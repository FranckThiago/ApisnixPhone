#!/usr/bin/env python3
"""Save tracked APISNIX edits; do not copy upstream service/signing settings."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    sources = json.loads((ROOT / "sources.lock.json").read_text())
    patches = ROOT / "patches"
    patches.mkdir(exist_ok=True)
    for platform, source in sources.items():
        checkout = ROOT / "apps" / platform
        prefix = ["git", "-C", str(checkout)]
        commit = subprocess.check_output(prefix + ["rev-parse", "HEAD"], text=True).strip()
        if commit != source["commit"]:
            raise SystemExit(f"Unexpected base commit in {platform}; update sources.lock.json deliberately.")
        subprocess.run(prefix + ["status", "--short"], check=True)
        untracked = subprocess.check_output(prefix + ["ls-files", "--others", "--exclude-standard"], text=True)
        if untracked.strip():
            raise SystemExit(f"Untracked files in {platform}; include them deliberately before exporting.")
        exclusions = [f":(exclude){path}" for path in source["remove_upstream_files"]]
        patch = subprocess.check_output(prefix + ["diff", "--binary", "HEAD", "--", ".", *exclusions])
        (patches / f"{platform}.patch").write_bytes(patch)
        print(f"Saved {platform} customization ({len(patch)} bytes)")


if __name__ == "__main__":
    main()
