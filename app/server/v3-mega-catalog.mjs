import {readFileSync} from 'node:fs';

const file=new URL('../content-src/mega-beta-v1.json',import.meta.url);

export function loadMegaBetaCatalog(){return JSON.parse(readFileSync(file,'utf8'));}

export function extendCatalogWithMega(base,mega=loadMegaBetaCatalog()){
 const next=structuredClone(base),regulation=next.regulations[0];
 next.metadata.catalogVersion=`${next.metadata.catalogVersion}-${mega.id}`;
 next.metadata.megaCatalogId=mega.id;
 next.regulations[0]={...regulation,megaCount:1};
 next.megaRelations=structuredClone(mega.relations);
 next.megaForms=structuredClone(mega.forms);
 next.abilities.push(...structuredClone(mega.abilities));
 next.items.push(...structuredClone(mega.items));
 next.coverage.entries.push(...mega.abilities.map(entry=>({kind:'ability',id:entry.id,name:entry.name,requiredHandlers:entry.mechanics.handlers.map(handler=>handler.id),formats:{single:{supported:true,reason:null},double:{supported:true,reason:null}},missingHandlers:[],manifestProblems:[]})),...mega.items.map(entry=>({kind:'item',id:entry.id,name:entry.name,requiredHandlers:entry.mechanics.handlers.map(handler=>handler.id),formats:{single:{supported:true,reason:null},double:{supported:true,reason:null}},missingHandlers:[],manifestProblems:[]})));
 return next;
}
