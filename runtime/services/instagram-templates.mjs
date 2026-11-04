// Instagram formats and templates for the Instagram studio (transcript and photos in, story, reel, post or carousel out).
// The existing Teajia catalog (ig-templates.js, 4:5 only) is reused unchanged; this module adds the facts about each
// Instagram format and four templates in Adrian's own look (his art site: Cormorant Garamond for titles, Lora for speech,
// warm dark ground, one bronze accent, no borders, no gradients). Every size is the real Instagram pixel size.
import IG from '../src/donors/mag/carousel/ig-templates.js';

// Facts, not formula. Checked 3 November 2026 against press coverage of Instagram's own announcements; the safe zones
// are what layout guides report, since Instagram does not publish one number. Kept here so the app, the agents and the
// tests read the same values.
export const FORMATS = Object.freeze({
 story: {label: 'Story', width: 1080, height: 1920, ratio: '9:16', safe: {top: 250, bottom: 250, left: 64, right: 64}, frames: [1, 10],
  note: 'Full screen, 24 hours. The top and bottom 250px sit under the profile bar and reply field.'},
 reel: {label: 'Reel', width: 1080, height: 1920, ratio: '9:16', safe: {top: 220, bottom: 420, left: 64, right: 160}, frames: [1, 40], maxSeconds: 180,
  grid: {top: 240, bottom: 1680}, feed: {top: 285, bottom: 1635},
  note: 'Up to 3 minutes. The caption and buttons cover the bottom 420px and the right 160px. The profile grid shows the centre 3:4 (1080 x 1440) of the cover, the feed the centre 4:5.'},
 post: {label: 'Post', width: 1080, height: 1350, ratio: '4:5', safe: {top: 0, bottom: 0, left: 34, right: 34}, frames: [1, 1],
  note: 'One photo at 4:5. The profile grid crops it to 3:4, trimming about 34px from each side.'},
 carousel: {label: 'Carousel', width: 1080, height: 1350, ratio: '4:5', safe: {top: 0, bottom: 0, left: 34, right: 34}, frames: [2, 20],
  note: 'Up to 20 slides, all cropped to the first slide\'s shape. The grid shows the first slide cropped to 3:4.'},
});
export const CAPTION = Object.freeze({maxChars: 2200, maxHashtags: 5});
export const FACTS = Object.freeze([
 {fact: 'Stories and reels are 1080 x 1920 (9:16).', basis: 'Instagram specification as published by layout guides, 2026.'},
 {fact: 'Reels can be up to 3 minutes.', basis: 'Adam Mosseri, January 2025. Some accounts report longer limits; not confirmed.'},
 {fact: 'The profile grid is 3:4 rectangles, not squares.', basis: 'Adam Mosseri, January 2025.'},
 {fact: 'Carousels hold up to 20 photos or videos.', basis: 'Instagram global rollout, August 2024.'},
 {fact: 'A caption holds up to 2,200 characters and at most 5 hashtags.', basis: 'Hashtag cap announced by Instagram, December 2025.'},
 {fact: 'Story safe zone: keep words out of the top and bottom 250px. Reel safe zone: about 220px top, 420px bottom, 160px right.', basis: 'Layout guides, 2026. Instagram publishes no single number.'},
]);

// His look, from the art site's design (Adrian-Website DESIGN.md): warm dark ground, cream text, one bronze accent.
const C = Object.freeze({ground: '#201d1a', step: '#2b2723', ink: '#f2efe9', soft: '#d6cdbf', dim: '#9a9083', bronze: '#c4aa7c'});
const F = Object.freeze({title: "'Cormorant Garamond',Georgia,serif", speech: "'Lora',Georgia,serif", label: "'Plus Jakarta Sans',Arial,sans-serif"});
export const FONT_FILES = Object.freeze([
 ['Cormorant Garamond', 500, 'normal', '/assets/fonts/cormorant-garamond-500-normal-latin.woff2', 'woff2'],
 ['Lora', 400, 'normal', '/assets/fonts/lora-400-normal-latin.woff2', 'woff2'],
 ['Lora', 400, 'italic', '/assets/fonts/lora-400-italic-latin.woff2', 'woff2'],
 ['Plus Jakarta Sans', 400, 'normal', '/assets/fonts/plus-jakarta-sans-400-normal-latin.woff2', 'woff2'],
 ['Plus Jakarta Sans', 500, 'normal', '/assets/fonts/plus-jakarta-sans-500-normal-latin.woff2', 'woff2'],
 ['Plus Jakarta Sans', 600, 'normal', '/assets/fonts/plus-jakarta-sans-600-normal-latin.woff2', 'woff2'],
 // The Teajia catalog's own type, as its exports load it.
 ['Caudex', 400, 'normal', '/assets/fonts/Caudex-Regular.ttf', 'truetype'],
 ['EB Garamond', 400, 'normal', '/ig-assets/eb-garamond-400-normal.ttf', 'truetype'],
 ['EB Garamond', 500, 'normal', '/ig-assets/eb-garamond-500-normal.ttf', 'truetype'],
 ['Shippori Mincho', 700, 'normal', '/ig-assets/shippori-mincho-700-normal.ttf', 'truetype'],
 ['Shippori Mincho', 800, 'normal', '/ig-assets/shippori-mincho-800-normal.ttf', 'truetype'],
 ['Noto Serif TC', 900, 'normal', '/ig-assets/noto-serif-tc-900-normal.ttf', 'truetype'],
]);

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Only same-origin paths, simple relative files or inline image data may enter rendered markup.
export function localImage(value) {
 const url = String(value ?? '');
 if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) return url;
 if (/^\/(?!\/)[^\s<>"'`\\()]+$/.test(url) && !/^\/(?:_blob|appifact)\//.test(url)) return url;
 if (/^(?!\/)(?![a-z][a-z0-9+.-]*:)[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(url) && !url.includes('..')) return url;
 return '';
}
const focus = n => { const v = Number(n); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50; };
// Words shrink as they lengthen, between a largest and a smallest size, so a short line stays big.
const fit = (text, max, min, from, to) => { const n = String(text || '').length; if (n <= from) return max; if (n >= to) return min; return Math.round(max - (max - min) * (n - from) / (to - from)); };
const photo = (s, i, box) => {
 const p = (s.photos || [])[i], url = localImage(p?.src);
 const inner = url ? '<img src="' + esc(url) + '" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;object-position:' + focus(p.x) + '% ' + focus(p.y) + '%;display:block">'
  : '<div aria-label="Photo needed" style="width:100%;height:100%;background:' + C.step + ';color:' + C.dim + ';font:500 30px ' + F.label + ';letter-spacing:.14em;text-transform:uppercase;display:flex;align-items:center;justify-content:center">photo needed</div>';
 return '<div data-slot="' + i + '" style="position:absolute;overflow:hidden;' + box + '">' + inner + '</div>';
};
const label = (t, px = 26, color = C.bronze, extra = '') => t ? '<div data-edit="label" style="font:600 ' + px + 'px ' + F.label + ';letter-spacing:.2em;text-transform:uppercase;color:' + color + ';' + extra + '">' + esc(t) + '</div>' : '';
const credit = (t, px = 26) => t ? '<div data-edit="credit" style="font:400 ' + px + 'px ' + F.label + ';letter-spacing:.04em;color:' + C.dim + '">' + esc(t) + '</div>' : '';
const frame = (w, h, body) => '<div data-ig-frame style="width:' + w + 'px;height:' + h + 'px;position:relative;overflow:hidden;background:' + C.ground + ';color:' + C.ink + ';font-family:' + F.speech + '">' + body + '</div>';
const pad = n => String(n).padStart(2, '0');
const clock = sec => Math.floor(sec / 60) + ':' + pad(Math.floor(sec % 60));

// The four new templates. `box` is each template's text area in frame pixels, checked against the format's safe zone
// by the tests; `maxChars` is the most text that still fits at the smallest size.
export const NEW_TEMPLATES = Object.freeze({
 'AR-S1': {name: 'Said, under the photo', formats: ['story'], photos: 1, roles: ['cover', 'inner', 'close'], textParts: 1, maxChars: 260, look: 'personal',
  purpose: 'A story frame: the photo above, his spoken line below it on the ground, where the profile bar and reply field cannot cover it.',
  box: {left: 96, right: 984, top: 1232, bottom: 1670},
  render: s => frame(1080, 1920, photo(s, 0, 'left:0;top:0;width:1080px;height:1160px') +
   '<div data-text-zone style="position:absolute;left:96px;right:96px;top:1232px;bottom:250px;display:flex;flex-direction:column;justify-content:center;gap:30px">' +
   label(s.label) +
   '<div style="position:relative"><span aria-hidden="true" style="position:absolute;left:-58px;top:-26px;font:500 128px/1 ' + F.title + ';color:' + C.bronze + '">“</span>' +
   '<div data-edit="text" data-base-font-size="60" style="font:400 ' + fit(s.text, 60, 40, 110, 260) + 'px/1.32 ' + F.speech + ';color:' + C.ink + ';white-space:pre-wrap;overflow-wrap:anywhere">' + esc(s.text) + '</div></div>' +
   credit(s.credit) + '</div>')},
 'AR-R1': {name: 'Reel line', formats: ['reel', 'story'], photos: 1, roles: ['inner'], textParts: 1, maxChars: 160, look: 'personal',
  purpose: 'One beat of a reel: footage or a photo fills the frame and his line sits low on printed strips, above the reel caption and left of the buttons. Its time is the label.',
  box: {left: 72, right: 920, top: 1060, bottom: 1500},
  render: (s, ctx = {}) => frame(1080, 1920, photo(s, 0, 'inset:0') +
   '<div data-text-zone style="position:absolute;left:72px;right:160px;bottom:420px;display:flex;flex-direction:column;align-items:flex-start;gap:20px">' +
   label(s.label || (Number.isFinite(ctx.start) ? clock(ctx.start) : ''), 24, C.bronze, 'background:' + C.ground + ';padding:8px 14px') +
   '<div data-edit="text" data-base-font-size="54" style="font:400 ' + fit(s.text, 54, 42, 70, 160) + 'px/1.55 ' + F.speech + ';color:' + C.ink + ';white-space:pre-wrap;overflow-wrap:anywhere">' +
   '<span style="background:' + C.ground + ';padding:.1em .34em;-webkit-box-decoration-break:clone;box-decoration-break:clone">' + esc(s.text) + '</span></div>' +
   (s.credit ? '<div style="background:' + C.ground + ';padding:6px 14px">' + credit(s.credit, 24) + '</div>' : '') + '</div>')},
 'AR-R2': {name: 'Reel cover, grid safe', formats: ['reel'], photos: 1, roles: ['cover'], textParts: 1, maxChars: 90, look: 'personal',
  purpose: 'The cover a reel shows on the profile grid. Photo and title both sit inside the centre 3:4, so the grid and the feed crop nothing that matters.',
  box: {left: 160, right: 920, top: 1090, bottom: 1480},
  render: s => frame(1080, 1920, photo(s, 0, 'left:0;top:300px;width:1080px;height:740px') +
   '<div data-text-zone style="position:absolute;left:160px;right:160px;top:1090px;bottom:440px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;text-align:center">' +
   label(s.label) +
   '<div data-edit="text" data-base-font-size="92" style="font:500 ' + fit(s.text, 88, 60, 30, 90) + 'px/1.08 ' + F.title + ';color:' + C.ink + ';white-space:pre-wrap;overflow-wrap:anywhere">' + esc(s.text) + '</div>' +
   credit(s.credit) + '</div>')},
 'AR-P1': {name: 'Field note', formats: ['post', 'carousel'], photos: 1, roles: ['cover', 'inner', 'close'], textParts: 1, maxChars: 180, look: 'personal',
  purpose: 'A post or carousel slide like a page from a field notebook: the photo set in from the left and running off the right edge, his line beneath, where and when in the margin.',
  box: {left: 96, right: 930, top: 940, bottom: 1200},
  render: (s, ctx = {}) => frame(1080, 1350, photo(s, 0, 'left:96px;top:96px;width:984px;height:790px') +
   '<div data-text-zone style="position:absolute;left:96px;right:150px;top:940px;bottom:150px;display:flex;flex-direction:column;justify-content:center;gap:22px">' +
   (ctx.total > 1 ? label(pad(ctx.index + 1) + ' / ' + pad(ctx.total), 24) : '') +
   '<div data-edit="text" data-base-font-size="46" style="font:400 ' + fit(s.text, 46, 34, 80, 180) + 'px/1.38 ' + F.speech + ';color:' + C.ink + ';white-space:pre-wrap;overflow-wrap:anywhere">' + esc(s.text) + '</div></div>' +
   '<div style="position:absolute;left:96px;right:96px;bottom:76px;display:flex;justify-content:space-between;align-items:baseline;gap:40px">' +
   label(s.label, 22, C.dim) + credit(s.credit, 22) + '</div>')},
});

// A magazine (Teajia) card is 4:5; in a story it sits whole on the dark ground, inside the band the profile bar and
// reply field never cover (top 285 to 1635, the same band the feed shows of a reel), so every magazine look is also a story.
const STORY_CARD_TOP = 285;
// Above and below the card, the same photo, blurred and darkened, so the story is full-bleed rather than a card on a band.
const storyBackdrop = src => src ? '<img src="' + esc(src) + '" alt="" aria-hidden="true" style="position:absolute;left:-80px;top:-80px;width:1240px;height:2080px;object-fit:cover;filter:blur(40px) brightness(.36) saturate(.9)">' : '';
const onStoryGround = (card, src) => frame(1080, 1920, storyBackdrop(src) + '<div data-story-card style="position:absolute;left:0;top:' + STORY_CARD_TOP + 'px;width:1080px;height:1350px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45)">' + card + '</div>');

/** Every template the studio can use: the four new ones first, then the existing 4:5 catalog, tagged by format. */
export function catalog() {
 const fresh = Object.entries(NEW_TEMPLATES).map(([id, t]) => ({id, name: t.name, formats: t.formats, photos: t.photos, roles: t.roles, textParts: t.textParts, maxChars: t.maxChars, look: t.look, group: 'New: his look', purpose: t.purpose, box: t.box, isNew: true}));
 const existing = Object.entries(IG.T).map(([id, t]) => ({id, name: t.name, formats: ['post', 'carousel', 'story'], photos: t.photos, roles: t.roles, textParts: t.textParts || 1, maxChars: 400, look: 'teajia', group: t.group || 'Teajia: first set', isNew: false}));
 return [...fresh, ...existing];
}
export const templateById = id => catalog().find(t => t.id === id) || null;

/** One frame's markup. slide: {role, text, label, credit, photos:[{src,x,y}]}; ctx: {index, total, start, format}. */
export function renderFrame(id, slide = {}, ctx = {}) {
 if (NEW_TEMPLATES[id]) return NEW_TEMPLATES[id].render(slide, ctx);
 if (!IG.T[id]) throw new Error('Unknown Instagram template ' + id);
 const photos = (slide.photos || []).map(p => ({...p, src: localImage(p?.src)}));
 const card = IG.render(id, {...slide, photos}, ctx);
 return ctx.format === 'story' ? onStoryGround(card, photos[0]?.src) : card;
}
const fontCss = () => FONT_FILES.map(([family, weight, style, file, format]) => '@font-face{font-family:"' + family + '";font-style:' + style + ';font-weight:' + weight + ';src:url(' + file + ') format("' + format + '")}').join('');
/** A whole HTML page holding one frame at its real size, for the app preview and for PNG export. */
export function frameDocument(format, html, title = 'Instagram frame') {
 const f = FORMATS[format] || FORMATS.post;
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + fontCss() + 'html,body{margin:0;padding:0;background:' + C.ground + '}body{width:' + f.width + 'px;height:' + f.height + 'px;overflow:hidden}</style></head><body>' + html + '</body></html>';
}
/** All frames of one piece side by side, scaled, for a quick look (agents link to it; the app shows its own). */
export function sheetDocument(format, frames, title = 'Instagram piece') {
 const f = FORMATS[format] || FORMATS.post, scale = 0.25;
 const cells = frames.map((html, i) => '<figure><div class="clip" style="width:' + f.width * scale + 'px;height:' + f.height * scale + 'px"><div style="transform:scale(' + scale + ');transform-origin:0 0;width:' + f.width + 'px;height:' + f.height + 'px">' + html + '</div></div><figcaption>' + (i + 1) + '</figcaption></figure>').join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' + fontCss() + 'body{margin:0;padding:24px;background:#141310;color:#a39e8e;font:14px "Plus Jakarta Sans",Arial,sans-serif}h1{font-size:15px;font-weight:600;color:#e7e1d3;margin:0 0 16px}main{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0}.clip{overflow:hidden;border-radius:6px}figcaption{margin-top:6px}</style></head><body><h1>' + esc(title) + ' · ' + esc(f.label) + ' · ' + f.width + ' x ' + f.height + '</h1><main>' + cells + '</main></body></html>';
}
