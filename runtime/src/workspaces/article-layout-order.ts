import type {Manuscript,Output} from './document';
import {inferArticleComposition,validateArticleComposition,type ArticleBlock,type ArticleComposition} from './articleComposition';
export type ArticleOrderPosition={container:string;index:number};
export type ArticleOrderGroup={container:string;label:string;fixed?:boolean;rows:{label:string}[]};
const layoutFor=(doc:Manuscript,output:Output):ArticleComposition=>validateArticleComposition(output.articleComposition||inferArticleComposition(output.manuscript||doc.paragraphs),output.manuscript||doc.paragraphs,output.placements);
export const articleOrderBaseline=(doc:Manuscript,output:Output)=>JSON.stringify([doc.id,doc.revision,output,output.manuscript?null:doc.paragraphs]);
function container(layout:ArticleComposition,key:string):any[]{
 if(key==='opening')return layout.opening;
 if(key==='ending')return layout.ending.blocks;
 if(key==='parts')return layout.parts;
 if(key.startsWith('part:')){const part=layout.parts.find(p=>p.titleId===key.slice(5));if(part)return part.blocks;}
 throw Error('This passage has a fixed layout role. Move a whole section or a block within its own group.');
}
/** Reorder references only. Composite/photo frames remain atomic; manuscript,
 * roles, stable IDs, placements and sibling outputs never change. */
export function moveArticleLayoutUnit(doc:Manuscript,outputId:string,from:ArticleOrderPosition,to:ArticleOrderPosition,baseline:string):Manuscript{
 const output=doc.outputs.find(o=>o.id===outputId);
 if(!output||output.kind!=='article')throw Error('The selected article is no longer available.');
 if(articleOrderBaseline(doc,output)!==baseline)throw Error('The article changed during this move. Try again from its current layout.');
 if(from.container!==to.container)throw Error('Move within the same layout group. Cross-role moves are not supported.');
 const layout=structuredClone(layoutFor(doc,output)),items=container(layout,from.container);
 if(![from.index,to.index].every(i=>Number.isSafeInteger(i)&&i>=0&&i<items.length))throw Error('This layout unit is no longer available.');
 if(from.index===to.index)return doc;
 const [item]=items.splice(from.index,1);items.splice(to.index,0,item);
 validateArticleComposition(layout,output.manuscript||doc.paragraphs,output.placements);
 return {...doc,outputs:doc.outputs.map(o=>o.id===outputId?{...o,articleComposition:layout}:o)};
}
export function articleOrderGroups(doc:Manuscript,output:Output):ArticleOrderGroup[]{
 const layout=layoutFor(doc,output),paragraphs=output.manuscript||doc.paragraphs;
 // Labels show the words only: heading, quotation and emphasis marks stay in the manuscript.
 const text=(id:string)=>paragraphs.find(p=>p.id===id)?.text.replace(/^#{1,6}\s+/,'').replace(/^>\s?/,'').replace(/\*\*(.+?)\*\*|__(.+?)__/g,(_m,a,b)=>a??b).slice(0,120)||'Passage';
 const blockLabel=(b:ArticleBlock):string=>{
  if(b.kind==='side'||b.kind==='glyph')return (b.kind==='side'?'Photo + words':'Framed words')+' · '+b.blocks.map(blockLabel).join(' / ');
  if('paragraphId' in b)return text(b.paragraphId)+(b.kind==='line'&&b.followId?' / '+text(b.followId):'')+(b.kind==='on-photo'?' · on photo':'');
  return 'Photograph'+(b.kind==='photos'&&b.slots.length>1?'s':'');
 };
 const groups:ArticleOrderGroup[]=[];
 const fixed=(key:string,id?:string)=>{if(id)groups.push({container:'fixed:'+key,label:({hookId:'Opening line',introId:'Introduction',closingId:'Closing line',sayingId:'Closing saying'} as Record<string,string>)[key],fixed:true,rows:[{label:text(id)}]});};
 fixed('hookId',layout.hookId);fixed('introId',layout.introId);
 if(layout.opening.length)groups.push({container:'opening',label:'Opening blocks',rows:layout.opening.map(b=>({label:blockLabel(b)}))});
 if(layout.parts.length)groups.push({container:'parts',label:'Sections · move with their blocks',rows:layout.parts.map(p=>({label:text(p.titleId)}))});
 for(const part of layout.parts)if(part.blocks.length)groups.push({container:'part:'+part.titleId,label:text(part.titleId)+' · blocks',rows:part.blocks.map(b=>({label:blockLabel(b)}))});
 if(layout.ending.blocks.length)groups.push({container:'ending',label:'Ending blocks',rows:layout.ending.blocks.map(b=>({label:blockLabel(b)}))});
 fixed('sayingId',layout.ending.sayingId);fixed('closingId',layout.closingId);
 return groups;
}
