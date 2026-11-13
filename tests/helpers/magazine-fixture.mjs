// A synthetic magazine: two invented stories, a drop folder, rule files, STATUS.md and an ASK file,
// laid out like the real MAG and FILES folders. Built under <repo>/.scratch (gitignored) for each test
// and removed after. Every word is invented; nothing is read from the real vault.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const repo = path.resolve(import.meta.dirname, '..', '..');
export const SCRATCH = path.join(repo, '.scratch', 'magazine-fixtures');

// Nothing a test starts may outlive the test. A test file normally stops its own server and removes its own
// fixture in t.after, but a run that is cancelled or killed never reaches t.after: the server it started then keeps
// running and keeps its fixture folder alive inside the checkout (this is how three servers from 11 November kept
// tripping the package check). So every fixture folder and every server started over one is also recorded with a
// small watcher process. The watcher holds the read end of a pipe from this test process; the pipe closes when this
// process ends in any way, a kill included, and the watcher then stops the recorded servers and removes the
// recorded folders. It only ever removes a folder directly inside SCRATCH.
const WATCHER = `
const fs=require('node:fs'),path=require('node:path'),scratch=process.argv[1],pids=new Set(),dirs=new Set();
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>{});
let text='',done=false;process.stdin.setEncoding('utf8');
function finish(){
 if(done)return;done=true;
 for(const pid of pids){try{process.kill(pid,'SIGKILL');}catch{}}
 const end=Date.now()+5000;
 const sweep=()=>{
  for(const dir of dirs){if(path.dirname(dir)!==scratch)continue;try{fs.rmSync(dir,{recursive:true,force:true});}catch{}if(!fs.existsSync(dir))dirs.delete(dir);}
  if(dirs.size&&Date.now()<end)return setTimeout(sweep,100);
  try{fs.rmdirSync(scratch);}catch{}
  process.exit(0);
 };
 sweep();
}
process.stdin.on('data',chunk=>{text+=chunk;for(let i;(i=text.indexOf('\\n'))>=0;){let m;try{m=JSON.parse(text.slice(0,i));}catch{}text=text.slice(i+1);if(!Array.isArray(m))continue;const set=m[0].endsWith('pid')?pids:dirs;if(m[0][0]==='+')set.add(m[1]);else set.delete(m[1]);}});
process.stdin.on('end',finish);process.stdin.on('close',finish);process.stdin.on('error',finish);
`;
const ownedChildren = new Set(), ownedDirs = new Set();
let watcher = null;
// A helper process that a test starts, restarts and stops on purpose must not own the fixture it builds: the fixture
// has to outlive it. Such a process is started with AR_FIXTURE_OWNER=parent, and the test itself records the folder
// with ownDir.
const ownsNothing = process.env.AR_FIXTURE_OWNER === 'parent';
function tell(message) {
  if (ownsNothing) return;
  try {
    if (!watcher) {
      watcher = spawn(process.execPath, ['-e', WATCHER, SCRATCH], {detached: true, stdio: ['pipe', 'ignore', 'ignore']});
      watcher.on('error', () => {}); watcher.stdin.on('error', () => {});
      watcher.unref(); watcher.stdin.unref?.();
      // An ordinary end of this process (the run finished, or a test threw) is handled here at once, without waiting for the watcher.
      process.on('exit', () => {
        for (const child of ownedChildren) { try { child.kill('SIGKILL'); } catch {} }
        for (const dir of ownedDirs) { try { fs.rmSync(dir, {recursive: true, force: true}); } catch {} }
      });
    }
    watcher.stdin.write(JSON.stringify(message) + '\n');
  } catch {}
}
/** Record a fixture folder that another process built for this test. Returns a function to call once the test has removed it. */
export function ownDir(dir) {
  if (path.dirname(dir) !== SCRATCH) throw Error('Only a folder directly inside the fixture scratch folder can be recorded.');
  ownedDirs.add(dir); tell(['+dir', dir]);
  return () => { ownedDirs.delete(dir); tell(['-dir', dir]); };
}
/** Record a server process a test started, so it is stopped even when the test run is killed before its own cleanup. Returns the child. */
export function ownChild(child) {
  if (!child?.pid) return child;
  ownedChildren.add(child); tell(['+pid', child.pid]);
  child.once('exit', () => { ownedChildren.delete(child); tell(['-pid', child.pid]); });
  return child;
}

const SRC_CLAY = `---
type: SRC
story: Clay Teacher
---

# SRC – Clay Teacher

## Full Transcript

**Mira:** The clay remembers every hand that pressed it, so I never hurry the wedging. You have to listen to it before you shape it.

**Mira:** When the kiln cools we open it together, the whole village, and nobody speaks until the first cup is out.

**Adrian:** What does the first cup tell you?

**Mira:** It tells me whether the fire was kind. Some years it is kind and some years it teaches us patience instead.
`;
const DEV_CLAY = `---
type: DEV
story: Clay Teacher
title: "The Fire Was Kind"
updated: 2026-10-10
---

Metadata line for the reader page.

---

I met Mira at the edge of the village, where the kilns stand in a row.

"The clay remembers every hand that pressed it, so I never hurry the wedging."

==She waits before she shapes anything.==

"You have to listen to it before you shape it."

"When the kiln cools we open it together, the whole village, and nobody speaks until the first cup is out."

"The river taught me to throw thin walls."

---
`;
const MAP_CLAY = `---
type: MAP
story: Clay Teacher
created: 2026-10-08
---

# MAP – Clay Teacher

## Directions

1. The kind fire
2. Patience

## Adrian's decisions (dated, never overwritten)

- 2026-10-09: Direction: The kind fire
`;
const ASK_CLAY = `---
type: ASK
story: Clay Teacher
record-to: Workflow/2-Guidance/MAP - Clay Teacher.md
---

## The title
Two titles fit the kind fire.
- [ ] The Fire Was Kind (recommended)
- [ ] Open It Together
- other

## What you remember
answer:
`;
const STATUS = `---
type: Magazine Status
updated: 2026-10-10
---

# Magazine Status

Where every story is. Adrian's own note line stays exactly as written.

## Draft, waiting for you

**[1] Clay Teacher: The Fire Was Kind**
- DEV - Clay Teacher (story). Your read is next.

## Source ready, waiting for three plans

**[2] River Potter**
- Taken in from one recording.
`;
const RAW_RIVER = `---
type: RAW
title: "River Potter"
recorded: "2026-10-01"
credit: Adrian Rasmussen
---

# RAW – River Potter

The river taught me to throw thin walls, because the water never stops moving.
`;
const SRC_RIVER = `---
type: SRC
story: River Potter
---

## Full Transcript

**Tomas:** The river taught me to throw thin walls, because the water never stops moving. I fire twice a year and both times I am afraid.
`;
const MAP_RIVER = `---
type: MAP
story: River Potter
created: 2026-10-12
---

# MAP – River Potter

## Adrian's decisions (dated, never overwritten)
`;
const CAROUSEL = `---
type: CAROUSEL
story: Clay Teacher
status: for-your-yes
stage: words
---

## Slides

1. [cover] The fire was kind
2. [quote · Mira, Clay Teacher] The clay remembers every hand that pressed it.

## Caption

A village opens its kiln.
`;

export function buildMagazineFixture({foreignLock = null, extra = {}} = {}) {
  const dir = path.join(SCRATCH, randomUUID());
  const vault = path.join(dir, 'vault', 'Brands', 'Teajia', 'Magazine');
  const files = path.join(dir, 'files');
  const drop = path.join(files, 'Drop'), phoneDrop = path.join(dir, 'icloud', 'Teajia Drop');
  const put = (root, rel, text) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), {recursive: true}); fs.writeFileSync(abs, text); };
  for (const sub of ['0-Ideas', '0-Inbox', '1-Source', '2-Guidance', '3-Develop', '4-Review', '5-Social', '6-Feedback', '_style', '_briefs']) fs.mkdirSync(path.join(vault, 'Workflow', sub), {recursive: true});
  fs.mkdirSync(path.join(vault, 'Issues'), {recursive: true});
  put(vault, 'SYSTEM.md', '# SYSTEM\n\nSynthetic rules.\n');
  put(vault, 'TEMPLATE.md', '# TEMPLATE\n\nSynthetic template.\n');
  put(vault, 'STATUS.md', STATUS);
  put(vault, '.ai-draft-ok', 'Synthetic scope note.\n');
  put(vault, 'Workflow/1-Source/CONTEXT - Clay Teacher.md', '---\ntype: CONTEXT\nstory: Clay Teacher\n---\n\nMy opening: I came for the cups and stayed for the silence.\n');
  put(vault, 'Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md', SRC_CLAY);
  put(vault, 'Workflow/2-Guidance/MAP - Clay Teacher.md', MAP_CLAY);
  put(vault, 'Workflow/3-Develop/DEV - Clay Teacher (story).md', DEV_CLAY);
  put(vault, 'Workflow/3-Develop/NOTES - Clay Teacher (story).md', '- one note\n');
  put(vault, 'Workflow/4-Review/CHECK - Clay Teacher (story, round 1).md', '- quotes checked\n');
  put(vault, 'Workflow/ASK - Clay Teacher.md', ASK_CLAY);
  put(vault, 'Workflow/0-Inbox/RAW - River Potter.md', RAW_RIVER);
  put(vault, 'Workflow/1-Source/SRC - River Potter.md', SRC_RIVER);
  put(vault, 'Workflow/2-Guidance/MAP - River Potter.md', MAP_RIVER);
  put(vault, 'Workflow/0-Inbox/RAW - UI-flow-part-01.md', '---\ntype: RAW\ntitle: "UI-flow-part-01"\n---\n\nTest recording.\n');
  put(vault, 'Workflow/5-Social/REQUESTS.md', '---\ntype: Make requests\n---\n\n# Make requests\n\n');
  put(vault, 'Workflow/5-Social/CAROUSEL - Clay Teacher - the fire.md', CAROUSEL);
  put(vault, 'Workflow/_style/gold-clay.md', 'Synthetic style.\n');
  for (const [rel, text] of Object.entries(extra)) put(vault, rel, text);
  // Old Workflow files make the board's newest-first order deterministic.
  const old = new Date('2026-10-05T00:00:00Z');
  fs.utimesSync(path.join(vault, 'Workflow/4-Review/CHECK - Clay Teacher (story, round 1).md'), old, old);
  for (const story of ['Clay Teacher', 'River Potter']) fs.mkdirSync(path.join(files, story, 'Photos'), {recursive: true});
  fs.writeFileSync(path.join(files, 'Clay Teacher', 'Photos', 'kiln.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  fs.mkdirSync(drop, {recursive: true}); fs.mkdirSync(phoneDrop, {recursive: true});
  fs.writeFileSync(path.join(drop, 'Stone Carver.txt'), '**Lena:** Stone keeps the shape of the first mistake, so I make it slowly.\n');
  fs.writeFileSync(path.join(drop, 'MIC001.m4a'), Buffer.from('synthetic audio bytes'));
  if (foreignLock) put(vault, 'Workflow/_mag-running.md', `machine: ${foreignLock.machine || 'innerstellar'}\nsince: ${foreignLock.since || new Date().toISOString()}\ndoing: ${foreignLock.doing || 'step 5, River Potter'}\n`);
  const data = path.join(dir, 'data'); fs.mkdirSync(data, {recursive: true});
  if (!ownsNothing) ownedDirs.add(dir);
  tell(['+dir', dir]);
  return {dir, vault, files, drop, phoneDrop, drops: [drop, phoneDrop], data, cleanup: () => { fs.rmSync(dir, {recursive: true, force: true}); ownedDirs.delete(dir); tell(['-dir', dir]); }};
}

/** sha256 of committed files under a root, keyed by relative path (for "nothing changed" proofs). */
export function treeHashes(root) {
  const out = {};
  // The journal writer stages atomicWrite's <month>.jsonl.<randomUUID>.tmp
  // before renaming it. Those uncommitted bytes can vanish during this walk;
  // they are not canonical journal records. Do not ignore other .tmp files or
  // catch ENOENT: a disappeared committed/protected file must still fail proof.
  const journalStaging = /^journal\/\d{4}-(?:0[1-9]|1[0-2])\.jsonl\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/i;
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(root, rel), {withFileTypes: true})) {
      const r = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(r);
      else if (entry.isFile() && !journalStaging.test(r)) out[r] = createHash('sha256').update(fs.readFileSync(path.join(root, r))).digest('hex');
    }
  };
  walk('');
  return out;
}
