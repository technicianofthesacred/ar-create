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
