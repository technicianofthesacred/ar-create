// A Magazine story's own photographs: added from its page into FILES/<story>/Photos (never over another file, undoable),
// listed and served by exact name and hash, and read from an unpublished draft's photo notes so its Download embeds them.
// Every word and image here is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {randomUUID, createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createServer} from '../runtime/server.mjs';
import {storyPhotoNames} from '../scripts/magazine-media-inspection.mjs';
const {JSDOM} = createRequire(new URL('../runtime/package.json', import.meta.url))('jsdom');
const sha = s => createHash('sha256').update(s).digest('hex');
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r('http://127.0.0.1:' + s.address().port)));
const close = s => new Promise(r => { s.closeAllConnections(); s.close(r); });
/** A small, real PNG of one colour. */
function png(rgb) {
  const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(3, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = Buffer.concat(Array.from({length: 3}, () => Buffer.from([0, ...Array.from({length: 4}, () => rgb).flat()])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

async function start(t) {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const publication = path.join(f.dir, 'publication'); fs.mkdirSync(publication);
  const plan = planRegistration({vault: f.vault, files: f.files});
  fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive: true});
  fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: f.vault, filesRoot: f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
  const server = await createServer({dataDir: f.data, publicDir: path.resolve('public'), connections: [], researchEnabled: false, magazineVault: {vaultRoot: f.vault, filesRoot: f.files, writable: true, machine: 'invented-story-photos', magSendRepo: publication}});
  const origin = await listen(server); t.after(() => close(server));
  const call = (route, body, actor = 'human:adrian') => fetch(origin + route, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin, 'X-AR-Actor': actor, 'X-AR-Client': 'cli'}, body: JSON.stringify(body)});
  const get = (route, query) => fetch(origin + route + '?' + new URLSearchParams(query));
  return {f, origin, call, get, photos: path.join(f.files, 'Clay Teacher', 'Photos')};
}

test('photo notes name their files once each, in order, across a pair', () => {
  assert.deepEqual(storyPhotoNames('%%photo: a.jpg · Cap · cover%%\n\nWords.\n\n%%photos: b.png · one | a.jpg · two · stagger%%\n\n%%side: c.webp · x%%'), ['a.jpg', 'b.png', 'c.webp']);
  assert.deepEqual(storyPhotoNames('No notes, %%was: old words%%.'), []);
});

test('photographs are added beside the story, never over another file, listed by hash, served exactly and undone', async t => {
  const {call, get, photos} = await start(t);
  const red = png([200, 40, 40]), blue = png([40, 40, 200]), storyId = 'mag-clay-teacher';
  const first = await call('/api/magazine/photos/add', {storyId, name: 'bowl.png', data: red.toString('base64'), operationId: randomUUID()});
  assert.equal(first.status, 200, await first.clone().text());
  assert.equal((await first.json()).name, 'bowl.png');
  assert.deepEqual(fs.readFileSync(path.join(photos, 'bowl.png')), red);
  const again = await (await call('/api/magazine/photos/add', {storyId, name: 'other.png', data: red.toString('base64'), operationId: randomUUID()})).json();
  assert.equal(again.already, true); assert.equal(again.name, 'bowl.png');
  const secondOp = randomUUID(), second = await (await call('/api/magazine/photos/add', {storyId, name: 'Bowl.PNG', data: blue.toString('base64'), operationId: secondOp})).json();
  assert.equal(second.name, 'Bowl (2).png', 'a different photo with a taken name gets the next free name');
  assert.deepEqual(fs.readFileSync(path.join(photos, 'bowl.png')), red, 'the first photo is untouched');
  const listed = await (await get('/api/magazine/photos', {storyId})).json();
  const byName = new Map(listed.photos.map(p => [p.name, p.hash]));
  assert.equal(byName.get('bowl.png'), sha(red)); assert.equal(byName.get('Bowl (2).png'), sha(blue));
  const served = await get('/api/magazine/photos/file', {storyId, name: 'bowl.png', hash: sha(red)});
  assert.equal(served.status, 200); assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), red);
  assert.equal((await get('/api/magazine/photos/file', {storyId, name: 'bowl.png', hash: sha(blue)})).status, 409, 'a changed photo is not served under an old hash');
  assert.equal((await call('/api/magazine/photos/add', {storyId, name: 'note.txt', data: Buffer.from('not a photo').toString('base64'), operationId: randomUUID()})).status, 415);
  const undone = await call('/api/magazine/undo', {undoOperationId: secondOp, operationId: randomUUID()});
  assert.equal(undone.status, 200, await undone.clone().text());
  assert.equal(fs.existsSync(path.join(photos, 'Bowl (2).png')), false);
  assert.deepEqual(fs.readFileSync(path.join(photos, 'bowl.png')), red);
});

test('an unpublished draft with photo notes downloads with the story photographs embedded, and a missing one is named', async t => {
  const {f, call, origin, photos} = await start(t);
  const red = png([200, 40, 40]); fs.mkdirSync(photos, {recursive: true}); fs.writeFileSync(path.join(photos, 'kiln.png'), red);
  const draft = path.join(f.vault, 'Workflow/3-Develop/DEV - Clay Teacher (story).md');
  const raw = '---\ntype: DEV\ntitle: Invented clay teacher\n---\n\nMetadata line.\n\n---\n\n%%photo: kiln.png · The invented kiln at dawn · cover%%\n\nFirst invented paragraph.\n\n%%photo: kiln.png · The same kiln, later%%\n\nSecond invented paragraph.\n';
  fs.writeFileSync(draft, raw);
  const input = {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', expectedHash: sha(raw), name: 'invented.html'};
  const response = await call('/api/magazine/working-draft/export', input, 'agent:codex');
  assert.equal(response.status, 200, await response.clone().text());
  const {artifact} = await response.json();
  const body = await (await fetch(origin + artifact.url)).text();
  const dom = new JSDOM(body);
  try {
    const d = dom.window.document, figures = [...d.querySelectorAll('figure[data-working-photo]')];
    assert.deepEqual(figures.map(x => x.dataset.workingPhoto), ['cover', 'photo']);
    assert.deepEqual(figures.map(x => x.querySelector('figcaption').textContent), ['The invented kiln at dawn', 'The same kiln, later']);
    for (const img of figures.map(x => x.querySelector('img'))) assert.equal(img.getAttribute('src'), 'data:image/png;base64,' + red.toString('base64'));
    assert.ok(d.body.textContent.includes('First invented paragraph.'));
    assert.equal(d.body.textContent.includes('kiln.png'), false, 'photo notes are shown as photographs, not as notes');
  } finally { dom.window.close(); }
  assert.equal(fs.readFileSync(draft, 'utf8'), raw);
  const missing = raw.replace('· The same kiln, later', '· gone').replace('%%photo: kiln.png · gone', '%%photo: gone.png · gone');
  fs.writeFileSync(draft, missing);
  const refused = await call('/api/magazine/working-draft/export', {...input, expectedHash: sha(missing)}, 'agent:codex');
  assert.equal(refused.status, 409); assert.match((await refused.json()).error, /gone\.png.*Photos folder/);
});
