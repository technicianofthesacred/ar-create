import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createInquiryProjectSelectors} from './inquiry-project-selectors.mjs';
import {owners} from './test-fixtures/inquiry-owners.mjs';
const error = status => Object.assign(Error('Invented owner failure'), {status});
function fixture({drafts = [], collections = [], lookupError, authorityError, alterAuthority} = {}) {
  const calls = [];
  return {calls, list: createInquiryProjectSelectors({
    drafts: {catalog: async () => ({drafts, collections})},
    bindings: {lookup: async ({projectKey}) => {calls.push(['lookup', projectKey]); if (lookupError) throw lookupError; return {projectKey, projectId: 'workspace-for-' + projectKey};}},
    readAuthority: async endpoint => {calls.push(['authority', endpoint]); if (authorityError) throw authorityError; return alterAuthority?.(endpoint) ?? {endpoint, project: {id: endpoint.id}};}
  })};
}
const ready = (bindingId, parentStudyId = 'invented-parent', extra = {}) => ({bindingId, parentStudyId, bindingStatus: 'ready', ...extra});
test('ready drafts and saved source-free collection roots share exact authority checks and deduplication', async () => {
  const draft = ready('draft'), collection = ready('source-free-root', 'invented-collection', {kind: 'collection-root'});
  const f = fixture({drafts: [draft, draft, ready('fork', 'invented-parent', {kind: 'output-fork'}), ready('pending', 'invented-parent', {bindingStatus: 'pending'}), ready(null)], collections: [collection, collection, ready('not-root', 'invented-parent', {kind: 'other'})]});
  assert.deepEqual(await f.list(), [
    {workspaceId: 'workspace-for-invented-parent', parentStudyId: 'invented-parent', rootBindingId: 'draft'},
    {workspaceId: 'workspace-for-invented-collection', parentStudyId: 'invented-collection', rootBindingId: 'source-free-root'}
  ]);
  assert.equal(f.calls.filter(([kind]) => kind === 'authority').length, 2);
});
test('an optional unbound original 404 does not hide a saved collection root', async () => {
  const catalog = {drafts: [ready('missing')], collections: [ready('root', 'saved-collection', {kind: 'collection-root'})]};
  const list = createInquiryProjectSelectors({drafts: {catalog: async () => catalog}, bindings: {lookup: async ({projectKey}) => {if (projectKey === 'invented-parent') throw error(404); return {projectKey, projectId: 'saved-workspace'};}}, readAuthority: async endpoint => ({endpoint, project: {id: endpoint.id}})});
  assert.deepEqual(await list(), [{workspaceId: 'saved-workspace', parentStudyId: 'saved-collection', rootBindingId: 'root'}]);
});
test('missing authority is omitted, but unexpected lookup and authority failures remain visible', async () => {
  assert.deepEqual(await fixture({drafts: [ready('gone')], authorityError: error(404)}).list(), []);
  for (const status of [403, 409, 503, undefined]) {
    for (const owner of ['lookupError', 'authorityError']) {
      const failure = error(status);
      await assert.rejects(fixture({drafts: [ready('root')], [owner]: failure}).list(), e => e === failure);
    }
  }
});
test('mismatched owner proof and malformed catalogs fail honestly', async () => {
  await assert.rejects(fixture({drafts: [ready('root')], alterAuthority: endpoint => ({endpoint: {...endpoint, rootBindingId: 'another-root'}, project: {id: endpoint.id}})}).list(), {status: 409});
  const list = createInquiryProjectSelectors({drafts: {catalog: async () => ({drafts: []})}, bindings: {lookup() {}}, readAuthority() {}});
  await assert.rejects(list(), {status: 503});
});
test('maintained synthetic native owners provide a verified saved selector', async t => {
  const f = await owners(t);
  const list = createInquiryProjectSelectors({drafts: f.native, bindings: f.bindings, readAuthority: endpoint => f.project.readAuthority(endpoint)});
  assert.deepEqual(await list(), [f.definition]);
  const parentStudyId = 'invented-source-free-project';
  const root = await f.native.createCollection({parentStudyId, title: 'Source-free invented inquiry', operationId: randomUUID()});
  await f.bindings.select({projectKey: parentStudyId, title: 'Source-free invented Project', operationId: randomUUID()});
  await f.ownedPhotos.select({bindingId: root.binding.id, parentStudyId, operationId: randomUUID()});
  const parent = await f.bindings.lookup({projectKey: parentStudyId});
  assert.deepEqual(await list(), [f.definition, {workspaceId: parent.projectId, parentStudyId, rootBindingId: root.binding.id}]);
});
