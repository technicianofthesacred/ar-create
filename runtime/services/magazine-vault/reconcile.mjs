// D7: AR Create's own working copies of a magazine draft (study-draft-copies, "owned-working-copy")
// against the vault draft. Equal: nothing to choose; the copy is archived. Different: Adrian sees both
// side by side, paragraph by paragraph, and picks one per story. Nothing is merged by itself.
// The chosen words end up in the vault DEV; the copy is moved (never deleted) to
// <data>/archive/owned-copies/<binding id>/.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {StateError} from '../../store.mjs';
import {requireHuman} from '../actor.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Paragraph-level side by side: same / only-vault / only-copy rows, in reading order (LCS). */
export function sideBySide(vaultText, copyText) {
  const blocks = t => String(t || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const a = blocks(vaultText), b = blocks(copyText), n = a.length, m = b.length;
  if (n * m > 4_000_000) throw new StateError('These drafts are too long to compare here.', 413);
  const L = Array.from({length: n + 1}, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const rows = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { rows.push({kind: 'same', vault: a[i], copy: b[j]}); i++; j++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) { rows.push({kind: 'copy-only', vault: null, copy: b[j]}); j++; }
    else { rows.push({kind: 'vault-only', vault: a[i], copy: null}); i++; }
  }
  return {rows, same: rows.filter(r => r.kind === 'same').length, vaultOnly: rows.filter(r => r.kind === 'vault-only').length, copyOnly: rows.filter(r => r.kind === 'copy-only').length};
}

export function createReconcile({dataDir, vault}) {
  const root = path.join(dataDir, 'study-draft-copies');
  const bindings = () => {
    const dir = path.join(root, 'bindings'); if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(n => /^[a-f0-9]{64}\.json$/.test(n)).map(n => { try { return {file: path.join(dir, n), b: JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))}; } catch { return null; } })
      .filter(x => x && x.b.schema === 'ar-create.study-draft-copy.v1' && !x.b.kind && UUID.test(x.b.id || '') && typeof x.b.draftRelative === 'string');
  };
  function row({file, b}) {
    const base = path.basename(b.draftRelative), project = vault.projects.list().stories.find(s => s.pieces.some(p => p.rel && path.basename(p.rel) === base)) || null;
    const copyFile = path.join(root, 'copies', b.id, 'workflow', b.draftRelative);
    const copy = fs.existsSync(copyFile) ? fs.readFileSync(copyFile) : null;
    const rel = project ? project.pieces.find(p => p.rel && path.basename(p.rel) === base).rel : null;
    const live = rel ? vault.read({path: rel}) : null;
    const state = !project ? 'not-a-registered-story' : !copy ? 'copy-missing' : !live?.exists ? 'vault-draft-missing' : sha(copy) === live.hash ? 'equal' : 'different';
    return {bindingId: b.id, title: b.title, parentStudyId: b.parentStudyId, story: project?.name || null, vaultPath: rel, vaultHash: live?.hash || null, copyHash: copy ? sha(copy) : null, state, bindingFile: file, copyFile};
  }
  const find = id => { if (!UUID.test(id || '')) throw new StateError('bindingId must be a working-copy UUID.', 400); const x = bindings().find(x => x.b.id === id); if (!x) throw new StateError('No working copy with that id.', 404); return row(x); };
  function archive(r) {
    const target = path.join(dataDir, 'archive', 'owned-copies', r.bindingId);
    if (fs.existsSync(target)) throw new StateError('That copy was already archived.', 409);
    fs.mkdirSync(target, {recursive: true, mode: 0o700});
    fs.renameSync(r.bindingFile, path.join(target, 'binding.json'));
    const copyDir = path.join(root, 'copies', r.bindingId); if (fs.existsSync(copyDir)) fs.renameSync(copyDir, path.join(target, 'copy'));
    return target;
  }
  return {
    list: () => ({schema: 'ar-create.magazine-reconcile.v1', copies: bindings().map(row).map(({bindingFile, copyFile, ...r}) => r)}),
    compare({bindingId}) {
      const r = find(bindingId);
      if (!['equal', 'different'].includes(r.state)) return {...r, bindingFile: undefined, copyFile: undefined};
      const vaultText = vault.read({path: r.vaultPath}).text, copyText = fs.readFileSync(r.copyFile, 'utf8');
      const {bindingFile, copyFile, ...rest} = r;
      return {...rest, sideBySide: sideBySide(vaultText, copyText), vaultText, copyText};
    },
    async choose(input) {
      requireHuman('Choosing between a working copy and the vault draft');
      if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['bindingId', 'choice', 'expectedVaultHash', 'expectedCopyHash', 'operationId'].includes(k))) throw new StateError('Use bindingId, choice (vault|copy), expectedVaultHash, expectedCopyHash, operationId.', 400);
      const r = find(input.bindingId);
      if (!['equal', 'different'].includes(r.state)) throw new StateError(`Nothing to choose: ${r.state}.`, 409);
      if (r.vaultHash !== input.expectedVaultHash || r.copyHash !== input.expectedCopyHash) throw new StateError('One of the two versions changed since you compared them. Compare again.', 409);
      if (!['vault', 'copy'].includes(input.choice)) throw new StateError('choice is vault or copy.', 400);
      let written = null;
      if (input.choice === 'copy' && r.state === 'different') written = await vault.write({path: r.vaultPath, content: fs.readFileSync(r.copyFile, 'utf8'), expectedHash: r.vaultHash, operationId: input.operationId});
      else vault._requireWritable();
      return {chosen: input.choice, story: r.story, path: r.vaultPath, written: written ? {hash: written.hash, operationId: written.operationId} : null, archivedTo: archive(r), ...(written?.scope ? {scope: written.scope} : {})};
    },
  };
}
