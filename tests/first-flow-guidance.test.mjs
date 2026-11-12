import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {withActor} from '../runtime/services/actor.mjs';
import {createFirstFlow} from '../runtime/services/first-flow.mjs';
import {digest} from '../runtime/services/files.mjs';
import {ruleLocation} from '../runtime/services/editorial-rules.mjs';

const stages=['arcreate/stages/research.md','arcreate/stages/brief.md','mag/stages/research.md','mag/stages/map.md','arcreate/brands/teajia.md','mag/LESSONS.md'];
async function prepare(t,override){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'first-flow-guidance-')));
 t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const prior=process.env.AR_CREATE_EDITORIAL_SKILL_ROOT;
 if(override===undefined)delete process.env.AR_CREATE_EDITORIAL_SKILL_ROOT;else process.env.AR_CREATE_EDITORIAL_SKILL_ROOT=override;
 t.after(()=>{if(prior===undefined)delete process.env.AR_CREATE_EDITORIAL_SKILL_ROOT;else process.env.AR_CREATE_EDITORIAL_SKILL_ROOT=prior;});
 const projectId=randomUUID(),sourceId=randomUUID(),body='An invented workshop uses water and clay.',source={id:sourceId,title:'Invented workshop',path:path.join(dataDir,'source.md'),text:body,hash:digest(body),cardEligibility:{eligible:true}};
 fs.writeFileSync(source.path,body);
 const assembledContext=body,capture={assembledContext,manifest:{projectId,contextHash:digest(assembledContext),sources:[{...source,body}]}};
 const flow=createFirstFlow({dataDir,store:{get:()=>({project:{id:projectId}})},library:{read:async()=>source},requests:{preview:async()=>capture},execution:{observe:()=>{},capabilities:()=>({available:false}),execute:()=>{throw Error('No provider may execute in this test.');}}});
 await flow.attach({projectId,sourceIds:[sourceId],operationId:randomUUID()});
 // Confirming the source is Adrian's alone, so this preparation is his.
 await withActor({actor:'human:adrian',client:'ui'},()=>flow.prepare({projectId,sourceIds:[sourceId],sourceReviews:[{sourceId,hash:source.hash}],question:'What can we learn about the invented workshop?',operationId:randomUUID()}));
 const room=path.join(dataDir,'first-flow',digest(projectId)),state=JSON.parse(fs.readFileSync(path.join(room,'flow.json'))),record=JSON.parse(fs.readFileSync(path.join(room,'requests',state.currentRequestId+'.json'))),workspace=path.join(room,'requests',record.id);
 assert.equal(fs.readFileSync(source.path,'utf8'),body);
 assert.equal(record.status,'preview');assert.equal(record.sentAt,undefined);
 return {record,workspace};
}

test('prepared research names and hashes the canonical readable guidance without a host override',async t=>{
 const {record,workspace}=await prepare(t);
 assert.equal(Object.keys(record.stageHashes).length,stages.length);
 for(const [index,name]of stages.entries()){
  const location=ruleLocation(name),expected=fs.readFileSync(path.join(location.root,location.rel),'utf8'),file=path.join(workspace,'stage-'+index+'.md');
  assert.equal(fs.readFileSync(file,'utf8'),expected,name);
  assert.equal(record.stageHashes[path.basename(file)],digest(expected));
  assert.ok(record.prompt.includes(JSON.stringify(file)),name+' is named in the actual prepared prompt');
 }
 assert.match(fs.readFileSync(path.join(workspace,'stage-0.md'),'utf8'),/short useful overview[\s\S]*semantic headings/);
 assert.match(fs.readFileSync(path.join(workspace,'stage-5.md'),'utf8'),/citations beside the claims/);
 assert.equal(record.promptHash,digest(record.prompt));
});

test('an explicit legacy-layout override supplies its exact guidance rather than canonical replacements',async t=>{
 const override=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'first-flow-override-')));t.after(()=>fs.rmSync(override,{recursive:true,force:true}));
 for(const name of stages){fs.mkdirSync(path.dirname(path.join(override,name)),{recursive:true});fs.writeFileSync(path.join(override,name),'# Invented override\n\nExact rule for '+name+'\n');}
 const {record,workspace}=await prepare(t,override);
 for(const [index,name]of stages.entries()){
  const expected=fs.readFileSync(path.join(override,name),'utf8'),file=path.join(workspace,'stage-'+index+'.md');
  assert.equal(fs.readFileSync(file,'utf8'),expected);assert.equal(record.stageHashes[path.basename(file)],digest(expected));assert.ok(record.prompt.includes(JSON.stringify(file)));
 }
});

test('a sparse explicit override retains its scope and the prompt names only captured files',async t=>{
 const override=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'first-flow-sparse-')));t.after(()=>fs.rmSync(override,{recursive:true,force:true}));
 const file=path.join(override,stages[0]);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'# Invented scoped research rule\n');
 const {record,workspace}=await prepare(t,override);
 assert.deepEqual(Object.keys(record.stageHashes),['stage-0.md']);
 assert.equal(fs.readFileSync(path.join(workspace,'stage-0.md'),'utf8'),'# Invented scoped research rule\n');
 assert.ok(record.prompt.includes(JSON.stringify(path.join(workspace,'stage-0.md'))));
 for(let index=1;index<stages.length;index++)assert.ok(!record.prompt.includes(JSON.stringify(path.join(workspace,'stage-'+index+'.md'))));
});
