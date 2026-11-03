// Browser check for Simmer: reachable from Home, drag a block to reorder (the others make room and the order saves),
// click a block to edit it (the words save), and his exact words open read-only. Not part of `npm test` (no browser
// is a dependency of this repo). Run it against a synthetic demo (`npm run demo`), never the installed app on 8841:
//   AR_CREATE_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node tests/simmer.browser.mjs
// AR_CREATE_SIMMER_SHOTS=<folder> also saves the board at 1440 and 390 wide, dark and light, filled and empty.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fillSimmerDemo} from './helpers/simmer-demo.mjs';
const base=process.env.AR_CREATE_GATE_URL?new URL(process.env.AR_CREATE_GATE_URL).origin:'http://127.0.0.1:8854',url=base+'/document-study/index.html?reviewActor=human:adrian';
if(/:8841\b/.test(base))throw Error('The Simmer check runs against a synthetic demo, never the installed app on 8841.');
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const shots=process.env.AR_CREATE_SIMMER_SHOTS;let SUBJECT='';
const board=async()=>(await fetch(base+'/api/simmer/board?subject='+encodeURIComponent(SUBJECT))).json();
const order=async(page,group)=>page.$$eval(`.sm-frame[data-id="${group}"] .sm-inner>.sm-blk`,els=>els.map(e=>e.dataset.id));
const settled=page=>page.waitForFunction(()=>/Saved/.test(document.querySelector('.sm-save')?.textContent||''),null,{timeout:8000});
const browser=await chromium.launch(),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:'load'});await page.waitForSelector('[data-tr-home]',{state:'attached',timeout:15000});await page.waitForTimeout(1500);
 // Home → the subject's Simmer button.
 if(!await page.locator('[data-simmer-open]').first().isVisible())await page.getByRole('button',{name:'Home',exact:true}).first().click();
 await page.locator('[data-simmer-open]').first().waitFor({timeout:8000});
 // Fill the subject this Home button opens with invented material, then open it.
 SUBJECT=await page.locator('[data-simmer-open]').first().getAttribute('data-simmer-open');await fillSimmerDemo(base,SUBJECT);
 await page.locator('[data-simmer-open]').first().click();
 await page.waitForSelector('dialog.simmer[open] .sm-blk[data-id="b-p1"]',{timeout:8000});await page.waitForTimeout(600);

 // Drag the first block past the third: the others make room, and the new order saves.
 const before=await order(page,'g-marks');assert.equal(before[0],'b-p1');
 const from=await page.locator('.sm-blk[data-id="b-p1"]').boundingBox(),to=await page.locator('.sm-blk[data-id="b-age"]').boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+30);await page.mouse.down();
 await page.mouse.move(from.x+from.width/2+12,from.y+40,{steps:4});
 assert.equal(await page.locator('.sm-frame[data-id="g-marks"] .sm-slot').count(),1,'a slot opens where the block can land');
 await page.mouse.move(to.x+to.width-6,to.y+to.height/2,{steps:12});await page.waitForTimeout(300);await page.mouse.up();
 const after=await order(page,'g-marks');
 assert.notEqual(after[0],'b-p1','the dragged block left the front');assert.ok(after.indexOf('b-p1')>after.indexOf('b-age'),'it landed after the note: '+after.join(','));
 assert.deepEqual([...after].sort(),[...before].sort(),'nothing was lost or duplicated');
 await settled(page);assert.deepEqual((await board()).groups.find(g=>g.id==='g-marks').blocks.map(b=>b.id),after,'the saved order matches the screen');

 // Click a note to open it, change the words, Done: the block shows them and they save.
 await page.locator('.sm-blk[data-id="b-age"]').click();
 const field=page.locator('.sm-editor:not([hidden]) [data-bind="text"]');await field.waitFor({timeout:3000});
 await field.click();await page.keyboard.press('End');await page.keyboard.type(' Every one of them.');
 await page.locator('.sm-editor [data-act="close"].sm-primary').click();
 await page.waitForFunction(()=>/Every one of them\./.test(document.querySelector('.sm-blk[data-id="b-age"]')?.textContent||''));
 await settled(page);assert.equal((await board()).groups.flatMap(g=>g.blocks).find(b=>b.id==='b-age').text,'I am getting older and I like my marks. Every one of them.');

 // His exact words open read-only; only his reading of them is editable.
 await page.locator('.sm-blk[data-id="b-marks"]').click();await page.locator('.sm-editor .sm-protected').waitFor({timeout:3000});
 assert.deepEqual(await page.$$eval('.sm-editor [contenteditable]',els=>els.map(e=>e.dataset.bind)),['reading']);
 await page.waitForTimeout(400);await page.keyboard.press('Escape');await page.waitForSelector('.sm-editor',{state:'hidden',timeout:5000});

 // Forming can be put away; the board keeps working.
 await page.locator('[data-sm="forming"]').click();assert.equal(await page.locator('.sm-forming').isVisible(),false);
 await page.locator('[data-sm="forming"]').click();assert.equal(await page.locator('.sm-forming').isVisible(),true);

 // Phone: a tap opens the block.
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
 await page.locator('.sm-blk[data-id="b-q"]').tap?.().catch(()=>{});if(await page.locator('.sm-editor').isHidden())await page.locator('.sm-blk[data-id="b-q"]').click();
 await page.locator('.sm-editor:not([hidden]) [data-bind="answer"]').waitFor({timeout:3000});await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'no sideways scroll on a phone');

 if(shots){
  for(const theme of ['dark','light'])for(const [w,h,size] of [[1440,900,'desktop'],[390,844,'phone']])for(const state of ['filled','empty']){
   await page.setViewportSize({width:w,height:h});await page.evaluate(([t,state,SUBJECT])=>{document.documentElement.dataset.theme=t;return window.arSimmer.open(state==='empty'?{subject:'simmer-empty-example',title:'A subject with nothing on it yet'}:{subject:SUBJECT,title:'Synthetic Project'});},[theme,state,SUBJECT]);
   await page.waitForTimeout(900);if(w>860&&state==='filled')await page.locator('[data-sm="fit"]').click();await page.waitForTimeout(500);
   await page.screenshot({path:path.join(shots,`simmer-${size}-${theme}-${state}.png`),fullPage:false});
  }
 }
}finally{await browser.close();}
assert.deepEqual(errors,[],'no page errors');
console.log('Simmer browser check passed: reachable from Home, drag to reorder, click to edit, protected words, Forming toggle, phone.');
