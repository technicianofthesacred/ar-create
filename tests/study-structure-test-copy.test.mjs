import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {digest} from '../runtime/services/files.mjs';
import {withActor} from '../runtime/services/actor.mjs';
const agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);
async function fixture(t,extra={}){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'structure-copy-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const raw='---\ntitle: Original title\n---\n\nExact original paragraph.\n',records=Array.from({length:10},(_,i)=>({id:'record-'+i,role:i?'source':'draft',path:path.join(dataDir,'originals',i?'SRC - '+i+'.md':'DEV - Original.md'),raw:i?'Source number '+i:raw,hash:digest(i?'Source number '+i:raw)}));
 const originals={catalog:()=>({drafts:[{id:'original',parentStudyKey:'parent',title:'Original'}]}),readDraft:()=>({id:'original',parentStudyKey:'parent',partKey:'article',title:'Original',records})};
 const originalOperationId=randomUUID(),config={dataDir,originals,...extra},service=createStudyDraftCopies(config),source=await service.openCopy({originalId:'original',originalHash:digest(raw),parentStudyId:'parent',operationId:originalOperationId});
 const request={sourceBindingId:source.binding.id,sourceParentStudyId:'parent',expected:source.expected,title:'Structure stand-in',operationId:randomUUID()};return {dataDir,config,service,source,request,records,originalOperationId};
}
const scope=d=>({bindingId:d.binding.id,parentStudyId:d.binding.parentStudyId});
test('agent clones current words with all immutable captures into a distinct discoverable root; restart/edit/Undo preserve source',async t=>{
 const f=await fixture(t),row=f.source.projection.find(p=>p.words),sourceEdit={...scope(f.source),expected:f.source.expected,operationId:randomUUID(),operations:[{kind:'text',id:row.id,from:0,to:5,insert:'Human',seenBlockHash:row.blockHash}]},changed=await f.service.save(sourceEdit);f.request.expected=changed.expected;
 const copy=await agent(()=>f.service.cloneStructureTest(f.request));assert.equal(copy.raw,changed.raw);assert.notEqual(copy.binding.id,f.source.binding.id);assert.equal(copy.binding.parentStudyId,'structure-test-'+f.request.operationId);assert.equal(copy.binding.title,f.request.title);assert.equal(copy.binding.origin,'structure-test');assert.equal(copy.binding.kind,'collection-root');assert.equal(copy.context.records.length,10);assert.equal(copy.context.records[0].raw,f.records[0].raw);assert.equal(copy.originalChanged,false);
 assert.deepEqual(copy.binding.structureTest,{sourceBindingId:f.source.binding.id,sourceParentStudyId:'parent',expected:changed.expected,draftHash:digest(changed.raw),captureHash:digest(fs.readFileSync(f.source.paths.manifest)),createdBy:'agent:codex',role:'structure-test',label:'stand-in'});
 const restarted=createStudyDraftCopies(f.config),catalog=await restarted.catalog();assert.equal(catalog.drafts[0].bindingId,f.source.binding.id);assert.deepEqual(catalog.collections[0].structureTest,copy.binding.structureTest);
 const edit={...scope(copy),expected:copy.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Independent stand-in words.'}]},saved=await restarted.save(edit);assert.equal((await agent(()=>restarted.cloneStructureTest(f.request))).raw,saved.raw);assert.equal((await restarted.read(scope(changed))).raw,changed.raw);
 const undone=await restarted.undo({...scope(copy),expected:saved.expected,operationId:randomUUID(),undoOperationId:edit.operationId});assert.equal(undone.raw,copy.raw);assert.equal((await restarted.read(scope(changed))).raw,changed.raw);
});
test('clone refuses missing/human actors, stale/foreign sources, caller paths and operation collisions',async t=>{
 const f=await fixture(t);await assert.rejects(f.service.cloneStructureTest(f.request),/agent/i);await assert.rejects(withActor({actor:'human:adrian',client:'ui'},()=>f.service.cloneStructureTest(f.request)),/agent/i);
 for(const patch of [{expected:{}},{sourceParentStudyId:'foreign'},{sourceBindingId:randomUUID()},{path:'/tmp/foreign'},{raw:'caller words'},{structureTest:{createdBy:'human:adrian'}}])await assert.rejects(agent(()=>f.service.cloneStructureTest({...f.request,...patch})));
 const copy=await agent(()=>f.service.cloneStructureTest(f.request));await assert.rejects(agent(()=>f.service.cloneStructureTest({...f.request,title:'Different input'})));await assert.rejects(agent(()=>f.service.cloneStructureTest({...f.request,operationId:f.originalOperationId})));
 assert.equal((await f.service.read(scope(copy))).raw,f.source.raw);
});
test('interrupted clone resumes immutable seed after source advances and refuses corrupted captures',async t=>{
 const f=await fixture(t);let stop=true;const interrupted=createStudyDraftCopies({...f.config,afterCopyFile:()=>{if(stop){stop=false;throw Error('interrupted clone');}}});await assert.rejects(agent(()=>interrupted.cloneStructureTest(f.request)),/interrupted clone/);
 await f.service.save({...scope(f.source),expected:f.source.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Later source edit.'}]});const restarted=createStudyDraftCopies(f.config),copy=await agent(()=>restarted.cloneStructureTest(f.request));assert.equal(copy.raw,f.source.raw);
 const captured=copy.context.records[1].copiedPath;fs.chmodSync(captured,0o600);fs.writeFileSync(captured,'tampered');await assert.rejects(agent(()=>restarted.cloneStructureTest(f.request)),/capture|source/i);
});

test('source capture, immutable clone seed and target parent collisions refuse without replacing either owner',async t=>{
 const f=await fixture(t),target='structure-test-'+f.request.operationId;
 await f.service.createCollection({parentStudyId:target,title:'An existing owner',operationId:randomUUID()});
 await assert.rejects(agent(()=>f.service.cloneStructureTest(f.request)),/parent identity/);
 const next={...f.request,operationId:randomUUID()},copy=await agent(()=>f.service.cloneStructureTest(next));
 const seed=path.join(f.dataDir,'study-draft-copies','copies',copy.binding.id,'structure-test-seed.json'),seedBefore=fs.readFileSync(seed);fs.chmodSync(seed,0o600);fs.writeFileSync(seed,'{}');
 await assert.rejects(agent(()=>f.service.cloneStructureTest(next)),/seed/);
 await assert.rejects(f.service.read(scope(copy)),/seed/);
 fs.writeFileSync(seed,seedBefore);
 const captured=f.source.context.records[2].copiedPath;fs.chmodSync(captured,0o600);fs.writeFileSync(captured,'source capture was altered');
 await assert.rejects(agent(()=>f.service.cloneStructureTest({...f.request,operationId:randomUUID()})),/capture/);
 assert.equal((await f.service.read(scope(copy))).raw,copy.raw);
});

test('read and catalog reject forged structure metadata; edited stand-in remains valid across restart',async t=>{
 const f=await fixture(t),copy=await agent(()=>f.service.cloneStructureTest(f.request)),area=path.join(f.dataDir,'study-draft-copies','bindings');
 const fileFor=id=>fs.readdirSync(area).map(n=>path.join(area,n)).find(file=>JSON.parse(fs.readFileSync(file)).id===id),file=fileFor(copy.binding.id),before=fs.readFileSync(file),record=JSON.parse(before);
 for(const patch of [{createdBy:'human:adrian'},{label:'real'},{sourceBindingId:copy.binding.id},{captureHash:'invalid'},{draftHash:digest('different')}]){
  fs.writeFileSync(file,JSON.stringify({...record,structureTest:{...record.structureTest,...patch}}));
  await assert.rejects(f.service.read(scope(copy)),/structure-test|seed/i);await assert.rejects(f.service.catalog(),/structure-test|seed/i);
 }
 fs.writeFileSync(file,before);const sourceFile=fileFor(f.source.binding.id),sourceBefore=fs.readFileSync(sourceFile),sourceRecord=JSON.parse(sourceBefore);fs.writeFileSync(sourceFile,JSON.stringify({...sourceRecord,structureTest:record.structureTest}));await assert.rejects(f.service.read(scope(f.source)),/structure-test/i);fs.writeFileSync(sourceFile,sourceBefore);
 const saved=await f.service.save({...scope(copy),expected:copy.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Changed independently.'}]});
 const reopened=createStudyDraftCopies(f.config);assert.equal((await reopened.read(scope(copy))).raw,saved.raw);assert.equal((await reopened.catalog()).collections[0].structureTest.draftHash,digest(copy.raw));
 const child=await reopened.fork({parentStudyId:copy.binding.parentStudyId,sourceBindingId:copy.binding.id,outputId:randomUUID(),expected:saved.expected,operationId:randomUUID()});assert.equal(child.raw,saved.raw);assert.equal(child.binding.origin,undefined);assert.equal(child.binding.structureTest,undefined);
});

test('intent-only restart keeps original discovery and honest pending row; exact replay resumes missing seed',async t=>{
 const f=await fixture(t),copy=await agent(()=>f.service.cloneStructureTest(f.request)),area=path.join(f.dataDir,'study-draft-copies','bindings');
 const file=fs.readdirSync(area).map(n=>path.join(area,n)).find(file=>JSON.parse(fs.readFileSync(file)).id===copy.binding.id),intent=JSON.parse(fs.readFileSync(file));
 // Reconstruct the exact persisted boundary: intent exists, copy/seed writes have not begun.
 intent.status='pending';delete intent.readyAt;delete intent.captureHash;fs.writeFileSync(file,JSON.stringify(intent));fs.rmSync(path.join(f.dataDir,'study-draft-copies','copies',copy.binding.id),{recursive:true,force:true});
 const restarted=createStudyDraftCopies(f.config),catalog=await restarted.catalog();assert.equal(catalog.drafts[0].bindingId,f.source.binding.id);assert.equal(catalog.collections[0].bindingStatus,'pending');assert.equal((await restarted.read(scope(f.source))).raw,f.source.raw);await assert.rejects(restarted.read(scope(copy)),/seed/);
 const resumed=await agent(()=>restarted.cloneStructureTest(f.request));assert.equal(resumed.binding.id,copy.binding.id);assert.equal(resumed.binding.status,'ready');assert.equal(resumed.raw,f.source.raw);
 // Ready state still fails closed when its immutable seed disappears.
 fs.unlinkSync(path.join(f.dataDir,'study-draft-copies','copies',copy.binding.id,'structure-test-seed.json'));await assert.rejects(restarted.catalog(),/seed/);
 fs.writeFileSync(file,JSON.stringify(intent));await restarted.save({...scope(f.source),expected:f.source.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'New source revision.'}]});await assert.rejects(agent(()=>restarted.cloneStructureTest(f.request)),/Source changed/);assert.equal((await restarted.catalog()).collections[0].bindingStatus,'pending');
});
