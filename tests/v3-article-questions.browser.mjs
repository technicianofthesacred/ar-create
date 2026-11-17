import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {syntheticHome} from '../scripts/demo.mjs';
import {buildDemoMagazine} from '../scripts/demo-magazine.mjs';
import {apply} from '../tools/magazine/register.mjs';
import {createServer} from '../runtime/server.mjs';

const {chromium} = await import(process.env.AR_CREATE_PLAYWRIGHT || 'playwright');
const home = syntheticHome();
let server, browser;
try {
  const config = JSON.parse(fs.readFileSync(home.config, 'utf8'));
  const {vault, files} = buildDemoMagazine(home.dir), data = config.dataDir;
  const ask = path.join(vault, 'Workflow/ASK - Kiln Keeper.md');
  const draft = path.join(vault, 'Workflow/3-Develop/DEV - Kiln Keeper (story).md');
  const before = fs.readFileSync(draft, 'utf8');
  fs.writeFileSync(ask, '# Kiln Keeper\n\n## When was the visit?\nOne note is undated.\nanswer:\n\n## How should the maker be introduced?\nanswer:\n');
  fs.mkdirSync(data, {recursive: true});
  const registration = await apply({mag: vault, files, data, verification: path.join(home.dir, 'question-proof')});
  assert.equal(registration.applied, true);
  fs.writeFileSync(path.join(data, "magazine-vault.json"), JSON.stringify({vaultRoot: vault, filesRoot: files, writable: true, machine: "question-fixture"}));
  server = await createServer({dataDir: data, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots,
    sharedArticles: true, researchEnabled: false, packageView: {syntheticFixtures: true}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
  const context = await browser.newContext({viewport: {width: 1280, height: 850}, extraHTTPHeaders: {'X-AR-Actor': 'human:adrian', 'X-AR-Client': 'ui'}});
  const page = await context.newPage();
  const write = id => `${base}/v3/index.html#/write/${id}?piece=${encodeURIComponent(id + ':article')}`;
  const panel = page.getByRole('region', {name: 'Article questions'});
  await page.goto(write('mag-kiln-keeper'));
  await panel.waitFor();
  assert.equal(await panel.getByRole('heading', {level: 3}).count(), 2);
  const shots = process.env.AR_CREATE_SHOTS;
  if (shots) {
    fs.mkdirSync(shots, {recursive: true});
    await page.screenshot({path: path.join(shots, 'article-questions-desktop.png')});
  }
  await page.setViewportSize({width: 390, height: 844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (shots) await page.screenshot({path: path.join(shots, 'article-questions-phone.png')});
  for (const [prompt, value] of [['When was the visit?', 'October 2024'], ['How should the maker be introduced?', 'Noor, a wood-fire potter']]) {
    const input = panel.getByRole('textbox', {name: prompt});
    await input.fill(value);
    await input.locator('xpath=ancestor::form').getByRole('button', {name: 'Save answer'}).click();
    await panel.getByText('Answered: ' + value, {exact: true}).waitFor();
  }
  assert.equal(fs.readFileSync(draft, 'utf8'), before);
  await page.reload();
  await panel.getByText('Answered: October 2024', {exact: true}).waitFor();
  await panel.getByText('Answered: Noor, a wood-fire potter', {exact: true}).waitFor();

  const response = page.waitForResponse(r => r.url().includes('/api/magazine/article-questions') && r.url().includes('mag-salt-lake-weaver'));
  await page.goto(write('mag-salt-lake-weaver'));
  assert.deepEqual((await (await response).json()).questions, []);
  await panel.waitFor({state: 'hidden'});
  await page.goto(base + '/v3/index.html#/');
  const needs = await context.request.get(base + '/api/needs-you?status=all');
  assert.equal((await needs.json()).asks.length, 0);
  assert.equal(await page.getByText('How should the maker be introduced?', {exact: true}).count(), 0);
  console.log('Two answers persisted in the selected article, its draft was unchanged, and another article and Home stayed clear.');
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => {server.close(resolve);server.closeAllConnections();});
  fs.rmSync(home.dir, {recursive: true, force: true});
}
