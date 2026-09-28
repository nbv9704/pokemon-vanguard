import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderAccountControl,countUnreadMail,renderMailbox,renderSettingsPage} from '../public/js/client-chrome-views.js';
import {renderRoutePage,renderClientShell} from '../public/js/client-shell-layout.js';
import {renderConfirmDialog,renderLegacyDetailDialog,renderLegacyTypeChart} from '../public/js/client-modal-templates.js';
import {routeFeatureClick} from '../public/js/client-feature-action-router.js';
import {createAdminViews} from '../public/js/admin-views.js';
import {validateMechanicManifest} from '../mechanics-v3/manifest-contract.mjs';
import * as publicManifestContract from '../mechanics-v3/manifest-contract.mjs';
import {validateManifestHandlers} from '../mechanics-v3/manifest-handler-validation.mjs';
import {validateMoveManifest} from '../mechanics-v3/manifest-move-validation.mjs';
import {rankedProfileView,ensureRankedState,rankedRatingDelta} from '../server/ranked-v1.mjs';
import * as splitProfile from '../server/ranked-profile.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const head=(title,description,extra='')=>`<header>${esc(title)} ${esc(description)} ${esc(extra)}</header>`;
const btn=(text,action)=>`<button data-action="${esc(action)}">${esc(text)}</button>`;

test('account chrome keeps escaped names, safe avatars and menu state across extraction',()=>{
 const closed=renderAccountControl({auth:{name:'<Trainer>&',provider:'test',avatar:'" onerror="alert(1)',admin:true},userMenuOpen:false,esc});
 assert.match(closed,/&lt;Trainer&gt;&amp;/);assert.match(closed,/src="&quot; onerror=&quot;alert\(1\)"/);
 assert.match(closed,/admin-console/);assert.match(closed,/aria-expanded="false"/);assert.match(closed,/id="account-dropdown" role="menu" hidden/);
 const opened=renderAccountControl({auth:null,userMenuOpen:true,esc});
 assert.match(opened,/Local player/);assert.match(opened,/aria-expanded="true"/);
 assert.doesNotMatch(opened,/id="account-dropdown" role="menu" hidden/);
});

test('unread count favors authoritative mailbox projection and retains legacy fallback',()=>{
 assert.equal(countUnreadMail({mailboxV1:{unreadCount:9},mail:[0,1,2],adminGiftsV1:{unreadCount:2}}),9);
 assert.equal(countUnreadMail({mail:[0,2],adminGiftsV1:{unreadCount:3}}),4);
});

test('mailbox and settings templates retain escaping, claim and connection states',()=>{
 const empty=renderMailbox({V:{},mailOpenKey:null,pending:false,head,esc,btn});
 assert.match(empty,/Mailbox empty/);
 const mail={mailId:'safe-mail',sender:'<system>',title:'<prize>',message:'<text>',reward:{coins:42},unread:true,claimable:true,expiresAt:Date.now()+1e7};
 const opened=renderMailbox({V:{mailboxV1:{system:[mail],unreadCount:1,pendingCount:1}},mailOpenKey:'system:safe-mail',pending:false,head,esc,btn});
 assert.match(opened,/&lt;system&gt;/);assert.match(opened,/&lt;prize&gt;/);assert.match(opened,/&lt;text&gt;/);
 assert.match(opened,/Receive gift/);assert.match(opened,/claim:safe-mail/);assert.doesNotMatch(opened,/<system>/);
 const settings=renderSettingsPage({settings:{reduce:true,audio:false,audioVolume:.35},auth:{name:'<alice>'},connected:false,esc,head,btn});
 assert.match(settings,/&lt;alice&gt;/);assert.match(settings,/Reconnecting/);assert.match(settings,/value="0.35"/);
 assert.match(settings,/data-setting="reduce" checked/);assert.match(settings,/data-audio-enabled\s*>/);
});

test('feature router preserves async social redraw and unknown action fall-through',async()=>{
 let draws=0,clicks=0;const view={async handleClick(){clicks++;return true;}};
 assert.equal(await routeFeatureClick({dataset:{social:'accept'}},{socialView:view,V:{},draw:()=>{draws++;}}),true);
 assert.deepEqual([clicks,draws],[1,1]);
 assert.equal(await routeFeatureClick({dataset:{}} ,{}),false);
});

test('feature router preserves ranked action IDs and forfeit confirmation boundary',async()=>{
 const outgoing=[];let confirm;
 const ctx={send:action=>outgoing.push(action),economyActionId:kind=>`id-${kind}`,openConfirm:options=>{confirm=options;}};
 assert.equal(await routeFeatureClick({dataset:{ranked:'queue',mode:'singles'}},ctx),true);
 assert.equal(await routeFeatureClick({dataset:{ranked:'leave'}},ctx),true);
 assert.deepEqual(outgoing,[{type:'rankedV1.queue.join',mode:'singles',actionId:'id-ranked-queue'},{type:'rankedV1.queue.leave',actionId:'id-ranked-queue'}]);
 await routeFeatureClick({dataset:{ranked:'forfeit'}},ctx);
 assert.match(confirm.title,/Forfeit/);assert.equal(outgoing.length,2);
 confirm.onConfirm();assert.deepEqual(outgoing[2],{type:'rankedV1.surrender',actionId:'id-ranked-forfeit'});
});

test('admin views are pure templates driven by current state and escaped identity',()=>{
 const state={view:'players',auth:{name:'<root>'},overview:{players:101,online:2,suspended:1,activeRanked:3,activeFriendly:0,totalVp:500},players:[],total:0,search:'',selected:null};
 const views=createAdminViews({state,esc,number:Number,avatar:()=>'',button:btn,getPendingAction:()=>null});
 assert.match(views.metrics(),/101/);assert.match(views.header(),/&lt;root&gt;/);
 assert.match(views.playersView(),/No players found/);
 assert.equal(views.pendingActionBanner(),'');
 state.view='gifts';assert.match(views.header(),/data-admin-view="gifts" class="active"/);
});

test('manifest facade preserves handler and move validator output ordering',()=>{
 const manifest={id:'b35-bad',handlers:[{id:'invalid-handler',hook:'does-not-exist',order:1,params:{}}],testEvidence:{singles:[],doubles:[]}};
 const handlers=validateManifestHandlers(manifest,'moves');
 const moves=validateMoveManifest(manifest);
 const combined=validateMechanicManifest(manifest,'moves');
 assert.ok(handlers.length>0);assert.ok(moves.length>0);
 assert.deepEqual(combined.slice(0,handlers.length),handlers);
 assert.deepEqual(combined.slice(-moves.length),moves);
 assert.deepEqual(validateMechanicManifest(manifest,'not-real'),['unknown content kind: not-real']);
});

test('ranked facade exports remain behaviorally identical to domain module',()=>{
 const sample={rankedV1:{rating:1270,history:[]}};
 const direct=structuredClone(sample),facade=structuredClone(sample);
 assert.equal(ensureRankedState(facade),splitProfile.ensureRankedState(direct));
 assert.deepEqual(rankedProfileView(facade),splitProfile.rankedProfileView(direct));
 assert.deepEqual(rankedRatingDelta(1000,1400,1),splitProfile.rankedRatingDelta(1000,1400,1));
});

test('route renderer resolves exactly one active route and keeps loading isolated',()=>{
 let calls=0;const renderers={home:()=>{calls++;return '<home>';},battle:()=>{calls++;return '<battle>';}};
 assert.equal(renderRoutePage('home',renderers,true,()=>'<loading>'),'<home>');
 assert.equal(calls,1);
 assert.equal(renderRoutePage('battle',renderers,false,()=>'<loading>'),'<loading>');
 assert.equal(calls,1);
 assert.equal(renderRoutePage('not-a-route',renderers,true,()=>'<fallback>'),'<fallback>');
});

test('shell renderer preserves resource balances, unread badge and immersive battle',()=>{
 const args={page:'mail',V:{coins:12,gems:3,collection:[],catalog:[],badges:[],socialV1:{incomingRequests:['a']},missions:{claimableCount:1}},navs:[['home','/home.png','Home'],['friends','/friends.png','Friends'],['mail','/mail.png','Mail']],esc,auth:{name:'<alice>',provider:'browser'},content:'<section>Hi</section>',footerSummary:'one badge',immersiveBattle:false,commerceBanner:()=>'',connectionLabel:()=>'ONLINE',unreadMailCount:()=>3,accountControl:()=>'<account>'};
 const shell=renderClientShell(args);
 assert.match(shell,/&lt;alice&gt;/);assert.match(shell,/data-action="nav:mail"/);
 assert.match(shell,/class="badge">3<\/span>/);assert.match(shell,/12/);assert.match(shell,/one badge/);
 const battle=renderClientShell({...args,immersiveBattle:true,page:'battle'});
 assert.match(battle,/battle-shell-layout/);assert.doesNotMatch(battle,/class="sidebar"/);
});

test('modal templates preserve escape and button semantics without DOM state',()=>{
 const confirm=renderConfirmDialog({title:'<bad>',message:'<script>',confirmLabel:'Continue',cancelLabel:'Back',danger:false,esc});
 assert.match(confirm,/&lt;bad&gt;/);assert.match(confirm,/&lt;script&gt;/);assert.match(confirm,/data-action="confirm-action"/);
 assert.doesNotMatch(confirm,/<script>/);
 const V={catalog:[{name:'Example',hp:10,attack:12,defense:7,speed:9,ability:{name:'Ability',desc:'Effect'},moves:[{name:'Punch',type:'Fire',power:10,cost:1,desc:'Hits'}]}],collection:[],team:[],items:[],coins:0,colors:['#f00'],types:['Fire'],typeChart:[[.5]]};
 const detail=renderLegacyDetailDialog({id:0,V,btn,art:()=>'<art>',types:()=>'<types>',pending:false});
 assert.match(detail,/Example/);assert.match(detail,/Open Recruitment/);
 const chart=renderLegacyTypeChart({V,btn});assert.match(chart,/Type effectiveness/);assert.match(chart,/½×/);
});

test('public manifest facade export names remain locked to the pre-split API',()=>{
 const expected='BATTLE_FORMATS BATTLE_STAGES CONTENT_KINDS DELAYED_EFFECT_IDS HAZARD_IDS HOOKS MAJOR_STATUS_IDS MOVE_TAG_IDS ROOM_IDS SECONDARY_EFFECT_KINDS SEMI_INVULNERABLE_MODES SIDE_CONDITION_IDS TERRAIN_IDS TWO_TURN_MOVE_KINDS VARIABLE_POWER_FORMULAS VOLATILE_STATUS_IDS WEATHER_IDS validateMechanicManifest'.split(' ');
 assert.deepEqual(Object.keys(publicManifestContract).sort(),expected);
});
