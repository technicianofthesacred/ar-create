import {articleCompositionIssue} from './article-composition.mjs';
export function articleWordsRecord(output){return {title:output.title||'',paragraphs:(output.manuscript||[]).map(p=>({id:p.id,doc:p.doc,text:p.text,attributions:p.attributions,kept:p.kept})),captions:(output.placements||[]).filter(photo=>photo.caption?.trim()).map(photo=>({slot:photo.slot,url:photo.url,caption:photo.caption,alt:photo.alt}))};}
export async function articleWordsHash(output){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(articleWordsRecord(output))));return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');}
export const articleVisualBaseline=output=>JSON.stringify({words:articleWordsRecord(output),placements:output.placements||[],composition:output.articleComposition||null,outputRevision:output.outputRevision||0,wordsReview:output.wordsReview||null});
export function articleLayoutReferences(composition){
 const ids=[],slots=[];const passage=id=>{if(id!==undefined)ids.push(id);},photo=slot=>{if(slot!==undefined)slots.push(slot);};
 const walk=blocks=>{for(const block of blocks||[]){if(['q','a','n','line','on-photo'].includes(block.kind)){passage(block.paragraphId);passage(block.followId);}if(block.kind==='side'||block.kind==='glyph')walk(block.blocks);photo(block.slot);if(block.slots)block.slots.forEach(photo);}};
 passage(composition.hookId);passage(composition.introId);photo(composition.portraitSlot);walk(composition.opening);
 for(const part of composition.parts||[]){passage(part.titleId);photo(part.openerSlot);walk(part.blocks);}
 walk(composition.ending?.blocks);passage(composition.ending?.sayingId);photo(composition.ending?.photoSlot);passage(composition.closingId);
 return {ids,slots};
}
export function articleVisualPlanIssue(plan,record){
 try{
  const exact=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(','))throw Error('The article visual plan has unsupported fields.');};
  exact(plan,['schema','outputId','wordsHash','composition','photos']);
  if(plan.schema!=='ar-create.article-visual-plan.v1'||plan.outputId!==record.outputId||plan.wordsHash!==record.wordsHash)throw Error('This layout belongs to a different article or wording.');
  if(!Array.isArray(plan.photos)||plan.photos.length>200)throw Error('The article photo list is invalid.');
  const selected=new Set((record.photos||[]).map(photo=>photo.id)),slots=new Set();
  for(const photo of plan.photos){exact(photo,['slot','sourceId','x','y','zoom']);if(typeof photo.slot!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(photo.slot)||slots.has(photo.slot)||!selected.has(photo.sourceId))throw Error('The layout references a duplicate slot or uncaptured photograph.');slots.add(photo.slot);if(![photo.x,photo.y].every(value=>Number.isFinite(value)&&value>=0&&value<=1)||!Number.isFinite(photo.zoom)||photo.zoom<1||photo.zoom>3)throw Error('The article photograph crop is invalid.');}
  const paragraphs=record.frozenWords?.paragraphs;if(!Array.isArray(paragraphs))throw Error('Captured article wording is unavailable.');
  const issue=articleCompositionIssue(plan.composition,paragraphs,plan.photos);if(issue)throw Error(issue);
  const references=articleLayoutReferences(plan.composition);
  if(JSON.stringify(references.ids)!==JSON.stringify(paragraphs.map(p=>p.id)))throw Error('The layout reordered accepted article passages. Keep their exact manuscript order.');
  if(references.slots.length!==slots.size)throw Error('Every planned photo must belong to one visible article frame.');
  for(const caption of record.frozenWords.captions||[]){const id=/^\/api\/sources\/blob\?id=([^&]+)$/.exec(caption.url)?.[1];if(!id||!plan.photos.some(photo=>photo.slot===caption.slot&&photo.sourceId===decodeURIComponent(id)))throw Error('The arrangement would remove or reassign an accepted photograph caption. Keep its original photo slot and source.');}
 }catch(error){return error.message;}
}
export function articlePlanPlacements(plan,photos,captions=[]){return plan.photos.map(row=>{const source=photos.find(photo=>photo.id===row.sourceId),caption=captions.find(caption=>caption.slot===row.slot);return {slot:row.slot,url:'/api/sources/blob?id='+encodeURIComponent(row.sourceId),x:row.x,y:row.y,zoom:row.zoom,alt:caption?.alt||source?.title||source?.name||'Article photograph',...(caption?{caption:caption.caption}:{})};});}
