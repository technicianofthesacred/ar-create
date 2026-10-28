/* Read-only Magazine snapshot: its maintained parser and renderer share one spec. */
import React from 'react';
import './magazine-published.css';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {standaloneArticleHtml} from '../../runtime/src/workspaces/standaloneArticleHtml';
import {saveDownload} from '../../runtime/src/workspaces/exportOutput';
import ConversationCanvas from '../../runtime/src/donors/teajia/conversation/ConversationCanvas';
import {LocalStoryProvider} from '../../runtime/src/donors/teajia/storyEdit';
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** Rendering aliases are per occurrence and never replace the saved parser slots. */
function occurrenceView(read:any){
 const owner=read?.ownerRef,media=read?.media;
 if(read?.schema!=='ar-create.magazine-working-edition.v1'||!hash(read.revision)||read.revision!==media?.revision||media?.schema!=='ar-create.magazine-media-inspection.v1'||JSON.stringify(owner)!==JSON.stringify(media?.ownerRef)||!hash(owner?.hash)||owner.editionId!=='working'||!read.spec||!Array.isArray(media.sources)||media.sources.length>256)throw Error('The current Magazine preview could not be verified.');
 const spec=structuredClone(read.spec),shots=new Map<string,{shot:any;block:any}>();
 const add=(shot:any,path:string,block:any={})=>{if(!shot||typeof shot.file!=='string'||!shot.file||typeof shot.slot!=='string'||!shot.slot||typeof shot.alt!=='string'||shots.has(path)||shots.size>=256)throw Error('A saved article photograph could not be verified.');shots.set(path,{shot,block});};
 const walk=(blocks:any,path:string,depth=0)=>{if(!Array.isArray(blocks)||blocks.length>2000||depth>8)throw Error('The saved article structure changed.');blocks.forEach((block:any,i:number)=>{if(!block||typeof block.kind!=='string')throw Error('The saved article structure changed.');const key=path+'/'+i+'/'+block.kind;if(block.shot)add(block.shot,key,block);if(block.kind==='photos'){if(!Array.isArray(block.shots)||block.shots.length>256)throw Error('The saved photo group changed.');block.shots.forEach((shot:any,n:number)=>add(shot,key+'/'+n,block));}if(block.kind==='side'||block.kind==='glyph')walk(block.blocks,key,depth+1);});};
 if(spec.portrait)add(spec.portrait,'portrait');walk(spec.opening,'opening');if(!Array.isArray(spec.parts)||spec.parts.length>256||!spec.ending)throw Error('The saved article structure changed.');spec.parts.forEach((part:any,i:number)=>{if(part.opener)add(part.opener,'parts/'+i+'/opener');walk(part.blocks,'parts/'+i+'/blocks');});walk(spec.ending.blocks,'ending/blocks');if(spec.ending.shot)add(spec.ending.shot,'ending/shot',spec.ending);
 const paths=new Set<string>(),ids=new Set<string>(),sources=new Set<string>(),sameRef=(a:any,b:any)=>['rootId','sourceId','relativePath','hash'].every(key=>a?.[key]===b?.[key]);
 const placements=media.sources.flatMap((source:any)=>{
  const ref=source?.sourceRef;
  if(!hash(source?.id)||sources.has(source.id)||ref?.sourceId!==source.id||!hash(ref?.rootId)||!hash(ref?.hash)||typeof ref?.relativePath!=='string'||ref.relativePath.startsWith('/')||/[\\\x00-\x1f]/.test(ref.relativePath)||ref.relativePath.split('/').some((part:string)=>!part||part==='.'||part==='..')||!Array.isArray(source.placements))throw Error('A saved article photograph could not be verified.');sources.add(source.id);
  const url='/api/review/magazine-media/file?'+new URLSearchParams({storyId:owner.projectId,pieceId:owner.pieceId,expectedHash:owner.hash,sourceId:source.id,sourceHash:ref.hash,revision:read.revision});
  return source.placements.map((p:any)=>{
   const at=shots.get(p?.structuralPath),crop=p?.crop||{};
   if(!p||p.projectId!==owner.projectId||p.pieceId!==owner.pieceId||p.editionId!=='working'||p.hash!==owner.hash||!hash(p.placementId)||ids.has(p.placementId)||typeof p.structuralPath!=='string'||paths.has(p.structuralPath)||!sameRef(p.sourceRef,ref)||!at||p.slot!==at.shot.slot||ref.relativePath.split('/').at(-1)!==at.shot.file||(p.alt??'')!==at.shot.alt.slice(0,2000)||['x','y'].some(key=>!Number.isFinite(crop[key]??.5)||(crop[key]??.5)<0||(crop[key]??.5)>1||(crop[key]??.5)!==(at.shot[key]??.5))||crop.aspect!==at.block.aspect)throw Error('A saved article placement changed.');
   ids.add(p.placementId);paths.add(p.structuralPath);const slot='magazine-occurrence-'+p.placementId;at.shot.slot=slot;return{id:p.placementId,slot,url,x:crop.x??.5,y:crop.y??.5,zoom:1};
  });
 });
 if(paths.size!==shots.size)throw Error('The saved article photo coverage is incomplete.');
 return {spec,placements};
}
function magazineView(read:any){
 const {spec,placements}=occurrenceView(read),owner=read.ownerRef;
 const view=<div className="ar-donor-workspace"><main className="ar-magazine-reader" data-template-render="magazine" data-magazine-working-preview={owner.hash}><LocalStoryProvider placements={placements} editing={false} onPlacements={()=>{}}><ConversationCanvas spec={spec} showByline/></LocalStoryProvider></main></div>;
 return{view,placements};
}
export function mountMagazineAudience(element:HTMLElement,read:any){
 const {view}=magazineView(read),root=createRoot(element);root.render(view);return{destroy(){root.unmount();}};
}
/** Preparation only. Caller must recheck the current snapshot and UI before download. */
export async function prepareMagazineHtml(read:any,{readAsset=fetch,origin=globalThis.location?.origin,maxBytes=32*1024*1024}: {readAsset?:typeof fetch;origin?:string;maxBytes?:number}={}){
 const {view,placements}=magazineView(read),title=Array.isArray(read.spec.title)?read.spec.title.join(' '):read.spec.title||'Working article';
 return standaloneArticleHtml({title,markup:renderToStaticMarkup(view),imageAssets:placements.map(p=>p.url),stylesheetUrl:'/assets/study-output-canvas.css',readAsset,origin,maxBytes});
}
export function downloadMagazineHtml(body:string,{title,hash:revision}:{title:string;hash:string}){
 if(typeof body!=='string'||!body.startsWith('<!doctype html>')||!hash(revision))throw Error('The prepared working article is unavailable.');
 const name=(title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'article')+'-working-'+revision.slice(0,8)+'.html';
 saveDownload(name,body,'text/html');
}
