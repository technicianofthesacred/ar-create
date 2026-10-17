import {digest} from './files.mjs';
import {capture,projection,render,inlineMap} from './draft-correspondence.mjs';
import {markdownToDoc} from '../src/donors/wordforge/wf-block-markdown';
import {snapshotOutput,plainText,type Manuscript,type Paragraph} from '../src/workspaces/document';
import {structuredMarkdown} from '../src/workspaces/structured-markdown.mjs';
import {captureArticleComposition} from '../src/workspaces/articleComposition';
import {documentParts,readableBlock} from '../src/donors/mag/markdown-blocks';
import {approvalMarks,assertOutputEditorialReady} from '../src/workspaces/editorial-state.mjs';
const stable=(v:any):string=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const same=(a:any,b:any)=>stable(a)===stable(b);
const fail=(message:string):never=>{throw Error(message)};
const HASH=/^[a-f0-9]{64}$/;
const freeze=(v:any):any=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
const text=(v:any,label:string):string=>typeof v==='string'&&v.isWellFormed()&&v.trim()?v:fail(label+' requires exact readable text.');
const privateNoteRoles:any={source:'source-provenance-note',sources:'source-provenance-summary',heard:'transcription-correction-note'};
const knownLayout=new Set(['photo','photos','side','/side','glyph','/glyph','pull','on-photo','saying','ending']);
const layout=/%%\s*(?:\/?(?:side|glyph|photos?|wide|bleed|on-photo|hook|intro|closing|ending|chapter|line|portrait|opener))\b/i;
const unsafeMarkdown=(s:string)=>/(^|\n)[ \t]*(?:`{3,}|~{3,}|\|.*\|)|<\/?[A-Za-z!][^>]*>|!\[[^\]\n]*\]\s*(?:\(|\[)|~~/.test(s);
const credits=/^\*\*(?:Conversations over Tea|Story Subject|Interview by|Interview Date|Photography, Words, Translation|Location|By|Published)\b/;
const supportedTree=(n:any):boolean=>{
 const nodes:any={doc:[],paragraph:['sep'],heading:['sep','level'],blockquote:['sep'],bulletList:['sep','tight'],orderedList:['sep','tight','start'],listItem:[],text:[],hardBreak:[]};
 if(!nodes[n?.type]||Object.keys(n).some(k=>!['type','attrs','content','text','marks'].includes(k))||Object.keys(n.attrs||{}).some(k=>!nodes[n.type].includes(k)))return false;
 if(n.type==='heading'&&![1,2,3].includes(n.attrs?.level))return false;
 for(const mark of n.marks||[])if(!['bold','italic','code','link'].includes(mark.type)||Object.keys(mark.attrs||{}).some(k=>!['markup','href','title','markdownDestination'].includes(k)))return false;
 return (n.content||[]).every(supportedTree);
};
function sources(snapshot:any){return (snapshot.context?.records||[]).filter((r:any)=>r.role!=='draft').map((r:any)=>{
 const hash=r.copiedHash??r.hash??null;if(!r.missing&&(typeof r.raw!=='string'||!HASH.test(hash||'')||digest(r.raw)!==hash))fail('Native retained source capture hash changed.');
 return {id:r.id,role:r.role,sourcePath:r.sourcePath??r.path??null,hash,missing:!!r.missing};
}).sort((a:any,b:any)=>String(a.id).localeCompare(String(b.id)));}
function validate(snapshot:any,emptyBoundaries=false){
 if(snapshot.binding?.authority!=='owned-working-copy'||snapshot.binding.status!=='ready'||snapshot.readiness?.ready!==true)fail('A ready exact owned native snapshot is required.');
 if(Buffer.byteLength(snapshot.raw||'')>2*1024*1024)fail('Native capture exceeds the existing two-megabyte document bound.');
 text(snapshot.binding.id,'Native binding');text(snapshot.binding.parentStudyId,'Native parent');text(snapshot.raw,'Native raw');
 if(snapshot.expected?.workflow?.draft!==digest(snapshot.raw)||!Array.isArray(snapshot.projection))fail('Native expected raw hash or projection changed.');
 const model=capture(snapshot.raw,'native-output-probe');const modelRows=emptyBoundaries?model.blocks.filter((b:any)=>b.raw.trim()):model.blocks,projectionRows=emptyBoundaries?snapshot.projection.filter((b:any)=>b.raw.trim()):snapshot.projection;if(render(model)!==snapshot.raw||modelRows.length!==projectionRows.length)fail('Native donor topology or exact raw bytes changed.');
 const ids=new Set();for(const row of snapshot.projection){
  if(!row.id||ids.has(row.id)||(row.raw.trim()||!emptyBoundaries)&&row.raw!==modelRows[projectionRows.indexOf(row)]?.raw||row.blockHash!==digest(row.raw))fail('Native paragraph identity/raw/block hash changed.');ids.add(row.id);
  const mapped=inlineMap(row.raw);for(const key of ['safe','words','doc','blockKind','level','notes'])if(!same(row[key],mapped[key]))fail('Native projection differs from its authoritative donor mapping.');
 }
 return sources(snapshot);
}
/** Pure captured adapter. Never creates a cooperating editable manuscript or
 * calls native/runtime save. All private material stays in the sidecar. */
export function captureNativeOutput(snapshot:any,scope:{projectId:string;documentId:string;outputId:string},options:{outputKind?:'post'|'product-listing';photoBindings?:{nativeFile:string;sourceId:string;sourceHash:string}[]}={}){
 if(options.outputKind!==undefined&&!['post','product-listing'].includes(options.outputKind))fail('Unsupported text output kind.');
 const sourceProof=validate(snapshot,!!options.outputKind);for(const key of ['projectId','documentId','outputId'])text((scope as any)[key],key);
 const photoBindings=structuredClone(options.photoBindings||[]);if(!Array.isArray(photoBindings)||photoBindings.length>200)fail('Explicit bounded original-file to Library photo bindings required.');
 const photoNames=new Set();for(const row of photoBindings){if(Object.keys(row).some(k=>!['nativeFile','sourceId','sourceHash'].includes(k))||!row.nativeFile||!row.sourceId||!HASH.test(row.sourceHash)||photoNames.has(row.nativeFile))fail('Photo binding identity/hash must be explicit and unique.');photoNames.add(row.nativeFile);}
 const original=structuredClone(snapshot),paragraphs:Paragraph[]=[],mapping:any[]=[],held:any[]=[];
 const blocks=documentParts(snapshot.raw,false).blocks,header=(raw:string)=>!raw.trim()||/^#\s/.test(raw.trim())||credits.test(raw.trim());
 const boundary=blocks.findIndex((b:any)=>b.raw.trim()==='---');let first=0;while(first<blocks.length&&header(blocks[first].raw))first++;
 const storyStart=options.outputKind?0:boundary>=0&&blocks.slice(0,boundary).every((b:any)=>header(b.raw))?boundary+1:first;
 for(const [index,row]of snapshot.projection.entries()){
  const terms=[...row.raw.matchAll(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g)].map((m:any)=>({id:m[1],label:m[2],raw:m[0]}));
  const hidden=[...row.raw.matchAll(/%%[\s\S]*?%%|<!--[\s\S]*?-->/g)].map((m:any)=>({raw:m[0],from:m.index,to:m.index+m[0].length,role:privateNoteRoles[/^%%\s*(source|sources|heard)\s*:/i.exec(m[0])?.[1]?.toLowerCase()||'']||'retained-native-note'}));
  const item:any={nativeId:row.id,nativeBlockHash:row.blockHash,hidden,terms,protected:row.safe===false,disposition:'held'};mapping.push(item);
  if(index<storyStart||row.raw.trim()==='---'){item.disposition='private-credit-title-separator-metadata';continue;}
  const directives=hidden.filter((note:any)=>note.raw.startsWith('%%')).map((note:any)=>({note,tag:/^%%\s*(\/?[a-z-]+)(?:\s*:|\s*%%)/i.exec(note.raw)?.[1]||null}));
  const unknown=directives.find(({tag}:any)=>tag&&!knownLayout.has(tag)&&!['you','was','note','editorial','comment','source','sources','heard'].includes(tag.toLowerCase()));
  if(unknown){held.push({nativeId:row.id,category:'unknown-native-directive',token:unknown.tag,reason:'The existing Magazine layout codec has no semantic handler for this native directive.'});continue;}
  const readable=readableBlock(row.raw.replaceAll('==','\u0000native-approval\u0000')).replaceAll('\u0000native-approval\u0000','==').trim();
  if(!readable){item.disposition=directives.some(({tag}:any)=>knownLayout.has(tag))?'native-layout-directive':'private-editorial-metadata';continue;}
  if(approvalMarks(readable).tokens){held.push({nativeId:row.id,category:'unresolved-native-approval',reason:'Existing /mag wholeDraft/editorial-state treats these == marks as unresolved approval; native.editable/safe is not an approval receipt.'});continue;}
  if(unsafeMarkdown(readable)){held.push({nativeId:row.id,category:'unsupported-rich-structure',reason:'Existing output Markdown grammar cannot faithfully represent this table/fence/raw HTML/image/strike block.'});continue;}
  let doc:any,markdown:string;try{doc=markdownToDoc(readable,{links:true});markdown=structuredMarkdown(doc);}catch(error){held.push({nativeId:row.id,category:'unsafe-link-or-rich-format',reason:(error as Error).message});continue;}
  if(!supportedTree(doc)||markdown!==readable){held.push({nativeId:row.id,category:'nonlossless-markdown',reason:'Existing output Markdown bridge cannot roundtrip this protected native block exactly.'});continue;}
  const paragraph:Paragraph={id:row.id,doc:structuredClone(doc),text:markdown,attributions:[],kept:[],origin:'source'};
  paragraphs.push(paragraph);item.disposition='immutable-output-passage';item.outputParagraphId=row.id;item.publishedWordsHash=digest(plainText(doc));item.publishedMarkdownHash=digest(markdown);item.transforms=[...(hidden.length?['native-notes-retained-private-with-codec-layout-handlers']:[]),...(terms.length?['existing-mag-protected-term-display-label']:[]),...(row.safe===false?['protected-block-exact-markdown-roundtrip']:[])];
 }
 if(!options.outputKind&&!paragraphs.length&&!held.length)held.push({nativeId:null,reason:'Native snapshot contains no supported publishable passage.'});
 const document:Manuscript={schema:'ar-create.document.v1',id:scope.documentId,revision:0,title:text(snapshot.binding.title,'Native title'),paragraphs,outputs:[]};
 let output:any=null,photoRequests:any[]=[];if(!held.length){
  try{if(options.outputKind){output={...snapshotOutput(document),id:scope.outputId,kind:options.outputKind,placements:[]};assertOutputEditorialReady(output);}else{const composed=captureArticleComposition(paragraphs,snapshot.raw);photoRequests=composed.photoRequests.map(request=>{const bound=photoBindings.find(p=>p.nativeFile===request.file);return {slot:request.slot,nativeFile:request.file,sourceId:bound?.sourceId||null,sourceHash:bound?.sourceHash||null,resolved:!!bound};});if(photoBindings.some(bound=>!photoRequests.some(request=>request.nativeFile===bound.nativeFile)))fail('Explicit photo binding does not belong to this native layout.');output={...snapshotOutput(document),id:scope.outputId,articleComposition:composed.composition,placements:composed.placements.map(p=>{const request=photoRequests.find(row=>row.slot===p.slot);return request?.resolved?{...p,url:'/api/sources/blob?id='+encodeURIComponent(request.sourceId)}:p;})};assertOutputEditorialReady(output);}}
  catch(error){held.push({nativeId:null,category:'native-layout-codec-incompatibility',reason:(error as Error).message});output=null;}
 }
 const payload:any={schema:'ar-create.native-output-probe.v1',role:'immutable-native-output-capture-not-a-second-editable-manuscript',scope:structuredClone(scope),...(options.outputKind?{outputKind:options.outputKind}:{}),ready:!held.length,mediaReady:photoRequests.every(p=>p.resolved),held,nativeProof:{bindingId:snapshot.binding.id,parentStudyId:snapshot.binding.parentStudyId,expected:structuredClone(snapshot.expected),rawHash:digest(snapshot.raw),sourceProof,photoProof:photoBindings,projectionHash:digest(stable(snapshot.projection))},output,outputHash:output?digest(stable(output)):null,privateSidecar:{nativeSnapshot:original,mapping,photoBindings,photoRequests},sourceIdentityPolicy:'Native source identities/protected term IDs retained privately; no paragraph source attribution or authorship inferred.'};
 return freeze({...payload,captureHash:digest(stable(payload))});
}
/** Existing renderer requires a document-shaped input. This is ephemeral,
 * shares the immutable output manuscript, and is never persisted or editable. */
export function nativeOutputRenderDocument(value:any):Manuscript {
 if(!value.ready||!value.output)fail('Native output capture is held; do not render a partial manuscript.');
 return freeze({schema:'ar-create.document.v1',id:value.scope.documentId,revision:value.output.manuscriptRevision,title:value.output.title,paragraphs:value.output.manuscript,outputs:[value.output]});
}
export function reopenNativeOutput(bytes:string){let value:any;try{value=JSON.parse(bytes)}catch{fail('Captured native output is malformed.')};const {captureHash,...payload}=value;if(value.schema!=='ar-create.native-output-probe.v1'||captureHash!==digest(stable(payload))||value.outputHash!==(value.output?digest(stable(value.output)):null))fail('Captured native output or sidecar integrity changed.');validate(value.privateSidecar.nativeSnapshot,!!value.outputKind);const derived=captureNativeOutput(value.privateSidecar.nativeSnapshot,value.scope,{photoBindings:value.privateSidecar.photoBindings,...(value.outputKind?{outputKind:value.outputKind}:{})}),published=(o:any)=>o?{...o,createdAt:undefined}:null;if(!same(value.nativeProof,derived.nativeProof)||!same(value.privateSidecar.mapping,derived.privateSidecar.mapping)||!same(published(value.output),published(derived.output))||!same(value.held,derived.held)||!same(value.privateSidecar.photoRequests,derived.privateSidecar.photoRequests)||value.mediaReady!==derived.mediaReady||value.ready!==derived.ready)fail('Output wording/structure does not match its exact native source capture.');return freeze(value);}
export function nativeOutputFreshness(value:any,current:any,currentSources:any[],currentPhotos?:any[]){
 const captureValue=reopenNativeOutput(JSON.stringify(value));try{const proof=validate(current,!!captureValue.outputKind);if(captureValue.nativeProof.bindingId!==current.binding.id||captureValue.nativeProof.parentStudyId!==current.binding.parentStudyId||captureValue.nativeProof.rawHash!==digest(current.raw)||!same(captureValue.nativeProof.expected,current.expected)||captureValue.nativeProof.projectionHash!==digest(stable(current.projection)))return {stale:true,reason:'Exact native revision/paragraph identity changed; output retained, no native rewrite.'};if(!same(captureValue.nativeProof.sourceProof,proof))return {stale:true,reason:'Native retained source capture changed.'};if(captureValue.nativeProof.photoProof.length&&!same(captureValue.nativeProof.photoProof,currentPhotos))return {stale:true,reason:'Explicit Library photo identity/hash changed or its live proof was not supplied.'};if(proof.length){if(!Array.isArray(currentSources)||!same(proof,currentSources))return {stale:true,reason:'Current authoritative original source identities/hashes differ or were not supplied.'};}return {stale:false,reason:null};}catch(error){return {stale:true,reason:(error as Error).message};}
}
