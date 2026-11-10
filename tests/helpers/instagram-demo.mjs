// Fills a running synthetic demo (`npm run demo`) with an invented Instagram plan: an invented voice note and generated
// photos go into Library, an assistant proposes two stories, the owner picks one, the assistant lays it out as a
// Carousel, and an assistant proposes one template from markup, so the studio has something in every place it shows.
// Never runs against the installed app on 8841.
//   node tests/helpers/instagram-demo.mjs [http://127.0.0.1:8854]
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inventedPhoto} from './simmer-demo.mjs';

const TRANSCRIPT = 'Invented fixture. Grower: The straw goes over the rows twenty days before the picking.\n\n'
 + 'Grower: Straw breathes. The net only takes the light away.\n\n'
 + 'Grower: First you watch, she said, and I watched for a whole spring.\n\n'
 + 'Grower: The cup she gave me first was not her best tea. It was the one she drinks.\n\n'
 + 'Grower: Sometimes it is twenty two days, if the nights stay cold.\n\n'
 + 'Grower: When the leaves come out from under the straw they are a green you only see once a year.\n';

/** A proposal an assistant might write: a full photo on top and one quoted line under it. Colours are the look's roles. */
export const DEMO_MARKUP = '<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden; background: {dark.ground}; color: {dark.headline}; font-family: {fonts.body}">'
 + '<div data-slot="0" style="position: absolute; left: 0; top: 0; width: 1080px; height: 880px; overflow: hidden"><img src="__IG_PHOTO_0__"></div>'
 + '<div data-text-zone style="position: absolute; left: 90px; right: 90px; top: 940px; bottom: 90px; display: flex; flex-direction: column; gap: 22px">'
 + '<div data-edit="label" style="font-family: {fonts.label}; font-size: 30px; letter-spacing: 0.16em; color: {dark.supporting}; text-transform: uppercase">__IG_LABEL__</div>'
 + '<div data-edit="text" data-base-font-size="52" style="font-size: 52px; line-height: 1.1; white-space: pre-wrap">__IG_TEXT_0__</div></div></div>';

export async function fillInstagramDemo(base = 'http://127.0.0.1:8854') {
 if (/:8841\b/.test(base)) throw Error('Instagram demo data goes into a synthetic demo, never the installed app on 8841.');
 const call = async (path, body, actor = 'agent:claude-code') => {
  const r = await fetch(base + path, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', 'X-AR-Actor': actor, 'X-AR-Client': 'http'}, body: body && JSON.stringify(body)});
  const v = await r.json(); if (!r.ok) throw Error(path + ': ' + v.error); return v;
 };
 const op = () => crypto.randomUUID(), stamp = p => ({id: p.id, operationId: op(), expectedRevision: p.revision, expectedHash: p.hash});
 const names = ['Rows under straw', 'Hands at the bench', 'The first cup', 'Green after shade'];
 const imported = await call('/api/sources/import', {rootId: 'library', folder: '', urls: [], files: [{name: 'Invented voice note from a tea garden.md', content: TRANSCRIPT}, ...names.map((n, i) => ({name: n + '.png', base64: inventedPhoto(i).toString('base64')}))]});
 const [text, ...photos] = imported.receipts.map(r => r.source);
 if (!text || photos.some(p => !p)) throw Error('Demo Library import failed.');
 let p = await call('/api/instagram/plan', {operationId: op(), title: 'A morning under the straw', door: 'teajia',
  material: {transcripts: [{sourceId: text.id, sourceHash: text.hash}], photos: photos.map((s, i) => ({sourceId: s.id, caption: names[i]}))}});
 const L = start => p.lines.find(l => l.text.startsWith(start))?.id;
 const spine = ['The straw goes', 'Straw breathes', 'First you watch', 'The cup she gave', 'Sometimes it is', 'When the leaves'].map(L).filter(Boolean);
 p = await call('/api/instagram/plan', {...stamp(p), stories: [
  {title: 'Twenty days of shade', dish: 'A carousel about the straw over the rows.', readback: 'Shade is patience you can taste.', why: 'One clear idea, told through one morning.', reader: 'People who drink green tea', format: 'carousel', spine,
   matches: [{photoId: 'P1', lineId: spine[0], why: 'The rows under straw'}, {photoId: 'P2', lineId: spine[2], why: 'Her hands'}, {photoId: 'P3', lineId: spine[3], why: 'The cup'}, {photoId: 'P4', lineId: spine[5], why: 'The green'}]},
  {title: 'The cup she drinks', dish: 'A single post about the everyday cup.', readback: 'The best tea is the one you drink every day.', format: 'post', spine: [spine[3]], matches: [{photoId: 'P3', lineId: spine[3], why: 'The cup'}]}]});
 p = await call('/api/instagram/choose', {...stamp(p), storyId: 'S1', forWhom: 'People who drink green tea'}, 'human:adrian');
 p = await call('/api/instagram/layout', {...stamp(p), storyId: 'S1', format: 'carousel'});
 const proposals = (await call('/api/templates?status=proposed')).templates;
 if (!proposals.length) await call('/api/template/propose', {operationId: op(), name: 'Photo on top, one line under', row: 'F', markup: DEMO_MARKUP});
 return p;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
 const p = await fillInstagramDemo(process.argv[2] || 'http://127.0.0.1:8854');
 console.log('Instagram plan ' + p.id + ': ' + Object.keys(p.layouts).join(', ') + '. Open ?instagram=' + p.id);
}
