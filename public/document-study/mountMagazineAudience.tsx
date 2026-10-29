/* Read-only Magazine snapshot: its maintained parser and renderer share one spec. */
import React from 'react';
import './magazine-published.css';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {standaloneArticleHtml} from '../../runtime/src/workspaces/standaloneArticleHtml';
import {saveDownload} from '../../runtime/src/workspaces/exportOutput';
import {AcceptedProse} from '../../runtime/src/workspaces/AcceptedProse';
import {parseWholeDraft} from '../../runtime/src/workspaces/article-codec';
import {captureArticleComposition} from '../../runtime/src/workspaces/articleComposition';
import {outputSpec} from '../../runtime/src/workspaces/compositionSpec';
import {documentParts} from '../../runtime/src/donors/mag/markdown-blocks';
import {markdownToDoc} from '../../runtime/src/donors/wordforge/wf-block-markdown';
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
 if(read?.renderKind==='manuscript'){
  const owner=read.ownerRef,media=read.media,blocks=read.manuscript?.blocks;
  if(read.schema!=='ar-create.magazine-working-edition.v1'||!hash(read.revision)||!hash(owner?.hash)||owner.editionId!=='working'||media?.schema!=='ar-create.magazine-media-inspection.v1'||media.revision!==read.revision||JSON.stringify(media.ownerRef)!==JSON.stringify(owner)||!Array.isArray(media.sources)||media.sources.length||!Array.isArray(blocks)||blocks.length>4096||blocks.some((b:any)=>typeof b.id!=='string'||typeof b.raw!=='string')||new Set(blocks.map((b:any)=>b.id)).size!==blocks.length)throw Error('The saved manuscript could not be verified.');
  if(typeof read.manuscript.raw==='string'){
   // Projection only: reuse the existing DEV reader and layout capture without
   // accepting, creating or saving another Article or manuscript.
   const raw=read.manuscript.raw,base:any={id:owner.artifactId,title:read.spec.title,revision:0,paragraphs:[],outputs:[]};
   const parsed=parseWholeDraft(raw,base),paragraphs=parsed.paragraphs.map((p:any,i:number)=>({...p,id:'working:'+i}));
   const captured=captureArticleComposition(paragraphs,raw);if(captured.placements.length||captured.photoRequests.length)throw Error('Unpublished photographs need their exact connected owner.');
   const doc:any={...base,paragraphs},output:any={id:owner.pieceId,kind:'article',title:read.spec.title,manuscriptRevision:0,manuscript:paragraphs,placements:[],articleComposition:captured.composition};
   const spec=outputSpec(doc,output);spec.credit=[];
   const sourceBlocks=documentParts(raw,false).blocks,separator=sourceBlocks.findIndex(b=>b.raw.trim()==='---');
   const header=(s:string)=>!s.trim()||/^#\s/.test(s.trim())||/^\*\*(?:Conversations over Tea|Story Subject|Interview by|Interview Date|Photography, Words, Translation|Location|By|Published)\b/.test(s.trim());
   let firstStory=0;while(firstStory<sourceBlocks.length&&header(sourceBlocks[firstStory].raw))firstStory++;
   const credits=sourceBlocks.slice(0,separator>=0&&sourceBlocks.slice(0,separator).every(b=>header(b.raw))?separator:firstStory).filter(b=>b.raw.trim());
   const notes=[...raw.matchAll(/%%[\s\S]*?%%/g)].map(m=>m[0]).filter(note=>!/^%%\/?(?:pull|photo|photos|side|glyph|on-photo|saying|ending|close)(?::|%%)/.test(note));
   const view=<div className="ar-donor-workspace"><main className="ar-magazine-reader ar-working-article" data-template-render="magazine" data-manuscript-preview={owner.hash}><p className="ar-working-notice">Working draft · pending wording remains marked.</p><LocalStoryProvider placements={[]} editing={false} onPlacements={()=>{}}><ConversationCanvas spec={spec} paragraphs={paragraphs}/></LocalStoryProvider>{!!credits.length&&<section className="ar-working-records" data-working-credits aria-label="Saved credits">{credits.map((b,i)=><AcceptedProse key={i} paragraphId={'credits:'+i} document={markdownToDoc(b.raw,{links:true})}/>)}</section>}{!!notes.length&&<section className="ar-working-records" data-working-notes><h2>Editorial notes · retained for review</h2>{notes.map((text,i)=><pre key={i}>{text}</pre>)}</section>}</main></div>;
   return {view,placements:[]};
  }
  const view=<main className="ar-working-manuscript" data-manuscript-preview={owner.hash} style={{maxWidth:760,margin:'0 auto',boxSizing:'border-box',padding:'32px 24px',background:'var(--bg,#151b18)',color:'var(--ink,#f1efe8)',fontFamily:'sans-serif',fontSize:17,lineHeight:1.65}}><p style={{fontSize:13}}>Working draft · pending marks and retained notes remain visible.</p>{!blocks.some((b:any)=>b.doc?.content?.some((n:any)=>n.type==='heading'&&n.attrs?.level===1))&&<h1>{read.spec.title}</h1>}{blocks.map((b:any)=>b.doc?<AcceptedProse key={b.id} paragraphId={b.id} document={b.doc}/>:<pre key={b.id} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',font:'inherit'}}>{b.raw}</pre>)}</main>;
  return {view,placements:[]};
 }
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
