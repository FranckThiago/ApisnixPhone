#!/usr/bin/env python3
"""Recreate an APISNIX checkout without replacing an existing working tree."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run(*args):
    subprocess.run(args, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("platform", choices=("android", "desktop"))
    parser.add_argument("--destination", type=Path)
    args = parser.parse_args()
    source = json.loads((ROOT / "sources.lock.json").read_text())[args.platform]
    destination = args.destination or ROOT / "apps" / args.platform
    if destination.exists():
        parser.error(f"Existing checkout preserved: {destination}. Choose a new destination.")
    patch = ROOT / "patches" / f"{args.platform}.patch"
    if not patch.is_file():
        parser.error(f"Missing customization patch: {patch}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    run("git", "clone", "--depth", "1", "--branch", source["tag"], source["url"], str(destination))
    commit = subprocess.check_output(
        ["git", "-C", str(destination), "rev-parse", "HEAD"], text=True
    ).strip()
    if commit != source["commit"]:
        raise SystemExit("Upstream tag no longer matches the locked commit; checkout left untouched.")
    run("git", "-C", str(destination), "status", "--short")
    run("git", "-C", str(destination), "apply", "--check", str(patch))
    run("git", "-C", str(destination), "apply", str(patch))
    for relative in source["remove_upstream_files"]:
        (destination / relative).unlink(missing_ok=True)
    print(f"Prepared {args.platform}: {destination}")


if __name__ == "__main__":
    main()
