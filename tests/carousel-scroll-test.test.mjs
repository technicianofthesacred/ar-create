// The scroll test from the carousel guide (Adrian, 2026-11-27): counted advice from saved words, never a verdict on meaning.
import test from 'node:test';
import assert from 'node:assert/strict';
import {scrollTest, scrollTestMarkup, SCROLL_TEST_SCHEMA, SCROLL_LIMITS} from '../public/lib/carousel-scroll-test.js';

const flop = {slides: [
  {role: 'cover', text: 'Five invented stories from one week at the bench: the kiln, the glaze, the guest, the rain and the door'},
  {role: 'line', text: 'The kiln, the glaze, the guest, the rain and the door that would not shut.'},
  {role: 'teach', text: 'Glaze applied thin cracks less in the cooling.'},
  {role: 'photo', text: '', photos: [{src: 'invented.jpg'}]},
  {role: 'close', text: 'The whole invented story is in the article.'},
], caption: 'An invented week at the bench.'};

test('a long cover that a later slide repeats is the biggest fix, and the repeating slide could go', () => {
  const r = scrollTest(flop);
  assert.equal(r.schema, SCROLL_TEST_SCHEMA);
  assert.equal(r.slideCount, 5);
  assert.equal(r.cover.measured, 3);
  assert.equal(r.cover.checks.find(c => c.id === 'cover-short').pass, false);
  assert.equal(r.cover.checks.find(c => c.id === 'cover-not-repeated').pass, false);
  assert.deepEqual(r.slides.map(s => s.verdict), ['swipe', 'leave', 'swipe', 'swipe', 'swipe']);
  assert.match(r.slides[1].reasons[0], /Repeats slide 1/);
  assert.deepEqual(r.cut, [2]);
  assert.match(r.biggestFix, /^Shorten the cover/);
  assert.equal(r.slides[4].reasons[0], 'The close.');
});

test('a clean carousel passes its counted checks and still leaves the eye questions to Adrian', () => {
  const r = scrollTest({slides: [
    {role: 'cover', text: 'Why the invented jar matters more than the tea'},
    {role: 'teach', text: 'Air moves through a loose lid every time the room warms.'},
    {role: 'photo', text: 'The shelf by the window.', photos: [{src: 'a.jpg'}]},
    {role: 'teach', text: 'A heavy clay jar holds the inside steady through a day.'},
    {role: 'close', text: 'Read the invented article for the full method.'},
  ], caption: 'Your tea is only as good as the jar it waits in.'});
  assert.equal(r.cover.passed, r.cover.measured);
  assert.ok(r.slides.every(s => s.verdict === 'swipe'));
  assert.deepEqual(r.cut, []);
  assert.deepEqual(r.deck, []);
  assert.ok(r.forYourEye.length >= 3, 'what no count can tell is asked, not judged');
});

test('slide length, deck length and the caption first line are reported with the guide\'s numbers', () => {
  const long = Array.from({length: SCROLL_LIMITS.slideWords + 5}, (_, i) => 'word' + i).join(' ');
  const r = scrollTest({slides: [{role: 'cover', text: 'An invented cover'}, {role: 'photo', text: 'one two three four five six seven eight nine ten', photos: [{}]}, {role: 'teach', text: long}], caption: 'x'.repeat(SCROLL_LIMITS.captionFirstLine + 1)});
  assert.match(r.slides[1].reasons[0], /photograph slide/);
  assert.match(r.slides[2].reasons[0], /may be two slides/);
  assert.ok(r.deck.some(d => d.id === 'deck-short'));
  assert.ok(r.deck.some(d => d.id === 'caption-long'));
  assert.deepEqual(r.cut, [], 'long slides are for splitting, not cutting');
});

test('Instagram studio frames (words as exact slices) read the same as saved slides', () => {
  const r = scrollTest({slides: [{role: 'cover', words: [{lineId: 'L1', text: 'An invented line'}]}, {role: 'inner', words: [{lineId: 'L2', text: 'Another'}, {lineId: 'L3', text: 'invented line here'}]}], caption: {parts: []}});
  assert.equal(r.slides[1].words, 4);
});

test('no slides, and the markup escapes every word', () => {
  assert.match(scrollTest({}).biggestFix, /no slides/);
  const html = scrollTestMarkup(scrollTest({slides: [{role: 'cover', text: '<b>invented</b> & "quoted"'}]}), {current: 1, title: '<i>Invented</i>', guide: 'https://example.invalid/"guide'});
  assert.doesNotMatch(html, /<b>invented|<i>Invented/, 'slide words are never put into the markup, and options are escaped');
  assert.match(html, /&lt;i&gt;Invented/);
  assert.match(html, /&quot;guide/);
  assert.match(html, /aria-current="true"/);
  assert.equal(scrollTestMarkup(null), '');
});
