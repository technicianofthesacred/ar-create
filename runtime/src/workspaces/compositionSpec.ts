import type {ConversationSpec,Block,Shot} from '../donors/teajia/conversation/spec';
import {locatorLabel,type Manuscript,type Output,type Paragraph,type Placement} from './document';
import {acceptedText,inferArticleComposition,validateArticleComposition,type ArticleBlock,type ArticleComposition} from './articleComposition';

export type RecordedConversationSpec=ConversationSpec & {
 recordedParagraphs:Pick<Paragraph,'id'|'doc'>[];
 recordedFields:{hookId?:string;introId?:string;closingId?:string;partTitleIds:string[]};
};
// One-way renderer adapter: layout is references to the captured accepted JSON.
// The original DEV receipt is never read here, even when later words change.
export function outputSpec(doc:Manuscript,output:Output):RecordedConversationSpec {
 const paragraphs=output.manuscript||doc.paragraphs;
 const byId=new Map(paragraphs.map(p=>[p.id,p]));
 const layout=(output as Output&{articleComposition?:ArticleComposition}).articleComposition||inferArticleComposition(paragraphs);
 validateArticleComposition(layout,paragraphs,output.placements);
 const text=(id?:string)=>id?acceptedText(byId.get(id)!):'';
 const owned=new Map(output.placements.map(p=>[p.slot,p]));
 const used=new Set<string>();
 const shot=(slot:string):Shot=>{const p=owned.get(slot)!;used.add(slot);return {slot,file:p.url,alt:p.alt,x:p.x,y:p.y};};
 const photoBlock=(p:Placement):Block=>p.caption
  ? {kind:'photos',shots:[shot(p.slot)],aspect:'3/2',caption:{id:'photo-caption:'+p.slot,text:p.caption}}
  : {kind:'wide',shot:shot(p.slot),aspect:'3/2'};
 const block=(b:ArticleBlock):Block=>{
  switch(b.kind){
   case 'q':case 'a':case 'n':return {kind:b.kind,id:b.paragraphId,text:text(b.paragraphId)};
   case 'line':return {kind:'line',id:b.paragraphId,text:text(b.paragraphId),size:b.size,...(b.followId?{follow:{id:b.followId,text:text(b.followId)}}:{})};
   case 'side':return {kind:'side',shot:shot(b.slot),blocks:b.blocks.map(block),flip:b.flip,bleed:b.bleed};
   case 'glyph':return {kind:'glyph',glyph:b.glyph,blocks:b.blocks.map(block)};
   case 'photos':{
    const captions=b.slots.map(slot=>owned.get(slot)!.caption).filter(Boolean);
    return {kind:'photos',shots:b.slots.map(shot),aspect:b.aspect,stagger:b.stagger,narrow:b.narrow,...(captions.length?{caption:{id:'photo-caption:'+b.slots.join(':'),text:captions.join(' · ')}}:{})};
   }
   case 'wide':{
    const p=owned.get(b.slot)!;
    if(p.caption)return {kind:'photos',shots:[shot(b.slot)],aspect:b.aspect||'3/2',narrow:b.narrow,caption:{id:'photo-caption:'+b.slot,text:p.caption}};
    return {kind:'wide',shot:shot(b.slot),aspect:b.aspect,narrow:b.narrow,offset:b.offset};
   }
   case 'bleed':return {kind:'bleed',shot:shot(b.slot)};
   case 'on-photo':return {kind:'on-photo',id:b.paragraphId,text:text(b.paragraphId),shot:shot(b.slot),aspect:b.aspect,ink:b.ink,accent:b.accent};
  }
 };
 const coverSlot=layout.portraitSlot||(owned.has('cover')?'cover':undefined);
 const portrait=coverSlot?shot(coverSlot):undefined;
 const opening=layout.opening.map(block);
 const parts=layout.parts.map(p=>({title:text(p.titleId),opener:p.openerSlot?shot(p.openerSlot):undefined,blocks:p.blocks.map(block)}));
 const ending={blocks:layout.ending.blocks.map(block),saying:{id:layout.ending.sayingId||'end',text:text(layout.ending.sayingId)},shot:layout.ending.photoSlot?shot(layout.ending.photoSlot):undefined,aspect:layout.ending.aspect};
 // New photos, added after capture, follow their stable accepted paragraph ID.
 // Unanchored or removed anchors remain visible at the end, never disappear.
 const extra=output.placements.filter(p=>p.slot!=='cover'&&!used.has(p.slot));
 const placed=new Set<string>();
 const append=(blocks:Block[]):Block[]=>blocks.flatMap(b=>{
  const nestedIds=(value:Block):string[]=>'id' in value?[value.id,...(value.kind==='line'&&value.follow?[value.follow.id]:[])]:value.kind==='side'||value.kind==='glyph'?value.blocks.flatMap(nestedIds):[];
  const ids=nestedIds(b);
  const photos=extra.filter(p=>p.paragraphId&&ids.includes(p.paragraphId)&&!placed.has(p.slot));
  photos.forEach(p=>placed.add(p.slot));return [b,...photos.map(photoBlock)];
 });
 const anchoredOpening=append(opening);parts.forEach(p=>{p.blocks=append(p.blocks);});ending.blocks=append(ending.blocks);
 // Preserve the legacy order-based placement rule only for old flat outputs.
 if(!(output as any).articleComposition&&!parts.length){
  for(const [i,p] of extra.entries())if(!p.paragraphId&&!placed.has(p.slot)){
   const anchor=paragraphs[i]?.id,index=anchoredOpening.findIndex(b=>'id' in b&&b.id===anchor);
   if(index>=0){anchoredOpening.splice(index+1,0,photoBlock(p));placed.add(p.slot);}
  }
 }
 extra.filter(p=>!placed.has(p.slot)).forEach(p=>ending.blocks.push(photoBlock(p)));
 const title=output.title||doc.title||'Untitled piece';
 const references=paragraphs.flatMap(p=>p.attributions).filter((a,i,all)=>all.findIndex(b=>b.id===a.id)===i);
 return {slug:output.id,path:'',images:'',source:references.map(r=>r.sourceId).join(','),pageTitle:title,title:[title,''],dek:'',subject:{name:'',role:''},speakers:{author:'',subject:''},form:layout.form||'story',author:{name:'',links:[]},portrait,hook:text(layout.hookId)||undefined,intro:text(layout.introId),closing:text(layout.closingId)||undefined,opening:anchoredOpening,parts,ending,credit:[`Manuscript revision ${output.manuscriptRevision} · private composition`,...references.map(r=>`${r.form==='paraphrase'?'Paraphrase, review required':r.form==='reference'?'Reference':'Quotation'}: ${r.sourceTitle}${r.author?' — '+r.author:''} · ${locatorLabel(r.locator)}`)],next:[],recordedParagraphs:paragraphs,recordedFields:{hookId:layout.hookId,introId:layout.introId,closingId:layout.closingId,partTitleIds:layout.parts.map(p=>p.titleId)}};
}
