// Walks one piece from a recording to a checked piece inside version two, on the invented demo, the way Adrian would
// with his hands, and photographs each step beside the old screen that does the same job.
//   AR_CREATE_URL=http://127.0.0.1:<port> node scripts/review-journey.mjs --out <folder> [--widths=1440,390] [--themes=dark,light] [--home=<demo folder>]
// Never run it against port 8841 (it refuses). Four walks: 1440 and 390 wide, dark and light, each with its own new subject.
//
// It uses only what a hand can do: clicks, typing, the theme button, the phone bar. Where version two cannot do a step,
// the walk writes down a break and takes the shortest honest route, then carries on. Nothing in the browser is faked.
//
// THE TRANSCRIPT. The demo cannot transcribe. After the recording is saved for real (the real microphone sheet, the real
// files), the script puts a finished transcription job in place the way tests/recording-source-owner-journey.test.mjs does
// it (its lines 14 to 16): the job's own files inside the demo's temporary data folder (the job file, its transcript.json,
// the RAW note and the fixture's two invented sentences). That folder is found from the demo's own process
// (AR_CREATE_PORT and AR_CREATE_CONFIG) or given with --home=<the "disposable files" folder the demo prints>, and only a
// synthetic fixture folder under the temporary directory is ever written. Then "Use the transcript" is pressed for real
// against the real server. If the folder cannot be found, step 4 says so as a break and nothing is faked.
//
// Pictures: JPEG at css scale (a phone picture is 390 wide), quality about 70, each under 250 KB. A page taller than
// 2000 px is cut there and journey.json says so. For full-page phone pictures the fixed phone bar is made static.
//
// Files written to --out: the pictures, journey.json, pairs.json, sheet.jpg. Old ones are cleared first.
// Exit code: 1 only when a step could not be done at all (even by the shortest honest route).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const arg = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? path.resolve(process.argv[outIdx + 1]) : path.resolve('review-journey-out');
const BASE = (process.env.AR_CREATE_URL || 'http://127.0.0.1:8854').replace(/\/$/, '');
if (/:8841(\/|$)/.test(BASE)) { console.error('Refusing to walk the live app on 8841. Use the demo.'); process.exit(2); }
const WIDTHS = (arg('widths') || '1440,390').split(',').map(Number);
const THEMES = (arg('themes') || 'dark,light').split(',');
const STAMP = Date.now().toString(36).slice(-4);
const TALL = 2000;

let chromium;
try { ({chromium} = await import(process.env.AR_CREATE_PLAYWRIGHT || 'playwright')); }
catch { ({chromium} = createRequire(import.meta.url)('playwright')); }

const j = await fetch(BASE + '/api/package').then(r => r.json()).catch(() => null);
if (j && j.syntheticFixtures === false) { console.error('This is not the invented demo. Refusing.'); process.exit(2); }

// Clear what an earlier run left in --out.
fs.mkdirSync(OUT, {recursive: true});
for (const f of fs.readdirSync(OUT)) if (/\.jpg$/.test(f) || ['journey.json', 'pairs.json'].includes(f)) fs.rmSync(path.join(OUT, f), {force: true});

// ---------- the demo's own data folder (for the transcript job only) ----------
function demoDataDir() {
  const port = new URL(BASE).port, cands = [];
  if (arg('home')) cands.push(arg('home'));
  if (process.env.AR_CREATE_DEMO_HOME) cands.push(process.env.AR_CREATE_DEMO_HOME);
  try {
    for (const d of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(d)) continue;
      try {
        const env = fs.readFileSync(`/proc/${d}/environ`, 'utf8').split('\0');
        const c = env.find(e => e.startsWith('AR_CREATE_CONFIG='));
        if (env.includes('AR_CREATE_PORT=' + port) && c) cands.push(path.dirname(c.slice('AR_CREATE_CONFIG='.length)));
      } catch {}
    }
  } catch {}
  const temp = fs.realpathSync(os.tmpdir());
  for (const c of cands) {
    try {
      const dir = fs.realpathSync(c), cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
      if (!path.basename(dir).startsWith('ar-create-synthetic-') || !dir.startsWith(temp + path.sep) || cfg.syntheticFixtures !== true) continue;
      const data = fs.realpathSync(cfg.dataDir);
      if (data.startsWith(dir + path.sep) && fs.existsSync(path.join(data, 'recordings'))) return data;
    } catch {}
  }
  return null;
}
const DATA = demoDataDir();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
/** Makes the one saved recording's job a finished transcription, the way the fixture does (invented sentences only). */
function finishJob(jobId) {
  const rec = path.join(DATA, 'recordings'), jobFile = path.join(rec, '.transcription-jobs', jobId + '.json');
  const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  const story = String(job.story || 'Journey recording').replace(/[\/\\\r\n]/g, '-').slice(0, 80);
  const output = path.join(rec, story, 'Transcription', jobId), rawRoot = path.join(rec, 'vault', 'Workflow', '0-Inbox');
  fs.mkdirSync(output, {recursive: true}); fs.mkdirSync(rawRoot, {recursive: true});
  const original = {language: 'en', speakers: [{id: 's1', name: null}], segments: [
    {start: 1, end: 6, speaker: 's1', text: 'The first cup was small and bitter, and I loved it.'},
    {start: 7, end: 12, speaker: 's1', text: 'We learned patience from the straw over the rows.'}],
    metadata: {duration_seconds: 12, review: {status: 'unreviewed'}, synthetic: true, warnings: ['Invented journey fixture; no speech recognition is asserted.']}};
  const rawBody = '# Machine RAW, journey fixture\n\n' + original.segments.map(s => s.text).join('\n\n') + '\n';
  const raw = path.join(rawRoot, `RAW - ${story} ${jobId.slice(0, 8)}.md`);
  fs.writeFileSync(raw, rawBody);
  fs.writeFileSync(path.join(output, 'transcript.json'), JSON.stringify(original, null, 2));
  // the transcript's own protections read the audio from inside the recordings folder, as the fixture's does
  const audio = path.join(rec, path.basename(job.source));
  if (!fs.existsSync(audio)) fs.copyFileSync(job.source, audio);
  const next = {...job, source: audio, state: 'done', stage: 'done', transcriptReady: true, output, raw, rawCandidateSha256: sha(rawBody)};
  fs.writeFileSync(jobFile + '.tmp', JSON.stringify(next)); fs.renameSync(jobFile + '.tmp', jobFile);
}

// ---------- the steps ----------
const STEPS = [
  ['01', 'home', 'Home, as it opens'],
  ['02', 'new-subject', 'A new subject made from Home'],
  ['03', 'capture-speak', 'Capture, Speak: a short recording saved to the subject'],
  ['04', 'recording-stands', 'The subject says where the recording stands; Use the transcript'],
  ['05', 'steps-to-write', 'The subject\'s steps lead to Write for its Article'],
  ['06', 'write', 'Write: paragraphs typed, saved, reloaded'],
  ['07', 'read', 'Read: the saved words'],
  ['08', 'check', 'Check: Check saved draft pressed on this walk\'s piece, a real result'],
  ['08b', 'check-finished-piece', 'Check on a different piece: the demo subject "The green gate"'],
  ['09', 'standing', 'Back on the subject and on Home: where the piece stands']
];
// The old screen that does the same job (its own section names). Step 9 goes by the bar's Advanced instead.
const OLD_SECTION = {'01': 'home', '02': undefined, '03': 'source', '04': 'source', '05': 'outputs', '06': 'write', '07': 'read', '08': 'check', '08b': 'check'};
const HOLD = 'No source to check against yet';
// Step 4 confirms the transcript and presses "Use it for Check", so step 8 must end in a real result. Said only if it does not.
const HELD_NOW = 'Check was held ("Capture the source transcript before checking") although the transcript was confirmed and "Use it for Check" was pressed in step 4.';

const result = {base: BASE, made: new Date().toISOString(), transcript: DATA ? 'a finished transcription job put in the demo\'s own data folder, then "Use the transcript" pressed for real' : 'NOT done: the demo\'s data folder could not be found', tallerThanCap: [], walks: [], breaks: [], faults: [], notes: []};
const kb = f => Math.round(fs.statSync(f).size / 1024);
const plain = s => String(s || '').replace(/\s+/g, ' ').trim();

let failedAny = false;
let browser;
try {
  browser = await chromium.launch({args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']});
  for (const width of WIDTHS) for (const theme of THEMES) await walkOne(width, theme);
} finally {
  if (browser) await browser.close().catch(() => {});
}

async function walkOne(width, theme) {
  const phone = width <= 850, height = phone ? 844 : 900;
  const tag = `${width}-${theme}`, mySubject = `Journey walk ${width} ${theme} ${STAMP}`;
  console.log(`\nWalk ${tag}`);
  const walk = {width, theme, subjectName: mySubject, subject: null, piece: null, steps: STEPS.map(([id, key, name]) => ({id, key, name, status: 'done', breaks: [], faults: [], notBuilt: [], says: '', address: '', oldAddress: '', sideways: null, pictures: [], oldPictures: [], notes: []}))};
  result.walks.push(walk);
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, hasTouch: phone, isMobile: false, permissions: ['microphone']});
  try {
    const p = await context.newPage(), q = await context.newPage();
    let cur = walk.steps[0];
    const stepOf = id => walk.steps.find(s => s.id === id);
    const faultOnce = (step, text) => { if (!step.faults.includes(text)) step.faults.push(text); };
    const breakOnce = (step, text) => { if (!step.breaks.includes(text)) step.breaks.push(text); };
    // Errors seen while this tab is in the old workspace (reached by the bar's Advanced) are the old screen's, not version two's.
    const where = () => /\/document-study\//.test(p.url()) ? 'in the old workspace: ' : '';
    const note = (step, text) => { if (!step.notes.includes(text)) step.notes.push(text); };
    p.on('console', m => { if (m.type() === 'error') { const w = where(); (w ? note : faultOnce)(cur, w + 'console error: ' + plain(m.text()).slice(0, 160)); } });
    p.on('pageerror', e => { const w = where(); (w ? note : faultOnce)(cur, w + 'page error: ' + String(e.message).slice(0, 160)); });
    p.on('response', r => { if (r.status() >= 400 && /\/api\//.test(r.url())) { const w = where(); (w ? note : faultOnce)(cur, `${w}request answered ${r.status()}: ${new URL(r.url()).pathname}`); } });

    const wait = ms => p.waitForTimeout(ms);
    const theTheme = async page => {
      const now = await page.evaluate(() => document.documentElement.dataset.theme);
      if (now === theme) return true;
      const btn = page.locator('[data-v2-theme]:visible, button[aria-label^="Switch to"]:visible').first();
      await btn.click({timeout: 4000});
      await page.waitForTimeout(400);
      return (await page.evaluate(() => document.documentElement.dataset.theme)) === theme;
    };
    const hasRoute = async prefix => (await p.evaluate(() => location.hash)).startsWith(prefix);
    const routeName = async () => (await p.evaluate(() => location.hash)).replace(/^#\/?/, '').split(/[/?]/)[0] || 'home';

    // A JPEG at css scale, quality about 70, each under 250 KB. A tall page is cut at TALL px and journey.json says so.
    async function shoot(page, step, which, extra = '') {
      const name = `${step.id}${extra}-${which}-${width}-${theme}.jpg`, file = path.join(OUT, name);
      const dims = await page.evaluate(() => ({h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), vh: innerHeight}));
      const opts = {path: file, type: 'jpeg', quality: 70, scale: 'css'};
      if (dims.h > dims.vh + 8) {
        // a sticky top bar would otherwise be drawn part-way down a scrolled page
        await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
        Object.assign(opts, {fullPage: true, clip: {x: 0, y: 0, width, height: Math.min(dims.h, TALL)}, style: '.v2-phone{position:static !important}'});
        if (dims.h > TALL) result.tallerThanCap.push({file: name, pageHeight: dims.h, shownHeight: TALL, cut: true});
      }
      await page.screenshot(opts);
      for (const quality of [60, 50, 40]) if (kb(file) > 250) await page.screenshot({...opts, quality});
      (which === 'old' ? step.oldPictures : step.pictures).push(name);
      return name;
    }
    const sideways = async step => {
      if (!phone) return;
      const over = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      if (over > 0) { step.sideways = over; faultOnce(step, `at ${width} wide the page scrolls sideways by ${over} px`); } else if (step.sideways === null) step.sideways = 0;
    };
    // "Not built yet" panels are breaks, not faults; each is listed once per screen (merged below).
    const sawNotBuilt = async step => {
      const screen = await routeName();
      const lines = await p.evaluate(() => [...document.querySelectorAll('[data-v2-notbuilt] p')].filter(e => e.offsetParent !== null).map(e => e.textContent));
      for (const l of lines) { const t = plain(l); if (!step.notBuilt.some(n => n.text === t && n.screen === screen)) step.notBuilt.push({screen, text: t}); }
    };
    const said = async (step, sel = 'main') => { step.says = plain(await p.innerText(sel).catch(() => '')).replace(/ /g, ' ').slice(0, 600); };

    // The old screen: wait until it has settled on that subject and section, then photograph it.
    async function settleOld(page, subject, section, step) {
      const ok = await page.waitForFunction(({subject}) => {
        const u = new URLSearchParams(location.search);
        if (u.has('section') || u.has('subject') || u.has('piece')) return false;
        try { if (subject && !(typeof current === 'function' && current()?.id === subject)) return false; } catch { return false; }
        return !!document.querySelector('.combined-rail,.combined-phonebar');
      }, {subject}, {timeout: 30000}).then(() => true).catch(() => false);
      if (!ok) faultOnce(step, 'the old workspace had not settled on the subject after 30 seconds; the picture may show another place');
      // the rail names the section it is on; wait (briefly) for the one asked for, and say if it never did
      if (ok && section && !['read', 'check', 'subjects'].includes(section)) {
        const on = await page.waitForFunction(s => { const r = document.querySelector('.combined-rail [data-combined-nav][aria-current]')?.dataset.combinedNav; return r === s; }, section, {timeout: 6000}).then(() => true).catch(() => false);
        if (!on) step.notes.push(`the old workspace's rail was not on ${section} when photographed`);
      }
      await page.waitForTimeout(600);
      return ok;
    }
    async function oldShot(step, extra, page) {
      if (!(await theTheme(page).catch(() => false))) faultOnce(step, 'the old workspace theme could not be switched at this width');
      await page.waitForTimeout(300);
      if (step.key === 'recording-stands' || step.key === 'capture-speak') {
        const all = await page.evaluate(() => /All subjects/.test(document.body.innerText));
        if (all) faultOnce(step, 'the old picture shows "All subjects" rather than the subject');
      }
      await shoot(page, step, 'old', extra);
    }
    async function old(step, extra = '', target = {}) {
      try {
        const o = {subject: target.subject ?? (walk.subject || undefined), piece: target.piece ?? (walk.piece || undefined), section: target.section ?? OLD_SECTION[step.id]};
        const addr = await p.evaluate(o2 => window.v2.advanced(o2), o);
        step.oldAddress = addr;
        await q.setViewportSize({width, height});
        await q.goto(BASE + addr, {waitUntil: 'load'});
        await settleOld(q, o.subject, o.section, step);
        await oldShot(step, extra, q);
      } catch (e) { faultOnce(step, 'the old screen could not be photographed: ' + String(e.message).split('\n')[0].slice(0, 100)); }
    }

    const run = async (id, fn) => {
      const step = stepOf(id);
      cur = step;
      console.log(`  ${id} ${step.name}`);
      try { await fn(step); }
      catch (e) {
        step.status = 'failed'; failedAny = true;
        breakOnce(step, 'This step could not be done: ' + String(e.message).split('\n')[0].slice(0, 160));
        try { await shoot(p, step, 'new', '-failed'); } catch {}
      }
      if (step.status !== 'failed' && (step.breaks.length || step.notBuilt.length)) step.status = 'broken';
    };
    const newShot = async (step, extra = '') => { await sideways(step); await sawNotBuilt(step); await shoot(p, step, 'new', extra); };
    const backHome = async () => {
      await p.locator('a[href="#/"]:visible').first().click({timeout: 5000});
      await p.waitForFunction(() => !/Reading your subjects/.test(document.body.innerText) && !!document.querySelector('.home-row-open,.home-card-open'), null, {timeout: 10000}).catch(() => {});
      await wait(600);
    };
    // A finished check, not a busy one: no "Checking", no "Reading saved words", and the state line has settled.
    const checkSettled = async step => {
      const done = await p.waitForFunction(() => {
        const t = document.body.innerText, btn = document.querySelector('[data-ck=run]');
        if (!btn || /Checking/.test(btn.textContent || '')) return false;
        if (/Reading saved words|Checking this saved draft/.test(t)) return false;
        const st = document.querySelector('.ck-state');
        return !!st && st.dataset.kind !== 'busy';
      }, null, {timeout: 30000}).then(() => true).catch(() => false);
      await wait(800);
      return done;
    };

    // ---------- 1 Home ----------
    await run('01', async step => {
      await p.goto(BASE + '/v2/index.html', {waitUntil: 'load'});
      await wait(1800);
      if (!(await theTheme(p))) breakOnce(step, 'The theme button did not change the theme.');
      await p.waitForFunction(() => !/Reading your subjects/.test(document.body.innerText), null, {timeout: 8000}).catch(() => faultOnce(step, 'Home still said it was reading the subjects after 8 seconds'));
      await wait(500);
      step.address = p.url(); await said(step); await newShot(step); await old(step);
    });

    // ---------- 2 New subject ----------
    await run('02', async step => {
      await p.locator('[data-home-new]:visible').first().click({timeout: 5000});
      await wait(500);
      await p.fill('#home-new-name', mySubject);
      await sideways(step); await shoot(p, step, 'new', 'a');
      await p.locator('.home-form button[type=submit]').click();
      await p.waitForFunction(() => location.hash.startsWith('#/subject/'), null, {timeout: 8000});
      walk.subject = decodeURIComponent((await p.evaluate(() => location.hash)).match(/subject\/([^?&]+)/)[1]);
      await wait(1500);
      step.address = p.url(); await said(step); await newShot(step); await old(step);
    });

    // ---------- 3 Capture, Speak ----------
    let seenJobs = new Set();
    await run('03', async step => {
      const before = await fetch(BASE + '/api/recordings').then(r => r.json()).catch(() => ({jobs: []}));
      seenJobs = new Set((before.jobs || []).map(x => x.id));
      await p.locator('[data-v2-capture]:visible').first().click({timeout: 5000});
      await wait(500);
      await p.locator('dialog [data-view=speak]').click({timeout: 5000});
      await wait(3200); // the fake microphone runs for a few seconds
      const stop = p.locator('dialog [data-cap=stop]');
      if (await stop.count()) await stop.click();
      else breakOnce(step, 'Speak did not start recording by itself; there was no Stop button.');
      await wait(800);
      await sideways(step); await shoot(p, step, 'new', 'a');
      await p.locator('dialog [data-cap=save]').click({timeout: 5000});
      await p.waitForSelector('dialog [data-cap=done]', {timeout: 15000});
      await wait(500);
      step.address = p.url(); await said(step, 'dialog'); await newShot(step);
      if (!/transcription is not set up/i.test(step.says)) breakOnce(step, 'The sheet did not say that transcription is not set up on this machine.');
      await old(step);
      await p.locator('dialog [data-cap=done]').click();
      await wait(800);
    });

    // ---------- 4 The subject says where the recording stands; Use the transcript ----------
    await run('04', async step => {
      if (!(await hasRoute('#/subject/'))) throw new Error('not on the subject');
      const openHave = async () => { const h = p.locator('[data-subj-step]:has-text("What you have")'); if (await h.count()) { await h.first().click(); await wait(800); } };
      await openHave();
      await said(step);
      const before = step.says;
      await shoot(p, step, 'new', 'a'); await sideways(step);
      if (!/Saved\. Transcription is not set up on this machine/.test(before)) breakOnce(step, 'The subject did not say "Saved. Transcription is not set up on this machine." for the recording.');
      // The demo cannot transcribe: put a finished job in place (see the top of this file), then use it for real.
      const now = await fetch(BASE + '/api/recordings').then(r => r.json()).catch(() => ({jobs: []}));
      const mine = (now.jobs || []).filter(x => !seenJobs.has(x.id) && x.state === 'saved').sort((a, b) => String(b.started).localeCompare(String(a.started)))[0];
      if (!DATA) { breakOnce(step, 'No transcript could be put in place: the demo\'s own data folder was not found (give it with --home=<folder>), so "Use the transcript" was not tested.'); }
      else if (!mine) { breakOnce(step, 'The recording saved in step 3 was not in the recordings list as saved, so no transcript could be put in place.'); }
      else {
        finishJob(mine.id);
        await p.reload({waitUntil: 'load'}); await wait(2000);
        await openHave();
        const use = p.locator('[data-subj-rec=use]');
        if (!(await use.count())) breakOnce(step, '"Use the transcript" did not appear even with a finished transcript in place.');
        else {
          const t0 = Date.now();
          await use.first().click();
          const kept = ms => p.waitForFunction(() => /kept as a source/.test(document.body.innerText), null, {timeout: ms}).then(() => true).catch(() => false);
          let said1 = '';
          const grab = async () => { const m = plain(await p.locator('#v2-messages').innerText().catch(() => '')); if (m) said1 = m; };
          const poll = setInterval(grab, 300);
          const ok1 = await kept(10000);
          if (!ok1) {
            // timing, or real? wait much longer, then say which
            const late = await kept(25000);
            const secs = Math.round((Date.now() - t0) / 1000);
            if (late) { const msg = `After "Use the transcript" the subject took ${secs} seconds to say the transcript was kept as a source (slow, not missing).`; faultOnce(step, msg); step.notes.push(msg); }
            else breakOnce(step, `"Use the transcript" worked (the app said "${said1 || 'nothing'}") but the subject went on saying "Transcript ready." with the button and never "kept as a source", even after 35 seconds: the Library list does not show the transcript it just saved (a real fault, not timing).`);
          }
          clearInterval(poll);
          await wait(600);
          // Confirm the transcript (name the speaker, press Confirm), then "Use it for Check", all through the real buttons as human:adrian.
          const open = p.locator('[data-cs=open]');
          await p.waitForSelector('[data-cs=open]', {timeout: 8000}).catch(() => {});
          if (!(await open.count())) breakOnce(step, '"Confirm this transcript" did not appear for a ready transcript.');
          else {
            await open.first().click();
            await p.waitForSelector('[data-cs-confirm] [data-cs-words]', {timeout: 10000}).catch(() => breakOnce(step, 'The transcript words did not open in place.'));
            await wait(400);
            const box = p.locator('[data-cs-name]');
            if (await box.count()) await box.first().fill('Journey speaker');
            await sideways(step); await shoot(p, step, 'new', 'b');
            await p.locator('[data-cs=confirm]').click({timeout: 5000});
            await p.waitForFunction(() => !!document.querySelector('[data-cs-confirmed]'), null, {timeout: 15000}).catch(() => breakOnce(step, 'The row did not say "Confirmed by you" after Confirm.'));
            await p.waitForSelector('[data-cs=capture]', {timeout: 15000}).catch(() => breakOnce(step, '"Use it for Check" did not appear for a kept, confirmed transcript.'));
            await wait(500);
            await sideways(step); await shoot(p, step, 'new', 'c');
            if (await p.locator('[data-cs=capture]').count()) {
              await p.locator('[data-cs=capture]').click({timeout: 5000});
              await p.waitForFunction(() => /Check can now read this/.test(document.body.innerText), null, {timeout: 15000}).catch(() => breakOnce(step, 'The subject did not say "Check can now read this" after "Use it for Check".'));
              await wait(600);
            }
          }
        }
      }
      step.address = p.url(); await said(step); await newShot(step); await old(step);
    });

    // ---------- 5 The steps lead to Write ----------
    await run('05', async step => {
      await p.locator('[data-subj-add]:visible').first().click({timeout: 5000}); await wait(700);
      const art = p.locator('[data-subj-make=article]');
      const locked = await art.isDisabled();
      await sideways(step); await shoot(p, step, 'new', 'a');
      if (locked) {
        breakOnce(step, 'Add a form offered Article greyed out for a new subject with a source, so the Article cannot be started without leaving version two.');
        throw new Error('Article stayed locked for a subject with a source');
      }
      // Article opens Write for the subject on an empty page; the first saved words start the Article.
      await art.click();
      await p.waitForFunction(() => /^#\/write\//.test(location.hash) && !/piece=/.test(location.hash), null, {timeout: 8000})
        .catch(() => breakOnce(step, 'Add a form, Article did not open Write for the subject.'));
      await p.locator('textarea[data-ed]').first().waitFor({timeout: 8000});
      const here = p.locator('textarea[data-ed]').first();
      if ((await here.getAttribute('placeholder')) !== 'Write here') breakOnce(step, 'The empty Write page did not show "Write here".');
      await sideways(step); await shoot(p, step, 'new', 'b');
      await here.click(); await p.keyboard.type('The first cup was small and bitter, and I loved it.');
      await p.waitForFunction(() => /piece=/.test(location.hash), null, {timeout: 20000})
        .catch(() => breakOnce(step, 'After the first words were saved the address did not carry the piece.'));
      walk.piece = new URL('http://x/' + (await p.evaluate(() => location.hash)).slice(1)).searchParams.get('piece');
      await wait(1500);
      await shoot(p, step, 'new', 'c');
      await p.evaluate(h => { location.hash = h; }, '#/subject/' + walk.subject); await wait(1500);
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
      if (!saved) breakOnce(step, 'Write did not say "Saved" after the words were typed.');
      await p.reload({waitUntil: 'load'}); await wait(2800);
      const vals = await p.evaluate(() => [...document.querySelectorAll('textarea[data-ed]')].map(t => t.value));
      for (const t of paras) if (!vals.includes(t)) breakOnce(step, 'After a reload a typed paragraph was gone: "' + t.slice(0, 40) + '".');
      if (vals.length < 3) breakOnce(step, 'After a reload fewer than three paragraphs were there.');
      step.address = p.url(); await said(step); await newShot(step); await old(step);
    });

    // ---------- 7 Read ----------
    await run('07', async step => {
      const link = p.locator('a[href^="#/read/"]:visible').first();
      if (!(await link.count())) throw new Error('Write offers no way to Read');
      await link.click(); await wait(1800);
      if (!(await hasRoute('#/read/'))) throw new Error('Read did not open');
      const t = await p.locator('main').innerText();
      if (!/A fourth paragraph that closes the piece/.test(t)) breakOnce(step, 'Read did not show the last paragraph that was saved in Write.');
      step.address = p.url(); await said(step); await newShot(step); await old(step);
    });

    // Presses "Check saved draft" on the open Check screen, waits until it has really finished, says what it said.
    async function pressCheck(step, {expectReal}) {
      await checkSettled(step);
      await shoot(p, step, 'new', 'a');
      const run1 = p.locator('[data-ck=run]');
      if (!(await run1.count())) throw new Error('there was no "Check saved draft" button');
      if (await run1.isDisabled()) { breakOnce(step, '"Check saved draft" was disabled although words were saved.'); return 'disabled'; }
      await run1.click();
      const finished = await checkSettled(step);
      if (!finished) breakOnce(step, 'The check did not finish within 30 seconds.');
      const kind = await p.evaluate(() => document.querySelector('.ck-state')?.dataset.kind || '');
      await said(step);
      const heldNow = kind === 'held' || /Capture the source transcript before checking|Checks held/.test(await p.innerText('main').catch(() => ''));
      step.checkKind = kind;
      if (finished && !heldNow && kind !== 'ok' && kind !== 'review') breakOnce(step, `The check ended as "${kind || 'unknown'}", not as a finished result.`);
      if (heldNow && expectReal) breakOnce(step, HELD_NOW);
      if (expectReal && !heldNow && kind !== 'ok' && kind !== 'review') breakOnce(step, `Step 8 did not end in a real check result (it ended as "${kind || 'unknown'}").`);
      if (heldNow && !expectReal) breakOnce(step, 'Check on the finished demo piece was held rather than giving a result.');
      return kind;
    }

    // ---------- 8 Check ----------
    await run('08', async step => {
      const link = p.locator('a[href^="#/check/"]:visible').first();
      if (!(await link.count())) throw new Error('Read offers no way to Check');
      await link.click(); await wait(1800);
      if (!(await hasRoute('#/check/'))) throw new Error('Check did not open');
      await pressCheck(step, {expectReal: true});
      step.address = p.url();
      await newShot(step);
      await old(step);
    });

    // ---------- 8b Check on a different piece: the demo subject "The green gate" ----------
    await run('08b', async step => {
      await backHome();
      const row = p.locator('a.home-row-open:has-text("The green gate"), a.home-card-open:has-text("The green gate")').first();
      if (!(await row.count())) throw new Error('Home did not list the demo subject "The green gate"');
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.click({timeout: 6000});
      await p.waitForFunction(() => location.hash.startsWith('#/subject/'), null, {timeout: 8000});
      const gateId = decodeURIComponent((await p.evaluate(() => location.hash)).match(/subject\/([^?&]+)/)[1]);
      await wait(1800);
      const stepBtn = p.locator('[data-subj-step]:has-text("Check")').first();
      if (await stepBtn.count()) { await stepBtn.click(); await wait(800); }
      const link = p.locator('a[href^="#/check/"]:visible').first();
      if (!(await link.count())) throw new Error('"The green gate" offers no way into Check');
      await link.click(); await wait(1800);
      if (!(await hasRoute('#/check/'))) throw new Error('Check did not open for "The green gate"');
      const pieceId = new URL('http://x/' + (await p.evaluate(() => location.hash)).slice(1)).searchParams.get('piece');
      await pressCheck(step, {expectReal: false});
      step.address = p.url();
      await newShot(step);
      await old(step, '', {subject: gateId, piece: pieceId || undefined, section: 'check'});
    });

    // ---------- 9 Back on the subject and on Home ----------
    await run('09', async step => {
      await backHome();
      // by clicks: Home, then this walk's own subject (by its unique name)
      const mine = p.locator(`a.home-row-open:has-text("${mySubject}"), a.home-card-open:has-text("${mySubject}")`).first();
      if (!(await mine.count())) { breakOnce(step, 'Home did not show the new subject among its subjects.'); throw new Error('this walk\'s subject was not on Home'); }
      await mine.scrollIntoViewIfNeeded().catch(() => {});
      await mine.click({timeout: 6000});
      await p.waitForFunction(() => location.hash.startsWith('#/subject/'), null, {timeout: 8000});
      await wait(2200);
      const sub = await p.evaluate(() => ({text: document.querySelector('main')?.innerText || '', where: document.querySelector('.subj-where')?.textContent || '', check: [...document.querySelectorAll('[data-subj-step]')].filter(e => /Check/.test(e.textContent)).map(e => e.textContent.replace(/\s+/g, ' ').trim())}));
      const subjCheck = plain(sub.check.join(' | ')), subjText = plain(sub.text);
      await sideways(step); await sawNotBuilt(step); await shoot(p, step, 'new', 'b');
      // Step 8 ended in a real result, so the subject no longer says it has no source to check against.
      if (sub.check.some(t => t.includes(HOLD)) || subjText.includes(HOLD)) breakOnce(step, `The subject's Check step still said "${HOLD}" after the transcript was used for Check and the check ran.`);

      // The way into Advanced and back, by the bar: the bar's Advanced in this tab, the old picture of the subject, then
      // the old workspace's own "Version three" link (it leads to the default front since 12 November; the walk then
      // goes on in version two at the same address).
      const adv = p.locator('[data-v2-advanced]:visible').first();
      if (await adv.count()) {
        await adv.click();
        await p.waitForURL(/document-study/, {timeout: 15000});
        step.oldAddress = p.url();
        await settleOld(p, walk.subject, null, step);
        await oldShot(step, '', p);
        const back = p.locator('a.v2-front:visible').first();
        if (!(await back.count())) { breakOnce(step, 'The old workspace shows no "Version three" link at this width, so there is no way back by clicking.'); await p.goto(BASE + '/v2/index.html#/', {waitUntil: 'load'}); }
        else {
          await back.click();
          await p.waitForURL(/\/v3\//, {timeout: 15000}).catch(() => breakOnce(step, 'The old workspace\'s "Version three" link did not lead to version three.'));
          await wait(1500);
          if (!/^#\/subject\//.test(await p.evaluate(() => location.hash))) breakOnce(step, 'The "Version three" link in the old workspace did not return to the subject that was open.');
          if (/\/v3\//.test(p.url())) await p.goto(p.url().replace('/v3/index.html', '/v2/index.html'), {waitUntil: 'load'});
        }
        await p.waitForFunction(() => !!document.querySelector('[data-v2-theme]'), null, {timeout: 10000}).catch(() => {});
        await theTheme(p).catch(() => {});
      } else {
        breakOnce(step, `At ${width} wide the bar shows no Advanced, so the old workspace and the way back could not be walked by clicks.`);
        await old(step, '', {subject: walk.subject, section: undefined});
      }
      await backHome();
      await p.waitForFunction(() => !/Reading your subjects/.test(document.body.innerText), null, {timeout: 8000}).catch(() => faultOnce(step, 'Home still said it was reading the subjects'));
      const rowText = await p.evaluate(n => {
        const hits = [...document.querySelectorAll('main *')].filter(e => e.offsetParent && e.textContent.includes(n) && ![...e.children].some(c => c.textContent.includes(n)));
        const el = hits[0]; if (!el) return '';
        const box = el.closest('li, tr, article, [role=row], [class*=row], [class*=card]') || el.parentElement;
        return box.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
      }, mySubject);
      if (!rowText) breakOnce(step, 'Home did not show the new subject among its subjects.');
      else {
        const said2 = rowText.replace(mySubject, '').trim().slice(0, 140);
        if (rowText.includes(HOLD)) breakOnce(step, `Home's row for the subject still said "${HOLD}" after the check ran (the row reads: "${said2}").`);
      }
      step.address = p.url();
      step.says = 'SUBJECT CHECK STEP: ' + subjCheck + ' ## STATION: ' + plain(sub.where) + ' ## HOME ROW: ' + rowText;
      await newShot(step);
    });
  } finally {
    await context.close().catch(() => {});
  }
}

// ---------- the list of breaks, the files and the contact sheet ----------
const order = STEPS.map(s => s[0]);
const addTo = (list, step, name, text, at, screen) => {
  const hit = list.find(x => x.text === text && (screen ? x.screen === screen : x.step === step));
  if (hit) { if (!hit.at.includes(at)) hit.at.push(at); } else list.push({step, name, ...(screen ? {screen} : {}), text, at: [at]});
};
for (const w of result.walks) for (const s of w.steps) {
  const at = `${w.width} ${w.theme}`;
  for (const b of s.breaks) addTo(result.breaks, s.id, s.name, b, at);
  for (const f of s.faults) addTo(result.faults, s.id, s.name, f, at);
  for (const n of s.notBuilt) addTo(result.breaks, s.id, s.name, `The ${n.screen} screen says "${n.text}"`, at, n.screen + '|' + n.text);
}
result.breaks.sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));

// pairs.json: for each step in order, its title, its break, and the pictures per width and theme.
const pairs = {made: result.made, steps: STEPS.map(([id, key, title]) => {
  const per = result.walks.map(w => { const s = w.steps.find(x => x.id === id); return {width: w.width, theme: w.theme, status: s.status, new: s.pictures.find(f => f.startsWith(`${id}-new-`)) || s.pictures[0] || null, more: s.pictures.filter(f => !f.startsWith(`${id}-new-`)), old: s.oldPictures.find(f => f.startsWith(`${id}-old-`)) || s.oldPictures[0] || null, address: s.address, oldAddress: s.oldAddress}; });
  const breaks = [...new Set(result.walks.flatMap(w => w.steps.find(x => x.id === id).breaks.concat(w.steps.find(x => x.id === id).notBuilt.map(n => `The ${n.screen} screen says "${n.text}"`))))];
  return {id, key, title, break: breaks[0] || null, breaks, pairs: per};
})};
fs.writeFileSync(path.join(OUT, 'pairs.json'), JSON.stringify(pairs, null, 1));
fs.writeFileSync(path.join(OUT, 'journey.json'), JSON.stringify(result, null, 1));

try {
  const items = pairs.steps.map(s => ({s, file: (s.pairs.find(p => p.width === 390 && p.theme === 'light') || {}).new})).filter(x => x.file && fs.existsSync(path.join(OUT, x.file)));
  if (items.length) {
    const b2 = await chromium.launch();
    try {
      const pg = await b2.newPage({viewport: {width: 1600, height: 1600}});
      const cells = items.map(({s, file}) => `<figure style="margin:0;width:372px;height:500px;overflow:hidden;background:#222"><img style="width:372px;height:476px;object-fit:cover;object-position:top;display:block" src="data:image/jpeg;base64,${fs.readFileSync(path.join(OUT, file)).toString('base64')}"><figcaption style="height:24px;line-height:24px;padding:0 4px;white-space:nowrap;overflow:hidden">${s.id} ${s.title.replace(/[<&]/g, '')}</figcaption></figure>`).join('');
      await pg.setContent(`<body style="margin:0;background:#111;color:#ccc;font:11px sans-serif"><div style="display:grid;grid-template-columns:repeat(4,372px);gap:12px;padding:12px;width:1548px">${cells}</div></body>`);
      await pg.screenshot({path: path.join(OUT, 'sheet.jpg'), type: 'jpeg', quality: 70, clip: {x: 0, y: 0, width: 1560, height: Math.min(1600, 12 + Math.ceil(items.length / 4) * 512)}});
    } finally { await b2.close(); }
  }
} catch (e) { console.log('contact sheet not made: ' + e.message); }

console.log('\nBreaks:');
for (const b of result.breaks) console.log(`  [${b.step}; ${b.at.join(', ')}] ${b.text}`);
console.log('\nFaults:');
for (const f of result.faults) console.log(`  [${f.step}; ${f.at.join(', ')}] ${f.text}`);
if (result.tallerThanCap.length) console.log(`\n${result.tallerThanCap.length} pictures were cut at ${TALL} px (see journey.json).`);
console.log(`\nWrote ${path.join(OUT, 'journey.json')} and pairs.json`);
process.exitCode = failedAny ? 1 : 0;
