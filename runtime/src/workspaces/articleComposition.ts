import type {Paragraph, Placement} from './document';
import {markdownToDoc} from '../donors/wordforge/wf-block-markdown';
import {documentParts, readableBlock} from '../donors/mag/markdown-blocks';
import {ARTICLE_COMPOSITION_SCHEMA, articleCompositionIssue, validateArticleComposition} from './article-composition.mjs';
export {articleCompositionIssue, validateArticleComposition} from './article-composition.mjs';

export type ArticleBlock =
 | {kind:'q'|'a'|'n';paragraphId:string}
 | {kind:'line';paragraphId:string;size:'xl'|'l'|'m';followId?:string}
 | {kind:'side';slot:string;flip?:boolean;bleed?:boolean;blocks:ArticleBlock[]}
 | {kind:'glyph';glyph:string;blocks:ArticleBlock[]}
 | {kind:'photos';slots:string[];aspect?:string;stagger?:boolean;narrow?:boolean}
 | {kind:'wide';slot:string;aspect?:string;narrow?:boolean;offset?:'left'|'right'}
 | {kind:'bleed';slot:string}
 | {kind:'on-photo';paragraphId:string;slot:string;aspect:string;ink:string;accent:string};
export type ArticleComposition = {
 schema:'ar-create.article-composition.v1';form?:'story'|'conversation';
 hookId?:string;introId?:string;closingId?:string;portraitSlot?:string;
 opening:ArticleBlock[];
 parts:{titleId:string;openerSlot?:string;blocks:ArticleBlock[]}[];
 ending:{blocks:ArticleBlock[];sayingId?:string;photoSlot?:string;aspect?:string};
};
const empty = ():ArticleComposition => ({schema:ARTICLE_COMPOSITION_SCHEMA,form:'story',opening:[],parts:[],ending:{blocks:[]}});
const textOf=(node:any):string=>node.type==='text'?node.text||'':node.type==='hardBreak'?'\n':node.type==='referenceCard'?`Reference · ${node.attrs?.sourceTitle||'Source'} ${node.attrs?.text||''}`:(node.content||[]).map(textOf).join(node.type==='doc'?'\n':'');
export const acceptedText = (p:Paragraph):string => textOf(p.doc);
const role=(p:Paragraph):'q'|'a'|'n'=>{
 const node=p.doc.content?.[0],text=acceptedText(p).trim();
 if (p.doc.content?.length===1&&/^[“"][\s\S]*[”"]$/.test(text)) {
  const leaves=node?.content?.filter(n=>n.type==='text')||[];
  return node?.type==='paragraph'&&leaves.length>0&&leaves.every(n=>n.marks?.some(m=>m.type==='italic'))?'q':'a';
 }
 return 'n';
};

/** Legacy outputs infer only structure already present in their accepted JSON.
 * No receipt text is consulted and no passage is split, paraphrased or quoted
 * a second time. Ordinary prose retains its original flat reading column. */
export function inferArticleComposition(paragraphs:Paragraph[]):ArticleComposition {
 const layout=empty();let target=layout.opening;
 for(const p of paragraphs){
  if(p.doc.content?.length===1&&p.doc.content[0].type==='heading'){
   const part={titleId:p.id,blocks:[] as ArticleBlock[]};layout.parts.push(part);target=part.blocks;
  }else target.push({kind:role(p),paragraphId:p.id});
 }
 return layout;
}

export type ArticleCompositionReconciliation=
 | {status:'ready';composition:ArticleComposition}
 | {status:'stale';composition:ArticleComposition;reason:string};
/** Direct wording edits preserve the layout. Structural changes need a new
 * layout decision rather than a guessed placement inside side/ending frames.
 * The stale result retains the entire original map for a recoverable review. */
export function reconcileArticleComposition(layout:ArticleComposition,previous:Paragraph[],next:Paragraph[],placements:Placement[]):ArticleCompositionReconciliation {
 const composition=structuredClone(layout);
 if(JSON.stringify(previous.map(p=>p.id))!==JSON.stringify(next.map(p=>p.id)))return {status:'stale',composition,reason:'Passages were added, removed or reordered. Review a new article layout; the previous output retains its layout.'};
 const issue=articleCompositionIssue(composition,next,placements);
 return issue?{status:'stale',composition,reason:issue+' Review a new article layout; the previous output retains its layout.'}:{status:'ready',composition};
}

export type ArticleCompositionCapture={composition:ArticleComposition;placements:Placement[];photoRequests:{slot:string;file:string}[]};
/** Capture once, while the reviewed DEV draft and accepted paragraphs still
 * agree. The %% grammar follows Teajia's magSend.parseDraft: hook, chapters,
 * side/glyph frames, paired photos, pulled lines and the complete ending.
 * Unlike mag-send, this keeps unresolved == as visible accepted text. A
 * layout is not a certificate of editorial or source approval.
 *
 * This function refuses stale receipts. Subsequent rendering uses only IDs
 * captured here and the snapshot's accepted document, never the DEV wording.
 * Photos are owned empty slots, not permission to load an original file. */
export function captureArticleComposition(paragraphs:Paragraph[], raw?:string):ArticleCompositionCapture {
 if(raw===undefined)return {composition:inferArticleComposition(paragraphs),placements:[],photoRequests:[]};
 const model=documentParts(raw,false);
 const header=(s:string)=>!s.trim()||/^#\s/.test(s.trim())||/^\*\*(?:Conversations over Tea|Story Subject|Interview by|Interview Date|Photography, Words, Translation|Location|By|Published)\b/.test(s.trim());
 const preambleEnd=model.blocks.findIndex(b=>b.raw.trim()==='---');
 let first=0;while(first<model.blocks.length&&header(model.blocks[first].raw))first++;
 const chunks=(preambleEnd>=0&&model.blocks.slice(0,preambleEnd).every(b=>header(b.raw))?model.blocks.slice(preambleEnd+1):model.blocks.slice(first)).map(b=>b.raw.trim()).filter(Boolean);
 const layout=empty(),placements:Placement[]=[],photoRequests:{slot:string;file:string}[]=[];
 let cursor=0,where:'opening'|'parts'|'ending'|'closing'='opening';
 const stack:{kind:'side'|'glyph';blocks:ArticleBlock[]}[]=[];
 let pendingFollow:Extract<ArticleBlock,{kind:'line'}>|undefined;
 const target=():ArticleBlock[]=>stack.at(-1)?.blocks||(where==='opening'?layout.opening:where==='parts'?layout.parts.at(-1)!.blocks:layout.ending.blocks);
 const fail=(message:string):never=>{throw new Error('Article layout: '+message);};
 const readable=(chunk:string)=>readableBlock(chunk.replaceAll('==','\u0000approval\u0000')).replaceAll('\u0000approval\u0000','==').trim();
 const consume=(chunk:string):Paragraph=>{
  const text=readable(chunk),p=paragraphs[cursor++];
  if(!p||JSON.stringify(markdownToDoc(text,{links:true}))!==JSON.stringify(p.doc))fail('the DEV receipt no longer matches the accepted paragraphs. Capture layout when accepting the draft.');
  return p;
 };
 type Note={file:string;alt:string;words:string[];opts:Record<string,string>};
 const photoNote=(text:string):Note=>{
  const [file,alt='',...rest]=text.split(' · '),words:string[]=[],opts:Record<string,string>={};
  for(const word of rest.join(' · ').split(/\s+/).filter(Boolean)){
   const pair=word.match(/^(\w+)=(.+)$/);if(pair)opts[pair[1]]=pair[2];else if(/^\d+\/\d+$/.test(word))opts.aspect=word;else words.push(word);
  }
  return {file:file.trim(),alt:alt.trim(),words,opts};
 };
 const photo=(note:Note,cover=false):string=>{
  const slot=cover?'cover':'article-photo-'+(placements.filter(p=>p.slot!=='cover').length+1);
  if(placements.some(p=>p.slot===slot))fail('a cover photo is repeated.');
  const focal=(v:string|undefined)=>v===undefined?.5:Number(v);
  const x=focal(note.opts.x),y=focal(note.opts.y);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)fail('a photo focal point must be between zero and one.');
  placements.push({slot,url:'',x,y,zoom:1,alt:note.alt,paragraphId:null});photoRequests.push({slot,file:note.file});return slot;
 };
 const note=(chunk:string,tag:string)=>chunk.match(new RegExp(`^%%${tag}:\\s*([^%]*)%%`))?.[1]?.trim();
 const wordsBlock=(p:Paragraph):ArticleBlock=>({kind:role(p),paragraphId:p.id});
 for(const chunk of chunks){
  if(chunk==='---')continue;
  if(chunk==='%%ending%%'){if(stack.length)fail('close the side or glyph before ending.');where='ending';pendingFollow=undefined;continue;}
  if(chunk==='%%/side%%'||chunk==='%%/glyph%%'){
   if(stack.at(-1)?.kind!==(chunk==='%%/side%%'?'side':'glyph'))fail('a side or glyph closing note does not match its frame.');stack.pop();continue;
  }
  const shown=readable(chunk);
  if(/^## /.test(shown)){
   if(stack.length||where==='ending'||where==='closing')fail('a chapter heading is out of order.');
   const p=consume(chunk);layout.parts.push({titleId:p.id,blocks:[]});where='parts';pendingFollow=undefined;continue;
  }
  let n:string|undefined;
  if((n=note(chunk,'photo'))!==undefined){
   const p=photoNote(n),slot=photo(p,p.words.includes('cover'));
   if(p.words.includes('cover'))layout.portraitSlot=slot;
   else if(p.words.includes('opener')){
    const part=layout.parts.at(-1);if(where!=='parts'||!part||part.blocks.length||part.openerSlot||stack.length)fail('an opener belongs directly after a chapter heading.');part!.openerSlot=slot;
   }else if(p.words.includes('bleed'))target().push({kind:'bleed',slot});
   else target().push({kind:'wide',slot,...(p.opts.aspect?{aspect:p.opts.aspect}:{}),...(p.words.includes('narrow')?{narrow:true}:{}),...(p.words.includes('left')?{offset:'left' as const}:p.words.includes('right')?{offset:'right' as const}:{})});
   if(shown)fail('a photo note must be separate from prose.');continue;
  }
  if((n=note(chunk,'photos'))!==undefined){
   const notes=n.split(' | ').map(photoNote),last=notes.at(-1)!;
   target().push({kind:'photos',slots:notes.map(p=>photo(p)),...(last.opts.aspect?{aspect:last.opts.aspect}:{}),...(last.words.includes('stagger')?{stagger:true}:{}),...(last.words.includes('narrow')?{narrow:true}:{})});
   if(shown)fail('a photo pair note must be separate from prose.');continue;
  }
  if((n=note(chunk,'side'))!==undefined){
   const p=photoNote(n),b:Extract<ArticleBlock,{kind:'side'}>={kind:'side',slot:photo(p),blocks:[],...(p.words.includes('flip')?{flip:true}:{}),...(p.words.includes('bleed')?{bleed:true}:{})};target().push(b);stack.push(b);
   if(shown)fail('a side note must precede its prose.');continue;
  }
  if((n=note(chunk,'glyph'))!==undefined){const b:Extract<ArticleBlock,{kind:'glyph'}>={kind:'glyph',glyph:n,blocks:[]};target().push(b);stack.push(b);if(shown)fail('a glyph note must precede its prose.');continue;}
  if((n=note(chunk,'pull'))!==undefined){
   const p=consume(chunk),[size,...options]=n.split(/\s+/);
   if(size==='hook'){if(layout.hookId)fail('the hook is repeated.');layout.hookId=p.id;continue;}
   if(!['xl','l','m'].includes(size))fail('a pull size must be xl, l or m.');
   const b:Extract<ArticleBlock,{kind:'line'}>={kind:'line',paragraphId:p.id,size:size as 'xl'|'l'|'m'};target().push(b);pendingFollow=options.includes('follow')?b:undefined;continue;
  }
  if((n=note(chunk,'on-photo'))!==undefined){
   const note=photoNote(n),p=consume(chunk);target().push({kind:'on-photo',paragraphId:p.id,slot:photo(note),aspect:note.opts.aspect,ink:note.opts.ink,accent:note.opts.accent});continue;
  }
  if(/^%%saying:?\s*%%/.test(chunk)||(n=note(chunk,'saying'))!==undefined){
   if(where!=='ending'||stack.length||layout.ending.sayingId)fail('the saying belongs once after ending.');
   layout.ending.sayingId=consume(chunk).id;
   if(n!==undefined){const p=photoNote(n);layout.ending.photoSlot=photo(p);layout.ending.aspect=p.opts.aspect;}
   where='closing';continue;
  }
  if(!shown)continue;
  const p=consume(chunk);
  if(where==='closing'){if(layout.closingId)fail('the closing has more than one paragraph.');layout.closingId=p.id;continue;}
  if(pendingFollow&&role(p)==='a'){pendingFollow.followId=p.id;pendingFollow=undefined;continue;}
  pendingFollow=undefined;
  if(where==='opening'&&!layout.introId&&!layout.opening.length&&!stack.length&&role(p)==='n')layout.introId=p.id;
  else target().push(wordsBlock(p));
 }
 if(stack.length)fail('a side or glyph frame was not closed.');
 if(cursor!==paragraphs.length)fail('the DEV receipt omits accepted paragraphs.');
 validateArticleComposition(layout,paragraphs,placements);
 return {composition:layout,placements,photoRequests};
}
