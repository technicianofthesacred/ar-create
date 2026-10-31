import {StateError} from '../store.mjs';import {digest} from './files.mjs';import {AGENT_ACTORS,currentActor} from './actor.mjs';
const fail=(message,status=409)=>{throw new StateError(message,status);};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
/** Prove an existing decision target; a display title or active editor cannot confer ownership. */
export function createStudyDirectionTarget({drafts,bindings,outputs,structureTests}){
 return async input=>{
  if(!input||Object.keys(input).sort().join(',')!=='bindingId,parentStudyId,target')fail('Choose one exact Direction target.',400);
  const {bindingId,parentStudyId,target}=input,document=await drafts.read({bindingId,parentStudyId});if(document.binding?.id!==bindingId||document.binding.parentStudyId!==parentStudyId||document.binding.status!=='ready'||document.readiness?.ready!==true)fail('The native Direction subject changed.');
  const parent=await bindings.lookup({projectKey:parentStudyId}),part=await bindings.lookup({projectKey:'owned-draft:'+bindingId});let authority={kind:'subject',parent,part,bindingId};
  if(target?.kind==='native'){
   const native=await drafts.read({bindingId:target.bindingId,parentStudyId});if(native.binding.id!==target.bindingId||native.binding.parentStudyId!==parentStudyId||native.binding.status!=='ready'||native.readiness?.ready!==true)fail('This piece belongs to another Direction subject.');
   const owned=await bindings.lookup({projectKey:'owned-draft:'+target.bindingId});authority={kind:'native',parent,part:owned,binding:{id:native.binding.id,parentStudyId:native.binding.parentStudyId,authority:native.binding.authority,origin:native.binding.origin,sourceBindingId:native.binding.sourceBindingId||null,canonicalOutputId:native.binding.canonicalOutputId||null}};
  }else if(target?.kind==='output'){
   const rootBindingId=document.binding.sourceBindingId||bindingId,value=await outputs.read({rootBindingId,parentStudyId,selectedOutputId:target.outputId});if(value.output?.id!==target.outputId||value.parentStudyId!==undefined&&value.parentStudyId!==parentStudyId||!value.wordOwner)fail('This output has no exact saved Direction owner.');
   authority={kind:'output',parent,rootBindingId,outputId:value.output.id,outputKind:value.output.kind,wordOwner:Object.fromEntries(Object.entries(value.wordOwner).filter(([key])=>['kind','bindingId','parentStudyId','projectId','documentId','outputId','rootBindingId','sourceBindingId'].includes(key)))};
  }else if(target?.kind!=='subject'||Object.keys(target).length!==1)fail('Choose a subject, native piece or saved output.',400);
  let canStandInReview=false;if(AGENT_ACTORS.includes(currentActor()?.actor)){try{await structureTests.validateTarget({bindingId,parentStudyId});if(target.kind==='native')await structureTests.validateTarget({bindingId:target.bindingId,parentStudyId});canStandInReview=true;}catch(error){if(![403,404,409].includes(error.status))throw error;}}
  return {fingerprint:digest(stable(authority)),canStandInReview};
 };
}
