// magazine-vault: AR Create as the one writer of the Teajia magazine (D1, 2026-10-21).
//
// The bytes stay in the vault (MAG) and the Files folder (FILES). Every change goes through here:
// one lock (lock.mjs, the same _mag-running.md /mag uses), a compare-and-swap on the file's sha256,
// an atomic write, an operation record with the before-bytes (so undo is exact), and the actor who
// asked. Agents propose prose (D4): a draft, a context note, a feedback message or post words that
// are not waiting for his yes become a proposal Adrian accepts or rejects; working notes save
// directly. RAW is written once. STATUS.md is touched only between its story-table markers (D6).
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {StateError} from '../../store.mjs';
import {atomicWrite, ensurePrivateDirectory, readJson} from '../files.mjs';
import {currentActor, isHuman, requireHuman, IN_PROCESS_ACTOR} from '../actor.mjs';
import * as askDonor from '../../reference/mag-ask.mjs';
import * as editDonor from '../../reference/mag-edit.mjs';
import {classify, storyFromName, storyId, cleanRelative} from './kinds.mjs';
import {createVaultLock} from './lock.mjs';
import {createRootIO, realRoot, sha256, expected, textBytes} from './write.mjs';
import {readBoard, boardText, dropped} from './board.mjs';
import {approveMade, saveLineup, requestLine, pageFeedbackLine, madeStatus} from './social.mjs';
import {renderTable, replaceTable, installMarkers, findTable} from './status.mjs';
import {createMagazineProjects, statusEntries} from './projects.mjs';
import {planTidy} from './tidy.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const stable = v => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
const fields = (input, allowed, required = []) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StateError('Send a JSON object.', 400);
  const extra = Object.keys(input).filter(k => !allowed.includes(k) && k !== 'scope');
  if (extra.length) throw new StateError(`Unsupported field(s): ${extra.join(', ')}. Use ${allowed.join(', ')}.`, 400);
  for (const k of required) if (input[k] === undefined) throw new StateError(`${k} is required.`, 400);
};
const ctx = () => currentActor() || {actor: IN_PROCESS_ACTOR, client: null};
const donorError = error => { if (error instanceof StateError) return error; const m = String(error.message || error); return new StateError(m, /changed since|gone; reload|Pending|ambiguous|could not be restored/.test(m) ? 409 : 400); };
const scopeFor = rel => { const s = rel && storyFromName(rel); return s ? {kind: 'story', id: storyId(s.replace(/\s*\(.*$/, ''))} : null; };
const MAKE_DIRS = rel => /^Workflow\/4-Review\/_blind$/.test(rel) || /^Workflow\/5-Social\/(CAROUSEL|POST|REEL|VIDEO|SCRIPT) - [^/]+$/.test(rel) || /^_archive\/Superseded drafts(\/[^/]+)?$/.test(rel) || /^Issues\/[^/]+$/.test(rel);
const FILES_DIRS = rel => /^[^/]+$/.test(rel) && rel !== 'Drop' || /^[^/]+\/Photos$/.test(rel);

export function createMagazineVault({vaultRoot = null, filesRoot = null, drops = [], writable = false, exportStaging = null, dataDir, machine, bootId, now = () => Date.now(), events = null, journal = null, leases = null, editorialRoot = null, magSendRepo = null, previewPort = 8766, intakeEngine = null} = {}) {
  const configured = typeof vaultRoot === 'string' && vaultRoot.length > 0;
  const home = ensurePrivateDirectory(dataDir, 'magazine');
  const dirs = Object.fromEntries(['operations', 'proposals', 'undone', 'tmp', 'sends', 'recovered-locks'].map(d => [d, ensurePrivateDirectory(home, d)]));
  const projects = createMagazineProjects({dataDir});
  let state = null;
  function roots() {
    if (!configured) throw new StateError('No magazine folder is configured in this AR Create (magazine.vaultRoot).', 503);
    if (state) return state;
    const mag = realRoot(vaultRoot, 'The magazine folder');
    const files = filesRoot ? realRoot(filesRoot, 'The magazine Files folder') : null;
    const lock = createVaultLock({vaultRoot, machine, bootId, now, onRecover: info => {
      const file = path.join(dirs['recovered-locks'], info.at.replace(/[:.]/g, '-') + '.md');
      try { fs.writeFileSync(file, info.bytes, {flag: 'wx', mode: 0o600}); } catch {}
      const who = ctx();
      journal?.append({actor: who.actor, client: who.client, scope: {kind: 'system', id: null}, kind: 'magazine.lock.recovered', status: 'committed', summary: info.why.slice(0, 280)}).catch(() => {});
      events?.emit({kind: 'magazine.lock', scope: {kind: 'system', id: null}, actor: who.actor, client: who.client, revision: null, operationId: null, lock: {recovered: true, previous: info.previous}});
    }});
    state = {mag: createRootIO(mag, {label: 'The magazine folder', makeDirs: MAKE_DIRS}), files: files ? createRootIO(files, {label: 'The magazine Files folder', makeDirs: FILES_DIRS}) : null, lock};
    return state;
  }
  const io = which => { const r = roots()[which]; if (!r) throw new StateError('No magazine Files folder is configured (magazine.filesRoot).', 503); return r; };
  const requireWritable = () => { if (!writable) throw new StateError('The magazine is read-only in this AR Create (magazine.writable is false). Nothing was written.', 503); };

  // ---- operations: the record that makes every write replayable and undoable ----
  const opFile = id => path.join(dirs.operations, id + '.json');
  async function operation({command, operationId, input, rel = null, story = null, doing}, fn) {
    requireWritable();
    if (typeof operationId !== 'string' || !UUID.test(operationId)) throw new StateError('operationId must be a fresh UUID for every write.', 400);
    const who = ctx(), inputHash = sha256(stable({command, input}));
    const prior = readJson(opFile(operationId), null);
    if (prior) { if (prior.inputHash !== inputHash) throw new StateError('That operationId was used for a different write.', 409); if (prior.state === 'committed') return {...prior.result, operationId, replay: true}; }
    const scope = story ? {kind: 'story', id: storyId(story)} : scopeFor(rel);
    if (scope && leases) leases.check(scope, who);
    const {lock} = roots();
    return lock.transaction({actor: who.actor, operation: operationId, doing: doing || command}, async () => {
      const record = {schema: 'ar-create.magazine-operation.v1', operationId, command, inputHash, actor: who.actor, client: who.client, at: new Date(now()).toISOString(), scope, state: 'pending', changes: []};
      const save = () => atomicWrite(opFile(operationId), JSON.stringify(record, null, 1) + '\n');
      const tx = {
        read: (root, r) => io(root).read(r),
        put(root, r, expectedHash, bytes) {
          const target = io(root);
          if (root === 'mag') { const conflicts = target.conflictCopies(r); if (conflicts.length) throw new StateError(`Syncthing left a conflict copy beside ${r} (${conflicts[0]}). Adrian chooses between them first; nothing was written.`, 409); }
          const before = target.read(r);
          if (expectedHash === null ? before.exists : before.hash !== expectedHash) throw Object.assign(new StateError(`${r} changed since it was read. Read it again; nothing was written.`, 409), {current: {path: r, hash: before.hash}});
          const change = {root, rel: r, beforeHash: before.hash, before: before.exists ? before.bytes.toString('base64') : null, afterHash: bytes === null ? null : sha256(bytes), applied: false};
          record.changes.push(change); save();
          const out = target.put(r, expectedHash, bytes);
          change.applied = true; save();
          return out;
        },
        move(root, from, to, hash) { const change = {root, move: {from, to}, hash, applied: false}; record.changes.push(change); save(); const out = io(root).move(from, to, hash); change.applied = true; save(); return out; },
      };
      let result;
      try { result = await fn(tx); }
      catch (error) { if (record.changes.some(c => c.applied)) { record.state = 'failed'; record.error = String(error.message).slice(0, 500); save(); } else fs.rmSync(opFile(operationId), {force: true}); throw error; }
      record.state = 'committed'; record.result = result; save();
      return {...result, operationId, changes: record.changes.filter(c => c.applied).map(c => c.move ? {root: c.root, move: c.move} : {root: c.root, path: c.rel, beforeHash: c.beforeHash, afterHash: c.afterHash}), ...(scope ? {scope} : {})};
    });
  }

  // ---- proposals: an agent's prose waits for Adrian's yes (D4) ----
  const propFile = id => { if (!UUID.test(id || '')) throw new StateError('proposalId must be a UUID.', 400); return path.join(dirs.proposals, id + '.json'); };
  function propose({rel, kind, content, baseHash, reason, operationId}) {
    const who = ctx(), proposalId = randomUUID(), story = storyFromName(rel);
    const value = {schema: 'ar-create.magazine-proposal.v1', proposalId, operationId, path: rel, kind, story, scope: scopeFor(rel), baseHash, content, contentHash: sha256(Buffer.from(content, 'utf8')), actor: who.actor, client: who.client, reason: reason || null, createdAt: new Date(now()).toISOString(), status: 'open'};
    atomicWrite(propFile(proposalId), JSON.stringify(value, null, 1) + '\n', {exclusive: true});
    events?.emit({kind: 'needs-decision', scope: value.scope || {kind: 'system', id: null}, actor: who.actor, client: who.client, revision: null, operationId, to: 'human:adrian', summary: `${kind} words proposed for ${rel}`});
    return {proposed: true, proposalId, path: rel, kind, waitsFor: 'human:adrian', note: 'Agents propose prose; Adrian accepts it (magazine.proposal.accept) before it is written.'};
  }
  function proposalList({status = 'open', story} = {}) {
    const rows = fs.readdirSync(dirs.proposals).filter(n => n.endsWith('.json')).map(n => readJson(path.join(dirs.proposals, n), null)).filter(Boolean)
      .filter(p => (!status || status === 'all' || p.status === status) && (!story || p.story === story || p.scope?.id === story));
    return {schema: 'ar-create.magazine-proposals.v1', proposals: rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(({content, ...rest}) => ({...rest, bytes: Buffer.byteLength(content)}))};
  }
  function proposalRead({proposalId}) {
    const p = readJson(propFile(proposalId), null); if (!p) throw new StateError('No such proposal.', 404);
    const current = io('mag').read(p.path);
    return {...p, current: {exists: current.exists, hash: current.hash, text: current.exists ? current.bytes.toString('utf8') : null}, stale: (current.hash || null) !== (p.baseHash || null)};
  }

  // ---- the generic write ----
  async function write(input) {
    fields(input, ['path', 'content', 'expectedHash', 'operationId', 'reason'], ['path', 'content', 'expectedHash', 'operationId']);
    const c = classify(input.path), bytes = textBytes(input.content), base = expected(input.expectedHash);
    if (c.class === 'log') throw new StateError(c.kind === 'EDITS' ? 'EDITS logs are written only by magazine.edit (Adrian\'s page edits).' : 'Exports are written only by magazine.export.save.', 403);
    if (c.class === 'board') throw new StateError('STATUS.md changes only through magazine.status.refresh (its story table).', 403);
    if (c.class === 'issue') throw new StateError('Issue indexes change through magazine.issue.write.', 403);
    if (c.class === 'raw' && base !== null) throw new StateError('RAW is written once and never overwritten.', 403);
    return operation({command: 'magazine.write', operationId: input.operationId, input: {path: c.rel, hash: sha256(bytes), base}, rel: c.rel}, async tx => {
      const human = isHuman(ctx().actor);
      let needsYes = c.class === 'prose' && !human;
      if (c.class === 'social' && !human) { const cur = tx.read('mag', c.rel); needsYes = madeStatus(input.content) !== 'for-your-yes' || (cur.exists && madeStatus(cur.bytes.toString('utf8')) === 'approved'); }
      if (needsYes) { const cur = tx.read('mag', c.rel); if ((cur.hash || null) !== base) throw new StateError(`${c.rel} changed since it was read. Read it again; nothing was proposed.`, 409); return propose({rel: c.rel, kind: c.kind, content: input.content, baseHash: base, reason: input.reason, operationId: input.operationId}); }
      const put = tx.put('mag', c.rel, base, bytes);
      if (c.kind === 'RAW') events?.emit({kind: 'recording.filed', scope: scopeFor(c.rel) || {kind: 'system', id: null}, actor: ctx().actor, client: ctx().client, revision: null, operationId: input.operationId, path: c.rel});
      return {written: true, path: c.rel, kind: c.kind, class: c.class, hash: put.afterHash, beforeHash: put.beforeHash};
    });
  }

  // ---- a change computed by an unmodified donor (mag-edit, mag-ask) on a private mirror ----
  function viaMirror(tx, rels, fn) {
    const tmp = fs.mkdtempSync(path.join(dirs.tmp, 'mirror-'));
    try {
      const before = new Map();
      for (const dir of ['Workflow/0-Inbox', 'Workflow/1-Source', 'Workflow/2-Guidance', 'Workflow/3-Develop', 'Workflow/4-Review', 'Workflow/5-Social', 'Workflow/6-Feedback']) fs.mkdirSync(path.join(tmp, dir), {recursive: true});
      for (const rel of rels) { const cur = tx.read('mag', rel); before.set(rel, cur); if (cur.exists) { fs.mkdirSync(path.dirname(path.join(tmp, rel)), {recursive: true}); fs.writeFileSync(path.join(tmp, rel), cur.bytes); } }
      let out; try { out = fn(tmp); } catch (error) { throw donorError(error); }
      const changes = [];
      for (const rel of rels) { const abs = path.join(tmp, rel), now = fs.existsSync(abs) ? fs.readFileSync(abs) : null, was = before.get(rel); if ((now ? sha256(now) : null) !== was.hash) changes.push({rel, expectedHash: was.hash, bytes: now}); }
      return {out, changes};
    } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  }

  async function edit(input) {
    requireHuman('Editing a draft on the reading page');
    fields(input, ['path', 'block', 'seen', 'text', 'operationId'], ['path', 'block', 'seen', 'text', 'operationId']);
    const c = classify(input.path);
    if (!['DEV', 'CONTEXT', 'FEEDBACK'].includes(c.kind)) throw new StateError('Only a draft, a context note or a feedback message is edited on the page.', 403);
    if (!Number.isSafeInteger(input.block) || typeof input.seen !== 'string' || typeof input.text !== 'string' || input.text.length > 200_000) throw new StateError('block (number), seen (the paragraph hash you saw) and text are required.', 400);
    const log = 'Workflow/4-Review/EDITS - ' + c.rel.split('/').pop();
    return operation({command: 'magazine.edit', operationId: input.operationId, input: {path: c.rel, block: input.block, seen: input.seen, text: input.text}, rel: c.rel, doing: 'Adrian edits ' + c.rel.split('/').pop()}, async tx => {
      const {out, changes} = viaMirror(tx, [c.rel, log], mag => editDonor.edit(mag, c.rel, input.block, input.seen, input.text));
      for (const ch of changes) tx.put('mag', ch.rel, ch.expectedHash, ch.bytes);
      const after = tx.read('mag', c.rel);
      return {changed: !!out.changed, removed: !!out.removed, raw: out.raw || '', h: out.raw ? editDonor.hash(out.raw) : null, plain: out.raw ? editDonor.plain(out.raw) : '', path: c.rel, hash: after.hash, log};
    });
  }

  async function askAnswer(input) {
    requireHuman('Answering a question on the page');
    fields(input, ['path', 'index', 'value', 'title', 'operationId'], ['path', 'index', 'value', 'operationId']);
    const c = classify(input.path); if (c.kind !== 'ASK') throw new StateError('Answers go into an ASK file.', 400);
    if (!Number.isSafeInteger(input.index) || input.index < 0 || typeof input.value !== 'string' || input.value.length > 2000) throw new StateError('index and value are required.', 400);
    return operation({command: 'magazine.ask.answer', operationId: input.operationId, input: {path: c.rel, index: input.index, value: input.value, title: input.title ?? null}, rel: c.rel, doing: 'Adrian answers on the page'}, async tx => {
      const cur = tx.read('mag', c.rel); if (!cur.exists) throw new StateError('That ASK file is gone.', 404);
      const parsed = askDonor.parseAsk(cur.bytes.toString('utf8')), q = parsed.questions[input.index];
      if (!q) throw new StateError('That question is gone; reload the page.', 409);
      if (input.title !== undefined && q.title !== input.title) throw new StateError('The questions changed since the page loaded; reload it and answer again.', 409);
      const rels = [c.rel], recordTo = parsed.meta['record-to'];
      if (recordTo) { let r; try { r = classify(recordTo); } catch { r = null; } if (r && r.rel.startsWith('Workflow/') && r.class !== 'raw' && r.class !== 'log') rels.push(r.rel); }
      const {out, changes} = viaMirror(tx, rels, mag => askDonor.answer(mag, c.rel, input.index, input.value));
      for (const ch of changes) tx.put('mag', ch.rel, ch.expectedHash, ch.bytes);
      return {answered: true, question: {title: out.title, value: out.value, answered: out.answered}, path: c.rel, hash: tx.read('mag', c.rel).hash, recorded: changes.some(ch => ch.rel !== c.rel) ? rels[1] : null};
    });
  }
  async function askSet(input) {
    fields(input, ['path', 'content', 'expectedHash', 'operationId', 'reason'], ['path', 'content', 'expectedHash', 'operationId']);
    if (classify(input.path).kind !== 'ASK') throw new StateError('magazine.ask.set writes an ASK file (Workflow/ASK - <story>.md).', 400);
    return write(input);
  }

  // ---- one-file text transforms the page asks for ----
  async function transform({command, rel, operationId, input, expectedHash, human = false, doing}, change) {
    if (human) requireHuman(doing);
    return operation({command, operationId, input, rel, doing}, async tx => {
      const cur = tx.read('mag', rel);
      if (expectedHash !== undefined && (cur.hash || null) !== expectedHash) throw Object.assign(new StateError(`${rel} changed since the page loaded it. Reload the page; nothing was saved.`, 409), {current: {path: rel, hash: cur.hash}});
      let next; try { next = change(cur.exists ? cur.bytes.toString('utf8') : null); } catch (error) { throw donorError(error); }
      if (next === null || (cur.exists && next === cur.bytes.toString('utf8'))) return {changed: false, path: rel, hash: cur.hash};
      const put = tx.put('mag', rel, cur.hash, textBytes(next));
      return {changed: true, path: rel, hash: put.afterHash};
    });
  }
  const socialFile = value => { const c = classify(value); if (c.kind !== 'SOCIAL') throw new StateError('Not a made file in Workflow/5-Social.', 400); return c.rel; };
  async function requestsAdd(input) {
    fields(input, ['kind', 'step', 'story', 'operationId'], ['story', 'operationId']);
    return transform({command: 'magazine.requests.add', rel: 'Workflow/5-Social/REQUESTS.md', operationId: input.operationId, input, doing: 'a request from the page'}, text => requestLine(text, input, new Date(now())));
  }
  async function pageFeedback(input) {
    fields(input, ['story', 'step', 'q', 'value', 'note', 'operationId'], ['story', 'operationId']);
    return transform({command: 'magazine.page-feedback.add', rel: 'Workflow/_page-feedback.md', operationId: input.operationId, input, doing: 'page feedback'}, text => pageFeedbackLine(text, input, new Date(now())));
  }
  async function lineupSave(input) {
    fields(input, ['path', 'slides', 'caption', 'expectedHash', 'operationId'], ['path', 'slides', 'expectedHash', 'operationId']);
    const rel = socialFile(input.path);
    return transform({command: 'magazine.lineup.save', rel, operationId: input.operationId, input: {path: rel, slides: input.slides, caption: input.caption ?? ''}, expectedHash: expected(input.expectedHash), human: true, doing: 'Adrian reorders the lineup'}, text => { if (text === null) throw new StateError('That made file is gone.', 404); return saveLineup(text, input.slides, input.caption); });
  }
  async function approve(input) {
    fields(input, ['path', 'value', 'expectedHash', 'operationId'], ['path', 'value', 'expectedHash', 'operationId']);
    const rel = socialFile(input.path);
    if (typeof input.value !== 'string' || !input.value.trim() || input.value.length > 2000) throw new StateError('value is yes, words, or what should change.', 400);
    return transform({command: 'magazine.approve', rel, operationId: input.operationId, input: {path: rel, value: input.value}, expectedHash: expected(input.expectedHash), human: true, doing: 'Adrian answers a made thing'}, text => { if (text === null) throw new StateError('That made file is gone.', 404); return approveMade(text, input.value, new Date(now())); });
  }
  async function exportSave(input) {
    requireHuman('Saving the approved slides');
    fields(input, ['path', 'staged', 'files', 'caption', 'operationId'], ['path', 'staged', 'files', 'operationId']);
    const rel = socialFile(input.path), folder = rel.replace(/\.md$/, '');
    if (!exportStaging) throw new StateError('No export staging folder is configured (magazine.exportStaging).', 503);
    if (typeof input.staged !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(input.staged) || input.staged.startsWith('.')) throw new StateError('staged must name a folder in the export staging area.', 400);
    if (!Array.isArray(input.files) || !input.files.length || input.files.length > 30) throw new StateError('files lists 1 to 30 staged slides.', 400);
    const staged = path.join(exportStaging, input.staged);
    const slides = input.files.map((f, i) => { const name = `slide-${String(i + 1).padStart(2, '0')}.png`; if (f?.name !== name || !/^[a-f0-9]{64}$/.test(f?.sha256 || '')) throw new StateError('Each staged slide is {name: slide-NN.png, sha256}, in order.', 400); const abs = path.join(staged, name), st = fs.lstatSync(abs, {throwIfNoEntry: false}); if (!st || !st.isFile() || st.isSymbolicLink() || st.size > 15 * 1024 * 1024) throw new StateError(`${name} is not staged.`, 404); const bytes = fs.readFileSync(abs); if (sha256(bytes) !== f.sha256 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new StateError(`${name} does not match its hash or is not a PNG.`, 409); return {rel: `${folder}/${name}`, bytes}; });
    return operation({command: 'magazine.export.save', operationId: input.operationId, input: {path: rel, files: input.files, caption: input.caption ?? ''}, rel, doing: 'saving the approved slides'}, async tx => {
      for (const s of slides) { const cur = tx.read('mag', s.rel); if (cur.hash !== sha256(s.bytes)) tx.put('mag', s.rel, cur.hash, s.bytes); }
      const cap = `${folder}/caption.txt`, capBytes = Buffer.from(String(input.caption ?? '') + '\n'), cur = tx.read('mag', cap); if (cur.hash !== sha256(capBytes)) tx.put('mag', cap, cur.hash, capBytes);
      const {abs} = io('mag').locate(folder); const extra = fs.readdirSync(abs).filter(n => /^slide-\d{2}\.png$/.test(n) && Number(n.slice(6, 8)) > slides.length);
      for (const n of extra) { const r = `${folder}/${n}`; tx.put('mag', r, tx.read('mag', r).hash, null); }
      return {saved: slides.length, folder};
    });
  }
  async function albumLink(input) {
    requireHuman('Linking a shared album');
    fields(input, ['story', 'link', 'operationId'], ['story', 'link', 'operationId']);
    const story = String(input.story);
    if (!story || /[/\\\r\n]/.test(story) || story.startsWith('.') || story === 'Drop' || story.length > 120) throw new StateError('unknown story', 400);
    if (!/^https:\/\/(www\.)?icloud\.com\/sharedalbum\/#[A-Za-z0-9]+$/.test(String(input.link).trim())) throw new StateError('That is not a shared album link (it starts https://www.icloud.com/sharedalbum/#)', 400);
    return operation({command: 'magazine.album.link', operationId: input.operationId, input, story, doing: 'linking a shared album'}, async tx => {
      const files = io('files'); files.locate(story + '/Photos/placeholder', {create: true});
      const rel = story + '/album-link.txt', cur = tx.read('files', rel), bytes = Buffer.from(String(input.link).trim() + '\n');
      if (cur.hash !== sha256(bytes)) tx.put('files', rel, cur.hash, bytes);
      return {linked: true, story};
    });
  }

  // ---- STATUS.md story table (D6) and the issue indexes ----
  const numbers = () => { const i = projects.index(); const map = new Map(); if (i) for (const s of i.stories) if (s.number !== null) map.set(s.name, s.number); return map; };
  async function statusRefresh(input) {
    fields(input, ['operationId'], ['operationId']);
    return operation({command: 'magazine.status.refresh', operationId: input.operationId, input: {}, doing: 'refreshing the STATUS story table'}, async tx => {
      const cur = tx.read('mag', 'STATUS.md'); if (!cur.exists) throw new StateError('STATUS.md is missing.', 404);
      const text = cur.bytes.toString('utf8'), nums = numbers();
      if (!nums.size) for (const e of statusEntries(text)) nums.set(e.name, e.number);
      const board = readBoard({vault: vaultRoot, files: filesRoot || '', drops, previewPort});
      for (const b of board.board) if (!nums.has(b.story)) { const e = [...nums.keys()].find(n => n.toLowerCase().split(' ').slice(0, 2).join(' ') === b.story.toLowerCase().split(' ').slice(0, 2).join(' ')); if (e) nums.set(b.story, nums.get(e)); }
      let next; try { next = replaceTable(text, renderTable(board, nums, {date: new Date(now()).toISOString().slice(0, 10)})); } catch (error) { throw new StateError(error.message, error.status || 409); }
      if (next === text) return {changed: false, hash: cur.hash};
      return {changed: true, hash: tx.put('mag', 'STATUS.md', cur.hash, textBytes(next)).afterHash};
    });
  }
  async function statusInstall(input) {
    requireHuman('Adding the story table to STATUS.md');
    fields(input, ['operationId', 'expectedHash'], ['operationId', 'expectedHash']);
    return transform({command: 'magazine.status.install', rel: 'STATUS.md', operationId: input.operationId, input: {}, expectedHash: expected(input.expectedHash), doing: 'adding the STATUS story table'}, text => { if (text === null) throw new StateError('STATUS.md is missing.', 404); try { return installMarkers(text); } catch (error) { throw new StateError(error.message, 409); } });
  }
  async function issueWrite(input) {
    fields(input, ['path', 'content', 'expectedHash', 'operationId'], ['path', 'content', 'expectedHash', 'operationId']);
    const c = classify(input.path); if (c.class !== 'issue') throw new StateError('magazine.issue.write writes files under Issues/.', 400);
    const bytes = textBytes(input.content), base = expected(input.expectedHash);
    return operation({command: 'magazine.issue.write', operationId: input.operationId, input: {path: c.rel, hash: sha256(bytes), base}, doing: 'updating an issue index'}, async tx => ({written: true, path: c.rel, hash: tx.put('mag', c.rel, base, bytes).afterHash}));
  }

  // ---- proposals decided by Adrian ----
  async function proposalAccept(input) {
    requireHuman('Accepting proposed words');
    fields(input, ['proposalId', 'operationId'], ['proposalId', 'operationId']);
    const file = propFile(input.proposalId), p = readJson(file, null);
    if (!p) throw new StateError('No such proposal.', 404);
    if (p.status !== 'open') throw new StateError(`That proposal is ${p.status}.`, 409);
    try {
      const result = await operation({command: 'magazine.proposal.accept', operationId: input.operationId, input: {proposalId: p.proposalId}, rel: p.path, doing: 'Adrian accepts proposed words'}, async tx => ({written: true, path: p.path, hash: tx.put('mag', p.path, p.baseHash, textBytes(p.content)).afterHash, proposalId: p.proposalId, proposedBy: p.actor}));
      atomicWrite(file, JSON.stringify({...p, status: 'accepted', decidedBy: ctx().actor, decidedAt: new Date(now()).toISOString(), appliedOperationId: input.operationId}, null, 1) + '\n');
      return result;
    } catch (error) {
      if (error.status === 409 && /changed since it was read/.test(error.message)) { atomicWrite(file, JSON.stringify({...p, status: 'stale', staleAt: new Date(now()).toISOString()}, null, 1) + '\n'); throw new StateError(`${p.path} changed after these words were proposed, so they were not written. The proposal is marked stale; ask for a fresh one against the current file.`, 409); }
      throw error;
    }
  }
  async function proposalReject(input) {
    requireHuman('Rejecting proposed words');
    fields(input, ['proposalId', 'reason', 'operationId'], ['proposalId', 'operationId']);
    requireWritable();
    const file = propFile(input.proposalId), p = readJson(file, null);
    if (!p) throw new StateError('No such proposal.', 404);
    if (p.status !== 'open') throw new StateError(`That proposal is ${p.status}.`, 409);
    atomicWrite(file, JSON.stringify({...p, status: 'rejected', decidedBy: ctx().actor, decidedAt: new Date(now()).toISOString(), reason: typeof input.reason === 'string' ? input.reason.slice(0, 500) : null}, null, 1) + '\n');
    return {rejected: true, proposalId: p.proposalId, path: p.path};
  }

  // ---- undo: exact, and only while the file still holds what the operation wrote ----
  async function undo(input) {
    fields(input, ['undoOperationId', 'operationId'], ['undoOperationId', 'operationId']);
    if (!UUID.test(input.undoOperationId || '')) throw new StateError('undoOperationId must be the UUID of the write to undo.', 400);
    const target = readJson(opFile(input.undoOperationId), null), who = ctx();
    if (!target || !['committed', 'failed'].includes(target.state)) throw new StateError('No magazine write has that operationId.', 404);
    if (target.undoneBy) throw new StateError('That write was already undone.', 409);
    const applied = target.changes.filter(c => c.applied !== false);
    if (!applied.length) throw new StateError('That operation changed no file.', 409);
    if (!isHuman(who.actor)) {
      if (target.actor !== who.actor) throw new StateError(`Only Adrian or ${target.actor} may undo that write.`, 403);
      for (const ch of applied) { if (ch.move) throw new StateError('Moves are undone by Adrian.', 403); if (ch.root === 'mag') { const c = classify(ch.rel); if (c.class !== 'note') throw new StateError(`${ch.rel} is ${c.class}; only Adrian undoes it.`, 403); } }
    }
    const result = await operation({command: 'magazine.undo', operationId: input.operationId, input: {undoOperationId: input.undoOperationId}, rel: applied.find(c => c.rel)?.rel || null, doing: 'undo'}, async tx => {
      for (const ch of [...applied].reverse()) {
        if (ch.move) { const at = io(ch.root).read(ch.move.to); if (at.hash !== ch.hash) throw new StateError(`${ch.move.to} changed after the move; nothing was undone.`, 409); tx.move(ch.root, ch.move.to, ch.move.from, ch.hash); continue; }
        const cur = tx.read(ch.root, ch.rel);
        if ((cur.hash || null) !== (ch.afterHash || null)) throw new StateError(`${ch.rel} changed after that write; undo would lose the newer words. Nothing was undone.`, 409);
        if (ch.before === null && cur.exists) { const keep = path.join(dirs.undone, input.operationId); fs.mkdirSync(keep, {recursive: true, mode: 0o700}); fs.writeFileSync(path.join(keep, path.basename(ch.rel)), cur.bytes, {mode: 0o600}); }
        tx.put(ch.root, ch.rel, ch.afterHash, ch.before === null ? null : Buffer.from(ch.before, 'base64'));
      }
      return {undone: input.undoOperationId};
    });
    atomicWrite(opFile(input.undoOperationId), JSON.stringify({...target, undoneBy: input.operationId}, null, 1) + '\n');
    return result;
  }

  // ---- tidy (one draft per story; older ones to _archive/Superseded drafts) ----
  async function tidy(input = {}) {
    fields(input, ['apply', 'operationId']);
    const plan = planTidy({vault: vaultRoot, board: readBoard({vault: vaultRoot, files: filesRoot || '', drops, previewPort})});
    if (!input.apply) return {apply: false, ...plan};
    requireHuman('Moving drafts into the archive');
    return operation({command: 'magazine.tidy', operationId: input.operationId, input: {moves: plan.moves}, doing: 'tidy'}, async tx => {
      for (const m of plan.moves) { const cur = tx.read('mag', m.from); if (!cur.exists) throw new StateError(`${m.from} is gone.`, 409); if (io('mag').read(m.to).exists) throw new StateError(`${m.to} already exists in the archive.`, 409); tx.move('mag', m.from, m.to, cur.hash); }
      return {apply: true, moved: plan.moves.length, keeps: plan.keeps};
    });
  }

  // ---- publish: only on Adrian's word ----
  function runMagSend(args) {
    if (!magSendRepo) return Promise.reject(new StateError('No teajia checkout is configured for mag-send (magazine.magSendRepo).', 503));
    return new Promise(resolve => execFile(process.execPath, [path.join(magSendRepo, 'scripts/mag-send.mjs'), ...args], {cwd: magSendRepo, timeout: 120_000, maxBuffer: 4 * 1024 * 1024}, (error, stdout, stderr) => resolve({ok: !error, exitCode: error ? (error.code ?? 1) : 0, stdout: String(stdout).slice(-20000), stderr: String(stderr).slice(-8000)})));
  }
  const devFile = value => { const c = classify(value); if (c.kind !== 'DEV') throw new StateError('Name the draft (Workflow/3-Develop/DEV - ….md).', 400); return c.rel; };
  async function sendCheck(input) {
    fields(input, ['path', 'piece'], ['path', 'piece']);
    const rel = devFile(input.path); if (!/^[a-z0-9-]{1,80}$/.test(input.piece || '')) throw new StateError('piece is the page slug (lowercase words and dashes).', 400);
    const cur = io('mag').read(rel); if (!cur.exists) throw new StateError('That draft is gone.', 404);
    return {path: rel, hash: cur.hash, check: await runMagSend(['send', io('mag').locate(rel).abs, input.piece, '--check'])};
  }
  async function send(input) {
    requireHuman('Publishing');
    fields(input, ['path', 'piece', 'expectedHash', 'operationId'], ['path', 'piece', 'expectedHash', 'operationId']);
    requireWritable();
    const rel = devFile(input.path), cur = io('mag').read(rel);
    if (cur.hash !== expected(input.expectedHash)) throw new StateError('The draft changed since you read it; read it again before saying publish.', 409);
    const record = {schema: 'ar-create.magazine-send.v1', path: rel, piece: input.piece, hash: cur.hash, approvedBy: ctx().actor, at: new Date(now()).toISOString(), operationId: input.operationId};
    atomicWrite(path.join(dirs.sends, input.operationId + '.json'), JSON.stringify(record, null, 1) + '\n', {exclusive: true});
    return {approved: true, ...record, next: 'The /mag publish stage now runs mag-send in a teajia worktree for exactly this draft hash.'};
  }
  function sendApproval({path: value}) {
    const rel = devFile(value), cur = io('mag').read(rel);
    const rows = fs.readdirSync(dirs.sends).map(n => readJson(path.join(dirs.sends, n), null)).filter(r => r && r.path === rel).sort((a, b) => b.at.localeCompare(a.at));
    return {path: rel, hash: cur.hash, approval: rows.find(r => r.hash === cur.hash) || null, older: rows.filter(r => r.hash !== cur.hash).length};
  }
  async function markPublished(input) {
    fields(input, ['path', 'link', 'expectedHash', 'operationId'], ['path', 'link', 'expectedHash', 'operationId']);
    const rel = devFile(input.path);
    if (!/^https:\/\/(www\.)?teajia\.com\/[\w/.-]+$/.test(String(input.link))) throw new StateError('link is the live teajia.com page.', 400);
    const approval = sendApproval({path: rel}).approval;
    if (!approval || approval.hash !== input.expectedHash) throw new StateError('Adrian has not said publish for this exact draft (magazine.send).', 403);
    return transform({command: 'magazine.mark-published', rel, operationId: input.operationId, input: {path: rel, link: input.link}, expectedHash: expected(input.expectedHash), doing: 'marking the draft published'}, text => {
      const fm = text.match(/^---\n([\s\S]*?)\n---\n/); if (!fm) throw new StateError('The draft has no frontmatter.', 409);
      const body = /^published:.*$/m.test(fm[1]) ? fm[1].replace(/^published:.*$/m, 'published: ' + input.link) : fm[1] + '\npublished: ' + input.link;
      return '---\n' + body + '\n---\n' + text.slice(fm[0].length);
    });
  }

  // ---- reading ----
  function read({path: value} = {}) {
    const rel = cleanRelative(value); let c = null; try { c = classify(rel); } catch {}
    const cur = io('mag').read(rel);
    if (!cur.exists) return {path: rel, exists: false, hash: null, kind: c?.kind || null, class: c?.class || null};
    let text = null; try { text = new TextDecoder('utf-8', {fatal: true}).decode(cur.bytes); } catch {}
    return {path: rel, exists: true, hash: cur.hash, size: cur.size, mtime: cur.mtime, kind: c?.kind || null, class: c?.class || 'read-only', text: text !== null && text.length <= 2 * 1024 * 1024 ? text : null, conflicts: io('mag').conflictCopies(rel)};
  }
  function board() {
    const {lock} = roots();
    const result = readBoard({vault: vaultRoot, files: filesRoot || '', drops, previewPort});
    const open = proposalList({status: 'open'}).proposals;
    return {schema: 'ar-create.magazine-board.v1', ...result, text: boardText(result, {date: new Date(now()).toISOString().slice(0, 10)}), lock: lock.status(), writable, proposals: open.map(p => ({proposalId: p.proposalId, path: p.path, kind: p.kind, actor: p.actor, createdAt: p.createdAt})), registered: projects.list()};
  }
  function brandRead({id} = {}) {
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,40}$/.test(id)) throw new StateError('Name the brand (for example teajia).', 400);
    if (!editorialRoot) throw new StateError('No editorial folder is configured.', 503);
    const file = path.join(editorialRoot, 'brands', id + '.md'), st = fs.lstatSync(file, {throwIfNoEntry: false});
    if (!st || !st.isFile() || st.isSymbolicLink()) throw new StateError(`No brand profile named ${id}.`, 404);
    const bytes = fs.readFileSync(file); return {id, text: bytes.toString('utf8'), hash: sha256(bytes), path: 'editorial/brands/' + id + '.md'};
  }

  return {
    configured, get writable() { return writable; }, projects,
    status: () => ({configured, writable, vaultRoot: configured ? vaultRoot : null, filesRoot, drops, lock: configured ? roots().lock.status() : null}),
    board, read, write, edit, askAnswer, askSet, requestsAdd, pageFeedback, lineupSave, approve, exportSave, albumLink,
    statusRefresh, statusInstall, statusTable: () => { const cur = io('mag').read('STATUS.md'); return {hash: cur.hash, ...findTable(cur.exists ? cur.bytes.toString('utf8') : '')}; },
    issueWrite, proposalList, proposalRead, proposalAccept, proposalReject, undo,
    operation: ({operationId}) => { if (!UUID.test(operationId || '')) throw new StateError('operationId must be a UUID.', 400); const r = readJson(opFile(operationId), null); if (!r) throw new StateError('No such operation.', 404); return {...r, changes: r.changes.map(({before, ...rest}) => rest)}; },
    lockStatus: () => roots().lock.status(),
    lockHold: async input => { fields(input || {}, ['doing', 'ttlMs']); requireWritable(); const who = ctx(); return roots().lock.hold({actor: who.actor, doing: typeof input?.doing === 'string' ? input.doing.slice(0, 120) : 'a /mag run on this Mac'}, input?.ttlMs ? {ttlMs: input.ttlMs} : {}); },
    lockRelease: async () => roots().lock.release(),
    lockRecover: async input => { requireHuman('Clearing the magazine lock'); fields(input || {}, ['expectedHash'], ['expectedHash']); requireWritable(); return roots().lock.recover(input); },
    tidy, sendCheck, send, sendApproval, markPublished, brandRead,
    drops: () => ({drops: dropped(drops).map(d => ({...d, size: (() => { try { return fs.statSync(d.path).size; } catch { return null; } })()}))}),
    // Internals the intake (M5) and reconcile steps build on.
    _operation: operation, _io: io, _roots: roots, _dirs: dirs, _ctx: ctx, _requireWritable: requireWritable, _intakeEngine: intakeEngine,
  };
}
