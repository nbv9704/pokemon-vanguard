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
        if manifest['schemaVersion']!=1 or manifest['kind'] not in ('source','runtime') or manifest_names[0]!=root+'/'+module.MANIFEST:
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
        # B27: independently validate archive-level catalog membership and immutable
        # content against the retention policy stored INSIDE the ZIP (no host trust).
        retention_name=root+'/app/content-active/retention-manifest.json'
        if manifest['kind']=='runtime' and retention_name not in names:
            raise ValueError('Runtime archive missing catalog retention policy')
        if retention_name in names:
            policy=json.loads(archive.read(retention_name))
            ptr=json.loads(archive.read(root+'/app/content-active/active.json'))
            entries=policy.get('catalogs', [])
            if policy.get('schemaVersion')!=1 or policy.get('policy')!='catalog-retention-b27' or not entries:
                raise ValueError('Invalid zipped catalog retention policy')
            active=ptr.get('catalogVersion')
            if ptr.get('catalogFile')!=f'catalogs/{active}/catalog.json':
                raise ValueError('Invalid zipped active pointer')
            expected_snapshots=set();seen=set();found_active=0
            for item in entries:
                version=item.get('version','')
                if not isinstance(version,str) or not version.startswith('pv-') or not version.replace('-','').isalnum() or version in seen:
                    raise ValueError('Invalid zipped catalog policy entry')
                seen.add(version)
                is_active=version==active
                if item.get('classification')!=('active-runtime' if is_active else 'source-history'):
                    raise ValueError(f'Stale zipped catalog class: {version}')
                if is_active:
                    found_active+=1
                    if item.get('sha256')!=ptr.get('sha256'):
                        raise ValueError('Zipped active hash mismatch')
                name=f'{root}/app/content-active/catalogs/{version}/catalog.json'
                if manifest['kind']=='source' or is_active:
                    expected_snapshots.add(name)
                    if name not in names:raise ValueError(f'Zipped catalog absent: {version}')
                    data=archive.read(name)
                    if len(data)!=item.get('bytes') or hashlib.sha256(data).hexdigest()!=item.get('sha256'):
                        raise ValueError(f'Zipped catalog corrupted: {version}')
                    metadata=json.loads(data).get('metadata',{})
                    if metadata.get('catalogVersion')!=version or metadata.get('schemaVersion')!=3:
                        raise ValueError(f'Zipped catalog metadata wrong: {version}')
                elif name in names:
                    raise ValueError(f'Runtime archive contains historical catalog: {version}')
            if found_active!=1:raise ValueError('Missing unique active catalog')
            included={n for n in names if n.startswith(root+'/app/content-active/catalogs/')}
            if included!=expected_snapshots:raise ValueError('Unexpected catalog in ZIP')
        if archive.testzip():raise ValueError('Archive CRC failure')
        return len(expected)+1


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive',type=Path)
    args=parser.parse_args()
    print(f'Verified release: {verify(args.archive)} files, manifest/CRC/security PASS')
