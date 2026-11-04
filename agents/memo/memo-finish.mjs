#!/usr/bin/env node
// memo-finish: after Adrian's yes (instagram.ready carried with his words), the mechanical end of a phone memo.
//   node agents/memo/memo-finish.mjs <planId> <memoId> [--format story]
// Renders every frame, leaves the posting kit on his memo page (Save to Photos, Copy caption) and hands the plan on
// to the Mac (one way). Refuses if the format is not ready. Posts nothing to Instagram. Prints one JSON summary.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ARC, arc, fail, site} from './memo-lib.mjs';

const [planId, memoId] = process.argv.slice(2).filter(a => /^[0-9a-f-]{36}$/i.test(a));
const args = process.argv.slice(2), format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'story';
if (!planId || !memoId) fail('usage: memo-finish <planId> <memoId> [--format story|reel|post|carousel]');

const plan = await arc('GET', `/api/instagram/plan?id=${planId}`);
const layout = plan.layouts?.[format], ready = plan.ready?.[format];
if (!layout) fail(`Nothing is laid out as a ${format} yet.`);
if (!ready) fail(`Adrian has not said this ${format} is ready; carry his yes (instagram.ready with said) first.`);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-finish-')), frames = [];
for (let i = 0; i < layout.frames.length; i++) {
  const response = await fetch(`${ARC}/api/instagram/png?id=${planId}&format=${format}&frame=${i}`, {headers: {'X-AR-Actor': 'agent:claude-code'}});
  if (!response.ok) fail(`Frame ${i + 1} did not render: HTTP ${response.status} ${(await response.text()).slice(0, 160)}`);
  const file = path.join(dir, `${format}-${i + 1}.png`); fs.writeFileSync(file, Buffer.from(await response.arrayBuffer())); frames.push(file);
}
const caption = layout.captionFinal ?? ready.caption ?? layout.caption?.text ?? '';
await site(`memos/${memoId}/kit`, {method: 'POST', body: {format, caption, frames: frames.length}});
for (const [i, file] of frames.entries()) await site(`memos/${memoId}/kit?frame=${i + 1}`, {method: 'POST', body: new Uint8Array(fs.readFileSync(file)), type: 'image/png'});
const handed = await arc('POST', '/api/instagram/handoff', {id: planId, memoId});
console.log(JSON.stringify({done: true, format, frames, caption, kit: `${frames.length} frames and the caption are on mandalacodes.com/memo/ (Save to Photos, Copy caption)`, handoff: handed.handoff}, null, 1));
