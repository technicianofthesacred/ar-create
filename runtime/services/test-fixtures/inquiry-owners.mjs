import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {createCurrentUnderstandingResolver} from '../current-understanding.mjs';
import {conceptContextProjection} from '../concept-markdown.mjs';
import {createLibrary} from '../library.mjs';
import {createProjectMembership} from '../project-membership.mjs';
import {createLibraryWorkReferences} from '../library-work-references.mjs';
import {createStudyHumanDirection} from '../study-human-direction.mjs';
import {createNativeOutputFactory} from '../native-output-factory.mjs';
import {createStore} from '../../store.mjs';
import {createStudyBindings} from '../study-bindings.mjs';
import {createStudyDraftCopies} from '../study-draft-copies.mjs';
import {createStudyOriginals} from '../study-originals.mjs';
import {createStudyOwnedPhotoBindings} from '../study-owned-photo-bindings.mjs';
import * as files from '../files.mjs';
const DEV='Workflow/3-Develop/DEV - An Cha 1 (story).md';
export async function owners(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-create-inquiry-interface-'))),vault=path.join(dataDir,'invented-vault'),originalFiles=path.join(dataDir,'invented-files');fs.mkdirSync(vault);fs.mkdirSync(originalFiles);const original=path.join(vault,DEV);fs.mkdirSync(path.dirname(original),{recursive:true});fs.writeFileSync(original,'---\ntype: DEV\ntitle: Invented later expression\n---\n\nOriginal native words.\n');

 // The maintained original catalog enumerates all four allowlisted DEV names.
 for(const name of ['DEV - An Cha 2 (story).md','DEV - An Cha 3 (story).md','DEV - Hong Kong Day 1 (story).md'])fs.writeFileSync(path.join(vault,'Workflow/3-Develop',name),'---\ntype: DEV\ntitle: Invented unbound optional draft\n---\n\nInvented fixture words only.\n');
 let store;t.after(async()=>{try{await store?.close();}finally{fs.rmSync(dataDir,{recursive:true,force:true});}});store=await createStore({dataDir,sharedArticles:true});const bindings=createStudyBindings({dataDir,store});let project,work,authorityGate=null,authorityActive=false;
 const library=createLibrary({dataDir,workReferences:{read:input=>work.read(input),measure:input=>work.measure(input)},projectAssociations:{read:async input=>{authorityActive=true;try{if(authorityGate)await authorityGate();return await project.readAuthority(input);}finally{authorityActive=false;}}}});
 const empty=(await library.saveCollection({name:'Empty learning inquiry',sourceIds:[],expectedRevision:(await library.collectionsSnapshot()).revision})).collection;
 const originals=createStudyOriginals({vaultRoot:vault,filesRoot:originalFiles}),native=createStudyDraftCopies({dataDir,originals}),direction=createStudyHumanDirection({dataDir,store,bindings,drafts:native,library:{collections:()=>library.collectionsSnapshot(),snapshot:(...args)=>library.snapshot(...args)}}),scope={scope:'collection',collectionId:empty.id},initial=await direction.read(scope),learning=await direction.write({...scope,operationId:randomUUID(),expectedRevision:initial.revision,expectedHash:initial.hash,body:'# A question before sources\n\nMy exact independent learning note.\n'});
 const root=await native.openCopy({originalId:'ancha-1',originalHash:files.digest(fs.readFileSync(original)),parentStudyId:'ref-an-cha',operationId:randomUUID()});await bindings.select({projectKey:'ref-an-cha',title:'Named invented Project',operationId:randomUUID()});const ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings}),physical=await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'ref-an-cha',operationId:randomUUID()}),factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos}),group={rootBindingId:root.binding.id,parentStudyId:'ref-an-cha'},parent=await bindings.lookup({projectKey:group.parentStudyId});
 work=createLibraryWorkReferences({store,outputs:factory.owner});project=createProjectMembership({store,bindings,drafts:native,ownedPhotos,outputs:factory.owner,library,workReferences:work});
 const definition={workspaceId:parent.projectId,...group},endpoint={kind:'project',id:parent.projectId,...group};
 const guards=async()=>{const q=await library.typedRelationships({includeDetached:true});return {expectedRevision:q.revision,expectedHash:q.indexHash};};
 const propose=async(extra={})=>library.proposeProjectAssociation({...await guards(),operationId:randomUUID(),collectionId:empty.id,workspaceId:parent.projectId,...group,expectedProjectProofHash:(await project.readAuthority(endpoint)).proofHash,actor:'human',reason:'Explicit organizational membership, independent of sources.',...extra});
 const accept=async created=>library.changeTypedRelationship({...await guards(),operationId:randomUUID(),id:created.relationship.id,status:'accepted',actor:'human',reason:'Adopt this named Project association.'});
 const create=async kind=>factory.owner.create({...group,kind,sourceBindingId:root.binding.id,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:group.parentStudyId})).expected,expectedOutput:(await factory.owner.read(group)).expectedOutput,operationId:randomUUID()});
 return {dataDir,store,bindings,library,empty,direction,scope,learning,native,root,ownedPhotos,factory,physical,group,parent,work,project,definition,endpoint,guards,propose,accept,create,authorityActive:()=>authorityActive,setGate:gate=>authorityGate=gate};
}


export function understanding(f){return createCurrentUnderstandingResolver({library:f.library,humanDirection:f.direction,collectionDirection:f.direction,nativeOutputs:f.factory.owner,nativeWords:f.native,carouselWords:f.store,conceptContextProjection,workReferences:f.work});}
