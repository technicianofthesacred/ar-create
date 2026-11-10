// Short codes for Carousel layouts, so a layout can be said aloud: "use C1, 2 and 5".
// A code is a row letter and the layout's place in that row (C1, S2, M5). The rows, their order and the order inside
// each row are the Instagram system canvas's own. The canvas's number (P06, N13) is what the layouts are keyed by in
// ig-original-layouts.json; the codes only name them.
//
// THIS TABLE IS APPEND-ONLY. A code, once given, is never reused, moved or renumbered: people have said it aloud and
// saved it. Add a new layout by appending one item at the END of its row (the next number) or by adding a new row at
// the end of ROWS with a new letter. Never insert in the middle, reorder, or delete an item (a retired layout keeps its
// line). Every code is written out in full for that reason, not worked out from the position.
//
// Each item is [code, layout, plain name, kind?]. `layout` is the canvas number for the 58 canvas layouts, or the
// layout's own id for the hand-written H1 and the four AR layouts. `kind` (cover, inner, single or close) defaults to
// the row's kind.
export const ROWS = Object.freeze([
 {letter: "C", row: "Covers", kind: "cover", items: [
  ["C1", "P06", "Night bleed"],
  ["C2", "N13", "Journey cover, logo in a box"],
  ["C3", "M01", "Triptych"],
  ["C4", "M03", "Grid with a centre box"]
 ]},
 {letter: "S", row: "Photo beside words", kind: "inner", items: [
  ["S1", "H1", "Scroll black"],
  ["S2", "P02", "Scroll white, long text"],
  ["S3", "P03", "Scroll black, text room"],
  ["S4", "N01", "Scroll white"],
  ["S5", "N02", "Scroll black, photo right"],
  ["S6", "N03", "Long text, black"]
 ]},
 {letter: "P", row: "Plates and bands", kind: "inner", items: [
  ["P1", "P04", "Plate black"],
  ["P2", "P05", "Plate white"],
  ["P3", "N04", "Plate white, big image"],
  ["P4", "N05", "Landscape plate"],
  ["P5", "N08", "Full photo, black band"],
  ["P6", "M09", "Gallery mat"]
 ]},
 {letter: "B", row: "Full photo with a box", kind: "inner", items: [
  ["B1", "N06", "Black box top, quote"],
  ["B2", "N07", "White box top right"],
  ["B3", "M05", "Picture in picture"]
 ]},
 {letter: "M", row: "Several photographs", kind: "inner", items: [
  ["M1", "N09", "Diptych, black band"],
  ["M2", "M04", "One big, one small"],
  ["M3", "M07", "Two places, contrast"],
  ["M4", "M10", "Full photo and two details"],
  ["M5", "M11", "Quote with photo strip"]
 ]},
 {letter: "N", row: "Chapters and numbers", kind: "inner", items: [
  ["N1", "M12", "Chapter divider"],
  ["N2", "M14", "Big number"]
 ]},
 {letter: "F", row: "Full picture", kind: "inner", items: [
  ["F1", "F01", "Full photo, quote low"],
  ["F2", "F02", "Full photo, title top, vertical characters"],
  ["F3", "F03", "Pure photo, wordmark only"],
  ["F4", "F04", "Full photo, one line on a rule"],
  ["F5", "F05", "Full photo with a seal"],
  ["F6", "F06", "Near-full photo, caption strip"]
 ]},
 {letter: "A", row: "Single posts", kind: "single", items: [
  ["A1", "P07", "Soft bleed"],
  ["A2", "P08", "White box"],
  ["A3", "P09", "Black box"],
  ["A4", "N12", "Solar term"]
 ]},
 {letter: "J", row: "The three jiā", kind: "single", items: [
  ["J1", "J01", "家 filled with a photo"],
  ["J2", "J02", "佳 cut out of black"],
  ["J3", "J03", "嘉 cut out of white"],
  ["J4", "J04", "One sound, three pillars"],
  ["J5", "J05", "Outlined 佳 over a photo"],
  ["J6", "J06", "Pillar seal on a regular slide"]
 ]},
 {letter: "E", row: "Closes", kind: "close", items: [
  ["E1", "P10", "Full story link"],
  ["E2", "N14", "Come share a cup"],
  ["E3", "N15", "Full story, split"],
  ["E4", "M15", "Four frames, one line"]
 ]},
 {letter: "Y", row: "Earlier, site colours", kind: "inner", items: [
  ["Y1", "C01", "Scroll, charcoal and gold"],
  ["Y2", "C02", "Plate, charcoal and gold"],
  ["Y3", "C03", "Box, charcoal and gold"],
  ["Y4", "C04", "Cover, charcoal and gold", "cover"],
  ["Y5", "C05", "Full story, charcoal and gold", "close"],
  ["Y6", "C06", "家, charcoal and gold"],
  ["Y7", "C07", "Scroll, cream and gold"],
  ["Y8", "C08", "Close, cream and gold", "close"]
 ]},
 {letter: "Z", row: "Earlier, terracotta blend", kind: "inner", items: [
  ["Z1", "B01", "Scroll with terracotta characters"],
  ["Z2", "B02", "Chapter with terracotta"],
  ["Z3", "B03", "Full photo seal, terracotta"],
  ["Z4", "B04", "Pillar seal, terracotta"],
  ["Z5", "B05", "Three jiā, terracotta"]
 ]},
 {letter: "R", row: "Story and reel", kind: "inner", items: [
  ["R1", "AR-S1", "Said, under the photo"],
  ["R2", "AR-R1", "Reel line"],
  ["R3", "AR-R2", "Reel cover, grid safe", "cover"],
  ["R4", "AR-P1", "Field note"]
 ]},
]);

// Older hand-written layouts that duplicate a canvas layout. They share their canvas twin's code, so an old plan that
// names H6 shows as C1. Old id -> the canvas number it duplicates. (The old H1 is not here: it is the canvas's own
// first artboard, "scroll black", and holds the code S1 itself.)
export const OLD_TWINS = Object.freeze({H6: "P06", F1: "F01", H4: "P04", H9: "P09", N9: "N09", M12: "M12", H10: "P10"});

const rowLetters = new Set(ROWS.map(r => r.letter));
const NUMBER_WORDS = Object.freeze({one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
 thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20});

/** One entry per code, in canvas order: {code, letter, row, rowLetter, number, layout, name, kind}. `layout` is the table's key. */
export const ENTRIES = Object.freeze(ROWS.flatMap(r => r.items.map(([code, layout, name, kind], i) => Object.freeze({code, letter: r.letter, row: r.row, rowLetter: r.letter, number: i + 1, layout, name, kind: kind || r.kind}))));
const byCode = new Map(ENTRIES.map(e => [e.code, e]));
const rowOf = new Map(ROWS.map(r => [r.letter, r]));

/**
 * The catalogue's real id for a table key. Canvas layouts are keyed like "canvas-P06-night" in the catalogue and
 * carry their canvas number as originalId; the hand-written ones are keyed by their own id.
 * @param {Record<string,{originalId?:string}>} catalog the catalogue (id -> layout)
 */
export function idsFor(catalog) {
 const canvas = new Map();
 for (const [id, l] of Object.entries(catalog)) if (l?.originalId) canvas.set(l.originalId, id);
 const real = key => canvas.get(key) || (Object.hasOwn(catalog, key) ? key : null);
 const canonical = new Map(), codeOf = new Map();
 for (const e of ENTRIES) { const id = real(e.layout); if (id) { canonical.set(e.code, id); codeOf.set(id, e.code); } }
 for (const [old, twin] of Object.entries(OLD_TWINS)) {
  const id = Object.hasOwn(catalog, old) && !catalog[old].originalId ? old : null, to = real(twin), code = to && codeOf.get(to);
  if (id && code) codeOf.set(id, code);
 }
 return {canonical, codeOf};
}

/** Table entry for a code, in any case: "c1" or "C1". Null when no layout has it. */
export const entryForCode = code => byCode.get(String(code ?? '').trim().toUpperCase()) || null;

/**
 * Resolve helpers over one catalogue. `catalog` maps real layout ids to layouts (the Carousel catalogue IG.T, or
 * IG.T plus the AR layouts as {id: {}}). Returned: codeToLayoutId (any case), layoutIdToCode (an old id gives its twin's
 * code), resolveLayoutId (an id or a code in, a real id out; ids that exist win, anything unknown comes back unchanged
 * so the caller's own error still names what was sent).
 */
export function resolvers(catalog) {
 const {canonical, codeOf} = idsFor(catalog);
 const codeToLayoutId = code => canonical.get(String(code ?? '').trim().toUpperCase()) || null;
 const layoutIdToCode = id => codeOf.get(id) || null;
 const resolveLayoutId = value => (typeof value === 'string' && !Object.hasOwn(catalog, value) && codeToLayoutId(value)) || value;
 return {codeToLayoutId, layoutIdToCode, resolveLayoutId, canonical, codeOf};
}

/**
 * Hear codes in a spoken or typed line. A letter carries over to the bare numbers after it ("C1, 2 and 5" is C1, C2,
 * C5); numbers may be written as words, one to twenty ("M two and five"); a lone number before any letter is ignored,
 * and so is a line with no codes. A code that names no layout is reported, never guessed.
 * Returns {codes: every code heard, in order, upper case; unknown: [{code, reason}] for those naming no layout; usable: the codes that do}.
 * `known` lists further codes that name a layout: the codes the home's own templates were given (C5 after the shipped C4).
 */
export function hearCodes(line, {known = []} = {}) {
 const more = new Set((Array.isArray(known) ? known : []).map(c => String(c).toUpperCase()));
 const text = String(line ?? '').toLowerCase().replace(/[\u2018\u2019]/g, "'");
 const tokens = [], re = /[a-z]+(?:'[a-z]+)*|\d+|[.;:!?\n,]/g;
 let m;
 while ((m = re.exec(text))) tokens.push({t: m[0], at: m.index, end: m.index + m[0].length});
 const numberOf = t => /^\d+$/.test(t) ? Number(t) : Object.hasOwn(NUMBER_WORDS, t) ? NUMBER_WORDS[t] : null;
 // A number is carried to the previous letter only across commas, "and", "then" and plain spaces between codes.
 const connectors = new Set(['and', 'then']);
 // A spaced single letter ("c one") starts a code only at the start of a line or sentence, after a comma, after
 // "use", "then" or "and", or straight after another code. "I have a 2 year old" is not A2. Written together
 // ("a2", "c1") it is always a code.
 const mayStart = new Set(['use', 'then', 'and', ',']);
 const heard = [];
 let letter = null;
 for (let i = 0; i < tokens.length; i++) {
  const {t} = tokens[i], n = numberOf(t), prev = tokens[i - 1]?.t;
  if (/^[.;:!?\n]$/.test(t)) letter = null;
  else if (t === ',') continue;
  else if (n !== null) { if (letter) heard.push({letter, n, digits: /^\d+$/.test(t) ? t : String(n)}); }
  else if (/^[a-z]$/.test(t)) {
   const next = tokens[i + 1], nn = next ? numberOf(next.t) : null;
   const attached = nn !== null && next.at === tokens[i].end;
   const spaced = nn !== null && rowLetters.has(t.toUpperCase()) && (prev === undefined || /^[.;:!?\n]$/.test(prev) || mayStart.has(prev) || letter !== null);
   letter = attached || spaced ? t.toUpperCase() : null;
  } else if (!connectors.has(t)) letter = null;
 }
 const usable = [], unknown = [], said = [];
 for (const {letter: l, n, digits} of heard) {
  const code = l + n, row = rowOf.get(l);
  if (/^0\d/.test(digits)) {
   // A leading zero is the canvas's own number (P06), which is not the same thing as a code (P6).
   const raw = l + digits, twin = ENTRIES.find(e => e.layout === raw);
   said.push(raw);
   unknown.push({code: raw, reason: twin ? raw + " is the canvas's number for " + twin.code + '. Say ' + twin.code + '.' : raw + " is not a layout code. Say a row letter and its place, like C1."});
   continue;
  }
  said.push(code);
  if (!row) unknown.push({code, reason: 'There is no row ' + l + '.'});
  else if ((n < 1 || n > row.items.length) && !more.has(code)) unknown.push({code, reason: 'Row ' + l + ' (' + row.row + ') has ' + row.items.length + ' layouts, so ' + code + ' names none.'});
  else usable.push(code);
 }
 return {codes: said, unknown, usable};
}
