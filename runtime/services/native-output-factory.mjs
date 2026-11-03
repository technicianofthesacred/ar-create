import fs from "node:fs";
import path from "node:path";
import { digest, regular, resolveInside } from "./files.mjs";
import { PHOTO_LIMIT } from "./study-photos.mjs";
import { createNativeOutputOwner } from "./native-output-owner.mjs";
import { createAssetPassCache } from "./native-output-asset-pass.mjs";
import { mapper, helpers } from "./native-output-helpers.mjs";
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i, HASH = /^[a-f0-9]{64}$/;
const ROLE = "human-authored-editorial-direction-not-evidence-or-source-quotation";
const stable = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x), same = (a, b) => stable(a) === stable(b);
const fail = (message) => {
  throw Object.assign(Error(message), { status: 409, outcome: "not-applied" });
};
const identity = (b) => ({ originalId: b.originalId, originalHash: b.originalHash, parentStudyKey: b.parentStudyKey, partKey: b.partKey });
// Output leases only inspect committed direction journals. Never recover or reenter
// the asynchronous direction/native owners while these leases are held.
const directionMetadata = (snapshot) => {
  const { body, history, path: unusedPath, externalEdit, metadataHash, ...metadata } = snapshot;
  return JSON.stringify(metadata, null, 2) + "\n";
};
function directionJournalValid(op, scope, operations) {
  const snapshot = (s) => s?.schema === "ar-create.study-human-direction.v1" && s.role === ROLE && same(s.scope, scope) && Number.isSafeInteger(s.revision) && s.revision >= 0 && typeof s.body === "string" && s.hash === digest(s.body);
  const locator = (a) => a && HASH.test(a.hash || "") && (a.kind === "field" ? ["body", "adoptedDirection", "authorThoughts", "aiInterpretation", "suggestions"].includes(a.name) : a.kind === "range" && Number.isSafeInteger(a.start) && Number.isSafeInteger(a.end) && a.start >= 0 && a.end > a.start);
  const pin = (p) => p && Number.isSafeInteger(p.revision) && p.revision >= 0 && HASH.test(p.hash || "") && locator(p.locator) && ["project", "part", "output", "collection"].includes(p.scope?.kind) && p.selector?.scope === p.scope.kind && (p.scope.kind === "collection" ? UUID.test(p.scope.collectionId || "") && p.selector.collectionId === p.scope.collectionId : UUID.test(p.scope.projectId || "") && typeof p.scope.parentStudyId === "string" && p.selector.parentStudyId === p.scope.parentStudyId && (p.scope.kind !== "output" || UUID.test(p.scope.outputId || "") && p.selector.outputId === p.scope.outputId));
  const rows = (s) => {
    const list = s.scopeReferences ?? [];
    return Array.isArray(list) && list.length <= 128 && new Set(list.map(r => r?.id)).size === list.length && list.every(r => r?.schema === "ar-create.direction-scope-reference.v1" && UUID.test(r.id || "") && ["linked-learning", "inherit-direction", "supersedes"].includes(r.kind) && ["proposed", "accepted", "detached"].includes(r.status) && pin(r.origin) && same(r.target?.scope, scope) && r.target?.selector?.scope === scope.kind && HASH.test(r.target?.hash || "") && Number.isSafeInteger(r.target?.revisionAtPin) && r.target.revisionAtPin >= 0 && ["agent", "human"].includes(r.proposedBy) && ["agent", "human"].includes(r.stateActor) && (r.status !== "accepted" || r.stateActor === "human") && r.createdOperationId === r.id && UUID.test(r.lastOperationId || "") && typeof r.reason === "string" && r.reason.trim().length > 0 && r.reason.length <= 256 && (r.associationReferenceId == null || UUID.test(r.associationReferenceId)) && (r.kind !== "supersedes" || UUID.test(r.supersedesId || "") && locator(r.replacement)));
  };
  if (!op || op.schema !== "ar-create.study-human-direction-operation.v1" || !same(op.scope, scope) || !["committed", "rejected"].includes(op.status) || !UUID.test(op.operationId || "") || !["write", "undo", "reference-propose", "reference-change", "reference-undo"].includes(op.kind) || op.before?.hash !== digest(op.before?.body || "") || op.after?.hash !== digest(op.after?.body || "")) return false;
  if (op.afterMetadataHash !== undefined && (!HASH.test(op.afterMetadataHash || "") || op.beforeMetadataHash !== null && !HASH.test(op.beforeMetadataHash || "") || op.afterMetadataHash !== digest(directionMetadata(op.after)))) return false;
  if (!op.kind.startsWith("reference-")) return true; // Legacy body journals retain their existing proof contract.
  if (!snapshot(op.before) || !snapshot(op.after) || !rows(op.before) || !rows(op.after) || !HASH.test(op.beforeMetadataHash || "") || !HASH.test(op.afterMetadataHash || "") || !HASH.test(op.fingerprint || "") || !UUID.test(op.referenceId || "") || op.before.body !== op.after.body || op.before.hash !== op.after.hash || op.after.revision !== op.before.revision + 1 || op.after.operationId !== op.operationId || op.createdAt !== op.after.updatedAt) return false;
  const unchangedMetadata = s => { const { scopeReferences, revision, updatedAt, operationId, body, history, path: unusedPath, externalEdit, metadataHash, ...rest } = s; return rest; };
  if (!same(unchangedMetadata(op.before), unchangedMetadata(op.after))) return false;
  const before = op.before.scopeReferences ?? [], after = op.after.scopeReferences ?? [];
  if (op.kind === "reference-propose") {
    const added = after.at(-1);
    return after.length === before.length + 1 && same(after.slice(0, -1), before) && added.id === op.operationId && added.id === op.referenceId && added.lastOperationId === op.operationId && added.status === "proposed" && added.stateActor === added.proposedBy && added.target.hash === op.before.hash && added.target.revisionAtPin === op.before.revision;
  }
  if (op.kind === "reference-change") {
    const index = before.findIndex(r => r.id === op.referenceId);
    if (index < 0 || before.length !== after.length || after[index]?.id !== op.referenceId) return false;
    const stableReference = r => { const { status, reason, stateActor, lastOperationId, ...rest } = r; return rest; };
    return after.every((r, i) => i === index ? same(stableReference(r), stableReference(before[i])) && r.stateActor === "human" && r.lastOperationId === op.operationId : same(r, before[i]));
  }
  const undone = operations.get(op.undoOperationId);
  return UUID.test(op.undoOperationId || "") && undone?.status === "committed" && undone.kind.startsWith("reference-") && undone.referenceId === op.referenceId && undone.afterMetadataHash === op.beforeMetadataHash && undone.after.revision === op.before.revision && same(undone.scope, scope) && same(after, undone.before.scopeReferences ?? []);
}
function createNativeOutputFactory({ dataDir, store, native, originals, library, ownedPhotos, retainedSource, browserOrigins = [], validateStandInReview }) {
  if (!ownedPhotos?.resolve || !native?.read || !originals?.readDraft || !library?.snapshot) throw Error("Supply the existing exact owners.");
  const scopes = /* @__PURE__ */ new Map();
  function read(relative) {
    let file;
    try {
      file = resolveInside(dataDir, relative, { missing: true });
    } catch (error) {
      if (error.status === 404 || error.code === "ENOENT") return null;
      throw error;
    }
    if (!fs.existsSync(file)) return null;
    regular(file);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  function registry(key) {
    const b = read("study-project-bindings/" + digest(key) + ".json");
    if (!b || b.schema !== "ar-create.study-binding.v1" || b.projectKey !== key || b.status !== "ready" || !UUID.test(b.projectId || "") || !UUID.test(b.documentId || "")) fail("Exact ready persisted study binding required; select through its existing owner first.");
    return b;
  }
  function mapping(rootBindingId, parentStudyId) {
    const m = read("study-owned-photo-bindings/" + rootBindingId + ".json");
    if (!m || m.schema !== "ar-create.study-owned-photo-binding.v1" || m.status !== "ready" || m.bindingId !== rootBindingId || m.ownedDraftId !== rootBindingId || m.parentStudyId !== parentStudyId || m.key !== "owned-draft:" + rootBindingId) fail("Exact ready root photo/document binding required; no physical document is guessed or created.");
    return m;
  }
  function validateScope(s) {
    const m = mapping(s.rootBindingId, s.parentStudyId), part = registry(m.key), parent = registry(s.parentStudyId);
    if (!same(m, s.mapping) || part.projectId !== s.projectId || part.documentId !== s.documentId || parent.projectId !== s.parent.projectId || parent.documentId !== s.parent.documentId) fail("Persisted native/output/parent scope changed; preserve existing outputs.");
    return { m, part, parent };
  }
  const scope = { async resolve(input) {
    if (!input || !UUID.test(input.rootBindingId || "") || typeof input.parentStudyId !== "string" || !input.parentStudyId || Object.keys(input).some((k) => !["rootBindingId", "parentStudyId"].includes(k))) fail("Exact native root and parent identities required.");
    const cached = scopes.get(stable(input));
    if (cached) {
      validateScope(cached);
      return { projectId: cached.projectId, documentId: cached.documentId };
    }
    const root = await native.read({ bindingId: input.rootBindingId, parentStudyId: input.parentStudyId });
    if (root.binding.authority !== "owned-working-copy" || root.binding.status !== "ready" || root.readiness?.ready !== true || root.binding.parentStudyKey !== input.parentStudyId) fail("Ready owned root of this exact parent required.");
    const m = mapping(input.rootBindingId, input.parentStudyId);
    if (!same(m.ownedIdentity, identity(root.binding))) fail("Owned photo and native provenance disagree.");
    const verified = await ownedPhotos.resolve(m.projectId);
    if (verified.bindingId !== input.rootBindingId || verified.parentStudyId !== input.parentStudyId || verified.projectId !== m.projectId || verified.documentId !== m.documentId) fail("Exact owned physical output scope changed.");
    const parent = registry(input.parentStudyId), s = { ...input, projectId: m.projectId, documentId: m.documentId, parent, mapping: m, originalId: root.binding.originalId, partKey: root.binding.partKey, capturedRoot:["authored-collection","structure-test"].includes(root.binding.origin), capturedOriginal:["authored-collection","structure-test"].includes(root.binding.origin)?{parentStudyKey:root.binding.parentStudyKey,partKey:root.binding.partKey,records:root.context.records.filter(r=>!r.missing).map(r=>({...r,path:r.sourcePath,hash:r.copiedHash??r.hash})),missing:root.context.records.filter(r=>r.missing).map(r=>({role:r.role,path:r.sourcePath}))}:null, sourceIdentities: root.context.records.filter((r) => r.role !== "draft").map((r) => ({ id: r.id, role: r.role, sourcePath: r.sourcePath })) };
    validateScope(s);
    const original = s.capturedRoot ? s.capturedOriginal : originals.readDraft(s.originalId);
    if (original.parentStudyKey !== s.parentStudyId || original.partKey !== s.partKey) fail("Original source belongs to another parent/part; inheritance held.");
    scopes.set(stable(input), s);
    return { projectId: s.projectId, documentId: s.documentId };
  } };
  function human(scope2, output = false) {
    const prefix = "workspaces/" + scope2.projectId + (output ? "/human-direction-outputs/" + digest(scope2.outputId) : ""), meta = read(prefix + "/HUMAN-DIRECTION.json");
    const directory = path.join(dataDir, prefix);
    if (!fs.existsSync(directory)) return null;
    const bodyPath = resolveInside(dataDir, prefix + "/HUMAN-DIRECTION.md", { missing: true });
    const body = fs.existsSync(bodyPath) ? (regular(bodyPath), fs.readFileSync(bodyPath, "utf8")) : null;
    if (!meta) {
      if (body !== null) fail("Human direction has no owned revision metadata; inheritance held.");
      return null;
    }
    if (meta.schema !== "ar-create.study-human-direction.v1" || meta.role !== ROLE || !same(meta.scope, scope2) || !Number.isSafeInteger(meta.revision) || meta.revision < 0 || !HASH.test(meta.hash || "") || body === null || digest(body) !== meta.hash) fail("Human direction changed outside its canonical owner; recover there before output use.");
    const journal = path.join(directory, "human-direction-history");
    if (fs.existsSync(journal)) {
      resolveInside(dataDir, prefix + "/human-direction-history", { directory: true });
      const operations = new Map();
      for (const name of fs.readdirSync(journal)) {
        if (!UUID.test(name.slice(0, -5)) || !name.endsWith(".json")) continue;
        const op = read(prefix + "/human-direction-history/" + name);
        if (op?.operationId !== name.slice(0, -5)) fail("Human direction recovery journal identity is corrupt.");
        operations.set(op.operationId, op);
      }
      for (const op of operations.values()) if (!directionJournalValid(op, scope2, operations)) fail("Human direction recovery is pending or corrupt; use its existing owner outside output leases.");
      const latest = operations.get(meta.operationId);
      if (latest?.kind.startsWith("reference-") && (latest.status !== "committed" || latest.afterMetadataHash !== digest(directionMetadata(meta)))) fail("Human direction reference metadata is outside its exact committed journal; recover there before output use.");
    }
    return { role: ROLE, scope: scope2, revision: meta.revision, hash: meta.hash };
  }
  function decisionProof(s, outputId) {
    const parent = { kind: "project", parentStudyId: s.parentStudyId, parentProjectId: s.parent.projectId, parentDocumentId: s.parent.documentId, projectId: s.parent.projectId, documentId: s.parent.documentId }, part = { ...parent, kind: "part", projectId: s.projectId, documentId: s.documentId, bindingId: s.rootBindingId }, output = { ...part, kind: "output", outputId };
    return digest(stable([human(parent), human(part), human(output, true)].filter(Boolean)));
  }
  function eligibleImage(s) {
    if (s.rootId !== "library" || s.writable !== true || s.sourceUnavailable || s.missing || !/\.(jpe?g|png|webp)$/i.test(s.rel_path || "")) return false;
    const stat = regular(s.path);
    if (!stat.size || stat.size > PHOTO_LIMIT) return false;
    const fd = fs.openSync(s.path, "r"), bytes = Buffer.alloc(Math.min(24, stat.size));
    try {
      fs.readSync(fd, bytes, 0, bytes.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    const ext = path.extname(s.rel_path).toLowerCase();
    return [".jpg", ".jpeg"].includes(ext) && bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 || ext === ".png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR" || ext === ".webp" && bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  // One overview pass asks for the proof of every output; the Library image list does not depend on
  // the output, so it is hashed once per short window (and re-hashed at once if the index changes).
  const assetPass = createAssetPassCache();
  function libraryAssets(index) {
    return assetPass.get(JSON.stringify(index ?? null), async () => {
      const assets = [];
      if (index) {
        if (!Array.isArray(index.sources) || new Set(index.sources.map((r) => r.id)).size !== index.sources.length) fail("Existing Library source identities are corrupt.");
        for (const record of index.sources) {
          if (record.rootId !== "library" || record.missing || !/\.(jpe?g|png|webp)$/i.test(record.rel_path || "")) continue;
          try {
            const current = await library.snapshot(record.id);
            if (current.id !== record.id || current.rel_path !== record.rel_path || !HASH.test(current.hash || "") || !eligibleImage(current)) continue;
            assets.push({ id: current.id, hash: current.hash });
          } catch (error) {
            if (error.status === 403 || error.status === 404 || error.code === "ENOENT") continue;
            throw error;
          }
        }
      }
      return assets;
    });
  }
  const proof = { async read(input) {
    const key = stable({ rootBindingId: input.rootBindingId, parentStudyId: input.parentStudyId }), s = scopes.get(key);
    if (!s || !UUID.test(input.outputId || "")) fail("Resolve this exact trusted root scope before proof reads.");
    validateScope(s);
    const original = s.capturedRoot ? s.capturedOriginal : originals.readDraft(s.originalId);
    if (original.parentStudyKey !== s.parentStudyId || original.partKey !== s.partKey) fail("Unsupported original source/part inheritance.");
    const sources = [];
    for (const r of original.records.filter((r2) => r2.role !== "draft")) {
      if (!r.id || !r.path || !HASH.test(r.hash || "") || typeof r.raw !== "string" || digest(r.raw) !== r.hash) fail("Exact original source hash/bytes required.");
      sources.push({ id: r.id, role: r.role, sourcePath: r.path, hash: r.hash, missing: false });
    }
    for (const wanted of s.sourceIdentities) if (!sources.some((r) => r.id === wanted.id && r.role === wanted.role && r.sourcePath === wanted.sourcePath)) {
      if (!(original.missing || []).some((m) => m.role === wanted.role && m.path === wanted.sourcePath)) fail("Captured source is not owned by this original part; unsupported inheritance held.");
      sources.push({ ...wanted, hash: null, missing: true });
    }
    const index = read("library-index.json");
    const assets = await libraryAssets(index);
    return { sources: sources.sort((a, b) => a.id.localeCompare(b.id)), photos: [], assets: assets.sort((a, b) => a.id.localeCompare(b.id)), decisionsHash: decisionProof(s, input.outputId) };
  } };
  return { owner: createNativeOutputOwner({ dataDir, store, native, mapper, helpers, scope, proof, retainedSource, browserOrigins, validateStandInReview }), scope, proof };
}
export {
  createNativeOutputFactory
};
