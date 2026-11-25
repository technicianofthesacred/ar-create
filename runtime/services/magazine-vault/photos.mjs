// A story's own photographs: the files in FILES/<story>/Photos/, the folder the Magazine already keeps beside each
// story (intake makes it; the board counts it). Adding copies a photo in as a new file, never over another one, through
// the vault's journalled operation, so it can be undone. Reading lists the folder and serves one photo's exact bytes.
// Nothing here edits a draft or decides where a photo sits in the article.
import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../../store.mjs';
import {magazinePhotoFormat} from '../magazine-library-photos.mjs';
import {sha256} from './write.mjs';

const SHOWN = /\.(jpe?g|png|gif|webp|avif)$/i;
const MAX_PHOTOS = 500;
/** A photo's name as it will sit in the folder: one plain file name, its extension the one its bytes really are. */
export function photoName(value, extension) {
  const name = String(value ?? '').normalize('NFC').trim().split(/[\\/]/).pop();
  if (!name || name.startsWith('.') || /[\x00-\x1f\x7f%]/.test(name) || name.length > 120) throw new StateError('Name the photo with a plain file name.', 400);
  const stem = name.replace(/\.[^.]*$/, '').trim() || 'photo';
  return stem + '.' + (extension === 'jpg' && /\.jpeg$/i.test(name) ? 'jpeg' : extension);
}
/** The next free name: "bowl.jpg", then "bowl (2).jpg", and so on. */
function freeName(taken, name) {
  if (!taken.has(name.toLowerCase())) return name;
  const ext = path.extname(name), stem = name.slice(0, -ext.length);
  for (let n = 2; n < 1000; n++) { const next = `${stem} (${n})${ext}`; if (!taken.has(next.toLowerCase())) return next; }
  throw new StateError('This story already has too many photos with that name.', 409);
}

export function createMagazinePhotos({projects, io, operation, requireWritable}) {
  const storyOf = storyId => { if (typeof storyId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,160}$/.test(storyId)) throw new StateError('Choose a Magazine story.', 400); return projects.project(storyId); };
  const folderOf = p => p.name + '/Photos';
  /** Every photo in the folder, by name, with its size and exact hash. A folder that does not exist yet holds none. */
  function list({storyId} = {}) {
    const p = storyOf(storyId), files = io('files'), {abs, missing} = files.locate(folderOf(p) + '/placeholder');
    const dir = path.dirname(abs);
    if (missing && !fs.existsSync(dir)) return {storyId: p.storyId, story: p.name, photos: []};
    const photos = [];
    for (const name of fs.readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
      if (name.startsWith('.') || !SHOWN.test(name)) continue;
      const st = fs.lstatSync(path.join(dir, name));
      if (!st.isFile() || st.isSymbolicLink()) continue;
      const cur = files.read(folderOf(p) + '/' + name);
      photos.push({name, size: cur.size, hash: cur.hash, addedAt: cur.mtime});
      if (photos.length >= MAX_PHOTOS) break;
    }
    return {storyId: p.storyId, story: p.name, photos};
  }
  /** One photo's bytes, only while they are still the ones that were listed. */
  function file({storyId, name, hash} = {}) {
    const p = storyOf(storyId);
    if (typeof name !== 'string' || !name || name.includes('/') || name.startsWith('.') || !SHOWN.test(name)) throw new StateError('Choose one of this story’s photos.', 400);
    const cur = io('files').read(folderOf(p) + '/' + name);
    if (!cur.exists) throw new StateError('That photo is no longer in the story’s folder.', 404);
    if (hash !== undefined && cur.hash !== hash) throw new StateError('That photo changed since the list was read. Read the list again.', 409);
    const format = magazinePhotoFormat(cur.bytes);
    return {bytes: cur.bytes, contentType: format.contentType, hash: cur.hash};
  }
  /** Copy one photo into the story's folder as a new file. The same bytes already there are not added twice. */
  async function add(input) {
    const keys = ['storyId', 'name', 'data', 'operationId'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(input, k))) throw new StateError('Use storyId, name, data and operationId.', 400);
    requireWritable();
    const p = storyOf(input.storyId);
    if (typeof input.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) throw new StateError('The photo did not arrive whole. Nothing was added.', 400);
    const bytes = Buffer.from(input.data, 'base64');
    if (bytes.toString('base64') !== input.data) throw new StateError('The photo did not arrive whole. Nothing was added.', 400);
    let format; try { format = magazinePhotoFormat(bytes); } catch (error) { throw new StateError(error.status === 413 ? 'This photo is larger than 20 MB. Nothing was added.' : 'This is not a photo the article can use (JPEG, PNG, GIF, WebP or AVIF). Nothing was added.', error.status === 413 ? 413 : 415); }
    const wanted = photoName(input.name, format.extension), hash = sha256(bytes);
    return operation({command: 'magazine.photos.add', operationId: input.operationId, input: {storyId: p.storyId, name: wanted, sha256: hash}, story: p.name, doing: 'adding a photograph to ' + p.name}, async tx => {
      const files = io('files'); files.locate(folderOf(p) + '/placeholder', {create: true});
      const here = list({storyId: p.storyId}).photos, same = here.find(x => x.hash === hash);
      if (same) return {added: false, already: true, story: p.name, name: same.name, hash};
      const name = freeName(new Set(here.map(x => x.name.toLowerCase())), wanted);
      tx.put('files', folderOf(p) + '/' + name, null, bytes);
      return {added: true, story: p.name, name, hash, size: bytes.length};
    });
  }
  return {list, file, add};
}
