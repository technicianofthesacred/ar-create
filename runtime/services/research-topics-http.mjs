// The doors to research topics and groups (runtime/services/research-topics.mjs), and the owners it reads through: the
// inquiries (Library Collections with learning), Library's sources, topics and relationships, the subject catalog, each
// subject's kept research answers and saved findings, the fact checks on the consent desk and the local Atlas. Nothing here keeps
// a copy of their records; every read goes to the owner. One registration line in the server hands requests here.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {digest} from './files.mjs';
import {StateError} from '../store.mjs';
import {requireWriteActor} from './actor.mjs';
import {createResearchTopics} from './research-topics.mjs';

// The saved findings the app holds are for these subjects only (runtime/services/study-derived-findings.mjs).
const FINDINGS_KEYS=Object.freeze({hk:'hk','ref-an-cha':'ancha','ref-collector':'collector'});
const PREFIX='/api/research-topics',MAX_BODY=256*1024;
const fail=(message,status=400)=>{throw new StateError(message,status);};

/** The owners the topic layer reads through, from the server's own services. Any may be missing in a smaller home.
    Nothing here lists every subject's authority: a link looks up the one subject it is for. */
export function researchOwners({dataDir,library,inquiries,drafts,bindings,membership,researchAnswers,findings,consent,atlas}={}){
 const m=inquiries?.methods;

 /** Which subjects each inquiry is used in, read from the same Library index the catalog came from (its hash must match),
     without checking each subject's authority again: the list only needs the pointers. */
 async function associations(expectedHash){
  const file=path.join(dataDir,'library-index.json');if(!fs.existsSync(file))return [];
  const bytes=fs.readFileSync(file);if(expectedHash&&digest(bytes)!==expectedHash)fail('Library changed while it was read. Read it again.',409);
  const value=JSON.parse(bytes.toString('utf8'));
  return (value.typedRelationships||[]).filter(r=>r?.recordKind==='organizational-association'&&r.from?.kind==='collection'&&r.to?.kind==='project'&&r.status!=='detached').map(r=>({id:r.id,collectionId:r.from.id,parentStudyId:r.to.parentStudyId,status:r.status}));
 }
 const catalogRows=async()=>{const c=await drafts.catalog();return [...(c.drafts||[]),...(c.collections||[]).filter(r=>r.kind==='collection-root')];};
 return {
  ...(m?{
   catalog:()=>m.catalog({}),
   inquiry:collectionId=>m.read({collectionId}),
   saveCollection:({id,name,sourceIds,expectedRevision})=>id?m.update({id,name,sourceIds,expectedRevision}):m.create({name,sourceIds,expectedRevision}),
   ...(drafts&&bindings&&membership&&library?{async link({collectionId,parentStudyId,accept}){
    // Library's Project association, as the existing workspace makes it: proposed, then accepted only by Adrian. Only
    // this one subject is looked up: its own saved binding (as the inquiry selector list makes it) and one authority read
    // for the proof a new association needs. Nothing lists every subject, and nothing re-reads every association.
    const row=(await catalogRows()).find(r=>r.parentStudyId===parentStudyId&&r.bindingStatus==='ready'&&r.bindingId&&r.kind!=='output-fork');
    if(!row)fail('This subject cannot be linked yet: it has no working root.',409);
    const parent=await bindings.lookup({projectKey:parentStudyId});
    const projectSelector={workspaceId:parent.projectId,parentStudyId,rootBindingId:row.bindingId},reason='Use this research topic for the subject.';
    let index=await m.catalog({});
    let rel=(await associations(index.indexHash)).find(a=>a.collectionId===collectionId&&a.parentStudyId===parentStudyId);
    if(!rel){
     const authority=await membership.readAuthority({kind:'project',id:projectSelector.workspaceId,parentStudyId,rootBindingId:projectSelector.rootBindingId});
     rel=(await m.associationPropose({collectionId,projectSelector,expectedRevision:index.revision,expectedHash:index.indexHash,expectedProjectProofHash:authority.proofHash,operationId:randomUUID(),reason})).relationship;
    }
    if(accept&&rel.status!=='accepted'){
     // The same change inquiries.association.change makes, for this exact association (checked above to be this topic's and this subject's).
     index=await m.catalog({});
     rel=(await library.changeTypedRelationship({id:rel.id,status:'accepted',expectedRevision:index.revision,expectedHash:index.indexHash,operationId:randomUUID(),actor:'human',reason})).relationship||{...rel,status:'accepted'};
    }
    return {status:rel.status};
   }}:{}),
  }:{}),
  ...(library?{
   associations,
   async relationships(collectionId){
    const all=await library.typedRelationships({entity:{kind:'collection',id:collectionId},direction:'incoming'});
    let cards=null;
    const out=[];for(const r of all.relationships){
     if(!['source','evidence'].includes(r.from?.kind))continue;
     let quote=null;if(r.anchor?.evidenceId){cards||=new Map(((await library.evidence())?.cards||[]).map(c=>[c.id,c]));const c=cards.get(r.anchor.evidenceId);if(c&&!c.stale&&!c.sourceMissing)quote=c.quote;}
     out.push({sourceId:r.anchor?.sourceId||r.from.id,relationshipType:r.relationshipType,status:r.status,quote});
    }
    return out;
   },
   async sources(ids){
    if(!ids.length)return [];
    const tree=await library.tree(),byId=new Map([...(tree.sources||[]).map(s=>[s.id,s]),...(tree.missingSources||[]).map(s=>[s.id,{...s,missing:true}])]);
    return ids.map(id=>{const s=byId.get(id);return s?{id,title:s.title||s.name||'Source',kind:s.kind||null,missing:!!s.missing||!!s.sourceUnavailable,url:s.source_url||s.url||null}:{id,title:'Source no longer in the Library',kind:null,missing:true};});
   },
   /** Every Library source that holds text, in Library's order, for "across everything". */
   async allSourceIds(){const tree=await library.tree();return (tree.sources||[]).filter(s=>!s.missing&&!s.sourceUnavailable&&s.hasReadableBody!==false).map(s=>s.id);},
   /** One source's text, from its saved identity (no Library rescan). null text when it is not text. */
   async readSource(id){const s=await library.snapshot(id,{includeBody:true});return {id:s.id,title:s.title||s.name||'Source',text:typeof s.text==='string'?s.text:null};},
   libraryTopics:async()=>(await library.readTopics()).sources,
  }:{}),
  ...(drafts?{subjects:async()=>(await drafts.catalog()).collections.filter(c=>c.bindingStatus==='ready'&&c.parentStudyId&&c.bindingId).map(c=>({parentStudyId:c.parentStudyId,title:c.title||c.parentStudyId,bindingId:c.bindingId}))}:{}),
  ...(consent?{async claim({parentStudyId,id}){const desk=await consent.read({parentStudyId});return (desk.claims||[]).find(c=>c.id===id)||null;}}:{}),
  ...(researchAnswers||findings?{
   async subjectResearch({parentStudyId,bindingId}){
    let answers=[],points=[];
    if(researchAnswers?.study?.recent){try{answers=((await researchAnswers.study.recent({bindingId,parentStudyId})).records||[]).map(r=>({id:r.id,question:String(r.question||'').split('Your question:\n').at(-1).trim()||'A question',status:r.status,keptAt:r.keptAt||null,createdAt:r.createdAt||null}));}catch(error){if(!Number.isInteger(error?.status))throw error;}}
    const key=FINDINGS_KEYS[parentStudyId];
    if(findings&&key){try{const v=await findings.read({projectKey:key,parentStudyId});if(v.available)points=(v.points||[]).map(p=>({id:p.id,title:p.title||'A finding',supported:p.clarity?.supported||'',uncertain:p.clarity?.uncertain||'',spoken:(p.spoken||[]).map(s=>({quote:s.quote,speaker:s.speaker,location:s.location}))}));}catch(error){if(!Number.isInteger(error?.status))throw error;}}
    return answers.length||points.length?{answers,findings:points}:null;
   },
  }:{}),
  ...(atlas?{async atlas({query,limit}){const c=await atlas.capabilities();if(!c?.available)return null;return atlas.search({query,limit});}}:{}),
 };
}

const instances=new Map();
export function sharedResearchTopics({dataDir,services}){
 if(!instances.has(dataDir)){
  const topics=createResearchTopics({dataDir,owners:researchOwners({dataDir,...services})});
  // A subject's own research changes through its research commands: forget what was known, so the list asks again.
  services.events?.subscribe?.(e=>{if(/^(study\.research|study-research|research\.answers)/.test(String(e?.kind||'')))topics.forgetResearch();});
  instances.set(dataDir,topics);
 }
 return instances.get(dataDir);
}

/** Returns false for any path that is not a research topic route. */
export async function handleResearchTopics(request,response,{dataDir,checkWrite,...services}){
 const url=new URL(request.url||'/','http://local.invalid');
 if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))return false;
 const topics=sharedResearchTopics({dataDir,services});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 try{
  const route=url.pathname.slice(PREFIX.length);
  const reads={'':i=>topics.list(i),'/read':i=>topics.read(i),'/subject':i=>topics.forSubject(i),'/groups':i=>topics.groups(i),'/group':i=>topics.readGroup(i)};
  const writes={'/save':i=>topics.save(i),'/take':i=>topics.take(i),'/let-go':i=>topics.letGo(i),'/undo':i=>topics.undo(i),'/keep':i=>topics.keep(i),'/propose':i=>topics.propose(i),'/start':i=>topics.start(i),'/link':i=>topics.link(i),'/group/save':i=>topics.saveGroup(i),'/group/sources':i=>topics.groupSources(i),'/ask':i=>topics.ask(i)};
  if(!Object.hasOwn(reads,route)&&!Object.hasOwn(writes,route))fail('Unknown research topic action.',404);
  if(request.method==='GET'){
   if(!Object.hasOwn(reads,route)){response.setHeader('Allow','POST');fail('Use POST.',405);}
   const query=Object.fromEntries(url.searchParams);if([...url.searchParams.keys()].length!==Object.keys(query).length)fail('Name each field once.');
   return send(200,await reads[route](query)),true;
  }
  if(request.method!=='POST'||!Object.hasOwn(writes,route)){response.setHeader('Allow',Object.hasOwn(writes,route)?'POST':'GET');fail('This action takes '+(Object.hasOwn(writes,route)?'POST':'GET')+'.',405);}
  if(route!=='/ask'){checkWrite?.();requireWriteActor();}
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)fail('That request is too large.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the request as JSON.');}
  const i=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  // The journal and change notices: a topic's changes are that topic's record, a group's are the group's.
  const group=route.startsWith('/group');
  request.arInput={operationId:i.operationId,...(Number.isSafeInteger(i.expectedRevision)?{expectedRevision:i.expectedRevision}:{}),...(typeof i.expectedHash==='string'?{expectedHash:i.expectedHash}:{}),
   scope:{kind:group?'research-group':'research-topic',id:typeof i.id==='string'?i.id:(route==='/propose'||route==='/start')&&typeof i.operationId==='string'?'p-'+i.operationId.toLowerCase():null}};
  const result=await writes[route](input);
  if(!request.arInput.scope.id&&result?.id)request.arInput.scope.id=result.id;
  send(200,result);
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'Research could not be read or saved. Nothing was changed.'});if(!error.status)console.error(error);}
 return true;
}
