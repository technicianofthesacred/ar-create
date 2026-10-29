import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const clientFile=new URL('../public/document-study/native-draft-catalog.js',import.meta.url);
const consumers=['recent-changes','output-connection','project-library','retained-carousel-copy','browser-carousel-copy','human-direction','workbench-pieces','photos-stage','research-standard','draft-check-flow','draft-flow','source-continuation'];
const valid=()=>({drafts:[{originalId:'one',bindingId:'binding-one',parentStudyId:'project-one',bindingStatus:'ready',title:'Saved manuscript'}],collections:[],outputBindings:[]});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function boot(fetch){const dom=new JSDOM('',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;w.structuredClone=structuredClone;w.fetch=fetch;w.eval(fs.readFileSync(clientFile,'utf8'));return {dom,owner:w.nativeDraftCatalog};}
const plain=value=>JSON.parse(JSON.stringify(value));

test('all twelve catalogue consumers use the page owner, installed before consumers',()=>{
 const html=fs.readFileSync(new URL('../public/document-study/index.html',import.meta.url),'utf8'),clientAt=html.indexOf('src="native-draft-catalog.js"');
 assert.ok(clientAt>=0,'Shared discovery owner is mounted');
 for(const name of consumers){const source=fs.readFileSync(new URL('../public/document-study/'+name+'.js',import.meta.url),'utf8');assert.match(source,/nativeDraftCatalog/,name+' joins shared discovery');assert.ok(clientAt<html.indexOf('src="'+name+'.js"'),name+' mounts after discovery owner');}
});

test('concurrent and staggered twelve-consumer discovery makes one fetch and returns detached data',async()=>{
 const gate=deferred(),calls=[],f=boot(async(url,options)=>{calls.push({url,options});await gate.promise;return {ok:true,json:async()=>valid()};});
 try{
  const reads=consumers.map(()=>f.owner.read());assert.equal(calls.length,1);gate.resolve();const result=await Promise.all(reads);
  result[0].drafts[0].title='Caller-local change';assert.equal(result[1].drafts[0].title,'Saved manuscript');
  for(const name of consumers)assert.equal((await f.owner.read()).drafts[0].title,'Saved manuscript',name);
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/study-draft/catalog');assert.equal(f.dom.window.localStorage.length,0);assert.equal(f.dom.window.document.documentElement.dataset.nativeCatalogDiscoveryReads,'1');assert.equal(f.dom.window.document.documentElement.dataset.nativeCatalogFreshReads,'0');
 }finally{f.dom.window.close();}
});

test('failed and malformed replies never become a cached substitute and remain retryable',async()=>{
 let calls=0;const f=boot(async()=>{calls++;return calls===1?{ok:false,status:503,json:async()=>({error:'private diagnostic'})}:{ok:true,json:async()=>calls===2?{drafts:[{},{}]}:valid()};});
 try{await assert.rejects(f.owner.read(),/unavailable/);await assert.rejects(f.owner.read(),/verified/);assert.deepEqual(plain(await f.owner.read()),valid());assert.equal(calls,3);}finally{f.dom.window.close();}
});

test('successful registration invalidates discovery, ordinary reads do not, and fresh guards reread',async()=>{
 let calls=0;const f=boot(async()=>({ok:true,json:async()=>({...valid(),sequence:++calls})}));
 try{
  assert.equal((await f.owner.read()).sequence,1);assert.equal(f.owner.mutationSucceeded('/api/study/photos/select'),false);assert.equal((await f.owner.read()).sequence,1);
  assert.equal(f.owner.mutationSucceeded('/api/study-draft/create-collection'),true);assert.equal((await f.owner.read()).sequence,2);
  assert.equal((await f.owner.read({fresh:true})).sequence,3);assert.equal((await f.owner.read()).sequence,3);
  f.owner.invalidate();assert.equal((await f.owner.read()).sequence,4);
 }finally{f.dom.window.close();}
});

test('invalidation refuses a late pre-mutation catalogue and cannot replace the new snapshot',async()=>{
 const old=deferred();let calls=0;const f=boot(async()=>{const n=++calls;if(n===1)await old.promise;return {ok:true,json:async()=>({...valid(),sequence:n})};});
 try{const earlier=f.owner.read(),held=assert.rejects(earlier,/changed/);f.owner.invalidate();assert.equal((await f.owner.read()).sequence,2);old.resolve();await held;assert.equal((await f.owner.read()).sequence,2);assert.equal(calls,2);}finally{f.dom.window.close();}
});

test('fresh operation checks coalesce together and an earlier discovery cannot replace their snapshot',async()=>{const old=deferred();let calls=0;const f=boot(async()=>{const n=++calls;if(n===1)await old.promise;return {ok:true,json:async()=>({...valid(),sequence:n})};});try{const discovery=f.owner.read(),first=f.owner.read({fresh:true}),second=f.owner.read({fresh:true});assert.equal((await first).sequence,2);assert.equal((await second).sequence,2);old.resolve();assert.equal((await discovery).sequence,1);assert.equal((await f.owner.read()).sequence,2);assert.equal(calls,2);assert.equal(f.dom.window.document.documentElement.dataset.nativeCatalogDiscoveryReads,'1');assert.equal(f.dom.window.document.documentElement.dataset.nativeCatalogFreshReads,'1');}finally{f.dom.window.close();}});
