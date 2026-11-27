/** The scroll test: a carousel read the way a scrolling reader meets it, slide by slide, from its saved words only.
 * The rules are the carousel guide's (editorial/stages/arcreate/carousel-guide.md). Only what can be counted is
 * judged here: length, repeats, empty slides, the slide count and the caption's first line. What needs an eye
 * (does the cover stand out, does slide 2 keep the cover's promise) comes back as questions, never as a verdict.
 * Pure: no I/O, no model, no writes. It never changes a word; it only reports.
 */
export const SCROLL_TEST_SCHEMA = 'ar-create.carousel-scroll-test.v1';

// Word budgets from the guide. They are guidance for a reader on a phone, not limits the words must be cut to.
export const SCROLL_LIMITS = Object.freeze({coverWords: 12, photoWords: 8, slideWords: 35, minSlides: 4, maxSlides: 10, captionFirstLine: 125, repeatOverlap: 0.6});
const PHOTO_ROLES = new Set(['photo', 'scene']);

const textOf = slide => {
  if (!slide || typeof slide !== 'object') return '';
  if (typeof slide.text === 'string') return slide.text;
  if (Array.isArray(slide.words)) return slide.words.map(w => String(w?.text || '')).join(' ');
  return '';
};
const wordsIn = text => (String(text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []);
const sentencesIn = text => String(text).split(/(?<=[.!?。])\s+/).map(s => s.trim()).filter(s => wordsIn(s).length);
const photoCount = slide => Array.isArray(slide?.photos) ? slide.photos.filter(Boolean).length : 0;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// Short words carry no meaning for a repeat; counting them would make any two slides look alike.
const STOP = new Set('a an and are as at be but by for from has have he her his i in is it its me my of on or our she so that the their them they this to was we were what when which who with you your'.split(' '));
const meaningful = text => new Set(wordsIn(text).filter(w => w.length > 2 && !STOP.has(w)));
function overlap(a, b) {
  if (a.size < 3 || b.size < 3) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

/** slides: [{role, text | words:[{text}], photos?}], caption: string. Returns the scroll test report. */
export function scrollTest({slides = [], caption = ''} = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const rows = list.map((slide, index) => {
    const text = textOf(slide), words = wordsIn(text).length;
    return {index, number: index + 1, role: String(slide?.role || ''), text, words, sentences: sentencesIn(text).length, photos: photoCount(slide), terms: meaningful(text)};
  });
  const last = rows.length - 1;
  const report = {schema: SCROLL_TEST_SCHEMA, slideCount: rows.length, cover: null, slides: [], deck: [], cut: [], biggestFix: null, forYourEye: []};
  if (!rows.length) {
    report.biggestFix = 'This carousel has no slides yet.';
    return report;
  }

  // The cover: about one second in the feed.
  const cover = rows[0], coverChecks = [];
  coverChecks.push({id: 'cover-short', label: 'Short enough to take in at a glance', pass: cover.words > 0 && cover.words <= SCROLL_LIMITS.coverWords,
    note: !cover.words ? (cover.photos ? 'The cover is a photograph with no words. Make sure the picture alone says what this is.' : 'The cover has no words and no photograph.') : cover.words <= SCROLL_LIMITS.coverWords ? `${plural(cover.words, 'word')}.` : `${plural(cover.words, 'word')}. At stamp size, aim for about ${SCROLL_LIMITS.coverWords} or fewer.`});
  coverChecks.push({id: 'cover-one-thought', label: 'One thought, not a summary', pass: cover.sentences <= 2 && !/(^|\n)\s*(?:\d+[.)]|[-•])\s/.test(cover.text),
    note: cover.sentences <= 2 ? 'Reads as one thought.' : `${plural(cover.sentences, 'sentence')}. A cover that explains everything leaves no reason to swipe.`});
  const echo = rows.slice(1).find(row => overlap(cover.terms, row.terms) >= SCROLL_LIMITS.repeatOverlap);
  coverChecks.push({id: 'cover-not-repeated', label: 'Kept back, not repeated later', pass: !echo,
    note: echo ? `Slide ${echo.number} says much of what the cover says, so the reader feels done early.` : 'No later slide repeats it.'});
  const passed = coverChecks.filter(c => c.pass).length;
  report.cover = {passed, measured: coverChecks.length, checks: coverChecks, words: cover.words};

  // Every slide: a reason to swipe, or a reason to leave.
  for (const row of rows) {
    const leave = [], keep = [];
    const photoLed = PHOTO_ROLES.has(row.role) || (row.photos > 0 && row.index > 0 && row.index < last && row.words <= SCROLL_LIMITS.photoWords);
    if (!row.words && !row.photos) leave.push('No words and no photograph.');
    if (row.index > 0) {
      const earlier = rows.slice(0, row.index).find(prev => overlap(prev.terms, row.terms) >= SCROLL_LIMITS.repeatOverlap);
      if (earlier) leave.push(`Repeats slide ${earlier.number}. Nothing new to swipe for.`);
    }
    if (row.index > 0 && photoLed && row.words > SCROLL_LIMITS.photoWords) leave.push(`${plural(row.words, 'word')} on a photograph slide. Let the picture carry it (about ${SCROLL_LIMITS.photoWords} or fewer).`);
    else if (row.index > 0 && row.words > SCROLL_LIMITS.slideWords) leave.push(`${plural(row.words, 'word')}. On a phone this looks like work; it may be two slides.`);
    else if (row.index > 0 && row.sentences >= 4) leave.push(`${plural(row.sentences, 'sentence')}. Check it carries one idea.`);
    if (row.index === last && rows.length > 1 && row.role && !['close'].includes(row.role)) keep.push('The last slide is where they decide what to do next. Make sure it closes.');
    if (!leave.length) keep.unshift(row.index === 0 ? 'The cover.' : row.index === last && row.role === 'close' ? 'The close.' : row.photos && row.words <= SCROLL_LIMITS.photoWords ? 'Picture first, few words.' : 'One short idea.');
    report.slides.push({number: row.number, role: row.role, words: row.words, verdict: leave.length ? 'leave' : 'swipe', reasons: leave.length ? leave : keep});
  }

  // The whole carousel.
  if (rows.length < SCROLL_LIMITS.minSlides) report.deck.push({id: 'deck-short', note: `${plural(rows.length, 'slide')}. Under ${SCROLL_LIMITS.minSlides} rarely leaves room for a hook, a turn and a takeaway.`});
  if (rows.length > SCROLL_LIMITS.maxSlides) report.deck.push({id: 'deck-long', note: `${plural(rows.length, 'slide')}. Every slide that does not add something is a place to leave.`});
  const firstLine = String(caption || '').split(/\r?\n/).map(l => l.trim()).find(Boolean) || '';
  if (!firstLine) report.deck.push({id: 'caption-missing', note: 'No caption yet. Its first line shows under the post; treat it as a second hook.'});
  else if (firstLine.length > SCROLL_LIMITS.captionFirstLine) report.deck.push({id: 'caption-long', note: `The caption's first line is ${firstLine.length} characters; Instagram cuts it at about ${SCROLL_LIMITS.captionFirstLine}, so the hook may be hidden behind "more".`});

  // Which slides could go: the ones that repeat or carry nothing. Long slides are for splitting, not cutting.
  report.cut = report.slides.filter(s => s.number > 1 && s.reasons.some(r => /^Repeats slide|^No words and no photograph/.test(r))).map(s => s.number);

  report.biggestFix = !report.cover.checks[0].pass ? `Shorten the cover. ${report.cover.checks[0].note}`
    : !report.cover.checks[2].pass ? `Hold the cover's answer back. ${report.cover.checks[2].note}`
    : report.cut.length ? `Cut slide${report.cut.length > 1 ? 's' : ''} ${report.cut.join(', ')}. ${plural(rows.length - report.cut.length, 'slide')} would carry the same story.`
    : report.slides.find(s => s.verdict === 'leave') ? `Slide ${report.slides.find(s => s.verdict === 'leave').number}: ${report.slides.find(s => s.verdict === 'leave').reasons[0]}`
    : !report.cover.checks[1].pass ? `Make the cover one thought. ${report.cover.checks[1].note}`
    : report.deck[0]?.note || 'Nothing countable stands out. Use the questions below.';

  report.forYourEye = [
    'Cover: where does the eye land first, and does it look different from the posts around it?',
    'Cover: can you say what it is about in six words?',
    'Slide 2: does it keep the cover’s promise straight away?',
    'Photographs: does each one show the real thing the words are about?',
    'Last slide: does it give a real takeaway and one clear next step?',
  ];
  return report;
}

const escHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
/** The report as plain markup for any screen that shows it (Check in Advanced, the slide studio). Every value is
 * escaped. `current` (a slide number) marks that slide's line. Classes start with st-. */
export function scrollTestMarkup(report, {current = null, title = 'Scroll test', guide = null} = {}) {
  if (!report || report.schema !== SCROLL_TEST_SCHEMA) return '';
  const e = escHTML;
  const head = `<div class="st-head"><h3 class="st-title">${e(title)}</h3><span class="st-note">Advice from the saved words. It never changes them or holds the carousel.</span></div>`;
  if (!report.slideCount) return `<section class="st" data-scroll-test>${head}<p class="st-fix">${e(report.biggestFix)}</p></section>`;
  const c = report.cover;
  const cover = `<div class="st-cover"><p class="st-label">Cover <b>${c.passed} of ${c.measured}</b> countable checks</p><ul class="st-checks">${c.checks.map(k => `<li data-pass="${k.pass}"><span class="st-mark" aria-hidden="true">${k.pass ? '✓' : '!'}</span><span><b>${e(k.label)}</b> ${e(k.note)}</span></li>`).join('')}</ul></div>`;
  const slides = `<p class="st-label">Every slide</p><ol class="st-slides">${report.slides.map(s => `<li data-verdict="${s.verdict}"${current === s.number ? ' aria-current="true"' : ''}><span class="st-n">${s.number}</span><span class="st-v">${s.verdict === 'leave' ? 'Leave' : 'Swipe'}</span><span class="st-why">${e(s.reasons[0] || '')}${s.reasons.length > 1 ? ' ' + e(s.reasons.slice(1).join(' ')) : ''}</span></li>`).join('')}</ol>`;
  const cut = report.cut.length ? `<p class="st-cut"><b>Could go:</b> slide${report.cut.length > 1 ? 's' : ''} ${e(report.cut.join(', '))}</p>` : '';
  const rest = report.deck.filter(d => d.note !== report.biggestFix);
  const deck = rest.length ? `<ul class="st-deck">${rest.map(d => `<li>${e(d.note)}</li>`).join('')}</ul>` : '';
  const eye = `<details class="st-eye"><summary>For your eye</summary><ul>${report.forYourEye.map(q => `<li>${e(q)}</li>`).join('')}</ul></details>`;
  const link = guide ? `<p class="st-guide"><a href="${e(guide)}" target="_blank" rel="noopener">Read the carousel guide</a></p>` : '';
  return `<section class="st" data-scroll-test>${head}<p class="st-fix"><b>Biggest fix:</b> ${e(report.biggestFix)}</p>${cover}${slides}${cut}${deck}${eye}${link}</section>`;
}
