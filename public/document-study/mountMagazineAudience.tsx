/* Read-only Magazine snapshot: its maintained parser and renderer share one spec. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {standaloneArticleHtml} from '../../runtime/src/workspaces/standaloneArticleHtml';
import {saveDownload} from '../../runtime/src/workspaces/exportOutput';
import ConversationCanvas from '../../runtime/src/donors/teajia/conversation/ConversationCanvas';
import {LocalStoryProvider} from '../../runtime/src/donors/teajia/storyEdit';
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function magazineView(read:any){
 const owner=read?.ownerRef,media=read?.media;
 if(read?.schema!=='ar-create.magazine-working-edition.v1'||!hash(read.revision)||read.revision!==media?.revision||JSON.stringify(owner)!==JSON.stringify(media?.ownerRef)||!hash(owner?.hash)||owner.editionId!=='working'||!read.spec||!Array.isArray(media.sources)||media.sources.length>256)throw Error('The current Magazine preview could not be verified.');
 const slots=new Set<string>(),placements=media.sources.flatMap((source:any)=>{
  if(!hash(source.id)||!hash(source.sourceRef?.hash)||!Array.isArray(source.placements))throw Error('A saved article photograph could not be verified.');
  const url='/api/review/magazine-media/file?'+new URLSearchParams({storyId:owner.projectId,pieceId:owner.pieceId,expectedHash:owner.hash,sourceId:source.id,sourceHash:source.sourceRef.hash,revision:read.revision});
  return source.placements.map((p:any)=>{if(p.projectId!==owner.projectId||p.pieceId!==owner.pieceId||p.hash!==owner.hash||typeof p.slot!=='string'||!p.slot||slots.has(p.slot))throw Error('A saved article placement changed.');slots.add(p.slot);return{id:p.placementId,slot:p.slot,url,x:p.crop?.x??.5,y:p.crop?.y??.5,zoom:1};});
 });
 const view=<div className="ar-donor-workspace"><main className="ar-output-reader" data-magazine-working-preview={owner.hash}><LocalStoryProvider placements={placements} editing={false} onPlacements={()=>{}}><ConversationCanvas spec={read.spec}/></LocalStoryProvider></main></div>;
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
