// Version two's "Advanced" hand-off lands where it says. Opens the existing workspace at
// /document-study/index.html?subject=<id>&section=<id>[&piece=<output id>] for every section id, with and without a
// piece, and checks where it lands by the workspace's own marks: the subject open, the section the rail marks as
// current, the piece chosen, and Read or Write for the writer. Exit code 1 when any lands elsewhere.
// Start the demo and fill it first (npm run demo; npm run demo:fill), then:
//   AR_CREATE_URL=http://127.0.0.1:8854 AR_CREATE_PLAYWRIGHT=/opt/node-tools/node_modules/playwright/index.mjs node scripts/review-advanced-addresses.mjs [--only=write,read]
// It only reads and clicks the demo; it never targets 8841.
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const base=process.env.AR_CREATE_URL||'http://127.0.0.1:8854';
if(/:8841\b/.test(base))throw Error('This check never runs against the installed app on 8841.');
const SECTIONS=['home','subjects','library','material','source','research','direction','write','read','check','media','arrange','audience','share','outputs'];
const only=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean);
const actor='agent:claude-code';
const browser=await chromium.launch(),problems=[];let checked=0;
// Pieces of the demo, read through the workspace's own output reader: the first Article and the first Carousel.
// (The demo has no Carousel until one is made: open Outputs on a subject that has an Article and press Create on Carousel.)
const cases=[];
{const page=await browser.newPage();await page.goto(`${base}/document-study/index.html?reviewActor=${actor}`,{waitUntil:'load'});
 await page.waitForFunction(()=>window.realOutputOverview?.read&&typeof state!=='undefined'&&state.projects?.length,null,{timeout:30000});
 const found=await page.evaluate(async()=>{const r={};for(const p of state.projects){let d;try{d=await window.realOutputOverview.read({projectId:p.id});}catch{continue;}for(const o of d.outputs||[])if(!r[o.format])r[o.format]={subject:p.id,piece:o.id,format:o.format};}return r;});
 await page.close();
 for(const f of ['Article','Carousel']){if(!found[f]){problems.push('The demo has no '+f+' piece.');console.log('WRONG no '+f+' piece in the demo');}else cases.push(found[f]);}}
// Where each section id should land: the rail's own key for it.
const railKey=s=>s==='read'?'write':s==='subjects'?'home':s;
async function land(query){
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto(`${base}/document-study/index.html?${query}`,{waitUntil:'load'});
 // Settled: the address keys are taken out when the hand-off has finished.
 await page.waitForFunction(()=>!new URLSearchParams(location.search).has('section'),null,{timeout:30000}).catch(()=>{});
 await page.waitForTimeout(1500);
 await page.waitForFunction(()=>!!document.querySelector('.combined-rail [data-combined-nav][aria-current]')&&Number.isFinite(Number(current?.().viewedStage)),null,{timeout:8000}).catch(()=>{});
 const at=await page.evaluate(()=>({subject:typeof current==='function'?current().id:null,rail:document.querySelector('.combined-rail [data-combined-nav][aria-current]')?.dataset.combinedNav||null,
  mode:window.studyDraft?.viewMode?.()||null,stage:typeof current==='function'?Number(current().viewedStage):null,
  piece:window.studyOutputConnection?.selection?.()?.output?.id||null,subjectsOpen:!!window.combinedSubjects?.isOpen?.(),checkBeside:document.getElementById('wbf-drawer')?.dataset.tool==='check',home:!!document.getElementById('project-library')?.open,
  writing:document.querySelector('#study-output-canvas .car-writing-page')?.dataset.writingView||null,canvas:!!document.querySelector('#study-output-canvas .car-stage'),
  search:location.search}));
 await page.close();return at;
}
for(const c of cases)for(const withPiece of [false,true])for(const section of SECTIONS){
 if(only.length&&!only.includes(section))continue;
 const {subject,piece}=c;
 const at=await land(new URLSearchParams({subject,section,...(withPiece?{piece}:{}),reviewActor:actor}).toString());
 const want=[];
 if(section==='home'){if(!at.home)want.push('Home open');}
 else if(section==='subjects'){if(!at.subjectsOpen)want.push('the subject board open');}
 else{
  if(at.subject!==subject)want.push('subject '+subject);
  // A chosen Carousel is written, read and arranged at the workspace's step 9, where the rail keeps marking Arrange:
  // its own marks are the writing page's view (write or read) and the arrange canvas. Everything else is the rail.
  const carousel=withPiece&&c.format==='Carousel'&&['write','read','arrange','check'].includes(section);
  if(carousel){
   if(section==='write'&&at.writing!=='write')want.push('the Carousel writer on Write');
   if(section==='read'&&at.writing!=='read')want.push('the Carousel writer on Read');
   if(section==='arrange'&&!at.canvas)want.push('the Carousel arrange canvas');
   if(section==='check'&&!at.checkBeside)want.push('Check beside the Carousel');
  }else{
   // Check of a chosen Article opens beside its writing (the rail stays on Write), as the rail's own Check does.
   if(at.rail!==railKey(section)&&!(section==='check'&&at.checkBeside&&withPiece))want.push('rail on '+railKey(section));
   if(section==='read'&&at.mode!=='preview')want.push('Read (preview)');
   if(section==='write'&&at.mode!=='edit')want.push('Write (edit)');
  }
  if(withPiece&&at.piece!==piece)want.push('piece '+piece);
 }
 if(/[?&](subject|section|piece)=/.test(at.search))want.push('address keys taken out');
 checked++;
 const line=`${want.length?'WRONG':'ok   '} ${c.format} ${section}${withPiece?' with piece':''}: rail ${at.rail} stage ${at.stage} mode ${at.mode} piece ${at.piece?at.piece.slice(0,8):null} writing ${at.writing} canvas ${at.canvas}${want.length?' (wanted '+want.join(', ')+')':''}`;
 console.log(line);if(want.length)problems.push(line);
}
// An address without the parameters is left alone: nothing is opened, chosen or removed from it.
{const at=await land('reviewActor='+actor);const line=`${/[?&](subject|section|piece)=/.test(at.search)||!at.subject?'WRONG':'ok   '} old address (no parameters): subject ${at.subject} rail ${at.rail} stage ${at.stage} search ${at.search}`;checked++;console.log(line);if(line.startsWith('WRONG'))problems.push(line);}
await browser.close();
console.log(`${checked} addresses checked. ${problems.length?problems.length+' landed elsewhere.':'Every one landed where it says.'}`);
process.exitCode=problems.length?1:0;
