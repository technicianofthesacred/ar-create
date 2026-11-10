// Walk the seeded demo from the recording to an exported Carousel and photograph every step, at desktop and phone width.
// Start the demo first (npm run demo) and wait for "Demo seeded", then:
//   AR_CREATE_PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/demo-walk.mjs [outDir]
// The author's steps are the same requests the page makes (see demo-seed.mjs); the pictures are of the real screens.
// It acts as the demo's author on a disposable home. It never targets 8841.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {client,walkHarbour} from './demo-seed.mjs';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const base=process.env.AR_CREATE_URL||'http://127.0.0.1:8854';
if(/:8841\b/.test(base))throw Error('The demo walk never runs against the installed app on 8841.');
const outDir=process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),'ar-create-walk-'));fs.mkdirSync(outDir,{recursive:true});
const url=`${base}/document-study/index.html`;
const SIZES={desk:[1440,900],phone:[390,844]};
const PHONE={Library:'develop',Source:'develop',Research:'develop',Direction:'develop',Write:'make',Check:'make',Media:'make',Arrange:'make',Audience:'deliver',Share:'deliver',Outputs:'deliver'};
const api=client(base),title='Harbour Morning Walk';
const catalog=await api.author('GET','/api/study-draft/catalog'),found=catalog.collections.find(row=>row.title===title);
if(!found)throw Error('The seeded subject "'+title+'" is missing. Wait for the demo to finish seeding, or start a fresh demo.');
const subject={title,bindingId:found.bindingId,parentStudyId:found.parentStudyId};
const browser=await chromium.launch();const pages={};
for(const [size,[width,height]] of Object.entries(SIZES)){const context=await browser.newContext({viewport:{width,height},hasTouch:size==='phone',deviceScaleFactor:size==='phone'?2:1});pages[size]=await context.newPage();pages[size].setDefaultTimeout(8000);}
let counter=0;const shots=[],notes=[];
async function openScreen(size,name){
 const page=pages[size];await page.goto(url,{waitUntil:'load'});await page.waitForTimeout(2600);
 const home=size==='phone'?page.locator('.combined-phonebar [data-combined-nav="home"]').click():page.locator('.combined-rail button',{hasText:/^\s*Home\s*\d*$/}).first().click();await home;await page.waitForTimeout(700);
 await page.locator('button:visible',{hasText:title}).last().click();await page.waitForTimeout(1800);
 if(size==='phone'){if(!PHONE[name])throw Error('not reachable from the phone bar');await page.locator(`.combined-phonebar [data-combined-group="${PHONE[name]}"]`).click();await page.waitForTimeout(300);await page.locator('#combined-phone-sheet button',{hasText:new RegExp('^\\s*'+name)}).first().click();}
 else await page.locator('.combined-rail button',{hasText:new RegExp('^\\s*'+name+'\\s*\\d*$')}).first().click();
 await page.waitForTimeout(2200);
}
async function shot(label,screen,{after=null}={}){
 for(const size of Object.keys(SIZES)){
  try{await openScreen(size,screen);if(after)await after(pages[size],size);}catch(error){notes.push(`${label} (${size}): ${String(error.message).split('\n')[0]}`);continue;}
  const file=`${String(++counter).padStart(2,'0')}-${label}-${size}.png`;await pages[size].screenshot({path:path.join(outDir,file)});shots.push(file);}
}
// Steps before the author writes: the seeded recording, transcript, answer and direction.
await shot('recording-in-material','Material');
// The recording's own transcript page: every line with its speaker and time. (The Source screen lists imported conversations, which the demo does not hold.)
{const {jobs}=await api.author('GET','/api/recordings'),job=jobs.find(row=>/Harbour walk interview$/.test(row.story||row.file||'')||row.story==='Harbour walk interview');
 if(job)for(const size of Object.keys(SIZES)){await pages[size].goto(`${base}/transcription/${job.id}/view`,{waitUntil:'load'});await pages[size].waitForTimeout(1500);const file=`${String(++counter).padStart(2,'0')}-transcript-with-speakers-and-times-${size}.png`;await pages[size].screenshot({path:path.join(outDir,file)});shots.push(file);}
 else notes.push('transcript page: the Harbour recording was not found');}
await shot('source-screen','Source');
await shot('research-answer','Research');
await shot('direction','Direction');
const hooks={
 'proposal-waiting':()=>shot('write-proposal-waiting','Write'),
 'article-written':async()=>{await shot('write-proposal-accepted','Write');await shot('check-comparison','Check',{after:async page=>{await page.getByRole('button',{name:'Check saved draft'}).first().click({timeout:4000}).catch(()=>notes.push('Check saved draft was not found'));await page.waitForTimeout(2500);}});},
 'revision-rejected':()=>shot('write-proposal-rejected','Write'),
 'carousel-ready':async()=>{await shot('media-photographs','Media');await shot('arrange-photo-on-slide','Arrange',{after:async page=>{await page.locator('button.sb-in-t:visible',{hasText:/^\s*Carousel/}).first().click({timeout:4000}).catch(()=>notes.push('Arrange: no visible Carousel tab'));await page.waitForTimeout(2500);}});await shot('audience','Audience');},
 'share-held':()=>shot('share-held','Share'),
 'share-released':()=>shot('share-released','Share'),
 'exported':()=>shot('outputs-export','Outputs'),
};
await walkHarbour(api,subject,{at:async(name)=>{if(hooks[name])await hooks[name]();}});
await browser.close();
fs.writeFileSync(path.join(outDir,'walk.json'),JSON.stringify({shots,notes},null,1));
console.log('Photographed '+shots.length+' screens in '+outDir+(notes.length?'\nNot reached:\n  '+notes.join('\n  '):''));
