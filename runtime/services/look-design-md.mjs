// A look's DESIGN.md: Google's DESIGN.md format (google-labs-code/design.md, version alpha): YAML front matter with the
// brand's tokens (colors, typography, rounded, spacing, components), then prose in its canonical sections. A look adds one
// block of its own to the front matter, `slides:`, naming the roles a slide needs, each as a token of the same file
// ({colors.background}) or a plain value. The block is documented in each shipped look.
//
// Here: reading the front matter (the YAML subset these files use), resolving a look's slide roles, and proposing a
// `slides:` block for a DESIGN.md that has none, with every guess reported so a person can correct it. Nothing here
// reads the network or any file.
import {StateError} from '../store.mjs';
import {TONES, COLOR_ROLES, FONT_ROLES} from '../src/donors/mag/carousel/ig-look-render.mjs';
import {FONT_FILES} from './instagram-templates.mjs';

const fail = (message, status = 400) => { throw new StateError(message, status); };
export const MAX_DESIGN_BYTES = 256 * 1024;

/* ---------- the front matter ---------- */

/** {yaml, body, start, end} for a DESIGN.md: the text between the first two `---` lines, and what follows. */
export function splitDesign(text) {
 const t = String(text ?? '');
 if (Buffer.byteLength(t) > MAX_DESIGN_BYTES) fail('A DESIGN.md is at most ' + MAX_DESIGN_BYTES / 1024 + ' KB.', 413);
 const m = /^(?:﻿)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(t);
 if (!m) fail('A DESIGN.md starts with front matter between two --- lines.');
 return {yaml: m[1].replace(/\r\n/g, '\n'), body: t.slice(m[0].length)};
}

// A comment starts at a # outside quotes that begins the line or follows a space.
function uncomment(line) {
 let q = null;
 for (let k = 0; k < line.length; k++) {
  const c = line[k];
  if (q) { if (c === q) q = null; continue; }
  if (c === '"' || c === "'") { if (k === 0 || /[\s:[,{-]/.test(line[k - 1]) || /^\s*$/.test(line.slice(0, k))) q = c; continue; }
  if (c === '#' && (k === 0 || /\s/.test(line[k - 1]))) return line.slice(0, k).replace(/\s+$/, '');
 }
 return line.replace(/\s+$/, '');
}
function scalar(raw) {
 const v = raw.trim();
 if (v === '' || v === '~' || v === 'null') return null;
 if (v === 'true') return true;
 if (v === 'false') return false;
 if (/^"(?:[^"\\]|\\.)*"$/.test(v)) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
 if (/^'(?:[^']|'')*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
 if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
 if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean).map(scalar);
 return v;
}

/**
 * The YAML these files use: nested maps by indentation, lists of scalars or maps, quoted and plain scalars, comments,
 * flow lists of scalars and folded or literal blocks (>, >-, |, |-). Anything else is refused with the line it is on.
 */
export function parseYaml(src) {
 const raw = String(src ?? '').replace(/\r\n/g, '\n').split('\n');
 const lines = raw.map((text, n) => ({n: n + 1, text, indent: text.length - text.trimStart().length, body: uncomment(text).trim()}));
 let i = 0;
 const skip = () => { while (i < lines.length && !lines[i].body) i++; };
 function blockScalar(style, parentIndent) {
  const out = [];let indent = null;
  while (i < lines.length) {
   const l = lines[i];
   if (l.text.trim() && l.indent <= parentIndent) break;
   if (l.text.trim()) indent ??= l.indent;
   out.push(l.text.trim() ? l.text.slice(indent) : '');i++;
  }
  while (out.length && !out.at(-1)) out.pop();
  const folded = style[0] === '>' ? out.join('\n').replace(/([^\n])\n(?!\n)/g, '$1 ') : out.join('\n');
  return style.endsWith('-') ? folded : folded + '\n';
 }
 function value(rest, indent) {
  if (/^[>|][-+]?$/.test(rest)) return blockScalar(rest, indent);
  if (rest !== '') return scalar(rest);
  skip();
  if (i >= lines.length || lines[i].indent <= indent) return lines[i] && lines[i].indent === indent && lines[i].body.startsWith('- ') ? list(indent) : null;
  return block(lines[i].indent);
 }
 function list(indent) {
  const out = [];
  for (skip(); i < lines.length && lines[i].indent === indent && /^-(\s|$)/.test(lines[i].body); skip()) {
   const l = lines[i], rest = l.body.slice(1).trim();
   if (/^("[^"]*"|[^"'\s][^:]*):(\s|$)/.test(rest)) fail('The front matter has a list of named values at line ' + l.n + '; a DESIGN.md uses named values or lists of plain values.');
   i++; out.push(scalar(rest));
  }
  return out;
 }
 function block(indent) {
  skip();
  if (i < lines.length && /^-(\s|$)/.test(lines[i].body)) return list(lines[i].indent);
  const out = {};
  for (skip(); i < lines.length && lines[i].indent === indent; skip()) {
   const l = lines[i], m = /^("(?:[^"\\]|\\.)*"|'[^']*'|[^"'\s][^:]*?):(?:\s+(.*))?$/.exec(l.body);
   if (!m) fail('The front matter cannot be read at line ' + l.n + ': ' + l.text.trim().slice(0, 80));
   const key = String(scalar(m[1])); i++;
   if (Object.hasOwn(out, key)) fail('The front matter names ' + key + ' twice (line ' + l.n + ').');
   out[key] = value((m[2] ?? '').trim(), indent);
  }
  if (i < lines.length && lines[i].indent > indent) fail('The front matter is indented unevenly at line ' + lines[i].n + '.');
  return out;
 }
 skip();
 if (i >= lines.length) return {};
 const doc = block(lines[i].indent);
 skip();
 if (i < lines.length) fail('The front matter cannot be read at line ' + lines[i].n + '.');
 return doc;
}

/** The parsed front matter and prose of a DESIGN.md. */
export function readDesign(text) {
 const {yaml, body} = splitDesign(text);
 const doc = parseYaml(yaml);
 if (!doc || typeof doc !== 'object' || Array.isArray(doc)) fail('The front matter is a set of named values.');
 return {doc, body};
}

/** A token reference ({colors.primary}, {typography.display.fontFamily}) or a plain value, resolved. */
export function resolveRef(value, doc, seen = new Set()) {
 const m = typeof value === 'string' ? /^\{([\w-]+(?:\.[\w-]+)*)\}$/.exec(value.trim()) : null;
 if (!m) return value;
 if (seen.has(m[1])) fail('The token ' + value + ' refers to itself.');
 let at = doc;
 for (const part of m[1].split('.')) { if (!at || typeof at !== 'object' || !Object.hasOwn(at, part)) return undefined; at = at[part]; }
 return resolveRef(at, doc, new Set([...seen, m[1]]));
}

/* ---------- colours ---------- */
const SAFE_COLOR = /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([0-9a-z.,%\s/+-]{1,80}\))$/i;
export const isColor = v => typeof v === 'string' && SAFE_COLOR.test(v.trim());
const rgbOf = hex => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim()); if (!m) return null; const v = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]; return [0, 2, 4].map(k => parseInt(v.slice(k, k + 2), 16)); };
const toHex = rgb => '#' + rgb.map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');
const luminance = rgb => { const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const saturation = ([r, g, b]) => { const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2; return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)); };
const mix = (a, b, share) => toHex(a.map((v, k) => v + (b[k] - v) * share));

/* ---------- fonts ---------- */
/**
 * Font families the app has files for (FONT_FILES, from runtime/public/assets/fonts and runtime/public/ig-assets), and
 * whether each is a serif. A family a look wants is honoured as soon as its file is added there.
 */
export const FONT_FAMILIES = Object.freeze(Object.fromEntries(FONT_FILES.map(([family]) => [family, !/sans|grotesk|mono/i.test(family)])));
// A family the app lacks is drawn in the nearest one it has, until its file is added.
const NEAREST = Object.freeze({'Karla': 'Plus Jakarta Sans', 'Inter': 'Plus Jakarta Sans', 'Instrument Sans': 'Plus Jakarta Sans', 'Schibsted Grotesk': 'Plus Jakarta Sans', 'Geist': 'Plus Jakarta Sans', 'Helvetica': 'Plus Jakarta Sans', 'Arial': 'Plus Jakarta Sans',
 'Iowan Old Style': 'Lora', 'Source Serif 4': 'Lora', 'Georgia': 'Lora', 'Cinzel': 'Cormorant Garamond', 'Cormorant': 'Cormorant Garamond', 'Garamond': 'EB Garamond', 'EB Garamond 12': 'EB Garamond'});
const firstFamily = value => String(value ?? '').split(',')[0].trim().replace(/^(['"])(.*)\1$/, '$2');
/** {family the slide is drawn in, serif, wanted (the family the look names, when the app has no file for it)}. */
export function fontFor(value) {
 const named = firstFamily(value), all = String(value ?? '');
 if (Object.hasOwn(FONT_FAMILIES, named)) return {family: named, serif: FONT_FAMILIES[named]};
 const family = NEAREST[named] || (/\bsans\b|grotesk|mono/i.test(all) ? 'Plus Jakarta Sans' : 'Lora');
 return {family, serif: FONT_FAMILIES[family], wanted: named || null};
}

/* ---------- the slides block ---------- */
const LOGO_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(?:png|jpe?g|webp)$/;
const APP_IMAGE = /^\/(?:ig-assets|assets)\/[A-Za-z0-9._/-]{1,160}\.(?:png|jpe?g|webp)$/;
/** A logo value: a file in the look's folder, an app path (/ig-assets/...), or empty for the wordmark. */
export const isLogoValue = v => v === null || v === '' || (typeof v === 'string' && (LOGO_FILE.test(v) || (APP_IMAGE.test(v) && !v.includes('..'))));

/**
 * The resolved roles of a look's `slides:` block, or the problems that stop it being drawn. `assetUrl(file)` turns a
 * file in the look's folder into the address it is served at.
 */
export function resolveSlides(doc, {id, assetUrl = f => f} = {}) {
 const s = doc.slides, problems = [];
 if (!s || typeof s !== 'object' || Array.isArray(s)) return {roles: null, problems: ['The front matter has no slides: block, so slides cannot be drawn in this look yet. Import it to propose one.']};
 const roles = {id, name: String(doc.name || id || '').slice(0, 80), dark: {}, light: {}, fonts: {}, logo: {}, link: ''};
 for (const t of TONES) for (const r of COLOR_ROLES) {
  const raw = s[t]?.[r], v = resolveRef(raw, doc);
  if (!isColor(v)) problems.push('slides.' + t + '.' + r + (raw === undefined ? ' is missing.' : ' is not a colour (' + JSON.stringify(raw).slice(0, 60) + ').'));
  else roles[t][r] = v.trim().toLowerCase();
 }
 for (const r of FONT_ROLES) {
  const raw = s.fonts?.[r], v = resolveRef(raw, doc), family = v && typeof v === 'object' ? v.fontFamily : v;
  if (typeof family !== 'string' || !family.trim()) { problems.push('slides.fonts.' + r + (raw === undefined ? ' is missing.' : ' names no font family.')); continue; }
  roles.fonts[r] = fontFor(family);
 }
 const logo = s.logo || {};
 for (const t of TONES) {
  const v = logo[t] ?? '';
  if (!isLogoValue(v)) { problems.push('slides.logo.' + t + ' is a file in this look\'s folder (png, jpg or webp), an app path such as /ig-assets/name.png, or empty.'); continue; }
  roles.logo[t] = v ? (v.startsWith('/') ? v : assetUrl(v)) : '';
 }
 roles.logo.wordmark = String(logo.wordmark || doc.name || id || '').slice(0, 60);
 roles.link = String(s.link ?? '').slice(0, 60);
 return problems.length ? {roles: null, problems} : {roles, problems};
}

// Names a website's tokens use for each role, best first. Light variants are found by a light marker in the name.
const NAMES = {
 ground: ['background', 'ground', 'canvas', 'bg', 'base', 'page', 'paper'],
 box: ['surface', 'surface-container', 'card', 'panel', 'box', 'raised'],
 line: ['outline', 'border', 'divider', 'line', 'rule', 'surface-elevated', 'surface-container-high'],
 headline: ['on-background', 'on-surface', 'foreground', 'text', 'ink', 'headline', 'heading'],
 supporting: ['on-surface-secondary', 'on-surface-variant', 'text-secondary', 'secondary-text', 'muted', 'supporting', 'body'],
 label: ['on-surface-dim', 'dim', 'text-tertiary', 'tertiary-text', 'label', 'caption', 'subtle', 'faint'],
 accent: ['primary', 'accent', 'brand', 'gold', 'highlight'],
};
const FONT_NAMES = {headline: ['display', 'headline', 'h1', 'heading', 'title', 'headline-lg', 'display-lg'], body: ['body', 'body-md', 'body-lg', 'lead', 'paragraph', 'text'], label: ['label', 'label-caps', 'eyebrow', 'overline', 'label-md', 'caption', 'meta']};
const LIGHT = /(^|-)light(-|$)|(^|-)day(-|$)/i, DARK = /(^|-)dark(-|$)|(^|-)night(-|$)/i;
const base = name => name.replace(/(^|-)(light|dark|day|night)(?=-|$)/gi, '').replace(/^-+|-+$/g, '');

/**
 * Propose a `slides:` block for a DESIGN.md: roles by token name where the names are clear (background, surface,
 * on-background, primary), otherwise by lightness and contrast. Returns {slides, guesses}: every role that was not a
 * clear name is a guess, said in words, so a person can correct it before the look is saved.
 */
export function proposeSlides(doc) {
 const colors = Object.entries(doc.colors && typeof doc.colors === 'object' ? doc.colors : {}).map(([name, raw]) => ({name, value: resolveRef(raw, doc)}))
  .filter(c => isColor(c.value)).map(c => ({...c, rgb: rgbOf(c.value)}));
 const hexes = colors.filter(c => c.rgb);
 if (hexes.length < 2) fail('This DESIGN.md has fewer than two colours written as hex, so no slide roles can be read from it.', 422);
 const guesses = [], slides = {dark: {}, light: {}, fonts: {}, logo: {}};
 const ref = c => '{colors.' + c.name + '}';
 const say = (role, value, why) => guesses.push({role, value, why});
 const isDark = c => luminance(c.rgb) < 0.18;
 for (const tone of TONES) {
  // When a file marks its grounds for a tone (background-light), only marked tokens are that tone's; otherwise unmarked
  // names are. A lighter shade of one colour (bronze-light) is not a mark.
  const mark = tone === 'light' ? LIGHT : DARK, other = tone === 'light' ? DARK : LIGHT, marked = hexes.some(c => mark.test(c.name) && [...NAMES.ground, ...NAMES.box].includes(base(c.name).toLowerCase()));
  const fits = c => marked ? mark.test(c.name) : !other.test(c.name);
  let ground = null;
  const suits = (role, c) => role === 'ground' ? isDark(c) === (tone === 'dark') : ['box', 'line'].includes(role) ? isDark(c) === isDark(ground) && c !== ground
   : contrast(c.rgb, ground.rgb) >= ({headline: 4.5, supporting: 3, label: 2, accent: 2.5})[role];
  const named = role => { for (const want of NAMES[role]) { const hit = hexes.find(c => fits(c) && base(c.name).toLowerCase() === want && suits(role, c)); if (hit) return hit; } return null; };
  // The ground: its name if it is the right lightness, else the darkest (dark) or lightest (light) colour.
  ground = named('ground');
  if (!ground) { ground = [...hexes].sort((a, b) => luminance(a.rgb) - luminance(b.rgb))[tone === 'dark' ? 0 : hexes.length - 1]; say(tone + '.ground', ref(ground), 'No token is named as a ' + tone + ' background, so the ' + (tone === 'dark' ? 'darkest' : 'lightest') + ' colour, ' + ground.name + ', is the ground.'); }
  if ((tone === 'dark') !== isDark(ground)) say(tone + '.ground', ref(ground), ground.name + ' is the closest to a ' + tone + ' ground this file has, but it is not very ' + tone + '.');
  slides[tone].ground = ref(ground);
  const others = hexes.filter(c => c !== ground);
  // Words on the ground: the named one, else the colour with the most contrast.
  let headline = named('headline');
  if (!headline) { headline = [...others].sort((a, b) => contrast(b.rgb, ground.rgb) - contrast(a.rgb, ground.rgb))[0]; say(tone + '.headline', ref(headline), 'No token for text on this ground reads well enough, so ' + headline.name + ', the colour with the most contrast, carries headlines.'); }
  slides[tone].headline = ref(headline);
  let accent = named('accent');
  if (!accent) {
   accent = others.filter(c => c !== headline && contrast(c.rgb, ground.rgb) >= 3).sort((a, b) => saturation(b.rgb) - saturation(a.rgb))[0] || headline;
   say(tone + '.accent', ref(accent), 'No primary or accent token reads well on this ground, so ' + accent.name + ', the most coloured that still reads on it, is the accent.');
  }
  slides[tone].accent = ref(accent);
  // The quieter roles: named, else mixed from the ground and the headline colour.
  for (const [role, share, what] of [['box', 0.08, 'a little lifted from the ground'], ['line', 0.16, 'a quiet line on the ground'], ['supporting', 0.78, 'between the headline and the ground'], ['label', 0.55, 'quieter than the supporting words']]) {
   const hit = named(role);
   if (hit) { slides[tone][role] = ref(hit); continue; }
   const value = mix(ground.rgb, headline.rgb, share);
   slides[tone][role] = value;
   say(tone + '.' + role, value, 'No token is named for ' + role + ', so it is mixed from ' + ground.name + ' and ' + headline.name + ' (' + what + ').');
  }
 }
 const typography = doc.typography && typeof doc.typography === 'object' ? doc.typography : {};
 const faces = Object.keys(typography).filter(k => typography[k] && typeof typography[k] === 'object' && typeof typography[k].fontFamily === 'string');
 for (const role of FONT_ROLES) {
  const hit = FONT_NAMES[role].find(n => faces.includes(n));
  const pick = hit || (role === 'headline' ? faces[0] : role === 'body' ? faces.find(f => /body|text|lead|para/i.test(f)) || faces[1] || faces[0] : faces.find(f => /label|caption|meta|eyebrow|overline/i.test(f)) || faces.at(-1));
  if (!pick) { slides.fonts[role] = 'Lora'; say('fonts.' + role, 'Lora', 'This file names no type, so ' + role + ' is set in Lora.'); continue; }
  slides.fonts[role] = '{typography.' + pick + '}';
  if (!hit) say('fonts.' + role, slides.fonts[role], 'No type style is named for ' + role + ', so ' + pick + ' (' + typography[pick].fontFamily + ') is used.');
  const font = fontFor(typography[pick].fontFamily);
  if (font.wanted) say('fonts.' + role, slides.fonts[role], font.wanted + ' has no font file in the app yet, so ' + role + ' is drawn in ' + font.family + ' until it is added.');
 }
 slides.logo = {dark: '', light: '', wordmark: String(doc.name || '').slice(0, 60)};
 say('logo', '', 'No logo file came with this DESIGN.md, so the logo is the brand\'s name set in its headline type until a file is added.');
 slides.link = '';
 return {slides, guesses};
}

const yamlString = v => typeof v === 'string' && /^[\w .,'/#{}()-]*$/.test(v) && !/^[\s'"#{[>|*&!%@`-]/.test(v) && v.trim() === v && v !== '' && !/:\s|\s#/.test(v) ? v : JSON.stringify(v ?? '');
/** The slides block as YAML, with a short note on what it is, for the end of a DESIGN.md's front matter. */
export function slidesYaml(slides, note = []) {
 const out = ['# slides: the roles a Carousel slide needs, for posts on a dark ground and on a light one. Each value is a token', '# of this file ({colors.name}, {typography.name}) or a plain value. Read by AR Create; not part of the DESIGN.md spec.', ...note.map(n => '# ' + n), 'slides:'];
 for (const tone of TONES) { out.push('  ' + tone + ':'); for (const r of COLOR_ROLES) out.push('    ' + r + ': ' + JSON.stringify(slides[tone][r])); }
 out.push('  fonts:'); for (const r of FONT_ROLES) out.push('    ' + r + ': ' + JSON.stringify(slides.fonts[r]));
 out.push('  logo:', '    dark: ' + JSON.stringify(slides.logo.dark || ''), '    light: ' + JSON.stringify(slides.logo.light || ''), '    wordmark: ' + yamlString(slides.logo.wordmark || ''));
 out.push('  link: ' + JSON.stringify(slides.link || ''));
 return out.join('\n');
}

/** The DESIGN.md whole, with a `slides:` block added at the end of its front matter (or its own block, if it has one, kept). */
export function withSlides(text, slides, note) {
 const t = String(text).replace(/\r\n/g, '\n'), {yaml} = splitDesign(t), close = t.indexOf(yaml) + yaml.length;
 return t.slice(0, close).replace(/\s*$/, '') + '\n' + slidesYaml(slides, note) + t.slice(close);
}
