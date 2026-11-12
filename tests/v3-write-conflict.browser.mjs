// Version three's Write in a real Chromium: two versions of one paragraph, and words a closed tab kept on this device.
// On the real in-process server with invented words (or, with AR_CREATE_URL, on a running demo). The page stands in for
// Adrian with the header X-AR-Actor: human:adrian, as tests/v3-write-editing.browser.mjs does.
//   Both changed one paragraph: both versions stand in its place, named and marked; nothing is saved until he chooses;
//   "Keep both" saves both, one after the other. A tab that closed with unsaved words: the next tab offers them once, in
//   place; "Put them back" saves them; "Leave them out" keeps them on the app. Two live tabs keep two keys.
//   The rules of the look, measured on those screens at 1440, 1000, 700 and 390, dark and light: nothing moves on hover
//   or focus, the bar keeps one height, nothing scrolls sideways, no text is clipped, the item's text sits about 12 pixels
//   inside its edges, every button names its result in plain words, no em dash.
// Run: node tests/v3-write-conflict.browser.mjs   (AR_CREATE_URL=<demo> to use a demo, AR_CREATE_SHOTS=<folder> for pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const repo=path.resolve(import.meta.dirname,'..'),shots=process.env.AR_CREATE_SHOTS||null;
let base=process.env.AR_CREATE_URL||null,server=null,fixture=null;
if(!base){
 fixture=syntheticHome();const config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 await fillDemo(base,{only:['straw-over-the-rows','the-first-cup','studio-after-rain','shade-and-patience']});
}
if(shots)fs.mkdirSync(shots,{recursive:true});
const H={'X-AR-Actor':'human:adrian','X-AR-Client':'cli'};
const getJSON=async p=>(await fetch(base+p,{headers:H})).json();
const subjectOf=async slug=>{const st=await getJSON('/api/subject/standing?parentStudyId=demo-'+slug);return {id:'demo-'+slug,binding:st.facts.bindingId,piece:st.forms.find(f=>f.kind==='article').id};};
const draftOf=sub=>getJSON(`/api/study-draft/read?bindingId=${sub.binding}&parentStudyId=${sub.id}`);
const wordsOf=async sub=>(await draftOf(sub)).projection.filter(r=>r.safe!==false||r.words).map(r=>r.words);
const asideOf=async sub=>(await getJSON(`/api/study-draft/set-aside/list?bindingId=${sub.binding}&parentStudyId=${sub.id}`)).items||[];
async function elsewhere(sub,id,insert){
 const cur=await draftOf(sub),row=cur.projection.find(r=>r.id===id);
 const r=await fetch(base+'/api/study-draft/save',{method:'POST',headers:{...H,'Content-Type':'application/json',Origin:base},body:JSON.stringify({bindingId:sub.binding,parentStudyId:sub.id,operationId:crypto.randomUUID(),expected:cur.expected,operations:[{kind:'text',id,from:0,to:0,insert,seenBlockHash:row.blockHash}]})});
 assert.equal(r.status,200,await r.text());
}
const browser=await chromium.launch();
let failed=0;const results=[];
async function check(name,fn){try{await fn();results.push('ok - '+name);}catch(e){failed++;results.push('not ok - '+name+'\n  '+String(e.stack||e).split('\n').slice(0,14).join('\n  '));}}
const ctxOf=()=>browser.newContext({viewport:{width:1440,height:900},extraHTTPHeaders:{'X-AR-Actor':'human:adrian','X-AR-Client':'ui'}});
async function openIn(ctx,sub){
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`${base}/v3/index.html#/write/${sub.id}?piece=${sub.piece}`);
 await p.waitForSelector('.wr-ed');await p.waitForTimeout(400);
 return {p,errors};
}
const saved=p=>p.waitForFunction(()=>/^Saved/.test(document.querySelector('.wr-bar [data-wr-saved]')?.textContent||''),null,{timeout:30000});
const typeAtEnd=async(p,index,text)=>{await p.evaluate(i=>{const el=[...document.querySelectorAll('.wr-ed[data-ed]')].filter(e=>e.value.length>30)[i];el.focus();el.setSelectionRange(el.value.length,el.value.length);},index);await p.keyboard.type(text,{delay:2});};
const idAt=(p,index)=>p.evaluate(i=>[...document.querySelectorAll('.wr-ed[data-ed]')].filter(e=>e.value.length>30)[i].dataset.ed,index);
const blurAll=p=>p.evaluate(()=>document.activeElement?.blur());

const PLAIN=new Set(['Keep this one','Keep both, one after the other','Put them back','Leave them out','See them','Hide them','Done','Use the words you had','Put this paragraph back']);
const WIDTHS=[1440,1000,700,390],THEMES=['dark','light'];
/** The rules of the look on the screen as it stands, at every width and theme. Returns what was measured. */
async function look(p,label){
 const out=[];
 // As in the sample, these two screens are looked at with the sources column closed.
 if(await p.$('.wr-tools [data-wr="src"][aria-pressed="true"]'))await p.click('.wr-tools [data-wr="src"]');
 for(const theme of THEMES)for(const width of WIDTHS){
  await p.setViewportSize({width,height:width<700?844:900});
  await p.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);await p.waitForTimeout(120);
  const m=await p.evaluate(()=>{
   const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
   const scope=[...document.querySelectorAll('.wr-two,.wr-side,.wr-conflict,.wr-rec,.wr-bar')].filter(vis);
   const clipped=[];for(const root of scope)for(const e of [root,...root.querySelectorAll('*')]){if(!vis(e)||!e.childNodes.length||e.closest('.wr-back'))continue;/* the subject name in the bar shortens, with its full name as the title, as before */const s=getComputedStyle(e);if((s.overflowX!=='visible'||s.textOverflow==='ellipsis')&&e.scrollWidth>e.clientWidth+1&&[...e.childNodes].some(n=>n.nodeType===3&&n.data.trim()))clipped.push((e.className||e.tagName)+': '+e.textContent.slice(0,40));}
   const items=[...document.querySelectorAll('.wr-side .wr-item,.wr-conflict .wr-item')].filter(vis);
   const inset=items.flatMap(it=>{const r=it.getBoundingClientRect();return [...it.querySelectorAll('h2,.wr-says,.wr-by,.wr-label')].filter(vis).map(t=>{const q=t.getBoundingClientRect();return [Math.round(q.left-r.left),Math.round(r.right-q.right)];});});
   const buttons=[...document.querySelectorAll('.wr-two button,.wr-side button,.wr-conflict button')].filter(vis).map(b=>b.textContent.trim());
   const bar=document.querySelector('.wr-bar');
   return {sideways:document.documentElement.scrollWidth-innerWidth,bar:bar.getBoundingClientRect().height,clipped,inset,buttons,dash:document.body.innerText.includes('\u2014'),
    status:[...document.querySelectorAll('.wr-bar [data-wr-saved],.wr-bar [data-wr-saved-s]')].filter(vis).map(e=>e.getClientRects().length)};
  });
  // hover and focus each control in the items: nothing moves
  const moved=await p.evaluate(async()=>{
   const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
   const all=[...document.querySelectorAll('.wr-two,.wr-two *,.wr-side,.wr-side *,.wr-conflict,.wr-conflict *,.wr-bar,.wr-bar *')].filter(vis);
   const snap=()=>all.map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(x=>Math.round(x*2)/2).join(',');});
   const before=snap(),bad=[];
   for(const b of [...document.querySelectorAll('.wr-two button,.wr-side button,.wr-conflict button')].filter(vis)){
    b.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));b.focus({preventScroll:true});
    await new Promise(r=>requestAnimationFrame(()=>r()));
    const now=snap();if(now.some((x,i)=>x!==before[i]))bad.push(b.textContent.trim());
    b.blur();
   }
   return bad;
  });
  const hovered=[];
  for(const b of await p.$$('.wr-two button:visible,.wr-side button:visible,.wr-conflict button:visible')){const box=()=>b.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width};});/* on the page, not the window: hovering may scroll */const before=await box();await b.hover();await p.waitForTimeout(30);const after=await box();if(before&&after&&(Math.abs(before.x-after.x)>0.5||Math.abs(before.y-after.y)>0.5||Math.abs(before.width-after.width)>0.5))hovered.push(await b.textContent());}
  await p.mouse.move(0,0);
  out.push({label,theme,width,...m,moved,hovered});
  if(shots&&(width===1440||width===390))await p.screenshot({path:path.join(shots,`v3-${label}-${width}-${theme}.png`)});
 }
 await p.setViewportSize({width:1440,height:900});
 return out;
}
function rules(measured,barHeights){
 for(const m of measured){
  const at=`${m.label} at ${m.width} ${m.theme}`;
  assert.ok(m.sideways<=0,`${at}: scrolls sideways by ${m.sideways}`);
  assert.equal(m.bar,barHeights[m.width],`${at}: the bar keeps its height`);
  assert.deepEqual(m.status.filter(n=>n!==1),[],`${at}: the status is one line`);
  assert.deepEqual(m.clipped,[],`${at}: clipped text`);
  for(const [l,r] of m.inset)assert.ok(l>=10&&l<=14&&r>=10,`${at}: item text sits about 12 inside its edges (${l}, ${r})`);
  assert.deepEqual(m.buttons.filter(b=>!PLAIN.has(b)),[],`${at}: buttons name their result`);
  assert.equal(m.dash,false,`${at}: no em dash`);
  assert.deepEqual(m.moved,[],`${at}: nothing moves on hover or focus`);assert.deepEqual(m.hovered,[],`${at}: nothing moves under the pointer`);
 }
}
const measured=[];
/** The bar's height in the ordinary saved state, at each width: every other state must keep it. */
async function barHeights(p){const out={};for(const width of WIDTHS){await p.setViewportSize({width,height:900});await p.waitForTimeout(80);out[width]=await p.evaluate(()=>document.querySelector('.wr-bar').getBoundingClientRect().height);}await p.setViewportSize({width:1440,height:900});return out;}

await check('both changed one paragraph: both versions stand in its place, named and marked; nothing is saved until he chooses; Keep both saves both',async()=>{
 const sub=await subjectOf('shade-and-patience'),ctx=await ctxOf(),{p,errors}=await openIn(ctx,sub);
 const heights=await barHeights(p);
 let release;const gate=new Promise(r=>{release=r;});
 await p.route('**/api/study-draft/save',async r=>{await gate;await r.continue();});
 const id=await idAt(p,1),was=(await draftOf(sub)).projection.find(r=>r.id===id).words,mine=' And I sat with her until the light went.';
 await typeAtEnd(p,1,mine);await blurAll(p);await p.waitForTimeout(200);
 await elsewhere(sub,id,'Elsewhere, on the phone: ');
 release();
 await p.waitForSelector(`[data-row="${id}"] .wr-two`,{timeout:20000});
 const two=await p.evaluate(rid=>{const t=document.querySelector(`[data-row="${rid}"] .wr-two`);return {labels:[...t.querySelectorAll('.wr-k span')].map(s=>s.textContent),texts:[...t.querySelectorAll('.wr-vt')].map(s=>s.textContent),marks:t.querySelectorAll('mark.wr-dif').length,status:document.querySelector('.wr-bar [data-wr-saved]').textContent};},id);
 assert.match(two.labels[0],/^Written elsewhere, \d\d:\d\d$/);assert.match(two.labels[1],/^Written here, \d\d:\d\d$/);
 assert.match(two.texts[0],/^Elsewhere, on the phone: /);assert.match(two.texts[1],/until the light went\.$/);
 assert.ok(two.marks>=2,'what differs is marked in each');assert.equal(two.status,'One paragraph has two versions');
 assert.ok(await p.isVisible('.wr-side [data-wr-side="conflict"]'),'the item stands beside the paragraph at 1440');
 await p.waitForTimeout(2000);
 const server=(await draftOf(sub)).projection.find(r=>r.id===id).words;
 assert.equal(server,'Elsewhere, on the phone: '+was,'nothing saved before he chooses');
 measured.push(...await look(p,'conflict'));
 await p.setViewportSize({width:390,height:844});assert.ok(await p.isVisible('.wr-conflict [data-wr-side="conflict"]'),'on a phone the item is at the top of the page');
 await p.setViewportSize({width:1440,height:900});
 await p.click(`[data-row="${id}"] [data-act="keep"][data-v="both"]`);await saved(p);
 const both=(await draftOf(sub)).projection.find(r=>r.id===id).words;
 assert.equal(both,'Elsewhere, on the phone: '+was+' '+was+mine,'both, one after the other');
 measured.push(...(await look(p,'conflict-kept')).filter(m=>m.width===1440||m.width===390));
 rules(measured.filter(m=>m.label.startsWith('conflict')),heights);
 assert.deepEqual(errors,[]);await ctx.close();
});

await check('a tab that closed with unsaved words: the next tab offers them once, in place; Put them back saves them; Leave them out keeps them on the app',async()=>{
 const sub=await subjectOf('the-first-cup'),ctx=await ctxOf();
 const a=await openIn(ctx,sub),heights=await barHeights(a.p);
 await ctx.setOffline(true);// from here until the tab is gone nothing reaches the app
 const id=await idAt(a.p,0);
 await typeAtEnd(a.p,0,' And whether her son will.');await blurAll(a.p);await a.p.waitForTimeout(2200);
 const typed=await a.p.evaluate(rid=>document.querySelector(`[data-ed="${rid}"]`).value,id);
 await a.p.close();await ctx.setOffline(false);// the tab dies with his words unsaved (offline, so its last save on closing cannot land)
 // Two tabs open; whichever finds the closed tab's key free first offers its words, and the other never does.
 const t1=await openIn(ctx,sub),t2=await openIn(ctx,sub);
 const has=t=>t.p.$('.wr-side [data-wr-side="recovered"]');
 const deadline=Date.now()+30000;while(!(await has(t1))&&!(await has(t2))&&Date.now()<deadline)await t1.p.waitForTimeout(200);
 const [b,c]=await has(t1)?[t1,t2]:[t2,t1];
 await b.p.waitForSelector('.wr-side [data-wr-side="recovered"]',{timeout:1000}).catch(async e=>{for(const t of [t1,t2])console.log(await t.p.evaluate(()=>({keys:Object.keys(localStorage),status:document.querySelector('.wr-bar [data-wr-saved]')?.textContent,side:document.querySelector('[data-wr-side]')?.outerHTML.slice(0,200)})),t.errors);throw e;});
 await c.p.waitForTimeout(500);assert.equal(await c.p.$('[data-wr-side="recovered"]'),null,'offered in one tab only');
 const shown=await b.p.evaluate(()=>({well:[...document.querySelectorAll('.wr-rec')].map(e=>e.textContent),item:document.querySelector('.wr-side [data-wr-side="recovered"]').innerText,status:document.querySelector('.wr-bar [data-wr-saved]').textContent}));
 assert.deepEqual(shown.well,[typed],'his kept words stand in place');
 assert.match(shown.item,/Saved/);assert.match(shown.item,/Kept on this device/);assert.match(shown.item,/Adds 5 words\. Takes away none of yours\./);
 assert.equal(shown.status,'Words kept on this device');
 measured.push(...await look(b.p,'recovered'));
 await b.p.click('.wr-side [data-act="rec"][data-v="back"]');await saved(b.p);
 assert.ok((await wordsOf(sub)).includes(typed),'put back and saved');
 measured.push(...(await look(b.p,'recovered-back')).filter(m=>m.width===1440||m.width===390));
 rules(measured.filter(m=>m.label.startsWith('recovered')),heights);
 // Again, and this time he leaves them out: they go to the app's set-aside store and the device key goes.
 await ctx.setOffline(true);// from here until the tab is gone nothing reaches the app
 await typeAtEnd(b.p,1,' A sentence he will leave out.');await blurAll(b.p);await b.p.waitForTimeout(2200);
 const left=await b.p.evaluate(()=>[...document.querySelectorAll('.wr-ed[data-ed]')].filter(e=>e.value.length>30)[1].value);
 await b.p.close();await c.p.close();await ctx.setOffline(false);
 const d=await openIn(ctx,sub);
 await d.p.waitForSelector('.wr-side [data-wr-side="recovered"]',{timeout:15000}).catch(async e=>{console.log(await d.p.evaluate(()=>Object.entries(localStorage).map(([k,v])=>k+' '+v.slice(0,200))),'on the app:',(await wordsOf(sub)).includes(left),(await asideOf(sub)).length);throw e;});
 await d.p.click('.wr-side [data-act="rec"][data-v="left"]');
 await d.p.waitForSelector('.wr-side [data-wr-side="recovered-done"]');
 assert.ok((await asideOf(sub)).some(e=>e.reason==='recovery'&&e.paragraphs.some(x=>x.words===left)),'kept on the app');
 assert.equal((await wordsOf(sub)).includes(left),false,'not put in the piece');
 const keys=await d.p.evaluate(b=>Object.keys(localStorage).filter(k=>k.startsWith('ar-v3-write:'+b)),sub.binding);
 assert.deepEqual(keys,[],'and the closed tab\'s key is gone');
 await ctx.close();
});

await check('two live tabs on one piece keep two keys, and both tabs\' words are saved',async()=>{
 const sub=await subjectOf('studio-after-rain'),ctx=await ctxOf();
 const a=await openIn(ctx,sub),b=await openIn(ctx,sub);
 await a.p.route('**/api/study-draft/save',r=>r.abort());await b.p.route('**/api/study-draft/save',r=>r.abort());
 await typeAtEnd(a.p,0,' (tab one)');await typeAtEnd(b.p,1,' (tab two)');await a.p.waitForTimeout(400);
 const kept=await a.p.evaluate(bid=>Object.keys(localStorage).filter(k=>k.startsWith('ar-v3-write:'+bid)).map(k=>JSON.parse(localStorage.getItem(k)).edits.map(e=>e[1])),sub.binding);
 assert.equal(kept.length,2,'one key for each tab');
 assert.ok(kept.flat().some(x=>x.endsWith('(tab one)'))&&kept.flat().some(x=>x.endsWith('(tab two)')));
 await a.p.unroute('**/api/study-draft/save');await b.p.unroute('**/api/study-draft/save');
 await a.p.click('.wr-bar [data-wr="retry"]').catch(()=>{});await blurAll(a.p);
 await a.p.waitForFunction(()=>/^Saved/.test(document.querySelector('.wr-bar [data-wr-saved]').textContent),null,{timeout:30000});
 await b.p.click('.wr-bar [data-wr="retry"]').catch(()=>{});
 await b.p.waitForFunction(()=>/^Saved/.test(document.querySelector('.wr-bar [data-wr-saved]').textContent),null,{timeout:30000});
 const words=await wordsOf(sub);
 assert.ok(words.some(x=>x.endsWith('(tab one)'))&&words.some(x=>x.endsWith('(tab two)')),'both saved');
 await ctx.close();
});

await browser.close();if(server){await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}
if(shots)fs.writeFileSync(path.join(shots,'measured.json'),JSON.stringify(measured,null,1));
console.log(results.join('\n'));console.log(`# pass ${results.length-failed}\n# fail ${failed}`);
process.exit(failed?1:0);
