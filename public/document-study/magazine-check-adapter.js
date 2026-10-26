/* Explicit registered Magazine targets only. Saved results come only from the server receipt owner. */
(()=>{
 'use strict';
 const HASH=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 const stable=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const ownerKey=o=>stable([o?.kind,o?.storyId,o?.pieceId,o?.path,o?.partKey]);
 const snapshotKey=s=>stable([s?.parentStudyId,ownerKey(s?.owner),s?.proof?.draftHash,s?.proof?.expected,s?.proof?.sequence,s?.proof?.dirty,s?.origin]);
 const hash=value=>typeof value==='string'&&HASH.test(value);
 const path=(value,kind)=>typeof value==='string'&&!/[\\\x00-\x1f]/.test(value)&&!value.split('/').some(p=>p==='.'||p==='..')&&new RegExp('^Workflow/'+(kind==='DEV'?'3-Develop':'1-Source')+'/'+kind+' - [^/]+\\.md$').test(value);
 function validateSnapshot(s,{origin,actor,clean=false}){
  const o=s?.owner,p=s?.proof;if(actor!=='human:adrian'||s?.origin!==origin||!/^https?:\/\//.test(origin||''))throw Error('This check must be opened by the author in the current workspace.');
  if(o?.kind!=='magazine'||['storyId','pieceId','partKey'].some(k=>typeof o[k]!=='string'||!o[k])||!path(o.path,'DEV')||!p||ownerKey(p.owner)!==ownerKey(o)||p.parentStudyId!==s.parentStudyId||!hash(p.draftHash)||p.expected?.workflow?.draft!==p.draftHash)throw Error('The exact current Magazine part could not be confirmed.');
  if(clean&&p.dirty)throw Error('Save or resolve your current words before checking.');return s;
 }
 function registration(s,r,options){
  validateSnapshot(s,options);const o=s.owner,p=s.proof,t=r?.target,a=r?.artifact,story=r?.story,root=r?.rootIdentity;
  if(root?.scheme!=='canonical-directory-sha256-v1'||!hash(root.fingerprint)||!hash(r?.catalogRevision)||t?.kind!=='magazine'||t.edition!=='working'||t.storyId!==o.storyId||t.pieceId!==o.pieceId||t.partKey!==o.partKey||t.nativeProjectId!==s.parentStudyId||typeof t.artifactId!=='string'||!t.artifactId||t.artifactId!==a?.artifactId||t.hash!==a?.hash||t.hash!==p.draftHash||a.kind!=='DEV'||a.relativePath!==o.path||story?.storyId!==o.storyId||story.archived)throw Error('The registered check target does not match this exact working part.');
  const pieces=(story.pieces||[]).filter(x=>x.pieceId===o.pieceId);if(pieces.length!==1||!['article','article-part'].includes(pieces[0].kind)||pieces[0].rel!==o.path||(pieces[0].part||'article')!==o.partKey)throw Error('The registered working part is ambiguous or changed.');
  const records=(role,kind)=>{const seen=new Set();return [].concat(story.vaultRecords?.[role]||[]).map(row=>{if(!path(row.rel,kind)||seen.has(row.rel)||row.currentHash!==null&&!hash(row.currentHash))throw Error('Registered check references are unavailable or ambiguous.');seen.add(row.rel);return {role,path:row.rel,hash:row.currentHash,kind};});};
  const drafts=records('draft','DEV').filter(x=>x.path===o.path);if(drafts.length!==1||drafts[0].hash!==p.draftHash)throw Error('The registered draft changed. Refresh its current saved revision.');
  const link=r.pieceInputs,limitations=[];
  let source=null,context=[];
  // Story membership, a filename match, and even one SRC are not a piece/source link.
  if(!link)limitations.push('This part has no verified transcript connection. No mechanical check can run.');
  else{
   if(link.storyId!==o.storyId||link.pieceId!==o.pieceId||link.draftPath!==o.path||!hash(link.revision)||!Array.isArray(link.contextPaths)||new Set(link.contextPaths).size!==link.contextPaths.length)throw Error('The explicit piece input relationship could not be confirmed.');
   const src=records('src','SRC'),contexts=records('context','CONTEXT');
   const matches=src.filter(ref=>ref.path===link.sourcePath);if(matches.length!==1)throw Error('The explicit transcript is not registered to this story.');source=matches[0];
   context=link.contextPaths.map(value=>{const rows=contexts.filter(ref=>ref.path===value);if(rows.length!==1)throw Error('An explicit context note is not registered to this story.');return rows[0];});
   if(!source.hash)limitations.push('The explicitly linked transcript is unavailable. No mechanical check ran.');
   if(context.some(ref=>!ref.hash))limitations.push('An unavailable linked context note was not checked.');
  }
  const proof={rootFingerprint:root.fingerprint,catalogRevision:r.catalogRevision,artifactId:a.artifactId,owner:{...o},parentStudyId:s.parentStudyId,draftHash:p.draftHash,expected:structuredClone(p.expected),pieceInputRevision:link?.revision??null,references:[drafts[0],...source?[source]:[],...context]};
  return {proof,source,context:context.filter(x=>x.hash),limitations,signature:stable(proof),title:o.title||story.name||'Current Magazine part'};
 }
 function locate(needle,paragraphs){const matches=(paragraphs||[]).filter(p=>typeof p.id==='string'&&typeof p.text==='string'&&p.text.includes(needle));if(matches.length===1&&needle&&matches[0].text.indexOf(needle)===matches[0].text.lastIndexOf(needle))return {kind:'native-paragraph',nativeId:matches[0].id,passage:needle};return {kind:'unanchored',reason:'No unique exact passage is available. Compare these words in Read.'};}
 function normalize(value,target,snapshot){
  if(value?.draft?.path!==snapshot.owner.path||value.draft.hash!==snapshot.proof.draftHash||value?.source?.path!==target.source?.path||value.source.hash!==target.source?.hash||stable(value.context)!==stable(target.context.map(x=>({path:x.path,hash:x.hash}))))throw Error('The check returned a different saved draft or source revision.');
  const q=value.quotes,z=value.splits;if(!q||!Number.isSafeInteger(q.passages)||!Number.isSafeInteger(q.found)||q.found<0||q.found>q.passages||!Array.isArray(q.notFound)||q.notFound.some(x=>typeof x!=='string')||q.notFound.length!==q.passages-q.found||!Array.isArray(z?.splits)||z.splits.some(pair=>typeof pair?.a!=='string'||!pair.a||typeof pair.b!=='string'||!pair.b)||typeof z.ok!=='boolean'||z.ok!==(z.splits.length===0)||q.ok!==(q.notFound.length===0))throw Error('The mechanical check result could not be confirmed.');
  const issues=[...q.notFound.map(text=>({message:'NOT FOUND: "'+text+'"',words:text,sourcePassage:text,locator:locate(text,snapshot.paragraphs)})),...z.splits.map(pair=>({message:'SPLIT (one source paragraph)',words:[pair.a,pair.b].filter(Boolean).join('\n\n'),sourcePassage:pair.a||'',locator:locate(pair.a||'',snapshot.paragraphs)}))];
  return {kind:'magazine',status:issues.length?'needs-review':target.limitations.length||!q.passages?'held':'checked',persisted:false,finishedAt:new Date().toISOString(),proof:target.proof,targetSignature:target.signature,quotes:q,splits:z,issues,limitations:[...target.limitations,...!q.passages?['No supported quoted passages were checked.']:[]]};
 }
 // Catalog/artifact identities are refreshed for navigation, but unrelated portfolio
 // changes must not invalidate an exact persisted draft/source relationship.
 const semantic=target=>({rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:target.proof.rootFingerprint},parentStudyId:target.proof.parentStudyId,storyId:target.proof.owner.storyId,pieceId:target.proof.owner.pieceId,partKey:target.proof.owner.partKey,draft:{path:target.proof.owner.path,hash:target.proof.draftHash},source:target.source?{path:target.source.path,hash:target.source.hash}:null,context:target.proof.references.filter(ref=>ref.role==='context').map(ref=>({path:ref.path,hash:ref.hash})),inputRevision:target.proof.pieceInputRevision});
 function savedRecord(record,target,snapshot){
  const proof=record?.proof,expected=semantic(target),statuses=['checked','needs-review','held','stale','failed','interrupted','running'];
  if(record?.schema!=='ar-create.magazine-mechanical-check.v1'||record.persisted!==true||!UUID.test(record.checkId||'')||!UUID.test(record.operationId||'')||!statuses.includes(record.status)||typeof record.createdAt!=='string'||!Number.isFinite(Date.parse(record.createdAt))||record.finishedAt!=null&&!Number.isFinite(Date.parse(record.finishedAt))||!hash(proof?.checkerRevision))throw Error('The saved mechanical check receipt could not be confirmed.');
  if(record.scope?.mechanicalOnly!==true||!hash(proof.draft?.hash)||proof.source!==null&&(!path(proof.source?.path,'SRC')||proof.source.hash!==null&&!hash(proof.source.hash))||!Array.isArray(proof.context)||proof.context.some(ref=>!path(ref?.path,'CONTEXT')||ref.hash!==null&&!hash(ref.hash))||new Set(proof.context.map(ref=>ref.path)).size!==proof.context.length||proof.inputRevision!==null&&!hash(proof.inputRevision))throw Error('The saved mechanical check proof could not be confirmed.');
  if(proof.rootIdentity?.scheme!==expected.rootIdentity.scheme||proof.rootIdentity?.fingerprint!==expected.rootIdentity.fingerprint||['parentStudyId','storyId','pieceId','partKey'].some(key=>proof[key]!==expected[key])||proof.draft?.path!==expected.draft.path)throw Error('The saved check belongs to a different workspace or working part.');
  const observed=Object.fromEntries(Object.keys(expected).map(key=>[key,proof[key]])),matches=stable(observed)===stable(expected);
  const base={kind:'magazine',persisted:true,checkId:record.checkId,operationId:record.operationId,createdAt:record.createdAt,finishedAt:record.finishedAt||record.createdAt,proof:target.proof,targetSignature:target.signature,issues:[],limitations:[...target.limitations]};
  if(!matches||record.status==='stale')return {...base,status:'stale',notRun:true,proof:{...base.proof,draftHash:proof.draft.hash,expected:null,pieceInputRevision:proof.inputRevision,references:[{role:'draft',kind:'DEV',...proof.draft},...proof.source?[{role:'src',kind:'SRC',...proof.source}]:[],...proof.context.map(ref=>({role:'context',kind:'CONTEXT',...ref}))]},staleReason:record.staleReason||'This saved check covers an earlier draft or registered source revision.'};
  if(!['checked','needs-review','held'].includes(record.status))return {...base,status:record.status,notRun:true,error:typeof record.error==='string'?record.error:'',limitations:[...base.limitations,'This saved check did not finish. Check the saved draft again.']};
  if(record.status==='held'&&record.notRun===true&&record.result===null)return {...base,status:'held',notRun:true,limitations:[...base.limitations,...typeof record.reason==='string'?[record.reason]:[]]};
  const value=normalize(record.result,target,snapshot);
  if(value.status!==record.status)throw Error('The saved mechanical check outcome could not be confirmed.');
  return {...value,...base,issues:value.issues,limitations:value.limitations,status:value.status};
 }
 function create({origin,actor,resolve,read,run,readSaved,runSaved}={}){
  const options={origin,actor};
  const current=(snapshot,isCurrent)=>{validateSnapshot(snapshot,{...options,clean:true});if(typeof isCurrent!=='function'||!isCurrent(snapshot))throw Error('The selected working part changed. No result was applied.');};
  async function inspect(snapshot,{isCurrent=()=>true}={}){validateSnapshot(snapshot,options);if(!isCurrent(snapshot))throw Error('The selected working part changed.');if(typeof resolve!=='function')throw Error('Registered Magazine check references are not connected.');const result=registration(snapshot,await resolve(snapshot),options);if(!isCurrent(snapshot))throw Error('The selected working part changed.');return result;}
  async function verify(ref){if(typeof read!=='function')throw Error('The registered file reader is not connected.');const result=await read(ref.path);if(result?.path!==ref.path||result.exists!==true||result.kind!==ref.kind||result.hash!==ref.hash)throw Error('A saved check input changed. Refresh the current draft and source before checking.');}
  const selectors=snapshot=>({parentStudyId:snapshot.parentStudyId,storyId:snapshot.owner.storyId,pieceId:snapshot.owner.pieceId});
  async function savedResponse(snapshot,isCurrent){
   current(snapshot,isCurrent);if(typeof readSaved!=='function')return {available:false,record:null};
   let value;try{value=await readSaved(selectors(snapshot));}catch(error){current(snapshot,isCurrent);if([404,503].includes(error.status))return {available:false,record:null};throw error;}
   current(snapshot,isCurrent);
   if(value?.schema!=='ar-create.magazine-mechanical-check-response.v1'||typeof value.available!=='boolean'||!Object.hasOwn(value,'record')||value.record!==null&&(typeof value.record!=='object'||Array.isArray(value.record)))throw Error('Saved mechanical check support could not be confirmed.');return value;
  }
  async function readReceipt(snapshot,{isCurrent,target}={}){
   current(snapshot,isCurrent);if(!target)await inspect(snapshot,{isCurrent});current(snapshot,isCurrent);
   const response=await savedResponse(snapshot,isCurrent);current(snapshot,isCurrent);if(!response.record)return null;
   const after=await inspect(snapshot,{isCurrent});current(snapshot,isCurrent);
   return savedRecord(response.record,after,snapshot);
  }
  async function execute(snapshot,{isCurrent}={}){
   current(snapshot,isCurrent);const target=await inspect(snapshot,{isCurrent});current(snapshot,isCurrent);
   if(!target.source?.hash)return {kind:'magazine',status:'held',persisted:false,finishedAt:new Date().toISOString(),proof:target.proof,targetSignature:target.signature,issues:[],limitations:target.limitations,notRun:true};
   if(typeof readSaved==='function'&&typeof runSaved==='function'){
    const support=await savedResponse(snapshot,isCurrent);current(snapshot,isCurrent);
    if(support.available){
     if(typeof window.crypto?.randomUUID!=='function')throw Error('A fresh operation identity is unavailable. The check was not run.');
     const operationId=window.crypto.randomUUID(),response=await runSaved({...selectors(snapshot),expectedDraftHash:snapshot.proof.draftHash,expectedInputRevision:target.proof.pieceInputRevision,operationId});current(snapshot,isCurrent);
     if(response?.schema!=='ar-create.magazine-mechanical-check-response.v1'||response.available!==true||response.record?.operationId!==operationId)throw Error('The mechanical check could not be confirmed as saved.');
     const after=await inspect(snapshot,{isCurrent});current(snapshot,isCurrent);return savedRecord(response.record,after,snapshot);
    }
   }
   const refs=target.proof.references.filter(x=>x.hash);for(const ref of refs){await verify(ref);current(snapshot,isCurrent);}
   if(typeof run!=='function')throw Error('The Magazine mechanical checker is not connected.');
   const guard={origin,actor,owner:{...snapshot.owner},parentStudyId:snapshot.parentStudyId,expected:structuredClone(snapshot.proof.expected),draftHash:snapshot.proof.draftHash,rootFingerprint:target.proof.rootFingerprint,catalogRevision:target.proof.catalogRevision,artifactId:target.proof.artifactId,pieceInputRevision:target.proof.pieceInputRevision,references:refs};
   const value=await run({draft:snapshot.owner.path,source:target.source.path,context:target.context.map(x=>x.path)},guard);current(snapshot,isCurrent);
   const result=normalize(value,target,snapshot);for(const ref of refs){try{await verify(ref);}catch{result.status='stale';result.staleReason='Draft or registered source changed during checking.';return result;}current(snapshot,isCurrent);}
   const after=await inspect(snapshot,{isCurrent});if(after.signature!==target.signature){result.status='stale';result.staleReason='The registered draft or source relationship changed during checking.';}return result;
  }
  return Object.freeze({inspect,readReceipt,execute,snapshotKey});
 }
 window.createMagazineCheckAdapter=create;window.magazineCheckTarget=Object.freeze({registration,snapshotKey,locate});
})();
