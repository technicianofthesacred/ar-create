// Browser check for the Words screen: the card on Home, the "Go through them" link on Needs you, answering a doubtful
// word (recorded as human:adrian from the page, remembered in the library, fixed in the transcript), confirming an
// agent's suggestion, search and filter, the first-use screen, read-only as an agent, and a phone with no sideways
// scroll and 44px taps. Not part of `npm test` (no browser is a dependency of this repo). It starts its own synthetic demo,
// never the installed app on 8841:
//   AR_CREATE_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node tests/words.browser.mjs
// AR_CREATE_WORDS_SHOTS=<folder> also saves the screens at 1440 and 390 wide.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startWordsDemo} from './helpers/words-demo.mjs';

const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const shots=process.env.AR_CREATE_WORDS_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});
const demo=await startWordsDemo({port:0}),errors=[];
const browser=await chromium.launch();
const shot=async(page,name,{tall=0}={})=>{if(!shots)return;const was=page.viewportSize();if(tall)await page.setViewportSize({width:was.width,height:tall});await page.waitForTimeout(400);await page.screenshot({path:path.join(shots,name)});if(tall)await page.setViewportSize(was);};
const watch=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/404|409|MIME/.test(m.text()))errors.push(m.text());});};
const openHome=async(page,url)=>{
 await page.goto(url,{waitUntil:'load'});await page.waitForSelector('[data-tr-home]',{state:'attached',timeout:15000});await page.waitForTimeout(1200);
 if(!await page.locator('[data-home-words]').isVisible().catch(()=>false))await page.evaluate(()=>window.projectLibrary?.open?.());
 await page.waitForSelector('[data-home-words] .wl-open',{timeout:10000});
};
const check=async id=>(await fetch(demo.base+'/api/words/check?jobId='+id)).json();
const transcript=id=>{const dir=path.join(demo.dataDir,'recordings','Story',id,'transcript.json');return JSON.parse(fs.readFileSync(dir,'utf8'));};
try{
 // ---- Home: the Words card with its count, and the Needs you link ----
 const page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await openHome(page,demo.url+'?reviewActor=human:adrian');
 assert.match(await page.locator('[data-home-words]').innerText(),/words shared by every project\. 7 words to check\./);
 assert.equal(await page.locator('[data-home-words] .wl-count').innerText(),'7');
 const link=page.locator(`.ny-ask[data-ny-ask] a.ny-open`).first();
 assert.match(await link.getAttribute('href'),/^#words\/check\/[a-f0-9-]{36}$/,'Go through them opens the Words screen at that recording');
 assert.equal(await page.locator('.ny-ask .ny-choice.is-default').first().innerText().then(t=>/Keep all as heard/.test(t)),true);
 assert.equal(await page.locator('.ny-band').evaluate(b=>/—/.test(b.innerText)),false,'no em dashes');
 await shot(page,'words-home-desktop.png');

 // ---- the screen ----
 await page.locator('[data-home-words] .wl-open').click();
 await page.waitForSelector('#words-library[open] .wl-card',{timeout:8000});
 const screen=page.locator('#words-library');
 assert.match(await screen.innerText(),/To check[\s\S]*Suggested[\s\S]*Recently learned[\s\S]*All words/);
 assert.equal(await screen.evaluate(el=>/—/.test(el.innerText)),false,'no em dashes on the screen');
 assert.equal(await screen.locator('.wl-recent').innerText().then(t=>/Mariya[\s\S]*Heard as Maria/.test(t)),true,'a word he confirmed shows under Recently learned');
 await shot(page,'words-desktop-top.png');

 // ---- answer: use the library's suggestion, remembered and fixed ----
 const card=screen.locator('details.wl-card',{hasText:'Tea Teacher interview'});
 if(!await card.evaluate(d=>d.open))await card.locator('summary').click();
 const near=screen.locator('.wl-item[data-wl-item="near-match:luyo"]');
 await near.locator('[data-wl-use]').click();
 await near.locator('.wl-done').waitFor({timeout:8000});
 assert.match(await near.locator('.wl-done').innerText(),/Changed to Lu Yu in this recording and remembered/);
 const rec=await check(demo.first),item=rec.items.find(i=>i.word==='Lu Yo');
 assert.deepEqual([item.status,item.answer.by,item.answer.choice],['corrected','human:adrian','suggestion']);
 assert.match(transcript(demo.first).segments[0].text,/^Lu Yu wrote/);
 // "That is right, remember it" for a name
 const jonas=screen.locator('.wl-item[data-wl-item="unknown-name:jonas"]');
 await jonas.locator('[data-wl-mode="right"]').click();
 await jonas.locator('select').selectOption('person');
 await shot(page,'words-desktop-answering.png',{tall:1500});
 await jonas.locator('button[type=submit]').click();
 await jonas.locator('.wl-done').waitFor({timeout:8000});
 const learned=await (await fetch(demo.base+'/api/words?q=jonas&status=all')).json();
 assert.deepEqual([learned.entries[0].spelling,learned.entries[0].category,learned.entries[0].source.kind],['Jonas','person','confirmed-answer']);
 // type his own spelling for a number: fixed for this talk only, never vocabulary
 const num=screen.locator('.wl-item[data-wl-item="number:1998"]');
 await num.locator('[data-wl-mode="spell"]').click();
 await num.locator('input[type=text]').fill('1989');
 await num.locator('button[type=submit]').click();
 await num.locator('.wl-done').waitFor({timeout:8000});
 assert.match(transcript(demo.first).segments[1].text,/from 1989 with/);
 assert.equal((await (await fetch(demo.base+'/api/words?q=1989&status=all')).json()).matched,0);
 // keep as heard on the rest settles the recording and its Needs you ask
 for(const key of ['unknown-name:classic','unknown-name:dingshu']){await screen.locator(`.wl-item[data-wl-item="${key}"] [data-wl-keep]`).click();await page.waitForSelector(`.wl-item[data-wl-item="${key}"][data-status="kept"]`,{timeout:8000});}
 assert.equal((await check(demo.first)).state,'done','answering every word settles the recording');
 const asks=(await (await fetch(demo.base+'/api/needs-you?status=answered')).json()).asks;
 assert.ok(asks.some(a=>a.scope?.id===demo.first&&a.resolution.by==='human:adrian'&&a.resolution.choice==='Go through them'),'and its Needs you ask');
 // ---- confirm an agent's suggestion ----
 const sugg=screen.locator('[data-wl-proposed]',{hasText:'Fenghuang'});
 await sugg.locator('[data-wl-decide="confirm"]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-wl-proposed] .wl-w')?.textContent.includes('Fenghuang'),null,{timeout:8000});
 assert.equal((await (await fetch(demo.base+'/api/words?q=fung+wong')).json()).entries[0].spelling,'Fenghuang');
 // ---- search and filter ----
 await screen.locator('[data-wl-search]').fill('shou');
 await page.waitForFunction(()=>document.querySelectorAll('#words-library .wl-row[data-wl-word]').length===1,null,{timeout:6000});
 assert.match(await screen.locator('.wl-row[data-wl-word]').innerText(),/Shou Puerh/);
 await screen.locator('[data-wl-search]').fill('');
 await screen.locator('[data-wl-chip="hexagram"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#words-library .wl-row[data-wl-word] .wl-tag')].every(t=>t.textContent==='Hexagram')&&document.querySelectorAll('#words-library .wl-row[data-wl-word]').length>0,null,{timeout:6000});
 await screen.locator('[data-wl-chip=""]').click();
 await screen.locator('[data-wl-search]').fill('zzzzz-nothing');
 await screen.locator('.wl-empty').waitFor({timeout:6000});
 assert.match(await screen.locator('.wl-empty').innerText(),/No word matches "zzzzz-nothing"/);
 await screen.locator('[data-wl-search]').fill('');
 await shot(page,'words-desktop-list.png',{tall:2200});
 // ---- add a word ----
 await screen.locator('.wl-bar [data-wl-add-open]').click();
 await screen.locator('[data-wl-add-spelling]').fill('Mengshan');
 await screen.locator('[data-wl-add-heard]').fill('moon shan, mung shan');
 await screen.locator('form[data-wl-add] select').selectOption('place');
 await screen.locator('form[data-wl-add] button[type=submit]').click();
 await page.waitForFunction(()=>!document.querySelector('#words-library form[data-wl-add]'),null,{timeout:6000});
 const added=(await (await fetch(demo.base+'/api/words?q=moon+shan')).json()).entries[0];
 assert.deepEqual([added.spelling,added.category,added.addedBy,added.variants.length],['Mengshan','place','human:adrian',2]);
 // ---- back to Home: the count has gone down ----
 await screen.locator('[data-wl-close]').click();
 await page.waitForFunction(()=>!document.getElementById('words-library')?.open);
 await page.waitForTimeout(800);
 assert.match(await page.locator('[data-home-words]').innerText(),/Open Words/);

 // ---- a deep link opens that recording ----
 const second=await browser.newPage({viewport:{width:1440,height:900}});watch(second);
 await second.goto(demo.url+'?reviewActor=human:adrian#words/check/'+demo.second,{waitUntil:'load'});
 await second.waitForSelector('#words-library[open] .wl-card[open]',{timeout:15000});
 assert.match(await second.locator('#words-library .wl-card[open]').first().innerText(),/Yixing studio visit/);
 await second.close();

 // ---- an agent reads and never answers ----
 const agent=await browser.newPage({viewport:{width:1440,height:900}});watch(agent);
 await agent.goto(demo.url+'?reviewActor=agent:claude-code#words',{waitUntil:'load'});
 await agent.waitForSelector('#words-library[open] .wl-card',{timeout:15000});
 assert.match(await agent.locator('#words-library .wl-msg').first().innerText(),/Confirming a spelling is Adrian's/);
 assert.equal(await agent.locator('#words-library [data-wl-keep]:not([disabled]),#words-library [data-wl-decide]:not([disabled]),#words-library .wl-bar [data-wl-add-open]:not([disabled])').count(),0,'no live answer button for an agent');
 await agent.close();

 // ---- phone ----
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 const phone=await ctx.newPage();watch(phone);
 await phone.goto(demo.url+'?reviewActor=human:adrian',{waitUntil:'load'});await phone.waitForSelector('[data-tr-home]',{state:'attached',timeout:15000});await phone.waitForTimeout(1200);
 await phone.evaluate(()=>window.projectLibrary?.open?.());
 await phone.waitForSelector('[data-home-words] .wl-open',{timeout:10000});
 await shot(phone,'words-home-phone.png');
 await phone.evaluate(()=>window.wordsLibrary.open());
 await phone.waitForSelector('#words-library[open] .wl-card',{timeout:8000});await phone.waitForTimeout(600);
 const wide=await phone.evaluate(()=>{const d=document.querySelector('#words-library .wl-scroll');return d.scrollWidth-d.clientWidth;});
 assert.ok(wide<=1,'no sideways scroll on the phone ('+wide+'px)');
 const small=await phone.$$eval('#words-library button:not([hidden])',els=>els.filter(b=>b.getBoundingClientRect().height>0&&b.getBoundingClientRect().height<43.5).map(b=>b.textContent.trim().slice(0,30)));
 assert.deepEqual(small,[],'every tap target is at least 44px: '+small);
 await shot(phone,'words-phone-top.png');
 await phone.evaluate(()=>document.querySelector('#words-library .wl-scroll').scrollTo(0,99999));await phone.waitForTimeout(300);
 await shot(phone,'words-phone-list.png');
 await ctx.close();

 // ---- first use: an empty library says what to do next, and seeds from one tap ----
 const empty=await startWordsDemo({port:0,seed:false});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}});watch(p);
  await p.goto(empty.url+'?reviewActor=human:adrian#words',{waitUntil:'load'});
  await p.waitForSelector('#words-library[open] .wl-empty',{timeout:15000});
  const text=await p.locator('#words-library').innerText();
  assert.match(text,/The library has no words yet\./);assert.match(text,/Nothing to check\./);
  assert.equal(await p.locator('#words-library [data-wl-import]').count(),2);
  await shot(p,'words-empty-desktop.png');
  await p.close();
 }finally{await empty.close();}
 assert.deepEqual(errors,[],'no page errors: '+errors.join(' | '));
 console.log('words.browser: ok');
}finally{await browser.close();await demo.close();}
