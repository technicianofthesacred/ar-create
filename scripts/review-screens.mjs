// Screenshot survey of the demo: every sidebar destination at desktop, 1000px and phone width, in dark and light.
// Start the demo first (npm run demo), then:
//   AR_CREATE_PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/review-screens.mjs [outDir] [sizes] [themes]
// Example: node scripts/review-screens.mjs /tmp/ar-screens desk,phone dark
// It only reads and clicks the demo (port 8854 by default). It never targets 8841.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const base=process.env.AR_CREATE_URL||'http://127.0.0.1:8854';
if(/:8841\b/.test(base))throw Error('The review walk never runs against the installed app on 8841.');
const actor=process.env.AR_CREATE_ACTOR||'agent:claude-code';
const url=`${base}/document-study/index.html?reviewActor=${encodeURIComponent(actor)}`;
const outDir=process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),'ar-create-screens-'));
const SIZES={desk:[1440,900],mid:[1000,800],phone:[390,844]};
const sizes=(process.argv[3]||'desk,mid,phone').split(',').filter(k=>SIZES[k]);
const themes=(process.argv[4]||'dark,light').split(',');
const DEST=['Home','Library','Material','Source','Research','Direction','Write','Check','Media','Arrange','Audience','Share','Outputs'];
// Phone groups as the bottom bar files them today. Material has no phone entry; that is a recorded finding.
const PHONE={Library:'develop',Source:'develop',Research:'develop',Direction:'develop',Write:'make',Check:'make',Media:'make',Arrange:'make',Audience:'deliver',Share:'deliver',Outputs:'deliver'};
fs.mkdirSync(outDir,{recursive:true});
const report={};const browser=await chromium.launch();
for(const size of sizes)for(const theme of themes){
  const [width,height]=SIZES[size],phone=size==='phone',key=`${size}-${theme}`;report[key]={};
  const context=await browser.newContext({viewport:{width,height},hasTouch:phone});const page=await context.newPage();
  const failed=new Set();page.on('pageerror',e=>failed.add('script error: '+e.message));page.on('response',r=>{if(r.status()>=400)failed.add(r.status()+' '+r.url().replace(base,''));});
  await page.goto(url,{waitUntil:'load'});await page.waitForTimeout(3000);
  if(await page.evaluate(()=>document.documentElement.dataset.theme)!==theme){await page.getByRole('button',{name:/Switch to (light|dark) theme/}).first().click();await page.waitForTimeout(400);}
  const open=async name=>{
    if(!phone)return page.locator('.combined-rail button',{hasText:new RegExp('^\\s*'+name+'\\s*\\d*$')}).first().click({timeout:4000});
    if(name==='Home')return page.locator('.combined-phonebar [data-combined-nav="home"]').click();
    if(!PHONE[name])throw Error('not reachable from the phone bar');
    await page.locator(`.combined-phonebar [data-combined-group="${PHONE[name]}"]`).click();await page.waitForTimeout(300);
    return page.locator('#combined-phone-sheet button',{hasText:new RegExp('^\\s*'+name)}).first().click();
  };
  for(const name of DEST){
    try{await open(name);}catch(error){report[key][name]={unreachable:String(error.message).split('\n')[0]};continue;}
    await page.waitForTimeout(1400);
    report[key][name]=await page.evaluate(()=>{
      const view=document.documentElement.clientWidth,clipped=[];
      for(const element of document.querySelectorAll('body *')){
        if(element.children.length||!element.textContent.trim())continue;
        const r=element.getBoundingClientRect(),style=getComputedStyle(element);
        if(r.width<=0||r.height<=0||style.visibility==='hidden'||+style.opacity===0)continue;
        if(r.right>view+2&&r.left<view)clipped.push(element.textContent.trim().slice(0,40));
      }
      return {sidewaysScroll:document.documentElement.scrollWidth>view,clippedText:clipped.slice(0,8)};
    });
    await page.screenshot({path:path.join(outDir,`${key}-${name.toLowerCase()}.png`)});
  }
  report[key].failedRequests=[...failed].slice(0,30);
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,1));
console.log('Screens and report.json written to '+outDir);
