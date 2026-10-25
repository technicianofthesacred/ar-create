import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const script=fs.readFileSync(new URL('../public/document-study/retained-carousel-copy.js',import.meta.url),'utf8');
const clone=v=>JSON.parse(JSON.stringify(v)),tick=()=>new Promise(r=>setTimeout(r,0));
const settle=async()=>{for(let i=0;i<6;i++)await tick();};
const h=n=>n.repeat(64),prefix='ar-create.retained-carousel-copy.v1:';
function fixture(){
 const source={projectId:randomUUID(),documentId:randomUUID(),outputId:randomUUID(),sourceHash:h('a'),outputHash:h('b'),kind:'carousel',title:'Original <b>thirteen</b>',outputRevision:3,createdAt:'2026-10-11T00:00:00Z',slideCount:13};
 const output={id:source.outputId,kind:'carousel',title:source.title,outputRevision:3,slides:Array.from({length:13},(_,i)=>({id:randomUUID(),text:'ORIGINAL_SECRET_BODY '+i}))};
 const row={bindingId:randomUUID(),parentStudyId:'synthetic-parent',title:'Destination <img src=x onerror=bad()>',bindingStatus:'ready'};
 const group={rootBindingId:row.bindingId,parentStudyId:row.parentStudyId},physical={projectId:randomUUID(),documentId:randomUUID()};
 const expectedNative={workflow:{draft:h('c'),edits:null},bindingHash:h('d'),correspondenceHash:h('e')},expectedOutput={revision:7,hash:h('f')};
 const view={scope:group,documentId:row.bindingId,photoScope:physical,expectedOutput,outputs:[{id:randomUUID(),kind:'carousel',slides:Array.from({length:8},(_,i)=>({text:'CURRENT_EIGHT '+i}))}]};
 const native={binding:{id:row.bindingId,parentStudyId:row.parentStudyId,authority:'owned-working-copy',status:'ready'},readiness:{ready:true},expected:expectedNative,raw:'PRIVATE_NATIVE_BODY',paths:{draft:'/private/secret/file'}};
 const capability={readOnly:true,configured:true,available:true,requiresExplicitDestination:true,requiresOriginalValidation:true,items:[source]};
 return {source,output,row,group,physical,expectedNative,expectedOutput,view,native,capability};
}
function boot(f=fixture(),options={}){
 const dom=new JSDOM('<div id="pieces">Pieces unchanged</div><div id="current">Current eight unchanged</div><div id="host"></div>',{runScripts:'outside-only',url:'http://localhost'}),w=dom.window,d=w.document;
 Object.defineProperty(w,'crypto',{value:webcrypto});if(options.storage)for(const[k,v]of Object.entries(options.storage))w.localStorage.setItem(k,v);
 let calls=[],posts=[],current=true,postCount=0;
 const catalog={drafts:[f.row,{...f.row,bindingId:randomUUID(),title:'Not ready',bindingStatus:'pending'},{...f.row,bindingId:randomUUID(),title:'Unopened',bindingId:undefined},{...f.row,bindingId:randomUUID(),title:'Fork',kind:'output-fork'}],collections:[],outputBindings:[]};
 const normalReply=p=>({view:{...clone(f.view),output:{...clone(f.output),id:p.operationId,title:'Original thirteen · working copy',stage:'words',outputRevision:0},wordOwner:{kind:'carousel-words',...f.physical,outputId:p.operationId},outputOrigins:{[p.operationId]:{kind:'retained-original-copy',source:clone(p.source)}}}});
 w.fetch=async(url,init={})=>{
  calls.push({url,init});const parsed=new URL(url,'http://localhost');
  let value;if(url==='/api/capabilities')value={retainedCarouselCopy:clone(f.capability)};
  else if(url==='/api/study-draft/catalog')value=clone(catalog);
  else if(parsed.pathname==='/api/study/outputs')value=clone(f.view);
  else if(parsed.pathname==='/api/study-draft/read')value=clone(f.native);
  else if(url==='/api/study/outputs/copy-retained-carousel'){
   const p=JSON.parse(init.body);posts.push(p);postCount++;
   const result=await options.post?.(p,postCount,normalReply);
   if(result)return result;
   value=normalReply(p);
  }else throw Error('Unexpected route: '+url);
  if(options.read&&init.method!=='POST'){const changed=await options.read(url,value);if(changed!==undefined)value=changed;}
  return {ok:true,status:200,json:async()=>value};
 };
 w.eval(script);const mountOptions={source:f.source,output:f.output,isCurrent:()=>current,onOpen:options.onOpen};let panel=w.retainedCarouselCopy.mount(d.querySelector('#host'),mountOptions);
 const snapshot=()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)];}));
 return {f,w,d,calls,posts,catalog,panel,setCurrent:v=>current=v,snapshot,remount(){panel.dispose();panel=w.retainedCarouselCopy.mount(d.querySelector('#host'),mountOptions);this.panel=panel;return panel;},close:()=>w.close()};
}
function action(b,name){return b.d.querySelector('[data-rcc-action="'+name+'"]');}
async function start(b){await b.panel.ready;action(b,'start').click();await settle();}
async function choose(b,index='0'){const select=b.d.querySelector('[data-rcc-destination]');select.value=index;select.dispatchEvent(new b.w.Event('change',{bubbles:true}));await settle();}
test('disabled or mismatched capability offers no copy controls and reads no catalog or destination',async()=>{
 for(const change of [f=>f.capability.configured=false,f=>f.capability.available=false,f=>f.capability.items[0].sourceHash=h('0'),f=>f.capability.items=[f.source,f.source],f=>f.capability.requiresOriginalValidation=false]){
  const f=fixture();f.capability=clone(f.capability);change(f);const b=boot(f);assert.equal(await b.panel.ready,false);assert.equal(b.d.querySelector('#host').textContent,'');assert.equal(b.calls.length,1);assert.equal(b.posts.length,0);b.close();
 }
});
test('explicit destination selection lists only existing ready roots, including collection roots, and never assumes current owner',async()=>{
 const b=boot();const collection={bindingId:randomUUID(),parentStudyId:'collection-parent',title:'Authored collection',bindingStatus:'ready',kind:'collection-root'};b.catalog.collections.push(collection);
 await b.panel.ready;assert.equal(b.calls.length,1);await start(b);
 assert.equal(b.d.querySelector('[data-rcc-destination]').value,'');assert.equal(b.d.querySelectorAll('option').length,3);assert.equal(action(b,'create'),null);
 assert.equal(b.calls.filter(c=>new URL(c.url,'http://localhost').pathname==='/api/study/outputs').length,0);
 await choose(b,'1');assert.equal(action(b,'create').disabled,true,'foreign owner reply does not enable create');assert.equal(b.posts.length,0);
 assert.equal(b.calls.some(c=>c.init.method==='POST'),false);assert.equal(b.d.querySelector('#host img'),null);assert.doesNotMatch(b.d.querySelector('#host').textContent,/PRIVATE_NATIVE_BODY|private\/secret/);b.close();
});
test('explicit creation posts exact guards/source only, preserves thirteen original and current eight, and requires own words review',async()=>{
 const b=boot(),before=clone(b.f);await start(b);await choose(b);assert.equal(action(b,'create').disabled,false);action(b,'create').click();await settle();
 assert.equal(b.posts.length,1);const p=b.posts[0];assert.deepEqual(Object.keys(p).sort(),['rootBindingId','parentStudyId','destinationProjectId','destinationDocumentId','expectedOutput','expectedNative','operationId','source'].sort());
 assert.deepEqual(p.source,Object.fromEntries(['projectId','documentId','outputId','sourceHash','outputHash'].map(k=>[k,b.f.source[k]])));assert.deepEqual(p.expectedNative,b.f.expectedNative);assert.deepEqual(p.expectedOutput,b.f.expectedOutput);assert.equal(p.destinationProjectId,b.f.physical.projectId);assert.equal(p.destinationDocumentId,b.f.physical.documentId);
 assert.equal(b.calls.filter(c=>c.init.method==='POST').length,1);assert.equal(b.calls.find(c=>c.init.method==='POST').init.signal,undefined);assert.match(b.d.querySelector('#host').textContent,/Working copy created: Original thirteen/);assert.match(b.d.querySelector('#host').textContent,/words need review/);
 assert.deepEqual(b.f,before);assert.equal(b.d.querySelector('#pieces').textContent,'Pieces unchanged');assert.equal(b.d.querySelector('#current').textContent,'Current eight unchanged');
 const stored=JSON.stringify(b.snapshot());assert.doesNotMatch(stored,/ORIGINAL_SECRET_BODY|CURRENT_EIGHT|PRIVATE_NATIVE_BODY|private\/secret/);assert.equal(Object.keys(b.snapshot()).length,1);
 b.remount();await start(b);await choose(b);assert.match(b.d.querySelector('#host').textContent,/Working copy created/);assert.equal(action(b,'create'),null);assert.equal(b.posts.length,1);b.close();
});
test('lost reply survives close and full reload; retry reuses byte-for-byte request and operation UUID',async()=>{
 const f=fixture(),b=boot(f,{post:(_p,n)=>{if(n===1)throw Error('Lost reply');}});await start(b);await choose(b);action(b,'create').click();await settle();assert.ok(action(b,'retry'));const first=clone(b.posts[0]),storage=b.snapshot();assert.equal(JSON.parse(Object.values(storage)[0]).state,'pending');b.close();
 const reopened=boot(f,{storage});await start(reopened);await choose(reopened);assert.ok(action(reopened,'retry'));assert.equal(action(reopened,'create'),null);action(reopened,'retry').click();await settle();assert.deepEqual(reopened.posts,[first]);assert.match(reopened.d.querySelector('#host').textContent,/Working copy created/);reopened.close();
});
test('409 preserves exact request; retry never silently refreshes source or expected owner guards',async()=>{
 const b=boot(undefined,{post:()=>({ok:false,status:409,json:async()=>({error:'/private/path must never be displayed'})})});await start(b);await choose(b);action(b,'create').click();await settle();const first=clone(b.posts[0]);b.f.view.expectedOutput={revision:8,hash:h('1')};b.f.native.expected.bindingHash=h('2');
 assert.ok(action(b,'retry'));assert.match(b.d.querySelector('#host').textContent,/source or destination changed/);assert.doesNotMatch(b.d.querySelector('#host').textContent,/private\/path/);action(b,'retry').click();await settle();assert.deepEqual(b.posts,[first,first]);assert.equal(JSON.parse(Object.values(b.snapshot())[0]).state,'pending');b.close();
});
test('lost reply followed by changed original replays the old exact command after reopening and reports stale source',async()=>{
 const f=fixture(),b=boot(f,{post:()=>{throw Error('Lost reply after commit');}});await start(b);await choose(b);action(b,'create').click();await settle();const first=clone(b.posts[0]),storage=b.snapshot();b.close();
 f.source.sourceHash=h('0');f.source.outputHash=h('1');f.output.slides.push({id:randomUUID(),text:'New source word'});f.source.slideCount=14;
 const c=boot(f,{storage,post:(p,_n,reply)=>{const value=reply(p);value.view.output.slides.pop();value.view.freshness={sourceStale:true};return {ok:true,status:200,json:async()=>value};}});await start(c);await choose(c);assert.ok(action(c,'retry'));assert.equal(action(c,'create'),null);action(c,'retry').click();await settle();assert.deepEqual(c.posts,[first]);assert.match(c.d.querySelector('#host').textContent,/original has changed since this copy/);assert.equal(Object.keys(c.snapshot()).length,1);c.close();
});
test('saved copy opens only after explicit action with exact completed receipt scope; failed open keeps saved copy',async()=>{
 const opened=[],b=boot(undefined,{onOpen:async scope=>{opened.push(clone(scope));if(opened.length===1)throw Error('Unsaved current writing');}});await start(b);await choose(b);action(b,'create').click();await settle();assert.equal(opened.length,0);assert.ok(action(b,'open'));action(b,'open').click();await settle();assert.deepEqual(opened,[{...b.f.group,outputId:b.posts[0].operationId}]);assert.match(b.d.querySelector('#host').textContent,/working copy is saved/);assert.equal(JSON.parse(Object.values(b.snapshot())[0]).state,'complete');action(b,'open').click();await settle();assert.equal(opened.length,2);assert.equal(b.posts.length,1);b.close();
});
test('changed source capability before final action refuses mutation without guessing a new reference',async()=>{
 const b=boot();await start(b);await choose(b);b.f.capability.items[0].sourceHash=h('0');action(b,'create').click();await settle();assert.equal(b.posts.length,0);assert.match(b.d.querySelector('#host').textContent,/original changed/);assert.deepEqual(b.snapshot(),{});b.close();
});
test('wrong output/native owner, child binding and unavailable owner never enable the final write',async()=>{
 for(const change of [f=>f.view.scope.rootBindingId=randomUUID(),f=>f.view.scope.parentStudyId='foreign',f=>f.view.documentId=randomUUID(),f=>f.native.binding.parentStudyId='foreign',f=>f.native.binding.kind='output-fork',f=>f.native.readiness.ready=false,f=>f.native.expected={raw:'PRIVATE_WORDS'}]){
  const f=fixture();change(f);const b=boot(f);await start(b);await choose(b);assert.equal(action(b,'create').disabled,true);assert.equal(b.posts.length,0);assert.doesNotMatch(b.d.querySelector('#host').textContent,/PRIVATE_WORDS/);b.close();
 }
});
test('late reads after dispose/current switch cannot enable controls or issue a write',async()=>{
 let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r),b=boot(undefined,{read:async(url,value)=>{if(url.startsWith('/api/study/outputs?')){entered();await held;}return value;}});await start(b);
 const select=b.d.querySelector('select');select.value='0';select.dispatchEvent(new b.w.Event('change',{bubbles:true}));await started;b.setCurrent(false);release();await settle();assert.equal(b.posts.length,0);b.panel.dispose();assert.equal(b.d.querySelector('.retained-carousel-copy'),null);b.close();
});
test('closing an in-flight write does not abort it or repaint another reader; reopen finds one durable receipt',async()=>{
 let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r),b=boot(undefined,{post:async(p,_n,reply)=>{entered();await held;return {ok:true,status:200,json:async()=>reply(p)};}});await start(b);await choose(b);action(b,'create').click();await started;
 const post=b.calls.find(c=>c.init.method==='POST');assert.equal(post.init.signal,undefined);b.panel.dispose();b.d.querySelector('#host').textContent='Different original reader';release();await settle();assert.equal(b.d.querySelector('#host').textContent,'Different original reader');assert.equal(JSON.parse(Object.values(b.snapshot())[0]).state,'complete');
 b.d.querySelector('#host').textContent='';b.remount();await start(b);await choose(b);assert.match(b.d.querySelector('#host').textContent,/Working copy created/);assert.equal(b.posts.length,1);b.close();
});
test('wrong copy reply is not accepted and retains inspectable pending identity; refused durable storage prevents POST',async()=>{
 const b=boot(undefined,{post:(p,_n,reply)=>{const value=reply(p);value.view.photoScope.projectId=randomUUID();return {ok:true,status:200,json:async()=>value};}});await start(b);await choose(b);action(b,'create').click();await settle();assert.ok(action(b,'retry'));assert.match(b.d.querySelector('#host').textContent,/reply could not be verified/);assert.equal(JSON.parse(Object.values(b.snapshot())[0]).state,'pending');b.close();
 const c=boot();await start(c);await choose(c);c.w.Storage.prototype.setItem=()=>{throw Error('Storage unavailable');};action(c,'create').click();await settle();assert.equal(c.posts.length,0);c.close();
});
test('receipt uses exact source and destination key and exposes no body, executable HTML or public config',async()=>{
 const b=boot(undefined,{post:()=>{throw Error('Lost reply');}});await start(b);await choose(b);action(b,'create').click();await settle();const [key,raw]=Object.entries(b.snapshot())[0],r=JSON.parse(raw);
 assert.equal(key,prefix+JSON.stringify([...['projectId','documentId','outputId','sourceHash','outputHash'].map(k=>b.f.source[k]),b.f.row.bindingId,b.f.row.parentStudyId]));assert.deepEqual(r.request,b.posts[0]);assert.equal(b.d.querySelector('#host script,#host img'),null);assert.doesNotMatch(b.d.querySelector('#host').innerHTML,/PRIVATE_NATIVE_BODY|ORIGINAL_SECRET_BODY|private\/secret/);b.close();
});
