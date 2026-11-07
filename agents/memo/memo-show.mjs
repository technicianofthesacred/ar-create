#!/usr/bin/env node
// memo-show: the Instagram studio as Adrian would see it in AR Create, one part at a time, as PNGs for a chat to show.
//   node agents/memo/memo-show.mjs <planId> [--parts material,story,words,made,research] [--width 430]
// Drawn by the studio's own code (public/document-study/instagram-mirror.html), so the chat and the app cannot drift.
// Opened as an agent: it reads, it never presses one of his buttons. One picture per story, one per other part;
// a part with nothing in it is left out. Prints one JSON summary with the files, in the order to show them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ARC, arc, fail} from './memo-lib.mjs';
import {chrome} from '../../runtime/services/instagram-studio.mjs';

const args = process.argv.slice(2);
const [planId] = args.filter(a => /^[0-9a-f-]{36}$/i.test(a));
const opt = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const parts = opt('--parts', 'material,story,words,made,research').split(',');
const width = Number(opt('--width', '430'));
if (!planId) fail('usage: memo-show <planId> [--parts material,story,words,made,research] [--width 430]');

const plan = await arc('GET', `/api/instagram/plan?id=${planId}`);
const run = promisify(execFile), bin = chrome(), base = [...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), '--headless', '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--virtual-time-budget=10000'];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-show-')), out = [];

async function shoot(name, query) {
  const url = `${ARC}/document-study/instagram-mirror.html?${new URLSearchParams({id: planId, ...query})}`;
  // First pass reads how tall the part is once drawn; the second takes the picture at exactly that height.
  const {stdout} = await run(bin, [...base, `--window-size=${width},900`, '--dump-dom', url], {timeout: 40000, maxBuffer: 64 << 20});
  const body = /<body([^>]*)>/.exec(stdout)?.[1] || '', attr = k => new RegExp(`data-${k}="([^"]*)"`).exec(body)?.[1];
  const state = attr('mirror');
  if (state === 'empty') return;
  if (state !== 'ready') { out.push({part: name, error: attr('error') || 'The studio did not finish drawing.'}); return; }
  const file = path.join(dir, `${String(out.length + 1).padStart(2, '0')}-${name}.png`);
  await run(bin, [...base, '--force-device-scale-factor=2', `--window-size=${width},${Math.min(16000, Number(attr('height')) || 900)}`, `--screenshot=${file}`, url], {timeout: 40000});
  out.push({part: name, file});
}
for (const part of parts) {
  if (part === 'story') for (const s of plan.stories) await shoot(`story-${s.id}`, {part, story: s.id});
  else await shoot(part, {part});
}
console.log(JSON.stringify({plan: planId, title: plan.title, pictures: out}, null, 1));
