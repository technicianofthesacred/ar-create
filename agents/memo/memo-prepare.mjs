#!/usr/bin/env node
import crypto from 'node:crypto';
// memo-prepare: the mechanical half of a phone memo, so the agent can go straight to the stories.
//   node agents/memo/memo-prepare.mjs [memoId] [--door teajia|art|mandala-codes|personal]
// With no memo id it takes the oldest memo with a transcript that this VPS has not collected yet.
// It files the transcript exactly as transcribed and the photos into Library, opens the Instagram plan
// (subject memo-<id>, so consent can be checked), adds the second transcriber's doubts as words to confirm, and marks
// the memo collected. It decides nothing of Adrian's. Prints one JSON summary for the agent to read.
import {arc, fail, guard, site} from './memo-lib.mjs';

const args = process.argv.slice(2);
const door = args.includes('--door') ? args[args.indexOf('--door') + 1] : 'personal';
let memoId = args.find(a => /^[0-9a-f-]{36}$/i.test(a));

if (!memoId) {
  const {memos} = await site('memos?waiting=collect&by=vps');
  if (!memos.length) { console.log(JSON.stringify({ready: false, note: 'No memo with a transcript is waiting. If he just sent one, run memo-transcribe first.'})); process.exit(0); }
  memoId = memos[0].id;
}
const detail = await site(`memos/${memoId}`);
if (!detail.transcript) fail(`Memo ${memoId} has no transcript yet; run memo-transcribe first.`);
const full = await (await site(`memos/${memoId}/files/transcript`, {raw: true})).json().catch(() => ({}));
const day = detail.memo.createdAt.slice(0, 10), title = (detail.memo.title || 'Memo').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Memo';

const files = [{name: `${day} ${title}.md`, content: detail.transcript}];
for (const photo of detail.files.photos) {
  const response = await site(`memos/${memoId}/files/${photo.id}`, {raw: true});
  if (!response.ok) fail(`Photo ${photo.name} could not be fetched (HTTP ${response.status}).`);
  files.push({name: photo.name, base64: Buffer.from(await response.arrayBuffer()).toString('base64')});
}
const imported = await arc('POST', '/api/sources/import', {rootId: 'library', folder: `Instagram/${day} ${title}`, urls: [], files});
const failed = imported.receipts.filter(r => !r.ok);
if (failed.length) fail('Library refused: ' + failed.map(r => `${r.name}: ${r.error}`).join('; '));
const [transcript, ...photos] = imported.receipts.map(r => r.source);

let plan = await arc('POST', '/api/instagram/plan', {operationId: crypto.randomUUID(), title, door, subject: `memo-${memoId}`,
  material: {transcripts: [{sourceId: transcript.id, sourceHash: transcript.hash}], photos: photos.map(p => ({sourceId: p.id, caption: p.name || ''}))}});

// The second transcriber's doubts: each an exact run of words in a line, with what the other model heard.
const doubts = Array.isArray(full.doubts) ? full.doubts : [];
const flags = [];
for (const d of doubts) {
  const line = plan.lines.find(l => l.text.includes(d.heard));
  if (line) flags.push({lineId: line.id, heard: d.heard, kind: 'other', suggestion: d.alt || '', why: d.alt ? `The second transcriber heard "${d.alt}".` : 'The second transcriber heard nothing here.'});
}
if (flags.length) plan = await arc('POST', '/api/instagram/plan', {...guard(plan), flags});
await site(`memos/${memoId}/picked`, {method: 'POST', body: {by: 'vps'}});

console.log(JSON.stringify({
  ready: true, memoId, planId: plan.id, revision: plan.revision, hash: plan.hash, title, door,
  photos: plan.material.photos.map((p, i) => ({photoId: `P${i + 1}`, caption: p.caption})),
  moments: plan.moments.map(m => ({id: m.id, at: m.at, until: m.until, lines: m.lineIds})),
  lines: plan.lines.map(l => ({id: l.id, at: l.at ?? null, text: l.text})),
  wordsToConfirm: plan.flags.map(f => ({flagId: f.id, lineId: f.lineId, heard: f.heard, kind: f.kind, suggestion: f.suggestion || ''})),
  next: 'Propose two or three stories (instagram.plan stories + coverage), then send ONE numbered message of asks with defaults.',
}, null, 1));
