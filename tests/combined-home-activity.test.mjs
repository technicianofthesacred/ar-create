import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/recent-changes.js',import.meta.url),'utf8');
const at='2026-10-30T00:00:00Z',scope={kind:'project',id:'subject-one'};
const question={operationId:'ask-one',ts:at,actor:'agent:claude-code',kind:'ask',status:'needs-decision',scope,to:'human:adrian',summary:'Choose the angle'};
const answer={operationId:'ask-one',ts:'2026-10-30T00:01:00Z',actor:'human:adrian',kind:'handoff',status:'handoff',scope,to:'agent:claude-code'};
const proposal={operationId:'proposal-one',ts:at,actor:'agent:codex',kind:'study-ai.propose',status:'committed',scope};
function boot(){
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,calls=[],p={id:'subject-one',name:'Invented subject',viewedStage:5,view:'article'};let failed=false,live;
 w.current=()=>p;w.state={projects:[p]};w.c3Shell={actorName:a=>a,live:{on:(_scope,callback)=>{live=callback;}}};
 w.fetch=async(url,init)=>{calls.push([url,init]);if(init?.method)throw Error('Home must only read');const u=new URL(url,'http://localhost');if(u.pathname==='/api/study-draft/catalog')return{ok:true,json:async()=>({drafts:[],collections:[]})};if(u.pathname==='/api/presence')return{ok:true,json:async()=>({presence:[]})};if(u.pathname==='/api/leases')return{ok:true,json:async()=>({leases:[]})};const q=u.searchParams;if(q.get('status')==='committed'){if(failed)throw Error('Disconnected');return{ok:true,json:async()=>({lines:[proposal,{...proposal,status:'rejected',operationId:'refused'}]})};}return{ok:true,json:async()=>({lines:q.get('actor')?[answer]:q.get('status')==='needs-decision'?[question]:[]})};};
 w.eval(code);return{w,calls,set failed(v){failed=v;},event:e=>live?.(e),close:()=>w.close()};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test('agent committed activity has its own read snapshot without changing the human answer/ask owner',async()=>{
 const x=boot();try{await x.w.arLive.refresh();const state=x.w.arLive.state();assert.equal(state.committedStatus,'ready');assert.deepEqual(JSON.parse(JSON.stringify(state.committedLines)),[proposal]);assert.deepEqual(JSON.parse(JSON.stringify(state.humanLines)),[answer]);assert.equal(x.w.arLive.waiting().length,0,'the human answer still resolves its exact question');assert.equal(x.w.arLive.label(state.committedLines[0]),'Proposed wording','committed proposal never becomes accepted wording');assert.ok(x.calls.some(([u])=>u==='/api/journal?status=committed&limit=300'));assert.ok(x.calls.every(([,init])=>!init?.method));x.failed=true;await x.w.arLive.refresh();assert.equal(x.w.arLive.state().committedStatus,'unavailable');assert.equal(x.w.arLive.state().humanLines[0].operationId,'ask-one');}finally{x.close();}
});
test('agent committed events refresh the read snapshot while navigation does not write anything',async()=>{
 const x=boot();try{await x.w.arLive.refresh();await settle();const before=x.calls.length;x.event({actor:'agent:codex',kind:'study-ai.propose',status:'committed',scope});await new Promise(resolve=>setTimeout(resolve,280));assert.ok(x.calls.length>before);assert.ok(x.calls.every(([,init])=>!init?.method));}finally{x.close();}
});
