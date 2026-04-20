"""
Classify act-of-God windows via Vertex AI batch predictions (Gemini 2.5 Pro).

Same four-axis prompt as the earlier live-API draft — event_type, domain,
disposition, really_adjudicated — just routed through Vertex's async batch
endpoint. For ~100-case slices this is overkill latency-wise, but it keeps the
pipeline on the same infra the rest of the project uses, and costs roughly
half of synchronous Gemini pricing.

Prereqs
-------
- GCP project with Vertex AI API enabled.
- A GCS bucket in the same region you submit the job from.
- `gcloud auth application-default login`  (or a service account key via
  GOOGLE_APPLICATION_CREDENTIALS).
- pip install google-genai google-cloud-storage pandas pyarrow

Env vars
--------
GOOGLE_CLOUD_PROJECT   required — GCP project id.
GOOGLE_CLOUD_LOCATION  default: us-central1.
GCS_BUCKET             required — bucket name only (no `gs://`).
GCS_PREFIX             default: acts-of-god/batch — GCS key prefix.

Flow
----
1. Load hits.parquet; pick one window per case (prefer active, then quotation,
   then boilerplate, then related_term).
2. Write a local JSONL of Vertex batch requests.
3. Upload to GCS.
4. Submit batch job; poll until JOB_STATE_SUCCEEDED or terminal failure.
5. Download output JSONL; parse; join back to case metadata.
6. Write data/processed/classified.parquet.

Running
-------
  python3 src/classify.py                # submit a new batch and wait
  python3 src/classify.py --build-only   # build JSONL, don't submit
  python3 src/classify.py --resume JOB   # poll an existing job resource name
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
INTERIM = REPO / "data" / "interim"
PROCESSED = REPO / "data" / "processed"
BATCH_DIR = INTERIM / "batch"
BATCH_DIR.mkdir(parents=True, exist_ok=True)

REQUESTS_JSONL = BATCH_DIR / "requests.jsonl"
RESULTS_JSONL = BATCH_DIR / "results.jsonl"
JOB_STATE_FILE = BATCH_DIR / "job.json"

MODEL = "gemini-2.5-pro"

PROMPT = """You are a legal research assistant coding a window of text from a U.S. appellate opinion that mentions the phrase "act of God."

Classify the mention along four axes. Return ONLY valid JSON.

Schema:
{
  "event_type": one of ["flood","storm_wind","lightning_fire","earthquake","ice_freeze","drought","disease","animal","geological","carrier_boilerplate","none_discussed","other"],
  "domain": one of ["tort","contract","admiralty","common_carrier","insurance","environmental","property","other"],
  "disposition": one of ["succeeded","failed","not_reached","unclear"],
  "really_adjudicated": true | false,
  "rationale": a brief (<=200 chars) quote or paraphrase explaining disposition
}

Rules:
- "succeeded" means the court accepted the act-of-God defense as a complete or partial bar to liability IN THIS CASE.
- "failed" means the court rejected the defense.
- "not_reached" means the court declined to decide (e.g., "we need not reach the act of God argument").
- "unclear" only if genuinely ambiguous after close reading.
- "carrier_boilerplate" event_type indicates the phrase appears only as a recitation of the common-carrier rule ("acts of God or the public enemy") without the court adjudicating a specific event.
- "really_adjudicated" is FALSE when the phrase appears only in quoted text from another case, in a footnote, or as doctrinal recitation without application.
- "none_discussed" for event_type when the phrase appears but no specific natural event is at issue in this window.

Window:
<<<
{WINDOW}
>>>

Return JSON only."""


MENTION_PRIORITY = {"active": 0, "quotation": 1, "boilerplate": 2, "related_term": 3}


def select_case_level_windows(hits: pd.DataFrame) -> pd.DataFrame:
    df = hits.copy()
    df["_prio"] = df["mention_type"].map(MENTION_PRIORITY).fillna(9)
    df = df.sort_values(["case_id", "_prio", "paragraph_idx"])
    out = df.drop_duplicates(subset=["case_id"], keep="first").reset_index(drop=True)
    return out.drop(columns=["_prio"])


def build_request_record(row: pd.Series) -> dict:
    """One JSONL line in Vertex batch input format for Gemini."""
    window = (row["window"] or "")[:8000]
    return {
        "id": str(row["case_id"]),
        "request": {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": PROMPT.replace("{WINDOW}", window)}],
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json",
            },
        },
    }


def write_requests_jsonl(case_level: pd.DataFrame, path: Path) -> int:
    with open(path, "w") as f:
        for _, row in case_level.iterrows():
            f.write(json.dumps(build_request_record(row)) + "\n")
    return len(case_level)


def _env(name: str, default: str | None = None, required: bool = False) -> str:
    val = os.environ.get(name, default)
    if required and not val:
        print(f"ERROR: environment variable {name} is required.", file=sys.stderr)
        sys.exit(2)
    return val  # type: ignore[return-value]


def _gcs_client():
    try:
        from google.cloud import storage
    except ImportError:
        print("ERROR: google-cloud-storage not installed. pip install google-cloud-storage",
              file=sys.stderr)
        sys.exit(2)
    return storage.Client(project=_env("GOOGLE_CLOUD_PROJECT", required=True))


def upload_to_gcs(local: Path, bucket_name: str, key: str) -> str:
    client = _gcs_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(key)
    blob.upload_from_filename(str(local))
    return f"gs://{bucket_name}/{key}"


def download_prefix_jsonl(bucket_name: str, prefix: str, dest: Path) -> int:
    """Download every .jsonl under gs://bucket/prefix/ and concatenate to dest."""
    client = _gcs_client()
    bucket = client.bucket(bucket_name)
    blobs = [b for b in client.list_blobs(bucket, prefix=prefix) if b.name.endswith(".jsonl")]
    if not blobs:
        print(f"WARN: no .jsonl output under gs://{bucket_name}/{prefix}", file=sys.stderr)
    with open(dest, "wb") as out:
        for b in blobs:
            out.write(b.download_as_bytes())
            if not out.tell() or True:
                out.write(b"\n")
    return len(blobs)


def submit_batch(input_uri: str, output_uri: str) -> str:
    """Submit a Gemini batch prediction job on Vertex AI. Returns job resource name."""
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("ERROR: google-genai not installed. pip install google-genai", file=sys.stderr)
        sys.exit(2)

    client = genai.Client(
        vertexai=True,
        project=_env("GOOGLE_CLOUD_PROJECT", required=True),
        location=_env("GOOGLE_CLOUD_LOCATION", default="us-central1"),
    )
    job = client.batches.create(
        model=MODEL,
        src=input_uri,
        config=types.CreateBatchJobConfig(dest=output_uri),
    )
    return job.name


def poll_batch(job_name: str, interval_s: int = 30) -> dict:
    """Block until the job reaches a terminal state. Returns the final job dict."""
    from google import genai

    client = genai.Client(
        vertexai=True,
        project=_env("GOOGLE_CLOUD_PROJECT", required=True),
        location=_env("GOOGLE_CLOUD_LOCATION", default="us-central1"),
    )

    terminal = {"JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"}
    start = time.time()
    while True:
        job = client.batches.get(name=job_name)
        state = str(job.state)
        elapsed = int(time.time() - start)
        print(f"[{elapsed:>5}s] {state}")
        if any(s in state for s in terminal):
            dest = getattr(job, "dest", None)
            output_uri = getattr(dest, "gcs_uri", None) if dest is not None else None
            return {"name": job.name, "state": state, "output": output_uri}
        time.sleep(interval_s)


def parse_result_record(line: str) -> dict:
    """Parse one output JSONL line from Vertex batch. Shape is:
    {"id": ..., "request": {...}, "response": {"candidates": [{"content": {"parts":[{"text":"..."}]}}]}}
    or an error envelope."""
    try:
        rec = json.loads(line)
    except json.JSONDecodeError:
        return {"error": "line_json_parse_failed"}

    case_id = rec.get("id") or rec.get("custom_id")
    resp = rec.get("response") or {}
    # Vertex surfaces per-record errors as a `status` string (JSON-encoded)
    # with non-zero code when the request itself was rejected.
    status = rec.get("status")
    if isinstance(status, str) and status.strip().startswith("{"):
        try:
            status_obj = json.loads(status)
            if status_obj.get("code") and status_obj.get("code") != 0:
                return {"case_id": case_id, "error": status_obj.get("message", status)[:500]}
        except json.JSONDecodeError:
            pass
    err = rec.get("error") or (resp.get("error") if isinstance(resp, dict) else None)
    if err:
        return {"case_id": case_id, "error": json.dumps(err)[:500]}

    try:
        text = resp["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return {"case_id": case_id, "error": "no_text_in_response", "raw": json.dumps(resp)[:500]}

    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except Exception:
                return {"case_id": case_id, "error": "json_parse_failed", "raw": text[:500]}
        else:
            return {"case_id": case_id, "error": "no_json_in_text", "raw": text[:500]}

    # Some responses come back as a JSON array (one element per mention in the
    # window). Take the first element.
    if isinstance(parsed, list):
        parsed = parsed[0] if parsed else {}
    if not isinstance(parsed, dict):
        return {"case_id": case_id, "error": "unexpected_shape", "raw": text[:500]}

    parsed["case_id"] = case_id
    return parsed


def parse_results(path: Path) -> pd.DataFrame:
    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(parse_result_record(line))
    return pd.DataFrame(rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--build-only", action="store_true",
                    help="Build requests JSONL only; do not submit.")
    ap.add_argument("--resume", type=str, default=None,
                    help="Resource name of an existing batch job to poll.")
    args = ap.parse_args()

    hits = pd.read_parquet(INTERIM / "hits.parquet")
    case_level = select_case_level_windows(hits)
    n = write_requests_jsonl(case_level, REQUESTS_JSONL)
    print(f"wrote {REQUESTS_JSONL} ({n} requests, one per case)")

    if args.build_only:
        return

    bucket = _env("GCS_BUCKET", required=True)
    prefix = _env("GCS_PREFIX", default="acts-of-god/batch")
    input_key = f"{prefix}/requests.jsonl"
    output_prefix = f"{prefix}/output/"

    if args.resume:
        job_name = args.resume
        print(f"resuming job: {job_name}")
    else:
        input_uri = upload_to_gcs(REQUESTS_JSONL, bucket, input_key)
        output_uri = f"gs://{bucket}/{output_prefix}"
        print(f"uploaded -> {input_uri}")
        print(f"submitting batch to Vertex AI ({MODEL})...")
        job_name = submit_batch(input_uri, output_uri)
        with open(JOB_STATE_FILE, "w") as f:
            json.dump({"name": job_name, "input": input_uri, "output": output_uri}, f)
        print(f"job: {job_name}")

    final = poll_batch(job_name)
    print(f"terminal state: {final['state']}")
    if "SUCCEEDED" not in final["state"]:
        print("job did not succeed. check Vertex AI console for details.", file=sys.stderr)
        sys.exit(1)

    output_uri = (final.get("output") or f"gs://{bucket}/{output_prefix}").rstrip("/")
    if output_uri.startswith("gs://"):
        gcs_path = output_uri[len("gs://"):]
        dl_bucket, _, dl_prefix = gcs_path.partition("/")
    else:
        dl_bucket, dl_prefix = bucket, output_prefix
    n_files = download_prefix_jsonl(dl_bucket, dl_prefix.rstrip("/") + "/", RESULTS_JSONL)
    print(f"downloaded {n_files} output file(s) -> {RESULTS_JSONL}")

    parsed = parse_results(RESULTS_JSONL)
    # Join back case metadata so downstream code has the useful columns.
    meta_cols = ["case_id", "citation", "year", "reporter", "mention_type"]
    case_level["case_id"] = case_level["case_id"].astype(str)
    parsed["case_id"] = parsed["case_id"].astype(str)
    merged = parsed.merge(case_level[meta_cols].astype({"case_id": str}),
                          on="case_id", how="left")

    merged.to_parquet(PROCESSED / "classified.parquet", index=False)
    print(f"wrote {PROCESSED/'classified.parquet'} ({len(merged)} rows)")
    if "error" in merged.columns:
        n_err = merged["error"].notna().sum()
        print(f"parse errors: {n_err}")


if __name__ == "__main__":
    main()
