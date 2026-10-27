import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const script=fs.readFileSync(new URL('../public/document-study/source-continuation.js',import.meta.url),'utf8');
const UNBOUND='Exact ready persisted parent and part bindings required for material context.';
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,0));};
async function fixture(t,{message=UNBOUND,status=409}={}){
 const dom=new JSDOM('<div id="app"><div id="stage-working-lane"></div></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,d=w.document;
 const project={id:'hk',viewedStage:3},bindingId='11111111-1111-4111-8111-111111111111',calls=[];
 let connected=false,dirty=false,gate=()=>{},failure=false,rows=[{parentStudyId:'hk',bindingId,bindingStatus:'ready',title:'Invented part'}];
 Object.defineProperty(w,'crypto',{value:webcrypto});w.current=()=>project;w.render=()=>{};w.studyDraft={currentBinding:()=>({id:bindingId,parentStudyId:'hk'})};w.studyHumanDirection={isDirty:()=>dirty,choosePart:async()=>{},currentProof:()=>({dirty})};
 w.fetch=async(url,options)=>{const u=new URL(url,'http://localhost'),body=options?.body?JSON.parse(options.body):undefined,call={path:u.pathname,body,query:Object.fromEntries(u.searchParams)};calls.push(call);await gate(call);
  let value;if(u.pathname==='/api/study-draft/catalog')value={drafts:rows};
  else if(u.pathname==='/api/study-ai/requests')value={items:[]};
  else if(u.pathname==='/api/study-ai/read'){if(!connected)return {ok:false,status,json:async()=>({error:message})};value={binding:{id:bindingId,parentStudyId:'hk'},sourceCatalog:[{id:'invented-source',title:'Invented source',canPrepare:true,eligible:true,origin:'retained-owned-capture'}],context:{records:[]}};}
  else if(u.pathname==='/api/study/human-direction/select'){if(failure)throw Error('Synthetic connection unavailable');connected=true;value={bound:true,scope:{kind:'part',parentStudyId:'hk',bindingId}};}
  else throw Error('Unexpected route '+u.pathname);
  return {ok:true,json:async()=>value};};
 w.eval(script);await tick();t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});
 return {w,d,project,bindingId,calls,setDirty:value=>dirty=value,setGate:value=>gate=value,setFailure:value=>failure=value,setRows:value=>rows=value};
}
test('unbound context connects only on explicit click through the exact existing owner, then reloads sources',async t=>{
 const f=await fixture(t);assert.equal(f.calls.some(c=>c.body),false);assert.match(f.d.querySelector('.source-continuation [role=alert]').textContent,/Connect source context/);
 for(let i=0;i<2;i++){f.d.querySelector('[data-continuation-refresh]').click();await tick();}assert.equal(f.calls.some(c=>c.body),false);
 f.d.querySelector('[data-continuation-connect]').click();await tick();
 const writes=f.calls.filter(c=>c.body);assert.equal(writes.length,1);assert.equal(writes[0].path,'/api/study/human-direction/select');assert.deepEqual({...writes[0].body,operationId:undefined},{parentStudyId:'hk',bindingId:f.bindingId,scope:'part',title:'Invented part',operationId:undefined});assert.match(writes[0].body.operationId,/^[a-f0-9-]{36}$/);
 assert.equal(f.d.querySelector('[data-continuation-connect]'),null);assert.ok(f.d.querySelector('[data-continuation-source="invented-source"]'));assert.equal(f.project.viewedStage,3);
});
test('ordinary conflicts and foreign context errors never offer connection',async t=>{
 for(const opts of [{message:'Source context belongs to another part.'},{message:UNBOUND,status:400},{message:'Source context changed elsewhere.'}]){const f=await fixture(t,opts);assert.equal(f.d.querySelector('[data-continuation-connect]'),null);assert.equal(f.calls.some(c=>c.body),false);}
});
test('stale project, stale part catalog and dirty direction refuse connection before any write',async t=>{
 for(const scenario of ['project','catalog','dirty','changed-during-check']){const f=await fixture(t),button=f.d.querySelector('[data-continuation-connect]');if(scenario==='project')f.project.id='other';if(scenario==='catalog')f.setRows([]);if(scenario==='dirty')f.setDirty(true);if(scenario==='changed-during-check')f.setGate(c=>{if(c.path==='/api/study-draft/catalog')f.project.id='other';});button.click();await tick();assert.equal(f.calls.some(c=>c.body),false,scenario);}
});
test('failed connection stays recoverable and a deliberate retry uses a fresh operation',async t=>{
 const f=await fixture(t);f.setFailure(true);f.d.querySelector('[data-continuation-connect]').click();await tick();assert.ok(f.d.querySelector('[data-continuation-connect]'));assert.equal(f.d.querySelector('[data-continuation-connect]').disabled,false);assert.equal(f.d.querySelector('[data-continuation-continue]').disabled,true);
 f.setFailure(false);f.d.querySelector('[data-continuation-connect]').click();await tick();const writes=f.calls.filter(c=>c.body);assert.equal(writes.length,2);assert.notEqual(writes[0].body.operationId,writes[1].body.operationId);assert.ok(f.d.querySelector('[data-continuation-source]'));assert.equal(f.d.querySelector('[data-continuation-connect]'),null);
});
