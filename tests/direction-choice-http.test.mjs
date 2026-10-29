import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {digest} from '../runtime/services/files.mjs';
import {applyDirectionChoice,readDirectionChoices,stripDirectionChoices} from '../public/lib/direction-choice.js';

test('real human-direction HTTP choices survive restart with actor, hash, history and original-file guards',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-direction-choice-http-'))),dataDir=path.join(dir,'data'),vault=path.join(dir,'vault'),files=path.join(dir,'files');fs.mkdirSync(vault);fs.mkdirSync(files);
 const original=path.join(vault,'Synthetic original.md'),originalBody='# Invented original\n\nExact synthetic uncertainty.\n',prepared=path.join(files,'Synthetic prepared directions.md'),preparedBody='## Pick a direction\n\n**1. Synthetic garden.** An invented explanation.\n\n## Pick a title\n1. **Synthetic title**\n';fs.writeFileSync(original,originalBody);fs.writeFileSync(prepared,preparedBody);
 let server,base;const options={dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:{vaultRoot:vault,filesRoot:files},sharedArticles:true,researchEnabled:false};
 async function start(){server=await createServer(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 async function stop(){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server=null;}
 t.after(async()=>{if(server)await stop();fs.rmSync(dir,{recursive:true,force:true});});await start();
 const mutations=[];
 async function request(route,input,{status=200,actor='human:adrian'}={}){if(input!==undefined)mutations.push(route);const response=await fetch(base+route,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'http'},body:JSON.stringify(input)}),value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
 const parentStudyId='synthetic-choice-http-'+randomUUID(),created=await request('/api/concepts',{parentStudyId,title:'Synthetic direction inquiry',operationId:randomUUID()}),scope={parentStudyId,scope:'project'},readRoute='/api/study/human-direction?'+new URLSearchParams(scope),notes='# Exact synthetic human notes\n\nPreserve this wording.\n保留疑问。\n';
 let current=await request(readRoute);current=await request('/api/study/human-direction/write',{...scope,operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.hash,body:notes});
 const baseline=current,source={artifactId:'synthetic-prepared-directions',hash:digest(preparedBody)},events=[];
 const inputFor=(event,record=current)=>({...scope,operationId:event.operationId,expectedRevision:record.revision,expectedHash:record.hash,body:applyDirectionChoice(record.body,event)});
 const event=(kind,action,reason='')=>({operationId:randomUUID(),kind,action,optionId:kind+':1',text:kind==='angle'?'Synthetic garden.':'Synthetic title',reason,source});
 const first=event('angle','use'),firstInput=inputFor(first);await request('/api/study/human-direction/write',firstInput,{status:403,actor:'agent:codex'});assert.equal((await request(readRoute)).hash,baseline.hash);
 current=await request('/api/study/human-direction/write',firstInput);events.push(first);assert.equal(current.hash,digest(current.body));
 const title=event('title','use');current=await request('/api/study/human-direction/write',inputFor(title));events.push(title);
 const stale=event('angle','reject','An invented stale reason.');await request('/api/study/human-direction/write',{...inputFor(stale),expectedHash:baseline.hash},{status:409});assert.equal((await request(readRoute)).hash,current.hash);
 const rejection=event('angle','reject','I prefer a different invented emphasis.');current=await request('/api/study/human-direction/write',inputFor(rejection));events.push(rejection);
 const beforeRestart=await request(readRoute),savedBytes=fs.readFileSync(beforeRestart.path,'utf8');assert.equal(savedBytes,current.body);assert.equal(stripDirectionChoices(savedBytes),notes);assert.deepEqual(readDirectionChoices(savedBytes).events,events);
 await stop();await start();
 const reopened=await request(readRoute);assert.equal(reopened.body,savedBytes);assert.equal(reopened.hash,beforeRestart.hash);assert.equal(reopened.revision,beforeRestart.revision);assert.deepEqual(reopened.scope,beforeRestart.scope);assert.equal(reopened.scope.parentStudyId,created.parentStudyId);assert.deepEqual(reopened.directionChoices.events,events);assert.equal(reopened.directionChoices.selectedAngle,null);assert.equal(reopened.directionChoices.selectedTitle.text,'Synthetic title');assert.equal(reopened.directionChoices.rejections[0].reason,rejection.reason);
 const committed=reopened.history.filter(row=>row.status==='committed'&&events.some(e=>e.operationId===row.operationId));assert.equal(committed.length,3);assert.ok(committed.every(row=>row.actor==='human:adrian'&&row.kind==='write'));assert.ok(reopened.history.some(row=>row.status==='rejected'&&row.operationId===stale.operationId));
 assert.equal(fs.readFileSync(original,'utf8'),originalBody);assert.equal(fs.readFileSync(prepared,'utf8'),preparedBody);assert.deepEqual(fs.readdirSync(vault),['Synthetic original.md']);assert.deepEqual(fs.readdirSync(files),['Synthetic prepared directions.md']);assert.ok(mutations.every(route=>['/api/concepts','/api/study/human-direction/write'].includes(route)));
});
