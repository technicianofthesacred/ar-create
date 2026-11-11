// Where a subject stands: the one pure rule (runtime/standing-rule.mjs) shared by the server and version two, and
// its browser copy. Invented facts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {standingOf, summaryOf, stepsFor, formsOf, say, TWELVE, STATES, STATIONS} from '../runtime/standing-rule.mjs';
import {standingBrowserSource, BROWSER_STANDING} from '../runtime/scripts/build-standing.mjs';

const NOW = Date.parse('2026-11-11T12:00:00Z');
const at = (s, id) => s.find(x => x.id === id);
const article = (extra = {}) => ({key: 'out:a1', id: 'a1', kind: 'article', title: 'Invented article', placements: 0, slides: 0, ...extra});
const carousel = (plan = {}) => ({key: 'ig:p1', id: 'p1', kind: 'instagram', title: 'Invented plan', plan: {format: 'carousel', stories: 2, chosen: false, chosenTitle: '', frames: 0, caption: false, ready: false, look: null, ...plan}});
/** Facts as the server gathers them, for an invented subject. */
function facts(over = {}) {
 return {id: 'invented-subject', title: 'An invented subject', bindingId: 'b', projectId: 'p', changedAt: '2026-11-10T09:00:00Z', asks: 0,
  material: {total: 0, recordings: 0, notes: 0, links: 0, photos: 0}, transcript: {open: 0, checked: false},
  research: {step: null, unreviewed: 0, topics: 0}, dish: {named: false, text: '', at: null, dishes: 0, direction: false},
  words: {paragraphs: 0, count: 0}, suggestions: 0, check: {status: null, issues: 0},
  consent: {people: [], released: false, overridden: false, ready: false, held: false}, pieces: [], ...over};
}
const notes = {total: 2, recordings: 0, notes: 2, links: 0, photos: 0};
const finishedWords = {words: {paragraphs: 6, count: 120}, suggestions: 0};

test('a subject with nothing yet: What you have is next, in Gather, and nothing past it is claimed done', () => {
 const s = standingOf(facts(), {now: NOW});
 assert.equal(s.station, 'gather'); assert.equal(s.stationName, 'Gather');
 assert.equal(s.next.step, 'have'); assert.equal(s.next.state, 'next'); assert.equal(s.next.note, 'Nothing yet');
 assert.equal(at(s.steps, 'dish').state, 'wait'); assert.equal(at(s.steps, 'dish').waitsFor, 'Material to be added');
 assert.equal(at(s.steps, 'form').state, 'wait');
 assert.equal(s.ring, 0); assert.equal(s.known, true);
});

test('a subject holding a voice note and notes is not "Nothing yet" and does not ask for material', () => {
 const s = standingOf(facts({material: notes, research: {step: 'review', unreviewed: 2, topics: 0}}), {now: NOW});
 assert.equal(at(s.steps, 'have').state, 'done'); assert.equal(at(s.steps, 'have').note, '2 notes');
 assert.notEqual(s.next.step, 'have'); assert.equal(s.next.step, 'facts'); assert.equal(s.station, 'research');
 assert.match(s.next.note, /2 sources not looked at yet/);
 assert.ok(!JSON.stringify(s).includes('Add material'));
});

test('a finished Article: The words are done and Check is next', () => {
 const s = standingOf(facts({material: notes, ...finishedWords, dish: {named: false, dishes: 0, direction: true}, pieces: [article()]}), {now: NOW});
 const steps = s.forms[0].steps;
 assert.equal(at(steps, 'words').state, 'done'); assert.equal(at(steps, 'words').note, '120 words');
 assert.equal(at(steps, 'check').state, 'next');
 assert.equal(s.next.step, 'check'); assert.equal(s.next.formName, 'Article'); assert.equal(s.station, 'create'); assert.equal(say(s.next), 'Check');
});

test('while a suggestion waits on the words, The words need him, and Check and Publish wait', () => {
 const s = standingOf(facts({material: notes, words: {paragraphs: 2, count: 30}, suggestions: 1, pieces: [article()]}), {now: NOW});
 const steps = s.forms[0].steps;
 assert.equal(at(steps, 'words').state, 'flag'); assert.equal(at(steps, 'words').note, '1 suggestion waiting');
 assert.equal(at(steps, 'check').state, 'wait'); assert.deepEqual(at(steps, 'check').waits, ['words']); assert.equal(at(steps, 'check').waitsFor, 'The suggestion to be settled');
 // Nothing says whether it is out, so Publish claims neither; once a record says it is not out, it waits.
 assert.equal(at(steps, 'publish').state, 'unknown'); assert.equal(at(steps, 'publish').note, 'Not known whether it is out');
 const out = standingOf(facts({material: notes, words: {paragraphs: 2, count: 30}, suggestions: 1, pieces: [article()], published: false}), {now: NOW}).forms[0].steps;
 assert.equal(at(out, 'publish').state, 'wait'); assert.ok(at(out, 'publish').waits.includes('words') && at(out, 'publish').waits.includes('check'));
 assert.equal(s.next.step, 'words'); assert.equal(s.next.state, 'flag'); assert.equal(say(s.next), 'The words: 1 suggestion waiting');
 // An Article not yet started does not claim a suggestion.
 assert.equal(at(stepsFor(formsOf(facts({pieces: [article()]}))[0], facts({pieces: [article()]})), 'words').note, 'Not started');
});

test('photographs in the Article wait for photographs to be added, not for What you have', () => {
 const steps = standingOf(facts({material: notes, ...finishedWords, pieces: [article()]}), {now: NOW}).forms[0].steps, ph = at(steps, 'photos');
 assert.equal(ph.name, 'Photographs in the article'); assert.equal(ph.state, 'wait'); assert.equal(ph.waitsFor, 'Photographs to be added'); assert.ok(!ph.waits);
 const withPhotos = standingOf(facts({material: {...notes, total: 3, photos: 1}, ...finishedWords, pieces: [article()]}), {now: NOW}).forms[0].steps;
 assert.ok(['todo', 'next'].includes(at(withPhotos, 'photos').state));
 const placed = standingOf(facts({material: notes, ...finishedWords, pieces: [article({placements: 2})]}), {now: NOW}).forms[0].steps;
 assert.equal(at(placed, 'photos').state, 'done');
});

test('Name the dish is done only when the board holds the dish he named; a written direction alone is not a named dish', () => {
 const written = standingOf(facts({material: notes, dish: {named: false, dishes: 0, direction: true}}), {now: NOW});
 assert.equal(at(written.steps, 'dish').state, 'todo'); assert.match(at(written.steps, 'dish').note, /direction is written; the dish is not named yet/);
 const named = standingOf(facts({material: notes, dish: {named: true, text: 'A slow morning', at: '2026-11-02T08:00:00Z', dishes: 2, direction: true}}), {now: NOW});
 assert.equal(at(named.steps, 'dish').state, 'done'); assert.equal(at(named.steps, 'dish').note, 'Named on the board, 2 Nov');
 const possible = standingOf(facts({material: notes, dish: {named: false, dishes: 3, direction: false}}), {now: NOW});
 assert.equal(at(possible.steps, 'dish').note, '3 possible dishes');
});

test('an Article and a chosen Carousel: forms in order, and the next step is the first unfinished form\'s', () => {
 const f = facts({material: notes, ...finishedWords, pieces: [article(), carousel({chosen: true, chosenTitle: 'The waiting', frames: 6})]});
 const s = standingOf(f, {now: NOW});
 assert.deepEqual(s.forms.map(x => x.name), ['Article', 'Carousel']);
 assert.equal(s.next.form, 'out:a1'); assert.equal(s.next.step, 'check');
 assert.equal(s.forms[1].next.step, 'posttext'); assert.equal(at(s.forms[1].steps, 'story').state, 'done');
 // Once the Article is published, the Carousel leads.
 const pub = standingOf({...f, published: true}, {now: NOW});
 assert.equal(pub.station, 'published');
 const two = standingOf(facts({material: notes, ...finishedWords, pieces: [article(), carousel({chosen: true, frames: 6})], consent: {people: [], released: true}}), {now: NOW});
 assert.equal(two.next.form, 'out:a1');
});

test('a Carousel-only subject still has real steps, and reaches Write, Read and Check from its post text step', () => {
 const s = standingOf(facts({material: notes, pieces: [carousel()]}), {now: NOW});
 assert.equal(s.forms.length, 1); assert.equal(s.forms[0].name, 'Carousel');
 const steps = s.forms[0].steps, post = at(steps, 'posttext');
 for (const sec of ['write', 'read', 'check']) assert.ok(post.sections.includes(sec), sec);
 assert.equal(at(steps, 'story').state, 'flag'); assert.equal(at(steps, 'slides').state, 'wait');
 assert.equal(s.next.step, 'story'); assert.equal(s.next.note, '2 stories to choose from');
 for (const sec of ['write', 'read', 'check']) assert.ok(s.reached.includes(sec));
});

test('every one of the workspace\'s twelve sections is reachable from some step', () => {
 const f = facts({material: notes, pieces: [article(), {key: 'out:c', id: 'c', kind: 'carousel', slides: 0}, carousel()]});
 const s = standingOf(f, {now: NOW});
 assert.deepEqual(s.reached, TWELVE);
 for (const step of s.forms.flatMap(x => x.steps)) {assert.ok(STATES.includes(step.state)); assert.equal(step.section, step.sections[0]);}
});

test('a fact not read is never guessed: its steps say Not known and no next step is claimed', () => {
 const s = standingOf(facts({material: notes, ...finishedWords, check: null, pieces: [article()]}), {now: NOW});
 assert.equal(at(s.forms[0].steps, 'check').state, 'unknown'); assert.equal(at(s.forms[0].steps, 'check').note, 'Not known');
 assert.equal(at(s.forms[0].steps, 'publish').state, 'unknown');
 assert.equal(s.next, null); assert.equal(s.known, false);
 const noPieces = standingOf(facts({material: notes, pieces: null}), {now: NOW});
 assert.equal(at(noPieces.steps, 'form').state, 'unknown'); assert.equal(noPieces.next, null);
 const noMaterial = standingOf(facts({material: null}), {now: NOW});
 assert.equal(at(noMaterial.steps, 'have').state, 'unknown'); assert.equal(noMaterial.next, null);
});

test('resting: long untouched; and the short summary carries no steps', () => {
 const s = standingOf(facts({material: notes, changedAt: '2026-08-01T00:00:00Z'}), {now: NOW});
 assert.equal(s.station, 'resting');
 const short = summaryOf(standingOf(facts({material: notes, pieces: [article()]}), {now: NOW}));
 assert.ok(!('steps' in short) && !('reached' in short)); assert.ok(!('steps' in short.forms[0]));
 assert.deepEqual(Object.keys(short.forms[0]).sort(), ['alike', 'createdAt', 'done', 'finished', 'id', 'key', 'kind', 'name', 'next', 'ring', 'slides', 'title', 'to', 'total', 'updatedAt', 'words'].sort());
 assert.ok(STATIONS.some(x => x.id === short.station));
});

// The seven kinds of subject the demo fill makes (scripts/demo-fill.mjs), as facts shaped like the server's.
test('the seven kinds of demo subject each stand where their records put them', () => {
 const topics = {step: 'review', unreviewed: 2, topics: 1};
 const kinds = {
  'Nothing yet': [facts(), 'gather', 'have'],
  'Recording and notes only': [facts({material: notes, research: {step: 'attach', unreviewed: 0, topics: 0}}), 'research', 'facts'],
  'Research with findings': [facts({material: notes, research: topics}), 'research', 'facts'],
  'Direction written': [facts({material: notes, research: topics, dish: {named: false, dishes: 0, direction: true}}), 'research', 'facts'],
  'Article half written, one suggestion waiting': [facts({material: notes, research: topics, dish: {named: false, direction: true}, words: {paragraphs: 2, count: 30}, suggestions: 1, pieces: [article()]}), 'create', 'words'],
  'Article finished': [facts({material: notes, research: topics, dish: {named: false, direction: true}, ...finishedWords, pieces: [article()]}), 'create', 'check'],
  'Carousel plan': [facts({material: notes, research: topics, dish: {named: false, direction: true}, ...finishedWords, transcript: {open: 2, checked: true}, pieces: [article(), carousel({chosen: true, frames: 6})]}), 'gather', 'transcript'],
 };
 for (const [name, [f, station, step]] of Object.entries(kinds)) {
  const s = standingOf(f, {now: NOW});
  assert.equal(s.station, station, name); assert.equal(s.next?.step, step, name); assert.equal(s.known, true, name);
 }
});

test('the browser copy is the rule itself, built from it', async () => {
 assert.equal(fs.readFileSync(BROWSER_STANDING, 'utf8'), await standingBrowserSource(), 'run npm run build');
 const browser = await import('../public/v2/shell/standing.js');
 const f = facts({material: notes, ...finishedWords, pieces: [article()]});
 assert.deepEqual(browser.standingOf(f, {now: NOW}), standingOf(f, {now: NOW}));
 assert.equal(typeof globalThis.v2Standing.standingOf, 'function');
});

test('archived rests whatever its steps say; published is null unless a record says; a step not known stops the lead', () => {
 const a = standingOf(facts({material: notes, archived: true}), {now: NOW});
 assert.equal(a.station, 'resting'); assert.equal(a.resting, 'archived'); assert.equal(a.archived, true);
 assert.equal(standingOf(facts({material: notes}), {now: NOW}).resting, null);
 assert.equal(standingOf(facts({material: notes, pieces: [article()]}), {now: NOW}).published, null);
 assert.equal(standingOf(facts({material: notes, pieces: [article()], published: false}), {now: NOW}).published, false);
 // The check was not read: photographs waiting earlier must not be put forward as the next step.
 const s = standingOf(facts({material: notes, ...finishedWords, check: null, pieces: [article()]}), {now: NOW});
 assert.equal(s.next, null);
 // A step that needs him before the unknown one still leads.
 const f = standingOf(facts({material: notes, words: {paragraphs: 2, count: 30}, suggestions: 1, check: null, pieces: [article()]}), {now: NOW});
 assert.equal(f.next.step, 'words');
});

// ---------- real records on the subject page (First look, 12 November) ----------
const slidesPiece = (extra = {}) => ({key: 'out:c1', id: 'c1', kind: 'carousel', title: '', status: null, placements: 0, slides: 5, words: 41, createdAt: '2026-10-03T08:15:00Z', updatedAt: '2026-10-05T09:00:00Z', ...extra});

test('a form carries what tells two of the same name apart: its slide count and when it was made and last changed', () => {
 const s = standingOf(facts({material: notes, ...finishedWords, pieces: [slidesPiece(), slidesPiece({key: 'out:c2', id: 'c2', slides: 7, words: 60, createdAt: '2026-10-09T10:00:00Z', updatedAt: null})]}), {now: NOW});
 assert.deepEqual(s.forms.map(f => [f.name, f.alike, f.slides, f.createdAt, f.updatedAt]), [['Carousel', true, 5, '2026-10-03T08:15:00Z', '2026-10-05T09:00:00Z'], ['Carousel', true, 7, '2026-10-09T10:00:00Z', null]]);
 const art = standingOf(facts({material: notes, ...finishedWords, pieces: [article()]}), {now: NOW}).forms[0];
 assert.deepEqual([art.slides, art.createdAt, art.updatedAt, art.words], [0, null, null, null], 'nothing is invented for a piece with no such record');
});

test('the words on a Carousel are its own slides\' words, never the whole article\'s count', () => {
 const f = (piece, words) => at(standingOf(facts({material: notes, words, suggestions: 0, pieces: [piece]}), {now: NOW}).forms[0].steps, 'words');
 const article1428 = {paragraphs: 12, count: 1428};
 assert.equal(f(slidesPiece(), article1428).note, '41 words');
 assert.equal(f(slidesPiece({words: 1}), article1428).note, '1 word');
 for (const [what, piece] of [['no text in its records', slidesPiece({words: null})], ['words not recorded', slidesPiece({words: undefined})], ['no words', slidesPiece({words: 0})], ['no slides', slidesPiece({slides: 0, words: null})]]) {
  const step = f(piece, article1428);
  assert.notEqual(step.state, 'done', what + ': the records do not support done');
  assert.equal(step.note, 'Nothing written on the slides yet', what);
 }
 assert.equal(f({...article(), id: 'a'}, article1428).note, '1428 words', 'an Article still counts its own words');
});

test('a finished research result is not called findings until findings are known to be there', () => {
 const f = research => at(stepsFor(null, facts({material: notes, research})), 'facts');
 assert.equal(f({step: 'directions', unreviewed: 0}).note, 'Research came back');
 assert.equal(f({step: 'directions', unreviewed: 0}).state, 'flag');
 assert.equal(f({step: 'directions', unreviewed: 0}).why, 'research-result');
 assert.equal(f({step: 'directions', unreviewed: 0, findings: 3}).note, 'Findings to read');
 const none = f({step: 'directions', unreviewed: 0, findings: 0});
 assert.equal(none.state, 'wait'); assert.equal(none.note, 'The question is asked, waiting for findings'); assert.equal(none.waitsFor, 'Findings');
 assert.ok(!JSON.stringify(none).includes('Findings to read'));
});
