// Fills a RUNNING invented demo (`npm run demo`, port 8854) with a believable invented world, through the app's own
// commands only, so version two's Home can be walked, judged and photographed.
//   npm run demo:fill                 (default http://127.0.0.1:8854, or AR_CREATE_URL)
//   npm run demo:fill -- --large      about 150 subjects, long and short titles, more folders
// It prints what exists afterwards, read back through the commands.
//
// SAFETY. It uses the same check as scripts/demo-instagram.mjs: the server must say it is the invented demo
// (syntheticFixtures:true in the package config the page reads) and port 8841 is refused outright. Only after that check
// does it make the few steps that are the owner's alone (writing a direction, writing the Article words, accepting a
// Research topic onto a subject, choosing the Carousel story) as human:adrian, because the demo home is invented and
// disposable. Accept and Turn down on suggestions, and publishing, are left alone. Running it twice does not double
// anything: every subject has a fixed id and every step looks before it acts.
//
// What it cannot reach through commands in the demo (no recording, no AI provider, no Magazine folder) is left one
// step earlier; STATES below says which, and `unreached` in the result lists each such subject.
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assertInventedDemo, seedInstagramDemo, PLAN_TITLE} from './demo-instagram.mjs';

/** Stage numbers. 7 (published) is not reachable in the demo: there is no Magazine folder to publish into. */
export const STATES = ['Nothing yet', 'Recording and notes only', 'Research with findings', 'Direction written', 'Article half written, one suggestion waiting', 'Article finished', 'Carousel plan', 'Published'];
const REACHABLE = 6;

const FOLDERS = [['Tea'], ['Tea', 'Gardens'], ['Mandala'], ['Art'], ['Journey']];
const LARGE_FOLDERS = [['Tea', 'Workshop'], ['Mandala', 'Series'], ['Art', 'Studio'], ['Journey', 'Notes'], ['Journey', 'Notes', 'Spring']];
// slug, title, folder, tags, stage, pinned, archived
const BASE = [
 ['straw-over-the-rows', 'Straw over the rows', ['Tea', 'Gardens'], ['shade', 'spring'], 6, true],
 ['the-first-cup', 'The first cup', ['Tea'], ['tasting', 'story'], 5, true],
 ['shade-and-patience', 'Shade and patience', ['Tea', 'Gardens'], ['shade'], 4],
 ['picking-before-dawn', 'Picking before dawn', ['Tea', 'Gardens'], ['spring', 'harvest'], 3],
 ['a-teapot-for-guests', 'A teapot for guests', ['Tea'], ['objects'], 2],
 ['water-and-leaf', 'Water and leaf', ['Tea'], ['tasting'], 1],
 ['questions-for-the-grower', 'Questions for the grower', ['Tea', 'Gardens'], ['interview'], 0],
 ['circle-of-twelve', 'Circle of twelve', ['Mandala'], ['geometry', 'series'], 5, true],
 ['ink-on-warm-paper', 'Ink on warm paper', ['Mandala'], ['process'], 4],
 ['the-slow-border', 'The slow border', ['Mandala'], ['geometry'], 3],
 ['colour-from-clay', 'Colour from clay', ['Mandala'], ['materials'], 2],
 ['a-single-line', 'A single line', ['Mandala'], ['process', 'series'], 1],
 ['studio-after-rain', 'Studio after rain', ['Art'], ['studio'], 5],
 ['small-paintings-of-doors', 'Small paintings of doors', ['Art'], ['series'], 4, true],
 ['what-the-brush-remembers', 'What the brush remembers', ['Art'], ['process'], 3],
 ['mixing-the-grey', 'Mixing the grey', ['Art'], ['materials'], 2],
 ['sketchbook-pages', 'Sketchbook pages', ['Art'], ['studio'], 1],
 ['a-wall-for-the-new-work', 'A wall for the new work', ['Art'], ['studio'], 0],
 ['the-road-north', 'The road north', ['Journey'], ['travel'], 3, true],
 ['night-train-notes', 'Night train notes', ['Journey'], ['travel', 'notes'], 2],
 ['market-morning', 'Market morning', ['Journey'], ['notes'], 1],
 ['leaving-and-returning', 'Leaving and returning', ['Journey'], ['reflection'], 0],
 ['an-old-idea-set-aside', 'An old idea set aside', ['Art'], ['archive'], 2, false, true],
 ['last-years-plan', "Last year's plan", ['Journey'], ['archive'], 1, false, true],
];
const ASKS = [
 {slug: 'shade-and-patience', question: 'Which photo should open the shade piece?', choices: ['The rows under straw', 'The first leaves'], about: 'Shade and patience'},
 {slug: 'circle-of-twelve', question: 'The Article says twelve rings. Is it twelve or thirteen?', choices: ['Twelve', 'Thirteen'], about: 'Circle of twelve'},
 {slug: 'the-road-north', question: 'May the guesthouse be named in the piece?', choices: ['Yes, name it', 'No, leave it out'], about: 'The road north'},
];

// One subject whose Article quotes a captured source, so Check shows a real finding and a real pass. The source is the demo
// fixture's invented "Synthetic One" note (scripts/demo.mjs); the subject takes a retained copy of it when it is made. One
// quotation is exact and one is altered. It is made only on a full fill, or when `only` names it.
export const CHECKED = {slug: 'the-green-gate', title: 'The green gate', folder: ['Tea'], tags: ['quotes'], original: {id: 'hk-article', parent: 'hk'}, words: [
 'The gate was painted green the spring she arrived, and the note said "Entirely invented source fixture." and nothing more.',
 'Later the same page was remembered a little differently: "Entirely invented source fixtures. Nobody ever interviewed anyone."',
 'The rest is only the walk to the gate, with nothing quoted.',
]};
const PARAGRAPHS = t => [
 `${t} began with something small that was noticed and then kept.`,
 'It would have been easy to pass by. Looking again showed how much was already there.',
 'The part that surprised most was how little needed to be added. Most of the work was waiting.',
 'Asked about it later, the answer was short and plain, and it said more than a long one would have.',
 'There is a quiet order to it once you see it, each step leaning on the one before.',
 'What remains is simple: a thing made slowly, and a reason to make another.',
];
const NOTE = t => `Invented note for "${t}". The idea, in my own words: start from what is in front of me and say it plainly.\n`;
const VOICE = t => `Invented voice note about "${t}".\n\nSpeaker: I want to tell this one slowly, from the first morning.\n\nSpeaker: The part people never ask about is the waiting.\n\nSpeaker: If I only keep one thing, it is how quiet it was.\n`;
const FINDING = t => `# What I found out about ${t}\n\nFinding one: the idea is older than I thought, and it was written about plainly.\n\nFinding two: two sources agree on the main point and differ on the dates.\n\nStill to ask: who else has made this, and what did they call it?\n`;
const DIRECTION = t => `A short piece about ${t}. Calm and exact. Start with the first morning, end on what is still unknown.`;

// Invented words for the large set.
const WORDS_A = ['Morning', 'River', 'Clay', 'Winter', 'Garden', 'Lantern', 'Salt', 'Threshold', 'Harvest', 'Paper', 'Copper', 'Orchard', 'Window', 'Valley', 'Ember', 'Moss', 'Harbour', 'Pigment', 'Kettle', 'Meadow'];
const WORDS_B = ['notes', 'drafts', 'questions', 'studies', 'letters', 'recipes', 'sketches', 'visits', 'rituals', 'maps', 'repairs', 'lessons'];
const LONG = ['and what it taught me about waiting for the right light to arrive', 'a long conversation, written up slowly over three seasons, with all the false starts left in', 'why the smallest decision at the start changed everything that came after it'];
export function largeSubjects() {
 const folders = [...FOLDERS, ...LARGE_FOLDERS], out = [];
 for (let i = 0; out.length < 126; i++) {
  const a = WORDS_A[i % WORDS_A.length], b = WORDS_B[(i * 7 + Math.floor(i / 20)) % WORDS_B.length], n = Math.floor(i / 20) + 1;
  const title = i % 9 === 4 ? `${a} ${b}, ${LONG[i % LONG.length]}` : i % 5 === 0 ? `${a}` : `${a} ${b} ${n}`;
  const slug = 'large-' + String(i + 1).padStart(3, '0');
  const stage = i % 11 === 0 ? 3 : i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0;
  out.push([slug, title, folders[(i * 3) % folders.length], [['tea', 'art', 'mandala', 'travel'][i % 4], ['spring', 'notes', 'series', 'process'][(i * 5) % 4]], stage, false, i % 41 === 40]);
 }
 return out;
}

const SLUG = s => 'demo-' + s;
const op = () => crypto.randomUUID();
const q = o => '?' + new URLSearchParams(o);
const gi = o => '?input=' + encodeURIComponent(JSON.stringify(o));

export async function fillDemo(base = process.env.AR_CREATE_URL || 'http://127.0.0.1:8854', {large = false, only = null, fetch: fetchFn = fetch, log = () => {}} = {}) {
 const origin = await assertInventedDemo(base, fetchFn);
 const AGENT = 'agent:claude-code', OWNER = 'human:adrian';
 const call = async (path, body, actor = AGENT) => {
  const r = await fetchFn(origin + path, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', 'X-AR-Actor': actor, 'X-AR-Client': 'http'}, body: body && JSON.stringify(body)});
  const text = await r.text(); let v; try { v = JSON.parse(text); } catch { v = {error: text}; }
  if (!r.ok) throw Error(path.split('?')[0] + ': ' + r.status + ' ' + v.error);
  return v;
 };
// `only` (slugs) is for tests: just those subjects, in their usual order.
 const specs = [...BASE, ...(large ? largeSubjects() : [])].filter(r => !only || only.includes(r[0])).map(([slug, title, folder, tags, stage, pinned = false, archived = false], order) => ({id: SLUG(slug), slug, title, folder, tags, stage: Math.min(stage, REACHABLE), pinned, archived, order}));
 const unreached = [], done = {};

 // 1. Folders (an empty folder can exist; creating one that exists is skipped).
 let folders = await call('/api/subject-places/folders');
 const key = p => p.join('/');
 for (const path of [...FOLDERS, ...(large ? LARGE_FOLDERS : [])]) {
  if (folders.folders.some(f => key(f.path) === key(path) && f.saved)) continue;
  await call('/api/subject-places/folders', {action: 'create', path, expectedRevision: folders.revision, expectedHash: folders.hash, operationId: op()});
  folders = await call('/api/subject-places/folders');
 }

 // 2. Each subject, one step at a time. A failure leaves that subject where it got to and the rest carry on.
 const catalogAll = async () => (await call('/api/study-draft/catalog')).collections;
 let catalog = await catalogAll();
 const topics = async () => (await call('/api/inquiries/catalog' + gi({}))).collections;
 const needsAsks = (await call('/api/needs-you?status=all')).asks || [];
 let planDone = false;
 // The app lets Research link topics only while the home holds 100 subjects or fewer, so the deeper ones are made first.
 for (const s of [...specs].sort((x, y) => (y.stage >= 2) - (x.stage >= 2))) {
  let reached = -1;
  try {
   let binding = catalog.find(c => c.parentStudyId === s.id);
   if (!binding) { await call('/api/study-draft/create-collection', {parentStudyId: s.id, title: s.title, operationId: op()}); catalog = await catalogAll(); binding = catalog.find(c => c.parentStudyId === s.id); }
   reached = 0;
   const scope = {parentStudyId: s.id, bindingId: binding.bindingId};
   let projectId = null;
   if (s.stage >= 1) {
    projectId = (await call('/api/first-flow/select', {projectKey: s.id, title: s.title, operationId: op()})).projectId;
    const flow = await call('/api/first-flow' + q({projectId}));
    if (!flow.sourceIds?.length) {
     const folder = 'Projects/' + projectId;
     await call('/api/sources/folders', {rootId: 'library', folder});
     await call('/api/sources/import', {rootId: 'library', folder, urls: [], files: [{name: 'Voice note about ' + s.slug + '.md', content: VOICE(s.title)}, {name: 'My notes on ' + s.slug + '.md', content: NOTE(s.title)}]});
    }
    reached = 1;
   }
   if (s.stage >= 2) {
    const name = s.title + ': research';
    let topic = (await topics()).find(t => t.name === name);
    const flow = await call('/api/first-flow' + q({projectId}));
    if (!topic) {
     const cat = await call('/api/inquiries/catalog' + gi({}));
     topic = (await call('/api/inquiries/create', {name, sourceIds: flow.sourceIds, expectedRevision: cat.revision})).collection;
    }
    let r = await call('/api/inquiries/read' + gi({collectionId: topic.id}));
    const finished = !!r.record.body.trim();
    if (!finished) {
     await call('/api/inquiries/save', {collectionId: topic.id, expectedRevision: r.record.revision, expectedHash: r.record.hash, expectedMetadataHash: r.record.metadataHash, operationId: op(), body: FINDING(s.title)});
    }
    // A topic that already holds its finding was linked on an earlier run (the app cannot list subjects for linking above 100).
    const sel = finished ? null : (await call('/api/inquiries/projects' + gi({}))).projects.find(p => p.selector.parentStudyId === s.id)?.selector;
    if (!finished && !sel) throw Error('the subject is not offered to Research');
    if (!finished) {
    let v = await call('/api/inquiries/project' + gi({collectionId: topic.id, projectSelector: sel}));
    let rel = (v.relationships || [])[0];
    if (!rel) {
     rel = (await call('/api/inquiries/association/propose', {collectionId: topic.id, projectSelector: sel, ...v.libraryExpected, expectedProjectProofHash: v.authority.proofHash, operationId: op(), reason: 'Research for this subject.'})).relationship;
     v = await call('/api/inquiries/project' + gi({collectionId: topic.id, projectSelector: sel}));
    }
    if (rel.status !== 'accepted') await call('/api/inquiries/association/change', {collectionId: topic.id, projectSelector: sel, id: rel.id, status: 'accepted', ...v.libraryExpected, operationId: op(), reason: 'Use this research for the subject.'}, OWNER);
    }
    reached = 2;
   }
   if (s.stage >= 3) {
    const d = await call('/api/study/human-direction' + q({parentStudyId: s.id}));
    if (!d.body.trim()) await call('/api/study/human-direction/write', {parentStudyId: s.id, scope: 'project', operationId: op(), expectedRevision: d.revision, expectedHash: d.hash, body: DIRECTION(s.title)}, OWNER);
    reached = 3;
   }
   if (s.stage >= 4) {
    const paragraphs = s.stage >= 5 ? PARAGRAPHS(s.title) : PARAGRAPHS(s.title).slice(0, 2);
    let root = await call('/api/study-draft/read' + q(scope));
    if (!root.projection.some(r => r.words.trim())) {
     const last = root.projection.at(-1);
     await call('/api/study-draft/save', {...scope, operationId: op(), expected: root.expected, operations: paragraphs.map(raw => ({kind: 'insert', id: crypto.randomUUID(), beforeId: last.id, raw}))}, OWNER);
     root = await call('/api/study-draft/read' + q(scope));
    }
    const group = {rootBindingId: binding.bindingId, parentStudyId: s.id};
    const outputs = await call('/api/study/outputs' + q(group));
    if (!outputs.outputs?.length) await call('/api/study/outputs/create', {...group, kind: 'article', sourceBindingId: binding.bindingId, expectedNative: root.expected, expectedOutput: outputs.expectedOutput, operationId: op()}, OWNER);
    if (s.stage === 4) {
     const pending = ((await call('/api/study-ai/requests' + q(scope))).items || []).filter(i => i.status === 'pending');
     if (!pending.length) {
      const target = root.projection.find(r => r.words.trim()).id;
      const prep = await call('/api/study-ai/prepare' + q(scope), {purpose: 'scoped-revision', instruction: 'Make the first paragraph clearer.', targetParagraphIds: [target], sourceIds: ['author-page:' + binding.bindingId]});
      await call('/api/study-ai/propose' + q({...scope, requestId: prep.id}), {requestId: prep.id, replacements: [{id: target, words: 'It began with something small, noticed and then kept: ' + s.title.toLowerCase() + '.'}]});
     }
    }
    reached = s.stage;
   }
   if (s.stage >= 6 && !planDone) {
    let {plan} = await seedInstagramDemo(origin, {fetch: fetchFn});
    if (plan.subject !== s.id) plan = await call('/api/instagram/plan', {id: plan.id, operationId: op(), expectedRevision: plan.revision, expectedHash: plan.hash, subject: s.id});
    planDone = true; reached = 6;
   }
  } catch (e) { s.error = e.message; }
  done[s.id] = reached;
  if (reached < s.stage) unreached.push({id: s.id, title: s.title, wanted: s.stage, reached, why: s.error || 'not reached'});
  log(s.id + ' -> ' + reached);
 }


 // 2b. The subject whose Article quotes its captured source: one quote exact, one altered.
 let checkedSubject = null;
 if (!only || only.includes(CHECKED.slug)) {
  try {
   const id = SLUG(CHECKED.slug);
   let root = (await catalogAll()).find(c => c.parentStudyId === id);
   if (!root) {
    const all = await call('/api/study-draft/catalog'), original = all.drafts.find(d => d.id === CHECKED.original.id);
    if (!original) throw Error('the demo has no retained source to copy');
    const part = (await call('/api/study-draft/open', {parentStudyId: CHECKED.original.parent, originalId: original.originalId, originalHash: original.originalHash, operationId: op()})).binding;
    const expected = (await call('/api/study-draft/read' + q({parentStudyId: CHECKED.original.parent, bindingId: part.id}))).expected;
    await call('/api/study-draft/create-collection', {parentStudyId: id, title: CHECKED.title, operationId: op(), sourceBindingId: part.id, sourceParentStudyId: CHECKED.original.parent, expected});
    root = (await catalogAll()).find(c => c.parentStudyId === id);
   }
   const scope = {parentStudyId: id, bindingId: root.bindingId};
   let draft = await call('/api/study-draft/read' + q(scope));
   if (!draft.projection.some(r => r.words.trim())) {
    const last = draft.projection.at(-1);
    await call('/api/study-draft/save', {...scope, operationId: op(), expected: draft.expected, operations: CHECKED.words.map(raw => ({kind: 'insert', id: crypto.randomUUID(), beforeId: last.id, raw}))}, OWNER);
    draft = await call('/api/study-draft/read' + q(scope));
   }
   const group = {rootBindingId: root.bindingId, parentStudyId: id}, outputs = await call('/api/study/outputs' + q(group));
   if (!outputs.outputs?.length) await call('/api/study/outputs/create', {...group, kind: 'article', sourceBindingId: root.bindingId, expectedNative: draft.expected, expectedOutput: outputs.expectedOutput, operationId: op()}, OWNER);
   const place = ((await call('/api/subject-places')).places || []).find(p => p.parentStudyId === id) || {saved: false, revision: 0};
   if (!place.saved) await call('/api/subject-places/save', {parentStudyId: id, operationId: op(), expectedRevision: place.revision, folder: CHECKED.folder, tags: CHECKED.tags, pinned: false, archived: false, order: specs.length});
   checkedSubject = id; log(id + ' -> quotes its source');
  } catch (e) { unreached.push({id: SLUG(CHECKED.slug), title: CHECKED.title, wanted: 'quotes its source', reached: 'not made', why: e.message}); }
 }

 // 3. Where each subject lives. Only what differs is saved; the hand-set order is the position in the list.
 const places = new Map(((await call('/api/subject-places')).places || []).map(p => [p.parentStudyId, p]));
 for (const s of specs) {
  if (done[s.id] === undefined || done[s.id] < 0) continue;
  const p = places.get(s.id) || {saved: false, revision: 0};
  const same = p.saved && key(p.folder || []) === key(s.folder) && JSON.stringify(p.tags || []) === JSON.stringify(s.tags) && !!p.pinnedAt === s.pinned && !!p.archived === s.archived && p.order === s.order;
  if (same) continue;
  await call('/api/subject-places/save', {parentStudyId: s.id, operationId: op(), expectedRevision: p.revision, ...(p.saved ? {expectedHash: p.hash} : {}), folder: s.folder, tags: s.tags, pinned: s.pinned, archived: s.archived, order: s.order});
 }

 // 4. Things that need the owner. An ask is raised once, found again by its question.
 for (const a of ASKS) {
  if (needsAsks.some(x => x.question === a.question) || (only && !only.includes(a.slug))) continue;
  if (!done[SLUG(a.slug)] && done[SLUG(a.slug)] !== 0) continue;
  try {
   await call('/api/needs-you/raise', {operationId: op(), band: 'only-adrian', question: a.question, choices: a.choices, about: a.about, scope: {kind: 'project', id: SLUG(a.slug)}});
  } catch (e) { await call('/api/needs-you/raise', {operationId: op(), band: 'only-adrian', question: a.question, choices: a.choices, about: a.about}); }
 }
 return {origin, large, subjects: specs.length, checkedSubject, unreached, states: STATES, readBack: await readBack(origin, {fetch: fetchFn})};
}

/** Reads the world back through the commands and says which state each subject is in. */
export async function readBack(origin, {fetch: fetchFn = fetch} = {}) {
 const call = async path => { const r = await fetchFn(origin + path, {headers: {'X-AR-Actor': 'agent:claude-code', 'X-AR-Client': 'http'}}); const v = await r.json(); if (!r.ok) throw Error(path + ': ' + r.status + ' ' + v.error); return v; };
 const all = await call('/api/subject-places'), known = new Set([...BASE, ...largeSubjects()].map(x => SLUG(x[0]))), catalog = (await call('/api/study-draft/catalog')).collections.filter(c => known.has(c.parentStudyId));
 const placeOf = new Map(all.places.map(p => [p.parentStudyId, p])), topicsList = (await call('/api/inquiries/catalog' + gi({}))).collections;
 const asks = ((await call('/api/needs-you?status=open')).asks || []).filter(a => ASKS.some(x => x.question === a.question)), plans = (await call('/api/instagram/plans')).plans || [];
 const files = new Map(), walk = f => { files.set(f.rel_path, f.file_count || 0); (f.folders || []).forEach(walk); };
 for (const r of (await call('/api/sources/tree')).roots || []) if (r.id === 'library' && r.tree) walk(r.tree);
 const rows = [];
 for (const c of catalog) {
  const id = c.parentStudyId, place = placeOf.get(id) || {}, group = {rootBindingId: c.bindingId, parentStudyId: id}, scope = {parentStudyId: id, bindingId: c.bindingId};
  let sources = 0;
  try { sources = files.get('Projects/' + (await call('/api/first-flow/binding' + q({projectKey: id}))).projectId) || 0; } catch {}
  const topic = topicsList.some(t => t.name === c.title + ': research');
  let direction = false; try { direction = !!(await call('/api/study/human-direction' + q({parentStudyId: id}))).body.trim(); } catch {}
  let article = false; try { article = !!(await call('/api/study/outputs' + q(group))).outputs?.length; } catch {}
  let words = 0; try { words = (await call('/api/study-draft/read' + q(scope))).projection.reduce((n, r) => n + (r.words.trim() ? r.words.trim().split(/\s+/).length : 0), 0); } catch {}
  let pending = 0; try { pending = ((await call('/api/study-ai/requests' + q(scope))).items || []).filter(i => i.status === 'pending').length; } catch {}
  const plan = plans.some(p => p.subject === id);
  const stage = plan ? 6 : article && words >= 60 ? 5 : article && pending ? 4 : direction ? 3 : topic ? 2 : sources ? 1 : 0;
  rows.push({id, title: c.title, stage, state: STATES[stage], sources, topic, direction, article, words, suggestionsWaiting: pending, carousel: plan, folder: place.folder || [], tags: place.tags || [], pinned: !!place.pinnedAt, archived: !!place.archived, order: place.order ?? null});
 }
 const byState = {}; for (const r of rows) byState[r.state] = (byState[r.state] || 0) + 1;
 return {subjects: rows.length, byState, pinned: rows.filter(r => r.pinned).length, archived: rows.filter(r => r.archived).length, folders: [...new Set(rows.map(r => r.folder.join('/')))].sort(), needsYou: asks.length, rows};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
 try {
  const result = await fillDemo(undefined, {large: process.argv.includes('--large'), log: m => process.stderr.write(m + '\n')});
  const {rows, ...summary} = result.readBack;
  console.log(JSON.stringify({subjects: result.subjects, unreached: result.unreached, ...summary}, null, 1));
  console.log('Open: ' + result.origin + '/document-study/index.html');
 } catch (e) { console.error(e.message); process.exitCode = 1; }
}
void PLAN_TITLE;
