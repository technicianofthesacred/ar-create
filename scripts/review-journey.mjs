// Walks one piece from a recording to a checked piece inside version two, on the invented demo, the way Adrian would
// with his hands, and photographs each step beside the old screen that does the same job.
//   AR_CREATE_URL=http://127.0.0.1:<port> node scripts/review-journey.mjs --out <folder> [--widths=1440,390] [--themes=dark,light]
// Never run it against port 8841 (it refuses). Four walks: 1440 and 390 wide, dark and light, each with its own new subject.
//
// It uses only what a hand can do: clicks, typing, the theme button, the phone bar. Where version two cannot do a step,
// the walk writes down a break and takes the shortest honest route (a typed address, or Advanced), then carries on.
//
// THE ONE STAND-IN. The demo cannot transcribe, so a recording stays "saved only" there. After the recording is saved
// for real (the real microphone sheet, the real files), the browser is told, the way tests/v2-subject.test.mjs does it,
// to see only the ANSWERS of four reads as a machine with transcription would give them: GET /api/recordings (the same
// job, state done, transcriptReady, capability ready), GET /api/transcript-check/<job> (the `expected` proof), POST
// /api/recordings/source (accepted) and GET /api/sources/tree (one invented transcript source listed once "Use the
// transcript" was pressed). The button, the two commands behind it and the screen are the real ones; no transcript
// exists on the server, so a later Check says the source transcript is not captured. That is the stand-in, not a fault.
//
// Exit code: 1 only when a step could not be done at all (even by the shortest honest route).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const arg = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? path.resolve(process.argv[outIdx + 1]) : path.resolve('review-journey-out');
const BASE = (process.env.AR_CREATE_URL || 'http://127.0.0.1:8854').replace(/\/$/, '');
if (/:8841(\/|$)/.test(BASE)) { console.error('Refusing to walk the live app on 8841. Use the demo.'); process.exit(2); }
const WIDTHS = (arg('widths') || '1440,390').split(',').map(Number);
const THEMES = (arg('themes') || 'dark,light').split(',');
fs.mkdirSync(OUT, {recursive: true});

let chromium;
try { ({chromium} = await import(process.env.AR_CREATE_PLAYWRIGHT || 'playwright')); }
catch { ({chromium} = createRequire(import.meta.url)('playwright')); }

const j = await fetch(BASE + '/api/package').then(r => r.json()).catch(() => null);
if (j && j.syntheticFixtures === false) { console.error('This is not the invented demo. Refusing.'); process.exit(2); }

const STEPS = [
  ['01', 'home', 'Home, as it opens'],
  ['02', 'new-subject', 'A new subject made from Home'],
  ['03', 'capture-speak', 'Capture, Speak: a short recording saved to the subject'],
  ['04', 'recording-stands', 'The subject says where the recording stands; Use the transcript'],
  ['05', 'steps-to-write', 'The subject\'s steps lead to Write for its Article'],
  ['06', 'write', 'Write: paragraphs typed, saved, reloaded'],
  ['07', 'read', 'Read: the saved words'],
  ['08', 'check', 'Check: Check saved draft pressed'],
  ['09', 'standing', 'Back on the subject and on Home: where the piece stands']
];
const OLD_SECTION = {'01': 'home', '02': 'subjects', '03': 'material', '04': 'source', '05': 'write', '06': 'write', '07': 'read', '08': 'check', '09': 'home'};

const result = {base: BASE, made: new Date().toISOString(), standIn: 'GET /api/recordings, GET /api/transcript-check/<job>, POST /api/recordings/source and GET /api/sources/tree answered by the browser after the recording was really saved; nothing else is invented.', walks: [], breaks: [], faults: []};
const addBreak = (w, step, text) => { w.steps.find(s => s.id === step).breaks.push(text); };
const kb = f => Math.round(fs.statSync(f).size / 1024);

const browser = await chromium.launch({args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']});
let failedAny = false;

for (const width of WIDTHS) for (const theme of THEMES) {
  const phone = width <= 850, height = phone ? 844 : 900;
  const tag = `${width}-${theme}`;
  console.log(`\nWalk ${tag}`);
  const walk = {width, theme, subject: null, piece: null, steps: STEPS.map(([id, key, name]) => ({id, key, name, status: 'done', breaks: [], faults: [], notBuilt: [], says: '', address: '', oldAddress: '', sideways: null, pictures: []}))};
  result.walks.push(walk);
  const S = {standIn: false, used: false, jobId: null};
  let ctxDpr = phone ? 2 : 1;
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: ctxDpr, hasTouch: phone, isMobile: false, permissions: ['microphone']});
  // The stand-in: answers only, active only once the recording has been saved for real.
  await context.route(/\/api\/recordings(\?.*)?$/, async r => {
    if (!S.standIn || r.request().method() !== 'GET') return r.continue();
    const resp = await r.fetch(), body = await resp.json();
    S.jobId = body.jobs?.[0]?.id || S.jobId;
    return r.fulfill({response: resp, json: {...body, capability: {...(body.capability || {}), ready: true}, jobs: (body.jobs || []).map(x => ({...x, state: 'done', transcriptReady: true}))}});
  });
  await context.route(/\/api\/transcript-check\/[^/?]+(\?.*)?$/, r => S.standIn ? r.fulfill({json: {expected: {jobId: S.jobId, markdownHash: 'h1'}}}) : r.continue());
  await context.route(/\/api\/recordings\/source(\?.*)?$/, r => { if (!S.standIn) return r.continue(); S.used = true; return r.fulfill({json: {source: {id: '11111111-aaaa-4aaa-8aaa-111111111111'}, jobId: S.jobId}}); });
  await context.route(/\/api\/sources\/tree(\?.*)?$/, async r => {
    if (!S.standIn || !S.used || r.request().method() !== 'GET') return r.continue();
    const resp = await r.fetch(), body = await resp.json();
    return r.fulfill({response: resp, json: {...body, sources: [...(body.sources || []), {id: '11111111-aaaa-4aaa-8aaa-111111111111', kind: 'transcript', recordingId: S.jobId, title: 'Transcript of the recording', hash: 'h1', rel_path: 'x/transcript.md'}]}});
  });

  const p = await context.newPage(), q = await context.newPage();
  let cur = walk.steps[0];
  const faultOnce = (step, text) => { if (!step.faults.includes(text)) step.faults.push(text); };
  p.on('console', m => { if (m.type() === 'error') faultOnce(cur, 'console error: ' + m.text().replace(/\s+/g, ' ').slice(0, 160)); });
  p.on('pageerror', e => faultOnce(cur, 'page error: ' + String(e.message).slice(0, 160)));
  p.on('response', r => { if (r.status() >= 400 && /\/api\//.test(r.url())) faultOnce(cur, `request answered ${r.status()}: ${new URL(r.url()).pathname}`); });

  const wait = ms => p.waitForTimeout(ms);
  const theTheme = async page => {
    const want = theme;
    const now = await page.evaluate(() => document.documentElement.dataset.theme);
    if (now === want) return true;
    const btn = page.locator('[data-v2-theme]:visible, button[aria-label^="Switch to"]:visible').first();
    await btn.click({timeout: 4000});
    await page.waitForTimeout(400);
    return (await page.evaluate(() => document.documentElement.dataset.theme)) === want;
  };
  const hasRoute = async prefix => (await p.evaluate(() => location.hash)).startsWith(prefix);

  // A JPEG no wider than 1440, quality about 70, each under 250 KB (phone: scale 2 first, then 1).
  async function shoot(page, step, which, extra = '') {
    const name = `${step.id}${extra}-${which}-${width}-${theme}.jpg`, file = path.join(OUT, name);
    const dims = await page.evaluate(() => ({h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), vh: innerHeight}));
    const opts = {path: file, type: 'jpeg', quality: 70};
    if (dims.h > dims.vh + 8) { Object.assign(opts, {fullPage: true, clip: {x: 0, y: 0, width, height: Math.min(dims.h, 2000)}}); }
    await page.screenshot(opts);
    if (kb(file) > 250 && phone) await page.screenshot({...opts, scale: 'css'});
    if (kb(file) > 250) await page.screenshot({...opts, quality: 55, scale: 'css'});
    step.pictures.push(name);
    return name;
  }
  const sideways = async step => {
    if (!phone) return;
    const over = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    if (over > 0) { step.sideways = over; faultOnce(step, `at ${width} wide the page scrolls sideways by ${over} px`); } else if (step.sideways === null) step.sideways = 0;
  };
  const sawNotBuilt = async step => {
    const lines = await p.evaluate(() => [...document.querySelectorAll('main *, dialog *')].filter(e => e.children.length === 0 && /not built yet/i.test(e.textContent) && e.offsetParent !== null).map(e => (e.closest('section,article,li,div')?.textContent || e.textContent).replace(/\s+/g, ' ').trim().slice(0, 110)));
    for (const l of lines) if (!step.notBuilt.includes(l)) step.notBuilt.push(l);
  };
  const said = async (step, sel = 'main') => { step.says = (await p.innerText(sel).catch(() => '')).replace(/\n+/g, ' | ').slice(0, 600); };

  // The old screen that does the same job, same subject and piece, same width and theme.
  async function old(step, extra = '') {
    try {
      const addr = await p.evaluate(o => window.v2.advanced(o), {subject: walk.subject || undefined, piece: walk.piece || undefined, section: OLD_SECTION[step.id]});
      step.oldAddress = addr;
      await q.setViewportSize({width, height});
      await q.goto(BASE + addr, {waitUntil: 'load'});
      await q.waitForTimeout(3200);
      if (!(await theTheme(q).catch(() => false))) faultOnce(step, 'the old workspace theme could not be switched at this width');
      await q.waitForTimeout(300);
      await shoot(q, step, 'old', extra);
    } catch (e) { faultOnce(step, 'the old screen could not be photographed: ' + String(e.message).split('\n')[0].slice(0, 100)); }
  }

  const run = async (id, fn) => {
    const step = walk.steps.find(s => s.id === id);
    cur = step;
    console.log(`  ${id} ${step.name}`);
    try { await fn(step); }
    catch (e) {
      step.status = 'failed'; failedAny = true;
      step.breaks.push('This step could not be done: ' + String(e.message).split('\n')[0].slice(0, 160));
      try { await shoot(p, step, 'new', '-failed'); } catch {}
    }
    if (step.status !== 'failed' && step.breaks.length) step.status = 'broken';
  };
  const newShot = async (step, extra = '') => { await sideways(step); await sawNotBuilt(step); await shoot(p, step, 'new', extra); };

  // ---------- 1 Home ----------
  await run('01', async step => {
    await p.goto(BASE + '/v2/index.html', {waitUntil: 'load'});
    await wait(1800);
    if (!(await theTheme(p))) step.breaks.push('The theme button did not change the theme.');
    await p.waitForFunction(() => !/Reading your subjects/.test(document.body.innerText), null, {timeout: 8000}).catch(() => faultOnce(step, 'Home still said it was reading the subjects after 8 seconds'));
    await wait(500);
    step.address = p.url(); await said(step); await newShot(step); await old(step);
  });

  // ---------- 2 New subject ----------
  await run('02', async step => {
    await p.locator('[data-home-new]:visible').first().click({timeout: 5000});
    await wait(500);
    await p.fill('#home-new-name', `Journey walk ${width} ${theme}`);
    await sideways(step); await shoot(p, step, 'new', 'a');
    await p.locator('.home-form button[type=submit]').click();
    await p.waitForFunction(() => location.hash.startsWith('#/subject/'), null, {timeout: 8000});
    walk.subject = decodeURIComponent((await p.evaluate(() => location.hash)).match(/subject\/([^?&]+)/)[1]);
    await wait(1500);
    step.address = p.url(); await said(step); await newShot(step); await old(step);
  });

  // ---------- 3 Capture, Speak ----------
  await run('03', async step => {
    await p.locator('[data-v2-capture]:visible').first().click({timeout: 5000});
    await wait(500);
    await p.locator('dialog [data-view=speak]').click({timeout: 5000});
    await wait(3200); // the fake microphone runs for a few seconds
    const stop = p.locator('dialog [data-cap=stop]');
    if (await stop.count()) await stop.click();
    else step.breaks.push('Speak did not start recording by itself; there was no Stop button.');
    await wait(800);
    await sideways(step); await shoot(p, step, 'new', 'a');
    await p.locator('dialog [data-cap=save]').click({timeout: 5000});
    await p.waitForSelector('dialog [data-cap=done]', {timeout: 15000});
    await wait(500);
    step.address = p.url(); await said(step, 'dialog'); await newShot(step);
    if (!/transcription is not set up/i.test(step.says)) step.breaks.push('The sheet did not say that transcription is not set up on this machine.');
    await old(step);
    await p.locator('dialog [data-cap=done]').click();
    await wait(800);
  });

  // ---------- 4 The subject says where the recording stands; Use the transcript ----------
  await run('04', async step => {
    if (!(await hasRoute('#/subject/'))) throw new Error('not on the subject');
    const haveStep = p.locator('[data-subj-step]:has-text("What you have")');
    if (await haveStep.count()) { await haveStep.first().click(); await wait(800); }
    await said(step);
    const before = step.says;
    await shoot(p, step, 'new', 'a'); await sideways(step);
    if (!/Saved\. Transcription is not set up on this machine/.test(before)) step.breaks.push('The subject did not say "Saved. Transcription is not set up on this machine." for the recording.');
    // From here the transcript is the stand-in: the answers are given as a machine with transcription would give them.
    S.standIn = true;
    await p.reload({waitUntil: 'load'}); await wait(2000);
    const haveStep2 = p.locator('[data-subj-step]:has-text("What you have")');
    if (await haveStep2.count()) { await haveStep2.first().click(); await wait(800); }
    const use = p.locator('[data-subj-rec=use]');
    if (!(await use.count())) throw new Error('"Use the transcript" did not appear even with a finished transcript in place');
    await use.first().click();
    await p.waitForFunction(() => /kept as a source/.test(document.body.innerText), null, {timeout: 8000}).catch(() => step.breaks.push('After "Use the transcript" the subject did not say the transcript was kept as a source.'));
    await wait(600);
    step.address = p.url(); await said(step); await newShot(step); await old(step);
  });

  // ---------- 5 The steps lead to Write ----------
  await run('05', async step => {
    await p.locator('[data-subj-add]:visible').first().click({timeout: 5000}); await wait(700);
    const art = p.locator('[data-subj-make=article]');
    const locked = await art.isDisabled();
    await sideways(step); await shoot(p, step, 'new', 'a');
    if (locked) {
      step.breaks.push('Article cannot be added until there are words in Write, and Write says "no Article yet" until it is added. The way out is only in Advanced: the first words were typed there.');
      await p.keyboard.press('Escape'); await wait(400);
      const addr = await p.evaluate(o => window.v2.advanced(o), {subject: walk.subject, section: 'write'});
      await q.setViewportSize({width, height});
      await q.goto(BASE + addr, {waitUntil: 'load'}); await q.waitForTimeout(3500);
      await theTheme(q).catch(() => {});
      await q.locator('#manuscript').click({timeout: 8000});
      await q.keyboard.type('The first cup was small and bitter, and I loved it.');
      await q.waitForTimeout(5000);
      await p.evaluate(h => { location.hash = h; }, '#/subject/' + walk.subject); await wait(1500);
      await p.locator('[data-subj-add]:visible').first().click({timeout: 5000}); await wait(700);
      if (await p.locator('[data-subj-make=article]').isDisabled()) throw new Error('Article stayed locked even after words were typed in Advanced');
    }
    await p.locator('[data-subj-make=article]').click();
    await p.waitForFunction(() => /form=out/.test(location.hash), null, {timeout: 8000});
    walk.piece = decodeURIComponent((await p.evaluate(() => location.hash)).match(/form=out(?:%3A|:)([^&]+)/i)?.[1] || '') || null;
    await wait(1200);
    const words = p.locator('[data-subj-step]:has-text("The words")');
    if (!(await words.count())) throw new Error('the Article\'s steps did not include The words');
    await words.first().click(); await wait(900);
    step.address = p.url(); await said(step); await newShot(step); await old(step);
  });

  // ---------- 6 Write ----------
  await run('06', async step => {
    const link = p.locator('a[href^="#/write/"]:visible').first();
    if (!(await link.count())) throw new Error('the subject offers no way into Write');
    await link.click(); await wait(2200);
    if (!(await hasRoute('#/write/'))) throw new Error('Write did not open');
    if (!walk.piece) walk.piece = new URL('http://x/' + (await p.evaluate(() => location.hash)).slice(1)).searchParams.get('piece');
    const paras = ['A second paragraph, written in Write, about the straw over the rows.', 'A third paragraph, about patience and the first cup.', 'A fourth paragraph that closes the piece.'];
    for (const t of paras) {
      await p.locator('textarea[data-ed]').last().click({timeout: 6000});
      await p.keyboard.type(t);
      await wait(3500);
    }
    await p.locator('textarea[data-ed]').last().blur().catch(() => {});
    await wait(1500);
    const saved = await p.locator('main').innerText().then(t => /Saved/.test(t)).catch(() => false);
    if (!saved) step.breaks.push('Write did not say "Saved" after the words were typed.');
    await p.reload({waitUntil: 'load'}); await wait(2800);
    const vals = await p.evaluate(() => [...document.querySelectorAll('textarea[data-ed]')].map(t => t.value));
    for (const t of paras) if (!vals.includes(t)) step.breaks.push('After a reload a typed paragraph was gone: "' + t.slice(0, 40) + '".');
    if (vals.length < 3) step.breaks.push('After a reload fewer than three paragraphs were there.');
    step.address = p.url(); await said(step); await newShot(step); await old(step);
  });

  // ---------- 7 Read ----------
  await run('07', async step => {
    const link = p.locator('a[href^="#/read/"]:visible').first();
    if (!(await link.count())) throw new Error('Write offers no way to Read');
    await link.click(); await wait(1800);
    if (!(await hasRoute('#/read/'))) throw new Error('Read did not open');
    const t = await p.locator('main').innerText();
    if (!/A fourth paragraph that closes the piece/.test(t)) step.breaks.push('Read did not show the last paragraph that was saved in Write.');
    step.address = p.url(); await said(step); await newShot(step); await old(step);
  });

  // ---------- 8 Check ----------
  await run('08', async step => {
    const link = p.locator('a[href^="#/check/"]:visible').first();
    if (!(await link.count())) throw new Error('Read offers no way to Check');
    await link.click(); await wait(1800);
    if (!(await hasRoute('#/check/'))) throw new Error('Check did not open');
    await shoot(p, step, 'new', 'a');
    const run1 = p.locator('[data-ck=run]');
    if (!(await run1.count())) throw new Error('there was no "Check saved draft" button');
    if (await run1.isDisabled()) step.breaks.push('"Check saved draft" was disabled although words were saved.');
    else {
      await run1.click();
      await p.waitForFunction(() => !/Checking/.test(document.querySelector('[data-ck=run]')?.textContent || ''), null, {timeout: 20000}).catch(() => step.breaks.push('The check did not finish within 20 seconds.'));
      await wait(1000);
    }
    step.address = p.url(); await said(step); await newShot(step);
    if (/held|capture the source transcript/i.test(step.says)) faultOnce(step, 'Check is held with "Capture the source transcript before checking." (expected here: the transcript is only a stand-in, the demo has no real one)');
    await old(step);
  });

  // ---------- 9 Back on the subject and on Home ----------
  await run('09', async step => {
    const back = p.locator(`main a[href^="#/subject/${walk.subject}"]:visible, a[href^="#/subject/${walk.subject}"]:visible`).first();
    if (!(await back.count())) throw new Error('Check offers no way back to the subject');
    await back.click(); await wait(1800);
    if (!(await hasRoute('#/subject/'))) throw new Error('the subject did not open');
    const subj = (await p.locator('main').innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 500);
    await sideways(step); await sawNotBuilt(step); await shoot(p, step, 'new', 'b');
    const home = p.locator('a[href="#/"]:visible').first();
    await home.click({timeout: 5000}); await wait(1500);
    await p.waitForFunction(() => !/Reading your subjects/.test(document.body.innerText), null, {timeout: 8000}).catch(() => faultOnce(step, 'Home still said it was reading the subjects'));
    await wait(600);
    const row = await p.evaluate(n => {
      const hits = [...document.querySelectorAll('main *')].filter(e => e.offsetParent && e.textContent.includes(n) && ![...e.children].some(c => c.textContent.includes(n)));
      const el = hits[0]; if (!el) return '';
      const box = el.closest('li, tr, article, [role=row], [class*=row], a') || el.parentElement;
      return box.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
    }, `Journey walk ${width} ${theme}`);
    if (!row) step.breaks.push('Home did not show the new subject among its subjects.');
    step.address = p.url(); await said(step);
    step.says = 'SUBJECT: ' + subj + ' ## HOME ROW: ' + row;
    await newShot(step); await old(step);
  });

  await context.close();
}
await browser.close();

// ---------- the list of breaks, the file and the contact sheet ----------
const merge = (list, step, name, key, text, w) => {
  const hit = list.find(x => x.step === step && x.text === text);
  const at = `${w.width} ${w.theme}`;
  if (hit) { if (!hit.at.includes(at)) hit.at.push(at); } else list.push({step, name, text, at: [at]});
};
for (const w of result.walks) for (const s of w.steps) {
  for (const b of s.breaks) merge(result.breaks, s.id, s.name, 'b', b, w);
  for (const f of s.faults) merge(result.faults, s.id, s.name, 'f', f, w);
  for (const f of s.notBuilt) merge(result.faults, s.id, s.name, 'n', 'says "not built yet": ' + f, w);
}
fs.writeFileSync(path.join(OUT, 'journey.json'), JSON.stringify(result, null, 1));

try {
  const files = STEPS.map(([id]) => path.join(OUT, `${id}-new-1440-dark.jpg`)).filter(f => fs.existsSync(f));
  if (files.length) {
    const b2 = await chromium.launch(), pg = await b2.newPage({viewport: {width: 1560, height: 1200}});
    const cells = files.map((f, i) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${STEPS[i][0]} ${STEPS[i][2].replace(/[<&]/g, '')}</figcaption></figure>`).join('');
    await pg.setContent(`<body style="margin:0;background:#111;color:#ccc;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(3,500px);gap:12px;padding:12px;width:1536px">${cells.replace(/<figure>/g, '<figure style="margin:0;height:370px;overflow:hidden">').replace(/<img /g, '<img style="width:500px;height:310px;object-fit:cover;object-position:top;display:block" ')}</div></body>`);
    await pg.screenshot({path: path.join(OUT, 'sheet.jpg'), type: 'jpeg', quality: 70, clip: {x: 0, y: 0, width: 1560, height: Math.min(1200, 12 + 3 * 382)}});
    await b2.close();
  }
} catch (e) { console.log('contact sheet not made: ' + e.message); }

console.log('\nBreaks:');
for (const b of result.breaks) console.log(`  [${b.step}; ${b.at.join(', ')}] ${b.text}`);
console.log('\nFaults:');
for (const f of result.faults) console.log(`  [${f.step}; ${f.at.join(', ')}] ${f.text}`);
console.log(`\nWrote ${path.join(OUT, 'journey.json')}`);
process.exitCode = failedAny ? 1 : 0;
