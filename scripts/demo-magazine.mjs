// A disposable invented demo that also holds a small invented Magazine, so version two can show Magazine stories.
//   node scripts/demo-magazine.mjs          (port 8854 by default; AR_CREATE_PORT picks another)
// It makes the same synthetic home as `npm run demo`, then builds three invented stories in a Magazine folder inside that
// home and registers them with the Magazine's own registration tool (tools/magazine/register.mjs, the same code the
// release runs for the real stories), and tells the home where the Magazine is (<data>/magazine-vault.json). The demo
// then starts as usual. Fill it as usual (`AR_CREATE_URL=http://127.0.0.1:<port> npm run demo:fill`): the filler only adds
// subjects, so the stories stay as they are.
//   Kiln Keeper        words, a picked direction, a CHECK file, one photograph
//   Salt Lake Weaver   words, no check, no direction, no photographs
//   Bamboo Carver      a recording's source only, no draft yet
// Every word is invented. Nothing is read from a real Magazine, and the files exist only inside the temporary home.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {syntheticHome} from './demo.mjs';
import {apply} from '../tools/magazine/register.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const KILN_DEV = `---
type: DEV
story: Kiln Keeper
title: "Where the Ash Settles"
updated: 2026-10-20
---

Metadata line for the reader page.

---

I reached the kiln before the heat did, and the keeper was already sitting beside it.

"Ash is just the fire's handwriting," she said. "You learn to read it slowly."

==She never looked at the clock.==

"When the glaze runs, we wait. Waiting is part of the firing."

She lifted the first bowl out with both hands and turned it to the light, and for a long moment nobody spoke.

---
`;
const WEAVER_DEV = `---
type: DEV
story: Salt Lake Weaver
title: "The Loom Beside the Water"
updated: 2026-10-24
---

Metadata line for the reader page.

---

The loom stands where the lake used to be, and the weaver says that is the reason for the pattern.

"Every thread is a shoreline," he told me. "I only decide where the water stopped."

He works from dusk until the light goes thin, and the cloth grows by a hand's width each night.

"Nobody buys the first piece," he said. "The first piece is for learning what the lake wants."

---
`;
const src = (story, who, line) => `---\ntype: SRC\nstory: ${story}\n---\n\n## Full Transcript\n\n**${who}:** ${line}\n`;
const map = (story, decision) => `---\ntype: MAP\nstory: ${story}\ncreated: 2026-10-18\n---\n\n# MAP - ${story}\n\n## Directions\n\n1. The fire's handwriting\n2. Waiting as craft\n\n## Adrian's decisions (dated, never overwritten)\n\n${decision}`;

/** Builds the invented Magazine under `dir` and returns its two folders. */
export function buildDemoMagazine(dir) {
  const vault = path.join(dir, 'magazine-demo', 'Brands', 'Teajia', 'Magazine'), files = path.join(dir, 'magazine-demo', 'files');
  const put = (rel, text) => {const abs = path.join(vault, rel); fs.mkdirSync(path.dirname(abs), {recursive: true}); fs.writeFileSync(abs, text);};
  for (const sub of ['0-Inbox', '1-Source', '2-Guidance', '3-Develop', '4-Review', '5-Social', '6-Feedback']) fs.mkdirSync(path.join(vault, 'Workflow', sub), {recursive: true});
  put('STATUS.md', '---\ntype: Magazine Status\nupdated: 2026-10-24\n---\n\n# Magazine Status\n\n## Draft, waiting for you\n\n**[1] Kiln Keeper: Where the Ash Settles**\n- DEV - Kiln Keeper (story). Your read is next.\n\n**[2] Salt Lake Weaver: The Loom Beside the Water**\n- DEV - Salt Lake Weaver (story). Your read is next.\n\n## Source ready, waiting for three plans\n\n**[3] Bamboo Carver**\n- Taken in from one recording.\n');
  const context = (story, line) => put('Workflow/1-Source/CONTEXT - ' + story + '.md', '---\ntype: CONTEXT\nstory: ' + story + '\n---\n\n' + line + '\n');
  context('Kiln Keeper', 'My opening: I came for the bowls and stayed to watch the fire.');
  context('Salt Lake Weaver', 'My opening: I asked about the cloth and was shown the water.');
  context('Bamboo Carver', 'My opening: a knife, a stalk and a long afternoon.');
  put('Workflow/1-Source/SRC - Kiln Keeper (Firing Day).md', src('Kiln Keeper', 'Noor', 'Ash is just the fire\'s handwriting, and you learn to read it slowly.'));
  put('Workflow/2-Guidance/MAP - Kiln Keeper.md', map('Kiln Keeper', '- 2026-10-19: Direction: The fire\'s handwriting\n'));
  put('Workflow/3-Develop/DEV - Kiln Keeper (story).md', KILN_DEV);
  put('Workflow/4-Review/CHECK - Kiln Keeper (story, round 1).md', '- quotes checked\n');
  put('Workflow/1-Source/SRC - Salt Lake Weaver (Dusk).md', src('Salt Lake Weaver', 'Amir', 'Every thread is a shoreline, and I only decide where the water stopped.'));
  put('Workflow/2-Guidance/MAP - Salt Lake Weaver.md', map('Salt Lake Weaver', ''));
  put('Workflow/3-Develop/DEV - Salt Lake Weaver (story).md', WEAVER_DEV);
  put('Workflow/0-Inbox/RAW - Bamboo Carver.md', '---\ntype: RAW\ntitle: "Bamboo Carver"\nrecorded: "2026-10-22"\n---\n\n# RAW - Bamboo Carver\n\nThe knife follows the grain, and the grain never lies.\n');
  put('Workflow/1-Source/SRC - Bamboo Carver.md', src('Bamboo Carver', 'Lian', 'The knife follows the grain, and the grain never lies. I only keep it company.'));
  fs.mkdirSync(path.join(files, 'Kiln Keeper', 'Photos'), {recursive: true});
  fs.writeFileSync(path.join(files, 'Kiln Keeper', 'Photos', 'bowl.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  return {vault, files};
}

/** Makes the home's Magazine: builds it, registers it, and points the home at it. Run before the server starts. */
export async function addMagazineToSyntheticHome(home) {
  const dir = home.dir, data = JSON.parse(fs.readFileSync(home.config, 'utf8')).dataDir, {vault, files} = buildDemoMagazine(dir);
  fs.mkdirSync(data, {recursive: true});
  const done = await apply({mag: vault, files, data, verification: path.join(dir, 'magazine-demo', 'proof')});
  if (!done.applied) throw new Error('The invented Magazine could not be registered: ' + JSON.stringify(done));
  fs.writeFileSync(path.join(data, 'magazine-vault.json'), JSON.stringify({vaultRoot: vault, filesRoot: files, writable: true, machine: 'synthetic-demo'}));
  return {vault, files, data, stories: done.stories};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const home = syntheticHome(), magazine = await addMagazineToSyntheticHome(home);
  console.log('Invented Magazine with ' + magazine.stories + ' stories (the third has no draft yet); disposable files: ' + home.dir);
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'demo.mjs')], {env: {...process.env, AR_CREATE_SYNTHETIC_CONFIG: home.config}, stdio: 'inherit'});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => {process.exitCode = code || 0;});
}
