import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify, isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
const guards = fileURLToPath(new URL('./guards/', import.meta.url));
const pins = {'mag-article-body.mjs':'b6a172f65eb4d9bb906d429eb5792f76e3f9fb6114bd9335c59edce9d7dbae7e','mag-check-quotes.mjs':'a8c018750fefa2b6b41f9e5069b221c532c4be8ecf524cd4dc3cd91272536487','mag-check-splits.mjs':'44879f21c3591a52b9d371107dda9cd67d886d6749805c344b3e7bbbf3044ef8'};
const hash = raw => createHash('sha256').update(raw).digest('hex');
const same = (a,b) => isDeepStrictEqual(a,b);
const fail = (message,status=409) => Object.assign(new Error(message),{status});
const scope = {narration:'not-verified',meaning:'not-verified',bracketIntent:'not-verified',independentEditor:'not-run',blindRead:'not-run',rating:'not-run',approval:'not-granted'};
function validateIds({bindingId,parentStudyId,operationId}) {
  if (typeof bindingId !== 'string' || !bindingId || typeof parentStudyId !== 'string' || !parentStudyId) throw fail('A bound draft and parent study are required.',400);
  if (operationId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) throw fail('operationId must be a UUID.',400);
}
async function evidence(drafts,args) {
  const draft = await drafts.read({bindingId:args.bindingId,parentStudyId:args.parentStudyId});
  if (draft.binding?.id !== args.bindingId || draft.binding?.parentStudyId !== args.parentStudyId || typeof draft.raw !== 'string') throw fail('Draft does not belong to this study.');
  const records = (draft.context?.records || []).filter(r => ['source','context'].includes(r.role) && !r.missing);
  const sources = [];
  for (const r of records) {
    if (!r.copiedPath || !r.copiedHash) throw fail('Captured source lacks owned-copy evidence.');
    const raw = await fs.readFile(r.copiedPath,'utf8');
    const actual = hash(raw);
    if (actual !== r.copiedHash || (r.raw !== undefined && r.raw !== raw)) throw fail('Captured source bytes changed; recapture before checking.');
    sources.push({id:r.id,role:r.role,copiedPath:r.copiedPath,hash:actual,raw});
  }
  return {draft,sources,proof:{bindingId:args.bindingId,parentStudyId:args.parentStudyId,draftHash:hash(draft.raw),expected:draft.expected,sources:sources.map(({id,role,hash})=>({id,role,hash}))}};
}
async function guard(name,args) {
  try { const r = await execute(process.execPath,[path.join(guards,name),...args],{timeout:30000,maxBuffer:1024*1024}); return {exitCode:0,output:r.stdout+r.stderr}; }
  catch(error) { if (typeof error.code !== 'number') throw error; return {exitCode:error.code,output:(error.stdout||'')+(error.stderr||'')}; }
}
function coverage(result,label) {
  const line = result.output.split('\n').find(l=>l.startsWith(label+' COVERAGE:'));
  const fields = Object.fromEntries([...(line||'').matchAll(/([\w-]+)=([^;.\s]+)/g)].map(m=>[m[1],/^\d+$/.test(m[2])?Number(m[2]):m[2]]));
  return {...fields,status:fields.status||'unsupported',exitCode:result.exitCode,output:result.output};
}
// Presentation-only mapping: keep raw offsets while removing the markup the
// quote guard removes. This never decides whether words/brackets are valid.
function quoteView(raw) {
  let chars = [...raw.split('')].map((value,index)=>({value,start:index,end:index+1}));
  function replace(pattern,replacement) {
    const text=chars.map(c=>c.value).join(''); const next=[]; let cursor=0;
    for(const match of text.matchAll(pattern)) {
      next.push(...chars.slice(cursor,match.index));
      next.push(...replacement(match,chars.slice(match.index,match.index+match[0].length)));
      cursor=match.index+match[0].length;
    }
    next.push(...chars.slice(cursor)); chars=next;
  }
  const space=(_,span)=>[{value:' ',start:span[0].start,end:span.at(-1).end}];
  replace(/%%[\s\S]*?%%/g,space);
  replace(/==[\s\S]*?==/g,(_,span)=>[{value:'…',start:span[0].start,end:span.at(-1).end}]);
  replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g,(match,span)=>span.slice(match[0].indexOf('|')+1,-2));
  replace(/\*\*/g,()=>[]);
  replace(/(^|\s)\*(?=["“])|(?<=["”])\*(?=\s|$)/g,(match,span)=>match[1]?span.slice(0,match[1].length):[]);
  replace(/^\s*>\s*/gm,space);
  replace(/\s+/g,space);
  return {text:chars.map(c=>c.value).join(''),chars};
}
function locator(raw,passage,projection,{quote=false,truncated=false}={}) {
  const unavailable={kind:'check-output',reason:'No unique passage locator in this checked revision; inspect check output.'};
  if(!passage) return unavailable;
  const view=quote?quoteView(raw):null;
  const text=view?.text??raw;
  const needle=quote?passage.replace(/\s+/g,' '):passage;
  const at=text.indexOf(needle);
  if(at<0 || text.indexOf(needle,at+1)>=0) return unavailable;
  const start=view?view.chars[at].start:at;
  const end=view?view.chars[at+needle.length-1].end:at+needle.length;
  const selected=raw.slice(start,end);
  const blocks=(projection||[]).filter(p=>typeof p.id==='string' && p.id && typeof p.blockHash==='string' && typeof p.raw==='string' && p.raw.includes(selected) && p.raw.indexOf(selected)===p.raw.lastIndexOf(selected));
  const native=blocks.length===1 && projection.filter(p=>p.id===blocks[0].id).length===1?blocks[0]:null;
  return {kind:native?'native-paragraph':'markdown-offset',...(native?{nativeId:native.id,blockHash:native.blockHash}:{}),line:raw.slice(0,start).split('\n').length,startOffset:start,endOffset:end,passage:selected,...(truncated?{truncated:true}: {})};
}
function issuesFor(result,type,draft) {
  // Split guards emit one multiline issue containing two raw block prefixes.
  // Bracket/unsupported messages have no passage: retain output-only locators.
  const messages=result.output.match(/^(?:NOT FOUND:|INVALID BRACKET:|UNSUPPORTED:)[^\n]*|^SPLIT \([^\n]*\n  A: [\s\S]*?\n  B: [\s\S]*?(?=\n\n|(?![\s\S]))/gm)||[];
  return messages.map((message,i)=>{
    const quoted=/^NOT FOUND: "(.*)"$/.exec(message)?.[1];
    const truncated=quoted?.length===141 && quoted.endsWith('…');
    const passage=truncated?quoted.slice(0,-1):quoted;
    const split=/\n  A: ([\s\S]*?)\n  B: ([\s\S]*)$/.exec(message);
    const relatedLocators=split?split.slice(1).map(p=>locator(draft.raw,p,draft.projection,{truncated:p.length===70})):undefined;
    return {id:`${type}-${i+1}`,type,severity:message.startsWith('UNSUPPORTED')?'held':'review',message,locator:relatedLocators?.[0]??locator(draft.raw,passage,draft.projection,{quote:true,truncated}),...(relatedLocators?{relatedLocators}: {})};
  });
}
export function createStudyDraftChecks({dataDir,drafts}) {
  if(!dataDir || typeof drafts?.read!=='function') throw new TypeError('Owned dataDir and draft reader required.');
  const directory=path.join(dataDir,'study-draft-checks'); const active=new Map();
  const key=args=>hash(`${args.parentStudyId}\0${args.bindingId}`);
  async function save(file,record) { await fs.mkdir(path.dirname(file),{recursive:true}); const temporary=file+'.tmp'; await fs.writeFile(temporary,JSON.stringify(record,null,2)); await fs.rename(temporary,file); }
  async function load(file) {try { return JSON.parse(await fs.readFile(file,'utf8')); }catch(e){if(e.code==='ENOENT') return null;throw e;}}
  async function perform(args) {
    const bucket=path.join(directory,key(args)); const file=path.join(bucket,args.operationId+'.json');
    const existing=await load(file); if(existing) return existing.status==='running'?{...existing,status:'interrupted',error:'This persisted check was interrupted; start a new operation to check again.'}:existing;
    const before=await evidence(drafts,args);
    if(!args.expected || !same(args.expected,before.draft.expected)) throw fail('Draft changed before checks. Reload its current revision.');
    for(const [name,pin] of Object.entries(pins)) if(hash(await fs.readFile(path.join(guards,name)))!==pin) throw fail('Quote safeguard module differs from reviewed revision.',500);
    const record={schema:'ar-create.study-draft-check.v1',checkId:args.operationId,operationId:args.operationId,bindingId:args.bindingId,parentStudyId:args.parentStudyId,createdAt:new Date().toISOString(),status:'running',proof:before.proof,scope,guardHashes:pins};
    await save(file,record);await save(path.join(bucket,'current.json'),record);
    try {
      const snap=path.join(bucket,args.operationId);await fs.mkdir(snap,{recursive:true});
      const dev=path.join(snap,'draft.md');await fs.writeFile(dev,before.draft.raw,{flag:'wx'});
      const sourceFiles=[];for(const [i,s] of before.sources.entries()){const p=path.join(snap,`source-${i}.md`);await fs.writeFile(p,s.raw,{flag:'wx'});sourceFiles.push({role:s.role,path:p});}
      const primary=sourceFiles.find(s=>s.role==='source');
      if(!primary){record.quote={status:'held',reason:'No captured SRC available.'};record.split={status:'held',reason:'No captured SRC available.'};record.issues=[];record.status='held';}
      else {
        const q=await guard('mag-check-quotes.mjs',[dev,primary.path,...sourceFiles.filter(s=>s!==primary).map(s=>s.path)]);
        const s=await guard('mag-check-splits.mjs',[dev,primary.path]);
        record.quote=coverage(q,'QUOTE');record.split=coverage(s,'SPLIT');record.bodyCoverage={status:q.output.includes('Unclosed leading frontmatter')?'held':'covered-by-conservative-body-extractor',narrationParagraphs:Number(/(\d+) paragraphs with no quotation marks/.exec(q.output)?.[1]||0),narration:'not-verified',language:record.quote.unsupported?'unsupported-spans-held':'ASCII-quoted-words-only'};record.issues=[...issuesFor(q,'quote',before.draft),...issuesFor(s,'split',before.draft)];
        record.status=record.quote.status==='failed' || record.split.status==='split-detected' || record.split.splits>0?'needs-review':record.quote.status==='unsupported'||record.split.status==='unsupported'?'held':'checked';
      }
      try { const after=await evidence(drafts,args);if(!same(before.proof,after.proof)){record.status='stale';record.staleReason='Draft or captured source changed during checks.';} }
      catch(error){record.status='stale';record.staleReason=error.message;}
    }catch(error){record.status='failed';record.error=error.message;}
    record.finishedAt=new Date().toISOString();await save(file,record);await save(path.join(bucket,'current.json'),record);return record;
  }
  return {
    async run(args) {validateIds(args);if(!args.operationId)throw fail('operationId required.',400);const id=key(args)+args.operationId;if(active.has(id))return active.get(id);const pending=perform(args);active.set(id,pending);try{return await pending;}finally{active.delete(id);}},
    async read(args) {validateIds(args);if(args.checkId)validateIds({...args,operationId:args.checkId});const record=await load(path.join(directory,key(args),(args.checkId||'current')+'.json'));if(!record)return null;try{const current=await evidence(drafts,args);if(!same(record.proof,current.proof))return {...record,status:'stale',staleReason:'This receipt covers an earlier draft or source revision.'};}catch(error){return {...record,status:'stale',staleReason:error.message};}return record;}
  };
}
