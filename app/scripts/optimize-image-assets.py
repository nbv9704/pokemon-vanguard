#!/usr/bin/env python3
"""Regenerate B25 responsive images from retained masters (optional build dependency: Pillow).

Only lossless RGBA PNG variants are generated. Animated/palette sprites are hashed
and inventoried but never resized, re-encoded, merged or deduplicated.
Run: python3 -m pip install Pillow; python3 scripts/optimize-image-assets.py
The production npm check only needs Node; it verifies stored PNGs/hash/dimensions.
"""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
SOURCE = ROOT / 'asset-masters' / 'ui'
MANIFEST = ROOT / 'docs' / 'image-assets-b25.json'
MODULE = PUBLIC / 'js' / 'image-variants.js'
RULES = {'assets/icons': (56,112), 'assets/items': (144,288), 'ranks': (104,208)}

def sha(data): return hashlib.sha256(data).hexdigest()
def info(path, url=None):
    data = path.read_bytes()
    with Image.open(path) as im:
        dimension = [*im.size]
        bands = im.getbands()
        alpha = 'A' in bands or 'transparency' in im.info
        frames = getattr(im,'n_frames',1)
    out = {'file':path.relative_to(ROOT).as_posix(),'sha256':sha(data),'bytes':len(data),'width':dimension[0],'height':dimension[1],'alpha':alpha}
    if url: out['url'] = url
    if frames > 1: out['frames'] = frames
    return out

def make_variant(image, folder, label, max_width):
    # Preserve aspect ratio and full RGBA transparency; LANCZOS for painted UI art.
    width = min(max_width, image.width)
    height = max(1, round(image.height*width/image.width))
    work = image.resize((width,height),Image.Resampling.LANCZOS) if width != image.width else image.copy()
    import io
    out = io.BytesIO(); work.save(out,format='PNG',optimize=True,compress_level=9)
    data = out.getvalue(); fingerprint = sha(data)[:16]
    name = f'{label}.{fingerprint}.{width}w.png'
    dest = folder / name
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(data)
    return info(dest, '/' + dest.relative_to(PUBLIC).as_posix())

def main():
    items=[]; expected=set(); optimized = PUBLIC / 'assets' / 'optimized'
    optimized.mkdir(parents=True,exist_ok=True)
    for folder,sizes in RULES.items():
        current = PUBLIC / folder
        for file in sorted(current.glob('*.png')):
            master = SOURCE / folder / file.name
            master.parent.mkdir(parents=True,exist_ok=True)
            if not master.exists(): shutil.copy2(file,master)
            with Image.open(master) as src:
                image = src.convert('RGBA')
                lower = folder.replace('/','-')
                v1 = make_variant(image,optimized,f'{lower}-{file.stem}',sizes[0]);expected.add(Path(v1['file']))
                v2 = make_variant(image,optimized,f'{lower}-{file.stem}',sizes[1]);expected.add(Path(v2['file']))
            # Keep existing public URLs for old saves, CSS backgrounds and legacy callers,
            # but serve a reasonable 2x fallback instead of a 1254px master.
            optimized2 = ROOT / v2['file']
            shutil.copyfile(optimized2,file)
            record={'id':f'/{folder}/{file.name}','category':folder,'source':info(master),
                'legacy':info(file, '/'+file.relative_to(PUBLIC).as_posix()),
                'displayCssPx':sizes[0], 'variants':{'1x':v1,'2x':v2},
                'attribution':'Project supplied UI artwork; source attribution not documented',
                'licenseStatus':'review-required-before-public-distribution', 'resize':'RGBA/LANCZOS lossless PNG'}
            items.append(record)
    # Artwork masters stay at original public path. Only small portrait/list views opt
    # into derivatives; full resolution art still goes to detail/hero screens.
    portraits=PUBLIC / 'pokemon-artwork' / 'portraits'; portraits.mkdir(parents=True,exist_ok=True)
    for path in sorted((PUBLIC/'pokemon-artwork').glob('*.png')):
        with Image.open(path) as original:
            img=original.convert('RGBA')
            v1=make_variant(img,portraits,path.stem,72);expected.add(Path(v1['file']))
            v2=make_variant(img,portraits,path.stem,144);expected.add(Path(v2['file']))
        items.append({'id':'/'+path.relative_to(PUBLIC).as_posix(),'category':'pokemon-artwork',
            'source':info(path), 'displayCssPx':72,'variants':{'1x':v1,'2x':v2},
            'attribution':'See docs/pokemon-artwork-sources.md and content-src/presentation-asset-sources-v1.json',
            'licenseStatus':'third-party-rights-review-before-public-distribution',
            'resize':'RGBA/LANCZOS lossless PNG'})
    # Animated GIF and fallback PNG remain byte-for-byte unchanged, with inventory
    # so animation/frame/palette/form assets cannot be silently replaced.
    sprites=[]
    for folder in ['pokemon-sprites','pokemon-sprites/back']:
        for path in sorted((PUBLIC/folder).iterdir()):
            if path.is_file() and path.suffix.lower() in ('.gif','.png'):
                sprites.append({'id':'/'+path.relative_to(PUBLIC).as_posix(),**info(path),
                    'kind':'animated-pixel-sprite' if path.suffix.lower()=='.gif' else 'static-pixel-sprite',
                    'licenseStatus':'review-upstream-rights-before-public-distribution'})
    for folder in (optimized,portraits):
        for path in folder.glob('*.png'):
            if Path(path.relative_to(ROOT).as_posix()) not in expected: path.unlink()
    items.sort(key=lambda row:row['id']); sprites.sort(key=lambda row:row['id'])
    manifest={'schemaVersion':1,'scope':'local image delivery (not a distribution license)',
        'notes':['No third-party license is implied by inclusion or a source URL.',
          'UI masters retained under asset-masters/ui, legacy paths are safe 2x fallbacks.',
          'Artwork large masters retained in public for detail screens; pixel sprites preserved without processing.',
          'Missing external UI symbol mirror remains a separately tracked #27 dependency.'],
        'items':items,'sprites':sprites}
    MANIFEST.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    lookup={row['id']:{'width':row['displayCssPx'],
             'one':row['variants']['1x']['url'],'two':row['variants']['2x']['url']}
            for row in items}
    attrs = 'export function imageAttributes(src,{lazy=true,size}={}){const entry=imageVariant(src);if(!entry)return `src="${String(src).replace(/[&<>"\']/g,char=>({\'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\'}[char]))}"${lazy?\' loading="lazy" decoding="async"\':\'\'}`;const w=size||entry.width;return `src="${src}" srcset="${entry.one} 1x, ${entry.two} 2x" width="${w}" height="${w}"${lazy?\' loading="lazy" decoding="async"\':\' fetchpriority="high"\'}`;}\n'
    MODULE.write_text('// Generated by scripts/optimize-image-assets.py. Do not edit by hand.\n'
        'export const IMAGE_VARIANTS=Object.freeze('+json.dumps(lookup,ensure_ascii=False,separators=(',',':'))+');\n'
        'export function imageVariant(src){return IMAGE_VARIANTS[src]||null;}\n'
        + attrs, encoding='utf8')
    b_original=sum(r['source']['bytes'] for r in items if r['category']!='pokemon-artwork')
    b_optimized=sum(r['variants']['1x']['bytes']+r['variants']['2x']['bytes'] for r in items if r['category']!='pokemon-artwork')
    print(f'B25 generated {len(items)} responsive image entries ({len(items)*2} variants) + {len(sprites)} pinned pixel sprites; UI source {b_original:,} bytes, 1x+2x {b_optimized:,} bytes')

if __name__=='__main__':main()
