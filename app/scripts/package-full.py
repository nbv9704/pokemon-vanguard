#!/usr/bin/env python3
"""Build a content-verified, deterministic-metadata full-source ZIP; no secrets or saves.

Run: python3 scripts/package-full.py --project-root PATH --output /outside/project.zip
Use scripts/verify-release.py to validate the ZIP's embedded SHA-256 manifest.
"""
import argparse
import hashlib
import json
import stat
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

SKIP_DIRS = {
    '.admin-backups', '.campaigns', '.transactions', '.git', '.local-data', '.wrangler', '__pycache__',
    '.pytest_cache', 'backups', 'content-candidates', 'dist', 'logs', 'node_modules', 'reports',
}
SKIP_FILES = {'.dev.vars', '.ds_store', 'id_rsa', 'id_ed25519'}
PRIVATE_SUFFIXES = ('.pem', '.p12', '.pfx', '.key')
# Stable timestamp and permissions, including the embedded manifest. ZIP DEFLATE bytes
# may differ across zlib implementations; the per-file SHA-256 manifest is portable.
ZIP_DATE = (2026, 1, 1, 0, 0, 0)
MANIFEST = 'RELEASE-MANIFEST.json'
ARCHIVE_ROOT = 'PokemonVanguard'


def private(name):
    lower = name.lower()
    if lower in SKIP_FILES or lower.endswith(PRIVATE_SUFFIXES) or lower.endswith(('.log', '.zip', '.tmp', '.sqlite', '.sqlite3')):
        return True
    if lower.startswith(('.env', '.dev.vars')) and lower not in {'.env.example', '.dev.vars.example'}:
        return True
    return False


def link_or_junction(item):
    """Return true for POSIX symlinks and Windows reparse-point junctions."""
    details = item.lstat()
    return item.is_symlink() or bool(getattr(details, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0))


def walk(directory, project, excluded):
    # Prune private directories before descending. Do not follow symlinks/junctions.
    for item in sorted(directory.iterdir(), key=lambda p: p.name):
        rel = item.relative_to(project)
        if link_or_junction(item):
            excluded.append((rel.as_posix(), 'symlink'))
        elif item.name.lower() in SKIP_DIRS and item.is_dir():
            excluded.append((rel.as_posix()+'/', 'excluded-directory'))
        elif private(item.name):
            excluded.append((rel.as_posix(), 'private-file'))
        elif item.is_dir():
            yield from walk(item, project, excluded)
        elif item.is_file() and item.name != MANIFEST:
            yield item, rel
        elif item.name == MANIFEST:
            excluded.append((rel.as_posix(), 'generated-manifest'))


def collect(project, excluded=None):
    if not (project / 'app' / 'package.json').is_file():
        raise ValueError(f'Not a full Pokémon Vanguard project: {project}')
    return list(walk(project, project, excluded if excluded is not None else []))


def zipinfo(name):
    info = ZipInfo(name, ZIP_DATE)
    info.create_system = 3
    info.external_attr = (0o100644 << 16)
    info.compress_type = ZIP_DEFLATED
    return info


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path)
    parser.add_argument('--dry-run', action='store_true', help='Print included files and excluded paths/reasons without creating ZIP')
    args = parser.parse_args()
    project = args.project_root.resolve()
    output = (args.output or (project.parent / 'PokemonVanguard_full_safe.zip')).resolve()
    if output.is_relative_to(project):
        raise ValueError('Write archive outside project root to avoid archiving the output itself.')
    excluded = []
    files = collect(project, excluded)
    if not (project / 'app' / '.dev.vars.example').is_file():
        raise ValueError('Missing safe environment template app/.dev.vars.example')
    if args.dry_run:
        for _, rel in files: print(f'INCLUDED {rel.as_posix()}')
        for name, reason in excluded: print(f'EXCLUDED {reason} {name}')
        print(f'{len(files)} included, {len(excluded)} excluded')
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    records = []
    with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for full, rel in files:
            data = full.read_bytes()
            name = (Path(ARCHIVE_ROOT) / rel).as_posix()
            archive.writestr(zipinfo(name), data, compress_type=ZIP_DEFLATED, compresslevel=6)
            records.append({'path': rel.as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        body = json.dumps({'schemaVersion': 1, 'kind': 'source', 'root': ARCHIVE_ROOT, 'files': records}, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf8')+b'\n'
        archive.writestr(zipinfo(f'{ARCHIVE_ROOT}/{MANIFEST}'), body, compress_type=ZIP_DEFLATED, compresslevel=6)
    with ZipFile(output) as archive:
        bad = archive.testzip()
        if bad: raise ValueError(f'Archive CRC failure: {bad}')
        names = archive.namelist()
        if any(private(Path(name).name) or any(part.lower() in SKIP_DIRS for part in Path(name).parts) for name in names):
            raise ValueError('Unsafe private path in resulting archive')
    print(f'Full project ZIP ready: {output.name} ({len(files)+1} files, {output.stat().st_size:,} bytes)')
    print('Included content SHA-256 manifest; excluded secrets, player saves, logs and caches.')


if __name__ == '__main__':
    main()
