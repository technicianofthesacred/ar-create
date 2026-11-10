// Drawing a Carousel layout in a look. The one place where the Teajia values written into the layouts' markup become a
// look's roles, used by every render path (the page preview, the PNG, the sheet). Plain and browser-safe: it reads no
// files. A look comes in already resolved by runtime/services/looks.mjs:
//   {id, name, dark:{ground,box,line,headline,supporting,label,accent}, light:{the same seven},
//    fonts:{headline,body,label} (each {family, serif}), logo:{dark, light, wordmark}, link}
//
// The layouts were drawn from Teajia's Instagram guide, so the guide's values are the source: each one is swapped for
// the same role in the look, exactly once, in one pass over each tag. A value whose role is the same in the look stays
// byte for byte as it is, so the teajia look draws exactly what was drawn before looks existed.
//
// What belongs to Teajia stays with Teajia: in any other look the Chinese characters and the seals are left out (a
// chapter character becomes a plain numeral), and the rows that are Teajia's own (the three jiā and the two earlier
// rows) are refused with a reason. The Story and reel layouts (row R) were made in the art look and carry no Teajia
// values, so they draw as they always have in every look.

/** The roles the layouts' markup was written with: Teajia's Instagram guide. */
export const TEAJIA_SOURCE = Object.freeze({
 dark: Object.freeze({ground: '#1a1714', box: '#2a2622', line: '#3a3530', headline: '#f3eada', supporting: '#cdc0a8', label: '#8d806b', accent: '#a8874d'}),
 light: Object.freeze({ground: '#f4ece0', box: '#e6dbcc', line: '#d5c8b4', headline: '#18130e', supporting: '#443a2c', label: '#9a8c78', accent: '#8e6d2e'}),
 fonts: Object.freeze({headline: 'Caudex', body: 'EB Garamond', label: 'Caudex'}),
 logo: '/ig-assets/teajia-wordmark.png',
 link: 'teajia.com/read',
});
export const TONES = Object.freeze(['dark', 'light']);
export const COLOR_ROLES = Object.freeze(['ground', 'box', 'line', 'headline', 'supporting', 'label', 'accent']);
export const FONT_ROLES = Object.freeze(['headline', 'body', 'label']);
/** Rows of the code table that are Teajia's own: the three jiā and the two earlier rows. */
export const OWN_ROWS = Object.freeze({J: 'the three jiā', Y: 'the earlier rows in the site colours', Z: 'the earlier rows in the terracotta blend'});
/** The look that owns Teajia's characters, seals and own rows. */
export const OWNER = 'teajia';

// Two shades the layouts use beside the fourteen roles. Each follows its role, and stays as it is while that role is.
const EXTRA = Object.freeze({'#ede4d4': ['dark', 'supporting'], '#241f1a': ['dark', 'box']});
// The faded grounds of photographs and the soft headline colour, written as rgba of the dark ground and headline.
const RGBA = Object.freeze({'26,23,20': ['dark', 'ground'], '243,234,218': ['dark', 'headline']});
// The font stacks as the layouts write them.
// Caudex is the headline type, and the label type inside a label or credit.
const STACKS = Object.freeze({
 'Caudex, Georgia, serif': ['headline', 'Caudex'], 'Caudex,Georgia,serif': ['headline', 'Caudex'],
 "'EB Garamond', Georgia, serif": ['body', 'EB Garamond'], "'EB Garamond',Georgia,serif": ['body', 'EB Garamond'],
 "'Shippori Mincho', 'Noto Serif TC', serif": ['chinese'], 'Shippori Mincho,serif': ['chinese'], "'Noto Serif TC', serif": ['chinese'],
});
const CJK_NUMERALS = Object.freeze({壹: 1, 貳: 2, 贰: 2, 參: 3, 叁: 3, 肆: 4, 伍: 5, 陸: 6, 陆: 6, 柒: 7, 捌: 8, 玖: 9, 拾: 10, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10});
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hexRgb = hex => { const h = String(hex).trim().toLowerCase(); const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(h); if (!m) return null; const v = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]; return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** The font stack a look's family is written with. */
export const stackOf = font => (/[\s]/.test(font.family) ? "'" + font.family + "'" : font.family) + (font.serif === false ? ', Arial, sans-serif' : ', Georgia, serif');

/** True when a look leaves every Teajia value exactly as the layouts write it. */
export function isSourceLook(look) {
 if (!look) return true;
 return TONES.every(t => COLOR_ROLES.every(r => same(look[t][r], TEAJIA_SOURCE[t][r]))) && FONT_ROLES.every(r => look.fonts[r].family === TEAJIA_SOURCE.fonts[r])
  && look.logo.dark === TEAJIA_SOURCE.logo && look.logo.light === TEAJIA_SOURCE.logo && (look.link ?? TEAJIA_SOURCE.link) === TEAJIA_SOURCE.link;
}

/**
 * Why a layout cannot be drawn in a look, or null when it can. `code` is the layout's code (C1, J2, ...).
 * Only the owner look draws Teajia's own rows.
 */
export function refusal(look, code, layoutName = '') {
 if (!look || look.id === OWNER) return null;
 const row = /^([A-Z])\d+$/.exec(String(code || ''))?.[1];
 if (!row || !Object.hasOwn(OWN_ROWS, row)) return null;
 return code + (layoutName ? ' (' + layoutName + ')' : '') + ' is one of Teajia\'s own layouts (' + OWN_ROWS[row] + '), so it is not drawn in the ' + (look.name || look.id) + ' look. Choose a shared layout, or the Teajia look.';
}

// Teajia's characters and seals, left out of every other look. Structural, so a seal's gold box goes with its character.
function leaveOutCharacters(html, look) {
 return html
  // A seal: a box holding only characters (the full-photo seal).
  .replace(/<div style="[^"]*"><div lang="zh-Hant"[^>]*>[^<]*<\/div><\/div>/g, '')
  // The pillar seal a slide may carry.
  .replace(/<div data-pillar-seal="[^"]*"[^>]*>[^<]*<\/div>/g, '')
  // A chapter character becomes a plain numeral in the look's headline type; any other character is left out.
  .replace(/<div lang="zh-Hant" style="([^"]*)">([^<]*)<\/div>/g, (all, style, chars) => {
   const n = [...chars.trim()].length === 1 ? CJK_NUMERALS[chars.trim()] : undefined;
   return n === undefined ? '' : '<div data-chapter-number style="' + style + '">' + n + '</div>';
  });
}

function logoTag(tag, look) {
 const light = /filter:\s*brightness\(0\)/.test(tag), tone = light ? 'light' : 'dark', file = look.logo[tone];
 if (file) {
  let out = tag.replace(/\bsrc="[^"]*"/, 'src="' + esc(file) + '"').replace(/\balt="[^"]*"/, 'alt="' + esc(look.logo.wordmark || look.name || '') + '"');
  // A look with its own light logo needs no darkening.
  if (light && look.logo.light !== look.logo.dark) out = out.replace(/;?\s*filter:\s*brightness\(0\)/, '');
  return out;
 }
 // No logo file yet: the brand's name set in its headline type, at the logo's height.
 const style = /\bstyle="([^"]*)"/.exec(tag)?.[1] || '', h = Number(/(?:^|;)\s*height:\s*([\d.]+)px/.exec(style)?.[1]) || 44;
 const kept = style.split(';').map(s => s.trim()).filter(s => s && !/^(width|height|object-fit|filter)\s*:/.test(s)).join('; ');
 return '<div data-wordmark aria-label="' + esc(look.logo.wordmark) + '" style="' + (kept ? kept + '; ' : '') + 'height: ' + h + 'px; line-height: ' + h + 'px; white-space: nowrap; font-family: ' + stackOf(look.fonts.headline) + '; font-size: ' + Math.round(h * 0.62) + 'px; letter-spacing: 0.04em; color: ' + look[tone].headline + '">' + esc(look.logo.wordmark) + '</div>';
}

function swaps(look) {
 const colours = new Map();
 for (const t of TONES) for (const r of COLOR_ROLES) colours.set(TEAJIA_SOURCE[t][r], look[t][r]);
 for (const [hex, [t, r]] of Object.entries(EXTRA)) colours.set(hex, same(look[t][r], TEAJIA_SOURCE[t][r]) ? hex : look[t][r]);
 const rgba = (key, alpha) => { const [t, r] = RGBA[key], target = look[t][r]; if (same(target, TEAJIA_SOURCE[t][r])) return null; const rgb = hexRgb(target);
  return rgb ? 'rgba(' + rgb.join(',') + ',' + alpha + ')' : 'color-mix(in srgb, ' + target + ' ' + Math.round(Number(alpha) * 1000) / 10 + '%, transparent)'; };
 // Characters stay in their own type in the owner look; elsewhere only a chapter numeral is left, in the headline type.
 const font = ([role, family], label) => { if (role === 'chinese') return look.id === OWNER ? null : stackOf(look.fonts.headline);
  const want = look.fonts[role === 'headline' && label ? 'label' : role]; return want.family === family ? null : stackOf(want); };
 const pattern = new RegExp('(?<=[:\\s(,])#[0-9a-fA-F]{6}\\b|rgba\\(\\s*(26\\s*,\\s*23\\s*,\\s*20|243\\s*,\\s*234\\s*,\\s*218)\\s*,\\s*([\\d.]+)\\s*\\)|' + Object.keys(STACKS).map(reEsc).join('|'), 'g');
 return {colours, rgba, font, pattern};
}

/**
 * The markup of a layout drawn in a look. `html` is the layout's markup as drawn today (Teajia values). With no look,
 * or a look whose every role is Teajia's own, the markup comes back unchanged, byte for byte.
 */
export function drawInLook(html, look) {
 if (!look) return html;
 const owner = look.id === OWNER;
 if (owner && isSourceLook(look)) return html;
 let out = owner ? html : leaveOutCharacters(html, look);
 const s = swaps(look);
 out = out.replace(/<[a-zA-Z][^>]*>/g, tag => {
  // The logo is swapped whole and nothing in it is mapped again.
  if (/^<img\b/.test(tag) && /\balt="teaji(?:ā|&#257;)"/.test(tag) && !(owner && look.logo.dark === TEAJIA_SOURCE.logo && look.logo.light === TEAJIA_SOURCE.logo)) return logoTag(tag, look);
  const label = /\bdata-edit="(?:label|credit)"/.test(tag);
  return tag.replace(s.pattern, (m, rgbaKey, alpha) => {
   if (rgbaKey !== undefined) return s.rgba(rgbaKey.replace(/\s+/g, ''), alpha) ?? m;
   if (m[0] === '#') { const to = s.colours.get(m.toLowerCase()); return to === undefined || same(to, m) ? m : to; }
   return s.font(STACKS[m], label) ?? m;
  });
 });
 return out;
}

/* ---------- placed things ---------- */
// A slide may carry things placed on it on top of its layout: the look's logo, a mark or a graphic of the look, a picture
// from the plan, a short label or a rule. Each is {kind, asset?, text?, x, y, width, height?, z, tone?, color?, size?} in
// the slide's own pixels (1080 wide). They are drawn here and nowhere else, after the layout is drawn in its look, so the
// one path (renderFrame) puts them on the page preview, the PNG, the sheet and every export alike. A logo, mark or graphic
// is always the look's own: a thing whose asset the look lacks is left out and reported, never drawn from another brand.

export const PLACED_KINDS = Object.freeze(['logo', 'mark', 'graphic', 'picture', 'label', 'rule']);
/** The kinds a look's assets: block may hold. */
export const ASSET_KINDS = Object.freeze(['logo', 'mark', 'graphic']);
export const MAX_PLACED = 12;
export const ASSET_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const PICTURE_ID = /^(?:P[0-9]{1,3}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
const FIELDS = Object.freeze({
 logo: ['asset', 'height', 'tone'], mark: ['asset', 'height', 'tone'], graphic: ['asset', 'height', 'tone'],
 picture: ['asset', 'height'], label: ['text', 'size', 'tone', 'color'], rule: ['height', 'tone', 'color'],
});
const COMMON = ['kind', 'x', 'y', 'width', 'z'];
const placedFail = message => { throw Object.assign(new Error(message), {status: 400}); };
const SOURCE_FONTS = Object.freeze({headline: {family: 'Caudex', serif: true}, body: {family: 'EB Garamond', serif: true}, label: {family: 'Caudex', serif: true}});
const SEAL_STACK = "'Shippori Mincho', 'Noto Serif TC', serif";
const plainText = v => typeof v === 'string' && !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff<>]/.test(v);
// Same-origin paths only: a look's served file (/api/look/asset?...), an app image (/ig-assets/...), a Library blob.
const localPath = v => { const s = String(v ?? ''); return /^\/(?!\/)[^\s<>"'`\\()]+$/.test(s) && !/^\/(?:_blob|appifact)\//.test(s) ? s : ''; };
const int = (v, what, min, max) => { if (!Number.isInteger(v) || v < min || v > max) placedFail(what + ' is a whole number from ' + min + ' to ' + max + '.'); return v; };
/** The height a placed thing takes when it names none. */
export const placedHeight = t => t.height ?? (t.kind === 'picture' ? Math.round(t.width * 1.25) : t.kind === 'label' ? Math.ceil((t.size ?? 30) * 1.4) : t.kind === 'rule' ? 2 : t.width);

/**
 * Check a slide's placed things and return them tidied, with fixed keys in a fixed order. Values are bounded: every
 * thing sits inside the slide (width by height pixels), and only the fields its kind uses are accepted. `pictures`, when
 * given, maps a picture's asset (a photo id of the plan or its Library id) to the plan's photo id; others are refused.
 */
export function checkPlaced(list, {width = 1080, height = 1350, pictures = null} = {}) {
 if (list === undefined || list === null) return [];
 if (!Array.isArray(list) || list.length > MAX_PLACED) placedFail('Placed things are a list of up to ' + MAX_PLACED + '.');
 return list.map((t, i) => {
  const at = 'Placed thing ' + (i + 1) + ': ';
  if (!t || typeof t !== 'object' || Array.isArray(t)) placedFail(at + 'each is an object.');
  if (!PLACED_KINDS.includes(t.kind)) placedFail(at + 'kind is ' + PLACED_KINDS.join(', ') + '.');
  const allowed = new Set([...COMMON, ...FIELDS[t.kind]]), extra = Object.keys(t).filter(k => !allowed.has(k));
  if (extra.length) placedFail(at + 'a ' + t.kind + ' does not take ' + extra.join(', ') + '.');
  const out = {kind: t.kind};
  if (['logo', 'mark', 'graphic'].includes(t.kind)) { if (typeof t.asset !== 'string' || !ASSET_ID.test(t.asset)) placedFail(at + 'name the look\'s asset by its id, like wordmark.'); out.asset = t.asset; }
  if (t.kind === 'picture') {
   if (typeof t.asset !== 'string' || !PICTURE_ID.test(t.asset)) placedFail(at + 'a picture names a photo of the plan (P1) or its Library id.');
   const photo = pictures ? pictures(t.asset) : t.asset;
   if (!photo) placedFail(at + 'that photo is not in this plan.');
   out.asset = photo;
  }
  if (t.kind === 'label') {
   if (!plainText(t.text) || !t.text.trim() || t.text.length > 60) placedFail(at + 'a label is plain text of up to 60 characters.');
   out.text = t.text;
   out.size = t.size === undefined ? 30 : int(t.size, at + 'size', 16, 160);
  }
  out.x = int(t.x, at + 'x', 0, width - 1);
  out.y = int(t.y, at + 'y', 0, height - 1);
  out.width = int(t.width, at + 'width', 1, width);
  if (t.height !== undefined) out.height = int(t.height, at + 'height', 1, height);
  if (out.x + out.width > width) placedFail(at + 'it runs past the right edge (x ' + out.x + ' + width ' + out.width + ' is more than ' + width + ').');
  if (out.y + placedHeight(out) > height) placedFail(at + 'it runs past the bottom edge (y ' + out.y + ' + height ' + placedHeight(out) + ' is more than ' + height + ').');
  out.z = t.z === undefined ? i : int(t.z, at + 'z', 0, 50);
  if (FIELDS[t.kind].includes('tone')) { const tone = t.tone ?? 'dark'; if (!TONES.includes(tone)) placedFail(at + 'tone is dark or light (the ground it sits on).'); out.tone = tone; }
  if (FIELDS[t.kind].includes('color')) { const c = t.color ?? (t.kind === 'rule' ? 'line' : 'supporting'); if (!COLOR_ROLES.includes(c)) placedFail(at + 'color is one of the look\'s roles: ' + COLOR_ROLES.join(', ') + '.'); out.color = c; }
  return out;
 });
}

/**
 * Which placed things a look can draw. A logo, mark or graphic must be an asset of that very look, of the same kind;
 * anything else is left out with the reason, so it can be reported. Returns {draw, leftOut:[{index, kind, asset, why}]}.
 */
export function resolvePlaced(list, look) {
 const draw = [], leftOut = [], assets = look?.assets || {}, name = look?.name || look?.id || 'this';
 for (const [index, t] of (Array.isArray(list) ? list : []).entries()) {
  if (!ASSET_KINDS.includes(t?.kind)) { draw.push({...t, index}); continue; }
  const a = Object.hasOwn(assets, t.asset) ? assets[t.asset] : null;
  if (!a) leftOut.push({index, kind: t.kind, asset: t.asset, why: 'The ' + name + ' look has no asset ' + t.asset + ', so it is left out.'});
  else if (a.kind !== t.kind) leftOut.push({index, kind: t.kind, asset: t.asset, why: t.asset + ' is a ' + a.kind + ' of the ' + name + ' look, not a ' + t.kind + ', so it is left out.'});
  else draw.push({...t, index, use: a});
 }
 return {draw, leftOut};
}

const px = n => Math.round(Number(n) || 0);
/** The markup of a slide's placed things in a look, stacked by z then by order; empty when there are none to draw. */
export function placedMarkup(list, look) {
 const roles = look || {...TEAJIA_SOURCE, fonts: SOURCE_FONTS}, fonts = roles.fonts?.headline?.family ? roles.fonts : SOURCE_FONTS;
 const {draw} = resolvePlaced(list, look);
 draw.sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || a.index - b.index);
 return draw.map(t => {
  const tone = TONES.includes(t.tone) ? t.tone : 'dark', set = roles[tone] || TEAJIA_SOURCE[tone], h = px(placedHeight(t));
  const box = 'position:absolute;left:' + px(t.x) + 'px;top:' + px(t.y) + 'px;width:' + px(t.width) + 'px;height:' + h + 'px;z-index:' + (px(t.z) + 1);
  const open = style => '<div data-placed="' + t.kind + '" data-placed-index="' + t.index + '" style="' + box + ';' + style + '">';
  if (t.kind === 'rule') return open('background:' + set[COLOR_ROLES.includes(t.color) ? t.color : 'line']) + '</div>';
  if (t.kind === 'label') return open('font-family:' + stackOf(fonts.label) + ';font-size:' + px(t.size || 30) + 'px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;overflow:hidden;color:' + set[COLOR_ROLES.includes(t.color) ? t.color : 'supporting']) + esc(t.text) + '</div>';
  if (t.kind === 'picture') { const src = localPath(t.src); return open('overflow:hidden') + (src ? '<img src="' + esc(src) + '" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block">' : '') + '</div>'; }
  const a = t.use, src = localPath(a.src);
  if (src) return open('overflow:hidden') + '<img src="' + esc(src) + '" alt="' + esc(a.name) + '" draggable="false" style="width:100%;height:100%;object-fit:contain;display:block' + (t.kind === 'logo' && tone === 'light' && !a.light ? ';filter:brightness(0)' : '') + '"></div>';
  // A mark drawn from characters, as the pillar seal is: the look's accent box, its ground for the characters.
  if (t.kind === 'mark' && a.text) return open('background:' + set.accent + ';color:' + set.ground + ';font-family:' + SEAL_STACK + ';font-weight:800;font-size:' + Math.round(Math.min(px(t.width), h) * 0.68) + 'px;line-height:1;display:flex;align-items:center;justify-content:center') + esc(a.text) + '</div>';
  // A logo with no file: the brand's name in its headline type, as the layouts draw it.
  if (t.kind === 'logo') return open('display:flex;align-items:center;white-space:nowrap;overflow:hidden;font-family:' + stackOf(fonts.headline) + ';font-size:' + Math.round(h * 0.62) + 'px;letter-spacing:0.04em;color:' + set.headline) + esc(roles.logo?.wordmark || look?.name || '') + '</div>';
  return '';
 }).join('');
}

/** A drawn card with its placed things laid on top, inside its own frame. With none, the card comes back unchanged. */
export function withPlaced(card, list, look) {
 if (!Array.isArray(list) || !list.length || !card.endsWith('</div>')) return card;
 const marks = placedMarkup(list, look);
 return marks ? card.slice(0, -6) + marks + '</div>' : card;
}
