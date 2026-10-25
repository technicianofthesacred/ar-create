/* Read-only Magazine snapshot: its maintained parser and renderer share one spec. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import ConversationCanvas from '../../runtime/src/donors/teajia/conversation/ConversationCanvas';
import {LocalStoryProvider} from '../../runtime/src/donors/teajia/storyEdit';
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function mountMagazineAudience(element:HTMLElement,read:any){
 const owner=read?.ownerRef,media=read?.media;
 if(read?.schema!=='ar-create.magazine-working-edition.v1'||!hash(read.revision)||read.revision!==media?.revision||JSON.stringify(owner)!==JSON.stringify(media?.ownerRef)||!hash(owner?.hash)||owner.editionId!=='working'||!read.spec||!Array.isArray(media.sources)||media.sources.length>256)throw Error('The current Magazine preview could not be verified.');
 const slots=new Set<string>(),placements=media.sources.flatMap((source:any)=>{
  if(!hash(source.id)||!hash(source.sourceRef?.hash)||!Array.isArray(source.placements))throw Error('A saved article photograph could not be verified.');
  const url='/api/review/magazine-media/file?'+new URLSearchParams({storyId:owner.projectId,pieceId:owner.pieceId,expectedHash:owner.hash,sourceId:source.id,sourceHash:source.sourceRef.hash,revision:read.revision});
  return source.placements.map((p:any)=>{if(p.projectId!==owner.projectId||p.pieceId!==owner.pieceId||p.hash!==owner.hash||typeof p.slot!=='string'||!p.slot||slots.has(p.slot))throw Error('A saved article placement changed.');slots.add(p.slot);return{id:p.placementId,slot:p.slot,url,x:p.crop?.x??.5,y:p.crop?.y??.5,zoom:1};});
 });
 const root=createRoot(element);root.render(<div className="ar-donor-workspace"><main className="ar-output-reader" data-magazine-working-preview={owner.hash}><LocalStoryProvider placements={placements} editing={false} onPlacements={()=>{}}><ConversationCanvas spec={read.spec}/></LocalStoryProvider></main></div>);
 return{destroy(){root.unmount();}};
}
