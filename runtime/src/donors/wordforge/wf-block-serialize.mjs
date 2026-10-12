import {fromMarkdown} from 'mdast-util-from-markdown';
import {safePassageHref} from './passage-links.mjs';
import {LINK_PARSE_OPTIONS} from './wf-markdown-options.mjs';
function escapeInline(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const prev = text[i - 1] ?? " ";
    const next = text[i + 1] ?? " ";
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
const MARK_ORDER = ["link", "bold", "italic", "code"];
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
    let text = run.text;
    closeTo(sharedPrefix(active, run.marks));
    const opening = run.marks.slice(active.length);
    if (opening.length) {
      const leading = text.match(/^\s+/)?.[0] ?? "";
      out += leading;
      text = text.slice(leading.length);
    }
    for (const mark of opening) {
      out += delimiterFor(mark);
      active.push(mark);
    }
    const next = runs[index + 1];
    const keepAfter = next && "text" in next ? sharedPrefix(active, next.marks) : 0;
    const trailing = active.length > keepAfter ? text.match(/\s+$/)?.[0] ?? "" : "";
    const body = trailing ? text.slice(0, -trailing.length) : text;
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
function indentContinuation(text, indent) {
  return text.split("\n").map((line, i) => i === 0 || line === "" ? line : indent + line).join("\n");
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
export {
  docToMarkdown
};
