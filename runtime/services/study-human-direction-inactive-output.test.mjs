import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {owners} from './test-fixtures/inquiry-owners.mjs';
import {createStudyHumanDirection} from './study-human-direction.mjs';
async function scopedOwners(t){
  const f=await owners(t);
  // Match the shared-article server capability; keep legacy owner guards intact.
  // Resolve the method on each call so tests exercise the actual injected reader.
  f.direction=createStudyHumanDirection({dataDir:f.dataDir,store:f.store,bindings:f.bindings,drafts:f.native,library:{collections:()=>f.library.collectionsSnapshot(),snapshot:(...args)=>f.library.snapshot(...args)},readOutputDocument:input=>f.store.readArticle(input)});
  return f;
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const guards=record=>({expectedRevision:record.revision,expectedHash:record.hash,expectedMetadataHash:record.metadataHash});
async function unrelated(f,title){const state=f.store.get();return f.store.createPiece({title,expectedProjectId:state.project.id,expectedRevision:state.revision});}
const scope=(f,outputId)=>({scope:'output',parentStudyId:f.group.parentStudyId,bindingId:f.root.binding.id,outputId});

test('actual inactive Article and Carousel direction retain exact scopes, manual text and independent learning',async t=>{
  const f=await scopedOwners(t),article=await f.create('article'),carousel=await f.create('carousel');
  const scopes=[scope(f,article.view.output.id),scope(f,carousel.view.output.id)];
  await unrelated(f,'Unrelated current writing');
  const active=structuredClone(f.store.get()),learning=await f.direction.read(f.scope);
  const bodies=[
    '# Article direction\n\nKeep my full manual paragraph, punctuation — and this second line.\n\n## A question\nWhat remains uncertain?\n',
    '# Carousel direction\n\nKeep this independent sequence.\n\n1. First thought\n2. Its own ending\n'
  ];
  for(const [index,selector] of scopes.entries()){
    const before=await f.direction.read(selector);
    await f.direction.write({...selector,...guards(before),operationId:randomUUID(),body:bodies[index]});
    const saved=await f.direction.read(selector);
    assert.equal(saved.scope.outputId,selector.outputId);
    assert.equal(saved.scope.bindingId,f.root.binding.id);
    assert.equal(saved.scope.projectId,f.physical.projectId);
    assert.equal(saved.scope.documentId,f.physical.documentId);
    assert.equal(saved.body,bodies[index]);
    assert.deepEqual(f.store.get(),active,'direction access must not activate its workspace or alter unrelated active writing');
  }
  const articleBefore=await f.direction.read(scopes[0]),carouselBefore=await f.direction.read(scopes[1]);
  const revised=bodies[0]+'\nA later exact human amendment.\n';
  await f.direction.write({...scopes[0],...guards(articleBefore),operationId:randomUUID(),body:revised});
  assert.equal((await f.direction.read(scopes[0])).body,revised);
  assert.deepEqual(await f.direction.read(scopes[1]),carouselBefore,'Article amendments preserve sibling Carousel direction');
  assert.deepEqual(await f.direction.read(f.scope),learning,'independent Collection learning remains exact');
  assert.deepEqual(f.store.get(),active);
});

test('concurrent unrelated activation between catalog authority and exact saved read cannot redirect output direction',async t=>{
  const f=await scopedOwners(t),article=await f.create('article'),carousel=await f.create('carousel'),selector=scope(f,article.view.output.id);
  await unrelated(f,'First unrelated active writing');
  const entered=deferred(),resume=deferred(),realList=f.store.listPieces,realRead=f.store.readArticle,reads=[];
  let gated=false;
  f.store.listPieces=async(...args)=>{const result=await realList(...args);if(!gated){gated=true;entered.resolve();await resume.promise;}return result;};
  f.store.readArticle=async input=>{reads.push(structuredClone(input));return realRead(input);};
  t.after(()=>{f.store.listPieces=realList;f.store.readArticle=realRead;});
  const reading=f.direction.read(selector);
  await entered.promise;
  await unrelated(f,'Second unrelated activation during authority read');
  const active=structuredClone(f.store.get());
  resume.resolve();
  const record=await reading;
  assert.equal(record.scope.outputId,article.view.output.id);
  assert.equal(record.scope.projectId,f.physical.projectId);
  assert.ok(reads.length>0);
  assert.ok(reads.every(input=>input.projectId===f.physical.projectId),'every saved read requests the exact owned workspace');
  const body='# Preserved after unrelated activation\n\nMy complete manual direction stays bound to this Article.\n';
  await f.direction.write({...selector,...guards(record),operationId:randomUUID(),body});
  assert.equal((await f.direction.read(selector)).body,body);
  assert.equal((await f.direction.read(scope(f,carousel.view.output.id))).body,'');
  assert.deepEqual(f.store.get(),active,'concurrent activation does not authorize a write into the newly active workspace');
});

test('unknown output and mismatched maintained project/document proofs remain refused while inactive',async t=>{
  const f=await scopedOwners(t),article=await f.create('article'),selector=scope(f,article.view.output.id);
  await unrelated(f,'Unrelated active proof rejection');
  const active=structuredClone(f.store.get()),before=await f.direction.read(selector);
  await assert.rejects(f.direction.read({...selector,outputId:randomUUID()}),{status:404});
  await assert.rejects(f.direction.write({...selector,outputId:randomUUID(),...guards(before),operationId:randomUUID(),body:'Must not save unknown output.\n'}),{status:404});
  const realRead=f.store.readArticle;
  t.after(()=>{f.store.readArticle=realRead;});
  for(const mismatch of ['project','document','output']){
    f.store.readArticle=async input=>{
      const saved=structuredClone(await realRead(input));
      if(mismatch==='project')saved.project.id=randomUUID();
      else if(mismatch==='document')saved.document.id=randomUUID();
      else saved.document.outputs=saved.document.outputs.filter(output=>output.id!==selector.outputId);
      return saved;
    };
    await assert.rejects(f.direction.read(selector),{status:404});
    await assert.rejects(f.direction.write({...selector,...guards(before),operationId:randomUUID(),body:'Must not save mismatched proof.\n'}),{status:404});
  }
  f.store.readArticle=realRead;
  assert.deepEqual(await f.direction.read(selector),before);
  assert.deepEqual(f.store.get(),active);
});
