// A synthetic magazine: two invented stories, a drop folder, rule files, STATUS.md and an ASK file,
// laid out like the real MAG and FILES folders. Built under <repo>/.scratch (gitignored) for each test
// and removed after. Every word is invented; nothing is read from the real vault.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';

const repo = path.resolve(import.meta.dirname, '..', '..');
export const SCRATCH = path.join(repo, '.scratch', 'magazine-fixtures');

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
  return {dir, vault, files, drop, phoneDrop, drops: [drop, phoneDrop], data, cleanup: () => fs.rmSync(dir, {recursive: true, force: true})};
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
