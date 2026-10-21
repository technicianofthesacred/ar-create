import {StateError} from './store.mjs';
import {isICloudAlbum} from './services/icloud-albums.mjs';
import {INQUIRY_METHODS} from './services/inquiry-interface-routes.mjs';

/**
 * One command registry for every entrance: the app, the CLI (agents/cli/ar-create.mjs)
 * and the MCP server (agents/mcp/server.mjs). Each entry:
 *   {name, section, method, route, schema, readOnly, actors, undo?, mount}
 * - route: the HTTP path; {id} marks a path parameter.
 * - schema: a summary of the input — query fields for GET, body fields for POST.
 *   Services remain the authority on validation.
 * - actors: ['any'] or ['human'] (a decision only Adrian makes).

 * - mode: scope (query carries identity; body must not), scope-copy (query and body both carry it), input-json (GET ?input=<json>).
 * - mount: 'map' (dispatched from the route map below) or 'custom' (bespoke
 *   handler in server.mjs: streams, path parameters, query-scoped bodies).
 */
export const SCHEMA = 'ar-create.capabilities.v1';
const HUMAN = Object.freeze(['human']), ANY = Object.freeze(['any']);

/** POST routes that only read. They need no actor. */
export const READ_ONLY_POSTS = new Set(['/api/concept/sources/search', '/api/study-draft/inspect', '/api/study-draft/history-preview', '/api/study/outputs/export-check', '/api/sources/reconnect/preview']);

const UNDO = {
  'POST /api/study-draft/save': 'study-draft.undo', 'POST /api/study-draft/history-restore': 'study-draft.undo',
  'POST /api/study/human-direction/write': 'study.human-direction.undo', 'POST /api/concept/save': 'study.human-direction.undo',
  'POST /api/study/share/save': 'study.share.undo', 'POST /api/study/outputs/save': 'study.outputs.undo',
  'POST /api/source-sessions/edit': 'source-sessions.undo',
  'POST /api/inquiries/references/propose': 'inquiries.references.undo', 'POST /api/inquiries/direction-references/propose': 'inquiries.direction-references.undo',
  'POST /api/inquiries/save': 'inquiries.learning.undo', 'POST /api/inquiries/update': 'inquiries.learning.undo',
  'POST /api/work-continuity/assign': 'work-continuity.undo', 'POST /api/work-continuity/result': 'work-continuity.undo', 'POST /api/work-continuity/complete': 'work-continuity.undo',
};
/** Body fields for the commands agents use most; the rest say 'object'. */
const BODY = {
  '/api/concepts': ['parentStudyId', 'title', 'operationId'],
  '/api/concept/save': ['parentStudyId', 'operationId', 'expectedRevision', 'expectedHash', 'authorThoughts', 'adoptedDirection?', 'aiInterpretation', 'suggestions', 'sourceSelections', 'body?', 'replaceExistingDirection?'],
  '/api/concept/sources/search': ['parentStudyId?', 'query', 'limit?'],
  '/api/study-draft/create-collection': ['parentStudyId', 'title', 'operationId'],
  '/api/study-draft/open': ['parentStudyId', 'originalId', 'originalHash', 'operationId'],
  '/api/study-draft/save': ['bindingId', 'parentStudyId', 'operationId', 'expected', 'operations'],
  '/api/study-draft/undo': ['bindingId', 'parentStudyId', 'operationId', 'expected', 'undoOperationId'],
  '/api/study/human-direction/select': ['parentStudyId', 'scope', 'bindingId?', 'outputId?', 'operationId', 'title'],
  '/api/study/human-direction/write': ['parentStudyId', 'scope', 'bindingId?', 'outputId?', 'operationId', 'expectedRevision', 'expectedHash', 'body'],
  '/api/study/human-direction/undo': ['parentStudyId', 'scope', 'bindingId?', 'outputId?', 'operationId', 'expectedRevision', 'expectedHash', 'undoOperationId'],
  '/api/study-ai/prepare': ['sourceIds'], '/api/study-ai/propose': ['requestId', 'replacements'],
  '/api/study-ai/accept': ['requestId', '...'], '/api/study-ai/reject': ['requestId', 'reason?'],
  '/api/pieces': ['expectedProjectId', 'expectedRevision', 'title'], '/api/pieces/switch': ['expectedProjectId', 'expectedRevision', 'projectId'],
  '/api/presence': ['stage', 'scope:{kind,id}', 'dirty', 'sequence'],
};
function section(route) {
  const r = route.replace(/^\/api\//, '');
  const rules = [[/^(concept|study\/human-direction)/, 'direction'], [/^(sources|collections|collection-relationships|connections|icloud-albums|evidence|study-originals|study\/source-context)/, 'library'], [/^material/, 'material'],
    [/^(study-draft|study-ai)/, 'draft'], [/^(study\/outputs|carousel|article|exports|shared-articles|shared-carousels)/, 'outputs'], [/^study\/share/, 'share'], [/^(study\/photos|study\/media-usage|media)/, 'media'],
    [/^(study-research|research-material|research|first-flow)/, 'research'], [/^(pieces|state)/, 'piece'], [/^(source-sessions|recordings|ingestion|transcript-tools|transcription)/, 'transcript'],
    [/^inquiries/, 'collection'], [/^work-continuity/, 'continuity'], [/^magazine/, 'magazine'], [/^(terminal|ai\/execution|requests|passage)/, 'agent-runtime'], [/^(writing-template|guidance)/, 'writing'],
    [/^(i64os|capabilities|events|presence|leases|journal)/, 'system']];
  return rules.find(([pattern]) => pattern.test(r))?.[1] || 'system';
}
const nameOf = route => route.replace(/^\/api\//, '').replace(/\{(\w+)\}/g, '$1').split('/').join('.');
const VERB = { GET: 'get', POST: 'post', PUT: 'put', DELETE: 'delete', HEAD: 'head' };

/** Commands mounted by bespoke handlers in server.mjs (not the route map). */
export const CUSTOM_COMMANDS = [
  ['GET', '/api/state'], ['PUT', '/api/state'],
  ['GET', '/api/shared-articles/capabilities'], ['GET', '/api/shared-articles/current', ['projectId?', 'allowEditedMarkdown?']], ['GET', '/api/shared-articles/requests', ['projectId?', 'documentId?']],
  ['GET', '/api/shared-articles/requests/{id}'], ['GET', '/api/shared-articles/requests/{id}/external'], ['POST', '/api/shared-articles/requests/{id}/accept'], ['POST', '/api/shared-articles/requests/{id}/reject'],
  ['POST', '/api/shared-articles/prepare'], ['POST', '/api/shared-articles/propose'], ['POST', '/api/shared-articles/recover-external'], ['POST', '/api/shared-articles/launches'], ['GET', '/api/shared-articles/launches/{id}'], ['POST', '/api/shared-articles/launches/{id}/send'],
  ['GET', '/api/shared-carousels/capabilities'], ['GET', '/api/shared-carousels/current', ['projectId', 'documentId', 'outputId', 'allowEditedMarkdown?']], ['GET', '/api/shared-carousels/requests', ['projectId', 'documentId', 'outputId']],
  ['GET', '/api/shared-carousels/requests/{id}', ['projectId', 'documentId', 'outputId']], ['GET', '/api/shared-carousels/requests/{id}/external', ['projectId', 'documentId', 'outputId']],
  ['POST', '/api/shared-carousels/prepare', ['projectId', 'documentId', 'outputId'], 'scope-copy'], ['POST', '/api/shared-carousels/recover-external', ['projectId', 'documentId', 'outputId'], 'scope-copy'], ['POST', '/api/shared-carousels/propose', ['projectId', 'documentId', 'outputId'], 'scope-copy'],
  ['POST', '/api/shared-carousels/requests/{id}/review', ['projectId', 'documentId', 'outputId'], 'scope-copy'], ['POST', '/api/shared-carousels/requests/{id}/accept', ['projectId', 'documentId', 'outputId'], 'scope-copy'], ['POST', '/api/shared-carousels/requests/{id}/reject', ['projectId', 'documentId', 'outputId'], 'scope-copy'],
  ['GET', '/api/passage/revisions/{id}'], ['POST', '/api/passage/revisions/{id}/send'], ['POST', '/api/passage/revisions/{id}/run'],
  ['GET', '/api/research/answers/{id}'], ['GET', '/api/research/answers/{id}/markdown'], ['POST', '/api/research/answers/{id}/run'], ['POST', '/api/research/answers/{id}/keep'],
  ['GET', '/api/article/visual/{id}'], ['POST', '/api/article/visual/{id}/send'], ['POST', '/api/article/visual/{id}/run'],
  ['GET', '/api/article/make/{id}'], ['GET', '/api/article/make/{id}/context'], ['POST', '/api/article/make/{id}/send'], ['POST', '/api/article/make/{id}/run'], ['POST', '/api/article/make/{id}/propose'], ['POST', '/api/article/make/{id}/accept'],
  ['GET', '/api/carousel/make/{id}'], ['POST', '/api/carousel/make/{id}/send'], ['POST', '/api/carousel/make/{id}/run'],
  ['GET', '/api/terminal/sessions/{id}'], ['POST', '/api/terminal/sessions/{id}/input'], ['POST', '/api/terminal/sessions/{id}/resize'], ['POST', '/api/terminal/sessions/{id}/stop'],
  ['GET', '/api/carousel/exports/{id}/render/{index}', ['rootBindingId?', 'parentStudyId?', 'selectedOutputId?']], ['GET', '/api/carousel/exports/{id}/file/{name}', ['rootBindingId?', 'parentStudyId?', 'selectedOutputId?']],
  ['GET', '/api/exports/{id}/file', ['rootBindingId?', 'parentStudyId?', 'selectedOutputId?']], ['GET', '/api/ingestion/raw', ['id', 'file']], ['GET', '/api/study-originals/audio', ['id']], ['GET', '/api/sources/blob', ['id', 'original?']],
  ['POST', '/api/media', ['image bytes (image/jpeg|png|webp)']],
  ['GET', '/transcription/{id}/view'], ['POST', '/transcription/{id}/{action}'],
  ...['read', 'seen', 'assign', 'result', 'complete', 'undo', 'recover', 'context', 'understanding', 'artifacts'].map(op => ['POST', '/api/work-continuity/' + op]),
  ...Object.values(INQUIRY_METHODS).map(([method, path]) => [method, '/api/inquiries' + path, method === 'GET' ? ['input (one JSON selector)'] : undefined, method === 'GET' ? 'input-json' : undefined]),
];
/** POST routes in the custom families that only read. */
const CUSTOM_READ_ONLY = new Set(['POST /api/work-continuity/read', 'POST /api/work-continuity/context', 'POST /api/work-continuity/understanding', 'POST /api/work-continuity/artifacts', 'POST /api/shared-carousels/requests/{id}/review']);
/** Decisions only a human makes. Agents propose; the record says who decided. */
const HUMAN_ONLY = new Set(['POST /api/study-ai/accept', 'POST /api/study-ai/reject', 'POST /api/study-ai/human-contract', 'POST /api/study/share/fact',
  'POST /api/shared-articles/requests/{id}/accept', 'POST /api/shared-articles/requests/{id}/reject', 'POST /api/shared-carousels/requests/{id}/accept', 'POST /api/shared-carousels/requests/{id}/reject',
  'POST /api/article/make/{id}/accept', 'POST /api/inquiries/association/change', 'POST /api/inquiries/references/change', 'POST /api/inquiries/direction-references/change']);

function entry(method, route, { query, mode, mount }) {
  // Manuscript proposals take their identity from the query only; the body must not repeat it.
  if (route.startsWith('/api/study-ai/')) { mode = 'scope'; query = ['bindingId', 'parentStudyId', 'requestId?']; }
  const key = method + ' ' + route, readOnly = method === 'GET' || READ_ONLY_POSTS.has(route) || CUSTOM_READ_ONLY.has(key);
  const pattern = new RegExp('^' + route.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\w+)\\?\}/g, '([^/]+)') + '$');
  return { name: '', section: section(route), method, route, schema: method === 'GET' || mode === 'scope' || mode === 'scope-copy' ? { query: query || [], ...(mode === 'scope-copy' ? { body: 'object (repeats the query scope)' } : mode === 'scope' && method !== 'GET' ? { body: BODY[route] || 'object (identity stays in the query)' } : {}), ...(mode === 'input-json' ? { encoding: 'input-json' } : {}) } : { body: BODY[route] || 'object' },
    readOnly, actors: HUMAN_ONLY.has(key) ? HUMAN : ANY, ...(UNDO[key] ? { undo: UNDO[key] } : {}), mount, ...(mode ? { mode } : {}), pattern };
}
/** Query fields a GET handler reads, recovered from its source. */
const queryFields = fn => [...new Set([...String(fn).matchAll(/searchParams\.(?:get|getAll|has)\('([\w-]+)'\)/g)].map(m => m[1]))];

/** Build the registry: every route-map entry plus every custom route, with unique names. */
export function describeRoutes(routes, extra = []) {
  const list = [];
  for (const [route, methods] of Object.entries(routes)) for (const [method, fn] of Object.entries(methods)) list.push(entry(method, route, { query: method === 'GET' ? queryFields(fn) : undefined, mount: 'map' }));
  for (const [method, route, query, mode] of [...CUSTOM_COMMANDS, ...extra]) list.push(entry(method, route, { query, mode, mount: 'custom' }));
  const byRoute = new Map();for (const e of list) byRoute.set(e.route, (byRoute.get(e.route) || 0) + 1);
  for (const e of list) e.name = nameOf(e.route) + (byRoute.get(e.route) > 1 ? '.' + VERB[e.method] : '');
  const seen = new Set();for (const e of list) { if (seen.has(e.name)) throw new Error('Duplicate command name ' + e.name); seen.add(e.name); }
  // Undo names were written against unsuffixed names; resolve them to real entries.
  for (const e of list) if (e.undo && !seen.has(e.undo)) { const target = list.find(t => t.method === 'POST' && nameOf(t.route) === e.undo); if (target) e.undo = target.name; else delete e.undo; }
  return list;
}
/** The command matching an HTTP method and path (exact routes before patterns). */
export function findCommand(list, method, pathname) {
  return list.find(e => e.method === method && e.route === pathname) || list.find(e => e.method === method && e.route.includes('{') && e.pattern.test(pathname)) || null;
}
/** The registry as JSON for /api/capabilities. */
export const publicEntry = ({ pattern, ...rest }) => rest;

/**
 * The HTTP route map, moved verbatim from server.mjs. bind() is called once per
 * request (as the literal was) with that request's url/request/server, so every
 * handler behaves exactly as before.
 */
export function createRouteMap(services) {
  return function bind({ url, request, server, outputQuery, decorateOutputExports, describe }) {
    const {albums,articleMake,articleVisual,carousel,carouselMake,conceptWork,connectedFolders,createStudyCollection,draftCall,execution,exports,extraction,firstFlow,guardCarouselOutput,guidance,ingestion,library,magazine,magazineRead,materialAlbums,materialFolder,originalRead,passageRevisions,recordings,requests,researchAction,researchAnswers,researchEnabled,researchInput,researchMaterial,sharedArticles,sourceSessions,stampSourceSession,store,studyAI,studyBindings,studyDerivedFindings,studyDraftChecks,studyDrafts,studyHumanDirection,studyMediaUsage,studyOriginals,studyOutputExports,studyOutputs,studyOwnedPhotoBindings,studyPhotos,studyResearchChoices,studyShare,terminal,transcriptTools,writingTemplates} = services;
    const studyAICall=(action,input={})=>draftCall(()=>{
      const scope={};
      for(const key of ['bindingId','parentStudyId']){const values=url.searchParams.getAll(key);if(values.length!==1||!values[0])throw new StateError('Select one exact owned manuscript and parent project.',400);scope[key]=values[0];}
      if([...url.searchParams.keys()].some(key=>!['bindingId','parentStudyId','requestId'].includes(key))||url.searchParams.getAll('requestId').length>1)throw new StateError('Unsupported manuscript proposal query.',400);
      if(Object.keys(input).some(key=>['bindingId','parentStudyId'].includes(key)))throw new StateError('Manuscript identity comes from the explicit route scope.',400);
      const requestId=url.searchParams.get('requestId');if(requestId){if(input.requestId&&input.requestId!==requestId)throw new StateError('Request identity differs from its route.',409);input={...input,requestId};}
      return studyAI.call(action,{...scope,...input});
    });
    const conceptCall=fn=>draftCall(()=>{if(!conceptWork)throw new StateError('Concept work requires configured collections.',503);return fn();});
    const routes = {
      '/api/concept/capabilities': {GET:()=>conceptCall(()=>conceptWork.capabilities())},
      '/api/concepts': {GET:()=>conceptCall(()=>conceptWork.list()),POST:input=>conceptCall(()=>conceptWork.create(input))},
      '/api/concept': {GET:()=>conceptCall(()=>conceptWork.read({parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/concept/save': {POST:input=>conceptCall(()=>conceptWork.save(input))},
      '/api/concept/source': {GET:()=>conceptCall(()=>conceptWork.source({...url.searchParams.has('parentStudyId')?{parentStudyId:url.searchParams.get('parentStudyId')}:{},sourceId:url.searchParams.get('sourceId')}))},
      '/api/concept/sources/search': {POST:input=>conceptCall(()=>conceptWork.sourcesSearch(input))},
      '/api/writing-template': {GET:()=>writingTemplates.get({expectedProjectId:url.searchParams.get('expectedProjectId'),expectedDocumentId:url.searchParams.get('expectedDocumentId')})},
      '/api/writing-template/attach': {POST:input=>writingTemplates.attach(input)},
      '/api/writing-template/detach': {POST:input=>writingTemplates.detach(input)},
      '/api/writing-template/snapshot': {POST:input=>writingTemplates.snapshot(input)},
      '/api/writing-template/restore-copy': {POST:input=>writingTemplates.restoreCopy(input)},
      '/api/magazine/portfolio': {GET:()=>magazineRead(()=>magazine.list())},
      '/api/magazine/artifact': {GET:()=>magazineRead(()=>magazine.read({artifactId:url.searchParams.get('id'),expectedHash:url.searchParams.get('hash')}))},
      '/api/sources/tree': { GET: () => library.tree() },
      '/api/sources/file': { GET: () => library.read(url.searchParams.get('id'),{allowUnreconciled:true}), POST: input => library.write(input) },
      '/api/sources/import': { POST: async input => {
        if (!Array.isArray(input.urls || []) || !Array.isArray(input.files || []) || (input.urls?.length || 0) + (input.files?.length || 0) > 100) throw new StateError('Import up to 100 files or URLs.');
        const albumLinks=(input.urls || []).filter(isICloudAlbum);
        const result=await library.import({...input,urls:(input.urls || []).filter(url=>!isICloudAlbum(url))});
        for(const link of albumLinks) {try {const imported=await albums.import(link);result.receipts.push(...imported.receipts);}catch(error){result.receipts.push({ok:false,url:link,error:error.message});}}
        for (const receipt of result.receipts) if (receipt.ok && receipt.source) { try { await recordings.retain(receipt.source); } catch (error) { receipt.recordingError = error.message; } }
        return result;
      } },
      '/api/icloud-albums': { GET: () => albums.list() },
      '/api/sources/rename': { POST: input => library.rename(input) },
      '/api/sources/reconnect/preview': {POST:input=>library.reconnectPreview(input)},
      '/api/sources/reconnect': {POST:input=>library.reconnectMoved(input)},
      '/api/sources/folders': { POST: input => library.folder(input) },
      '/api/collections': { GET: () => library.collections(), POST: input => library.saveCollection(input) },
      '/api/collection-relationships': {GET:()=>library.collectionRelationships(url.searchParams.get('collectionId'))},
      '/api/collection-relationships/link': {POST:input=>library.linkCollections(input)},
      '/api/collection-relationships/detach': {POST:input=>library.detachCollectionRelationship(input)},
      '/api/connections': {GET:()=>connectedFolders.list(),POST:input=>connectedFolders.add(input),DELETE:input=>connectedFolders.remove(input)},
      '/api/guidance': { GET: () => guidance.get(), POST: input => guidance.put(input) },
      '/api/evidence': { GET: () => library.evidence(), POST: input => library.saveEvidence(input) },
      '/api/terminal/capabilities': { GET: () => terminal.capabilities() },
      '/api/terminal/sessions': { GET: () => terminal.list(), POST: input => terminal.start(input) },
      '/api/pieces': {GET:()=>store.listPieces(),POST:input=>store.createPiece(input)},
      '/api/i64os/health': {GET:()=>{if(!studyDrafts)throw new StateError('Document study is not configured.',503);return {service:'ar-create-document-study',ready:true};}},
      '/api/study-ai/contracts': {GET:()=>studyAICall('contracts')},
      '/api/study-ai/human-contract': {POST:input=>studyAICall('humanContract',input)},
      '/api/study-ai/read': {GET:()=>studyAICall('read')},
      '/api/study-ai/prepare': {POST:input=>studyAICall('prepare',input)},
      '/api/study-ai/context': {GET:()=>studyAICall('context')},
      '/api/study-ai/propose': {POST:input=>studyAICall('propose',input)},
      '/api/study-ai/review': {GET:()=>studyAICall('review')},
      '/api/study-ai/requests': {GET:()=>studyAICall('list')},
      '/api/study-ai/accept': {POST:input=>studyAICall('accept',input)},
      '/api/study-ai/reject': {POST:input=>studyAICall('reject',input)},
      '/api/study/human-direction': {GET:()=>draftCall(()=>studyHumanDirection.read({parentStudyId:url.searchParams.get('parentStudyId'),scope:url.searchParams.get('scope')||'project',...(url.searchParams.has('bindingId')?{bindingId:url.searchParams.get('bindingId')}:{}),...(url.searchParams.has('outputId')?{outputId:url.searchParams.get('outputId')}:{})}))},
      '/api/study/human-direction/select': {POST:input=>draftCall(()=>studyHumanDirection.select(input))},
      '/api/study/human-direction/write': {POST:input=>draftCall(()=>studyHumanDirection.write(input))},
      '/api/study/human-direction/undo': {POST:input=>draftCall(()=>studyHumanDirection.undo(input))},
      '/api/study-originals': {GET:()=>originalRead(()=>studyOriginals.list(url.searchParams.get('projectKey')))},
      '/api/study/photos/select': {POST:input=>draftCall(()=>studyOwnedPhotoBindings.select(input))},
      '/api/study/photos': {GET:()=>draftCall(()=>studyPhotos.list({projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId')}))},
      '/api/study/photos/available': {GET:()=>draftCall(()=>studyPhotos.available({projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId')}))},
      '/api/study/photos/add': {POST:input=>draftCall(()=>studyPhotos.add(input))},
      '/api/study/photos/update': {POST:input=>draftCall(()=>studyPhotos.update(input))},
      '/api/study-research/findings': {GET:()=>draftCall(()=>studyDerivedFindings.read({projectKey:url.searchParams.get('projectKey'),parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/study-research/choices': {GET:()=>draftCall(()=>studyResearchChoices.read({projectKey:url.searchParams.get('projectKey'),bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')})),POST:input=>draftCall(()=>studyResearchChoices.save(input))},
      '/api/study-draft/root-recovery': {GET:()=>draftCall(()=>studyDrafts.inspectRoots({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')})),POST:input=>draftCall(()=>studyDrafts.recoverRoots(input))},
      '/api/study/source-context': {GET:async()=>{if([...url.searchParams.keys()].some(key=>key!=='id')||url.searchParams.getAll('id').length!==1)throw new StateError('Select one existing Library source.',400);const source=await library.snapshot(url.searchParams.get('id'),{includeBody:true});return {sourceId:source.id,hash:source.hash,title:source.title||source.name||'Source',text:typeof source.text==='string'?source.text:null,missing:!!source.missing};}},
      '/api/study/media-usage': {GET:()=>draftCall(()=>{if(!studyMediaUsage)throw new StateError('Saved media usage is unavailable.',503);const input=Object.fromEntries(url.searchParams);input.sourceIds=url.searchParams.getAll('sourceId');delete input.sourceId;return studyMediaUsage.read(input);})},
      '/api/study/media-usage/resolve': {GET:()=>draftCall(()=>{if(!studyMediaUsage)throw new StateError('Saved media usage is unavailable.',503);return studyMediaUsage.resolve(Object.fromEntries(url.searchParams));})},
      '/api/study/share/recipients': {GET:()=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.list(Object.fromEntries(url.searchParams));})},
      '/api/study/share': {GET:()=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.read(Object.fromEntries(url.searchParams));})},
      '/api/study/share/save': {POST:input=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.save(input);})},
      '/api/study/share/fact': {POST:input=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.appendFact(input);})},
      '/api/study/share/undo': {POST:input=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.undo(input);})},
      '/api/study/outputs': {GET:()=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.read({rootBindingId:url.searchParams.get('rootBindingId'),parentStudyId:url.searchParams.get('parentStudyId'),...(url.searchParams.has('selectedOutputId')?{selectedOutputId:url.searchParams.get('selectedOutputId')}:{})});})},
      '/api/study/outputs/review-words': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.reviewCarouselWords(input);})},
      '/api/study/outputs/export': {POST:input=>draftCall(async()=>{if(!studyOutputExports)throw new StateError('Output exports are not enabled.',503);const {kind,...payload}=input;if(!['article','carousel','post','product-listing'].includes(kind))throw new StateError('Choose a supported output export.',400);const result=kind!=='carousel'?await studyOutputExports.saveArticle(payload):await studyOutputExports.saveCarousel(payload,'http://127.0.0.1:'+server.address().port);return decorateOutputExports(result,input);})},
      '/api/study/outputs/exports': {GET:()=>draftCall(async()=>{if(!studyOutputExports)throw new StateError('Output exports are not enabled.',503);const input=outputQuery();return decorateOutputExports(await studyOutputExports.list(input),input);})},
      '/api/study/outputs/create': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.create(input);})},
      '/api/study/outputs/save': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.save(input);})},
      '/api/study/outputs/refresh': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.refreshSelectedArticle(input);})},
      '/api/study/outputs/undo': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.undo(input);})},
      '/api/study/outputs/export-check': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.assertExport(input);})},
      '/api/study-draft/catalog': {GET:()=>draftCall(()=>studyDrafts.catalog())},
      '/api/study-draft/read': {GET:()=>draftCall(()=>studyDrafts.read({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/study-draft/create-collection': {POST:input=>draftCall(()=>createStudyCollection(input))},
      '/api/study-draft/open': {POST:input=>draftCall(()=>studyDrafts.openCopy(input))},
      '/api/study-draft/save': {POST:input=>draftCall(()=>studyDrafts.save(input))},
      '/api/study-draft/history-preview': {POST:input=>draftCall(()=>studyDrafts.previewVersion(input))},
      '/api/study-draft/history-restore': {POST:input=>draftCall(()=>studyDrafts.restoreVersion(input))},
      '/api/study-draft/undo': {POST:input=>draftCall(()=>studyDrafts.undo(input))},
      '/api/study-draft/inspect': {GET:()=>draftCall(()=>studyDrafts.inspect({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId'),operationId:url.searchParams.get('operationId')})),POST:input=>draftCall(()=>studyDrafts.inspect(input))},
      '/api/study-draft/recover': {POST:input=>draftCall(()=>studyDrafts.recover(input))},
      '/api/study-draft/check': {GET:()=>draftCall(()=>studyDraftChecks.read({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId'),...(url.searchParams.has('checkId')?{checkId:url.searchParams.get('checkId')}:{})})),POST:input=>draftCall(()=>studyDraftChecks.run(input))},

      '/api/source-sessions': {GET:()=>{if(!sourceSessions)throw new StateError('Kept conversation editing is not connected in this workspace.',503);return sourceSessions.list();}},
      '/api/source-sessions/edit': {POST:input=>{if(!sourceSessions)throw new StateError('Kept conversation editing is not connected in this workspace.',503);return stampSourceSession('edit',input);}},
      '/api/source-sessions/undo': {POST:input=>{if(!sourceSessions)throw new StateError('Kept conversation editing is not connected in this workspace.',503);return stampSourceSession('undo',input);}},
      '/api/material/folder/open': {POST:input=>materialFolder.open(input)},
      '/api/material/album': {POST:input=>materialAlbums.add(input)},
      '/api/first-flow/binding': {GET:()=>studyBindings.lookup({projectKey:url.searchParams.get('projectKey')})},
      '/api/first-flow/select': {POST:input=>studyBindings.select(input)},
      '/api/first-flow': {GET:async()=>({...await firstFlow.get({projectId:url.searchParams.get('projectId')||store.get().project.id}),researchAvailable:researchEnabled})},
      '/api/first-flow/source-review': {POST:input=>firstFlow.reviewSources(input)},
      '/api/first-flow/attach': {POST:input=>firstFlow.attach(input)},
      '/api/first-flow/prepare': {POST:researchAction(input=>firstFlow.prepare(input))},
      '/api/first-flow/run': {POST:researchAction(input=>firstFlow.run(input))},
      '/api/first-flow/pick': {POST:researchAction(input=>firstFlow.pick(input))},
      '/api/first-flow/check': {POST:researchAction(input=>firstFlow.check(input))},
      '/api/first-flow/decide-line': {POST:researchAction(input=>firstFlow.decideLine(input))},
      '/api/first-flow/reinspect': {POST:researchAction(input=>firstFlow.reinspect(input))},
      '/api/pieces/switch': {POST:input=>store.switchPiece(input)},
      '/api/research-material': {GET:()=>researchMaterial.list(store.get().project.id)},
      '/api/research-material/claim': {POST:input=>researchMaterial.saveClaim(researchInput(input))},
      '/api/research-material/account': {POST:input=>researchMaterial.saveAccount(researchInput(input))},
      '/api/research-material/concept': {POST:input=>researchMaterial.saveConcept(researchInput(input))},
      '/api/research-material/position': {POST:input=>researchMaterial.savePosition(researchInput(input))},
      '/api/research-material/preview': {POST:input=>researchMaterial.previewImport(researchInput(input))},
      '/api/research-material/import': {POST:input=>researchMaterial.import(researchInput(input))},
      '/api/research-material/inherit': {POST:input=>researchMaterial.inherit(researchInput(input))},
      '/api/research-material/review': {POST:input=>researchMaterial.review(researchInput(input))},
      '/api/requests/preview': { POST: input => requests.preview(input) },
      '/api/requests/recent': { GET: () => requests.recent() },
      '/api/exports': { GET: () => exports.list(), POST: async input => {await guardCarouselOutput(input);return exports.save(input);} },
      '/api/research/answers/recent': {GET:()=>researchAnswers.recent(url.searchParams.get('projectId')||store.get().project.id)},
      '/api/research/answers/preview': {POST:input=>researchAnswers.preview(researchInput(input))},
      '/api/ai/execution/capabilities': {GET:()=>execution.capabilities()},
      '/api/passage/revisions/recent': {GET:()=>passageRevisions.recent()},
      '/api/passage/revisions/preview': {POST:input=>passageRevisions.preview(input)},
      '/api/article/visual/recent': {GET:()=>articleVisual.recent()},
      '/api/article/visual/preview': {POST:input=>articleVisual.preview(input)},
      '/api/article/make/recent': {GET:()=>articleMake.recent()},
      '/api/article/make/preview': {POST: input => articleMake.preview(input, `http://${request.headers.host}`)},
      '/api/carousel/make/recent': {GET:()=>carouselMake.recent()},
      '/api/carousel/make/preview': {POST: async input => {if(input.stage==='look')await guardCarouselOutput(input);return carouselMake.preview(input);}},
      '/api/carousel/exports': {GET:()=>carousel.list(),POST:async input=>{await guardCarouselOutput(input);return carousel.save(input,`http://${request.headers.host}`);}},
      '/api/ingestion': { GET: () => ingestion.list() },
      '/api/ingestion/retry': { POST: input => ingestion.retry(input.id) },
      '/api/transcript-tools/connect': {POST:input=>transcriptTools.connect(input,url.origin)},
      '/api/recordings': { GET: () => recordings.list() },
      '/api/capabilities': { GET: async () => ({ library: 'file-backed', webExtraction: { configured: true, backend: extraction ? 'WordForge Firecrawl' : 'i64os Readability', local: ingestion.capabilities.article }, youtube: ingestion.capabilities.youtube, transcription: (await recordings.list()).capability, guidance: 'shared-own-files', sharedArticles: {enabled:sharedArticles}, ...await describe() }) },
    };
    return routes;
  };
}
