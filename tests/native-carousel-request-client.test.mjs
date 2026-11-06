import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createNativeCarouselRequest} from '../public/document-study/native-carousel-request.js';

function fixture({registered = true, fork = false, standIn = false} = {}) {
  const root = randomUUID(), source = fork ? randomUUID() : root, article = randomUUID(), sibling = randomUUID();
  const scope = {rootBindingId: root, parentStudyId: 'invented-parent'};
  const expected = {revision: 3, workflow: {draft: 'a'.repeat(64)}};
  const owner = {kind: 'native', bindingId: source, parentStudyId: scope.parentStudyId};
  const binding = {id: source, parentStudyId: scope.parentStudyId, parentStudyKey: scope.parentStudyId,
    authority: 'owned-working-copy', status: 'ready', ...(fork ? {kind: 'output-fork', sourceBindingId: root} : {}),
    ...(registered ? {canonicalOutputId: article} : {})};
  const state = {binding, proof: {bindingId: source, parentStudyId: scope.parentStudyId, expected, sequence: 0, dirty: false},
    owner: null, selection: registered ? {projectId: scope.parentStudyId, rootBindingId: root, output: {id: article, kind: 'article'}, owner} : null,
    outputs: [{id: sibling, kind: 'carousel', title: 'Keep this sibling', slides: [{text: 'Independent words'}]}],
    bindings: [], records: new Map(), calls: [], hook: null};
  if (registered) { state.outputs.push({id: article, kind: 'article'}); state.bindings.push({outputId: article, wordOwner: owner}); }
  const win = {studyDraft: {currentBinding: () => state.binding, currentProof: () => state.proof,
    currentOwner: () => state.owner, viewMode: () => 'edit'}, studyOutputConnection: {selection: () => state.selection}, crypto: {randomUUID}};
  const view = id => ({scope, expectedOutput: {revision: state.outputs.length}, outputs: state.outputs, outputBindings: state.bindings,
    ...(standIn ? {standInOutputCreation: true} : {}), ...(id ? {output: state.outputs.find(row => row.id === id), wordOwner: owner,
      writingProof: {...owner, expected: state.proof.expected}, freshness: {stale: false}} : {})});
  const transport = async (path, options) => {
    const url = new URL(path, 'http://fixture'), body = options?.body ? JSON.parse(options.body) : null;
    const call = {path: url.pathname, query: Object.fromEntries(url.searchParams), body}; state.calls.push(call);
    let result;
    if (url.pathname === '/api/study-draft/read') result = {binding: state.binding, expected: state.proof.expected, readiness: {ready: true}, raw: 'Saved invented Article'};
    else if (url.pathname === '/api/study/outputs') result = view(url.searchParams.get('selectedOutputId'));
    else if (url.pathname.endsWith('/outputs/create') || url.pathname.endsWith('/outputs/stand-in-create')) {
      state.outputs.push({id: body.operationId, kind: 'article'}); state.bindings.push({outputId: body.operationId, wordOwner: owner}); result = {view: view(body.operationId)};
    } else if (url.pathname.endsWith('/preview')) {
      result = {schema: 'ar-create.native-carousel-generation.v1', scope, requestId: body.operationId,
        sourceBindingId: body.sourceBindingId, sourceOutputId: body.sourceOutputId, status: 'preview', modelExecuted: false, reviewed: false};
      state.records.set(result.requestId, result);
    } else if (url.pathname === '/api/study/carousel-make') {
      result = call.query.requestId ? state.records.get(call.query.requestId) : {scope, items: [...state.records.values()].map(({scope, ...record}) => record)};
    } else {
      const prior = state.records.get(body.requestId);
      if (url.pathname.endsWith('/run')) result = {...prior, status: 'running'};
      else if (url.pathname.endsWith('/register')) result = {...prior, status: 'registered', outputId: prior.requestId, reviewed: false, view: {output: {id: prior.requestId, adaptation: {reviewed: false}}}};
      else if (url.pathname.endsWith('/cancel')) result = {...prior, status: 'cancelled'};
      else throw Error('Unexpected request ' + path);
      state.records.set(result.requestId, result);
    }
    result = structuredClone(result);
    if (state.hook) result = await state.hook(call, result) ?? result;
    return {ok: true, status: 200, json: async () => result};
  };
  const client = createNativeCarouselRequest({window: win, fetch: transport});
  return {state, win, client, scope, source, article, sibling, view};
}
const writes = f => f.state.calls.filter(call => call.body);

test('selected fork prepares against exact root, native owner and current output guards, with no model run', async () => {
  const f = fixture({fork: true}), siblings = structuredClone(f.state.outputs);
  Object.defineProperty(f.win, 'current', {get() {throw Error('Global article data must not be read');}});
  const record = await f.client.prepare();
  assert.equal(record.sourceBindingId, f.source); assert.equal(record.sourceOutputId, f.article); assert.deepEqual(record.scope, f.scope);
  assert.equal(record.modelExecuted, false); assert.deepEqual(f.state.outputs, siblings);
  assert.deepEqual(f.state.calls[0].query, {bindingId: f.source, parentStudyId: f.scope.parentStudyId});
  assert.deepEqual(writes(f).map(call => call.path), ['/api/study/carousel-make/preview']);
  assert.deepEqual(writes(f)[0].body.expectedNative, f.state.proof.expected);
  assert.deepEqual(writes(f)[0].body.expectedOutput, {revision: siblings.length});
});

test('unregistered primary Article is registered through existing owner while preserving siblings', async () => {
  for (const standIn of [false, true]) {
    const f = fixture({registered: false, standIn}), sibling = structuredClone(f.state.outputs[0]);
    const record = await f.client.prepare();
    assert.deepEqual(f.state.outputs[0], sibling);
    assert.deepEqual(writes(f).map(call => call.path), [standIn ? '/api/study/outputs/stand-in-create' : '/api/study/outputs/create', '/api/study/carousel-make/preview']);
    const created = writes(f)[0].body;
    assert.equal(created.kind, 'article'); assert.equal(created.sourceBindingId, f.source);
    assert.equal(record.sourceOutputId, created.operationId); assert.notEqual(record.requestId, created.operationId);
    assert.equal(created.humanDecision, undefined); assert.equal(created.reviewed, undefined);
  }
});

test('dirty, foreign, non-native and Carousel owners refuse all transport', async () => {
  for (const change of [
    f => {f.state.proof.dirty = true;}, f => {f.state.owner = {kind: 'magazine'};},
    f => {f.state.selection.output.kind = 'carousel';}, f => {f.state.selection.owner.kind = 'carousel-words';},
    f => {f.state.selection.owner.bindingId = randomUUID();}, f => {f.state.selection.projectId = 'foreign';},
    f => {f.state.proof.bindingId = randomUUID();}, f => {f.state.binding.textOutputKind = 'post';}
  ]) {
    const f = fixture(); change(f); await assert.rejects(f.client.prepare()); assert.equal(f.state.calls.length, 0);
  }
});

test('selection/revision drift at every pre-mutation read prevents preparation writes', async () => {
  for (const target of ['native', 'listing', 'article']) for (const kind of ['selection', 'revision', 'dirty']) {
    const f = fixture();
    f.state.hook = call => {
      if (target === 'native' && call.path.endsWith('/read') || target === 'listing' && call.path.endsWith('/outputs') && !call.query.selectedOutputId || target === 'article' && call.query.selectedOutputId) {
        if (kind === 'selection') f.state.selection.rootBindingId = randomUUID();
        if (kind === 'revision') f.state.proof.sequence++;
        if (kind === 'dirty') f.state.proof.dirty = true;
      }
    };
    await assert.rejects(f.client.prepare()); assert.equal(writes(f).length, 0);
  }
});

test('foreign root, Article owner and saved native revisions are not trusted', async () => {
  for (const change of [
    (call, value) => {if (call.path.endsWith('/outputs')) value.scope.rootBindingId = randomUUID();},
    (call, value) => {if (call.query.selectedOutputId) value.wordOwner.bindingId = randomUUID();},
    (call, value) => {if (call.path.endsWith('/read')) value.expected.revision++;},
    (call, value) => {if (call.query.selectedOutputId) value.freshness.stale = true;}
  ]) {
    const f = fixture(); f.state.hook = change; await assert.rejects(f.client.prepare()); assert.equal(writes(f).length, 0);
  }
});

test('run is explicit and never retried; checks and list remain scoped to durable requests', async () => {
  const f = fixture(), record = await f.client.prepare();
  const listing = await f.client.list(); assert.deepEqual(listing.items[0].scope, f.scope);
  const running = await f.client.run(listing.items[0]); assert.equal(running.status, 'running');
  await f.client.get(record); await assert.rejects(f.client.run(record), /already started/);
  assert.equal(writes(f).filter(call => call.path.endsWith('/run')).length, 1);
  const cancelled = await f.client.cancel(record); assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(writes(f).at(-1).body, {...f.scope, requestId: record.requestId});
});

test('a lost run response cannot trigger another launch for the same request', async () => {
  const f = fixture(), record = await f.client.prepare();
  f.state.hook = call => {if (call.path.endsWith('/run')) {f.state.records.set(record.requestId, record); throw Error('Connection lost');}};
  await assert.rejects(f.client.run(record), /Connection lost/); f.state.hook = null;
  await assert.rejects(f.client.run(record), /already started/);
  assert.equal(writes(f).filter(call => call.path.endsWith('/run')).length, 1);
});

test('navigation never retargets saved requests; mutations refuse selection or revision drift', async () => {
  for (const action of ['run', 'register', 'cancel']) {
    const f = fixture(), record = await f.client.prepare();
    f.state.selection.rootBindingId = randomUUID();
    const checked = await f.client.get(record); assert.deepEqual(checked.scope, f.scope);
    await assert.rejects(f.client[action](record), /another Article/);
    assert.equal(writes(f).length, 1);
  }
  for (const action of ['run', 'register', 'cancel']) {
    const f = fixture(), record = await f.client.prepare();
    f.state.hook = call => {if (call.query.requestId) f.state.proof.sequence++;};
    await assert.rejects(f.client[action](record), /revision changed/); assert.equal(writes(f).length, 1);
  }
});

test('registration retains generated/unreviewed provenance and exact navigable output id', async () => {
  const f = fixture(), record = await f.client.prepare();
  f.state.records.set(record.requestId, {...record, status: 'result-ready', finalizationVerified: true});
  const saved = await f.client.register(record);
  assert.equal(saved.status, 'registered'); assert.equal(saved.outputId, record.requestId);
  assert.equal(saved.reviewed, false); assert.equal(saved.view.output.adaptation.reviewed, false);
  assert.equal(saved.view.output.wordsReview, undefined);
  assert.deepEqual(writes(f).at(-1).body, {...f.scope, requestId: record.requestId});
  assert.equal(writes(f).some(call => /\/(review|accept|run)$/.test(call.path)), false);
});

test('durable response after final POST retains original scope even when selection changes', async () => {
  const f = fixture();
  f.state.hook = call => {if (call.path.endsWith('/preview')) f.state.selection.rootBindingId = randomUUID();};
  const record = await f.client.prepare(); assert.deepEqual(record.scope, f.scope);
  await assert.rejects(f.client.run(record), /another Article/);
});

test('drift during first Article registration stops before Carousel preparation', async () => {
  const f = fixture({registered: false});
  f.state.hook = call => {if (call.path.endsWith('/outputs/create')) f.state.proof.sequence++;};
  await assert.rejects(f.client.prepare(), /revision changed/);
  assert.deepEqual(writes(f).map(call => call.path), ['/api/study/outputs/create']);
});

test('backend failure preserves its status and does not retry a request', async () => {
  const f = fixture(); let calls = 0;
  const client = createNativeCarouselRequest({window: f.win, fetch: async () => {
    calls++; return {ok: false, status: 409, json: async () => ({error: 'Exact saved source changed.'})};
  }});
  await assert.rejects(client.prepare(), error => error.status === 409 && error.message === 'Exact saved source changed.');
  assert.equal(calls, 1);
});
