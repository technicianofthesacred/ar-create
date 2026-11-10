// Making an SVG safe to keep as a look's mark or graphic. An SVG is a document that can carry scripts, event handlers,
// embedded HTML (foreignObject) and references to other addresses; none of that belongs in a mark. The file is read as
// tags and text, and written out again with those parts removed:
//   - script, style, foreignObject, iframe, embed, object, image, a, audio, video, canvas, the animation elements
//     (animate, set, animateMotion, animateTransform, which can rewrite a link) and their contents;
//   - every attribute whose name starts with "on" (an event handler);
//   - every href or xlink:href that is not a reference inside the file (#id), and every url(...) that is not url(#id);
//   - comments, processing instructions and CDATA sections.
// A file with a DOCTYPE or an ENTITY is refused whole (entities can expand without end or reach other files). So is
// anything that cannot be read as plain tags, or that does not start with an <svg> element. The result is plain markup
// a person can read. In the app it is only ever shown as an image, which never runs scripts either.
import {StateError} from '../store.mjs';

export const MAX_SVG_BYTES = 512 * 1024;
const fail = message => { throw new StateError(message, 415); };
const DROP = new Set(['script', 'style', 'foreignobject', 'iframe', 'embed', 'object', 'image', 'a', 'audio', 'video', 'canvas', 'animate', 'set', 'animatemotion', 'animatetransform', 'discard', 'handler', 'listener', 'meta', 'base', 'link']);
const ATTR = /\s+([A-Za-z_][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;
const escAttr = s => String(s).replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = s => String(s).replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const outside = v => /url\(\s*(?!['"]?#)/i.test(v) || /(?:javascript|vbscript|data|https?|file|ftp)\s*:/i.test(v) || /@import|expression\s*\(/i.test(v);

/** The SVG made safe, as bytes; refuses (415) a file that cannot be made safe or is not an SVG. Reports what it removed. */
export function cleanSvg(bytes) {
 const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? '');
 if (!buf.length || buf.length > MAX_SVG_BYTES) fail('An SVG is a file of up to ' + MAX_SVG_BYTES / 1024 + ' KB.');
 let src = buf.toString('utf8');
 if (src.includes('�')) fail('This SVG is not plain UTF-8 text.');
 src = src.replace(/^\ufeff/, '');
 if (/<!DOCTYPE|<!ENTITY/i.test(src)) fail('This SVG declares a DOCTYPE or ENTITY, which is not kept. Save it again without one.');
 const out = [], stack = [], removed = new Set();
 let i = 0, dropping = 0, root = false;
 while (i < src.length) {
  if (src.startsWith('<!--', i)) { const end = src.indexOf('-->', i + 4); if (end < 0) fail('This SVG has a comment that never ends.'); i = end + 3; continue; }
  if (src.startsWith('<![CDATA[', i)) { const end = src.indexOf(']]>', i); if (end < 0) fail('This SVG has a CDATA section that never ends.'); removed.add('CDATA'); i = end + 3; continue; }
  if (src.startsWith('<?', i)) { const end = src.indexOf('?>', i); if (end < 0) fail('This SVG cannot be read.'); i = end + 2; continue; }
  if (src[i] === '<') {
   const close = /^<\/([A-Za-z_][\w:.-]*)\s*>/.exec(src.slice(i, i + 200));
   if (close) {
    const name = close[1].toLowerCase(), top = stack.pop();
    if (!top || top.raw.toLowerCase() !== name) fail('This SVG\'s tags do not close in order.');
    if (top.dropped) dropping--; else if (!dropping) out.push('</' + top.raw + '>');
    i += close[0].length; continue;
   }
   const open = /^<([A-Za-z_][\w:.-]*)/.exec(src.slice(i, i + 200));
   if (!open) fail('This SVG cannot be read as plain tags.');
   // Elements and attributes are judged by their local name, whatever prefix they carry (s:script is a script).
   const raw = open[1], name = raw.toLowerCase().split(':').pop();
   let j = i + open[0].length;
   const attrs = [];
   for (;;) { ATTR.lastIndex = j; const m = ATTR.exec(src); if (!m) break; attrs.push([m[1], m[2] ?? m[3] ?? '']); j = ATTR.lastIndex; }
   const end = /^\s*(\/?)>/.exec(src.slice(j, j + 40));
   if (!end) fail('This SVG has a tag that cannot be read (' + raw + ').');
   i = j + end[0].length;
   if (!stack.length && !root) { if (name !== 'svg') fail('This file does not start with an <svg> element.'); root = true; }
   else if (!stack.length) fail('This SVG has something after its <svg> element.');
   const selfClosing = end[1] === '/', drop = dropping > 0 || DROP.has(name);
   if (DROP.has(name)) removed.add(name);
   if (!selfClosing) stack.push({name, raw, dropped: drop});
   if (drop) { if (!selfClosing) dropping++; continue; }
   const kept = [];
   for (const [a, v] of attrs) {
    const local = a.toLowerCase().split(':').pop();
    if (local.startsWith('on')) { removed.add('event handlers'); continue; }
    if (local === 'href' && !/^#[\w.-]+$/.test(v.trim())) { removed.add('outside references'); continue; }
    if (outside(v)) { removed.add('outside references'); continue; }
    if (local === 'base' || local === 'externalresourcesrequired') { removed.add('outside references'); continue; }
    kept.push(a + '="' + escAttr(v) + '"');
   }
   out.push('<' + raw + (kept.length ? ' ' + kept.join(' ') : '') + (selfClosing ? '/>' : '>'));
   continue;
  }
  const next = src.indexOf('<', i), text = src.slice(i, next < 0 ? src.length : next);
  if (stack.length && !dropping) out.push(escText(text));
  else if (!stack.length && text.trim() && root) fail('This SVG has something after its <svg> element.');
  else if (!stack.length && text.trim()) fail('This file does not start with an <svg> element.');
  i = next < 0 ? src.length : next;
 }
 if (!root) fail('This file is not an SVG.');
 if (stack.length) fail('This SVG ends before its tags close.');
 return {bytes: Buffer.from(out.join('') + '\n', 'utf8'), removed: [...removed].sort()};
}
