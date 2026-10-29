import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readDirectionChoices,applyDirectionChoice,stripDirectionChoices,parsePreparedDirections} from '../public/lib/direction-choice.js';
import {createStudyHumanDirection} from '../runtime/services/study-human-direction.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {renderConcept,conceptContextProjection} from '../runtime/services/concept-markdown.mjs';
const source={artifactId:'synthetic-prepared',hash:'a'.repeat(64)};
const choice=(extra={})=>({operationId:randomUUID(),kind:'angle',action:'use',optionId:'angle:1',text:'Synthetic garden.',reason:'',source,...extra});
test('managed codec preserves exact prose, plan and attribution; supersession and rejection are explicit',()=>{
 const core=renderConcept({authorThoughts:'Exact original thoughts.\n保留原文。',adoptedDirection:'Human intent.',aiInterpretation:'Provisional.',suggestions:'Unadopted.',sourceSelections:[]}),body=core+'\n\n<!-- ar-create:direction-plan:v1 -->\n## Planning intent — not approval of wording or publication\n\n```json\n{"title":"Synthetic plan"}\n```\n<!-- /ar-create:direction-plan:v1 -->';
 const first=choice(),saved=applyDirectionChoice(body,first);assert.equal(stripDirectionChoices(saved),body);assert.ok(saved.startsWith(body));assert.deepEqual(readDirectionChoices(saved).selectedAngle,first);
 const next=choice({optionId:'angle:2',text:'Synthetic attention.'}),second=applyDirectionChoice(saved,next);assert.equal(readDirectionChoices(second).selectedAngle.text,next.text);assert.equal(readDirectionChoices(second).rejections.length,0);
 const oldReject=applyDirectionChoice(second,choice({action:'reject',reason:'A different emphasis.'}));assert.equal(readDirectionChoices(oldReject).selectedAngle.text,next.text);
 const rejected=applyDirectionChoice(oldReject,choice({...next,operationId:randomUUID(),action:'reject',reason:'Too broad.'}));assert.equal(readDirectionChoices(rejected).selectedAngle,null);assert.equal(readDirectionChoices(rejected).rejections.length,2);
 const projection=conceptContextProjection(saved);assert.equal(projection.attribution,'labeled-contributions');assert.equal(projection.personalThoughts.body,'Exact original thoughts.\n保留原文。');assert.equal(projection.sourceSnapshot.body,saved);assert.equal(projection.planningIntent.values.title,'Synthetic plan');assert.equal(projection.directionChoices.selectedAngle.text,first.text);
 assert.throws(()=>applyDirectionChoice(saved,first),/already exists/);assert.throws(()=>applyDirectionChoice(body,choice({action:'reject'})),/reason/);assert.throws(()=>applyDirectionChoice(body,{...choice(),actor:'human:adrian'}));assert.throws(()=>applyDirectionChoice(body,choice({reason:'line\nbreak'})));assert.throws(()=>applyDirectionChoice(body,choice({text:'x'.repeat(2049)})));
 for(const bad of ['<!-- ar-create:direction-choices:v1 -->','<!-- /ar-create:direction-choices:v1 -->',saved+saved.slice(body.length),saved.replace('"schema": "ar-create.direction-choices.v1"','"schema": "wrong"')]){assert.equal(readDirectionChoices(bad).available,false);assert.throws(()=>stripDirectionChoices(bad));}
});
test('prepared generic Markdown retains explanation and stable source-bound option IDs',()=>{
 const raw='## Pick a direction\n\n**1. Synthetic garden.** An invented explanation.\n\nSecond paragraph.\n\n**2. Synthetic attention.**\nAnother explanation.\n\n## Pick a title\n1. **Synthetic title**\n2. Plain synthetic title\n\n## Other\n1. Ignore this';
 const parsed=parsePreparedDirections(raw,source);assert.deepEqual(parsed.titles,[{id:'title:1',text:'Synthetic title'},{id:'title:2',text:'Plain synthetic title'}]);assert.deepEqual(parsed.angles,[{id:'angle:1',text:'Synthetic garden.',description:'An invented explanation.\n\nSecond paragraph.'},{id:'angle:2',text:'Synthetic attention.',description:'Another explanation.'}]);assert.deepEqual(parsed.source,source);
});
test('existing owner gates choices, keeps revision/history/idempotence and exact saved Undo',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-direction-choice-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));const id=randomUUID(),scope={scope:'collection',collectionId:id},owner=createStudyHumanDirection({dataDir,library:{collections:async()=>({collections:[{id,name:'Synthetic inquiry',sourceIds:[]}]})}});
 const actor=(name,fn)=>withActor({actor:name,client:'http'},fn),human=fn=>actor('human:adrian',fn),agent=fn=>actor('agent:codex',fn);
 let current=await owner.read(scope);const save=(body,operationId=randomUUID(),record=current)=>({...scope,body,operationId,expectedRevision:record.revision,expectedHash:record.hash});
 current=await agent(()=>owner.write(save('Exact synthetic notes.')));const notes=current,event=choice(),input=save(applyDirectionChoice(current.body,event),event.operationId);
 await assert.rejects(owner.write(input),error=>error.status===403);await assert.rejects(agent(()=>owner.write(input)),error=>error.status===403);current=await human(()=>owner.write(input));assert.equal(current.revision,2);assert.equal((await owner.read(scope)).directionChoices.selectedAngle.text,event.text);
 const replay=await human(()=>owner.write(input));assert.equal(replay.revision,2);assert.equal((await owner.read(scope)).history.filter(o=>o.status==='committed').length,2);await assert.rejects(agent(()=>owner.write(input)),error=>error.status===403);
 await assert.rejects(human(()=>owner.write({...input,body:input.body+' changed'})),/different direction decision/);
 await assert.rejects(human(()=>owner.write(save(applyDirectionChoice(notes.body,choice()),randomUUID(),notes))),/changed/);
 await assert.rejects(human(()=>owner.write(save(applyDirectionChoice(current.body,choice())))),/exactly one/);
 await assert.rejects(human(()=>owner.write(save(notes.body))),/exactly one/);const changed=current.body.replace('Synthetic garden.','Rewritten history.');await assert.rejects(agent(()=>owner.write(save(changed))),error=>error.status===403);await assert.rejects(human(()=>owner.write(save(changed))),/exactly one/);
 for(const malformed of [current.body+'\n<!-- ar-create:direction-choices:v1 -->','<!-- /ar-create:direction-choices:v1 -->\n'+current.body]){assert.equal(readDirectionChoices(malformed).available,false);await assert.rejects(agent(()=>owner.write(save(malformed))),error=>error.status===403);await assert.rejects(human(()=>owner.write(save(malformed))),/exactly one/);assert.equal((await owner.read(scope)).body,current.body);}
 const undo={...scope,operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.hash,undoOperationId:event.operationId};await assert.rejects(agent(()=>owner.undo(undo)),error=>error.status===403);const restored=await human(()=>owner.undo(undo));assert.equal(restored.body,notes.body);assert.equal(readDirectionChoices(restored.body).events.length,0);
 current=restored;current=await agent(()=>owner.write(save('Agent notes remain allowed.')));assert.equal(current.body,'Agent notes remain allowed.');
});

test('an existing unchanged malformed managed section survives an unrelated agent notes save',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-direction-malformed-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));const id=randomUUID(),scope={scope:'collection',collectionId:id},owner=createStudyHumanDirection({dataDir,library:{collections:async()=>({collections:[{id,name:'Synthetic legacy inquiry',sourceIds:[]}]})}});
 const empty=await owner.read(scope),saved=await owner.write({...scope,operationId:randomUUID(),expectedRevision:empty.revision,expectedHash:empty.hash,body:'Synthetic legacy notes.'}),{digest}=await import('../runtime/services/files.mjs');
 // Model a pre-existing malformed legacy file, retaining its owned revision.
 const malformed='<!-- ar-create:direction-choices:v1 -->\nLegacy incomplete section';fs.writeFileSync(saved.path,malformed);const metadataPath=saved.path.replace(/\.md$/,'.json'),metadata=JSON.parse(fs.readFileSync(metadataPath,'utf8'));metadata.hash=digest(malformed);fs.writeFileSync(metadataPath,JSON.stringify(metadata,null,2)+'\n');
 const before=await owner.read(scope);assert.equal(before.directionChoices.available,false);const body='An unrelated agent note.\n\n'+before.body,result=await withActor({actor:'agent:codex',client:'http'},()=>owner.write({...scope,operationId:randomUUID(),expectedRevision:before.revision,expectedHash:before.hash,body}));assert.equal(result.body,body);assert.equal((await owner.read(scope)).directionChoices.available,false);
});
