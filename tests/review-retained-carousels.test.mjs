import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRetainedCarouselReader} from '../runtime/services/review-retained-carousels.mjs';
import {createExistingWorkReview} from '../scripts/review-existing.mjs';
async function fixture(t){
 const home=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'retained-carousel-reader-'))),file=path.join(home,'original.json');t.after(()=>fs.rm(home,{recursive:true,force:true}));
 const make=()=>({id:randomUUID(),kind:'carousel',title:'Same title',outputRevision:2,createdAt:'2026-10-11T00:00:00.000Z',slides:[{id:randomUUID(),text:'Synthetic original words',template:'M1',photos:[]}],caption:'Exact caption'});
 const outputs=[make(),make(),make()],state={revision:4,project:{id:randomUUID(),document:{schema:'ar-create.document.v1',id:randomUUID(),revision:3,outputs}}};
 const config={path:file,projectId:state.project.id,documentId:state.project.document.id,outputIds:outputs.slice(0,2).map(output=>output.id)};
 const write=()=>fs.writeFile(file,JSON.stringify(state));await write();const reader=createRetainedCarouselReader({retainedCarouselState:config});return {home,file,state,config,reader,write};
}
const reference=item=>({outputId:item.outputId,expectedSourceHash:item.sourceHash,expectedOutputHash:item.outputHash});
test('C01/C04/S12: metadata retains separate exact identities, guarded read retains exact output, no source writes',async t=>{
 const f=await fixture(t),before=await fs.stat(f.file),bytes=await fs.readFile(f.file),entries=await fs.readdir(f.home),list=await f.reader.list();
 assert.equal(list.items.length,2);assert.notEqual(list.items[0].outputId,list.items[1].outputId);assert.equal(list.items[0].title,list.items[1].title);assert.equal(list.items[0].slideCount,1);assert.equal(list.items[0].revision,4);assert.equal(list.items[0].outputRevision,2);
 assert.ok(!JSON.stringify(list).includes('Synthetic original words'));assert.ok(!JSON.stringify(list).includes(f.file));
 const read=await f.reader.read(reference(list.items[0]));assert.deepEqual(read.output,f.state.project.document.outputs[0]);assert.equal(read.authority,'retained-original');assert.equal(read.readOnly,true);
 assert.deepEqual(await fs.readFile(f.file),bytes);assert.deepEqual(await fs.readdir(f.home),entries);const after=await fs.stat(f.file);assert.equal(after.mtimeMs,before.mtimeMs);assert.equal(after.ctimeMs,before.ctimeMs);
});
test('C06: stale source, stale output, unapproved ID and changed owning identities refuse exact read',async t=>{
 const f=await fixture(t),item=(await f.reader.list()).items[0];
 await assert.rejects(f.reader.read({...reference(item),expectedOutputHash:'0'.repeat(64)}),{status:409});
 await assert.rejects(f.reader.read({...reference(item),outputId:f.state.project.document.outputs[2].id}),{status:400});
 f.state.project.document.outputs[1].caption='Outside edit';await f.write();await assert.rejects(f.reader.read(reference(item)),{status:409});
 for(const owner of [f.state.project,f.state.project.document]){const id=owner.id;owner.id=randomUUID();await f.write();await assert.rejects(f.reader.list(),{status:409});owner.id=id;}
});
test('duplicate IDs, missing allowed output and invalid configuration fail closed',async t=>{
 const f=await fixture(t);
 assert.throws(()=>createRetainedCarouselReader({retainedCarouselState:{...f.config,outputIds:[f.config.outputIds[0],f.config.outputIds[0]]}}),{status:400});
 assert.throws(()=>createRetainedCarouselReader({retainedCarouselState:{...f.config,outputIds:['guess']}}),{status:400});
 f.state.project.document.outputs.push({...f.state.project.document.outputs[0]});await f.write();await assert.rejects(f.reader.list(),{status:409});
 f.state.project.document.outputs=[];await f.write();await assert.rejects(f.reader.list(),{status:409});
});
test('symlink, oversized and malformed files refuse without leaking configured paths',async t=>{
 const f=await fixture(t),link=path.join(f.home,'link.json');await fs.symlink(f.file,link);const linked=createRetainedCarouselReader({retainedCarouselState:{...f.config,path:link}});
 for(const run of [()=>linked.list(),async()=>{await fs.writeFile(f.file,' '.repeat(2*1024*1024+1));return f.reader.list();},async()=>{await fs.writeFile(f.file,'{broken');return f.reader.list();}])await assert.rejects(run(),error=>{assert.ok(!error.message.includes(f.home));return [403,413,415].includes(error.status);});
});
test('disabled adapter performs no filesystem reads',async()=>{
 const originalOpen=fs.open,originalRealpath=fs.realpath;let calls=0;fs.open=async()=>{calls++;throw Error('Unexpected read');};fs.realpath=async()=>{calls++;throw Error('Unexpected read');};
 try{const reader=createRetainedCarouselReader();assert.deepEqual(await reader.list(),{readOnly:true,available:false,items:[]});await assert.rejects(reader.read({}),{status:503});assert.equal(calls,0);}finally{fs.open=originalOpen;fs.realpath=originalRealpath;}
});
test('review routes enforce GET and strict references, include metadata before catalog projection',async t=>{
 const f=await fixture(t);let ownerReads=0;
 const {server,reader}=await createExistingWorkReview({config:{authorityURL:'http://127.0.0.1:65530',allowedAuthorityPort:65530,magazineRoots:[],retainedCarouselState:f.config},fetchImpl:async()=>{ownerReads++;return {ok:true,json:async()=>({sources:[],sessions:[],pieces:[{id:'independent-piece',title:'Other saved work'}],drafts:[],collections:[]})};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));const base='http://127.0.0.1:'+server.address().port;
 const list=await(await fetch(base+'/api/review/retained-carousels')).json();assert.equal(list.items.length,2);
 const query=new URLSearchParams(reference(list.items[0])),route='/api/review/retained-carousel?'+query;
 assert.deepEqual((await(await fetch(base+route)).json()).output,f.state.project.document.outputs[0]);
 for(const tail of ['&path=/outside','&outputId='+list.items[0].outputId])assert.equal((await fetch(base+route+tail)).status,400);
 assert.equal((await fetch(base+'/api/review/retained-carousels?path=/outside')).status,400);assert.equal((await fetch(base+route,{method:'HEAD'})).status,405);assert.equal((await fetch(base+route,{method:'POST'})).status,423);
 const catalog=await reader.catalog();assert.equal(catalog.retainedCarousels.items.length,2);assert.equal((await(await fetch(base+'/api/review/catalog')).json()).retainedCarousels.items.length,2);
 const prior=ownerReads;f.state.project.id=randomUUID();await f.write();
 for(const missing of [false,true]){
  if(missing)await fs.unlink(f.file);
  const current=await reader.catalog();assert.deepEqual(current.workspacePieces,catalog.workspacePieces);assert.equal(current.workspacePieces[0].id,'independent-piece');assert.equal(current.retainedCarousels.available,false);assert.deepEqual(current.retainedCarousels.items,[]);assert.ok(current.retainedCarousels.error);assert.ok(!current.retainedCarousels.error.includes(f.home));
  const response=await fetch(base+'/api/review/catalog');assert.equal(response.status,200);assert.ok((await response.json()).retainedCarousels.error);
  assert.equal((await fetch(base+route)).status,missing?503:409);assert.equal((await fetch(base+'/api/review/retained-carousels')).status,missing?503:409);
 }
 assert.ok(ownerReads>prior,'optional retained failure leaves independent owners readable');
});

test('C01/C04/C06/S12: five additional explicit originals are readable without becoming copy eligible',async t=>{
 const f=await fixture(t),base=f.state.project.document.outputs[0],extra=Array.from({length:5},(_,i)=>({...structuredClone(base),id:randomUUID(),title:'Historical synthetic '+i,slides:[{...structuredClone(base.slides[0]),id:randomUUID(),text:'Earlier synthetic words '+i}]}));
 f.state.project.document.outputs.push(...extra);await f.write();const bytes=await fs.readFile(f.file),before=await fs.stat(f.file),reader=createRetainedCarouselReader({retainedCarouselState:{...f.config,readOnlyOutputIds:extra.map(o=>o.id)}}),list=await reader.list();
 assert.equal(list.items.length,7);assert.deepEqual(list.items.filter(item=>item.copyAllowed).map(item=>item.outputId),f.config.outputIds);
 for(const original of extra){const item=list.items.find(item=>item.outputId===original.id);assert.equal(item.readOnly,true);assert.equal(item.copyAllowed,false);assert.deepEqual((await reader.read(reference(item))).output,original);}
 assert.equal(list.items.some(item=>item.outputId===f.state.project.document.outputs[2].id),false);
 assert.deepEqual(await fs.readFile(f.file),bytes);const after=await fs.stat(f.file);assert.equal(after.mtimeMs,before.mtimeMs);assert.equal(after.ctimeMs,before.ctimeMs);
 const item=list.items.at(-1);extra.at(-1).caption='Changed original';f.state.project.document.outputs.at(-1).caption=extra.at(-1).caption;await f.write();await assert.rejects(reader.read(reference(item)),{status:409});
});
test('read-only allowlist rejects malformed, duplicate, overlapping and oversized identities',async t=>{
 const f=await fixture(t),id=f.state.project.document.outputs[2].id;
 for(const readOnlyOutputIds of [null,'all',['guess'],[id,id],[f.config.outputIds[0]],Array.from({length:101},()=>randomUUID())])assert.throws(()=>createRetainedCarouselReader({retainedCarouselState:{...f.config,readOnlyOutputIds}}),{status:400});
 const reader=createRetainedCarouselReader({retainedCarouselState:{...f.config,readOnlyOutputIds:[randomUUID()]}});await assert.rejects(reader.list(),{status:409});
});
