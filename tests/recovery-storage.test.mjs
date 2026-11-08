import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomBytes} from 'node:crypto';
const source=fs.readFileSync(new URL('../public/document-study/recovery-storage.js',import.meta.url),'utf8');
function codec(globals={}){const context={window:{},...globals};vm.runInNewContext(source,context);return context.window.arRecoveryStorage;}
function store(limit,initial=[]){const values=new Map(initial);return {values,getItem:key=>values.get(key)??null,setItem(key,value){if([...values].reduce((n,[k,v])=>n+(k===key?0:v.length),0)+value.length>limit)throw Error('quota');values.set(key,value);}};}
test('compact quota fallback round-trips exact nested Unicode, histories and pending operation identities',()=>{
 const c=codec(),history=Array.from({length:200},(_,i)=>({words:'Invented prose 漢字 😀 <br>\u0000 \ud800 '.repeat(30),operationId:'original-operation-'+i})),value={projects:{one:{history}},documents:{one:{history,blocks:history.map(h=>({html:h.words})),pending:{operationId:'original-pending',expected:{revision:19,hash:'exact-base'}}}}},raw=JSON.stringify(value),s=store(raw.length/3,[['older','earlier exact words']]);
 c.write(s,'new',raw);assert.ok(s.getItem('new').length<raw.length/3);assert.equal(JSON.stringify(c.parse(s.getItem('new'))),raw);assert.equal(s.getItem('older'),'earlier exact words');
});
test('ordinary snapshots retain plain compatibility; compact records read after a fresh codec instance',()=>{
 const raw=JSON.stringify({words:'invented '.repeat(3000)}),s=store(raw.length);codec().write(s,'plain',raw);assert.equal(s.getItem('plain'),raw);
 const compact=store(2000);codec().write(compact,'packed',raw);assert.equal(JSON.stringify(codec().parse(compact.getItem('packed'))),raw);
});
test('a full or incompressible store retains all previous bytes and reports failure',()=>{
 const raw=JSON.stringify({words:randomBytes(10000).toString('base64')}),s=store(32,[['old','keep exact']]);assert.throws(()=>codec().write(s,'new',raw));assert.deepEqual([...s.values],[['old','keep exact']]);
});
test('truncated, oversized or invalid compact references never become empty replacement words',()=>{
 const c=codec(),format='ar-create.recovery-packed.v1';for(const v of [{format,length:8,parts:[[1,8]]},{format,length:8,parts:['short']},{format,length:1e12,parts:[]},{format,length:8,parts:[['x',8]]},{format,length:2,parts:['{}extra']}])assert.throws(()=>c.parse(JSON.stringify(v)));
});
test('the actual study cache loader and saver retain complete packed project state',()=>{
 const study=fs.readFileSync(new URL('../public/document-study/study.js',import.meta.url),'utf8'),key='ar-create-packaged-document-study-v1',value={project:'invented',variant:'visible',projects:[{id:'invented',blocks:[{html:'Existing exact 漢字 words'}],history:Array.from({length:120},()=>({words:'Earlier invented words '.repeat(100)}))}]},raw=JSON.stringify(value),storage=store(raw.length/3);
 codec().write(storage,key,raw);
 const context={window:{},localStorage:storage,document:{getElementById:()=>({})},AR_CREATE_SYNTHETIC_PROJECTS:[]};
 vm.runInNewContext(source,context);vm.runInNewContext(study.slice(0,study.indexOf('function toast('))+';window.testState=state;window.testSave=save;',context);
 assert.equal(JSON.stringify(context.window.testState),raw);
 context.window.testState.projects[0].blocks[0].html='New exact words with retained history';context.window.testSave();
 assert.equal(JSON.stringify(codec().parse(storage.getItem(key))),JSON.stringify(context.window.testState));
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.testState.projects[0].history)),value.projects[0].history);
});

test('plain legacy whitespace is retained byte-for-byte rather than normalized',()=>{
 const raw=' { "words" : "exact retained words" } \n',s=store(1000);codec().write(s,'legacy-copy',raw);assert.equal(s.getItem('legacy-copy'),raw);assert.equal(codec().parse(raw).words,'exact retained words');
});
test('long-range repeated snapshots fit two new writers beside the retained near-full baseline',()=>{
 // Shape/size-only fixture: no real manuscript, path, source or browser bytes.
 const random=seed=>{let x=seed;return n=>{let out='';for(let i=0;i<n;i++){x=(Math.imul(x,1664525)+1013904223)>>>0;out+=String.fromCharCode(33+x%90);}return out;};},make=random(71),a=make(24000),b=make(24000);
 const sized=(value,size)=>{const prefix=JSON.stringify({...value,padding:''});assert.ok(prefix.length<=size);return JSON.stringify({...value,padding:' '.repeat(size-prefix.length)});};
 const repeated={base:Array.from({length:6},(_,i)=>({id:'invented-'+i,html:a,context:b})),blocks:Array.from({length:3},(_,i)=>({id:'invented-'+i,html:a})),context:{records:[{raw:b},{raw:a},{raw:b}]},pending:{request:{operationId:'exact-invented-request',expected:{revision:9}}},history:[{blocks:[{html:a},{html:b}]}]};
 const raw=sized({projects:{invented:{active:'doc',browser:null}},documents:{doc:{binding:{id:'doc',parentStudyId:'invented'},expected:{revision:9},...repeated}}},725157),ui=sized({project:'invented',projects:[{blocks:[{html:a},{html:b},{html:a}],history:[{words:b},{words:a}]}]},194731),values=new Map();
 for(const [i,size]of [1451059,1450962,725157,725157].entries())values.set('retained-foreign-'+i,sized({projects:{foreign:{active:'f',browser:null}},documents:{f:{binding:{id:'f',parentStudyId:'foreign'},base:[{id:'p',words:'Foreign invented words '+i}],blocks:[{id:'p',html:'Foreign invented words '+i}],expected:{revision:i},history:[],pending:{request:{operationId:'foreign-'+i}}}}},size));
 const packedStore=store(100000);codec().write(packedStore,'old',raw);const previous=packedStore.getItem('old');values.set('previous-own-snapshot',previous+' '.repeat(424392-previous.length));values.set('other-prototype-cache',' '.repeat(197034));values.set('legacy-mirror',sized({words:'Legacy invented words'},27426));for(let i=0;i<16;i++)values.set('retained-empty-'+i,' '.repeat(595));
 values.set('browser-cache',ui);values.set('other-origin-metadata',' '.repeat(5240555-[...values.values()].reduce((n,v)=>n+v.length,0)));assert.equal(values.size,25);
 const before=new Map(values),limit=5242880,s={getItem:k=>values.get(k)??null,setItem(k,v){const total=[...values].reduce((n,[key,value])=>n+(key===k?0:value.length),0)+v.length;if(total>limit)throw Error('quota');values.set(k,v);}};
 const c=codec();c.write(s,'browser-cache',ui);c.write(s,'new-writer-a',raw);c.write(s,'new-writer-b',raw);
 for(const [k,v]of before)if(k!=='browser-cache')assert.equal(values.get(k),v,'Older retained key must remain byte exact');
 assert.equal(JSON.stringify(c.parse(values.get('new-writer-a'))),raw);assert.equal(JSON.stringify(c.parse(values.get('new-writer-b'))),raw);assert.equal(JSON.stringify(c.parse(values.get('browser-cache'))),ui);
 console.log(JSON.stringify({syntheticOnly:true,baselineCharacters:5240555,quotaCharacters:limit,newWriterCharacters:values.get('new-writer-a').length,cacheCharacters:values.get('browser-cache').length,totalCharacters:[...values.values()].reduce((n,v)=>n+v.length,0)}));
});
test('legacy many-part snapshots decode in bounded CPU without quadratic string churn',()=>{
 const length=725157,prefix='{"words":"x',suffix='"}',parts=[prefix];let remaining=length-prefix.length-suffix.length;while(remaining>=16){parts.push([1,16]);remaining-=16;}if(remaining)parts.push('x'.repeat(remaining));parts.push(suffix);
 const encoded=JSON.stringify({format:'ar-create.recovery-packed.v1',length,parts}),before=process.cpuUsage(),value=codec().parse(encoded),used=process.cpuUsage(before),cpuMicroseconds=used.user+used.system;
 assert.equal(value.words.length,length-12);assert.ok(cpuMicroseconds<2000000,'Legacy recovery decode exceeded the 2 CPU-second budget: '+cpuMicroseconds);console.log(JSON.stringify({legacyParts:parts.length,decodedCharacters:length,cpuMicroseconds}));
});

test('the dictionary evicts at its hard total cap for large incompressible snapshots',()=>{
 let maximum=0,inserts=0;class TrackedMap extends Map{set(k,v){super.set(k,v);inserts++;maximum=Math.max(maximum,this.size);return this;}}
 const raw=JSON.stringify({inventedIncompressible:randomBytes(400000).toString('base64')}),s=store(raw.length*2),before=process.cpuUsage();codec({Map:TrackedMap}).write(s,'own',raw);const cpu=process.cpuUsage(before);
 assert.ok(inserts>262144,'The eviction boundary must be exercised');assert.ok(maximum<=262144,'Distinct dictionary keys must remain bounded');assert.equal(JSON.stringify(codec().parse(s.getItem('own'))),raw);console.log(JSON.stringify({dictionaryMaximum:maximum,inserts,cpuMicroseconds:cpu.user+cpu.system}));
});

test('malformed plain or packed main cache is never replaced by startup or ordinary saves',()=>{
 const study=fs.readFileSync(new URL('../public/document-study/study.js',import.meta.url),'utf8'),key='ar-create-packaged-document-study-v1';
 for(const raw of ['{bad retained exact bytes',JSON.stringify({format:'ar-create.recovery-packed.v1',length:8,parts:[[1,8]]}),JSON.stringify({projects:[],project:'missing'})]){
  const storage=store(10000,[[key,raw]]),context={window:{},localStorage:storage,document:{getElementById:()=>({})},AR_CREATE_SYNTHETIC_PROJECTS:[{id:'invented',blocks:[],history:[]}]};
  vm.runInNewContext(source,context);vm.runInNewContext(study.slice(0,study.indexOf('function toast('))+';window.testSave=save;',context);assert.equal(storage.getItem(key),raw);assert.throws(()=>context.window.testSave(),/exact bytes are retained/);assert.equal(storage.getItem(key),raw);
 }
});

test('startup compaction refuses a cache changed by another tab during encoding',()=>{
 const study=fs.readFileSync(new URL('../public/document-study/study.js',import.meta.url),'utf8'),key='ar-create-packaged-document-study-v1',older=JSON.stringify({project:'invented',projects:[{id:'invented',blocks:[{html:'Earlier cache '.repeat(10000)}]}]}),newer=JSON.stringify({project:'invented',projects:[{id:'invented',blocks:[{html:'Newer exact words must survive'}]}]}),storage=store(1000000,[[key,older]]);let changed=false;
 class ConcurrentMap extends Map{set(k,v){if(!changed){storage.setItem(key,newer);changed=true;}return super.set(k,v);}}
 const context={window:{},Map:ConcurrentMap,localStorage:storage,document:{getElementById:()=>({})},AR_CREATE_SYNTHETIC_PROJECTS:[]};vm.runInNewContext(source,context);vm.runInNewContext(study.slice(0,study.indexOf('function toast('))+';window.testSave=save;',context);assert.equal(changed,true);assert.equal(storage.getItem(key),newer);assert.equal(context.window.arRecoveryCacheStatus().state,'stale');assert.throws(()=>context.window.testSave(),/newer bytes are retained/);assert.equal(storage.getItem(key),newer);
});
test('startup compaction reports unavailable storage without replacing retained cache bytes',()=>{
 const study=fs.readFileSync(new URL('../public/document-study/study.js',import.meta.url),'utf8'),key='ar-create-packaged-document-study-v1',raw=JSON.stringify({project:'invented',projects:[{id:'invented',blocks:[{html:'Retained exact cache '.repeat(5000)}]}]}),storage={getItem:()=>raw,setItem(){throw Error('controlled unavailable storage');}},context={window:{},localStorage:storage,document:{getElementById:()=>({})},AR_CREATE_SYNTHETIC_PROJECTS:[]};
 vm.runInNewContext(source,context);vm.runInNewContext(study.slice(0,study.indexOf('function toast(')),context);assert.equal(storage.getItem(key),raw);assert.equal(context.window.arRecoveryCacheStatus().state,'unavailable');
});
test('startup compaction retains exact whitespace from the value that was read',()=>{
 const study=fs.readFileSync(new URL('../public/document-study/study.js',import.meta.url),'utf8'),key='ar-create-packaged-document-study-v1',raw=' \n'+JSON.stringify({project:'invented',projects:[{id:'invented',blocks:[{html:'Exact cache words '.repeat(5000)}]}]})+' \n',storage=store(1000000,[[key,raw]]),context={window:{},localStorage:storage,document:{getElementById:()=>({})},AR_CREATE_SYNTHETIC_PROJECTS:[]};
 vm.runInNewContext(source,context);vm.runInNewContext(study.slice(0,study.indexOf('function toast(')),context);assert.equal(context.window.arRecoveryCacheStatus().state,'compacted');assert.equal(JSON.parse(storage.getItem(key)).length,raw.length,'The original whitespace must remain in decoded bytes');
});
