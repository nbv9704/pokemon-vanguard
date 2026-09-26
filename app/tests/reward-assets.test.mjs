import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {UI_ICONS,TICKET_ASSETS,RANK_BOX_ASSETS,rewardAsset,rankBoxAsset,rewardIcon} from '../public/js/reward-assets.js';
import {MissionView} from '../public/js/mission-view.js';
import {ShopView} from '../public/js/shop-view.js';

const source=rel=>readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const runPython=args=>{
 const configured=process.env.PYTHON?.trim(),candidates=configured?[[configured,[]]]:process.platform==='win32'?[['py',['-3']],['python',[]],['python3',[]]]:[['python3',[]],['python',[]]];
 let last;
 for(const [command,prefix] of candidates){last=spawnSync(command,[...prefix,...args],{encoding:'utf8'});if(!last.error||last.error.code!=='ENOENT')return last;}
 return last;
};

test('reward assets expose only existing ticket and rank variants',()=>{
 assert.equal(Object.keys(UI_ICONS).length,3);
 assert.deepEqual(Object.keys(TICKET_ASSETS),['training','recruitment','rank','shop']);
 assert.deepEqual(Object.keys(RANK_BOX_ASSETS),['pokeball','greatball','ultraball','masterball','challenger']);
 for(const src of [...Object.values(UI_ICONS),...Object.values(TICKET_ASSETS),...Object.values(RANK_BOX_ASSETS)]){
  const png=readFileSync(new URL(`../public${src}`,import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 }
 assert.equal(rewardAsset('recruitmentTicket'),TICKET_ASSETS.recruitment);
 assert.equal(rankBoxAsset('ChAlLeNgEr'),RANK_BOX_ASSETS.challenger);
 assert.equal(rankBoxAsset('legendary'),null); // no phantom asset or unapproved drop mechanic
 assert.equal(rewardIcon('unknown'),'');
 assert.match(rewardIcon('vp','sample-button'),/class="reward-asset-icon sample-button"/);
 assert.doesNotMatch(rewardIcon('vp','bad" onerror="alert(1)'),/onerror/);
});

test('currency/resource icons are wired in both app shells and override image pixelation',()=>{
 const client=source('public/client.js');
 assert.match(client,/rewardIcon\("vp"\)/);
 assert.match(client,/rewardIcon\("pokegem"\)/);
 assert.doesNotMatch(client,/class="currency" title="Recruitment tickets"/);
 assert.match(client,/data-action="bag"/);
 assert.match(client,/rewardIcon\('vp','mail-reward-icon'\)/);
 for(const shell of ['public/index.html','public/classic.html'])assert.match(source(shell),/reward-assets\.css/);
 const css=source('public/reward-assets.css');
 assert.match(css,/image-rendering:auto!important/);
 assert.match(css,/\.currency-icon/);
});

test('mission/shop screen images do not change mission or purchase actions',()=>{
 const sent=[],missions=new MissionView({sendAction:a=>sent.push(a),onChange(){},createActionId:()=> 'batch:asset'});
 const mission={id:'mission1',title:'Test',description:'Test',progress:1,target:1,reward:{recruitmentTickets:2,coins:10,crystals:0},claimable:true,claimed:false,complete:true,route:'shop'};
 assert.match(missions.card(mission),/\/assets\/items\/recruit_ticket\.png/);
 assert.match(missions.card({...mission,reward:{crystals:10}}),/\/assets\/icons\/pokegem\.png/);
 assert.match(missions.card({...mission,reward:{coins:10}}),/\/assets\/icons\/vp\.png/);
 missions.handleClick({dataset:{mission:'claim',category:'daily',missionId:'mission1'}});
 assert.deepEqual(sent[0],{type:'mission.claim',category:'daily',missionId:'mission1',actionId:'batch:asset'});
 const shop=new ShopView({sendAction:a=>sent.push(a),onChange(){},createActionId:()=> 'batch:asset'});
 const item={id:'charcoal',name:'Charcoal',category:'held-item',priceCoins:700,source:'shop',sourceLabel:'Shop',owned:false,purchasable:true};
 const html=shop.render({shopV3:{items:[item],balanceCoins:999,ownedCount:0,totalCount:1}});
 assert.doesNotMatch(html,/\/assets\/icons\/bag\.png/);
 assert.match(source('public/js/bag-view.js'),/\/assets\/icons\/bag\.png/);
 assert.match(html,/\/assets\/icons\/vp\.png/);
 shop.handleClick({dataset:{shop:'buy',itemId:'charcoal'}});
 assert.deepEqual(sent[1],{type:'shopV3.buy',itemId:'charcoal',payment:'coins',actionId:'batch:asset'});
});

test('full ZIP packager excludes secret files and player saves while preserving safe examples',()=>{
 const tmp=mkdtempSync(path.join(os.tmpdir(),'pv-package-test-')),root=path.join(tmp,'Fixture'),app=path.join(root,'app'),out=path.join(tmp,'full.zip');
 try{
  mkdirSync(path.join(app,'.local-data'),{recursive:true});mkdirSync(path.join(app,'public'),{recursive:true});
  writeFileSync(path.join(app,'package.json'),'{}');
  writeFileSync(path.join(app,'.dev.vars.example'),'AUTH_ALLOW_LOCAL_BETA=false');
  writeFileSync(path.join(app,'.dev.vars'),'DO_NOT_SHIP_THIS_SESSION_SECRET');
  writeFileSync(path.join(app,'.env.production'),'DO_NOT_SHIP_THIS_ENVIRONMENT');
  writeFileSync(path.join(app,'.local-data','player.json'),'DO_NOT_SHIP_THIS_PLAYER_SAVE');
  writeFileSync(path.join(app,'public','index.html'),'public asset');
  const script=fileURLToPath(new URL('../scripts/package-full.py',import.meta.url));
  const result=runPython([script,'--project-root',root,'--output',out]);
  assert.equal(result.status,0,result.stderr);
  const verify=runPython(['-c',`import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({'names':z.namelist(),'bad':z.testzip(),'content':z.read('Fixture/app/public/index.html').decode()}))`,out]);
  assert.equal(verify.status,0,verify.stderr);
  const resultJson=JSON.parse(verify.stdout);
  assert.equal(resultJson.bad,null);
  assert.equal(resultJson.content,'public asset');
  assert.ok(resultJson.names.includes('Fixture/app/.dev.vars.example'));
  for(const filename of resultJson.names)assert.doesNotMatch(filename,/\.dev\.vars$|\.env\.production|\.local-data/);
 }finally{rmSync(tmp,{force:true,recursive:true});}
});
