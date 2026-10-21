// Step 1 → 2: a recording or a transcript dropped in becomes a story's RAW, with AR Create as the
// only writer of FILES/<story>/ and the Inbox. Replaces the filing half of ~/builds/mag-intake.sh
// and mag-local (the transcription engine itself is reused unchanged through recordings.mjs).
//
//   claim  copies the dropped file into FILES/<story>/ (exclusive; never over a different file),
//          makes Photos/, and records the claim. A transcript (.txt/.md) is filed to RAW at once;
//          a recording starts the isolated transcription job.
//   file   when the job's RAW is ready: publishes it once into Workflow/0-Inbox (RAW is never
//          overwritten), pointing its audio/photos lines at the FILES copy, then empties the drop
//          (only now, and only if the dropped file is still the one that was copied).
// A second drop of the same bytes is refused while its first claim stands.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {StateError} from '../../store.mjs';
import {atomicWrite, readJson} from '../files.mjs';
import {sha256, sha256File} from './write.mjs';

const MEDIA = /\.(m4a|mp3|wav|mov|mp4|aac|flac|ogg|opus|webm|mkv|aiff|aif|m4v)$/i, TEXT = /\.(txt|md)$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function safeStoryName(value) {
  const story = String(value ?? '').trim();
  if (!story || story === 'Drop' || story.startsWith('.') || story.startsWith('_') || /[/\\\x00-\x1f]/.test(story) || story.length > 120) throw new StateError('Name the story without slashes (it becomes the folder and the RAW name).', 400);
  return story;
}
/** RAW for a transcript dropped in as text, in the shape mag-intake.sh wrote. */
export function rawFromText({story, text, recorded, source}) {
  const q = v => JSON.stringify(v);
  return `---\ntype: RAW\ntitle: ${q(story)}\nrecorded: ${q(recorded)}\nsource: ${q(source)}\ncredit: Adrian Rasmussen\nlanguage: "unknown"\nfiled-by: ar-create\n---\n\n# RAW – ${story}\n\n${text.replace(/\r\n/g, '\n').trim()}\n`;
}
/** The engine's RAW, with its audio/photos lines pointed at the FILES copy (the isolated copy is private). */
export function pointRawAt(raw, {audio, photos}) {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/); if (!fm) return raw;
  const body = fm[1].replace(/^audio:.*$/m, 'audio: ' + JSON.stringify(audio)).replace(/^photos:.*$/m, 'photos: ' + JSON.stringify(photos));
  return '---\n' + body + '\n---\n' + raw.slice(fm[0].length);
}

export function createMagazineIntake({vault, engine = null, drops = [], filesRoot, now = () => Date.now(), events = null}) {
  const dir = vault._dirs.intake;
  const claimFile = id => { if (!UUID.test(id || '')) throw new StateError('claimId must be a UUID.', 400); return path.join(dir, id + '.json'); };
  const claims = () => fs.readdirSync(dir).filter(n => n.endsWith('.json')).map(n => readJson(path.join(dir, n), null)).filter(Boolean);
  const save = claim => atomicWrite(claimFile(claim.claimId), JSON.stringify(claim, null, 1) + '\n');
  const rawRel = story => `Workflow/0-Inbox/RAW - ${story}.md`;
  function dropFile(folder, name) {
    if (!Number.isInteger(folder) || folder < 0 || folder >= drops.length) throw new StateError(`folder is 0 to ${drops.length - 1} (the configured drop folders).`, 400);
    if (typeof name !== 'string' || !name || name.startsWith('.') || /[/\\\x00-\x1f]/.test(name) || name.endsWith('.part')) throw new StateError('name is a file directly in the drop folder.', 400);
    const abs = path.join(drops[folder], name), st = fs.lstatSync(abs, {throwIfNoEntry: false});
    if (!st) { if (fs.existsSync(path.join(drops[folder], '.' + name + '.icloud'))) throw new StateError(`${name} is still downloading from iCloud. Open the Teajia Drop folder in Finder to fetch it, then try again.`, 409); throw new StateError(`${name} is not in the drop folder.`, 404); }
    if (st.isSymbolicLink() || !st.isFile()) throw new StateError(`${name} is not a regular file.`, 403);
    return {abs, size: st.size, mtime: new Date(st.mtimeMs).toISOString().slice(0, 10)};
  }
  function removeDrop(claim) {
    const abs = path.join(drops[claim.drop.folder], claim.drop.name);
    if (!fs.existsSync(abs)) return 'already gone';
    if (sha256File(abs) !== claim.drop.sha256) return 'kept: it changed after it was taken in';
    fs.rmSync(abs); return 'emptied';
  }
  async function fileRaw(claim, text, operationId) {
    const story = claim.story, rel = rawRel(story);
    const result = await vault._operation({command: 'magazine.intake.file', operationId, input: {claimId: claim.claimId, raw: sha256(Buffer.from(text))}, story, doing: 'filing RAW for ' + story}, async tx => {
      const put = tx.put('mag', rel, null, Buffer.from(text, 'utf8'));
      return {filed: true, raw: rel, hash: put.afterHash};
    });
    claim.state = 'filed'; claim.raw = {rel, sha256: result.hash}; claim.filedAt = new Date(now()).toISOString(); claim.drop.after = removeDrop(claim); save(claim);
    const who = vault._ctx();
    events?.emit({kind: 'recording.filed', scope: {kind: 'story', id: result.scope?.id || null}, actor: who.actor, client: who.client, revision: null, operationId, path: rel, files: claim.filed});
    return {...result, claim: publicClaim(claim)};
  }
  const publicClaim = c => ({claimId: c.claimId, story: c.story, kind: c.kind, state: c.state, filed: c.filed, raw: c.raw || null, jobId: c.jobId || null, drop: {name: c.drop.name, folder: c.drop.folder, sha256: c.drop.sha256, size: c.drop.size, after: c.drop.after || null}, error: c.error || null, claimedAt: c.claimedAt, actor: c.actor});

  return {
    async claim(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['name', 'folder', 'story', 'operationId'].includes(k))) throw new StateError('Use name, folder, story and operationId.', 400);
      vault._requireWritable();
      const story = safeStoryName(input.story), folder = input.folder ?? 0, drop = dropFile(folder, input.name);
      const kind = MEDIA.test(input.name) ? 'recording' : TEXT.test(input.name) ? 'transcript' : null;
      if (!kind) throw new StateError('AR Create takes in a recording (m4a, mp3, wav, mov…) or a .txt/.md transcript. Export other transcripts (docx, rtf, srt) as .txt first.', 415);
      if (kind === 'recording' && !engine?.ready?.()) throw new StateError('Local transcription is not ready in AR Create, so the recording stays in the drop folder.', 503);
      if (vault.read({path: rawRel(story)}).exists) throw new StateError(`RAW - ${story} already exists, and RAW is never overwritten. Choose another story name.`, 409);
      const dropHash = sha256File(drop.abs);
      const prior = claims().find(c => c.drop.sha256 === dropHash && c.state !== 'failed');
      if (prior && prior.operationId === input.operationId) return {replay: true, claim: publicClaim(prior)};
      if (prior) throw new StateError(`This recording was already taken in for ${prior.story} (${prior.state}).`, 409);
      const who = vault._ctx(), filed = `${story}/${input.name}`;
      const claim = {schema: 'ar-create.magazine-intake.v1', claimId: randomUUID(), story, kind, state: 'claimed', filed, drop: {folder, name: input.name, sha256: dropHash, size: drop.size}, claimedAt: new Date(now()).toISOString(), actor: who.actor, operationId: input.operationId};
      const copied = await vault._operation({command: 'magazine.drops.claim', operationId: input.operationId, input: {story, name: input.name, folder, sha256: dropHash}, story, doing: 'taking in ' + input.name}, async tx => {
        vault._io('files').locate(`${story}/Photos/placeholder`, {create: true});
        const c = tx.copyIn('files', filed, drop.abs, dropHash);
        return {copied: !c.reused, filed};
      });
      save(claim);
      if (kind === 'transcript') {
        const text = fs.readFileSync(path.join(filesRoot, filed), 'utf8');
        return {...copied, ...(await fileRaw(claim, rawFromText({story, text, recorded: drop.mtime, source: path.join(filesRoot, filed)}), randomUUID()))};
      }
      try { claim.jobId = engine.start(story, path.join(filesRoot, filed)); claim.state = 'transcribing'; }
      catch (error) { claim.state = 'failed'; claim.error = String(error.message).slice(0, 300); }
      save(claim);
      return {...copied, claim: publicClaim(claim)};
    },
    read({claimId}) {
      const c = readJson(claimFile(claimId), null); if (!c) throw new StateError('No such intake.', 404);
      return {...publicClaim(c), job: c.jobId && engine ? engine.job(c.jobId) : null};
    },
    list: () => ({claims: claims().map(publicClaim)}),
    async file(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['claimId', 'operationId'].includes(k))) throw new StateError('Use claimId and operationId.', 400);
      const c = readJson(claimFile(input.claimId), null); if (!c) throw new StateError('No such intake.', 404);
      if (c.state === 'filed') return {filed: true, already: true, claim: publicClaim(c)};
      if (c.state !== 'transcribing' || !c.jobId) throw new StateError(`This intake is ${c.state}.`, 409);
      const job = engine?.job(c.jobId);
      if (!job) throw new StateError('The transcription job is gone; the recording is safe in its story folder.', 409);
      if (job.state === 'failed') throw new StateError(`Transcription failed: ${job.error || 'see the recordings workshop'}. The recording is safe in its story folder.`, 409);
      if (!job.transcriptReady || !job.raw) throw new StateError(`Still transcribing (${job.stage || job.state}).`, 409);
      const bytes = fs.readFileSync(job.raw);
      if (job.rawSha256 && sha256(bytes) !== job.rawSha256) throw new StateError('The transcript the job made changed; check it in the recordings workshop.', 409);
      return fileRaw(c, pointRawAt(bytes.toString('utf8'), {audio: path.join(filesRoot, c.filed), photos: path.join(filesRoot, c.story, 'Photos')}), input.operationId);
    },
  };
}
