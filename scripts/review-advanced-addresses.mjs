// Version two's "Advanced" hand-off lands where it says. Opens the existing workspace at
// /document-study/index.html?subject=<id>&section=<id>[&piece=<output id>] for every section id, with and without a
// piece, and checks where it lands by the workspace's own marks: the subject open, the section the rail marks as
// current, the piece chosen, and Read or Write for the writer. Exit code 1 when any lands elsewhere.
// Start the demo and fill it first (npm run demo; npm run demo:fill), then:
//   AR_CREATE_URL=http://127.0.0.1:8854 AR_CREATE_PLAYWRIGHT=/opt/node-tools/node_modules/playwright/index.mjs node scripts/review-advanced-addresses.mjs [--only=write,read]
// It reads and clicks the demo, and may make one Carousel and one Article there; it refuses any server that is not the
// invented demo, and never targets 8841.
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const base=process.env.AR_CREATE_URL||'http://127.0.0.1:8854';
if(/:8841\b/.test(base))throw Error('This check never runs against the installed app on 8841.');
// It creates a Carousel and a second Article when the demo lacks them, so it runs only against the invented demo.
await (await import('./demo-instagram.mjs')).assertInventedDemo(base);
const SECTIONS=['home','subjects','library','material','source','research','direction','write','read','check','media','arrange','audience','share','outputs'];
const only=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean);
const actor='agent:claude-code';
const browser=await chromium.launch(),problems=[];let checked=0;
// Pieces of the demo, read through the workspace's own output reader: the first Article, a Carousel, and a second Article
// of the same subject (so two Articles of one subject can be told apart by their ids).
// The demo fill makes none of the last two, so they are made on the first subject that has an Article, through the
// workspace's own Create buttons (the demo only; this script never targets 8841).
const cases=[];
{const page=await browser.newPage();await page.goto(`${base}/document-study/index.html?reviewActor=${actor}`,{waitUntil:'load'});
 await page.waitForFunction(()=>window.realOutputOverview?.read&&typeof state!=='undefined'&&state.projects?.length>1,null,{timeout:30000});
 const readAll=()=>page.evaluate(async()=>{const rows=[];for(const p of state.projects){let d;try{d=await window.realOutputOverview.read({projectId:p.id});}catch{continue;}for(const o of d.outputs||[])rows.push({subject:p.id,piece:o.id,format:o.format});}return rows;});
 let rows=await readAll();
 const home=rows.find(r=>r.format==='Article');
 if(home){
  const kinds=[];
  if(!rows.some(r=>r.format==='Carousel'))kinds.push('create-carousel');
  if(rows.filter(r=>r.subject===home.subject&&r.format==='Article').length<2)kinds.push('create-article');
  if(kinds.length){
   await page.goto(`${base}/document-study/index.html?reviewActor=${actor}&subject=${encodeURIComponent(home.subject)}&section=outputs`,{waitUntil:'load'});
   await page.waitForFunction(()=>window.arVersionTwo?.landing,null,{timeout:30000});await page.evaluate(()=>window.arVersionTwo.landing());
   for(const kind of kinds)await page.evaluate(k=>window.realOutputOverview.onAction({projectId:current().id,outputId:null,edition:null,kind:k}),kind).catch(e=>{problems.push('Could not make '+kind+': '+e.message);console.log('WRONG could not make '+kind);});
   rows=await readAll();
  }
 }
 await page.close();
 const article=rows.find(r=>r.format==='Article'),carousel=rows.find(r=>r.format==='Carousel');
 const second=article&&rows.find(r=>r.format==='Article'&&r.subject===article.subject&&r.piece!==article.piece);
 if(!article){problems.push('The demo has no Article piece.');console.log('WRONG no Article piece in the demo');}else cases.push({...article,label:'Article'});
 if(!carousel){problems.push('The demo has no Carousel piece.');console.log('WRONG no Carousel piece in the demo');}else cases.push({...carousel,label:'Carousel'});
 if(!second){problems.push('The demo has no second Article on one subject.');console.log('WRONG no second Article on the first Article\'s subject');}else cases.push({...second,label:'Article 2',other:article.piece});
 var elsewhere=rows.find(r=>article&&r.subject!==article.subject&&r.format==='Article');
}
// Where each section id should land: the rail's own key for it.
const railKey=s=>s==='read'?'write':s==='subjects'?'home':s;
async function land(query){
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto(`${base}/document-study/index.html?${query}`,{waitUntil:'load'});
 // Settled: the address keys are taken out when the hand-off has finished.
 await page.waitForFunction(()=>!new URLSearchParams(location.search).has('section'),null,{timeout:30000}).catch(()=>{});
 await page.waitForTimeout(1500);
 await page.waitForFunction(()=>!!document.querySelector('.combined-rail [data-combined-nav][aria-current]')&&Number.isFinite(Number(current?.().viewedStage)),null,{timeout:8000}).catch(()=>{});
 // What the landing itself said, so a wrong landing shows whether it was reported or claimed as ok.
 const said=await page.evaluate(async()=>{try{const r=await window.arVersionTwo?.landing?.();return r?(r.ok?'ok':r.reason):'none';}catch(e){return 'threw';}}).catch(()=>'unreadable');
 const at=await page.evaluate(()=>({said:null,subject:typeof current==='function'?current().id:null,rail:document.querySelector('.combined-rail [data-combined-nav][aria-current]')?.dataset.combinedNav||null,
  mode:window.studyDraft?.viewMode?.()||null,stage:typeof current==='function'?Number(current().viewedStage):null,
  piece:window.studyOutputConnection?.selection?.()?.output?.id||null,subjectsOpen:!!window.combinedSubjects?.isOpen?.(),checkBeside:document.getElementById('wbf-drawer')?.dataset.tool==='check',home:!!document.getElementById('project-library')?.open,
  writing:document.querySelector('#study-output-canvas .car-writing-page')?.dataset.writingView||null,canvas:!!document.querySelector('#study-output-canvas .car-stage'),
  search:location.search}));
 at.said=said;await page.close();return at;
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
  const carousel=withPiece&&c.label==='Carousel'&&['write','read','arrange','check'].includes(section);
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
  if(withPiece&&at.piece!==piece)want.push('piece '+piece+(c.other&&at.piece===c.other?' (it opened the first Article of the subject instead)':''));
 }
 if(/[?&](subject|section|piece)=/.test(at.search))want.push('address keys taken out');
 checked++;
 const line=`${want.length?'WRONG':'ok   '} ${c.label} ${section}${withPiece?' with piece':''}: rail ${at.rail} stage ${at.stage} mode ${at.mode} piece ${at.piece?at.piece.slice(0,8):null} writing ${at.writing} canvas ${at.canvas}${want.length?' landing said '+at.said+' (wanted '+want.join(', ')+')':''}`;
 console.log(line);if(want.length)problems.push(line);
}
// A piece that belongs to another subject, or that does not exist, never opens: the subject's own section opens and the
// landing says why. A subject that does not exist opens nothing and says so.
if(!only.length&&cases.length&&elsewhere){
 const c=cases[0];
 for(const [name,piece] of [['piece of another subject',elsewhere.piece],['unknown piece','no-such-piece-id']])for(const section of ['write','read','check','arrange']){
  const at=await land(new URLSearchParams({subject:c.subject,section,piece,reviewActor:actor}).toString());
  const want=[];
  if(at.subject!==c.subject)want.push('subject '+c.subject);
  if(at.piece===piece)want.push('no other subject\'s piece');
  if(section==='read'&&at.mode!=='preview')want.push('Read (preview)');
  if(section==='write'&&at.mode!=='edit')want.push('Write (edit)');
  if(['write','read','arrange'].includes(section)&&at.rail!==railKey(section))want.push('rail on '+railKey(section));
  checked++;const line=`${want.length?'WRONG':'ok   '} ${name} ${section}: subject ${at.subject} rail ${at.rail} mode ${at.mode} piece ${at.piece?at.piece.slice(0,8):null}${want.length?' (wanted '+want.join(', ')+')':''}`;
  console.log(line);if(want.length)problems.push(line);
 }
 {const page=await browser.newPage();await page.goto(`${base}/document-study/index.html?reviewActor=${actor}`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.arVersionTwo?.openPlace,null,{timeout:30000});
  const said=await page.evaluate(async([a,b,mine])=>({
   missing:(await window.arVersionTwo.openPlace({subject:'no-such-subject',view:'write'})).reason,
   other:(await window.arVersionTwo.openPlace({subject:a,piece:b,view:'write'})).reason,
   unknown:(await window.arVersionTwo.openPlace({subject:a,piece:'no-such-piece-id',view:'write'})).reason,
   good:(await window.arVersionTwo.openPlace({subject:a,piece:mine,view:'read'}))}),[c.subject,elsewhere.piece,cases.find(x=>x.other)?.piece||c.piece]);
  await page.close();
  const bad=[];if(said.missing!=='subject-not-found')bad.push('subject-not-found');if(said.other!=='piece-other-subject')bad.push('piece-other-subject');if(said.unknown!=='piece-not-found')bad.push('piece-not-found');if(!said.good.ok||said.good.opened?.view!=='preview')bad.push('a good landing says ok and shows Read');
  checked++;const line=`${bad.length?'WRONG':'ok   '} the landing says why it could not open: ${JSON.stringify(said)}${bad.length?' (wanted '+bad.join(', ')+')':''}`;console.log(line);if(bad.length)problems.push(line);}
}
// An address without the parameters is left alone: nothing is opened, chosen or removed from it.
{const at=await land('reviewActor='+actor);const line=`${/[?&](subject|section|piece)=/.test(at.search)||!at.subject?'WRONG':'ok   '} old address (no parameters): subject ${at.subject} rail ${at.rail} stage ${at.stage} search ${at.search}`;checked++;console.log(line);if(line.startsWith('WRONG'))problems.push(line);}
await browser.close();
console.log(`${checked} addresses checked. ${problems.length?problems.length+' landed elsewhere.':'Every one landed where it says.'}`);
process.exitCode=problems.length?1:0;
