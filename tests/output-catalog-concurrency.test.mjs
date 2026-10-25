import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const source=fs.readFileSync(new URL('../public/document-study/output-connection.js',import.meta.url),'utf8');
function boot(){
 const dom=new JSDOM('<body></body>',{url:'http://127.0.0.1',runScripts:'outside-only'}),w=dom.window;let calls=0,pending=[];
 w.structuredClone=structuredClone;w.current=()=>({id:'synthetic-browser',view:'record',viewedStage:1});w.phaseReader=()=>'';w.render=()=>{};
 w.fetch=async url=>{assert.equal(url,'/api/study-draft/catalog');calls++;return new Promise((resolve,reject)=>pending.push({resolve:body=>resolve({ok:true,json:async()=>body}),reject}));};w.eval(source);
 return {dom,w,get calls(){return calls},release(body={drafts:[]}){const batch=pending;pending=[];for(const p of batch)p.resolve(body);},fail(){const batch=pending;pending=[];for(const p of batch)p.reject(Error('Synthetic offline'));}};
}
test('simultaneous project discovery shares only its in-flight catalog, then rereads fresh metadata',async()=>{
 const f=boot();try{const reads=Array.from({length:12},(_,i)=>f.w.realOutputOverview.read({projectId:'synthetic-'+i}));assert.equal(f.calls,1);f.release();const result=await Promise.all(reads);assert.equal(result.length,12);assert.ok(result.every((r,i)=>r.projectId==='synthetic-'+i&&r.outputs.length===0));
 const next=f.w.realOutputOverview.read({projectId:'synthetic-new'});assert.equal(f.calls,2);f.release();assert.equal((await next).projectId,'synthetic-new');
 }finally{f.dom.window.close();}
});
test('shared catalog failures and malformed replies never poison a later fresh discovery',async()=>{
 const f=boot();try{const pending=['a','b','c'].map(projectId=>f.w.realOutputOverview.read({projectId}));assert.equal(f.calls,1);f.fail();for(const p of pending)await assert.rejects(p,/Synthetic offline/);
 const malformed=f.w.realOutputOverview.read({projectId:'a'});assert.equal(f.calls,2);f.release({drafts:null});await assert.rejects(malformed,/catalog is unavailable/);
 const recovered=f.w.realOutputOverview.read({projectId:'a'});assert.equal(f.calls,3);f.release();assert.equal((await recovered).projectId,'a');
 }finally{f.dom.window.close();}
});
