// Where a subject stands, read on the server: `subject.standing` (one subject, every step of every form) and
// `subjects.standing` (every subject, its station, ring, next step and forms; one call for Home).
//
// The decision itself is the pure rule in ../standing-rule.mjs, shared with the browser. This file only gathers the
// facts that rule needs, each from the cheapest place it is kept, calling the owners' own read functions (never
// writing, never a read that lists every subject per subject):
//   subjects, their saved writing place      study drafts' catalogue (once for all)
//   project and document                      the subject's saved Material connection (study-project-bindings/,
//                                             the one file study bindings' lookup reads)
//   material                                  the Library index (once for all) for the subject's folder
//                                             Projects/<project>, plus the sources its research brief holds
//                                             (first-flow/<project>/flow.json) and what its plans were made from
//   research step                             the same flow record and the Library's hashes; only a subject whose
//                                             research was asked for is read through the research owner itself
//   the dish he named, possible dishes        the Simmer board
//   his direction written                     human direction's words file for the project
//   the words, suggestions waiting            the saved writing; suggestion folders indexed once for all; the
//                                             proposal owner only for a subject with one made on its current words
//   check                                     the saved Check
//   pieces                                    the saved outputs (read only for a writing place whose output
//                                             index lists one), and Instagram plans (listed once)
//   consent                                   the consent desk
//   word checks, open questions, places,      each listed once for all and kept until a change of its kind
//   research topics
// Freshness: every write in the app becomes a change on the event bus (kind = command name, scope = the record).
// A change about one subject (its id, writing place, project, piece or plan) marks only that subject to be read
// again; a change to something every subject draws on (Library, plans, questions, places, word checks, topics)
// marks that shared list, and the subjects that depend on it, to be read again. A change that names nothing known
// marks everything. Changes are announced just after a write answers, so each read first lets announced-but-not-yet-
// delivered changes through (the activity outbox's reconcile). Reading again happens on the next call, one subject at a time, giving the server back between
// subjects so other calls never wait behind it. A backstop re-reads anything older than `maxAgeMs`.
import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {digest, readJson} from './files.mjs';
import {standingOf, summaryOf} from '../standing-rule.mjs';

const READ_AT_ONCE = 4;
const yieldNow = () => new Promise(resolve => setImmediate(resolve));
const quiet = async fn => {try {return await fn();} catch {return undefined;}};
const TIMING = new Map();
const timed = (label, fn) => async () => {const t = performance.now(); try {return await fn();} finally {TIMING.set(label, (TIMING.get(label) || 0) + performance.now() - t);}};
export const standingTiming = () => Object.fromEntries([...TIMING].map(([k, v]) => [k, Math.round(v)]));
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const newest = times => {let best = null, t = -Infinity; for (const x of times) {const v = Date.parse(x || ''); if (Number.isFinite(v) && v > t) {t = v; best = new Date(v).toISOString();}} return best;};
/** Changes that never alter where a subject stands. */
const IGNORE = [/^presence/, /^leases?\./, /^handoff$/, /^needs-decision$/, /^journal\./, /^looks?\b/, /^accounts?\b/, /^templates?\b/, /^template\./, /^instagram\.template/, /^subject-places\.folders/, /^terminal/, /^study-draft\.open$/, /^standing\./];
/** Shared lists, and the change kinds that touch them. A matching change marks the list and every subject. */
const SHARED = {
 catalog: [/^study-draft\.create-collection/, /^study\.outputs\./, /^study\.carousel-make/, /^study-draft\.(?!save|undo|history|check)/],
 library: [/^sources\b/, /^library\b/, /^recordings\b/, /^ingestion\b/, /^phone-pickup/, /^first-flow\b/, /^study\.material/, /^study\.photos/, /^magazine\.library-photos/, /^transcription/],
 requests: [/^study-ai\./],
 plans: [/^instagram\./],
 asks: [/^needs-you/],
 places: [/^subject-places\.(save|reorder|carry)/],
 wordChecks: [/^words\./, /^transcript-check/],
 topics: [/^inquiries\./],
};

export function createSubjectStanding({dataDir, drafts, outputs, checks, consentDesk, library, firstFlow, simmer, instagram, suggestions, needsYou, places, wordChecks, topics, events, settle = async () => {}, maxAgeMs = 5 * 60_000, now = () => Date.now()} = {}) {
 if (!dataDir || !drafts) throw new TypeError('Subject standing needs the data folder and the study drafts.');
 const shared = new Map();  // name -> {value, at, dirty, pending}
 const subjects = new Map(); // id -> {facts, at, gen, dirty}
 const verdicts = new Map(); // id -> {key, count?, pending?}: how many of its suggestions the proposal owner still offers
 const ids = new Map();      // any record id (binding, project, output, plan) -> subject id
 let everythingGen = 0, changes = 0; // changes: every change heard that could matter, to catch one that lands during a read
 const stats = {sharedReads: 0, subjectReads: 0};

 // ---------- shared lists, read once and kept until a change of their kind ----------
 const READERS = {
  catalog: async () => drafts.catalog(),
  library: async () => {const tree = await library.tree(); const byId = new Map(), byFolder = new Map(); for (const s of tree.sources || []) {if (!s?.id) continue; byId.set(s.id, s); if (s.rootId === 'library' && typeof s.rel_path === 'string') {const m = s.rel_path.match(/^Projects\/([^/]+)\//); if (m) {if (!byFolder.has(m[1])) byFolder.set(m[1], []); byFolder.get(m[1]).push(s);}}} return {byId, byFolder};},
  requests: async () => requestIndex(),
  plans: async () => instagram ? (await instagram.plans({})).plans || [] : [],
  asks: async () => needsYou ? (await needsYou.list({status: 'open'})).asks || [] : null,
  places: async () => places ? (await places.read({})).places || [] : null,
  wordChecks: async () => wordChecks ? (await wordChecks()).recordings || [] : null,
  topics: async () => topics ? (await topics()).collections || [] : null,
 };
 async function sharedRead(name) {
  let s = shared.get(name);
  // A read under way (it started because the list was marked changed) answers before the older kept value does. One
  // marked changed again while it ran may hold the state from before that change: let it finish, then read again.
  if (s?.pending) {if (!s.dirty) return s.pending; await s.pending.catch(() => {}); return sharedRead(name);}
  if (s && !s.dirty && now() - s.at < maxAgeMs) return s.value;
  s = s || {}; shared.set(name, s);
  const started = everythingGen;
  s.dirty = false;
  s.pending = (async () => {try {stats.sharedReads++; const value = await timed('shared:' + name, READERS[name])(); s.value = value; s.at = now(); if (started !== everythingGen) s.dirty = true; return value;} catch (error) {s.value = undefined; s.dirty = true; throw error;} finally {s.pending = null;}})();
  return s.pending;
 }
 const sharedQuiet = name => sharedRead(name).catch(() => undefined);

 /** Suggestions on the words: every request folder read once, by writing place. Pending: a proposal and no decision. */
 function requestIndex() {
  const root = path.join(dataDir, 'study-mcp-requests'), byBinding = new Map();
  let names = []; try {names = fs.readdirSync(root).filter(n => UUID.test(n));} catch (error) {if (error.code !== 'ENOENT') throw error;}
  for (const n of names) {
   const r = readJson(path.join(root, n, 'request.json'), null); const b = r?.binding?.bindingId; if (!b) continue;
   const pending = fs.existsSync(path.join(root, n, 'proposal.json')) && !fs.existsSync(path.join(root, n, 'decision.json'));
   const row = byBinding.get(b) || {pending: [], at: null}; if (pending) row.pending.push({id: n, expected: r.expected}); row.at = newest([row.at, r.createdAt]); byBinding.set(b, row);
  }
  return byBinding;
 }

 /** Every subject: the saved collections, then working drafts that belong to none. */
 async function list() {
  const catalog = await sharedRead('catalog'), out = [], seen = new Set();
  for (const c of catalog?.collections || []) {const id = c?.parentStudyId; if (typeof id !== 'string' || !id || seen.has(id)) continue; seen.add(id); out.push({id, title: String(c.title || '').trim() || 'Untitled subject', bindingId: c.bindingId || null});}
  for (const d of catalog?.drafts || []) {const id = d?.parentStudyKey; if (typeof id !== 'string' || !id || seen.has(id)) continue; seen.add(id); out.push({id, title: String(d.title || '').trim() || 'Untitled subject', bindingId: null, draft: {id: d.id, title: d.title, modifiedAt: d.modifiedAt || null}});}
  return out;
 }

 // ---------- one subject's facts ----------
 /** Whether a writing place holds any piece, from the one index every piece is listed in, whatever made it (Outputs,
     Add a form, a generated or copied Carousel): the output owner's own records, in the article document its
     photo binding names (study-owned-photo-bindings/<binding>.json -> articles/<project>/<document>/article.json,
     document.nativeOutputIndex). No photo binding or document means no piece can exist yet. When the index cannot be
     read for another reason, the answer is yes, so the owner itself is asked and nothing is hidden. */
 function outputIndexHolds(parentStudyId, bindingId) {
  try {
   const m = readJson(path.join(dataDir, 'study-owned-photo-bindings', bindingId + '.json'), null);
   if (!m) return false;
   if (m.bindingId !== bindingId || m.parentStudyId !== parentStudyId || !UUID.test(m.projectId || '') || !UUID.test(m.documentId || '')) return true;
   const a = readJson(path.join(dataDir, 'articles', digest(m.projectId), digest(m.documentId), 'article.json'), null);
   if (!a) return false;
   const doc = a.project?.document, index = doc?.nativeOutputIndex;
   if (!doc) return true;
   // No index yet: the owner lists pieces only from it, so none; a document still holding outputs is asked anyway.
   if (index === undefined) return Array.isArray(doc.outputs) ? doc.outputs.length > 0 : true;
   return !Array.isArray(index?.records) || index.records.length > 0;
  } catch {return true;}
 }

 const kindOf = s => {
  const k = String(s?.kind || '').toLowerCase();
  if (['image', 'photo', 'photograph', 'picture', 'photos'].includes(k) || /\.(jpe?g|png|heic|webp|gif|tiff?)$/i.test(s?.rel_path || '')) return 'photos';
  if (['audio', 'video', 'transcript', 'recording', 'recordings'].includes(k) || s?.recordingId || s?.transcriptState) return 'recordings';
  if (['link', 'url', 'web', 'webpage', 'youtube', 'links'].includes(k) || /^https?:/i.test(s?.url || '')) return 'links';
  return 'notes';
 };
 async function gather(subject) {
  stats.subjectReads++;
  const {id, bindingId} = subject, times = [subject.draft?.modifiedAt], facts = {id, title: subject.title, bindingId, projectId: null};
  const [lib, reqs, planList, placeList, askList, topicList] = await Promise.all(['library', 'requests', 'plans', 'places', 'asks', 'topics'].map(sharedQuiet));
  // Where it lives.
  const place = placeList?.find(p => p.parentStudyId === id);
  if (place) {facts.folder = place.folder || []; facts.archived = !!place.archived; if (place.saved) times.push(place.updatedAt);}
  if (askList) facts.asks = askList.filter(a => a.scope?.id === id).length;
  // Project and document. None saved means no material folder and no research brief yet, which is known.
  let project = null, projectKnown = true;
  // The saved connection file itself (what study bindings' lookup reads), without the lookup's check of every piece.
  try {
   const b = readJson(path.join(dataDir, 'study-project-bindings', digest(id) + '.json'), null);
   if (b) {if (b.schema === 'ar-create.study-binding.v1' && b.status === 'ready' && b.projectKey === id && UUID.test(b.projectId || '') && UUID.test(b.documentId || '')) project = {projectId: b.projectId, documentId: b.documentId}; else projectKnown = false;}
  } catch {projectKnown = false;}
  facts.projectId = project?.projectId || null;
  // Plans and their records (what each was made from, its story, slides, post text, yes and look).
  const mine = planList ? planList.filter(p => p.subject === id) : null;
  const planRecords = mine ? (await Promise.all(mine.map(p => quiet(timed('plan', () => instagram.read({id: p.id})))))) : null;
  // Pieces: the saved outputs of its writing place, then its plans.
  let pieces = [];
  if (bindingId && outputIndexHolds(id, bindingId)) {
   const view = await quiet(timed('outputs', () => outputs.read({rootBindingId: bindingId, parentStudyId: id})));
   if (view) for (const o of view.outputs || []) {pieces.push({key: 'out:' + o.id, id: o.id, kind: o.kind, title: o.title || o.name || '', status: o.status || null, placements: (o.placements || []).length, slides: (o.slides || []).length}); times.push(o.createdAt, o.updatedAt);}
   else pieces = null;
  } else if (subject.draft) pieces.push({key: 'draft:' + subject.draft.id, id: subject.draft.id, kind: 'article', title: subject.draft.title || '', status: null, placements: 0, slides: 0});
  if (pieces && planRecords) for (const [i, pr] of planRecords.entries()) {
   if (!pr) {pieces = null; break;}
   const fmt = Object.keys(pr.layouts || {})[0] || pr.stories?.[0]?.format || 'carousel', lay = pr.layouts?.[fmt], chosen = pr.chosen?.storyId, story = (pr.stories || []).find(s => s.id === chosen), cap = lay?.caption;
   pieces.push({key: 'ig:' + pr.id, id: pr.id, kind: 'instagram', title: pr.title || '', plan: {format: fmt, stories: (pr.stories || []).length, chosen: !!(chosen || pr.chosen?.named), chosenTitle: story?.title || '', frames: (lay?.frames || []).length, caption: !!(typeof cap === 'string' ? cap.trim() : cap?.parts?.length), ready: !!(pr.ready && Object.keys(pr.ready).length), look: pr.drawnIn && pr.drawnIn.from !== 'default' ? pr.drawnIn.id : null}});
   times.push(mine[i].updatedAt);
  } else if (!planRecords) pieces = null;
  facts.pieces = pieces;
  facts.look = pieces?.find(p => p.plan?.look)?.plan.look || null;
  // The Simmer board: the dish he named, and the words and photographs brought to it (a chat intake files his words
  // as a Library note "Adrian, in chat" and his photographs as Library sources, and places both on the board).
  const board = simmer ? await quiet(timed('board', async () => (await simmer).boards.read({subject: id}))) : undefined;
  // Material: the subject's own Library folder, the sources its research holds, what its plans were made from, and
  // what is on its board. A list that could not be read makes the material not known, never "nothing".
  const flow = facts.projectId ? readJson(path.join(dataDir, 'first-flow', digest(facts.projectId), 'flow.json'), null) : null;
  const sourceIds = new Set(), setAside = new Set(Object.entries(flow?.materialDecisions || {}).filter(([, v]) => v?.decision === 'set-aside').map(([k]) => k));
  const items = new Map(), add = (sid, s) => {if (!sid || items.has(sid) || setAside.has(sid)) return; items.set(sid, s || {});};
  if (lib && projectKnown) {
   for (const sid of flow?.sourceIds || []) {add(sid, lib.byId.get(sid)); sourceIds.add(sid);}
   if (facts.projectId) for (const s of lib.byFolder.get(facts.projectId) || []) {add(s.id, s); times.push(s.modified_at); sourceIds.add(s.id);}
   for (const pr of planRecords || []) {if (!pr) continue; for (const x of pr.material?.transcripts || []) add(x.sourceId, {...lib.byId.get(x.sourceId), kind: 'transcript'}); for (const x of pr.material?.photos || []) add(x.sourceId, {...lib.byId.get(x.sourceId), kind: 'image'});}
   for (const g of board?.groups || []) for (const b of g?.blocks || []) {
    const sid = b?.photo?.sourceId || b?.source?.sourceId;
    if (sid) {add(sid, b.photo ? {...lib.byId.get(sid), kind: 'image'} : lib.byId.get(sid) || {kind: 'note'}); sourceIds.add(sid);}
    else if (b?.origin === 'human' && ['mine', 'note', 'voice', 'letter'].includes(b.kind) && String(b.text || '').trim()) add('block:' + b.id, {kind: 'note'});
   }
   const m = {total: 0, recordings: 0, notes: 0, links: 0, photos: 0}; for (const s of items.values()) {m[kindOf(s)]++; m.total++;}
   facts.material = (planRecords || !mine) && board !== undefined ? m : null;
  } else facts.material = null;
  // The transcript: words a word check left open for its recordings, and a plan's words still to confirm.
  if (facts.material) {
   const jobs = new Set([...items.values()].filter(s => kindOf(s) === 'recordings').map(s => s.transcriptState?.jobId || s.recordingId).filter(Boolean));
   const checksList = jobs.size ? await sharedQuiet('wordChecks') : [];
   if (checksList === undefined || checksList === null && jobs.size) facts.transcript = null;
   else {
    const mineChecks = (checksList || []).filter(r => jobs.has(r.jobId));
    let open = mineChecks.reduce((n, c) => n + (c.open || 0), 0);
    for (const pr of planRecords || []) {const o = new Set((pr.flagStatus || []).filter(x => x.status === 'open').map(x => x.id)); open += (pr.flags || []).filter(x => o.has(x.id)).length;}
    facts.transcript = {open, checked: mineChecks.length > 0 || (planRecords || []).length > 0};
   }
  } else facts.transcript = null;
  // Research: its brief's step. Without a research request the step follows from the flow record and the Library's
  // hashes alone; with one, the research owner itself is asked (it checks the result against its sources).
  if (!projectKnown || !lib) facts.research = null;
  else if (!facts.projectId) facts.research = {step: null, unreviewed: 0};
  else if (flow?.currentRequestId || flow?.choice) {
   const brief = bindingId && project ? await quiet(timed('brief', () => firstFlow.study.read({bindingId, parentStudyId: id, projectId: project.projectId, documentId: project.documentId}))) : undefined;
   facts.research = brief ? {step: brief.step || null, unreviewed: (brief.materials || []).filter(x => !x.reviewed && !['audio', 'image'].includes(x.kind)).length} : null;
  } else {
   const mats = (flow?.sourceIds || []).filter(sid => !setAside.has(sid)).map(sid => ({sid, s: lib.byId.get(sid)}));
   const managed = mats.some(x => x.s?.transcriptState || x.s?.recordingId);
   const reviewed = x => !!x.s && flow.reviews?.[x.sid] === x.s.hash;
   const textual = x => !['audio', 'image'].includes(x.s?.kind);
   const unreviewed = mats.filter(x => textual(x) && !reviewed(x)).length;
   if (managed) facts.research = null; // A recording's transcript is reviewed by its own owner; not decided here.
   else if (!(flow?.sourceIds || []).length) facts.research = {step: 'attach', unreviewed: 0};
   else facts.research = {step: mats.some(x => !x.s || textual(x) && !reviewed(x)) || !mats.some(reviewed) ? 'review' : 'research', unreviewed};
  }
  if (facts.research && topicList) facts.research.topics = topicList.filter(t => (t.sourceIds || []).some(s => sourceIds.has(s))).length;
  // The dish he named on the Simmer board, and whether his direction is written.
  // His direction: the words file human direction keeps for the project (workspaces/<project>/HUMAN-DIRECTION.md).
  let dir = null;
  if (facts.projectId) dir = await quiet(timed('direction', async () => {
   const where = path.join(dataDir, 'workspaces', facts.projectId), meta = readJson(path.join(where, 'HUMAN-DIRECTION.json'), null);
   let body = ''; try {body = fs.readFileSync(path.join(where, 'HUMAN-DIRECTION.md'), 'utf8');} catch (error) {if (error.code !== 'ENOENT') throw error;}
   return {body, updatedAt: meta?.updatedAt || null};
  }));
  if (board && dir !== undefined) {
   const f = board.forming || {}, namedText = typeof f.named?.text === 'string' ? f.named.text.trim() : '', sentText = f.sentAt && typeof f.sentence?.dish === 'string' ? f.sentence.dish.trim() : '';
   facts.dish = {named: !!(namedText || sentText), text: namedText || sentText || '', at: namedText ? f.named.dictated?.at || null : sentText ? f.sentAt : null, dishes: (f.dishes || []).length, direction: !!String(dir?.body || '').trim()};
   times.push(dir?.updatedAt);
  } else facts.dish = null;
  // The words, suggestions waiting on them, and the Check.
  if (bindingId) {
   const read = await quiet(timed('read', () => drafts.read({bindingId, parentStudyId: id})));
   if (read) {const blocks = (read.projection || []).filter(x => String(x.words || '').trim()); facts.words = {paragraphs: blocks.filter(x => x.blockKind !== 'heading').length, count: blocks.reduce((n, x) => n + String(x.words).trim().split(/\s+/).length, 0)}; times.push(...(read.history || []).map(h => h.modifiedAt));}
   else facts.words = null;
   // Suggestions waiting on the words. One made before the words last changed is stale and the app no longer offers
   // it, so it is not counted. One made against the current words may still be stale for another reason (his
   // direction or guidance changed), which only the proposal owner can say: then it is asked, for this subject only.
   const row = reqs?.get(bindingId); times.push(row?.at);
   if (!reqs || !read) facts.suggestions = null;
   else {
    const current = (row?.pending || []).filter(x => JSON.stringify(x.expected) === JSON.stringify(read.expected));
    if (!current.length) facts.suggestions = 0;
    else if (!suggestions) facts.suggestions = null;
    else {
     // The owner's answer is slow (seconds at a hundred subjects), so it is kept per subject, per suggestion and per
     // version of the words, and asked in the background: until it answers, the count is not known.
     const key = JSON.stringify([current.map(x => x.id), read.expected, subjects.get(id)?.gen || 0]), v = verdicts.get(id);
     if (v?.key === key && 'count' in v) facts.suggestions = v.count;
     else {
      facts.suggestions = null;
      if (v?.key !== key || !v.pending) {
       const entry = {key};
       entry.pending = quiet(timed('suggestions', () => suggestions({bindingId, parentStudyId: id}))).then(listed => {
        entry.count = listed ? (listed.items || []).filter(i => i.status === 'pending' && !i.stale).length : null;
        entry.pending = null; if (entry.count === null) verdicts.delete(id);
        const e = subjects.get(id); if (e) {e.dirty = true; e.late = true;}
        // Tell whoever is watching this subject, once, so a page showing Not known asks again. The event kind is ignored
        // by onChange (IGNORE), so it starts no read and no wait of its own; a count that could not be read says nothing.
        if (entry.count !== null) try {events?.emit?.({kind: 'standing.suggestions', scope: {kind: 'subject', id}, status: 'committed', actor: 'system:standing'});} catch {}
       });
       verdicts.set(id, entry);
      }
     }
    }
   }
   const c = await quiet(timed('check', async () => ({value: await checks.read({bindingId, parentStudyId: id}, {draft: read})})));
   facts.check = c ? {status: c.value?.status || null, issues: (c.value?.issues || []).length} : null;
   times.push(c?.value?.checkedAt, c?.value?.createdAt);
  } else if (subject.draft) {facts.words = null; facts.suggestions = null; facts.check = null;}
  else {facts.words = {paragraphs: 0, count: 0}; facts.suggestions = 0; facts.check = {status: null, issues: 0};}
  // The consent desk.
  const desk = consentDesk ? await quiet(timed('desk', () => consentDesk.read({parentStudyId: id}))) : undefined;
  facts.consent = desk ? {people: (desk.people || []).map(p => ({name: p.name, state: p.consent?.state || 'not-asked', request: !!p.request})), released: !!desk.release?.released, overridden: !!desk.release?.overridden, ready: !!desk.release?.ready, held: !!desk.release?.held} : null;
  facts.changedAt = newest(times);
  facts._sources = [...new Set([...items.keys(), ...sourceIds])];
  facts._jobs = [...new Set([...items.values()].filter(s => kindOf(s) === 'recordings').map(s => s.transcriptState?.jobId || s.recordingId).filter(Boolean))];
  // Ids that point back to this subject, for changes that name them.
  for (const k of [bindingId, facts.projectId, ...(pieces || []).map(p => p.id)]) if (k) ids.set(k, id);
  return facts;
 }

 /** A cheap fingerprint of what a subject's facts draw from the shared lists: when it differs from the one its facts
     were read with, the subject is read again, so a change to a shared list re-reads only the subjects it touches. */
 async function signature(subject, deps = {}) {
  const [lib, reqs, planList, placeList, askList, topicList, checksList] = await Promise.all(['library', 'requests', 'plans', 'places', 'asks', 'topics', ...(deps.jobs?.length ? ['wordChecks'] : [])].map(sharedQuiet));
  const place = placeList?.find(p => p.parentStudyId === subject.id);
  const folder = deps.projectId ? (lib?.byFolder.get(deps.projectId) || []).map(s => s.id + ':' + s.hash) : [fs.existsSync(path.join(dataDir, 'study-project-bindings', digest(subject.id) + '.json'))];
  const keys = new Set(deps.sources || []);
  return JSON.stringify([subject.bindingId, subject.title, subject.draft?.modifiedAt || null,
   planList ? planList.filter(p => p.subject === subject.id).map(p => p.id + ':' + p.revision) : null,
   reqs ? (reqs.get(subject.bindingId)?.pending || []).map(x => x.id) : null,
   place ? [place.folder, place.archived, place.updatedAt] : null,
   askList ? askList.filter(a => a.scope?.id === subject.id).length : null,
   folder, [...keys].map(k => lib?.byId.get(k)?.hash || null),
   topicList ? topicList.filter(t => (t.sourceIds || []).some(x => keys.has(x))).length : null,
   checksList ? checksList.filter(r => deps.jobs.includes(r.jobId)).map(r => r.jobId + ':' + (r.open || 0)) : null]);
 }
 const isFresh = (e, sig) => e && e.facts && !e.dirty && e.everything === everythingGen && now() - e.at < maxAgeMs * 6 && e.sig === sig;
 async function factsOf(subject) {
  let e = subjects.get(subject.id);
  const sig = await signature(subject, e?.deps);
  if (isFresh(e, sig)) return e.facts;
  if (e?.pending) {
   if (e.pendingGen === e.gen && e.pendingEvery === everythingGen) return e.pending;
   await e.pending.catch(() => {}); return factsOf(subject);
  }
  e = e || {gen: 0}; subjects.set(subject.id, e);
  const gen = e.gen, every = everythingGen, heard = changes;
  e.pendingGen = gen; e.pendingEvery = every;
  e.pending = (async () => {try {
   const facts = await gather(subject);
   e.deps = {projectId: facts.projectId, sources: facts._sources || [], jobs: facts._jobs || []};
   delete facts._sources; delete facts._jobs;
   e.sig = await signature(subject, e.deps); e.facts = facts; e.at = now(); e.everything = every; e.dirty = gen !== e.gen || heard !== changes || !!e.late; e.late = false; return facts;
  } finally {e.pending = null;}})();
  return e.pending;
 }

 // ---------- freshness ----------
 function onChange(event) {
  if (!event || event.status === 'rejected' || event.status === 'conflict') return;
  const kind = String(event.kind || ''), sid = event.scope?.id;
  if (IGNORE.some(r => r.test(kind))) return;
  let touchedShared = false; changes++;
  for (const [name, patterns] of Object.entries(SHARED)) if (patterns.some(r => r.test(kind))) {touchedShared = true; const s = shared.get(name); if (s) s.dirty = true;}
  const subjectId = typeof sid === 'string' ? (subjects.has(sid) ? sid : ids.get(sid)) : null;
  if (subjectId) {const e = subjects.get(subjectId); if (e) {e.gen++; e.dirty = true;}}
  // A change that names no subject and no shared list could touch anything: read everything again.
  if (!subjectId && !touchedShared) {everythingGen++; for (const s of shared.values()) s.dirty = true;}
 }
 const stop = events?.subscribe ? events.subscribe(onChange) : () => {};

 // ---------- the two reads ----------
 async function one({parentStudyId} = {}) {
  await quiet(settle);
  if (typeof parentStudyId !== 'string' || !parentStudyId.trim() || parentStudyId.length > 256 || /[\x00-\x1f\x7f]/.test(parentStudyId)) throw new StateError('Name the subject by its project id (parentStudyId).', 400);
  const subject = (await list()).find(s => s.id === parentStudyId);
  if (!subject) throw new StateError('No subject with that id.', 404);
  // The proposal owner's answer about suggestions is slow, so it is not waited for: the count is Not known until it
  // arrives, and the next read has it. Screens ask again.
  const facts = await factsOf(subject);
  return {...standingOf(facts, {now: now()}), facts, readAt: new Date(now()).toISOString()};
 }
 let running = null;
 async function all() {
  // One reading at a time; a caller arriving meanwhile waits for it and then reads what changed since.
  await quiet(settle);
  while (running) await running.catch(() => {});
  const work = (async () => {
   const started = now(), subjectsNow = await list(), out = new Array(subjectsNow.length), startReads = stats.subjectReads;
   // A few subjects at a time; each read still gives the server back (yieldNow) so other calls never wait behind it.
   let next = 0;
   const worker = async () => {
    while (next < subjectsNow.length) {
     const i = next++, before = stats.subjectReads, facts = await factsOf(subjectsNow[i]);
     if (stats.subjectReads !== before) await yieldNow();
     out[i] = summaryOf(standingOf(facts, {now: now()}));
    }
   };
   await Promise.all(Array.from({length: Math.min(READ_AT_ONCE, subjectsNow.length)}, worker));
   const read = stats.subjectReads - startReads;
   for (const id of subjects.keys()) if (!subjectsNow.some(s => s.id === id)) subjects.delete(id);
   return {schema: 'ar-create.subjects-standing.v1', readAt: new Date(now()).toISOString(), count: out.length, readAgain: read, ms: now() - started, subjects: out};
  })();
  running = work;
  try {return await work;} finally {if (running === work) running = null;}
 }
 return {one, all, onChange, stop, stats: () => ({...stats, cached: subjects.size, timing: standingTiming()})};
}

/** The two routes: GET /api/subject/standing?parentStudyId=… and GET /api/subjects/standing. Read-only, any actor. */
export async function handleStanding(request, response, standing) {
 const url = new URL(request.url || '/', 'http://local.invalid');
 if (url.pathname !== '/api/subject/standing' && url.pathname !== '/api/subjects/standing') return false;
 const send = (status, body) => {response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); response.end(JSON.stringify(body));};
 try {
  if (request.method !== 'GET') {response.setHeader('Allow', 'GET'); throw new StateError('Use GET.', 405);}
  if (!standing) throw new StateError('Where a subject stands needs the study drafts, which this home does not have.', 503);
  const keys = [...url.searchParams.keys()];
  if (url.pathname === '/api/subjects/standing') {if (keys.length) throw new StateError('subjects.standing takes no fields.', 400); return send(200, await standing.all()), true;}
  if (keys.some(k => k !== 'parentStudyId') || url.searchParams.getAll('parentStudyId').length !== 1) throw new StateError('Name one subject with parentStudyId.', 400);
  send(200, await standing.one({parentStudyId: url.searchParams.get('parentStudyId')}));
 } catch (error) {send(Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500, {error: error.status ? error.message : 'Where the subject stands could not be read.'});}
 return true;
}
