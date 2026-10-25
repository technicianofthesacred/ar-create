import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sourceTranslationFixture} from './helpers/kept-source-translation-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function candidatePort(){const reservation=net.createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));assert.notEqual(port,8841);return port;}
function entrypoint(dir,name){const file=path.join(dir,name);fs.writeFileSync(file,'// Invented disabled legacy entrypoint; no executable writer.\n');return {file,sha256:sha(fs.readFileSync(file))};}
function sourceBytes(dir){const result={};function visit(at){for(const entry of fs.readdirSync(at,{withFileTypes:true})){const file=path.join(at,entry.name);if(entry.isDirectory())visit(file);else if(/\.(txt|md)$/i.test(entry.name))result[path.relative(dir,file)]=sha(fs.readFileSync(file));}}visit(dir);assert.ok(Object.keys(result).length,'fixture contains real invented source bytes');return result;}
async function normalHost(t,configFile){
 // Use the ordinary entrypoint and its normal config/factory, never an injected owner.
 // Only this exact spawned child can be stopped by this helper.
 const child=spawn(process.execPath,[path.join(root,'serve.mjs'),'--config',configFile,'--allow-scratch-roots'],{cwd:root,env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});
 let output='',exited=false;child.once('exit',()=>{exited=true;});
 child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
 let stopped=false;
 async function stop(){if(stopped||exited||!child.pid)return;stopped=true;await new Promise(resolve=>{const killTimer=setTimeout(()=>{if(!exited)child.kill('SIGKILL');},3000);child.once('exit',()=>{clearTimeout(killTimer);resolve();});child.kill('SIGTERM');});}
 t.after(stop);
 try{await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(Error('Normal synthetic host startup timed out: '+output));},10000);
  const onData=()=>{if(output.includes('AR Create: http://127.0.0.1:')){cleanup();resolve();}};
  const onExit=()=>{cleanup();reject(Error('Normal synthetic host exited before readiness: '+output));};
  const onError=error=>{cleanup();reject(error);};
  function cleanup(){clearTimeout(timer);child.stdout.off('data',onData);child.off('exit',onExit);child.off('error',onError);}
  child.stdout.on('data',onData);child.once('exit',onExit);child.once('error',onError);onData();
 });}catch(error){await stop();throw error;}
 return {stop,pid:child.pid};
}

for(const enabled of [false,true])test('normal serve/config/imported-owner startup: '+(enabled?'explicit synthetic grant prepares English proposals without changing sources':'generation defaults off while kept sources remain readable'),async t=>{
 const fixture=await sourceTranslationFixture(t,{enabled:false}),seed=await fixture.read();
 // Fully retire the seeding HTTP writer before starting the normal host factory.
 await fixture.stop();
 const ownerDir=path.join(fixture.root,'owner'),notesFile=path.join(fixture.root,'notes.json'),handoverFile=path.join(fixture.root,'handover.json');
 fs.writeFileSync(notesFile,JSON.stringify({records:{}}));
 const start=entrypoint(fixture.root,'disabled-start.mjs'),other=[entrypoint(fixture.root,'disabled-api.mjs'),entrypoint(fixture.root,'disabled-worker.mjs')];
 fs.writeFileSync(handoverFile,JSON.stringify({schema:'ar-create.source-owner-handover.v1',state:'legacy-disabled',dataDir:ownerDir,disabledStartFile:start.file,disabledStartSha256:start.sha256,disabledEntrypoints:other,legacyPort:8927}));
 const port=await candidatePort(),url='http://127.0.0.1:'+port,configFile=path.join(fixture.root,'normal-host.json');
 const owner={dataDir:ownerDir,notesFile,handoverFile,connections:[],...(enabled?{translation:{codexPath:path.join(fixture.root,'fake-account'),timeoutMs:10000,keptConversations:{enabled:true,shareEntireContext:true,sourceIds:[seed.sessions[0].sourceId]}}}:{})};
 fs.writeFileSync(configFile,JSON.stringify({dataDir:path.join(fixture.root,'normal-app'),port,allowScratchRoots:true,importedTranscriptOwner:owner}));
 const savedBytes=sourceBytes(ownerDir),host=await normalHost(t,configFile);
 assert.ok(Number.isInteger(host.pid));
 async function request(route,body){const response=await fetch(url+route,body?{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
 try{
  const before=await request('/api/source-sessions');assert.deepEqual(before.sessions,seed.sessions);assert.equal(before.revision,seed.revision);assert.equal(before.notesState,'available','verified normal owner loads the configured synthetic notes');
  const session=before.sessions[0],result=await request('/api/source-sessions/translation-proposals',{sessionId:session.id,expectedRevision:before.revision,expectedSourceHash:session.sourceHash});
  assert.equal(result.applied,false);
  if(enabled){
   assert.equal(result.state,'proposal-ready');assert.deepEqual(result.proposals.map(p=>p.turnId),['gap','gap2']);assert.equal(result.proposals[0].text,'The invented garden is quiet.');assert.equal(result.proposals[1].text,'The invented river is nearby.');
   const calls=fs.readFileSync(fixture.log,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.equal(calls.length,1,'only the fake local executable ran');assert.equal(calls[0].segments.length,2);
  }else{
   assert.equal(result.state,'unavailable');assert.deepEqual(result.proposals,[]);assert.equal(fs.existsSync(fixture.log),false,'default-off host never invokes even the fake executable');
  }
  assert.deepEqual(await request('/api/source-sessions'),before,'proposal generation cannot edit source sessions or revision');
  assert.deepEqual(sourceBytes(ownerDir),savedBytes,'saved invented source bytes remain exact');
 }finally{await host.stop();}
});
