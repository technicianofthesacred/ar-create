// The chat mirror of the Instagram studio: the studio's own screen, one part at a time, drawn as an agent so a picture
// in chat can never press one of Adrian's buttons. The page has to load under the app's script-src 'self' policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const page = fs.readFileSync(new URL('../public/document-study/instagram-mirror.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../public/document-study/instagram-mirror.js', import.meta.url), 'utf8');

test('the mirror page has no inline script and opens the studio as an agent before the studio loads', () => {
  assert.doesNotMatch(page, /<script>(?!<\/script>)/, 'inline script is refused by the app policy');
  const order = [...page.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['instagram-mirror.js', 'instagram-studio.js']);
  assert.match(script, /arCreateUiActor=\{actor:'agent:claude-code'\}/);
  assert.doesNotMatch(script, /human:/);
});

test('every part the tool asks for names a section the studio draws', () => {
  const studio = fs.readFileSync(new URL('../public/document-study/instagram-studio.js', import.meta.url), 'utf8');
  for (const label of ['Material', 'Coverage of the whole recording', 'Possible stories', 'Words to confirm', 'Made', 'Research worth doing']) {
    assert.ok(script.includes(`'${label}'`), `mirror keeps ${label}`);
    assert.ok(studio.includes(`aria-label="${label}"`), `studio draws ${label}`);
  }
});

test('memo-show refuses to run without a plan id', () => {
  const r = spawnSync(process.execPath, [new URL('../agents/memo/memo-show.mjs', import.meta.url).pathname], {encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: memo-show/);
});
