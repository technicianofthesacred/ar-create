// Browser half of the shell gate (review A12): the facts jsdom cannot measure. Not part of `npm test` (no browser is a
// dependency of this repo). Run it against a synthetic demo (`npm run demo`), never the installed app on 8841:
//   AR_CREATE_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs AR_CREATE_GATE_URL=http://127.0.0.1:8854/document-study/index.html node tests/ui-gate.browser.mjs
// At 1440×900 and 390×844, for each of the twelve steps: ≤3 persistent regions plus the bar, exactly one primary,
// the step reachable (phone: through the sidebar sheet), no horizontal overflow and no "Something went wrong".
const url=process.env.AR_CREATE_GATE_URL||'http://127.0.0.1:8854/document-study/index.html';
if(/:8841\b/.test(url))throw Error('The gate runs against a synthetic demo, never the installed app on 8841.');
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const REGIONS={sidebar:'nav.workflowNavigation.c3-rail',bar:'#c3-surface-bar',inspector:'#c3-read-insp,.desk>#c3-insp-head',removed:'#c3-path,#c3-queue,#c3-crumb,#work-context'};
const failures=[];
const browser=await chromium.launch();
for(const [w,h,size] of [[1440,900,'desktop'],[390,844,'phone']]){
 const page=await browser.newPage({viewport:{width:w,height:h}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:'networkidle'});await page.waitForTimeout(1200);
 for(let n=1;n<=12;n++){
  const step=page.locator('nav.workflowNavigation .workflowStep').nth(n-1);
  if(!(await step.isVisible()))await page.locator('.cr-picker').click();
  await step.click({timeout:5000}).catch(e=>failures.push(`${size} step ${n}: not reachable (${String(e).split('\n')[0]})`));
  await page.waitForTimeout(700);
  const m=await page.evaluate(R=>{
   const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>2&&r.height>2&&cs.display!=='none'&&cs.visibility!=='hidden'&&r.right>0&&r.left<innerWidth;};
   const on=s=>[...document.querySelectorAll(s)].some(vis);
   return {sidebar:on(R.sidebar),bar:on(R.bar),inspector:on(R.inspector),removed:on(R.removed),primaries:[...document.querySelectorAll('.sb-primary')].filter(vis).length,overflow:document.documentElement.scrollWidth>innerWidth+2,broken:/Something went wrong/.test(document.body.innerText)};
  },REGIONS);
  const regions=[m.sidebar,true,m.inspector].filter(Boolean).length;
  if(regions>3)failures.push(`${size} step ${n}: ${regions} persistent regions`);
  if(!m.bar)failures.push(`${size} step ${n}: no bar`);
  if(m.removed)failures.push(`${size} step ${n}: a removed bar is back`);
  if(m.primaries!==1)failures.push(`${size} step ${n}: ${m.primaries} primary actions`);
  if(m.overflow)failures.push(`${size} step ${n}: horizontal overflow`);
  if(m.broken)failures.push(`${size} step ${n}: "Something went wrong"`);
 }
 if(errors.length)failures.push(`${size}: ${errors.length} page errors, first: ${errors[0].slice(0,160)}`);
 await page.close();
}
await browser.close();
if(failures.length){console.error('UI gate failed:\n'+failures.join('\n'));process.exitCode=1;}else console.log('UI gate passed: 12 steps × 2 sizes.');
