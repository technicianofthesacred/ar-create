/* A bounded device-local outbox. The server remains the authority for saved briefs and original source bytes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ArVideoHandoffRecovery=api;})(typeof window==='undefined'?null:window,function(){
 const PREFIX='ar-create.video-handoff.v1:',UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,HASH=/^[a-f0-9]{64}$/,SCOPES={hk:'hk','ref-an-cha':'ancha','ref-collector':'collector'},FIELDS=['projectKey','parentStudyId','title','findingId','sourcePath','sourceHash','from','to','quote'];
 const fail=message=>{throw Error(message);},copy=value=>JSON.parse(JSON.stringify(value)),bytes=value=>new TextEncoder().encode(value).length;
 function exact(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||FIELDS.some(k=>!Object.hasOwn(input,k))||Object.keys(input).some(k=>![...FIELDS,'collectionId'].includes(k))||!Object.hasOwn(SCOPES,input.parentStudyId)||SCOPES[input.parentStudyId]!==input.projectKey)fail('The saved handoff scope is unavailable.');
  for(const key of ['title','findingId'])if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>256||/[\u0000-\u001f\u007f]/.test(input[key]))fail('The saved handoff identity is unreadable.');
  if(typeof input.sourcePath!=='string'||!input.sourcePath||input.sourcePath.length>2048||input.sourcePath.startsWith('/')||input.sourcePath.includes('\\')||input.sourcePath.split('/').some(p=>p==='..')||/[\u0000-\u001f\u007f]/.test(input.sourcePath)||!HASH.test(input.sourceHash||'')||!Number.isSafeInteger(input.from)||!Number.isSafeInteger(input.to)||input.from<0||input.to<=input.from||typeof input.quote!=='string'||!input.quote.trim()||input.quote.length>8192||/[\u0000\p{Surrogate}]/u.test(input.quote)||input.to-input.from!==input.quote.length)fail('The saved handoff passage is unreadable.');
  if(Object.hasOwn(input,'collectionId')&&!UUID.test(input.collectionId||''))fail('The saved handoff inquiry is unavailable.');
  return Object.fromEntries([...FIELDS,...Object.hasOwn(input,'collectionId')?['collectionId']:[]].map(k=>[k,k==='title'?input[k].trim():input[k]]));
 }
 const equal=(a,b)=>JSON.stringify(exact(a))===JSON.stringify(exact(b));
 function createStore(storage){
  const local=()=>typeof storage==='function'?storage():storage;
  const prefix=parent=>{if(!Object.hasOwn(SCOPES,parent))fail('Choose one exact Video Editing subject.');return PREFIX+SCOPES[parent]+':';};
  const key=(parent,id)=>{if(!UUID.test(id||''))fail('Choose the exact unfinished handoff.');return prefix(parent)+id;};
  function read(parent,id){const raw=local().getItem(key(parent,id));if(raw===null)return null;
   try{if(raw.length>49152)fail('Saved handoff recovery exceeds its limit.');const value=JSON.parse(raw);if(value.version!==1||value.operationId!==id||value.input?.parentStudyId!==parent||!['prepared','uncertain','failed'].includes(value.state)||typeof value.message!=='string'||value.message.length>1000||typeof value.inquiryName!=='string'||value.inquiryName.length>200||value.returnTarget!==null&&typeof value.returnTarget!=='string'||typeof value.updatedAt!=='string')fail('Saved handoff recovery is unreadable.');value.input=exact(value.input);return value;}catch(error){fail('Saved handoff recovery could not be read. Keep this tab open. '+error.message);}
  }
  function list(parent){const start=prefix(parent),ids=[],s=local();for(let i=0;i<s.length;i++){const name=s.key(i);if(name?.startsWith(start)){const id=name.slice(start.length);if(!UUID.test(id))fail('Saved handoff recovery contains an unreadable identity.');ids.push(id);}}
   if(ids.length>32)fail('Saved handoff recovery exceeds its limit.');return ids.map(id=>read(parent,id)).filter(Boolean).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  function prepare(input,{operationId,inquiryName='',returnTarget=null}={}){const normalized=exact(input),records=list(normalized.parentStudyId),same=records.find(r=>equal(r.input,normalized));if(same)return copy(same);
   const existing=read(normalized.parentStudyId,operationId);if(existing)fail('A different handoff already uses this operation.');
   const value={version:1,operationId,input:normalized,state:'prepared',message:'',inquiryName:String(inquiryName).slice(0,200),returnTarget:typeof returnTarget==='string'?returnTarget:null,updatedAt:new Date().toISOString()},raw=JSON.stringify(value);
   if(records.length>=8||records.reduce((n,r)=>n+bytes(JSON.stringify(r)),0)+bytes(raw)>262144||bytes(raw)>49152)fail('Finish an earlier video handoff before starting another.');
   local().setItem(key(normalized.parentStudyId,operationId),raw);return copy(value);
  }
  function update(parent,id,state,message=''){const value=read(parent,id);if(!value)return null;if(!['prepared','uncertain','failed'].includes(state))fail('Choose a retained handoff state.');value.state=state;value.message=String(message).slice(0,1000);value.updatedAt=new Date().toISOString();local().setItem(key(parent,id),JSON.stringify(value));return copy(value);}
  function remove(parent,id,input){const value=read(parent,id);if(value&&!equal(value.input,input))fail('The retained handoff changed.');if(value)local().removeItem(key(parent,id));}
  return {prepare,list,update,remove};
 }
 function matchesBrief(brief,pending){if(!brief||brief.id!==pending.operationId)return false;try{const input=exact(pending.input);for(const key of FIELDS.filter(k=>!['projectKey','parentStudyId'].includes(k))){const actual=key==='findingId'?brief.findingLink?.createdFindingId??brief.findingId:brief[key];if(actual!==input[key])return false;}return (brief.inquiryOrigin?.collectionId??null)===(input.collectionId??null);}catch{return false;}}
 return {createStore,matchesBrief,prefix:PREFIX};
});
