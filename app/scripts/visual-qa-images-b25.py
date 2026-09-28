#!/usr/bin/env python3
"""Optional Pillow visual-integrity QA for B25 masters, responsive variants and alpha."""
import json
import statistics
import time
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

APP=Path(__file__).resolve().parent.parent
manifest=json.loads((APP/'docs/image-assets-b25.json').read_text())
items=manifest['items']
metrics={'checked':0,'failures':[],'source':[],'1x':[],'2x':[],'alpha':0,'paletteOriginals':0}
for entry in items:
    source=APP/entry['source']['file']
    with Image.open(source) as sourceImg:
        if sourceImg.mode=='P': metrics['paletteOriginals']+=1
        full=sourceImg.convert('RGBA')
    if full.getextrema()[3][0]<255:metrics['alpha']+=1
    for label in ('1x','2x'):
        variant=entry['variants'][label]
        t=time.perf_counter()
        with Image.open(APP/variant['file']) as im:
            actual=im.convert('RGBA');actual.load()
        metrics[label].append((time.perf_counter()-t)*1000)
        expected=full.resize(actual.size,Image.Resampling.LANCZOS) if actual.size!=full.size else full
        if ImageChops.difference(expected,actual).getbbox():metrics['failures'].append((entry['id'],label,'pixel differs from lossless LANCZOS master'))
        if not actual.getbands()==('R','G','B','A'):metrics['failures'].append((entry['id'],label,'alpha lost'))
    metrics['checked']+=1
    t=time.perf_counter()
    with Image.open(source) as master:
        master.load()
    metrics['source'].append((time.perf_counter()-t)*1000)
if metrics['failures']:raise ValueError(metrics['failures'][:10])
# Human-readable contact sheet: source decoded to the *same* CSS slot and 1x/2x
# derivatives on checkerboard. It is a controlled pixel QA, not a browser screenshot.
ids=['/assets/icons/vp.png','/assets/items/recruit_ticket.png','/assets/items/challenger_box.png','/ranks/pokeball.png','/ranks/challenger.png','/pokemon-artwork/venusaur.png','/pokemon-artwork/greninja-mega.png']
lookup={row['id']:row for row in items}
w,h=975,len(ids)*155+75
sheet=Image.new('RGB',(w,h),(227,234,247));draw=ImageDraw.Draw(sheet)
draw.text((12,12),'B25: original master vs lossless 1x vs 2x at the same CSS size',fill=(25,39,58))
for i,key in enumerate(ids):
 row=lookup[key];target=min(112,row['displayCssPx']);y=i*155+46
 draw.text((12,y),key.rsplit('/',1)[-1],fill=(29,46,66))
 files=[row['source']['file'],row['variants']['1x']['file'],row['variants']['2x']['file']]
 for j,file in enumerate(files):
  with Image.open(APP/file) as original:
   image=original.convert('RGBA').resize((target,target),Image.Resampling.LANCZOS)
  x=285+j*226
  for a in range(0,124,12):
   for b in range(0,124,12):
    grey=(222,225,226) if (a//12+b//12)%2 else (251,251,251)
    draw.rectangle((x+a,y+b+20,x+a+11,y+b+31),fill=grey)
  sheet.paste(image,(x+(124-target)//2,y+20+(124-target)//2),image)
  draw.text((x,y),['master rendered','1x rendered','2x rendered'][j],fill=(29,46,66))
out=APP/'docs/image-qa-b25.png';sheet.save(out,optimize=True)
def perf(nums):
 return {'p50Ms':round(statistics.median(nums),3),'p95Ms':round(sorted(nums)[int((len(nums)-1)*.95)],3)}
report={'scope':'Pillow full-pixel QA of stored lossless variants; not a browser timing measurement',
 'checkedImages':metrics['checked'],'checkedVariants':metrics['checked']*2,
 'alphaSources':metrics['alpha'],'paletteArtworkSources':metrics['paletteOriginals'],
 'mismatchedPixels':len(metrics['failures']), 'sampleImage':out.relative_to(APP).as_posix(),
 'decodeBench':{key:perf(metrics[key]) for key in ('source','1x','2x')}}
(APP/'docs/image-qa-b25.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
