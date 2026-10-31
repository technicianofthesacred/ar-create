import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {createStudyFootage,footageMetadata} from './study-footage.mjs';import {createLibrary} from './library.mjs';import {withActor} from './actor.mjs';import {digest} from './files.mjs';
const agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn),human=fn=>withActor({actor:'human:adrian',client:'ui'},fn);
async function fixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'study-footage-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const input=path.join(dataDir,'synthetic.mp4');execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=64x48:r=12:d=2','-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','2','-c:v','mpeg4','-c:a','aac','-shortest',input],{timeout:10000});
 const library=createLibrary({dataDir}),imported=await library.import({rootId:'library',folder:'',files:[{name:'Synthetic footage.mp4',base64:fs.readFileSync(input).toString('base64')}],urls:[]});assert.equal(imported.receipts[0].ok,true);const sourceId=imported.receipts[0].source.id,original=await library.snapshot(sourceId),scope={bindingId:randomUUID(),parentStudyId:'structure-test-'+randomUUID()},projectId=randomUUID(),documentId=randomUUID();let fingerprint=digest('exact synthetic physical mapping'),standIn=true,attached=[sourceId],reads=0,race=false;
 const resolveScope=async request=>{reads++;if(request.bindingId!==scope.bindingId||request.parentStudyId!==scope.parentStudyId)throw Object.assign(Error('foreign scope'),{status:404});if(race&&reads===2)fingerprint=digest('rebound');return {...scope,projectId,documentId,sourceIds:[...attached],fingerprint,canStandInReview:standIn};};
 const create=options=>createStudyFootage({dataDir,library,resolveScope,...options});let service=create();
 const list=()=>service.list(scope),request=(v,extra={})=>({...scope,operationId:randomUUID(),expected:v.expected,sourceId,sourceHash:v.sources[0].hash,metadataHash:v.sources[0].metadataHash,inTicks:v.sources[0].metadata.startTicks,outTicks:v.sources[0].metadata.startTicks+v.sources[0].metadata.durationTicks,label:'Whole useful movement',decision:'keep',...extra});
 return {dataDir,library,sourceId,original,scope,projectId,documentId,get service(){return service;},list,request,restart(){service=create();},custom:create,noStandIn(){standIn=false;},detach(){attached=[];},rebind(){fingerprint=digest('another exact project');},race(){race=true;reads=0;}};
}
test('actual synthetic Library original preserves exact source timebase, ranges, playback and truthful stand-in provenance across restart',async t=>{
 const f=await fixture(t),view=await f.list(),m=view.sources[0].metadata;assert.equal(view.sources.length,1);assert.equal(m.width,64);assert.equal(m.height,48);assert.equal(m.audio,true);assert.ok(m.timebase.denominator>0);assert.equal(view.ranges.length,0);assert.equal(view.coverage.trimmedExport,false);
 const input=f.request(view),saved=await agent(()=>f.service.save(input));assert.equal(saved.ranges[0].decisionRole,'stand-in');assert.equal(saved.ranges[0].provenance.actor,'agent:codex');assert.equal(saved.ranges[0].humanDecision,undefined);assert.equal(saved.ranges[0].outTicks,m.startTicks+m.durationTicks);assert.match(saved.ranges[0].previewUrl,/#t=0,2$/);assert.equal(saved.ranges[0].stale,false);assert.doesNotMatch(JSON.stringify(saved),/"path"|source-originals|ffmpeg/);
 f.restart();const replay=await agent(()=>f.service.save(input));assert.equal(replay.alreadySaved,true);assert.equal(replay.expected.revision,1);assert.equal(replay.history.length,1);assert.deepEqual(replay.ranges,saved.ranges);
 const preview=await f.service.preview({...f.scope,sourceId:f.sourceId,expectedHash:input.sourceHash});assert.equal(preview.contentType,'video/mp4');assert.equal(preview.file,f.original.path);assert.equal(digest(fs.readFileSync(preview.file)),f.original.hash);assert.equal((await f.library.snapshot(f.sourceId)).hash,f.original.hash);
});
test('original-project agents propose only; genuine human source-range review stays distinct',async t=>{
 const f=await fixture(t);f.noStandIn();const v=await f.list();await assert.rejects(agent(()=>f.service.save(f.request(v))),/only registered copies/);await assert.rejects(()=>f.service.save(f.request(v)),/explicit known actor/);
 const proposed=await agent(()=>f.service.save(f.request(v,{decision:'proposed'})));assert.equal(proposed.ranges[0].decisionRole,'proposal');
 const reviewed=await human(()=>f.service.save(f.request(proposed,{rangeId:proposed.ranges[0].id,decision:'check',label:'Check motion in context'})));assert.equal(reviewed.ranges[0].decisionRole,'human');assert.equal(reviewed.ranges[0].provenance.actor,'human:adrian');assert.equal(reviewed.ranges[0].decision,'check');assert.equal(reviewed.history[0].provenance.actor,'agent:codex');assert.equal(reviewed.history[0].range.decision,'proposed');assert.equal(reviewed.history[0].range.label,'Whole useful movement');
});
test('closed fields, exact bounds, stale versions, foreign scope and changed ownership refuse without altering original',async t=>{
 const f=await fixture(t),v=await f.list(),input=f.request(v);
 for(const bad of [{...input,path:f.original.path},{...input,humanDecision:true},{...input,inTicks:-1},{...input,outTicks:input.outTicks+1},{...input,sourceHash:'a'.repeat(64)},{...input,metadataHash:'b'.repeat(64)},{...input,sourceId:randomUUID()},{...input,parentStudyId:'foreign'}])await assert.rejects(agent(()=>f.service.save(bad)));
 const saved=await agent(()=>f.service.save(input));await assert.rejects(agent(()=>f.service.save({...input,operationId:randomUUID()})),/ranges changed/);await assert.rejects(agent(()=>f.service.save({...input,label:'different'})),/another exact/);
 await assert.rejects(()=>f.service.preview({...f.scope,sourceId:f.sourceId,expectedHash:'a'.repeat(64)}),/changed/);f.rebind();await assert.rejects(f.list,/earlier binding/);assert.equal(digest(fs.readFileSync(f.original.path)),f.original.hash);assert.equal(saved.expected.revision,1);
});
test('source changes retain stale range, detachment removes playback, scope race does not save a decision',async t=>{
 const f=await fixture(t),v=await f.list();await agent(()=>f.service.save(f.request(v)));fs.appendFileSync(f.original.path,'changed');const changed=await f.list();assert.equal(changed.ranges[0].stale,true);assert.equal(changed.ranges[0].previewUrl,undefined);await assert.rejects(agent(()=>f.service.save(f.request(v,{operationId:randomUUID()}))),/changed/);
 f.detach();const detached=await f.list();assert.equal(detached.sources.length,0);assert.equal(detached.ranges[0].available,false);await assert.rejects(()=>f.service.preview({...f.scope,sourceId:f.sourceId,expectedHash:f.original.hash}),/not attached/);
 const g=await fixture(t),before=await g.list();g.race();await assert.rejects(agent(()=>g.service.save(g.request(before))),/ownership changed/);assert.equal(fs.readdirSync(path.join(g.dataDir,'study-footage')).length,0);
});
test('unknown timebase and probe failure stay unavailable; no false duration or trimming claim',async t=>{
 assert.throws(()=>footageMetadata({streams:[{codec_type:'video',width:64,height:48,duration_ts:24}]}),/timebase/);
 const f=await fixture(t),unavailable=f.custom({probe:async()=>{throw Error('/private/synthetic/path must stay private');}}),v=await unavailable.list(f.scope);assert.equal(v.sources[0].available,false);assert.doesNotMatch(JSON.stringify(v),/private\/synthetic/);assert.equal(v.ranges.length,0);
});

test('saved range provenance corruption fails closed without replacing existing bytes',async t=>{
 const f=await fixture(t),v=await f.list();await agent(()=>f.service.save(f.request(v)));const directory=path.join(f.dataDir,'study-footage'),file=path.join(directory,fs.readdirSync(directory)[0]),value=JSON.parse(fs.readFileSync(file,'utf8'));value.ranges[0].decisionRole='human';fs.writeFileSync(file,JSON.stringify(value));const before=fs.readFileSync(file,'utf8');await assert.rejects(f.list,/invalid/);assert.equal(fs.readFileSync(file,'utf8'),before);
});
