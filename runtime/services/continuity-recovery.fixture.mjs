// Invented disposable Library/native study only. Maintained fixed catalog identities, invented content; no private bootstrap.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLibrary} from './library.mjs';
import {createStudyHumanDirection} from './study-human-direction.mjs';
import {createStore} from '../store.mjs';
import {createStudyBindings} from './study-bindings.mjs';
import {createStudyDraftCopies} from './study-draft-copies.mjs';
import {createStudyOriginals} from './study-originals.mjs';
import {createStudyOwnedPhotoBindings} from './study-owned-photo-bindings.mjs';
import {createNativeOutputFactory} from './native-output-factory.mjs';
import {createNativeOutputExports} from './native-output-exports.mjs';
import {digest} from './files.mjs';
export async function createContinuityInterfaceFixture(t,{native=false}={}){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-continuity-interface-invented-')));let store;t.after(async()=>{if(store)await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const library=createLibrary({dataDir});await library.import({rootId:'library',files:[{name:'shared.md',content:'One shared synthetic source.'}]});const source=(await library.tree()).sources[0];
 async function collection(name){const before=await library.collections();return (await library.saveCollection({name,sourceIds:[source.id],expectedRevision:before.revision})).collection;}
 const c1=await collection('Sun Exposure'),c2=await collection('Tea');let direction=createStudyHumanDirection({dataDir,library});const scopes=[c1,c2].map(c=>({kind:'collection',collectionId:c.id}));
 async function learningWrite(scope,body){const selector=scope.kind==='collection'?{scope:'collection',collectionId:scope.collectionId}:{scope:'project',parentStudyId:scope.parentStudyId},prior=await direction.read(selector);return direction.write({...selector,operationId:randomUUID(),expectedRevision:prior.revision,expectedHash:prior.hash,body});}
 await learningWrite(scopes[0],'# Sun inquiry\n\nMy exact uncertainty.');await learningWrite(scopes[1],'# Tea inquiry\n\nAn independent thought.');
 let factory,outputs,exports,projectScope,group,physical,nativeOwner,bindings;
 if(native){
  const vault=path.join(dataDir,'synthetic-vault'),files=path.join(dataDir,'synthetic-files'),dev='Workflow/3-Develop/DEV - An Cha 1 (story).md',src='Workflow/1-Source/SRC - An Cha Master (Dark Tea & Organic Farming).md';fs.mkdirSync(vault);fs.mkdirSync(files);
  for(const [rel,body] of [[dev,'---\ntype: DEV\ntitle: Synthetic\n---\n\nExact native words.\n'],[src,'Invented source words.']]){const p=path.join(vault,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);}

  for(const name of ['DEV - An Cha 2 (story).md','DEV - An Cha 3 (story).md','DEV - Hong Kong Day 1 (story).md'])fs.writeFileSync(path.join(vault,'Workflow/3-Develop',name),'---\ntype: DEV\ntitle: Invented unbound optional draft\n---\n\nInvented fixture words only.\n');
  const originals=createStudyOriginals({vaultRoot:vault,filesRoot:files});
  store=await createStore({dataDir,sharedArticles:true});nativeOwner=createStudyDraftCopies({dataDir,originals});const root=await nativeOwner.openCopy({originalId:'ancha-1',originalHash:digest(fs.readFileSync(path.join(vault,dev))),parentStudyId:'ref-an-cha',operationId:randomUUID()});bindings=createStudyBindings({dataDir,store});await bindings.select({projectKey:'ref-an-cha',title:'Synthetic parent',operationId:randomUUID()});const photos=createStudyOwnedPhotoBindings({dataDir,store,drafts:nativeOwner,bindings});physical=await photos.select({bindingId:root.binding.id,parentStudyId:'ref-an-cha',operationId:randomUUID()});
  direction=createStudyHumanDirection({dataDir,library,store,bindings,drafts:nativeOwner});projectScope={kind:'project',parentStudyId:'ref-an-cha'};await learningWrite(projectScope,'# Current project understanding\n\nNo duplicated summary.');factory=createNativeOutputFactory({dataDir,store,native:nativeOwner,originals,library,ownedPhotos:photos});outputs=factory.owner;group={parentStudyId:'ref-an-cha',rootBindingId:root.binding.id};
  for(let i=0;i<2;i++){const made=await outputs.create({...group,kind:i?'carousel':'article',sourceBindingId:root.binding.id,expectedNative:(await nativeOwner.read({bindingId:root.binding.id,parentStudyId:group.parentStudyId})).expected,expectedOutput:(await outputs.read(group)).expectedOutput,operationId:randomUUID()});scopes.push({kind:'piece',...group,outputId:made.view.output.id});}
  exports=createNativeOutputExports({dataDir,store,outputs,resolveScope:factory.scope.resolve,library});
 }
 const activate=async()=>{const state=store.get();if(state.project.id!==physical.projectId)await store.switchPiece({expectedProjectId:state.project.id,expectedRevision:state.revision,projectId:physical.projectId});};
 return {dataDir,store,library,source,scopes,direction,factory,outputs,exports,projectScope,group,physical,nativeOwner,bindings,activate};
}

export const continuityInterfaceSelectors=f=>({project:{scope:'project',parentStudyId:f.group.parentStudyId},article:{scope:'output',parentStudyId:f.group.parentStudyId,bindingId:f.group.rootBindingId,outputId:f.scopes[2].outputId},carousel:{scope:'output',parentStudyId:f.group.parentStudyId,bindingId:f.group.rootBindingId,outputId:f.scopes[3].outputId},collections:f.scopes.slice(0,2).map(s=>({scope:'collection',collectionId:s.collectionId}))});
