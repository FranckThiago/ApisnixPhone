#!/usr/bin/env python3
"""Prepare the exact Desktop SDK using reachable, commit-verified mirrors."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = ROOT / 'apps/desktop'
SDK = DESKTOP / 'external/linphone-sdk'


def git(directory, *args, capture=False):
    command = ['git', '-C', str(directory), *args]
    if capture:
        return subprocess.check_output(command, text=True).strip()
    subprocess.run(command, check=True)


def preserve_existing(directory, expected):
    if (directory / '.git').exists():
        if git(directory, 'rev-parse', 'HEAD', capture=True) != expected:
            raise SystemExit(f'Existing revision preserved: {directory}')
        if git(directory, 'status', '--porcelain', '--ignore-submodules=all', capture=True):
            raise SystemExit(f'Existing changes preserved: {directory}')


def main():
    lock = json.loads((ROOT / 'desktop-sdk.lock.json').read_text())
    desktop_lock = json.loads((ROOT / 'sources.lock.json').read_text())['desktop']
    if git(DESKTOP, 'rev-parse', 'HEAD', capture=True) != desktop_lock['commit']:
        raise SystemExit('Unexpected Desktop revision; existing checkout preserved.')
    entry = git(DESKTOP, 'ls-tree', 'HEAD', 'external/linphone-sdk', capture=True)
    if entry.split()[2] != lock['commit']:
        raise SystemExit('SDK lock does not match the upstream Desktop gitlink.')
    preserve_existing(SDK, lock['commit'])
    git(DESKTOP, 'config', 'submodule.linphone-sdk.url', lock['url'])
    # Keep SDK history for upstream version detection while avoiding old file blobs.
    git(DESKTOP, 'submodule', 'update', '--init', '--filter=blob:none', '--', 'external/linphone-sdk')
    if git(SDK, 'rev-parse', 'HEAD', capture=True) != lock['commit']:
        raise SystemExit('SDK commit verification failed.')
    tree = git(SDK, 'ls-tree', '-r', 'HEAD', capture=True)
    actual = {}
    for line in tree.splitlines():
        metadata, path = line.split('\t', 1)
        mode, kind, commit = metadata.split()
        if kind == 'commit':
            actual[path] = commit
    expected = {entry['path']: entry['commit'] for entry in lock['submodules'] + lock['disabled_submodules']}
    if actual != expected:
        raise SystemExit('Dependency lock differs from the original SDK gitlinks.')
    names = {}
    config = git(SDK, 'config', '-f', '.gitmodules', '--get-regexp', r'^submodule\..*\.path$', capture=True)
    for line in config.splitlines():
        key, path = line.split(None, 1)
        names[path] = key[:-len('.path')]
    for entry in lock['submodules']:
        preserve_existing(SDK / entry['path'], entry['commit'])
        git(SDK, 'config', names[entry['path']] + '.url', entry['url'])
    for entry in lock['disabled_submodules']:
        git(SDK, 'config', names[entry['path']] + '.update', 'none')
    paths = [entry['path'] for entry in lock['submodules']]
    git(SDK, 'submodule', 'update', '--init', '--recursive', '--depth', '1', '--jobs', '4', '--', *paths)
    for entry in lock['submodules']:
        if git(SDK / entry['path'], 'rev-parse', 'HEAD', capture=True) != entry['commit']:
            raise SystemExit(f'Dependency commit verification failed: {entry["path"]}')
    print(f'Verified SDK and {len(paths)} dependency commits against upstream gitlinks.')


if __name__ == '__main__':
    main()
