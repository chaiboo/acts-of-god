"""
Download CAP (Caselaw Access Project) static bulk data for selected NY reporters.

CAP is fully open since 2024 and hosted at static.case.law. Each reporter is
organized as zip files per volume; each zip contains one JSON per case. We
download zips (small, ~1MB each) rather than tars (include PDFs, ~160MB each).

Scope for MVP: NY Court of Appeals + NY Reports 2d/3d + NY Supplement (partial).
This gives us 1847-2017 coverage of New York's highest state court, with a real
gap 1917-1956 (volumes not digitized by CAP) and a post-2017 gap overall.
These gaps are acknowledged limitations; MVP lives with them.
"""

from __future__ import annotations

import concurrent.futures as cf
import json
import sys
from pathlib import Path

import requests

# Repo-relative paths resolved from this file's location so the script runs
# from anywhere.
HERE = Path(__file__).resolve().parent
REPO = HERE.parent
RAW = REPO / "data" / "raw"

BASE = "https://static.case.law"

# Reporters selected for coverage, not completeness. ny + ny-2d + ny3d give
# us the New York Court of Appeals (state supreme court) as a single
# institutional voice across time, which keeps court-level confounds out of
# the trend analysis. nys is added to thicken the late-19th / early-20th
# century record with Appellate Division opinions.
REPORTERS = ["ny", "ny-2d", "ny3d", "nys", "ill", "ill-2d"]


def volume_list(reporter: str) -> list[dict]:
    """Fetch VolumesMetadata.json for a reporter."""
    url = f"{BASE}/{reporter}/VolumesMetadata.json"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json()


def download_zip(reporter: str, volume_number: str, out_dir: Path) -> Path | None:
    """Download a single volume zip if not already cached. Returns path or None on failure."""
    out_path = out_dir / f"{volume_number}.zip"
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path
    url = f"{BASE}/{reporter}/{volume_number}.zip"
    try:
        r = requests.get(url, timeout=120, stream=True)
        if r.status_code != 200:
            print(f"  MISS {reporter}/{volume_number}: HTTP {r.status_code}", file=sys.stderr)
            return None
        tmp = out_path.with_suffix(".zip.part")
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)
        tmp.rename(out_path)
        return out_path
    except Exception as e:
        print(f"  FAIL {reporter}/{volume_number}: {e}", file=sys.stderr)
        return None


def download_reporter(reporter: str, workers: int = 8) -> tuple[int, int]:
    """Download all volumes for a reporter. Returns (downloaded, total)."""
    out_dir = RAW / reporter
    out_dir.mkdir(parents=True, exist_ok=True)
    vols = volume_list(reporter)
    print(f"[{reporter}] {len(vols)} volumes")

    # Save metadata locally for reproducibility
    (out_dir / "VolumesMetadata.json").write_text(json.dumps(vols, indent=2))

    ok = 0
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {
            ex.submit(download_zip, reporter, v["volume_number"], out_dir): v["volume_number"]
            for v in vols
        }
        for i, fut in enumerate(cf.as_completed(futures), 1):
            if fut.result() is not None:
                ok += 1
            if i % 25 == 0 or i == len(vols):
                print(f"  [{reporter}] {i}/{len(vols)} done", flush=True)
    return ok, len(vols)


def main() -> None:
    total_ok = 0
    total = 0
    for rep in REPORTERS:
        ok, n = download_reporter(rep)
        total_ok += ok
        total += n
    print(f"\nTotal: {total_ok}/{total} volumes downloaded across {len(REPORTERS)} reporters.")


if __name__ == "__main__":
    main()
