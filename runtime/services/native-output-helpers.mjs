// services/files.mjs
import { randomUUID, createHash } from "node:crypto";

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
function escapeInline(text2) {
  let out = "";
  for (let i = 0; i < text2.length; i += 1) {
    const ch = text2[i];
    const prev = text2[i - 1] ?? " ";
    const next = text2[i + 1] ?? " ";
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
    const parsed = fromMarkdown("[x" + original, LINK_PARSE_OPTIONS).children[0], link = parsed?.children?.[0];
    if (parsed?.children?.length === 1 && link?.type === "link" && link.position?.end.offset === original.length + 2 && link.url === href && (link.title ?? null) === title) return original;
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
    let text2 = run.text;
    closeTo(sharedPrefix(active, run.marks));
    const opening = run.marks.slice(active.length);
    if (opening.length) {
      const leading = text2.match(/^\s+/)?.[0] ?? "";
      out += leading;
      text2 = text2.slice(leading.length);
    }
    for (const mark of opening) {
      out += delimiterFor(mark);
      active.push(mark);
    }
    const next = runs[index + 1];
    const keepAfter = next && "text" in next ? sharedPrefix(active, next.marks) : 0;
    const trailing = active.length > keepAfter ? text2.match(/\s+$/)?.[0] ?? "" : "";
    const body = trailing ? text2.slice(0, -trailing.length) : text2;
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
function indentContinuation(text2, indent) {
  return text2.split("\n").map((line, i) => i === 0 || line === "" ? line : indent + line).join("\n");
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
var CAROUSEL_WORDS_LIMITS = Object.freeze({ maxBytes: 1024 * 1024, maxSlides: 40, maxFieldCharacters: 2e4, maxIdentityCharacters: 240 });

// src/workspaces/article-composition.mjs
var ARTICLE_COMPOSITION_SCHEMA = "ar-create.article-composition.v1";
function articleCompositionIssue(value, paragraphs, placements = []) {
  const fail2 = (message) => {
    throw new Error(message);
  };
  const object = (v, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !keys.includes(k))) fail2("Invalid article layout fields.");
  };
  const text2 = (v, max = 256) => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  const list = (v) => {
    if (!Array.isArray(v) || v.length > 5e3) fail2("Invalid article layout list.");
  };
  const optionalBool = (v, key) => {
    if (v[key] !== void 0 && typeof v[key] !== "boolean") fail2("Invalid article layout option.");
  };
  const aspect = (v) => {
    if (v !== void 0 && (!text2(v, 32) || !/^[1-9]\d*(?:\.\d+)?\/[1-9]\d*(?:\.\d+)?$/.test(v))) fail2("Invalid article photo aspect.");
  };
  try {
    object(value, ["schema", "form", "hookId", "introId", "closingId", "portraitSlot", "opening", "parts", "ending"]);
    if (value.schema !== ARTICLE_COMPOSITION_SCHEMA || value.form !== void 0 && !["story", "conversation"].includes(value.form)) fail2("Unknown article layout format.");
    const ids = new Set(paragraphs.map((p) => p.id)), slots = new Set(placements.map((p) => p.slot));
    if (ids.size !== paragraphs.length || slots.size !== placements.length) fail2("Article identities must be unique.");
    const usedIds = /* @__PURE__ */ new Set(), usedSlots = /* @__PURE__ */ new Set();
    const passage = (id) => {
      if (!text2(id) || !ids.has(id)) fail2("Article layout references a missing accepted passage.");
      if (usedIds.has(id)) fail2("Article layout repeats an accepted passage.");
      usedIds.add(id);
    };
    const photo = (slot) => {
      if (!text2(slot) || !slots.has(slot)) fail2("Article layout references a photo slot it does not own.");
      if (usedSlots.has(slot)) fail2("Article layout repeats a photo slot.");
      usedSlots.add(slot);
    };
    const walk = (blocks, depth = 0, wordsOnly = false) => {
      list(blocks);
      if (depth > 8) fail2("Article layout is nested too deeply.");
      for (const b of blocks) {
        if (!b || typeof b !== "object") fail2("Invalid article block.");
        if (wordsOnly && !["q", "a", "n", "line"].includes(b.kind)) fail2("Side and glyph frames contain words only.");
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
            if (!["xl", "l", "m"].includes(b.size)) fail2("Invalid article line size.");
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
            if (!text2(b.glyph, 32)) fail2("Invalid article glyph.");
            walk(b.blocks, depth + 1, true);
            break;
          case "photos":
            object(b, ["kind", "slots", "aspect", "stagger", "narrow"]);
            list(b.slots);
            if (b.slots.length < 1 || b.slots.length > 2) fail2("An article photo pair has one or two photos.");
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
            if (b.offset !== void 0 && !["left", "right"].includes(b.offset)) fail2("Invalid article photo offset.");
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
            if (!b.aspect || !/^#[a-f\d]{6}$/i.test(b.ink || "") || !/^#[a-f\d]{6}$/i.test(b.accent || "")) fail2("An on-photo passage needs its measured colors and aspect.");
            break;
          default:
            fail2("Unknown article block.");
        }
      }
    };
    for (const key of ["hookId", "introId", "closingId"]) if (value[key] !== void 0) passage(value[key]);
    if (value.portraitSlot !== void 0) photo(value.portraitSlot);
    walk(value.opening);
    list(value.parts);
    for (const part of value.parts) {
      object(part, ["titleId", "openerSlot", "blocks"]);
      passage(part.titleId);
      const title = paragraphs.find((p) => p.id === part.titleId);
      if (title.doc?.content?.length !== 1 || title.doc.content[0].type !== "heading") fail2("An article chapter title must reference an accepted heading.");
      if (part.openerSlot !== void 0) photo(part.openerSlot);
      walk(part.blocks);
    }
    object(value.ending, ["blocks", "sayingId", "photoSlot", "aspect"]);
    walk(value.ending.blocks);
    if (value.ending.sayingId !== void 0) passage(value.ending.sayingId);
    if (value.ending.photoSlot !== void 0) photo(value.ending.photoSlot);
    aspect(value.ending.aspect);
    if (usedIds.size !== ids.size) fail2("Article layout omits an accepted passage.");
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
var WRITING_TEMPLATE_MAX_BYTES = 128 * 1024;

// services/files.mjs
var digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

// services/draft-correspondence.mjs
import { createHash as createHash2, randomUUID as randomUUID2 } from "node:crypto";
import { fromMarkdown as fromMarkdown2 } from "mdast-util-from-markdown";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { fromMarkdown as fromMarkdown3 } from "mdast-util-from-markdown";
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
  const projection2 = protectGuidanceQueue ? guidanceRegions(raw) : { prefix: splitBlocks(raw).fm, regions: [{ raw: raw.slice(splitBlocks(raw).fm.length), pending: false }] };
  const parts = [], blocks = [], separators = /* @__PURE__ */ new Set();
  for (const region of projection2.regions) {
    if (region.pending) {
      parts.push(region.raw);
      continue;
    }
    const chunk = region.raw.split(/(\r?\n\s*\r?\n)/);
    for (let index = 0; index < chunk.length; index++) {
      const partIndex = parts.length, part = chunk[index];
      parts.push(part);
      if (index % 2) separators.add(partIndex);
      else blocks.push({ index: blocks.length, partIndex, raw: part, plain: plain(part), editable: editable(part) });
    }
  }
  if (!blocks.some((block) => block.raw.trim()) && blocks[0]) blocks[0].editable = true;
  return { prefix: projection2.prefix, suffix: "", parts, blocks, separators };
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
  const text2 = (value, extra = []) => {
    const all = [...marks, ...extra].map((mark) => ({ type: mark.type, attrs: { ...mark.attrs } }));
    value.split("\n").forEach((piece, index) => {
      if (index > 0) out.push({ type: "hardBreak" });
      if (piece) out.push(all.length ? { type: "text", text: piece, marks: all } : { type: "text", text: piece });
    });
  };
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        text2(node.value);
        break;
      case "strong":
        out.push(...inlineChildren(node.children, source, [...marks, { type: "bold", attrs: { markup: delimiterAt(source, node, "**") } }]));
        break;
      case "emphasis":
        out.push(...inlineChildren(node.children, source, [...marks, { type: "italic", attrs: { markup: delimiterAt(source, node, "_") } }]));
        break;
      case "inlineCode":
        text2(node.value, [{ type: "code", attrs: {} }]);
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
        if ("value" in node && typeof node.value === "string") text2(node.value);
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
function markdownToDoc(text2, options = {}) {
  const content = blockChildren(fromMarkdown2(text2, options.links ? LINK_PARSE_OPTIONS2 : PARSE_OPTIONS2).children, text2);
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
var hash2 = (s) => createHash2("sha256").update(s).digest("hex");
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
  let words = "", runs = [], notes = false, safe = true, reworks = [];
  const add = (value, a, b, locked = false) => {
    runs.push({ from: words.length, to: words.length + value.length, rawFrom: a, rawTo: b, locked });
    words += value;
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
        const from = words.length, end = i + request[0].length;
        add("/", i, i + 10);
        scan(i + 10, end - 11);
        add("/", end - 11, end);
        reworks.push({ from, to: words.length, rawFrom: i, rawTo: end, words: plain(request[1]) });
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
  const leading = words.length - words.trimStart().length, trailing = words.trimEnd().length;
  runs = runs.map((r) => ({ ...r, from: r.from - leading, to: r.to - leading })).filter((r) => r.to >= 0 && r.from <= trailing - leading);
  reworks = reworks.map((r) => ({ ...r, from: r.from - leading, to: r.to - leading }));
  words = words.trim();
  const body = raw.slice(frame.bodyStart, frame.end);
  const knownWholeRequest = reworks.length === 1 && reworks[0].from === 0 && reworks[0].to === words.length && !notes;
  safe = safe && !/^(?: {4}|\t)/m.test(raw) && (editable(raw) || knownWholeRequest) && words === plain(body) && !/^\s*[#>]|^\s*[-+*]\s|^\s*\d+[.)]\s/.test(body);
  let doc = null;
  if (safe) {
    doc = markdownToDoc(readableBlock(raw.slice(frame.start, frame.end)), { links: true });
    const nodes = doc.content || [], node = nodes[0];
    safe = nodes.length === 1 && treeWords(doc) === words && (frame.kind === "paragraph" ? node?.type === "paragraph" : frame.kind === "heading" ? node?.type === "heading" && node.attrs?.level === frame.level : node?.type === "blockquote" && node.content?.length === 1 && node.content[0].type === "paragraph");
    if (!safe) doc = null;
  }
  return { words, runs, notes, safe, doc, blockKind: frame.kind, level: frame.level, frame, reworks };
}
function render(snapshot) {
  return snapshot.prefix + snapshot.blocks.map((b) => b.raw + b.separator).join("");
}
function capture(raw, sourceKey) {
  const m = documentParts(raw, false), blocks = [], fileHash = hash2(raw);
  let offset = m.prefix.length;
  for (let i = 0; i < m.parts.length; i++) {
    if (m.separators.has(i)) conflict("Unexpected donor separator topology.");
    const block = m.parts[i], separator = m.separators.has(i + 1) ? m.parts[++i] : "";
    blocks.push({ id: randomUUID2(), raw: block, separator, origin: { fileHash, blockHash: hash2(block), offset } });
    offset += block.length + separator.length;
  }
  const out = { schema: "mag-dev-correspondence.v1", sourceKey, fileHash, prefix: m.prefix, blocks };
  if (render(out) !== raw) conflict("Donor projection did not retain exact bytes.");
  return out;
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
  const text2 = (value, extra = []) => {
    const all = [...marks, ...extra].map((mark) => ({ type: mark.type, attrs: { ...mark.attrs } }));
    value.split("\n").forEach((piece, index) => {
      if (index > 0) out.push({ type: "hardBreak" });
      if (piece) out.push(all.length ? { type: "text", text: piece, marks: all } : { type: "text", text: piece });
    });
  };
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        text2(node.value);
        break;
      case "strong":
        out.push(...inlineChildren2(node.children, source, [...marks, { type: "bold", attrs: { markup: delimiterAt2(source, node, "**") } }]));
        break;
      case "emphasis":
        out.push(...inlineChildren2(node.children, source, [...marks, { type: "italic", attrs: { markup: delimiterAt2(source, node, "_") } }]));
        break;
      case "inlineCode":
        text2(node.value, [{ type: "code", attrs: {} }]);
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
        if ("value" in node && typeof node.value === "string") text2(node.value);
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
function markdownToDoc2(text2, options = {}) {
  const content = blockChildren2(fromMarkdown4(text2, options.links ? LINK_PARSE_OPTIONS : PARSE_OPTIONS).children, text2);
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
function splitBlocks2(md) {
  const fm = (md.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/) || [""])[0];
  return { fm, parts: md.slice(fm.length).split(/(\r?\n\s*\r?\n)/) };
}
var protectedMarks2 = /%%[\s\S]*?%%|<!--[\s\S]*?-->/g;
function plain2(raw) {
  return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "/$1/").replace(/\s*%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/^>\s?/gm, "").replace(/^#{1,6}\s+/, "").replace(/==([\s\S]*?)==/g, "$1").replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1").replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}
function editable2(raw) {
  const t = raw.trim();
  if (!t || t === "---" || /^%%[\s\S]*%%$/.test(t) || /^<!--[\s\S]*-->$/.test(t) || /^\|/.test(t) || /^```/.test(t) || /^~~~/.test(t)) return false;
  if (/^[-*] /m.test(t) && t.split("\n").every((line) => /^\s*([-*] |\d+\. )/.test(line) || /^\s+/.test(line))) return false;
  if (/^\d+[.)] /m.test(t)) return false;
  if (/^\*\*[^*]+:\*\*\s*$/m.test(t.split("\n")[0])) return false;
  return true;
}
function documentParts2(raw, protectGuidanceQueue = true) {
  const projection2 = protectGuidanceQueue ? guidanceRegions2(raw) : { prefix: splitBlocks2(raw).fm, regions: [{ raw: raw.slice(splitBlocks2(raw).fm.length), pending: false }] };
  const parts = [], blocks = [], separators = /* @__PURE__ */ new Set();
  for (const region of projection2.regions) {
    if (region.pending) {
      parts.push(region.raw);
      continue;
    }
    const chunk = region.raw.split(/(\r?\n\s*\r?\n)/);
    for (let index = 0; index < chunk.length; index++) {
      const partIndex = parts.length, part = chunk[index];
      parts.push(part);
      if (index % 2) separators.add(partIndex);
      else blocks.push({ index: blocks.length, partIndex, raw: part, plain: plain2(part), editable: editable2(part) });
    }
  }
  if (!blocks.some((block) => block.raw.trim()) && blocks[0]) blocks[0].editable = true;
  return { prefix: projection2.prefix, suffix: "", parts, blocks, separators };
}
function readableBlock2(raw) {
  return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, "/$1/").replace(protectedMarks2, "").replace(/==([\s\S]*?)==/g, "**$1**").replace(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g, "$2");
}

// src/workspaces/articleComposition.ts
var empty = () => ({ schema: ARTICLE_COMPOSITION_SCHEMA, form: "story", opening: [], parts: [], ending: { blocks: [] } });
var textOf = (node) => node.type === "text" ? node.text || "" : node.type === "hardBreak" ? "\n" : node.type === "referenceCard" ? `Reference \xB7 ${node.attrs?.sourceTitle || "Source"} ${node.attrs?.text || ""}` : (node.content || []).map(textOf).join(node.type === "doc" ? "\n" : "");
var acceptedText = (p) => textOf(p.doc);
var role = (p) => {
  const node = p.doc.content?.[0], text2 = acceptedText(p).trim();
  if (p.doc.content?.length === 1 && /^[“"][\s\S]*[”"]$/.test(text2)) {
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
      const part = { titleId: p.id, blocks: [] };
      layout.parts.push(part);
      target = part.blocks;
    } else target.push({ kind: role(p), paragraphId: p.id });
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
  const fail2 = (message) => {
    throw new Error("Article layout: " + message);
  };
  const readable = (chunk) => readableBlock2(chunk.replaceAll("==", "\0approval\0")).replaceAll("\0approval\0", "==").trim();
  const consume = (chunk) => {
    const text2 = readable(chunk), p = paragraphs[cursor++];
    if (!p || JSON.stringify(markdownToDoc2(text2, { links: true })) !== JSON.stringify(p.doc)) fail2("the DEV receipt no longer matches the accepted paragraphs. Capture layout when accepting the draft.");
    return p;
  };
  const photoNote = (text2) => {
    const [file, alt = "", ...rest] = text2.split(" \xB7 "), words = [], opts = {};
    for (const word of rest.join(" \xB7 ").split(/\s+/).filter(Boolean)) {
      const pair = word.match(/^(\w+)=(.+)$/);
      if (pair) opts[pair[1]] = pair[2];
      else if (/^\d+\/\d+$/.test(word)) opts.aspect = word;
      else words.push(word);
    }
    return { file: file.trim(), alt: alt.trim(), words, opts };
  };
  const photo = (note2, cover = false) => {
    const slot = cover ? "cover" : "article-photo-" + (placements.filter((p) => p.slot !== "cover").length + 1);
    if (placements.some((p) => p.slot === slot)) fail2("a cover photo is repeated.");
    const focal = (v) => v === void 0 ? 0.5 : Number(v);
    const x = focal(note2.opts.x), y = focal(note2.opts.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) fail2("a photo focal point must be between zero and one.");
    placements.push({ slot, url: "", x, y, zoom: 1, alt: note2.alt, paragraphId: null });
    photoRequests.push({ slot, file: note2.file });
    return slot;
  };
  const note = (chunk, tag) => chunk.match(new RegExp(`^%%${tag}:\\s*([^%]*)%%`))?.[1]?.trim();
  const wordsBlock = (p) => ({ kind: role(p), paragraphId: p.id });
  for (const chunk of chunks) {
    if (chunk === "---") continue;
    if (chunk === "%%ending%%") {
      if (stack.length) fail2("close the side or glyph before ending.");
      where = "ending";
      pendingFollow = void 0;
      continue;
    }
    if (chunk === "%%/side%%" || chunk === "%%/glyph%%") {
      if (stack.at(-1)?.kind !== (chunk === "%%/side%%" ? "side" : "glyph")) fail2("a side or glyph closing note does not match its frame.");
      stack.pop();
      continue;
    }
    const shown = readable(chunk);
    if (/^## /.test(shown)) {
      if (stack.length || where === "ending" || where === "closing") fail2("a chapter heading is out of order.");
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
        const part = layout.parts.at(-1);
        if (where !== "parts" || !part || part.blocks.length || part.openerSlot || stack.length) fail2("an opener belongs directly after a chapter heading.");
        part.openerSlot = slot;
      } else if (p2.words.includes("bleed")) target().push({ kind: "bleed", slot });
      else target().push({ kind: "wide", slot, ...p2.opts.aspect ? { aspect: p2.opts.aspect } : {}, ...p2.words.includes("narrow") ? { narrow: true } : {}, ...p2.words.includes("left") ? { offset: "left" } : p2.words.includes("right") ? { offset: "right" } : {} });
      if (shown) fail2("a photo note must be separate from prose.");
      continue;
    }
    if ((n = note(chunk, "photos")) !== void 0) {
      const notes = n.split(" | ").map(photoNote), last = notes.at(-1);
      target().push({ kind: "photos", slots: notes.map((p2) => photo(p2)), ...last.opts.aspect ? { aspect: last.opts.aspect } : {}, ...last.words.includes("stagger") ? { stagger: true } : {}, ...last.words.includes("narrow") ? { narrow: true } : {} });
      if (shown) fail2("a photo pair note must be separate from prose.");
      continue;
    }
    if ((n = note(chunk, "side")) !== void 0) {
      const p2 = photoNote(n), b = { kind: "side", slot: photo(p2), blocks: [], ...p2.words.includes("flip") ? { flip: true } : {}, ...p2.words.includes("bleed") ? { bleed: true } : {} };
      target().push(b);
      stack.push(b);
      if (shown) fail2("a side note must precede its prose.");
      continue;
    }
    if ((n = note(chunk, "glyph")) !== void 0) {
      const b = { kind: "glyph", glyph: n, blocks: [] };
      target().push(b);
      stack.push(b);
      if (shown) fail2("a glyph note must precede its prose.");
      continue;
    }
    if ((n = note(chunk, "pull")) !== void 0) {
      const p2 = consume(chunk), [size, ...options] = n.split(/\s+/);
      if (size === "hook") {
        if (layout.hookId) fail2("the hook is repeated.");
        layout.hookId = p2.id;
        continue;
      }
      if (!["xl", "l", "m"].includes(size)) fail2("a pull size must be xl, l or m.");
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
      if (where !== "ending" || stack.length || layout.ending.sayingId) fail2("the saying belongs once after ending.");
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
      if (layout.closingId) fail2("the closing has more than one paragraph.");
      layout.closingId = p.id;
      continue;
    }
    if (pendingFollow && role(p) === "a") {
      pendingFollow.followId = p.id;
      pendingFollow = void 0;
      continue;
    }
    pendingFollow = void 0;
    if (where === "opening" && !layout.introId && !layout.opening.length && !stack.length && role(p) === "n") layout.introId = p.id;
    else target().push(wordsBlock(p));
  }
  if (stack.length) fail2("a side or glyph frame was not closed.");
  if (cursor !== paragraphs.length) fail2("the DEV receipt omits accepted paragraphs.");
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
    const text2 = plainText(p.doc);
    if (text2.trim()) slides.push({ id: uid(), role: "inner", text: text2, credit: p.attributions.map((a) => a.author || a.sourceTitle).filter((v, i, a) => a.indexOf(v) === i).join(" \xB7 "), template: "M12", photos: [], paragraphIds: [p.id] });
  }
  const { articleComposition, articleCompositionNotice, ...carouselBase } = base;
  return { ...carouselBase, placements: [], kind: "carousel", outputRevision: 0, slides, caption: "", stage: "words" };
}

// src/workspaces/editorial-state.mjs
var protectedEditorial = /%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`/g;
var personalNoteQuestions = (raw) => [...String(raw || "").matchAll(/%%\s*you\s*:\s*([\s\S]*?)%%/gi)].map((match) => match[1].trim().replace(/\s+/g, " ")).filter(Boolean);
function approvalMarks(raw) {
  const text2 = String(raw || "").replace(protectedEditorial, "");
  const pairs = [...text2.matchAll(/==(?=\S)([\s\S]*?\S)==/g)].length, remaining = text2.replace(/==(?=\S)([\s\S]*?\S)==/g, "");
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
  const words = output?.kind === "carousel" ? [output.title || fallback.title || "", output.caption || "", ...(output.slides || []).flatMap((slide) => [slide.text || "", slide.label ?? output.importedDraft?.label ?? output.title ?? fallback.title ?? "", slide.credit || ""])] : [output?.title || fallback.title || "", ...(output?.manuscript || fallback.paragraphs || []).flatMap((paragraph) => [nodeText(paragraph.doc), ...(paragraph.attributions || []).flatMap((source) => [source.sourceTitle || "", source.author || "", typeof source.locator === "string" ? source.locator : source.locator?.path || source.locator?.page || source.locator?.lineStart || ""])]), ...(output?.placements || []).flatMap((photo) => [photo.caption || "", photo.alt || ""])];
  return words.reduce((issues, word) => ({ approvalTokens: issues.approvalTokens + approvalMarks(word).tokens, personalNotes: issues.personalNotes + personalNoteQuestions(word).length }), { approvalTokens: 0, personalNotes: 0 });
}
function assertOutputEditorialReady(output, fallback) {
  const issues = outputEditorialIssues(output, fallback);
  if (issues.approvalTokens) throw Error("Approve or remove marked prose (==\u2026==) in Writing content before arranging visuals or exporting a public file.");
  if (issues.personalNotes) throw Error("Remove editorial %%you%% notes from the visible wording before arranging or exporting. Personal contribution is optional; you can skip it.");
  return true;
}

// services/native-output-seam.ts
var stable = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
var same = (a, b) => stable(a) === stable(b);
var fail = (message) => {
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
var text = (v, label) => typeof v === "string" && v.isWellFormed() && v.trim() ? v : fail(label + " requires exact readable text.");
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
function sources(snapshot) {
  return (snapshot.context?.records || []).filter((r) => r.role !== "draft").map((r) => {
    const hash = r.copiedHash ?? r.hash ?? null;
    if (!r.missing && (typeof r.raw !== "string" || !HASH.test(hash || "") || digest(r.raw) !== hash)) fail("Native retained source capture hash changed.");
    return { id: r.id, role: r.role, sourcePath: r.sourcePath ?? r.path ?? null, hash, missing: !!r.missing };
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
function validate(snapshot, emptyBoundaries = false) {
  if (snapshot.binding?.authority !== "owned-working-copy" || snapshot.binding.status !== "ready" || snapshot.readiness?.ready !== true) fail("A ready exact owned native snapshot is required.");
  if (Buffer.byteLength(snapshot.raw || "") > 2 * 1024 * 1024) fail("Native capture exceeds the existing two-megabyte document bound.");
  text(snapshot.binding.id, "Native binding");
  text(snapshot.binding.parentStudyId, "Native parent");
  text(snapshot.raw, "Native raw");
  if (snapshot.expected?.workflow?.draft !== digest(snapshot.raw) || !Array.isArray(snapshot.projection)) fail("Native expected raw hash or projection changed.");
  const model = capture(snapshot.raw, "native-output-probe");
  const modelRows = emptyBoundaries ? model.blocks.filter((b) => b.raw.trim()) : model.blocks, projectionRows = emptyBoundaries ? snapshot.projection.filter((b) => b.raw.trim()) : snapshot.projection;
  if (render(model) !== snapshot.raw || modelRows.length !== projectionRows.length) fail("Native donor topology or exact raw bytes changed.");
  const ids = /* @__PURE__ */ new Set();
  for (const row of snapshot.projection) {
    if (!row.id || ids.has(row.id) || (row.raw.trim() || !emptyBoundaries) && row.raw !== modelRows[projectionRows.indexOf(row)]?.raw || row.blockHash !== digest(row.raw)) fail("Native paragraph identity/raw/block hash changed.");
    ids.add(row.id);
    const mapped = inlineMap(row.raw);
    for (const key of ["safe", "words", "doc", "blockKind", "level", "notes"]) if (!same(row[key], mapped[key])) fail("Native projection differs from its authoritative donor mapping.");
  }
  return sources(snapshot);
}
function captureNativeOutput(snapshot, scope, options = {}) {
  if (options.outputKind !== void 0 && !["post", "product-listing"].includes(options.outputKind)) fail("Unsupported text output kind.");
  const sourceProof = validate(snapshot, !!options.outputKind);
  for (const key of ["projectId", "documentId", "outputId"]) text(scope[key], key);
  const photoBindings = structuredClone(options.photoBindings || []);
  if (!Array.isArray(photoBindings) || photoBindings.length > 200) fail("Explicit bounded original-file to Library photo bindings required.");
  const photoNames = /* @__PURE__ */ new Set();
  for (const row of photoBindings) {
    if (Object.keys(row).some((k) => !["nativeFile", "sourceId", "sourceHash"].includes(k)) || !row.nativeFile || !row.sourceId || !HASH.test(row.sourceHash) || photoNames.has(row.nativeFile)) fail("Photo binding identity/hash must be explicit and unique.");
    photoNames.add(row.nativeFile);
  }
  const original = structuredClone(snapshot), paragraphs = [], mapping = [], held = [];
  const blocks = documentParts2(snapshot.raw, false).blocks, header = (raw) => !raw.trim() || /^#\s/.test(raw.trim()) || credits.test(raw.trim());
  const boundary = blocks.findIndex((b) => b.raw.trim() === "---");
  let first = 0;
  while (first < blocks.length && header(blocks[first].raw)) first++;
  const storyStart = options.outputKind ? 0 : boundary >= 0 && blocks.slice(0, boundary).every((b) => header(b.raw)) ? boundary + 1 : first;
  for (const [index, row] of snapshot.projection.entries()) {
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
    const readable = readableBlock2(row.raw.replaceAll("==", "\0native-approval\0")).replaceAll("\0native-approval\0", "==").trim();
    if (!readable) {
      item.disposition = directives.some(({ tag }) => knownLayout.has(tag)) ? "native-layout-directive" : "private-editorial-metadata";
      continue;
    }
    if (approvalMarks(readable).tokens) {
      held.push({ nativeId: row.id, category: "unresolved-native-approval", reason: "Existing /mag wholeDraft/editorial-state treats these == marks as unresolved approval; native.editable/safe is not an approval receipt." });
      continue;
    }
    if (unsafeMarkdown(readable)) {
      held.push({ nativeId: row.id, category: "unsupported-rich-structure", reason: "Existing output Markdown grammar cannot faithfully represent this table/fence/raw HTML/image/strike block." });
      continue;
    }
    let doc, markdown;
    try {
      doc = markdownToDoc2(readable, { links: true });
      markdown = structuredMarkdown(doc);
    } catch (error) {
      held.push({ nativeId: row.id, category: "unsafe-link-or-rich-format", reason: error.message });
      continue;
    }
    if (!supportedTree(doc) || markdown !== readable) {
      held.push({ nativeId: row.id, category: "nonlossless-markdown", reason: "Existing output Markdown bridge cannot roundtrip this protected native block exactly." });
      continue;
    }
    const paragraph = { id: row.id, doc: structuredClone(doc), text: markdown, attributions: [], kept: [], origin: "source" };
    paragraphs.push(paragraph);
    item.disposition = "immutable-output-passage";
    item.outputParagraphId = row.id;
    item.publishedWordsHash = digest(plainText(doc));
    item.publishedMarkdownHash = digest(markdown);
    item.transforms = [...hidden.length ? ["native-notes-retained-private-with-codec-layout-handlers"] : [], ...terms.length ? ["existing-mag-protected-term-display-label"] : [], ...row.safe === false ? ["protected-block-exact-markdown-roundtrip"] : []];
  }
  if (!options.outputKind && !paragraphs.length && !held.length) held.push({ nativeId: null, reason: "Native snapshot contains no supported publishable passage." });
  const document = { schema: "ar-create.document.v1", id: scope.documentId, revision: 0, title: text(snapshot.binding.title, "Native title"), paragraphs, outputs: [] };
  let output = null, photoRequests = [];
  if (!held.length) {
    try {
      if (options.outputKind) {
        output = { ...snapshotOutput(document), id: scope.outputId, kind: options.outputKind, placements: [] };
        assertOutputEditorialReady(output);
      } else {
        const composed = captureArticleComposition(paragraphs, snapshot.raw);
        photoRequests = composed.photoRequests.map((request) => {
          const bound = photoBindings.find((p) => p.nativeFile === request.file);
          return { slot: request.slot, nativeFile: request.file, sourceId: bound?.sourceId || null, sourceHash: bound?.sourceHash || null, resolved: !!bound };
        });
        if (photoBindings.some((bound) => !photoRequests.some((request) => request.nativeFile === bound.nativeFile))) fail("Explicit photo binding does not belong to this native layout.");
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
  const payload = { schema: "ar-create.native-output-probe.v1", role: "immutable-native-output-capture-not-a-second-editable-manuscript", scope: structuredClone(scope), ...options.outputKind ? { outputKind: options.outputKind } : {}, ready: !held.length, mediaReady: photoRequests.every((p) => p.resolved), held, nativeProof: { bindingId: snapshot.binding.id, parentStudyId: snapshot.binding.parentStudyId, expected: structuredClone(snapshot.expected), rawHash: digest(snapshot.raw), sourceProof, photoProof: photoBindings, projectionHash: digest(stable(snapshot.projection)) }, output, outputHash: output ? digest(stable(output)) : null, privateSidecar: { nativeSnapshot: original, mapping, photoBindings, photoRequests }, sourceIdentityPolicy: "Native source identities/protected term IDs retained privately; no paragraph source attribution or authorship inferred." };
  return freeze({ ...payload, captureHash: digest(stable(payload)) });
}
function nativeOutputRenderDocument(value) {
  if (!value.ready || !value.output) fail("Native output capture is held; do not render a partial manuscript.");
  return freeze({ schema: "ar-create.document.v1", id: value.scope.documentId, revision: value.output.manuscriptRevision, title: value.output.title, paragraphs: value.output.manuscript, outputs: [value.output] });
}
function reopenNativeOutput(bytes) {
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    fail("Captured native output is malformed.");
  }
  ;
  const { captureHash, ...payload } = value;
  if (value.schema !== "ar-create.native-output-probe.v1" || captureHash !== digest(stable(payload)) || value.outputHash !== (value.output ? digest(stable(value.output)) : null)) fail("Captured native output or sidecar integrity changed.");
  validate(value.privateSidecar.nativeSnapshot, !!value.outputKind);
  const derived = captureNativeOutput(value.privateSidecar.nativeSnapshot, value.scope, { photoBindings: value.privateSidecar.photoBindings, ...value.outputKind ? { outputKind: value.outputKind } : {} }), published = (o) => o ? { ...o, createdAt: void 0 } : null;
  if (!same(value.nativeProof, derived.nativeProof) || !same(value.privateSidecar.mapping, derived.privateSidecar.mapping) || !same(published(value.output), published(derived.output)) || !same(value.held, derived.held) || !same(value.privateSidecar.photoRequests, derived.privateSidecar.photoRequests) || value.mediaReady !== derived.mediaReady || value.ready !== derived.ready) fail("Output wording/structure does not match its exact native source capture.");
  return freeze(value);
}
function nativeOutputFreshness(value, current, currentSources, currentPhotos) {
  const captureValue = reopenNativeOutput(JSON.stringify(value));
  try {
    const proof = validate(current, !!captureValue.outputKind);
    if (captureValue.nativeProof.bindingId !== current.binding.id || captureValue.nativeProof.parentStudyId !== current.binding.parentStudyId || captureValue.nativeProof.rawHash !== digest(current.raw) || !same(captureValue.nativeProof.expected, current.expected) || captureValue.nativeProof.projectionHash !== digest(stable(current.projection))) return { stale: true, reason: "Exact native revision/paragraph identity changed; output retained, no native rewrite." };
    if (!same(captureValue.nativeProof.sourceProof, proof)) return { stale: true, reason: "Native retained source capture changed." };
    if (captureValue.nativeProof.photoProof.length && !same(captureValue.nativeProof.photoProof, currentPhotos)) return { stale: true, reason: "Explicit Library photo identity/hash changed or its live proof was not supplied." };
    if (proof.length) {
      if (!Array.isArray(currentSources) || !same(proof, currentSources)) return { stale: true, reason: "Current authoritative original source identities/hashes differ or were not supplied." };
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
  const bytes = new TextEncoder().encode(JSON.stringify(carouselWordsRecord(output)));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// services/native-output-helpers.ts
var mapper = { capture: captureNativeOutput, reopen: reopenNativeOutput, freshness: nativeOutputFreshness, renderDocument: nativeOutputRenderDocument };
var helpers = { snapshotCarousel, reconcileArticleComposition, articleCompositionIssue, assertOutputEditorialReady, carouselWordsHash };
export {
  helpers,
  mapper
};
