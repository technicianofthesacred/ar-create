// F-19: draft-history, media-usage, share-preparation and native-output-owner must refuse a stale token with HTTP 409
// and leave the winning bytes alone. These use the real services over invented files.
// The services import files that `npm run build` generates; without them the file is skipped, not failed.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID,createHash} from 'node:crypto';
const BASE=path.resolve(import.meta.dirname,'../runtime');
const built=['services/draft-correspondence.mjs','services/native-output-helpers.mjs'].every(file=>fs.existsSync(path.join(BASE,file)));
const guard=built?test:(name,fn)=>test(name,{skip:'run npm run build first (generated runtime files are missing)'},fn);
const load=file=>import(pathToFileURL(path.join(BASE,file)).href);
const hash=value=>createHash('sha256').update(value).digest('hex');
const has409=error=>error?.status===409;
const modules=built?await Promise.all(['store.mjs','services/study-draft-copies.mjs','services/native-output-owner.mjs','services/native-output-helpers.mjs','services/files.mjs','services/share-preparation.mjs','services/draft-history.mjs','output-records.mjs'].map(load)):[];
const [{createStore,createInitialState}={},{createStudyDraftCopies}={},{createNativeOutputOwner}={},{helpers,mapper}={},files={},{createSharePreparation}={},history={},{outputPrivatePrefix}={}]=modules;

async function ownerFixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-stale-guards-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const original=path.join(dataDir,'DEV - Invented.md');fs.writeFileSync(original,'---\ntype: DEV\ntitle: Invented\n---\n\nOriginal native words.\n');
 const originals={catalog:()=>({drafts:[{originalId:'invented',parentStudyKey:'parent',partKey:'article',title:'Invented',originalHash:hash(fs.readFileSync(original))}]}),readDraft:()=>({id:'invented',parentStudyKey:'parent',partKey:'article',title:'Invented',records:[{id:'draft',role:'draft',path:original,raw:fs.readFileSync(original,'utf8'),hash:hash(fs.readFileSync(original))}]})};
 const native=createStudyDraftCopies({dataDir,originals}),root=await native.openCopy({parentStudyId:'parent',originalId:'invented',originalHash:hash(fs.readFileSync(original)),operationId:randomUUID()});
 const project=createInitialState().project;project.id='invented-project';project.document={schema:'ar-create.document.v1',id:'invented-document',title:'Invented',revision:0,paragraphs:[],outputs:[]};fs.writeFileSync(path.join(dataDir,'state.json'),JSON.stringify({revision:0,project}));
 const store=await createStore({dataDir,sharedArticles:true});t.after(()=>store.close().catch(()=>{}));const group={rootBindingId:root.binding.id,parentStudyId:'parent'};
 const owner=createNativeOutputOwner({dataDir,store,native,mapper,helpers,scope:{resolve:()=>({projectId:project.id,documentId:project.document.id})},proof:{read:async()=>({sources:[],assets:[],photos:[],decisionsHash:hash('invented decisions')})}});
 const create=async()=>owner.create({...group,kind:'article',sourceBindingId:root.binding.id,expectedNative:root.expected,expectedOutput:(await owner.read(group)).expectedOutput,operationId:randomUUID()});
 const a=await create();
 return {dataDir,native,root,store,owner,group,a,create};
}

guard('native-output-owner: a stale expectedOutput or expectedNative is a 409 and the winning words stay',async t=>{
 const f=await ownerFixture(t),id=f.a.view.output.id,view=await f.owner.read({...f.group,selectedOutputId:id});
 await f.owner.save({...f.group,selectedOutputId:id,expectedNative:view.writingProof?.expected,expectedOutput:view.expectedOutput,operationId:randomUUID(),changes:{name:'First name'}});
 const winning=JSON.stringify(await f.owner.read({...f.group,selectedOutputId:id}));
 await assert.rejects(f.owner.save({...f.group,selectedOutputId:id,expectedNative:view.writingProof?.expected,expectedOutput:view.expectedOutput,operationId:randomUUID(),changes:{name:'Stale name'}}),has409);
 await assert.rejects(f.owner.create({...f.group,kind:'article',sourceBindingId:f.root.binding.id,expectedNative:f.root.expected,expectedOutput:f.a.view.expectedOutput,operationId:randomUUID()}),has409,'creating from an out-of-date output list');
 assert.equal(JSON.stringify(await f.owner.read({...f.group,selectedOutputId:id})),winning);
});

guard('native-output-owner: a stale native expectation is a 409',async t=>{
 const f=await ownerFixture(t),id=f.a.view.output.id,before=await f.owner.read({...f.group,selectedOutputId:id});
 const binding=f.a.view.wordOwner.bindingId,snap=await f.native.read({bindingId:binding,parentStudyId:'parent'}),paragraph=snap.projection.find(p=>p.words.includes('native words.'));
 await f.native.save({bindingId:binding,parentStudyId:'parent',expected:snap.expected,operationId:randomUUID(),operations:[{kind:'text',id:paragraph.id,from:0,to:8,insert:'Changed',seenBlockHash:paragraph.blockHash}]});
 await assert.rejects(f.owner.save({...f.group,selectedOutputId:id,expectedNative:before.writingProof?.expected,expectedOutput:before.expectedOutput,operationId:randomUUID(),changes:{name:'Late name'}}),has409);
});

guard('share-preparation: a stale expected token or a stale edition is a 409 and the first contribution stays',async t=>{
 const f=await ownerFixture(t),selector={...f.group,selectedOutputId:f.a.view.output.id,recipientId:randomUUID()};
 const service=createSharePreparation({dataDir:f.dataDir,outputs:f.owner,files,outputPrivatePrefix});
 const save=(changes,view)=>service.save({...selector,expected:view.expected,expectedEdition:view.currentEdition,operationId:randomUUID(),changes});
 const v0=await service.read(selector);await save({message:'First'},v0);
 await assert.rejects(save({message:'Stale token'},v0),has409);
 assert.equal((await service.read(selector)).preparation.message,'First');
 const v1=await service.read(selector);
 // Change the native words so the output's edition moves on, then use the old edition.
 const binding=f.a.view.wordOwner.bindingId,snap=await f.native.read({bindingId:binding,parentStudyId:'parent'}),paragraph=snap.projection.find(p=>p.words.includes('native words.'));
 await f.native.save({bindingId:binding,parentStudyId:'parent',expected:snap.expected,operationId:randomUUID(),operations:[{kind:'text',id:paragraph.id,from:0,to:8,insert:'Changed',seenBlockHash:paragraph.blockHash}]});
 await assert.rejects(service.save({...selector,expected:v1.expected,expectedEdition:v1.currentEdition,operationId:randomUUID(),changes:{message:'Racing'}}),has409);
 assert.equal((await service.read(selector)).preparation.message,'First');
});

guard('draft-history: a receipt that is not the exact committed owned receipt is a 409, never a guess',()=>{
 const sourceKey=hash('invented source'),projectId='invented-project',draftRelative='Draft.md';
 const receipt={schema:'ar-create.project-folder-operation.v1',projectId,state:'committed',changes:[]};
 const call=(overrides={},position='before')=>()=>history.historicalVersion({receipt:{...receipt,...overrides},projectId,draftRelative,sourceKey,position});
 assert.throws(call({schema:'something-else'}),has409);
 assert.throws(call({projectId:'another-project'}),has409);
 assert.throws(call({state:'pending'}),has409);
 assert.throws(call({},'sideways'),has409);
 assert.throws(call({},'before'),has409,'no inverse proof, so the earlier version cannot be rebuilt');
 assert.throws(call({changes:[{area:'binding-metadata',relativePath:projectId+'.draft-correspondence.json',after:'{"tampered":true}',afterHash:hash('different')}]},'after'),has409,'metadata whose bytes do not match their recorded hash');
 assert.equal(history.canUndoVersion({receipt,projectId,draftRelative,sourceKey},{},''),false,'a stale receipt can never offer Undo');
 assert.equal(history.canUndoVersion({receipt,projectId,draftRelative,sourceKey},null,''),false);
});

// media-usage needs the full native-output factory and a bundled article spec.
const mediaReady=built&&fs.existsSync(path.join(BASE,'node_modules/esbuild/lib/main.js'))&&fs.existsSync(path.join(BASE,'src/donors/mag/carousel/ig-templates.js'));
(mediaReady?test:(name,fn)=>test(name,{skip:'needs the build and runtime/node_modules (npm run setup && npm run build)'},fn))('media-usage: a stale expectedOutput or a stale usage hash is a 409',async t=>{
 const [{createStudyBindings},{createStudyOriginals},{createStudyOwnedPhotoBindings},{createLibrary},{createNativeOutputFactory},{build},{default:IG},{createMediaUsage}]=await Promise.all(['services/study-bindings.mjs','services/study-originals.mjs','services/study-owned-photo-bindings.mjs','services/library.mjs','services/native-output-factory.mjs','node_modules/esbuild/lib/main.js','src/donors/mag/carousel/ig-templates.js','services/media-usage.mjs'].map(load));
 const bundled=await build({stdin:{contents:"export {outputSpec} from './src/workspaces/compositionSpec.ts';",resolveDir:BASE},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 const {outputSpec}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
 const DEV='Workflow/3-Develop/DEV - Invented usage.md';
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-stale-media-'))),vault=path.join(dataDir,'invented-vault'),originalFiles=path.join(dataDir,'invented-files');fs.mkdirSync(path.dirname(path.join(vault,DEV)),{recursive:true});fs.mkdirSync(originalFiles);
 fs.writeFileSync(path.join(vault,DEV),'---\ntype: DEV\ntitle: Invented usage\n---\n\nOriginal native words.\n\nAnother invented paragraph.\n');
 const catalog={projects:{},drafts:{'invented-1':{parentStudyKey:'parent',partKey:'1',title:'Invented usage',path:DEV,contextScope:'Invented test fixture.',support:[]}}};
 const originals=createStudyOriginals({vaultRoot:vault,filesRoot:originalFiles,catalog}),store=await createStore({dataDir,sharedArticles:true});t.after(async()=>{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const native=createStudyDraftCopies({dataDir,originals}),root=await native.openCopy({originalId:'invented-1',originalHash:files.digest(fs.readFileSync(path.join(vault,DEV))),parentStudyId:'parent',operationId:randomUUID()}),bindings=createStudyBindings({dataDir,store});
 await bindings.select({projectKey:'parent',title:'Invented parent',operationId:randomUUID()});
 const ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings});await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'parent',operationId:randomUUID()});
 const library=createLibrary({dataDir,legacyState:()=>({project:{sources:[]}})}),factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos}),group={rootBindingId:root.binding.id,parentStudyId:'parent'};
 const physical=await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'parent',operationId:randomUUID()});
 const asset=await library.retainAlbumPhoto({folder:'Invented photos',name:'shared.jpg',bytes:Buffer.from([255,216,255,224,0,1,2,3]),provenance:{kind:'study-photo-upload',projectId:physical.projectId,documentId:physical.documentId}});
 const article=await factory.owner.create({...group,kind:'article',sourceBindingId:root.binding.id,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:'parent'})).expected,expectedOutput:(await factory.owner.read(group)).expectedOutput,operationId:randomUUID()});
 const service=createMediaUsage({outputs:factory.owner,library,articleSpec:outputSpec,carouselTemplates:IG.T}),input={...group,sourceIds:[asset.id]};
 const before=await service.read(input);
 const view=await factory.owner.read({...group,selectedOutputId:article.view.output.id});
 await factory.owner.save({...group,selectedOutputId:article.view.output.id,expectedNative:view.writingProof?.expected,expectedOutput:view.expectedOutput,operationId:randomUUID(),changes:{placements:[{slot:'cover',url:'/api/sources/blob?id='+encodeURIComponent(asset.id),x:.5,y:.5,zoom:1,alt:'Invented cover'}]}});
 await assert.rejects(service.read({...input,expectedOutput:before.expectedOutput}),has409,'saved output moved on since this usage read');
 await assert.rejects(service.resolve({...group,sourceId:asset.id,occurrenceId:hash('not an occurrence'),expectedUsageHash:before.usageHash}),has409,'usage changed since this occurrence was listed');
 const after=await service.read(input);assert.notEqual(after.usageHash,before.usageHash);
});
