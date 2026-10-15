import type {Manuscript} from './document';
import {carouselWordsHash,carouselWordsRecord} from './carousel-words.mjs';
import IG from '../donors/mag/carousel/ig-templates.js';
// Apply visual work to its own unchanged reviewed output, never accepted prose.
export async function applyCarouselVisualPlan(doc:Manuscript,record:any):Promise<Manuscript>{
 const output=doc.outputs.find(item=>item.id===record.outputId&&item.kind==='carousel'),plan=record.artifact?.visualPlan;
 if(!output||doc.id!==record.documentId||!plan)throw new Error('This visual draft belongs to a different carousel.');
 if((output as any).visualMake?.requestId===record.id)return doc;
 const hash=await carouselWordsHash(output);
 if((output.outputRevision||0)!==record.capturedOutputRevision||hash!==record.wordsHash||output.wordsReview?.hash!==hash)throw new Error('This carousel changed after layout was requested. Your edits are kept; prepare a new visual draft.');
 if(plan.outputId!==output.id||plan.wordsHash!==hash||JSON.stringify(carouselWordsRecord({slides:plan.slides,caption:plan.caption}))!==JSON.stringify(carouselWordsRecord(output)))throw new Error('The visual draft changed the reviewed wording or slide order. Return it for correction.');
 const available=new Set((record.photos||[]).map((photo:any)=>photo.id));
 const slides=output.slides!.map((slide,index)=>{
  const visual=plan.slides[index];
  if(!IG.T[visual.template]||!Array.isArray(visual.photos)||visual.photos.length!==IG.T[visual.template].photos)throw new Error('The visual draft has an unsupported layout or missing photograph.');
  if(IG.T[visual.template].textParts===0&&slide.text.trim())throw new Error('This photo-only layout would hide reviewed wording. Choose a layout with text.');
  const photos=visual.photos.map((photo:any)=>{if(!available.has(photo.sourceId)||!Number.isFinite(photo.x)||photo.x<0||photo.x>100||!Number.isFinite(photo.y)||photo.y<0||photo.y>100)throw new Error('The visual draft references an uncaptured photograph or invalid crop.');return {src:'/api/sources/blob?id='+encodeURIComponent(photo.sourceId),x:photo.x,y:photo.y};});
  if(visual.pillar!==undefined&&!['','佳','家','嘉'].includes(visual.pillar))throw new Error('The visual draft has an unknown emblem.');
  return {...slide,template:visual.template,photos,...(visual.pillar!==undefined?{pillar:visual.pillar}:{})};
 });
 return {...doc,outputs:doc.outputs.map(item=>item.id===output.id?{...item,slides,stage:'look',outputRevision:(item.outputRevision||0)+1,visualMake:{requestId:record.id,artifactHash:record.artifact.hash,wordsHash:hash}}:item)};
}
