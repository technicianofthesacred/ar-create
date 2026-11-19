import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStudyDerivedFindings} from '../runtime/services/study-derived-findings.mjs';
import {createStudyVideoBriefs} from '../runtime/services/study-video-briefs.mjs';
import {digest} from '../runtime/services/files.mjs';
import {withActor} from '../runtime/services/actor.mjs';

function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'finding-link-'));
  t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  const source={path:'Workflow/1-Source/SRC - Invented.md',name:'Invented transcript',role:'source',raw:'Heading 😀\n**Invented speaker:**\n[00:01:00] An exact invented spoken anchor.\n'};
  source.hash=digest(source.raw);
  const originals={list:async projectKey=>({projectKey,records:[source]})};
  const findings=createStudyDerivedFindings({dataDir,originals});
  const briefs=createStudyVideoBriefs({dataDir,originals,findings});
  const quote='An exact invented spoken anchor.',from=source.raw.indexOf(quote);
  const scope={projectKey:'hk',parentStudyId:'hk'};
  const input={...scope,operationId:randomUUID(),expectedExportHash:null,title:'Proposed spoken anchor',sourcePath:source.path,sourceHash:source.hash,from,to:from+quote.length,quote,speaker:'Invented speaker',location:'Within 00:01:00 transcript turn; media edit points unverified',clarity:{supported:'The transcript contains this attributed passage.',uncertain:'Recording and final cut have not been reviewed.',storyImplication:'Audition this proposed anchor.'}};
  const originalBrief={...scope,operationId:randomUUID(),findingId:'unresolved-existing-anchor',title:'Existing proposed brief',sourcePath:source.path,sourceHash:source.hash,from,to:input.to,quote};
  return {dataDir,source,findings,briefs,input,scope,originalBrief};
}
const agent=fn=>withActor({actor:'agent:codex',client:'test'},fn);

test('save one source-backed proposed finding, reopen it, and relink the same brief idempotently',async t=>{
  const f=fixture(t),original=await agent(()=>f.briefs.add(f.originalBrief));
  const saved=await agent(()=>f.findings.save(f.input));
  assert.equal(saved.points.length,1);
  const point=saved.points[0];
  assert.equal(point.spoken[0].quote,f.input.quote);
  assert.equal(point.canPlan,false);
  assert.equal(point.provenance.actor,'agent:codex');
  assert.deepEqual(await agent(()=>f.findings.save(f.input)),saved);
  const reopened=await f.findings.read(f.scope);assert.equal(reopened.points[0].id,point.id);
  const change={...f.scope,id:original.brief.id,operationId:randomUUID(),expectedFindingId:original.brief.findingId,findingId:point.id};
  const linked=await agent(()=>f.briefs.relink(change));
  assert.equal(linked.brief.id,original.brief.id);
  for(const key of ['title','quote','sourcePath','sourceHash','from','to','status','provenance'])assert.deepEqual(linked.brief[key],original.brief[key]);
  assert.equal(linked.brief.findingId,point.id);
  assert.deepEqual(await agent(()=>f.briefs.relink(change)),linked);
  assert.deepEqual(await agent(()=>f.briefs.add(f.originalBrief)),linked);
  await assert.rejects(agent(()=>f.briefs.add({...f.originalBrief,findingId:point.id})),/different/i);
  assert.equal((await f.briefs.list(f.scope)).briefs.length,1);
  assert.equal((await f.briefs.resolve({...f.scope,id:linked.brief.id})).source.quote,f.input.quote);
});

test('older relink retries never restore an obsolete choice or reuse a committed UUID',async t=>{
  const f=fixture(t),original=await agent(()=>f.briefs.add(f.originalBrief));
  const first=(await agent(()=>f.findings.save(f.input))).points[0];
  const secondInput={...f.input,operationId:randomUUID(),expectedExportHash:(await f.findings.read(f.scope)).exportHash,title:'Second proposed interpretation of the same passage'};
  const second=(await agent(()=>f.findings.save(secondInput))).points.find(p=>p.derivedId===secondInput.operationId);
  const change={...f.scope,id:original.brief.id,operationId:randomUUID(),expectedFindingId:original.brief.findingId,findingId:first.id};
  await agent(()=>f.briefs.relink(change));
  const newer={...change,operationId:randomUUID(),expectedFindingId:first.id,findingId:second.id};
  await agent(()=>f.briefs.relink(newer));
  const result=await agent(()=>f.briefs.relink(change));
  assert.equal(result.brief.findingId,second.id);
  assert.equal(result.brief.findingLink.operations.length,2);
  await assert.rejects(agent(()=>f.briefs.relink({...change,findingId:second.id})),/operation|different/i);
});

test('relink preserves a brief changed by another owner while resolving the finding',async t=>{
  const f=fixture(t),original=await agent(()=>f.briefs.add(f.originalBrief));
  const point=(await agent(()=>f.findings.save(f.input))).points[0];
  const file=path.join(f.dataDir,'study-video-briefs/hk',original.brief.id+'.json');
  const findings={read:async scope=>{
    const record=JSON.parse(fs.readFileSync(file));record.brief.title='Newer saved title';
    fs.writeFileSync(file,JSON.stringify(record));return f.findings.read(scope);
  }};
  const service=createStudyVideoBriefs({dataDir:f.dataDir,originals:{list:async key=>({projectKey:key,records:[f.source]})},findings});
  await assert.rejects(agent(()=>service.relink({...f.scope,id:original.brief.id,operationId:randomUUID(),expectedFindingId:original.brief.findingId,findingId:point.id})),/changed|refresh/i);
  assert.equal(JSON.parse(fs.readFileSync(file)).brief.title,'Newer saved title');
});

test('saved source locators count CR, LF and CRLF consistently',async t=>{
  for(const newline of ['\r','\n','\r\n']){
    const f=fixture(t);f.source.raw=f.source.raw.replaceAll('\n',newline);f.source.hash=digest(f.source.raw);
    const from=f.source.raw.indexOf(f.input.quote),input={...f.input,sourceHash:f.source.hash,from,to:from+f.input.quote.length};
    const read=await agent(()=>f.findings.save(input));assert.equal(read.points[0].sources[0].lineStart,3);
  }
});

test('finding save refuses changed source, stale manifest, operation collisions and foreign scopes without adding records',async t=>{
  const f=fixture(t);
  await assert.rejects(agent(()=>f.findings.save({...f.input,sourceHash:digest('changed')})),/source|passage/i);
  await assert.rejects(agent(()=>f.findings.save({...f.input,parentStudyId:'ref-an-cha'})),/scope|subject|parent/i);
  await agent(()=>f.findings.save(f.input));
  await assert.rejects(agent(()=>f.findings.save({...f.input,title:'Changed retry'})),/operation|different/i);
  await assert.rejects(agent(()=>f.findings.save({...f.input,clarity:{...f.input.clarity,unexpected:'ignored'}})),/unsupported/i);
  await assert.rejects(agent(()=>f.findings.save({...f.input,operationId:randomUUID()})),/changed|refresh|stale/i);
  assert.equal((await f.findings.read(f.scope)).points.length,1);
});

test('relink refuses absent findings, changed anchors, stale links and conflicting retries',async t=>{
  const f=fixture(t),original=await agent(()=>f.briefs.add(f.originalBrief));
  const point=(await agent(()=>f.findings.save(f.input))).points[0];
  const change={...f.scope,id:original.brief.id,operationId:randomUUID(),expectedFindingId:original.brief.findingId,findingId:point.id};
  await assert.rejects(agent(()=>f.briefs.relink({...change,id:randomUUID()})),error=>error.status===404);
  await assert.rejects(agent(()=>f.briefs.relink({...change,findingId:'not-a-real-finding'})),/finding/i);
  await assert.rejects(agent(()=>f.briefs.relink({...change,expectedFindingId:'stale'})),/changed|refresh|stale/i);
  const second={...f.input,operationId:randomUUID(),expectedExportHash:(await f.findings.read(f.scope)).exportHash,quote:'exact invented',from:f.source.raw.indexOf('exact invented'),to:f.source.raw.indexOf('exact invented')+'exact invented'.length};
  const other=(await agent(()=>f.findings.save(second))).points.find(p=>p.derivedId===second.operationId);
  await assert.rejects(agent(()=>f.briefs.relink({...change,findingId:other.id})),/anchor|passage|source/i);
  await agent(()=>f.briefs.relink(change));
  await assert.rejects(agent(()=>f.briefs.relink({...change,findingId:other.id})),/operation|different/i);
  f.source.raw+='Source correction';f.source.hash=digest(f.source.raw);
  await assert.rejects(agent(()=>f.briefs.relink({...change,operationId:randomUUID(),expectedFindingId:point.id})),/source|passage|finding/i);
});

test('a valid non-English brief can keep its full UTF-16 quote when linked',async t=>{
  const f=fixture(t);f.source.raw='中文'.repeat(1500);f.source.hash=digest(f.source.raw);
  const input={...f.input,sourceHash:f.source.hash,quote:f.source.raw,from:0,to:f.source.raw.length};
  assert.equal((await agent(()=>f.findings.save(input))).points[0].spoken[0].quote,input.quote);
});

test('appending a finding preserves a valid UTF-8 BOM producer export',async t=>{
  const f=fixture(t);await agent(()=>f.findings.save(f.input));
  const file=path.join(f.dataDir,'study-derived-findings',digest('hk')+'.json');
  fs.writeFileSync(file,'\uFEFF'+fs.readFileSync(file,'utf8'));
  const before=await f.findings.read(f.scope);
  assert.equal((await agent(()=>f.findings.save({...f.input,operationId:randomUUID(),expectedExportHash:before.exportHash}))).points.length,2);
});
