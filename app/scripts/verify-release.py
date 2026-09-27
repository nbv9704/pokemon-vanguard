#!/usr/bin/env python3
"""Verify source-archive per-file SHA-256, CRC, membership, and private-path safety."""
import argparse
import hashlib
import json
import stat
import sys
from pathlib import PurePosixPath
from zipfile import ZipFile

from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
sys.dont_write_bytecode=True
spec=spec_from_file_location('safe_package',Path(__file__).with_name('package-full.py'))
module=module_from_spec(spec);spec.loader.exec_module(module)


def verify(archive_path):
    with ZipFile(archive_path) as archive:
        names=archive.namelist()
        if len(names)!=len(set(names)): raise ValueError('Duplicate archive member')
        manifest_names=[name for name in names if name.endswith('/'+module.MANIFEST)]
        if len(manifest_names)!=1: raise ValueError('Missing/duplicate release manifest')
        manifest=json.loads(archive.read(manifest_names[0]))
        root=manifest['root']
        if manifest['schemaVersion']!=1 or manifest['kind']!='source' or manifest_names[0]!=root+'/'+module.MANIFEST:
            raise ValueError('Invalid release manifest')
        expected={root+'/'+row['path']:row for row in manifest['files']}
        if set(names)!=(set(expected)|set(manifest_names)):raise ValueError('Archive membership differs from manifest')
        for name in names:
            mode=stat.S_IFMT(archive.getinfo(name).external_attr >> 16)
            if mode and mode!=stat.S_IFREG:raise ValueError(f'Unsafe archive entry mode: {name}')
            parts=PurePosixPath(name).parts
            if not parts or parts[0]!=root or '..' in parts or any(part.lower() in module.SKIP_DIRS for part in parts) or module.private(parts[-1]):
                raise ValueError(f'Unsafe path: {name}')
        for name,row in expected.items():
            digest=hashlib.sha256();size=0
            with archive.open(name) as handle:
                while chunk:=handle.read(1024*1024):digest.update(chunk);size+=len(chunk)
            if size!=row['bytes'] or digest.hexdigest()!=row['sha256']:raise ValueError(f'Content mismatch: {name}')
        if archive.testzip():raise ValueError('Archive CRC failure')
        return len(expected)+1


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive',type=Path)
    args=parser.parse_args()
    print(f'Verified release: {verify(args.archive)} files, manifest/CRC/security PASS')
