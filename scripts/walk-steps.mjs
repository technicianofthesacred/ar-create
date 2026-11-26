#!/usr/bin/env node
// Walk every step of one Magazine story as an agent, following the step guide (runtime/agent-guide.mjs), and report
// what each step showed before, what the agent did, which of Adrian's decisions were refused to it, and what each step
// shows after. It proves the guide is enough for an agent to work through a story, and that what an agent does shows.
//
//   node scripts/walk-steps.mjs --url http://127.0.0.1:8854 [--actor agent:hermes] [--story mag-kiln-keeper] [--json]
//
// Invented data only: it writes (working notes, proposals, consent records, a download), so it refuses the installed
// app's port 8841. Use `npm run demo` (8854) or a test server. Exit 0 when every step walked as the guide says.
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '../agents/lib/client.mjs';

const op = () => randomUUID();
/** A story with no draft yet: the first one is proposed at its standard name, and becomes the story's Article when he accepts it. */
const firstDraft = name => `Workflow/3-Develop/DEV - ${name} (story).md`;

/** One walker per Magazine step id: reads, then the agent's moves, then one of his decisions (expected 403). */
const WALK = {
 async have(w) {
  const story = await w.read('magazine.story', {id: w.storyId});
  const src = story.vaultRecords?.src?.[0]?.rel;
  if (!src) return w.note('No source file is registered, so nothing was added.');
  const file = await w.read('magazine.read', {path: src});
  await w.read('magazine.drops', {});
  const written = await w.do('magazine.write', {path: src, content: file.text.replace(/\n*$/, '\n') + '\nA line the agent added from what Adrian handed over.\n', expectedHash: file.hash, operationId: op()});
  w.expect(written.written === true, 'a source note saves directly');
  const context = story.vaultRecords?.context?.[0]?.rel;
  if (context) {const c = await w.read('magazine.read', {path: context}); const p = await w.do('magazine.write', {path: context, content: c.text.replace(/\n*$/, '\n') + '\nA line for his context, for him to accept.\n', expectedHash: c.hash, operationId: op()}); w.expect(p.proposed === true, 'his context becomes a proposal'); w.proposals.push(p.proposalId);}
 },
 async facts(w) {
  await w.read('research-topics.subject', {parentStudyId: w.id});
  const rel = `Workflow/3-Develop/RESEARCH - ${w.name}.md`, now = await w.read('magazine.read', {path: rel});
  const r = await w.do('magazine.write', {path: rel, content: (now.exists ? now.text.replace(/\n*$/, '\n') : '---\ntype: RESEARCH\nstory: ' + w.name + '\n---\n') + '\n## A finding\n\nWhat was looked up, with where it came from.\n', expectedHash: now.exists ? now.hash : null, operationId: op()});
  w.expect(r.written === true, 'the research file saves directly');
  await w.yours('research-topics.start', {operationId: op(), name: 'A question only he starts'});
 },
 async dish(w) {
  const board = await w.read('simmer.board.get', {subject: w.id});
  await w.read('simmer.material', {subject: w.id});
  const proposed = await w.do('simmer.propose', {subject: w.id, operationId: op(), expectedRevision: board.revision, expectedHash: board.hash, dishes: [{title: 'The patience of the craft', why: 'It keeps coming back in his notes.'}, {title: 'A teacher who never hurries', why: 'Her own words say it.'}]});
  const named = await w.do('simmer.dish', {subject: w.id, sentence: 'The words Adrian said, carried exactly.', said: 'typed', operationId: op(), expectedRevision: proposed.revision, expectedHash: proposed.hash});
  w.expect(named.forming?.named?.dictated?.carriedBy === w.actor, 'the dish is recorded as his words, carried by the agent');
 },
 async words(w) {
  const story = await w.read('magazine.story', {id: w.storyId});
  if (!story.draft?.exists) {
   const rel = firstDraft(w.name), now = await w.read('magazine.read', {path: rel});
   const p = await w.do('magazine.write', {path: rel, content: '---\ntype: DEV\nstory: ' + w.name + '\ntitle: "' + w.name + '"\n---\n\nA first draft the agent suggests, from the sources.\n', expectedHash: now.exists ? now.hash : null, operationId: op()});
   w.expect(p.proposed === true, 'the first draft is a suggestion for him');
   w.proposals.push(p.proposalId); w.firstDraft = p.proposalId;
   return w.note('The first draft waits for his yes; once he accepts it, it is this story\'s Article.');
  }
  const draft = await w.read('magazine.working-draft.read', {storyId: w.storyId, pieceId: w.pieceId, edition: 'working'});
  await w.read('magazine.proposals', {story: w.storyId});
  await w.read('magazine.article-questions', {storyId: w.storyId, pieceId: w.pieceId});
  const doc = draft.document;
  if (!doc?.exists) return w.note('This story has no draft yet, so no words were proposed.');
  const p = await w.do('magazine.write', {path: doc.path, content: doc.text.replace(/\n*$/, '\n') + '\nA paragraph the agent suggests, from the sources.\n', expectedHash: doc.hash, operationId: op()});
  w.expect(p.proposed === true, 'words become a suggestion for him');
  w.proposals.push(p.proposalId);
  const after = await w.read('magazine.working-draft.read', {storyId: w.storyId, pieceId: w.pieceId, edition: 'working'});
  w.expect(after.document.hash === doc.hash, 'his words are unchanged until he accepts');
  await w.yours('magazine.proposal.accept', {proposalId: p.proposalId, operationId: op()});
 },
 async photos(w) {
  await w.read('magazine.library-photos', {});
  const story = await w.read('magazine.story', {id: w.storyId});
  if (!story.draft?.exists) return w.note('This story has no draft yet, so no photograph was placed.');
  const draft = await w.read('magazine.working-draft.read', {storyId: w.storyId, pieceId: w.pieceId, edition: 'working'});
  const doc = draft.document;
  if (!doc?.exists) return w.note('This story has no draft yet, so no photograph was placed.');
  const p = await w.do('magazine.write', {path: doc.path, content: doc.text.replace(/\n*$/, '\n') + '\n%%photo: bowl.jpg · The first bowl out of the kiln · cover%%\n', expectedHash: doc.hash, operationId: op()});
  w.expect(p.proposed === true, 'a photograph placement is a suggestion on the words');
  w.proposals.push(p.proposalId);
 },
 async check(w) {
  const story = await w.read('magazine.story', {id: w.storyId});
  if (!story.draft?.exists) return w.note('This story has no draft yet, so nothing was checked.');
  const src = story.vaultRecords?.src?.[0]?.rel;
  const found = await w.read('magazine.check', {draft: story.draft.path, ...(src ? {source: src} : {})});
  const rel = `Workflow/4-Review/CHECK - ${w.name} (story, round 9).md`, now = await w.read('magazine.read', {path: rel});
  const r = await w.do('magazine.write', {path: rel, content: '---\ntype: CHECK\nstory: ' + w.name + '\n---\n\n' + (found.quotes?.lines || ['Checked.']).join('\n') + '\n', expectedHash: now.exists ? now.hash : null, operationId: op()});
  w.expect(r.written === true, 'the check is written down');
 },
 async yes(w) {
  let desk = await w.read('consent.desk', {parentStudyId: w.id});
  desk = await w.do('consent.claims.record', {parentStudyId: w.id, operationId: op(), expectedRevision: desk.revision, expectedHash: desk.hash, claim: {kind: 'quote', text: 'Ash is just the fire\'s handwriting.'}});
  desk = await w.do('consent.people.record', {parentStudyId: w.id, operationId: op(), expectedRevision: desk.revision, expectedHash: desk.hash, person: {name: 'The keeper', appears: ['named', 'quoted']}});
  const person = desk.people.at(-1);
  desk = await w.do('consent.people.draft-request', {parentStudyId: w.id, operationId: op(), expectedRevision: desk.revision, expectedHash: desk.hash, personId: person.id, text: 'May I share the piece with your words in it?'});
  w.expect(desk.people.find(p => p.id === person.id)?.request, 'the request is drafted for him to send');
  await w.yours('consent.share.answer', {parentStudyId: w.id, operationId: op(), expectedRevision: desk.revision, expectedHash: desk.hash, question: 'comfort', answer: 'yes'});
 },
 async publish(w) {
  const story = await w.read('magazine.story', {id: w.storyId});
  if (!story.draft?.exists) return w.note('This story has no draft yet, so there is nothing to publish.');
  await w.read('magazine.send.approval', {path: story.draft.path});
  await w.yours('magazine.approve', {path: story.draft.path, value: 'yes', expectedHash: story.draft.hash, operationId: op()});
  await w.yours('magazine.send', {path: story.draft.path, piece: 'story', expectedHash: story.draft.hash, operationId: op()});
 },
};
export const WALKED = Object.freeze(Object.keys(WALK));

export async function walk({url, actor = 'agent:claude-code', story = null, fetchImpl = fetch} = {}) {
 if (Number(new URL(url).port) === 8841) throw new Error('The walk writes invented records; it never runs against the installed app on 8841. Use npm run demo (8854).');
 const client = createClient({url, actor, client: 'cli', fetchImpl});
 const call = async (name, input) => client.call(name, input);
 const guide = async id => {const r = await call('agent.guide', {parentStudyId: id}); if (!r.ok) throw new Error('agent.guide: ' + (r.body?.error || r.status)); return r.body;};
 let id = story;
 if (!id) {const all = await call('subjects.standing', {}); id = (all.body?.subjects || []).find(s => s.id.startsWith('mag-') && s.next)?.id; if (!id) throw new Error('No Magazine story to walk. Name one with --story.');}
 const before = await guide(id);
 if (before.story.kind !== 'magazine') throw new Error('The walk follows a Magazine story; ' + id + ' is a ' + before.story.kind + '.');
 const name = (await call('magazine.story', {id: before.story.ids.storyId})).body?.name;
 const report = {schema: 'ar-create.walk.v1', actor, story: {id, title: before.story.title, name}, steps: [], proposals: [], ok: true};
 const steps = before.forms[0].steps;
 for (const s of steps) {
  const row = {id: s.id, name: s.name, before: {state: s.state, note: s.note}, youGive: s.youGive, agentDoes: s.agentDoes, called: [], refused: [], checks: [], notes: [], gaps: [], problems: []};
  const allowed = new Set([...(s.read || []), ...(s.do || [])]), his = new Set(s.yours || []);
  const w = {
   id, actor, name, storyId: before.story.ids.storyId, pieceId: before.story.ids.pieceId, proposals: report.proposals,
   async read(command, input) {if (!allowed.has(command) && !WIDE.has(command)) row.problems.push(`${command} is not in the guide for this step`); const r = await call(command, input); row.called.push({command, status: r.status}); if (!r.ok) throw Object.assign(new Error(`${command} answered ${r.status}: ${r.body?.error || ''}`), {row}); return r.body;},
   async do(command, input) {return w.read(command, input);},
   async yours(command, input) {if (!his.has(command)) row.problems.push(`${command} is not listed as his for this step`); const r = await call(command, input); row.refused.push({command, status: r.status}); if (r.status !== 403) row.problems.push(`${command} answered ${r.status} to an agent; it should be refused (403)`);},
   expect(ok, what) {row.checks.push({what, ok: !!ok}); if (!ok) row.problems.push('Not so: ' + what);},
   note(text) {row.notes.push(text);},
   gap(text) {row.gaps.push(text);},
  };
  if (!WALK[s.id]) row.notes.push('No walk is written for this step.');
  else try {await WALK[s.id](w);} catch (error) {row.problems.push(error.message);}
  report.steps.push(row);
 }
 const after = await guide(id);
 for (const row of report.steps) {const s = after.forms[0].steps.find(x => x.id === row.id); row.after = s ? {state: s.state, note: s.note} : null;}
 // What the agent did must show on the story's own steps.
 const shown = {facts: s => s.state === 'done', dish: s => s.state === 'done', words: s => s.state === 'flag' && /suggestion/.test(s.note), yes: s => /drafted|asked|answer/i.test(s.note)};
 for (const row of report.steps) if (shown[row.id] && row.called.length && !row.problems.length && !row.gaps.length && !shown[row.id](row.after || {})) row.problems.push(`What the agent did does not show: the step says "${row.after?.note}"`);
 report.next = after.story.next;
 report.ok = report.steps.every(r => !r.problems.length);
 report.gaps = report.steps.flatMap(r => r.gaps.map(text => ({step: r.id, text})));
 return report;
}
/** Reads any step may make on the way (the story itself, a file by path). */
const WIDE = new Set(['magazine.story', 'magazine.read']);

export function plain(report) {
 const lines = [`Walked "${report.story.title}" (${report.story.id}) as ${report.actor}.`, ''];
 for (const r of report.steps) {
  lines.push(`${r.problems.length ? '✗' : '✓'} ${r.name}: ${r.before.note || r.before.state} → ${r.after?.note || r.after?.state || 'not shown'}`);
  for (const c of r.checks) lines.push(`    ${c.ok ? 'yes' : 'NO '}  ${c.what}`);
  for (const x of r.refused) lines.push(`    his  ${x.command} refused to the agent (${x.status})`);
  for (const n of r.notes) lines.push(`    note ${n}`);
  for (const g of r.gaps) lines.push(`    GAP  ${g}`);
  for (const p of r.problems) lines.push(`    PROBLEM ${p}`);
 }
 lines.push('', report.ok ? 'Every step walked as the guide says.' : 'Some steps did not walk as the guide says.', report.next ? `Next on the story page: ${report.next.name} (${report.next.note}).` : 'No next step is named.');
 return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const args = process.argv.slice(2), get = flag => {const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined;};
 const url = get('--url') || process.env.AR_CREATE_URL || 'http://127.0.0.1:8854';
 const report = await walk({url, actor: get('--actor') || process.env.AR_CREATE_ACTOR || 'agent:claude-code', story: get('--story') || null});
 console.log(args.includes('--json') ? JSON.stringify(report, null, 1) : plain(report));
 process.exitCode = report.ok ? 0 : 1;
}
