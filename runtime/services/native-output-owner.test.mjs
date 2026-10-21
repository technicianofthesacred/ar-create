var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// services/native-output-owner.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs10 from "node:fs";
import os2 from "node:os";
import path12 from "node:path";
import { randomUUID as randomUUID7, createHash as createHash10 } from "node:crypto";

// store.mjs
import { mkdir as mkdir2, readFile as readFile2, open as open2, rename, unlink as unlink2, lstat as lstat2, readdir, link } from "node:fs/promises";
import path2 from "node:path";
import { randomUUID as randomUUID2, createHash as createHash3 } from "node:crypto";
import { constants } from "node:fs";
import { existsSync as existsSync2 } from "node:fs";

// article-persistence.mjs
import { mkdir, lstat, readFile, open, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

// src/donors/wordforge/wf-block-serialize.mjs
import { fromMarkdown } from "mdast-util-from-markdown";

// src/donors/wordforge/passage-links.mjs
function safePassageHref(value) {
  if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f<>]/u.test(value)) return false;
  if (value.startsWith("#")) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (/^https?:/i.test(value)) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
    } catch {
      return false;
    }
  }
  return /^(mailto|tel):[^:]/i.test(value);
}

// src/donors/wordforge/wf-markdown-options.mjs
var PARSE_OPTIONS = {
  extensions: [{
    disable: {
      null: [
        "autolink",
        "labelStartLink",
        "labelStartImage",
        "labelEnd",
        "definition",
        "codeIndented",
        "codeFenced",
        "htmlFlow",
        "htmlText",
        "thematicBreak",
        "setextUnderline",
        "characterReference"
      ]
    }
  }]
};
var LINK_PARSE_OPTIONS = { extensions: [{ disable: { null: PARSE_OPTIONS.extensions[0].disable.null.filter((name) => !["labelStartLink", "labelEnd"].includes(name)) } }] };

// src/donors/wordforge/wf-block-serialize.mjs
function escapeInline(text4) {
  let out = "";
  for (let i = 0; i < text4.length; i += 1) {
    const ch = text4[i];
    const prev = text4[i - 1] ?? " ";
    const next = text4[i + 1] ?? " ";
    const floating = /\s/.test(prev) && /\s/.test(next);
    if (ch === "\\" && /[!-/:-@[-`{-~]/.test(next)) out += "\\\\";
    else if (ch === "`") out += "\\`";
    else if (ch === "*" && !floating) out += "\\*";
    else if (ch === "_" && !floating && !(/\w/.test(prev) && /\w/.test(next))) out += "\\_";
    else out += ch;
  }
  return out;
}
function escapeLineStart(line) {
  return line.replace(/^(\s*)(#{1,6}(?=\s|$)|[-+*](?=\s)|\d{1,9}[.)](?=\s)|>)/, "$1\\$2");
}
var MARK_ORDER = ["link", "bold", "italic", "code"];
function linkDestination(mark) {
  const href = String(mark.attrs?.href || ""), title = mark.attrs?.title ?? null, original = mark.attrs?.markdownDestination;
  if (typeof original === "string") {
    const parsed = fromMarkdown("[x" + original, LINK_PARSE_OPTIONS).children[0], link2 = parsed?.children?.[0];
    if (parsed?.children?.length === 1 && link2?.type === "link" && link2.position?.end.offset === original.length + 2 && link2.url === href && (link2.title ?? null) === title) return original;
  }
  const url = /[()]/.test(href) ? "<" + href + ">" : href;
  return "](" + url + (typeof title === "string" ? ' "' + title.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"' : "") + ")";
}
function closingFor(mark) {
  return mark.type === "link" ? linkDestination(mark) : delimiterFor(mark);
}
function delimiterFor(mark) {
  if (mark.type === "link") return "[";
  if (mark.type === "bold") return mark.attrs?.markup === "__" ? "__" : "**";
  if (mark.type === "italic") return mark.attrs?.markup === "*" ? "*" : "_";
  if (mark.type === "code") return "`";
  return "";
}
function sameMark(a, b) {
  return a.type === b.type && (a.type === "link" ? a.attrs?.href === b.attrs?.href && (a.attrs?.title ?? null) === (b.attrs?.title ?? null) && a.attrs?.markdownDestination === b.attrs?.markdownDestination : delimiterFor(a) === delimiterFor(b));
}
function sharedPrefix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && sameMark(a[n], b[n])) n += 1;
  return n;
}
function runsOf(nodes) {
  const runs = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push({ brk: true });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const marks = node.text.trim() === "" ? [] : [...node.marks ?? []].filter((mark) => MARK_ORDER.includes(mark.type) && (mark.type !== "link" || safePassageHref(mark.attrs?.href))).sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
    const last = runs[runs.length - 1];
    if (last && "text" in last && last.marks.length === marks.length && sharedPrefix(last.marks, marks) === marks.length) {
      last.text += node.text;
    } else {
      runs.push({ text: node.text, marks });
    }
  }
  return runs;
}
function serializeInline(nodes) {
  const runs = runsOf(nodes);
  let out = "";
  const active = [];
  const closeTo = (depth) => {
    while (active.length > depth) out += closingFor(active.pop());
  };
  runs.forEach((run, index) => {
    if ("brk" in run) {
      closeTo(0);
      out += "\n";
      return;
    }
    let text4 = run.text;
    closeTo(sharedPrefix(active, run.marks));
    const opening = run.marks.slice(active.length);
    if (opening.length) {
      const leading = text4.match(/^\s+/)?.[0] ?? "";
      out += leading;
      text4 = text4.slice(leading.length);
    }
    for (const mark of opening) {
      out += delimiterFor(mark);
      active.push(mark);
    }
    const next = runs[index + 1];
    const keepAfter = next && "text" in next ? sharedPrefix(active, next.marks) : 0;
    const trailing = active.length > keepAfter ? text4.match(/\s+$/)?.[0] ?? "" : "";
    const body = trailing ? text4.slice(0, -trailing.length) : text4;
    const escaped = escapeInline(body);
    out += active.some((mark) => mark.type === "code") ? body : active.some((mark) => mark.type === "link") ? escaped.replace(/[\[\]]/g, "\\$&") : escaped;
    closeTo(keepAfter);
    out += trailing;
  });
  closeTo(0);
  return out;
}
function inlineOf(node) {
  return serializeInline(node.content ?? []).split("\n").map(escapeLineStart).join("\n");
}
function indentContinuation(text4, indent) {
  return text4.split("\n").map((line, i) => i === 0 || line === "" ? line : indent + line).join("\n");
}
function serializeBlock(node) {
  switch (node.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${inlineOf(node)}`;
    }
    case "bulletList":
    case "orderedList": {
      const tight = node.attrs?.tight !== false;
      const start = Number(node.attrs?.start ?? 1);
      const items = (node.content ?? []).map((item, i) => {
        const marker = node.type === "bulletList" ? "- " : `${start + i}. `;
        return marker + indentContinuation(serializeBlocks(item.content ?? []), " ".repeat(marker.length));
      });
      return items.join(tight ? "\n" : "\n\n");
    }
    case "blockquote":
      return serializeBlocks(node.content ?? []).split("\n").map((line) => line ? `> ${line}` : ">").join("\n");
    case "paragraph":
    default:
      return inlineOf(node);
  }
}
function separatorFor(node, previous) {
  if (!previous) return "";
  const sep = node.attrs?.sep ?? null;
  if (sep === "line") return "\n";
  if (sep === "blank") return "\n\n";
  return previous.type === "heading" && node.type === "paragraph" ? "\n" : "\n\n";
}
function serializeBlocks(nodes) {
  let out = "";
  let previous = null;
  for (const node of nodes) {
    out += separatorFor(node, previous) + serializeBlock(node);
    previous = node;
  }
  return out;
}
function docToMarkdown(doc) {
  return serializeBlocks(doc.content ?? []);
}

// src/workspaces/structured-markdown.mjs
function structuredMarkdown(doc) {
  const copy = structuredClone(doc);
  const visit = (node) => {
    if (node.type === "referenceCard") {
      node.type = "paragraph";
      node.content = [{ type: "text", text: `[Reference: ${node.attrs?.sourceTitle || ""}] ${node.attrs?.text || ""}` }];
    }
    if (node.type === "blockquoteAttributed") {
      node.type = "blockquote";
      node.content = [{ type: "paragraph", content: node.content || [] }, { type: "paragraph", content: [{ type: "text", text: `\u2014 ${node.attrs?.author || node.attrs?.sourceTitle || "Source"}` }] }];
    }
    node.content?.forEach(visit);
  };
  visit(copy);
  return docToMarkdown(copy);
}

// src/workspaces/shared-carousel-words.mjs
var CAROUSEL_WORDS_SCHEMA = "ar-create.carousel-words.v1";
var CAROUSEL_WORDS_LIMITS = Object.freeze({ maxBytes: 1024 * 1024, maxSlides: 40, maxFieldCharacters: 2e4, maxIdentityCharacters: 240 });
var bytes = (value) => new TextEncoder().encode(value);
var own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
var slidesOf = (output) => own(output, "slides") ? output.slides : [];
var fail = (message) => {
  throw new Error(message + " No carousel changes were applied.");
};
function wellFormed(value) {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 55296 && unit <= 56319) {
      const next = value.charCodeAt(++index);
      if (!(next >= 56320 && next <= 57343)) fail("Ill-formed Unicode: a lone surrogate cannot be written losslessly.");
    } else if (unit >= 56320 && unit <= 57343) fail("Ill-formed Unicode: a lone surrogate cannot be written losslessly.");
  }
  return value;
}
function identity(value, name) {
  if (typeof value !== "string" || !value || value.length > CAROUSEL_WORDS_LIMITS.maxIdentityCharacters || /[\u0000-\u001f\u007f]/.test(value)) fail("Invalid " + name + " identity.");
  return wellFormed(value);
}
function words(value, name, optional = false) {
  if (optional && value == null) return "";
  if (typeof value !== "string") fail("The " + name + " must be a string.");
  if (value.length > CAROUSEL_WORDS_LIMITS.maxFieldCharacters) fail("The " + name + " exceeds the supported length limit.");
  return wellFormed(value);
}
function role(value) {
  if (typeof value !== "string" || value.length > 240 || /[\u0000-\u001f\u007f]/.test(value)) fail("The slide role must be a string of at most 240 characters.");
  return wellFormed(value);
}
function effectiveLabel(output, slide) {
  return words(slide.label ?? output.importedDraft?.label ?? output.title ?? "", "small heading");
}
function validateOutput(output) {
  if (!output || output.kind !== "carousel") fail("Choose an existing carousel output.");
  identity(output.id, "output");
  const slides = slidesOf(output);
  if (!Array.isArray(slides) || slides.length > CAROUSEL_WORDS_LIMITS.maxSlides) fail("An existing carousel must have 0\u201340 slides.");
  const ids = /* @__PURE__ */ new Set();
  for (const slide of slides) {
    if (!slide || typeof slide !== "object") fail("Invalid existing slide identity.");
    identity(slide.id, "slide");
    if (ids.has(slide.id)) fail("Duplicate existing slide identity " + slide.id + ".");
    ids.add(slide.id);
    role(slide.role ?? "");
    words(slide.text, "slide text");
    words(slide.credit, "slide credit", true);
    if (slide.label != null) words(slide.label, "slide label");
    effectiveLabel(output, slide);
  }
  words(output.caption, "caption", true);
}
function carouselWordsManifest(projectId, documentId, output) {
  identity(projectId, "project");
  identity(documentId, "document");
  validateOutput(output);
  return { schema: CAROUSEL_WORDS_SCHEMA, projectId, documentId, outputId: output.id, outputRevision: output.outputRevision ?? 0, words: verbalRecord(output) };
}
function verbalRecord(output) {
  return { slides: slidesOf(output).map((slide) => ({ id: slide.id, role: slide.role ?? "", text: slide.text, credit: slide.credit ?? "", label: effectiveLabel(output, slide), labelMode: slide.label == null ? "inherited" : "explicit" })), caption: output.caption ?? "" };
}
function metadata(tag, value) {
  return "<!-- " + tag + ":" + JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e") + " -->\n";
}
function block(heading, value) {
  const runs = value.match(/`+/g) || [], fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return "### " + heading + "\n" + fence + "text\n" + value + "\n" + fence + "\n\n";
}
function renderCarouselWords(projectId, documentId, output) {
  const manifest = carouselWordsManifest(projectId, documentId, output);
  let raw = metadata("ar-carousel-words", { schema: manifest.schema, projectId, documentId, outputId: output.id }) + "# Carousel words\n\n";
  for (const slide of slidesOf(output)) {
    raw += "## Slide\n" + metadata("ar-carousel-slide", { id: slide.id, role: slide.role ?? "", labelMode: slide.label == null ? "inherited" : "explicit" }) + "\n";
    raw += block("Words", slide.text) + block("Small heading", effectiveLabel(output, slide)) + block("Credit", slide.credit ?? "");
  }
  raw += "## Caption\n\n" + block("Caption", output.caption ?? "") + "<!-- ar-carousel-end -->\n";
  if (bytes(raw).length > CAROUSEL_WORDS_LIMITS.maxBytes) fail("The carousel Markdown exceeds the 1 MB size limit.");
  return raw;
}

// article-persistence.mjs
var articleHash = (value) => createHash("sha256").update(value).digest("hex");
var json = (value) => JSON.stringify(value);
var encodedArticleIdentity = (value) => encodeURIComponent(value);
var identity2 = encodedArticleIdentity;
function renderProjectArticle(project) {
  const document = project.document;
  if (!document) return `<!-- ar-create:article v1 project=${identity2(project.id)} document=legacy -->
# ${project.title}

${project.draft}

<!-- ar-create:end -->
`;
  return renderArticle(document, project.id);
}
function renderArticle(document, projectId) {
  return `<!-- ar-create:article v1 project=${identity2(projectId)} document=${identity2(document.id)} -->
# ${document.title}

` + document.paragraphs.map((paragraph) => `<!-- ar-create:passage ${identity2(paragraph.id)} -->
${structuredMarkdown(paragraph.doc)}

`).join("") + "<!-- ar-create:end -->\n";
}
function articlePaths(dataDir, project) {
  const directory2 = path.join(dataDir, "articles", articleHash(project.id), articleHash(project.document?.id || "legacy"));
  return { directory: directory2, markdown: path.join(directory2, "article.md"), companion: path.join(directory2, "article.json") };
}
function carouselWordsPaths(dataDir, project, output) {
  const directory2 = path.join(articlePaths(dataDir, project).directory, "carousels", articleHash(output.id));
  return { directory: directory2, markdown: path.join(directory2, "words.md"), companion: articlePaths(dataDir, project).companion };
}
function articleBytes(project) {
  const raw = renderProjectArticle(project);
  return { raw, companion: json({ schema: "ar-create.article-bundle.v1", carouselWordsVersion: 1, projectId: project.id, documentId: project.document?.id || null, projectHash: articleHash(json(project)), markdownHash: articleHash(raw), project }) };
}
async function createArticlePersistence({ dataDir, atomicWrite: atomicWrite3, StateError: StateError2, fault }) {
  dataDir = path.resolve(dataDir);
  const journal = path.join(dataDir, "article-publication.pending.json"), ownerFile = path.join(dataDir, "article-owner.json");
  const owner = { schema: "ar-create.article-owner.v1", pid: process.pid, id: randomUUID() };
  const fail10 = (message) => {
    throw new StateError2(message, 409);
  };
  async function safeDirectory(directory2) {
    const relative2 = path.relative(dataDir, directory2);
    if (relative2.startsWith("..") || path.isAbsolute(relative2)) fail10("Article path is outside owned storage.");
    let current = dataDir;
    for (const part2 of [".", ...relative2.split(path.sep).filter(Boolean)]) {
      current = path.resolve(current, part2);
      try {
        await mkdir(current, { mode: 448 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail10("Article directories must be real private directories.");
    }
  }
  async function bytes4(file) {
    await safeDirectory(path.dirname(file));
    try {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail10("Article publication requires ordinary private files.");
      return await readFile(file);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  async function acquire() {
    try {
      await atomicWrite3(ownerFile, json(owner), { exclusive: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const current = JSON.parse((await bytes4(ownerFile)).toString());
      if (current.schema !== owner.schema || !Number.isSafeInteger(current.pid)) fail10("Article owner record needs inspection.");
      let alive = true;
      try {
        process.kill(current.pid, 0);
      } catch (error2) {
        if (error2.code === "ESRCH") alive = false;
        else throw error2;
      }
      if (alive) fail10("Shared articles already have a cooperating store owner. Close that owner before starting another writer.");
      await unlink(ownerFile);
      await atomicWrite3(ownerFile, json(owner), { exclusive: true });
    }
  }
  async function assertOwner() {
    const current = await bytes4(ownerFile);
    if (!current || current.toString() !== json(owner)) fail10("Shared article owner changed; publication stopped.");
  }
  const packed = (raw) => raw === null ? null : { base64: raw.toString("base64"), hash: articleHash(raw) };
  function unpack(value) {
    if (value === null) return null;
    if (!value || typeof value.base64 !== "string" || !/^[a-f0-9]{64}$/.test(value.hash)) fail10("Article journal bytes are damaged.");
    const raw = Buffer.from(value.base64, "base64");
    if (raw.toString("base64") !== value.base64 || articleHash(raw) !== value.hash) fail10("Article journal bytes are damaged.");
    return raw;
  }
  const same4 = (a, b) => a === null ? b === null : b !== null && a.equals(b);
  function allowed(relative2) {
    return /^native-outputs\/operations\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/receipt\.json$/.test(relative2) || /^native-outputs\/[a-f0-9]{64}\/[a-f0-9]{64}\/(captures|history)\/[A-Za-z0-9_-]{1,128}\.json$/.test(relative2) || /^article-make\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/decision\.json$/.test(relative2) || /^shared-carousel-requests\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/decision\.json$/.test(relative2) || /^shared-article-requests\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/decision\.json$/.test(relative2) || ["state.json", "state.backup.json", "state.pieces-migration.backup.json"].includes(relative2) || /^pieces\/[a-f0-9]{64}\.json$/.test(relative2) || /^articles\/[a-f0-9]{64}\/[a-f0-9]{64}\/article\.(md|json)$/.test(relative2) || /^articles\/[a-f0-9]{64}\/[a-f0-9]{64}\/carousels\/[a-f0-9]{64}\/words\.md$/.test(relative2);
  }
  async function syncDirectory() {
    const handle = await open(dataDir, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  async function recover() {
    await assertOwner();
    const raw = await bytes4(journal);
    if (raw === null) return false;
    let intent;
    try {
      intent = JSON.parse(raw.toString());
    } catch {
      fail10("Article journal is damaged; all files were preserved.");
    }
    if (intent.schema !== "ar-create.article-publication.v1" || !Array.isArray(intent.files) || !intent.files.length || new Set(intent.files.map((entry) => entry.path)).size !== intent.files.length) fail10("Article journal is damaged; all files were preserved.");
    const entries = intent.files.map((entry) => {
      if (!allowed(entry.path)) fail10("Article journal path is invalid.");
      return { ...entry, old: unpack(entry.old), next: unpack(entry.next), file: path.join(dataDir, entry.path) };
    });
    for (const entry of entries) {
      const current = await bytes4(entry.file);
      if (!same4(current, entry.old) && !same4(current, entry.next)) fail10("Interrupted article publication found external edits; all files were preserved.");
    }
    for (const entry of entries) {
      const current = await bytes4(entry.file);
      if (same4(current, entry.next)) continue;
      if (entry.next === null) {
        await unlink(entry.file);
      } else await atomicWrite3(entry.file, entry.next);
    }
    await unlink(journal);
    await syncDirectory();
    return { files: entries.map((entry) => [entry.file, entry.next]) };
  }
  async function publish(files, { expectedFiles = /* @__PURE__ */ new Map() } = {}) {
    await assertOwner();
    if (existsSync(journal)) fail10("An interrupted article publication must recover before saving.");
    const prepared = [];
    for (const [file, value] of files) {
      const relative2 = path.relative(dataDir, file).split(path.sep).join("/");
      if (!allowed(relative2)) fail10("Publication path is outside the allowed bundle files.");
      const old = await bytes4(file), next = value === null ? null : Buffer.from(value);
      if (expectedFiles.has(file)) {
        const expected = expectedFiles.get(file);
        if ((old === null ? null : articleHash(old)) !== expected) fail10("A bundle changed after inspection; existing files were preserved.");
      }
      prepared.push({ path: relative2, old: packed(old), next: packed(next) });
    }
    const intent = { schema: "ar-create.article-publication.v1", id: randomUUID(), files: prepared };
    await atomicWrite3(journal, json(intent), { exclusive: true });
    await fault?.("after-intent", intent);
    for (const [index, entry] of prepared.entries()) {
      const file = path.join(dataDir, entry.path);
      if (!same4(await bytes4(file), unpack(entry.old))) fail10("A file changed during article publication; recovery requires inspection.");
      const next = unpack(entry.next);
      if (!same4(unpack(entry.old), next)) {
        if (next === null) {
          if (entry.old !== null) await unlink(file);
        } else await atomicWrite3(file, next);
      }
      await fault?.(`after-file:${index}`, intent);
    }
    await fault?.("before-complete", intent);
    await unlink(journal);
    await syncDirectory();
    await fault?.("after-complete", intent);
  }
  async function checkPublished(files) {
    await assertOwner();
    for (const [file, value] of files) if (!same4(await bytes4(file), value === null ? null : Buffer.from(value))) fail10("A completed article publication found external edits; all files were preserved.");
  }
  async function readArticle(project, { allowEditedMarkdown = false } = {}) {
    await assertOwner();
    const paths = articlePaths(dataDir, project), raw = await bytes4(paths.markdown), metadata3 = await bytes4(paths.companion);
    if (raw === null || metadata3 === null) fail10("Article bundle is partial or missing; existing files were preserved.");
    const canonical3 = articleBytes(project);
    const legacy = JSON.parse(canonical3.companion);
    delete legacy.carouselWordsVersion;
    if (metadata3.toString() !== canonical3.companion && metadata3.toString() !== json(legacy)) fail10("Article metadata diverged from its saved piece; existing files were preserved.");
    const externalEdit = !raw.equals(Buffer.from(canonical3.raw));
    if (externalEdit && !allowEditedMarkdown) fail10("Article Markdown has external edits. Prepare an explicit reviewed proposal before saving.");
    return { project: structuredClone(project), document: structuredClone(project.document || null), raw: raw.toString("utf8"), paths, externalEdit, expected: { projectId: project.id, documentId: project.document?.id || null, projectHash: articleHash(json(project)), markdownHash: articleHash(raw), companionHash: articleHash(metadata3) } };
  }
  async function checkArticle(project, expected) {
    const current = await readArticle(project, { allowEditedMarkdown: !!expected });
    if (expected && json(expected) !== json(current.expected)) fail10("Article bundle changed since it was read. Refresh before saving.");
    return current;
  }
  function carouselOutputs(project) {
    const outputs = (project.document?.outputs || []).filter((output) => output.kind === "carousel"), ids = /* @__PURE__ */ new Set();
    for (const output of outputs) {
      if (typeof output.id !== "string" || !output.id.trim() || ids.has(output.id)) fail10("Carousel wording files require unique output IDs.");
      ids.add(output.id);
    }
    return outputs;
  }
  function carouselFiles(project) {
    return carouselOutputs(project).map((output) => [carouselWordsPaths(dataDir, project, output).markdown, renderCarouselWords(project.id, project.document.id, output)]);
  }
  async function retainedCarouselWordsHash(project, file) {
    const entry = carouselFiles(project).find(([destination]) => destination === file);
    if (!entry) return null;
    const current = await bytes4(file);
    if (current === null) return null;
    if (!current.equals(Buffer.from(entry[1]))) fail10("A bundle changed after inspection; retained carousel words were preserved.");
    return articleHash(current);
  }
  async function readCarouselWords(project, { documentId, outputId, allowEditedMarkdown = false } = {}) {
    await assertOwner();
    if (!project.document || project.document.id !== documentId) fail10("Carousel document identity changed. Refresh before reading.");
    const output = carouselOutputs(project).find((output2) => output2.id === outputId);
    if (!output) throw new StateError2("Carousel output was not found.", 404);
    const article = await readArticle(project, { allowEditedMarkdown: true }), paths = carouselWordsPaths(dataDir, project, output), raw = await bytes4(paths.markdown);
    const canonical3 = renderCarouselWords(project.id, project.document.id, output), externalEdit = raw === null || !raw.equals(Buffer.from(canonical3));
    if (externalEdit && !allowEditedMarkdown) fail10("Carousel Markdown has external edits. Prepare an explicit reviewed proposal before saving.");
    return { project: structuredClone(project), document: structuredClone(project.document), output: structuredClone(output), raw: raw?.toString("utf8") ?? null, bytes: raw, missing: raw === null, paths, externalEdit, expected: { projectId: project.id, documentId: project.document.id, outputId: output.id, projectHash: article.expected.projectHash, outputHash: articleHash(json(output)), markdownHash: raw === null ? null : articleHash(raw), companionHash: article.expected.companionHash } };
  }
  async function checkCarouselWords(project, expectedCarousel) {
    const outputs = carouselOutputs(project), selected = expectedCarousel && expectedCarousel.projectId === project.id && expectedCarousel.documentId === project.document?.id && outputs.some((output) => output.id === expectedCarousel.outputId);
    if (expectedCarousel && !selected) fail10("Carousel reconciliation must bind an exact existing output.");
    const results = [];
    for (const output of outputs) {
      const bound = expectedCarousel?.projectId === project.id && expectedCarousel?.documentId === project.document.id && expectedCarousel?.outputId === output.id;
      const current = await readCarouselWords(project, { documentId: project.document.id, outputId: output.id, allowEditedMarkdown: !!selected });
      if (bound && json(current.expected) !== json(expectedCarousel)) fail10("Carousel bytes changed since review; capture the latest bytes before deciding.");
      results.push(current);
    }
    return results;
  }
  function articleFiles(project) {
    const paths = articlePaths(dataDir, project), value = articleBytes(project);
    return [[paths.markdown, value.raw], [paths.companion, value.companion]];
  }
  function bundleFiles(project) {
    return [...articleFiles(project), ...carouselFiles(project)];
  }
  async function bootstrap(projects, files = [], { expectedFiles = /* @__PURE__ */ new Map() } = {}) {
    const additions = [...files];
    for (const project of projects) {
      const paths = articlePaths(dataDir, project), raw = await bytes4(paths.markdown), metadata3 = await bytes4(paths.companion);
      if (raw === null && metadata3 === null) additions.push(...articleFiles(project));
      else await readArticle(project, { allowEditedMarkdown: true });
      const migrated = metadata3 !== null && JSON.parse(metadata3.toString()).carouselWordsVersion === 1;
      if (!migrated) {
        for (const [file, value] of carouselFiles(project)) {
          if (await bytes4(file) === null) additions.push([file, value]);
        }
        if (metadata3 !== null) {
          additions.push([paths.companion, articleBytes(project).companion]);
          expectedFiles.set(paths.companion, articleHash(metadata3));
        }
      }
    }
    if (additions.length) await publish(additions, { expectedFiles: new Map(additions.map(([file]) => [file, expectedFiles.has(file) ? expectedFiles.get(file) : null])) });
  }
  await acquire();
  try {
    await recover();
  } catch (error) {
    await unlink(ownerFile);
    throw error;
  }
  return { journal, publish, recover, checkPublished, readArticle, checkArticle, readCarouselWords, checkCarouselWords, retainedCarouselWordsHash, bundleFiles, bootstrap, async close() {
    await assertOwner();
    await unlink(ownerFile);
    await syncDirectory();
  } };
}

// output-records.mjs
import { createHash as createHash2 } from "node:crypto";
var hash = (value) => createHash2("sha256").update(value).digest("hex");
var exact = (value, keys, optional = []) => value && typeof value === "object" && !Array.isArray(value) && keys.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys.includes(key) || optional.includes(key));
var opaque = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
var outputRecordsExpected = (document) => ({ revision: document.nativeOutputIndex?.revision ?? 0, hash: hash(JSON.stringify({ outputs: document.outputs, nativeOutputIndex: document.nativeOutputIndex ?? null })) });
function validateOutputIndex(value, outputs, StateError2) {
  const fail10 = (message) => {
    throw new StateError2(message);
  };
  if (!exact(value, ["schema", "revision", "records"]) || value.schema !== "ar-create.native-output-index.v1" || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.records) || value.records.length > 100) fail10("Native output index requires bounded pointer metadata.");
  const ids = /* @__PURE__ */ new Set();
  for (const record of value.records) {
    if (!exact(record, ["outputId", "wordOwner", "captureId", "proofId", "historyIds", "createdAt", "updatedAt"]) || !["outputId", "captureId", "proofId"].every((key) => opaque(record[key])) || !Array.isArray(record.historyIds) || record.historyIds.length > 100 || !record.historyIds.every(opaque) || new Set(record.historyIds).size !== record.historyIds.length || !["createdAt", "updatedAt"].every((key) => typeof record[key] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(record[key]) && Number.isFinite(Date.parse(record[key])))) fail10("Native output records contain only IDs and history dates.");
    const owner = record.wordOwner;
    if (!(exact(owner, ["kind", "bindingId", "parentStudyId"]) && owner.kind === "native" && opaque(owner.bindingId) && opaque(owner.parentStudyId)) && !(exact(owner, ["kind", "projectId", "documentId", "outputId"]) && owner.kind === "carousel-words" && ["projectId", "documentId", "outputId"].every((key) => typeof owner[key] === "string" && owner[key].trim()) && owner.outputId === record.outputId)) fail10("Output wording owner must be an explicit native or carousel pointer.");
    if (["article", "post", "product-listing"].includes(outputs.find((output) => output.id === record.outputId)?.kind) && owner.kind !== "native") fail10("Article words require a native owner.");
    if (ids.has(record.outputId) || !outputs.some((output) => output.id === record.outputId)) fail10("Native output pointers require unique existing outputs.");
    ids.add(record.outputId);
  }
  if (ids.size !== outputs.length) fail10("Every persisted output requires its own metadata pointer.");
  return value;
}
function outputPrivatePrefix(projectId, documentId) {
  return `native-outputs/${hash(projectId)}/${hash(documentId)}/`;
}
function outputOperationInputHash(input) {
  return hash(JSON.stringify({ projectId: input.projectId, documentId: input.documentId, expectedOutput: { revision: input.expectedOutput.revision, hash: input.expectedOutput.hash }, operationId: input.operationId, commandHash: input.commandHash }));
}

// src/workspaces/article-composition.mjs
var ARTICLE_COMPOSITION_SCHEMA = "ar-create.article-composition.v1";
function articleCompositionIssue(value, paragraphs, placements = []) {
  const fail10 = (message) => {
    throw new Error(message);
  };
  const object = (v, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !keys.includes(k))) fail10("Invalid article layout fields.");
  };
  const text4 = (v, max = 256) => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  const list = (v) => {
    if (!Array.isArray(v) || v.length > 5e3) fail10("Invalid article layout list.");
  };
  const optionalBool = (v, key) => {
    if (v[key] !== void 0 && typeof v[key] !== "boolean") fail10("Invalid article layout option.");
  };
  const aspect = (v) => {
    if (v !== void 0 && (!text4(v, 32) || !/^[1-9]\d*(?:\.\d+)?\/[1-9]\d*(?:\.\d+)?$/.test(v))) fail10("Invalid article photo aspect.");
  };
  try {
    object(value, ["schema", "form", "hookId", "introId", "closingId", "portraitSlot", "opening", "parts", "ending"]);
    if (value.schema !== ARTICLE_COMPOSITION_SCHEMA || value.form !== void 0 && !["story", "conversation"].includes(value.form)) fail10("Unknown article layout format.");
    const ids = new Set(paragraphs.map((p) => p.id)), slots = new Set(placements.map((p) => p.slot));
    if (ids.size !== paragraphs.length || slots.size !== placements.length) fail10("Article identities must be unique.");
    const usedIds = /* @__PURE__ */ new Set(), usedSlots = /* @__PURE__ */ new Set();
    const passage = (id2) => {
      if (!text4(id2) || !ids.has(id2)) fail10("Article layout references a missing accepted passage.");
      if (usedIds.has(id2)) fail10("Article layout repeats an accepted passage.");
      usedIds.add(id2);
    };
    const photo = (slot) => {
      if (!text4(slot) || !slots.has(slot)) fail10("Article layout references a photo slot it does not own.");
      if (usedSlots.has(slot)) fail10("Article layout repeats a photo slot.");
      usedSlots.add(slot);
    };
    const walk = (blocks, depth = 0, wordsOnly = false) => {
      list(blocks);
      if (depth > 8) fail10("Article layout is nested too deeply.");
      for (const b of blocks) {
        if (!b || typeof b !== "object") fail10("Invalid article block.");
        if (wordsOnly && !["q", "a", "n", "line"].includes(b.kind)) fail10("Side and glyph frames contain words only.");
        switch (b.kind) {
          case "q":
          case "a":
          case "n":
            object(b, ["kind", "paragraphId"]);
            passage(b.paragraphId);
            break;
          case "line":
            object(b, ["kind", "paragraphId", "size", "followId"]);
            passage(b.paragraphId);
            if (!["xl", "l", "m"].includes(b.size)) fail10("Invalid article line size.");
            if (b.followId !== void 0) passage(b.followId);
            break;
          case "side":
            object(b, ["kind", "slot", "flip", "bleed", "blocks"]);
            photo(b.slot);
            optionalBool(b, "flip");
            optionalBool(b, "bleed");
            walk(b.blocks, depth + 1, true);
            break;
          case "glyph":
            object(b, ["kind", "glyph", "blocks"]);
            if (!text4(b.glyph, 32)) fail10("Invalid article glyph.");
            walk(b.blocks, depth + 1, true);
            break;
          case "photos":
            object(b, ["kind", "slots", "aspect", "stagger", "narrow"]);
            list(b.slots);
            if (b.slots.length < 1 || b.slots.length > 2) fail10("An article photo pair has one or two photos.");
            b.slots.forEach(photo);
            aspect(b.aspect);
            optionalBool(b, "stagger");
            optionalBool(b, "narrow");
            break;
          case "wide":
            object(b, ["kind", "slot", "aspect", "narrow", "offset"]);
            photo(b.slot);
            aspect(b.aspect);
            optionalBool(b, "narrow");
            if (b.offset !== void 0 && !["left", "right"].includes(b.offset)) fail10("Invalid article photo offset.");
            break;
          case "bleed":
            object(b, ["kind", "slot"]);
            photo(b.slot);
            break;
          case "on-photo":
            object(b, ["kind", "paragraphId", "slot", "aspect", "ink", "accent"]);
            passage(b.paragraphId);
            photo(b.slot);
            aspect(b.aspect);
            if (!b.aspect || !/^#[a-f\d]{6}$/i.test(b.ink || "") || !/^#[a-f\d]{6}$/i.test(b.accent || "")) fail10("An on-photo passage needs its measured colors and aspect.");
            break;
          default:
            fail10("Unknown article block.");
        }
      }
    };
    for (const key of ["hookId", "introId", "closingId"]) if (value[key] !== void 0) passage(value[key]);
    if (value.portraitSlot !== void 0) photo(value.portraitSlot);
    walk(value.opening);
    list(value.parts);
    for (const part2 of value.parts) {
      object(part2, ["titleId", "openerSlot", "blocks"]);
      passage(part2.titleId);
      const title = paragraphs.find((p) => p.id === part2.titleId);
      if (title.doc?.content?.length !== 1 || title.doc.content[0].type !== "heading") fail10("An article chapter title must reference an accepted heading.");
      if (part2.openerSlot !== void 0) photo(part2.openerSlot);
      walk(part2.blocks);
    }
    object(value.ending, ["blocks", "sayingId", "photoSlot", "aspect"]);
    walk(value.ending.blocks);
    if (value.ending.sayingId !== void 0) passage(value.ending.sayingId);
    if (value.ending.photoSlot !== void 0) photo(value.ending.photoSlot);
    aspect(value.ending.aspect);
    if (usedIds.size !== ids.size) fail10("Article layout omits an accepted passage.");
    return void 0;
  } catch (error) {
    return error.message;
  }
}
function validateArticleComposition(value, paragraphs, placements = []) {
  const issue = articleCompositionIssue(value, paragraphs, placements);
  if (issue) throw new Error(issue);
  return value;
}

// store.mjs
var MAX_BODY_BYTES = 2 * 1024 * 1024;
var StateError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
function shape(value, keys, label, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key) && !optional.includes(key)) || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new StateError(`${label} must contain exactly: ${keys.join(", ")}.`);
  }
}
function text(value, label, max = MAX_BODY_BYTES) {
  if (typeof value !== "string" || value.length > max) throw new StateError(`${label} must be a string of at most ${max} characters.`);
}
function id(value, label) {
  text(value, label, 128);
  if (!value.trim() || /[\u0000-\u001f\u007f]/.test(value)) throw new StateError(`${label} must be a nonempty ID without control characters.`);
}
function collection(value, label, max, check) {
  if (!Array.isArray(value) || value.length > max) throw new StateError(`${label} must be an array with at most ${max} entries.`);
  const ids = /* @__PURE__ */ new Set();
  value.forEach((entry, index) => {
    check(entry, `${label}[${index}]`);
    if (ids.has(entry.id)) throw new StateError(`${label} contains duplicate ID ${entry.id}.`);
    ids.add(entry.id);
  });
  return ids;
}
function guidance(value, label) {
  shape(value, ["voice", "perspective", "recipe"], label);
  for (const key of ["voice", "perspective", "recipe"]) text(value[key], `${label}.${key}`, 256 * 1024);
}
var WRITING_TEMPLATE_MAX_BYTES = 128 * 1024;
var sha256 = (value) => createHash3("sha256").update(value).digest("hex");
function isoDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new StateError(`${label} requires an ISO date-time.`);
}
function validateWritingTemplate(attachment, label = "writingTemplate") {
  shape(attachment, ["sourceId", "attachmentId", "attachedAt", "source"], label);
  id(attachment.sourceId, `${label}.sourceId`);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(attachment.attachmentId)) throw new StateError("Writing template requires a unique attachment UUID.");
  isoDate(attachment.attachedAt, `${label}.attachedAt`);
  shape(attachment.source, ["artifactId", "fileName", "provenance"], `${label}.source`);
  if (!/^mag_[a-f0-9]{64}$/.test(attachment.source.artifactId) || attachment.source.fileName !== "TEMPLATE.md") throw new StateError("Only Magazine TEMPLATE.md can be attached as a writing template.");
  const origin = attachment.source.provenance;
  shape(origin, ["rootId", "rootLabel", "rootPath", "relativePath", "sha256", "readOnly"], `${label}.source.provenance`);
  for (const key of ["rootId", "rootLabel", "rootPath", "relativePath"]) {
    text(origin[key], `${label}.source.provenance.${key}`, key === "rootId" ? 128 : key === "rootLabel" ? 256 : 4096);
    if (!origin[key].trim() || /[\u0000-\u001f\u007f]/.test(origin[key])) throw new StateError("Writing template provenance requires readable identifiers.");
  }
  if (!path2.isAbsolute(origin.rootPath) || path2.isAbsolute(origin.relativePath) || origin.relativePath.includes("\\") || origin.relativePath.split("/").some((part2) => !part2 || part2 === "." || part2 === "..") || path2.posix.basename(origin.relativePath) !== "TEMPLATE.md" || !/^[a-f0-9]{64}$/.test(origin.sha256) || origin.readOnly !== true) throw new StateError("Writing template requires an original read-only Magazine receipt.");
  return attachment;
}
function validateWritingTemplateSnapshot(snapshot2, label = "writingTemplateSnapshot") {
  if (snapshot2 === null) return snapshot2;
  shape(snapshot2, ["schema", "attachment", "raw", "hash", "capturedAt"], label);
  if (snapshot2.schema !== "ar-create.writing-template-snapshot.v1") throw new StateError("Writing template snapshot has an unsupported schema.");
  validateWritingTemplate(snapshot2.attachment, `${label}.attachment`);
  text(snapshot2.raw, `${label}.raw`, WRITING_TEMPLATE_MAX_BYTES);
  if (Buffer.byteLength(snapshot2.raw) > WRITING_TEMPLATE_MAX_BYTES || snapshot2.raw.includes("\0") || !/^[a-f0-9]{64}$/.test(snapshot2.hash) || sha256(snapshot2.raw) !== snapshot2.hash) throw new StateError("Writing template snapshot requires exact bounded raw bytes and their SHA-256.");
  isoDate(snapshot2.capturedAt, `${label}.capturedAt`);
  return snapshot2;
}
function validateDocument(document, label = "document") {
  if (!document || typeof document !== "object" || Array.isArray(document) || document.schema !== "ar-create.document.v1") throw new StateError(`${label} requires ar-create.document.v1.`);
  id(document.id, `${label}.id`);
  text(document.title, `${label}.title`, 512);
  if (document.writingTemplate !== void 0 && document.writingTemplate !== null) validateWritingTemplate(document.writingTemplate, `${label}.writingTemplate`);
  if (document.editorialFrame !== void 0) text(document.editorialFrame, `${label}.editorialFrame`, 16e3);
  if (!Number.isSafeInteger(document.revision) || document.revision < 0) throw new StateError(`${label}.revision must be a nonnegative integer.`);
  collection(document.paragraphs, `${label}.paragraphs`, 2e3, (paragraph, name) => {
    id(paragraph.id, `${name}.id`);
    text(paragraph.text, `${name}.text`);
    if (!paragraph.doc || typeof paragraph.doc !== "object" || Array.isArray(paragraph.doc) || paragraph.doc.type !== "doc") throw new StateError(`${name}.doc must contain a TipTap document.`);
    if (!Array.isArray(paragraph.attributions) || !Array.isArray(paragraph.kept)) throw new StateError(`${name} needs attributions and kept arrays.`);
    for (const attribution of paragraph.attributions) {
      id(attribution.id, `${name}.attribution.id`);
      id(attribution.sourceId, `${name}.attribution.sourceId`);
      if (!["quote", "inline", "reference", "paraphrase"].includes(attribution.form)) throw new StateError(`${name}.attribution has an unknown form.`);
      text(attribution.excerpt, `${name}.attribution.excerpt`);
    }
    for (const kept of paragraph.kept) {
      id(kept.id, `${name}.kept.id`);
      text(kept.text, `${name}.kept.text`);
      if (!["verbatim", "point"].includes(kept.mode)) throw new StateError(`${name}.kept has an unknown mode.`);
    }
  });
  if (!Array.isArray(document.outputs) || document.outputs.length > 100) throw new StateError(`${label}.outputs must be an array under 100 entries.`);
  for (const [outputIndex, output] of document.outputs.entries()) {
    if (output?.articleComposition !== void 0) {
      if (output.kind !== "article") throw new StateError("Only an article can carry article composition.");
      const issue = articleCompositionIssue(output.articleComposition, output.manuscript || document.paragraphs, output.placements || []);
      if (issue) throw new StateError(issue);
    }
    if (output?.articleCompositionNotice !== void 0) text(output.articleCompositionNotice, "articleCompositionNotice", 1e3);
    if (output?.articleVisualMake !== void 0) {
      if (output.kind !== "article") throw new StateError("Only articles carry visual arrangement receipts.");
      shape(output.articleVisualMake, ["requestId", "artifactHash", "wordsHash"], "articleVisualMake");
      id(output.articleVisualMake.requestId, "articleVisualMake.requestId");
      for (const key of ["artifactHash", "wordsHash"]) if (!/^[a-f0-9]{64}$/.test(output.articleVisualMake[key])) throw new StateError("Article visual receipts require SHA-256 hashes.");
    }
    if (output?.articleVisualHistory !== void 0) {
      if (output.kind !== "article" || !Array.isArray(output.articleVisualHistory) || output.articleVisualHistory.length > 10) throw new StateError("Keep at most ten earlier article arrangements.");
      for (const saved of output.articleVisualHistory) {
        shape(saved, ["createdAt", "wordsHash", "placements"], "articleVisualHistory", ["composition"]);
        if (typeof saved.createdAt !== "string" || !Number.isFinite(Date.parse(saved.createdAt)) || !/^[a-f0-9]{64}$/.test(saved.wordsHash) || !Array.isArray(saved.placements) || saved.placements.length > 200) throw new StateError("Earlier article arrangements require a date, wording hash and bounded photo placements.");
      }
    }
    if (output?.kind === "article" && output.wordsReview !== void 0) {
      shape(output.wordsReview, ["hash", "reviewedAt"], "article.wordsReview");
      if (!/^[a-f0-9]{64}$/.test(output.wordsReview.hash) || typeof output.wordsReview.reviewedAt !== "string" || !Number.isFinite(Date.parse(output.wordsReview.reviewedAt))) throw new StateError("Article wording review requires a SHA-256 receipt and review date.");
    }
    if (output?.kind !== "carousel" || !Array.isArray(output.slides)) continue;
    if (output.stage !== void 0 && !["words", "look"].includes(output.stage)) throw new StateError("Carousel stage must be words or look.");
    if (output.wordsReview !== void 0) {
      shape(output.wordsReview, ["hash", "reviewedAt"], "carousel.wordsReview");
      if (!/^[a-f0-9]{64}$/.test(output.wordsReview.hash) || typeof output.wordsReview.reviewedAt !== "string" || !Number.isFinite(Date.parse(output.wordsReview.reviewedAt))) throw new StateError("Carousel wording review requires a SHA-256 receipt and review date.");
    }
    for (const [slideIndex, slide] of output.slides.entries()) {
      if (slide?.pillar !== void 0 && !["", "\u4F73", "\u5BB6", "\u5609"].includes(slide.pillar)) throw new StateError(`${label}.outputs[${outputIndex}].slides[${slideIndex}].pillar must be \u4F73, \u5BB6, \u5609 or empty.`);
      if (slide?.label !== void 0) text(slide.label, `${label}.outputs[${outputIndex}].slides[${slideIndex}].label`, 240);
      if (slide?.typography !== void 0) {
        const name = `${label}.outputs[${outputIndex}].slides[${slideIndex}].typography`, value = slide.typography;
        shape(value, ["font", "scale", "fit"], name);
        if (!["original", "caudex", "serif", "sans"].includes(value.font) || !Number.isFinite(value.scale) || value.scale < 0.5 || value.scale > 1.5 || !["auto", "manual"].includes(value.fit)) throw new StateError(`${name} requires a supported font, scale 0.5\u20131.5 and auto or manual fit.`);
      }
    }
  }
  if (document.nativeOutputIndex !== void 0) validateOutputIndex(document.nativeOutputIndex, document.outputs, StateError);
  const magazine = document.importedDraft?.magazineProvenance;
  if (magazine !== void 0) {
    shape(magazine, ["rootId", "rootLabel", "rootPath", "relativePath", "sha256", "readOnly"], `${label}.importedDraft.magazineProvenance`);
    for (const key of ["rootId", "rootLabel", "rootPath", "relativePath"]) {
      text(magazine[key], `magazineProvenance.${key}`, key === "rootId" ? 128 : key === "rootLabel" ? 256 : 4096);
      if (!magazine[key].trim() || /[\u0000-\u001f\u007f]/.test(magazine[key])) throw new StateError("Magazine provenance must contain readable source identifiers.");
    }
    if (!path2.isAbsolute(magazine.rootPath) || path2.isAbsolute(magazine.relativePath) || magazine.relativePath.includes("\\") || magazine.relativePath.split(/[\\/]/).some((part2) => !part2 || part2 === "." || part2 === "..") || !/^[a-f0-9]{64}$/.test(magazine.sha256) || magazine.readOnly !== true) throw new StateError("Magazine provenance requires an original path, SHA-256 and read-only receipt.");
  }
  if (Buffer.byteLength(JSON.stringify(document)) > MAX_BODY_BYTES) throw new StateError("Document exceeds the 2 MB limit.", 413);
  return document;
}
function validateState(state) {
  shape(state, ["revision", "project"], "state");
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new StateError("revision must be a nonnegative safe integer below the maximum.");
  }
  const project = state.project;
  shape(project, ["id", "title", "sources", "reflections", "draft", "guidance", "versions"], "project", ["document", "materialSelection"]);
  if (project.document !== void 0) validateDocument(project.document, "project.document");
  if (project.materialSelection !== void 0) {
    const selection = project.materialSelection;
    shape(selection, ["sourceIds"], "project.materialSelection", ["cardIds", "collectionId"]);
    for (const [key, max] of [["sourceIds", 100], ["cardIds", 200]]) {
      if (selection[key] === void 0) continue;
      if (!Array.isArray(selection[key]) || selection[key].length > max || new Set(selection[key]).size !== selection[key].length) throw new StateError(`materialSelection.${key} must contain unique IDs, at most ${max}.`);
      selection[key].forEach((value) => id(value, `materialSelection.${key}`));
    }
    if (selection.collectionId !== void 0) id(selection.collectionId, "materialSelection.collectionId");
  }
  id(project.id, "project.id");
  text(project.title, "project.title", 256);
  text(project.draft, "project.draft");
  guidance(project.guidance, "project.guidance");
  const sourceIds = collection(project.sources, "sources", 200, (source, label) => {
    shape(source, ["id", "title", "url", "body"], label);
    id(source.id, `${label}.id`);
    text(source.title, `${label}.title`, 512);
    text(source.url, `${label}.url`, 2048);
    text(source.body, `${label}.body`);
  });
  collection(project.reflections, "reflections", 1e3, (reflection, label) => {
    shape(reflection, ["id", "body", "sourceId"], label, ["origin"]);
    id(reflection.id, `${label}.id`);
    text(reflection.body, `${label}.body`);
    if (reflection.origin !== void 0) {
      const origin = reflection.origin;
      shape(origin, ["kind", "rootId", "relativePath", "sourceHash", "questionKey", "questionTitle", "prompt"], `${label}.origin`);
      if (origin.kind !== "magazine-question") throw new StateError(`${label}.origin requires magazine-question.`);
      if (reflection.sourceId !== null) throw new StateError("A Magazine question contribution must have sourceId null.");
      id(origin.rootId, `${label}.origin.rootId`);
      text(origin.relativePath, `${label}.origin.relativePath`, 4096);
      if (!origin.relativePath.trim() || /[\u0000-\u001f\u007f]/.test(origin.relativePath) || path2.isAbsolute(origin.relativePath) || origin.relativePath.includes("\\") || origin.relativePath.split("/").some((part2) => !part2 || part2 === "." || part2 === "..")) throw new StateError("Magazine question origin requires a safe relative artifact path.");
      for (const key of ["sourceHash", "questionKey"]) if (typeof origin[key] !== "string" || !/^[a-f0-9]{64}$/.test(origin[key])) throw new StateError(`${label}.origin.${key} requires a lowercase SHA-256 hash.`);
      text(origin.questionTitle, `${label}.origin.questionTitle`, 512);
      text(origin.prompt, `${label}.origin.prompt`, 2e4);
    }
    if (reflection.sourceId !== null) {
      id(reflection.sourceId, `${label}.sourceId`);
      if (!sourceIds.has(reflection.sourceId)) throw new StateError(`${label}.sourceId refers to an unknown source.`);
    }
  });
  collection(project.versions, "versions", 50, (version, label) => {
    shape(version, ["id", "createdAt", "label", "draft", "guidance"], label, ["document", "writingTemplateSnapshot"]);
    if (version.writingTemplateSnapshot !== void 0) {
      validateWritingTemplateSnapshot(version.writingTemplateSnapshot, `${label}.writingTemplateSnapshot`);
      if (version.writingTemplateSnapshot && (!version.document || JSON.stringify(version.document.writingTemplate) !== JSON.stringify(version.writingTemplateSnapshot.attachment))) throw new StateError("Version writing template snapshot must match its saved document attachment.");
    }
    if (version.document !== void 0) validateDocument(version.document, `${label}.document`);
    id(version.id, `${label}.id`);
    text(version.createdAt, `${label}.createdAt`, 64);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(version.createdAt) || !Number.isFinite(Date.parse(version.createdAt))) {
      throw new StateError(`${label}.createdAt must be an ISO date-time.`);
    }
    text(version.label, `${label}.label`, 256);
    text(version.draft, `${label}.draft`);
    guidance(version.guidance, `${label}.guidance`);
  });
  if (Buffer.byteLength(JSON.stringify(state)) > MAX_BODY_BYTES) throw new StateError("State exceeds the 2 MB limit.", 413);
  return state;
}
function createInitialState() {
  return { revision: 0, project: {
    id: randomUUID2(),
    title: "Untitled exploration",
    sources: [],
    reflections: [],
    draft: "",
    guidance: { voice: "", perspective: "", recipe: "" },
    versions: []
  } };
}
async function assertRegularOrMissing(file) {
  try {
    const stat = await lstat2(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing non-regular data file: ${file}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function atomicWrite(file, contents, { exclusive = false } = {}) {
  const temporary = `${file}.${randomUUID2()}.tmp`;
  let handle;
  try {
    handle = await open2(temporary, "wx", 384);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = void 0;
    if (exclusive) await link(temporary, file);
    else await rename(temporary, file);
    const directory2 = await open2(path2.dirname(file), "r");
    try {
      await directory2.sync();
    } finally {
      await directory2.close();
    }
  } finally {
    if (handle) await handle.close();
    await unlink2(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
async function createStore({ dataDir, sharedArticles = false, publicationFault } = {}) {
  dataDir = path2.resolve(dataDir);
  await mkdir2(dataDir, { recursive: true, mode: 448 });
  const directory2 = await lstat2(dataDir);
  if (!directory2.isDirectory() || directory2.isSymbolicLink()) throw new Error("Data directory must be a real directory.");
  const file = path2.join(dataDir, "state.json");
  const backup = path2.join(dataDir, "state.backup.json");
  await assertRegularOrMissing(file);
  await assertRegularOrMissing(backup);
  const articles = sharedArticles ? await createArticlePersistence({ dataDir, atomicWrite, StateError, fault: publicationFault }) : null;
  let state;
  try {
    const contents = await readFile2(file);
    if (contents.length > MAX_BODY_BYTES) throw new Error("Stored state exceeds the 2 MB limit.");
    state = validateState(JSON.parse(contents.toString("utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") {
      if (articles) await articles.close();
      throw new Error(`Cannot load state; existing files were preserved: ${error.message}`, { cause: error });
    }
    state = createInitialState();
    await atomicWrite(file, JSON.stringify(state));
  }
  let knownStateBytes = await readFile2(file), needsRecovery = false, closed = false, recoveryFiles = [];
  let pending = Promise.resolve();
  const savedListeners = /* @__PURE__ */ new Set();
  const piecesDir = path2.join(dataDir, "pieces"), migrationBackup = path2.join(dataDir, "state.pieces-migration.backup.json");
  let piecesReady = false, activeMetadata = null;
  const knownPieceBytes = /* @__PURE__ */ new Map();
  const pieceFile = (projectId) => path2.join(piecesDir, createHash3("sha256").update(projectId).digest("hex") + ".json");
  const timestamp = () => (/* @__PURE__ */ new Date()).toISOString();
  async function refreshPublication() {
    if (closed) throw new StateError("Store owner is closed.", 409);
    if (!articles) return;
    const recovered = await articles.recover(), disk = await readFile2(file);
    if (recovered || needsRecovery) {
      if (!recovered) await articles.checkPublished(recoveryFiles);
      state = validateState(JSON.parse(disk.toString("utf8")));
      knownStateBytes = disk;
      activeMetadata = null;
      capturePublishedPieceBytes(recovered?.files || recoveryFiles);
      needsRecovery = false;
      recoveryFiles = [];
    } else if (!disk.equals(knownStateBytes)) throw new StateError("State changed outside its cooperating store owner; existing files were preserved.", 409);
  }
  function serialized(action) {
    const operation = pending.then(async () => {
      await refreshPublication();
      return action();
    });
    pending = operation.catch(() => {
    });
    return operation;
  }
  function notifySaved() {
    for (const listener of savedListeners) {
      try {
        listener(structuredClone(state));
      } catch (error) {
        console.error("Saved workspace view could not refresh:", error.message);
      }
    }
  }
  async function checkDataDirectory() {
    const stat = await lstat2(dataDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new StateError("Data storage must remain a real directory.", 403);
  }
  async function checkPiecesDirectory(create = false) {
    await checkDataDirectory();
    try {
      const stat = await lstat2(piecesDir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new StateError("Pieces storage must be a real private directory.", 403);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (!create) throw new StateError("Saved piece was not found.", 404);
      await mkdir2(piecesDir, { mode: 448 });
    }
  }
  function envelope2(project, metadata3) {
    const result = { schema: "ar-create.piece.v1", createdAt: metadata3.createdAt, updatedAt: metadata3.updatedAt, project: structuredClone(project) };
    const bytes4 = JSON.stringify(result);
    if (Buffer.byteLength(bytes4) > MAX_BODY_BYTES) throw new StateError("Piece exceeds the 2 MB limit.", 413);
    return { result, bytes: bytes4 };
  }
  async function capturePieceBytes() {
    knownPieceBytes.clear();
    if (!existsSync2(piecesDir)) return;
    for (const filename of await readdir(piecesDir)) if (/^[a-f0-9]{64}\.json$/.test(filename)) {
      const location2 = path2.join(piecesDir, filename);
      await assertRegularOrMissing(location2);
      knownPieceBytes.set(location2, articleHash(await readFile2(location2)));
    }
  }
  function capturePublishedPieceBytes(files) {
    for (const [location2, value] of files) if (path2.dirname(location2) === piecesDir && /^[a-f0-9]{64}\.json$/.test(path2.basename(location2))) {
      if (value === null) knownPieceBytes.delete(location2);
      else knownPieceBytes.set(location2, articleHash(value));
    }
  }
  async function readPiece(projectId, filename = pieceFile(projectId)) {
    await checkPiecesDirectory();
    let handle;
    try {
      handle = await open2(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1) throw new StateError("Piece snapshot must be an ordinary private file.", 403);
      if (stat.size > MAX_BODY_BYTES) throw new StateError("Stored piece exceeds the 2 MB limit.", 413);
      const bytes4 = await handle.readFile();
      if (bytes4.length > MAX_BODY_BYTES) throw new StateError("Stored piece exceeds the 2 MB limit.", 413);
      const record = JSON.parse(bytes4.toString("utf8"));
      shape(record, ["schema", "createdAt", "updatedAt", "project"], "piece");
      if (record.schema !== "ar-create.piece.v1") throw new StateError("Piece snapshot has an unsupported schema.");
      for (const key of ["createdAt", "updatedAt"]) if (typeof record[key] !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(record[key]) || !Number.isFinite(Date.parse(record[key]))) throw new StateError("Piece timestamps are invalid.");
      validateState({ revision: 0, project: record.project });
      if (projectId !== void 0 && record.project.id !== projectId || pieceFile(record.project.id) !== filename) throw new StateError("Piece snapshot identity does not match its saved file.", 409);
      return record;
    } catch (error) {
      if (error.code === "ENOENT") throw new StateError("Saved piece was not found.", 404);
      if (error.code === "ELOOP") throw new StateError("Symlink piece snapshots are not available.", 403);
      if (error instanceof StateError) throw error;
      throw new StateError("Cannot read saved piece; existing files were preserved: " + error.message);
    } finally {
      await handle?.close();
    }
  }
  async function activeMeta() {
    if (activeMetadata?.id === state.project.id) return activeMetadata;
    const stat = await lstat2(file), updatedAt = stat.mtime.toISOString();
    let prior = null;
    try {
      prior = await readPiece(state.project.id);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    return activeMetadata = { id: state.project.id, createdAt: prior?.createdAt || updatedAt, updatedAt: prior && JSON.stringify(prior.project) === JSON.stringify(state.project) ? prior.updatedAt : updatedAt };
  }
  async function writePiece(project, metadata3, { exclusive = false } = {}) {
    const prepared = envelope2(project, metadata3);
    await checkPiecesDirectory();
    await assertRegularOrMissing(pieceFile(project.id));
    await atomicWrite(pieceFile(project.id), prepared.bytes, { exclusive });
    return prepared.result;
  }
  async function initializePieces() {
    if (piecesReady) {
      await checkPiecesDirectory();
      return;
    }
    await checkPiecesDirectory(true);
    await assertRegularOrMissing(file);
    await assertRegularOrMissing(migrationBackup);
    if (articles) {
      const projects = [state.project], files = [], expectedFiles = /* @__PURE__ */ new Map();
      for (const filename of await readdir(piecesDir)) {
        if (!/^[a-f0-9]{64}\.json$/.test(filename) || filename === path2.basename(pieceFile(state.project.id))) continue;
        projects.push((await readPiece(void 0, path2.join(piecesDir, filename))).project);
      }
      const metadata4 = await activeMeta();
      const activeFile = pieceFile(state.project.id);
      if (!existsSync2(activeFile)) files.push([activeFile, envelope2(state.project, metadata4).bytes]);
      else {
        const activeBytes = await readFile2(activeFile), prior = await readPiece(state.project.id);
        if (JSON.stringify(prior.project) !== JSON.stringify(state.project)) {
          files.push([activeFile, envelope2(state.project, metadata4).bytes]);
          expectedFiles.set(activeFile, articleHash(activeBytes));
        }
      }
      if (!existsSync2(migrationBackup)) files.push([migrationBackup, await readFile2(file)]);
      try {
        await articles.bootstrap(projects, files, { expectedFiles });
      } catch (error) {
        needsRecovery = existsSync2(articles.journal);
        throw error;
      }
      await capturePieceBytes();
      piecesReady = true;
      return;
    }
    try {
      await lstat2(migrationBackup);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await atomicWrite(migrationBackup, await readFile2(file), { exclusive: true });
    }
    const metadata3 = await activeMeta();
    try {
      await lstat2(pieceFile(state.project.id));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await writePiece(state.project, metadata3, { exclusive: true });
    }
    piecesReady = true;
  }
  function expected(input) {
    id(input.expectedProjectId, "expectedProjectId");
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new StateError("expectedRevision must be a nonnegative safe integer.");
    if (input.expectedProjectId !== state.project.id || input.expectedRevision !== state.revision) throw new StateError("Active piece changed since this page loaded. Reload the latest state before continuing.", 409);
  }
  async function commit(next, metadata3 = null, { pieceProjects = [], expectedArticle, expectedCarousel, decisionFile, receipt, finalCheck, extraFiles = [], extraExpectedFiles = /* @__PURE__ */ new Map(), preserveActive = false } = {}) {
    validateState(next);
    await checkDataDirectory();
    await assertRegularOrMissing(file);
    await assertRegularOrMissing(backup);
    if (articles) {
      await initializePieces();
      const checked = preserveActive ? null : await articles.checkArticle(state.project, expectedArticle);
      const carouselChecks = preserveActive ? [] : await articles.checkCarouselWords(state.project, expectedCarousel);
      const retainedCarouselFiles = new Map(carouselChecks.filter((carousel) => carousel.externalEdit && carousel.output.id !== expectedCarousel?.outputId).map((carousel) => [carousel.paths.markdown, carousel.bytes]));
      const expectedFiles = new Map([[file, articleHash(knownStateBytes)], ...extraExpectedFiles]);
      if (checked) {
        expectedFiles.set(checked.paths.markdown, checked.expected.markdownHash);
        expectedFiles.set(checked.paths.companion, checked.expected.companionHash);
      }
      for (const carousel of carouselChecks) expectedFiles.set(carousel.paths.markdown, carousel.expected.markdownHash);
      const disk = await readFile2(file);
      if (!disk.equals(knownStateBytes)) throw new StateError("State changed during article publication; existing files were preserved.", 409);
      const active = await activeMeta(), nextMeta = metadata3 || (preserveActive ? active : { createdAt: active.createdAt, updatedAt: timestamp() });
      const projects = new Map(pieceProjects.map((entry) => [entry.project.id, entry]));
      if (!preserveActive) projects.set(next.project.id, { project: next.project, metadata: nextMeta });
      const files = [...retainedCarouselFiles, ...preserveActive ? [] : [[backup, disk]], ...extraFiles];
      for (const entry of projects.values()) {
        if (entry.project.id !== state.project.id) {
          const oldPiece = await readPiece(entry.project.id).catch((error) => {
            if (error.status === 404) return null;
            throw error;
          });
          if (oldPiece) {
            const target = await articles.checkArticle(oldPiece.project);
            expectedFiles.set(target.paths.markdown, target.expected.markdownHash);
            expectedFiles.set(target.paths.companion, target.expected.companionHash);
            for (const carousel of await articles.checkCarouselWords(oldPiece.project)) expectedFiles.set(carousel.paths.markdown, carousel.expected.markdownHash);
          } else {
            const paths = articlePaths(dataDir, entry.project);
            expectedFiles.set(paths.markdown, null);
            expectedFiles.set(paths.companion, null);
          }
        }
        for (const [destination] of articles.bundleFiles(entry.project)) if (!expectedFiles.has(destination)) expectedFiles.set(destination, await articles.retainedCarouselWordsHash(entry.project, destination));
        expectedFiles.set(pieceFile(entry.project.id), knownPieceBytes.get(pieceFile(entry.project.id)) ?? null);
        files.push([pieceFile(entry.project.id), envelope2(entry.project, entry.metadata).bytes], ...articles.bundleFiles(entry.project).filter(([destination]) => !retainedCarouselFiles.has(destination)));
      }
      files.push([file, preserveActive ? disk : JSON.stringify(next)]);
      if (decisionFile) {
        expectedFiles.set(decisionFile, null);
        files.push([decisionFile, JSON.stringify(receipt)]);
      }
      await finalCheck?.();
      try {
        await articles.publish(files, { expectedFiles });
      } catch (error) {
        needsRecovery = existsSync2(articles.journal) || !!(decisionFile && existsSync2(decisionFile)) || !(await readFile2(file)).equals(knownStateBytes);
        if (needsRecovery) recoveryFiles = files;
        throw error;
      }
      state = next;
      knownStateBytes = preserveActive ? disk : Buffer.from(JSON.stringify(next));
      activeMetadata = { id: state.project.id, ...nextMeta };
      capturePublishedPieceBytes(files);
      notifySaved();
      return structuredClone(state);
    }
    await atomicWrite(backup, JSON.stringify(state));
    await atomicWrite(file, JSON.stringify(next));
    state = next;
    if (metadata3) activeMetadata = { id: state.project.id, ...metadata3 };
    else if (activeMetadata) activeMetadata = { ...activeMetadata, updatedAt: timestamp() };
    notifySaved();
    return structuredClone(state);
  }
  async function outputOwnedDirectory(directory3) {
    await checkDataDirectory();
    const relative2 = path2.relative(dataDir, directory3);
    if (relative2.startsWith("..") || path2.isAbsolute(relative2) || relative2.split(path2.sep)[0] !== "native-outputs") throw new StateError("Output path is outside owned native-output storage.", 403);
    let current = dataDir;
    for (const part2 of relative2.split(path2.sep)) {
      current = path2.join(current, part2);
      try {
        await mkdir2(current, { mode: 448 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      const stat = await lstat2(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new StateError("Output directories must be real private directories.", 403);
    }
  }
  async function outputPrivateFile(destination) {
    await outputOwnedDirectory(path2.dirname(destination));
    try {
      const stat = await lstat2(destination);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new StateError("Output captures require ordinary private files.", 403);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  function summary(project, metadata3, active) {
    const paragraphs = project.document?.paragraphs || [], body = project.document ? paragraphs.map((paragraph) => paragraph.text).join(" ") : project.draft;
    const original = project.document?.importedDraft?.magazineProvenance;
    const magazineSource = original ? { rootId: original.rootId, relativePath: original.relativePath, rootPathHash: createHash3("sha256").update(original.rootPath).digest("hex"), sha256: original.sha256, readOnly: true } : null;
    return { id: project.id, title: project.title, documentId: project.document?.id || null, wordCount: (body.match(/\S+/gu) || []).length, passages: paragraphs.length, outputs: project.document?.outputs?.length || 0, sourceCount: (/* @__PURE__ */ new Set([...project.sources.map((source) => source.id), ...project.materialSelection?.sourceIds || []])).size, createdAt: metadata3.createdAt, updatedAt: metadata3.updatedAt, active, ...magazineSource ? { magazineSource } : {} };
  }
  if (articles) {
    try {
      await initializePieces();
    } catch (error) {
      await articles.close();
      throw error;
    }
  }
  return {
    async close() {
      if (closed) return;
      await pending;
      closed = true;
      if (articles) await articles.close();
    },
    read(options = {}) {
      return serialized(async () => {
        if (articles) await articles.readArticle(state.project, options);
        return structuredClone(state);
      });
    },
    readArticle(options = {}) {
      return serialized(async () => {
        if (!articles) throw new StateError("Shared article persistence is not enabled.", 409);
        const project = !options.projectId || options.projectId === state.project.id ? state.project : (await readPiece(options.projectId)).project;
        return articles.readArticle(project, options);
      });
    },
    readCarouselWords(options = {}) {
      const captured = structuredClone(options);
      return serialized(async () => {
        if (!articles) throw new StateError("Shared article persistence is not enabled.", 409);
        const project = !captured.projectId || captured.projectId === state.project.id ? state.project : (await readPiece(captured.projectId)).project;
        return articles.readCarouselWords(project, captured);
      });
    },
    // Trusted in-process service boundary. No HTTP route accepts prepare or paths.
    saveOutputRecords(input, prepare) {
      const incoming = structuredClone(input);
      return serialized(async () => {
        let receiptFile, publicationAttempted = false;
        try {
          if (!articles) throw new StateError("Shared article persistence is required for output saves.", 409);
          shape(incoming, ["projectId", "documentId", "expectedOutput", "operationId", "commandHash"], "output save");
          id(incoming.projectId, "projectId");
          id(incoming.documentId, "documentId");
          shape(incoming.expectedOutput, ["revision", "hash"], "expectedOutput");
          if (!Number.isSafeInteger(incoming.expectedOutput.revision) || incoming.expectedOutput.revision < 0 || !/^[a-f0-9]{64}$/.test(incoming.expectedOutput.hash) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(incoming.operationId)) throw new StateError("Output saves require exact revision/hash and operation UUID.");
          if (typeof incoming.commandHash !== "string" || !/^[a-f0-9]{64}$/.test(incoming.commandHash)) throw new StateError("Output save requires an exact trusted command SHA-256.");
          if (typeof prepare !== "function") throw new StateError("Output save requires a trusted preparation callback.");
          const inputHash = outputOperationInputHash(incoming);
          receiptFile = path2.join(dataDir, "native-outputs", "operations", incoming.operationId, "receipt.json");
          await outputOwnedDirectory(path2.dirname(receiptFile));
          await outputPrivateFile(receiptFile);
          let prior;
          try {
            prior = JSON.parse(await readFile2(receiptFile, "utf8"));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          if (prior) {
            if (prior.schema !== "ar-create.output-save-receipt.v1" || prior.operationId !== incoming.operationId || prior.inputHash !== inputHash || prior.commandHash !== incoming.commandHash || prior.projectId !== incoming.projectId || prior.documentId !== incoming.documentId) throw new StateError("Output operation already belongs to different input.", 409);
            return { receipt: prior, alreadySaved: true };
          }
          const active = incoming.projectId === state.project.id;
          const record = active ? null : await readPiece(incoming.projectId), project = structuredClone(active ? state.project : record.project);
          if (project.document?.id !== incoming.documentId) throw new StateError("Output save belongs to another document.", 409);
          const expected2 = outputRecordsExpected(project.document);
          if (expected2.revision !== incoming.expectedOutput.revision || expected2.hash !== incoming.expectedOutput.hash) throw new StateError("Output records changed since inspection.", 409);
          const outputReadProject = structuredClone(project);
          const prepared = await prepare({ project: structuredClone(project), expectedOutput: structuredClone(expected2), readArticle: (options) => articles.readArticle(project, options), readCarouselWords: (options) => articles.readCarouselWords(outputReadProject, options) });
          shape(prepared, ["outputs", "nativeOutputIndex", "finalCheck"], "prepared outputs", ["extraFiles"]);
          if (typeof prepared.finalCheck !== "function") throw new StateError("Output save requires the native/source proof check.");
          const outputs = structuredClone(prepared.outputs), index = structuredClone(prepared.nativeOutputIndex);
          if (!Array.isArray(outputs) || outputs.length > 100 || outputs.some((output) => !output || !["article", "carousel", "post", "product-listing"].includes(output.kind) || typeof output.id !== "string" || !output.id.trim()) || new Set(outputs.map((output) => output.id)).size !== outputs.length) throw new StateError("Output saves require unique article or carousel records.");
          validateOutputIndex(index, outputs, StateError);
          for (const entry of index.records) if (entry.wordOwner.kind === "carousel-words" && (entry.wordOwner.projectId !== project.id || entry.wordOwner.documentId !== project.document.id)) throw new StateError("Carousel word owner belongs to another document.", 409);
          if (index.revision !== expected2.revision + 1) throw new StateError("Native output index must advance exactly once.");
          project.document.outputs = outputs;
          project.document.nativeOutputIndex = index;
          validateState({ revision: 0, project });
          const extraFiles = [], extraExpectedFiles = /* @__PURE__ */ new Map(), prefix = outputPrivatePrefix(project.id, project.document.id);
          if (prepared.extraFiles !== void 0 && !Array.isArray(prepared.extraFiles)) throw new StateError("Private capture files must be an array.");
          if ((prepared.extraFiles?.length ?? 0) > 200) throw new StateError("Too many private capture files.");
          for (const extra of prepared.extraFiles || []) {
            shape(extra, ["relativePath", "contents", "expectedHash"], "private capture");
            if (typeof extra.relativePath !== "string" || !extra.relativePath.startsWith(prefix) || !new RegExp("^(captures|history)/[A-Za-z0-9_-]{1,128}\\.json$").test(extra.relativePath.slice(prefix.length))) throw new StateError("Private capture paths must remain in this document native-output namespace.", 403);
            text(extra.contents, "private capture contents");
            if (Buffer.byteLength(extra.contents) > MAX_BODY_BYTES || extra.expectedHash !== null && !/^[a-f0-9]{64}$/.test(extra.expectedHash)) throw new StateError("Private captures require bounded bytes and an expected file hash.");
            const destination = path2.join(dataDir, extra.relativePath);
            if (extraExpectedFiles.has(destination)) throw new StateError("Private capture destinations must be unique.");
            await outputOwnedDirectory(path2.dirname(destination));
            await outputPrivateFile(destination);
            extraFiles.push([destination, extra.contents]);
            extraExpectedFiles.set(destination, extra.expectedHash);
          }
          const next = active ? { revision: state.revision + 1, project } : structuredClone(state);
          const receipt = { schema: "ar-create.output-save-receipt.v1", operationId: incoming.operationId, inputHash, commandHash: incoming.commandHash, projectId: project.id, documentId: project.document.id, expectedOutput: incoming.expectedOutput, savedOutput: outputRecordsExpected(project.document), savedAt: timestamp(), committedRevision: next.revision };
          publicationAttempted = true;
          await commit(next, null, { preserveActive: !active, pieceProjects: active ? [] : [{ project, metadata: { createdAt: record.createdAt, updatedAt: timestamp() } }], extraFiles, extraExpectedFiles, decisionFile: receiptFile, receipt, finalCheck: async () => {
            for (const [destination] of extraFiles) await outputPrivateFile(destination);
            await outputOwnedDirectory(path2.dirname(receiptFile));
            await prepared.finalCheck();
          } });
          return { receipt: structuredClone(receipt), alreadySaved: false };
        } catch (error) {
          error.outcome = publicationAttempted && (existsSync2(articles?.journal || "") || receiptFile && existsSync2(receiptFile)) ? "unknown" : "not-applied";
          throw error;
        }
      });
    },
    initializeFirstDraft(input) {
      const incoming = structuredClone(input);
      return serialized(async () => {
        expected(incoming);
        if (!articles) throw new StateError("Shared article persistence is required for a first draft.", 409);
        if (String(state.project.draft || "").trim()) throw new StateError("Existing legacy writing must be preserved. Open it before preparing a first draft.", 409);
        const document = state.project.document;
        if (document) {
          if (document.paragraphs.length || document.pendingResearchCandidate || document.importedDraft || document.legacyImport) throw new StateError("A first draft requires an empty document with no pending writing.", 409);
          await articles.readArticle(state.project);
          return structuredClone(state);
        }
        const next = structuredClone(state);
        next.revision++;
        next.project.document = { schema: "ar-create.document.v1", id: state.project.id, revision: 0, title: state.project.title, paragraphs: [], outputs: [] };
        return commit(next);
      });
    },
    decideFirstDraft(input, prepare) {
      const incoming = structuredClone(input);
      return serialized(async () => {
        let decisionFile, publicationAttempted = false;
        try {
          if (!articles) throw new StateError("Shared article persistence is required for a first draft.", 409);
          const { requestId, binding } = incoming;
          if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId)) throw new StateError("Invalid first-draft request.");
          shape(binding, ["artifactHash", "completionHash", "reviewHash"], "first-draft binding");
          if (Object.values(binding).some((hash8) => !/^[a-f0-9]{64}$/.test(hash8))) throw new StateError("First-draft acceptance requires exact inspected artifact hashes.");
          const directory3 = path2.join(dataDir, "article-make", requestId);
          for (const dir of [path2.dirname(directory3), directory3]) {
            const stat = await lstat2(dir);
            if (!stat.isDirectory() || stat.isSymbolicLink()) throw new StateError("First-draft request must be an owned directory.", 403);
          }
          decisionFile = path2.join(directory3, "decision.json");
          await assertRegularOrMissing(decisionFile);
          let prior;
          try {
            prior = JSON.parse(await readFile2(decisionFile, "utf8"));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          if (prior) {
            if (prior.schema !== "ar-create.first-draft-decision.v1" || prior.requestId !== requestId || Object.keys(binding).some((key) => prior.binding?.[key] !== binding[key])) throw new StateError("This first draft already has a different acceptance receipt.", 409);
            return { state: structuredClone(state), receipt: prior, alreadyDecided: true };
          }
          expected(incoming);
          const prepared = await prepare({ state: structuredClone(state), readArticle: () => articles.readArticle(state.project) });
          if (prepared.next.project.id !== state.project.id || prepared.next.project.document?.id !== state.project.document?.id) throw new StateError("First-draft acceptance cannot change article identity.", 409);
          const receipt = { schema: "ar-create.first-draft-decision.v1", requestId, projectId: state.project.id, documentId: state.project.document.id, decision: "accepted", binding, decidedAt: timestamp(), committedRevision: prepared.next.revision };
          publicationAttempted = true;
          await commit(prepared.next, null, { expectedArticle: prepared.expectedArticle, decisionFile, receipt, finalCheck: prepared.finalCheck });
          return { state: structuredClone(state), receipt, alreadyDecided: false };
        } catch (error) {
          error.outcome = publicationAttempted && (existsSync2(articles.journal) || decisionFile && existsSync2(decisionFile)) ? "unknown" : "not-applied";
          throw error;
        }
      });
    },
    // The callback holds the SAME serialized boundary as ordinary saves. It must
    // use get() and the supplied readArticle, never await a nested store command.
    decideSharedArticle(input, prepare) {
      return serialized(async () => {
        let decisionFile, publicationAttempted = false;
        try {
          if (!articles) throw new StateError("Shared article persistence is not enabled.", 409);
          const { requestId, decision, binding } = input;
          if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId) || !["accepted", "rejected"].includes(decision)) throw new StateError("Invalid shared article decision.");
          shape(binding, ["requestId", "proposalHash", "contextHash", "writingIdentity"], "decision binding");
          if (binding.requestId !== requestId || ["proposalHash", "contextHash", "writingIdentity"].some((key) => !/^[a-f0-9]{64}$/.test(binding[key]))) throw new StateError("Decision requires the exact reviewed proposal and context hashes.");
          const directory3 = path2.join(dataDir, "shared-article-requests", requestId);
          for (const dir of [path2.dirname(directory3), directory3]) {
            const stat = await lstat2(dir);
            if (!stat.isDirectory() || stat.isSymbolicLink()) throw new StateError("Shared request must be an owned real directory.", 403);
          }
          decisionFile = path2.join(directory3, "decision.json");
          await assertRegularOrMissing(decisionFile);
          let prior;
          try {
            prior = JSON.parse(await readFile2(decisionFile, "utf8"));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          if (prior) {
            if (prior.schema !== "ar-create.shared-article-decision.v1" || prior.requestId !== requestId || prior.decision !== decision || Object.keys(binding).some((key) => prior.binding?.[key] !== binding[key])) throw new StateError("This request already has a different terminal decision or review identity.", 409);
            return { state: structuredClone(state), receipt: prior, alreadyDecided: true };
          }
          const prepared = await prepare({ state: structuredClone(state), readArticle: (options) => articles.readArticle(state.project, options) });
          const next = prepared.next || state;
          const receipt = { schema: "ar-create.shared-article-decision.v1", requestId, projectId: prepared.projectId, documentId: prepared.documentId, decision, binding: structuredClone(binding), proposalHash: binding.proposalHash, contextHash: binding.contextHash, writingIdentity: binding.writingIdentity, decidedAt: timestamp(), committedRevision: next.revision, safetyVersionId: prepared.safetyVersionId || null, ...prepared.externalHash ? { externalHash: prepared.externalHash } : {} };
          publicationAttempted = true;
          if (prepared.next) await commit(prepared.next, null, { expectedArticle: prepared.expectedArticle, decisionFile, receipt, finalCheck: prepared.finalCheck });
          else {
            const files = [[decisionFile, JSON.stringify(receipt)]];
            await prepared.finalCheck?.();
            try {
              await articles.publish(files, { expectedFiles: /* @__PURE__ */ new Map([[decisionFile, null]]) });
            } catch (error) {
              needsRecovery = existsSync2(articles.journal);
              if (needsRecovery) recoveryFiles = files;
              throw error;
            }
          }
          return { state: structuredClone(state), receipt, alreadyDecided: false };
        } catch (error) {
          error.outcome = publicationAttempted && (existsSync2(articles.journal) || decisionFile && existsSync2(decisionFile)) ? "unknown" : "not-applied";
          throw error;
        }
      });
    },
    decideSharedCarousel(input, prepare) {
      return serialized(async () => {
        let decisionFile, publicationAttempted = false;
        try {
          if (!articles) throw new StateError("Shared article persistence is not enabled.", 409);
          const { requestId, decision, binding } = input;
          if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId) || !["accepted", "rejected"].includes(decision)) throw new StateError("Invalid shared carousel decision.");
          shape(binding, ["requestId", "proposalHash", "reviewHash", "contextHash", "wordsIdentity"], "decision binding");
          if (binding.requestId !== requestId || ["proposalHash", "reviewHash", "contextHash", "wordsIdentity"].some((key) => !/^[a-f0-9]{64}$/.test(binding[key]))) throw new StateError("Decision requires the exact reviewed proposal and context hashes.");
          const directory3 = path2.join(dataDir, "shared-carousel-requests", requestId);
          for (const dir of [path2.dirname(directory3), directory3]) {
            const stat = await lstat2(dir);
            if (!stat.isDirectory() || stat.isSymbolicLink()) throw new StateError("Shared request must be an owned real directory.", 403);
          }
          decisionFile = path2.join(directory3, "decision.json");
          await assertRegularOrMissing(decisionFile);
          let prior;
          try {
            prior = JSON.parse(await readFile2(decisionFile, "utf8"));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          if (prior) {
            if (prior.schema !== "ar-create.shared-carousel-decision.v1" || prior.requestId !== requestId || prior.decision !== decision || Object.keys(binding).some((key) => prior.binding?.[key] !== binding[key])) throw new StateError("This request already has a different terminal decision or review identity.", 409);
            return { state: structuredClone(state), receipt: prior, alreadyDecided: true };
          }
          const prepared = await prepare({ state: structuredClone(state), readArticle: (options) => articles.readArticle(state.project, options), readCarouselWords: (options) => articles.readCarouselWords(state.project, options) });
          const next = prepared.next || state;
          if (prepared.projectId !== state.project.id || prepared.documentId !== state.project.document?.id) throw new StateError("Carousel decision belongs to another active document.", 409);
          if (prepared.next && (next.project.id !== state.project.id || next.project.document?.id !== state.project.document?.id)) throw new StateError("Carousel decision cannot change piece identity.", 409);
          const receipt = { schema: "ar-create.shared-carousel-decision.v1", requestId, projectId: prepared.projectId, documentId: prepared.documentId, outputId: prepared.outputId, decision, binding: structuredClone(binding), proposalHash: binding.proposalHash, contextHash: binding.contextHash, wordsIdentity: binding.wordsIdentity, reviewHash: binding.reviewHash, decidedAt: timestamp(), committedRevision: next.revision, safetyVersionId: prepared.safetyVersionId || null, ...prepared.externalMissing !== void 0 ? { externalHash: prepared.externalHash ?? null, externalMissing: prepared.externalMissing } : {} };
          publicationAttempted = true;
          if (prepared.next) await commit(prepared.next, null, { expectedArticle: prepared.expectedArticle, expectedCarousel: prepared.expectedCarousel, decisionFile, receipt, finalCheck: prepared.finalCheck });
          else {
            const files = [[decisionFile, JSON.stringify(receipt)]];
            await prepared.finalCheck?.();
            try {
              await articles.publish(files, { expectedFiles: /* @__PURE__ */ new Map([[decisionFile, null]]) });
            } catch (error) {
              needsRecovery = existsSync2(articles.journal);
              if (needsRecovery) recoveryFiles = files;
              throw error;
            }
          }
          return { state: structuredClone(state), receipt, alreadyDecided: false };
        } catch (error) {
          error.outcome = publicationAttempted && (existsSync2(articles.journal) || decisionFile && existsSync2(decisionFile)) ? "unknown" : "not-applied";
          throw error;
        }
      });
    },
    subscribeSaved(listener) {
      savedListeners.add(listener);
      return () => savedListeners.delete(listener);
    },
    get() {
      if (closed || needsRecovery || articles && existsSync2(articles.journal)) throw new StateError("Article publication requires an awaited read to recover before reading.", 409);
      return structuredClone(state);
    },
    put(candidate, options = {}) {
      const incoming = structuredClone(candidate), expectedArticle = structuredClone(options.expectedArticle);
      return serialized(async () => {
        validateState(incoming);
        if (incoming.revision !== state.revision) throw new StateError("State changed since this page loaded. Reload the latest state before saving.", 409);
        if (incoming.project.id !== state.project.id) throw new StateError("project.id cannot change.");
        const next = { ...incoming, revision: state.revision + 1 };
        validateState(next);
        return commit(next, null, { expectedArticle });
      });
    },
    listPieces(options = {}) {
      if (!options || Array.isArray(options) || Object.keys(options).some((k) => k !== "readOnly") || options.readOnly !== void 0 && typeof options.readOnly !== "boolean") throw new StateError("Choose a supported piece catalog read.");
      const queue = options.readOnly ? (fn) => {
        const operation = pending.then(async () => {
          if (closed || needsRecovery || articles && existsSync2(articles.journal)) throw new StateError("Piece publication requires explicit owner recovery before a read-only catalog.", 409);
          if (articles ? !(await readFile2(file)).equals(knownStateBytes) : JSON.stringify(JSON.parse(await readFile2(file, "utf8"))) !== JSON.stringify(state)) throw new StateError("State changed outside its cooperating store owner.", 409);
          return fn();
        });
        pending = operation.catch(() => {
        });
        return operation;
      } : serialized;
      return queue(async () => {
        if (options.readOnly) await checkPiecesDirectory();
        else await initializePieces();
        const pieces = [], activeFilename = path2.basename(pieceFile(state.project.id));
        for (const filename of await readdir(piecesDir)) {
          if (!/^[a-f0-9]{64}\.json$/.test(filename) || filename === activeFilename) continue;
          const record = await readPiece(void 0, path2.join(piecesDir, filename));
          pieces.push(summary(record.project, record, false));
        }
        pieces.push(summary(state.project, await activeMeta(), true));
        pieces.sort((left, right) => Number(right.active) - Number(left.active) || right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));
        return { pieces };
      });
    },
    createPiece(candidate, options = {}) {
      const incoming = structuredClone(candidate), assignedId = options.projectId;
      return serialized(async () => {
        if (assignedId !== void 0) {
          if (typeof assignedId !== "string" || !/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(assignedId)) throw new StateError("Invalid owned piece identity.");
          if (assignedId === state.project.id) throw new StateError("Piece identity already exists.", 409);
          await initializePieces();
          if (await lstat2(pieceFile(assignedId)).catch((e) => {
            if (e.code === "ENOENT") return null;
            throw e;
          })) throw new StateError("Piece identity already exists.", 409);
        }
        shape(incoming, ["expectedProjectId", "expectedRevision"], "createPiece", ["project", "title"]);
        expected(incoming);
        if (incoming.title !== void 0) text(incoming.title, "title", 256);
        let project;
        if (incoming.project !== void 0) {
          validateState({ revision: 0, project: incoming.project });
          project = structuredClone(incoming.project);
          if (project.document?.writingTemplate) throw new StateError("A new piece needs its own writing template copy. Detach the inherited template before creating it.");
        } else project = createInitialState().project;
        project.id = assignedId || randomUUID2();
        if (incoming.title !== void 0) project.title = incoming.title;
        project.versions = [];
        project.document ||= { schema: "ar-create.document.v1", id: randomUUID2(), revision: 0, title: project.title, paragraphs: [], outputs: [] };
        project.document.id = randomUUID2();
        project.document.outputs = [];
        if (incoming.title !== void 0) project.document.title = incoming.title;
        const next = { revision: state.revision + 1, project }, metadata3 = { createdAt: timestamp(), updatedAt: timestamp() };
        validateState(next);
        envelope2(project, metadata3);
        await initializePieces();
        await assertRegularOrMissing(file);
        await assertRegularOrMissing(backup);
        if (articles) return commit(next, metadata3, { pieceProjects: [{ project: state.project, metadata: await activeMeta() }] });
        await writePiece(state.project, await activeMeta());
        await writePiece(project, metadata3, { exclusive: true });
        return commit(next, metadata3);
      });
    },
    switchPiece(candidate) {
      const incoming = structuredClone(candidate);
      return serialized(async () => {
        shape(incoming, ["expectedProjectId", "expectedRevision", "projectId"], "switchPiece");
        expected(incoming);
        id(incoming.projectId, "projectId");
        if (incoming.projectId === state.project.id) return structuredClone(state);
        await checkPiecesDirectory();
        const target = await readPiece(incoming.projectId), next = { revision: state.revision + 1, project: structuredClone(target.project) };
        validateState(next);
        await initializePieces();
        await assertRegularOrMissing(file);
        await assertRegularOrMissing(backup);
        if (articles) {
          await articles.checkArticle(target.project);
          return commit(next, { createdAt: target.createdAt, updatedAt: target.updatedAt }, { pieceProjects: [{ project: state.project, metadata: await activeMeta() }] });
        }
        await writePiece(state.project, await activeMeta());
        return commit(next, { createdAt: target.createdAt, updatedAt: target.updatedAt });
      });
    }
  };
}

// services/draft-history.mjs
import { createHash as createHash6 } from "node:crypto";

// services/draft-correspondence.mjs
import { createHash as createHash4 } from "node:crypto";
import { createHash as createHash22, randomUUID as randomUUID3 } from "node:crypto";
import { fromMarkdown as fromMarkdown2 } from "mdast-util-from-markdown";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { fromMarkdown as fromMarkdown3 } from "mdast-util-from-markdown";
var protectedEditorial = /%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`/g;
function approvalMarks(raw) {
  const text4 = String(raw || "").replace(protectedEditorial, "");
  const pairs = [...text4.matchAll(/==(?=\S)([\s\S]*?\S)==/g)].length, remaining = text4.replace(/==(?=\S)([\s\S]*?\S)==/g, "");
  const incomplete = [...remaining.matchAll(/(?:^|\n|\s)==(?=\S)|(?<=\S)==(?=$|\n)/g)].length;
  return { pairs, tokens: pairs * 2 + incomplete };
}
function approveMarkedProse(raw) {
  const marks = approvalMarks(raw);
  if (marks.tokens !== marks.pairs * 2) throw Error("An approval mark is incomplete. Edit that paragraph before approving marked prose.");
  const protectedParts2 = [], token = crypto.randomUUID();
  let masked = raw.replace(protectedEditorial, (part2) => {
    protectedParts2.push(part2);
    return token + ":" + (protectedParts2.length - 1) + ":";
  });
  masked = masked.replace(/==(?=\S)([\s\S]*?\S)==/g, "$1");
  for (let index = 0; index < protectedParts2.length; index++) masked = masked.replaceAll(token + ":" + index + ":", protectedParts2[index]);
  return masked;
}
var hash2 = (s) => createHash4("sha256").update(s).digest("hex");
var protectedParts = /%%rework%%[\s\S]*?%%\/rework%%|%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`|\[\[term:[^\]]+\]\]|\]\([^\n)]*\)/g;
var fail2 = (message) => {
  throw Error(message);
};
function exactApprovalSpans(raw) {
  if (typeof raw !== "string" || !raw.isWellFormed()) return [];
  const t = raw.trim();
  if (!t || /^(?:\||```|~~~|<| {4}|\t)/.test(t)) return [];
  const marks = approvalMarks(raw);
  if (marks.tokens !== marks.pairs * 2) return [];
  const masked = raw.replace(protectedParts, (p) => p.replace(/[^\r\n]/g, "\0")), spans = [];
  for (const match of masked.matchAll(/==(?=\S)([\s\S]*?\S)==/g)) {
    const rawFrom = match.index, rawTo = rawFrom + match[0].length, markup = raw.slice(rawFrom, rawTo), inner = markup.slice(2, -2);
    if (raw[rawFrom - 1] === "=" || raw[rawTo] === "=" || inner.startsWith("=") || inner.endsWith("=") || !match[1].replaceAll("\0", "").trim()) continue;
    const selected = approvalMarks(markup);
    if (selected.pairs !== 1 || selected.tokens !== 2) continue;
    let approved;
    try {
      approved = approveMarkedProse(markup);
    } catch {
      continue;
    }
    if (approved !== inner) continue;
    spans.push({ rawFrom, rawTo, seenMarkupHash: hash2(markup) });
  }
  return spans;
}
function approveExactSpan(raw, operation) {
  if (operation.humanDecision !== true) fail2("Explicit human approval decision required.");
  if (!Number.isSafeInteger(operation.rawFrom) || !Number.isSafeInteger(operation.rawTo) || operation.rawFrom < 0 || operation.rawTo <= operation.rawFrom || typeof operation.seenMarkupHash !== "string" || !/^[a-f0-9]{64}$/.test(operation.seenMarkupHash)) fail2("Exact native markup span/hash required.");
  const span = exactApprovalSpans(raw).find((s) => s.rawFrom === operation.rawFrom && s.rawTo === operation.rawTo && s.seenMarkupHash === operation.seenMarkupHash);
  if (!span) fail2("Approval span changed, is incomplete, protected or ambiguous; preserve source bytes.");
  const changed = raw.slice(0, span.rawFrom) + raw.slice(span.rawFrom + 2, span.rawTo - 2) + raw.slice(span.rawTo);
  if (approveMarkedProse(raw) !== approveMarkedProse(changed)) fail2("Approval changed more than the selected canonical delimiters.");
  return changed;
}
var reworkSlashes = () => /(^|[\s"'(])\/([^\/\n]+?)\/(?=$|[\s.,;:!?"')])/g;
var requestBody = (value) => String(value || "").replace(/^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
function guidanceRegions(raw) {
  raw = String(raw || "");
  const prefix = raw.slice(0, raw.length - requestBody(raw).length);
  const body = raw.slice(prefix.length), pending = new Uint8Array(body.length);
  const markers = /<!--\s*VOICE-QUEUE-START\s*-->[\s\S]*?(?:<!--\s*VOICE-QUEUE-END\s*-->|$)|<!--\s*VOICE-QUEUE-END\s*-->/gi;
  for (const match of body.matchAll(markers)) pending.fill(1, match.index, match.index + match[0].length);
  const offsets = [], visible = [];
  for (let index = 0; index < body.length; index++) if (!pending[index]) {
    offsets.push(index);
    visible.push(body[index]);
  }
  let cursor = 0, queueLevel = null, fence = null;
  for (const match of visible.join("").matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
    const line = match[0].replace(/\r?\n$/, "");
    const boundary = line.match(/^ {0,3}(`{3,}|~{3,})/);
    const heading = !fence && line.match(/^ {0,3}(#{1,6})[ \t]+(.+)$/);
    if (queueLevel !== null && heading && heading[1].length <= queueLevel) queueLevel = null;
    if (heading && /^Strengthenings[ \t]+queue\b/i.test(heading[2])) queueLevel = heading[1].length;
    if (queueLevel !== null) for (let index = cursor; index < cursor + match[0].length; index++) pending[offsets[index]] = 1;
    if (boundary) {
      if (!fence) fence = boundary[1];
      else if (boundary[1][0] === fence[0] && boundary[1].length >= fence.length) fence = null;
    }
    cursor += match[0].length;
  }
  const regions = [];
  for (let start = 0; start < body.length; ) {
    let end = start + 1;
    while (end < body.length && pending[end] === pending[start]) end++;
    regions.push({ raw: body.slice(start, end), pending: !!pending[start] });
    start = end;
  }
  if (!regions.length || regions[0].pending) regions.unshift({ raw: "", pending: false });
  return { prefix, regions };
}
function splitBlocks(md) {
  const fm = (md.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/) || [""])[0];
  return { fm, parts: md.slice(fm.length).split(/(\r?\n\s*\r?\n)/) };
}
var protectedMarks = /%%[\s\S]*?%%|<!--[\s\S]*?-->/g;
function plain(raw) {
  return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "/$1/").replace(/\s*%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/^>\s?/gm, "").replace(/^#{1,6}\s+/, "").replace(/==([\s\S]*?)==/g, "$1").replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1").replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}
function editable(raw) {
  const t = raw.trim();
  if (!t || t === "---" || /^%%[\s\S]*%%$/.test(t) || /^<!--[\s\S]*-->$/.test(t) || /^\|/.test(t) || /^```/.test(t) || /^~~~/.test(t)) return false;
  if (/^[-*] /m.test(t) && t.split("\n").every((line) => /^\s*([-*] |\d+\. )/.test(line) || /^\s+/.test(line))) return false;
  if (/^\d+[.)] /m.test(t)) return false;
  if (/^\*\*[^*]+:\*\*\s*$/m.test(t.split("\n")[0])) return false;
  return true;
}
function documentParts(raw, protectGuidanceQueue = true) {
  const projection22 = protectGuidanceQueue ? guidanceRegions(raw) : { prefix: splitBlocks(raw).fm, regions: [{ raw: raw.slice(splitBlocks(raw).fm.length), pending: false }] };
  const parts = [], blocks = [], separators = /* @__PURE__ */ new Set();
  for (const region of projection22.regions) {
    if (region.pending) {
      parts.push(region.raw);
      continue;
    }
    const chunk = region.raw.split(/(\r?\n\s*\r?\n)/);
    for (let index = 0; index < chunk.length; index++) {
      const partIndex = parts.length, part2 = chunk[index];
      parts.push(part2);
      if (index % 2) separators.add(partIndex);
      else blocks.push({ index: blocks.length, partIndex, raw: part2, plain: plain(part2), editable: editable(part2) });
    }
  }
  if (!blocks.some((block2) => block2.raw.trim()) && blocks[0]) blocks[0].editable = true;
  return { prefix: projection22.prefix, suffix: "", parts, blocks, separators };
}
function readableBlock(raw) {
  return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "/$1/").replace(protectedMarks, "").replace(/==([\s\S]*?)==/g, "**$1**").replace(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g, "$2");
}
function safePassageHref2(value) {
  if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f<>]/u.test(value)) return false;
  if (value.startsWith("#")) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (/^https?:/i.test(value)) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
    } catch {
      return false;
    }
  }
  return /^(mailto|tel):[^:]/i.test(value);
}
var PARSE_OPTIONS2 = {
  extensions: [{
    disable: {
      null: [
        "autolink",
        "labelStartLink",
        "labelStartImage",
        "labelEnd",
        "definition",
        "codeIndented",
        "codeFenced",
        "htmlFlow",
        "htmlText",
        "thematicBreak",
        "setextUnderline",
        "characterReference"
      ]
    }
  }]
};
var LINK_PARSE_OPTIONS2 = { extensions: [{ disable: { null: PARSE_OPTIONS2.extensions[0].disable.null.filter((name) => !["labelStartLink", "labelEnd"].includes(name)) } }] };
function separatorBefore(node, previous) {
  if (!previous?.position || !node.position) return "blank";
  return node.position.start.line === previous.position.end.line + 1 ? "line" : "blank";
}
function delimiterAt(source, node, fallback) {
  const offset = node.position?.start.offset;
  if (typeof offset !== "number") return fallback;
  const two = source.slice(offset, offset + 2);
  if (two === "**" || two === "__") return two;
  const one = source[offset];
  return one === "*" || one === "_" ? one : fallback;
}
function inlineChildren(nodes, source, marks = []) {
  const out = [];
  const text4 = (value, extra = []) => {
    const all = [...marks, ...extra].map((mark) => ({ type: mark.type, attrs: { ...mark.attrs } }));
    value.split("\n").forEach((piece, index) => {
      if (index > 0) out.push({ type: "hardBreak" });
      if (piece) out.push(all.length ? { type: "text", text: piece, marks: all } : { type: "text", text: piece });
    });
  };
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        text4(node.value);
        break;
      case "strong":
        out.push(...inlineChildren(node.children, source, [...marks, { type: "bold", attrs: { markup: delimiterAt(source, node, "**") } }]));
        break;
      case "emphasis":
        out.push(...inlineChildren(node.children, source, [...marks, { type: "italic", attrs: { markup: delimiterAt(source, node, "_") } }]));
        break;
      case "inlineCode":
        text4(node.value, [{ type: "code", attrs: {} }]);
        break;
      case "link": {
        if (!safePassageHref2(node.url)) throw new Error("The draft contains an unsafe citation URL. Review that link before importing.");
        const labelEnd = node.children.at(-1)?.position?.end.offset, end = node.position?.end.offset;
        const destination = typeof labelEnd === "number" && typeof end === "number" ? source.slice(labelEnd, end) : null;
        out.push(...inlineChildren(node.children, source, [...marks, { type: "link", attrs: { href: node.url, title: node.title ?? null, markdownDestination: destination } }]));
        break;
      }
      case "break":
        out.push({ type: "hardBreak" });
        break;
      default:
        if ("value" in node && typeof node.value === "string") text4(node.value);
        else if ("children" in node) out.push(...inlineChildren(node.children, source, marks));
    }
  }
  return out;
}
function blockChildren(nodes, source) {
  const out = [];
  let previous = null;
  for (const node of nodes) {
    const sep = separatorBefore(node, previous);
    switch (node.type) {
      case "paragraph": {
        const content = inlineChildren(node.children, source);
        out.push(content.length ? { type: "paragraph", attrs: { sep }, content } : { type: "paragraph", attrs: { sep } });
        break;
      }
      case "heading": {
        const content = inlineChildren(node.children, source);
        out.push(content.length ? { type: "heading", attrs: { sep, level: node.depth }, content } : { type: "heading", attrs: { sep, level: node.depth } });
        break;
      }
      case "list": {
        const items = node.children.map((item) => {
          const content = blockChildren(item.children, source);
          return content.length ? { type: "listItem", content } : { type: "listItem", content: [{ type: "paragraph" }] };
        });
        out.push(node.ordered ? { type: "orderedList", attrs: { sep, tight: !node.spread, start: node.start ?? 1 }, content: items } : { type: "bulletList", attrs: { sep, tight: !node.spread }, content: items });
        break;
      }
      case "blockquote":
        out.push({ type: "blockquote", attrs: { sep }, content: blockChildren(node.children, source) });
        break;
      default:
        if ("children" in node) out.push({ type: "paragraph", attrs: { sep }, content: inlineChildren(node.children, source) });
        else if ("value" in node && typeof node.value === "string") out.push({ type: "paragraph", attrs: { sep }, content: [{ type: "text", text: node.value }] });
    }
    previous = node;
  }
  return out;
}
function markdownToDoc(text4, options = {}) {
  const content = blockChildren(fromMarkdown2(text4, options.links ? LINK_PARSE_OPTIONS2 : PARSE_OPTIONS2).children, text4);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph", attrs: { sep: "blank" } }] };
}
var PassageMarkdownAttributes = Extension.create({
  name: "passageMarkdownAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList", "blockquote"],
        attributes: { sep: { default: null, rendered: false } }
      },
      {
        types: ["bulletList", "orderedList"],
        attributes: { tight: { default: true, rendered: false } }
      },
      { types: ["link"], attributes: { markdownDestination: { default: null, rendered: false } } },
      {
        types: ["bold", "italic"],
        attributes: { markup: { default: null, rendered: false } }
      }
    ];
  }
});
var hash22 = (s) => createHash22("sha256").update(s).digest("hex");
var conflict = (reason) => {
  throw new Error(reason);
};
function envelope(raw) {
  const trimmed = raw.trim(), start = raw.indexOf(trimmed), end = start + trimmed.length;
  const heading = /^(#{1,3})([ \t]+)(?=\S)/.exec(trimmed), quote = /^>( ?)(?=\S)/.exec(trimmed);
  const kind = heading ? "heading" : quote ? "blockquote" : "paragraph";
  const prefix = heading ? heading[0] : quote ? quote[0] : "";
  return { kind, level: heading?.[1].length, start, end, prefix, bodyStart: start + prefix.length };
}
var treeWords = (node) => node.type === "text" ? node.text || "" : node.type === "hardBreak" ? "\n" : (node.content || []).map(treeWords).join("");
function inlineMap(raw) {
  let words3 = "", runs = [], notes = false, safe = true, reworks = [];
  const add = (value, a, b, locked = false) => {
    runs.push({ from: words3.length, to: words3.length + value.length, rawFrom: a, rawTo: b, locked });
    words3 += value;
  };
  const scan = (a, b) => {
    let i = a;
    while (i < b) {
      const rest = raw.slice(i, b);
      let m;
      if (rest.startsWith("%%rework%%")) {
        const request = /^%%rework%%([^\r\n]*?)%%\/rework%%/.exec(rest);
        if (!request || !request[1].trim() || request[1].includes("%%")) {
          safe = false;
          add(rest, i, b, true);
          i = b;
          continue;
        }
        const from = words3.length, end = i + request[0].length;
        add("/", i, i + 10);
        scan(i + 10, end - 11);
        add("/", end - 11, end);
        reworks.push({ from, to: words3.length, rawFrom: i, rawTo: end, words: plain(request[1]) });
        i = end;
        continue;
      }
      if (m = /^(%%[\s\S]*?%%|<!--[\s\S]*?-->)/.exec(rest)) {
        notes = true;
        add("", i, i + m[0].length, true);
        i += m[0].length;
        continue;
      }
      if (m = /^\[\[term:[^|\]]+\|([^\]]+)\]\]/.exec(rest)) {
        add(m[1], i, i + m[0].length, true);
        i += m[0].length;
        continue;
      }
      if (m = /^==([^=]+)==/.exec(rest)) {
        add(plain(m[1]), i, i + m[0].length, true);
        i += m[0].length;
        continue;
      }
      if (m = /^\[([^\]]+)\]\(([^)]+)\)/.exec(rest)) {
        add(plain(m[1]), i, i + m[0].length, true);
        i += m[0].length;
        continue;
      }
      if (m = /^(\*\*|__)([^*_]+)\1/.exec(rest)) {
        scan(i + m[1].length, i + m[0].length - m[1].length);
        i += m[0].length;
        continue;
      }
      if (/[\n\r*_`<>{}\\]/.test(raw[i]) || rest.startsWith("%%") || rest.startsWith("==") || rest.startsWith("[[")) safe = false;
      add(raw[i], i, i + 1);
      i++;
    }
  };
  const frame = envelope(raw);
  scan(frame.bodyStart, frame.end);
  const leading = words3.length - words3.trimStart().length, trailing = words3.trimEnd().length;
  runs = runs.map((r) => ({ ...r, from: r.from - leading, to: r.to - leading })).filter((r) => r.to >= 0 && r.from <= trailing - leading);
  reworks = reworks.map((r) => ({ ...r, from: r.from - leading, to: r.to - leading }));
  words3 = words3.trim();
  const body = raw.slice(frame.bodyStart, frame.end);
  const knownWholeRequest = reworks.length === 1 && reworks[0].from === 0 && reworks[0].to === words3.length && !notes;
  safe = safe && !/^(?: {4}|\t)/m.test(raw) && (editable(raw) || knownWholeRequest) && words3 === plain(body) && !/^\s*[#>]|^\s*[-+*]\s|^\s*\d+[.)]\s/.test(body);
  let doc = null;
  if (safe) {
    doc = markdownToDoc(readableBlock(raw.slice(frame.start, frame.end)), { links: true });
    const nodes = doc.content || [], node = nodes[0];
    safe = nodes.length === 1 && treeWords(doc) === words3 && (frame.kind === "paragraph" ? node?.type === "paragraph" : frame.kind === "heading" ? node?.type === "heading" && node.attrs?.level === frame.level : node?.type === "blockquote" && node.content?.length === 1 && node.content[0].type === "paragraph");
    if (!safe) doc = null;
  }
  return { words: words3, runs, notes, safe, doc, blockKind: frame.kind, level: frame.level, frame, reworks };
}
function render(snapshot2) {
  return snapshot2.prefix + snapshot2.blocks.map((b) => b.raw + b.separator).join("");
}
function capture(raw, sourceKey) {
  const m = documentParts(raw, false), blocks = [], fileHash = hash22(raw);
  let offset = m.prefix.length;
  for (let i = 0; i < m.parts.length; i++) {
    if (m.separators.has(i)) conflict("Unexpected donor separator topology.");
    const block2 = m.parts[i], separator = m.separators.has(i + 1) ? m.parts[++i] : "";
    blocks.push({ id: randomUUID3(), raw: block2, separator, origin: { fileHash, blockHash: hash22(block2), offset } });
    offset += block2.length + separator.length;
  }
  const out = { schema: "mag-dev-correspondence.v1", sourceKey, fileHash, prefix: m.prefix, blocks };
  if (render(out) !== raw) conflict("Donor projection did not retain exact bytes.");
  return out;
}
function projection(s) {
  return s.blocks.map((b) => ({ id: b.id, origin: b.origin, blockHash: hash22(b.raw), ...inlineMap(b.raw) }));
}
var byteBoundary = (map, position, bias = "right") => {
  if (position > 0 && position < map.words.length && /[\uD800-\uDBFF]/.test(map.words[position - 1]) && /[\uDC00-\uDFFF]/.test(map.words[position])) conflict("Native range divides a Unicode character.");
  if (!Number.isSafeInteger(position) || position < 0 || position > map.words.length) conflict("Invalid native range.");
  if (map.runs.some((r) => r.locked && r.from < position && position < r.to)) conflict("Protected inline identity cannot be split.");
  const right = map.runs.find((r) => r.from === position && r.to > position), left = [...map.runs].reverse().find((r) => r.to === position && r.from < position);
  return (bias === "left" ? left?.rawTo ?? right?.rawFrom : right?.rawFrom ?? left?.rawTo) ?? conflict("Unmapped native boundary.");
};
function apply(s, currentRaw, ops) {
  if (hash22(currentRaw) !== s.fileHash || currentRaw !== render(s)) conflict("External file change: reload and explicitly rebind; never rematch repeated text by position.");
  const next = structuredClone(s), ledger = [], reworkLog = [];
  const get = (id2) => next.blocks.find((b) => b.id === id2) ?? conflict("Unknown stable block ID.");
  const fresh = (id2) => {
    if (!id2 || next.blocks.some((b) => b.id === id2)) conflict("Fresh unique native ID required.");
  };
  const newline = currentRaw.includes("\r\n") ? "\r\n" : "\n";
  if (!Array.isArray(ops) || ops.length > 1e3) conflict("Bounded operation array required.");
  for (const op of ops) {
    validateOperation(op);
    if (op.kind === "approveMark") {
      const b = get(op.id), beforeFrame = envelope(b.raw);
      if (hash22(b.raw) !== op.seenBlockHash) conflict("Block changed since exact human approval capture.");
      if (!editable(b.raw)) conflict("Opaque source structure requires its own decision, not prose approval.");
      const changed = approveExactSpan(b.raw, op), afterFrame = envelope(changed);
      if (beforeFrame.kind !== afterFrame.kind || beforeFrame.level !== afterFrame.level) conflict("Approval cannot change source words or native block kind.");
      const beforeParts = documentParts(b.raw, false), afterParts = documentParts(changed, false);
      if (beforeParts.prefix !== afterParts.prefix || beforeParts.parts.length !== afterParts.parts.length || JSON.stringify([...beforeParts.separators]) !== JSON.stringify([...afterParts.separators])) conflict("Approval cannot change native topology.");
      b.raw = changed;
    } else if (op.kind === "text") {
      const b = get(op.id), m = inlineMap(b.raw);
      if (hash22(b.raw) !== op.seenBlockHash) conflict("Block changed since native edit capture.");
      if (!m.safe) conflict("Unknown source syntax is read-only.");
      if (op.from > op.to || /[\r\n\u0000]/.test(op.insert) || /[\[\]*_`<>=]|%%/.test(op.insert)) conflict("Use explicit structure/format operations; text insert cannot invent syntax.");
      const offered = exactApprovalSpans(b.raw);
      const pendingRun = m.runs.find((r) => r.locked && r.from <= op.from && r.to >= op.to && (op.from < op.to || op.from > r.from && op.from < r.to) && offered.some((span) => span.rawFrom === r.rawFrom && span.rawTo === r.rawTo) && b.raw.slice(r.rawFrom + 2, r.rawTo - 2) === m.words.slice(r.from, r.to) && !/[\r\n\[\]*_`<>=\\]|%%/.test(b.raw.slice(r.rawFrom + 2, r.rawTo - 2)));
      if (m.runs.some((r) => r.locked && r !== pendingRun && (r.from < op.to && r.to > op.from || r.from === r.to && op.from < r.from && op.to > r.to))) conflict("Native edit touches protected source/term/pending/note bytes.");
      if (pendingRun) {
        for (const position of [op.from, op.to]) if (position > 0 && position < m.words.length && /[\uD800-\uDBFF]/.test(m.words[position - 1]) && /[\uDC00-\uDFFF]/.test(m.words[position])) conflict("Native range divides a Unicode character.");
      }
      if (op.insert === m.words.slice(op.from, op.to)) continue;
      const completeRequest = m.reworks.find((r) => r.from === op.from && r.to === op.to);
      const a = pendingRun ? pendingRun.rawFrom + 2 + op.from - pendingRun.from : completeRequest?.rawFrom ?? byteBoundary(m, op.from), z = pendingRun ? pendingRun.rawFrom + 2 + op.to - pendingRun.from : completeRequest?.rawTo ?? byteBoundary(m, op.to, "left");
      if (!completeRequest && z - a !== op.to - op.from) conflict("Native range crosses a formatting or request boundary; edit each text run or complete request separately.");
      let changed = b.raw.slice(0, a) + op.insert + b.raw.slice(z);
      const mapped = inlineMap(changed);
      if (!mapped.safe || mapped.blockKind !== m.blockKind || mapped.level !== m.level) conflict("Edit would create unsupported or unbalanced source syntax or change block kind.");
      if (pendingRun && exactApprovalSpans(changed).length !== offered.length) conflict("Pending wording correction must retain every review mark.");
      const requests = [...mapped.words.matchAll(reworkSlashes())].map((match) => ({ from: match.index + match[1].length, to: match.index + match[0].length, words: match[2] }));
      for (const request of requests.reverse()) {
        if (mapped.reworks.some((r) => r.from === request.from && r.to === request.to)) continue;
        if (mapped.runs.some((r) => r.locked && (r.from < request.to && r.to > request.from || r.from === r.to && request.from < r.from && request.to > r.to))) conflict("Rework request touches protected source/term/pending/note identity.");
        const start = byteBoundary(mapped, request.from), end = byteBoundary(mapped, request.to, "left"), rawSpan = changed.slice(start, end);
        if (!rawSpan.startsWith("/") || !rawSpan.endsWith("/")) conflict("Request range is not losslessly mapped to source slashes.");
        changed = changed.slice(0, start) + "%%rework%%" + rawSpan.slice(1, -1) + "%%/rework%%" + changed.slice(end);
      }
      const after = inlineMap(changed);
      if (!after.safe) conflict("Rework request is not safely represented by the native donor.");
      for (const r of after.reworks) if (!m.words.includes("/" + r.words + "/")) reworkLog.push(r.words);
      b.raw = changed;
    } else if (op.kind === "blockKind") {
      const b = get(op.id), m = inlineMap(b.raw);
      if (!m.safe) conflict("Unknown source syntax is read-only.");
      if (hash22(b.raw) !== op.seenBlockHash) conflict("Block changed since native kind change capture.");
      const f = m.frame;
      const prefix = op.blockKind === "paragraph" ? "" : op.blockKind === "blockquote" ? f.kind === "blockquote" ? f.prefix : "> " : "#".repeat(op.level) + (f.kind === "heading" ? f.prefix.slice(f.level) : " ");
      const changed = b.raw.slice(0, f.start) + prefix + b.raw.slice(f.bodyStart);
      const after = inlineMap(changed);
      if (!after.safe || after.blockKind !== op.blockKind || op.blockKind === "heading" && after.level !== op.level || after.words !== m.words) conflict("Kind change is not represented losslessly by the native donor.");
      ledger.push({ kind: "block-kind-lineage", id: b.id, from: m.blockKind, to: op.blockKind, oldPrefix: f.prefix, newPrefix: prefix });
      b.raw = changed;
    } else if (op.kind === "split") {
      const b = get(op.id), m = inlineMap(b.raw);
      fresh(op.newId);
      if (!m.safe || m.blockKind !== "paragraph") conflict("Only supported paragraphs can split; change heading/quote kind explicitly first.");
      const at = byteBoundary(m, op.at);
      const left = b.raw.slice(0, at), right = b.raw.slice(at);
      if (!left.trim() || !right.trim() || !inlineMap(left).safe || !inlineMap(right).safe) conflict("Split must leave two independently supported blocks and balanced protected formatting.");
      const oldSeparator = b.separator;
      b.raw = left;
      b.separator = newline + newline;
      next.blocks.splice(next.blocks.indexOf(b) + 1, 0, { id: op.newId, raw: right, separator: oldSeparator, origin: null });
    } else if (op.kind === "join") {
      const left = get(op.leftId), right = get(op.rightId);
      if (next.blocks.indexOf(right) !== next.blocks.indexOf(left) + 1) conflict("Only adjacent block joins have explicit lineage.");
      if (!inlineMap(left.raw).safe || !inlineMap(right.raw).safe || inlineMap(left.raw).blockKind !== "paragraph" || inlineMap(right.raw).blockKind !== "paragraph") conflict("Only supported paragraphs can join; change heading/quote kind explicitly first.");
      left.raw += " " + right.raw;
      left.separator = right.separator;
      next.blocks.splice(next.blocks.indexOf(right), 1);
      ledger.push({ kind: "join-lineage", retainedId: left.id, consumedId: right.id, removedSeparator: getOriginalSeparator(s, right.id, left.id) });
    } else if (op.kind === "delete") {
      const b = get(op.id), m = inlineMap(b.raw);
      if (!m.safe || m.notes || m.runs.some((r) => r.locked)) conflict("Delete requires separate explicit protected-material decision.");
      next.blocks.splice(next.blocks.indexOf(b), 1);
    } else if (op.kind === "insert") {
      fresh(op.id);
      if (!inlineMap(op.raw).safe || !op.raw.trim()) conflict("New blocks must be supported ordinary Markdown prose.");
      const i = op.beforeId === null ? next.blocks.length : next.blocks.indexOf(get(op.beforeId));
      if (i > 0 && !next.blocks[i - 1].separator) next.blocks[i - 1].separator = newline + newline;
      next.blocks.splice(i, 0, { id: op.id, raw: op.raw, separator: newline + newline, origin: null });
    } else {
      const b = get(op.id);
      if (op.beforeId === b.id) continue;
      next.blocks.splice(next.blocks.indexOf(b), 1);
      const i = op.beforeId === null ? next.blocks.length : next.blocks.indexOf(get(op.beforeId));
      if (i > 0 && !next.blocks[i - 1].separator) next.blocks[i - 1].separator = newline + newline;
      if (i < next.blocks.length && !b.separator) b.separator = newline + newline;
      next.blocks.splice(i, 0, b);
    }
    ledger.push(op);
  }
  const raw = render(next);
  next.fileHash = hash22(raw);
  return { raw, snapshot: next, ledger, expectedOriginalHash: s.fileHash, nextOriginalHash: next.fileHash, reworks: reworkLog, inverse: { schema: "mag-dev-inverse.v1", before: structuredClone(s), afterHash: next.fileHash, afterSnapshotHash: hash22(JSON.stringify(next)) } };
}
function getOriginalSeparator(s, _right, left) {
  return s.blocks.find((b) => b.id === left)?.separator ?? null;
}
function undo(current, currentRaw, inverse) {
  if (!inverse || inverse.schema !== "mag-dev-inverse.v1" || !inverse.before || inverse.before.sourceKey !== current.sourceKey || inverse.afterHash !== current.fileHash || hash22(currentRaw) !== current.fileHash || render(current) !== currentRaw || hash22(JSON.stringify(current)) !== inverse.afterSnapshotHash) conflict("Undo receipt or current original changed; preserve external bytes.");
  const raw = render(inverse.before);
  if (hash22(raw) !== inverse.before.fileHash) conflict("Inverse receipt before bytes are damaged.");
  return { raw, snapshot: structuredClone(inverse.before), expectedOriginalHash: current.fileHash, nextOriginalHash: inverse.before.fileHash };
}
function validateOperation(op) {
  const shapes = { approveMark: ["kind", "id", "rawFrom", "rawTo", "seenBlockHash", "seenMarkupHash", "humanDecision"], text: ["kind", "id", "from", "to", "insert", "seenBlockHash"], move: ["kind", "id", "beforeId"], split: ["kind", "id", "at", "newId"], join: ["kind", "leftId", "rightId"], insert: ["kind", "id", "beforeId", "raw"], delete: ["kind", "id"], blockKind: ["kind", "id", "blockKind", "level", "seenBlockHash"] };
  if (!op || typeof op !== "object" || Array.isArray(op) || !Object.hasOwn(shapes, op.kind)) conflict("Unknown document operation kind.");
  const keys = shapes[op.kind];
  if (Object.keys(op).some((k) => !keys.includes(k)) || keys.filter((k) => k !== "level").some((k) => !Object.hasOwn(op, k))) conflict("Malformed document operation fields.");
  for (const key of ["id", "leftId", "rightId", "newId"]) if (key in op && (typeof op[key] !== "string" || !op[key] || op[key].length > 256 || !op[key].isWellFormed() || /[\u0000-\u001f]/.test(op[key]))) conflict("Malformed stable native ID.");
  if ("beforeId" in op && op.beforeId !== null && (typeof op.beforeId !== "string" || !op.beforeId)) conflict("Malformed target native ID.");
  for (const key of ["from", "to", "at"]) if (key in op && (!Number.isSafeInteger(op[key]) || op[key] < 0)) conflict("Invalid native range.");
  for (const key of ["insert", "raw"]) if (key in op && (typeof op[key] !== "string" || !op[key].isWellFormed() || op[key].includes("\0"))) conflict("Well-formed Unicode text required.");
  if ("seenBlockHash" in op && (typeof op.seenBlockHash !== "string" || !/^[a-f0-9]{64}$/.test(op.seenBlockHash))) conflict("Malformed seen block hash.");
  if (op.kind === "blockKind" && (!["paragraph", "heading", "blockquote"].includes(op.blockKind) || op.blockKind === "heading" && ![1, 2, 3].includes(op.level) || op.blockKind !== "heading" && op.level !== void 0)) conflict("Unsupported native block kind or heading level.");
}
function approvalSpans(raw) {
  if (!editable(raw)) return [];
  return exactApprovalSpans(raw).map((span) => ({ ...span, preview: raw.slice(span.rawFrom + 2, span.rawTo - 2).replace(/%%rework%%[\s\S]*?%%\/rework%%|%%[\s\S]*?%%|<!--[\s\S]*?-->/g, "") }));
}

// services/draft-correspondence-metadata.mjs
import { createHash as createHash5 } from "node:crypto";
var hash3 = (s) => createHash5("sha256").update(s).digest("hex");
function metadata2(snapshot2) {
  return { schema: "ar-create.bound-draft-correspondence.v1", sourceKey: snapshot2.sourceKey, fileHash: snapshot2.fileHash, prefixHash: hash3(snapshot2.prefix), prefixLength: snapshot2.prefix.length, blocks: snapshot2.blocks.map((b) => ({ id: b.id, blockHash: hash3(b.raw), rawLength: b.raw.length, separatorHash: hash3(b.separator), separatorLength: b.separator.length, origin: b.origin })) };
}
function snapshot(raw, record, sourceKey) {
  if (record?.schema !== "ar-create.bound-draft-correspondence.v1" || record.sourceKey !== sourceKey || record.fileHash !== hash3(raw)) throw Error("External DEV divergence or correspondence identity changed; explicit rebind required. Native pending operations must be preserved.");
  if (!Number.isSafeInteger(record.prefixLength) || record.prefixLength < 0 || !Array.isArray(record.blocks)) throw Error("Correspondence metadata damaged; explicit rebind required.");
  let offset = record.prefixLength;
  const s = { schema: "mag-dev-correspondence.v1", sourceKey, fileHash: record.fileHash, prefix: raw.slice(0, offset), blocks: [] };
  if (record.prefixHash !== hash3(s.prefix)) throw Error("Correspondence prefix damaged; explicit rebind required.");
  const ids = /* @__PURE__ */ new Set();
  for (const old of record.blocks) {
    if (typeof old.id !== "string" || !old.id || ids.has(old.id) || !Number.isSafeInteger(old.rawLength) || old.rawLength < 0 || !Number.isSafeInteger(old.separatorLength) || old.separatorLength < 0) throw Error("Correspondence metadata damaged; explicit rebind required.");
    const body = raw.slice(offset, offset + old.rawLength);
    offset += old.rawLength;
    const separator = raw.slice(offset, offset + old.separatorLength);
    offset += old.separatorLength;
    if (hash3(body) !== old.blockHash || hash3(separator) !== old.separatorHash) throw Error("Correspondence metadata damaged; explicit rebind required.");
    ids.add(old.id);
    s.blocks.push({ id: old.id, raw: body, separator, origin: old.origin });
  }
  if (offset !== raw.length || render(s) !== raw) throw Error("Correspondence roundtrip changed original bytes.");
  return s;
}

// services/draft-history.mjs
var digest = (value) => createHash6("sha256").update(value).digest("hex");
var fail3 = (message) => {
  throw Object.assign(new Error(message), { status: 409 });
};
var hash4 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function validatedSnapshot(model, sourceKey) {
  if (model?.schema !== "mag-dev-correspondence.v1" || model.sourceKey !== sourceKey || !hash4(model.sourceKey) || !hash4(model.fileHash) || typeof model.prefix !== "string" || !Array.isArray(model.blocks) || model.blocks.some((block2) => !block2 || typeof block2.id !== "string" || !block2.id || typeof block2.raw !== "string" || typeof block2.separator !== "string" || !(block2.origin === null || block2.origin && hash4(block2.origin.fileHash) && hash4(block2.origin.blockHash) && Number.isSafeInteger(block2.origin.offset) && block2.origin.offset >= 0))) fail3("Historical correspondence schema or source identity changed.");
  const raw = render(model), record = metadata2(model), validated = snapshot(raw, record, sourceKey);
  if (JSON.stringify(validated) !== JSON.stringify(model)) fail3("Historical correspondence did not retain its exact snapshot.");
  return { raw, model: validated, metadataRaw: JSON.stringify(record, null, 2) };
}
function historicalVersion({ receipt, projectId, draftRelative, sourceKey, position }) {
  if (receipt?.schema !== "ar-create.project-folder-operation.v1" || receipt.projectId !== projectId || receipt.state !== "committed" || !Array.isArray(receipt.changes) || !["before", "after"].includes(position)) fail3("Exact committed owned historical receipt required.");
  const text4 = receipt.changes.find((change) => !change.area && change.relativePath === draftRelative), meta = receipt.changes.find((change) => change.area === "binding-metadata" && change.relativePath === projectId + ".draft-correspondence.json");
  if (position === "before") {
    const inverse = receipt.correspondenceInverse;
    if (inverse?.schema !== "mag-dev-inverse.v1" || !hash4(inverse.afterHash) || !hash4(inverse.afterSnapshotHash) || !meta || !hash4(meta.beforeHash)) fail3("This earlier version cannot be reconstructed exactly.");
    const version = validatedSnapshot(inverse.before, sourceKey);
    if (version.model.fileHash !== receipt.expectedWorkflow?.draft || text4 && text4.beforeHash !== version.model.fileHash || digest(version.metadataRaw) !== meta.beforeHash) fail3("Historical before snapshot differs from its recorded receipt proof.");
    return version;
  }
  if (!meta || typeof meta.after !== "string" || digest(meta.after) !== meta.afterHash) fail3("This saved version has no exact correspondence proof.");
  const record = JSON.parse(meta.after), raw = text4?.after;
  if (typeof raw === "string") {
    if (digest(raw) !== text4.afterHash) fail3("Historical version bytes changed.");
    return validatedSnapshot(snapshot(raw, record, sourceKey), sourceKey);
  }
  const before = historicalVersion({ receipt, projectId, draftRelative, sourceKey, position: "before" });
  if (before.model.fileHash !== record.fileHash || receipt.correspondenceInverse.afterHash !== record.fileHash) fail3("Historical unchanged text proof differs.");
  return validatedSnapshot(snapshot(before.raw, record, sourceKey), sourceKey);
}
function canUndoVersion(input, currentModel, currentRaw) {
  if (!currentModel) return false;
  try {
    historicalVersion({ ...input, position: "before" });
    undo(currentModel, currentRaw, input.receipt.correspondenceInverse);
    return true;
  } catch {
    return false;
  }
}

// services/study-owned-relocation.mjs
import fs2 from "node:fs";
import path4 from "node:path";

// services/files.mjs
import fs from "node:fs";
import path3 from "node:path";
import { randomUUID as randomUUID4, createHash as createHash7 } from "node:crypto";
var digest2 = (bytes4) => createHash7("sha256").update(bytes4).digest("hex");
function regular(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new StateError("Source must be a regular file.", 403);
  if (stat.nlink > 1) throw new StateError("Linked files are read-only.", 403);
  return stat;
}
function atomicWrite2(file, bytes4, { exclusive = false, expectedHash = null } = {}) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat) {
    regular(file);
    if (exclusive) throw new StateError("A different file already uses that name.", 409);
  }
  const temporary = `${file}.${randomUUID4()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temporary, "wx", 384);
    fs.writeFileSync(fd, bytes4);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = void 0;
    if (expectedHash !== null && (!fs.existsSync(file) || digest2(fs.readFileSync(file)) !== expectedHash)) throw new StateError("File changed during save. Refresh before saving.", 409);
    if (exclusive) fs.linkSync(temporary, file);
    else fs.renameSync(temporary, file);
    const dir = fs.openSync(path3.dirname(file), "r");
    try {
      fs.fsyncSync(dir);
    } finally {
      fs.closeSync(dir);
    }
  } finally {
    if (fd !== void 0) fs.closeSync(fd);
    fs.rmSync(temporary, { force: true });
  }
}
function readJson(file, fallback) {
  if (!fs.existsSync(file)) return structuredClone(fallback);
  regular(file);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${path3.basename(file)}; existing data preserved: ${error.message}`);
  }
}
function ensurePrivateDirectory(root, relative2 = "") {
  if (path3.isAbsolute(relative2) || relative2.split(path3.sep).some((p) => p === "..") || relative2.includes("\0")) throw new Error("Backend directory escapes its data root.");
  let current = root;
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("Data root must be a real directory.");
  for (const part2 of relative2.split(path3.sep).filter(Boolean)) {
    current = path3.join(current, part2);
    const found = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!found) fs.mkdirSync(current, { mode: 448 });
    else if (found.isSymbolicLink() || !found.isDirectory()) throw new Error("Backend directory cannot be a symlink or file.");
  }
  return current;
}

// services/study-owned-relocation.mjs
var UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
var SHA = /^[a-f0-9]{64}$/;
var stable = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
var fail4 = () => {
  throw new StateError("Owned relocation proof changed or is not authorized.", 409);
};
function canonical(p, directory2 = true) {
  if (typeof p !== "string" || !path4.isAbsolute(p) || path4.resolve(p) !== p) fail4();
  let at = path4.parse(p).root;
  for (const part2 of p.slice(at.length).split(path4.sep).filter(Boolean)) {
    at = path4.join(at, part2);
    if (fs2.lstatSync(at).isSymbolicLink()) fail4();
  }
  const s = fs2.lstatSync(p);
  if (fs2.realpathSync(p) !== p || (directory2 ? !s.isDirectory() : !s.isFile() || s.nlink !== 1)) fail4();
  return s;
}
var stamp = (p) => {
  const s = canonical(p);
  return { path: p, dev: s.dev, ino: s.ino };
};
var validStamp = (r) => r && typeof r.path === "string" && Number.isSafeInteger(r.dev) && Number.isSafeInteger(r.ino);
var suffixes = { "roots.media": "media", "roots.workflow": "workflow", media: "media/Project", derived: "workflow/Derived" };
function createStudyOwnedRelocation({ dataDir, manifest } = {}) {
  if (!manifest) return null;
  const m = structuredClone(manifest);
  if (m.schema !== "ar-create.study-owned-relocation.v1" || m.dataRoot !== dataDir || typeof m.legacyDataRoot !== "string" || !path4.isAbsolute(m.legacyDataRoot) || path4.resolve(m.legacyDataRoot) !== m.legacyDataRoot || m.legacyDataRoot === dataDir || !Array.isArray(m.bindings)) fail4();
  const dataStamp = stamp(dataDir), entries = /* @__PURE__ */ new Map();
  const room = (root, id2) => path4.join(root, "study-draft-copies/copies", id2);
  for (const e of m.bindings) {
    if (!UUID.test(e.bindingId || "") || !SHA.test(e.bindingHash || "") || entries.has(e.bindingId) || !e.roots || Object.keys(e.roots).length !== 4 || !Array.isArray(e.captures)) fail4();
    for (const [k, suffix] of Object.entries(suffixes)) {
      const r = e.roots[k];
      if (!validStamp(r?.before) || !validStamp(r?.after) || r.before.path !== path4.join(room(m.legacyDataRoot, e.bindingId), suffix) || r.after.path !== path4.join(room(dataDir, e.bindingId), suffix) || stable(stamp(r.after.path)) !== stable(r.after)) fail4();
    }
    const used = /* @__PURE__ */ new Set();
    for (const c of e.captures) {
      const legacyCapture = path4.join(room(m.legacyDataRoot, e.bindingId), "capture");
      if (typeof c.copiedPath !== "string" || path4.dirname(c.copiedPath) !== legacyCapture || used.has(c.copiedPath) || !SHA.test(c.copiedHash || "") || c.relocatedPath !== path4.join(room(dataDir, e.bindingId), "capture", path4.basename(c.copiedPath))) fail4();
      canonical(c.relocatedPath, false);
      if (digest2(fs2.readFileSync(c.relocatedPath)) !== c.copiedHash) fail4();
      used.add(c.copiedPath);
    }
    entries.set(e.bindingId, e);
  }
  function check() {
    if (stable(stamp(dataDir)) !== stable(dataStamp)) fail4();
  }
  function binding(raw, b, configured) {
    check();
    const e = entries.get(b.projectId);
    if (!e) return b;
    if (digest2(raw) !== e.bindingHash) fail4();
    const updated = structuredClone(b), sourceKey = b.draftSourceKey ?? digest2(stable({ projectId: b.projectId, workflow: b.roots.workflow, draft: b.records.draft }));
    if (!SHA.test(sourceKey)) fail4();
    for (const [k] of Object.entries(suffixes)) {
      const prior = k.startsWith("roots.") ? b.roots[k.slice(6)] : b[k], r = e.roots[k];
      if (stable(prior) !== stable(r.before) || stable(stamp(r.after.path)) !== stable(r.after)) fail4();
      if (k.startsWith("roots.")) {
        const kind = k.slice(6);
        if (stable(configured[kind]) !== stable(r.after)) fail4();
        updated.roots[kind] = structuredClone(r.after);
      } else updated[k] = structuredClone(r.after);
    }
    updated.draftSourceKey = sourceKey;
    return updated;
  }
  function capture2(bindingId, record, captureDir) {
    check();
    const e = entries.get(bindingId);
    if (!e) {
      if (path4.dirname(record.copiedPath) !== captureDir) fail4();
      return record.copiedPath;
    }
    const bindingFile = path4.join(room(dataDir, bindingId), "metadata/ar-project-folder-bindings", bindingId + ".json");
    canonical(bindingFile, false);
    if (digest2(fs2.readFileSync(bindingFile)) !== e.bindingHash) fail4();
    const c = e.captures.find((c2) => c2.copiedPath === record.copiedPath);
    if (!c || c.copiedHash !== record.copiedHash || path4.dirname(c.relocatedPath) !== captureDir) fail4();
    for (const r of Object.values(e.roots)) if (stable(stamp(r.after.path)) !== stable(r.after)) fail4();
    canonical(c.relocatedPath, false);
    if (digest2(fs2.readFileSync(c.relocatedPath)) !== c.copiedHash) fail4();
    return c.relocatedPath;
  }
  return { binding, capture: capture2 };
}

// services/study-root-recovery.mjs
import fs3 from "node:fs";
import path5 from "node:path";
var UUID2 = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
var SHA2 = /^[a-f0-9]{64}$/;
var stable2 = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
var fail5 = (message) => {
  throw new StateError(message, 409);
};
var text2 = (bytes4) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes4);
function canonical2(file, directory2 = false) {
  if (typeof file !== "string" || !path5.isAbsolute(file) || path5.resolve(file) !== file) fail5("Recovery requires fixed canonical owner paths.");
  let current = path5.parse(file).root;
  for (const segment of file.slice(current.length).split(path5.sep).filter(Boolean)) {
    current = path5.join(current, segment);
    const stat2 = fs3.lstatSync(current);
    if (stat2.isSymbolicLink()) fail5("Recovery refuses symlink paths.");
  }
  const stat = fs3.lstatSync(file);
  if (fs3.realpathSync(file) !== file || (directory2 ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)) fail5("Recovery owner path changed.");
  return stat;
}
function bytes2(file, optional = false) {
  if (optional && !fs3.lstatSync(file, { throwIfNoEntry: false })) {
    canonical2(path5.dirname(file), true);
    return null;
  }
  canonical2(file);
  regular(file);
  const fd = fs3.openSync(file, fs3.constants.O_RDONLY | fs3.constants.O_NOFOLLOW);
  try {
    const before = fs3.fstatSync(fd);
    if (before.size > 64 * 1024 * 1024) fail5("Recovery proof exceeds file limit.");
    const raw = fs3.readFileSync(fd), after = fs3.fstatSync(fd), visible = fs3.lstatSync(file);
    if (before.dev !== visible.dev || before.ino !== visible.ino || before.size !== raw.length || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail5("Recovery evidence changed during read.");
    return raw;
  } finally {
    fs3.closeSync(fd);
  }
}
var hashAt = (file, optional = false) => {
  const raw = bytes2(file, optional);
  return raw === null ? null : digest2(raw);
};
function safeRel(rel) {
  if (typeof rel !== "string" || !rel || path5.isAbsolute(rel) || /[\\\x00-\x1f\x7f]/.test(rel) || rel.split("/").some((v) => !v || v === "." || v === ".." || v.startsWith("."))) fail5("Recovery refuses unsafe record paths.");
  return rel;
}
function projectionProof(raw, metadata3, sourceKey) {
  if (metadata3?.schema !== "ar-create.bound-draft-correspondence.v1" || metadata3.sourceKey !== sourceKey || metadata3.fileHash !== digest2(raw)) fail5("Native DEV projection identity or bytes changed.");
  const value = text2(raw);
  if (!Number.isSafeInteger(metadata3.prefixLength) || metadata3.prefixLength < 0 || !Array.isArray(metadata3.blocks) || digest2(value.slice(0, metadata3.prefixLength)) !== metadata3.prefixHash) fail5("Native DEV projection prefix changed.");
  let offset = metadata3.prefixLength;
  const ids = /* @__PURE__ */ new Set();
  for (const block2 of metadata3.blocks) {
    if (typeof block2.id !== "string" || !block2.id || ids.has(block2.id) || !Number.isSafeInteger(block2.rawLength) || block2.rawLength < 0 || !Number.isSafeInteger(block2.separatorLength) || block2.separatorLength < 0) fail5("Native DEV projection metadata changed.");
    const body = value.slice(offset, offset + block2.rawLength);
    offset += block2.rawLength;
    const separator = value.slice(offset, offset + block2.separatorLength);
    offset += block2.separatorLength;
    if (digest2(body) !== block2.blockHash || digest2(separator) !== block2.separatorHash) fail5("Native DEV projection block changed.");
    ids.add(block2.id);
  }
  if (offset !== value.length) fail5("Native DEV projection cannot retain exact bytes.");
  return [...ids];
}
function createStudyRootRecovery({ copyRoot, bindingId, parentStudyId, originalId, afterPublish } = {}) {
  if (!UUID2.test(bindingId || "") || typeof parentStudyId !== "string" || !parentStudyId || typeof originalId !== "string" || !originalId) fail5("Exact owned study identity required.");
  canonical2(copyRoot, true);
  const key = digest2(stable2({ parentStudyId, originalId }));
  const room = path5.join(copyRoot, "copies", bindingId);
  const intentFile = path5.join(copyRoot, "bindings", key + ".json");
  const area = path5.join(room, "metadata", "ar-project-folder-bindings");
  const bindingFile = path5.join(area, bindingId + ".json");
  const correspondenceFile = path5.join(area, bindingId + ".draft-correspondence.json");
  const journalFile = (id2) => path5.join(area, bindingId + "-" + id2 + ".root-recovery.json");
  const sourceKey = (b) => b.draftSourceKey ?? digest2(stable2({ projectId: b.projectId, workflow: b.roots.workflow, draft: b.records.draft }));
  let recoveryLock = null;
  function proof() {
    canonical2(room, true);
    canonical2(area, true);
    const adapterLock = fs3.lstatSync(path5.join(area, "adapter.lock"), { throwIfNoEntry: false });
    if (adapterLock && (!recoveryLock || adapterLock.ino !== recoveryLock.ino || adapterLock.dev !== recoveryLock.dev) || fs3.lstatSync(path5.join(room, "workflow", "Workflow", "_mag-running.md"), { throwIfNoEntry: false })) fail5("Pending owner operation or Magazine run requires recovery first.");
    const intentRaw = bytes2(intentFile), intent = JSON.parse(text2(intentRaw));
    if (intent.schema !== "ar-create.study-draft-copy.v1" || intent.id !== bindingId || intent.key !== key || intent.parentStudyId !== parentStudyId || intent.originalId !== originalId || intent.status !== "ready" || !SHA2.test(intent.captureHash || "")) fail5("Owned copy intent identity changed or is incomplete.");
    const bindingRaw = bytes2(bindingFile), binding = JSON.parse(text2(bindingRaw));
    if (binding.schema !== "ar-create.project-folders.v1" || binding.projectId !== bindingId || binding.draftAuthority !== "owned-working-copy" || !binding.roots || !binding.records || binding.records.draft !== intent.draftRelative || !/^Workflow\/3-Develop\/DEV - [^/]+\.md$/.test(binding.records.draft) || binding.records.edits !== "Workflow/4-Review/EDITS - " + path5.basename(binding.records.draft)) fail5("Owned binding authority changed.");
    if (!Array.isArray(binding.materials) || binding.materials.length || Object.keys(binding.records).some((k) => !["draft", "edits"].includes(k))) fail5("Recovery cannot prove expanded owner membership.");
    const roots = [
      ["roots.media", binding.roots.media, path5.join(room, "media")],
      ["roots.workflow", binding.roots.workflow, path5.join(room, "workflow")],
      ["media", binding.media, path5.join(room, "media", "Project")],
      ["derived", binding.derived, path5.join(room, "workflow", "Derived")]
    ].map(([name, root, fixed]) => {
      if (!root || root.path !== fixed || !Number.isSafeInteger(root.dev) || !Number.isSafeInteger(root.ino)) fail5("Recovery refuses changed canonical root paths.");
      const stat = canonical2(fixed, true);
      if (stat.ino !== root.ino) fail5("Recovery refuses changed root inodes.");
      return { name, path: fixed, ino: stat.ino, beforeDevice: root.dev, afterDevice: stat.dev };
    });
    const manifestFile = path5.join(room, "capture-manifest.json"), manifestRaw = bytes2(manifestFile);
    if (digest2(manifestRaw) !== intent.captureHash) fail5("Captured manifest authority changed.");
    const manifest = JSON.parse(text2(manifestRaw));
    if (manifest.schema !== "ar-create.study-draft-capture.v1" || manifest.bindingId !== bindingId || manifest.parentStudyId !== parentStudyId || manifest.originalId !== originalId || !Array.isArray(manifest.records)) fail5("Captured original identity changed.");
    const captureDir = path5.join(room, "capture");
    canonical2(captureDir, true);
    const captureIds = /* @__PURE__ */ new Set(), capturePaths = /* @__PURE__ */ new Set(), captures = [];
    for (const record of manifest.records) {
      if (typeof record.id !== "string" || captureIds.has(record.id)) fail5("Captured record identity changed.");
      captureIds.add(record.id);
      if (record.missing) continue;
      if (!path5.isAbsolute(record.copiedPath || "") || path5.dirname(record.copiedPath) !== captureDir || capturePaths.has(record.copiedPath) || !SHA2.test(record.sourceHash || "") || record.copiedHash !== record.sourceHash) fail5("Captured original hash authority changed.");
      capturePaths.add(record.copiedPath);
      if (hashAt(record.copiedPath) !== record.copiedHash) fail5("Read-only source capture changed.");
      captures.push({ id: record.id, hash: record.copiedHash });
    }
    const drafts = manifest.records.filter((r) => r.role === "draft" && !r.missing);
    if (drafts.length !== 1 || drafts[0].sourceHash !== intent.originalHash) fail5("Captured original DEV authority changed.");
    const workflow = {}, workflowRaw = {};
    for (const [name, rel] of Object.entries(binding.records)) {
      workflowRaw[name] = bytes2(path5.join(room, "workflow", safeRel(rel)), name === "edits");
      workflow[name] = workflowRaw[name] === null ? null : digest2(workflowRaw[name]);
    }
    const correspondenceRaw = bytes2(correspondenceFile), correspondence = JSON.parse(text2(correspondenceRaw));
    const stableSourceKey = sourceKey(binding);
    if (!SHA2.test(stableSourceKey)) fail5("Stable correspondence source identity is invalid.");
    const paragraphIds = projectionProof(workflowRaw.draft, correspondence, stableSourceKey);
    const operations = [];
    for (const name of fs3.readdirSync(area).filter((name2) => name2.startsWith(bindingId + "-") && name2.endsWith(".operation.json")).sort()) {
      const raw = bytes2(path5.join(area, name)), operation = JSON.parse(text2(raw));
      if (operation.schema !== "ar-create.project-folder-operation.v1" || operation.projectId !== bindingId || !UUID2.test(operation.operationId || "") || name !== bindingId + "-" + operation.operationId + ".operation.json" || operation.state !== "committed" || !Array.isArray(operation.changes)) fail5("Pending or invalid native operation requires explicit operation recovery first.");
      const destinations = /* @__PURE__ */ new Set();
      for (const change of operation.changes) {
        const destination = (change.area || "workflow") + ":" + change.relativePath;
        if (destinations.has(destination) || typeof change.after !== "string" || digest2(change.after) !== change.afterHash || (change.area === "binding-metadata" ? change.relativePath !== bindingId + ".draft-correspondence.json" : change.area !== void 0 || !Object.values(binding.records).includes(change.relativePath))) fail5("Native operation receipt contract changed.");
        destinations.add(destination);
      }
      if (operation.correspondenceInverse?.before?.sourceKey !== void 0 && operation.correspondenceInverse.before.sourceKey !== stableSourceKey) fail5("Saved Undo source identity changed.");
      operations.push({ name, hash: digest2(raw) });
    }
    return { binding, bindingRaw, intentRaw, audit: { schema: "ar-create.study-root-recovery-proof.v1", bindingId, parentStudyId, originalId, roots, captures, paragraphIds, sourceKey: stableSourceKey, operations, expected: { bindingHash: digest2(bindingRaw), correspondenceHash: digest2(correspondenceRaw), workflow }, captureHash: intent.captureHash, intentHash: digest2(intentRaw) } };
  }
  function contract(audit) {
    return { expected: audit.expected, captureHash: audit.captureHash, intentHash: audit.intentHash };
  }
  function validateInput(input) {
    if (!input || Object.keys(input).some((k) => !["operationId", "ownerDecision", "expected", "captureHash", "intentHash"].includes(k)) || input.ownerDecision !== true || !UUID2.test(input.operationId || "") || !input.expected || !SHA2.test(input.captureHash || "") || !SHA2.test(input.intentHash || "")) fail5("Exact explicit recovery decision and proof contract required.");
  }
  function permittedAfter(binding, audit) {
    const updated = structuredClone(binding);
    updated.draftSourceKey = audit.sourceKey;
    updated.roots.media.dev = audit.roots[0].afterDevice;
    updated.roots.workflow.dev = audit.roots[1].afterDevice;
    updated.media.dev = audit.roots[2].afterDevice;
    updated.derived.dev = audit.roots[3].afterDevice;
    return JSON.stringify(updated, null, 2);
  }
  function recover(input) {
    validateInput(input);
    const current = proof(), file = journalFile(input.operationId), priorRaw = bytes2(file, true);
    let journal;
    if (priorRaw) {
      journal = JSON.parse(text2(priorRaw));
      if (journal.schema !== "ar-create.study-root-recovery.v1" || journal.bindingId !== bindingId || journal.operationId !== input.operationId || stable2(journal.request) !== stable2(input) || !["prepared", "committed"].includes(journal.state) || digest2(journal.after) !== journal.afterHash) fail5("Recovery journal identity changed.");
      if (journal.beforeHash !== input.expected.bindingHash || ![journal.beforeHash, journal.afterHash].includes(current.audit.expected.bindingHash) || permittedAfter(current.binding, journal.audit) !== journal.after || journal.audit.sourceKey !== current.audit.sourceKey) fail5("Binding or repair contract changed after recovery preparation.");
      const unchanged = { ...contract(current.audit), expected: { ...current.audit.expected, bindingHash: journal.beforeHash } };
      if (stable2(unchanged) !== stable2({ expected: input.expected, captureHash: input.captureHash, intentHash: input.intentHash }) || stable2(current.audit.operations) !== stable2(journal.audit.operations)) fail5("Recovery evidence changed after interruption.");
    } else {
      if (stable2(contract(current.audit)) !== stable2({ expected: input.expected, captureHash: input.captureHash, intentHash: input.intentHash })) fail5("Recovery proof changed; inspect current owner evidence.");
      if (!current.audit.roots.some((root) => root.beforeDevice !== root.afterDevice)) fail5("No owned root device change requires recovery.");
      const after = permittedAfter(current.binding, current.audit);
      journal = { schema: "ar-create.study-root-recovery.v1", bindingId, operationId: input.operationId, state: "prepared", request: structuredClone(input), beforeHash: current.audit.expected.bindingHash, afterHash: digest2(after), after, audit: current.audit };
      atomicWrite2(file, JSON.stringify(journal, null, 2), { exclusive: true });
    }
    const rechecked = proof();
    const normalized = { ...contract(rechecked.audit), expected: { ...rechecked.audit.expected, bindingHash: journal.beforeHash } };
    if (![journal.beforeHash, journal.afterHash].includes(rechecked.audit.expected.bindingHash) || stable2(normalized) !== stable2({ expected: input.expected, captureHash: input.captureHash, intentHash: input.intentHash }) || stable2(rechecked.audit.operations) !== stable2(journal.audit.operations) || rechecked.audit.roots.some((root, i) => root.afterDevice !== journal.audit.roots[i].afterDevice || root.ino !== journal.audit.roots[i].ino || root.path !== journal.audit.roots[i].path)) fail5("Recovery evidence changed before publication.");
    if (rechecked.audit.expected.bindingHash === journal.beforeHash) {
      atomicWrite2(bindingFile, journal.after, { expectedHash: journal.beforeHash });
      afterPublish?.({ bindingFile, journalFile: file });
    }
    journal.state = "committed";
    atomicWrite2(file, JSON.stringify(journal, null, 2), { expectedHash: hashAt(file) });
    const result = proof().audit;
    return { state: "committed", operationId: input.operationId, audit: result, repaired: { bindingFile, journalFile: file, beforeHash: journal.beforeHash, afterHash: journal.afterHash, stableSourceKey: result.sourceKey }, contract: contract(result) };
  }
  function lockedRecover(input) {
    canonical2(area, true);
    const lockFile = path5.join(area, "adapter.lock");
    let fd;
    try {
      fd = fs3.openSync(lockFile, "wx", 384);
    } catch (error) {
      if (error.code === "EEXIST") fail5("Pending owner operation requires recovery first.");
      throw error;
    }
    recoveryLock = fs3.fstatSync(fd);
    try {
      return recover(input);
    } finally {
      fs3.closeSync(fd);
      const current = fs3.lstatSync(lockFile, { throwIfNoEntry: false });
      if (current && current.dev === recoveryLock.dev && current.ino === recoveryLock.ino) fs3.unlinkSync(lockFile);
      recoveryLock = null;
    }
  }
  return { inspect: () => {
    const audit = proof().audit;
    return { audit, contract: contract(audit) };
  }, recover: lockedRecover };
}

// services/actor.mjs
import fs4 from "node:fs";
import path6 from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
var LEGACY_ACTOR = "unknown(pre-provenance)";
var IN_PROCESS_ACTOR = "unknown(in-process)";
var HUMAN_ACTORS = Object.freeze(["human:adrian"]);
var AGENT_ACTORS = Object.freeze(["agent:claude-code", "agent:codex", "agent:claude-design", "agent:hermes", "agent:grok", "agent:chatgpt"]);
var CLIENTS = Object.freeze(["ui", "cli", "mcp", "http", "file", "mag-page"]);
var SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/;
var SHA3 = /^[a-f0-9]{7,40}$/;
function parseActor(value) {
  if (typeof value !== "string") return null;
  const actor = value.trim();
  if (HUMAN_ACTORS.includes(actor) || AGENT_ACTORS.includes(actor)) return actor;
  const [kind, ...rest] = actor.split(":"), name = rest.join(":");
  if (rest.length !== 1) return null;
  if ((kind === "cron" || kind === "import") && SLUG.test(name)) return actor;
  if (kind === "release" && SHA3.test(name)) return actor;
  return null;
}
function parseClient(value) {
  return typeof value === "string" && CLIENTS.includes(value.trim()) ? value.trim() : null;
}
var storage = new AsyncLocalStorage();
function currentActor() {
  return storage.getStore() || null;
}
function provenance() {
  const ctx = currentActor();
  return { actor: ctx?.actor || IN_PROCESS_ACTOR, client: ctx?.client || null, at: (/* @__PURE__ */ new Date()).toISOString() };
}
function authorOf(record) {
  const p = record && typeof record === "object" ? record.provenance && typeof record.provenance === "object" ? record.provenance : record : null;
  const actor = typeof p?.actor === "string" && (parseActor(p.actor) || p.actor.startsWith("unknown(")) ? p.actor : LEGACY_ACTOR;
  return { actor, client: parseClient(p?.client) };
}
var SAFE = /^[A-Za-z0-9._:-]{1,200}$/;
var part = (value) => {
  const text4 = String(value);
  if (!SAFE.test(text4) || text4 === "." || text4 === "..") throw new StateError("Provenance key is not a safe name.", 400);
  return text4;
};
function createProvenanceLedger({ dataDir }) {
  const root = () => ensurePrivateDirectory(dataDir, "provenance");
  const file = ({ area, scopeId, key, action = "write" }) => {
    const dir = ensurePrivateDirectory(root(), path6.join(part(area), part(scopeId)));
    return path6.join(dir, part(key) + "." + part(action) + ".json");
  };
  return {
    stamp(entry) {
      if (!entry?.key) return null;
      const target = file(entry), stamp2 = { schema: "ar-create.provenance.v1", area: entry.area, scopeId: String(entry.scopeId), key: String(entry.key), action: entry.action || "write", ...provenance() };
      if (fs4.existsSync(target)) return readJson(target, null);
      try {
        atomicWrite2(target, JSON.stringify(stamp2, null, 2) + "\n", { exclusive: true });
      } catch (error) {
        if (error.status !== 409) throw error;
      }
      return stamp2;
    },
    lookup(entry) {
      try {
        const target = file(entry);
        if (!fs4.existsSync(target)) return { actor: LEGACY_ACTOR, client: null };
        return authorOf(readJson(target, null));
      } catch {
        return { actor: LEGACY_ACTOR, client: null };
      }
    }
  };
}

// services/study-draft-copies.mjs
import fs8 from "node:fs";
import path10 from "node:path";
import { randomUUID as randomUUID6 } from "node:crypto";

// services/ar-project-folders.mjs
import fs5 from "node:fs";
import path7 from "node:path";
import os from "node:os";
import { createHash as createHash8, randomUUID as randomUUID5 } from "node:crypto";

// services/project-material-markdown.mjs
function materialMarkdown(record) {
  const fields = ["---", "ar_create_material: 1", `kind: ${record.kind}`, `title: ${JSON.stringify(record.name)}`];
  if (record.kind === "url") {
    fields.push(`source_url: ${JSON.stringify(record.url)}`, `linked_image: ${record.linkedImage === true}`);
  } else if (record.sourceUrl) fields.push(`source_url: ${JSON.stringify(record.sourceUrl)}`);
  fields.push("---", "");
  const body = record.kind === "note" ? record.text : `<${record.url}>
`;
  return fields.join("\n") + "\n" + body;
}
function readMaterialMarkdown(raw) {
  const text4 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
  const header = text4.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!header || !/^ar_create_material: 1\r?$/m.test(header)) return null;
  const field = (key) => header.split(/\r?\n/).filter((line) => line.startsWith(key + ": "));
  const one = (key) => {
    const values = field(key);
    if (values.length !== 1) throw Error("Invalid material header.");
    return values[0].slice(key.length + 2);
  };
  const kind = one("kind");
  if (!["url", "note"].includes(kind)) throw Error("Invalid material kind.");
  const title = JSON.parse(one("title"));
  if (typeof title !== "string") throw Error("Invalid material title.");
  const sources2 = field("source_url");
  if (sources2.length > 1) throw Error("Duplicate material URL.");
  const url = sources2.length ? JSON.parse(sources2[0].slice("source_url: ".length)) : "";
  if (url) {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw Error("Invalid material URL.");
  }
  if (kind === "url" && !url) throw Error("URL material has no URL.");
  const linked = kind === "url" ? one("linked_image") : "false";
  if (!["true", "false"].includes(linked)) throw Error("Invalid image-link flag.");
  return { kind, availability: kind === "url" ? "linked" : "local", title, url, linkedImage: linked === "true" };
}

// services/ar-project-folders.mjs
var digest3 = (bytes22) => createHash8("sha256").update(bytes22).digest("hex");
var UUID3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var fail6 = (message, status = 409) => {
  throw Object.assign(new Error(message), { status });
};
var stable3 = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
var same = (a, b) => stable3(a) === stable3(b);
function workflowText(raw) {
  if (raw === null) return "";
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
  } catch {
    fail6("Working record is not valid UTF-8; repair its encoding before editing.", 400);
  }
}
function relative(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || path7.isAbsolute(value) || /[\\\x00-\x1f\x7f]/.test(value) || value.split("/").some((p) => !p || p === "." || p === ".." || p.startsWith("."))) fail6("Use an explicit safe relative path.", 400);
  return value;
}
function directory(p) {
  if (typeof p !== "string" || !path7.isAbsolute(p)) fail6("Explicit absolute directory required.", 400);
  const s = fs5.lstatSync(p);
  if (!s.isDirectory() || s.isSymbolicLink() || fs5.realpathSync(p) !== path7.resolve(p)) fail6("Directory must be real and canonical.", 403);
  return { path: p, dev: s.dev, ino: s.ino };
}
function currentRoot(root) {
  const now = directory(root.path);
  if (now.dev !== root.dev || now.ino !== root.ino) fail6("Bound root changed. Rebind explicitly.");
}
function location(root, rel, missing = false) {
  relative(rel);
  currentRoot(root);
  let p = root.path;
  const parts = rel.split("/");
  for (let i = 0; i < parts.length; i++) {
    p = path7.join(p, parts[i]);
    const s = fs5.lstatSync(p, { throwIfNoEntry: false });
    if (!s && missing && i === parts.length - 1) return p;
    if (!s) fail6("Bound file or directory unavailable.", 404);
    if (s.isSymbolicLink() || i < parts.length - 1 && !s.isDirectory()) fail6("Symlink or changed directory refused.", 403);
  }
  return p;
}
function bytes3(file, { optional = false } = {}) {
  const s = fs5.lstatSync(file, { throwIfNoEntry: false });
  if (!s && optional) return null;
  if (!s) fail6("Bound file unavailable.", 404);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1) fail6("Only unlinked regular files are supported.", 403);
  if (s.size > 64 * 1024 * 1024) fail6("File exceeds the 64 MB candidate limit.", 413);
  const fd = fs5.openSync(file, fs5.constants.O_RDONLY | fs5.constants.O_NOFOLLOW);
  try {
    const before = fs5.fstatSync(fd), buffer = Buffer.alloc(Math.min(before.size + 1, 64 * 1024 * 1024 + 1));
    let length = 0;
    while (length < buffer.length) {
      const read = fs5.readSync(fd, buffer, length, buffer.length - length, length);
      if (!read) break;
      length += read;
    }
    const raw = buffer.subarray(0, length), after = fs5.fstatSync(fd), visible = fs5.lstatSync(file);
    if (before.ino !== visible.ino || before.dev !== visible.dev || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || raw.length > 64 * 1024 * 1024) fail6("File changed during read.");
    return raw;
  } finally {
    fs5.closeSync(fd);
  }
}
function atomic(file, raw, exclusive = false) {
  const temp = file + "." + randomUUID5() + ".tmp";
  let fd;
  try {
    fd = fs5.openSync(temp, "wx", 384);
    fs5.writeFileSync(fd, raw);
    fs5.fsyncSync(fd);
    fs5.closeSync(fd);
    fd = void 0;
    if (exclusive) fs5.linkSync(temp, file);
    else {
      bytes3(file, { optional: true });
      fs5.renameSync(temp, file);
    }
    const dir = fs5.openSync(path7.dirname(file), "r");
    try {
      fs5.fsyncSync(dir);
    } finally {
      fs5.closeSync(dir);
    }
  } finally {
    if (fd !== void 0) fs5.closeSync(fd);
    fs5.rmSync(temp, { force: true });
  }
}
var hashAt2 = (file) => {
  const raw = bytes3(file, { optional: true });
  return raw === null ? null : digest3(raw);
};
var safeUrl = (value) => {
  let u;
  try {
    u = new URL(value);
  } catch {
    fail6("A valid URL is required.", 400);
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.href.length > 4096) fail6("Use a bounded HTTP URL without credentials.", 400);
  return u.href;
};
function createBoundProjectFolders({ dataDir, roots, ask, draft, writableWorkingRecords = false, beforeCommit, afterCommit, ownedRelocation } = {}) {
  const data = directory(dataDir), configured = { media: directory(roots?.media), workflow: directory(roots?.workflow) };
  if (data.path === configured.media.path || data.path.startsWith(configured.media.path + path7.sep) || data.path === configured.workflow.path || data.path.startsWith(configured.workflow.path + path7.sep)) fail6("Keep adapter metadata outside original roots.", 403);
  const area = path7.join(data.path, "ar-project-folder-bindings");
  if (!fs5.existsSync(area)) fs5.mkdirSync(area, { mode: 448 });
  const owned = directory(area);
  function ownedFile(name) {
    currentRoot(data);
    currentRoot(owned);
    return path7.join(area, name);
  }
  function projectFile(id2) {
    if (!UUID3.test(id2 || "")) fail6("A project UUID is required.", 400);
    return ownedFile(id2 + ".json");
  }
  function load(id2) {
    const raw = bytes3(projectFile(id2), { optional: true });
    if (!raw) fail6("Project is not bound.", 404);
    let b = JSON.parse(raw);
    if (ownedRelocation) b = ownedRelocation(raw, b, configured);
    if (b.projectId !== id2 || b.schema !== "ar-create.project-folders.v1") fail6("Binding identity changed.");
    for (const key of ["media", "workflow"]) {
      if (b.roots[key].path !== configured[key].path) fail6("Binding roots differ from configuration.");
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
      fd = fs5.openSync(p, "wx", 384);
    } catch (e) {
      if (e.code === "EEXIST") fail6("Another adapter operation is working.");
      throw e;
    }
    try {
      return work();
    } finally {
      fs5.closeSync(fd);
      fs5.unlinkSync(p);
    }
  }
  function bind({ projectId, mediaFolder, derivedFolder, records = {}, draftAuthority }) {
    return locked(() => {
      const file = projectFile(projectId);
      if (fs5.existsSync(file)) fail6("Project already bound; explicit reconnect is required.");
      const media = directory(location(configured.media, mediaFolder)), derived = directory(location(configured.workflow, derivedFolder));
      if (media.path === derived.path || derived.path.startsWith(media.path + path7.sep) || media.path.startsWith(derived.path + path7.sep)) fail6("Original and derived directories must be separate.", 403);
      const r = {};
      if (records.ask) {
        if (!/^Workflow\/ASK - [^/]+\.md$/.test(relative(records.ask))) fail6("Only an exact ASK working record may be bound.", 403);
        r.ask = records.ask;
        const parsed = ask.parseAsk(bytes3(location(configured.workflow, r.ask)).toString("utf8"));
        if (parsed.meta["record-to"]) {
          r.map = relative(parsed.meta["record-to"]);
          if (!/^Workflow\/2-Guidance\/MAP - [^/]+\.md$/.test(r.map) || records.map !== r.map) fail6("Explicit MAP binding must match ASK record-to.", 403);
          bytes3(location(configured.workflow, r.map));
        } else if (records.map) fail6("ASK has no MAP record-to.", 400);
      }
      if (records.draft) {
        r.draft = relative(records.draft);
        if (!/^Workflow\/3-Develop\/DEV - [^/]+\.md$/.test(r.draft)) fail6("Only an exact DEV working record may be bound.", 403);
        bytes3(location(configured.workflow, r.draft));
        r.edits = "Workflow/4-Review/EDITS - " + path7.basename(r.draft);
        location(configured.workflow, r.edits, true);
      }
      if (draftAuthority !== void 0 && draftAuthority !== "owned-working-copy") fail6("Explicit owned-working-copy authority required for native draft operations.", 403);
      const b = { schema: "ar-create.project-folders.v1", projectId, roots: configured, media, derived, records: r, materials: [], revision: 0, ...draftAuthority ? { draftAuthority } : {} };
      atomic(file, JSON.stringify(b, null, 2), true);
      return structuredClone(b);
    });
  }
  function scan(projectId) {
    return locked(() => {
      const b = load(projectId), found = [], diagnostics = [];
      if (!workflowReadiness(projectId).ready) fail6("Pending workflow operation requires recovery before mutations.");
      let entries = 0, total = 0;
      function walk(rel = "") {
        const dir = rel ? location(b.media, rel) : b.media.path;
        for (const e of fs5.readdirSync(dir, { withFileTypes: true }).sort((a, b2) => a.name.localeCompare(b2.name))) {
          if (e.name.startsWith(".")) continue;
          if (++entries > 2e3) fail6("Folder scan exceeds 2000 entries; membership unchanged.", 413);
          const r = rel ? rel + "/" + e.name : e.name;
          if (r.split("/").length > 12) fail6("Folder scan depth exceeded; membership unchanged.", 413);
          if (e.isSymbolicLink()) {
            diagnostics.push({ relativePath: r, error: "Symlink skipped" });
            continue;
          }
          if (e.isDirectory()) {
            walk(r);
            continue;
          }
          if (!e.isFile()) continue;
          const p = location(b.media, r), raw = bytes3(p), s = fs5.lstatSync(p);
          total += raw.length;
          if (total > 256 * 1024 * 1024) fail6("Scan exceeds 256 MB; membership unchanged.", 413);
          let material = { kind: "file", availability: "local" };
          if (/\.md$/i.test(r)) {
            try {
              material = readMaterialMarkdown(raw) || material;
            } catch {
              diagnostics.push({ relativePath: r, error: "Invalid Markdown material header; shown as file" });
            }
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
          found.push({ ...material, relativePath: r, path: p, hash: digest3(raw), dev: s.dev, ino: s.ino });
        }
      }
      walk();
      const used = /* @__PURE__ */ new Set(), paths = new Set(found.map((x) => x.relativePath));
      const materials = found.map((f) => {
        let old = b.materials.find((m) => !used.has(m.id) && m.relativePath === f.relativePath);
        if (!old) {
          const matches = b.materials.filter((m) => !used.has(m.id) && !paths.has(m.relativePath) && m.dev === f.dev && m.ino === f.ino);
          if (matches.length === 1) old = matches[0];
        }
        if (old) used.add(old.id);
        const change2 = !old ? "added" : old.relativePath !== f.relativePath ? "renamed" : old.dev !== f.dev || old.ino !== f.ino ? "replaced" : old.hash !== f.hash ? "modified" : "unchanged";
        return { ...f, id: old?.id || randomUUID5(), change: change2, missing: false };
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
      if (!workflowReadiness(projectId).ready) fail6("Pending workflow operation requires recovery before mutations.");
      if (!Array.isArray(items) || items.length > 100) fail6("Use a bounded material batch.", 400);
      const receipts = [];
      for (const item of items) {
        try {
          if (typeof item?.name !== "string" || item.name.length > 200 || item.name.includes("/") || item.name.includes("\\")) fail6("Use a safe material filename.", 400);
          relative(item.name);
          let name = item.name, raw;
          if (item.kind === "file") {
            if (!Buffer.isBuffer(item.bytes) && !(item.bytes instanceof Uint8Array)) fail6("Supply file bytes.", 400);
            raw = Buffer.from(item.bytes);
            if (name.endsWith(".ar-material.json")) fail6("Reserved material record suffix.", 400);
          } else if (["url", "note"].includes(item.kind)) {
            const record = { schema: "ar-create.material.v1", kind: item.kind, name: item.name };
            if (item.kind === "url") {
              record.url = safeUrl(item.url);
              record.linkedImage = item.linkedImage === true;
            } else {
              if (typeof item.text !== "string" || !item.text.trim() || Buffer.byteLength(item.text) > 1024 * 1024) fail6("Supply a bounded note.", 400);
              record.text = item.text;
              if (item.sourceUrl) record.sourceUrl = safeUrl(item.sourceUrl);
            }
            raw = Buffer.from(materialMarkdown(record));
            if (!/\.md$/i.test(name)) name += ".md";
          } else fail6("Unsupported drop payload.", 400);
          if (raw.length > 64 * 1024 * 1024) fail6("Drop exceeds 64 MB.", 413);
          const ext = path7.extname(name), stem = name.slice(0, name.length - ext.length);
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
              if (++n > 1e3) fail6("Too many filename collisions.");
            }
          }
          receipts.push({ ok: true, name, path: p, hash: digest3(raw) });
        } catch (e) {
          receipts.push({ ok: false, name: item?.name || "", error: e.message, status: e.status || 500 });
        }
      }
      return { projectId, receipts };
    });
  }
  function reconnect({ projectId, sourceId, targetId, expectedSourceHash, expectedTargetHash }) {
    return locked(() => {
      if (!workflowReadiness(projectId).ready) fail6("Pending workflow operation requires recovery before mutations.");
      const b = load(projectId), s = b.materials.find((m) => m.id === sourceId), t = b.materials.find((m) => m.id === targetId);
      if (!s?.missing || !t || t.missing || sourceId === targetId || s.hash !== expectedSourceHash || t.hash !== expectedTargetHash || s.hash !== t.hash || hashAt2(location(b.media, s.relativePath, true)) !== null || hashAt2(location(b.media, t.relativePath)) !== t.hash) fail6("Reconnect requires missing identity and exact matching current bytes.");
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
      const value = bytes3(location(b.roots.workflow, rel, true), { optional: key === "edits" });
      raw[key] = workflowText(value);
      hashes[key] = value === null ? null : digest3(value);
    }
    const parsed = raw.ask ? ask.parseAsk(raw.ask) : { meta: {}, questions: [] };
    if ((parsed.meta["record-to"] || null) !== (b.records.map || null)) fail6("ASK record-to changed. Rebind explicitly.");
    return { projectId, hashes, ...raw, questions: parsed.questions.map((q) => ({ ...q, key: digest3(JSON.stringify({ ask: b.records.ask, index: q.index, title: q.title, hash: hashes.ask })) })), paragraphs: raw.draft ? draft.splitBlocks(raw.draft).parts.filter((_, i) => i % 2 === 0).map((raw2, index) => ({ index, seen: draft.hash(raw2), text: draft.plain(raw2), editable: draft.editable(raw2) })).filter((p) => p.editable) : [] };
  }
  function operationFile(projectId, operationId) {
    if (!UUID3.test(operationId || "")) fail6("Operation UUID required.", 400);
    return ownedFile(projectId + "-" + operationId + ".operation.json");
  }
  function inspectOperation({ projectId, operationId }) {
    const b = load(projectId), r = JSON.parse(bytes3(operationFile(projectId, operationId)).toString());
    if (r.projectId !== projectId || r.operationId !== operationId || r.schema !== "ar-create.project-folder-operation.v1" || !["prepared", "committed"].includes(r.state) || !Array.isArray(r.changes)) fail6("Receipt identity changed.");
    if (new Set(r.changes.map((c) => (c.area || "workflow") + ":" + c.relativePath)).size !== r.changes.length) fail6("Duplicate journal destinations refused.");
    const changes = r.changes.map((c) => {
      if (typeof c.after !== "string" || digest3(c.after) !== c.afterHash) fail6("Receipt contract changed.");
      const actual = hashAt2(changeDestination(b, c));
      return { ...c, state: actual === c.afterHash ? "applied" : actual === c.beforeHash ? "pending" : "diverged" };
    });
    return { ...r, changes, state: r.state === "committed" ? "committed" : changes.some((c) => c.state === "diverged") ? "diverged" : changes.every((c) => c.state === "applied") ? "applied" : changes.every((c) => c.state === "pending") ? "pending" : "partial" };
  }
  function withRun(b, work) {
    if (!writableWorkingRecords) fail6("Working records are read-only until explicitly configured.", 403);
    const p = location(b.roots.workflow, "Workflow/_mag-running.md", true);
    let fd, identity3;
    try {
      fd = fs5.openSync(p, "wx", 384);
      identity3 = fs5.fstatSync(fd);
      fs5.writeFileSync(fd, `machine: ${os.hostname()}
since: ${(/* @__PURE__ */ new Date()).toISOString()}
doing: AR Create explicit project action
`);
      fs5.fsyncSync(fd);
    } catch (e) {
      if (fd !== void 0) fs5.closeSync(fd);
      if (e.code === "EEXIST") fail6("Magazine is running or its marker needs explicit recovery.");
      throw e;
    }
    try {
      return work();
    } finally {
      fs5.closeSync(fd);
      const now = fs5.lstatSync(p, { throwIfNoEntry: false });
      if (now && now.dev === identity3.dev && now.ino === identity3.ino) fs5.unlinkSync(p);
    }
  }
  function correspondenceFile(id2) {
    projectFile(id2);
    return ownedFile(id2 + ".draft-correspondence.json");
  }
  function changeDestination(b, c) {
    if (c.area === "binding-metadata") {
      if (c.relativePath !== b.projectId + ".draft-correspondence.json") fail6("Metadata receipt path refused.");
      return correspondenceFile(b.projectId);
    }
    if (c.area !== void 0 || !Object.values(b.records).includes(c.relativePath)) fail6("Receipt contract changed.");
    return location(b.roots.workflow, c.relativePath, true);
  }
  function commit(b, r) {
    const ensureBinding = () => {
      if (r.expectedBindingHash && hashAt2(projectFile(b.projectId)) !== r.expectedBindingHash) fail6("Binding changed; explicit inspection required.");
      if (r.expectedWorkflow) for (const [key, expected] of Object.entries(r.expectedWorkflow)) {
        const actual = hashAt2(location(b.roots.workflow, b.records[key], true)), changed = r.changes.find((c) => c.area === void 0 && c.relativePath === b.records[key]);
        if (actual !== expected && actual !== changed?.afterHash) fail6("Workflow changed; preserve external records and recover explicitly.");
      }
    };
    ensureBinding();
    for (const c of r.changes) {
      const actual = hashAt2(changeDestination(b, c));
      if (actual !== c.beforeHash && actual !== c.afterHash) fail6("Working record changed; newer words preserved.");
    }
    for (const [index, c] of r.changes.entries()) {
      const p = changeDestination(b, c), actual = hashAt2(p);
      if (actual === c.afterHash) continue;
      beforeCommit?.(c);
      ensureBinding();
      if (hashAt2(changeDestination(b, c)) !== c.beforeHash) fail6("Working record changed before commit.");
      atomic(p, c.after, c.beforeHash === null);
      afterCommit?.(c, index);
    }
    r.state = "committed";
    atomic(operationFile(b.projectId, r.operationId), JSON.stringify(r, null, 2));
    return { operationId: r.operationId, state: "committed", hashes: Object.fromEntries(r.changes.map((c) => [c.relativePath, c.afterHash])) };
  }
  function change(input, kind) {
    const isAnswer = kind === "answer" || kind === "revise-answer";
    if (kind === "edit" && (typeof input.text !== "string" || Buffer.byteLength(input.text) > 1024 * 1024 || !Number.isInteger(input.paragraphIndex))) fail6("Supply explicit bounded draft text and paragraph index.", 400);
    if (isAnswer && (typeof input.value !== "string" || !input.value.trim() || Buffer.byteLength(input.value) > 1e5 || !Number.isInteger(input.questionIndex))) fail6("Supply an explicit bounded answer and question index.", 400);
    if (kind === "revise-answer" && (input.humanDecision !== true || typeof input.expectedValue !== "string")) fail6("An explicit human correction and the previous answer are required.", 403);
    return locked(() => {
      const b = load(input.projectId), op = operationFile(b.projectId, input.operationId), requestHash = digest3(stable3({ ...input, operationId: void 0 }));
      if (fs5.existsSync(op)) {
        const r = inspectOperation(input);
        if (r.requestHash !== requestHash || r.kind !== kind) fail6("Operation ID already belongs to another action.");
        if (r.state !== "committed") fail6("Interrupted operation needs explicit recovery.");
        return { operationId: r.operationId, state: "committed", replayed: true };
      }
      const readiness = workflowReadiness(b.projectId);
      if (!readiness.ready) fail6("Interrupted workflow operation needs explicit recovery before another write.");
      return withRun(b, () => {
        const before = readWorkflow(b.projectId);
        const nativeMetaRaw = kind === "edit" ? bytes3(correspondenceFile(b.projectId), { optional: true }) : null;
        const nativeBefore = nativeMetaRaw ? snapshot(before.draft, JSON.parse(workflowText(nativeMetaRaw)), sourceKey(b)) : null;
        const bindingHash = hashAt2(projectFile(b.projectId));
        if (!same(input.expected, before.hashes)) fail6("Working records changed; reload before saving.");
        const needed = isAnswer ? ["ask", ...b.records.map ? ["map"] : []] : ["draft", "edits"];
        if (needed.some((k) => !b.records[k])) fail6("Required working records are not bound.", 400);
        if (isAnswer) {
          const q = before.questions[input.questionIndex];
          if (!q || q.key !== input.questionKey || (kind === "answer" ? !q.open : q.open || q.value !== input.expectedValue)) fail6("Question changed or already answered.");
        }
        const staging = fs5.mkdtempSync(ownedFile("stage-"));
        try {
          for (const key of needed) {
            const p = path7.join(staging, b.records[key]);
            fs5.mkdirSync(path7.dirname(p), { recursive: true });
            if (before.hashes[key] !== null) fs5.writeFileSync(p, before[key]);
          }
          if (isAnswer) ask.answer(staging, b.records.ask, input.questionIndex, input.value);
          else draft.edit(staging, b.records.draft, input.paragraphIndex, input.seen, input.text);
          if (!same(readWorkflow(b.projectId).hashes, before.hashes)) fail6("Working records changed during preparation.");
          const changes = needed.map((key) => {
            const staged = bytes3(path7.join(staging, b.records[key]), { optional: true });
            if (staged === null) return null;
            const after = staged.toString("utf8");
            return { relativePath: b.records[key], beforeHash: before.hashes[key], after, afterHash: digest3(after) };
          }).filter((c) => c && c.beforeHash !== c.afterHash);
          if (nativeBefore) {
            const donorBefore = capture(before.draft, sourceKey(b));
            if (donorBefore.blocks.length !== nativeBefore.blocks.length || donorBefore.blocks.some((row, i) => row.raw !== nativeBefore.blocks[i].raw || row.separator !== nativeBefore.blocks[i].separator)) fail6("Legacy donor block boundaries differ from native correspondence; use stable-ID native operations.");
            const updated = workflowText(bytes3(path7.join(staging, b.records.draft))), next = capture(updated, sourceKey(b));
            const delta = next.blocks.length - nativeBefore.blocks.length;
            if (delta !== 0 && delta !== -1) fail6("Legacy edit topology cannot preserve native IDs; use explicit native operations.");
            next.blocks = next.blocks.map((row, index) => {
              const old = nativeBefore.blocks[index + (delta === -1 && index >= input.paragraphIndex ? 1 : 0)];
              return { ...row, id: old.id, origin: old.origin };
            });
            changes.push(metadataChange(b, nativeMetaRaw, next));
          }
          const r = { schema: "ar-create.project-folder-operation.v1", projectId: b.projectId, operationId: input.operationId, requestHash, kind, state: "prepared", changes, ...nativeBefore ? { expectedBindingHash: bindingHash, expectedWorkflow: before.hashes } : {} };
          atomic(op, JSON.stringify(r, null, 2), true);
          return commit(b, r);
        } finally {
          fs5.rmSync(staging, { recursive: true, force: true });
        }
      });
    });
  }
  function sourceKey(b) {
    if (b.draftSourceKey !== void 0) {
      if (typeof b.draftSourceKey !== "string" || !/^[a-f0-9]{64}$/.test(b.draftSourceKey)) fail6("Recovered draft source identity is invalid.");
      return b.draftSourceKey;
    }
    return digest3(stable3({ projectId: b.projectId, workflow: b.roots.workflow, draft: b.records.draft }));
  }
  function draftStatus(b) {
    if (b.draftAuthority !== "owned-working-copy" || !b.records.draft || !b.records.edits) fail6("Native draft operations require explicitly bound owned-working-copy DEV and EDITS.", 403);
    const workflow = readWorkflow(b.projectId), raw = bytes3(correspondenceFile(b.projectId), { optional: true });
    return { workflow, metadataRaw: raw, expected: { workflow: workflow.hashes, bindingHash: hashAt2(projectFile(b.projectId)), correspondenceHash: raw === null ? null : digest3(raw) } };
  }
  function readDraftStatus(projectId) {
    return locked(() => {
      const b = load(projectId), s = draftStatus(b);
      return { projectId, expected: s.expected, readiness: workflowReadiness(projectId), initialized: s.metadataRaw !== null };
    });
  }
  function readDraftProjection(projectId) {
    return locked(() => {
      const b = load(projectId);
      if (!workflowReadiness(projectId).ready) fail6("Pending operation requires recovery before reading native projection.");
      const s = draftStatus(b);
      if (s.metadataRaw === null) fail6("Prepare trusted draft correspondence first.");
      const model = snapshot(s.workflow.draft, JSON.parse(workflowText(s.metadataRaw)), sourceKey(b));
      return { projectId, expected: s.expected, projection: projection(model) };
    });
  }
  function metadataChange(b, before, snapshot2) {
    const after = JSON.stringify(metadata2(snapshot2), null, 2);
    return { area: "binding-metadata", relativePath: b.projectId + ".draft-correspondence.json", beforeHash: before === null ? null : digest3(before), after, afterHash: digest3(after) };
  }
  function nativeRequest(input, kind) {
    const fields = ["projectId", "operationId", "expected", ...kind === "draft-operations" ? ["operations"] : kind === "draft-undo" ? ["undoOperationId"] : kind === "draft-restore" ? ["restoreOperationId", "restorePosition"] : kind === "draft-rebind" ? ["humanDecision"] : []];
    if (!input || typeof input !== "object" || Object.keys(input).some((k) => !fields.includes(k)) || fields.some((k) => !Object.hasOwn(input, k))) fail6("Malformed native draft request; caller snapshots are refused.", 400);
    if (kind === "draft-rebind" && input.humanDecision !== true) fail6("Explicit human rebind decision required.", 403);
    if (kind === "draft-undo" && !UUID3.test(input.undoOperationId || "")) fail6("Owned operation UUID required for Undo.", 400);
    if (kind === "draft-restore" && (!UUID3.test(input.restoreOperationId || "") || !["before", "after"].includes(input.restorePosition))) fail6("Exact owned history version required.", 400);
    return locked(() => {
      const b = load(input.projectId), op = operationFile(b.projectId, input.operationId), requestHash = digest3(stable3({ ...input, operationId: void 0 }));
      if (fs5.existsSync(op)) {
        const r = inspectOperation(input);
        if (r.requestHash !== requestHash || r.kind !== kind) fail6("Operation ID already belongs to another action.");
        if (r.state !== "committed") fail6("Interrupted operation needs explicit recovery.");
        return { operationId: r.operationId, state: "committed", replayed: true };
      }
      if (!workflowReadiness(b.projectId).ready) fail6("Interrupted workflow operation needs explicit recovery before another write.");
      return withRun(b, () => {
        const s = draftStatus(b);
        if (!same(input.expected, s.expected)) fail6("Workflow, binding or correspondence changed; preserve pending native edits.");
        if (Buffer.byteLength(s.workflow.draft) > 1024 * 1024) fail6("Bound DEV exceeds native correspondence limit.", 413);
        let result, model, affectedIds = [];
        if (kind === "draft-prepare" || kind === "draft-rebind") {
          if (kind === "draft-prepare" && s.metadataRaw !== null) fail6("Already prepared; explicit rebind required.");
          result = { raw: s.workflow.draft, snapshot: capture(s.workflow.draft, sourceKey(b)) };
        } else {
          if (s.metadataRaw === null) fail6("Prepare trusted correspondence first.");
          model = snapshot(s.workflow.draft, JSON.parse(workflowText(s.metadataRaw)), sourceKey(b));
          if (kind === "draft-operations") result = apply(model, s.workflow.draft, input.operations);
          else if (kind === "draft-restore") {
            const prior = inspectOperation({ projectId: b.projectId, operationId: input.restoreOperationId });
            if (prior.state !== "committed") fail6("Only committed owned history can be restored.");
            const { raw, model: target } = historicalVersion({ receipt: prior, projectId: b.projectId, draftRelative: b.records.draft, sourceKey: model.sourceKey, position: input.restorePosition });
            result = { raw, snapshot: structuredClone(target), inverse: { schema: "mag-dev-inverse.v1", before: structuredClone(model), afterHash: target.fileHash, afterSnapshotHash: digest3(JSON.stringify(target)) } };
          } else {
            const prior = inspectOperation({ projectId: b.projectId, operationId: input.undoOperationId });
            if (prior.state !== "committed" || !prior.correspondenceInverse) fail6("Undo requires a committed owned native operation receipt.");
            historicalVersion({ receipt: prior, projectId: b.projectId, draftRelative: b.records.draft, sourceKey: model.sourceKey, position: "before" });
            result = undo(model, s.workflow.draft, prior.correspondenceInverse);
            affectedIds = prior.correspondenceAffectedIds || [];
          }
        }
        if (model && !result.inverse && (result.raw !== s.workflow.draft || !same(result.snapshot, model))) result.inverse = { schema: "mag-dev-inverse.v1", before: structuredClone(model), afterHash: result.snapshot.fileHash, afterSnapshotHash: digest3(JSON.stringify(result.snapshot)) };
        const changes = [];
        if (result.raw !== s.workflow.draft) {
          changes.push({ relativePath: b.records.draft, beforeHash: s.workflow.hashes.draft, after: result.raw, afterHash: digest3(result.raw) });
          const changed = new Set(affectedIds);
          for (const row of model.blocks) {
            const after2 = result.snapshot.blocks.find((p) => p.id === row.id);
            if (!after2 || after2.raw !== row.raw) changed.add(row.id);
          }
          for (const row of result.snapshot.blocks) if (!model.blocks.some((p) => p.id === row.id)) changed.add(row.id);
          if (kind === "draft-operations") for (const op2 of input.operations) {
            if (op2.kind === "move") changed.add(op2.id);
          }
          affectedIds = [...changed];
          const today3 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), oneLine = (t) => draft.plain(t.trim()).replace(/\r?\n/g, " ");
          const entries = affectedIds.map((id2) => {
            const before = model.blocks.find((p) => p.id === id2), next = result.snapshot.blocks.find((p) => p.id === id2);
            return `- passage: ${id2}
- before: ${before ? oneLine(before.raw) : "(new)"}
- after: ${next ? oneLine(next.raw) : "(removed)"}
`;
          }).join("");
          const actions = kind === "draft-restore" ? "restore " + input.restoreOperationId + " " + input.restorePosition : kind === "draft-undo" ? "undo " + input.undoOperationId : input.operations.map((op2) => op2.kind + ":" + (op2.id || [op2.leftId, op2.rightId].join(","))).join(" ");
          const reworkRows = (result.reworks || []).map((words3) => "- rework: " + words3 + "\n").join("");
          const after = (s.workflow.edits || draft.editLogHeader(path7.basename(b.records.draft))) + `
## ${today3}
${entries}${reworkRows}- action: ${kind} ${input.operationId} ${actions}
`;
          changes.push({ relativePath: b.records.edits, beforeHash: s.workflow.hashes.edits, after, afterHash: digest3(after) });
        }
        const mc = metadataChange(b, s.metadataRaw, result.snapshot);
        if (mc.beforeHash !== mc.afterHash) changes.push(mc);
        if (!same(draftStatus(b).expected, s.expected)) fail6("Bound records changed during native preparation.");
        const r = { schema: "ar-create.project-folder-operation.v1", projectId: b.projectId, operationId: input.operationId, requestHash, kind, state: "prepared", expectedBindingHash: s.expected.bindingHash, expectedWorkflow: s.expected.workflow, changes, ...result.inverse ? { correspondenceInverse: result.inverse } : {}, correspondenceAffectedIds: affectedIds, correspondenceLedger: result.ledger || [{ kind, ownedUndoOperationId: input.undoOperationId || null }] };
        atomic(op, JSON.stringify(r, null, 2), true);
        return commit(b, r);
      });
    });
  }
  function recoverOperation(input) {
    return locked(() => {
      const b = load(input.projectId);
      return withRun(b, () => {
        const r = inspectOperation(input);
        if (r.state === "diverged") fail6("Working record changed after interruption; newer words preserved.");
        return commit(b, r);
      });
    });
  }
  function workflowReadiness(projectId) {
    load(projectId);
    const prefix = projectId + "-", suffix = ".operation.json";
    const unresolved = [];
    for (const name of fs5.readdirSync(area)) {
      if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
      const operationId = name.slice(prefix.length, -suffix.length);
      let receipt;
      try {
        receipt = inspectOperation({ projectId, operationId });
        if (receipt.schema !== "ar-create.project-folder-operation.v1" || !["prepared", "committed"].includes(JSON.parse(bytes3(ownedFile(name)).toString()).state)) throw new Error("Invalid operation receipt.");
      } catch {
        unresolved.push({ operationId, state: "unreadable", recoveryRequired: true });
        continue;
      }
      if (receipt.state !== "committed") unresolved.push({ operationId, state: receipt.state, recoveryRequired: true });
    }
    return { projectId, ready: unresolved.length === 0, unresolved };
  }
  return { bind, readDraftStatus, readDraftProjection, prepareDraftCorrespondence: (input) => nativeRequest(input, "draft-prepare"), rebindDraftCorrespondence: (input) => nativeRequest(input, "draft-rebind"), applyDraftOperations: (input) => nativeRequest(input, "draft-operations"), undoDraftOperation: (input) => nativeRequest(input, "draft-undo"), restoreDraftVersion: (input) => nativeRequest(input, "draft-restore"), readBinding: (id2) => structuredClone(load(id2)), scan, add, reconnect, readWorkflow, workflowReadiness, answerQuestion: (input) => change(input, "answer"), reviseAnswer: (input) => change(input, "revise-answer"), editDraft: (input) => change(input, "edit"), inspectOperation, recoverOperation };
}

// reference/mag-ask.mjs
var mag_ask_exports = {};
__export(mag_ask_exports, {
  answer: () => answer,
  listAsks: () => listAsks,
  parseAsk: () => parseAsk
});
import fs6 from "fs";
import path8 from "path";
var today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
function parseAsk(text4) {
  const fm = (text4.match(/^---\n([\s\S]*?)\n---/) || [, ""])[1];
  const meta = Object.fromEntries(fm.split("\n").map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  const body = text4.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const questions = body.split(/^## /m).slice(1).map((chunk, index) => {
    const [title, ...lines] = chunk.split("\n");
    const q = { index, title: title.trim(), context: [], read: null, options: [], other: false, text: false, answer: "", answered: "" };
    for (const raw of lines) {
      const l = raw.trim();
      let m;
      if (!l) continue;
      if (m = l.match(/^read:\s*([^|]+?)\s*(?:\|\s*(.+))?$/)) {
        const r = { file: m[1], label: m[2] || "Read it" };
        (q.reads ||= []).push(r);
        q.read ||= r;
      } else if (m = l.match(/^- \[( |x|X)\]\s*(.+)$/)) {
        const rec = /\(recommended\)\s*$/i.test(m[2]);
        q.options.push({ label: m[2].replace(/\s*\(recommended\)\s*$/i, ""), recommended: rec, chosen: m[1] !== " " });
      } else if (m = l.match(/^- other(?::\s*(.+))?$/i)) {
        q.other = true;
        q.otherLabel = m[1] || "";
      } else if (m = l.match(/^answer:\s*(.*)$/)) {
        q.text = true;
        q.answer = m[1];
      } else if (m = l.match(/^answered:\s*(.*)$/)) q.answered = m[1];
      else if (m = l.match(/^(who|at|said|suggested|why|telling):\s*(.*)$/)) (q.line ||= {})[m[1]] = m[2];
      else if (!/^#/.test(l)) q.context.push(l);
    }
    const picked = q.options.find((o) => o.chosen);
    q.value = picked ? picked.label : q.answer;
    q.open = !q.answered;
    return q;
  });
  return { meta, questions };
}
function answer(mag, file, index, value) {
  const abs = path8.resolve(mag, file);
  if (!abs.startsWith(path8.resolve(mag, "Workflow") + path8.sep) || !/^ASK - .+\.md$/.test(path8.basename(abs))) throw new Error("not an ASK file");
  const text4 = fs6.readFileSync(abs, "utf8");
  const head = text4.match(/^---\n[\s\S]*?\n---\n?/)?.[0] || "";
  const parts = text4.slice(head.length).split(/^(?=## )/m);
  const qChunks = parts.filter((p) => p.startsWith("## "));
  const chunk = qChunks[index];
  if (!chunk) throw new Error("no such question");
  const { questions, meta } = parseAsk(text4);
  const q = questions[index];
  value = String(value).trim().replace(/\n+/g, " ");
  if (!value) throw new Error("empty answer");
  let lines = chunk.split("\n").filter((l) => !/^answered:/.test(l.trim()));
  if (q.text) {
    lines = lines.map((l) => /^answer:/.test(l.trim()) ? `answer: ${value}` : l);
  } else {
    const known = q.options.some((o) => o.label === value);
    if (!known && !q.other) throw new Error("not one of the choices");
    lines = lines.map((l) => {
      const m = l.match(/^(\s*)- \[( |x|X)\]\s*(.+)$/);
      if (!m) return l;
      const label = m[3].replace(/\s*\(recommended\)\s*$/i, "");
      return `${m[1]}- [${label === value ? "x" : " "}] ${m[3]}`;
    });
    if (!known) {
      const at = lines.findIndex((l) => /^- other(:.*)?$/i.test(l.trim()));
      lines.splice(at, 0, `- [x] ${value}`);
    }
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines.push(`answered: ${today()}`, "", "");
  const newChunk = lines.join("\n");
  const out = head + parts.map((p) => p === chunk ? newChunk : p).join("");
  fs6.writeFileSync(abs, out);
  if (meta["record-to"]) {
    const rec = path8.resolve(mag, meta["record-to"]);
    if (rec.startsWith(path8.resolve(mag, "Workflow") + path8.sep) && fs6.existsSync(rec)) {
      let r = fs6.readFileSync(rec, "utf8");
      const tag = `- ${today()}: ${q.title}: `;
      const line = `${tag}${value} (picked on the magazine page)`;
      r = r.split("\n").filter((l) => !(l.startsWith(tag) && l.endsWith("(picked on the magazine page)"))).join("\n");
      const h = r.match(/^## Adrian's decisions.*$/m);
      if (h) {
        const start = h.index + h[0].length;
        const next = r.slice(start).search(/^## /m);
        const end = next < 0 ? r.length : start + next;
        r = r.slice(0, start) + r.slice(start, end).replace(/\s*$/, `
${line}
`) + (next < 0 ? "" : "\n" + r.slice(end));
      } else r = r.replace(/\s*$/, `

## Adrian's decisions (dated, never overwritten)

${line}
`);
      fs6.writeFileSync(rec, r);
    }
  }
  return parseAsk(fs6.readFileSync(abs, "utf8")).questions[index];
}
function listAsks(mag) {
  const dir = path8.join(mag, "Workflow");
  let files = [];
  try {
    files = fs6.readdirSync(dir).filter((f) => /^ASK - .+\.md$/.test(f));
  } catch {
  }
  return files.map((f) => {
    const { meta, questions } = parseAsk(fs6.readFileSync(path8.join(dir, f), "utf8"));
    return { file: `Workflow/${f}`, story: meta.story || f.replace(/^ASK - |\.md$/g, ""), questions };
  });
}

// reference/mag-edit.mjs
var mag_edit_exports = {};
__export(mag_edit_exports, {
  edit: () => edit,
  editLogHeader: () => editLogHeader,
  editable: () => editable2,
  hash: () => hash5,
  plain: () => plain2,
  reworkSlashes: () => reworkSlashes2,
  splitBlocks: () => splitBlocks2
});
import fs7 from "fs";
import path9 from "path";
import crypto2 from "crypto";
var reworkSlashes2 = () => /(^|[\s"'(])\/([^\/\n]+?)\/(?=$|[\s.,;:!?"')])/g;
var editLogHeader = (basename) => `---
type: Adrian's page edits
draft: ${basename}
---

Adrian's edits on the reading page. They are his and final: /mag runs the quote check after them and never undoes one. A "rework" line is words he wrapped in /slashes/: rewrite those words (keeping their meaning and the rules), then remove the mark.
`;
var today2 = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
var hash5 = (s) => crypto2.createHash("sha1").update(s).digest("hex").slice(0, 12);
function splitBlocks2(md) {
  const fm = (md.match(/^---\n[\s\S]*?\n---\n/) || [""])[0];
  return { fm, parts: md.slice(fm.length).split(/(\n\s*\n)/) };
}
function plain2(raw) {
  return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "/$1/").replace(/\s*%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/^>\s?/gm, "").replace(/^#{1,4}\s+/, "").replace(/==([\s\S]*?)==/g, "$1").replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").trim();
}
function editable2(raw) {
  const t = raw.trim();
  if (!t || t === "---" || /^%%[\s\S]*%%$/.test(t) || /^\|/.test(t)) return false;
  if (/^[-*] /m.test(t) && t.split("\n").every((l) => /^\s*([-*] |\d+\. )/.test(l) || /^\s+/.test(l))) return false;
  if (/^\*\*[^*]+:\*\*\s*$/m.test(t.split("\n")[0])) return false;
  return true;
}
var protectedMarks2 = /%%[\s\S]*?%%|<!--[\s\S]*?-->/g;
function pendingSpans(raw) {
  const masked = raw.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`/g, (part2) => " ".repeat(part2.length));
  const spans = [...masked.matchAll(/==([\s\S]*?)==/g)].map((m) => ({
    from: m.index,
    to: m.index + m[0].length,
    raw: raw.slice(m.index, m.index + m[0].length),
    words: plain2(raw.slice(m.index + 2, m.index + m[0].length - 2))
  }));
  if (masked.replace(/==([\s\S]*?)==/g, "").includes("==") || spans.some((span) => !span.words))
    throw new Error("This pending review boundary cannot be edited safely; review it separately first.");
  return spans;
}
function uniquePosition(text4, words3) {
  const i = text4.indexOf(words3);
  return i >= 0 && text4.indexOf(words3, i + 1) < 0 ? i : -1;
}
function protectPending(raw, text4) {
  const spans = pendingSpans(raw);
  if (!spans.length) return { text: text4, formatting: raw, restore: (s) => s };
  if (text4.includes("==") || text4.includes("\0"))
    throw new Error("Pending review marks cannot be changed through a prose edit; review separately first.");
  const before = plain2(raw);
  let lastBefore = 0, lastAfter = 0;
  const ranges = spans.map((span, i) => {
    const oldAt = uniquePosition(before, span.words), at = uniquePosition(text4, span.words);
    if (oldAt < lastBefore || at < lastAfter)
      throw new Error("Pending wording changed, was removed, or is ambiguous; review it separately first.");
    lastBefore = oldAt + span.words.length;
    lastAfter = at + span.words.length;
    return { ...span, at, token: "\0" + "".repeat(i + 1) + "\0" };
  });
  let shielded = text4, formatting = raw;
  for (const span of [...ranges].reverse()) {
    shielded = shielded.slice(0, span.at) + span.token + shielded.slice(span.at + span.words.length);
    formatting = formatting.slice(0, span.from) + span.token + formatting.slice(span.to);
  }
  return { text: shielded, formatting, restore: (s) => {
    for (const span of ranges) {
      if (uniquePosition(s, span.token) < 0) throw new Error("Pending review boundary could not be restored safely; nothing was saved.");
      s = s.replace(span.token, () => span.raw);
    }
    return s;
  } };
}
function rebuild(raw, text4) {
  const t = raw.trim().replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "$1");
  const notes = t.match(protectedMarks2) || [];
  const bare = t.replace(protectedMarks2, "").trim();
  const pending = protectPending(bare, text4.trim().replace(/\r/g, ""));
  const formatting = pending.formatting;
  let s = pending.text;
  for (const m of formatting.matchAll(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g)) {
    const i = s.indexOf(m[2]);
    if (i >= 0) s = s.slice(0, i) + `[[term:${m[1]}|${m[2]}]]` + s.slice(i + m[2].length);
  }
  for (const m of formatting.matchAll(/\*\*([^*]+)\*\*/g)) {
    const i = s.indexOf(m[1]);
    if (i >= 0 && !/\[\[term:[^\]]*$/.test(s.slice(0, i))) s = s.slice(0, i) + `**${m[1]}**` + s.slice(i + m[1].length);
  }
  const head = bare.match(/^(#{1,4})\s+/);
  if (head) s = head[1] + " " + s.replace(/\n+/g, " ");
  if (bare.startsWith(">")) s = s.split("\n").map((l) => "> " + l).join("\n");
  s = pending.restore(s);
  return notes.length ? s + " " + notes.join(" ") : s;
}
function edit(mag, file, index, seen, text4) {
  const abs = path9.resolve(mag, file);
  const isDraft = abs.startsWith(path9.resolve(mag, "Workflow/3-Develop") + path9.sep) && path9.basename(abs).startsWith("DEV - ");
  const isContext = abs.startsWith(path9.resolve(mag, "Workflow/1-Source") + path9.sep) && path9.basename(abs).startsWith("CONTEXT - ");
  const isMessage = abs.startsWith(path9.resolve(mag, "Workflow/6-Feedback") + path9.sep) && path9.basename(abs).startsWith("FEEDBACK - ");
  if (!(isDraft || isContext || isMessage) || !abs.endsWith(".md")) throw new Error("only a draft or your context note can be edited here");
  const md = fs7.readFileSync(abs, "utf8");
  const { fm, parts } = splitBlocks2(md);
  const k = index * 2;
  if (!Number.isInteger(index) || k < 0 || k >= parts.length) throw new Error("that paragraph is gone; reload the page");
  const raw = parts[k];
  if (hash5(raw) !== seen) throw new Error("the draft changed since you opened it; reload the page and try again");
  if (!editable2(raw)) throw new Error("that part cannot be edited here");
  const before = plain2(raw);
  const after = String(text4 || "").trim();
  const slashes = reworkSlashes2();
  const reworks = [...after.matchAll(slashes)].map((m) => m[2]).filter((r) => !before.includes("/" + r + "/"));
  const marked = after.replace(slashes, (m, pre, seg) => `${pre}%%rework%%${seg}%%/rework%%`);
  if (after === before) return { changed: false };
  if (!after) {
    if (pendingSpans(raw).length) throw new Error("Pending wording cannot be removed through a prose edit; review it separately first.");
    if (k + 1 < parts.length) parts.splice(k, 2);
    else if (k > 0) parts.splice(k - 1, 2);
    else parts.splice(k, 1);
  } else {
    const t = raw.trim(), i = raw.indexOf(t);
    parts[k] = raw.slice(0, i) + rebuild(raw, marked) + raw.slice(i + t.length);
  }
  fs7.writeFileSync(abs, fm + parts.join(""));
  const log = path9.join(mag, "Workflow/4-Review", "EDITS - " + path9.basename(abs));
  const entry = `
## ${today2()}
- before: ${before.replace(/\n/g, " ")}
- after: ${after ? after.replace(/\n/g, " ") : "(removed)"}
` + reworks.map((r) => `- rework: ${r}
`).join("");
  if (!fs7.existsSync(log)) fs7.writeFileSync(log, editLogHeader(path9.basename(abs)));
  fs7.appendFileSync(log, entry);
  return { changed: true, removed: !after, raw: after ? parts[k] : "" };
}

// services/study-draft-copies.mjs
var uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
var fail7 = (message, status = 409) => {
  throw new StateError(message, status);
};
var readable = (v, label, max = 256) => {
  if (typeof v !== "string" || !v.trim() || v.length > max || /[\x00-\x1f\x7f]/.test(v)) fail7(label + " must be explicit readable text.", 400);
  return v;
};
var stable4 = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
function createStudyDraftCopies({ dataDir, originals, afterCopyFile, afterCommit, beforeCommit, studyRelocation, vaultBound = null } = {}) {
  const readOriginal = originals?.readDraft || originals?.read;
  if (!originals?.catalog || !readOriginal) throw Error("Supply the root-owned read-only originals catalog.");
  const relocation = createStudyOwnedRelocation({ dataDir, manifest: studyRelocation });
  const root = ensurePrivateDirectory(dataDir, "study-draft-copies"), intents = ensurePrivateDirectory(root, "bindings"), copies = ensurePrivateDirectory(root, "copies"), outputLinks = ensurePrivateDirectory(root, "output-bindings");
  let pending = Promise.resolve();
  const serial = (fn) => {
    const op = pending.then(fn).catch((error) => {
      if (error instanceof StateError) throw error;
      if (error.status || /^(Use explicit structure|Edit would create unsupported|Protected|Unsafe|Unmapped|Invalid native|Native range|External DEV divergence|Correspondence |Unknown native|Malformed native|Block identity|Opaque|Pending wording|No native)/.test(error.message || "")) throw new StateError(error.message, error.status || 409);
      throw error;
    });
    pending = op.catch(() => {
    });
    return op;
  };
  const location2 = (id2) => {
    if (!uuid.test(id2 || "")) fail7("Owned draft binding UUID required.", 400);
    return path10.join(copies, id2);
  };
  const persist = (b) => atomicWrite2(path10.join(intents, b.key + ".json"), JSON.stringify(b, null, 2));
  const allBindings = () => fs8.readdirSync(intents).filter((name) => /^[a-f0-9]{64}\.json$/.test(name)).map((name) => readJson(path10.join(intents, name), null)).filter(Boolean);
  function outputRegistrations() {
    return fs8.readdirSync(outputLinks).filter((name) => uuid.test(name.slice(0, -5)) && name.endsWith(".json")).map((name) => {
      const value = readJson(path10.join(outputLinks, name), null);
      if (value?.schema !== "ar-create.study-native-output-binding.v1" || value.bindingId !== name.slice(0, -5) || !uuid.test(value.outputId || "") || !uuid.test(value.operationId || "") || !readable(value.parentStudyId) || typeof value.inputHash !== "string") fail7("Native output registration identity is corrupt.");
      return value;
    });
  }
  function outputRegistration(b) {
    const found = outputRegistrations().find((row) => row.bindingId === b.id);
    if (found && (found.parentStudyId !== b.parentStudyId || found.originalId !== b.originalId || found.originalHash !== b.originalHash || b.kind === "output-fork" && found.outputId !== b.outputId)) fail7("Output registration differs from its exact native owner.");
    return found;
  }
  function outputCatalog() {
    const rows = allBindings(), forks = rows.filter((b) => b.kind === "output-fork"), registered = outputRegistrations();
    const result = forks.map((b) => ({ bindingId: b.id, parentStudyId: b.parentStudyId, outputId: b.outputId, canonicalOutputId: b.outputId, bindingStatus: b.status, sourceBindingId: b.derivedFrom.bindingId, originalId: b.originalId, originalHash: b.originalHash, seedWorkingHash: b.seedWorkingHash, parentStudyKey: b.parentStudyKey, partKey: b.partKey, title: b.title, kind: b.kind, derivedFrom: structuredClone(b.derivedFrom) }));
    for (const link2 of registered) {
      const b = rows.find((row) => row.id === link2.bindingId);
      if (!b || b.parentStudyId !== link2.parentStudyId) fail7("Registered output native owner is missing or belongs to another parent.");
      outputRegistration(b);
      if (!result.some((row) => row.bindingId === b.id)) result.push({ bindingId: b.id, parentStudyId: b.parentStudyId, outputId: link2.outputId, canonicalOutputId: link2.outputId, bindingStatus: b.status, sourceBindingId: b.id, originalId: b.originalId, originalHash: b.originalHash, parentStudyKey: b.parentStudyKey, partKey: b.partKey, title: b.title, kind: "existing-native-output-registration", derivedFrom: structuredClone(link2.derivedFrom) });
    }
    if (new Set(result.map((row) => row.outputId)).size !== result.length) fail7("Output identity is assigned to more than one native owner.");
    return result;
  }
  function binding(input, { allowPending = false } = {}) {
    readable(input?.parentStudyId, "Parent study ID");
    const b = allBindings().find((b2) => b2.id === input.bindingId);
    if (!b || b.schema !== "ar-create.study-draft-copy.v1") fail7("Owned draft binding not found.", 404);
    if (b.parentStudyId !== input.parentStudyId) fail7("This draft binding belongs to a different parent study.");
    if (b.status !== "ready" && !allowPending) fail7("Draft copy is incomplete; explicitly reopen its saved copy intent.");
    return b;
  }
  function original(id2) {
    readable(id2, "Original identifier");
    const v = readOriginal.call(originals, id2);
    if (!v || v.id !== id2 || !Array.isArray(v.records) || v.records.filter((r) => r.role === "draft" && !r.missing).length !== 1) fail7("Trusted original must identify exactly one current DEV.", 400);
    readable(v.parentStudyKey, "Original parent study");
    readable(v.partKey, "Original part");
    for (const r of v.records) {
      if (r.missing || r.raw === null) continue;
      if (typeof r.raw !== "string" || Buffer.byteLength(r.raw) > 2 * 1024 * 1024 || !r.hash || digest2(r.raw) !== r.hash) fail7("Original record hash or readable bytes changed.");
    }
    return v;
  }
  const dirs = (b) => ({ room: location2(b.id), workflow: path10.join(location2(b.id), "workflow"), media: path10.join(location2(b.id), "media"), metadata: path10.join(location2(b.id), "metadata"), capture: path10.join(location2(b.id), "capture") });
  function owner(b) {
    const d = dirs(b);
    return createBoundProjectFolders({ dataDir: d.metadata, roots: { workflow: d.workflow, media: d.media }, ask: mag_ask_exports, draft: mag_edit_exports, writableWorkingRecords: true, beforeCommit, afterCommit, ...relocation ? { ownedRelocation: relocation.binding } : {} });
  }
  function capture2(b) {
    const file = path10.join(dirs(b).room, "capture-manifest.json");
    regular(file);
    const raw = fs8.readFileSync(file, "utf8");
    if (digest2(raw) !== b.captureHash) fail7("Captured original provenance changed; existing working words preserved.");
    const v = JSON.parse(raw);
    if (!Array.isArray(v.records) || v.records.some((r) => !r.missing && (!path10.isAbsolute(r.copiedPath || "") || !relocation && path10.dirname(r.copiedPath) !== dirs(b).capture))) fail7("Captured file must remain inside its owned copy.");
    if (v.bindingId !== b.id || v.originalId !== b.originalId || v.parentStudyId !== b.parentStudyId) fail7("Captured study identity changed.");
    return { ...v, records: v.records.map((r) => {
      if (r.missing) return r;
      const copiedPath = relocation ? relocation.capture(b.id, r, dirs(b).capture) : r.copiedPath;
      regular(copiedPath);
      const bytes4 = fs8.readFileSync(copiedPath);
      if (digest2(bytes4) !== r.copiedHash || r.copiedHash !== r.sourceHash) fail7("Read-only source capture changed; existing draft preserved.");
      return { ...r, raw: new TextDecoder("utf-8", { fatal: true }).decode(bytes4) };
    }) };
  }
  function history(b, service, raw, currentModel) {
    const area = path10.join(dirs(b).metadata, "ar-project-folder-bindings"), prefix = b.id + "-";
    return fs8.readdirSync(area).filter((name) => name.startsWith(prefix) && name.endsWith(".operation.json")).map((name) => {
      const operationId = name.slice(prefix.length, -".operation.json".length), receipt = service.inspectOperation({ projectId: b.id, operationId }), change = receipt.changes.find((c) => c.relativePath === b.draftRelative);
      return { operationId, kind: receipt.kind, state: receipt.state, beforeHash: change?.beforeHash || null, afterHash: change?.afterHash || null, hasVersion: receipt.changes.some((change2) => change2.area === "binding-metadata" && change2.beforeHash !== change2.afterHash), canUndo: canUndoVersion({ receipt, projectId: b.id, draftRelative: b.draftRelative, sourceKey: currentModel?.sourceKey }, currentModel, raw), modifiedAt: fs8.statSync(path10.join(area, name)).mtime.toISOString(), ...draftLedger.lookup({ area: "draft", scopeId: b.id, key: operationId, action: "op" }) };
    }).sort((a, b2) => a.modifiedAt.localeCompare(b2.modifiedAt));
  }
  function previewVersion(input) {
    const b = binding(input), service = owner(b), current = readOwned(b);
    if (!uuid.test(input.versionOperationId || "") || !["before", "after"].includes(input.position)) fail7("Choose an exact saved version.", 400);
    const receipt = service.inspectOperation({ projectId: b.id, operationId: input.versionOperationId });
    if (receipt.state !== "committed") fail7("This version is not committed.");
    const metadata3 = readJson(path10.join(dirs(b).metadata, "ar-project-folder-bindings", b.id + ".draft-correspondence.json"), null);
    const { model, raw } = historicalVersion({ receipt, projectId: b.id, draftRelative: b.draftRelative, sourceKey: metadata3?.sourceKey, position: input.position });
    return { bindingId: b.id, parentStudyId: b.parentStudyId, versionOperationId: input.versionOperationId, position: input.position, hash: model.fileHash, raw, projection: projection(model).map((row) => ({ ...row, raw: model.blocks.find((block2) => block2.id === row.id).raw })), expected: current.expected };
  }
  function readOwned(b) {
    const registeredOutput = outputRegistration(b), service = owner(b), captured = capture2(b), readiness = service.workflowReadiness(b.id), status = service.readDraftStatus(b.id), workflow = service.readWorkflow(b.id);
    let projection3 = null, currentModel = null;
    if (readiness.ready && status.initialized) {
      const native = service.readDraftProjection(b.id), metadata3 = readJson(path10.join(dirs(b).metadata, "ar-project-folder-bindings", b.id + ".draft-correspondence.json"), null), model = snapshot(workflow.draft, metadata3, metadata3?.sourceKey);
      currentModel = model;
      projection3 = native.projection.map((p) => ({ ...p, raw: model.blocks.find((block2) => block2.id === p.id).raw }));
    }
    let originalChanged = false;
    if (b.origin !== "authored-collection") try {
      originalChanged = original(b.originalId).records.find((r) => r.role === "draft").hash !== b.originalHash;
    } catch {
      originalChanged = true;
    }
    return { binding: { id: b.id, parentStudyId: b.parentStudyId, parentStudyKey: b.parentStudyKey, partKey: b.partKey, title: b.title, originalId: b.originalId, originalHash: b.originalHash, status: b.status, createdAt: b.createdAt, authority: "owned-working-copy", ...b.origin ? { origin: b.origin } : {}, ...b.kind === "collection-root" ? { kind: b.kind } : {}, ...b.textOutputKind ? { textOutputKind: b.textOutputKind } : {}, ...registeredOutput ? { canonicalOutputId: registeredOutput.outputId, derivedFrom: structuredClone(registeredOutput.derivedFrom) } : {}, ...b.kind === "output-fork" ? { kind: b.kind, outputId: b.outputId, canonicalOutputId: b.outputId, sourceBindingId: b.derivedFrom.bindingId, seedWorkingHash: b.seedWorkingHash, derivedFrom: structuredClone(b.derivedFrom) } : {} }, approvalReview: { role: "explicit-human-native-markup-decision", blocks: (projection3 || []).map((row) => ({ id: row.id, seenBlockHash: row.blockHash, spans: approvalSpans(row.raw) })).filter((row) => row.spans.length) }, raw: workflow.draft, projection: projection3, expected: status.expected, history: history(b, service, workflow.draft, currentModel), readiness, originalChanged, paths: { draft: path10.join(dirs(b).workflow, b.draftRelative), edits: path10.join(dirs(b).workflow, "Workflow/4-Review/EDITS - " + path10.basename(b.draftRelative)), manifest: path10.join(dirs(b).room, "capture-manifest.json") }, context: captured };
  }
  function inputFields(input, allowed) {
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((k) => !allowed.includes(k))) fail7("Malformed request: caller snapshots, paths and unsupported fields are refused.", 400);
    if (!uuid.test(input.operationId || "")) fail7("Operation UUID required.", 400);
  }
  const blankRaw = (title) => "---\ntitle: " + JSON.stringify(title) + "\n---\n";
  async function createCollection(input) {
    inputFields(input, ["parentStudyId", "title", "operationId"]);
    readable(input.parentStudyId, "Parent study ID");
    readable(input.title, "Collection title");
    const originalId = "collection:" + input.parentStudyId, key = digest2(stable4({ parentStudyId: input.parentStudyId, originalId })), file = path10.join(intents, key + ".json"), inputHash = digest2(stable4(input)), all = allBindings();
    let b = readJson(file, null);
    if (outputRegistrations().some((row) => row.operationId === input.operationId) || all.some((row) => row.operationId === input.operationId && (row.key !== key || row.collectionInputHash !== inputHash))) fail7("Operation ID already belongs to a different native collection/copy/output.");
    if (b) {
      if (b.kind !== "collection-root" || b.collectionInputHash !== inputHash || b.operationId !== input.operationId || b.parentStudyId !== input.parentStudyId || b.title !== input.title) fail7("Collection already has a different native creation identity or exact input.");
      if (b.status === "ready") return readOwned(b);
    } else {
      const raw2 = blankRaw(input.title);
      b = { schema: "ar-create.study-draft-copy.v1", kind: "collection-root", origin: "authored-collection", key, id: randomUUID6(), status: "pending", parentStudyId: input.parentStudyId, parentStudyKey: input.parentStudyId, originalId, partKey: "collection", title: input.title, originalHash: digest2(raw2), seedWorkingHash: digest2(raw2), createdAt: (/* @__PURE__ */ new Date()).toISOString(), operationId: input.operationId, prepareOperationId: randomUUID6(), draftRelative: "Workflow/3-Develop/DEV - Collection.md", collectionInputHash: inputHash };
      atomicWrite2(file, JSON.stringify(b, null, 2), { exclusive: true });
    }
    const raw = blankRaw(b.title);
    return finishCopy(b, { id: b.originalId, records: [{ id: "collection-initial-edition", role: "draft", path: path10.join(dirs(b).workflow, b.draftRelative), raw, hash: digest2(raw) }] });
  }
  async function openCopy(input) {
    inputFields(input, ["originalId", "originalHash", "parentStudyId", "operationId"]);
    readable(input.parentStudyId, "Parent study ID");
    const source = original(input.originalId);
    if (source.parentStudyKey !== input.parentStudyId) fail7("Original belongs to a different parent study.");
    const key = digest2(stable4({ parentStudyId: input.parentStudyId, originalId: input.originalId })), file = path10.join(intents, key + ".json");
    let b = readJson(file, null);
    if (b?.status === "ready") return readOwned(b);
    if (!b) {
      const bound = vaultBound?.(source);
      if (bound) fail7(bound, 409);
    }
    const selected = source.records.find((r) => r.role === "draft");
    if (input.originalHash !== selected.hash) fail7("Review the exact current original DEV hash before making a copy.");
    if (!b) {
      b = { schema: "ar-create.study-draft-copy.v1", key, id: randomUUID6(), status: "pending", parentStudyId: input.parentStudyId, parentStudyKey: source.parentStudyKey, originalId: source.id, partKey: source.partKey, title: source.title, originalHash: selected.hash, createdAt: (/* @__PURE__ */ new Date()).toISOString(), operationId: input.operationId, prepareOperationId: randomUUID6(), draftRelative: "Workflow/3-Develop/" + path10.basename(selected.path) };
      if (!/^Workflow\/3-Develop\/DEV - [^/]+\.md$/.test(b.draftRelative)) fail7("Trusted original DEV filename is unsupported.", 400);
      atomicWrite2(file, JSON.stringify(b, null, 2), { exclusive: true });
    } else if (b.originalHash !== selected.hash) fail7("Original changed during an unfinished copy; captured copy intent is preserved.");
    return finishCopy(b, source);
  }
  function finishCopy(b, source) {
    const d = dirs(b);
    for (const dir of [d.room, d.workflow, d.media, d.metadata, d.capture, path10.join(d.media, "Project"), path10.join(d.workflow, "Derived"), path10.join(d.workflow, "Workflow/3-Develop"), path10.join(d.workflow, "Workflow/4-Review")]) ensurePrivateDirectory(copies, path10.relative(copies, dir));
    const manifestFile = path10.join(d.room, "capture-manifest.json");
    let manifest = readJson(manifestFile, null);
    if (!manifest) {
      const records = [];
      for (const [index, r] of source.records.entries()) {
        if (r.missing || r.raw === null) {
          records.push({ id: r.id, role: r.role, sourcePath: r.path, missing: true });
          continue;
        }
        const copiedPath = path10.join(d.capture, String(index) + "-" + path10.basename(r.path));
        if (fs8.existsSync(copiedPath)) {
          regular(copiedPath);
          if (digest2(fs8.readFileSync(copiedPath)) !== r.hash) fail7("Interrupted copy bytes differ; existing capture preserved.");
        } else {
          atomicWrite2(copiedPath, r.raw, { exclusive: true });
          fs8.chmodSync(copiedPath, 256);
          if (afterCopyFile) afterCopyFile({ binding: b, record: r, copiedPath });
        }
        records.push({ id: r.id, role: r.role, sourcePath: r.path, sourceHash: r.hash, copiedPath, copiedHash: r.hash });
      }
      manifest = { schema: "ar-create.study-draft-capture.v1", bindingId: b.id, originalId: b.originalId, parentStudyId: b.parentStudyId, capturedAt: (/* @__PURE__ */ new Date()).toISOString(), records, ...b.origin ? { origin: b.origin } : {} };
      atomicWrite2(manifestFile, JSON.stringify(manifest, null, 2), { exclusive: true });
      fs8.chmodSync(manifestFile, 256);
    }
    const expectedRecords = source.records.map((r) => ({ id: r.id, role: r.role, sourcePath: r.path, sourceHash: r.missing || r.raw === null ? null : r.hash })), actualRecords = manifest.records.map((r) => ({ id: r.id, role: r.role, sourcePath: r.sourcePath, sourceHash: r.missing ? null : r.sourceHash }));
    if (stable4(expectedRecords) !== stable4(actualRecords)) fail7("Interrupted capture manifest differs from the exact trusted records.");
    b.captureHash = digest2(fs8.readFileSync(manifestFile));
    persist(b);
    const draftFile = path10.join(d.workflow, b.draftRelative), capturedDraft = manifest.records.find((r) => r.role === "draft");
    if (fs8.existsSync(draftFile)) {
      regular(draftFile);
      if (digest2(fs8.readFileSync(draftFile)) !== (b.seedWorkingHash ?? b.originalHash)) fail7("Existing working copy has edits; incomplete copy cannot overwrite them.");
    } else atomicWrite2(draftFile, fs8.readFileSync(capturedDraft.copiedPath), { exclusive: true });
    const service = owner(b);
    try {
      service.readBinding(b.id);
    } catch (error) {
      if (error.status !== 404) throw error;
      service.bind({ projectId: b.id, mediaFolder: "Project", derivedFolder: "Derived", records: { draft: b.draftRelative }, draftAuthority: "owned-working-copy" });
    }
    const readiness = service.workflowReadiness(b.id);
    if (!readiness.ready) return readOwned(b);
    if (!service.readDraftStatus(b.id).initialized) service.prepareDraftCorrespondence({ projectId: b.id, operationId: b.prepareOperationId, expected: service.readDraftStatus(b.id).expected });
    b.status = "ready";
    b.readyAt = (/* @__PURE__ */ new Date()).toISOString();
    persist(b);
    return readOwned(b);
  }
  function forkSeed(parent, b) {
    const captured = parent.context.records;
    return { schema: "ar-create.study-native-fork-seed.v1", bindingId: b.id, parentStudyId: b.parentStudyId, sourceBindingId: b.derivedFrom.bindingId, outputId: b.outputId, originalId: b.originalId, originalHash: b.originalHash, seedWorkingHash: b.seedWorkingHash, derivedFrom: structuredClone(b.derivedFrom), records: captured.map((r) => r.role === "draft" ? { id: r.id, role: r.role, path: parent.paths.draft, raw: b.textOutputKind ? blankRaw(b.title) : parent.raw, hash: b.seedWorkingHash } : r.missing ? { id: r.id, role: r.role, path: r.sourcePath, raw: null, hash: null, missing: true } : { id: r.id, role: r.role, path: r.sourcePath, raw: r.raw, hash: r.copiedHash }) };
  }
  function validateFork(b, input, key) {
    if (!b || b.schema !== "ar-create.study-draft-copy.v1" || b.kind !== "output-fork" || b.key !== key || b.outputId !== input.outputId || b.parentStudyId !== input.parentStudyId || b.derivedFrom?.bindingId !== input.sourceBindingId || b.forkInputHash !== digest2(stable4(input)) || stable4(b.derivedFrom.expected) !== stable4(input.expected) || b.textOutputKind !== input.textOutputKind || !b.textOutputKind && b.seedWorkingHash !== input.expected?.workflow?.draft || b.derivedFrom.rawHash !== input.expected?.workflow?.draft || !uuid.test(b.id || "") || !["pending", "ready"].includes(b.status)) fail7("Output is registered with a different fork identity or exact input.");
    if (allBindings().filter((row) => row.id === b.id).length !== 1) fail7("Native fork binding ID collision; registration preserved.");
  }
  async function fork(input) {
    inputFields(input, ["sourceBindingId", "parentStudyId", "outputId", "operationId", "expected", "textOutputKind"]);
    readable(input.parentStudyId, "Parent study ID");
    if (input.textOutputKind !== void 0 && !["post", "product-listing"].includes(input.textOutputKind)) fail7("Supported short text output kind required.", 400);
    if (!uuid.test(input.sourceBindingId || "") || !uuid.test(input.outputId || "")) fail7("Explicit source binding and output UUID required.", 400);
    const key = digest2(stable4({ parentStudyId: input.parentStudyId, sourceBindingId: input.sourceBindingId, outputId: input.outputId })), location3 = path10.join(intents, key + ".json"), inputHash = digest2(stable4(input)), all = allBindings(), prior = readJson(location3, null), links = outputRegistrations();
    if (links.some((row) => row.operationId === input.operationId)) fail7("Operation ID already belongs to a native output registration.");
    if (links.some((row) => row.outputId === input.outputId && row.bindingId !== prior?.id)) fail7("Output ID already registered to another native owner.");
    if (all.some((row) => row.operationId === input.operationId && (row.key !== key || row.forkInputHash !== inputHash))) fail7("Operation ID already belongs to a different native copy/fork.");
    if (all.some((row) => row.id === input.outputId || row.kind === "output-fork" && row.outputId === input.outputId && row.key !== key)) fail7("Output ID already belongs to a different native binding/registration.");
    let b = prior, parent = null;
    if (b) {
      validateFork(b, input, key);
      if (b.status === "ready") return readOwned(b);
    } else {
      if (all.filter((row) => row.id === input.sourceBindingId).length !== 1) fail7("Exact unique source native binding required; ID collision or missing owner.");
      const source = binding({ bindingId: input.sourceBindingId, parentStudyId: input.parentStudyId });
      parent = readOwned(source);
      if (parent.readiness?.ready !== true || !parent.projection || stable4(parent.expected) !== stable4(input.expected)) fail7("Exact current saved native expected revision is required for this fork.");
      b = { schema: "ar-create.study-draft-copy.v1", kind: "output-fork", key, id: randomUUID6(), status: "pending", parentStudyId: source.parentStudyId, parentStudyKey: source.parentStudyKey, originalId: source.originalId, partKey: source.partKey, title: source.title, ...source.origin ? { origin: source.origin } : {}, ...input.textOutputKind ? { textOutputKind: input.textOutputKind } : {}, originalHash: source.originalHash, seedWorkingHash: digest2(input.textOutputKind ? blankRaw(source.title) : parent.raw), outputId: input.outputId, createdAt: (/* @__PURE__ */ new Date()).toISOString(), operationId: input.operationId, prepareOperationId: randomUUID6(), draftRelative: source.draftRelative, forkInputHash: inputHash, derivedFrom: { bindingId: source.id, expected: structuredClone(input.expected), rawHash: digest2(parent.raw), captureHash: source.captureHash, relationship: "archival-starting-edition-not-continuous-wording-or-freshness-authority" } };
      if (all.some((row) => row.id === b.id)) fail7("Generated native fork binding ID collided; no registration written.");
      b.seedHash = digest2(stable4(forkSeed(parent, b)));
      atomicWrite2(location3, JSON.stringify(b, null, 2), { exclusive: true });
    }
    const d = dirs(b);
    ensurePrivateDirectory(copies, b.id);
    const seedFile = path10.join(d.room, "fork-seed.json");
    let seed = readJson(seedFile, null);
    if (seed) {
      if (digest2(stable4(seed)) !== b.seedHash) fail7("Immutable native fork seed changed; preserve child and parent words.");
      regular(seedFile);
    } else {
      if (!parent) {
        parent = readOwned(binding({ bindingId: input.sourceBindingId, parentStudyId: input.parentStudyId }));
        if (stable4(parent.expected) !== stable4(b.derivedFrom.expected)) fail7("Fork intent has no saved seed and parent changed; preserve intent instead of guessing bytes.");
      }
      seed = forkSeed(parent, b);
      if (digest2(stable4(seed)) !== b.seedHash) fail7("Pending fork seed differs from its exact recorded source edition.");
      atomicWrite2(seedFile, JSON.stringify(seed, null, 2), { exclusive: true });
      fs8.chmodSync(seedFile, 256);
    }
    if (seed.schema !== "ar-create.study-native-fork-seed.v1" || seed.bindingId !== b.id || seed.sourceBindingId !== input.sourceBindingId || seed.outputId !== b.outputId || seed.seedWorkingHash !== b.seedWorkingHash || seed.originalHash !== b.originalHash || !Array.isArray(seed.records) || seed.records.filter((r) => r.role === "draft").length !== 1) fail7("Fork seed identity/provenance changed.");
    for (const record of seed.records) if (!record.missing && (typeof record.raw !== "string" || digest2(record.raw) !== record.hash)) fail7("Fork source/context seed bytes changed.");
    const draft = seed.records.find((r) => r.role === "draft");
    if (digest2(draft.raw) !== b.seedWorkingHash) fail7("Fork initial working draft does not match its separate seed hash.");
    return finishCopy(b, { id: b.originalId, records: seed.records });
  }
  async function registerOutput(input) {
    inputFields(input, ["bindingId", "parentStudyId", "outputId", "operationId", "expected"]);
    readable(input.parentStudyId, "Parent study ID");
    if (!uuid.test(input.bindingId || "") || !uuid.test(input.outputId || "")) fail7("Explicit native binding and output UUID required.", 400);
    const b = binding(input), all = allBindings(), links = outputRegistrations(), inputHash = digest2(stable4(input));
    if (all.some((row) => row.operationId === input.operationId) || links.some((row) => row.operationId === input.operationId && (row.bindingId !== b.id || row.inputHash !== inputHash))) fail7("Operation ID already belongs to another native copy/fork/registration.");
    if (all.some((row) => row.id === input.outputId) || all.some((row) => row.kind === "output-fork" && row.outputId === input.outputId && row.id !== b.id) || links.some((row) => row.outputId === input.outputId && row.bindingId !== b.id)) fail7("Output ID already owned by a different native registration.");
    if (all.filter((row) => row.id === b.id).length !== 1) fail7("Native binding ID collision; registration refused.");
    const existing = outputRegistration(b);
    if (existing) {
      if (existing.outputId !== input.outputId || existing.inputHash !== inputHash || existing.operationId !== input.operationId) fail7("Native binding already has a different output registration or exact input.");
      return readOwned(b);
    }
    if (b.kind === "output-fork" && b.outputId !== input.outputId) fail7("Native fork already belongs to a different output.");
    const saved = readOwned(b);
    if (saved.readiness?.ready !== true || !saved.projection || stable4(saved.expected) !== stable4(input.expected)) fail7("Exact current saved native expected revision required for output registration.");
    const registered = { schema: "ar-create.study-native-output-binding.v1", bindingId: b.id, parentStudyId: b.parentStudyId, outputId: input.outputId, originalId: b.originalId, originalHash: b.originalHash, operationId: input.operationId, inputHash, registeredAt: (/* @__PURE__ */ new Date()).toISOString(), derivedFrom: { bindingId: b.id, expected: structuredClone(input.expected), originalId: b.originalId, originalHash: b.originalHash, relationship: "archival-registration-of-existing-canonical-wording-owner-not-shared-wording-freshness" } };
    atomicWrite2(path10.join(outputLinks, b.id + ".json"), JSON.stringify(registered, null, 2), { exclusive: true });
    return readOwned(b);
  }
  async function withSnapshotLease(input, fn) {
    const captured = structuredClone(input);
    if (!captured || typeof captured !== "object" || Array.isArray(captured) || Object.keys(captured).some((key) => !["bindingId", "parentStudyId", "expected"].includes(key)) || !uuid.test(captured.bindingId || "") || !readable(captured.parentStudyId) || typeof fn !== "function") fail7("Trusted exact native snapshot lease fields and callback required.", 400);
    return serial(async () => {
      const b = binding(captured), snapshot2 = readOwned(b);
      if (snapshot2.readiness?.ready !== true || !snapshot2.projection || stable4(snapshot2.expected) !== stable4(captured.expected)) fail7("Exact ready current native expected proof required for snapshot lease.");
      let active = true;
      const reread = () => {
        if (!active) fail7("Native snapshot lease has ended; use a fresh exact lease.");
        return readOwned(b);
      };
      try {
        return await fn({ snapshot: snapshot2, reread });
      } finally {
        active = false;
      }
    });
  }
  function rootRecovery(input) {
    const b = binding(input);
    capture2(b);
    return createStudyRootRecovery({ copyRoot: root, bindingId: b.id, parentStudyId: b.parentStudyId, originalId: b.originalId });
  }
  const draftLedger = createProvenanceLedger({ dataDir });
  function withDraftProvenance(api) {
    for (const name of ["createCollection", "openCopy", "fork", "registerOutput", "restoreVersion", "save", "undo", "recover", "recoverRoots"]) {
      const run = api[name];
      api[name] = async (input) => {
        const out = await run(input);
        const scopeId = input?.bindingId || out?.binding?.id || out?.document?.binding?.id;
        if (scopeId && input?.operationId) {
          try {
            draftLedger.stamp({ area: "draft", scopeId, key: input.operationId, action: "op" });
          } catch (error) {
            console.error("Draft provenance was not recorded:", error.message);
          }
          const mark = (doc) => {
            if (Array.isArray(doc?.history)) doc.history = doc.history.map((h) => h.operationId === input.operationId ? { ...h, ...draftLedger.lookup({ area: "draft", scopeId, key: input.operationId, action: "op" }) } : h);
          };
          mark(out);
          mark(out?.document);
        }
        return out;
      };
    }
    return api;
  }
  return withDraftProvenance({ createCollection: (input) => serial(() => createCollection(structuredClone(input))), withSnapshotLease, inspectRoots: (input) => serial(() => rootRecovery(input).inspect()), recoverRoots: (input) => serial(() => {
    inputFields(input, ["bindingId", "parentStudyId", "operationId", "ownerDecision", "expected", "captureHash", "intentHash"]);
    const result = rootRecovery(input).recover({ operationId: input.operationId, ownerDecision: input.ownerDecision, expected: input.expected, captureHash: input.captureHash, intentHash: input.intentHash });
    return { recovery: result, document: readOwned(binding(input)) };
  }), catalog: () => serial(() => {
    let c, originalsUnavailable;
    try {
      c = originals.catalog();
    } catch (error) {
      if (error.status !== 404 || !allBindings().some((b) => b.kind === "collection-root")) throw error;
      c = { drafts: [] };
      originalsUnavailable = { status: 404, message: error.message };
    }
    const drafts = Array.isArray(c) ? c : c.drafts;
    return { ...originalsUnavailable ? { originalsUnavailable } : {}, collections: allBindings().filter((b) => b.kind === "collection-root").map((b) => ({ bindingId: b.id, parentStudyId: b.parentStudyId, parentStudyKey: b.parentStudyKey, partKey: b.partKey, title: b.title, bindingStatus: b.status, kind: b.kind, origin: b.origin })), outputBindings: outputCatalog(), drafts: drafts.map((item) => {
      const id2 = item.originalId || item.id, b = allBindings().find((b2) => b2.kind !== "output-fork" && b2.originalId === id2);
      return { ...item, originalId: id2, ...b ? { bindingId: b.id, parentStudyId: b.parentStudyId, bindingStatus: b.status } : {} };
    }) };
  }), openCopy: (input) => serial(() => openCopy(structuredClone(input))), fork: (input) => serial(() => fork(structuredClone(input))), registerOutput: (input) => serial(() => registerOutput(structuredClone(input))), read: (input) => serial(() => readOwned(binding(input, { allowPending: true }))), previewVersion: (input) => serial(() => previewVersion(structuredClone(input))), restoreVersion: (input) => serial(() => {
    inputFields(input, ["bindingId", "parentStudyId", "operationId", "expected", "restoreOperationId", "restorePosition"]);
    const b = binding(input);
    capture2(b);
    owner(b).restoreDraftVersion({ projectId: b.id, operationId: input.operationId, expected: input.expected, restoreOperationId: input.restoreOperationId, restorePosition: input.restorePosition });
    return readOwned(b);
  }), save: (input) => serial(() => {
    inputFields(input, ["bindingId", "parentStudyId", "operationId", "expected", "operations"]);
    const b = binding(input);
    capture2(b);
    owner(b).applyDraftOperations({ projectId: b.id, operationId: input.operationId, expected: input.expected, operations: structuredClone(input.operations) });
    return readOwned(b);
  }), undo: (input) => serial(() => {
    inputFields(input, ["bindingId", "parentStudyId", "operationId", "expected", "undoOperationId"]);
    const b = binding(input);
    capture2(b);
    owner(b).undoDraftOperation({ projectId: b.id, operationId: input.operationId, expected: input.expected, undoOperationId: input.undoOperationId });
    return readOwned(b);
  }), inspect: (input) => serial(() => {
    const b = binding(input, { allowPending: true }), service = owner(b);
    return { bindingId: b.id, readiness: service.workflowReadiness(b.id), receipt: service.inspectOperation({ projectId: b.id, operationId: input.operationId }) };
  }), recover: (input) => serial(() => {
    const b = binding(input, { allowPending: true });
    capture2(b);
    const service = owner(b);
    service.recoverOperation({ projectId: b.id, operationId: input.operationId });
    if (b.status === "pending" && service.workflowReadiness(b.id).ready && service.readDraftStatus(b.id).initialized) {
      b.status = "ready";
      b.readyAt = (/* @__PURE__ */ new Date()).toISOString();
      persist(b);
    }
    return readOwned(b);
  }) });
}

// services/native-output-owner.mjs
import fs9 from "node:fs";

// src/workspaces/carousel-typography.mjs
var CAROUSEL_FONTS = Object.freeze({
  original: null,
  // Keep each canvas's authored family.
  caudex: "Caudex,Georgia,serif",
  serif: "'Source Serif 4',Georgia,serif",
  sans: "'Instrument Sans',Arial,sans-serif"
});
function validateCarouselTypography(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && ["original", "caudex", "serif", "sans"].includes(value.font) && typeof value.scale === "number" && Number.isFinite(value.scale) && value.scale >= 0.5 && value.scale <= 1.5 && ["auto", "manual"].includes(value.fit);
}

// services/native-output-owner.mjs
import path11 from "node:path";
import { createHash as createHash9 } from "node:crypto";
var stable5 = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
var hash6 = (v) => createHash9("sha256").update(typeof v === "string" ? v : stable5(v)).digest("hex");
var same2 = (a, b) => stable5(a) === stable5(b);
var clone = (v) => structuredClone(v);
var uuid2 = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
var fail8 = (message) => {
  throw Object.assign(Error(message), { status: 409, outcome: "not-applied" });
};
function derivedId(op) {
  const h = hash6("native-output-registration:" + op);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
var textKind = (kind) => ["article", "post", "product-listing"].includes(kind);
var shortKind = (kind) => ["post", "product-listing"].includes(kind);
var arrangement = (o) => textKind(o.kind) ? { placements: o.placements || [], articleComposition: o.articleComposition, name: o.name } : { slides: (o.slides || []).map(({ text: text4, credit, label, role: role3, ...slide }) => slide), name: o.name };
var words2 = (o) => textKind(o.kind) ? { title: o.title, manuscript: o.manuscript } : { slides: (o.slides || []).map(({ id: id2, role: role3, text: text4, credit, label }) => ({ id: id2, role: role3, text: text4, credit, label: label ?? "" })), caption: o.caption ?? "" };
var resetVisual = (o) => {
  delete o.articleVisualMake;
  delete o.articleVisualHistory;
  delete o.visualMake;
  delete o.visualHistory;
};
function createNativeOutputOwner({ dataDir, store, native, mapper, helpers, scope, proof }) {
  if (!scope?.resolve || !proof?.read || !native?.withSnapshotLease || !store?.saveOutputRecords) throw Error("Exact trusted owners are required.");
  async function target(input) {
    if (!input || !uuid2.test(input.rootBindingId || "") || typeof input.parentStudyId !== "string" || !input.parentStudyId) fail8("Exact native root and parent are required.");
    const ids = await scope.resolve({ rootBindingId: input.rootBindingId, parentStudyId: input.parentStudyId });
    if (!ids?.projectId || !ids.documentId) fail8("Unknown trusted output scope.");
    const read2 = await store.readArticle({ projectId: ids.projectId });
    if (read2.document.id !== ids.documentId) fail8("Trusted physical document changed.");
    return { ...ids, document: read2.document };
  }
  const group = (i) => ({ rootBindingId: i.rootBindingId, parentStudyId: i.parentStudyId });
  function privatePath(t, kind, id2) {
    if (!(kind === "captures" ? /^[a-f0-9]{64}$/ : uuid2).test(id2 || "")) fail8("Exact private evidence identity required.");
    return outputPrivatePrefix(t.projectId, t.documentId) + kind + "/" + id2 + ".json";
  }
  function privateRead(t, kind, id2) {
    const relative2 = privatePath(t, kind, id2), file = path11.join(dataDir, relative2);
    let cursor = dataDir;
    for (const segment of relative2.split("/")) {
      cursor = path11.join(cursor, segment);
      if (!fs9.existsSync(cursor)) return null;
      const s = fs9.lstatSync(cursor);
      if (s.isSymbolicLink() || s.isFile() && s.nlink !== 1) fail8("Private output evidence must remain ordinary owned files.");
    }
    const bytes4 = fs9.readFileSync(file, "utf8");
    if (kind === "captures" && hash6(bytes4) !== id2) fail8("Immutable private capture/source proof integrity changed.");
    return { value: JSON.parse(bytes4), hash: hash6(bytes4) };
  }
  function record(t, id2) {
    const r = t.document.nativeOutputIndex?.records.find((r2) => r2.outputId === id2), o = t.document.outputs.find((o2) => o2.id === id2);
    if (!r || !o) fail8("Output does not belong to this exact document.");
    const p = privateRead(t, "captures", r.captureId)?.value;
    if (!p || !same2(p.group, group(t.input))) fail8("Output belongs to another native scope.");
    if (p.capture.scope.projectId !== t.projectId || p.capture.scope.documentId !== t.documentId || p.capture.scope.outputId !== id2 || textKind(o.kind) && (r.wordOwner.bindingId !== p.capture.nativeProof.bindingId || r.wordOwner.parentStudyId !== t.input.parentStudyId)) fail8("Exact captured output ownership changed.");
    return { record: r, output: o, private: p };
  }
  async function proofCatalogue(i, outputId) {
    const p = await proof.read({ ...group(i), outputId });
    if (!Array.isArray(p?.sources) || !Array.isArray(p.assets || []) || !Array.isArray(p.photos || []) || !/^[a-f0-9]{64}$/.test(p.decisionsHash || "")) fail8("Authoritative source/decision/photo catalogue required.");
    return clone(p);
  }
  function scopedProof(p, captureValue, output, { captureMappings = false } = {}) {
    const wanted = captureValue.nativeProof.sourceProof;
    const sources2 = wanted.map((w) => {
      const matches = p.sources.filter((s2) => s2.id === w.id);
      if (matches.length > 1) fail8("Ambiguous exact source identity.");
      const s = matches[0];
      if (!s) return { ...w, hash: null, missing: true };
      if (s.role === "draft" || s.role !== w.role || s.sourcePath !== w.sourcePath || !s.missing && !/^[a-f0-9]{64}$/.test(s.hash || "")) fail8("Exact retained source authority changed.");
      return { id: s.id, role: s.role, sourcePath: s.sourcePath, hash: s.hash ?? null, missing: !!s.missing };
    });
    const names = new Set(captureValue.privateSidecar.photoRequests.map((p2) => p2.nativeFile));
    const photos = (captureMappings ? p.photos || [] : captureValue.nativeProof.photoProof).filter((x) => names.has(x.nativeFile)).map((x) => ({ nativeFile: x.nativeFile, sourceId: x.sourceId, sourceHash: x.sourceHash })).sort((a, b) => a.nativeFile.localeCompare(b.nativeFile));
    const urls = [...(output?.placements || []).map((x) => x.url), ...(output?.slides || []).flatMap((s) => (s.photos || []).map((x) => x.src))].filter(Boolean);
    const ids = [...new Set(urls.map((url) => {
      const m = /^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(url);
      if (!m) fail8("Only exact owned Library photograph URLs may be used.");
      return decodeURIComponent(m[1]);
    }))].sort();
    const assets = ids.map((id2) => {
      const matches = (p.assets || []).filter((a2) => a2.id === id2);
      if (matches.length > 1) fail8("Ambiguous used photo identity.");
      const a = matches[0];
      return { id: id2, hash: a?.hash ?? null, missing: !a || !!a.missing };
    });
    return { sources: sources2, photos, assets, decisionsHash: p.decisionsHash };
  }
  async function currentProof(i, outputId, captureValue, output) {
    return scopedProof(await proofCatalogue(i, outputId), captureValue, output);
  }
  function placements(output, p) {
    if (output.kind === "article" && !output.articleComposition) fail8("Exact article layout required; no flat prose fallback.");
    const ids = new Set(output.manuscript?.map((x) => x.id)), slots = /* @__PURE__ */ new Set();
    for (const row of output.placements || []) {
      if (!row || typeof row.slot !== "string" || !row.slot || slots.has(row.slot)) fail8("Unique exact output photo slots required.");
      slots.add(row.slot);
      if (row.paragraphId && !ids.has(row.paragraphId)) fail8("Photo anchor belongs to another wording owner.");
      if (row.url) {
        const match = /^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(row.url);
        if (!match) fail8("Photographs must use exact owned Library source IDs.");
        const id2 = decodeURIComponent(match[1]);
        if (!(p.assets || []).some((x) => x.id === id2 && !x.missing && /^[a-f0-9]{64}$/.test(x.hash || ""))) fail8("Exact current Library photo proof required.");
      }
      for (const field of ["x", "y"]) if (row[field] !== void 0 && (!Number.isFinite(row[field]) || row[field] < 0 || row[field] > 1)) fail8("Invalid article crop.");
      if (row.zoom !== void 0 && (!Number.isFinite(row.zoom) || row.zoom <= 0)) fail8("Invalid article zoom.");
    }
    if (output.articleComposition) {
      const issue = helpers.articleCompositionIssue(output.articleComposition, output.manuscript, output.placements);
      if (issue) fail8(issue);
    }
    for (const slide of output.slides || []) for (const photo of slide.photos || []) {
      const m = /^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(photo.src || "");
      if (!m || !p.assets.some((x) => x.id === decodeURIComponent(m[1]) && !x.missing && /^[a-f0-9]{64}$/.test(x.hash || ""))) fail8("Exact current carousel photo proof required.");
    }
  }
  function validateCapture(p, o) {
    const c = mapper.reopen(JSON.stringify(p.capture));
    if (!c.ready || c.scope.outputId !== o.id) fail8("Exact ready captured output identity required.");
    if (textKind(o.kind) && (o.kind !== c.output.kind || !same2(words2(o), words2(c.output)))) fail8("Article words changed outside its canonical native owner; refresh explicitly.");
    return c;
  }
  async function freshness(i, t, selected) {
    const p = await currentProof(i, selected.output.id, selected.private.capture, selected.output);
    const sourceStale = !same2(p, selected.private.proof);
    let reason = sourceStale ? "Shared source, decision or photo proof changed." : null, writingProof, writingStale = false;
    if (textKind(selected.output.kind)) {
      const c = validateCapture(selected.private, selected.output), s = await native.read({ bindingId: selected.record.wordOwner.bindingId, parentStudyId: i.parentStudyId });
      writingProof = { kind: "native", bindingId: s.binding.id, parentStudyId: s.binding.parentStudyId, expected: clone(s.expected), rawHash: hash6(s.raw), capturedRawHash: c.nativeProof.rawHash };
      writingStale = writingProof.rawHash !== writingProof.capturedRawHash || !same2(s.expected, c.nativeProof.expected);
      if (mapper.freshness(c, s, p.sources, p.photos).stale) reason = "This output native wording or exact source proof changed.";
    } else {
      const w = await store.readCarouselWords({ projectId: t.projectId, documentId: t.documentId, outputId: selected.output.id, allowEditedMarkdown: true });
      writingProof = { kind: "carousel-words", projectId: t.projectId, documentId: t.documentId, outputId: selected.output.id, expected: clone(w.expected), wordsHash: await helpers.carouselWordsHash(w.output) };
      writingStale = !!w.externalEdit || !!w.missing;
      if (writingStale) reason = "This carousel canonical words file changed outside its saved output.";
    }
    return { writingProof, freshness: { stale: sourceStale || writingStale, reason, writingStale, sourceStale } };
  }
  async function read(input) {
    const t = await target(input);
    t.input = input;
    const selected = input.selectedOutputId ? record(t, input.selectedOutputId) : null;
    const outputBindings = (t.document.nativeOutputIndex?.records || []).filter((r) => {
      const p = privateRead(t, "captures", r.captureId)?.value;
      return p && same2(p.group, group(input));
    }).map((r) => ({ outputId: r.outputId, wordOwner: clone(r.wordOwner) }));
    let arrangementUndo = null;
    if (selected) {
      const operationId = selected.record.historyIds.at(-1), previous = operationId ? privateRead(t, "history", operationId)?.value : null;
      if (previous?.schema === "ar-create.native-output-command.v1" && previous.outputId === selected.output.id && same2(previous.group, group(input)) && previous.afterHash === hash6(selected.output) && previous.captureId === selected.record.captureId && previous.beforeArrangement && !same2(previous.beforeArrangement, arrangement(selected.output))) arrangementUndo = { operationId };
    }
    const outputs = outputBindings.map((binding) => clone(record(t, binding.outputId).output));
    const document = selected ? { ...clone(mapper.renderDocument(validateCapture(selected.private, selected.output))), id: input.rootBindingId, outputs: clone(outputs) } : null;
    return { scope: group(input), photoScope: { projectId: t.projectId, documentId: t.documentId }, documentId: input.rootBindingId, expectedOutput: outputRecordsExpected(t.document), outputBindings, outputs, ...selected ? { document, arrangementUndo, output: clone(selected.output), wordOwner: clone(selected.record.wordOwner), ...await freshness(input, t, selected) } : {} };
  }
  async function mutate(action, input) {
    input = clone(input);
    if (!uuid2.test(input.operationId || "")) fail8("Output operation UUID required.");
    const allowed = ["rootBindingId", "parentStudyId", "operationId", "expectedOutput", "expectedNative", "selectedOutputId", ...action === "create" ? ["kind", "sourceBindingId"] : action === "save" ? ["changes"] : action === "undo" ? ["undoOperationId"] : action === "review" ? ["expectedWords", "wordsHash"] : []];
    if (Object.keys(input).some((k) => !allowed.includes(k))) fail8("Unsupported output mutation fields.");
    const t = await target(input);
    t.input = input;
    const commandHash = hash6({ action, input }), prior = privateRead(t, "history", input.operationId);
    const request = { projectId: t.projectId, documentId: t.documentId, operationId: input.operationId, expectedOutput: input.expectedOutput, commandHash };
    if (prior) {
      if (prior.value.commandHash !== commandHash || !same2(prior.value.group, group(input))) fail8("Operation ID already owns another exact output request.");
      const result2 = await store.saveOutputRecords(request, () => fail8("Recorded output operation has no matching store receipt."));
      return { ...result2, view: await read({ ...group(input), selectedOutputId: prior.value.outputId }) };
    }
    if (!same2(input.expectedOutput, outputRecordsExpected(t.document))) fail8("Outputs changed since this request.");
    let selected = action === "create" ? null : record(t, input.selectedOutputId), snapshot2, binding;
    if (action === "review" && selected.output.kind !== "carousel") fail8("Only an own carousel words file can be reviewed here.");
    if (action === "review" && (!input.expectedWords || typeof input.wordsHash !== "string" || !/^[a-f0-9]{64}$/.test(input.wordsHash))) fail8("Exact current own carousel words proof required.");
    if (action === "refresh" && !textKind(selected.output.kind)) fail8("Only a native text output refreshes from its own wording.");
    if (action === "create") {
      if (!["article", "carousel", "post", "product-listing"].includes(input.kind)) fail8("Explicit supported output kind required.");
      if (shortKind(input.kind)) {
        input.sourceBindingId = input.sourceBindingId || input.rootBindingId;
      }
      if (!input.sourceBindingId) fail8("Explicit starting native binding required.");
      if (input.sourceBindingId !== input.rootBindingId && !(t.document.nativeOutputIndex?.records || []).some((r) => r.wordOwner.kind === "native" && r.wordOwner.bindingId === input.sourceBindingId && same2(privateRead(t, "captures", r.captureId)?.value?.group, group(input)))) fail8("Starting copy belongs to another native root/part.");
      const start = await native.read({ bindingId: input.sourceBindingId, parentStudyId: input.parentStudyId });
      if (shortKind(input.kind) && !input.expectedNative) input.expectedNative = clone(start.expected);
      if (!same2(start.expected, input.expectedNative)) fail8("Exact starting native snapshot required before output registration.");
      const preflight = mapper.capture(start, { projectId: t.projectId, documentId: t.documentId, outputId: input.operationId }, shortKind(input.kind) ? { outputKind: input.kind } : {});
      if (!shortKind(input.kind) && !preflight.ready) fail8("Native layout is held before output registration: " + preflight.held.map((x) => x.reason).join("; "));
      if (textKind(input.kind)) {
        if (input.kind === "article" && input.sourceBindingId === input.rootBindingId && (!start.binding.canonicalOutputId || start.binding.canonicalOutputId === input.operationId)) snapshot2 = await native.registerOutput({ bindingId: input.rootBindingId, parentStudyId: input.parentStudyId, outputId: input.operationId, operationId: derivedId(input.operationId), expected: input.expectedNative });
        else snapshot2 = await native.fork({ sourceBindingId: input.sourceBindingId, parentStudyId: input.parentStudyId, outputId: input.operationId, operationId: derivedId(input.operationId), expected: input.expectedNative, ...shortKind(input.kind) ? { textOutputKind: input.kind } : {} });
      } else {
        snapshot2 = start;
        if (!same2(snapshot2.expected, input.expectedNative)) fail8("Exact starting native snapshot required.");
      }
      if (input.kind === "article" && snapshot2.binding.id === input.rootBindingId && !same2(snapshot2.expected, input.expectedNative)) fail8("Registered native words changed before output publication; exact pending request preserved.");
      binding = snapshot2.binding.id;
    } else if (textKind(selected.output.kind)) {
      binding = selected.record.wordOwner.bindingId;
      snapshot2 = await native.read({ bindingId: binding, parentStudyId: input.parentStudyId });
      if (!same2(input.expectedNative, snapshot2.expected)) fail8("Exact own article native expected proof required.");
    }
    const run = async (lease) => store.saveOutputRecords(request, async ({ project, readCarouselWords }) => {
      const doc = project.document, id2 = selected?.output.id || input.operationId, catalogue = await proofCatalogue(input, id2);
      let proofNow, reviewedWords;
      if (action === "review") {
        reviewedWords = await readCarouselWords({ documentId: t.documentId, outputId: id2 });
        if (!same2(reviewedWords.expected, input.expectedWords) || await helpers.carouselWordsHash(reviewedWords.output) !== input.wordsHash) fail8("Own carousel words changed since human review.");
      }
      let output, captureValue, privateValue, captureId = selected?.record.captureId;
      if (action === "create" || action === "refresh") {
        const s = lease.snapshot;
        const outputKind = shortKind(action === "create" ? input.kind : selected.output.kind) ? action === "create" ? input.kind : selected.output.kind : void 0;
        const basis = mapper.capture(s, { projectId: t.projectId, documentId: t.documentId, outputId: id2 }, { outputKind });
        proofNow = scopedProof(catalogue, basis, null, { captureMappings: true });
        captureValue = mapper.capture(s, { projectId: t.projectId, documentId: t.documentId, outputId: id2 }, { photoBindings: proofNow.photos, outputKind });
        if (!captureValue.ready) fail8("Native layout is held: " + captureValue.held.map((x) => x.reason).join("; "));
        if (mapper.freshness(captureValue, s, proofNow.sources, proofNow.photos).stale) fail8("Native retained source proof differs from authoritative current sources.");
        output = clone(captureValue.output);
        if (action === "create" && input.kind === "carousel") {
          output = helpers.snapshotCarousel(mapper.renderDocument(captureValue));
          output.id = id2;
          output.adaptation = { method: "deterministic-existing-snapshotCarousel", generated: false };
        }
        if (action === "refresh") {
          if (!textKind(selected.output.kind)) fail8("Only a native text output refreshes from its own wording.");
          const previous = selected.output;
          const old = outputKind ? { status: "text" } : helpers.reconcileArticleComposition(previous.articleComposition, previous.manuscript, output.manuscript, previous.placements);
          const validIds = new Set(output.manuscript.map((x) => x.id));
          const existing = new Map((previous.placements || []).filter((x) => !x.paragraphId || validIds.has(x.paragraphId)).map((x) => [x.slot, x]));
          output.placements = output.placements.map((x) => clone(existing.get(x.slot) || x));
          for (const x of existing.values()) if (!output.placements.some((p) => p.slot === x.slot)) output.placements.push(clone(x));
          if (old.status === "ready") output.articleComposition = old.composition;
          output.id = id2;
          output.createdAt = previous.createdAt;
          output.name = previous.name;
          output.outputRevision = (previous.outputRevision || 0) + 1;
        }
        proofNow = scopedProof(catalogue, captureValue, output);
        privateValue = { schema: "ar-create.native-output-private.v1", group: group(input), capture: captureValue, proof: proofNow };
        captureId = hash6(JSON.stringify(privateValue));
      } else {
        output = clone(selected.output);
        privateValue = selected.private;
        captureValue = validateCapture(privateValue, output);
        proofNow = scopedProof(catalogue, captureValue, output);
        if (!same2(proofNow, privateValue.proof)) fail8("Shared proof changed; existing output preserved.");
        if (lease && mapper.freshness(captureValue, lease.snapshot, proofNow.sources, proofNow.photos).stale) fail8("Article words changed; explicitly refresh its saved output.");
        if (action === "save") {
          const allowedChanges = textKind(output.kind) ? shortKind(output.kind) ? ["name"] : ["placements", "articleComposition", "name"] : ["slides", "caption", "name"];
          if (!input.changes || Object.keys(input.changes).some((k) => !allowedChanges.includes(k))) fail8("Article wording is immutable; only its native owner may edit it.");
          Object.assign(output, clone(input.changes));
          if (output.kind === "carousel") {
            if (typeof output.caption !== "string" || output.caption.length > 1e5) fail8("Exact readable carousel caption required.");
            if (!Array.isArray(output.slides) || !output.slides.length || output.slides.length > 100 || new Set(output.slides.map((s) => s.id)).size !== output.slides.length || output.slides.some((s) => Object.keys(s).some((k) => !["id", "role", "text", "credit", "label", "template", "photos", "paragraphIds", "typography", "pillar"].includes(k)) || "pillar" in s && !["", "\u4F73", "\u5BB6", "\u5609"].includes(s.pillar) || !uuid2.test(s.id || "") || typeof s.text !== "string" || typeof s.credit !== "string" || !["cover", "inner"].includes(s.role))) fail8("Exact independent carousel slides required.");
            for (const slide of output.slides) if (slide.typography !== void 0 && (!validateCarouselTypography(slide.typography) || Object.keys(slide.typography).sort().join(",") !== "fit,font,scale")) fail8("Use an existing supported carousel font, scale and fit.");
            if (!same2(words2(output), words2(selected.output))) {
              delete output.wordsReview;
              output.stage = "words";
            }
          }
        } else if (action === "review") {
          helpers.assertOutputEditorialReady(output);
          output.slides = output.slides.map((slide) => ({ ...slide, label: slide.label ?? output.importedDraft?.label ?? output.title ?? "" }));
          output.stage = "look";
          output.wordsReview = { hash: await helpers.carouselWordsHash(output), reviewedAt: (/* @__PURE__ */ new Date()).toISOString() };
        } else if (action === "undo") {
          const previous = privateRead(t, "history", input.undoOperationId)?.value;
          if (!previous || previous.outputId !== id2 || !same2(previous.group, group(input)) || previous.afterHash !== hash6(selected.output) || previous.captureId !== captureId || !previous.beforeArrangement) fail8("Arrangement undo no longer matches exact own output snapshot.");
          if (output.kind === "carousel") {
            const rows = previous.beforeArrangement.slides;
            if (!same2(rows.map((s) => s.id), output.slides.map((s) => s.id))) fail8("Carousel topology changed; arrangement Undo cannot rewrite words.");
            output.slides = output.slides.map((s, i) => {
              const restored2 = clone(s);
              for (const key of Object.keys(restored2)) if (!["text", "credit", "label", "role"].includes(key)) delete restored2[key];
              return { ...restored2, ...clone(rows[i]) };
            });
            output.name = previous.beforeArrangement.name;
          } else {
            for (const key of ["placements", "articleComposition", "name"]) delete output[key];
            Object.assign(output, clone(previous.beforeArrangement));
          }
          const restored = scopedProof(catalogue, captureValue, output);
          if (!same2(restored.assets, previous.beforeAssets)) fail8("Previous arrangement used photos changed; Undo held.");
        }
        output.outputRevision = (output.outputRevision || 0) + 1;
        proofNow = scopedProof(catalogue, captureValue, output);
        privateValue = { ...clone(privateValue), proof: proofNow };
        captureId = hash6(JSON.stringify(privateValue));
      }
      if (shortKind(output.kind) && (output.placements?.length || output.articleComposition)) fail8("Short outputs support text content only.");
      if (output.name !== void 0 && (typeof output.name !== "string" || output.name.length > 256)) fail8("Output name must be readable text.");
      resetVisual(output);
      placements(output, proofNow);
      const outputs = selected ? doc.outputs.map((o) => o.id === id2 ? output : o) : doc.outputs.concat(output), now = (/* @__PURE__ */ new Date()).toISOString(), owner = textKind(output.kind) ? { kind: "native", bindingId: binding, parentStudyId: input.parentStudyId } : { kind: "carousel-words", projectId: t.projectId, documentId: t.documentId, outputId: id2 };
      const index = doc.nativeOutputIndex || { schema: "ar-create.native-output-index.v1", revision: 0, records: [] };
      const nextRecord = { outputId: id2, wordOwner: owner, captureId, proofId: captureId, historyIds: [...selected?.record.historyIds || [], input.operationId], createdAt: selected?.record.createdAt || now, updatedAt: now };
      const history = { schema: "ar-create.native-output-command.v1", provenance: provenance(), group: group(input), commandHash, outputId: id2, captureId, beforeArrangement: selected ? arrangement(selected.output) : null, beforeAssets: selected?.private.proof.assets ?? null, afterHash: hash6(output) };
      const extraFiles = [{ relativePath: privatePath(t, "history", input.operationId), contents: JSON.stringify(history), expectedHash: null }];
      if (action === "create" || action === "refresh" || captureId !== selected.record.captureId) extraFiles.push({ relativePath: privatePath(t, "captures", captureId), contents: JSON.stringify(privateValue), expectedHash: privateRead(t, "captures", captureId)?.hash ?? null });
      return { outputs, nativeOutputIndex: { schema: index.schema, revision: input.expectedOutput.revision + 1, records: selected ? index.records.map((r) => r.outputId === id2 ? nextRecord : r) : index.records.concat(nextRecord) }, extraFiles, finalCheck: async () => {
        if (reviewedWords && !same2((await readCarouselWords({ documentId: t.documentId, outputId: id2 })).expected, reviewedWords.expected)) fail8("Own carousel words changed before review publication.");
        if (!same2(await currentProof(input, id2, captureValue, output), proofNow)) fail8("Source proof changed during output publication.");
        if (lease) {
          const s = lease.reread();
          if (!same2(s.expected, lease.snapshot.expected) || mapper.freshness(captureValue, s, proofNow.sources, proofNow.photos).stale) fail8("Own native snapshot changed before output publication.");
        }
      } };
    });
    const result = snapshot2 ? await native.withSnapshotLease({ bindingId: binding, parentStudyId: input.parentStudyId, expected: snapshot2.expected }, run) : await run(null);
    return { ...result, view: await read({ ...group(input), selectedOutputId: selected?.output.id || input.operationId }) };
  }
  async function withExportSnapshot(input, fn) {
    if (typeof fn !== "function") fail8("Trusted export publication callback required.");
    const t = await target(input);
    t.input = input;
    const selected = record(t, input.selectedOutputId);
    if (!same2(input.expectedOutput, outputRecordsExpected(t.document))) fail8("Exact current output export revision/hash required.");
    const capturedProof = await currentProof(input, selected.output.id, selected.private.capture, selected.output);
    if (!same2(capturedProof, selected.private.proof)) fail8("Shared proof changed; export held.");
    const captureValue = validateCapture(selected.private, selected.output);
    helpers.assertOutputEditorialReady(selected.output);
    placements(selected.output, capturedProof);
    if (textKind(selected.output.kind) && captureValue.privateSidecar.photoRequests.some((p) => !selected.output.placements.some((row) => row.slot === p.slot && row.url))) fail8("Native photo layout still has unresolved owned source slots; export held.");
    const run = async (lease) => {
      if (lease && mapper.freshness(captureValue, lease.snapshot, capturedProof.sources, capturedProof.photos).stale) fail8("This article native wording or source proof changed; export held.");
      if (!lease) await store.readCarouselWords({ projectId: t.projectId, documentId: t.documentId, outputId: selected.output.id });
      let active = true;
      const finalCheck = async ({ readArticle, readCarouselWords } = {}) => {
        if (!active) fail8("Export snapshot lease ended.");
        const now = readArticle ? await readArticle({ projectId: t.projectId }) : await target(input);
        if (now.document.id !== t.documentId || !same2(outputRecordsExpected(now.document), input.expectedOutput)) fail8("Output changed before export publication.");
        if (!same2(await currentProof(input, selected.output.id, captureValue, selected.output), capturedProof)) fail8("Shared source proof changed before export publication.");
        if (lease && mapper.freshness(captureValue, lease.reread(), capturedProof.sources, capturedProof.photos).stale) fail8("Own native snapshot changed before export publication.");
        if (!lease) await (readCarouselWords || store.readCarouselWords)({ projectId: t.projectId, documentId: t.documentId, outputId: selected.output.id });
      };
      try {
        await finalCheck();
        return await fn({ projectId: t.projectId, documentId: t.documentId, output: clone(selected.output), wordOwner: clone(selected.record.wordOwner), expectedOutput: clone(input.expectedOutput), assetProof: clone(capturedProof.assets), sourceProofHash: hash6(capturedProof), finalCheck });
      } finally {
        active = false;
      }
    };
    return textKind(selected.output.kind) ? native.withSnapshotLease({ bindingId: selected.record.wordOwner.bindingId, parentStudyId: input.parentStudyId, expected: input.expectedNative }, run) : run(null);
  }
  return { read, create: (i) => mutate("create", i), save: (i) => mutate("save", i), reviewCarouselWords: (i) => mutate("review", i), refreshSelectedArticle: (i) => mutate("refresh", i), undo: (i) => mutate("undo", i), withExportSnapshot, assertExport: (i) => withExportSnapshot(i, async ({ output, wordOwner, expectedOutput }) => ({ output, wordOwner, expectedOutput })) };
}

// src/donors/wordforge/wf-block-markdown.ts
import { fromMarkdown as fromMarkdown4 } from "mdast-util-from-markdown";
import { Extension as Extension2 } from "@tiptap/core";
import StarterKit2 from "@tiptap/starter-kit";
function separatorBefore2(node, previous) {
  if (!previous?.position || !node.position) return "blank";
  return node.position.start.line === previous.position.end.line + 1 ? "line" : "blank";
}
function delimiterAt2(source, node, fallback) {
  const offset = node.position?.start.offset;
  if (typeof offset !== "number") return fallback;
  const two = source.slice(offset, offset + 2);
  if (two === "**" || two === "__") return two;
  const one = source[offset];
  return one === "*" || one === "_" ? one : fallback;
}
function inlineChildren2(nodes, source, marks = []) {
  const out = [];
  const text4 = (value, extra = []) => {
    const all = [...marks, ...extra].map((mark) => ({ type: mark.type, attrs: { ...mark.attrs } }));
    value.split("\n").forEach((piece, index) => {
      if (index > 0) out.push({ type: "hardBreak" });
      if (piece) out.push(all.length ? { type: "text", text: piece, marks: all } : { type: "text", text: piece });
    });
  };
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        text4(node.value);
        break;
      case "strong":
        out.push(...inlineChildren2(node.children, source, [...marks, { type: "bold", attrs: { markup: delimiterAt2(source, node, "**") } }]));
        break;
      case "emphasis":
        out.push(...inlineChildren2(node.children, source, [...marks, { type: "italic", attrs: { markup: delimiterAt2(source, node, "_") } }]));
        break;
      case "inlineCode":
        text4(node.value, [{ type: "code", attrs: {} }]);
        break;
      case "link": {
        if (!safePassageHref(node.url)) throw new Error("The draft contains an unsafe citation URL. Review that link before importing.");
        const labelEnd = node.children.at(-1)?.position?.end.offset, end = node.position?.end.offset;
        const destination = typeof labelEnd === "number" && typeof end === "number" ? source.slice(labelEnd, end) : null;
        out.push(...inlineChildren2(node.children, source, [...marks, { type: "link", attrs: { href: node.url, title: node.title ?? null, markdownDestination: destination } }]));
        break;
      }
      case "break":
        out.push({ type: "hardBreak" });
        break;
      default:
        if ("value" in node && typeof node.value === "string") text4(node.value);
        else if ("children" in node) out.push(...inlineChildren2(node.children, source, marks));
    }
  }
  return out;
}
function blockChildren2(nodes, source) {
  const out = [];
  let previous = null;
  for (const node of nodes) {
    const sep = separatorBefore2(node, previous);
    switch (node.type) {
      case "paragraph": {
        const content = inlineChildren2(node.children, source);
        out.push(content.length ? { type: "paragraph", attrs: { sep }, content } : { type: "paragraph", attrs: { sep } });
        break;
      }
      case "heading": {
        const content = inlineChildren2(node.children, source);
        out.push(content.length ? { type: "heading", attrs: { sep, level: node.depth }, content } : { type: "heading", attrs: { sep, level: node.depth } });
        break;
      }
      case "list": {
        const items = node.children.map((item) => {
          const content = blockChildren2(item.children, source);
          return content.length ? { type: "listItem", content } : { type: "listItem", content: [{ type: "paragraph" }] };
        });
        out.push(node.ordered ? { type: "orderedList", attrs: { sep, tight: !node.spread, start: node.start ?? 1 }, content: items } : { type: "bulletList", attrs: { sep, tight: !node.spread }, content: items });
        break;
      }
      case "blockquote":
        out.push({ type: "blockquote", attrs: { sep }, content: blockChildren2(node.children, source) });
        break;
      default:
        if ("children" in node) out.push({ type: "paragraph", attrs: { sep }, content: inlineChildren2(node.children, source) });
        else if ("value" in node && typeof node.value === "string") out.push({ type: "paragraph", attrs: { sep }, content: [{ type: "text", text: node.value }] });
    }
    previous = node;
  }
  return out;
}
function markdownToDoc2(text4, options = {}) {
  const content = blockChildren2(fromMarkdown4(text4, options.links ? LINK_PARSE_OPTIONS : PARSE_OPTIONS).children, text4);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph", attrs: { sep: "blank" } }] };
}
var PassageMarkdownAttributes2 = Extension2.create({
  name: "passageMarkdownAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList", "blockquote"],
        attributes: { sep: { default: null, rendered: false } }
      },
      {
        types: ["bulletList", "orderedList"],
        attributes: { tight: { default: true, rendered: false } }
      },
      { types: ["link"], attributes: { markdownDestination: { default: null, rendered: false } } },
      {
        types: ["bold", "italic"],
        attributes: { markup: { default: null, rendered: false } }
      }
    ];
  }
});

// public/lib/guidance-body.js
var requestBody2 = (value) => String(value || "").replace(/^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
function guidanceRegions2(raw) {
  raw = String(raw || "");
  const prefix = raw.slice(0, raw.length - requestBody2(raw).length);
  const body = raw.slice(prefix.length), pending = new Uint8Array(body.length);
  const markers = /<!--\s*VOICE-QUEUE-START\s*-->[\s\S]*?(?:<!--\s*VOICE-QUEUE-END\s*-->|$)|<!--\s*VOICE-QUEUE-END\s*-->/gi;
  for (const match of body.matchAll(markers)) pending.fill(1, match.index, match.index + match[0].length);
  const offsets = [], visible = [];
  for (let index = 0; index < body.length; index++) if (!pending[index]) {
    offsets.push(index);
    visible.push(body[index]);
  }
  let cursor = 0, queueLevel = null, fence = null;
  for (const match of visible.join("").matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
    const line = match[0].replace(/\r?\n$/, "");
    const boundary = line.match(/^ {0,3}(`{3,}|~{3,})/);
    const heading = !fence && line.match(/^ {0,3}(#{1,6})[ \t]+(.+)$/);
    if (queueLevel !== null && heading && heading[1].length <= queueLevel) queueLevel = null;
    if (heading && /^Strengthenings[ \t]+queue\b/i.test(heading[2])) queueLevel = heading[1].length;
    if (queueLevel !== null) for (let index = cursor; index < cursor + match[0].length; index++) pending[offsets[index]] = 1;
    if (boundary) {
      if (!fence) fence = boundary[1];
      else if (boundary[1][0] === fence[0] && boundary[1].length >= fence.length) fence = null;
    }
    cursor += match[0].length;
  }
  const regions = [];
  for (let start = 0; start < body.length; ) {
    let end = start + 1;
    while (end < body.length && pending[end] === pending[start]) end++;
    regions.push({ raw: body.slice(start, end), pending: !!pending[start] });
    start = end;
  }
  if (!regions.length || regions[0].pending) regions.unshift({ raw: "", pending: false });
  return { prefix, regions };
}

// src/donors/mag/markdown-blocks.ts
function splitBlocks3(md) {
  const fm = (md.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/) || [""])[0];
  return { fm, parts: md.slice(fm.length).split(/(\r?\n\s*\r?\n)/) };
}
var protectedMarks3 = /%%[\s\S]*?%%|<!--[\s\S]*?-->/g;
function plain3(raw) {
  return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "/$1/").replace(/\s*%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/^>\s?/gm, "").replace(/^#{1,6}\s+/, "").replace(/==([\s\S]*?)==/g, "$1").replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1").replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}
function editable3(raw) {
  const t = raw.trim();
  if (!t || t === "---" || /^%%[\s\S]*%%$/.test(t) || /^<!--[\s\S]*-->$/.test(t) || /^\|/.test(t) || /^```/.test(t) || /^~~~/.test(t)) return false;
  if (/^[-*] /m.test(t) && t.split("\n").every((line) => /^\s*([-*] |\d+\. )/.test(line) || /^\s+/.test(line))) return false;
  if (/^\d+[.)] /m.test(t)) return false;
  if (/^\*\*[^*]+:\*\*\s*$/m.test(t.split("\n")[0])) return false;
  return true;
}
function documentParts2(raw, protectGuidanceQueue = true) {
  const projection3 = protectGuidanceQueue ? guidanceRegions2(raw) : { prefix: splitBlocks3(raw).fm, regions: [{ raw: raw.slice(splitBlocks3(raw).fm.length), pending: false }] };
  const parts = [], blocks = [], separators = /* @__PURE__ */ new Set();
  for (const region of projection3.regions) {
    if (region.pending) {
      parts.push(region.raw);
      continue;
    }
    const chunk = region.raw.split(/(\r?\n\s*\r?\n)/);
    for (let index = 0; index < chunk.length; index++) {
      const partIndex = parts.length, part2 = chunk[index];
      parts.push(part2);
      if (index % 2) separators.add(partIndex);
      else blocks.push({ index: blocks.length, partIndex, raw: part2, plain: plain3(part2), editable: editable3(part2) });
    }
  }
  if (!blocks.some((block2) => block2.raw.trim()) && blocks[0]) blocks[0].editable = true;
  return { prefix: projection3.prefix, suffix: "", parts, blocks, separators };
}
function readableBlock2(raw) {
  return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "/$1/").replace(protectedMarks3, "").replace(/==([\s\S]*?)==/g, "**$1**").replace(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g, "$2");
}

// src/workspaces/articleComposition.ts
var empty = () => ({ schema: ARTICLE_COMPOSITION_SCHEMA, form: "story", opening: [], parts: [], ending: { blocks: [] } });
var textOf = (node) => node.type === "text" ? node.text || "" : node.type === "hardBreak" ? "\n" : node.type === "referenceCard" ? `Reference \xB7 ${node.attrs?.sourceTitle || "Source"} ${node.attrs?.text || ""}` : (node.content || []).map(textOf).join(node.type === "doc" ? "\n" : "");
var acceptedText = (p) => textOf(p.doc);
var role2 = (p) => {
  const node = p.doc.content?.[0], text4 = acceptedText(p).trim();
  if (p.doc.content?.length === 1 && /^[“"][\s\S]*[”"]$/.test(text4)) {
    const leaves = node?.content?.filter((n) => n.type === "text") || [];
    return node?.type === "paragraph" && leaves.length > 0 && leaves.every((n) => n.marks?.some((m) => m.type === "italic")) ? "q" : "a";
  }
  return "n";
};
function inferArticleComposition(paragraphs) {
  const layout = empty();
  let target = layout.opening;
  for (const p of paragraphs) {
    if (p.doc.content?.length === 1 && p.doc.content[0].type === "heading") {
      const part2 = { titleId: p.id, blocks: [] };
      layout.parts.push(part2);
      target = part2.blocks;
    } else target.push({ kind: role2(p), paragraphId: p.id });
  }
  return layout;
}
function reconcileArticleComposition(layout, previous, next, placements) {
  const composition = structuredClone(layout);
  if (JSON.stringify(previous.map((p) => p.id)) !== JSON.stringify(next.map((p) => p.id))) return { status: "stale", composition, reason: "Passages were added, removed or reordered. Review a new article layout; the previous output retains its layout." };
  const issue = articleCompositionIssue(composition, next, placements);
  return issue ? { status: "stale", composition, reason: issue + " Review a new article layout; the previous output retains its layout." } : { status: "ready", composition };
}
function captureArticleComposition(paragraphs, raw) {
  if (raw === void 0) return { composition: inferArticleComposition(paragraphs), placements: [], photoRequests: [] };
  const model = documentParts2(raw, false);
  const header = (s) => !s.trim() || /^#\s/.test(s.trim()) || /^\*\*(?:Conversations over Tea|Story Subject|Interview by|Interview Date|Photography, Words, Translation|Location|By|Published)\b/.test(s.trim());
  const preambleEnd = model.blocks.findIndex((b) => b.raw.trim() === "---");
  let first = 0;
  while (first < model.blocks.length && header(model.blocks[first].raw)) first++;
  const chunks = (preambleEnd >= 0 && model.blocks.slice(0, preambleEnd).every((b) => header(b.raw)) ? model.blocks.slice(preambleEnd + 1) : model.blocks.slice(first)).map((b) => b.raw.trim()).filter(Boolean);
  const layout = empty(), placements = [], photoRequests = [];
  let cursor = 0, where = "opening";
  const stack = [];
  let pendingFollow;
  const target = () => stack.at(-1)?.blocks || (where === "opening" ? layout.opening : where === "parts" ? layout.parts.at(-1).blocks : layout.ending.blocks);
  const fail10 = (message) => {
    throw new Error("Article layout: " + message);
  };
  const readable2 = (chunk) => readableBlock2(chunk.replaceAll("==", "\0approval\0")).replaceAll("\0approval\0", "==").trim();
  const consume = (chunk) => {
    const text4 = readable2(chunk), p = paragraphs[cursor++];
    if (!p || JSON.stringify(markdownToDoc2(text4, { links: true })) !== JSON.stringify(p.doc)) fail10("the DEV receipt no longer matches the accepted paragraphs. Capture layout when accepting the draft.");
    return p;
  };
  const photoNote = (text4) => {
    const [file, alt = "", ...rest] = text4.split(" \xB7 "), words3 = [], opts = {};
    for (const word of rest.join(" \xB7 ").split(/\s+/).filter(Boolean)) {
      const pair = word.match(/^(\w+)=(.+)$/);
      if (pair) opts[pair[1]] = pair[2];
      else if (/^\d+\/\d+$/.test(word)) opts.aspect = word;
      else words3.push(word);
    }
    return { file: file.trim(), alt: alt.trim(), words: words3, opts };
  };
  const photo = (note2, cover = false) => {
    const slot = cover ? "cover" : "article-photo-" + (placements.filter((p) => p.slot !== "cover").length + 1);
    if (placements.some((p) => p.slot === slot)) fail10("a cover photo is repeated.");
    const focal = (v) => v === void 0 ? 0.5 : Number(v);
    const x = focal(note2.opts.x), y = focal(note2.opts.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) fail10("a photo focal point must be between zero and one.");
    placements.push({ slot, url: "", x, y, zoom: 1, alt: note2.alt, paragraphId: null });
    photoRequests.push({ slot, file: note2.file });
    return slot;
  };
  const note = (chunk, tag) => chunk.match(new RegExp(`^%%${tag}:\\s*([^%]*)%%`))?.[1]?.trim();
  const wordsBlock = (p) => ({ kind: role2(p), paragraphId: p.id });
  for (const chunk of chunks) {
    if (chunk === "---") continue;
    if (chunk === "%%ending%%") {
      if (stack.length) fail10("close the side or glyph before ending.");
      where = "ending";
      pendingFollow = void 0;
      continue;
    }
    if (chunk === "%%/side%%" || chunk === "%%/glyph%%") {
      if (stack.at(-1)?.kind !== (chunk === "%%/side%%" ? "side" : "glyph")) fail10("a side or glyph closing note does not match its frame.");
      stack.pop();
      continue;
    }
    const shown = readable2(chunk);
    if (/^## /.test(shown)) {
      if (stack.length || where === "ending" || where === "closing") fail10("a chapter heading is out of order.");
      const p2 = consume(chunk);
      layout.parts.push({ titleId: p2.id, blocks: [] });
      where = "parts";
      pendingFollow = void 0;
      continue;
    }
    let n;
    if ((n = note(chunk, "photo")) !== void 0) {
      const p2 = photoNote(n), slot = photo(p2, p2.words.includes("cover"));
      if (p2.words.includes("cover")) layout.portraitSlot = slot;
      else if (p2.words.includes("opener")) {
        const part2 = layout.parts.at(-1);
        if (where !== "parts" || !part2 || part2.blocks.length || part2.openerSlot || stack.length) fail10("an opener belongs directly after a chapter heading.");
        part2.openerSlot = slot;
      } else if (p2.words.includes("bleed")) target().push({ kind: "bleed", slot });
      else target().push({ kind: "wide", slot, ...p2.opts.aspect ? { aspect: p2.opts.aspect } : {}, ...p2.words.includes("narrow") ? { narrow: true } : {}, ...p2.words.includes("left") ? { offset: "left" } : p2.words.includes("right") ? { offset: "right" } : {} });
      if (shown) fail10("a photo note must be separate from prose.");
      continue;
    }
    if ((n = note(chunk, "photos")) !== void 0) {
      const notes = n.split(" | ").map(photoNote), last = notes.at(-1);
      target().push({ kind: "photos", slots: notes.map((p2) => photo(p2)), ...last.opts.aspect ? { aspect: last.opts.aspect } : {}, ...last.words.includes("stagger") ? { stagger: true } : {}, ...last.words.includes("narrow") ? { narrow: true } : {} });
      if (shown) fail10("a photo pair note must be separate from prose.");
      continue;
    }
    if ((n = note(chunk, "side")) !== void 0) {
      const p2 = photoNote(n), b = { kind: "side", slot: photo(p2), blocks: [], ...p2.words.includes("flip") ? { flip: true } : {}, ...p2.words.includes("bleed") ? { bleed: true } : {} };
      target().push(b);
      stack.push(b);
      if (shown) fail10("a side note must precede its prose.");
      continue;
    }
    if ((n = note(chunk, "glyph")) !== void 0) {
      const b = { kind: "glyph", glyph: n, blocks: [] };
      target().push(b);
      stack.push(b);
      if (shown) fail10("a glyph note must precede its prose.");
      continue;
    }
    if ((n = note(chunk, "pull")) !== void 0) {
      const p2 = consume(chunk), [size, ...options] = n.split(/\s+/);
      if (size === "hook") {
        if (layout.hookId) fail10("the hook is repeated.");
        layout.hookId = p2.id;
        continue;
      }
      if (!["xl", "l", "m"].includes(size)) fail10("a pull size must be xl, l or m.");
      const b = { kind: "line", paragraphId: p2.id, size };
      target().push(b);
      pendingFollow = options.includes("follow") ? b : void 0;
      continue;
    }
    if ((n = note(chunk, "on-photo")) !== void 0) {
      const note2 = photoNote(n), p2 = consume(chunk);
      target().push({ kind: "on-photo", paragraphId: p2.id, slot: photo(note2), aspect: note2.opts.aspect, ink: note2.opts.ink, accent: note2.opts.accent });
      continue;
    }
    if (/^%%saying:?\s*%%/.test(chunk) || (n = note(chunk, "saying")) !== void 0) {
      if (where !== "ending" || stack.length || layout.ending.sayingId) fail10("the saying belongs once after ending.");
      layout.ending.sayingId = consume(chunk).id;
      if (n !== void 0) {
        const p2 = photoNote(n);
        layout.ending.photoSlot = photo(p2);
        layout.ending.aspect = p2.opts.aspect;
      }
      where = "closing";
      continue;
    }
    if (!shown) continue;
    const p = consume(chunk);
    if (where === "closing") {
      if (layout.closingId) fail10("the closing has more than one paragraph.");
      layout.closingId = p.id;
      continue;
    }
    if (pendingFollow && role2(p) === "a") {
      pendingFollow.followId = p.id;
      pendingFollow = void 0;
      continue;
    }
    pendingFollow = void 0;
    if (where === "opening" && !layout.introId && !layout.opening.length && !stack.length && role2(p) === "n") layout.introId = p.id;
    else target().push(wordsBlock(p));
  }
  if (stack.length) fail10("a side or glyph frame was not closed.");
  if (cursor !== paragraphs.length) fail10("the DEV receipt omits accepted paragraphs.");
  validateArticleComposition(layout, paragraphs, placements);
  return { composition: layout, placements, photoRequests };
}

// src/workspaces/document.ts
var uid = () => crypto.randomUUID();
function plainText(doc) {
  if (doc.type === "text") return doc.text || "";
  if (doc.type === "hardBreak") return "\n";
  return (doc.content || []).map(plainText).join(["doc", "bulletList", "orderedList"].includes(doc.type || "") ? "\n" : "");
}
function snapshotOutput(doc) {
  const output = { id: uid(), kind: "article", manuscriptRevision: doc.revision, placements: [], createdAt: (/* @__PURE__ */ new Date()).toISOString(), manuscript: structuredClone(doc.paragraphs.map(({ proposal, ...accepted }) => accepted)), title: doc.title };
  if (doc.importedDraft?.raw) {
    try {
      const captured = captureArticleComposition(output.manuscript, doc.importedDraft.raw);
      output.articleComposition = captured.composition;
      output.placements = captured.placements;
    } catch {
      output.articleCompositionNotice = "The writing changed since its original layout. This preview uses your current words; review its visual arrangement.";
    }
  }
  return output;
}
function snapshotCarousel(doc) {
  const base = snapshotOutput(doc);
  const slides = [{ id: uid(), role: "cover", text: doc.title || "Untitled piece", credit: "", template: "H6", photos: [], paragraphIds: [] }];
  for (const p of base.manuscript || []) {
    const text4 = plainText(p.doc);
    if (text4.trim()) slides.push({ id: uid(), role: "inner", text: text4, credit: p.attributions.map((a) => a.author || a.sourceTitle).filter((v, i, a) => a.indexOf(v) === i).join(" \xB7 "), template: "M12", photos: [], paragraphIds: [p.id] });
  }
  const { articleComposition, articleCompositionNotice, ...carouselBase } = base;
  return { ...carouselBase, placements: [], kind: "carousel", outputRevision: 0, slides, caption: "", stage: "words" };
}

// src/workspaces/editorial-state.mjs
var protectedEditorial2 = /%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`/g;
var personalNoteQuestions = (raw) => [...String(raw || "").matchAll(/%%\s*you\s*:\s*([\s\S]*?)%%/gi)].map((match) => match[1].trim().replace(/\s+/g, " ")).filter(Boolean);
function approvalMarks2(raw) {
  const text4 = String(raw || "").replace(protectedEditorial2, "");
  const pairs = [...text4.matchAll(/==(?=\S)([\s\S]*?\S)==/g)].length, remaining = text4.replace(/==(?=\S)([\s\S]*?\S)==/g, "");
  const incomplete = [...remaining.matchAll(/(?:^|\n|\s)==(?=\S)|(?<=\S)==(?=$|\n)/g)].length;
  return { pairs, tokens: pairs * 2 + incomplete };
}
function nodeText(node) {
  if (!node || node.type === "codeBlock") return "";
  if (node.type === "text") return node.marks?.some((mark) => mark.type === "code") ? "" : node.text || "";
  if (node.type === "referenceCard") return [node.attrs?.sourceTitle, node.attrs?.author, node.attrs?.text].filter(Boolean).join("\n");
  return [node.type === "blockquoteAttributed" ? node.attrs?.author || node.attrs?.sourceTitle : "", ...(node.content || []).map(nodeText)].join(node.type === "doc" ? "\n" : "");
}
function outputEditorialIssues(output, fallback = {}) {
  const words3 = output?.kind === "carousel" ? [output.title || fallback.title || "", output.caption || "", ...(output.slides || []).flatMap((slide) => [slide.text || "", slide.label ?? output.importedDraft?.label ?? output.title ?? fallback.title ?? "", slide.credit || ""])] : [output?.title || fallback.title || "", ...(output?.manuscript || fallback.paragraphs || []).flatMap((paragraph) => [nodeText(paragraph.doc), ...(paragraph.attributions || []).flatMap((source) => [source.sourceTitle || "", source.author || "", typeof source.locator === "string" ? source.locator : source.locator?.path || source.locator?.page || source.locator?.lineStart || ""])]), ...(output?.placements || []).flatMap((photo) => [photo.caption || "", photo.alt || ""])];
  return words3.reduce((issues, word) => ({ approvalTokens: issues.approvalTokens + approvalMarks2(word).tokens, personalNotes: issues.personalNotes + personalNoteQuestions(word).length }), { approvalTokens: 0, personalNotes: 0 });
}
function assertOutputEditorialReady(output, fallback) {
  const issues = outputEditorialIssues(output, fallback);
  if (issues.approvalTokens) throw Error("Approve or remove marked prose (==\u2026==) in Writing content before arranging visuals or exporting a public file.");
  if (issues.personalNotes) throw Error("Remove editorial %%you%% notes from the visible wording before arranging or exporting. Personal contribution is optional; you can skip it.");
  return true;
}

// services/native-output-seam.ts
var stable6 = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
var same3 = (a, b) => stable6(a) === stable6(b);
var fail9 = (message) => {
  throw Error(message);
};
var HASH = /^[a-f0-9]{64}$/;
var freeze = (v) => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
};
var text3 = (v, label) => typeof v === "string" && v.isWellFormed() && v.trim() ? v : fail9(label + " requires exact readable text.");
var privateNoteRoles = { source: "source-provenance-note", sources: "source-provenance-summary", heard: "transcription-correction-note" };
var knownLayout = /* @__PURE__ */ new Set(["photo", "photos", "side", "/side", "glyph", "/glyph", "pull", "on-photo", "saying", "ending"]);
var unsafeMarkdown = (s) => /(^|\n)[ \t]*(?:`{3,}|~{3,}|\|.*\|)|<\/?[A-Za-z!][^>]*>|!\[[^\]\n]*\]\s*(?:\(|\[)|~~/.test(s);
var credits = /^\*\*(?:Conversations over Tea|Story Subject|Interview by|Interview Date|Photography, Words, Translation|Location|By|Published)\b/;
var supportedTree = (n) => {
  const nodes = { doc: [], paragraph: ["sep"], heading: ["sep", "level"], blockquote: ["sep"], bulletList: ["sep", "tight"], orderedList: ["sep", "tight", "start"], listItem: [], text: [], hardBreak: [] };
  if (!nodes[n?.type] || Object.keys(n).some((k) => !["type", "attrs", "content", "text", "marks"].includes(k)) || Object.keys(n.attrs || {}).some((k) => !nodes[n.type].includes(k))) return false;
  if (n.type === "heading" && ![1, 2, 3].includes(n.attrs?.level)) return false;
  for (const mark of n.marks || []) if (!["bold", "italic", "code", "link"].includes(mark.type) || Object.keys(mark.attrs || {}).some((k) => !["markup", "href", "title", "markdownDestination"].includes(k))) return false;
  return (n.content || []).every(supportedTree);
};
function sources(snapshot2) {
  return (snapshot2.context?.records || []).filter((r) => r.role !== "draft").map((r) => {
    const hash8 = r.copiedHash ?? r.hash ?? null;
    if (!r.missing && (typeof r.raw !== "string" || !HASH.test(hash8 || "") || digest2(r.raw) !== hash8)) fail9("Native retained source capture hash changed.");
    return { id: r.id, role: r.role, sourcePath: r.sourcePath ?? r.path ?? null, hash: hash8, missing: !!r.missing };
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
function validate(snapshot2, emptyBoundaries = false) {
  if (snapshot2.binding?.authority !== "owned-working-copy" || snapshot2.binding.status !== "ready" || snapshot2.readiness?.ready !== true) fail9("A ready exact owned native snapshot is required.");
  if (Buffer.byteLength(snapshot2.raw || "") > 2 * 1024 * 1024) fail9("Native capture exceeds the existing two-megabyte document bound.");
  text3(snapshot2.binding.id, "Native binding");
  text3(snapshot2.binding.parentStudyId, "Native parent");
  text3(snapshot2.raw, "Native raw");
  if (snapshot2.expected?.workflow?.draft !== digest2(snapshot2.raw) || !Array.isArray(snapshot2.projection)) fail9("Native expected raw hash or projection changed.");
  const model = capture(snapshot2.raw, "native-output-probe");
  const modelRows = emptyBoundaries ? model.blocks.filter((b) => b.raw.trim()) : model.blocks, projectionRows = emptyBoundaries ? snapshot2.projection.filter((b) => b.raw.trim()) : snapshot2.projection;
  if (render(model) !== snapshot2.raw || modelRows.length !== projectionRows.length) fail9("Native donor topology or exact raw bytes changed.");
  const ids = /* @__PURE__ */ new Set();
  for (const row of snapshot2.projection) {
    if (!row.id || ids.has(row.id) || (row.raw.trim() || !emptyBoundaries) && row.raw !== modelRows[projectionRows.indexOf(row)]?.raw || row.blockHash !== digest2(row.raw)) fail9("Native paragraph identity/raw/block hash changed.");
    ids.add(row.id);
    const mapped = inlineMap(row.raw);
    for (const key of ["safe", "words", "doc", "blockKind", "level", "notes"]) if (!same3(row[key], mapped[key])) fail9("Native projection differs from its authoritative donor mapping.");
  }
  return sources(snapshot2);
}
function captureNativeOutput(snapshot2, scope, options = {}) {
  if (options.outputKind !== void 0 && !["post", "product-listing"].includes(options.outputKind)) fail9("Unsupported text output kind.");
  const sourceProof = validate(snapshot2, !!options.outputKind);
  for (const key of ["projectId", "documentId", "outputId"]) text3(scope[key], key);
  const photoBindings = structuredClone(options.photoBindings || []);
  if (!Array.isArray(photoBindings) || photoBindings.length > 200) fail9("Explicit bounded original-file to Library photo bindings required.");
  const photoNames = /* @__PURE__ */ new Set();
  for (const row of photoBindings) {
    if (Object.keys(row).some((k) => !["nativeFile", "sourceId", "sourceHash"].includes(k)) || !row.nativeFile || !row.sourceId || !HASH.test(row.sourceHash) || photoNames.has(row.nativeFile)) fail9("Photo binding identity/hash must be explicit and unique.");
    photoNames.add(row.nativeFile);
  }
  const original = structuredClone(snapshot2), paragraphs = [], mapping = [], held = [];
  const blocks = documentParts2(snapshot2.raw, false).blocks, header = (raw) => !raw.trim() || /^#\s/.test(raw.trim()) || credits.test(raw.trim());
  const boundary = blocks.findIndex((b) => b.raw.trim() === "---");
  let first = 0;
  while (first < blocks.length && header(blocks[first].raw)) first++;
  const storyStart = options.outputKind ? 0 : boundary >= 0 && blocks.slice(0, boundary).every((b) => header(b.raw)) ? boundary + 1 : first;
  for (const [index, row] of snapshot2.projection.entries()) {
    const terms = [...row.raw.matchAll(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g)].map((m) => ({ id: m[1], label: m[2], raw: m[0] }));
    const hidden = [...row.raw.matchAll(/%%[\s\S]*?%%|<!--[\s\S]*?-->/g)].map((m) => ({ raw: m[0], from: m.index, to: m.index + m[0].length, role: privateNoteRoles[/^%%\s*(source|sources|heard)\s*:/i.exec(m[0])?.[1]?.toLowerCase() || ""] || "retained-native-note" }));
    const item = { nativeId: row.id, nativeBlockHash: row.blockHash, hidden, terms, protected: row.safe === false, disposition: "held" };
    mapping.push(item);
    if (index < storyStart || row.raw.trim() === "---") {
      item.disposition = "private-credit-title-separator-metadata";
      continue;
    }
    const directives = hidden.filter((note) => note.raw.startsWith("%%")).map((note) => ({ note, tag: /^%%\s*(\/?[a-z-]+)(?:\s*:|\s*%%)/i.exec(note.raw)?.[1] || null }));
    const unknown = directives.find(({ tag }) => tag && !knownLayout.has(tag) && !["you", "was", "note", "editorial", "comment", "source", "sources", "heard"].includes(tag.toLowerCase()));
    if (unknown) {
      held.push({ nativeId: row.id, category: "unknown-native-directive", token: unknown.tag, reason: "The existing Magazine layout codec has no semantic handler for this native directive." });
      continue;
    }
    const readable2 = readableBlock2(row.raw.replaceAll("==", "\0native-approval\0")).replaceAll("\0native-approval\0", "==").trim();
    if (!readable2) {
      item.disposition = directives.some(({ tag }) => knownLayout.has(tag)) ? "native-layout-directive" : "private-editorial-metadata";
      continue;
    }
    if (approvalMarks2(readable2).tokens) {
      held.push({ nativeId: row.id, category: "unresolved-native-approval", reason: "Existing /mag wholeDraft/editorial-state treats these == marks as unresolved approval; native.editable/safe is not an approval receipt." });
      continue;
    }
    if (unsafeMarkdown(readable2)) {
      held.push({ nativeId: row.id, category: "unsupported-rich-structure", reason: "Existing output Markdown grammar cannot faithfully represent this table/fence/raw HTML/image/strike block." });
      continue;
    }
    let doc, markdown;
    try {
      doc = markdownToDoc2(readable2, { links: true });
      markdown = structuredMarkdown(doc);
    } catch (error) {
      held.push({ nativeId: row.id, category: "unsafe-link-or-rich-format", reason: error.message });
      continue;
    }
    if (!supportedTree(doc) || markdown !== readable2) {
      held.push({ nativeId: row.id, category: "nonlossless-markdown", reason: "Existing output Markdown bridge cannot roundtrip this protected native block exactly." });
      continue;
    }
    const paragraph = { id: row.id, doc: structuredClone(doc), text: markdown, attributions: [], kept: [], origin: "source" };
    paragraphs.push(paragraph);
    item.disposition = "immutable-output-passage";
    item.outputParagraphId = row.id;
    item.publishedWordsHash = digest2(plainText(doc));
    item.publishedMarkdownHash = digest2(markdown);
    item.transforms = [...hidden.length ? ["native-notes-retained-private-with-codec-layout-handlers"] : [], ...terms.length ? ["existing-mag-protected-term-display-label"] : [], ...row.safe === false ? ["protected-block-exact-markdown-roundtrip"] : []];
  }
  if (!options.outputKind && !paragraphs.length && !held.length) held.push({ nativeId: null, reason: "Native snapshot contains no supported publishable passage." });
  const document = { schema: "ar-create.document.v1", id: scope.documentId, revision: 0, title: text3(snapshot2.binding.title, "Native title"), paragraphs, outputs: [] };
  let output = null, photoRequests = [];
  if (!held.length) {
    try {
      if (options.outputKind) {
        output = { ...snapshotOutput(document), id: scope.outputId, kind: options.outputKind, placements: [] };
        assertOutputEditorialReady(output);
      } else {
        const composed = captureArticleComposition(paragraphs, snapshot2.raw);
        photoRequests = composed.photoRequests.map((request) => {
          const bound = photoBindings.find((p) => p.nativeFile === request.file);
          return { slot: request.slot, nativeFile: request.file, sourceId: bound?.sourceId || null, sourceHash: bound?.sourceHash || null, resolved: !!bound };
        });
        if (photoBindings.some((bound) => !photoRequests.some((request) => request.nativeFile === bound.nativeFile))) fail9("Explicit photo binding does not belong to this native layout.");
        output = { ...snapshotOutput(document), id: scope.outputId, articleComposition: composed.composition, placements: composed.placements.map((p) => {
          const request = photoRequests.find((row) => row.slot === p.slot);
          return request?.resolved ? { ...p, url: "/api/sources/blob?id=" + encodeURIComponent(request.sourceId) } : p;
        }) };
        assertOutputEditorialReady(output);
      }
    } catch (error) {
      held.push({ nativeId: null, category: "native-layout-codec-incompatibility", reason: error.message });
      output = null;
    }
  }
  const payload = { schema: "ar-create.native-output-probe.v1", role: "immutable-native-output-capture-not-a-second-editable-manuscript", scope: structuredClone(scope), ...options.outputKind ? { outputKind: options.outputKind } : {}, ready: !held.length, mediaReady: photoRequests.every((p) => p.resolved), held, nativeProof: { bindingId: snapshot2.binding.id, parentStudyId: snapshot2.binding.parentStudyId, expected: structuredClone(snapshot2.expected), rawHash: digest2(snapshot2.raw), sourceProof, photoProof: photoBindings, projectionHash: digest2(stable6(snapshot2.projection)) }, output, outputHash: output ? digest2(stable6(output)) : null, privateSidecar: { nativeSnapshot: original, mapping, photoBindings, photoRequests }, sourceIdentityPolicy: "Native source identities/protected term IDs retained privately; no paragraph source attribution or authorship inferred." };
  return freeze({ ...payload, captureHash: digest2(stable6(payload)) });
}
function nativeOutputRenderDocument(value) {
  if (!value.ready || !value.output) fail9("Native output capture is held; do not render a partial manuscript.");
  return freeze({ schema: "ar-create.document.v1", id: value.scope.documentId, revision: value.output.manuscriptRevision, title: value.output.title, paragraphs: value.output.manuscript, outputs: [value.output] });
}
function reopenNativeOutput(bytes4) {
  let value;
  try {
    value = JSON.parse(bytes4);
  } catch {
    fail9("Captured native output is malformed.");
  }
  ;
  const { captureHash, ...payload } = value;
  if (value.schema !== "ar-create.native-output-probe.v1" || captureHash !== digest2(stable6(payload)) || value.outputHash !== (value.output ? digest2(stable6(value.output)) : null)) fail9("Captured native output or sidecar integrity changed.");
  validate(value.privateSidecar.nativeSnapshot, !!value.outputKind);
  const derived = captureNativeOutput(value.privateSidecar.nativeSnapshot, value.scope, { photoBindings: value.privateSidecar.photoBindings, ...value.outputKind ? { outputKind: value.outputKind } : {} }), published = (o) => o ? { ...o, createdAt: void 0 } : null;
  if (!same3(value.nativeProof, derived.nativeProof) || !same3(value.privateSidecar.mapping, derived.privateSidecar.mapping) || !same3(published(value.output), published(derived.output)) || !same3(value.held, derived.held) || !same3(value.privateSidecar.photoRequests, derived.privateSidecar.photoRequests) || value.mediaReady !== derived.mediaReady || value.ready !== derived.ready) fail9("Output wording/structure does not match its exact native source capture.");
  return freeze(value);
}
function nativeOutputFreshness(value, current, currentSources, currentPhotos) {
  const captureValue = reopenNativeOutput(JSON.stringify(value));
  try {
    const proof = validate(current, !!captureValue.outputKind);
    if (captureValue.nativeProof.bindingId !== current.binding.id || captureValue.nativeProof.parentStudyId !== current.binding.parentStudyId || captureValue.nativeProof.rawHash !== digest2(current.raw) || !same3(captureValue.nativeProof.expected, current.expected) || captureValue.nativeProof.projectionHash !== digest2(stable6(current.projection))) return { stale: true, reason: "Exact native revision/paragraph identity changed; output retained, no native rewrite." };
    if (!same3(captureValue.nativeProof.sourceProof, proof)) return { stale: true, reason: "Native retained source capture changed." };
    if (captureValue.nativeProof.photoProof.length && !same3(captureValue.nativeProof.photoProof, currentPhotos)) return { stale: true, reason: "Explicit Library photo identity/hash changed or its live proof was not supplied." };
    if (proof.length) {
      if (!Array.isArray(currentSources) || !same3(proof, currentSources)) return { stale: true, reason: "Current authoritative original source identities/hashes differ or were not supplied." };
    }
    return { stale: false, reason: null };
  } catch (error) {
    return { stale: true, reason: error.message };
  }
}

// src/workspaces/carousel-words.mjs
function carouselWordsRecord(output) {
  return { slides: (output.slides || []).map((slide) => ({ id: slide.id, role: slide.role, text: slide.text, credit: slide.credit, label: slide.label ?? "" })), caption: output.caption ?? "" };
}
async function carouselWordsHash(output) {
  const bytes4 = new TextEncoder().encode(JSON.stringify(carouselWordsRecord(output)));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes4)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// services/native-output-owner.test.ts
var hash7 = (b) => createHash10("sha256").update(b).digest("hex");
async function fixture(t, options = {}) {
  const dataDir = fs10.realpathSync(fs10.mkdtempSync(path12.join(os2.tmpdir(), "native-output-owner-")));
  t.after(() => fs10.rmSync(dataDir, { recursive: true, force: true }));
  const dir = path12.join(dataDir, "originals");
  fs10.mkdirSync(dir);
  const draft = path12.join(dir, "DEV - Synthetic.md"), src = path12.join(dir, "SRC - Synthetic.md");
  fs10.writeFileSync(draft, options.nativeRaw || "---\ntype: DEV\ntitle: Synthetic\n---\n\nOriginal native words. %%you: PRIVATE NOTE%%\n\n> \u201CExact quote.\u201D\n");
  fs10.writeFileSync(src, "Exact source quote.");
  const originals = { catalog: () => ({ drafts: [{ originalId: "source-part", parentStudyKey: "parent", partKey: "article", title: "Synthetic", originalHash: hash7(fs10.readFileSync(draft)) }] }), readDraft: () => ({ id: "source-part", parentStudyKey: "parent", partKey: "article", title: "Synthetic", records: [{ id: "draft", role: "draft", path: draft, raw: fs10.readFileSync(draft, "utf8"), hash: hash7(fs10.readFileSync(draft)) }, { id: "src", role: "source", path: src, raw: fs10.readFileSync(src, "utf8"), hash: hash7(fs10.readFileSync(src)) }] }) };
  const native = createStudyDraftCopies({ dataDir, originals }), root = await native.openCopy({ parentStudyId: "parent", originalId: "source-part", originalHash: hash7(fs10.readFileSync(draft)), operationId: randomUUID7() });
  const project = createInitialState().project;
  project.id = "physical-project";
  project.document = { schema: "ar-create.document.v1", id: "physical-document", title: "Unrelated shared manuscript", revision: 12, paragraphs: [], outputs: [] };
  fs10.writeFileSync(path12.join(dataDir, "state.json"), JSON.stringify({ revision: 4, project }));
  const store = await createStore({ dataDir, sharedArticles: true, ...options });
  t.after(() => store.close().catch(() => {
  }));
  const group = { rootBindingId: root.binding.id, parentStudyId: "parent" }, mapper = { capture: captureNativeOutput, reopen: reopenNativeOutput, freshness: nativeOutputFreshness, renderDocument: nativeOutputRenderDocument };
  let proofHook = null;
  const assets = /* @__PURE__ */ new Map([["photo", hash7("synthetic-photo")]]), extraSources = [], extraPhotos = [];
  const proof = { read: async () => {
    if (proofHook) await proofHook();
    return { sources: [{ id: "src", role: "source", sourcePath: src, hash: hash7(fs10.readFileSync(src)), missing: false }, ...extraSources], photos: extraPhotos, assets: [...assets].map(([id2, hash8]) => ({ id: id2, hash: hash8 })), decisionsHash: hash7("shared explicit decisions") };
  } };
  const service = createNativeOutputOwner({ dataDir, store, native, mapper, helpers: { snapshotCarousel, reconcileArticleComposition, articleCompositionIssue, assertOutputEditorialReady, carouselWordsHash }, scope: { resolve: (i) => {
    assert.deepEqual(i, group);
    return { projectId: project.id, documentId: project.document.id };
  } }, proof });
  const view = (id2) => service.read({ ...group, selectedOutputId: id2 });
  const create = async (kind = "article", source = root) => service.create({ ...group, kind, sourceBindingId: source.binding.id, expectedNative: source.expected, expectedOutput: (await view()).expectedOutput, operationId: randomUUID7() });
  const edit2 = async (s, insert = "Changed") => {
    const p = s.projection.find((p2) => p2.words.includes("native words."));
    return native.save({ parentStudyId: "parent", bindingId: s.binding.id, expected: s.expected, operationId: randomUUID7(), operations: [{ kind: "text", id: p.id, from: 0, to: p.words.indexOf(" native"), insert, seenBlockHash: p.blockHash }] });
  };
  return { dataDir, draft, src, root, native, store, service, group, view, create, edit: edit2, assets, extraSources, extraPhotos, setHook: (fn) => proofHook = fn };
}
var placement = { slot: "cover", url: "/api/sources/blob?id=photo", x: 0.2, y: 0.8, zoom: 1.3, caption: "Exact cover caption", alt: "Exact alt" };
test("real native journal + real store: first register, second fork, independent words, reload, stale selected only, faithful refresh and arrangement Undo", async (t) => {
  const f = await fixture(t), sharedBefore = structuredClone(f.store.get().project.document), original = fs10.readFileSync(f.draft), a = await f.create(), aId = a.view.output.id, b = await f.create(), bId = b.view.output.id;
  assert.equal(a.view.wordOwner.bindingId, f.root.binding.id);
  assert.notEqual(b.view.wordOwner.bindingId, f.root.binding.id);
  assert.equal((await f.native.catalog()).drafts.length, 1);
  assert.equal((await f.native.catalog()).outputBindings.length, 2);
  const beforeB = await f.view(bId);
  const saveInput = { ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: f.root.expected, operationId: randomUUID7(), changes: { placements: [placement] } };
  const arranged = await f.service.save(saveInput);
  assert.deepEqual(arranged.view.output.placements, [placement]);
  assert.equal(arranged.view.freshness.stale, false);
  const changed = await f.edit(f.root);
  assert.equal((await f.view(aId)).freshness.stale, true);
  assert.equal((await f.view(bId)).freshness.stale, false);
  await assert.rejects(f.service.assertExport({ ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: changed.expected }), /native wording/);
  const refreshed = await f.service.refreshSelectedArticle({ ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: changed.expected, operationId: randomUUID7() });
  assert.equal(refreshed.view.freshness.stale, false);
  assert.deepEqual(refreshed.view.output.placements, [placement]);
  assert.match(JSON.stringify(refreshed.view.output.manuscript), /Changed native words/);
  assert.doesNotMatch(JSON.stringify(refreshed.view), /PRIVATE NOTE|copiedPath|nativeSnapshot/);
  assert.deepEqual((await f.view(bId)).output, beforeB.output);
  const secondSave = { ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: changed.expected, operationId: randomUUID7(), changes: { placements: [{ ...placement, x: 0.6 }] } };
  await f.service.save(secondSave);
  const undone = await f.service.undo({ ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: changed.expected, operationId: randomUUID7(), undoOperationId: secondSave.operationId });
  assert.deepEqual(undone.view.output.placements, [placement]);
  const shared = structuredClone(f.store.get().project.document);
  delete shared.outputs;
  delete shared.nativeOutputIndex;
  delete sharedBefore.outputs;
  assert.deepEqual(shared, sharedBefore);
  assert.deepEqual(fs10.readFileSync(f.draft), original);
  await f.store.close();
  const reopened = await createStore({ dataDir: f.dataDir, sharedArticles: true });
  assert.deepEqual((await reopened.readArticle()).document.outputs.find((o) => o.id === aId).placements, [placement]);
  await reopened.close();
});
test("carousel canonical words published through actual readCarouselWords; article edits do not stale carousel; own review invalidated", async (t) => {
  const f = await fixture(t);
  const a = await f.create(), c = await f.create("carousel"), id2 = c.view.output.id, slides = structuredClone(c.view.output.slides);
  slides[0].text = "Independent carousel cover";
  const saved = await f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: (await f.view()).expectedOutput, operationId: randomUUID7(), changes: { slides, caption: "Independent caption" } });
  assert.equal(saved.view.wordOwner.kind, "carousel-words");
  assert.equal(saved.view.output.wordsReview, void 0);
  assert.match((await f.store.readCarouselWords({ projectId: "physical-project", documentId: "physical-document", outputId: id2 })).raw, /Independent carousel cover/);
  await f.edit(f.root);
  assert.equal((await f.view(id2)).freshness.stale, false);
  assert.equal((await f.view(a.view.output.id)).freshness.stale, true);
  assert.deepEqual((await f.native.catalog()).outputBindings.length, 1);
});
test("exact command replay after later native changes and output changes; different payload reused operation refuses", async (t) => {
  const f = await fixture(t), operationId = randomUUID7(), input = { ...f.group, kind: "article", sourceBindingId: f.root.binding.id, expectedNative: f.root.expected, expectedOutput: (await f.view()).expectedOutput, operationId };
  const first = await f.service.create(input);
  await f.create();
  await f.edit(f.root);
  const retry = await f.service.create(input);
  assert.equal(retry.alreadySaved, true);
  assert.deepEqual(retry.receipt, first.receipt);
  await assert.rejects(f.service.create({ ...input, kind: "carousel" }), /another exact/);
  assert.equal((await f.native.catalog()).outputBindings.length, 2);
});
test("foreign scope, stale native, injected article words, unowned photos and source race preserve bytes", async (t) => {
  const f = await fixture(t), a = await f.create(), id2 = a.view.output.id, before = structuredClone(f.store.get());
  await assert.rejects(f.service.read({ ...f.group, parentStudyId: "foreign", selectedOutputId: id2 }));
  await assert.rejects(f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: (await f.view()).expectedOutput, expectedNative: f.root.expected, operationId: randomUUID7(), changes: { manuscript: [] } }), /immutable/);
  await assert.rejects(f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: (await f.view()).expectedOutput, expectedNative: f.root.expected, operationId: randomUUID7(), changes: { placements: [{ ...placement, url: "/api/sources/blob?id=foreign" }] } }), /Library/);
  let count = 0;
  f.setHook(() => {
    if (++count === 2) fs10.writeFileSync(f.src, "External source changed");
  });
  await assert.rejects(f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: (await f.view()).expectedOutput, expectedNative: f.root.expected, operationId: randomUUID7(), changes: { placements: [placement] } }), /Source proof changed/);
  assert.deepEqual(f.store.get(), before);
  assert.equal((await f.view(id2)).freshness.stale, true);
  assert.equal((await f.native.read({ bindingId: f.root.binding.id, parentStudyId: "parent" })).raw, f.root.raw);
});
test("partial native registration resumes after publication lost response; capture stays private", async (t) => {
  let armed = false;
  const f = await fixture(t, { publicationFault: (point) => {
    if (armed && point === "after-complete") {
      armed = false;
      throw Error("lost output reply");
    }
  } }), input = { ...f.group, kind: "article", sourceBindingId: f.root.binding.id, expectedNative: f.root.expected, expectedOutput: (await f.view()).expectedOutput, operationId: randomUUID7() };
  armed = true;
  await assert.rejects(f.service.create(input), /lost output reply/);
  await f.store.read();
  const replay = await f.service.create(input);
  assert.equal(replay.alreadySaved, true);
  assert.equal(replay.view.output.id, input.operationId);
  assert.equal((await f.native.catalog()).outputBindings.length, 1);
  assert.doesNotMatch(JSON.stringify((await f.store.readArticle()).document.outputs), /PRIVATE NOTE|capture-manifest|nativeSnapshot/);
});
test("trusted export lease holds native Save and rechecks exact own native/source/output before publishing", async (t) => {
  const f = await fixture(t), a = await f.create(), id2 = a.view.output.id;
  let entered, release;
  const reached = new Promise((r) => entered = r), gate = new Promise((r) => release = r);
  let saveComplete = false;
  const exporting = f.service.withExportSnapshot({ ...f.group, selectedOutputId: id2, expectedOutput: (await f.view()).expectedOutput, expectedNative: f.root.expected }, async ({ output, finalCheck }) => {
    assert.equal(output.id, id2);
    entered();
    await gate;
    await finalCheck();
    return "verified own export";
  });
  await reached;
  const pending = f.edit(f.root).then(() => saveComplete = true);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(saveComplete, false);
  release();
  assert.equal(await exporting, "verified own export");
  await pending;
  assert.equal(saveComplete, true);
  assert.equal((await f.view(id2)).freshness.stale, true);
  await assert.rejects(f.service.assertExport({ ...f.group, selectedOutputId: id2, expectedOutput: { revision: 0, hash: hash7("wrong") }, expectedNative: f.root.expected }), /revision/);
});
test("carousel arrangement Undo retains independently edited words; canonical word file and siblings remain intact", async (t) => {
  const f = await fixture(t), article = await f.create(), carousel = await f.create("carousel"), id2 = carousel.view.output.id, slides = structuredClone(carousel.view.output.slides);
  slides[0].text = "Own changed words";
  slides[0].template = "H7";
  const operationId = randomUUID7();
  const saved = await f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: (await f.view()).expectedOutput, operationId, changes: { slides, caption: "Own changed caption" } });
  const undone = await f.service.undo({ ...f.group, selectedOutputId: id2, expectedOutput: saved.view.expectedOutput, operationId: randomUUID7(), undoOperationId: operationId });
  assert.equal(undone.view.output.slides[0].text, "Own changed words");
  assert.equal(undone.view.output.caption, "Own changed caption");
  assert.equal(undone.view.output.slides[0].template, carousel.view.output.slides[0].template);
  assert.match((await f.store.readCarouselWords({ projectId: "physical-project", documentId: "physical-document", outputId: id2 })).raw, /Own changed words/);
  assert.deepEqual((await f.view(article.view.output.id)).output, article.view.output);
});
test("another native root within same parent cannot seed this group; stale output guards and native race refuse", async (t) => {
  const f = await fixture(t), a = await f.create();
  await assert.rejects(f.service.create({ ...f.group, kind: "article", sourceBindingId: randomUUID7(), expectedNative: f.root.expected, expectedOutput: (await f.view()).expectedOutput, operationId: randomUUID7() }), /another native root/);
  const old = (await f.view()).expectedOutput;
  await f.create();
  await assert.rejects(f.service.save({ ...f.group, selectedOutputId: a.view.output.id, expectedOutput: old, expectedNative: f.root.expected, operationId: randomUUID7(), changes: { placements: [] } }), /changed since/);
  await f.edit(f.root);
  await assert.rejects(f.service.save({ ...f.group, selectedOutputId: a.view.output.id, expectedOutput: (await f.view()).expectedOutput, expectedNative: f.root.expected, operationId: randomUUID7(), changes: { placements: [] } }), /own article native/);
});
test("private captures are content-addressed; proof tampering refuses without publishing", async (t) => {
  const f = await fixture(t), a = await f.create(), index = f.store.get().project.document.nativeOutputIndex, r = index.records[0], files = [];
  const walk = (dir) => {
    for (const name of fs10.readdirSync(dir)) {
      const file2 = path12.join(dir, name);
      if (fs10.statSync(file2).isDirectory()) walk(file2);
      else files.push(file2);
    }
  };
  walk(path12.join(f.dataDir, "native-outputs"));
  const file = files.find((p) => p.endsWith("/captures/" + r.captureId + ".json"));
  const value = JSON.parse(fs10.readFileSync(file, "utf8"));
  value.proof.decisionsHash = hash7("forged proof");
  fs10.writeFileSync(file, JSON.stringify(value));
  await assert.rejects(f.view(a.view.output.id), /integrity changed/);
  assert.equal(f.store.get().project.document.outputs.length, 1);
});
test("prepublication failure preserves native registration and exact retry resumes without another copy", async (t) => {
  const f = await fixture(t), input = { ...f.group, kind: "article", sourceBindingId: f.root.binding.id, expectedNative: f.root.expected, expectedOutput: (await f.view()).expectedOutput, operationId: randomUUID7() };
  let failOnce = true;
  f.setHook(() => {
    if (failOnce) {
      failOnce = false;
      throw Error("proof reader unavailable");
    }
  });
  await assert.rejects(f.service.create(input), /proof reader unavailable/);
  assert.equal(f.store.get().project.document.outputs.length, 0);
  assert.equal((await f.native.catalog()).outputBindings.length, 1);
  const result = await f.service.create(input);
  assert.equal(result.view.wordOwner.bindingId, f.root.binding.id);
  assert.equal((await f.native.catalog()).outputBindings.length, 1);
});
test("unused eligibility additions leave words/crop guard current; new upload can be placed; only changed/deleted USED assets stale their output", async (t) => {
  const f = await fixture(t), a = await f.create(), b = await f.create(), aId = a.view.output.id, bId = b.view.output.id;
  const arrange = async (id2, nativeExpected, photoId, x = 0.2) => f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: (await f.view()).expectedOutput, expectedNative: nativeExpected, operationId: randomUUID7(), changes: { placements: [{ ...placement, url: "/api/sources/blob?id=" + photoId, x }] } });
  await arrange(aId, f.root.expected, "photo");
  const bNative = await f.native.read({ bindingId: b.view.wordOwner.bindingId, parentStudyId: "parent" });
  f.assets.set("other-photo", hash7("other synthetic photo"));
  await arrange(bId, bNative.expected, "other-photo");
  const pending = await f.view(aId), nativeBefore = await f.native.read({ bindingId: f.root.binding.id, parentStudyId: "parent" });
  f.assets.set("unused-upload", hash7("unused photograph"));
  f.extraSources.push({ id: "unused-source", role: "source", sourcePath: "never-selected.md", hash: hash7("unused"), missing: false });
  f.extraPhotos.push({ nativeFile: "unrequested-photo.jpg", sourceId: "unused-upload", sourceHash: hash7("unused photograph") });
  assert.deepEqual((await f.view(aId)).expectedOutput, pending.expectedOutput);
  assert.equal((await f.view(aId)).freshness.stale, false);
  assert.equal((await f.view(bId)).freshness.stale, false);
  const cropped = await f.service.save({ ...f.group, selectedOutputId: aId, expectedOutput: pending.expectedOutput, expectedNative: nativeBefore.expected, operationId: randomUUID7(), changes: { placements: [{ ...placement, x: 0.6 }] } });
  assert.equal(cropped.view.output.placements[0].x, 0.6);
  const uploaded = "new-user-upload";
  f.assets.set(uploaded, hash7("new eligible bytes"));
  const placed = await arrange(aId, nativeBefore.expected, uploaded, 0.7);
  assert.deepEqual(placed.view.output.manuscript, pending.output.manuscript);
  assert.deepEqual((await f.native.read({ bindingId: f.root.binding.id, parentStudyId: "parent" })).expected, nativeBefore.expected);
  assert.equal(placed.view.freshness.stale, false);
  await f.service.assertExport({ ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: nativeBefore.expected });
  f.assets.set(uploaded, hash7("changed USED photograph"));
  assert.equal((await f.view(aId)).freshness.stale, true);
  assert.equal((await f.view(bId)).freshness.stale, false);
  await assert.rejects(f.service.assertExport({ ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: nativeBefore.expected }), /Shared proof changed/);
  f.assets.delete(uploaded);
  await assert.rejects(f.service.assertExport({ ...f.group, selectedOutputId: aId, expectedOutput: (await f.view()).expectedOutput, expectedNative: nativeBefore.expected }), /Shared proof changed/);
  assert.equal((await f.view(bId)).freshness.stale, false);
  await f.service.assertExport({ ...f.group, selectedOutputId: bId, expectedOutput: (await f.view()).expectedOutput, expectedNative: bNative.expected });
});
test("only codec-requested native photo mappings enter capture; unrelated mapping additions do not stale; photo replacement Undo restores owned placement without words", async (t) => {
  const f = await fixture(t, { nativeRaw: "---\ntype: DEV\ntitle: Synthetic\n---\n\n%%photo: cover.jpg \xB7 Exact cover \xB7 cover%%\n\nOriginal native words.\n\n> \u201CExact quote.\u201D\n" });
  f.extraPhotos.push({ nativeFile: "cover.jpg", sourceId: "photo", sourceHash: hash7("synthetic-photo") }, { nativeFile: "unused-layout.jpg", sourceId: "irrelevant", sourceHash: hash7("irrelevant") });
  const a = await f.create(), id2 = a.view.output.id;
  assert.equal(a.view.output.placements[0].url, "/api/sources/blob?id=photo");
  f.extraPhotos.push({ nativeFile: "another-unrequested.jpg", sourceId: "another-unused", sourceHash: hash7("another") });
  assert.equal((await f.view(id2)).freshness.stale, false);
  f.assets.set("replacement", hash7("replacement bytes"));
  const op = randomUUID7(), old = structuredClone(a.view.output.placements), next = old.map((p) => ({ ...p, url: "/api/sources/blob?id=replacement" }));
  const saved = await f.service.save({ ...f.group, selectedOutputId: id2, operationId: op, expectedOutput: (await f.view()).expectedOutput, expectedNative: f.root.expected, changes: { placements: next } });
  const undone = await f.service.undo({ ...f.group, selectedOutputId: id2, undoOperationId: op, operationId: randomUUID7(), expectedOutput: saved.view.expectedOutput, expectedNative: f.root.expected });
  assert.deepEqual(undone.view.output.placements, old);
  assert.deepEqual(undone.view.output.manuscript, a.view.output.manuscript);
  const rePlaced = await f.service.save({ ...f.group, selectedOutputId: id2, operationId: randomUUID7(), expectedOutput: undone.view.expectedOutput, expectedNative: f.root.expected, changes: { placements: next } });
  f.assets.set("photo", hash7("changed now UNUSED original binding bytes"));
  f.extraPhotos[0].sourceHash = hash7("changed now UNUSED original binding bytes");
  assert.equal((await f.view(id2)).freshness.stale, false);
  await f.service.assertExport({ ...f.group, selectedOutputId: id2, expectedOutput: rePlaced.view.expectedOutput, expectedNative: f.root.expected });
});
test("held approval/unsupported native mapping refuses before register/fork; root remains recoverably unassociated", async (t) => {
  for (const raw of ["Original ==pending human approval== native words.", "Original native words.\n\n%%unknown-private-layout: opaque%%"]) {
    const f = await fixture(t, { nativeRaw: raw }), before = await f.native.catalog(), operationId = randomUUID7();
    await assert.rejects(f.service.create({ ...f.group, kind: "article", sourceBindingId: f.root.binding.id, expectedNative: f.root.expected, expectedOutput: (await f.view()).expectedOutput, operationId }), /held before output registration/);
    assert.deepEqual(await f.native.catalog(), before);
    assert.equal((await f.native.read({ bindingId: f.root.binding.id, parentStudyId: "parent" })).binding.canonicalOutputId, void 0);
    assert.equal(f.store.get().project.document.outputs.length, 0);
    assert.equal(fs10.existsSync(path12.join(f.dataDir, "study-draft-copies", "output-bindings", f.root.binding.id + ".json")), false);
    assert.equal((await f.native.read({ bindingId: f.root.binding.id, parentStudyId: "parent" })).raw, raw);
  }
});
test("store receipt binds exact stable command intent; same mutation UUID/body replay works but changed crop conflicts", async (t) => {
  const f = await fixture(t), a = await f.create(), input = { ...f.group, selectedOutputId: a.view.output.id, expectedNative: f.root.expected, expectedOutput: (await f.view()).expectedOutput, operationId: randomUUID7(), changes: { placements: [placement] } };
  const first = await f.service.save(input), receiptFile = path12.join(f.dataDir, "native-outputs", "operations", input.operationId, "receipt.json"), receipt = JSON.parse(fs10.readFileSync(receiptFile, "utf8"));
  assert.match(receipt.commandHash, /^[a-f0-9]{64}$/);
  assert.equal((await f.service.save(input)).alreadySaved, true);
  await assert.rejects(f.service.save({ ...input, changes: { placements: [{ ...placement, x: 0.8 }] } }), /another exact/);
  const historyFiles = [];
  const walk = (dir) => {
    for (const name of fs10.readdirSync(dir)) {
      const p = path12.join(dir, name);
      if (fs10.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith("/history/" + input.operationId + ".json")) historyFiles.push(p);
    }
  };
  walk(path12.join(f.dataDir, "native-outputs"));
  assert.equal(historyFiles.length, 1);
  const stored = JSON.parse(fs10.readFileSync(historyFiles[0], "utf8"));
  assert.equal(receipt.commandHash, stored.commandHash);
  await assert.rejects(f.store.saveOutputRecords({ projectId: "physical-project", documentId: "physical-document", operationId: input.operationId, expectedOutput: input.expectedOutput, commandHash: hash7("different exact body") }, () => {
    throw Error("Must never prepare reused ID");
  }), /different input/);
  assert.equal(first.view.output.placements[0].x, placement.x);
});
test("public selected writingProof identifies second article own child and exact carousel words file without leaking current raw/context", async (t) => {
  const f = await fixture(t), a = await f.create(), b = await f.create(), c = await f.create("carousel"), bv = await f.view(b.view.output.id), child = await f.native.read({ bindingId: bv.wordOwner.bindingId, parentStudyId: "parent" });
  assert.equal(bv.documentId, f.root.binding.id);
  assert.equal(bv.writingProof.kind, "native");
  assert.equal(bv.writingProof.bindingId, child.binding.id);
  assert.notEqual(bv.writingProof.bindingId, bv.documentId);
  assert.deepEqual(bv.writingProof.expected, child.expected);
  assert.equal(bv.writingProof.rawHash, hash7(child.raw));
  assert.equal(bv.writingProof.capturedRawHash, hash7(child.raw));
  const savedBefore = structuredClone(bv.output), edited = await f.edit(child, "Child edition");
  const after = await f.view(bv.output.id);
  assert.deepEqual(after.output, savedBefore);
  assert.deepEqual(after.writingProof.expected, edited.expected);
  assert.equal(after.writingProof.rawHash, hash7(edited.raw));
  assert.equal(after.writingProof.capturedRawHash, bv.writingProof.capturedRawHash);
  assert.equal(after.freshness.writingStale, true);
  assert.equal(after.freshness.sourceStale, false);
  assert.equal((await f.view(a.view.output.id)).freshness.stale, false);
  const cv = await f.view(c.view.output.id), file = await f.store.readCarouselWords({ projectId: "physical-project", documentId: "physical-document", outputId: cv.output.id });
  assert.equal(cv.writingProof.kind, "carousel-words");
  assert.equal(cv.writingProof.outputId, cv.output.id);
  assert.deepEqual(cv.writingProof.expected, file.expected);
  assert.equal(cv.writingProof.expected.markdownHash, hash7(file.raw));
  assert.equal(cv.writingProof.wordsHash, await carouselWordsHash(cv.output));
  assert.doesNotMatch(JSON.stringify(after), /PRIVATE NOTE|nativeSnapshot|copiedPath|capture-manifest/);
  assert.equal(after.writingProof.raw, void 0);
  assert.equal(after.writingProof.context, void 0);
  fs10.writeFileSync(file.paths.markdown, "External carousel bytes changed.");
  const stale = await f.view(cv.output.id);
  assert.deepEqual(stale.output, cv.output);
  assert.equal(stale.freshness.writingStale, true);
  assert.equal(stale.freshness.sourceStale, false);
  assert.equal(stale.writingProof.expected.markdownHash, hash7("External carousel bytes changed."));
});
test("trusted own-file words review mints existing look-stage receipt; typography preserves it, word edits invalidate it and siblings", async (t) => {
  const f = await fixture(t), a = await f.create("carousel"), b = await f.create("carousel"), id2 = a.view.output.id, beforeB = (await f.view(b.view.output.id)).output;
  const view = await f.view(id2), input = { ...f.group, selectedOutputId: id2, expectedOutput: view.expectedOutput, expectedWords: view.writingProof.expected, wordsHash: view.writingProof.wordsHash, operationId: randomUUID7() };
  const reviewed = await f.service.reviewCarouselWords(input);
  assert.equal(reviewed.view.output.stage, "look");
  assert.equal(reviewed.view.output.wordsReview.hash, await carouselWordsHash(reviewed.view.output));
  assert.match(reviewed.view.output.wordsReview.reviewedAt, /^\d{4}-/);
  const receipt = reviewed.view.output.wordsReview;
  assert.equal((await f.service.reviewCarouselWords(input)).alreadySaved, true);
  const slides = structuredClone(reviewed.view.output.slides);
  slides[0].typography = { font: "sans", scale: 1.25, fit: "auto" };
  const saved = await f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: reviewed.view.expectedOutput, operationId: randomUUID7(), changes: { slides, caption: reviewed.view.output.caption } });
  assert.deepEqual(saved.view.output.slides[0].typography, slides[0].typography);
  assert.deepEqual(saved.view.output.wordsReview, receipt);
  assert.equal(saved.view.output.stage, "look");
  slides[0].text += " Authored next words";
  const changed = await f.service.save({ ...f.group, selectedOutputId: id2, expectedOutput: saved.view.expectedOutput, operationId: randomUUID7(), changes: { slides, caption: saved.view.output.caption } });
  assert.equal(changed.view.output.stage, "words");
  assert.equal(changed.view.output.wordsReview, void 0);
  assert.deepEqual((await f.view(b.view.output.id)).output, beforeB);
  await assert.rejects(f.service.reviewCarouselWords({ ...input, operationId: randomUUID7(), expectedOutput: changed.view.expectedOutput }), /changed since human review/);
  await f.store.close();
  const reopened = await createStore({ dataDir: f.dataDir, sharedArticles: true });
  const stored = (await reopened.readArticle()).document.outputs.find((o) => o.id === id2);
  assert.deepEqual(stored.slides[0].typography, slides[0].typography);
  assert.equal(stored.stage, "words");
  assert.equal(stored.wordsReview, void 0);
  await reopened.close();
});
test("review refuses foreign own-file token, unapproved words and forged receipts; typography refuses unknown keys/bounds", async (t) => {
  const f = await fixture(t), a = await f.create("carousel"), b = await f.create("carousel"), view = await f.view(a.view.output.id), other = await f.view(b.view.output.id), scope = { ...f.group, selectedOutputId: view.output.id, expectedOutput: view.expectedOutput, operationId: randomUUID7() };
  await assert.rejects(f.service.reviewCarouselWords({ ...scope, expectedWords: other.writingProof.expected, wordsHash: view.writingProof.wordsHash }), /changed since human review/);
  for (const typography of [{ font: "unknown", scale: 1, fit: "auto" }, { font: "sans", scale: 2, fit: "manual" }, { font: "sans", scale: 1, fit: "auto", css: "arbitrary" }]) {
    const slides2 = structuredClone(view.output.slides);
    slides2[0].typography = typography;
    await assert.rejects(f.service.save({ ...scope, operationId: randomUUID7(), changes: { slides: slides2, caption: view.output.caption } }), /supported carousel/);
  }
  await assert.rejects(f.service.save({ ...scope, changes: { wordsReview: { hash: view.writingProof.wordsHash, reviewedAt: "2026-10-14" }, stage: "look" } }), /immutable/);
  const slides = structuredClone(view.output.slides);
  slides[0].text = "==Awaiting human approval==";
  const marked = await f.service.save({ ...scope, operationId: randomUUID7(), changes: { slides, caption: view.output.caption } }), v = marked.view;
  await assert.rejects(f.service.reviewCarouselWords({ ...f.group, selectedOutputId: v.output.id, expectedOutput: v.expectedOutput, expectedWords: v.writingProof.expected, wordsHash: v.writingProof.wordsHash, operationId: randomUUID7() }), /Approve or remove/);
});
test("carousel human review recovers at journal publication interruptions and refuses own physical words race", async (t) => {
  for (const point of ["after-intent", "after-file:0", "before-complete", "after-complete"]) {
    let armed = false;
    const f2 = await fixture(t, { publicationFault: (where) => {
      if (armed && where === point) throw Error("review interrupted");
    } }), c2 = await f2.create("carousel"), view2 = await f2.view(c2.view.output.id), input = { ...f2.group, selectedOutputId: view2.output.id, expectedOutput: view2.expectedOutput, expectedWords: view2.writingProof.expected, wordsHash: view2.writingProof.wordsHash, operationId: randomUUID7() };
    armed = true;
    await assert.rejects(f2.service.reviewCarouselWords(input), /review interrupted/);
    armed = false;
    const replay = await f2.service.reviewCarouselWords(input);
    assert.equal(replay.alreadySaved, true);
    assert.equal(replay.view.output.stage, "look");
    assert.equal(replay.view.output.wordsReview.hash, await carouselWordsHash(replay.view.output));
  }
  const f = await fixture(t), c = await f.create("carousel"), view = await f.view(c.view.output.id), w = await f.store.readCarouselWords({ projectId: "physical-project", documentId: "physical-document", outputId: view.output.id });
  let reads = 0;
  f.setHook(() => {
    if (++reads === 2) fs10.appendFileSync(w.paths.markdown, "\nExternal own words changed");
  });
  await assert.rejects(f.service.reviewCarouselWords({ ...f.group, selectedOutputId: view.output.id, expectedOutput: view.expectedOutput, expectedWords: view.writingProof.expected, wordsHash: view.writingProof.wordsHash, operationId: randomUUID7() }), /external edits|changed/);
  assert.match(fs10.readFileSync(w.paths.markdown, "utf8"), /External own words changed/);
  assert.equal(f.store.get().project.document.outputs.find((o) => o.id === view.output.id).wordsReview, void 0);
});
test("public arrangement Undo identifies only exact changed own arrangement, never creation or words-only change", async (t) => {
  const f = await fixture(t);
  const a = await f.service.create({ ...f.group, kind: "article", sourceBindingId: f.root.binding.id, expectedNative: f.root.expected, expectedOutput: (await f.service.read(f.group)).expectedOutput, operationId: randomUUID7() });
  assert.equal(a.view.arrangementUndo, null);
  const operationId = randomUUID7(), saved = await f.service.save({ ...f.group, selectedOutputId: a.view.output.id, expectedNative: a.view.writingProof.expected, expectedOutput: a.view.expectedOutput, operationId, changes: { name: "A deliberate arrangement name" } });
  assert.deepEqual(saved.view.arrangementUndo, { operationId });
  const undone = await f.service.undo({ ...f.group, selectedOutputId: a.view.output.id, expectedNative: saved.view.writingProof.expected, expectedOutput: saved.view.expectedOutput, operationId: randomUUID7(), undoOperationId: operationId });
  assert.equal(undone.view.output.name, a.view.output.name);
});
test("existing pillar seal choices save as arrangement and preserve reviewed carousel words", async (t) => {
  const f = await fixture(t), created = await f.create("carousel");
  let view = created.view;
  const review = await f.service.reviewCarouselWords({ ...f.group, selectedOutputId: view.output.id, expectedOutput: view.expectedOutput, expectedWords: view.writingProof.expected, wordsHash: view.writingProof.wordsHash, operationId: randomUUID7() });
  view = review.view;
  for (const pillar of ["\u4F73", "\u5BB6", "\u5609", ""]) {
    const slides2 = structuredClone(view.output.slides);
    slides2[0].pillar = pillar;
    const saved = await f.service.save({ ...f.group, selectedOutputId: view.output.id, expectedOutput: view.expectedOutput, operationId: randomUUID7(), changes: { slides: slides2 } });
    assert.equal(saved.view.output.slides[0].pillar, pillar);
    assert.deepEqual(saved.view.output.wordsReview, review.view.output.wordsReview);
    view = saved.view;
  }
  const slides = structuredClone(view.output.slides);
  slides[0].pillar = "unrecognized";
  await assert.rejects(f.service.save({ ...f.group, selectedOutputId: view.output.id, expectedOutput: view.expectedOutput, operationId: randomUUID7(), changes: { slides } }), /independent carousel slides/);
});
