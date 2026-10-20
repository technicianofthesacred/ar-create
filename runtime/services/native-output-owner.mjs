import fs from "node:fs";
import {validateCarouselTypography} from "../src/workspaces/carousel-typography.mjs";
import path from "node:path";
import { createHash } from "node:crypto";
import { outputRecordsExpected, outputPrivatePrefix } from "../output-records.mjs";
const stable = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
const hash = (v) => createHash("sha256").update(typeof v === "string" ? v : stable(v)).digest("hex");
const same = (a, b) => stable(a) === stable(b), clone = (v) => structuredClone(v), uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail = (message) => {
  throw Object.assign(Error(message), { status: 409, outcome: "not-applied" });
};
function derivedId(op) {
  const h = hash("native-output-registration:" + op);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const textKind = kind => ["article", "post", "product-listing"].includes(kind);
const shortKind = kind => ["post", "product-listing"].includes(kind);
const arrangement = (o) => textKind(o.kind) ? { placements: o.placements || [], articleComposition: o.articleComposition, name: o.name } : { slides: (o.slides || []).map(({ text, credit, label, role, ...slide }) => slide), name: o.name };
const words = (o) => textKind(o.kind) ? { title: o.title, manuscript: o.manuscript } : { slides: (o.slides || []).map(({ id, role, text, credit, label }) => ({ id, role, text, credit, label: label ?? "" })), caption: o.caption ?? "" };
const resetVisual = (o) => {
  delete o.articleVisualMake;
  delete o.articleVisualHistory;
  delete o.visualMake;
  delete o.visualHistory;
};
function createNativeOutputOwner({ dataDir, store, native, mapper, helpers, scope, proof }) {
  if (!scope?.resolve || !proof?.read || !native?.withSnapshotLease || !store?.saveOutputRecords) throw Error("Exact trusted owners are required.");
  async function target(input) {
    if (!input || !uuid.test(input.rootBindingId || "") || typeof input.parentStudyId !== "string" || !input.parentStudyId) fail("Exact native root and parent are required.");
    const ids = await scope.resolve({ rootBindingId: input.rootBindingId, parentStudyId: input.parentStudyId });
    if (!ids?.projectId || !ids.documentId) fail("Unknown trusted output scope.");
    const read2 = await store.readArticle({ projectId: ids.projectId });
    if (read2.document.id !== ids.documentId) fail("Trusted physical document changed.");
    return { ...ids, document: read2.document };
  }
  const group = (i) => ({ rootBindingId: i.rootBindingId, parentStudyId: i.parentStudyId });
  function privatePath(t, kind, id) {
    if (!(kind === "captures" ? /^[a-f0-9]{64}$/ : uuid).test(id || "")) fail("Exact private evidence identity required.");
    return outputPrivatePrefix(t.projectId, t.documentId) + kind + "/" + id + ".json";
  }
  function privateRead(t, kind, id) {
    const relative = privatePath(t, kind, id), file = path.join(dataDir, relative);
    let cursor = dataDir;
    for (const segment of relative.split("/")) {
      cursor = path.join(cursor, segment);
      if (!fs.existsSync(cursor)) return null;
      const s = fs.lstatSync(cursor);
      if (s.isSymbolicLink() || s.isFile() && s.nlink !== 1) fail("Private output evidence must remain ordinary owned files.");
    }
    const bytes = fs.readFileSync(file, "utf8");
    if (kind === "captures" && hash(bytes) !== id) fail("Immutable private capture/source proof integrity changed.");
    return { value: JSON.parse(bytes), hash: hash(bytes) };
  }
  function record(t, id) {
    const r = t.document.nativeOutputIndex?.records.find((r2) => r2.outputId === id), o = t.document.outputs.find((o2) => o2.id === id);
    if (!r || !o) fail("Output does not belong to this exact document.");
    const p = privateRead(t, "captures", r.captureId)?.value;
    if (!p || !same(p.group, group(t.input))) fail("Output belongs to another native scope.");
    if (p.capture.scope.projectId !== t.projectId || p.capture.scope.documentId !== t.documentId || p.capture.scope.outputId !== id || textKind(o.kind) && (r.wordOwner.bindingId !== p.capture.nativeProof.bindingId || r.wordOwner.parentStudyId !== t.input.parentStudyId)) fail("Exact captured output ownership changed.");
    return { record: r, output: o, private: p };
  }
  async function proofCatalogue(i, outputId) {
    const p = await proof.read({ ...group(i), outputId });
    if (!Array.isArray(p?.sources) || !Array.isArray(p.assets || []) || !Array.isArray(p.photos || []) || !/^[a-f0-9]{64}$/.test(p.decisionsHash || "")) fail("Authoritative source/decision/photo catalogue required.");
    return clone(p);
  }
  function scopedProof(p, captureValue, output, { captureMappings = false } = {}) {
    const wanted = captureValue.nativeProof.sourceProof;
    const sources = wanted.map((w) => {
      const matches = p.sources.filter((s2) => s2.id === w.id);
      if (matches.length > 1) fail("Ambiguous exact source identity.");
      const s = matches[0];
      if (!s) return { ...w, hash: null, missing: true };
      if (s.role === "draft" || s.role !== w.role || s.sourcePath !== w.sourcePath || !s.missing && !/^[a-f0-9]{64}$/.test(s.hash || "")) fail("Exact retained source authority changed.");
      return { id: s.id, role: s.role, sourcePath: s.sourcePath, hash: s.hash ?? null, missing: !!s.missing };
    });
    const names = new Set(captureValue.privateSidecar.photoRequests.map((p2) => p2.nativeFile));
    const photos = (captureMappings ? p.photos || [] : captureValue.nativeProof.photoProof).filter((x) => names.has(x.nativeFile)).map((x) => ({ nativeFile: x.nativeFile, sourceId: x.sourceId, sourceHash: x.sourceHash })).sort((a, b) => a.nativeFile.localeCompare(b.nativeFile));
    const urls = [...(output?.placements || []).map((x) => x.url), ...(output?.slides || []).flatMap((s) => (s.photos || []).map((x) => x.src))].filter(Boolean);
    const ids = [...new Set(urls.map((url) => {
      const m = /^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(url);
      if (!m) fail("Only exact owned Library photograph URLs may be used.");
      return decodeURIComponent(m[1]);
    }))].sort();
    const assets = ids.map((id) => {
      const matches = (p.assets || []).filter((a2) => a2.id === id);
      if (matches.length > 1) fail("Ambiguous used photo identity.");
      const a = matches[0];
      return { id, hash: a?.hash ?? null, missing: !a || !!a.missing };
    });
    return { sources, photos, assets, decisionsHash: p.decisionsHash };
  }
  async function currentProof(i, outputId, captureValue, output) {
    return scopedProof(await proofCatalogue(i, outputId), captureValue, output);
  }
  function placements(output, p) {
    if (output.kind === "article" && !output.articleComposition) fail("Exact article layout required; no flat prose fallback.");
    const ids = new Set(output.manuscript?.map((x) => x.id)), slots = /* @__PURE__ */ new Set();
    for (const row of output.placements || []) {
      if (!row || typeof row.slot !== "string" || !row.slot || slots.has(row.slot)) fail("Unique exact output photo slots required.");
      slots.add(row.slot);
      if (row.paragraphId && !ids.has(row.paragraphId)) fail("Photo anchor belongs to another wording owner.");
      if (row.url) {
        const match = /^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(row.url);
        if (!match) fail("Photographs must use exact owned Library source IDs.");
        const id = decodeURIComponent(match[1]);
        if (!(p.assets || []).some((x) => x.id === id && !x.missing && /^[a-f0-9]{64}$/.test(x.hash || ""))) fail("Exact current Library photo proof required.");
      }
      for (const field of ["x", "y"]) if (row[field] !== void 0 && (!Number.isFinite(row[field]) || row[field] < 0 || row[field] > 1)) fail("Invalid article crop.");
      if (row.zoom !== void 0 && (!Number.isFinite(row.zoom) || row.zoom <= 0)) fail("Invalid article zoom.");
    }
    if (output.articleComposition) {
      const issue = helpers.articleCompositionIssue(output.articleComposition, output.manuscript, output.placements);
      if (issue) fail(issue);
    }
    for (const slide of output.slides || []) for (const photo of slide.photos || []) {
      const m = /^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(photo.src || "");
      if (!m || !p.assets.some((x) => x.id === decodeURIComponent(m[1]) && !x.missing && /^[a-f0-9]{64}$/.test(x.hash || ""))) fail("Exact current carousel photo proof required.");
    }
  }
  function validateCapture(p, o) {
    const c = mapper.reopen(JSON.stringify(p.capture));
    if (!c.ready || c.scope.outputId !== o.id) fail("Exact ready captured output identity required.");
    if (textKind(o.kind) && (o.kind!==c.output.kind||!same(words(o), words(c.output)))) fail("Article words changed outside its canonical native owner; refresh explicitly.");
    return c;
  }
  async function freshness(i, t, selected) {
    const p = await currentProof(i, selected.output.id, selected.private.capture, selected.output);
    const sourceStale=!same(p,selected.private.proof);
    let reason=sourceStale?"Shared source, decision or photo proof changed.":null,writingProof,writingStale=false;
    if(textKind(selected.output.kind)){
      const c=validateCapture(selected.private,selected.output),s=await native.read({bindingId:selected.record.wordOwner.bindingId,parentStudyId:i.parentStudyId});
      writingProof={kind:'native',bindingId:s.binding.id,parentStudyId:s.binding.parentStudyId,expected:clone(s.expected),rawHash:hash(s.raw),capturedRawHash:c.nativeProof.rawHash};
      writingStale=writingProof.rawHash!==writingProof.capturedRawHash||!same(s.expected,c.nativeProof.expected);
      if(mapper.freshness(c,s,p.sources,p.photos).stale)reason="This output native wording or exact source proof changed.";
    }else{
      const w=await store.readCarouselWords({projectId:t.projectId,documentId:t.documentId,outputId:selected.output.id,allowEditedMarkdown:true});
      writingProof={kind:'carousel-words',projectId:t.projectId,documentId:t.documentId,outputId:selected.output.id,expected:clone(w.expected),wordsHash:await helpers.carouselWordsHash(w.output)};
      writingStale=!!w.externalEdit||!!w.missing;
      if(writingStale)reason='This carousel canonical words file changed outside its saved output.';
    }
    return {writingProof,freshness:{stale:sourceStale||writingStale,reason,writingStale,sourceStale}};
  }
  async function read(input) {
    const t = await target(input);
    t.input = input;
    const selected = input.selectedOutputId ? record(t, input.selectedOutputId) : null;
    const outputBindings = (t.document.nativeOutputIndex?.records || []).filter((r) => {
      const p = privateRead(t, "captures", r.captureId)?.value;
      return p && same(p.group, group(input));
    }).map((r) => ({ outputId: r.outputId, wordOwner: clone(r.wordOwner) }));
    let arrangementUndo=null;
    if(selected){const operationId=selected.record.historyIds.at(-1),previous=operationId?privateRead(t,'history',operationId)?.value:null;if(previous?.schema==='ar-create.native-output-command.v1'&&previous.outputId===selected.output.id&&same(previous.group,group(input))&&previous.afterHash===hash(selected.output)&&previous.captureId===selected.record.captureId&&previous.beforeArrangement&&!same(previous.beforeArrangement,arrangement(selected.output)))arrangementUndo={operationId};}
    const outputs=outputBindings.map(binding=>clone(record(t,binding.outputId).output));
    const document=selected?{...clone(mapper.renderDocument(validateCapture(selected.private,selected.output))),id:input.rootBindingId,outputs:clone(outputs)}:null;
    return { scope: group(input), photoScope:{projectId:t.projectId,documentId:t.documentId}, documentId: input.rootBindingId, expectedOutput: outputRecordsExpected(t.document), outputBindings, outputs, ...selected ? { document, arrangementUndo, output: clone(selected.output), wordOwner: clone(selected.record.wordOwner), ...await freshness(input, t, selected) } : {} };
  }
  async function mutate(action, input) {
    input = clone(input);
    if (!uuid.test(input.operationId || "")) fail("Output operation UUID required.");
    const allowed = ["rootBindingId", "parentStudyId", "operationId", "expectedOutput", "expectedNative", "selectedOutputId", ...action === "create" ? ["kind", "sourceBindingId"] : action === "save" ? ["changes"] : action === "undo" ? ["undoOperationId"] : action === "review" ? ["expectedWords", "wordsHash"] : []];
    if (Object.keys(input).some((k) => !allowed.includes(k))) fail("Unsupported output mutation fields.");
    const t = await target(input);
    t.input = input;
    const commandHash = hash({ action, input }), prior = privateRead(t, "history", input.operationId);
    const request = { projectId: t.projectId, documentId: t.documentId, operationId: input.operationId, expectedOutput: input.expectedOutput, commandHash };
    if (prior) {
      if (prior.value.commandHash !== commandHash || !same(prior.value.group, group(input))) fail("Operation ID already owns another exact output request.");
      const result2 = await store.saveOutputRecords(request, () => fail("Recorded output operation has no matching store receipt."));
      return { ...result2, view: await read({ ...group(input), selectedOutputId: prior.value.outputId }) };
    }
    if (!same(input.expectedOutput, outputRecordsExpected(t.document))) fail("Outputs changed since this request.");
    let selected = action === "create" ? null : record(t, input.selectedOutputId), snapshot, binding;
    if(action === "review" && selected.output.kind !== "carousel")fail("Only an own carousel words file can be reviewed here.");
    if(action === "review" && (!input.expectedWords || typeof input.wordsHash !== "string" || !/^[a-f0-9]{64}$/.test(input.wordsHash)))fail("Exact current own carousel words proof required.");
    if (action === "refresh" && !textKind(selected.output.kind)) fail("Only a native text output refreshes from its own wording.");
    if (action === "create") {
      if (!["article", "carousel", "post", "product-listing"].includes(input.kind)) fail("Explicit supported output kind required.");
      if(shortKind(input.kind)){input.sourceBindingId=input.sourceBindingId||input.rootBindingId;}
      if (!input.sourceBindingId) fail("Explicit starting native binding required.");
      if (input.sourceBindingId !== input.rootBindingId && !(t.document.nativeOutputIndex?.records || []).some((r) => r.wordOwner.kind === "native" && r.wordOwner.bindingId === input.sourceBindingId && same(privateRead(t, "captures", r.captureId)?.value?.group, group(input)))) fail("Starting copy belongs to another native root/part.");
      const start = await native.read({ bindingId: input.sourceBindingId, parentStudyId: input.parentStudyId });
      if(shortKind(input.kind)&&!input.expectedNative)input.expectedNative=clone(start.expected);
      if(!same(start.expected,input.expectedNative))fail("Exact starting native snapshot required before output registration.");
      const preflight=mapper.capture(start,{projectId:t.projectId,documentId:t.documentId,outputId:input.operationId},shortKind(input.kind)?{outputKind:input.kind}:{});
      if(!shortKind(input.kind)&&!preflight.ready)fail("Native layout is held before output registration: "+preflight.held.map(x=>x.reason).join("; "));
      if (textKind(input.kind)) {
        if (input.kind === "article" && input.sourceBindingId === input.rootBindingId && (!start.binding.canonicalOutputId || start.binding.canonicalOutputId === input.operationId)) snapshot = await native.registerOutput({ bindingId: input.rootBindingId, parentStudyId: input.parentStudyId, outputId: input.operationId, operationId: derivedId(input.operationId), expected: input.expectedNative });
        else snapshot = await native.fork({ sourceBindingId: input.sourceBindingId, parentStudyId: input.parentStudyId, outputId: input.operationId, operationId: derivedId(input.operationId), expected: input.expectedNative, ...(shortKind(input.kind)?{textOutputKind:input.kind}:{}) });
      } else {
        snapshot = start;
        if (!same(snapshot.expected, input.expectedNative)) fail("Exact starting native snapshot required.");
      }
      if (input.kind === "article" && snapshot.binding.id === input.rootBindingId && !same(snapshot.expected, input.expectedNative)) fail("Registered native words changed before output publication; exact pending request preserved.");
      binding = snapshot.binding.id;
    } else if (textKind(selected.output.kind)) {
      binding = selected.record.wordOwner.bindingId;
      snapshot = await native.read({ bindingId: binding, parentStudyId: input.parentStudyId });
      if (!same(input.expectedNative, snapshot.expected)) fail("Exact own article native expected proof required.");
    }
    const run = async (lease) => store.saveOutputRecords(request, async ({ project, readCarouselWords }) => {
      const doc = project.document, id = selected?.output.id || input.operationId, catalogue = await proofCatalogue(input, id);
      let proofNow,reviewedWords;
      if(action === "review"){
        reviewedWords=await readCarouselWords({documentId:t.documentId,outputId:id});
        if(!same(reviewedWords.expected,input.expectedWords)||await helpers.carouselWordsHash(reviewedWords.output)!==input.wordsHash)fail("Own carousel words changed since human review.");
      }
      let output, captureValue, privateValue, captureId = selected?.record.captureId;
      if (action === "create" || action === "refresh") {
        const s = lease.snapshot;
        const outputKind=shortKind(action==="create"?input.kind:selected.output.kind)?(action==="create"?input.kind:selected.output.kind):undefined;
        const basis = mapper.capture(s, { projectId: t.projectId, documentId: t.documentId, outputId: id }, {outputKind});
        proofNow = scopedProof(catalogue, basis, null, { captureMappings: true });
        captureValue = mapper.capture(s, { projectId: t.projectId, documentId: t.documentId, outputId: id }, { photoBindings: proofNow.photos, outputKind });
        if (!captureValue.ready) fail("Native layout is held: " + captureValue.held.map((x) => x.reason).join("; "));
        if (mapper.freshness(captureValue, s, proofNow.sources, proofNow.photos).stale) fail("Native retained source proof differs from authoritative current sources.");
        output = clone(captureValue.output);
        if (action === "create" && input.kind === "carousel") {
          output = helpers.snapshotCarousel(mapper.renderDocument(captureValue));
          output.id = id;
          output.adaptation = { method: "deterministic-existing-snapshotCarousel", generated: false };
        }
        if (action === "refresh") {
          if (!textKind(selected.output.kind)) fail("Only a native text output refreshes from its own wording.");
          const previous = selected.output;
          const old = outputKind?{status:"text"}:helpers.reconcileArticleComposition(previous.articleComposition, previous.manuscript, output.manuscript, previous.placements);
          const validIds = new Set(output.manuscript.map((x) => x.id));
          const existing = new Map((previous.placements || []).filter((x) => !x.paragraphId || validIds.has(x.paragraphId)).map((x) => [x.slot, x]));
          output.placements = output.placements.map((x) => clone(existing.get(x.slot) || x));
          for (const x of existing.values()) if (!output.placements.some((p) => p.slot === x.slot)) output.placements.push(clone(x));
          if (old.status === "ready") output.articleComposition = old.composition;
          output.id = id;
          output.createdAt = previous.createdAt;
          output.name = previous.name;
          output.outputRevision = (previous.outputRevision || 0) + 1;
        }
        proofNow = scopedProof(catalogue, captureValue, output);
        privateValue = { schema: "ar-create.native-output-private.v1", group: group(input), capture: captureValue, proof: proofNow };
        captureId = hash(JSON.stringify(privateValue));
      } else {
        output = clone(selected.output);
        privateValue = selected.private;
        captureValue = validateCapture(privateValue, output);
        proofNow = scopedProof(catalogue, captureValue, output);
        if (!same(proofNow, privateValue.proof)) fail("Shared proof changed; existing output preserved.");
        if (lease && mapper.freshness(captureValue, lease.snapshot, proofNow.sources, proofNow.photos).stale) fail("Article words changed; explicitly refresh its saved output.");
        if (action === "save") {
          const allowedChanges = textKind(output.kind) ? (shortKind(output.kind)?["name"]:["placements", "articleComposition", "name"]) : ["slides", "caption", "name"];
          if (!input.changes || Object.keys(input.changes).some((k) => !allowedChanges.includes(k))) fail("Article wording is immutable; only its native owner may edit it.");
          Object.assign(output, clone(input.changes));
          if (output.kind === "carousel") {
            if (typeof output.caption !== "string" || output.caption.length > 1e5) fail("Exact readable carousel caption required.");
            if (!Array.isArray(output.slides) || !output.slides.length || output.slides.length > 100 || new Set(output.slides.map((s) => s.id)).size !== output.slides.length || output.slides.some((s) => Object.keys(s).some((k) => !["id", "role", "text", "credit", "label", "template", "photos", "paragraphIds", "typography", "pillar"].includes(k)) || ("pillar" in s && !["", "佳", "家", "嘉"].includes(s.pillar)) || !uuid.test(s.id || "") || typeof s.text !== "string" || typeof s.credit !== "string" || !["cover", "inner"].includes(s.role))) fail("Exact independent carousel slides required.");
            for(const slide of output.slides)if(slide.typography !== undefined && (!validateCarouselTypography(slide.typography)||Object.keys(slide.typography).sort().join(",")!=="fit,font,scale"))fail("Use an existing supported carousel font, scale and fit.");
            if (!same(words(output), words(selected.output))){delete output.wordsReview;output.stage="words";}
          }
        } else if(action === "review"){
          helpers.assertOutputEditorialReady(output);
          output.slides=output.slides.map(slide=>({...slide,label:slide.label??output.importedDraft?.label??output.title??""}));
          output.stage="look";output.wordsReview={hash:await helpers.carouselWordsHash(output),reviewedAt:new Date().toISOString()};
        } else if (action === "undo") {
          const previous = privateRead(t, "history", input.undoOperationId)?.value;
          if (!previous || previous.outputId !== id || !same(previous.group, group(input)) || previous.afterHash !== hash(selected.output) || previous.captureId !== captureId || !previous.beforeArrangement) fail("Arrangement undo no longer matches exact own output snapshot.");
          if (output.kind === "carousel") {
            const rows = previous.beforeArrangement.slides;
            if (!same(rows.map((s) => s.id), output.slides.map((s) => s.id))) fail("Carousel topology changed; arrangement Undo cannot rewrite words.");
            output.slides = output.slides.map((s, i) => {const restored=clone(s);for(const key of Object.keys(restored))if(!["text","credit","label","role"].includes(key))delete restored[key];return {...restored,...clone(rows[i])};});
            output.name = previous.beforeArrangement.name;
          } else {for(const key of ["placements","articleComposition","name"])delete output[key];Object.assign(output, clone(previous.beforeArrangement));}
          const restored = scopedProof(catalogue, captureValue, output);
          if (!same(restored.assets, previous.beforeAssets)) fail("Previous arrangement used photos changed; Undo held.");
        }
        output.outputRevision = (output.outputRevision || 0) + 1;
        proofNow = scopedProof(catalogue, captureValue, output);
        privateValue = { ...clone(privateValue), proof: proofNow };
        captureId = hash(JSON.stringify(privateValue));
      }
      if(shortKind(output.kind)&&(output.placements?.length||output.articleComposition))fail("Short outputs support text content only.");
      if (output.name !== void 0 && (typeof output.name !== "string" || output.name.length > 256)) fail("Output name must be readable text.");
      resetVisual(output);
      placements(output, proofNow);
      const outputs = selected ? doc.outputs.map((o) => o.id === id ? output : o) : doc.outputs.concat(output), now = (/* @__PURE__ */ new Date()).toISOString(), owner = textKind(output.kind) ? { kind: "native", bindingId: binding, parentStudyId: input.parentStudyId } : { kind: "carousel-words", projectId: t.projectId, documentId: t.documentId, outputId: id };
      const index = doc.nativeOutputIndex || { schema: "ar-create.native-output-index.v1", revision: 0, records: [] };
      const nextRecord = { outputId: id, wordOwner: owner, captureId, proofId: captureId, historyIds: [...selected?.record.historyIds || [], input.operationId], createdAt: selected?.record.createdAt || now, updatedAt: now };
      const history = { schema: "ar-create.native-output-command.v1", group: group(input), commandHash, outputId: id, captureId, beforeArrangement: selected ? arrangement(selected.output) : null, beforeAssets: selected?.private.proof.assets ?? null, afterHash: hash(output) };
      const extraFiles = [{ relativePath: privatePath(t, "history", input.operationId), contents: JSON.stringify(history), expectedHash: null }];
      if (action === "create" || action === "refresh" || captureId !== selected.record.captureId) extraFiles.push({ relativePath: privatePath(t, "captures", captureId), contents: JSON.stringify(privateValue), expectedHash: privateRead(t, "captures", captureId)?.hash ?? null });
      return { outputs, nativeOutputIndex: { schema: index.schema, revision: input.expectedOutput.revision + 1, records: selected ? index.records.map((r) => r.outputId === id ? nextRecord : r) : index.records.concat(nextRecord) }, extraFiles, finalCheck: async () => {
        if(reviewedWords&&!same((await readCarouselWords({documentId:t.documentId,outputId:id})).expected,reviewedWords.expected))fail("Own carousel words changed before review publication.");
        if (!same(await currentProof(input, id, captureValue, output), proofNow)) fail("Source proof changed during output publication.");
        if (lease) {
          const s = lease.reread();
          if (!same(s.expected, lease.snapshot.expected) || mapper.freshness(captureValue, s, proofNow.sources, proofNow.photos).stale) fail("Own native snapshot changed before output publication.");
        }
      } };
    });
    const result = snapshot ? await native.withSnapshotLease({ bindingId: binding, parentStudyId: input.parentStudyId, expected: snapshot.expected }, run) : await run(null);
    return { ...result, view: await read({ ...group(input), selectedOutputId: selected?.output.id || input.operationId }) };
  }
  async function withExportSnapshot(input, fn) {
    if (typeof fn !== "function") fail("Trusted export publication callback required.");
    const t = await target(input);
    t.input = input;
    const selected = record(t, input.selectedOutputId);
    if (!same(input.expectedOutput, outputRecordsExpected(t.document))) fail("Exact current output export revision/hash required.");
    const capturedProof = await currentProof(input, selected.output.id, selected.private.capture, selected.output);
    if (!same(capturedProof, selected.private.proof)) fail("Shared proof changed; export held.");
    const captureValue = validateCapture(selected.private, selected.output);
    helpers.assertOutputEditorialReady(selected.output);
    placements(selected.output, capturedProof);
    if (textKind(selected.output.kind) && captureValue.privateSidecar.photoRequests.some((p) => !selected.output.placements.some((row) => row.slot === p.slot && row.url))) fail("Native photo layout still has unresolved owned source slots; export held.");
    const run = async (lease) => {
      if (lease && mapper.freshness(captureValue, lease.snapshot, capturedProof.sources, capturedProof.photos).stale) fail("This article native wording or source proof changed; export held.");
      if (!lease) await store.readCarouselWords({ projectId: t.projectId, documentId: t.documentId, outputId: selected.output.id });
      let active = true;
      const finalCheck = async ({ readArticle, readCarouselWords } = {}) => {
        if (!active) fail("Export snapshot lease ended.");
        const now = readArticle ? await readArticle({ projectId: t.projectId }) : await target(input);
        if (now.document.id !== t.documentId || !same(outputRecordsExpected(now.document), input.expectedOutput)) fail("Output changed before export publication.");
        if (!same(await currentProof(input, selected.output.id, captureValue, selected.output), capturedProof)) fail("Shared source proof changed before export publication.");
        if (lease && mapper.freshness(captureValue, lease.reread(), capturedProof.sources, capturedProof.photos).stale) fail("Own native snapshot changed before export publication.");
        if (!lease) await (readCarouselWords || store.readCarouselWords)({ projectId: t.projectId, documentId: t.documentId, outputId: selected.output.id });
      };
      try {
        await finalCheck();
        return await fn({ projectId:t.projectId, documentId:t.documentId, output: clone(selected.output), wordOwner: clone(selected.record.wordOwner), expectedOutput: clone(input.expectedOutput), assetProof:clone(capturedProof.assets), sourceProofHash:hash(capturedProof), finalCheck });
      } finally {
        active = false;
      }
    };
    return textKind(selected.output.kind) ? native.withSnapshotLease({ bindingId: selected.record.wordOwner.bindingId, parentStudyId: input.parentStudyId, expected: input.expectedNative }, run) : run(null);
  }
  return { read, create: (i) => mutate("create", i), save: (i) => mutate("save", i), reviewCarouselWords: (i) => mutate("review", i), refreshSelectedArticle: (i) => mutate("refresh", i), undo: (i) => mutate("undo", i), withExportSnapshot, assertExport: (i) => withExportSnapshot(i, async ({ output, wordOwner, expectedOutput }) => ({ output, wordOwner, expectedOutput })) };
}
export {
  createNativeOutputOwner
};
