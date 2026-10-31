import fs from "node:fs";
import {validateCarouselTypography} from "../src/workspaces/carousel-typography.mjs";
import path from "node:path";
import { createHash } from "node:crypto";
import { outputRecordsExpected, outputPrivatePrefix } from "../output-records.mjs";
import { provenance, requireHuman, currentActor, AGENT_ACTORS } from "./actor.mjs";
import IG from "../src/donors/mag/carousel/ig-templates.js";
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
const wordSnapshot = o => ({slides:(o.slides||[]).map(({id,role,text,credit,label})=>({id,role,text,credit,...(label!==undefined?{label}:{})})),caption:o.caption??""});
const resetVisual = (o) => {
  delete o.articleVisualMake;
  delete o.articleVisualHistory;
  delete o.visualMake;
  delete o.visualHistory;
};
function createNativeOutputOwner({ dataDir, store, native, mapper, helpers, scope, proof, retainedSource, browserOrigins = [], validateStandInReview }) {
  if (!scope?.resolve || !proof?.read || !native?.withSnapshotLease || !store?.saveOutputRecords) throw Error("Exact trusted owners are required.");
  const loopbackOrigin = origin => {try {const u=new URL(origin);return u.origin===origin&&u.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(u.hostname);}catch {return false;}};
  if (!Array.isArray(browserOrigins) || browserOrigins.some(origin=>!loopbackOrigin(origin))) throw Error("Browser carousel origins must be explicit local HTTP origins.");
  async function target(input) {
    if (!input || !uuid.test(input.rootBindingId || "") || typeof input.parentStudyId !== "string" || !input.parentStudyId) fail("Exact native root and parent are required.");
    const ids = await scope.resolve({ rootBindingId: input.rootBindingId, parentStudyId: input.parentStudyId });
    if (!ids?.projectId || !ids.documentId) fail("Unknown trusted output scope.");
    const read2 = await store.readArticle({ projectId: ids.projectId });
    if (read2.document.id !== ids.documentId) fail("Trusted physical document changed.");
    return { ...ids, document: read2.document };
  }
  const group = (i) => ({ rootBindingId: i.rootBindingId, parentStudyId: i.parentStudyId });
  const retained = c => c?.schema === "ar-create.retained-carousel-copy-capture.v1";
  const browserCopy = c => c?.schema === "ar-create.browser-carousel-copy-capture.v1";
  const independentCopy = c => retained(c) || browserCopy(c);
  const browserFields = ["origin","projectId","revision","carouselRevision","slideIds","wordsSignature","arrangementSignature","title","name","caption","slides"];
  function browserSnapshot(value, origin) {
    if (!value || Array.isArray(value) || Object.keys(value).length !== browserFields.length || browserFields.some(key=>!Object.hasOwn(value,key)) || Object.keys(value).some(key=>!browserFields.includes(key)) || Buffer.byteLength(JSON.stringify(value))>128*1024) fail("An exact bounded browser carousel snapshot is required.");
    let url;try {url=new URL(origin);}catch {fail("The current browser origin is required.");}
    if (url.origin!==origin || url.protocol!=="http:" || !["localhost","127.0.0.1","[::1]"].includes(url.hostname) || value.origin!==origin || typeof value.projectId!=="string" || !value.projectId || value.projectId.length>240 || /[\u0000-\u001f\u007f]/.test(value.projectId)) fail("The browser carousel belongs to another origin or project.");
    if ([value.revision,value.carouselRevision].some(revision=>revision!==null&&(!Number.isSafeInteger(revision)||revision<0)) || typeof value.title!=="string" || value.title.length>8192 || typeof value.name!=="string" || value.name.length>256 || typeof value.caption!=="string" || value.caption.length>1e5 || !Array.isArray(value.slides) || !value.slides.length || value.slides.length>100 || value.slides.some(slide=>!slide||typeof slide!=="object"||Array.isArray(slide)) || !Array.isArray(value.slideIds) || !same(value.slideIds,value.slides.map(slide=>slide?.id)) || new Set(value.slideIds).size!==value.slideIds.length) fail("The browser carousel identity or wording is unsupported.");
    const wordsSignature=JSON.stringify([value.slides.map(s=>({id:s.id,text:s.text,credit:s.credit,label:s.label,role:s.role})),value.caption]);
    const arrangementSignature=JSON.stringify(value.slides.map(({text,credit,label,role,...layout})=>layout));
    if (value.wordsSignature!==wordsSignature || value.arrangementSignature!==arrangementSignature) fail("The browser carousel changed since its exact pickup.");
    for (const [index,slide] of value.slides.entries()) {
      const unknown=Object.keys(slide).filter(key=>!["id","role","text","credit","label","template","photos","paragraphIds","typography","pillar"].includes(key));
      if(unknown.length)fail("Slide "+(index+1)+" has unsupported fields: "+unknown.join(", ")+". Its original is preserved.");
      if(!["cover","inner","hook","line","quote","teach","chapter","photo","scene","close"].includes(slide.role))fail("Slide "+(index+1)+" needs a supported slide role.");
      if(typeof slide.text!=="string"||typeof slide.credit!=="string")fail("Slide "+(index+1)+" needs explicit text and credit fields.");
      if(!Object.hasOwn(IG.T,slide.template))fail("Slide "+(index+1)+" has an unsupported layout.");
      if (!slide || Array.isArray(slide) || Object.keys(slide).some(key=>!["id","role","text","credit","label","template","photos","paragraphIds","typography","pillar"].includes(key)) || typeof slide.id!=="string" || !slide.id || slide.id.length>240 || /[\u0000-\u001f\u007f]/.test(slide.id) || !["cover","inner","hook","line","quote","teach","chapter","photo","scene","close"].includes(slide.role) || typeof slide.text!=="string" || typeof slide.credit!=="string" || slide.label!==undefined&&typeof slide.label!=="string" || !Object.hasOwn(IG.T,slide.template) || IG.T[slide.template].textParts===0&&slide.text || !Array.isArray(slide.photos) || (slide.photos.length>16||slide.photos.slice(IG.T[slide.template].photos).some(photo=>photo?.src!=="")) || slide.paragraphIds!==undefined&&(!Array.isArray(slide.paragraphIds)||slide.paragraphIds.some(id=>typeof id!=="string"||id.length>240)) || slide.typography!==undefined&&(!validateCarouselTypography(slide.typography)||Object.keys(slide.typography).sort().join(",")!=="fit,font,scale") || slide.pillar!==undefined&&!["","佳","家","嘉"].includes(slide.pillar)) fail("A browser slide has unsupported wording or appearance metadata.");
      for (const photo of slide.photos) if (!photo || Array.isArray(photo) || Object.keys(photo).some(key=>!["src","x","y"].includes(key)) || typeof photo.src!=="string" || photo.src!==""&&!/^\/api\/sources\/blob\?id=[^&?#]+$/.test(photo.src) || ["x","y"].some(key=>photo[key]!==undefined&&(!Number.isFinite(photo[key])||photo[key]<0||photo[key]>100))) fail("Browser photographs require empty slots or exact owned Library URLs and supported crops.");
    }
    return clone(value);
  }
  function browserOutput(snapshot,id,createdAt) {
    const mapping=snapshot.slides.map((slide,index)=>({originalSlideId:slide.id,outputSlideId:derivedId("browser-slide:"+id+":"+index+":"+slide.id),originalParagraphIds:clone(slide.paragraphIds||[])}));
    if (!uuid.test(id||"") || mapping.some(row=>row.originalSlideId===row.outputSlideId)) fail("Independent browser output identities required.");
    return {output:{id,kind:"carousel",title:snapshot.title,name:snapshot.name,caption:snapshot.caption,slides:snapshot.slides.map((slide,index)=>({...clone(slide),id:mapping[index].outputSlideId,paragraphIds:[]})),stage:"words",outputRevision:0,manuscriptRevision:0,manuscript:[],placements:[],createdAt},mapping};
  }
  function reopenBrowser(c) {
    const {captureHash,...payload}=c;
    if (captureHash!==hash(payload) || !c.ready || c.sourceLiveVerification!==false || c.role!=="immutable-browser-snapshot-not-destination-native-wording" || !uuid.test(c.scope?.outputId||"") || !uuid.test(c.scope?.projectId||"") || !uuid.test(c.scope?.documentId||"")) fail("Browser copy capture integrity changed.");
    const original=browserSnapshot(c.original,c.original?.origin),derived=browserOutput(original,c.scope.outputId,c.output?.createdAt);
    const source=browserReference(original);
    if (!same(c.source,source) || !same(c.mapping,derived.mapping) || !same(c.output,derived.output)) fail("Browser copy no longer matches its immutable captured snapshot.");
    return c;
  }
  const browserReference=snapshot=>Object.fromEntries(["origin","projectId","revision","carouselRevision","slideIds","wordsSignature","arrangementSignature"].map(key=>[key,clone(snapshot[key])]));
  const sourceFields = ["projectId", "documentId", "outputId", "sourceHash", "outputHash"];
  function sourceReference(value) {
    if (!value || Object.keys(value).length !== sourceFields.length || sourceFields.some(k => !Object.hasOwn(value,k)) || ["projectId","documentId","outputId"].some(k => !uuid.test(value[k]||"")) || ["sourceHash","outputHash"].some(k => !/^[a-f0-9]{64}$/.test(value[k]||""))) fail("Exact retained source identities and hashes required.");
    return clone(value);
  }
  async function resolveRetained(reference) {
    if (!retainedSource?.read) throw Object.assign(Error("A trusted retained-original reader is not configured."),{status:503,outcome:"not-applied"});
    let value;try {value=await retainedSource.read({outputId:reference.outputId,expectedSourceHash:reference.sourceHash,expectedOutputHash:reference.outputHash});}catch {fail("The exact retained original changed or is unavailable.");}
    if (value?.copyAllowed===false) fail("This retained original is available for reading only; no copy was made.");
    if (!value?.readOnly || value.projectId!==reference.projectId || value.documentId!==reference.documentId || value.outputId!==reference.outputId || value.sourceHash!==reference.sourceHash || value.outputHash!==reference.outputHash || value.output?.id!==reference.outputId || value.output.kind!=="carousel" || createHash("sha256").update(JSON.stringify(value.output)).digest("hex")!==reference.outputHash) fail("The retained reader returned another exact source.");
    return clone(value.output);
  }
  function retainedOutput(original,id,createdAt) {
    const fields=["id","kind","title","name","caption","slides","stage","wordsReview","outputRevision","manuscriptRevision","placements","createdAt","manuscript","importedDraft","status"];
    const importFields=["filename","raw","stage","story","pillar","label","briefs","cutFrom","sourceStatus"];
    // Unknown output-level branding/layout fields cannot silently disappear.
    // Known source review/status/history metadata stays in the private baseline;
    // none constitutes approval of this independently editable copy.
    if(Object.keys(original).some(k=>!fields.includes(k)) || original.importedDraft!==undefined&&(!original.importedDraft||typeof original.importedDraft!=="object"||Array.isArray(original.importedDraft)||Object.keys(original.importedDraft).some(k=>!importFields.includes(k))) || original.placements!==undefined&&(!Array.isArray(original.placements)||original.placements.length))fail("Retained output has unsupported appearance or composition metadata; no copy was made.");
    if (id===original.id || !uuid.test(id||"") || original.kind!=="carousel" || typeof original.caption!=="string" || original.caption.length>1e5 || typeof original.title!=="string" || !Array.isArray(original.slides) || !original.slides.length || original.slides.length>100 || new Set(original.slides.map(s=>s.id)).size!==original.slides.length) fail("This retained carousel cannot be copied losslessly.");
    const mapping=[];
    const slides=original.slides.map((s,index)=>{
      if (!s || Object.keys(s).some(k=>!["id","role","text","credit","label","template","photos","paragraphIds","typography","pillar"].includes(k)) || !uuid.test(s.id||"") || !["cover","inner","hook","line","quote","teach","chapter","photo","scene","close"].includes(s.role) || typeof s.text!=="string" || typeof s.credit!=="string" || s.label!==undefined&&typeof s.label!=="string" || !Array.isArray(s.paragraphIds) || !Array.isArray(s.photos) || !Object.hasOwn(IG.T,s.template) || (s.photos.length>16||s.photos.slice(IG.T[s.template].photos).some(photo=>photo?.src!=="")) || s.photos.some(photo=>!photo||Object.keys(photo).some(key=>!["src","x","y"].includes(key))||typeof photo.src!=="string"||photo.src!==""&&!/^\/api\/sources\/blob\?id=[^&?#]+$/.test(photo.src)||["x","y"].some(key=>photo[key]!==undefined&&(!Number.isFinite(photo[key])||photo[key]<0||photo[key]>100))) || IG.T[s.template].textParts===0&&s.text || s.typography!==undefined&&(!validateCarouselTypography(s.typography)||Object.keys(s.typography).sort().join(",")!=="fit,font,scale") || s.pillar!==undefined&&!["","佳","家","嘉"].includes(s.pillar)) fail("A retained slide needs unsupported layout, wording or photograph correspondence; no copy was made.");
      const nextId=derivedId("retained-slide:"+id+":"+index+":"+s.id);
      if (nextId===s.id) fail("Independent retained slide identities required.");
      mapping.push({originalSlideId:s.id,outputSlideId:nextId,originalParagraphIds:clone(s.paragraphIds)});
      // Foreign paragraph anchors are retained in the capture mapping, never
      // asserted as destination manuscript anchors or authorship.
      return {...clone(s),id:nextId,paragraphIds:[],...(s.label===undefined&&original.importedDraft?.label!==undefined?{label:original.importedDraft.label}:{})};
    });
    if(original.name!==undefined&&(typeof original.name!=="string"||original.name.length>256)||original.importedDraft?.label!==undefined&&typeof original.importedDraft.label!=="string")fail("Retained output labels must be supported readable text.");
    return {output:{id,kind:"carousel",title:original.title,...(original.name!==undefined?{name:original.name}:{}),caption:original.caption,slides,stage:"words",outputRevision:0,manuscriptRevision:0,manuscript:[],placements:[],createdAt},mapping};
  }
  function reopenRetained(c) {
    const {captureHash,...payload}=c;
    if (captureHash!==hash(payload) || !c.ready || !same(c.source,sourceReference(c.source)) || c.source.outputId!==c.original.id || createHash("sha256").update(JSON.stringify(c.original)).digest("hex")!==c.source.outputHash || !uuid.test(c.scope?.outputId||"") || !uuid.test(c.scope?.projectId||"") || !uuid.test(c.scope?.documentId||"")) fail("Retained copy capture integrity changed.");
    const derived=retainedOutput(c.original,c.scope.outputId,c.output.createdAt);
    if (!same(c.mapping,derived.mapping) || !same(c.output,derived.output)) fail("Retained copy no longer matches its captured original.");
    return c;
  }
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
    if (independentCopy(captureValue)) {
      if(browserCopy(captureValue))reopenBrowser(captureValue);else reopenRetained(captureValue);
      // Destination decisions and used assets still have maintained owners;
      // original wording provenance is solely the retained source reference.
      const ids=[...new Set((output?.slides||[]).flatMap(s=>s.photos||[]).filter(photo=>photo.src!=="").map(photo=>{const match=/^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(photo.src||"");if(!match)fail("Only exact owned Library photograph URLs may be used.");return decodeURIComponent(match[1]);}))].sort();
      const assets=ids.map(id=>{const matches=(p.assets||[]).filter(asset=>asset.id===id);if(matches.length>1)fail("Ambiguous used photo identity.");return {id,hash:matches[0]?.hash??null,missing:!matches[0]||!!matches[0].missing};});
      return {sources:[{kind:browserCopy(captureValue)?"browser-carousel-snapshot":"retained-carousel",...clone(captureValue.source),...(browserCopy(captureValue)?{liveVerification:false}:{})}],photos:[],assets,decisionsHash:p.decisionsHash};
    }
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
  async function currentProof(i, outputId, captureValue, output, catalogue=null) {
    const value=scopedProof(catalogue||await proofCatalogue(i, outputId), captureValue, output);
    if(retained(captureValue)){try{await resolveRetained(captureValue.source);}catch{return {...value,retainedSourceUnavailable:true};}}
    return value;
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
      if (photo.src === "") continue;
      const m = /^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(photo.src || "");
      if (!m || !p.assets.some((x) => x.id === decodeURIComponent(m[1]) && !x.missing && /^[a-f0-9]{64}$/.test(x.hash || ""))) fail("Exact current carousel photo proof required.");
    }
  }
  function validateCapture(p, o) {
    if(independentCopy(p.capture)){const c=browserCopy(p.capture)?reopenBrowser(p.capture):reopenRetained(p.capture);if(o.kind!=="carousel"||c.scope.outputId!==o.id||o.manuscript?.length||o.placements?.length||o.manuscriptRevision!==0)fail("Independent copy cannot claim destination manuscript wording.");return c;}
    const c = mapper.reopen(JSON.stringify(p.capture));
    if (!c.ready || c.scope.outputId !== o.id) fail("Exact ready captured output identity required.");
    if (textKind(o.kind) && (o.kind!==c.output.kind||!same(words(o), words(c.output)))) fail("Article words changed outside its canonical native owner; refresh explicitly.");
    return c;
  }
  function languageTag(value){if(typeof value!=="string"||value.length>48||!value.trim())fail("Choose an explicit supported target language tag.");let tag;try{tag=Intl.getCanonicalLocales(value)[0];}catch{fail("Choose a valid target language tag, such as en or zh-Hans.");}if(!tag||tag!==value)fail("Use the canonical target language tag.");return tag;}
  function copyArticleLayout(source,output){
    if(source.manuscript?.length!==output.manuscript?.length)fail("The selected article paragraph structure changed before its language copy.");
    const ids=new Map();for(const [i,row]of source.manuscript.entries()){const next=output.manuscript[i];if(!same({...row,id:null},{...next,id:null}))fail("The selected article wording changed before its language copy.");ids.set(row.id,next.id);}
    const idKeys=new Set(["paragraphId","followId","titleId","hookId","introId","closingId","sayingId"]);
    const map=(value,key)=>{if(idKeys.has(key)&&value!==undefined&&value!==null){if(!ids.has(value))fail("A selected article composition anchor has no exact child paragraph.");return ids.get(value);}if(Array.isArray(value))return value.map(item=>map(item));if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,map(v,k)]));return value;};
    output.articleComposition=map(source.articleComposition);output.placements=source.placements.map(row=>map(row));
  }
  function carouselEditionCapture(source,id,createdAt){
    const c=source.private.capture,scope={...c.scope,outputId:id};let captureValue;
    if(independentCopy(c)){const derived=browserCopy(c)?browserOutput(c.original,id,createdAt):retainedOutput(c.original,id,createdAt),{captureHash,...payload}=clone(c);Object.assign(payload,{scope,output:derived.output,mapping:derived.mapping});captureValue={...payload,captureHash:hash(payload)};validateCapture({capture:captureValue},derived.output);}
    else captureValue=mapper.capture(c.privateSidecar.nativeSnapshot,scope,{photoBindings:c.privateSidecar.photoBindings});
    const output={...clone(source.output),id,createdAt,outputRevision:0,stage:"words",slides:source.output.slides.map((slide,index)=>({...clone(slide),id:derivedId("language-slide:"+id+":"+index+":"+slide.id),paragraphIds:[]}))};
    delete output.wordsReview;delete output.language;delete output.languageEdition;resetVisual(output);
    return {captureValue,output};
  }
  async function languageReview(i,t,output){
    const edition=output.languageEdition;if(!edition)return null;let parent;
    try{parent=record(t,edition.sourceOutputId);}catch{return {sourceOutputId:edition.sourceOutputId,stale:true,reason:"Linked source output is unavailable; independent wording is preserved."};}
    let source;try{source=await freshness(i,t,parent,true);}catch{return {sourceOutputId:edition.sourceOutputId,stale:true,reason:"Linked source wording is unavailable; independent wording is preserved."};}
    const currentWordsHash=source.writingProof.kind==="native"?source.writingProof.rawHash:source.writingProof.wordsHash;
    const currentSourceProof=source.currentProof;
    const stale=hash(parent.output)!==edition.sourceOutputHash||currentWordsHash!==edition.sourceWordsHash||source.freshness.writingStale||!same(parent.record.wordOwner,edition.sourceWordOwner)||hash(currentSourceProof)!==edition.sourceProofHash;
    return {sourceOutputId:edition.sourceOutputId,sourceTitle:parent.output.name||parent.output.title||"Linked source",stale,reason:stale?"Linked source changed; review this independent language edition.":null,currentSourceOutputRevision:parent.output.outputRevision||0,currentSourceWordsHash:currentWordsHash,basis:"observed-parent-state-not-translation-approval"};
  }
  async function freshness(i, t, selected, includeProof=false) {
    const catalogue=await proofCatalogue(i,selected.output.id);
    const p = await currentProof(i, selected.output.id, selected.private.capture, selected.output,catalogue);
    const sourceStale=!same(p,selected.private.proof);
    let reason=sourceStale?"Shared source, decision or photo proof changed.":null,writingProof,writingStale=false,canRefreshUnchangedWriting=false;
    if(textKind(selected.output.kind)){
      const c=validateCapture(selected.private,selected.output),s=await native.read({bindingId:selected.record.wordOwner.bindingId,parentStudyId:i.parentStudyId});
      writingProof={kind:'native',bindingId:s.binding.id,parentStudyId:s.binding.parentStudyId,expected:clone(s.expected),rawHash:hash(s.raw),capturedRawHash:c.nativeProof.rawHash};
      writingStale=writingProof.rawHash!==writingProof.capturedRawHash||!same(s.expected,c.nativeProof.expected);
      if(mapper.freshness(c,s,p.sources,p.photos).stale)reason="This output native wording or exact source proof changed.";
      // This is recapture eligibility, never a waiver of stale evidence or approval.
      if(selected.output.kind==='article'&&(sourceStale||writingStale)&&same({...p,decisionsHash:selected.private.proof.decisionsHash},selected.private.proof))try{
        const liveProof=scopedProof(catalogue,c,selected.output,{captureMappings:true}),current=mapper.capture(s,c.scope,{photoBindings:liveProof.photos});
        canRefreshUnchangedWriting=same({...liveProof,decisionsHash:selected.private.proof.decisionsHash},selected.private.proof)&&current.ready===true&&current.mediaReady===true&&current.nativeProof.bindingId===c.nativeProof.bindingId&&current.nativeProof.parentStudyId===c.nativeProof.parentStudyId&&current.nativeProof.rawHash===c.nativeProof.rawHash&&current.nativeProof.projectionHash===c.nativeProof.projectionHash&&!mapper.freshness(current,s,liveProof.sources,liveProof.photos).stale;
      }catch{/* Unready, marked or unsupported current wording stays held. */}
    }else{
      const w=await store.readCarouselWords({projectId:t.projectId,documentId:t.documentId,outputId:selected.output.id,allowEditedMarkdown:true});
      writingProof={kind:'carousel-words',projectId:t.projectId,documentId:t.documentId,outputId:selected.output.id,expected:clone(w.expected),wordsHash:await helpers.carouselWordsHash(w.output)};
      writingStale=!!w.externalEdit||!!w.missing;
      if(writingStale)reason='This carousel canonical words file changed outside its saved output.';
    }
    return {writingProof,freshness:{stale:sourceStale||writingStale,reason,writingStale,sourceStale,canRefreshUnchangedWriting},...(includeProof?{currentProof:p}:{})};
  }
  async function read(input) {
    const t = await target(input);
    t.input = input;
    const selected = input.selectedOutputId ? record(t, input.selectedOutputId) : null;
    const outputBindings = (t.document.nativeOutputIndex?.records || []).filter((r) => {
      const p = privateRead(t, "captures", r.captureId)?.value;
      return p && same(p.group, group(input));
    }).map((r) => ({ outputId: r.outputId, wordOwner: clone(r.wordOwner) }));
    let arrangementUndo=null,wordsUndo=null;
    const wordsReviewDecision=reviewDecision(t,selected,input);
    if(selected){
      const operationId=selected.record.historyIds.at(-1),previous=operationId?privateRead(t,'history',operationId)?.value:null;
      if(previous?.schema==='ar-create.native-output-command.v1'&&previous.outputId===selected.output.id&&same(previous.group,group(input))&&previous.afterHash===hash(selected.output)&&previous.captureId===selected.record.captureId){
        if(previous.beforeArrangement&&!same(previous.beforeArrangement,arrangement(selected.output)))arrangementUndo={operationId};
        if(selected.output.kind==='carousel'&&previous.beforeWords&&same(previous.beforeWords.slides.map(slide=>slide.id),selected.output.slides.map(slide=>slide.id))&&!same(previous.beforeWords,wordSnapshot(selected.output)))wordsUndo={operationId};
      }
    }
    const outputs=outputBindings.map(binding=>clone(record(t,binding.outputId).output));
    const capture=selected?validateCapture(selected.private,selected.output):null;
    const document=selected?{...clone(independentCopy(capture)?{schema:"ar-create.document.v1",id:t.documentId,revision:0,title:selected.output.title,paragraphs:[]}:mapper.renderDocument(capture)),id:input.rootBindingId,outputs:clone(outputs)}:null;
    const outputOrigins={};for(const output of outputs){const c=record(t,output.id).private.capture;if(independentCopy(c)){if(browserCopy(c))reopenBrowser(c);else reopenRetained(c);outputOrigins[output.id]={kind:browserCopy(c)?"browser-carousel-copy":"retained-original-copy",source:clone(c.source),mapping:clone(c.mapping),wordOrigin:browserCopy(c)?"browser-snapshot-not-destination-manuscript":"retained-original-not-destination-manuscript",...(browserCopy(c)?{sourceLiveVerification:false}:{})};}}
    const selectedFreshness=selected?await freshness(input,t,selected):null;
    if(selectedFreshness?.freshness.writingStale)wordsUndo=null;
    const languageEditionReview=selected?await languageReview(input,t,selected.output):null;
    let standInCapabilities={};
    if(AGENT_ACTORS.includes(currentActor()?.actor)&&typeof validateStandInReview==='function'&&input.parentStudyId.startsWith('structure-test-')){
      try{const checked=await validateStandInReview({...group(input),selectedOutputId:selected?.output.id});if(checked?.canStandInReview===true&&/^[a-f0-9]{64}$/.test(checked.fingerprint||''))standInCapabilities={standInOutputCreation:true,...selected?{standInOutputEditing:true,standInWordsReview:selected.output.kind==='carousel'}:{}};}catch(error){if(![403,404,409].includes(error.status))throw error;}
    }
    return { ...standInCapabilities,...(languageEditionReview?{languageEditionReview}:{}),scope: group(input), photoScope:{projectId:t.projectId,documentId:t.documentId}, documentId: input.rootBindingId, expectedOutput: outputRecordsExpected(t.document), outputBindings, outputs, outputOrigins, ...selected ? { document, arrangementUndo, wordsUndo, wordsReviewDecision, output: clone(selected.output), wordOwner: clone(selected.record.wordOwner), ...selectedFreshness } : {} };
  }
  // Read the existing command journal rather than extending the closed output schema.
  // A later layout edit may retain a word review; a wording edit cannot borrow it.
  function reviewDecision(t,selected,input){
    if(selected?.output.kind !== "carousel" || !selected.output.wordsReview)return null;
    for(const operationId of [...selected.record.historyIds].reverse()){
      const row=privateRead(t,"history",operationId)?.value;
      if(row?.schema==="ar-create.native-output-command.v1" && row.outputId===selected.output.id && same(row.group,group(input)) && row.decisionRole==="stand-in" && row.decision?.schema==="ar-create.carousel-words-stand-in-review.v1" && same(row.decision.review,selected.output.wordsReview))return clone(row.decision);
    }
    return null;
  }
  async function mutate(action, input, pairedReview = null, standIn = false) {
    if (action === "review" && !standIn) requireHuman("Reviewing Carousel words");
    const actor = currentActor();
    let standInProof;
    const verifyStandIn = async (context) => {
      if (!AGENT_ACTORS.includes(actor?.actor) || currentActor()?.actor !== actor.actor || typeof validateStandInReview !== "function") fail("Carousel stand-in review requires an explicit registered agent and copy guard.");
      const checked = await validateStandInReview({ ...group(input), selectedOutputId: action==="create"?input.operationId:input.selectedOutputId },context);
      if (checked?.canStandInReview !== true || !/^[a-f0-9]{64}$/.test(checked.fingerprint || "")) fail("Carousel stand-in review requires a registered structure-test copy.");
      const next = { fingerprint: checked.fingerprint, actor: actor.actor, client: actor.client, decisionRole: "stand-in" };
      if (standInProof && !same(next, standInProof)) fail("Carousel stand-in copy ownership changed before publication.");
      standInProof = next;
    };
    if (standIn) await verifyStandIn();
    input = clone(input);
    if (!uuid.test(input.operationId || "")) fail("Output operation UUID required.");
    const allowed = ["rootBindingId", "parentStudyId", "operationId", "expectedOutput", "expectedNative", "selectedOutputId", ...action === "create" ? ["kind", "sourceBindingId", "sourceOutputId", "targetLanguage", "expectedSourceWords"] : action === "save" ? ["changes"] : ["undo","undo-words"].includes(action) ? ["undoOperationId"] : action === "review" ? ["expectedWords", "wordsHash"] : []];
    if (Object.keys(input).some((k) => !allowed.includes(k))) fail("Unsupported output mutation fields.");
    if(standIn&&action==="create"&&(!["article","carousel","post","product-listing"].includes(input.kind)||!uuid.test(input.sourceBindingId||"")||!input.expectedNative||["selectedOutputId","sourceOutputId","targetLanguage","expectedSourceWords"].some(key=>Object.hasOwn(input,key))))fail("Stand-in creation requires exact copy-native source fields.");
    const t = await target(input);
    t.input = input;
    const commandHash = hash({ action, input, ...(pairedReview?{review:pairedReview.binding}:{}), ...(standIn?{standIn:standInProof}:{}) }), prior = privateRead(t, "history", input.operationId);
    const request = { projectId: t.projectId, documentId: t.documentId, operationId: input.operationId, expectedOutput: input.expectedOutput, commandHash };
    if (prior) {
      if (prior.value.commandHash !== commandHash || !same(prior.value.group, group(input))) fail("Operation ID already owns another exact output request.");
      const result2 = await store.saveOutputRecords(request, () => fail("Recorded output operation has no matching store receipt."));
      return { ...result2, view: await read({ ...group(input), selectedOutputId: prior.value.outputId }) };
    }
    if (!same(input.expectedOutput, outputRecordsExpected(t.document))) fail("Outputs changed since this request.");
    let selected = action === "create" ? null : record(t, input.selectedOutputId), snapshot, binding,languageSource=null,languageSourceProof=null,languageSourceFresh=null,lineage=null,related=null;
    const languageFields=["sourceOutputId","targetLanguage","expectedSourceWords"];
    if(action==="create"&&languageFields.some(key=>Object.hasOwn(input,key))){
      if(!languageFields.every(key=>Object.hasOwn(input,key))||!["article","carousel"].includes(input.kind)||!uuid.test(input.sourceOutputId||"")||input.sourceOutputId===input.operationId||input.sourceBindingId!==undefined)fail("A language edition requires its exact selected source output, kind and own-word proof.");
      languageTag(input.targetLanguage);languageSource=record(t,input.sourceOutputId);if(languageSource.output.kind!==input.kind)fail("A language edition must retain its selected source output kind.");
      validateCapture(languageSource.private,languageSource.output);helpers.assertOutputEditorialReady(languageSource.output);
      languageSourceFresh=await freshness(input,t,languageSource);if(languageSourceFresh.freshness.writingStale||!same(input.expectedSourceWords,languageSourceFresh.writingProof))fail("Selected source own words changed; reopen before creating a language edition.");
      languageSourceProof=await currentProof(input,languageSource.output.id,languageSource.private.capture,languageSource.output);
      if(!same({...languageSourceProof,decisionsHash:languageSource.private.proof.decisionsHash},languageSource.private.proof))fail("Selected source assets or source evidence changed; preserve its current output.");
      lineage={sourceOutputId:languageSource.output.id,sourceOutputRevision:languageSource.output.outputRevision||0,sourceOutputHash:hash(languageSource.output),sourceWordsHash:languageSourceFresh.writingProof.kind==="native"?languageSourceFresh.writingProof.rawHash:languageSourceFresh.writingProof.wordsHash,sourceWordOwner:clone(languageSource.record.wordOwner),sourceProofHash:hash(languageSourceProof)};
      if(input.kind==="article"){input.sourceBindingId=languageSource.record.wordOwner.bindingId;if(input.expectedNative!==undefined&&!same(input.expectedNative,languageSourceFresh.writingProof.expected))fail("The selected source native expected proof changed.");input.expectedNative=clone(languageSourceFresh.writingProof.expected);related={bindingId:input.sourceBindingId,parentStudyId:input.parentStudyId,expected:clone(input.expectedNative)};}
    }

    if(retained(selected?.private.capture))await resolveRetained(selected.private.capture.source);
    if(["review","undo-words"].includes(action) && selected.output.kind !== "carousel")fail("Only an own carousel words file can be reviewed here.");
    if(action === "review" && (!input.expectedWords || typeof input.wordsHash !== "string" || !/^[a-f0-9]{64}$/.test(input.wordsHash)))fail("Exact current own carousel words proof required.");
    if (action === "refresh" && !textKind(selected.output.kind)) fail("Only a native text output refreshes from its own wording.");
    if (action === "create" && !(languageSource&&input.kind==="carousel")) {
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
        if (!languageSource && input.kind === "article" && input.sourceBindingId === input.rootBindingId && (!start.binding.canonicalOutputId || start.binding.canonicalOutputId === input.operationId)) snapshot = await native.registerOutput({ bindingId: input.rootBindingId, parentStudyId: input.parentStudyId, outputId: input.operationId, operationId: derivedId(input.operationId), expected: input.expectedNative });
        else snapshot = await native.fork({ sourceBindingId: input.sourceBindingId, parentStudyId: input.parentStudyId, outputId: input.operationId, operationId: derivedId(input.operationId), expected: input.expectedNative, ...(shortKind(input.kind)?{textOutputKind:input.kind}:{}) });
      } else {
        snapshot = start;
        if (!same(snapshot.expected, input.expectedNative)) fail("Exact starting native snapshot required.");
      }
      if (input.kind === "article" && snapshot.binding.id === input.rootBindingId && !same(snapshot.expected, input.expectedNative)) fail("Registered native words changed before output publication; exact pending request preserved.");
      binding = snapshot.binding.id;
    } else if (action!=="create" && textKind(selected.output.kind)) {
      binding = selected.record.wordOwner.bindingId;
      snapshot = await native.read({ bindingId: binding, parentStudyId: input.parentStudyId });
      if (!same(input.expectedNative, snapshot.expected)) fail("Exact own article native expected proof required.");
    }
    const run = async (lease) => store.saveOutputRecords(request, async ({ project, readCarouselWords }) => {
      const doc = project.document, id = selected?.output.id || input.operationId, catalogue = await proofCatalogue(input, id);
      let proofNow,reviewedWords;
      if(action === "review" || action === "undo-words" || pairedReview){
        reviewedWords=await readCarouselWords({documentId:t.documentId,outputId:id});
        if(pairedReview&&!same(reviewedWords.expected,pairedReview.expectedWords))fail("Own Carousel words changed after proposal review.");
        if(action === "review" && (!same(reviewedWords.expected,input.expectedWords)||await helpers.carouselWordsHash(reviewedWords.output)!==input.wordsHash))fail("Own carousel words changed since human review.");
        if(action === "undo-words"&&!same(words(reviewedWords.output),words(selected.output)))fail("Own carousel words changed outside their saved owner; wording Undo held.");
      }
      let output, captureValue, privateValue, captureId = selected?.record.captureId;
      if(languageSource&&input.kind==="carousel"){
        const copied=carouselEditionCapture(languageSource,id,new Date().toISOString());output=copied.output;captureValue=copied.captureValue;
        proofNow=scopedProof(catalogue,captureValue,output);privateValue={schema:"ar-create.native-output-private.v1",group:group(input),capture:captureValue,proof:proofNow};captureId=hash(JSON.stringify(privateValue));
      }else if (action === "create" || action === "refresh") {
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
          if(previous.languageEdition){output.language=previous.language;output.languageEdition=clone(previous.languageEdition);}
          output.outputRevision = (previous.outputRevision || 0) + 1;
        }
        if(languageSource&&input.kind==="article")copyArticleLayout(languageSource.output,output);
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
            if (!Array.isArray(output.slides) || !output.slides.length || output.slides.length > 100 || new Set(output.slides.map((s) => s.id)).size !== output.slides.length || output.slides.some((s) => Object.keys(s).some((k) => !["id", "role", "text", "credit", "label", "template", "photos", "paragraphIds", "typography", "pillar"].includes(k)) || ("pillar" in s && !["", "佳", "家", "嘉"].includes(s.pillar)) || !uuid.test(s.id || "") || typeof s.text !== "string" || typeof s.credit !== "string" || !["cover", "inner", "hook", "line", "quote", "teach", "chapter", "photo", "scene", "close"].includes(s.role))) fail("Exact independent carousel slides required.");
            for(const slide of output.slides)if(slide.typography !== undefined && (!validateCarouselTypography(slide.typography)||Object.keys(slide.typography).sort().join(",")!=="fit,font,scale"))fail("Use an existing supported carousel font, scale and fit.");
            if (!same(words(output), words(selected.output))){delete output.wordsReview;output.stage="words";}
          }
        } else if(action === "review"){
          helpers.assertOutputEditorialReady(output);
          output.slides=output.slides.map(slide=>({...slide,label:slide.label??output.importedDraft?.label??output.title??""}));
          output.stage="look";output.wordsReview={hash:await helpers.carouselWordsHash(output),reviewedAt:new Date().toISOString()};
        } else if (action === "undo-words") {
          const previous=privateRead(t,"history",input.undoOperationId)?.value;
          if(!previous || selected.record.historyIds.at(-1)!==input.undoOperationId || previous.schema!=="ar-create.native-output-command.v1" || previous.outputId!==id || !same(previous.group,group(input)) || previous.afterHash!==hash(selected.output) || previous.captureId!==captureId || !previous.beforeWords || !same(previous.beforeWords.slides.map(slide=>slide.id),output.slides.map(slide=>slide.id)) || same(previous.beforeWords,wordSnapshot(output)))fail("Wording Undo no longer matches this exact saved carousel and slide sequence.");
          output.slides=output.slides.map((slide,index)=>{const restored={...slide};for(const key of ["role","text","credit","label"])delete restored[key];return {...restored,...clone(previous.beforeWords.slides[index])};});
          output.caption=previous.beforeWords.caption;delete output.wordsReview;output.stage="words";
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
      if(lineage){output.language=input.targetLanguage;output.languageEdition=clone(lineage);const displayLanguage=new Intl.DisplayNames(["en"],{type:"language"}).of(input.targetLanguage)||input.targetLanguage,suffix=" · "+(displayLanguage.length<=100?displayLanguage:input.targetLanguage);let label=languageSource.output.name||languageSource.output.title||"Output";while(label.length+suffix.length>256)label=[...label].slice(0,-1).join("");output.name=label+suffix;}
      if(shortKind(output.kind)&&(output.placements?.length||output.articleComposition))fail("Short outputs support text content only.");
      if (output.name !== void 0 && (typeof output.name !== "string" || output.name.length > 256)) fail("Output name must be readable text.");
      resetVisual(output);
      placements(output, proofNow);
      const outputs = selected ? doc.outputs.map((o) => o.id === id ? output : o) : doc.outputs.concat(output), now = (/* @__PURE__ */ new Date()).toISOString(), owner = textKind(output.kind) ? { kind: "native", bindingId: binding, parentStudyId: input.parentStudyId } : { kind: "carousel-words", projectId: t.projectId, documentId: t.documentId, outputId: id };
      const index = doc.nativeOutputIndex || { schema: "ar-create.native-output-index.v1", revision: 0, records: [] };
      const nextRecord = { outputId: id, wordOwner: owner, captureId, proofId: captureId, historyIds: [...selected?.record.historyIds || [], input.operationId], createdAt: selected?.record.createdAt || now, updatedAt: now };
      const history = { schema: "ar-create.native-output-command.v1", provenance: provenance(), ...(standIn?{decisionRole:"stand-in",decision:{schema:action==="review"?"ar-create.carousel-words-stand-in-review.v1":action==="create"?"ar-create.output-stand-in-create.v1":action==="refresh"?"ar-create.output-stand-in-refresh.v1":"ar-create.output-stand-in-save.v1",...clone(standInProof),operationId:input.operationId,scope:{...group(input),outputId:id},review:clone(output.wordsReview)}}:{}), group: group(input), commandHash, outputId: id, captureId, beforeArrangement: selected ? arrangement(selected.output) : null, ...(selected?.output.kind==="carousel"&&["save","undo-words"].includes(action)?{beforeWords:wordSnapshot(selected.output)}:{}), beforeAssets: selected?.private.proof.assets ?? null, afterHash: hash(output) };
      const extraFiles = [{ relativePath: privatePath(t, "history", input.operationId), contents: JSON.stringify(history), expectedHash: null }];
      if (action === "create" || action === "refresh" || captureId !== selected.record.captureId) extraFiles.push({ relativePath: privatePath(t, "captures", captureId), contents: JSON.stringify(privateValue), expectedHash: privateRead(t, "captures", captureId)?.hash ?? null });
      return { outputs, nativeOutputIndex: { schema: index.schema, revision: input.expectedOutput.revision + 1, records: selected ? index.records.map((r) => r.outputId === id ? nextRecord : r) : index.records.concat(nextRecord) }, extraFiles, ...(pairedReview?.beforeIntent?{beforeIntent:pairedReview.beforeIntent}:{}), ...(pairedReview?{sharedCarouselDecision:{requestId:pairedReview.requestId,binding:clone(pairedReview.binding),outputId:id}}:{}), finalCheck: async () => {
        if(languageSource){
          const currentSource=doc.outputs.find(row=>row.id===lineage.sourceOutputId);if(!currentSource||hash(currentSource)!==lineage.sourceOutputHash)fail("Selected source output changed before language edition publication; prepared copy is retained.");
          if(related){const actual=lease.rereadRelated();if(hash(actual.raw)!==lineage.sourceWordsHash)fail("Selected source own words changed before language edition publication.");}
          else {const actual=await readCarouselWords({projectId:t.projectId,documentId:t.documentId,outputId:lineage.sourceOutputId});if(!same(actual.expected,languageSourceFresh.writingProof.expected)||await helpers.carouselWordsHash(actual.output)!==lineage.sourceWordsHash)fail("Selected carousel own words changed before language edition publication.");}
          if(hash(await currentProof(input,lineage.sourceOutputId,languageSource.private.capture,languageSource.output))!==lineage.sourceProofHash)fail("Selected source decisions or assets changed during language edition publication.");
        }
        if(retained(captureValue))await resolveRetained(captureValue.source);
        if(reviewedWords&&!same((await readCarouselWords({documentId:t.documentId,outputId:id})).expected,reviewedWords.expected))fail("Own carousel words changed before review publication.");
        if (!same(await currentProof(input, id, captureValue, output), proofNow)) fail("Source proof changed during output publication.");
        if (lease) {
          const s = lease.reread();
          if (!same(s.expected, lease.snapshot.expected) || mapper.freshness(captureValue, s, proofNow.sources, proofNow.photos).stale) fail("Own native snapshot changed before output publication.");
        }
        if(standIn) await verifyStandIn(lease?{rootSnapshot:lease.snapshot.binding.id===input.rootBindingId?lease.reread():lease.rereadRelated()}:undefined);
        if(pairedReview){requireHuman("Accepting native Carousel wording");await pairedReview.finalCheck();}
      } };
    });
    if(standIn&&snapshot&&snapshot.binding.id!==input.rootBindingId){const root=await native.read({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId});related={bindingId:input.rootBindingId,parentStudyId:input.parentStudyId,expected:clone(root.expected)};}
    const result = snapshot ? await native.withSnapshotLease({ bindingId: binding, parentStudyId: input.parentStudyId, expected: snapshot.expected,...(related?{related}:{}) }, run) : await run(null);
    return { ...result, view: await read({ ...group(input), selectedOutputId: selected?.output.id || input.operationId }) };
  }
  // Trusted in-process copy boundary. There is intentionally no ambient file,
  // current project, browser JSON import, or native wording substitution here.
  async function copyRetainedCarousel(input) {
    input=clone(input);
    const allowed=["rootBindingId","parentStudyId","destinationProjectId","destinationDocumentId","operationId","expectedOutput","expectedNative","source"];
    if(!input||Object.keys(input).some(k=>!allowed.includes(k))||!uuid.test(input.operationId||"")||!uuid.test(input.destinationProjectId||"")||!uuid.test(input.destinationDocumentId||""))fail("An explicit retained-copy destination and operation UUID are required.");
    const reference=sourceReference(input.source),t=await target(input);t.input=input;
    if(t.projectId!==input.destinationProjectId||t.documentId!==input.destinationDocumentId)fail("The retained-copy destination differs from its persisted owner.");
    const commandHash=hash({action:"copy-retained-carousel",input}),request={projectId:t.projectId,documentId:t.documentId,operationId:input.operationId,expectedOutput:input.expectedOutput,commandHash},prior=privateRead(t,"history",input.operationId);
    if(prior){
      if(prior.value.commandHash!==commandHash||!same(prior.value.group,group(input)))fail("Operation ID already owns another exact output request.");
      const replay=await store.saveOutputRecords(request,()=>fail("Retained copy has no matching store receipt."));
      return {...replay,view:await read({...group(input),selectedOutputId:prior.value.outputId})};
    }
    if(!same(input.expectedOutput,outputRecordsExpected(t.document)))fail("Outputs changed before the retained copy.");
    const source=await resolveRetained(reference),prepared=retainedOutput(source,input.operationId,new Date().toISOString());
    return native.withSnapshotLease({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId,expected:input.expectedNative},async lease=>{
      const result=await store.saveOutputRecords(request,async({project})=>{
        const doc=project.document,id=input.operationId;if(doc.outputs.some(output=>output.id===id))fail("The retained copy needs an independent output identity.");
        const payload={schema:"ar-create.retained-carousel-copy-capture.v1",role:"immutable-retained-original-copy-not-destination-native-wording",scope:{projectId:t.projectId,documentId:t.documentId,outputId:id},ready:true,source:reference,original:source,output:prepared.output,mapping:prepared.mapping};
        const captureValue={...payload,captureHash:hash(payload)},proofNow=scopedProof(await proofCatalogue(input,id),captureValue,prepared.output),privateValue={schema:"ar-create.native-output-private.v1",group:group(input),capture:captureValue,proof:proofNow},captureId=hash(JSON.stringify(privateValue)),now=prepared.output.createdAt;
        placements(prepared.output,proofNow);
        const record={outputId:id,wordOwner:{kind:"carousel-words",projectId:t.projectId,documentId:t.documentId,outputId:id},captureId,proofId:captureId,historyIds:[input.operationId],createdAt:now,updatedAt:now};
        const index=doc.nativeOutputIndex||{schema:"ar-create.native-output-index.v1",revision:0,records:[]};
        const history={schema:"ar-create.native-output-command.v1",provenance:provenance(),group:group(input),commandHash,outputId:id,captureId,beforeArrangement:null,beforeAssets:null,afterHash:hash(prepared.output),source:reference,mapping:prepared.mapping,destination:{projectId:t.projectId,documentId:t.documentId,rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,role:"destination-location-not-word-origin"}};
        return {outputs:doc.outputs.concat(prepared.output),nativeOutputIndex:{schema:index.schema,revision:input.expectedOutput.revision+1,records:index.records.concat(record)},extraFiles:[{relativePath:privatePath(t,"captures",captureId),contents:JSON.stringify(privateValue),expectedHash:null},{relativePath:privatePath(t,"history",input.operationId),contents:JSON.stringify(history),expectedHash:null}],finalCheck:async()=>{
          await resolveRetained(reference);
          const destination=await scope.resolve(group(input));if(destination.projectId!==t.projectId||destination.documentId!==t.documentId||!same(lease.reread().expected,lease.snapshot.expected))fail("The retained-copy destination changed before publication.");
          if(!same(scopedProof(await proofCatalogue(input,id),captureValue,prepared.output),proofNow))fail("Destination decision or asset proof changed before publication.");
        }};
      });
      // Read only after the native lease ends: the normal scope resolver may
      // need to revalidate the native owner when this process is restarted.
      return result;
    }).then(async result=>({...result,view:await read({...group(input),selectedOutputId:input.operationId})}));
  }
  // This capture is a supplied browser snapshot, never a live source reader or
  // a claim that destination manuscript wording produced the carousel.
  async function copyBrowserCarousel(input, {origin} = {}) {
    input=clone(input);
    const allowed=["rootBindingId","parentStudyId","destinationProjectId","destinationDocumentId","operationId","expectedOutput","expectedNative","browser"];
    if(!input||Object.keys(input).some(key=>!allowed.includes(key))||!uuid.test(input.operationId||"")||!uuid.test(input.destinationProjectId||"")||!uuid.test(input.destinationDocumentId||""))fail("An explicit browser-copy destination and operation UUID are required.");
    if(!loopbackOrigin(origin) || input.browser?.origin!==origin&&!browserOrigins.includes(input.browser?.origin))fail("The browser source origin is not approved for this workspace.");
    const original=browserSnapshot(input.browser,input.browser.origin),source=browserReference(original),t=await target(input);t.input=input;
    if(t.projectId!==input.destinationProjectId||t.documentId!==input.destinationDocumentId)fail("The browser-copy destination differs from its persisted owner.");
    const commandHash=hash({action:"copy-browser-carousel",input}),request={projectId:t.projectId,documentId:t.documentId,operationId:input.operationId,expectedOutput:input.expectedOutput,commandHash},prior=privateRead(t,"history",input.operationId);
    if(prior){
      if(prior.value.commandHash!==commandHash||!same(prior.value.group,group(input)))fail("Operation ID already owns another exact output request.");
      const replay=await store.saveOutputRecords(request,()=>fail("Browser copy has no matching store receipt."));
      return {...replay,view:await read({...group(input),selectedOutputId:prior.value.outputId})};
    }
    if(!same(input.expectedOutput,outputRecordsExpected(t.document)))fail("Outputs changed before the browser copy.");
    const prepared=browserOutput(original,input.operationId,new Date().toISOString());
    return native.withSnapshotLease({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId,expected:input.expectedNative},async lease=>{
      return store.saveOutputRecords(request,async({project})=>{
        const doc=project.document,id=input.operationId;if(doc.outputs.some(output=>output.id===id))fail("The browser copy needs an independent output identity.");
        const payload={schema:"ar-create.browser-carousel-copy-capture.v1",role:"immutable-browser-snapshot-not-destination-native-wording",scope:{projectId:t.projectId,documentId:t.documentId,outputId:id},ready:true,sourceLiveVerification:false,source,original,output:prepared.output,mapping:prepared.mapping};
        const captureValue={...payload,captureHash:hash(payload)},proofNow=scopedProof(await proofCatalogue(input,id),captureValue,prepared.output),privateValue={schema:"ar-create.native-output-private.v1",group:group(input),capture:captureValue,proof:proofNow},captureId=hash(JSON.stringify(privateValue)),now=prepared.output.createdAt;
        placements(prepared.output,proofNow);
        const record={outputId:id,wordOwner:{kind:"carousel-words",projectId:t.projectId,documentId:t.documentId,outputId:id},captureId,proofId:captureId,historyIds:[input.operationId],createdAt:now,updatedAt:now};
        const index=doc.nativeOutputIndex||{schema:"ar-create.native-output-index.v1",revision:0,records:[]};
        const history={schema:"ar-create.native-output-command.v1",provenance:provenance(),group:group(input),commandHash,outputId:id,captureId,beforeArrangement:null,beforeAssets:null,afterHash:hash(prepared.output),source,mapping:prepared.mapping,destination:{projectId:t.projectId,documentId:t.documentId,rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,role:"destination-location-not-word-origin"}};
        return {outputs:doc.outputs.concat(prepared.output),nativeOutputIndex:{schema:index.schema,revision:input.expectedOutput.revision+1,records:index.records.concat(record)},extraFiles:[{relativePath:privatePath(t,"captures",captureId),contents:JSON.stringify(privateValue),expectedHash:null},{relativePath:privatePath(t,"history",input.operationId),contents:JSON.stringify(history),expectedHash:null}],finalCheck:async()=>{
          const destination=await scope.resolve(group(input));if(destination.projectId!==t.projectId||destination.documentId!==t.documentId||!same(lease.reread().expected,lease.snapshot.expected))fail("The browser-copy destination changed before publication.");
          if(!same(scopedProof(await proofCatalogue(input,id),captureValue,prepared.output),proofNow))fail("Destination decision or asset proof changed before publication.");
        }};
      });
    }).then(async result=>({...result,view:await read({...group(input),selectedOutputId:input.operationId})}));
  }
  // Read-only Check inspection deliberately precedes wordsReview/export admission.
  // Sources come only from this output's immutable capture, never its parent Article.
  async function inspectCheckSnapshot(input) {
    const t=await target(input);t.input=input;
    const selected=record(t,input.selectedOutputId),output=selected.output,capture=validateCapture(selected.private,output),owner=selected.record.wordOwner;
    if(output.kind!=="carousel"||owner?.kind!=="carousel-words"||owner.projectId!==t.projectId||owner.documentId!==t.documentId||owner.outputId!==output.id)fail("Check requires this exact carousel's canonical words owner.");
    const w=await store.readCarouselWords({projectId:t.projectId,documentId:t.documentId,outputId:output.id,allowEditedMarkdown:true});
    const current=await currentProof(input,output.id,capture,output),sources=[];
    if(!independentCopy(capture))for(const row of capture.privateSidecar.nativeSnapshot.context?.records||[]){
      if(!["source","context"].includes(row.role)||row.missing||typeof row.raw!=="string")continue;
      const actual=current.sources.filter(s=>s.id===row.id&&s.role===row.role&&!s.missing&&s.hash===hash(row.raw));
      if(typeof row.raw==="string"&&actual.length===1&&row.copiedHash===hash(row.raw))sources.push({id:row.id,role:row.role,hash:hash(row.raw),raw:row.raw});
    }
    const issues=[];
    if(w.missing||w.externalEdit)issues.push({type:"integrity",severity:"held",message:"The canonical carousel words file is missing or differs from its saved owner. Resolve it in Write before checking words."});
    for(const [index,slide]of output.slides.entries()){
      const count=IG.T[slide.template]?.photos;
      if(!Number.isInteger(count)){issues.push({type:"photo",severity:"held",message:"Slide "+(index+1)+" has an unavailable layout; required photographs cannot be checked.",slideId:slide.id});continue;}
      for(let slot=0;slot<count;slot++){const src=slide.photos?.[slot]?.src;
        if(!src)issues.push({type:"photo",severity:"review",message:"Slide "+(index+1)+" is missing photograph "+(slot+1)+".",slideId:slide.id});
      }
    }
    for(const asset of current.assets||[])if(asset.missing||!asset.hash)issues.push({type:"photo",severity:"held",message:"A selected Library photograph is unavailable. Reconnect that exact photograph in Media."});
    if(!same(current,selected.private.proof))issues.push({type:"source",severity:"held",message:"Captured source, decision or photograph evidence has changed; this is a check of current available evidence, not renewed approval."});
    const fields=output.slides.flatMap((slide,index)=>["text","label","credit"].map(field=>({slideId:slide.id,slideNumber:index+1,field,raw:field==="label"?(slide.label??output.importedDraft?.label??output.title??""):(slide[field]??"")}))).concat([{slideId:null,field:"caption",raw:output.caption??""}]);
    if(fields.some(f=>typeof f.raw!=="string"))fail("Unsupported carousel field content.");
    return {output:clone(output),raw:w.raw??"",expected:{expectedOutput:outputRecordsExpected(t.document),expectedWords:clone(w.expected)},sources,fields,issues,proof:{targetKind:"carousel",bindingId:input.rootBindingId,parentStudyId:input.parentStudyId,outputId:output.id,projectId:t.projectId,documentId:t.documentId,outputHash:hash(output),markdownHash:w.expected.markdownHash,wordsHash:await helpers.carouselWordsHash(output),missing:!!w.missing,externalEdit:!!w.externalEdit,sourceProof:current,sources:sources.map(({id,role,hash})=>({id,role,hash}))}};
  }
  async function withExportSnapshot(input, fn) {
    if (typeof fn !== "function") fail("Trusted export publication callback required.");
    const t = await target(input);
    t.input = input;
    const selected = record(t, input.selectedOutputId);
    if (!same(input.expectedOutput, outputRecordsExpected(t.document))) fail("Exact current output export revision/hash required.");
    const languageEditionReview=await languageReview(input,t,selected.output);
    const capturedProof = await currentProof(input, selected.output.id, selected.private.capture, selected.output);
    if (!same(capturedProof, selected.private.proof)) fail("Shared proof changed; export held.");
    const captureValue = validateCapture(selected.private, selected.output);
    const structureCopy = selected.output.kind === "carousel" && (await native.read({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId})).binding?.origin === "structure-test";
    if((independentCopy(captureValue)||structureCopy)&&(selected.output.stage!=="look"||selected.output.wordsReview?.hash!==await helpers.carouselWordsHash(selected.output)))fail("Review this copy's own saved words before exporting.");
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
        return await fn({ projectId:t.projectId, documentId:t.documentId, output: clone(selected.output), wordOwner: clone(selected.record.wordOwner), expectedOutput: clone(input.expectedOutput), wordsReviewDecision:reviewDecision(t,selected,input), assetProof:clone(capturedProof.assets),...(languageEditionReview?{languageEditionReview}:{}),sourceProofHash:hash(capturedProof), finalCheck });
      } finally {
        active = false;
      }
    };
    return textKind(selected.output.kind) ? native.withSnapshotLease({ bindingId: selected.record.wordOwner.bindingId, parentStudyId: input.parentStudyId, expected: input.expectedNative }, run) : run(null);
  }
  async function acceptCarouselProposal({scope:proposalScope,expected,candidate,requestId,binding},finalCheck,{beforeIntent}={}){
    requireHuman("Accepting native Carousel wording");if(!currentActor())throw Object.assign(Error("An explicit human actor must accept native Carousel wording."),{status:403});if(!uuid.test(requestId||"")||typeof finalCheck!=="function"||candidate?.kind!=="carousel"||candidate.id!==proposalScope?.outputId||binding?.requestId!==requestId)fail("Exact reviewed native Carousel proposal required.");
    const input={rootBindingId:proposalScope.rootBindingId,parentStudyId:proposalScope.parentStudyId,selectedOutputId:proposalScope.outputId},snapshot=await inspectCheckSnapshot(input);
    if(snapshot.proof.projectId!==proposalScope.projectId||snapshot.proof.documentId!==proposalScope.documentId||!same(snapshot.expected,expected))fail("The reviewed native Carousel owner or words changed.");
    const before=snapshot.output;
    if(!same(before.slides.map(({text,credit,label,role,...slide})=>slide),candidate.slides.map(({text,credit,label,role,...slide})=>slide)))fail("A wording proposal cannot move photographs, slide IDs or arrangement.");
    return mutate("save",{...input,operationId:requestId,expectedOutput:expected.expectedOutput,changes:{slides:clone(candidate.slides),caption:candidate.caption}},{requestId,binding,expectedWords:expected.expectedWords,finalCheck,...(beforeIntent?{beforeIntent}:{})});
  }
  return { read, inspectCheckSnapshot, acceptCarouselProposal, copyRetainedCarousel, copyBrowserCarousel, create: (i) => mutate("create", i), standInCreate: (i) => mutate("create", i, null, true), save: (i) => mutate("save", i), standInSave: (i) => mutate("save", i, null, true), reviewCarouselWords: (i) => mutate("review", i), standInReviewCarouselWords: (i) => mutate("review", i, null, true), refreshSelectedArticle: (i) => mutate("refresh", i), standInRefresh: (i) => mutate("refresh", i, null, true), undo: (i) => mutate("undo", i), undoCarouselWords: (i) => mutate("undo-words", i), withExportSnapshot, assertExport: (i) => withExportSnapshot(i, async ({ output, wordOwner, expectedOutput }) => ({ output, wordOwner, expectedOutput })) };
}
export {
  createNativeOutputOwner
};
