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
// A subject of the demo that has a piece (an output), read through the app's own catalog.
const catalog=await (await fetch(base+'/api/study-draft/catalog',{headers:{'X-AR-Actor':'agent:claude-code','X-AR-Client':'http'}})).json();
const output=(catalog.outputBindings||[]).find(o=>o.parentStudyId&&o.outputId&&o.bindingStatus==='ready');
if(!output)throw Error('The demo has no subject with a piece. Run npm run demo:fill first.');
const subject=output.parentStudyId,piece=output.outputId;
// Where each section id should land: the rail's own key for it.
const railKey=s=>s==='read'?'write':s==='subjects'?'home':s;
const browser=await chromium.launch(),problems=[];let checked=0;
for(const withPiece of [false,true])for(const section of SECTIONS){
 if(only.length&&!only.includes(section))continue;
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const q=new URLSearchParams({subject,section,...(withPiece?{piece}:{}),reviewActor:'agent:claude-code'});
 await page.goto(`${base}/document-study/index.html?${q}`,{waitUntil:'load'});
 // Settled: the address keys are taken out when the hand-off has finished.
 await page.waitForFunction(()=>!new URLSearchParams(location.search).has('section'),null,{timeout:30000}).catch(()=>{});
 await page.waitForTimeout(1500);
 // and the workspace has drawn its rail again (it redraws while a view mounts).
 await page.waitForFunction(()=>!!document.querySelector('.combined-rail [data-combined-nav][aria-current]')&&Number.isFinite(Number(current?.().viewedStage)),null,{timeout:8000}).catch(()=>{});
 const at=await page.evaluate(()=>({subject:typeof current==='function'?current().id:null,rail:document.querySelector('.combined-rail [data-combined-nav][aria-current]')?.dataset.combinedNav||null,
  mode:window.studyDraft?.viewMode?.()||null,stage:typeof current==='function'?Number(current().viewedStage):null,
  piece:window.studyOutputConnection?.selection?.()?.output?.id||null,subjectsOpen:!!window.combinedSubjects?.isOpen?.(),checkBeside:document.getElementById('wbf-drawer')?.dataset.tool==='check',home:!!document.getElementById('project-library')?.open}));
 const want=[];
 if(section==='home'){if(!at.home)want.push('Home open');}
 else if(section==='subjects'){if(!at.subjectsOpen)want.push('the subject board open');}
 else{
  if(at.subject!==subject)want.push('subject '+subject);
  // Check of a chosen piece opens beside its writing (the rail stays on Write), as the rail's own Check does.
  if(at.rail!==railKey(section)&&!(section==='check'&&at.checkBeside))want.push('rail on '+railKey(section));
  if(section==='read'&&at.mode!=='preview')want.push('Read (preview)');
  if(section==='write'&&at.mode!=='edit')want.push('Write (edit)');
  if(withPiece&&at.piece!==piece)want.push('piece '+piece);
 }
 checked++;
 const line=`${want.length?'WRONG':'ok   '} ${section}${withPiece?' with piece':''}: rail ${at.rail} stage ${at.stage} mode ${at.mode} piece ${at.piece?at.piece.slice(0,8):null}${want.length?' (wanted '+want.join(', ')+')':''}`;
 console.log(line);if(want.length)problems.push(line);
 await page.close();
}
await browser.close();
console.log(`${checked} addresses checked for subject ${subject} and piece ${piece}. ${problems.length?problems.length+' landed elsewhere.':'Every one landed where it says.'}`);
process.exitCode=problems.length?1:0;
