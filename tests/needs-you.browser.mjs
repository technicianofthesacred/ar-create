// Browser check for the "Needs you" list on Home: Only you and You steer asks, one tap to answer (recorded as
// human:adrian from this page), "applied by default, change it", a link to a human-only screen, read-only when opened
// as an agent, an empty state, and a phone with no sideways scroll and 44px taps. Not part of `npm test` (no browser is a
// dependency of this repo). Run it against a synthetic demo (`npm run demo`, or AR_CREATE_PORT=8855 npm run demo), never the
// installed app on 8841:
//   AR_CREATE_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs AR_CREATE_GATE_URL=http://127.0.0.1:8854 node tests/needs-you.browser.mjs
// AR_CREATE_NEEDS_SHOTS=<folder> also saves the list at 1440 and 390 wide.
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.env.AR_CREATE_GATE_URL?new URL(process.env.AR_CREATE_GATE_URL).origin:'http://127.0.0.1:8854',url=base+'/document-study/index.html?reviewActor=human:adrian';
if(/:8841\b/.test(base))throw Error('The needs-you check runs against a synthetic demo, never the installed app on 8841.');
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const shots=process.env.AR_CREATE_NEEDS_SHOTS,HOUR=3600e3;
const agent={'Content-Type':'application/json','X-AR-Actor':'agent:claude-code','X-AR-Client':'cli'};
const raise=async body=>{const r=await fetch(base+'/api/needs-you/raise',{method:'POST',headers:agent,body:JSON.stringify({operationId:crypto.randomUUID(),...body})});assert.equal(r.status,200,await r.clone().text());return r.json();};
const list=async(status='all')=>(await fetch(base+'/api/needs-you?status='+status)).json();
const when=ms=>new Date(Date.now()+ms).toISOString();

// Invented asks, one of each kind.
const dish=await raise({band:'only-adrian',about:'Wood-Fired Potter',question:'What would you call this dish, in a sentence?'});
const feeling=await raise({band:'only-adrian',about:'Tea Teacher story',question:'The paragraph about the first visit says "she laughed". Was that how it felt to you, or did it come from the transcript?',choices:['True for me','Borrowed','Cut it']});
const send=await raise({band:'only-adrian',about:'Tea Teacher story',question:'Ready to send the Tea Teacher story to the printer?',link:{label:'Open Share',href:'/document-study/index.html?reviewMagazineStory=tea-teacher&reviewMagazinePiece=a&reviewMagazineParent=hk&reviewStage=11'}});
const group=await raise({band:'steer',about:'Yixing',question:'Which group does the bowl photo belong in?',choices:['Marks','Repair','Hands'],default:'Repair',applyAt:when(5*HOUR)});
await raise({band:'steer',about:'An Cha',question:'Title for the carousel: lead with the place or with the cup?',choices:['The place','The cup'],default:'The cup',applyAt:when(26*HOUR)});
const soon=await raise({band:'steer',about:'Lu Zhaokai',question:'Link the interview to the Yixing collection?',choices:['Link it','Leave it'],default:'Link it',applyAt:when(20000)});

const browser=await chromium.launch(),errors=[];
const openHome=async page=>{
 await page.goto(url,{waitUntil:'load'});await page.waitForSelector('[data-tr-home]',{state:'attached',timeout:15000});await page.waitForTimeout(1200);
 if(!await page.locator('.ny-band').isVisible().catch(()=>false))await page.getByRole('button',{name:'Home',exact:true}).first().click({timeout:5000}).catch(()=>page.evaluate(()=>window.projectLibrary?.open?.()));
 await page.waitForSelector('.ny-band .ny-ask',{timeout:10000});
};
// {tall} grows the window so a whole list fits in one picture (the list scrolls inside the app, so a clip would cut it).
const shot=async(page,name,{tall=0}={})=>{if(!shots)return;const was=page.viewportSize();if(tall)await page.setViewportSize({width:was.width,height:tall});await page.waitForTimeout(400);await page.screenshot({path:path.join(shots,name)});if(tall)await page.setViewportSize(was);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(String(e)));
 await openHome(page);

 // The list: Only you first, then You steer by time; steer rows say what applies and when, Only you rows say nothing applies.
 const tags=await page.$$eval('.ny-ask .ny-tag',els=>els.map(e=>e.textContent));
 assert.deepEqual(tags.slice(0,3),['Only you','Only you','Only you'],'Only you comes first: '+tags);
 assert.match(await page.locator(`[data-ny-ask="${group.id}"] .ny-foot`).innerText(),/If you do not answer, Repair applies .* \(in 5 h\)/);
 assert.match(await page.locator(`[data-ny-ask="${feeling.id}"] .ny-foot`).innerText(),/Nothing applies on its own/);
 assert.equal(await page.locator(`[data-ny-ask="${feeling.id}"] .ny-choice.is-default`).count(),0,'an Only you ask has no default');
 assert.equal(await page.locator('.ny-band').evaluate(b=>/—/.test(b.innerText)),false,'no em dashes');
 await shot(page,'needs-you-desktop.png');
 // Four rows show; the rest sit behind one button.
 assert.equal(await page.locator('.ny-ask').count(),4);
 await page.locator('[data-ny-all]').click();assert.equal(await page.locator('.ny-ask').count(),6);
 await shot(page,'needs-you-desktop-all.png',{tall:1500});

 // Link to a human-only screen: a real link into the app, and a Done tap that only says it is done.
 const link=page.locator(`[data-ny-ask="${send.id}"] a.ny-open`);assert.match(await link.getAttribute('href'),/^\/document-study\/index\.html\?reviewMagazineStory=tea-teacher/);
 assert.equal(await page.locator(`[data-ny-ask="${send.id}"] .ny-foot`).innerText(),'This is done on its own screen. Tap Done afterwards to take it off the list.');

 // One tap on the default: recorded as human:adrian from the page, and the row leaves the waiting list.
 await page.locator(`[data-ny-ask="${group.id}"] [data-ny-choice="Repair"]`).click();
 await page.waitForSelector(`.ny-done-row[data-ny-ask="${group.id}"]`,{state:'attached',timeout:5000}).catch(()=>{});
 const saved=(await list()).asks.find(a=>a.id===group.id);
 assert.deepEqual([saved.status,saved.resolution.choice,saved.resolution.by,saved.resolution.client],['answered','Repair','human:adrian','ui']);
 // A written answer.
 await page.locator(`[data-ny-ask="${dish.id}"] textarea`).fill('Pasta, with this flair');await page.locator(`[data-ny-ask="${dish.id}"] button[type=submit]`).click();
 await page.waitForFunction(id=>!document.querySelector(`.ny-ask[data-ny-ask="${id}"]`),dish.id,{timeout:5000});
 assert.equal((await list()).asks.find(a=>a.id===dish.id).resolution.text,'Pasta, with this flair');
 // Done on a linked step.
 await page.locator(`[data-ny-ask="${send.id}"] [data-ny-choice="Done"]`).click();
 await page.waitForFunction(id=>!document.querySelector(`.ny-ask[data-ny-ask="${id}"]`),send.id,{timeout:5000});

 // A default applies on its own and shows as "applied by default", with Change it.
 await page.waitForTimeout(Math.max(0,Date.parse(soon.applyAt)-Date.now())+800);
 await page.evaluate(()=>window.needsYou.load());
 const applied=page.locator(`[data-ny-ask="${soon.id}"]`);await applied.waitFor({timeout:5000});
 assert.match(await applied.innerText(),/Applied by default[\s\S]*Link it was applied by default[\s\S]*Keep Link it[\s\S]*Change it/);
 await shot(page,'needs-you-desktop-applied.png');
 await applied.locator('[data-ny-change]').click();
 await applied.locator('[data-ny-choice="Leave it"]').click();
 await page.waitForFunction(id=>!document.querySelector(`.ny-ask[data-ny-ask="${id}"]`),soon.id,{timeout:5000});
 const changed=(await list()).asks.find(a=>a.id===soon.id);
 assert.deepEqual([changed.status,changed.resolution.choice,changed.resolution.by,changed.earlier],['answered','Leave it','human:adrian',1],'the default stays in the record');

 // Opened as an agent, the list reads but never answers.
 const agentPage=await browser.newPage({viewport:{width:1440,height:900}});agentPage.on('pageerror',e=>errors.push(String(e)));
 await agentPage.goto(base+'/document-study/index.html?reviewActor=agent:claude-code',{waitUntil:'load'});await agentPage.waitForSelector('[data-tr-home]',{state:'attached',timeout:15000});await agentPage.waitForTimeout(1200);
 await agentPage.getByRole('button',{name:'Home',exact:true}).first().click({timeout:5000}).catch(()=>agentPage.evaluate(()=>window.projectLibrary?.open?.()));
 await agentPage.waitForSelector('.ny-band .ny-ask',{timeout:10000});
 assert.match(await agentPage.locator('.ny-band .ny-msg').first().innerText(),/Answers are Adrian's/);
 assert.equal(await agentPage.locator('.ny-band .ny-choice:not([disabled])').count(),0,'no answer button is live for an agent');
 await agentPage.close();

 // Phone: one column, no sideways scroll, 44px taps.
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 await page.evaluate(()=>window.needsYou.load());await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2||document.querySelector('.ny-band').scrollWidth>document.querySelector('.ny-band').clientWidth+2),false,'no sideways scroll on a phone');
 const small=await page.$$eval('.ny-band .ny-choice,.ny-band .ny-open,.ny-band .ny-more',els=>els.filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.textContent));
 assert.deepEqual(small,[],'every tap target is at least 44px tall on a phone');

 // Everything answered: an empty state that says what happens next, not a blank.
 for(const a of (await list('open')).asks)await fetch(base+'/api/needs-you/answer',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian','X-AR-Client':'ui'},body:JSON.stringify({operationId:crypto.randomUUID(),id:a.id,...(a.choices.length?{choice:a.choices[0]}:{text:'Noted'})})});
 await page.evaluate(()=>window.needsYou.load());await page.waitForSelector('.ny-empty',{timeout:5000});
 assert.match(await page.locator('.ny-empty').innerText(),/Nothing needs you right now\.[\s\S]*lands here/);

 if(shots){
  // Refill for the phone pictures: the same kinds, with one default already applied.
  await raise({band:'only-adrian',about:'Wood-Fired Potter',question:'What would you call this dish, in a sentence?'});
  await raise({band:'only-adrian',about:'Tea Teacher story',question:'The paragraph about the first visit says "she laughed". Was that how it felt to you, or did it come from the transcript?',choices:['True for me','Borrowed','Cut it']});
  await raise({band:'only-adrian',about:'Tea Teacher story',question:'Ready to send the Tea Teacher story to the printer?',link:{label:'Open Share',href:'/document-study/index.html?reviewMagazineStory=tea-teacher&reviewMagazinePiece=a&reviewMagazineParent=hk&reviewStage=11'}});
  await raise({band:'steer',about:'Yixing',question:'Which group does the bowl photo belong in?',choices:['Marks','Repair','Hands'],default:'Repair',applyAt:when(5*HOUR)});
  await raise({band:'steer',about:'An Cha',question:'Title for the carousel: lead with the place or with the cup?',choices:['The place','The cup'],default:'The cup',applyAt:when(26*HOUR)});
  await raise({band:'steer',about:'Lu Zhaokai',question:'Link the interview to the Yixing collection?',choices:['Link it','Leave it'],default:'Link it',applyAt:when(1200)});
  await page.waitForTimeout(1800);
  await page.evaluate(()=>window.needsYou.load());await page.waitForSelector('.ny-ask',{timeout:5000});await page.waitForTimeout(500);
  await shot(page,'needs-you-phone.png');
  if(await page.locator('[data-ny-all][aria-expanded="false"]').count())await page.locator('[data-ny-all]').click();
  await shot(page,'needs-you-phone-all.png',{tall:2300});
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  await shot(page,'needs-you-phone-light.png',{tall:2300});
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(500);
  await shot(page,'needs-you-desktop-light.png');
 }
}finally{await browser.close();}
assert.deepEqual(errors,[],'no page errors');
console.log('Needs-you browser check passed: list order, one-tap answers as human:adrian, applied by default and Change it, link to a human-only screen, read-only as an agent, empty state, phone.');
