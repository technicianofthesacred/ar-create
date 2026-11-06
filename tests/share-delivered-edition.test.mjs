import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {createStore} from '../runtime/store.mjs';import {createStudyBindings} from '../runtime/services/study-bindings.mjs';import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';import {createStudyOriginals} from '../runtime/services/study-originals.mjs';import {createStudyOwnedPhotoBindings} from '../runtime/services/study-owned-photo-bindings.mjs';import {createStudyHumanDirection} from '../runtime/services/study-human-direction.mjs';import {createLibrary} from '../runtime/services/library.mjs';import {digest} from '../runtime/services/files.mjs';import {createNativeOutputFactory} from '../runtime/services/native-output-factory.mjs';
const DEV='Workflow/3-Develop/DEV - Invented part.md',SRC='Workflow/1-Source/SRC - Invented source.md';
async function nativeFixture(t,{withPhoto=false}={}){const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'native-output-factory-'))),vault=path.join(dataDir,'synthetic-original-vault'),files=path.join(dataDir,'synthetic-original-files');fs.mkdirSync(vault);fs.mkdirSync(files);const put=(rel,body)=>{const file=path.join(vault,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};put(DEV,'---\ntype: DEV\ntitle: Synthetic owner test\n---\n\n'+(withPhoto?'%%photo: cover.jpg · Cover%%\n\n':'')+'Original native words. 瓷 😀 — exact Unicode. %%you: PRIVATE EDITOR NOTE%%\n');put(SRC,'Exact synthetic original source.');const originals=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{'synthetic-parent':{title:'Synthetic source',docs:[[SRC,'source']],relatedProjects:[]}},drafts:{'synthetic-draft':{parentStudyKey:'synthetic-parent',partKey:'1',title:'Synthetic owner test',path:DEV,contextScope:'Synthetic export fixture.',support:[[SRC,'source']]}}}}),store=await createStore({dataDir,sharedArticles:true});t.after(async()=>{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});const native=createStudyDraftCopies({dataDir,originals}),root=await native.openCopy({originalId:'synthetic-draft',originalHash:digest(fs.readFileSync(path.join(vault,DEV))),parentStudyId:'synthetic-parent',operationId:randomUUID()}),bindings=createStudyBindings({dataDir,store});await bindings.select({projectKey:'synthetic-parent',title:'Synthetic parent',operationId:randomUUID()});const ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings}),physical=await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'synthetic-parent',operationId:randomUUID()}),direction=createStudyHumanDirection({dataDir,store,drafts:native,bindings}),library=createLibrary({dataDir,legacyState:()=>({project:{sources:[]}})}),factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos}),group={rootBindingId:root.binding.id,parentStudyId:'synthetic-parent'},create=async()=>factory.owner.create({...group,kind:'article',sourceBindingId:root.binding.id,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:'synthetic-parent'})).expected,expectedOutput:(await factory.owner.read(group)).expectedOutput,operationId:randomUUID()});return {dataDir,vault,files,store,native,root,originals,ownedPhotos,direction,library,factory,group,physical,create,put};}
import {createSharePreparation} from '../runtime/services/share-preparation.mjs';
import {createNativeOutputExports} from '../runtime/services/native-output-exports.mjs';
import {createExports,createExportAssetReader} from '../runtime/services/exports.mjs';
import {outputMarkdown,prepareMagazineHtml} from '../runtime/services/render-helper.mjs';
import {createMagazineOutputExports} from '../runtime/services/magazine-output-exports.mjs';
import {createMagazineMediaInspection} from '../scripts/magazine-media-inspection.mjs';
import * as fileOwners from '../runtime/services/files.mjs';
import {outputPrivatePrefix} from '../runtime/output-records.mjs';
import http from 'node:http';
import {once} from 'node:events';
// Direct service fixtures use invented recordedBy:'human' metadata to test storage only.
// They are synthetic attribution stand-ins, not authenticated human approval.
// The actual HTTP journey below identifies every request as agent:codex.
const op=()=>randomUUID();
const exportRequest=(f,v)=>({...f.group,selectedOutputId:v.output.id,expectedOutput:v.expectedOutput,...(v.writingProof.kind==='native'?{expectedNative:v.writingProof.expected}:{})});
const exportOwner=f=>createNativeOutputExports({dataDir:f.dataDir,store:f.store,outputs:f.factory.owner,resolveScope:f.factory.scope.resolve,library:f.library});
async function exportArticle(f,exports,v){
 const document={id:f.root.binding.id,title:v.output.title,revision:v.output.manuscriptRevision,paragraphs:v.output.manuscript,outputs:[v.output]};
 return exports.saveArticle({...exportRequest(f,v),name:'Exact delivered words',mimeType:'text/markdown',body:outputMarkdown(document,v.output),manuscriptRevision:v.output.manuscriptRevision});
}
const share=(f,exports)=>createSharePreparation({dataDir:f.dataDir,outputs:f.factory.owner,files:fileOwners,outputPrivatePrefix,exportOwners:()=>({native:exports})});
const write=(input,view,extra)=>({...input,expected:view.expected,expectedEdition:view.currentEdition,operationId:op(),...extra});
test('real native export invitation, replies and closure stay on old delivered bytes after edits; current CAS, replay, Undo and sibling independence remain exact',async t=>{
 const f=await nativeFixture(t),a=await f.create(),b=await f.create(),exports=exportOwner(f),saved=await exportArticle(f,exports,await f.factory.owner.read({...f.group,selectedOutputId:a.view.output.id})),service=share(f,exports);
 const input={...f.group,selectedOutputId:a.view.output.id,recipientId:op(),deliveredExportId:saved.artifact.id},before=await service.read(input);
 assert.equal(before.delivery.bytesVerified,true);assert.equal(before.delivery.contentVerification,'server-rendered-exact-edition');assert.notEqual(before.targetEdition,before.currentEdition);
 const originalBytes=fs.readFileSync(saved.artifact.path),original=fs.readFileSync(path.join(f.vault,DEV));
 const firstInput=write(input,before,{changes:{recipient:'Invented reader',message:'Read this exact edition.',translatedMessage:'请读这一版。'}}),first=await service.save(firstInput);
 assert.equal((await service.save(firstInput)).receipt.operationId,firstInput.operationId);
 assert.equal(first.facts.length,0);assert.equal(first.delivery.sent,false);assert.equal(first.delivery.publicationVerified,false);
 const second=await service.save(write(input,first,{changes:{message:'Please read these delivered words.'}}));
 const reply=await service.appendFact(write(input,second,{fact:{kind:'reply',recordedBy:'human',original:'The vessel was blue.',translation:'器皿是蓝色的。',proposedCorrection:'Use blue.',affectedReference:'Opening paragraph'}}));
 assert.equal(reply.facts[0].affectedOutput.deliveredExportId,saved.artifact.id);
 assert.deepEqual(reply.facts[0].affectedOutput.delivery,first.delivery);
 const undone=await service.undo(write(input,reply,{undoOperationId:second.receipt.operationId}));assert.deepEqual(undone.preparation,first.preparation);assert.equal(undone.facts.length,1);
 const selected={...f.group,selectedOutputId:a.view.output.id},native=await f.native.read({bindingId:a.view.wordOwner.bindingId,parentStudyId:f.group.parentStudyId}),paragraph=native.projection.find(p=>p.words.includes('native words.'));
 await f.native.save({bindingId:native.binding.id,parentStudyId:f.group.parentStudyId,expected:native.expected,operationId:op(),operations:[{kind:'text',id:paragraph.id,from:0,to:8,insert:'Changed',seenBlockHash:paragraph.blockHash}]});
 const reread=await share(f,exports).read({...input,targetEdition:first.targetEdition});
 assert.notEqual(reread.currentEdition,first.currentEdition);assert.equal(reread.targetEdition,first.targetEdition);assert.deepEqual(reread.delivery,first.delivery);assert.equal(reread.review.currentWorkCorrespondence,'not-assessed');
 assert.equal(reread.preparation.message,first.preparation.message);assert.deepEqual(fs.readFileSync(saved.artifact.path),originalBytes);
 await assert.rejects(service.save(write(input,undone,{changes:{message:'Old guard'}})),/edition changed/);
 const implicit={...selected,recipientId:input.recipientId};await assert.rejects(service.appendFact(write(implicit,reread,{fact:{kind:'closed',recordedBy:'human',reason:'Read.'}})),/Choose the retained delivery/);
 const closed=await service.appendFact(write({...implicit,targetEdition:first.targetEdition},reread,{fact:{kind:'closed',recordedBy:'human',reason:'This reader finished this delivered edition.'}}));
 assert.equal(closed.facts.at(-1).affectedOutput.edition,first.targetEdition);assert.equal(closed.editions.length,1);
 const sibling=await service.read({...implicit,selectedOutputId:b.view.output.id});assert.equal(sibling.facts.length,0);assert.equal(sibling.preparation,null);
 await assert.rejects(service.read({...input,selectedOutputId:b.view.output.id}),/retained export/);
 const listed=await service.list(selected);assert.equal(listed.records.length,1);assert.equal(listed.deliveries.editions[0].exportId,saved.artifact.id);
 assert.deepEqual(fs.readFileSync(path.join(f.vault,DEV)),original);
 // A refreshed export is a new entry; the previous invitation and reply never migrate.
 const current=await f.factory.owner.read(selected),refreshed=await f.factory.owner.refreshSelectedArticle({...selected,expectedOutput:current.expectedOutput,expectedNative:current.writingProof.expected,operationId:op()}),next=await exportArticle(f,exports,refreshed.view);
 const nextInput={...input,deliveredExportId:next.artifact.id},nextRead=await service.read(nextInput),nextSave=await service.save(write(nextInput,nextRead,{changes:{message:'New edition invitation.'}}));
 assert.notEqual(nextSave.targetEdition,first.targetEdition);assert.equal(nextSave.facts.length,0);assert.equal(nextSave.editions.length,2);
 const previous=await service.read({...implicit,targetEdition:first.targetEdition});assert.deepEqual(previous.preparation,first.preparation);assert.equal(previous.facts.length,2);assert.deepEqual(fs.readFileSync(saved.artifact.path),originalBytes);
 // Both byte changes and metadata changes refuse without modifying retained Share history.
 fs.writeFileSync(saved.artifact.path,'Changed retained bytes');await assert.rejects(service.read({...implicit,targetEdition:first.targetEdition}),/bytes changed|size changed/);fs.writeFileSync(saved.artifact.path,originalBytes);
 const manifest=path.join(path.dirname(saved.artifact.path),'.manifest.json'),manifestBytes=fs.readFileSync(manifest),changed=JSON.parse(manifestBytes);changed.createdAt='2099-01-01T00:00:00.000Z';fs.writeFileSync(manifest,JSON.stringify(changed));
 await assert.rejects(service.read({...implicit,targetEdition:first.targetEdition}),/manifest changed/);fs.writeFileSync(manifest,manifestBytes);
 assert.equal((await service.read({...implicit,targetEdition:first.targetEdition})).expected.hash,previous.expected.hash);
});
test('legacy unverified artifact remains byte-verified only; missing adapters and explicit delivery mismatches refuse honestly',async t=>{
 const f=await nativeFixture(t),a=await f.create(),exports=exportOwner(f),register=createExports({dataDir:f.dataDir,store:f.store}),legacy=register.save({name:'Legacy artifact',mimeType:'text/markdown',body:'Old caller bytes.',outputId:a.view.output.id,manuscriptRevision:0}),service=share(f,exports);
 const input={...f.group,selectedOutputId:a.view.output.id,recipientId:op(),deliveredExportId:legacy.artifact.id},view=await service.read(input);
 assert.equal(view.delivery.bytesVerified,true);assert.equal(view.delivery.contentVerification,'not-declared');assert.equal(view.delivery.publicationVerified,false);
 await assert.rejects(service.read({...input,targetEdition:digest('another')}),/differ/);
 const disconnected=createSharePreparation({dataDir:f.dataDir,outputs:f.factory.owner,files:fileOwners,outputPrivatePrefix}),ordinary={...input};delete ordinary.deliveredExportId;
 assert.equal((await disconnected.read(ordinary)).deliveries.available,false);await assert.rejects(disconnected.read(input),/not connected/);
 const saved=await service.save(write(input,view,{changes:{message:'Legacy bytes; correspondence unverified.'}}));assert.equal(saved.delivery.contentVerification,'not-declared');
});
function magazineFixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'share-magazine-export-'))),repoRoot=path.join(dataDir,'publication'),vault=path.join(dataDir,'vault');fs.mkdirSync(repoRoot);fs.mkdirSync(vault);t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 let raw='---\ntype: DEV\ntitle: Invented delivery\n---\n\nFirst exact words 瓷 😀.\n\nSecond exact words.\n';const root=digest(vault),relative='Workflow/3-Develop/DEV - Invented.md',roots=[{id:'invented-root',path:vault}];
 const working={catalog:()=>({registered:true,rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:root}}),read:async q=>({authority:{kind:'magazine',storyId:q.storyId,pieceId:q.pieceId,path:relative,title:'Invented delivery'},document:{text:raw,hash:digest(raw)}})};
 const exports=createMagazineOutputExports({working,exports:createExports({dataDir}),repoRoot,roots});
 const input=()=>({ownerKind:'magazine',parentStudyId:'mag-subject',storyId:'story',pieceId:'article',selectedOutputId:'magazine-working:story:article',expectedWorkingHash:digest(raw),recipientId:'11111111-1111-4111-8111-111111111111'});
 const service=createSharePreparation({dataDir,files:fileOwners,outputPrivatePrefix,exportOwners:()=>({magazine:exports}),magazine:{read:async q=>({...await working.read(q),parentStudyId:q.parentStudyId,rootIdentity:working.catalog().rootIdentity})}});
 async function saveExport(){const selection={storyId:'story',pieceId:'article',expectedHash:digest(raw)},media=createMagazineMediaInspection({repoRoot,resolveWorking:async q=>({...await working.read(q),target:{nativeProjectId:'story',artifactId:'mag_'+digest(roots[0].id+'\0'+vault+'\0'+relative),hash:q.expectedHash}})}),edition=await media.workingEdition(selection);return exports.save({...selection,renderRevision:edition.revision,name:'invented.html',body:await prepareMagazineHtml(edition,{origin:'http://localhost',readAsset:createExportAssetReader()})});}
 return {dataDir,exports,service,input,saveExport,edit:()=>raw+='\nLater independent correction.'};
}
test('real Magazine renderer/export register resolves source owner despite different UI ID and retains old edition after correction',async t=>{
 const f=magazineFixture(t),saved=await f.saveExport(),input={...f.input(),deliveredExportId:saved.artifact.id};assert.notEqual(saved.artifact.outputId,input.selectedOutputId);
 const view=await f.service.read(input),first=await f.service.save(write(input,view,{changes:{message:'Read the exported Article.'}})),bytes=fs.readFileSync(saved.artifact.path);
 assert.equal(first.delivery.kind,'magazine');assert.equal(first.delivery.contentVerification,'server-rendered-exact-edition');f.edit();
 const fresh={...f.input(),targetEdition:first.targetEdition},again=await f.service.read(fresh);assert.deepEqual(again.delivery,first.delivery);assert.notEqual(again.currentEdition,first.currentEdition);assert.deepEqual(fs.readFileSync(saved.artifact.path),bytes);
 const reply=await f.service.appendFact(write(fresh,again,{fact:{kind:'reply',recordedBy:'human',original:'Please adjust the second sentence.',proposedCorrection:'Later proposed wording.',affectedReference:'Second sentence'}}));assert.equal(reply.facts[0].affectedOutput.outputId,input.selectedOutputId);assert.equal(reply.facts[0].affectedOutput.delivery.outputId,saved.artifact.outputId);
 await assert.rejects(f.service.read({...f.input(),pieceId:'other',selectedOutputId:'magazine-working:story:other',deliveredExportId:saved.artifact.id}),/retained export/);
 assert.equal((await f.service.list((({recipientId,...scope})=>scope)(f.input()))).deliveries.editions[0].exportId,saved.artifact.id);
});
test('real Carousel PNG/caption/manifest delivery remains bound while selected working slides change',async t=>{
 const f=await nativeFixture(t),owner=f.factory.owner,c=await owner.create({...f.group,kind:'carousel',sourceBindingId:f.root.binding.id,expectedNative:f.root.expected,expectedOutput:(await owner.read(f.group)).expectedOutput,operationId:op()}),slides=c.view.output.slides.map(s=>({...s,template:'M12',photos:[]})),saved=await owner.save({...f.group,selectedOutputId:c.view.output.id,expectedOutput:c.view.expectedOutput,operationId:op(),changes:{slides}}),v=saved.view,exports=exportOwner(f);
 if(!exports.capability().available){t.skip('Existing local Chrome unavailable; no simulated PNG verification.');return;}
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname.startsWith('/api/carousel/exports/')){const p=url.pathname.split('/');res.setHeader('Content-Type','text/html');res.end(await exports.page({...f.group,selectedOutputId:v.output.id,exportId:p[4],index:Number(p[6])}));}else{const name=path.basename(url.pathname),allowed=['ab68f14ec71c3016.woff2','5963fe8e750eca5b.woff2','Caudex-Regular.ttf','eb-garamond-400-normal.ttf','eb-garamond-500-normal.ttf','shippori-mincho-700-normal.ttf','shippori-mincho-800-normal.ttf','noto-serif-tc-900-normal.ttf'];assert.ok(allowed.includes(name));const file=path.resolve(['Caudex-Regular.ttf','ab68f14ec71c3016.woff2','5963fe8e750eca5b.woff2'].includes(name)?'runtime/public/assets/fonts':'public/document-study/assets',name);res.end(fs.readFileSync(file));}}catch(error){res.statusCode=500;res.end(error.message);}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const made=await exports.saveCarousel({...exportRequest(f,v),outputRevision:v.output.outputRevision},'http://127.0.0.1:'+server.address().port),service=share(f,exports),input={...f.group,selectedOutputId:v.output.id,recipientId:op(),deliveredExportId:made.export.id},before=await service.read(input);
 assert.equal(before.delivery.kind,'carousel');assert.equal(before.delivery.contentVerification,'existing-carousel-renderer-saved-output-snapshot');assert.equal(before.delivery.bytesVerified,true);
 const png=made.export.files.find(x=>x.mimeType==='image/png'),file=(await exports.file({...f.group,selectedOutputId:v.output.id,exportId:made.export.id,format:'carousel',name:png.name})).file,bytes=fs.readFileSync(file);assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1350);
 const invitation=await service.save(write(input,before,{changes:{message:'Review these exact frames.'}}));
 await owner.save({...f.group,selectedOutputId:v.output.id,expectedOutput:v.expectedOutput,operationId:op(),changes:{caption:'Later corrected caption.'}});
 const after=await service.read({...input,targetEdition:invitation.targetEdition});assert.deepEqual(after.delivery,invitation.delivery);assert.notEqual(after.currentEdition,invitation.currentEdition);assert.deepEqual(fs.readFileSync(file),bytes);
 const caption=made.export.files.find(x=>x.name==='caption.txt'),captionFile=(await exports.file({...f.group,selectedOutputId:v.output.id,exportId:made.export.id,format:'carousel',name:caption.name})).file;fs.writeFileSync(captionFile,'Changed caption');await assert.rejects(service.read({...input,targetEdition:invitation.targetEdition}),/bytes changed|size changed/);
});
test('delivered file or manifest race across final awaited working-owner read refuses Share commit',async t=>{
 const f=await nativeFixture(t),a=await f.create(),exports=exportOwner(f),saved=await exportArticle(f,exports,a.view),input={...f.group,selectedOutputId:a.view.output.id,recipientId:op(),deliveredExportId:saved.artifact.id};
 const file=saved.artifact.path,manifest=path.join(path.dirname(file),'.manifest.json'),bytes=fs.readFileSync(file),manifestBytes=fs.readFileSync(manifest),initial=await share(f,exports).read(input);
 for(const variant of ['file','manifest']){
  let reads=0;const outputs={...f.factory.owner,read:async i=>{const value=await f.factory.owner.read(i);if(++reads===2){if(variant==='file')fs.writeFileSync(file,'Tampered during final owner read.');else fs.writeFileSync(manifest,JSON.stringify({...JSON.parse(manifestBytes),futureMetadata:'Changed during final owner read.'}));}return value;}};
  const service=createSharePreparation({dataDir:f.dataDir,outputs,files:fileOwners,outputPrivatePrefix,exportOwners:()=>({native:exports})});
  await assert.rejects(service.save(write(input,initial,{changes:{message:'Must remain unapplied.'}})),/changed during save/);
  fs.writeFileSync(file,bytes);fs.writeFileSync(manifest,manifestBytes);
  const after=await share(f,exports).read(input);assert.deepEqual(after.expected,initial.expected);assert.equal(after.preparation,null);
 }
});
// These direct service saves model invented local human metadata only. They do not
// authenticate a person or grant an agent the production HTTP human-only actions.
import {createServer} from '../runtime/server.mjs';
test('actual HTTP lazy export adapter resolves delivered selector and seeded invitation; agent save/fact stay forbidden',async t=>{
 const f=await nativeFixture(t),a=await f.create(),exports=exportOwner(f),artifact=await exportArticle(f,exports,a.view),input={...f.group,selectedOutputId:a.view.output.id,recipientId:op(),deliveredExportId:artifact.artifact.id},service=share(f,exports);
 const before=await service.read(input),seed=await service.save(write(input,before,{changes:{recipient:'Invented local test recipient',message:'Synthetic direct-service seed; not an authenticated human action.'}}));
 await f.store.close();
 const server=await createServer({dataDir:f.dataDir,publicDir:path.resolve('public'),studyOriginalRoots:{vaultRoot:f.vault,filesRoot:f.files,catalog:{projects:{'synthetic-parent':{title:'Synthetic source',docs:[[SRC,'source']],relatedProjects:[]}},drafts:{'synthetic-draft':{parentStudyKey:'synthetic-parent',partKey:'1',title:'Synthetic owner test',path:DEV,contextScope:'Synthetic export fixture.',support:[[SRC,'source']]}}}},sharedArticles:true,researchEnabled:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port;
 async function request(route,{body,status=200}={}){
  const response=await fetch(origin+route,{headers:{Origin:origin,'Content-Type':'application/json','X-AR-Actor':'agent:codex','X-AR-Client':'cli'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
 }
 const route='/api/study/share?'+new URLSearchParams(input),view=await request(route);
 assert.equal(view.delivery.exportId,artifact.artifact.id);assert.equal(view.delivery.bytesVerified,true);assert.equal(view.delivery.contentVerification,'server-rendered-exact-edition');assert.equal(view.targetEdition,seed.targetEdition);assert.equal(view.preparation.message,seed.preparation.message);assert.equal(view.delivery.manifestHash,seed.delivery.manifestHash);
 const query={...f.group,selectedOutputId:a.view.output.id},listed=await request('/api/study/share/recipients?'+new URLSearchParams(query));assert.equal(listed.records[0].targetEdition,seed.targetEdition);assert.equal(listed.deliveries.editions[0].exportId,artifact.artifact.id);
 await request('/api/study/share/save',{status:403,body:write(input,view,{changes:{message:'Agent must not overwrite human invitation.'}})});
 await request('/api/study/share/fact',{status:403,body:write(input,view,{fact:{kind:'reply',recordedBy:'human',original:'Agent-supplied label is not human authority.'}})});
 await request(route+'&deliveredExportId='+artifact.artifact.id,{status:400});
 const again=await request('/api/study/share?'+new URLSearchParams({...query,recipientId:input.recipientId,targetEdition:seed.targetEdition}));assert.deepEqual(again.expected,view.expected);assert.deepEqual(again.facts,[]);assert.equal(again.preparation.message,seed.preparation.message);
 const download=await exports.file({...query,exportId:artifact.artifact.id});assert.equal(digest(fs.readFileSync(download.file)),view.delivery.files[0].hash);
});
