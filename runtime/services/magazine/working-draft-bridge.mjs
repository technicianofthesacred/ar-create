// Adapter only: Magazine remains the sole writer, lock, proposal and receipt owner.
// Server composition supplies `magazine` (createMagazineVault) and, optionally,
// `editions.read({storyId,pieceId,editionId})`, an exact immutable-edition reader.
// Requests supply identities, never paths, authority, actor overrides or snapshots.
//
// read -> {selection, authority, editable, unavailableReason, document, paragraphs}
// edit -> Magazine's paragraph result (donor index + 12-hex seen hash, not retained IDs).
// save -> Magazine's whole-file CAS/proposal result (64-hex expectedHash).
// operation/eligibleUndo/undo -> the same Magazine receipts; no local history/cache.
// Paragraph edits deliberately use Magazine's paragraph concurrency contract; full
// file replacement uses save. An unrelated paragraph change need not block edit.
import {StateError} from '../../store.mjs';
import {currentActor, isHuman, requireHuman, requireWriteActor} from '../actor.mjs';
import {classify, frontmatter} from '../magazine-vault/kinds.mjs';
import {expected, sha256, textBytes} from '../magazine-vault/write.mjs';
import {splitBlocks, hash, plain, editable} from '../../reference/mag-edit.mjs';
import {parseFeedbackShare, updateFeedbackShareSection} from './feedback-share-codec.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BASE = ['storyId', 'pieceId', 'edition', 'editionId'];
function fields(input, extra = []) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StateError('Send a JSON object.', 400);
  if (Object.keys(input).some(k => ![...BASE, ...extra].includes(k))) throw new StateError('Unsupported bridge field. Send exact identities, not paths or authority.', 400);
  for (const k of ['storyId', 'pieceId', 'edition']) if (typeof input[k] !== 'string' || !input[k]) throw new StateError(`${k} is required.`, 400);
  if (!['working', 'published', 'historical'].includes(input.edition)) throw new StateError('Choose the working draft or an exact earlier edition.', 400);
  if (input.edition === 'working' ? input.editionId !== undefined : typeof input.editionId !== 'string' || !input.editionId) throw new StateError('Only earlier editions take an exact editionId.', 400);
}
function uuid(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new StateError('operationId must be a UUID.', 400);
}
function workingOnly(input) {
  if (input?.edition !== 'working') throw new StateError('Earlier and published editions are read-only. Return to the working draft to edit.', 403);
}
const select = input => Object.fromEntries(BASE.filter(k => input[k] !== undefined).map(k => [k, input[k]]));

export function createWorkingDraftBridge({magazine, editions = null, journal = null, photoLibrary = null} = {}) {
  if (!magazine?.projects || !magazine.read || !magazine.write || !magazine.edit || !magazine.operation || !magazine.undo) throw new TypeError('Supply the maintained Magazine owner.');

  function registrationRoot(status = magazine.status()) {
    const index = magazine.projects.index();
    if (!index) return null;
    if (!status.configured || !status.vaultRoot) throw new StateError('The registered Magazine folder is not configured.', 503);
    if (typeof index.vaultRoot !== 'string' || !path.isAbsolute(index.vaultRoot)) throw new StateError('Magazine registration has no verified canonical folder. Nothing was written.', 409);
    let registered, configured;
    try { registered = fs.realpathSync(index.vaultRoot); configured = fs.realpathSync(status.vaultRoot); }
    catch { throw new StateError('The Magazine registration folder is unavailable. Nothing was written.', 409); }
    // Use the maintained writer's captured root too; changing a configured alias
    // cannot turn an already-open owner into a writer over another directory.
    const captured = magazine._roots().mag.root.real;
    if (registered !== configured || captured !== configured) throw new StateError('Magazine registration belongs to a different canonical folder. Nothing was written.', 409);
    return configured;
  }

  function catalog(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new StateError('Working draft discovery accepts no caller selectors.', 400);
    const status = magazine.status(), registered = magazine.projects.list();
    if (registered.registered) registrationRoot(status);
    const rootIdentity = status.configured && status.vaultRoot ? {scheme: 'canonical-directory-sha256-v1', fingerprint: sha256(Buffer.from(fs.realpathSync(status.vaultRoot), 'utf8'))} : null;
    if (registered.stories.length > 256) throw new StateError('Working draft discovery exceeds its bounded story limit.', 413);
    const stories = registered.stories.map(row => {
      const project = magazine.projects.project(row.storyId);
      if (project.storyId !== row.storyId || project.pieces.length > 512) throw new StateError('Registered story identity is inconsistent or exceeds its bounded piece limit.', 409);
      const pieces = project.pieces.filter(piece => ['article', 'article-part'].includes(piece.kind) && piece.rel && classify(piece.rel).kind === 'DEV' && [].concat(project.vaultRecords.draft || []).some(record => record.rel === piece.rel)).map(piece => {
        const file = magazine.read({path: piece.rel});
        return {pieceId: piece.pieceId, kind: piece.kind, part: piece.part || null, relativePath: piece.rel, hash: file.exists ? file.hash : null, editable: !!status.writable && file.exists && !file.conflicts?.length};
      });
      return {storyId: project.storyId, archived: !!project.archived, pieces};
    });
    return {schema: 'ar-create.magazine-working-catalog.v1', configured: !!status.configured, writable: !!status.writable, rootIdentity, registered: !!registered.registered, stories};
  }

  function resolve(input) {
    // project() also accepts names; gate it through exact registered IDs first.
    const rows = magazine.projects.list();
    if (!rows.registered || !rows.stories.some(p => p.storyId === input.storyId)) throw new StateError('This story is not registered for Magazine editing yet.', 404);
    registrationRoot();
    const project = magazine.projects.project(input.storyId);
    if (project.storyId !== input.storyId || project.archived) throw new StateError('This is not an active registered story.', 409);
    const pieces = project.pieces.filter(p => p.pieceId === input.pieceId);
    if (pieces.length !== 1) throw new StateError('Choose one exact registered piece.', pieces.length ? 409 : 404);
    const piece = pieces[0];
    if (!['article', 'article-part'].includes(piece.kind) || !piece.rel || ![].concat(project.vaultRecords.draft || []).some(r => r.rel === piece.rel) || classify(piece.rel).kind !== 'DEV') throw new StateError('This piece has no established working DEV identity.', 409);
    return {kind: 'magazine', storyId: project.storyId, pieceId: piece.pieceId, path: piece.rel, title: project.name, partKey: piece.part || 'article'};
  }
  function writable() {
    if (!magazine.configured || !magazine.writable) throw new StateError('Magazine editing is unavailable: the maintained owner must be configured and writable.', 503);
  }
  function mutation(input, extra) {
    workingOnly(input); fields(input, extra); requireWriteActor();
    const authority = resolve(input); writable(); return authority;
  }
  async function read(input) {
    fields(input);
    if (input.edition !== 'working') {
      if (!editions?.read) throw new StateError('The earlier-edition reader is not connected.', 503);
      const document = await editions.read({storyId: input.storyId, pieceId: input.pieceId, editionId: input.editionId});
      if (BASE.some(k => document?.[k] !== input[k]) || typeof document.text !== 'string' || sha256(Buffer.from(document.text, 'utf8')) !== document.hash) throw new StateError('The edition reader did not resolve this exact immutable edition.', 409);
      return {selection: select(input), authority: {kind: 'immutable-edition', editionId: input.editionId}, editable: false, unavailableReason: 'This is an earlier read-only edition.', document: {text: document.text, hash: document.hash}, paragraphs: []};
    }
    const authority = resolve(input), document = await magazine.read({path: authority.path});
    if (!document.exists || typeof document.text !== 'string' || document.kind !== 'DEV') throw new StateError('The registered working draft is missing or unreadable.', 409);
    const title = frontmatter(document.text).meta.title;
    if (typeof title === 'string' && title.trim()) authority.title = title;
    const unavailableReason = !magazine.configured || !magazine.writable ? 'Magazine is read-only. Its designated owner must enable editing.' : document.conflicts?.length ? 'Conflicting files need a human choice before saving.' : null;
    const {parts} = splitBlocks(document.text);
    const paragraphs = [];
    for (let k = 0; k < parts.length; k += 2) if (editable(parts[k])) paragraphs.push({block: k / 2, seen: hash(parts[k]), text: plain(parts[k])});
    const native = await import('../draft-correspondence.mjs');
    const model = native.capture(document.text, authority.pieceId);
    // These are revision-scoped native projection identities, never retained
    // publication IDs or a second persisted correspondence/binding authority.
    model.blocks.forEach((block, i) => { block.id = 'magazine:' + encodeURIComponent(authority.pieceId) + ':' + i; });
    const projection = native.projection(model).map((row, i) => ({...row, raw: model.blocks[i].raw}));
    return {selection: select(input), authority, editable: !unavailableReason, unavailableReason, document, paragraphs, projection, supportedNativeOperations: (native.supportedNativeOperations || []).filter(kind=>kind!=='photoReplaceAsset'||photoLibrary), history: await historyFor(authority)};
  }
  // References only: Share reads the existing owners, never creates an edition,
  // recipient, message store or another copy of the working manuscript.
  async function shareContext(input) {
    workingOnly(input); fields(input, ['expectedHash']);
    const expectedHash = expected(input.expectedHash);
    if (expectedHash === null) throw new StateError('Share context requires the exact current working draft hash.', 400);
    const authority = resolve(input), root = registrationRoot();
    const project = magazine.projects.project(input.storyId), registration = JSON.stringify(project);
    const kinds = {feedback: 'FEEDBACK', context: 'CONTEXT', research: 'RESEARCH'};
    const references = {}, seen = new Set(), snapshots = [];
    // The public reader omits conflict metadata when the primary is missing.
    const hasConflicts = rel => magazine._roots().mag.conflictCopies(rel).length > 0;
    async function inspect(rel, kind) {
      const document = await magazine.read({path: rel});
      if (document.path !== rel || document.kind !== kind || document.conflicts?.length || hasConflicts(rel)) throw new StateError('A registered Share file is inconsistent or has conflicting copies. Resolve it before continuing.', 409);
      if (document.exists && !/^[a-f0-9]{64}$/.test(document.hash || '')) throw new StateError('A registered Share file has no exact current hash.', 409);
      snapshots.push({rel, kind, document});
      return document;
    }
    const draft = await inspect(authority.path, 'DEV');
    if (!draft.exists || typeof draft.text !== 'string' || draft.hash !== expectedHash) throw new StateError('The working draft changed or is unreadable. Read it again before preparing Share.', 409);
    for (const [key, kind] of Object.entries(kinds)) {
      references[key] = [];
      for (const record of [].concat(project.vaultRecords[key] || [])) {
        if (!record || typeof record.rel !== 'string' || classify(record.rel).kind !== kind || !/^[a-f0-9]{64}$/.test(record.sha256 || '') || seen.has(record.rel)) throw new StateError('The registered Share references are inconsistent.', 409);
        seen.add(record.rel);
        if (seen.size > 512) throw new StateError('Share context exceeds its bounded registered-reference limit.', 413);
        const current = await inspect(record.rel, kind), readable = current.exists && typeof current.text === 'string';
        const currentHash = current.exists ? current.hash : null, changedSinceRegistration = currentHash !== record.sha256;
        references[key].push({path: record.rel, kind, registeredHash: record.sha256, currentHash, readable, changedSinceRegistration,
          state: !current.exists ? 'missing' : !readable ? 'unreadable' : changedSinceRegistration ? 'changed-since-registration' : 'current'});
      }
    }
    // Re-read each selected file and registration after collecting references.
    // A stable registration hash is historical evidence, never current authority.
    for (const {rel, kind, document} of snapshots) {
      const current = await magazine.read({path: rel});
      if (current.path !== rel || current.kind !== kind || current.exists !== document.exists || current.hash !== document.hash || current.text !== document.text || current.conflicts?.length || hasConflicts(rel)) throw new StateError('A Share file changed while reading. Read it again before continuing.', 409);
    }
    const currentAuthority = resolve(input);
    if (registrationRoot() !== root || JSON.stringify(currentAuthority) !== JSON.stringify(authority) || JSON.stringify(magazine.projects.project(input.storyId)) !== registration) throw new StateError('The Share registration changed while reading. Read it again before continuing.', 409);
    return {schema: 'ar-create.magazine-share-context.v1', selection: select(input), authority,
      rootIdentity: {scheme: 'canonical-directory-sha256-v1', fingerprint: sha256(Buffer.from(root, 'utf8'))},
      draft: {path: authority.path, hash: draft.hash}, references};
  }
  // An exact registered reference selector, never a caller-granted file path.
  // This read grants no FEEDBACK write, proposal acceptance or sending authority.
  async function readShareFeedback(input) {
    workingOnly(input); fields(input, ['expectedHash', 'registeredFeedbackPath', 'expectedFeedbackHash']);
    const draftHash = expected(input.expectedHash), feedbackHash = expected(input.expectedFeedbackHash);
    if (draftHash === null || feedbackHash === null) throw new StateError('Read the exact current working draft and FEEDBACK hashes first.', 400);
    const authority = resolve(input), root = registrationRoot();
    const project = magazine.projects.project(input.storyId), registration = JSON.stringify(project);
    const records = [].concat(project.vaultRecords.feedback || []);
    if (records.length > 512) throw new StateError('The registered FEEDBACK list exceeds its bounded limit.', 413);
    const matches = records.filter(record => record?.rel === input.registeredFeedbackPath);
    if (typeof input.registeredFeedbackPath !== 'string' || matches.length !== 1) throw new StateError('Choose one exact registered FEEDBACK reference.', matches.length > 1 ? 409 : 404);
    const record = matches[0];
    if (classify(record.rel).kind !== 'FEEDBACK' || !/^[a-f0-9]{64}$/.test(record.sha256 || '')) throw new StateError('The registered FEEDBACK identity is inconsistent.', 409);
    async function exactDocument(rel, kind, currentHash) {
      const document = await magazine.read({path: rel});
      if (document.path !== rel || !document.exists || document.kind !== kind || typeof document.text !== 'string' || document.hash !== currentHash || document.conflicts?.length || magazine._roots().mag.conflictCopies(rel).length) throw new StateError('The selected working draft or FEEDBACK changed, is unreadable or has conflicts. Read its current references again.', 409);
      return document;
    }
    const draft = await exactDocument(authority.path, 'DEV', draftHash);
    const document = await exactDocument(record.rel, 'FEEDBACK', feedbackHash);
    // A full canonical Markdown read must round-trip to the owner's byte hash.
    // The maintained public reader strips a UTF-8 BOM; refuse that unsupported
    // representation rather than silently returning changed canonical bytes.
    if (sha256(Buffer.from(document.text, 'utf8')) !== feedbackHash) throw new StateError('The FEEDBACK reader did not return the exact canonical Markdown bytes.', 409);
    const parsed = parseFeedbackShare(document.text);
    const targetMatches = parsed.structured && parsed.projection.every(entry => entry.target.storyId === authority.storyId && entry.target.pieceId === authority.pieceId && entry.target.edition === 'working' && entry.target.hash === draftHash);
    const mapping = parsed.structured && !targetMatches
      ? {structured: false, metadata: parsed.metadata, projection: [], reason: 'The saved recipient mapping targets another piece or an earlier working revision. The full FEEDBACK remains readable.'}
      : {structured: parsed.structured, metadata: parsed.metadata, projection: parsed.projection, reason: parsed.reason};
    const currentFeedback = await exactDocument(record.rel, 'FEEDBACK', feedbackHash);
    const currentDraft = await exactDocument(authority.path, 'DEV', draftHash);
    const currentAuthority = resolve(input);
    if (currentFeedback.text !== document.text || currentDraft.text !== draft.text || registrationRoot() !== root || JSON.stringify(currentAuthority) !== JSON.stringify(authority) || JSON.stringify(magazine.projects.project(input.storyId)) !== registration) throw new StateError('The FEEDBACK registration or selected files changed while reading. Read the exact references again.', 409);
    return {schema: 'ar-create.magazine-share-feedback.v1', selection: select(input), authority,
      rootIdentity: {scheme: 'canonical-directory-sha256-v1', fingerprint: sha256(Buffer.from(root, 'utf8'))},
      draft: {path: authority.path, hash: draftHash},
      feedback: {path: record.rel, hash: feedbackHash, registeredHash: record.sha256, changedSinceRegistration: record.sha256 !== feedbackHash},
      document: {path: record.rel, kind: 'FEEDBACK', hash: feedbackHash, text: document.text}, mapping, readOnly: true};
  }
  const feedbackFields = ['expectedHash', 'registeredFeedbackPath', 'expectedFeedbackHash'];
  const feedbackContextKey = value => JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
  const sameFeedbackContext = (a,b) => feedbackContextKey(a) === feedbackContextKey(b);
  function feedbackWriteSelection(input) {
    const draftHash=expected(input.expectedHash), feedbackHash=expected(input.expectedFeedbackHash);
    if(draftHash===null||feedbackHash===null)throw new StateError('FEEDBACK editing requires existing exact draft and feedback hashes.',400);
    const authority=resolve(input),root=registrationRoot(),project=magazine.projects.project(input.storyId);
    const feedbackRecords=[].concat(project.vaultRecords.feedback||[]);
    if(feedbackRecords.length>512)throw new StateError('Registered FEEDBACK exceeds its bounded limit.',413);
    const matches=feedbackRecords.filter(record=>record?.rel===input.registeredFeedbackPath);
    if(typeof input.registeredFeedbackPath!=='string'||matches.length!==1)throw new StateError('Choose one exact registered FEEDBACK reference.',matches.length>1?409:404);
    const record=matches[0];
    if(classify(record.rel).kind!=='FEEDBACK'||!/^[a-f0-9]{64}$/.test(record.sha256||''))throw new StateError('Registered FEEDBACK identity is inconsistent.',409);
    return {authority,registration:JSON.stringify(project),context:{schema:'ar-create.magazine-feedback-write-context.v1',rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:sha256(Buffer.from(root,'utf8'))},selection:select(input),draft:{path:authority.path,hash:draftHash},feedback:{path:record.rel,hash:feedbackHash,registeredHash:record.sha256}}};
  }
  function assertFeedbackCurrent(input,selection) {
    const current=feedbackWriteSelection(input);
    if(!sameFeedbackContext(current.context,selection.context)||current.registration!==selection.registration)throw new StateError('FEEDBACK registration changed before saving.',409);
    for(const [kind,ref]of [['DEV',selection.context.draft],['FEEDBACK',selection.context.feedback]]){
      const document=magazine.read({path:ref.path});
      if(document?.then)throw new StateError('FEEDBACK currentness requires the synchronous maintained reader.',503);
      if(!document.exists||document.kind!==kind||document.path!==ref.path||typeof document.text!=='string'||document.hash!==ref.hash||document.conflicts?.length||magazine._roots().mag.conflictCopies(ref.path).length||kind==='FEEDBACK'&&sha256(Buffer.from(document.text,'utf8'))!==ref.hash)throw new StateError(kind+' changed, is unreadable or has conflicts. Compare before saving FEEDBACK.',409);
    }
  }
  async function prepareShareFeedback(input) {
    workingOnly(input);fields(input,[...feedbackFields,'content']);requireWriteActor();writable();
    const selection=feedbackWriteSelection(input);assertFeedbackCurrent(input,selection);textBytes(input.content);
    const parsed=parseFeedbackShare(input.content),current=parsed.structured&&parsed.projection.every(entry=>entry.target.storyId===selection.authority.storyId&&entry.target.pieceId===selection.authority.pieceId&&entry.target.hash===input.expectedHash);
    return {selection:select(input),rootIdentity:selection.context.rootIdentity,authority:selection.authority,registeredFeedbackPath:selection.context.feedback.path,expectedHash:input.expectedHash,expectedFeedbackHash:input.expectedFeedbackHash,content:input.content,mapping:{structured:!!current,metadata:parsed.metadata,projection:current?parsed.projection:[],reason:parsed.structured&&!current?'The mapping targets another piece or earlier working revision. Full Markdown editing remains available.':parsed.reason}};
  }
  async function readShareFeedbackEditModel(input) {
    const view=await readShareFeedback(structuredClone(input)),{fm,parts}=splitBlocks(view.document.text);
    if((parts.length+1)/2>5000)throw new StateError('FEEDBACK exceeds the bounded paragraph limit.',413);
    const unsupported=view.document.text.startsWith('---\r\n')&&!fm;
    const paragraphs=[];
    for(let k=0;k<parts.length;k+=2)paragraphs.push({index:k/2,seen:hash(parts[k]),text:plain(parts[k]),raw:parts[k],editable:editable(parts[k])});
    const available=!!magazine.configured&&!!magazine.writable&&!unsupported;
    return {...view,schema:'ar-create.magazine-share-feedback-edit-model.v1',paragraphs,editable:available,unavailableReason:unsupported?'The existing paragraph editor cannot preserve this frontmatter representation.':available?null:'Magazine is read-only. Its designated owner must enable editing.'};
  }
  async function prepareShareFeedbackParagraph(input) {
    workingOnly(input);fields(input,[...feedbackFields,'block','seen','text']);input=structuredClone(input);requireWriteActor();requireHuman('Preparing FEEDBACK paragraph corrections');writable();
    if(!Number.isSafeInteger(input.block)||input.block<0||!/^[a-f0-9]{12}$/.test(input.seen||'')||typeof input.text!=='string'||input.text.length>200000)throw new StateError('Use an exact donor paragraph index/hash and bounded text.',400);
    const selection=feedbackWriteSelection(input);assertFeedbackCurrent(input,selection);
    if(typeof magazine.prepareFeedbackParagraph!=='function')throw new StateError('The maintained FEEDBACK paragraph preparation owner is unavailable.',503);
    const document=magazine.read({path:selection.context.feedback.path}),original=document.text,{fm,parts}=splitBlocks(original);
    const k=input.block*2,raw=parts[k];
    if(raw===undefined||hash(raw)!==input.seen||!editable(raw))throw new StateError('The selected FEEDBACK paragraph changed or cannot be edited.',409);
    let start=fm.length;for(let i=0;i<k;i++)start+=parts[i].length;
    const end=start+raw.length,parsed=parseFeedbackShare(original);
    const candidate=magazine.prepareFeedbackParagraph({path:selection.context.feedback.path,expectedHash:input.expectedFeedbackHash,block:input.block,seen:input.seen,text:input.text});
    let content=candidate.content;
    if(content!==original&&parsed.structured){
      const anchored=parsed.projection.flatMap(entry=>entry.sections.map(section=>({entry,section}))).filter(({section})=>start<section.end&&end>section.start);
      if(anchored.length){
        if(anchored.length!==1||start<anchored[0].section.start||end>anchored[0].section.end||start===anchored[0].section.start)throw new StateError('Recipient/language headings keep their recorded identity. Edit the message paragraph instead.',409);
        const {entry,section}=anchored[0],sectionContent=content.slice(section.start,section.end+content.length-original.length);
        const updated=updateFeedbackShareSection(original,{expectedHash:input.expectedFeedbackHash,recipientId:entry.recipientId,target:entry.target,language:section.language,expectedSectionHash:section.hash,content:sectionContent});
        const change=updated.metadataChange;
        const donorOnly=updated.markdown.slice(0,change.start)+change.before+updated.markdown.slice(change.start+change.after.length);
        if(donorOnly!==candidate.content)throw new StateError('The mapped paragraph would change bytes outside its exact donor section.',409);
        // The codec may change only the metadata line in addition to the exact
        // donor section. It does not introduce another wording representation.
        content=updated.markdown;
      }
    }
    assertFeedbackCurrent(input,selection);
    return prepareShareFeedback({...Object.fromEntries([...BASE,...feedbackFields].filter(key=>input[key]!==undefined).map(key=>[key,input[key]])),content});
  }
  async function saveShareFeedback(input) {
    workingOnly(input);fields(input,[...feedbackFields,'content','operationId','reason']);input=structuredClone(input);requireWriteActor();writable();uuid(input.operationId);
    const selection=feedbackWriteSelection(input);
    // The same owner binds context into its fingerprint before replay lookup,
    // and rechecks it synchronously under its existing lock before propose/put.
    return magazine.write({path:selection.context.feedback.path,content:input.content,expectedHash:input.expectedFeedbackHash,operationId:input.operationId,...(input.reason!==undefined?{reason:input.reason}:{})},{context:selection.context,assertCurrent:()=>assertFeedbackCurrent(input,selection)});
  }
  async function feedbackSaveReceipt(selection,operationId) {
    uuid(operationId);const record=await magazine.operation({operationId});
    const saved=record.context;
    const comparable=saved&&{...saved,feedback:{...saved.feedback,hash:selection.context.feedback.hash}};
    if(record.command!=='magazine.write'||record.result?.path!==selection.context.feedback.path||!sameFeedbackContext(comparable,selection.context))throw new StateError('That receipt belongs to another FEEDBACK selection or working revision.',403);
    const changes=(record.changes||[]).filter(change=>change.applied!==false);
    if(changes.some(change=>change.root!=='mag'||change.rel!==selection.context.feedback.path||change.move||change.large))throw new StateError('That receipt includes other work.',403);
    return {record,changes};
  }
  async function feedbackUndoEligibility(input,selection) {
    const {record,changes}=await feedbackSaveReceipt(selection,input.operationId);
    if(!magazine.configured||!magazine.writable)return {eligible:false,reason:'Magazine is read-only.'};
    if(currentActor()&&!isHuman(currentActor().actor))return {eligible:false,reason:'Only the author can undo FEEDBACK wording.'};
    if(!['committed','failed'].includes(record.state)||record.undoneBy||changes.length!==1||changes[0].afterHash!==input.expectedFeedbackHash)return {eligible:false,reason:'That save has no exact current FEEDBACK change to undo.'};
    assertFeedbackCurrent(input,selection);
    return {eligible:true,operationId:input.operationId};
  }
  async function eligibleUndoShareFeedback(input) {
    workingOnly(input);fields(input,[...feedbackFields,'operationId']);input=structuredClone(input);
    return feedbackUndoEligibility(input,feedbackWriteSelection(input));
  }
  async function shareFeedbackHistory(input) {
    workingOnly(input);fields(input,feedbackFields);input=structuredClone(input);
    const selection=feedbackWriteSelection(input);assertFeedbackCurrent(input,selection);
    if(typeof magazine.feedbackOperations!=='function')throw new StateError('Maintained FEEDBACK receipt discovery is unavailable.',503);
    const discovered=await magazine.feedbackOperations({context:selection.context,limit:200}),history=[];
    for(const operationId of discovered.operationIds){
      const {record,changes}=await feedbackSaveReceipt(selection,operationId);
      const eligible=await feedbackUndoEligibility({...input,operationId},selection);
      history.push({operationId,modifiedAt:record.at,actor:record.actor,beforeHash:changes[0].beforeHash,afterHash:changes[0].afterHash,canUndo:eligible.eligible});
    }
    assertFeedbackCurrent(input,selection);
    return {history};
  }
  async function undoShareFeedback(input) {
    workingOnly(input);fields(input,[...feedbackFields,'operationId','undoOperationId']);input=structuredClone(input);requireWriteActor();requireHuman('Undoing FEEDBACK wording');writable();uuid(input.operationId);uuid(input.undoOperationId);
    const selection=feedbackWriteSelection(input),target=await feedbackSaveReceipt(selection,input.undoOperationId);
    if(target.changes.length!==1||target.changes[0].afterHash!==input.expectedFeedbackHash)throw new StateError('This Undo does not name the exact saved FEEDBACK hash.',409);
    let prior;try{prior=await magazine.operation({operationId:input.operationId});}catch(error){if(error.status!==404)throw error;}
    if(!prior){
      const eligible=await feedbackUndoEligibility({...input,operationId:input.undoOperationId},selection);
      if(!eligible.eligible)throw new StateError(eligible.reason,409);
    }
    // Same contextual owner fingerprint protects both initial Undo and replay;
    // only the maintained owner restores bytes under its existing lock.
    return magazine.undo({undoOperationId:input.undoOperationId,operationId:input.operationId},{context:selection.context,assertCurrent:()=>assertFeedbackCurrent(input,selection)});
  }
  async function prepare(input) {
    workingOnly(input); fields(input, ['expectedHash', 'operations']);
    requireHuman('Preparing a native draft edit');
    const authority = resolve(input); writable();
    const document = magazine.read({path: authority.path});
    if (!document.exists || document.hash !== expected(input.expectedHash) || document.conflicts?.length) throw new StateError('The working draft changed. Your local words are retained; compare before saving.', 409);
    if (!Array.isArray(input.operations) || !input.operations.length || input.operations.length > 500) throw new StateError('Send bounded native draft operations.', 400);
    const native = await import('../draft-correspondence.mjs');
    const model = native.capture(document.text, authority.pieceId);
    model.blocks.forEach((block, i) => { block.id = 'magazine:' + encodeURIComponent(authority.pieceId) + ':' + i; });
    let candidate;
    try {
      const selected=input.operations.filter(op=>op?.kind==='photoReplaceAsset');let trusted;
      if(selected.length){
        if(selected.length!==1||input.operations.length!==1||!photoLibrary?.preview||!photoLibrary?.retain)throw new StateError('The maintained photo library is unavailable for this native edit.',409);
        const op=selected[0],selector=Object.fromEntries(['rootId','sourceId','revision','sourceHash'].map(k=>[k,op[k]])),photo=await photoLibrary.preview(selector);
        const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[photo.contentType];
        if(!extension||photo.hash!==op.sourceHash)throw new StateError('The selected library photograph changed.',409);
        trusted={photoAssets:[{...op,file:'library-photo-'+photo.hash+'.'+extension}]};
        // Validate the exact target, syntax and full operation before retaining
        // any bytes. Only explicit Use/prepare reaches the existing Library owner.
        candidate=native.apply(model,document.text,input.operations,trusted);
        const current=magazine.read({path:authority.path});
        if(current.hash!==document.hash||current.conflicts?.length)throw new StateError('The working draft changed before retaining the photo.',409);
        const retained=await photoLibrary.retain(selector);
        if(retained.file!==trusted.photoAssets[0].file||retained.hash!==photo.hash)throw new StateError('The retained Library photo identity changed.',409);
        const after=magazine.read({path:authority.path});
        if(after.hash!==document.hash||after.conflicts?.length)throw new StateError('The working draft changed before photo preparation. Refresh before saving.',409);
      } else candidate = native.apply(model, document.text, input.operations);
    }
    catch (error) { throw new StateError(error.message, 409); }
    if (candidate.reworks?.length) throw new StateError('Slash rework requests need the maintained Magazine paragraph action; your words are retained.', 409);
    return {selection: select(input), content: candidate.raw, expectedHash: document.hash};
  }
  async function edit(input) {
    const authority = mutation(input, ['block', 'seen', 'text', 'operationId']);
    uuid(input.operationId);
    if (!Number.isSafeInteger(input.block) || input.block < 0 || !/^[a-f0-9]{12}$/.test(input.seen || '')) throw new StateError('Use the donor paragraph index and hash returned by the working reader.', 400);
    return magazine.edit({path: authority.path, block: input.block, seen: input.seen, text: input.text, operationId: input.operationId});
  }
  async function save(input) {
    const authority = mutation(input, ['content', 'expectedHash', 'operationId', 'reason']);
    uuid(input.operationId);
    if (expected(input.expectedHash) === null) throw new StateError('An existing working draft requires its exact file hash.', 400);
    return magazine.write({path: authority.path, content: input.content, expectedHash: input.expectedHash, operationId: input.operationId, ...(input.reason !== undefined ? {reason: input.reason} : {})});
  }
  function changesFor(record, authority) {
    const changes = (record.changes || []).filter(c => c.applied !== false);
    const log = 'Workflow/4-Review/EDITS - ' + authority.path.split('/').pop();
    if (changes.some(c => c.root !== 'mag' || c.move || c.large || ![authority.path, ...(record.command === 'magazine.edit' || record.command === 'magazine.undo' ? [log] : [])].includes(c.rel))) throw new StateError('That receipt belongs to other work.', 403);
    return changes;
  }
  async function receipt(authority, operationId, {undo = false} = {}) {
    uuid(operationId);
    const record = await magazine.operation({operationId});
    if (record.command === 'magazine.undo' && undo) {
      if (!changesFor(record, authority).some(c => c.rel === authority.path)) throw new StateError('That Undo belongs to other work.', 403);
    } else if (!['magazine.edit', 'magazine.write'].includes(record.command) || record.result?.path !== authority.path) throw new StateError('That receipt belongs to other work.', 403);
    changesFor(record, authority);
    return record;
  }
  async function operation(input) {
    workingOnly(input); fields(input, ['operationId']);
    return receipt(resolve(input), input.operationId, {undo: true});
  }
  async function eligibility(authority, operationId) {
    const record = await receipt(authority, operationId), changes = changesFor(record, authority);
    if (!magazine.configured || !magazine.writable) return {eligible: false, reason: 'Magazine is read-only.'};
    // An anonymous GET may display exact eligibility. It grants no write actor;
    // undo() still requires the request context and the owner's human decision.
    if (currentActor() && !isHuman(currentActor().actor)) return {eligible: false, reason: 'Only the author can undo draft wording.'};
    if (!['committed', 'failed'].includes(record.state) || record.undoneBy || !changes.some(c => c.rel === authority.path)) return {eligible: false, reason: 'This operation has no remaining draft change to undo.'};
    // Check *every* receipt file, including the donor edit log, before asking the
    // owner to undo. Final CAS/lock/before bytes still belong to Magazine.
    for (const c of changes) {
      const current = await magazine.read({path: c.rel});
      if ((current.hash || null) !== (c.afterHash || null) || current.conflicts?.length) return {eligible: false, reason: 'A file changed after this save. Newer words must be kept.'};
    }
    return {eligible: true, operationId};
  }
  async function historyFor(authority) {
    const durable = magazine.draftHistory ? await magazine.draftHistory({path: authority.path, storyId: authority.storyId, limit: 200}) : {operationIds: []};
    const result = journal ? await journal.read({kind: 'story', id: authority.storyId, status: 'committed', limit: 200}) : {lines: []};
    const seen = new Set(), history = [];
    for (const line of [...durable.operationIds.map(operationId => ({operationId})), ...result.lines]) {
      if (!line.operationId || seen.has(line.operationId)) continue;
      seen.add(line.operationId);
      let record;
      try { record = await receipt(authority, line.operationId); }
      catch (error) { if ([403, 404].includes(error.status)) continue; throw error; }
      if (record.state !== 'committed' || record.scope?.kind !== 'story' || record.scope.id !== authority.storyId) continue;
      const change = changesFor(record, authority).find(c => c.rel === authority.path);
      if (!change) continue;
      history.push({operationId: record.operationId, state: record.state, modifiedAt: record.at, actor: record.actor, beforeHash: change.beforeHash, afterHash: change.afterHash, canUndo: (await eligibility(authority, record.operationId)).eligible});
    }
    return history.sort((a,b) => a.modifiedAt.localeCompare(b.modifiedAt) || a.operationId.localeCompare(b.operationId)).slice(-200);
  }
  async function eligibleUndo(input) {
    workingOnly(input); fields(input, ['operationId']);
    return eligibility(resolve(input), input.operationId);
  }
  async function undo(input) {
    const authority = mutation(input, ['undoOperationId', 'operationId']);
    uuid(input.operationId); uuid(input.undoOperationId);
    // The owner marks the target undone after committing. Recover an interrupted
    // *response* using that same receipt, before checking target eligibility.
    let prior;
    try { prior = await receipt(authority, input.operationId, {undo: true}); }
    catch (error) { if (error.status !== 404) throw error; }
    if (prior) {
      if (prior.command !== 'magazine.undo' || prior.result?.undone !== input.undoOperationId || prior.state !== 'committed') throw new StateError('That operationId was used for a different or unfinished write.', 409);
      return {...prior.result, operationId: input.operationId, replay: true};
    }
    const eligible = await eligibility(authority, input.undoOperationId);
    if (!eligible.eligible) throw new StateError(eligible.reason, isHuman(currentActor()?.actor) ? 409 : 403);
    return magazine.undo({undoOperationId: input.undoOperationId, operationId: input.operationId});
  }
  return {catalog, read, shareContext, readShareFeedback, readShareFeedbackEditModel, prepareShareFeedback, prepareShareFeedbackParagraph, saveShareFeedback, eligibleUndoShareFeedback, undoShareFeedback, shareFeedbackHistory, prepare, edit, save, operation, eligibleUndo, undo};
}
