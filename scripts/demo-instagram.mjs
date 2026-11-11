// Fills a RUNNING invented demo (`npm run demo`, port 8854) with one Instagram plan so the studio has something to open.
//   npm run demo:instagram            (default http://127.0.0.1:8854, or AR_CREATE_URL)
// It prints one line: the link that opens the studio on that plan.
//
// SAFETY. The script first asks the server whether it is the invented demo (the package config the page itself reads,
// /document-study/package-config.js, says syntheticFixtures:true only for `npm run demo`) and refuses port 8841 outright.
// Only after that check passes does it make the one step that is the owner's alone (choosing the story, and saving a template as him)
// as human:adrian, because the demo home is invented and disposable. Accept and Turn down are left for him to press.
// It never marks the plan ready. Running it twice finds the plan by its title and prints the same link.
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inventedPhoto} from '../tests/helpers/simmer-demo.mjs';

export const PLAN_TITLE = 'A morning under the straw (demo)';
const TRANSCRIPT = 'Invented fixture. Grower: The straw goes over the rows twenty days before the picking.\n\n'
 + 'Grower: Straw breathes. The net only takes the light away.\n\n'
 + 'Grower: First you watch, she said, and I watched for a whole spring.\n\n'
 + 'Grower: The cup she gave me first was not her best tea. It was the one she drinks.\n\n'
 + 'Grower: Sometimes it is twenty two days, if the nights stay cold.\n\n'
 + 'Grower: When the leaves come out from under the straw they are a green you only see once a year.\n';
const MARKUP = '<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden; background: {dark.ground}; color: {dark.headline}; font-family: {fonts.body}">'
 + '<div data-slot="0" style="position: absolute; left: 0; top: 0; width: 1080px; height: 880px; overflow: hidden"><img src="__IG_PHOTO_0__"></div>'
 + '<div data-text-zone style="position: absolute; left: 90px; right: 90px; top: 940px; bottom: 90px; display: flex; flex-direction: column; gap: 22px">'
 + '<div data-edit="label" style="font-family: {fonts.label}; font-size: 30px; letter-spacing: 0.16em; color: {dark.supporting}; text-transform: uppercase">__IG_LABEL__</div>'
 + '<div data-edit="text" data-base-font-size="52" style="font-size: 52px; line-height: 1.1; white-space: pre-wrap">__IG_TEXT_0__</div></div></div>';
const PROPOSED = 'Photo on top, one line under', OWN = 'Photo beside words, mine';
const CODES = ['C1', 'S1', 'P1', 'B1', 'F5', 'E2'];

/** Throws unless `base` is the invented demo. */
export async function assertInventedDemo(base, fetchFn = fetch) {
 let url; try { url = new URL(base); } catch { throw Error('That is not a web address: ' + base); }
 if (url.port === '8841') throw Error('Refusing port 8841: that is the installed app, not the invented demo.');
 let text; try { const r = await fetchFn(url.origin + '/document-study/package-config.js'); text = r.ok ? await r.text() : ''; } catch { text = ''; }
 const m = /^window\.AR_CREATE_PACKAGE_CONFIG=(\{.*\});?\s*$/s.exec(text);
 let config = null; try { config = m && JSON.parse(m[1]); } catch {}
 if (!config || config.syntheticFixtures !== true) throw Error('Refusing: ' + url.origin + ' does not say it is the invented demo (syntheticFixtures).');
 return url.origin;
}

export async function seedInstagramDemo(base = process.env.AR_CREATE_URL || 'http://127.0.0.1:8854', {fetch: fetchFn = fetch} = {}) {
 const origin = await assertInventedDemo(base, fetchFn);
 const call = async (path, body, actor = 'agent:claude-code') => {
  const r = await fetchFn(origin + path, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', 'X-AR-Actor': actor, 'X-AR-Client': 'http'}, body: body && JSON.stringify(body)});
  const v = await r.json(); if (!r.ok) throw Error(path + ': ' + r.status + ' ' + v.error); return v;
 };
 const op = () => crypto.randomUUID(), stamp = p => ({id: p.id, operationId: op(), expectedRevision: p.revision, expectedHash: p.hash});
 let p = ((await call('/api/instagram/plans')).plans || []).find(x => x.title === PLAN_TITLE);
 if (p) p = await call('/api/instagram/plan?id=' + p.id);
 if (!p) {
  const names = ['Rows under straw', 'Hands at the bench', 'The first cup', 'Green after shade'];
  const imported = await call('/api/sources/import', {rootId: 'library', folder: '', urls: [], files: [{name: 'Invented voice note from a tea garden.md', content: TRANSCRIPT}, ...names.map((n, i) => ({name: n + '.png', base64: inventedPhoto(i).toString('base64')}))]});
  const [text, ...photos] = imported.receipts.map(r => r.source);
  if (!text || photos.some(x => !x)) throw Error('Demo Library import failed.');
  p = await call('/api/instagram/plan', {operationId: op(), title: PLAN_TITLE, door: 'teajia', material: {transcripts: [{sourceId: text.id, sourceHash: text.hash}], photos: photos.map((s, i) => ({sourceId: s.id, caption: names[i]}))}});
  const L = start => p.lines.find(l => l.text.startsWith(start))?.id;
  const spine = ['The straw goes', 'Straw breathes', 'First you watch', 'The cup she gave', 'Sometimes it is', 'When the leaves'].map(L).filter(Boolean);
  p = await call('/api/instagram/plan', {...stamp(p), stories: [{title: 'Twenty days of shade', dish: 'A carousel about the straw over the rows.', readback: 'Shade is patience you can taste.', why: 'One clear idea, told through one morning.', reader: 'People who drink green tea', format: 'carousel', spine,
   matches: [{photoId: 'P1', lineId: spine[0], why: 'The rows under straw'}, {photoId: 'P2', lineId: spine[2], why: 'Her hands'}, {photoId: 'P3', lineId: spine[3], why: 'The cup'}, {photoId: 'P4', lineId: spine[5], why: 'The green'}]}]});
 }
 if (!p.chosenStoryId && !p.chosen) p = await call('/api/instagram/choose', {...stamp(p), storyId: 'S1', forWhom: 'People who drink green tea'}, 'human:adrian');
 if (!p.layouts?.carousel?.frames?.length) { p = await call('/api/instagram/layout', {...stamp(p), storyId: 'S1', format: 'carousel'}); p = await call('/api/instagram/plan/codes', {...stamp(p), codes: CODES, format: 'carousel', storyId: 'S1'}); }
 if (!(p.layouts.carousel.frames[0].placed || []).length) p = await call('/api/instagram/placed', {...stamp(p), format: 'carousel', slide: 1, placed: [{kind: 'logo', asset: 'wordmark', x: 90, y: 90, width: 200}, {kind: 'mark', asset: 'seal-excellence', x: 860, y: 90, width: 130}]});
 const all = [...(await call('/api/templates')).templates, ...(await call('/api/templates?status=proposed')).templates];
 if (!all.some(t => t.name === OWN)) await call('/api/instagram/template', {operationId: op(), id: p.id, format: 'carousel', slide: 2, name: OWN, looks: 'all'}, 'human:adrian');
 if (!all.some(t => t.name === PROPOSED)) await call('/api/template/propose', {operationId: op(), name: PROPOSED, row: 'F', markup: MARKUP});
 return {id: p.id, link: origin + '/document-study/index.html?instagram=' + p.id, plan: p};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
 try { console.log((await seedInstagramDemo()).link); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
