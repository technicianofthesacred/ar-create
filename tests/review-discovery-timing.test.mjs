import test from 'node:test';
import assert from 'node:assert/strict';
import {createExistingWorkReview} from '../scripts/review-existing.mjs';

const config={authorityURL:'http://127.0.0.1:8841',allowedAuthorityPort:8841,magazineRoots:[]};
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('exact HTTP discovery timing observes the actual run without warming or refreshing its catalogue',async t=>{
 let reads=0;const observed=[];
 const {server}=await createExistingWorkReview({config,onCatalogTiming:row=>observed.push(row),fetchImpl:async()=>{reads++;return {ok:true,json:async()=>({})};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const base='http://127.0.0.1:'+server.address().port;
 const empty=await fetch(base+'/api/review/discovery-timing');assert.equal(empty.status,200);assert.equal(await empty.json(),null);assert.equal(reads,0);
 assert.equal((await fetch(base+'/api/review/discovery-timing?run=1')).status,400);assert.equal(reads,0);
 assert.equal((await fetch(base+'/api/review/discovery-timing',{method:'POST'})).status,423);assert.equal(reads,0);
 assert.equal((await fetch(base+'/api/review/catalog')).status,200);const before=reads;
 const first=await (await fetch(base+'/api/review/discovery-timing')).json();
 assert.equal(first.run,1);assert.equal(first.completed,true);assert.equal(first.failed,false);assert.equal(first.rows.filter(row=>row.reader==='retained-carousels').length,1);
 const second=await (await fetch(base+'/api/review/discovery-timing')).json();assert.deepEqual(second,first);assert.equal(reads,before);
 assert.equal(observed.filter(row=>row.reader==='retained-carousels').length,1);
});

test('retained reader timeout joins the current run and keeps the existing unavailable fallback',async()=>{
 const observed=[];const {reader,retainedCarousels}=await createExistingWorkReview({config:{...config,retainedCarouselState:{path:new URL('./fixtures/unavailable-retained-state.json',import.meta.url).pathname,projectId:'invented-project',documentId:'invented-document',outputIds:['44444444-4444-4444-8444-444444444444']}},readTimeoutMs:20,onCatalogTiming:row=>{observed.push(row);if(row.reader==='retained-carousels')return Promise.reject(Error('retained observer failed'));},fetchImpl:async()=>({ok:true,json:async()=>({})})});
 let release;retainedCarousels.list=()=>new Promise(resolve=>{release=resolve;});
 const pending=reader.catalog();assert.equal(reader.catalog(),pending);await turn();assert.equal(reader.lastTiming().completed,false);
 const catalog=await pending;assert.equal(catalog.mode,'existing-work-read-only');assert.equal(catalog.retainedCarousels.available,false);assert.deepEqual(catalog.retainedCarousels.items,[]);assert.match(catalog.retainedCarousels.error,/timed out/);
 const done=reader.lastTiming();assert.equal(done.completed,true);assert.equal(done.failed,false);assert.equal(done.rows.find(row=>row.reader==='retained-carousels')?.outcome,'timed-out');assert.equal(observed.filter(row=>row.reader==='retained-carousels').length,1);
 const count=done.rows.length;release({available:true,items:[{id:'private-late-record'}]});await turn();assert.equal(reader.lastTiming().rows.length,count);assert.ok(!JSON.stringify(reader.lastTiming()).includes('private-late-record'));
});

test('a retained completion from an earlier failed run never enters the new run or observer',async()=>{
 let round=0,retainedReads=0,release;const observed=[];
 const {reader,retainedCarousels}=await createExistingWorkReview({config,readTimeoutMs:500,onCatalogTiming:row=>observed.push(row),fetchImpl:async url=>({ok:true,json:async()=>url.pathname==='/api/pieces'&&++round===1?{pieces:'invalid'}:{}})});
 retainedCarousels.list=()=>++retainedReads===1?new Promise(resolve=>{release=resolve;}):Promise.resolve({readOnly:true,available:false,items:[]});
 await assert.rejects(reader.catalog(),/filter/);assert.equal(reader.lastTiming().failed,true);
 await reader.catalog();const fresh=reader.lastTiming();assert.equal(fresh.run,2);assert.equal(fresh.failed,false);assert.equal(fresh.rows.filter(row=>row.reader==='retained-carousels').length,1);
 const retainedCount=observed.filter(row=>row.reader==='retained-carousels').length;release({available:true,items:[{id:'private-prior-run'}]});await turn();
 assert.deepEqual(reader.lastTiming(),fresh);assert.equal(observed.filter(row=>row.reader==='retained-carousels').length,retainedCount);assert.ok(!JSON.stringify(fresh).includes('private-prior-run'));
 fresh.rows[0].reader='changed';assert.notEqual(reader.lastTiming().rows[0].reader,'changed');
});
