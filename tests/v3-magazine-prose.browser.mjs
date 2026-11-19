// Invented manuscript only: display formatting must never change the saved draft.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {syntheticHome} from '../scripts/demo.mjs';
import {buildDemoMagazine} from '../scripts/demo-magazine.mjs';
import {apply} from '../tools/magazine/register.mjs';
import {createServer} from '../runtime/server.mjs';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const home=syntheticHome();let server,browser;
try{
 const config=JSON.parse(fs.readFileSync(home.config,'utf8')),{vault,files}=buildDemoMagazine(home.dir);
 const draft=path.join(vault,'Workflow/3-Develop/DEV - Kiln Keeper (story).md');
 const manuscript='---\ntype: DEV\nstory: Kiln Keeper\ntitle: Where the Ash Settles\n---\n\nMetadata for the invented reader page.\n\n---\n\n*Where the Ash Settles*\n\nI reached the kiln before the heat did. The keeper lifted a **small clay bowl** into the morning light.\n\n## Reading the fire\n\n> Every firing leaves its own *handwriting*.\n\nThe ash settled slowly against the rim. We sat beside the kiln and watched the light change.\n\n- Pine from the hillside\n- Clay from the river\n\n---\n';
 fs.writeFileSync(draft,manuscript);
 const ask=path.join(vault,'Workflow/ASK - Kiln Keeper.md');
 fs.writeFileSync(ask,'# Kiln Keeper\n\n## Which title?\nChoose a title for this invented story.\nanswer:\n');
 fs.mkdirSync(config.dataDir,{recursive:true});
 assert.equal((await apply({mag:vault,files,data:config.dataDir,verification:path.join(home.dir,'proof')})).applied,true);
 fs.writeFileSync(path.join(config.dataDir,'magazine-vault.json'),JSON.stringify({vaultRoot:vault,filesRoot:files,writable:true,machine:'synthetic-prose'}));
 server=await createServer({dataDir:config.dataDir,publicDir:path.resolve('public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage();
 const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(new URL(r.url()).pathname);});
 const url=screen=>`${base}/v3/index.html?reviewActor=agent:codex#/${screen}/mag-kiln-keeper?piece=mag-kiln-keeper%3Aarticle`;
 const shots=process.env.AR_CREATE_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});
 async function pictures(state){
  if(!shots)return;
  for(const [name,width,height] of [['desktop',1280,850],['panel',670,916],['phone',390,844],['small-phone',320,844]]){
   await page.setViewportSize({width,height});
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(shots,`prose-${state}-${name}-${theme}.png`)});
   }
  }
 }
 if(process.env.AR_CREATE_COMPARE_BASELINE){
  const changed=['public/v3/index.html','public/v3/screens/write.js','public/v2/screens/read.js','public/v2/shell/parts.js','public/document-study/readable-markdown.js'];
  await page.route('**/*',async route=>{const file='public'+new URL(route.request().url()).pathname;if(changed.includes(file))return route.fulfill({body:execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'}),contentType:file.endsWith('.html')?'text/html':'text/javascript'});return route.continue();});
  await page.goto(url('write'));await page.locator('.wr-title').waitFor();await pictures('before');await page.unroute('**/*');await page.goto('about:blank');
 }
 await page.setViewportSize({width:1280,height:850});const started=Date.now();
 await page.goto(url('write'));const text=page.locator('[data-wr-text]');await text.locator('h2').waitFor({timeout:10000}).catch(async e=>{console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(-2000)}));throw e;});
 const openingMs=Date.now()-started;
 assert.equal(await page.locator('.wr-ro:visible').count(),0,'routine actor and edit-location explanations are absent');
 const edit=page.locator('[data-wr-story-heading]').getByRole('link',{name:'Edit in Magazine',exact:true});
 assert.ok((await edit.getAttribute('href')).includes('section=write'));
 assert.ok((await edit.getAttribute('href')).includes('mag-kiln-keeper'));
 assert.equal(await text.locator('textarea').count(),0);
 assert.equal(await text.locator('h2').innerText(),'Reading the fire');
 assert.equal(await text.locator('strong').innerText(),'small clay bowl');
 assert.equal(await text.locator('blockquote em').innerText(),'handwriting');
 assert.equal(await text.locator('li').count(),2);
 assert.equal(await page.getByRole('region',{name:'Article questions'}).locator('form:visible').count(),0);
 const catalogs=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/api/study-draft/catalog')).map(r=>r.name));
 assert.ok(catalogs.length&&catalogs.every(u=>new URL(u).searchParams.get('purpose')==='navigation'));
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/api/magazine/working-draft/catalog')).length),0);
 await pictures('after');
 await page.goto(url('read'));const read=page.locator('[data-rd-text]');await read.locator('h2').waitFor();
 assert.equal(await read.locator('strong').innerText(),'small clay bowl');
 assert.equal(await read.locator('blockquote em').innerText(),'handwriting');assert.equal(await read.locator('li').count(),2);
 await page.goto(base+'/v3/index.html?reviewActor=agent:codex#/write/mag-bamboo-carver?piece=mag-bamboo-carver%3Aarticle');
 await page.getByText('This story has no draft yet, so there are no words to write on here. A draft is started in the Magazine; it is not started from here.',{exact:true}).waitFor();
 assert.equal(fs.readFileSync(draft,'utf8'),manuscript);assert.deepEqual(errors,[]);
 assert.ok(writes.every(p=>p==='/api/presence'),JSON.stringify(writes));
 // Advanced owns its existing initialization commands; validate that destination separately.
 await page.goto(url('write'));await edit.waitFor();
 const destination=await edit.getAttribute('href');
 const [opened]=await Promise.all([page.waitForNavigation(),edit.click()]);
 assert.equal(opened.status(),200);
 assert.equal(new URL(page.url()).pathname,'/document-study/index.html');
 for(const [key,value] of new URL(destination,base).searchParams)assert.equal(new URL(page.url()).searchParams.get(key),value);
 assert.equal(new URL(page.url()).searchParams.get('v2from'),'/write/mag-kiln-keeper?piece=mag-kiln-keeper%3Aarticle');

 assert.equal(fs.readFileSync(draft,'utf8'),manuscript);

 console.log(JSON.stringify({openingMs,checks:'semantic Write and Read, navigation catalog, no preflight, closed article questions, no horizontal overflow, unchanged manuscript, no content writes',screenshots:shots||null}));
}finally{
 await browser?.close();if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});fs.rmSync(home.dir,{recursive:true,force:true});
}
