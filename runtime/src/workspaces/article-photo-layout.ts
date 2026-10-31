import type {Manuscript,Output} from './document';
import {inferArticleComposition,validateArticleComposition,type ArticleBlock,type ArticleComposition} from './articleComposition';
import {articlePhotoPositionBaseline,articlePhotoPositions} from './compositionSpec';
export type PhotoLayoutChoice={role:string;paragraphId:string|null;partnerSlot?:string};
export function articlePhotoRole(output:Output,slot:string):string {
 const layout=output.articleComposition;if(!layout)return slot==='cover'?'cover':'inline';
 if(layout.portraitSlot===slot||slot==='cover'&&!layout.portraitSlot)return 'cover';
 if(layout.ending.photoSlot===slot)return 'closing';
 const part=layout.parts.find(p=>p.openerSlot===slot);if(part)return 'opener:'+part.titleId;
 const walk=(blocks:ArticleBlock[]):string|null=>{for(const b of blocks){if('slot'in b&&b.slot===slot)return b.kind==='side'?'side':b.kind;if(b.kind==='photos'&&b.slots.includes(slot))return b.slots.length===2?'pair':'wide';if(b.kind==='side'||b.kind==='glyph'){const role=walk(b.blocks);if(role)return role;}}return null;};
 return walk(layout.opening)||layout.parts.map(p=>walk(p.blocks)).find(Boolean)||walk(layout.ending.blocks)||'inline';
}
/** Change only saved composition references. Accepted words, source bytes and sibling outputs stay exact. */
export function setArticlePhotoLayout(doc:Manuscript,outputId:string,slot:string,choice:PhotoLayoutChoice,baseline:string,seenPlacements:string):Manuscript {
 const output=doc.outputs.find(o=>o.id===outputId);if(!output||output.kind!=='article'||articlePhotoPositionBaseline(doc,output)!==baseline||JSON.stringify(output.placements)!==seenPlacements)throw Error('The Article changed. Review its current photo layout.');
 if(!output.placements.some(p=>p.slot===slot))throw Error('Choose this Article’s photograph.');
 const paragraphs=output.manuscript||doc.paragraphs,layout:ArticleComposition=structuredClone(output.articleComposition||inferArticleComposition(paragraphs));
 const roles=['inline','cover','closing','wide','bleed','pair','side','on-photo'];if(!roles.includes(choice.role)&&!layout.parts.some(p=>'opener:'+p.titleId===choice.role))throw Error('Choose an existing Article layout.');
 const selected=new Set([slot]);if(choice.role==='pair'){if(!choice.partnerSlot||choice.partnerSlot===slot||!output.placements.some(p=>p.slot===choice.partnerSlot))throw Error('Choose a second photograph in this Article.');selected.add(choice.partnerSlot);}
 // A role change deliberately unwraps its exact photo frame, retaining every contained thought.
 const detach=(blocks:ArticleBlock[]):ArticleBlock[]=>blocks.flatMap(b=>{if(b.kind==='photos'){const slots=b.slots.filter(s=>!selected.has(s));return slots.length?[{...b,slots}]:[];}if('slot'in b&&selected.has(b.slot)){if(b.kind==='side')return detach(b.blocks);if(b.kind==='on-photo')return [{kind:'n',paragraphId:b.paragraphId} as ArticleBlock];return [];}return b.kind==='side'||b.kind==='glyph'?[{...b,blocks:detach(b.blocks)}]:[b];});
 if(layout.portraitSlot&&selected.has(layout.portraitSlot))delete layout.portraitSlot;for(const part of layout.parts){if(part.openerSlot&&selected.has(part.openerSlot))delete part.openerSlot;part.blocks=detach(part.blocks);}if(layout.ending.photoSlot&&selected.has(layout.ending.photoSlot))delete layout.ending.photoSlot;layout.opening=detach(layout.opening);layout.ending.blocks=detach(layout.ending.blocks);
 if(choice.role==='cover'){if(layout.portraitSlot&&layout.portraitSlot!==slot||slot!=='cover'&&output.placements.some(p=>p.slot==='cover'))throw Error('The cover already has its own photograph. Select that occurrence.');layout.portraitSlot=slot;}
 else if(choice.role==='closing'){if(layout.ending.photoSlot)throw Error('The closing already has its own photograph. Select that occurrence.');layout.ending.photoSlot=slot;layout.ending.aspect||='3/2';}
 else if(choice.role.startsWith('opener:')){const part=layout.parts.find(p=>'opener:'+p.titleId===choice.role)!;if(part.openerSlot)throw Error('This section opener already has a photograph.');part.openerSlot=slot;}
 else if(choice.role!=='inline'){
  const groups=[layout.opening,...layout.parts.map(p=>p.blocks),layout.ending.blocks],id=choice.paragraphId;
  let blocks=groups.find(rows=>rows.some(b=>['q','a','n'].includes(b.kind)&&'paragraphId'in b&&b.paragraphId===id)),index=blocks?.findIndex(b=>'paragraphId'in b&&b.paragraphId===id)??-1;
  if(choice.role==='side'||choice.role==='on-photo'){if(!blocks||index<0)throw Error('Choose one whole ordinary thought for this frame.');const original=blocks[index];blocks.splice(index,1,choice.role==='side'?{kind:'side',slot,blocks:[original]}:{kind:'on-photo',slot,paragraphId:id!,aspect:'3/2',ink:'#ffffff',accent:'#ffffff'});}
  else{if(id===null){blocks=layout.ending.blocks;index=blocks.length-1;}else if(id===layout.introId){blocks=layout.opening;index=-1;}else if(!blocks)throw Error('Choose a current whole-paragraph position.');const block:ArticleBlock=choice.role==='pair'?{kind:'photos',slots:[slot,choice.partnerSlot!],aspect:'3/2'}:choice.role==='bleed'?{kind:'bleed',slot}:{kind:'wide',slot,aspect:'3/2'};blocks!.splice(index+1,0,block);}
 }
 // The legacy reserved cover slot always renders as a portrait; prevent a misleading role conversion.
 if(slot==='cover'&&choice.role!=='cover')throw Error('This reserved cover occurrence keeps its role. Add another photograph for other layouts.');
 const placements=output.placements.map(p=>selected.has(p.slot)?{...p,paragraphId:choice.paragraphId}:p);validateArticleComposition(layout,paragraphs,placements);
 if(choice.role==='inline'&&!articlePhotoPositions(doc,{...output,articleComposition:layout,placements}).some(p=>p.paragraphId===choice.paragraphId))throw Error('Choose a current whole-paragraph position.');
 return {...doc,outputs:doc.outputs.map(o=>o.id===outputId?{...o,placements,articleComposition:layout}:o)};
}
