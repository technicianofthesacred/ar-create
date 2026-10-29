import test from 'node:test';
import assert from 'node:assert/strict';
import {createExistingWorkReader} from '../runtime/services/review-existing-work.mjs';

const original={stories:[],guidance:[],unassigned:[],diagnostics:[]};
const portfolio={list:async()=>structuredClone(original)};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const safeLabels=new Set(['portfolio','portfolio-recovery','library','conversations','workspace-pieces','native-workspace-identities','magazine-working-identities','magazine-root-resolution','workspace-binding','workspace-binding-wave']);
function validateTiming(row){
 assert.deepEqual(Object.keys(row).sort(),['elapsedMs','outcome','reader','remainingMs']);
 assert.ok(safeLabels.has(row.reader));
 assert.ok(['fulfilled','rejected','timed-out','budget-exhausted'].includes(row.outcome));
 assert.ok(Number.isInteger(row.elapsedMs)&&row.elapsedMs>=0);
 assert.ok(Number.isInteger(row.remainingMs)&&row.remainingMs>=0);
 assert.equal(Object.isFrozen(row),true);
}

test('optional reader timing names the stalled owner without retaining late proof or private details',async()=>{
 const rows=[];let release,aborted=false;
 const reader=createExistingWorkReader({portfolio,readTimeoutMs:20,onTiming:row=>rows.push(row),readAuthority:(path,{signal}={})=>{
  if(path==='/api/sources/tree'){signal.addEventListener('abort',()=>{aborted=true;});return new Promise(resolve=>{release=resolve;});}
  return {};
 }});
 const catalog=await reader.catalog();
 assert.ok(aborted);assert.equal(catalog.sources.length,0);
 const stalled=rows.filter(row=>row.reader==='library');assert.equal(stalled.length,1);assert.equal(stalled[0].outcome,'timed-out');
 for(const row of rows)validateTiming(row);
 assert.deepEqual(new Set(rows.map(row=>row.reader)),new Set(['portfolio','library','conversations','workspace-pieces','native-workspace-identities','magazine-working-identities','magazine-root-resolution','workspace-binding-wave']));
 const count=rows.length;release({sources:[{id:'private-late-id',title:'private-late-prose'}]});await turn();
 assert.equal(catalog.sources.length,0);assert.equal(rows.length,count);assert.ok(!JSON.stringify(rows).includes('private-'));assert.ok(!JSON.stringify(rows).includes('/api/'));
});

test('binding timings use a fixed label and exhausted shared budget does not start a fresh lookup wave',async()=>{
 const rows=[],bindingId='11111111-1111-4111-8111-111111111111';let lookups=0;
 const reader=createExistingWorkReader({portfolio,readTimeoutMs:20,onTiming:row=>rows.push(row),readAuthority:path=>{
  if(path==='/api/sources/tree')return new Promise(()=>{});
  if(path==='/api/study-draft/catalog')return {drafts:[{bindingStatus:'ready',bindingId,parentStudyId:'private-parent'}]};
  if(path.startsWith('/api/first-flow/binding?')){lookups++;throw Error('private reader failure');}
  return {};
 }});
 const catalog=await reader.catalog();assert.equal(lookups,0);assert.equal(catalog.workspaceLinks.unavailableBindings.length,2);
 const bindings=rows.filter(row=>row.reader==='workspace-binding');assert.equal(bindings.length,2);assert.ok(bindings.every(row=>row.outcome==='budget-exhausted'));
 assert.equal(rows.filter(row=>row.reader==='workspace-binding-wave').length,1);for(const row of rows)validateTiming(row);
 assert.ok(!JSON.stringify(rows).includes(bindingId));assert.ok(!JSON.stringify(rows).includes('private-parent'));
});

test('rejected readers and observer failures preserve the same catalogue result',async()=>{
 const readAuthority=path=>{if(path==='/api/source-sessions')throw Error('private rejection detail');return {};};
 const plain=await createExistingWorkReader({portfolio,readAuthority}).catalog();
 for(const onTiming of [()=>{throw Error('observer refused');},()=>Promise.reject(Error('observer refused'))]){
  const observed=await createExistingWorkReader({portfolio,readAuthority,onTiming}).catalog();assert.deepEqual(observed,plain);await turn();
 }
 const rows=[];await createExistingWorkReader({portfolio,readAuthority,onTiming:row=>rows.push(row)}).catalog();
 assert.equal(rows.find(row=>row.reader==='conversations')?.outcome,'rejected');assert.ok(!JSON.stringify(rows).includes('private rejection detail'));
});

test('fatal portfolio rejection remains fatal and is measured without exposing its error',async()=>{
 const rows=[];const reader=createExistingWorkReader({portfolio:{list:async()=>{throw Error('private portfolio detail');}},readAuthority:async()=>({}),onTiming:row=>rows.push(row)});
 await assert.rejects(reader.catalog(),/private portfolio detail/);await turn();
 assert.equal(rows.find(row=>row.reader==='portfolio')?.outcome,'rejected');assert.ok(!JSON.stringify(rows).includes('private portfolio detail'));
});

test('root resolution failure emits only its safe phase and preserves unavailable working identity',async()=>{
 const rows=[];const reader=createExistingWorkReader({portfolio,roots:[{id:'private-root',path:new URL('./fixtures/unavailable-timing-root',import.meta.url).pathname}],readAuthority:async()=>({}),onTiming:row=>rows.push(row)});
 const catalog=await reader.catalog();assert.equal(catalog.magazineWorkingLinks.state,'unavailable');
 assert.equal(rows.find(row=>row.reader==='magazine-root-resolution')?.outcome,'rejected');
 assert.ok(!JSON.stringify(rows).includes('private-root'));assert.ok(!JSON.stringify(rows).includes('unavailable-timing-root'));
});

test('last timing observes one real build across concurrent catalogue joins and returns detached snapshots',async()=>{
 let release,calls=0;const gate=new Promise(resolve=>{release=resolve;});
 const reader=createExistingWorkReader({portfolio:{list:async()=>{calls++;await gate;return structuredClone(original);}},readAuthority:async()=>({})});
 assert.equal(reader.lastTiming(),null);assert.equal(calls,0);
 const first=reader.catalog();assert.equal(reader.catalog(),first);assert.equal(calls,0);
 const initial=reader.lastTiming();assert.deepEqual(Object.keys(initial).sort(),['completed','failed','rows','run','startedAt']);assert.equal(initial.run,1);assert.ok(Number.isInteger(initial.startedAt));assert.equal(initial.completed,false);assert.equal(initial.failed,false);
 await turn();assert.equal(calls,1);release();await first;
 const done=reader.lastTiming();assert.equal(done.run,1);assert.equal(done.completed,true);assert.equal(done.failed,false);assert.ok(done.rows.length>0);
 done.rows[0].reader='mutated';done.rows.push({reader:'injected'});done.run=99;assert.equal(reader.lastTiming().run,1);assert.ok(!reader.lastTiming().rows.some(row=>['mutated','injected'].includes(row.reader)));assert.equal(calls,1);
 const second=reader.catalog();assert.notEqual(second,first);assert.equal(reader.lastTiming().run,2);assert.equal(reader.lastTiming().completed,false);await second;assert.equal(reader.lastTiming().completed,true);assert.equal(calls,2);
});

test('last timing reflects fatal failure and optional refusal without exposing errors or triggering another read',async()=>{
 let calls=0;const reader=createExistingWorkReader({portfolio:{list:async()=>{calls++;throw Error('private fatal detail');}},readAuthority:async()=>{throw Error('private optional detail');},onTiming:()=>{throw Error('observer error');}});
 await assert.rejects(reader.catalog(),/private fatal detail/);await turn();
 const snapshot=reader.lastTiming();assert.equal(snapshot.run,1);assert.equal(snapshot.completed,true);assert.equal(snapshot.failed,true);assert.equal(snapshot.rows.find(row=>row.reader==='portfolio')?.outcome,'rejected');assert.equal(snapshot.rows.find(row=>row.reader==='library')?.outcome,'rejected');assert.ok(!JSON.stringify(snapshot).includes('private'));assert.ok(!JSON.stringify(snapshot).includes('observer error'));
 assert.deepEqual(reader.lastTiming(),snapshot);assert.equal(calls,1);
});

test('one stalled required portfolio cannot pin return: recover once from fresh bytes within the same budget',async()=>{const rows=[];let calls=0,release,aborted=false;const first=new Promise(resolve=>{release=resolve;});const reader=createExistingWorkReader({readTimeoutMs:60,onTiming:row=>rows.push(row),portfolio:{list:async({signal}={})=>{calls++;if(calls===1){signal?.addEventListener('abort',()=>{aborted=true;});return first;}return structuredClone(original);}},readAuthority:async()=>({})});let watchdog;try{const result=await Promise.race([reader.catalog(),new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('Required reader stayed pinned')),300);})]);assert.equal(calls,2);assert.equal(aborted,true);assert.deepEqual(result.stories,[]);const before=reader.lastTiming();assert.equal(before.completed,true);assert.equal(before.rows.find(r=>r.reader==='portfolio')?.outcome,'timed-out');assert.equal(before.rows.find(r=>r.reader==='portfolio-recovery')?.outcome,'fulfilled');for(const row of rows)validateTiming(row);release({...structuredClone(original),stories:[{id:'late-story',name:'Late abandoned work',artifacts:[],parts:[],questions:[]}]});await turn();assert.deepEqual(result.stories,[]);assert.deepEqual(reader.lastTiming(),before);}finally{clearTimeout(watchdog);}});

test('two stalled required scans release the shared promise so a later opening starts a real new run',async()=>{let calls=0;const reader=createExistingWorkReader({readTimeoutMs:40,portfolio:{list:async()=>{calls++;if(calls<=2)return new Promise(()=>{});return structuredClone(original);}},readAuthority:async()=>({})});let watchdog;try{await assert.rejects(Promise.race([reader.catalog(),new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('Required reader stayed pinned')),300);})]),/timed out/);assert.equal(calls,2);assert.equal(reader.lastTiming().failed,true);const next=await reader.catalog();assert.deepEqual(next.stories,[]);assert.equal(calls,3);assert.equal(reader.lastTiming().run,2);assert.equal(reader.lastTiming().completed,true);}finally{clearTimeout(watchdog);}});
