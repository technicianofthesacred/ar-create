#!/usr/bin/env node
// memo-looks: the first frame of a story in three genuinely different looks, as PNGs to show Adrian side by side.
//   node agents/memo/memo-looks.mjs <planId> <storyId> [--format story] [--looks id,id,id]
// Lays the story out once per look (the plan is not ready yet, so this changes nothing of his), renders frame 1 of
// each, then lays it out again in the first look. When he picks one, lay the story out in that look.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ARC, arc, fail, guard} from './memo-lib.mjs';

const args = process.argv.slice(2);
const [planId] = args.filter(a => /^[0-9a-f-]{36}$/i.test(a));
const storyId = args.find(a => /^S\d+$/.test(a));
const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'story';
if (!planId || !storyId) fail('usage: memo-looks <planId> <storyId> [--format story] [--looks id,id,id]');

let plan = await arc('GET', `/api/instagram/plan?id=${planId}`);
if (plan.ready?.[format]) fail(`He already said this ${format} is ready; leave its look as it is.`);
const byDoor = {teajia: ['canvas-C04-cover-teajia-dark', 'canvas-F04-full-line', 'canvas-P06-night'], art: ['AR-S1', 'canvas-N13-cover-box', 'canvas-F01-full-quote']};
const looks = args.includes('--looks') ? args[args.indexOf('--looks') + 1].split(',') : byDoor[plan.door] || ['AR-S1', 'canvas-C04-cover-teajia-dark', 'canvas-F04-full-line'];

plan = await arc('POST', '/api/instagram/layout', {...guard(plan), storyId, format});
const shape = plan.layouts[format].frames;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-looks-')), out = [];
for (const [i, templateId] of looks.entries()) {
  const frames = shape.map(f => ({templateId, role: f.role, words: f.words.map(w => ({lineId: w.lineId, text: w.text})), label: f.label, credit: f.credit, photos: f.photos}));
  plan = await arc('POST', '/api/instagram/layout', {...guard(plan), storyId, format, frames});
  const response = await fetch(`${ARC}/api/instagram/png?id=${planId}&format=${format}&frame=0`, {headers: {'X-AR-Actor': 'agent:claude-code'}});
  if (!response.ok) { out.push({look: i + 1, templateId, error: `HTTP ${response.status}`}); continue; }
  const file = path.join(dir, `look-${i + 1}-${templateId}.png`); fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  out.push({look: i + 1, templateId, file});
}
const first = shape.map(f => ({templateId: looks[0], role: f.role, words: f.words.map(w => ({lineId: w.lineId, text: w.text})), label: f.label, credit: f.credit, photos: f.photos}));
await arc('POST', '/api/instagram/layout', {...guard(plan), storyId, format, frames: first});
// One picture of the three side by side, when ffmpeg is there, so the chat shows a single comparison.
let sheet = null;
const made = out.filter(o => o.file);
if (made.length > 1) {
  const {spawnSync} = await import('node:child_process');
  const target = path.join(dir, 'looks-side-by-side.png');
  const run = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...made.flatMap(o => ['-i', o.file]), '-filter_complex', made.map((_, i) => `[${i}:v]scale=540:-1[v${i}]`).join(';') + ';' + made.map((_, i) => `[v${i}]`).join('') + `hstack=inputs=${made.length}`, target]);
  if (run.status === 0) sheet = target;
}
console.log(JSON.stringify({looks: out, sheet, note: 'Show these three side by side; when he picks one, lay the story out in that template (instagram.layout with frames).'}, null, 1));
