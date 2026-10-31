import {createHash} from 'node:crypto';
const SCHEMA='ar-create.media-usage.v1',UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const same=(a,b)=>stable(a)===stable(b),clone=v=>structuredClone(v);
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=1024&&!/[\u0000-\u001f\u007f]/.test(v);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status,outcome:'not-applied'});};
function fields(v,allowed){if(!plain(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('Use exact selector fields; caller paths and output snapshots are refused.',400);}
function expected(v){if(!plain(v)||!Number.isSafeInteger(v.revision)||v.revision<0||!HASH.test(v.hash||'')||Object.keys(v).some(k=>!['revision','hash'].includes(k)))fail('Exact output revision/hash required.',400);}
function assetId(url){
 if(!url)return null;
 const m=typeof url==='string'&&/^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(url);
 if(!m)fail('Saved placement has no exact Library asset URL.');
 let value;try{value=decodeURIComponent(m[1]);}catch{fail('Saved placement has an invalid asset ID.');}
 if(!id(value))fail('Saved placement requires a stable Library asset ID.');return value;
}

/** Read-only projection. All records and renderer behavior remain with maintained owners. */
export function createMediaUsage({outputs,library,articleSpec,carouselTemplates,listScopes=null}={}){
 if(!outputs?.read||!library?.snapshot||typeof articleSpec!=='function'||!plain(carouselTemplates))throw Error('Supply existing native output, read-only Library snapshot and maintained render adapters.');
 function validate(input){
  fields(input,['rootBindingId','parentStudyId','sourceIds','selectedOutputId','expectedOutput']);
  if(!UUID.test(input.rootBindingId||'')||!id(input.parentStudyId)||input.selectedOutputId!==undefined&&!UUID.test(input.selectedOutputId)||!Array.isArray(input.sourceIds)||input.sourceIds.length>200||input.sourceIds.some(x=>!id(x))||new Set(input.sourceIds).size!==input.sourceIds.length)fail('Exact root/parent, optional selected output and unique bounded source IDs required.',400);
  if(input.expectedOutput!==undefined)expected(input.expectedOutput);
 }
 function validateBase(v,g){
  if(!same(v?.scope,g)||v.documentId!==g.rootBindingId||!id(v.photoScope?.projectId)||!id(v.photoScope?.documentId)||!Array.isArray(v.outputs)||v.outputs.length>100||!Array.isArray(v.outputBindings)||new Set(v.outputs.map(o=>o.id)).size!==v.outputs.length||v.outputs.some(o=>!UUID.test(o.id)||!v.outputBindings.some(b=>b.outputId===o.id)))fail('Maintained output owner returned another or ambiguous root/project scope.');
  expected(v.expectedOutput);return v;
 }
 function edition(v){return {revision:v.output.outputRevision??0,hash:hash({output:v.output,wordOwner:v.wordOwner,writingProof:v.writingProof})};}
 function validateSelected(v,base,g,outputId){
  validateBase(v,g);
  if(!same(v.photoScope,base.photoScope)||!same(v.expectedOutput,base.expectedOutput)||v.output?.id!==outputId||!same(base.outputs.find(o=>o.id===outputId),v.output)||!v.wordOwner||!same(v.outputBindings.find(b=>b.outputId===outputId)?.wordOwner,v.wordOwner)||!v.writingProof||typeof v.freshness?.stale!=='boolean')fail('Output scope or revision changed during media usage read.');
 }
 async function source(sourceId){
  try{
   const s=await library.snapshot(sourceId);
   if(s?.id!==sourceId||s.rootId!=='library'||s.writable!==true||s.sourceUnavailable||s.missing||!HASH.test(s.hash||''))return {sourceId,status:'unavailable',reason:'The exact owned Library asset is unavailable.',hash:null};
   const type=/\.(jpe?g|png|webp)$/i.test(s.rel_path||'')?'photo':/\.(mp4|mov|webm|m4v)$/i.test(s.rel_path||'')?'video':'other';
   return {sourceId,status:type==='photo'?'available':'unsupported',type,hash:s.hash,reason:type==='photo'?null:'Saved occurrence support for this media format is not connected.'};
  }catch(error){if(![403,404,409].includes(error.status)&&error.code!=='ENOENT')throw error;return {sourceId,status:'unavailable',reason:'The exact Library asset could not be read.',hash:null};}
 }
 function occurrences(view,g,physical){
  const o=view.output,result=[],ed=edition(view),title=o.name||o.title||o.kind;
  function add(sourceId,location,caption,credit){
   if(!sourceId)return;
   if(o.kind==='article')location={...location,slotOccurrence:result.filter(row=>row.location.slot===location.slot).length};
   const occurrence={id:hash({scope:g,outputId:o.id,sourceId,...o.kind==='article'?{slot:location.slot,section:location.section,path:location.path}:{slideId:location.slideId,photoIndex:location.photoIndex}}),sourceId,scope:{...g,...physical},outputId:o.id,outputName:title,kind:o.kind,edition:ed,order:result.length+1,location,caption:caption??null,credit:credit??null,freshness:clone(view.freshness)};
   occurrence.navigation={entry:'studyOutputConnection.onAction',request:{projectId:g.parentStudyId,outputId:o.id,kind:'arrange'},rootBindingId:g.rootBindingId,location:clone(location),expectedOutput:clone(view.expectedOutput),edition:ed,occurrenceFocusConnected:false};
   occurrence.returnToMedia={entry:'viewPhase',stage:8,parentStudyId:g.parentStudyId,rootBindingId:g.rootBindingId,sourceId,assetFocusConnected:false};result.push(occurrence);
  }
  if(o.kind==='article'){
   // outputSpec includes captured layout, cover fallback and all post-capture anchored/ending extras.
   const spec=articleSpec(view.document,o),slots=new Map((o.placements||[]).map(p=>[p.slot,p]));
   const photo=(shot,section,path)=>{if(!shot)return;const p=slots.get(shot.slot);if(!p||p.url!==shot.file)fail('Rendered photo no longer matches its saved placement.');add(assetId(p.url),{kind:'article',section,path,slot:p.slot,paragraphId:p.paragraphId??null},p.caption,p.credit);};
   const walk=(blocks,section,prefix=[])=>{for(const [index,b]of blocks.entries()){const path=[...prefix,index];if(b.shot)photo(b.shot,section,path);if(b.shots)b.shots.forEach((shot,i)=>photo(shot,section,[...path,'photos',i]));if(b.blocks)walk(b.blocks,section,[...path,'blocks']);}};
   photo(spec.portrait,'cover',[]);walk(spec.opening,'opening');spec.parts.forEach((part,index)=>{photo(part.opener,'part-'+(index+1),['opener']);walk(part.blocks,'part-'+(index+1));});walk(spec.ending.blocks,'ending');photo(spec.ending.shot,'ending',['photo']);
  }else if(o.kind==='carousel'){
   for(const [index,slide]of (o.slides||[]).entries()){
    const template=carouselTemplates[slide.template];if(!template||!Number.isSafeInteger(template.photos)||template.photos<0)fail('Saved carousel template is unsupported by its maintained renderer.');
    for(const [photoIndex,p]of (slide.photos||[]).slice(0,template.photos).entries())add(assetId(p.src),{kind:'carousel',slideId:slide.id,slideNumber:index+1,photoIndex,photoNumber:photoIndex+1,template:slide.template,paragraphIds:clone(slide.paragraphIds||[])},o.caption??null,slide.credit??null);
   }
  }
  return result;
 }
 async function read(input){
  validate(input);const g={rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId},base=validateBase(await outputs.read(g),g);
  if(input.expectedOutput&&!same(input.expectedOutput,base.expectedOutput))fail('Outputs changed since this media usage revision.');
  if(input.selectedOutputId&&!base.outputs.some(o=>o.id===input.selectedOutputId))fail('Selected output does not belong to this exact native project.',404);
  const sourceViews=await Promise.all(input.sourceIds.map(source)),rows=[],all=[],proofs=[];
  for(const o of base.outputs){
   if(!['article','carousel'].includes(o.kind)){rows.push({outputId:o.id,kind:o.kind,status:'unsupported',reason:'This output has no supported saved media occurrence contract.'});continue;}
   let view;
   try{view=await outputs.read({...g,selectedOutputId:o.id});}catch(error){if(![403,404,409,503].includes(error.status))throw error;rows.push({outputId:o.id,kind:o.kind,status:'unavailable',reason:'Current saved output proof is unavailable.'});continue;}
   validateSelected(view,base,g,o.id);
   try{all.push(...occurrences(view,g,base.photoScope));rows.push({outputId:o.id,kind:o.kind,status:'supported',edition:edition(view),freshness:clone(view.freshness)});proofs.push(view);}catch(error){if(error.status!==409)throw error;rows.push({outputId:o.id,kind:o.kind,status:'unavailable',reason:error.message});}
  }
  for(const before of proofs){const now=await outputs.read({...g,selectedOutputId:before.output.id});validateSelected(now,base,g,before.output.id);if(!same(edition(now),edition(before))||!same(now.freshness,before.freshness))fail('Native output edition or source proof changed during media usage read.');}
  const final=validateBase(await outputs.read(g),g);if(!same(final.expectedOutput,base.expectedOutput)||!same(final.photoScope,base.photoScope))fail('Output revision changed during media usage read.');
  const afterSources=await Promise.all(input.sourceIds.map(source));if(!same(sourceViews,afterSources))fail('Library asset changed during media usage read.');
  const complete=rows.every(r=>r.status==='supported'),unavailable=rows.some(r=>r.status==='unavailable');
  const usageHash=hash({scope:g,physical:base.photoScope,expectedOutput:base.expectedOutput,outputs:rows});
  return {schema:SCHEMA,scope:{...g,...base.photoScope},expectedOutput:clone(base.expectedOutput),selectedOutputId:input.selectedOutputId??null,usageHash,coverage:{complete,status:unavailable?'unavailable':complete?'complete':'partial',outputs:rows},sources:sourceViews.map(s=>{const used=all.filter(o=>o.sourceId===s.sourceId);return {...s,usageState:used.length?'used':unavailable?'unknown':complete?'unused':'unused-in-supported-outputs',occurrences:used};}),videoUsage:{status:'unsupported',reason:'The maintained Article/Carousel owners have no saved video occurrence or trim contract.'}};
 }
 async function readGlobal(input){
  fields(input,['sourceIds']);if(!Array.isArray(input.sourceIds)||input.sourceIds.length>200||input.sourceIds.some(x=>!id(x))||new Set(input.sourceIds).size!==input.sourceIds.length)fail('Unique bounded source IDs required.',400);
  if(typeof listScopes!=='function')fail('Saved piece scope enumeration is unavailable.',503);
  const scopes=await listScopes();if(!Array.isArray(scopes)||scopes.length>500)fail('Saved piece scope enumeration is unavailable.',503);
  const normalized=scopes.map(s=>({parentStudyId:s.parentStudyId,rootBindingId:s.rootBindingId}));
  if(normalized.some(s=>!id(s.parentStudyId)||!UUID.test(s.rootBindingId||'')))fail('Saved piece scope identity is unavailable.');
  const unique=[...new Map(normalized.map(s=>[stable(s),s])).values()].sort((a,b)=>stable(a).localeCompare(stable(b))),views=[],roots=[];
  for(const scope of unique){try{const v=await read({...scope,sourceIds:input.sourceIds});views.push(v);roots.push({scope,status:v.coverage.status,usageHash:v.usageHash});}catch(error){if(![400,403,404,409,503].includes(error.status))throw error;roots.push({scope,status:'unavailable'});}}
  for(const view of views){const fresh=await read({parentStudyId:view.scope.parentStudyId,rootBindingId:view.scope.rootBindingId,sourceIds:input.sourceIds});if(fresh.usageHash!==view.usageHash||!same(fresh.sources,view.sources))fail('Saved placements changed during global usage read.');}
  const current=await listScopes(),now=[...new Map(current.map(s=>{const g={parentStudyId:s.parentStudyId,rootBindingId:s.rootBindingId};return [stable(g),g];})).values()].sort((a,b)=>stable(a).localeCompare(stable(b)));
  if(!same(unique,now))fail('Saved piece scope catalog changed during usage read.');
  return {schema:'ar-create.library-usage.v1',usageHash:hash(roots),coverage:{complete:false,status:roots.some(r=>r.status==='unavailable')?'unavailable':'partial',roots,claim:'Known saved native Article/Carousel photo placements across indexed pieces. Source citations, Magazine uses, unsupported formats and unrecorded dependencies remain unknown.'},sources:input.sourceIds.map(sourceId=>({sourceId,status:views.find(v=>v.sources.some(s=>s.sourceId===sourceId&&s.status==='available'))?'available':'unsupported-or-unavailable',occurrences:views.flatMap(v=>v.sources.find(s=>s.sourceId===sourceId)?.occurrences.map(o=>({...o,rootUsageHash:v.usageHash}))||[])}))};
 }
 async function resolve(input){
  fields(input,['rootBindingId','parentStudyId','sourceId','occurrenceId','expectedUsageHash']);if(!id(input.sourceId)||!HASH.test(input.occurrenceId||'')||!HASH.test(input.expectedUsageHash||''))fail('Exact current source, occurrence and usage hash required.',400);
  const view=await read({rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,sourceIds:[input.sourceId]});if(view.usageHash!==input.expectedUsageHash)fail('Media usage changed; refresh this occurrence before navigation.');
  const occurrence=view.sources[0].occurrences.find(o=>o.id===input.occurrenceId);if(!occurrence)fail('This saved occurrence is unavailable or no longer belongs to this output.',404);return occurrence;
 }
 return {read,readGlobal,resolve};
}
