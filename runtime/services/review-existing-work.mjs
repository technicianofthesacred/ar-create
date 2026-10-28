// Read projections over maintained owners. No store, writer, import or new manuscript.
import {createHash} from 'node:crypto';
import {realpath} from 'node:fs/promises';
import {resolveMagazineWorkingTargets} from './review-magazine-working-links.mjs';
import {createMagazinePortfolio} from './magazine-portfolio.mjs';
import {reviewPieceBindingQueries,resolveReviewPieceLinks} from './review-piece-links.mjs';
import {DEFAULT_ARCHIVED} from './magazine-vault/projects.mjs';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const sourceKinds=new Set(['RAW','SRC','CONTEXT','NOTES','RESEARCH','BRIEF','REFERENCE','GUIDE']);
const outputKinds=new Set(['CAROUSEL','POST','REEL','VIDEO']);
const artifact=a=>({...a,authority:'magazine-original',readOnly:true});
// Explicit ASK read relationships only. Question wording, context and answers never enter this projection.
function questionReferences(story,original,excludedNames){
 const links=[],unresolved=[],seen=new Set(),all=[];
 for(const s of original.stories)for(const a of s.artifacts)all.push({artifact:a,storyId:s.id,excluded:excludedNames.has(norm(s.name))});
 for(const a of [...(original.guidance||[]),...(original.unassigned||[])])all.push({artifact:a,storyId:null,excluded:false});
 for(const question of story.questions||[])for(const read of question.reads||[]){
  const from=question.artifact,source=story.artifacts.find(a=>a.kind==='ASK'&&a.artifactId===from?.artifactId&&a.hash===from?.hash),target=read.artifact;
  const base={kind:'question-reading',fromStoryId:story.id,fromArtifactId:from?.artifactId||null,fromHash:from?.hash||null};
  const pending={...base,toArtifactId:target?.artifactId||null,toHash:target?.hash||null,targetPath:typeof read.file==='string'?read.file:null};
  if(!source){unresolved.push({...pending,reason:'source-question-record-unavailable'});continue;}
  if(!target?.artifactId||!target.hash){unresolved.push({...pending,reason:'explicit-reading-target-unresolved'});continue;}
  const matches=all.filter(a=>a.artifact.artifactId===target.artifactId),current=matches.filter(a=>a.artifact.hash===target.hash);
  if(!current.length){unresolved.push({...pending,reason:matches.length?'reading-target-hash-changed':'reading-target-unavailable'});continue;}
  const available=current.filter(a=>!a.excluded);if(!available.length){unresolved.push({...pending,reason:'reading-target-excluded'});continue;}
  const actual=available[0].artifact,toStoryIds=[...new Set(available.map(a=>a.storyId).filter(Boolean))].sort(),key=JSON.stringify([source.artifactId,source.hash,actual.artifactId,actual.hash]);
  if(seen.has(key))continue;seen.add(key);
  links.push({...base,fromArchived:!!source.archived,toArtifactId:actual.artifactId,toHash:actual.hash,toStoryId:toStoryIds.length===1?toStoryIds[0]:null,toStoryIds,crossStory:toStoryIds.some(id=>id!==story.id),toArchived:!!actual.archived,label:actual.title||actual.fileName||'Saved record'});
 }
 return {referenceLinks:links,unresolvedReferenceLinks:unresolved};
}
// A timed-out optional reader contributes no proof. Late completion is ignored;
// the next catalog call starts new reads, never a cached substitute.
export async function boundedReviewRead(read,{timeoutMs=10000,label='Review owner'}={}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Use a positive review read timeout.');
 const controller=new AbortController();let timer;
 try{return await Promise.race([
  Promise.resolve().then(()=>read(controller.signal)),
  new Promise((_,reject)=>{timer=setTimeout(()=>{const error=Object.assign(Error(label+' read timed out.'),{status:503});reject(error);controller.abort(error);},timeoutMs);}),
 ]);}finally{clearTimeout(timer);}
}
export function createExistingWorkReader({roots=[],portfolio=createMagazinePortfolio({roots}),readAuthority,readTimeoutMs=10000,projectLinks={},seedProjects=[],excludedStoryNames=DEFAULT_ARCHIVED,excludedSourceIds=[],excludedPieceIds=[],excludedProjectIds=[]}={}){
 if(typeof readAuthority!=='function')throw Error('An explicit read-only authority reader is required.');
 const exclusions=new Map(excludedStoryNames.map(n=>[norm(n),'Recorded test recording; excluded from real work, original retained.']));
 if(!Number.isFinite(readTimeoutMs)||readTimeoutMs<=0)throw Error('Use a positive review read timeout.');
 const sourceExclusions=new Set(excludedSourceIds),pieceExclusions=new Set(excludedPieceIds);
 let latest=null,catalogPending=null;
 function catalog(){if(catalogPending)return catalogPending;const pending=buildCatalog();catalogPending=pending;pending.finally(()=>{if(catalogPending===pending)catalogPending=null;}).catch(()=>{});return pending;}
 async function buildCatalog(){
  // Optional metadata owners and dependent identity joins share one deadline.
  // A stalled first reader cannot grant a second wave another full timeout.
  const deadline=performance.now()+readTimeoutMs;
  const readCatalogAuthority=path=>{
   const remaining=deadline-performance.now();
   if(remaining<1)return Promise.reject(Object.assign(Error(path+' read timed out.'),{status:503}));
   return boundedReviewRead(signal=>readAuthority(path,{signal}),{timeoutMs:remaining,label:path});
  };
  // Start only fresh reads here. allSettled owns every optional rejection even
  // when the fatal portfolio read fails before the remaining owners finish.
  const start=read=>Promise.resolve().then(read);
  const originalPending=start(()=>portfolio.list());
  const optionalReaders=[['/api/sources/tree','Library'],['/api/source-sessions','Conversations'],['/api/pieces','Workspace pieces'],['/api/study-draft/catalog','Native workspace identities']];
  const readersPending=Promise.allSettled([
   ...optionalReaders.map(([path])=>start(()=>readCatalogAuthority(path))),
   start(()=>readCatalogAuthority('/api/magazine/working-draft/catalog')),
   start(()=>Promise.all(roots.map(async root=>({...root,canonical:await realpath(root.path)})))),
  ]);
  const [original,results]=await Promise.all([originalPending,readersPending]);
  const diagnostics=[...(original.diagnostics||[])],excluded=[];
  const [tree,sessions,pieces,nativeCatalog]=results.slice(0,optionalReaders.length).map((result,index)=>{
   if(result.status==='fulfilled')return result.value;
   diagnostics.push(optionalReaders[index][1]+' unavailable: '+result.reason.message);return null;
  });
  let magazineWorkingLinks={schema:'ar-create.review-magazine-working-links.v1',state:'unavailable',reason:'owner-catalog-unavailable',targets:[]};
  try{
   const [ownerResult,rootsResult]=results.slice(optionalReaders.length);
   if(ownerResult.status==='rejected')throw ownerResult.reason;
   if(rootsResult.status==='rejected')throw rootsResult.reason;
   magazineWorkingLinks=resolveMagazineWorkingTargets({owner:ownerResult.value,roots:rootsResult.value,stories:original.stories.filter(story=>!exclusions.has(norm(story.name))),projectLinks});
  }catch(error){diagnostics.push('Magazine working identities unavailable: '+error.message);}
  const workingTargets=new Map(magazineWorkingLinks.targets.map(target=>[target.artifactId,target]));
  const projectArtifact=a=>({...artifact(a),...(workingTargets.has(a.artifactId)?{magazineWorkingTarget:workingTargets.get(a.artifactId)}:{})});
  const seeds=seedProjects.filter(s=>s&&typeof s.id==='string');
  const stories=[];
  for(const s of original.stories){
   if(exclusions.has(norm(s.name))){excluded.push({id:s.id,name:s.name,reason:exclusions.get(norm(s.name)),artifactIds:s.artifacts.map(a=>a.artifactId)});continue;}
   const explicit=projectLinks[s.id]||{},seed=seeds.find(p=>p.id===explicit.nativeProjectId);
   const artifacts=s.artifacts.map(projectArtifact),social=artifacts.filter(a=>outputKinds.has(a.kind)),references=questionReferences(s,original,exclusions);
   const retainedOutputs=seed?.slideCount?[{id:'retained:'+seed.id+':carousel',kind:'carousel',authority:'retained-bootstrap',slideCount:seed.slideCount,captionHash:seed.captionHash||null,readOnly:true}]:[];
   const publication=s.published||null;const match=String(publication||'').match(/https?:\/\/[^\s)]+/);let publishedUrl=null;
   if(match){try{const url=new URL(match[0]);if(url.protocol==='https:')publishedUrl=url.href;}catch{}}
   stories.push({id:s.id,name:s.name,nativeProjectId:explicit.nativeProjectId||seed?.id||null,originalProjectKey:explicit.originalProjectKey||null,stage:s.stage,step:s.step,who:s.who,flags:s.flags,published:publication,publishedUrl,latestDraft:s.latestDraft?projectArtifact(s.latestDraft):null,parts:s.parts.map(projectArtifact),artifacts,outputs:social,retainedOutputs,...references,attentionCount:s.attentionCount,openCount:s.openCount,answeredCount:s.answeredCount,readOnly:true});
  }
  const sources=[];
  for(const s of stories)for(const a of s.artifacts)if(sourceKinds.has(a.kind))sources.push({id:a.artifactId,title:a.title||a.fileName,kind:a.kind,authority:'magazine-original',storyId:s.id,artifactId:a.artifactId,hash:a.hash,relativePath:a.relativePath,archived:a.archived,readOnly:true});
  for(const s of tree?.sources||[]){if(sourceExclusions.has(s.id)){excluded.push({id:s.id,name:s.name||s.title,reason:'Explicitly inventoried test resource; original retained.'});continue;}sources.push({...s,title:s.title||s.name||s.rel_path,authority:'library',readOnly:true});}
  const allPieces=Array.isArray(pieces)?pieces:pieces?.pieces||[];
  const workspacePieces=allPieces.filter(p=>{if(!pieceExclusions.has(p.id))return true;excluded.push({id:p.id,name:p.title,reason:'Explicitly inventoried demonstration workspace; original retained.'});return false;});
  let workspaceLinks=null;if(nativeCatalog){try{const queries=reviewPieceBindingQueries(nativeCatalog);if(queries.length>128)throw Error('Native binding catalog exceeds the bounded review lookup.');const bindings=await Promise.all(queries.map(async q=>{try{return{...await readCatalogAuthority(q.path),requestedProjectKey:q.projectKey,httpStatus:200};}catch{return{requestedProjectKey:q.projectKey,httpStatus:503};}}));workspaceLinks=resolveReviewPieceLinks({pieces:workspacePieces,catalog:nativeCatalog,bindings});}catch(error){diagnostics.push('Workspace identity joins unavailable: '+error.message);}}
  const conversations=(sessions?.sessions||[]).map(s=>({id:s.id,title:s.title||s.name||'Retained conversation',sourceId:s.sourceId||null,sourceHash:s.sourceHash||null,version:s.version??null,date:s.date||null,turnCount:s.turns?.length??s.turnCount??null,authority:'source-sessions'}));
  const sourceGroups=[{id:'magazine-original',label:'Magazine source and research files',count:sources.filter(s=>s.authority==='magazine-original').length},{id:'library',label:'Retained Library resources',count:sources.filter(s=>s.authority==='library').length}];
  latest={mode:'existing-work-read-only',excludedProjectIds:[...excludedProjectIds],stories,sources,sourceGroups,conversations,workspacePieces,workspaceLinks,magazineWorkingLinks,guidance:original.guidance.map(artifact),unassigned:original.unassigned.map(artifact),exclusions:excluded,diagnostics,limits:['Read-only local review; no private writer is started.','Authority counts overlap; separately authored versions remain separate.','Browser-only edits at other origins are not imported or overwritten.']};
  latest.revision=sha(latest);return latest;
 }
 async function readArtifact({artifactId,expectedHash}){if(!latest)await catalog();return portfolio.read({artifactId,expectedHash});}
 return{catalog,readArtifact,portfolio};
}
