// The master style file (public/ui/tokens.css) owns the app's colours, type, spacing, corners, control heights,
// shadows and its nine button styles. This test keeps it that way:
//   1. the master file defines every token and exactly the nine button styles, and every front links it first;
//   2. outside the master file, hard-coded colours and hard-coded button heights may only go down. The ceilings are
//      the counts on 18 November 2026; when a migration removes some, lower the ceiling in the same change.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = 'public/ui/tokens.css';
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Today's counts. Lower them as files move onto the master; never raise them.
const CEILING = { hexColours: 1164, buttonHeights: 439 };

const NINE = ['primary', 'secondary', 'quiet', 'icon', 'tab', 'nav', 'chip', 'link', 'field'];

function cssFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), {withFileTypes: true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/node_modules|^public\/ui\/kit$/.test(p)) walk(p); }
      else if (p.endsWith('.css') && p !== MASTER) out.push(p);
    }
  };
  for (const dir of ['public', 'runtime/src', 'ui-kit/src']) if (fs.existsSync(path.join(root, dir))) walk(dir);
  return out.sort();
}

// A button rule is one whose selector names a button, a tab, a chip or one of the app's button classes.
const BUTTONISH = /\bbutton\b|btn|\bchip|\btab\b|-tab\b|\bpill|\.coss\b|v3-place|v3-pq|h3-nav|lk-link|\[role="?(tab|button)/i;

export function countHardCoded(files = cssFiles()) {
  let hexColours = 0, buttonHeights = 0;
  for (const f of files) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    hexColours += (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (BUTTONISH.test(selector)) buttonHeights += (body.match(/(?:^|[;\s])(?:min-)?height\s*:\s*\d+(?:\.\d+)?px/g) || []).length;
    }
  }
  return {hexColours, buttonHeights};
}

test('the master style file defines every token group and exactly the nine button styles', () => {
  const css = read(MASTER);
  for (const token of ['--bg', '--paper', '--ink', '--dim', '--line', '--warm', '--good', '--warn', '--bad',
    '--grey-1', '--grey-8', '--fill', '--font-ui', '--t-detail', '--t-ui', '--t-title', '--w-text', '--w-strong',
    '--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--r-control', '--r-surface',
    '--h-control-sm', '--h-control', '--h-touch', '--shadow-1', '--shadow-pop', '--shadow-sheet']) {
    assert.match(css, new RegExp(`${token}\\s*:`), `${token} is defined in the master`);
  }
  const spacing = [...css.matchAll(/--s(\d):\s*(\d+)px/g)].map((m) => Number(m[2]));
  assert.deepEqual(spacing, [4, 8, 12, 16, 24, 32, 48], 'spacing is 4 / 8 / 12 / 16 / 24 / 32 / 48');
  assert.match(css, /--h-control-sm:\s*28px/);
  assert.match(css, /--h-control:\s*32px/);
  assert.match(css, /--h-touch:\s*44px/);
  assert.match(css, /--r-control:\s*6px/);
  const styles = [...new Set([...css.matchAll(/\.ar-([a-z]+)\b/g)].map((m) => m[1]))].sort();
  assert.deepEqual(styles, [...NINE].sort(), 'the master names the nine button styles and no others');
  // Dark mode redefines every colour the light theme sets.
  const block = (sel) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
  const names = (s) => [...s.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(names(block(':root:root:root[data-theme="dark"]')), names(block(':root:root:root,')));
});

test('every front links the master style file before any other stylesheet', () => {
  for (const page of ['public/v3/index.html', 'public/v2/index.html', 'public/document-study/index.html']) {
    const first = read(page).match(/<link rel="stylesheet" href="([^"]+)"/);
    assert.equal(first?.[1], '/ui/tokens.css', `${page} links the master first`);
  }
});

test('older sheets read the master instead of setting their own palette, corners and sizes', () => {
  assert.doesNotMatch(read('public/document-study/c3-theme.css'), /(^|\})\s*:root(\[[^\]]*\])?(\s*,\s*:root(\[[^\]]*\])?)*\s*\{[^}]*--ink:#/, 'c3-theme no longer sets the page palette');
  assert.doesNotMatch(read('public/v2/shell/shell.css'), /--v2-t\d+:\d+px/, 'version two reads the master type sizes');
  for (const p of ['public/ui/kit/app-parts.css', 'ui-kit/src/app-bridge/app-parts.css']) {
    const css = read(p);
    assert.doesNotMatch(css, /--graphite-radius:\s*\d/, `${p} takes the corner from the master`);
    assert.doesNotMatch(css, /--radius:\s*[.\d]/, `${p} takes coss's corner from the master`);
  }
  assert.doesNotMatch(read('public/document-study/graphite-controls.css'), /--graphite-[a-z-]+:\s*#/, 'Graphite reads master colours');
});

test('hard-coded colours and button heights outside the master only go down', () => {
  const now = countHardCoded();
  assert.ok(now.hexColours <= CEILING.hexColours,
    `${now.hexColours} hard-coded colours (ceiling ${CEILING.hexColours}). Use a colour from ${MASTER} instead.`);
  assert.ok(now.buttonHeights <= CEILING.buttonHeights,
    `${now.buttonHeights} hard-coded button heights (ceiling ${CEILING.buttonHeights}). Use a button style from ${MASTER} instead.`);
});
