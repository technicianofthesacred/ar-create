import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createEventBus} from '../runtime/services/events.mjs';
import {createJournal} from '../runtime/services/journal.mjs';

for(const count of [250,1205])test(`${count} changes: oldest-first bounded pages, filters, duplicate polls and lost replies`,()=>{
 const bus=createEventBus({limit:1500});for(let i=1;i<=count;i++)bus.emit({kind:'save',scope:{kind:'project',id:i%3?'p':'other'},operationId:String(i)});
 for(const filter of [{},{kind:'project',id:'p'},{kind:'project',id:'missing'}]){
  let since=0,seen=[];do{const page=bus.since(since,filter,17,bus.bootId);assert.deepEqual(bus.since(since,filter,17,bus.bootId),page,'duplicate/lost response replays exact page');assert.equal(page.reset,false);assert.ok(page.events.length<=17);seen.push(...page.events.map(e=>e.cursor));since=page.cursor;if(!page.hasMore)break;}while(true);
  const expected=Array.from({length:count},(_,i)=>i+1).filter(i=>!filter.id||filter.id==='p'&&i%3);
  assert.deepEqual(seen,expected);assert.equal(since,count);
 }
});
test('buffer expiry including cursor zero explicitly requires canonical reread',()=>{
 const bus=createEventBus();for(let i=0;i<1205;i++)bus.emit({kind:'save'});
 for(const since of [0,1,200]){const p=bus.since(since,{},5,bus.bootId);assert.equal(p.reset,true);assert.equal(p.resetReason,'buffer-expired');assert.equal(p.cursor,1205);assert.deepEqual(p.events,[]);}
 assert.equal(bus.since(205,{},2,bus.bootId).events[0].cursor,206);
});
test('lower, equal and higher new sequences reset on idle resume; legacy numeric resume is explicit',()=>{
 const old=createEventBus();for(let i=0;i<5;i++)old.emit({kind:'save'});
 for(const count of [0,3,5,9]){const bus=createEventBus();for(let i=0;i<count;i++)bus.emit({kind:'save'});const p=bus.since(5,{},2,old.bootId);assert.equal(p.resetReason,'boot-changed');assert.equal(p.cursor,count);assert.equal(bus.since(p.cursor,{},2,p.bootId).reset,false);assert.equal(bus.since(5).resetReason,'boot-required');}
});
test('history pages retain tied timestamps, scope filters and older months during new appends',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'activity-history-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));let date=new Date('2026-10-01T00:00:00Z');const j=createJournal({dataDir,now:()=>date});
 for(let i=0;i<37;i++){if(i===20)date=new Date('2026-11-01T00:00:00Z');await j.append({operationId:randomUUID(),actor:'agent:codex',kind:'save',scope:{kind:'project',id:i%2?'p':'other'},status:'committed',after:{revision:i}});}
 let before,seen=[],pages=0;do{const page=await j.read({kind:'project',id:'p',limit:3,before});assert.ok(page.lines.length<=3);seen.push(...page.lines.map(r=>r.after.revision));before=page.nextCursor;pages++;if(pages===1){await j.append({operationId:randomUUID(),kind:'save',scope:{kind:'project',id:'p'},status:'committed',after:{revision:99}});await assert.rejects(j.read({id:'other',before}),/another filter/);}}while(before);
 assert.deepEqual(seen,Array.from({length:18},(_,i)=>35-i*2));assert.equal(pages,6);
});
test('representative 10000-line history remains reachable in bounded pages',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'large-history-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));fs.mkdirSync(path.join(dataDir,'journal'));
 const rows=Array.from({length:10000},(_,i)=>({ts:'2026-11-01T00:00:00Z',operationId:String(i),kind:'save',scope:{kind:'project',id:'p'},status:'committed',after:{revision:i}}));fs.writeFileSync(path.join(dataDir,'journal','2026-11.jsonl'),rows.map(JSON.stringify).join('\n')+'\n');
 const j=createJournal({dataDir}),start=performance.now();let before,count=0,last=10000;do{const page=await j.read({limit:137,before});for(const row of page.lines){assert.equal(row.after.revision,--last);count++;}before=page.nextCursor;}while(before);assert.equal(count,10000);t.diagnostic(`10000 lines / 137 page size: ${(performance.now()-start).toFixed(1)}ms, ${fs.statSync(path.join(dataDir,'journal','2026-11.jsonl')).size} bytes`);
});
