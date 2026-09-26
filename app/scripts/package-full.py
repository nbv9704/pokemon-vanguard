#!/usr/bin/env python3
"""Reproducible full-source ZIP without local credentials or local player state.

Run from app/: python3 scripts/package-full.py --output /path/to/full.zip
"""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

SKIP_DIRS = {'.git', '.local-data', '.wrangler', '__pycache__', '.pytest_cache', 'logs'}
SKIP_FILES = {'.dev.vars', '.DS_Store', 'id_rsa', 'id_ed25519'}
PRIVATE_SUFFIXES = ('.pem', '.p12', '.pfx', '.key')


def private(name):
    lower = name.lower()
    if lower in SKIP_FILES or lower.endswith(PRIVATE_SUFFIXES) or lower.endswith(('.log', '.zip', '.tmp', '.sqlite', '.sqlite3')):
        return True
    if lower.startswith(('.env', '.dev.vars')) and lower not in {'.env.example', '.dev.vars.example'}:
        return True
    return False


def collect(project):
    if not (project / 'app' / 'package.json').is_file():
        raise ValueError(f'Not a full Pokémon Vanguard project: {project}')
    for item in sorted(project.rglob('*')):
        rel = item.relative_to(project)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if private(item.name):
            continue
        if item.is_symlink():
            # Never follow links that could lead outside the project into secrets.
            continue
        if item.is_file():
            yield item, rel


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    project = args.project_root.resolve()
    output = (args.output or (project.parent / 'PokemonVanguard_full_safe.zip')).resolve()
    if output.is_relative_to(project):
        raise ValueError('Write archive outside project root to avoid archiving the output itself.')
    output.parent.mkdir(parents=True, exist_ok=True)
    files = list(collect(project))
    if not (project / 'app' / '.dev.vars.example').is_file():
        raise ValueError('Missing safe environment template app/.dev.vars.example')
    if any(path.name == '.dev.vars' for path, _ in files):
        raise ValueError('Secret-bearing .dev.vars file would enter archive.')
    with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for path, rel in files:
            archive.write(path, (Path(project.name) / rel).as_posix())
    with ZipFile(output) as archive:
        broken = archive.testzip()
        if broken:
            raise ValueError(f'Archive CRC failure: {broken}')
        names = archive.namelist()
        if any(private(Path(name).name) or '.local-data' in Path(name).parts for name in names):
            raise ValueError('Unsafe private path in resulting archive')
    print(f'Full project ZIP ready: {output.name} ({len(files)} files, {output.stat().st_size:,} bytes)')
    print('Excluded: local environment secrets, player saves, logs, caches and private keys.')


if __name__ == '__main__':
    main()
