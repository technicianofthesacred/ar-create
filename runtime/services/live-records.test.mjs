import test from 'node:test';
import assert from 'node:assert/strict';
import {isFixtureRecord,isLiveLibrarySource} from './live-records.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('fixture classification uses explicit provenance or exact legacy namespace, never broad title words',()=>{
 assert.equal(isFixtureRecord({fixture:true}),true);
 assert.equal(isFixtureRecord({provenance:{kind:'synthetic-test'}}),true);
 assert.equal(isFixtureRecord({parentStudyId:'connection-demo-'+id,title:'Connection demo — Making room'}),true);
 assert.equal(isFixtureRecord({id:'real-project',title:'Connection demo — Making room'}),false);
 assert.equal(isFixtureRecord({id:'connection-demo-'+id,title:'An ordinary saved project'}),false);
 assert.equal(isFixtureRecord({title:'Synthetic Oracle test '+id}),true);
 assert.equal(isFixtureRecord({title:'Research about synthetic Oracle tests'}),false);
});
test('legacy fixture files are exact while real recordings and supplied research remain live',()=>{
 for(const rel of ['synthetic-qa-narration.wav','Projects/'+id+'/synthetic-qa-narration.wav','Oracle/oracle-synthetic-'+id+'.wav'])assert.equal(isLiveLibrarySource({rootId:'library',rel_path:rel}),false);
 assert.equal(isLiveLibrarySource({rootId:'library',rel_path:'Projects/'+id+'/ar-material-intake-check.md',title:'Synthetic intake check'}),false);
 for(const source of [{rootId:'library',rel_path:'Oracle/oracle-'+id+'.wav'},{rootId:'recordings',rel_path:'Oracle recording '+id+'/oracle-'+id+'.wav'},{rootId:'kept-transcripts',rel_path:'Transcription/'+id+'/transcript.md'},{rootId:'library',rel_path:'Notes/synthetic-qa-narration.md'},{rootId:'library',rel_path:'Notes/ar-material-intake-check.md',title:'A real intake note'}])assert.equal(isLiveLibrarySource(source),true);
});

test('native catalogue omits the known demo namespace but preserves exact access and ordinary same-title work',async t=>{const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{randomUUID}=await import('node:crypto'),{createStudyDraftCopies}=await import('./study-draft-copies.mjs');const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-live-projects-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));const service=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>{throw Error('No original fixture');}}}),hiddenId='connection-demo-'+randomUUID(),title='Connection demo — Making room',hidden=await service.createCollection({parentStudyId:hiddenId,title,operationId:randomUUID()}),real=await service.createCollection({parentStudyId:'real-project',title,operationId:randomUUID()});const catalog=await service.catalog();assert.deepEqual(catalog.collections.map(r=>r.bindingId),[real.binding.id]);assert.deepEqual(catalog.excludedProjectIds,[hiddenId]);assert.equal((await service.read({bindingId:hidden.binding.id,parentStudyId:hiddenId})).raw,hidden.raw);});

test('review discovery carries native fixture exclusions alongside configured browser exclusions',async()=>{const {createExistingWorkReader}=await import('./review-existing-work.mjs'),reader=createExistingWorkReader({portfolio:{list:async()=>({stories:[],guidance:[],unassigned:[]})},excludedProjectIds:['configured-example'],readAuthority:async route=>route==='/api/study-draft/catalog'?{drafts:[],excludedProjectIds:['connection-demo-'+id]}:{}});const catalog=await reader.catalog();assert.deepEqual(catalog.excludedProjectIds,['configured-example','connection-demo-'+id]);});
