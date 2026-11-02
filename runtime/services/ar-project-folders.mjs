import {historicalVersion} from './draft-history.mjs';
import {capture as captureDraft,projection as projectDraft,apply as applyDraft,undo as undoDraft} from './draft-correspondence.mjs';
import {metadata as draftMetadata,snapshot as draftSnapshot} from './draft-correspondence-metadata.mjs';
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import {materialMarkdown, readMaterialMarkdown} from './project-material-markdown.mjs';
const digest = (bytes2) => createHash("sha256").update(bytes2).digest("hex");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message, status = 409) => {
  throw Object.assign(new Error(message), { status });
};
const stable = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const same = (a, b) => stable(a) === stable(b);
function workflowText(raw) {
  if (raw === null) return "";
  try {
    // Never rewrite original invalid bytes as Unicode replacement characters.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
  } catch {
    fail("Working record is not valid UTF-8; repair its encoding before editing.", 400);
  }
}
function relative(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || path.isAbsolute(value) || /[\\\x00-\x1f\x7f]/.test(value) || value.split("/").some((p) => !p || p === "." || p === ".." || p.startsWith("."))) fail("Use an explicit safe relative path.", 400);
  return value;
}
function directory(p) {
  if (typeof p !== "string" || !path.isAbsolute(p)) fail("Explicit absolute directory required.", 400);
  const s = fs.lstatSync(p);
  if (!s.isDirectory() || s.isSymbolicLink() || fs.realpathSync(p) !== path.resolve(p)) fail("Directory must be real and canonical.", 403);
  return { path: p, dev: s.dev, ino: s.ino };
}
function currentRoot(root) {
  const now = directory(root.path);
  // Compared by inode only: the path is already checked, and macOS can renumber the same disk (dev) after a restart.
  if (now.ino !== root.ino) fail("Bound root changed. Rebind explicitly.");
}
function location(root, rel, missing = false) {
  relative(rel);
  currentRoot(root);
  let p = root.path;
  const parts = rel.split("/");
  for (let i = 0; i < parts.length; i++) {
    p = path.join(p, parts[i]);
    const s = fs.lstatSync(p, { throwIfNoEntry: false });
    if (!s && missing && i === parts.length - 1) return p;
    if (!s) fail("Bound file or directory unavailable.", 404);
    if (s.isSymbolicLink() || i < parts.length - 1 && !s.isDirectory()) fail("Symlink or changed directory refused.", 403);
  }
  return p;
}
function bytes(file, { optional = false } = {}) {
  const s = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!s && optional) return null;
  if (!s) fail("Bound file unavailable.", 404);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1) fail("Only unlinked regular files are supported.", 403);
  if (s.size > 64 * 1024 * 1024) fail("File exceeds the 64 MB candidate limit.", 413);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd), buffer = Buffer.alloc(Math.min(before.size + 1, 64 * 1024 * 1024 + 1));
    let length = 0;
    while (length < buffer.length) {
      const read = fs.readSync(fd, buffer, length, buffer.length - length, length);
      if (!read) break;
      length += read;
    }
    const raw = buffer.subarray(0, length), after = fs.fstatSync(fd), visible = fs.lstatSync(file);
    if (before.ino !== visible.ino || before.dev !== visible.dev || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || raw.length > 64 * 1024 * 1024) fail("File changed during read.");
    return raw;
  } finally {
    fs.closeSync(fd);
  }
}
function atomic(file, raw, exclusive = false) {
  const temp = file + "." + randomUUID() + ".tmp";
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 384);
    fs.writeFileSync(fd, raw);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = void 0;
    if (exclusive) fs.linkSync(temp, file);
    else {
      bytes(file, { optional: true });
      fs.renameSync(temp, file);
    }
    const dir = fs.openSync(path.dirname(file), "r");
    try {
      fs.fsyncSync(dir);
    } finally {
      fs.closeSync(dir);
    }
  } finally {
    if (fd !== void 0) fs.closeSync(fd);
    fs.rmSync(temp, { force: true });
  }
}
const hashAt = (file) => {
  const raw = bytes(file, { optional: true });
  return raw === null ? null : digest(raw);
};
const safeUrl = (value) => {
  let u;
  try {
    u = new URL(value);
  } catch {
    fail("A valid URL is required.", 400);
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.href.length > 4096) fail("Use a bounded HTTP URL without credentials.", 400);
  return u.href;
};
function createBoundProjectFolders({ dataDir, roots, ask, draft, writableWorkingRecords = false, beforeCommit, afterCommit, ownedRelocation } = {}) {
  const data = directory(dataDir), configured = { media: directory(roots?.media), workflow: directory(roots?.workflow) };
  if (data.path === configured.media.path || data.path.startsWith(configured.media.path + path.sep) || data.path === configured.workflow.path || data.path.startsWith(configured.workflow.path + path.sep)) fail("Keep adapter metadata outside original roots.", 403);
  const area = path.join(data.path, "ar-project-folder-bindings");
  if (!fs.existsSync(area)) fs.mkdirSync(area, { mode: 448 });
  const owned = directory(area);
  function ownedFile(name) {
    currentRoot(data);
    currentRoot(owned);
    return path.join(area, name);
  }
  function projectFile(id) {
    if (!UUID.test(id || "")) fail("A project UUID is required.", 400);
    return ownedFile(id + ".json");
  }
  function load(id) {
    const raw = bytes(projectFile(id), { optional: true });
    if (!raw) fail("Project is not bound.", 404);
    let b = JSON.parse(raw);
    if(ownedRelocation)b=ownedRelocation(raw,b,configured);
    if (b.projectId !== id || b.schema !== "ar-create.project-folders.v1") fail("Binding identity changed.");
    for (const key of ["media", "workflow"]) {
      if (b.roots[key].path !== configured[key].path) fail("Binding roots differ from configuration.");
      currentRoot(b.roots[key]);
    }
    currentRoot(b.media);
    currentRoot(b.derived);
    return b;
  }
  function save(b) {
    atomic(projectFile(b.projectId), JSON.stringify(b, null, 2));
  }
  function locked(work) {
    const p = ownedFile("adapter.lock");
    let fd;
    try {
      fd = fs.openSync(p, "wx", 384);
    } catch (e) {
      if (e.code === "EEXIST") fail("Another adapter operation is working.");
      throw e;
    }
    try {
      return work();
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(p);
    }
  }
  function bind({ projectId, mediaFolder, derivedFolder, records = {}, draftAuthority }) {
    return locked(() => {
      const file = projectFile(projectId);
      if (fs.existsSync(file)) fail("Project already bound; explicit reconnect is required.");
      const media = directory(location(configured.media, mediaFolder)), derived = directory(location(configured.workflow, derivedFolder));
      if (media.path === derived.path || derived.path.startsWith(media.path + path.sep) || media.path.startsWith(derived.path + path.sep)) fail("Original and derived directories must be separate.", 403);
      const r = {};
      if (records.ask) {
        if (!/^Workflow\/ASK - [^/]+\.md$/.test(relative(records.ask))) fail("Only an exact ASK working record may be bound.", 403);
        r.ask = records.ask;
        const parsed = ask.parseAsk(bytes(location(configured.workflow, r.ask)).toString("utf8"));
        if (parsed.meta["record-to"]) {
          r.map = relative(parsed.meta["record-to"]);
          if (!/^Workflow\/2-Guidance\/MAP - [^/]+\.md$/.test(r.map) || records.map !== r.map) fail("Explicit MAP binding must match ASK record-to.", 403);
          bytes(location(configured.workflow, r.map));
        } else if (records.map) fail("ASK has no MAP record-to.", 400);
      }
      if (records.draft) {
        r.draft = relative(records.draft);
        if (!/^Workflow\/3-Develop\/DEV - [^/]+\.md$/.test(r.draft)) fail("Only an exact DEV working record may be bound.", 403);
        bytes(location(configured.workflow, r.draft));
        r.edits = "Workflow/4-Review/EDITS - " + path.basename(r.draft);
        location(configured.workflow, r.edits, true);
      }
      if(draftAuthority!==undefined&&draftAuthority!=='owned-working-copy')fail('Explicit owned-working-copy authority required for native draft operations.',403);
      const b = { schema: "ar-create.project-folders.v1", projectId, roots: configured, media, derived, records: r, materials: [], revision: 0,...(draftAuthority?{draftAuthority}:{}) };
      atomic(file, JSON.stringify(b, null, 2), true);
      return structuredClone(b);
    });
  }
  function scan(projectId) {
    return locked(() => {
      const b = load(projectId), found = [], diagnostics = [];
      if(!workflowReadiness(projectId).ready)fail('Pending workflow operation requires recovery before mutations.');
      let entries = 0, total = 0;
      function walk(rel = "") {
        const dir = rel ? location(b.media, rel) : b.media.path;
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b2) => a.name.localeCompare(b2.name))) {
          if (e.name.startsWith(".")) continue;
          if (++entries > 2e3) fail("Folder scan exceeds 2000 entries; membership unchanged.", 413);
          const r = rel ? rel + "/" + e.name : e.name;
          if (r.split("/").length > 12) fail("Folder scan depth exceeded; membership unchanged.", 413);
          if (e.isSymbolicLink()) {
            diagnostics.push({ relativePath: r, error: "Symlink skipped" });
            continue;
          }
          if (e.isDirectory()) {
            walk(r);
            continue;
          }
          if (!e.isFile()) continue;
          const p = location(b.media, r), raw = bytes(p), s = fs.lstatSync(p);
          total += raw.length;
          if (total > 256 * 1024 * 1024) fail("Scan exceeds 256 MB; membership unchanged.", 413);
          let material = { kind: "file", availability: "local" };
          if (/\.md$/i.test(r)) {
            try { material = readMaterialMarkdown(raw) || material; }
            catch { diagnostics.push({relativePath:r,error:"Invalid Markdown material header; shown as file"}); }
          }
          if (r.endsWith(".ar-material.json")) {
            try {
              const record = JSON.parse(raw);
              if (record.schema === "ar-create.material.v1" && ["url", "note"].includes(record.kind)) {
                material = { kind: record.kind, availability: record.kind === "url" ? "linked" : "local", url: record.url || record.sourceUrl || "", title: record.name, linkedImage: record.linkedImage === true };
              }
            } catch {
              diagnostics.push({ relativePath: r, error: "Invalid material record; shown as file" });
            }
          }
          found.push({ ...material, relativePath: r, path: p, hash: digest(raw), dev: s.dev, ino: s.ino });
        }
      }
      walk();
      const used = /* @__PURE__ */ new Set(), paths = new Set(found.map((x) => x.relativePath));
      const materials = found.map((f) => {
        let old = b.materials.find((m) => !used.has(m.id) && m.relativePath === f.relativePath);
        if (!old) {
          const matches = b.materials.filter((m) => !used.has(m.id) && !paths.has(m.relativePath) && m.ino === f.ino);
          if (matches.length === 1) old = matches[0];
        }
        if (old) used.add(old.id);
        const change2 = !old ? "added" : old.relativePath !== f.relativePath ? "renamed" : old.ino !== f.ino ? "replaced" : old.hash !== f.hash ? "modified" : "unchanged";
        return { ...f, id: old?.id || randomUUID(), change: change2, missing: false };
      });
      const missing = b.materials.filter((m) => !used.has(m.id)).map((m) => ({ ...m, missing: true, change: "missing" }));
      b.materials = [...materials, ...missing];
      b.revision++;
      save(b);
      return { projectId, revision: b.revision, materials, missing, diagnostics };
    });
  }
  function add({ projectId, items }) {
    return locked(() => {
      const b = load(projectId);
      if(!workflowReadiness(projectId).ready)fail('Pending workflow operation requires recovery before mutations.');
      if (!Array.isArray(items) || items.length > 100) fail("Use a bounded material batch.", 400);
      const receipts = [];
      for (const item of items) {
        try {
          if (typeof item?.name !== "string" || item.name.length > 200 || item.name.includes("/") || item.name.includes("\\")) fail("Use a safe material filename.", 400);
          relative(item.name);
          let name = item.name, raw;
          if (item.kind === "file") {
            if (!Buffer.isBuffer(item.bytes) && !(item.bytes instanceof Uint8Array)) fail("Supply file bytes.", 400);
            raw = Buffer.from(item.bytes);
            if (name.endsWith(".ar-material.json")) fail("Reserved material record suffix.", 400);
          } else if (["url", "note"].includes(item.kind)) {
            const record = { schema: "ar-create.material.v1", kind: item.kind, name: item.name };
            if (item.kind === "url") {
              record.url = safeUrl(item.url);
              record.linkedImage = item.linkedImage === true;
            } else {
              if (typeof item.text !== "string" || !item.text.trim() || Buffer.byteLength(item.text) > 1024 * 1024) fail("Supply a bounded note.", 400);
              record.text = item.text;
              if (item.sourceUrl) record.sourceUrl = safeUrl(item.sourceUrl);
            }
            raw = Buffer.from(materialMarkdown(record));
            if (!/\.md$/i.test(name)) name += ".md";
          } else fail("Unsupported drop payload.", 400);
          if (raw.length > 64 * 1024 * 1024) fail("Drop exceeds 64 MB.", 413);
          const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
          let n = 1, p;
          for (; ; ) {
            const candidate = n === 1 ? name : `${stem} (${n})${ext}`;
            p = location(b.media, candidate, true);
            try {
              atomic(p, raw, true);
              name = candidate;
              break;
            } catch (e) {
              if (e.code !== "EEXIST") throw e;
              if (++n > 1e3) fail("Too many filename collisions.");
            }
          }
          receipts.push({ ok: true, name, path: p, hash: digest(raw) });
        } catch (e) {
          receipts.push({ ok: false, name: item?.name || "", error: e.message, status: e.status || 500 });
        }
      }
      return { projectId, receipts };
    });
  }
  function reconnect({ projectId, sourceId, targetId, expectedSourceHash, expectedTargetHash }) {
    return locked(() => {
      if(!workflowReadiness(projectId).ready)fail('Pending workflow operation requires recovery before mutations.');
      const b = load(projectId), s = b.materials.find((m) => m.id === sourceId), t = b.materials.find((m) => m.id === targetId);
      if (!s?.missing || !t || t.missing || sourceId === targetId || s.hash !== expectedSourceHash || t.hash !== expectedTargetHash || s.hash !== t.hash || hashAt(location(b.media, s.relativePath, true)) !== null || hashAt(location(b.media, t.relativePath)) !== t.hash) fail("Reconnect requires missing identity and exact matching current bytes.");
      b.materials = b.materials.filter((m) => m.id !== sourceId && m.id !== targetId);
      b.materials.push({ ...t, id: sourceId, change: "reconnected" });
      b.revision++;
      save(b);
      return { sourceId, retiredTargetId: targetId, revision: b.revision };
    });
  }
  function readWorkflow(projectId) {
    const b = load(projectId), raw = {}, hashes = {};
    for (const [key, rel] of Object.entries(b.records)) {
      const value = bytes(location(b.roots.workflow, rel, true), { optional: key === "edits" });
      raw[key] = workflowText(value);
      hashes[key] = value === null ? null : digest(value);
    }
    const parsed = raw.ask ? ask.parseAsk(raw.ask) : { meta: {}, questions: [] };
    if ((parsed.meta["record-to"] || null) !== (b.records.map || null)) fail("ASK record-to changed. Rebind explicitly.");
    return { projectId, hashes, ...raw, questions: parsed.questions.map((q) => ({ ...q, key: digest(JSON.stringify({ ask: b.records.ask, index: q.index, title: q.title, hash: hashes.ask })) })), paragraphs: raw.draft ? draft.splitBlocks(raw.draft).parts.filter((_, i) => i % 2 === 0).map((raw2, index) => ({ index, seen: draft.hash(raw2), text: draft.plain(raw2), editable: draft.editable(raw2) })).filter((p) => p.editable) : [] };
  }
  function operationFile(projectId, operationId) {
    if (!UUID.test(operationId || "")) fail("Operation UUID required.", 400);
    return ownedFile(projectId + "-" + operationId + ".operation.json");
  }
  function inspectOperation({ projectId, operationId }) {
    const b = load(projectId), r = JSON.parse(bytes(operationFile(projectId, operationId)).toString());
    if (r.projectId !== projectId || r.operationId !== operationId||r.schema!=='ar-create.project-folder-operation.v1'||!['prepared','committed'].includes(r.state)||!Array.isArray(r.changes)) fail("Receipt identity changed.");
    if(new Set(r.changes.map(c=>(c.area||'workflow')+':'+c.relativePath)).size!==r.changes.length)fail('Duplicate journal destinations refused.');
    const changes = r.changes.map((c) => {
      if(typeof c.after!=='string'||digest(c.after)!==c.afterHash)fail("Receipt contract changed.");
      const actual = hashAt(changeDestination(b,c));
      return { ...c, state: actual === c.afterHash ? "applied" : actual === c.beforeHash ? "pending" : "diverged" };
    });
    return { ...r, changes, state: r.state === "committed" ? "committed" : changes.some((c) => c.state === "diverged") ? "diverged" : changes.every((c) => c.state === "applied") ? "applied" : changes.every((c) => c.state === "pending") ? "pending" : "partial" };
  }
  function withRun(b, work) {
    if (!writableWorkingRecords) fail("Working records are read-only until explicitly configured.", 403);
    const p = location(b.roots.workflow, "Workflow/_mag-running.md", true);
    let fd, identity;
    try {
      fd = fs.openSync(p, "wx", 384);
      identity = fs.fstatSync(fd);
      fs.writeFileSync(fd, `machine: ${os.hostname()}
since: ${(/* @__PURE__ */ new Date()).toISOString()}
doing: AR Create explicit project action
`);
      fs.fsyncSync(fd);
    } catch (e) {
      if (fd !== void 0) fs.closeSync(fd);
      if (e.code === "EEXIST") fail("Magazine is running or its marker needs explicit recovery.");
      throw e;
    }
    try {
      return work();
    } finally {
      fs.closeSync(fd);
      const now = fs.lstatSync(p, { throwIfNoEntry: false });
      if (now && now.dev === identity.dev && now.ino === identity.ino) fs.unlinkSync(p);
    }
  }
  function correspondenceFile(id){projectFile(id);return ownedFile(id+'.draft-correspondence.json');}
  function changeDestination(b,c){
    if(c.area==='binding-metadata'){
      if(c.relativePath!==b.projectId+'.draft-correspondence.json')fail('Metadata receipt path refused.');
      return correspondenceFile(b.projectId);
    }
    if(c.area!==undefined||!Object.values(b.records).includes(c.relativePath))fail('Receipt contract changed.');
    return location(b.roots.workflow,c.relativePath,true);
  }
  function commit(b, r) {
    const ensureBinding=()=>{
      if(r.expectedBindingHash&&hashAt(projectFile(b.projectId))!==r.expectedBindingHash)fail('Binding changed; explicit inspection required.');
      if(r.expectedWorkflow)for(const [key,expected] of Object.entries(r.expectedWorkflow)){
        const actual=hashAt(location(b.roots.workflow,b.records[key],true)),changed=r.changes.find(c=>c.area===undefined&&c.relativePath===b.records[key]);
        if(actual!==expected&&actual!==changed?.afterHash)fail('Workflow changed; preserve external records and recover explicitly.');
      }
    };
    ensureBinding();
    // Recovery validates ALL destinations before publishing any remaining byte.
    for(const c of r.changes){const actual=hashAt(changeDestination(b,c));if(actual!==c.beforeHash&&actual!==c.afterHash)fail('Working record changed; newer words preserved.');}
    for (const [index,c] of r.changes.entries()) {
      const p=changeDestination(b,c),actual=hashAt(p);
      if(actual===c.afterHash)continue;
      beforeCommit?.(c);
      ensureBinding();if(hashAt(changeDestination(b,c))!==c.beforeHash)fail('Working record changed before commit.');
      atomic(p,c.after,c.beforeHash===null);afterCommit?.(c,index);
    }
    r.state='committed';atomic(operationFile(b.projectId,r.operationId),JSON.stringify(r,null,2));
    return {operationId:r.operationId,state:'committed',hashes:Object.fromEntries(r.changes.map(c=>[c.relativePath,c.afterHash]))};
  }
  function change(input, kind) {
    const isAnswer = kind === 'answer' || kind === 'revise-answer';
    if(kind==='edit' && (typeof input.text!=='string'||Buffer.byteLength(input.text)>1024*1024||!Number.isInteger(input.paragraphIndex))) fail('Supply explicit bounded draft text and paragraph index.',400);
    if(isAnswer && (typeof input.value!=='string'||!input.value.trim()||Buffer.byteLength(input.value)>100000||!Number.isInteger(input.questionIndex))) fail('Supply an explicit bounded answer and question index.',400);
    if(kind==='revise-answer' && (input.humanDecision!==true||typeof input.expectedValue!=='string')) fail('An explicit human correction and the previous answer are required.',403);
    return locked(() => {
      const b = load(input.projectId), op = operationFile(b.projectId, input.operationId), requestHash = digest(stable({ ...input, operationId: void 0 }));
      if (fs.existsSync(op)) {
        const r = inspectOperation(input);
        if (r.requestHash !== requestHash || r.kind !== kind) fail("Operation ID already belongs to another action.");
        if (r.state !== "committed") fail("Interrupted operation needs explicit recovery.");
        return { operationId: r.operationId, state: "committed", replayed: true };
      }
      const readiness = workflowReadiness(b.projectId);
      if (!readiness.ready) fail("Interrupted workflow operation needs explicit recovery before another write.");
      return withRun(b, () => {
        const before = readWorkflow(b.projectId);
        const nativeMetaRaw=kind==='edit'?bytes(correspondenceFile(b.projectId),{optional:true}):null;
        const nativeBefore=nativeMetaRaw?draftSnapshot(before.draft,JSON.parse(workflowText(nativeMetaRaw)),sourceKey(b)):null;
        const bindingHash=hashAt(projectFile(b.projectId));
        if (!same(input.expected, before.hashes)) fail("Working records changed; reload before saving.");
        const needed = isAnswer ? ["ask", ...b.records.map ? ["map"] : []] : ["draft", "edits"];
        if (needed.some((k) => !b.records[k])) fail("Required working records are not bound.", 400);
        if (isAnswer) {
          const q = before.questions[input.questionIndex];
          if (!q || q.key !== input.questionKey || (kind==='answer'?!q.open:q.open||q.value!==input.expectedValue)) fail("Question changed or already answered.");
        }
        const staging = fs.mkdtempSync(ownedFile("stage-"));
        try {
          for (const key of needed) {
            const p = path.join(staging, b.records[key]);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            if (before.hashes[key] !== null) fs.writeFileSync(p, before[key]);
          }
          if (isAnswer) ask.answer(staging, b.records.ask, input.questionIndex, input.value);
          else draft.edit(staging, b.records.draft, input.paragraphIndex, input.seen, input.text);
          if (!same(readWorkflow(b.projectId).hashes, before.hashes)) fail("Working records changed during preparation.");
          const changes = needed.map((key) => {
            const staged = bytes(path.join(staging, b.records[key]), { optional: true });
            if (staged === null) return null;
            const after = staged.toString("utf8");
            return { relativePath: b.records[key], beforeHash: before.hashes[key], after, afterHash: digest(after) };
          }).filter((c) => c && c.beforeHash !== c.afterHash);
          if(nativeBefore){
            const donorBefore=captureDraft(before.draft,sourceKey(b));
            if(donorBefore.blocks.length!==nativeBefore.blocks.length||donorBefore.blocks.some((row,i)=>row.raw!==nativeBefore.blocks[i].raw||row.separator!==nativeBefore.blocks[i].separator))fail('Legacy donor block boundaries differ from native correspondence; use stable-ID native operations.');
            const updated=workflowText(bytes(path.join(staging,b.records.draft))),next=captureDraft(updated,sourceKey(b));
            const delta=next.blocks.length-nativeBefore.blocks.length;
            if(delta!==0&&delta!==-1)fail('Legacy edit topology cannot preserve native IDs; use explicit native operations.');
            next.blocks=next.blocks.map((row,index)=>{const old=nativeBefore.blocks[index+(delta===-1&&index>=input.paragraphIndex?1:0)];return {...row,id:old.id,origin:old.origin};});
            changes.push(metadataChange(b,nativeMetaRaw,next));
          }
          const r = { schema: "ar-create.project-folder-operation.v1", projectId: b.projectId, operationId: input.operationId, requestHash, kind, state: "prepared", changes,...(nativeBefore?{expectedBindingHash:bindingHash,expectedWorkflow:before.hashes}:{}) };
          atomic(op, JSON.stringify(r, null, 2), true);
          return commit(b, r);
        } finally {
          fs.rmSync(staging, { recursive: true, force: true });
        }
      });
    });
  }
  function sourceKey(b){if(b.draftSourceKey!==undefined){if(typeof b.draftSourceKey!=='string'||! /^[a-f0-9]{64}$/.test(b.draftSourceKey))fail('Recovered draft source identity is invalid.');return b.draftSourceKey;}return digest(stable({projectId:b.projectId,workflow:b.roots.workflow,draft:b.records.draft}));}
  function draftStatus(b){
    if(b.draftAuthority!=='owned-working-copy'||!b.records.draft||!b.records.edits)fail('Native draft operations require explicitly bound owned-working-copy DEV and EDITS.',403);
    const workflow=readWorkflow(b.projectId),raw=bytes(correspondenceFile(b.projectId),{optional:true});
    return {workflow,metadataRaw:raw,expected:{workflow:workflow.hashes,bindingHash:hashAt(projectFile(b.projectId)),correspondenceHash:raw===null?null:digest(raw)}};
  }
  function readDraftStatus(projectId){return locked(()=>{const b=load(projectId),s=draftStatus(b);return {projectId,expected:s.expected,readiness:workflowReadiness(projectId),initialized:s.metadataRaw!==null};});}
  function readDraftProjection(projectId){return locked(()=>{
    const b=load(projectId);if(!workflowReadiness(projectId).ready)fail('Pending operation requires recovery before reading native projection.');
    const s=draftStatus(b);if(s.metadataRaw===null)fail('Prepare trusted draft correspondence first.');
    const model=draftSnapshot(s.workflow.draft,JSON.parse(workflowText(s.metadataRaw)),sourceKey(b));
    return {projectId,expected:s.expected,projection:projectDraft(model)};
  });}
  function metadataChange(b,before,snapshot){const after=JSON.stringify(draftMetadata(snapshot),null,2);return {area:'binding-metadata',relativePath:b.projectId+'.draft-correspondence.json',beforeHash:before===null?null:digest(before),after,afterHash:digest(after)};}
  function nativeRequest(input,kind,internal={}){
    const fields=['projectId','operationId','expected',...(kind==='draft-operations'?['operations']:kind==='draft-undo'?['undoOperationId']:kind==='draft-restore'?['restoreOperationId','restorePosition']:kind==='draft-rebind'?['humanDecision']:[])];
    if(!input||typeof input!=='object'||Object.keys(input).some(k=>!fields.includes(k))||fields.some(k=>!Object.hasOwn(input,k)))fail('Malformed native draft request; caller snapshots are refused.',400);
    if(kind==='draft-rebind'&&input.humanDecision!==true)fail('Explicit human rebind decision required.',403);
    if(kind==='draft-undo'&&!UUID.test(input.undoOperationId||''))fail('Owned operation UUID required for Undo.',400);
    if(kind==='draft-restore'&&(!UUID.test(input.restoreOperationId||'')||!['before','after'].includes(input.restorePosition)))fail('Exact owned history version required.',400);
    return locked(()=>{
      const b=load(input.projectId),op=operationFile(b.projectId,input.operationId),requestHash=digest(stable({...input,operationId:undefined}));
      if(fs.existsSync(op)){const r=inspectOperation(input);if(r.requestHash!==requestHash||r.kind!==kind)fail('Operation ID already belongs to another action.');if(r.state!=='committed')fail('Interrupted operation needs explicit recovery.');return {operationId:r.operationId,state:'committed',replayed:true};}
      if(!workflowReadiness(b.projectId).ready)fail('Interrupted workflow operation needs explicit recovery before another write.');
      return withRun(b,()=>{
        const s=draftStatus(b);if(!same(input.expected,s.expected))fail('Workflow, binding or correspondence changed; preserve pending native edits.');
        if(Buffer.byteLength(s.workflow.draft)>1024*1024)fail('Bound DEV exceeds native correspondence limit.',413);
        let result,model,affectedIds=[];
        if(kind==='draft-prepare'||kind==='draft-rebind'){
          if(kind==='draft-prepare'&&s.metadataRaw!==null)fail('Already prepared; explicit rebind required.');
          result={raw:s.workflow.draft,snapshot:captureDraft(s.workflow.draft,sourceKey(b))};
        }else{
          if(s.metadataRaw===null)fail('Prepare trusted correspondence first.');
          model=draftSnapshot(s.workflow.draft,JSON.parse(workflowText(s.metadataRaw)),sourceKey(b));
          if(kind==='draft-operations')result=applyDraft(model,s.workflow.draft,input.operations,internal.reviewedLanguageDerivative?{reviewedLanguageDerivative:internal.reviewedLanguageDerivative}:internal.structureTestStandIn===true?{structureTestStandIn:true}:undefined);
          else if(kind==='draft-restore'){
            const prior=inspectOperation({projectId:b.projectId,operationId:input.restoreOperationId});
            if(prior.state!=='committed')fail('Only committed owned history can be restored.');
            const {raw,model:target}=historicalVersion({receipt:prior,projectId:b.projectId,draftRelative:b.records.draft,sourceKey:model.sourceKey,position:input.restorePosition});
            result={raw,snapshot:structuredClone(target),inverse:{schema:'mag-dev-inverse.v1',before:structuredClone(model),afterHash:target.fileHash,afterSnapshotHash:digest(JSON.stringify(target))}};
          }else {const prior=inspectOperation({projectId:b.projectId,operationId:input.undoOperationId});if(prior.state!=='committed'||!prior.correspondenceInverse)fail('Undo requires a committed owned native operation receipt.');historicalVersion({receipt:prior,projectId:b.projectId,draftRelative:b.records.draft,sourceKey:model.sourceKey,position:'before'});result=undoDraft(model,s.workflow.draft,prior.correspondenceInverse);affectedIds=prior.correspondenceAffectedIds||[];}
        }
        if(model&&!result.inverse&&(result.raw!==s.workflow.draft||!same(result.snapshot,model)))result.inverse={schema:'mag-dev-inverse.v1',before:structuredClone(model),afterHash:result.snapshot.fileHash,afterSnapshotHash:digest(JSON.stringify(result.snapshot))};
        const changes=[];
        if(result.raw!==s.workflow.draft){
          changes.push({relativePath:b.records.draft,beforeHash:s.workflow.hashes.draft,after:result.raw,afterHash:digest(result.raw)});
          const changed=new Set(affectedIds);
          for(const row of model.blocks){const after=result.snapshot.blocks.find(p=>p.id===row.id);if(!after||after.raw!==row.raw)changed.add(row.id);}
          for(const row of result.snapshot.blocks)if(!model.blocks.some(p=>p.id===row.id))changed.add(row.id);
          if(kind==='draft-operations')for(const op of input.operations){if(op.kind==='move')changed.add(op.id);}
          affectedIds=[...changed];
          const today=new Date().toISOString().slice(0,10),oneLine=t=>draft.plain(t.trim()).replace(/\r?\n/g,' ');
          const entries=affectedIds.map(id=>{
            const before=model.blocks.find(p=>p.id===id),next=result.snapshot.blocks.find(p=>p.id===id);
            return `- passage: ${id}\n- before: ${before?oneLine(before.raw):'(new)'}\n- after: ${next?oneLine(next.raw):'(removed)'}\n`;
          }).join('');
          const actions=kind==='draft-restore'?'restore '+input.restoreOperationId+' '+input.restorePosition:kind==='draft-undo'?'undo '+input.undoOperationId:input.operations.map(op=>op.kind+':'+(op.id||[op.leftId,op.rightId].join(','))).join(' ');
          const reworkRows=(result.reworks||[]).map(words=>'- rework: '+words+'\n').join('');
          const after=(s.workflow.edits||draft.editLogHeader(path.basename(b.records.draft)))+`\n## ${today}\n${entries}${reworkRows}- action: ${kind} ${input.operationId} ${actions}\n`;
          changes.push({relativePath:b.records.edits,beforeHash:s.workflow.hashes.edits,after,afterHash:digest(after)});
        }
        const mc=metadataChange(b,s.metadataRaw,result.snapshot);if(mc.beforeHash!==mc.afterHash)changes.push(mc);
        if(!same(draftStatus(b).expected,s.expected))fail('Bound records changed during native preparation.');
        const r={schema:'ar-create.project-folder-operation.v1',projectId:b.projectId,operationId:input.operationId,requestHash,kind,state:'prepared',expectedBindingHash:s.expected.bindingHash,expectedWorkflow:s.expected.workflow,changes,...(result.inverse?{correspondenceInverse:result.inverse}:{}),correspondenceAffectedIds:affectedIds,correspondenceLedger:result.ledger||[{kind,ownedUndoOperationId:input.undoOperationId||null}]};
        // Authorize dependencies once, immediately before durable intent. Recovery
        // must complete this exact authorized receipt without a new context read.
        if(internal.beforeIntent!==undefined){if(typeof internal.beforeIntent!=='function')fail('Native before-intent guard must be an internal synchronous function.');const checked=internal.beforeIntent();if(checked&&typeof checked.then==='function')fail('Native before-intent guard must be synchronous.');}
        atomic(op,JSON.stringify(r,null,2),true);return commit(b,r);
      });
    });
  }
  function recoverOperation(input) {
    return locked(() => {
      const b = load(input.projectId);
      return withRun(b, () => {
        const r = inspectOperation(input);
        if (r.state === "diverged") fail("Working record changed after interruption; newer words preserved.");
        return commit(b, r);
      });
    });
  }
  // This is an inspection, not a launch lock. A command launcher must inspect
  // again while holding the same exclusive Magazine run marker.
  function workflowReadiness(projectId) {
    load(projectId);
    const prefix = projectId + "-", suffix = ".operation.json";
    const unresolved = [];
    for (const name of fs.readdirSync(area)) {
      if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
      const operationId = name.slice(prefix.length, -suffix.length);
      let receipt;
      try {
        receipt = inspectOperation({ projectId, operationId });
        if (receipt.schema !== "ar-create.project-folder-operation.v1" || !["prepared", "committed"].includes(JSON.parse(bytes(ownedFile(name)).toString()).state)) throw new Error("Invalid operation receipt.");
      } catch {
        unresolved.push({ operationId, state: "unreadable", recoveryRequired: true });
        continue;
      }
      if (receipt.state !== "committed") unresolved.push({ operationId, state: receipt.state, recoveryRequired: true });
    }
    return { projectId, ready: unresolved.length === 0, unresolved };
  }
  return { bind,readDraftStatus,readDraftProjection,prepareDraftCorrespondence:input=>nativeRequest(input,'draft-prepare'),rebindDraftCorrespondence:input=>nativeRequest(input,'draft-rebind'),applyDraftOperations:(input,internal)=>nativeRequest(input,'draft-operations',internal),undoDraftOperation:input=>nativeRequest(input,'draft-undo'),restoreDraftVersion:input=>nativeRequest(input,'draft-restore'), readBinding: (id) => structuredClone(load(id)), scan, add, reconnect, readWorkflow, workflowReadiness, answerQuestion: (input) => change(input, "answer"), reviseAnswer: (input) => change(input, "revise-answer"), editDraft: (input) => change(input, "edit"), inspectOperation, recoverOperation };
}
export {
  createBoundProjectFolders,
  digest
};
