// A Carousel template written as markup, by an assistant or by hand: checked hard before it is kept, and drawn the way
// the shipped catalogue is drawn. Plain and browser-safe: it reads no files.
//
// Checking is by ALLOWLIST, never by blocklist. The markup is parsed into tags, attributes, inline style properties and
// text, and each one must be on the list below or the whole template is refused with the reason. Then it is written out
// again from what was parsed, so nothing the parser did not understand can pass through. The list is what the shipped
// layouts already use (ig-original-layouts.json and the hand-written layouts in ig-templates.js); the tests hold the two
// together, and check every refusal.
//
// A template is one 1080 by 1350 slide. It uses the catalogue's slots and nothing else:
//   <img src="__IG_PHOTO_0__">  a photo        background-image: __IG_BG_0__ (or url(__IG_PHOTO_0__))  a photo as a ground
//   __IG_TEXT_0__ ... __IG_TEXT_3__  his words  __IG_LABEL__  the label      __IG_CREDIT__  the credit
//   <img src="__IG_LOGO__">     the look's logo
// Colours are the look's roles, written {dark.ground} ... {light.accent}, or the colour a look gives one of its roles
// (the Teajia values the catalogue is written in, or a value of the look the template is for); the fades of the dark
// ground and the headline colour as rgba(26,23,20,a) and rgba(243,234,218,a); and transparent. Type is {fonts.headline},
// {fonts.body} or {fonts.label}, or the stacks the catalogue writes. Everything is stored in the catalogue's own values, so
// the one renderer (ig-look-render.mjs) draws it in any look exactly as it draws a shipped layout.
import {TEAJIA_SOURCE, TONES, COLOR_ROLES} from './ig-look-render.mjs';

export const SLIDE = Object.freeze({width: 1080, height: 1350});
export const MAX_MARKUP = 64 * 1024;
const MAX_ELEMENTS = 400, MAX_DEPTH = 24, MAX_FIXED = 3, MAX_PHOTOS = 4, MAX_TEXTS = 4;

/* ---------- THE ALLOWLIST (one place) ---------- */
const NUM = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const DIGIT = /^[0-9]$/, NUMBER = /^\d{1,4}(?:\.\d{1,3})?$/;
/** Tags, and the attributes each may carry with the values each may take. */
export const ALLOWED_TAGS = Object.freeze({
 div: Object.freeze({
  style: 'style', 'data-edit': /^(?:text|label|credit)$/, 'data-base-font-size': NUMBER, 'data-text-zone': /^$/, 'data-text-part': DIGIT,
  'data-slot': DIGIT, 'data-ig-photo': DIGIT, 'data-ig-background': DIGIT, 'data-ig-box-width': NUMBER, 'data-ig-box-height': NUMBER,
  'data-ig-img-width': NUMBER, 'data-ig-img-height': NUMBER, 'data-ig-origin-x': NUMBER, 'data-ig-origin-y': NUMBER,
  'aria-hidden': /^true$/, 'aria-label': /^[A-Za-z0-9 .,'-]{1,60}$/, lang: /^(?:zh-Hant|en)$/,
 }),
 span: Object.freeze({style: 'style', 'data-edit': /^(?:text|label|credit)$/, 'data-base-font-size': NUMBER}),
 img: Object.freeze({src: 'src', alt: /^[^<>"&]{0,40}$/, style: 'style', draggable: /^false$/}),
 br: Object.freeze({}),
});
const VOID = new Set(['img', 'br']);
const kw = (...words) => new RegExp('^(?:' + words.join('|') + ')$');
const len = (max, {pct = true, auto = false, none = false} = {}) => ({len: true, max, pct, auto, none});
/** Inline style properties, and the values each may take. */
export const ALLOWED_STYLE = Object.freeze({
 position: kw('relative', 'absolute'), display: kw('flex', 'block', 'grid'), 'flex-direction': kw('column', 'row'),
 'align-items': kw('center', 'flex-start', 'flex-end', 'baseline', 'stretch'), 'align-self': kw('flex-start', 'flex-end', 'center', 'stretch'),
 'justify-content': kw('center', 'flex-start', 'flex-end', 'space-between'), 'box-sizing': kw('border-box'), overflow: kw('hidden'),
 'overflow-wrap': kw('anywhere'), 'white-space': kw('pre-wrap', 'nowrap'), isolation: kw('isolate'), 'writing-mode': kw('vertical-rl'),
 'text-align': kw('center', 'left', 'right'), 'text-transform': kw('uppercase'), 'background-clip': kw('text'), '-webkit-background-clip': kw('text'),
 'mix-blend-mode': kw('multiply', 'screen'), 'object-fit': kw('cover', 'contain'), 'font-weight': kw('400', '500', '600', '700', '800', '900'),
 flex: /^\d{1,2} \d{1,2} 0$/, 'flex-grow': /^\d$/, 'flex-shrink': /^\d$/, opacity: /^(?:0|1|0?\.\d{1,3}|1\.0{1,3})$/, 'line-height': /^(?:[0-2](?:\.\d{1,3})?|\.\d{1,3}|3)$/,
 'grid-template-columns': /^repeat\([1-6], minmax\(0, 1fr\)\)$/,
 left: len(1080), right: len(1080), width: len(1080), 'min-width': len(1080), 'max-width': len(1080, {none: true}),
 top: len(1350), bottom: len(1350), height: len(1350),
 inset: {list: 4, of: len(1350)}, padding: {list: 4, of: len(540, {pct: false})}, 'padding-top': len(540, {pct: false}), gap: len(540, {pct: false}),
 'font-size': {px: [8, 1350]}, 'letter-spacing': /^(?:0|-?0?\.\d{1,3}em|-?1em|\d{1,2}px)$/,
 'background-size': /^(?:cover|contain|(?:\d{1,4}%|auto|\d{1,4}px)(?: (?:\d{1,4}%|auto|\d{1,4}px))?)$/,
 'background-position': /^(?:\d{1,3}%|\d{1,4}px|center|left|right|top|bottom)(?: (?:\d{1,3}%|\d{1,4}px|center|left|right|top|bottom))?$/,
 'object-position': /^(?:\d{1,3}%|\d{1,4}px|center|left|right|top|bottom)(?: (?:\d{1,3}%|\d{1,4}px|center|left|right|top|bottom))?$/,
 filter: /^(?:(?:grayscale|contrast|brightness)\((?:[01](?:\.\d{1,3})?|\.\d{1,3}|2)\)(?: |$)){1,4}$/,
 color: 'colour', '-webkit-text-fill-color': 'colour', background: 'ground', 'background-image': 'image',
 '-webkit-text-stroke': 'stroke', 'border-top': 'border', 'font-family': 'font',
});
/** The type stacks the catalogue writes (ig-look-render.mjs maps each to the look's), and the role names that stand for them. */
export const ALLOWED_FONTS = Object.freeze(['Caudex, Georgia, serif', 'Caudex,Georgia,serif', "'EB Garamond', Georgia, serif", "'EB Garamond',Georgia,serif", "'Shippori Mincho', 'Noto Serif TC', serif", 'Shippori Mincho,serif', "'Noto Serif TC', serif"]);
const FONT_ROLE = Object.freeze({'{fonts.headline}': 'Caudex, Georgia, serif', '{fonts.label}': 'Caudex, Georgia, serif', '{fonts.body}': "'EB Garamond', Georgia, serif"});
/** The slots, each where it may stand. */
export const SLOTS = Object.freeze({photo: /^__IG_PHOTO_([0-3])__$/, background: /^__IG_BG_([0-3])__$/, text: /^__IG_TEXT_([0-3])__$/, label: '__IG_LABEL__', credit: '__IG_CREDIT__', logo: '__IG_LOGO__', photoStyle: /^__IG_STYLE_([0-3])__$/});
const ANY_SLOT = /__IG_[A-Za-z0-9_]*/g, GOOD_SLOT = /^__IG_(?:PHOTO_[0-3]|BG_[0-3]|TEXT_[0-3]|LABEL|CREDIT|LOGO|STYLE_[0-3])__$/;
// Fixed words a template may carry, beyond its slots: a short label such as THE FULL STORY.
const FIXED_LABEL = /^[A-Za-z0-9 ·.,'/:-]{1,32}$/;

/* ---------- checking ---------- */
const refuse = message => { throw Object.assign(new Error(message), {status: 400, refused: true}); };
const round = n => Math.round(n * 1000) / 1000;

function colourTable(looks) {
 const map = new Map();
 for (const t of TONES) for (const r of COLOR_ROLES) { map.set('{' + t + '.' + r + '}', TEAJIA_SOURCE[t][r]); map.set(TEAJIA_SOURCE[t][r], TEAJIA_SOURCE[t][r]); }
 map.set('#ede4d4', '#ede4d4'); map.set('#241f1a', '#241f1a');
 // A value a look gives one of its roles stands for that role (the first, darkest tone first).
 for (const look of looks || []) for (const t of TONES) for (const r of COLOR_ROLES) { const v = String(look?.[t]?.[r] || '').toLowerCase(); if (/^#[0-9a-f]{6}$/.test(v) && !map.has(v)) map.set(v, TEAJIA_SOURCE[t][r]); }
 return map;
}
function colour(raw, table, {transparent = true} = {}) {
 const v = raw.trim().toLowerCase().replace(/\s+/g, '');
 if (transparent && v === 'transparent') return 'transparent';
 if (table.has(v)) return table.get(v);
 const m = /^rgba\((26,23,20|243,234,218),(0|1|0?\.\d{1,3}|1\.0{1,3})\)$/.exec(v);
 if (m) return 'rgba(' + m[1] + ',' + m[2] + ')';
 refuse('The colour ' + raw.trim().slice(0, 40) + ' is not one of the look\'s roles. Write a role, like {dark.headline} or {light.accent}.');
}
function length(raw, spec, prop) {
 const v = raw.trim();
 if (v === '0') return '0';
 if (spec.auto && v === 'auto') return v;
 if (spec.none && v === 'none') return v;
 const m = new RegExp('^(' + NUM + ')(px|%)$').exec(v);
 if (!m || (m[2] === '%' && !spec.pct)) refuse(prop + ': ' + v.slice(0, 30) + ' is not a size this slide takes.');
 const n = Number(m[1]);
 if (n < 0) refuse(prop + ': ' + v + ' reaches outside the 1080 by 1350 slide.');
 if (m[2] === '%' ? n > 100 : n > spec.max) refuse(prop + ': ' + v + ' reaches outside the 1080 by 1350 slide.');
 return round(n) + m[2];
}
function styleValue(prop, raw, ctx) {
 const rule = ALLOWED_STYLE[prop], v = raw.trim().replace(/\s+/g, ' ');
 if (rule instanceof RegExp) { if (!rule.test(v)) refuse(prop + ': ' + v.slice(0, 40) + ' is not a value the shipped layouts use.'); return v; }
 if (rule.len) return length(v, rule, prop);
 if (rule.list) { const parts = v.split(' '); if (parts.length > rule.list) refuse(prop + ' takes up to ' + rule.list + ' sizes.'); return parts.map(p => length(p, rule.of, prop)).join(' '); }
 if (rule.px) { const m = /^(\d{1,4}(?:\.\d{1,3})?)px$/.exec(v); if (!m || Number(m[1]) < rule.px[0] || Number(m[1]) > rule.px[1]) refuse(prop + ': ' + v.slice(0, 30) + ' is not a size from ' + rule.px[0] + 'px to ' + rule.px[1] + 'px.'); return v; }
 if (rule === 'colour') return colour(v, ctx.colours);
 if (rule === 'ground') {
  const g = /^linear-gradient\((.*)\)$/.exec(v);
  if (!g) return colour(v, ctx.colours, {transparent: false});
  const stops = g[1].split(/,(?![^(]*\))/).map(s => s.trim());
  if (stops.length < 2 || stops.length > 4) refuse('A gradient here has two to four colour stops.');
  return 'linear-gradient(' + stops.map(s => { const m = /^(.+?)(?: (\d{1,3})%)?$/.exec(s); if (m[2] !== undefined && Number(m[2]) > 100) refuse('A gradient stop is 0% to 100%.'); return colour(m[1], ctx.colours, {transparent: false}) + (m[2] !== undefined ? ' ' + Number(m[2]) + '%' : ''); }).join(', ') + ')';
 }
 if (rule === 'image') {
  if (v === 'none') return v;
  const m = /^(?:__IG_BG_([0-3])__|url\(\s*["']?__IG_PHOTO_([0-3])__["']?\s*\))$/.exec(v);
  if (!m) refuse('background-image is a photo slot (__IG_BG_0__ or url(__IG_PHOTO_0__)) or none; a url() to anything else is refused.');
  const n = Number(m[1] ?? m[2]); ctx.photos.add(n); return '__IG_BG_' + n + '__';
 }
 if (rule === 'stroke') { const m = /^(\d{1,2})px (.+)$/.exec(v); if (!m || Number(m[1]) > 12) refuse('-webkit-text-stroke is a width up to 12px and a role colour.'); return m[1] + 'px ' + colour(m[2], ctx.colours, {transparent: false}); }
 if (rule === 'border') { const m = /^(\d{1,2})px solid (.+)$/.exec(v); if (!m || Number(m[1]) > 12) refuse('border-top is a width up to 12px, solid, and a role colour.'); return m[1] + 'px solid ' + colour(m[2], ctx.colours, {transparent: false}); }
 if (rule === 'font') { if (Object.hasOwn(FONT_ROLE, v)) return FONT_ROLE[v]; if (ALLOWED_FONTS.includes(v)) return v; refuse('font-family is {fonts.headline}, {fonts.body} or {fonts.label}; the look chooses the type.'); }
 refuse(prop + ' cannot be checked.');
}
function readStyle(raw, ctx) {
 if (/[\\@!{}<>`]|\/\*|expression\s*\(|url\(\s*(?!["']?__IG_PHOTO_)/i.test(raw.replace(/\{(?:dark|light)\.[a-z]+\}|\{fonts\.[a-z]+\}/g, '')))
  refuse('An inline style may hold only plain declarations: no escapes, comments, at-rules, !important, or url() to anything but a photo slot.');
 // A property written twice keeps its last value, as a browser reads it; it is written out once.
 const out = new Map();
 for (const decl of raw.split(';')) {
  if (!decl.trim()) continue;
  const at = decl.indexOf(':');
  if (at < 0) refuse('The style "' + decl.trim().slice(0, 40) + '" cannot be read.');
  const prop = decl.slice(0, at).trim().toLowerCase(), value = decl.slice(at + 1);
  if (!Object.hasOwn(ALLOWED_STYLE, prop)) refuse('The style property ' + prop.slice(0, 40) + ' is not one the shipped layouts use.');
  out.delete(prop);
  out.set(prop, styleValue(prop, value, ctx));
 }
 return [...out];
}

/** Tokens of the markup: open and close tags with their attributes, and text. Anything else is refused. */
function tokens(src) {
 const out = [];
 let i = 0;
 while (i < src.length) {
  const lt = src.indexOf('<', i);
  if (lt < 0) { out.push({text: src.slice(i)}); break; }
  if (lt > i) out.push({text: src.slice(i, lt)});
  if (/^<[!?]/.test(src.slice(lt, lt + 2))) refuse('Comments, doctypes and processing instructions are not allowed in a template.');
  const close = /^<\/([A-Za-z][A-Za-z0-9-]*)\s*>/.exec(src.slice(lt, lt + 80));
  if (close) { out.push({close: close[1].toLowerCase()}); i = lt + close[0].length; continue; }
  const open = /^<([A-Za-z][A-Za-z0-9:-]*)/.exec(src.slice(lt, lt + 80));
  if (!open) refuse('A < that does not start a tag is not allowed; write words through the text slots.');
  let j = lt + open[0].length;
  const attrs = [];
  const re = /\s+([^\s=>/"']+)(?:\s*=\s*"([^"]*)")?/y;
  for (;;) { re.lastIndex = j; const m = re.exec(src); if (!m) break; attrs.push([m[1].toLowerCase(), m[2]]); j = re.lastIndex; }
  const end = /^\s*(\/?)>/.exec(src.slice(j, j + 8));
  if (!end) refuse('The tag <' + open[1].slice(0, 30) + '> cannot be read. Attributes are name="value", in double quotes.');
  out.push({open: open[1].toLowerCase(), attrs, selfClosing: end[1] === '/'});
  i = j + end[0].length;
 }
 return out;
}

/**
 * Check a template's markup and return it in the catalogue's own form, with what it uses:
 * {markup, fixedWords (every fixed label, as written, for the owner to see before he accepts), photos (how many photo
 * slots), textParts, label, credit, logo}. `looks` are the resolved looks it is for,
 * whose role values it may write. Throws (status 400, refused: true) with the reason when anything is not allowed.
 */
export function checkMarkup(markup, {looks = []} = {}) {
 if (typeof markup !== 'string' || !markup.trim()) refuse('Send the template as markup: one <div> 1080 by 1350.');
 if (markup.length > MAX_MARKUP) refuse('A template is at most ' + MAX_MARKUP / 1024 + ' KB of markup.');
 const src = markup.trim();
 if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029\u202a-\u202e\u2066-\u2069]/.test(src)) refuse('The markup holds control or direction characters.');
 if (src.includes('&')) refuse('Character references (&...;) are not allowed in a template; it carries no fixed text but labels.');
 if (/(?:^|[^a-z])(?:javascript|vbscript|data|file|https?|ftp|blob)\s*:/i.test(src) || /\/\/[A-Za-z0-9]/.test(src) || /\bsrcset\b/i.test(src)) refuse('A template refers to no outside address. Photos and the logo come in through their slots.');
 for (const [slot] of src.matchAll(ANY_SLOT)) if (!GOOD_SLOT.test(slot)) refuse('The slot ' + slot.slice(0, 30) + ' is not one of the catalogue\'s slots.');
 const ctx = {fixed: [], colours: colourTable(looks), photos: new Set(), photoImgs: new Set(), texts: new Set(), label: false, credit: false, logo: false};
 const stack = [], out = [];
 let elements = 0, fixed = 0, roots = 0;
 for (const tk of tokens(src)) {
  if (tk.text !== undefined) {
   const t = tk.text.trim();
   // Space between tags is kept as one space on a line, and dropped between lines, as the catalogue writes it.
   if (!t) { if (stack.length && !tk.text.includes('\n')) out.push(' '); continue; }
   if (!stack.length) refuse('Everything sits inside the one 1080 by 1350 <div>.');
   if (stack.at(-1).name === 'img' || stack.at(-1).name === 'br') refuse('Words cannot sit inside an <img> or <br>.');
   let m;
   if ((m = SLOTS.text.exec(t))) { ctx.texts.add(Number(m[1])); out.push(t); continue; }
   if (t === SLOTS.label) { ctx.label = true; out.push(t); continue; }
   if (t === SLOTS.credit) { ctx.credit = true; out.push(t); continue; }
   if (t.includes('__IG_')) refuse('A text slot stands alone between its tags (' + t.slice(0, 30) + ').');
   if (!FIXED_LABEL.test(t)) refuse('Fixed words are allowed only as a short label (up to 32 letters, digits and spaces): "' + t.slice(0, 40) + '" is not one. His words come in through __IG_TEXT_0__.');
   if (++fixed > MAX_FIXED) refuse('A template carries at most ' + MAX_FIXED + ' fixed labels.');
   ctx.fixed.push(t);
   out.push(t);
   continue;
  }
  if (tk.close !== undefined) {
   const top = stack.pop();
   if (!top || top.name !== tk.close) refuse('The tags do not close in order (</' + tk.close.slice(0, 20) + '>).');
   if (top.name === 'img' || top.name === 'br') refuse('<' + top.name + '> has no closing tag.');
   out.push('</' + tk.close + '>');
   continue;
  }
  const name = tk.open;
  if (!Object.hasOwn(ALLOWED_TAGS, name)) refuse('The tag <' + name.slice(0, 30) + '> is not allowed in a template. Only ' + Object.keys(ALLOWED_TAGS).map(t => '<' + t + '>').join(', ') + ' are.');
  if (!stack.length) { if (++roots > 1 || out.length) refuse('A template is one <div> 1080 by 1350, with everything inside it.'); if (name !== 'div') refuse('A template is one <div> 1080 by 1350, with everything inside it.'); }
  if (++elements > MAX_ELEMENTS) refuse('A template has at most ' + MAX_ELEMENTS + ' tags.');
  if (stack.length >= MAX_DEPTH) refuse('A template nests at most ' + MAX_DEPTH + ' tags deep.');
  const allowed = ALLOWED_TAGS[name], seen = new Set(), attrs = [];
  let style = null, src = null;
  for (const [a, value] of tk.attrs) {
   if (a.startsWith('on')) refuse('Event handlers (' + a.slice(0, 30) + ') are not allowed in a template.');
   if (!Object.hasOwn(allowed, a)) refuse('The attribute ' + a.slice(0, 40) + ' is not allowed on <' + name + '>.');
   if (seen.has(a)) refuse('The attribute ' + a + ' is written twice on one tag.');
   seen.add(a);
   const rule = allowed[a], v = value ?? '';
   if (rule === 'style') { style = v; continue; }
   if (rule === 'src') { src = v; continue; }
   if (!rule.test(v)) refuse('The attribute ' + a + '="' + v.slice(0, 30) + '" is not a value the shipped layouts use.');
   attrs.push([a, v]);
  }
  let decls = [];
  if (name === 'img') {
   let m;
   if (src !== null && (m = SLOTS.photo.exec(src))) {
    const n = Number(m[1]);
    if (ctx.photoImgs.has(n)) refuse('The photo slot __IG_PHOTO_' + n + '__ is used twice.');
    ctx.photoImgs.add(n); ctx.photos.add(n);
    // The renderer writes a photo's own crop; the template's style on it is not kept.
    out.push('<img src="__IG_PHOTO_' + n + '__" alt="">');
   } else if (src === SLOTS.logo) {
    ctx.logo = true;
    if (style !== null) decls = readStyle(style, ctx);
    out.push('<img src="__IG_LOGO__" alt="teajiā"' + (decls.length ? ' style="' + decls.map(([p, v]) => p + ': ' + v).join('; ') + '"' : '') + '>');
   } else refuse('An image is a photo slot (src="__IG_PHOTO_0__") or the logo (src="__IG_LOGO__"); ' + (src === null ? 'this one has no src.' : 'any other source is refused.'));
   continue;
  }
  if (style !== null) decls = readStyle(style, ctx);
  if (!stack.length) {
   const d = Object.fromEntries(decls);
   if (d.width !== '1080px' || d.height !== '1350px') refuse('The template\'s outer <div> is exactly width: 1080px; height: 1350px.');
   if (d.position !== 'relative' || d.overflow !== 'hidden') refuse('The template\'s outer <div> is position: relative; overflow: hidden, so nothing shows outside the slide.');
   // The slide itself never moves: an offset on the outer <div> would shift the whole slide.
   const moved = ['left', 'top', 'right', 'bottom', 'inset'].filter(p => Object.hasOwn(d, p));
   if (moved.length) refuse('The template\'s outer <div> takes no ' + moved.join(', ') + ': the slide itself stays where it is. Place things inside it.');
  }
  out.push('<' + name + attrs.map(([a, v]) => ' ' + a + '="' + v + '"').join('') + (decls.length ? ' style="' + decls.map(([p, v]) => p + ': ' + v).join('; ') + '"' : '') + '>');
  if (!VOID.has(name)) { if (tk.selfClosing) refuse('<' + name + '> is not self-closing; close it with </' + name + '>.'); stack.push({name}); }
 }
 if (stack.length) refuse('The markup ends before <' + stack.at(-1).name + '> is closed.');
 if (!roots) refuse('A template is one <div> 1080 by 1350, with everything inside it.');
 // Slots well formed: photo and text slots number from 0 with no gap, and every ground slot has its photo.
 const run = set => [...set].sort((a, b) => a - b).every((n, i) => n === i);
 if (!run(ctx.photos)) refuse('Photo slots number from __IG_PHOTO_0__ with no gap.');
 if (!run(ctx.texts)) refuse('Text slots number from __IG_TEXT_0__ with no gap.');
 if (ctx.photos.size > MAX_PHOTOS || ctx.texts.size > MAX_TEXTS) refuse('A template takes up to ' + MAX_PHOTOS + ' photos and ' + MAX_TEXTS + ' text parts.');
 if (!ctx.texts.size && !ctx.photos.size) refuse('A template uses at least one photo or text slot.');
 return {markup: out.join(''), fixedWords: ctx.fixed, photos: ctx.photos.size, textParts: Math.max(1, ctx.texts.size), label: ctx.label, credit: ctx.credit, logo: ctx.logo};
}

/* ---------- drawing ---------- */
const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const localImage = value => { const url = String(value ?? ''); return /^\/(?!\/)(?!_blob\/)(?!appifact\/)[^\s<>"'`\\()]+$/.test(url) ? url : ''; };
const focus = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 50;

/**
 * A checked template's markup filled with one slide, in the catalogue's own values (Teajia's), ready for the look renderer.
 * Slots are filled exactly as the shipped catalogue fills them (ig-original-catalog.mjs).
 */
export function renderMarkup(template, slide = {}, ctx = {}) {
 const parts = String(slide.text ?? '').split(/\n\s*\n/), textParts = template.textParts || 1;
 const part = index => index === textParts - 1 ? parts.slice(index).join('\n\n') : parts[index] || '';
 const photos = Array.isArray(slide.photos) ? slide.photos : [];
 const logo = localImage(ctx.logo) || '/ig-assets/teajia-wordmark.png';
 return String(template.markup).replace(/<img src="__IG_PHOTO_(\d)__" alt="">|__IG_BG_(\d)__|__IG_TEXT_(\d)__|__IG_LABEL__|__IG_CREDIT__|__IG_LOGO__/g, (token, img, bg, text) => {
  if (img !== undefined) {
   const p = photos[Number(img)], url = localImage(p?.src);
   if (!url) return '<div aria-label="Photo needed" style="position:absolute;inset:0;background:#241f1a;color:#8d806b;font:34px Caudex,Georgia,serif;display:flex;align-items:center;justify-content:center">photo needed</div>';
   return '<img src="' + escapeHtml(url) + '" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;object-position:' + focus(p.x) + '% ' + focus(p.y) + '%;display:block">';
  }
  if (bg !== undefined) { const url = localImage(photos[Number(bg)]?.src); return url ? 'url(&quot;' + escapeHtml(url) + '&quot;)' : 'none'; }
  if (text !== undefined) return escapeHtml(part(Number(text)));
  if (token === '__IG_LABEL__') return escapeHtml(slide.label);
  if (token === '__IG_CREDIT__') return escapeHtml(slide.credit);
  return escapeHtml(logo);
 });
}
