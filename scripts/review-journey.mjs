// Step through the demo by hand, one command at a time, keeping the browser profile between runs.
// Start the demo first (npm run demo), then:
//   AR_CREATE_PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/review-journey.mjs <name> <width> '<steps>'
// <steps> is JavaScript run with: page, rail(name), press(buttonName, index), wait(ms), state().
// Example: node scripts/review-journey.mjs new-subject 1440 "await rail('Home');await press('New subject');"
// After the steps it prints what is on screen (subject, lit sidebar item, headings, buttons, fields, messages,
// failed requests) and saves <name>.png. AR_CREATE_ACTOR sets ?reviewActor=; leave it unset only on the demo,
// where walking as the author is the way to test saving. It never targets 8841.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const base=process.env.AR_CREATE_URL||'http://127.0.0.1:8854';
if(/:8841\b/.test(base))throw Error('The review journey never runs against the installed app on 8841.');
const [name='step',widthArg='1440',steps='']=process.argv.slice(2),width=+widthArg||1440;
const work=process.env.AR_CREATE_REVIEW_DIR||path.join(os.tmpdir(),'ar-create-review-journey');
const profile=path.join(work,'profile-'+(process.env.AR_CREATE_REVIEW_PROFILE||'author'));fs.mkdirSync(work,{recursive:true});
const context=await chromium.launchPersistentContext(profile,{viewport:{width,height:width<800?844:900},hasTouch:width<800});
const page=context.pages()[0]||await context.newPage(),failed=new Set();
page.on('response',r=>{if(r.status()>=400)failed.add(r.status()+' '+r.request().method()+' '+r.url().replace(base,'').slice(0,90));});
page.on('pageerror',e=>failed.add('script error: '+e.message.slice(0,120)));
page.on('dialog',async dialog=>{failed.add('dialog: '+dialog.message().slice(0,160));await dialog.accept().catch(()=>{});});
const actor=process.env.AR_CREATE_ACTOR;
await page.goto(`${base}/document-study/index.html${actor?'?reviewActor='+encodeURIComponent(actor):''}`,{waitUntil:'load'});await page.waitForTimeout(2800);
const rail=label=>page.locator('.combined-rail button',{hasText:new RegExp('^\\s*'+label+'\\s*\\d*$')}).first().click({timeout:5000});
const press=(label,index=0)=>page.getByRole('button',{name:label,exact:true}).nth(index).click({timeout:5000});
const wait=ms=>page.waitForTimeout(ms);
const state=()=>page.evaluate(()=>{
  const seen=element=>{const r=element.getBoundingClientRect();if(r.width<=0||r.height<=0||r.bottom<0||r.top>innerHeight)return false;const style=getComputedStyle(element);if(style.visibility==='hidden'||+style.opacity===0)return false;const top=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),Math.min(innerHeight-1,Math.max(0,r.top+Math.min(r.height/2,10))));return !!top&&(top===element||element.contains(top)||top.contains(element));};
  const text=element=>(element.getAttribute('aria-label')||element.textContent||element.value||element.placeholder||'').replace(/\s+/g,' ').trim().slice(0,38);
  const inPage=element=>!element.closest('.combined-rail,#c3-tabstrip,.combined-phonebar');
  return {
    subject:(document.querySelector('.ht-switch-label')||{}).textContent,
    lit:[...document.querySelectorAll('.combined-rail [aria-current],.combined-phonebar [aria-current],.combined-rail .on')].map(text).join(','),
    headings:[...document.querySelectorAll('h1,h2,h3,[role=heading]')].filter(seen).filter(inPage).map(text).slice(0,14),
    buttons:[...document.querySelectorAll('button,a[href],summary,[role=tab]')].filter(seen).filter(inPage).map(element=>text(element)+(element.disabled?' (off)':'')).slice(0,45),
    fields:[...document.querySelectorAll('input,textarea,select,[contenteditable=true]')].filter(seen).filter(inPage).map(element=>element.tagName.toLowerCase()+':'+text(element)).slice(0,14),
    messages:[...document.querySelectorAll('[role=status],[aria-live],[role=alert]')].filter(seen).map(text).filter(Boolean).slice(0,8),
  };
});
try{await (new Function('page','rail','press','wait','state',`return (async()=>{${steps}})()`))(page,rail,press,wait,state);}
catch(error){console.log('Step failed: '+String(error.message).split('\n')[0].slice(0,200));}
await page.waitForTimeout(1200);
console.log(JSON.stringify(await state(),null,1));
if(failed.size)console.log('Failed requests: '+[...failed].slice(0,12).join(' ; '));
await page.screenshot({path:path.join(work,name+'.png')});console.log('Screenshot: '+path.join(work,name+'.png'));
await context.close();
