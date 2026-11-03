import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {loadConfig} from '../config.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
const repo=path.resolve(import.meta.dirname,'..');
function fixture(t){
 // Stop any server started on this home before removing it: removing first raced a server still writing (ENOTEMPTY in CI), and the throw left the server running so the file never ended.
 const f=syntheticHome(),stops=[];t.after(async()=>{for(const stop of stops)await stop();fs.rmSync(f.dir,{recursive:true,force:true});});const host=JSON.parse(fs.readFileSync(f.config,'utf8'));
 const output={id:randomUUID(),kind:'carousel',title:'Synthetic retained thirteen',caption:'Synthetic caption.',stage:'look',wordsReview:{hash:'a'.repeat(64),reviewedAt:'2026-10-11T00:00:00Z'},outputRevision:2,createdAt:'2026-10-11T00:00:00Z',slides:Array.from({length:13},(_,i)=>({id:randomUUID(),role:i?'inner':'cover',text:'SYNTHETIC_BODY_ONLY '+i,credit:'Synthetic credit',label:'Synthetic label',template:'M12',photos:[],paragraphIds:[]}))};
 const unselected={...structuredClone(output),id:randomUUID(),title:'UNSELECTED_TITLE_ONLY'},state={revision:3,project:{id:randomUUID(),document:{schema:'ar-create.document.v1',id:randomUUID(),revision:1,outputs:[output,unselected]}}},sourceFile=path.join(f.dir,'retained-original.json');fs.writeFileSync(sourceFile,JSON.stringify(state));
 const descriptor={path:sourceFile,projectId:state.project.id,documentId:state.project.document.id,outputIds:[output.id]};
 const save=()=>fs.writeFileSync(f.config,JSON.stringify(host));return {...f,host,output,unselected,state,sourceFile,descriptor,save,stops};
}
async function start(t,f){
 const reservation=http.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));assert.notEqual(port,8841);f.host.port=port;f.save();
 const child=spawn(process.execPath,[path.join(repo,'serve.mjs'),'--config',f.config],{cwd:repo,env:{PATH:process.env.PATH,HOME:process.env.HOME},stdio:['ignore','pipe','pipe']});let log='',errors='';child.stdout.on('data',chunk=>log+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
 f.stops.push(async()=>{if(child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');await once(child,'exit');});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Synthetic host startup timed out: '+errors)),8000);const observe=()=>{if(log.includes('AR Create:')){clearTimeout(timeout);child.stdout.off('data',observe);resolve();}};child.stdout.on('data',observe);child.once('exit',code=>{clearTimeout(timeout);reject(Error('Synthetic host exited '+code+': '+errors));});observe();});
 const base='http://127.0.0.1:'+port,get=async route=>{const response=await fetch(base+route),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;},post=async(route,body)=>{const response=await fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};return {base,get,post};
}
test('host descriptor is explicit/default off, rejects malformed IDs/fields/paths and never creates or imports a source',t=>{
 const f=fixture(t),env={AR_CREATE_CONFIG:f.config,AR_CREATE_ALLOW_SCRATCH_ROOTS:'1'};assert.equal(loadConfig(env).retainedCarouselState,null);assert.equal(loadConfig({...env,AR_CREATE_RETAINED_CAROUSEL_STATE:f.sourceFile}).retainedCarouselState,null);
 f.host.retainedCarouselState=null;f.save();assert.equal(loadConfig(env).retainedCarouselState,null);
 for(const value of [{...f.descriptor,path:'relative.json'},{...f.descriptor,outputIds:['guessed']},{...f.descriptor,outputIds:[f.output.id,f.output.id]},{...f.descriptor,unexpected:true},{...f.descriptor,path:path.join(repo,'never-create-retained-private.json')}]){f.host.retainedCarouselState=value;f.save();assert.throws(()=>loadConfig(env));}
 const symlink=path.join(f.dir,'linked-original.json');fs.symlinkSync(f.sourceFile,symlink);f.host.retainedCarouselState={...f.descriptor,path:symlink};f.save();assert.throws(()=>loadConfig(env),/symlink/);
 const missing=path.join(f.dir,'missing-original.json');f.host.retainedCarouselState={...f.descriptor,path:missing};f.save();assert.deepEqual(loadConfig(env).retainedCarouselState,f.host.retainedCarouselState);assert.equal(fs.existsSync(missing),false);
});
test('real default host advertises unavailable metadata and leaves copy disabled',async t=>{
 const f=fixture(t),s=await start(t,f),value=(await s.get('/api/capabilities')).retainedCarouselCopy;assert.deepEqual(value,{readOnly:true,configured:false,available:false,requiresExplicitDestination:true,requiresOriginalValidation:true,items:[]});assert.ok(!JSON.stringify(value).includes(f.sourceFile));
 const response=await fetch(s.base+'/api/study/outputs/copy-retained-carousel',{method:'POST',headers:{Origin:s.base,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,503);
});
test('real configured host exposes only allowed source metadata and copies thirteen only after explicit existing destination proofs',async t=>{
 const f=fixture(t);f.host.retainedCarouselState={...f.descriptor,readOnlyOutputIds:[f.unselected.id]};f.save();const sourceBytes=fs.readFileSync(f.sourceFile),s=await start(t,f),before=await s.get('/api/study-draft/catalog');
 const available=(await s.get('/api/capabilities')).retainedCarouselCopy;assert.equal(available.readOnly,true);assert.equal(available.configured,true);assert.equal(available.available,true);assert.equal(available.requiresExplicitDestination,true);assert.equal(available.requiresOriginalValidation,true);assert.equal(available.items.length,1);assert.equal(available.items[0].outputId,f.output.id);assert.equal(available.items[0].slideCount,13);
 const metadata=JSON.stringify(available);for(const secret of [f.sourceFile,'SYNTHETIC_BODY_ONLY','UNSELECTED_TITLE_ONLY',f.unselected.id])assert.ok(!metadata.includes(secret));assert.deepEqual(await s.get('/api/study-draft/catalog'),before,'availability does not create/select a destination');
 // Fixture setup explicitly establishes a destination. The future copy UI must
 // instead let the person choose an already-ready owned root, never run setup.
 const originalHash=createHash('sha256').update(fs.readFileSync(path.join(f.vault,f.host.studyOriginalRoots.catalog.drafts['hk-article'].path))).digest('hex');
 const root=await s.post('/api/study-draft/open',{originalId:'hk-article',originalHash,parentStudyId:'hk',operationId:randomUUID()});
 await s.post('/api/first-flow/select',{projectKey:'hk',title:'Synthetic chosen parent',operationId:randomUUID()});await s.post('/api/study/photos/select',{bindingId:root.binding.id,parentStudyId:'hk',operationId:randomUUID()});
 const selected={rootBindingId:root.binding.id,parentStudyId:'hk'},proof=await s.get('/api/study/outputs?'+new URLSearchParams(selected)),native=await s.get('/api/study-draft/read?'+new URLSearchParams({bindingId:selected.rootBindingId,parentStudyId:selected.parentStudyId}));assert.equal(native.binding.id,selected.rootBindingId);
 const item=available.items[0],source=Object.fromEntries(['projectId','documentId','outputId','sourceHash','outputHash'].map(key=>[key,item[key]]));
 const copy=await s.post('/api/study/outputs/copy-retained-carousel',{...selected,destinationProjectId:proof.photoScope.projectId,destinationDocumentId:proof.photoScope.documentId,expectedNative:native.expected,expectedOutput:proof.expectedOutput,operationId:randomUUID(),source});assert.equal(copy.view.output.slides.length,13);assert.equal(copy.view.output.stage,'words');assert.equal(copy.view.output.wordsReview,undefined);assert.deepEqual(copy.view.output.slides.map(slide=>slide.text),f.output.slides.map(slide=>slide.text));assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBytes);
 fs.writeFileSync(f.sourceFile,'{malformed synthetic source');const malformed=(await s.get('/api/capabilities')).retainedCarouselCopy;assert.equal(malformed.configured,true);assert.equal(malformed.available,false);assert.deepEqual(malformed.items,[]);assert.ok(malformed.error);assert.ok(!malformed.error.includes(f.sourceFile));
 fs.unlinkSync(f.sourceFile);const missing=(await s.get('/api/capabilities')).retainedCarouselCopy;assert.equal(missing.configured,true);assert.equal(missing.available,false);assert.ok(missing.error);assert.ok(!JSON.stringify(missing).includes(f.dir));assert.ok((await s.get('/api/capabilities')).commands.some(command=>command.route==='/api/study/outputs/copy-retained-carousel'));
});

test('host preserves the separate explicit read-only allowlist and refuses invalid boundaries',t=>{
 const f=fixture(t),env={AR_CREATE_CONFIG:f.config,AR_CREATE_ALLOW_SCRATCH_ROOTS:'1'};
 f.host.retainedCarouselState={...f.descriptor,readOnlyOutputIds:[f.unselected.id]};f.save();assert.deepEqual(loadConfig(env).retainedCarouselState,f.host.retainedCarouselState);
 for(const readOnlyOutputIds of [null,'all',['guessed'],[f.unselected.id,f.unselected.id],[f.output.id]]){f.host.retainedCarouselState={...f.descriptor,readOnlyOutputIds};f.save();assert.throws(()=>loadConfig(env));}
});
