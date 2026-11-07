import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomBytes} from 'node:crypto';
const source=fs.readFileSync(new URL('../public/document-study/recovery-storage.js',import.meta.url),'utf8');
function codec(){const context={window:{}};vm.runInNewContext(source,context);return context.window.arRecoveryStorage;}
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
