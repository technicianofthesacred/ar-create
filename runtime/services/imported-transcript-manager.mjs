import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';

// Library owns bytes, versions, groups and evidence. This registry owns only
// transcript structure and human decisions. No recording job is fabricated.
export function createTranscriptManager({dataDir,library,requests,store,files,StateError}) {
 const {digest,atomicWrite,ensurePrivateDirectory}=files;
 const dir=ensurePrivateDirectory(dataDir,'transcript-manager'),file=path.join(dir,'registry.json');
 const initial={schema:'ar-create.transcript-manager.v1',revision:0,imports:[],sessions:[],selections:[],history:[],operations:[],pending:null};
 const lockFile=path.join(dir,'owner.lock'),directoryIdentity=fs.lstatSync(dir);
 let state, diskHash=null, lock=null, queue=Promise.resolve();
 const fail=(message,status=400)=>{throw new StateError(message,status);};
 // This lock coordinates upgraded owners only. It cannot establish that a legacy
 // owner, Library writer, or external editor has handed over authority. No PID,
 // clock age, or apparent process death authorizes stealing an abandoned lock.
 function assertDirectory(){const st=fs.lstatSync(dir);if(!st.isDirectory()||st.isSymbolicLink()||st.dev!==directoryIdentity.dev||st.ino!==directoryIdentity.ino)fail('Transcript owner directory identity changed. Nothing was replaced.',409);}
 function acquire(){
  assertDirectory();
  const token=JSON.stringify({schema:'ar-create.transcript-owner-lock.v1',token:randomUUID(),pid:process.pid,host:os.hostname(),at:new Date().toISOString()});
  let fd;
  try{fd=fs.openSync(lockFile,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);}
  catch(error){if(['EEXIST','ELOOP'].includes(error.code))fail('Another or abandoned transcript owner holds the lock. No operation was started. Verify owner handover before recovering it.',409);throw error;}
  try{fs.writeFileSync(fd,token);fs.fsyncSync(fd);lock={token,stat:fs.fstatSync(fd)};}
  finally{fs.closeSync(fd);}
  const parent=fs.openSync(dir,'r');try{fs.fsyncSync(parent);}finally{fs.closeSync(parent);}
 }
 function assertLock(){
  try{assertDirectory();const st=fs.lstatSync(lockFile);if(!lock||!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.dev!==lock.stat.dev||st.ino!==lock.stat.ino||fs.readFileSync(lockFile,'utf8')!==lock.token)throw Error('changed');}
  catch{fail('Transcript lock ownership changed. Files were preserved; verified owner handover is required.',409);}
 }
 function release(){assertLock();fs.unlinkSync(lockFile);lock=null;const parent=fs.openSync(dir,'r');try{fs.fsyncSync(parent);}finally{fs.closeSync(parent);}}
 function registryBytes(){
  let fd;
  try{fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);}
  catch(error){if(error.code==='ENOENT')return null;if(error.code==='ELOOP')fail('Registry symlinks are not available.',403);throw error;}
  try{const st=fs.fstatSync(fd),named=fs.lstatSync(file);if(!st.isFile()||st.nlink!==1||named.isSymbolicLink()||named.dev!==st.dev||named.ino!==st.ino)fail('The transcript registry must be one regular owned file.',403);return fs.readFileSync(fd,'utf8');}
  finally{fs.closeSync(fd);}
 }
 function assertDisk(){assertLock();const raw=registryBytes();if((raw===null?null:digest(raw))!==diskHash)fail('The transcript registry changed during this operation. Existing bytes and pending receipt were preserved.',409);}
 function load(){
  assertLock();const raw=registryBytes();
  state=raw===null?structuredClone(initial):JSON.parse(raw);diskHash=raw===null?null:digest(raw);
  if(state.schema!==initial.schema||!Number.isSafeInteger(state.revision)||state.revision<0||['imports','sessions','selections','history'].some(k=>!Array.isArray(state[k]))||(state.operations!==undefined&&!Array.isArray(state.operations)))fail('The transcript registry is invalid. Existing bytes were preserved.',409);
  state.operations??=[];
 }
 const serial=fn=>{const p=queue.then(async()=>{acquire();try{load();await recover();return await fn();}finally{release();}});queue=p.catch(()=>{});return p;};
 const persist=()=>{assertDisk();state.revision++;const raw=JSON.stringify(state,null,2)+'\n';atomicWrite(file,raw,diskHash===null?{exclusive:true}:{expectedHash:diskHash});diskHash=digest(raw);};
 const canonical=value=>JSON.stringify(normalize(value));
 function normalize(value){if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,normalize(value[k])]));return value;}
 function operation(input,action){
  if(typeof input.operationId!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(input.operationId))fail('Provide a stable operationId for this save or Undo.');
  const requestHash=digest(canonical({action,input})),prior=state.operations.find(p=>p.id===input.operationId);
  if(prior){if(prior.requestHash!==requestHash||prior.action!==action)fail('This operation ID belongs to a different request. No change was made.',409);if(prior.status!=='committed')fail('This operation is unresolved. Recover it before another save.',409);return {prior};}
  return {record:{id:input.operationId,action,requestHash,status:'prepared',at:new Date().toISOString()}};
 }
 const sourceGuard=(input,current)=>{if(typeof input.expectedSourceHash!=='string'||input.expectedSourceHash!==current.hash)fail('The source changed or its exact expectedSourceHash is missing. Reload before saving.',409);};
 const word=(value,label,max=4000)=>{if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))fail(`Provide ${label} under ${max} characters.`);return value;};
 const key=(...parts)=>digest(JSON.stringify(parts));
 const session=id=>state.sessions.find(s=>s.id===id)||fail('Session was not found.',404);
 const guard=input=>{if(input.expectedRevision!==state.revision)fail('The collection changed. Reload before saving.',409);};
 const dialogue=s=>s.turns.map(t=>`${t.speaker}: ${t.text}`).join('\n\n')+'\n';
 const originalDialogue=s=>s.turns.map(t=>`${t.speaker}: ${t.originalText??t.text}`).join('\n\n')+'\n';
 async function source(s){const content=await library.read(s.sourceId);assertLock();if(typeof content.raw!=='string'||digest(content.raw)!==content.hash||content.text!==dialogue(s))fail('This transcript was edited outside the manager. Its bytes are preserved; reconcile it before continuing.',409);return content;}
 async function retain(name,content,folder){
  const hash=digest(content),tree=await library.tree();assertDisk();
  const existing=tree.sources.find(s=>s.rel_path===`${folder}/${name}`&&s.provenance?.originalHash===hash);
  if(existing)return existing;
  const result=await library.import({rootId:'library',folder,files:[{name,content}]});
  if(!result.receipts[0]?.ok)fail(result.receipts[0]?.error||'Import failed.');return result.receipts[0].source;
 }
 async function recover(){
  if(!state.pending)return;
  const p=state.pending;
  if(p.schema!=='ar-create.transcript-change.v2')fail('An earlier owner left an interrupted edit. Preserve it and reconcile during verified owner handover before activating this owner.',409);
  if(!p.before||!p.next||!p.history||typeof p.beforeRaw!=='string'||typeof p.afterRaw!=='string'||p.preparedRevision!==state.revision)fail('Interrupted receipt identity/revision is invalid. Existing bytes were preserved.',409);
  const op=p.operationId?state.operations.find(o=>o.id===p.operationId):null;
  if(p.operationId&&(!op||op.status!=='prepared'||op.sessionId!==p.before.id||op.beforeHash!==p.beforeHash||op.afterHash!==p.afterHash||op.beforeRevision!==state.revision-1||p.history.operationId!==op.id||!['edit','undo'].includes(op.action)))fail('Interrupted operation identity is invalid. Receipt preserved.',409);
  if(canonical(p.history.before)!==canonical(p.before)||canonical(p.history.after)!==canonical(p.next)||p.history.beforeRaw!==p.beforeRaw||p.history.afterRaw!==p.afterRaw||p.history.beforeHash!==p.beforeHash||p.history.afterHash!==p.afterHash)fail('Interrupted history identity is invalid. Receipt preserved.',409);
  if(p.history.undoOf&&!state.history.some(h=>h.operationId===p.history.undoOf&&!h.undoneBy))fail('Undo target changed. Receipt preserved.',409);
  const index=state.sessions.findIndex(s=>s.id===p.before.id);
  if(index<0||canonical(state.sessions[index])!==canonical(p.before)||digest(p.beforeRaw)!==p.beforeHash||digest(p.afterRaw)!==p.afterHash||p.next.id!==p.before.id||p.next.sourceId!==p.sourceId)fail('Interrupted edit receipt conflicts with the registry. Both versions are retained.',409);
  const current=await library.read(p.sourceId);assertLock();
  if(typeof current.raw!=='string'||digest(current.raw)!==current.hash)fail('The physical source hash is inconsistent; interrupted edit was preserved.',409);
  if(current.hash===p.beforeHash&&current.raw===p.beforeRaw){
   assertDisk();await library.write({id:p.sourceId,expectedHash:p.beforeHash,content:p.afterRaw,raw:true});assertLock();
  }else if(current.hash!==p.afterHash||current.raw!==p.afterRaw)fail('An interrupted edit conflicts with the physical file. Both versions are preserved.',409);
  const published=await library.read(p.sourceId);assertLock();
  if(published.hash!==p.afterHash||published.raw!==p.afterRaw)fail('The published source changed before receipt completion. Both versions are preserved.',409);
  state.sessions[index]=p.next;
  state.history.push(p.history);
  if(p.history.undoOf){const target=state.history.find(h=>h.operationId===p.history.undoOf);if(!target)fail('Undo target disappeared; receipt preserved.',409);target.undoneBy=p.operationId;}
  if(p.operationId){const op=state.operations.find(o=>o.id===p.operationId);if(!op||op.status!=='prepared')fail('Interrupted operation identity is invalid. Receipt preserved.',409);op.status='committed';op.completedAt=new Date().toISOString();op.result={operationId:op.id,status:'committed',revision:state.revision+1,sessionId:p.next.id,sourceHash:p.afterHash,...(p.history.undoOf?{undoOf:p.history.undoOf}:{undoOperationId:op.id})};}
  state.pending=null;persist();
 }
 async function change(s,next,reason,{current=null,record=null,afterRaw=null,undoOf=null}={}){
  current??=await source(s);assertLock();
  const raw=afterRaw??dialogue(next),at=new Date().toISOString();
  const history={at,sessionId:s.id,reason,before:structuredClone(s),after:structuredClone(next),beforeRaw:current.raw,afterRaw:raw,beforeHash:current.hash,afterHash:digest(raw),...(record?{operationId:record.id}:{}),...(undoOf?{undoOf}:{})};
  state.pending={schema:'ar-create.transcript-change.v2',preparedRevision:state.revision+1,sourceId:s.sourceId,before:structuredClone(s),beforeRaw:current.raw,beforeHash:current.hash,afterRaw:raw,afterHash:digest(raw),next,history,operationId:record?.id??null};
  if(record)state.operations.push({...record,beforeRevision:state.revision,sessionId:s.id,beforeHash:current.hash,afterHash:digest(raw)});
  persist();await recover();
  return record?structuredClone(state.operations.find(o=>o.id===record.id).result):{revision:state.revision};
 }
 function parse(input){
  const raw=word(input.content,'UTF-8 transcript',1500000),label=word(input.label,'source label',200);
  if(input.format==='text'){
   const turns=[];for(const line of raw.split(/\r?\n/)){
    const m=line.match(/^([^:\n]{1,100}):\s*(.*)$/);
    if(m&&m[2].trim())turns.push({id:`turn-${turns.length+1}`,speaker:m[1].trim(),text:m[2],originalText:m[2],language:null});
    else if(line.trim()){if(turns.length)turns.at(-1).text+='\n'+line;else turns.push({id:'turn-1',speaker:'Unassigned',text:line,originalText:line,language:null});}
   }
   for(const t of turns)t.originalText=t.text;
   return {raw,label,sourceId:input.sourceKey?word(input.sourceKey,'stable source key',300):`text:${digest(raw)}`,completeness:'unverified',warnings:['Text import has no verified provider completeness receipt. Speaker labels are supplied, not verified identities.'],sessions:[{id:'session-1',title:label,date:null,location:null,turns}]};
  }
  if(input.format!=='structured')fail('Choose text or structured JSON.');
  let d;try{d=JSON.parse(raw);}catch{fail('The structured export is not valid JSON.');}
  if(d.schema!=='ar-create.transcript-import.v1'||!Array.isArray(d.sessions)||!d.sessions.length||d.sessions.length>100)fail('Use ar-create.transcript-import.v1 with 1–100 explicit sessions.');
  word(d.sourceId,'export source ID',300);
  const seen=new Set(),sessions=d.sessions.map(s=>{
   word(s.id,'session ID',300);if(seen.has(s.id))fail('Duplicate session ID.');seen.add(s.id);
   if(!Array.isArray(s.turns)||!s.turns.length||s.turns.length>10000)fail('Each session needs ordered turns.');
   const ids=new Set(),turns=s.turns.map(t=>{
    word(t.id,'turn ID',300);if(ids.has(t.id))fail('Duplicate turn ID within a session.');ids.add(t.id);
    for(const k of ['speaker','text'])word(t[k],k,k==='text'?12000:100);
    for(const k of ['originalText','language','timestamp','mediaReference'])if(t[k]!=null)word(t[k],k,k==='originalText'?12000:2000);
    return {...structuredClone(t),id:t.id,speaker:t.speaker,text:t.text,originalText:t.originalText??t.text,language:t.language??null,timestamp:t.timestamp??null,mediaReference:t.mediaReference??null};
   });
   for(const k of ['date','location'])if(s[k]!=null)word(s[k],k,300);
   return {...structuredClone(s),id:s.id,title:word(s.title||label,'session title',200),date:s.date??null,location:s.location??null,turns};
  });
  return {raw,label,sourceId:d.sourceId,sessions,completeness:d.completeness?.status==='incomplete'?'incomplete':'unverified',warnings:['Explicit supplied session boundaries; no inferred people, dates or locations.','Provider completeness is not independently verified by this adapter. Media references do not include media bytes.']};
 }
 const api={
  list:()=>serial(async()=>{
   const tree=await library.tree(),cards=await library.evidence();
   return {...structuredClone(state),pending:undefined,sessions:state.sessions.map(s=>({...structuredClone(s),turns:s.editorial==='deleted'?[]:structuredClone(s.turns),sourceHash:tree.sources.find(x=>x.id===s.sourceId)?.hash,originalUrl:`/api/sources/blob?id=${encodeURIComponent(s.originalSourceId)}&original=1`,staleSelections:state.selections.filter(x=>x.sessionId===s.id&&cards.cards.find(c=>c.id===x.evidenceId)?.stale).map(x=>x.id)})),groups:tree.collections};
  }),
  import:input=>serial(async()=>{
   guard(input);const d=parse(input),identity=key(d.sourceId),rawHash=digest(d.raw),existing=state.imports.find(i=>i.identity===identity&&i.hash===rawHash);
   if(existing)return {reused:true,receipt:existing,revision:state.revision};
   // Validate the entire batch before publishing any source. Stable turn IDs
   // may append, but changed/reordered original turns need explicit reconciliation.
   for(const supplied of d.sessions){
    const prior=state.sessions.find(s=>s.id===key(identity,supplied.id));if(!prior)continue;
    if(prior.turns.length>supplied.turns.length)fail('Repeat import is missing earlier turns; nothing was revived or replaced.',409);
    for(let i=0;i<prior.turns.length;i++)if(JSON.stringify(prior.turns[i].imported)!==JSON.stringify(supplied.turns[i]))fail('An existing source turn changed or moved. Reconcile the export explicitly.',409);
    await source(prior);
   }
   const original=await retain(`original-${rawHash}.${input.format==='text'?'txt':'json'}`,d.raw,`Transcripts/Originals/${identity}`),ids=[];
   for(const supplied of d.sessions){
    const id=key(identity,supplied.id),prior=state.sessions.find(s=>s.id===id);ids.push(id);
    if(prior){
     const added=supplied.turns.slice(prior.turns.length).map(t=>({...t,imported:structuredClone(t)}));
     // Permanent review exclusion is a durable tombstone. New turns in that
     // session remain only in the new original; they do not rebuild its dialogue.
     if(added.length&&prior.editorial!=='deleted')await change(prior,{...structuredClone(prior),turns:[...prior.turns,...added],originalSourceId:original.id,version:prior.version+1},'incremental-import');
     continue;
    }
    const next={...structuredClone(supplied),id,externalId:supplied.id,importIdentity:identity,title:supplied.title,date:supplied.date,location:supplied.location,turns:supplied.turns.map(t=>({...t,imported:structuredClone(t)})),originalSourceId:original.id,version:1,editorial:'unreviewed',reason:'',product:{status:'unknown',notes:'',turnIds:[]}};
    const derived=await retain(`session-${id}.txt`,dialogue(next),`Transcripts/Working/${identity}`);next.sourceId=derived.id;state.sessions.push(next);persist();
   }
   const receipt={identity,externalSourceId:d.sourceId,label:d.label,hash:rawHash,originalSourceId:original.id,sessionIds:ids,completeness:d.completeness,warnings:d.warnings,at:new Date().toISOString()};state.imports.push(receipt);persist();
   return {reused:false,receipt,revision:state.revision};
  }),
  edit:input=>serial(async()=>{
   const op=operation(input,'edit');if(op.prior)return structuredClone(op.prior.result);
   guard(input);const s=session(input.sessionId);if(s.editorial==='deleted')fail('This review session was permanently excluded.',409);
   const current=await source(s);sourceGuard(input,current);
   const next=structuredClone(s),t=next.turns.find(t=>t.id===input.turnId);if(!t)fail('Turn was not found.');
   t.text=word(input.text,'dialogue text',12000);t.speaker=word(input.speaker,'speaker label',100);next.version++;
   return change(s,next,'human-correction',{current,record:op.record});
  }),
  undo:input=>serial(async()=>{
   const op=operation(input,'undo');if(op.prior)return structuredClone(op.prior.result);
   guard(input);const s=session(input.sessionId),target=state.history.find(h=>h.operationId===input.undoOperationId&&h.sessionId===s.id&&h.reason==='human-correction');
   if(!target||target.undoneBy||typeof target.beforeRaw!=='string'||digest(target.beforeRaw)!==target.beforeHash||canonical(s)!==canonical(target.after))fail('This exact correction cannot be undone from the current session. Reload or reconcile newer changes.',409);
   const current=await source(s);sourceGuard(input,current);
   if(current.hash!==target.afterHash||current.raw!==target.afterRaw)fail('The source changed after that correction. Undo was refused.',409);
   return change(s,structuredClone(target.before),'human-undo',{current,record:op.record,afterRaw:target.beforeRaw,undoOf:target.operationId});
  }),
  decide:input=>serial(async()=>{
   guard(input);const s=session(input.sessionId);if(s.editorial==='deleted')fail('Permanent exclusion has no ordinary Restore.',409);
   if(!['unreviewed','keep','passage','combine','product-reference','hidden','deleted'].includes(input.editorial))fail('Choose a supported review decision.');
   const reason=word(input.reason,'decision reason',4000);
   const product=input.product;if(!product||!['unknown','purchased','ordered','sampled','considered'].includes(product.status)||typeof product.notes!=='string'||product.notes.length>8000||!Array.isArray(product.turnIds)||product.turnIds.some(id=>!s.turns.some(t=>t.id===id)))fail('Product references need a status and existing source turns.');
   if((product.notes.trim()||product.status!=='unknown')&&!product.turnIds.length)fail('Link product information to at least one source turn.');
   const current=await source(s);const next={...structuredClone(s),editorial:input.editorial,reason,product:{...structuredClone(product),sourceId:s.sourceId,sourceHash:current.hash,version:s.version}};
   // Delete removes dialogue from review presentation; immutable originals,
   // Library/history and selected evidence are deliberately retained.
   state.history.push({at:new Date().toISOString(),sessionId:s.id,reason:'human-decision',before:structuredClone(s),after:structuredClone(next)});Object.assign(s,next);persist();return {revision:state.revision};
  }),
  group:input=>serial(async()=>{
   guard(input);const sessions=input.sessionIds?.map(session);if(!sessions?.length||sessions.some(s=>s.editorial==='deleted'))fail('Choose available sessions to group.');
   word(input.reason,'grouping evidence',4000);const tree=await library.tree();
   assertDisk();const saved=await library.saveCollection({id:input.id,name:word(input.name,'group title',200),sourceIds:[...new Set(sessions.map(s=>s.sourceId))],expectedRevision:tree.revision});
   state.history.push({at:new Date().toISOString(),reason:'human-grouping',evidence:input.reason,collectionId:saved.collection.id,sessionIds:input.sessionIds});persist();return saved;
  }),
  select:input=>serial(async()=>{
   guard(input);const s=session(input.sessionId);if(s.editorial==='deleted')fail('Permanently excluded sessions cannot enter new selections.',409);
   if(!['research','product'].includes(input.purpose))fail('Choose Research or Product reference.');
   if(s.editorial==='hidden'&&input.purpose!=='product')fail('Restore this hidden session before selecting it for Research.',409);
   if(!Array.isArray(input.turnIds)||!input.turnIds.length||new Set(input.turnIds).size!==input.turnIds.length)fail('Choose one contiguous passage.');
   const indexes=input.turnIds.map(id=>s.turns.findIndex(t=>t.id===id));if(indexes.some((v,i)=>v<0||i>0&&v!==indexes[i-1]+1))fail('Choose source turns in contiguous source order.');
   const content=await source(s),quote=s.turns.slice(indexes[0],indexes.at(-1)+1).map(t=>`${t.speaker}: ${t.text}`).join('\n\n');
   const start=s.turns.slice(0,indexes[0]).reduce((n,t)=>n+`${t.speaker}: ${t.text}`.length+2,0);
   assertDisk();const {card}=await library.saveEvidence({sourceId:s.sourceId,quote,kind:input.purpose==='product'?'reference':'quote',locator:{start,sessionId:s.id,turnIds:input.turnIds,version:s.version,originalSourceId:s.originalSourceId}});
   const request=await requests.preview({scope:'research',paragraphIds:[],sourceIds:[s.sourceId],cardIds:[card.id]});
   const selection={id:key(card.id),projectId:store.get().project.id,sessionId:s.id,sourceId:s.sourceId,sourceHash:content.hash,version:s.version,turnIds:input.turnIds,originalSourceId:s.originalSourceId,evidenceId:card.id,requestId:request.id||request.manifest.id,purpose:input.purpose,quote,at:new Date().toISOString()};state.selections.push(selection);persist();
   return {selection,request,revision:state.revision};
  }),
  original:input=>serial(async()=>{const s=session(input.sessionId);return {dialogue:originalDialogue(s),version:s.version};})
 };
 return {api,routes:url=>({
  '/api/transcript-manager':{GET:api.list},
  ...Object.fromEntries(['import','edit','undo','decide','group','select'].map(action=>[`/api/transcript-manager/${action}`,{POST:api[action]}]))
 })};
}
