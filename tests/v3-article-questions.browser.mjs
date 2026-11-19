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
  fs.writeFileSync(ask, '# Kiln Keeper\n\n## Which title?\nChoose the title for this invented story.\n- [ ] A Bowl at Dawn\n- [ ] The Kiln Keeper — a long evening beside the fire\n- other: A title of my own\nanswer:\n\n## Read the draft. Good, or what should change?\nTell me anything that reads wrong.\nanswer:\n\n## What do you remember from sitting with the maker?\nA sentence or two, or leave it blank.\nanswer:\n\n## When was the visit?\nOne note is undated.\nanswer:\n\n## How should the maker be introduced?\nanswer:\n');
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
  assert.equal(await panel.locator('h3').count(), 5);
  const shots = process.env.AR_CREATE_SHOTS;
  async function screenshots(state){
    if(!shots)return;
    fs.mkdirSync(shots,{recursive:true});
    for(const [name,width,height] of [['desktop',1280,850],['panel',670,916],['phone',390,844],['small-phone',320,844]]){
      await page.setViewportSize({width,height});
      for(const theme of ['light','dark']){
        await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:path.join(shots,`questions-${state}-${name}-${theme}.png`)});
      }
    }
    await page.setViewportSize({width:390,height:844});
  }
  await screenshots('closed');
  assert.equal(await panel.locator('form:visible').count(), 0, 'Questions start closed');
  const toggle = panel.getByRole('button', {name: /Questions/});
  assert.match(await toggle.innerText(), /5 open/);
  await toggle.click();
  assert.equal(await panel.locator('form:visible').count(), 1);
  const barBounds=await toggle.boundingBox();
  assert.ok(barBounds.height<=55, 'Closed bar stays compact');
  await screenshots('open');
  await panel.getByRole('button', {name: 'Which title?', exact:true}).click();
  await panel.getByRole('button', {name:'A Bowl at Dawn', exact:true}).click();
  assert.equal(await panel.locator('form:visible input[name=choice]').inputValue(), 'A Bowl at Dawn');
  const ownTitle = panel.getByRole('textbox', {name:'Which title?',exact:true});
  await ownTitle.fill('A title still being considered');
  await panel.getByRole('button', {name:'When was the visit?',exact:true}).click();
  await toggle.click();
  await toggle.click();
  await panel.getByRole('button', {name:'Which title?',exact:true}).click();
  assert.equal(await ownTitle.inputValue(),'A title still being considered');
  fs.appendFileSync(ask,'\n');
  const staleResponse=page.waitForResponse(response=>response.url().includes('/api/magazine/ask/answer'));
  await panel.locator('form:visible').getByRole('button',{name:'Save answer',exact:true}).click();
  assert.equal((await staleResponse).status(),409);
  const refreshed=page.waitForResponse(response=>response.url().includes('/api/magazine/article-questions'));
  await panel.getByRole('button',{name:'Refresh questions',exact:true}).click();
  await refreshed;
  await panel.getByRole('button',{name:'Refresh questions',exact:true}).waitFor({state:'hidden'});
  assert.equal(await ownTitle.inputValue(),'A title still being considered');
  await ownTitle.fill('');
  await panel.locator('form:visible').getByRole('button',{name:'Save answer',exact:true}).click();
  await panel.getByText('Answered: A Bowl at Dawn',{exact:true}).waitFor();
  for (const [prompt, value] of [['When was the visit?', 'October 2024'], ['How should the maker be introduced?', 'Noor, a wood-fire potter']]) {
    await panel.getByRole('button', {name:prompt,exact:true}).click();
    const input = panel.getByRole('textbox', {name: prompt});
    await input.fill(value);
    await input.locator('xpath=ancestor::form').getByRole('button', {name: 'Save answer'}).click();
    await panel.getByText('Answered: ' + value, {exact: true}).waitFor();
  }
  assert.equal(fs.readFileSync(draft, 'utf8'), before);
  await page.reload();
  await panel.getByRole('button', {name:/Questions/}).click();
  await panel.getByRole('button', {name:'When was the visit?, answered',exact:true}).click();
  await panel.getByText('Answered: October 2024', {exact: true}).waitFor();
  await panel.getByRole('button', {name:'How should the maker be introduced?, answered',exact:true}).click();
  await panel.getByText('Answered: Noor, a wood-fire potter', {exact: true}).waitFor();
  assert.match(await panel.getByRole('button',{name:/Questions/}).innerText(), /2 open/);

  const response = page.waitForResponse(r => r.url().includes('/api/magazine/article-questions') && r.url().includes('mag-salt-lake-weaver'));
  await page.goto(write('mag-salt-lake-weaver'));
  assert.deepEqual((await (await response).json()).questions, []);
  await panel.waitFor({state: 'hidden'});
  await page.goto(base + '/v3/index.html#/');
  const needs = await context.request.get(base + '/api/needs-you?status=all');
  assert.equal((await needs.json()).asks.length, 0);
  assert.equal(await page.getByText('How should the maker be introduced?', {exact: true}).count(), 0);
  console.log('Three answers persisted in the selected article, its draft was unchanged, and another article and Home stayed clear.');
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => {server.close(resolve);server.closeAllConnections();});
  fs.rmSync(home.dir, {recursive: true, force: true});
}
