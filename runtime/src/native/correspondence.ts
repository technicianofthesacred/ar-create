import {exactApprovalSpans,approveExactSpan} from '../../services/draft-approval.mjs';
import {reworkSlashes} from '../../reference/mag-edit.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {documentParts,plain,editable,readableBlock} from '../donors/mag/markdown-blocks';
import {draftBody,parseDraft} from '../donors/mag/mag-send';
import {markdownToDoc} from '../donors/wordforge/wf-block-markdown';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const conflict=(reason:string):never=>{throw new Error(reason);};
type BlockKind='paragraph'|'heading'|'blockquote';
type Run={from:number;to:number;rawFrom:number;rawTo:number;locked:boolean};
type Block={id:string;raw:string;separator:string;origin:{fileHash:string;blockHash:string;offset:number}|null};
type Snapshot={schema:'mag-dev-correspondence.v1';sourceKey:string;fileHash:string;prefix:string;blocks:Block[]};
/** Byte correspondence, not a replacement Markdown parser. The donor remains the
 * native document reader. This bounded subset maps exact visible UTF-16 positions
 * to original bytes; every unsupported construct remains exact and read-only. */
function envelope(raw:string){
 const trimmed=raw.trim(),start=raw.indexOf(trimmed),end=start+trimmed.length;
 const heading=/^(#{1,3})([ \t]+)(?=\S)/.exec(trimmed),quote=/^>( ?)(?=\S)/.exec(trimmed);
 const kind:BlockKind=heading?'heading':quote?'blockquote':'paragraph';
 const prefix=heading?heading[0]:quote?quote[0]:'';
 return {kind,level:heading?.[1].length,start,end,prefix,bodyStart:start+prefix.length};
}
const treeWords=(node:any):string=>node.type==='text'?node.text||'':node.type==='hardBreak'?'\n':(node.content||[]).map(treeWords).join('');
export function inlineMap(raw:string){
 let words='',runs:Run[]=[],notes=false,safe=true,reworks:{from:number;to:number;rawFrom:number;rawTo:number;words:string}[]=[];
 const add=(value:string,a:number,b:number,locked=false)=>{runs.push({from:words.length,to:words.length+value.length,rawFrom:a,rawTo:b,locked});words+=value;};
 const scan=(a:number,b:number)=>{let i=a;while(i<b){const rest=raw.slice(i,b);let m;
  if(rest.startsWith('%%rework%%')){
   const request=/^%%rework%%([^\r\n]*?)%%\/rework%%/.exec(rest);
   if(!request||!request[1].trim()||request[1].includes('%%')){safe=false;add(rest,i,b,true);i=b;continue;}
   const from=words.length,end=i+request[0].length;
   add('/',i,i+10);scan(i+10,end-11);add('/',end-11,end);
   reworks.push({from,to:words.length,rawFrom:i,rawTo:end,words:plain(request[1])});i=end;continue;
  }
  if((m=/^(%%[\s\S]*?%%|<!--[\s\S]*?-->)/.exec(rest))){notes=true;add('',i,i+m[0].length,true);i+=m[0].length;continue;}
  if((m=/^\[\[term:[^|\]]+\|([^\]]+)\]\]/.exec(rest))){add(m[1],i,i+m[0].length,true);i+=m[0].length;continue;}
  if((m=/^==([^=]+)==/.exec(rest))){add(plain(m[1]),i,i+m[0].length,true);i+=m[0].length;continue;}
  if((m=/^\[([^\]]+)\]\(([^)]+)\)/.exec(rest))){add(plain(m[1]),i,i+m[0].length,true);i+=m[0].length;continue;}
  if((m=/^(\*\*|__)([^*_]+)\1/.exec(rest))){scan(i+m[1].length,i+m[0].length-m[1].length);i+=m[0].length;continue;}
  // The map intentionally does not claim support for nesting, escaped delimiters,
  // emphasis, rework, code, HTML, or multiline hard-break syntax.
  if(/[\n\r*_`<>{}\\]/.test(raw[i])||rest.startsWith('%%')||rest.startsWith('==')||rest.startsWith('[['))safe=false;
  add(raw[i],i,i+1);i++;
 }};const frame=envelope(raw);scan(frame.bodyStart,frame.end);
 const leading=words.length-words.trimStart().length,trailing=words.trimEnd().length;
 runs=runs.map(r=>({...r,from:r.from-leading,to:r.to-leading})).filter(r=>r.to>=0&&r.from<=trailing-leading);
 reworks=reworks.map(r=>({...r,from:r.from-leading,to:r.to-leading}));words=words.trim();
 const body=raw.slice(frame.bodyStart,frame.end);
 const knownWholeRequest=reworks.length===1&&reworks[0].from===0&&reworks[0].to===words.length&&!notes;
 safe=safe&&!/^(?: {4}|\t)/m.test(raw)&&(editable(raw)||knownWholeRequest)&&words===plain(body)&&!/^\s*[#>]|^\s*[-+*]\s|^\s*\d+[.)]\s/.test(body);
 let doc:any=null;
 if(safe){
  doc=markdownToDoc(readableBlock(raw.slice(frame.start, frame.end)),{links:true});const nodes=doc.content||[],node=nodes[0];
  // The actual donor decides whether the prefix represents the expected native kind.
  // Closing ATX hashes, indented code, nested quotes, and extra donor nodes are opaque.
  safe=nodes.length===1&&treeWords(doc)===words&&(frame.kind==='paragraph'?node?.type==='paragraph':frame.kind==='heading'?node?.type==='heading'&&node.attrs?.level===frame.level:node?.type==='blockquote'&&node.content?.length===1&&node.content[0].type==='paragraph');
  if(!safe)doc=null;
 }
 return {words,runs,notes,safe,doc,blockKind:frame.kind,level:frame.level,frame,reworks};
}
export function render(snapshot:Snapshot){return snapshot.prefix+snapshot.blocks.map(b=>b.raw+b.separator).join('');}
export function capture(raw:string,sourceKey:string):Snapshot{
 const m=documentParts(raw,false),blocks:Block[]=[],fileHash=hash(raw);let offset=m.prefix.length;
 for(let i=0;i<m.parts.length;i++){
  if(m.separators.has(i))conflict('Unexpected donor separator topology.');
  const block=m.parts[i],separator=m.separators.has(i+1)?m.parts[++i]:'';
  blocks.push({id:randomUUID(),raw:block,separator,origin:{fileHash,blockHash:hash(block),offset}});offset+=block.length+separator.length;
 }
 const out={schema:'mag-dev-correspondence.v1' as const,sourceKey,fileHash,prefix:m.prefix,blocks};
 if(render(out)!==raw)conflict('Donor projection did not retain exact bytes.');return out;
}
export function projection(s:Snapshot){return s.blocks.map(b=>({id:b.id,origin:b.origin,blockHash:hash(b.raw),...inlineMap(b.raw)}));}
type Edit={kind:'text';id:string;from:number;to:number;insert:string;seenBlockHash:string};
type AssetPhotoOp={kind:'photoReplaceAsset';id:string;seenBlockHash:string;rootId:string;sourceId:string;revision:string;sourceHash:string;description:string};
type Op=AssetPhotoOp|Edit|{kind:'photoDescription';id:string;seenBlockHash:string;description:string}|{kind:'photoReplace';id:string;seenBlockHash:string;replacementId:string;seenReplacementHash:string}|{kind:'photoAspect';id:string;seenBlockHash:string;aspect:string}|{kind:'photoFocus';id:string;seenBlockHash:string;x:number;y:number}|{kind:'approveMark';id:string;rawFrom:number;rawTo:number;seenBlockHash:string;seenMarkupHash:string;humanDecision:true}|{kind:'move';id:string;beforeId:string|null}|{kind:'split';id:string;at:number;newId:string}|{kind:'join';leftId:string;rightId:string}|{kind:'insert';id:string;beforeId:string|null;raw:string}|{kind:'delete';id:string}|{kind:'blockKind';id:string;blockKind:BlockKind;level?:number;seenBlockHash:string};
const byteBoundary=(map:ReturnType<typeof inlineMap>,position:number,bias:'left'|'right'='right')=>{
 if(position>0&&position<map.words.length&&/[\uD800-\uDBFF]/.test(map.words[position-1])&&/[\uDC00-\uDFFF]/.test(map.words[position]))conflict('Native range divides a Unicode character.');
 if(!Number.isSafeInteger(position)||position<0||position>map.words.length)conflict('Invalid native range.');
 // A boundary inside a protected semantic span cannot split its identity.
 if(map.runs.some(r=>r.locked&&r.from<position&&position<r.to))conflict('Protected inline identity cannot be split.');
 const right=map.runs.find(r=>r.from===position&&r.to>position),left=[...map.runs].reverse().find(r=>r.to===position&&r.from<position);
 return (bias==='left'?left?.rawTo??right?.rawFrom:right?.rawFrom??left?.rawTo)??conflict('Unmapped native boundary.');
};
/** Pure candidate only. No path access, store, provider, original writer or dual-write. */
export function apply(s:Snapshot,currentRaw:string,ops:Op[],trusted?:{photoAssets?:Array<AssetPhotoOp&{file:string}>}){
 if(hash(currentRaw)!==s.fileHash||currentRaw!==render(s))conflict('External file change: reload and explicitly rebind; never rematch repeated text by position.');
 const next=structuredClone(s),ledger:any[]=[],reworkLog:string[]=[];
 const get=(id:string)=>next.blocks.find(b=>b.id===id)??conflict('Unknown stable block ID.');
 const fresh=(id:string)=>{if(!id||next.blocks.some(b=>b.id===id))conflict('Fresh unique native ID required.');};
 const newline=currentRaw.includes('\r\n')?'\r\n':'\n';
 if(!Array.isArray(ops)||ops.length>1000)conflict('Bounded operation array required.');
 for(const op of ops){
  validateOperation(op);
  if(op.kind==='photoReplaceAsset'){
   const b=get(op.id),assets=trusted?.photoAssets?.filter(asset=>['rootId','sourceId','revision','sourceHash','description'].every(k=>(asset as any)[k]===(op as any)[k]));
   if(ops.length!==1||hash(b.raw)!==op.seenBlockHash||next.blocks.filter(row=>row.id===op.id).length!==1)conflict('Use one current exact photo occurrence for library replacement.');
   if(assets?.length!==1||!new RegExp('^library-photo-'+op.sourceHash+'\\.(jpg|png|webp|gif|avif)$').test(assets[0].file))conflict('A trusted owner-resolved library photograph is required.');
   const raw=render(next),offset=next.prefix.length+next.blocks.slice(0,next.blocks.indexOf(b)).reduce((n,row)=>n+row.raw.length+row.separator.length,0),trimmed=b.raw.trim(),start=offset+b.raw.indexOf(trimmed);
   let range:{start:number;end:number}|undefined;const body=draftBody(raw,r=>{range=r;}),observations:any[]=[];
   const story=parseDraft(body.body,undefined,(shot,origin)=>observations.push({shot,origin})),matches=observations.filter(({origin:o})=>range&&range.start+o.chunkStart===start&&range.start+o.chunkEnd===start+trimmed.length),hit=matches[0],o=hit?.origin;
   const contains=(value:any,shot:any):boolean=>value===shot||!!value&&typeof value==='object'&&Object.values(value).some(v=>contains(v,shot));
   if(matches.length!==1||!o||o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||o.directiveStart!==o.chunkStart||o.directiveEnd!==o.chunkEnd||contains(story.ending,hit.shot))conflict('Replace only a standalone wide or bleed article photo.');
   b.raw=photoReplaceRaw(b.raw,'%%photo: '+assets[0].file+' · '+op.description+' · wide%%');
  }else if(op.kind==='photoReplace'){
   const b=get(op.id),source=get(op.replacementId);
   if(ops.length!==1||hash(b.raw)!==op.seenBlockHash||hash(source.raw)!==op.seenReplacementHash||b===source)conflict('Use two current exact photo occurrences for replacement.');
   const raw=render(next);let range:{start:number;end:number}|undefined;const body=draftBody(raw,r=>{range=r;}),observations:any[]=[];
   const story=parseDraft(body.body,undefined,(shot,origin)=>observations.push({shot,origin}));
   const contains=(value:any,shot:any):boolean=>value===shot||!!value&&typeof value==='object'&&Object.values(value).some(v=>contains(v,shot));
   for(const block of [b,source]){
    if(next.blocks.filter(row=>row.id===block.id).length!==1)conflict('Photo replacement requires unique native block IDs.');
    const offset=next.prefix.length+next.blocks.slice(0,next.blocks.indexOf(block)).reduce((n,row)=>n+row.raw.length+row.separator.length,0),trimmed=block.raw.trim(),start=offset+block.raw.indexOf(trimmed);
    const matches=observations.filter(({origin:o})=>range&&range.start+o.chunkStart===start&&range.start+o.chunkEnd===start+trimmed.length),hit=matches[0],o=hit?.origin;
    if(matches.length!==1||!o||o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||o.directiveStart!==o.chunkStart||o.directiveEnd!==o.chunkEnd||contains(story.ending,hit.shot))conflict('Replace only standalone article photos with another standalone photo in this draft.');
   }
   b.raw=photoReplaceRaw(b.raw,source.raw);
  }else if(op.kind==='photoAspect'){
   const b=get(op.id);if(ops.length!==1||hash(b.raw)!==op.seenBlockHash)conflict('Use one current exact photo occurrence for its shape.');
   if(next.blocks.filter(row=>row.id===op.id).length!==1)conflict('Photo shape requires one unique stable block ID.');
   const raw=render(next),offset=next.prefix.length+next.blocks.slice(0,next.blocks.indexOf(b)).reduce((n,row)=>n+row.raw.length+row.separator.length,0),trimmed=b.raw.trim(),start=offset+b.raw.indexOf(trimmed);
   let range:{start:number;end:number}|undefined;const body=draftBody(raw,r=>{range=r;}),observations:any[]=[];
   const story=parseDraft(body.body,undefined,(shot,origin)=>observations.push({shot,origin}));
   const matches=observations.filter(({origin:o})=>range&&range.start+o.chunkStart===start&&range.start+o.chunkEnd===start+trimmed.length);
   const contains=(value:any,shot:any):boolean=>value===shot||!!value&&typeof value==='object'&&Object.values(value).some(v=>contains(v,shot));
   const hit=matches[0],o=hit?.origin;
   if(matches.length!==1||!o||o.kind!=='photo'||o.role!=='wide'||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||o.directiveStart!==o.chunkStart||o.directiveEnd!==o.chunkEnd||contains(story.ending,hit.shot))conflict('Photo shape supports only a standalone wide article photo.');
   b.raw=photoAspectRaw(b.raw,op.aspect);
  }else if(op.kind==='photoDescription'){
   const b=get(op.id);if(ops.length!==1||hash(b.raw)!==op.seenBlockHash||next.blocks.filter(row=>row.id===op.id).length!==1)conflict('Use one current exact photo occurrence for its description.');
   const raw=render(next),offset=next.prefix.length+next.blocks.slice(0,next.blocks.indexOf(b)).reduce((n,row)=>n+row.raw.length+row.separator.length,0),trimmed=b.raw.trim(),start=offset+b.raw.indexOf(trimmed);
   let range:{start:number;end:number}|undefined;const body=draftBody(raw,r=>{range=r;}),observations:any[]=[];
   const story=parseDraft(body.body,undefined,(shot,origin)=>observations.push({shot,origin}));
   const matches=observations.filter(({origin:o})=>range&&range.start+o.chunkStart===start&&range.start+o.chunkEnd===start+trimmed.length);
   const contains=(value:any,shot:any):boolean=>value===shot||!!value&&typeof value==='object'&&Object.values(value).some(v=>contains(v,shot));
   const hit=matches[0],o=hit?.origin;
   if(matches.length!==1||!o||o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||o.directiveStart!==o.chunkStart||o.directiveEnd!==o.chunkEnd||contains(story.ending,hit.shot))conflict('Description editing supports only a standalone article photo.');
   const fields=b.raw.match(/^(\s*%%photo:[^\r\n%]*? · )([^\r\n%]*?)( · [^\r\n%]*)?(%%\s*)$/);
   if(!fields||b.raw.split(' · ').length>3||fields[2].includes(' · '))conflict('Photo description needs an unambiguous native field.');
   if(fields[2].trim()===op.description)conflict('Photo already has this description.');
   const padding=fields[2].match(/^(\s*)(.*?)(\s*)$/)!;
   b.raw=fields[1]+padding[1]+op.description+padding[3]+(fields[3]||'')+fields[4];
  }else if(op.kind==='photoFocus'){
   const b=get(op.id);if(ops.length!==1||hash(b.raw)!==op.seenBlockHash)conflict('Use one current exact photo occurrence for its focal point.');
   const raw=render(next),offset=next.prefix.length+next.blocks.slice(0,next.blocks.indexOf(b)).reduce((n,row)=>n+row.raw.length+row.separator.length,0),trimmed=b.raw.trim(),start=offset+b.raw.indexOf(trimmed);
   let range:{start:number;end:number}|undefined;const body=draftBody(raw,r=>{range=r;}),observations:any[]=[];
   const story=parseDraft(body.body,undefined,(shot,origin)=>observations.push({shot,origin}));
   const matches=observations.filter(({origin:o})=>range&&range.start+o.chunkStart===start&&range.start+o.chunkEnd===start+trimmed.length);
   const contains=(value:any,shot:any):boolean=>value===shot||!!value&&typeof value==='object'&&Object.values(value).some(v=>contains(v,shot));
   const hit=matches[0],o=hit?.origin;
   if(matches.length!==1||!o||o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||o.directiveStart!==o.chunkStart||o.directiveEnd!==o.chunkEnd||contains(story.ending,hit.shot))conflict('Focal adjustment supports only a standalone article photo.');
   b.raw=photoFocusRaw(b.raw,op.x,op.y);
  }else if(op.kind==='approveMark'){
      const b=get(op.id),beforeFrame=envelope(b.raw);
      if(hash(b.raw)!==op.seenBlockHash)conflict('Block changed since exact human approval capture.');
      if(!editable(b.raw))conflict('Opaque source structure requires its own decision, not prose approval.');
      const changed=approveExactSpan(b.raw,op),afterFrame=envelope(changed);
      if(beforeFrame.kind!==afterFrame.kind||beforeFrame.level!==afterFrame.level)conflict('Approval cannot change source words or native block kind.');
      const beforeParts=documentParts(b.raw,false),afterParts=documentParts(changed,false);
      if(beforeParts.prefix!==afterParts.prefix||beforeParts.parts.length!==afterParts.parts.length||JSON.stringify([...beforeParts.separators])!==JSON.stringify([...afterParts.separators]))conflict('Approval cannot change native topology.');
      b.raw=changed;
    }else if(op.kind==='text'){
   const b=get(op.id),m=inlineMap(b.raw);if(hash(b.raw)!==op.seenBlockHash)conflict('Block changed since native edit capture.');if(!m.safe)conflict('Unknown source syntax is read-only.');
   if(op.from>op.to||/[\r\n\u0000]/.test(op.insert)||/[\[\]*_`<>=]|%%/.test(op.insert))conflict('Use explicit structure/format operations; text insert cannot invent syntax.');
   // A correction is not approval: allow a bounded ordinary-text edit inside
   // one exact plain ==span==, retaining both delimiters and every other lock.
   const offered=exactApprovalSpans(b.raw);
   const pendingRun=m.runs.find(r=>r.locked&&r.from<=op.from&&r.to>=op.to&&(op.from<op.to||op.from>r.from&&op.from<r.to)&&offered.some(span=>span.rawFrom===r.rawFrom&&span.rawTo===r.rawTo)&&b.raw.slice(r.rawFrom+2,r.rawTo-2)===m.words.slice(r.from,r.to)&&!/[\r\n\[\]*_`<>=\\]|%%/.test(b.raw.slice(r.rawFrom+2,r.rawTo-2)));
   if(m.runs.some(r=>r.locked&&r!==pendingRun&&(r.from<op.to&&r.to>op.from||r.from===r.to&&op.from<r.from&&op.to>r.to)))conflict('Native edit touches protected source/term/pending/note bytes.');
   if(pendingRun)for(const position of [op.from,op.to])if(position>0&&position<m.words.length&&/[\uD800-\uDBFF]/.test(m.words[position-1])&&/[\uDC00-\uDFFF]/.test(m.words[position]))conflict('Native range divides a Unicode character.');
   if(op.insert===m.words.slice(op.from,op.to))continue;
   const completeRequest=m.reworks.find(r=>r.from===op.from&&r.to===op.to);
   const a=pendingRun?pendingRun.rawFrom+2+op.from-pendingRun.from:completeRequest?.rawFrom??byteBoundary(m,op.from),z=pendingRun?pendingRun.rawFrom+2+op.to-pendingRun.from:completeRequest?.rawTo??byteBoundary(m,op.to,'left');
   // Only a complete request replacement may traverse its synthetic slash boundaries.
   if(!completeRequest&&z-a!==op.to-op.from)conflict('Native range crosses a formatting or request boundary; edit each text run or complete request separately.');
   let changed=b.raw.slice(0,a)+op.insert+b.raw.slice(z);
   const mapped=inlineMap(changed);
   if(!mapped.safe||mapped.blockKind!==m.blockKind||mapped.level!==m.level)conflict('Edit would create unsupported or unbalanced source syntax or change block kind.');
   if(pendingRun&&exactApprovalSpans(changed).length!==offered.length)conflict('Pending wording correction must retain every review mark.');
   const requests=[...mapped.words.matchAll(reworkSlashes())].map(match=>({from:match.index!+match[1].length,to:match.index!+match[0].length,words:match[2]}));
   for(const request of requests.reverse()){
    if(mapped.reworks.some(r=>r.from===request.from&&r.to===request.to))continue;
    if(mapped.runs.some(r=>r.locked&&(r.from<request.to&&r.to>request.from||r.from===r.to&&request.from<r.from&&request.to>r.to)))conflict('Rework request touches protected source/term/pending/note identity.');
    const start=byteBoundary(mapped,request.from),end=byteBoundary(mapped,request.to,'left'),rawSpan=changed.slice(start,end);
    if(!rawSpan.startsWith('/')||!rawSpan.endsWith('/'))conflict('Request range is not losslessly mapped to source slashes.');
    changed=changed.slice(0,start)+'%%rework%%'+rawSpan.slice(1,-1)+'%%/rework%%'+changed.slice(end);
   }
   const after=inlineMap(changed);if(!after.safe)conflict('Rework request is not safely represented by the native donor.');
   // Exactly the donor log rule: only newly requested words get a rework row.
   for(const r of after.reworks)if(!m.words.includes('/'+r.words+'/'))reworkLog.push(r.words);
   b.raw=changed;
  }else if(op.kind==='blockKind'){
   const b=get(op.id),m=inlineMap(b.raw);if(!m.safe)conflict('Unknown source syntax is read-only.');
   if(hash(b.raw)!==op.seenBlockHash)conflict('Block changed since native kind change capture.');
   const f=m.frame;
   const prefix=op.blockKind==='paragraph'?'':op.blockKind==='blockquote'?(f.kind==='blockquote'?f.prefix:'> '):'#'.repeat(op.level!)+(f.kind==='heading'?f.prefix.slice(f.level!):' ');
   const changed=b.raw.slice(0,f.start)+prefix+b.raw.slice(f.bodyStart);
   const after=inlineMap(changed);
   if(!after.safe||after.blockKind!==op.blockKind||op.blockKind==='heading'&&after.level!==op.level||after.words!==m.words)conflict('Kind change is not represented losslessly by the native donor.');
   ledger.push({kind:'block-kind-lineage',id:b.id,from:m.blockKind,to:op.blockKind,oldPrefix:f.prefix,newPrefix:prefix});b.raw=changed;
  }else if(op.kind==='split'){
   const b=get(op.id),m=inlineMap(b.raw);fresh(op.newId);if(!m.safe||m.blockKind!=='paragraph')conflict('Only supported paragraphs can split; change heading/quote kind explicitly first.');const at=byteBoundary(m,op.at);
   const left=b.raw.slice(0,at),right=b.raw.slice(at);if(!left.trim()||!right.trim()||!inlineMap(left).safe||!inlineMap(right).safe)conflict('Split must leave two independently supported blocks and balanced protected formatting.');
   const oldSeparator=b.separator;b.raw=left;b.separator=newline+newline;
   next.blocks.splice(next.blocks.indexOf(b)+1,0,{id:op.newId,raw:right,separator:oldSeparator,origin:null});
  }else if(op.kind==='join'){
   const left=get(op.leftId),right=get(op.rightId);if(next.blocks.indexOf(right)!==next.blocks.indexOf(left)+1)conflict('Only adjacent block joins have explicit lineage.');
   if(!inlineMap(left.raw).safe||!inlineMap(right.raw).safe||inlineMap(left.raw).blockKind!=='paragraph'||inlineMap(right.raw).blockKind!=='paragraph')conflict('Only supported paragraphs can join; change heading/quote kind explicitly first.');
   left.raw+=' '+right.raw;left.separator=right.separator;next.blocks.splice(next.blocks.indexOf(right),1);
   ledger.push({kind:'join-lineage',retainedId:left.id,consumedId:right.id,removedSeparator:getOriginalSeparator(s,right.id,left.id)});
  }else if(op.kind==='delete'){
   const b=get(op.id),m=inlineMap(b.raw);if(!m.safe||m.notes||m.runs.some(r=>r.locked))conflict('Delete requires separate explicit protected-material decision.');next.blocks.splice(next.blocks.indexOf(b),1);
  }else if(op.kind==='insert'){
   fresh(op.id);if(!inlineMap(op.raw).safe||!op.raw.trim())conflict('New blocks must be supported ordinary Markdown prose.');
   const i=op.beforeId===null?next.blocks.length:next.blocks.indexOf(get(op.beforeId));
   if(i>0&&!next.blocks[i-1].separator)next.blocks[i-1].separator=newline+newline;
   next.blocks.splice(i,0,{id:op.id,raw:op.raw,separator:newline+newline,origin:null});
  }else{
   const b=get(op.id);if(op.beforeId===b.id)continue;next.blocks.splice(next.blocks.indexOf(b),1);
   const i=op.beforeId===null?next.blocks.length:next.blocks.indexOf(get(op.beforeId));
   if(i>0&&!next.blocks[i-1].separator)next.blocks[i-1].separator=newline+newline;
   if(i<next.blocks.length&&!b.separator)b.separator=newline+newline;next.blocks.splice(i,0,b);
  }
  ledger.push(op);
 }
 const raw=render(next);next.fileHash=hash(raw);
 return {raw,snapshot:next,ledger,expectedOriginalHash:s.fileHash,nextOriginalHash:next.fileHash,reworks:reworkLog,inverse:{schema:'mag-dev-inverse.v1' as const,before:structuredClone(s),afterHash:next.fileHash,afterSnapshotHash:hash(JSON.stringify(next))}};
}
function getOriginalSeparator(s:Snapshot,_right:string,left:string){return s.blocks.find(b=>b.id===left)?.separator??null;}

/** Restore an owned operation's exact inverse; not a second persistence authority.
 * The service must load this receipt itself, never trust one supplied by a client. */
export function undo(current:Snapshot,currentRaw:string,inverse:any){
 if(!inverse||inverse.schema!=='mag-dev-inverse.v1'||!inverse.before||inverse.before.sourceKey!==current.sourceKey||inverse.afterHash!==current.fileHash||hash(currentRaw)!==current.fileHash||render(current)!==currentRaw||hash(JSON.stringify(current))!==inverse.afterSnapshotHash)conflict('Undo receipt or current original changed; preserve external bytes.');
 const raw=render(inverse.before);if(hash(raw)!==inverse.before.fileHash)conflict('Inverse receipt before bytes are damaged.');
 return {raw,snapshot:structuredClone(inverse.before),expectedOriginalHash:current.fileHash,nextOriginalHash:inverse.before.fileHash};
}
function validateOperation(op:any){
 const shapes:any={photoDescription:['kind','id','seenBlockHash','description'],photoReplaceAsset:['kind','id','seenBlockHash','rootId','sourceId','revision','sourceHash','description'],photoReplace:['kind','id','seenBlockHash','replacementId','seenReplacementHash'],photoAspect:['kind','id','seenBlockHash','aspect'],photoFocus:['kind','id','seenBlockHash','x','y'],approveMark:['kind','id','rawFrom','rawTo','seenBlockHash','seenMarkupHash','humanDecision'],text:['kind','id','from','to','insert','seenBlockHash'],move:['kind','id','beforeId'],split:['kind','id','at','newId'],join:['kind','leftId','rightId'],insert:['kind','id','beforeId','raw'],delete:['kind','id'],blockKind:['kind','id','blockKind','level','seenBlockHash']};
 if(!op||typeof op!=='object'||Array.isArray(op)||!Object.hasOwn(shapes,op.kind))conflict('Unknown document operation kind.');
 const keys=shapes[op.kind];if(Object.keys(op).some(k=>!keys.includes(k))||keys.filter((k:string)=>k!=='level').some((k:string)=>!Object.hasOwn(op,k)))conflict('Malformed document operation fields.');
 for(const key of ['id','leftId','rightId','newId','replacementId'])if(key in op&&(typeof op[key]!=='string'||!op[key]||op[key].length>256||!op[key].isWellFormed()||/[\u0000-\u001f]/.test(op[key])))conflict('Malformed stable native ID.');
 if('beforeId' in op&&op.beforeId!==null&&(typeof op.beforeId!=='string'||!op.beforeId))conflict('Malformed target native ID.');
 for(const key of ['from','to','at'])if(key in op&&(!Number.isSafeInteger(op[key])||op[key]<0))conflict('Invalid native range.');
 for(const key of ['insert','raw'])if(key in op&&(typeof op[key]!=='string'||!op[key].isWellFormed()||op[key].includes('\0')))conflict('Well-formed Unicode text required.');
 if('seenBlockHash' in op&&(typeof op.seenBlockHash!=='string'||!/^[a-f0-9]{64}$/.test(op.seenBlockHash)))conflict('Malformed seen block hash.');
 if(op.kind==='photoReplaceAsset'){
  if(!['rootId','revision','sourceHash'].every(k=>typeof op[k]==='string'&&/^[a-f0-9]{64}$/.test(op[k]))||typeof op.sourceId!=='string'||!/^([a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(op.sourceId))conflict('Use the exact library photograph identity, revision and hash.');
  if(typeof op.description!=='string'||op.description.length>2000||!op.description.isWellFormed()||op.description!==op.description.trim()||/[\x00-\x1f\x7f%]/.test(op.description)||op.description.includes(' · '))conflict('Photo description must be one plain line without native separators.');
 }
 if(op.kind==='photoDescription'&&(typeof op.description!=='string'||op.description.length>2000||!op.description.isWellFormed()||op.description!==op.description.trim()||/[\x00-\x1f\x7f%]/.test(op.description)||op.description.includes(' · ')))conflict('Photo description must be one plain line without native separators.');
 if(op.kind==='photoReplace'&&(typeof op.seenReplacementHash!=='string'||!/^[a-f0-9]{64}$/.test(op.seenReplacementHash)))conflict('Malformed replacement block hash.');
 if(op.kind==='photoAspect'&&!supportedPhotoAspect(op.aspect))conflict('Unsupported photo shape; use 4/3, 4/5 or 1/1.');
 if(op.kind==='photoFocus'&&![op.x,op.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))conflict('Focal coordinates must be finite values from zero to one.');
 if(op.kind==='blockKind'&&(!['paragraph','heading','blockquote'].includes(op.blockKind)||op.blockKind==='heading'&&![1,2,3].includes(op.level)||op.blockKind!=='heading'&&op.level!==undefined))conflict('Unsupported native block kind or heading level.');
}

export function approvalSpans(raw:string){if(!editable(raw))return [];return exactApprovalSpans(raw).map(span=>({...span,preview:raw.slice(span.rawFrom+2,span.rawTo-2).replace(/%%rework%%[\s\S]*?%%\/rework%%|%%[\s\S]*?%%|<!--[\s\S]*?-->/g,"")}));}

/** Change coordinate tokens only, retaining original file, alt, layout and whitespace. */
export function photoFocusRaw(raw:string,x:number,y:number){
 if(![x,y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))conflict('Invalid focal coordinates.');
 const match=/^(\s*%%photo:[ \t]*)([^\r\n%]*)(%%\s*)$/.exec(raw),bits=match?.[2].split(' · ');
 if(!match||!bits||!bits[0].trim())conflict('An exact standalone photo directive is required.');
 const layout=bits.slice(2).join(' · '),tokens=[...layout.matchAll(/\S+/g)],seen=new Set<string>();
 if(tokens.some(t=>['cover','opener'].includes(t[0])))conflict('Unsupported focal-point layout.');
 let changed=layout;
 for(const token of [...tokens].reverse()){
  const m=/^([xy])=(.*)$/.exec(token[0]);if(!m)continue;
  if(seen.has(m[1])||!m[2]||!Number.isFinite(Number(m[2]))||Number(m[2])<0||Number(m[2])>1)conflict('Ambiguous or invalid existing focal coordinate.');
  seen.add(m[1]);const value=m[1]==='x'?x:y;
  if(Number(m[2])!==value)changed=changed.slice(0,token.index)+m[1]+'='+String(value)+changed.slice(token.index!+token[0].length);
 }
 const additions=[...(!seen.has('x')?['x='+String(x)]:[]),...(!seen.has('y')?['y='+String(y)]:[])];
 if(additions.length){const at=changed.trimEnd().length;changed=changed.slice(0,at)+(at?' ':'')+additions.join(' ')+changed.slice(at);}
 return match[1]+bits[0]+' · '+(bits[1]??'')+' · '+changed+match[3];
}

const supportedPhotoAspect=(aspect:unknown):aspect is string=>typeof aspect==='string'&&['4/3','4/5','1/1'].includes(aspect);
/** Change one aspect token only; all existing spelling and whitespace stays owned. */
export function photoAspectRaw(raw:string,aspect:string){
 if(!supportedPhotoAspect(aspect))conflict('Unsupported photo shape; use 4/3, 4/5 or 1/1.');
 const match=/^(\s*%%photo:[ \t]*)([^\r\n%]*)(%%\s*)$/.exec(raw),bits=match?.[2].split(' · ');
 if(!match||!bits||!bits[0].trim())conflict('An exact standalone photo directive is required.');
 const layout=bits.slice(2).join(' · '),tokens=[...layout.matchAll(/\S+/g)];
 if(tokens.some(t=>['cover','opener','bleed'].includes(t[0])))conflict('Unsupported photo-shape layout.');
 const aspects=tokens.filter(t=>t[0].startsWith('aspect=')||/^\d+\/\d+$/.test(t[0]));
 if(aspects.length>1)conflict('Ambiguous existing photo aspect.');
 let changed=layout;
 if(aspects.length){
  const token=aspects[0],keyed=token[0].startsWith('aspect='),value=keyed?token[0].slice(7):token[0],ratio=/^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
  if(!ratio||![Number(ratio[1]),Number(ratio[2])].every(Number.isSafeInteger))conflict('Invalid existing photo aspect.');
  const [a,b]=aspect.split('/').map(Number);
  if(Number(ratio[1])/Number(ratio[2])===a/b)conflict('Photo already has this shape.');
  changed=layout.slice(0,token.index)+(keyed?'aspect=':'')+aspect+layout.slice(token.index!+token[0].length);
 }else{
  if(aspect==='4/3')conflict('Photo already has this shape.');
  const at=layout.trimEnd().length;changed=layout.slice(0,at)+(at?' ':'')+'aspect='+aspect+layout.slice(at);
 }
 // With no existing layout, introduce only its required native separator.
 return match[1]+bits[0]+' · '+(bits[1]??'')+' · '+changed+match[3];
}

/** Derive asset and description only from another exact current native photo.
 * No path, filename or prose supplied by a caller can enter this operation. */
function photoReplaceRaw(raw:string,sourceRaw:string){
 const tokens=(value:string)=>{
  const match=/^(\s*%%photo:[ \t]*)([^\r\n%]*)(%%\s*)$/.exec(value),bits=match?.[2].split(' · ');
  if(!match||!bits||bits.length<2||bits.length>3)conflict('Replacement requires unambiguous photo file and description fields.');
  const file=bits[0].trim();
  if(!file||file.startsWith('.')||/[\/\\\x00-\x1f<>"']/.test(file)||!/\.(?:jpe?g|png|webp|gif|avif)$/i.test(file))conflict('Replacement requires a safe existing photo filename.');
  return {match,bits,file,alt:bits[1].trim()};
 };
 const target=tokens(raw),source=tokens(sourceRaw);
 if(target.file===source.file)conflict('Choose a different photograph.');
 const retainSpace=(old:string,value:string)=>{const parts=/^([ \t]*)(.*?)([ \t]*)$/.exec(old)!;return parts[1]+value+parts[3];};
 target.bits[0]=retainSpace(target.bits[0],source.file);
 target.bits[1]=retainSpace(target.bits[1],source.alt);
 return target.match[1]+target.bits.join(' · ')+target.match[3];
}

// Advertised by the maintained owner read; absent on older installed engines.
export const supportedNativeOperations=Object.freeze(['photoDescription','photoFocus','photoAspect','photoReplace','photoReplaceAsset']);
