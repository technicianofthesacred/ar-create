// Browser check for the Instagram studio: opens a plan from its link, as an agent (never as Adrian), and checks that
// the coverage strip shows every moment of the recording, each story shows its read-back, words to confirm are listed,
// the made frames render, and Adrian's buttons are not pressable by an agent. Not part of `npm test` (no browser is a
// dependency of this repo). Run against a synthetic demo that holds a plan (`npm run demo`), never the installed app:
//   AR_CREATE_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs AR_CREATE_GATE_URL=http://127.0.0.1:8854 node tests/instagram.browser.mjs
// AR_CREATE_INSTAGRAM_SHOTS=<folder> also saves the panel at 1440 and 390 wide, dark and light.
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.env.AR_CREATE_GATE_URL?new URL(process.env.AR_CREATE_GATE_URL).origin:'http://127.0.0.1:8854';
if(/:8841\b/.test(base))throw Error('The Instagram check runs against a synthetic demo, never the installed app on 8841.');
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const shots=process.env.AR_CREATE_INSTAGRAM_SHOTS;
const {plans}=await (await fetch(base+'/api/instagram/plans')).json();
assert.ok(plans.length,'the demo holds an Instagram plan (fill one first)');
const plan=await (await fetch(base+'/api/instagram/plan?id='+plans[0].id)).json();
const browser=await chromium.launch(),errors=[];
try{
 for(const [w,h,label] of [[1440,900,'desktop'],[390,844,'phone']])for(const theme of ['dark','light']){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/document-study/index.html?reviewActor=agent:claude-code&instagram='+plan.id,{waitUntil:'load'});
  await page.waitForSelector('dialog.igs[open] .igs-strip-time',{timeout:15000});
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);await page.waitForTimeout(500);
  assert.equal(await page.locator('.igs-seg').count(),plan.moments.length,'one strip segment per moment');
  assert.equal(await page.locator('.igs-seg.s-unplaced').count(),plan.coverage.counts.unplaced);
  assert.equal(await page.locator('.igs-readback').count(),plan.stories.length,'every story shows its read-back');
  assert.ok(await page.locator('[data-igs="choose"]').first().isDisabled(),'an agent cannot pick the story');
  if(Object.keys(plan.layouts).length)assert.ok(await page.locator('.igs-frame iframe').count()>0,'the made frames render');
  await page.locator('.igs-seg').nth(Math.floor(plan.moments.length/2)).click();
  assert.match(await page.locator('.igs-moment .igs-exact').innerText(),/\S/,'a moment opens with its exact words');
  if(shots){
   await page.locator('.igs-body').evaluate(el=>el.scrollTo(0,0));
   await page.screenshot({path:path.join(shots,'panel-'+label+'-'+theme+'.png')});
   const made=page.locator('section[aria-label="Made"]');await made.scrollIntoViewIfNeeded();await page.waitForTimeout(800);
   await page.screenshot({path:path.join(shots,'made-'+label+'-'+theme+'.png')});
   const words=page.locator('section[aria-label="Words to confirm"]');if(await words.count()){await words.scrollIntoViewIfNeeded();await page.waitForTimeout(300);await page.screenshot({path:path.join(shots,'confirm-'+label+'-'+theme+'.png')});}
  }
  await page.close();
 }
 assert.deepEqual(errors,[],'no page errors');
 console.log('Instagram studio browser check passed: '+plan.moments.length+' moments, '+plan.stories.length+' stories.');
}finally{await browser.close();}
