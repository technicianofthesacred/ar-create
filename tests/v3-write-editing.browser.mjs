// Version three's Write in a real Chromium, on the real in-process server with invented words: what he types, pastes and
// composes (an input method) is saved exactly; a ring after a quote never enters his words; Enter during a running save
// keeps every letter in order; a newline without an Enter key splits; an assistant's page stays read only.
// The page stands in for Adrian with the header X-AR-Actor: human:adrian (an assistant's page names its own actor).
// Run: AR_CREATE_PLAYWRIGHT=/path/to/playwright/index.mjs node tests/v3-write-editing.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const repo=path.resolve(import.meta.dirname,'..');
const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
await fillDemo(base,{only:['straw-over-the-rows','the-first-cup','studio-after-rain','circle-of-twelve']});
const getJSON=async p=>(await fetch(base+p)).json();
const subjectOf=async slug=>{const st=await getJSON('/api/subject/standing?parentStudyId=demo-'+slug);return {id:'demo-'+slug,binding:st.facts.bindingId,piece:st.forms.find(f=>f.kind==='article').id};};
const wordsOf=async sub=>(await getJSON(`/api/study-draft/read?bindingId=${sub.binding}&parentStudyId=${sub.id}`)).projection.filter(r=>r.safe!==false||r.words).map(r=>r.words);
const browser=await chromium.launch();
let failed=0;const results=[];
async function check(name,fn){try{await fn();results.push('ok - '+name);}catch(e){failed++;results.push('not ok - '+name+'\n  '+String(e.stack||e).split('\n').slice(0,14).join('\n  '));}}
async function open(sub,{actor='human:adrian',search=''}={}){
 const ctx=await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});
 await ctx.setExtraHTTPHeaders({'X-AR-Actor':actor,'X-AR-Client':'ui'});
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`${base}/v3/index.html${search}#/write/${sub.id}?piece=${sub.piece}`);
 await p.waitForSelector('.wr-ed');await p.waitForTimeout(300);
 return {p,ctx,errors};
}
const saved=p=>p.waitForFunction(()=>/^Saved/.test(document.querySelector('.wr-bar [data-wr-saved]')?.textContent||'')&&!document.querySelector('[data-wr-conflict]:not([hidden])'),null,{timeout:30000});
const quiet=async p=>{await p.waitForTimeout(1900);await saved(p);};
const caretAtEnd=(p,sel)=>p.evaluate(s=>{const el=document.querySelector(s);el.focus();el.setSelectionRange(el.value.length,el.value.length);},sel);
const onPage=p=>p.evaluate(()=>[...document.querySelectorAll('.wr-ed')].map(e=>e.value).filter(Boolean));

const sub=await subjectOf('straw-over-the-rows');
await check('typing keeps his exact words, spaces and marks included',async()=>{
 const {p,ctx,errors}=await open(sub);
 const first=(await onPage(p))[0];
 await caretAtEnd(p,'.wr-ed');
 const typed=' “Twenty days,” she said; no, wait:  twice-spaced, café, 茶.';
 await p.keyboard.type(typed,{delay:5});await quiet(p);
 assert.equal((await wordsOf(sub))[0],first+typed);assert.equal((await onPage(p))[0],first+typed);
 assert.equal(await p.evaluate(()=>document.querySelector('.wr-ed').isContentEditable),true);
 assert.deepEqual(errors,[]);await ctx.close();
});
await check('pasting text with line breaks keeps it in one paragraph, every word exact',async()=>{
 const {p,ctx}=await open(sub);
 const before=(await onPage(p))[1];
 await p.evaluate(()=>navigator.clipboard.writeText('Pasted one.\nPasted two.\r\n\r\nPasted three.'));
 await caretAtEnd(p,'.wr-row:nth-child(2) .wr-ed');await p.keyboard.press('ControlOrMeta+V');await quiet(p);
 const now=(await wordsOf(sub))[1];
 assert.equal(now,before+'Pasted one. Pasted two. Pasted three.');assert.equal((await onPage(p))[1],now);
 await ctx.close();
});
await check('composing with an input method saves only the finished word, once',async()=>{
 const {p,ctx}=await open(sub);
 const before=(await onPage(p))[2];
 await caretAtEnd(p,'.wr-row:nth-child(3) .wr-ed');
 const cdp=await ctx.newCDPSession(p);
 await cdp.send('Input.imeSetComposition',{text:'ち',selectionStart:1,selectionEnd:1});
 await cdp.send('Input.imeSetComposition',{text:'ちゃ',selectionStart:2,selectionEnd:2});
 await p.waitForTimeout(1800);// a save may run while he composes; the page is not rebuilt under the word
 await cdp.send('Input.insertText',{text:'茶'});
 await p.keyboard.type(' and more.',{delay:5});await quiet(p);
 assert.equal((await wordsOf(sub))[2],before+'茶 and more.');assert.equal((await onPage(p))[2],before+'茶 and more.');
 await ctx.close();
});
await check('a ring after a closing quote mark is skipped: typing beside it saves only his words',async()=>{
 const {p,ctx}=await open(sub);
 const before=(await onPage(p))[0];
 await p.evaluate(()=>{const el=document.querySelector('.wr-ed'),ring=document.createElement('span');ring.setAttribute('data-ring','');ring.setAttribute('contenteditable','false');ring.textContent='RING';el.appendChild(ring);el.append(document.createTextNode(''));el.focus();el.setSelectionRange(el.value.length,el.value.length);});
 await p.keyboard.type(' After the ring.',{delay:5});await quiet(p);
 const now=(await wordsOf(sub))[0];
 assert.equal(now,before+' After the ring.');assert.doesNotMatch(now,/RING/);
 await ctx.close();
});
await check('Enter in the middle of a saved paragraph while a save runs keeps every letter in order',async()=>{
 const {p,ctx}=await open(sub);
 await p.route('**/api/study-draft/save',async r=>{const res=await r.fetch();await new Promise(x=>setTimeout(x,1000));await r.fulfill({response:res});});
 const words=await onPage(p),text=words[3],at=text.indexOf(' ',Math.floor(text.length/2));
 await caretAtEnd(p,'.wr-row:nth-child(5) .wr-ed');await p.keyboard.type(' Changed first.');await p.keyboard.press('Tab');// a save starts, slow to answer
 await p.waitForTimeout(200);
 await p.evaluate(at=>{const el=document.querySelectorAll('.wr-ed')[3];el.focus();el.setSelectionRange(at,at);},at);
 await p.keyboard.press('Enter');await p.keyboard.type('jo',{delay:40});
 await p.waitForFunction(t=>[...document.querySelectorAll('.wr-ed')].some(e=>e.value===t)&&document.activeElement?.value?.startsWith('jo'),text.slice(0,at),{timeout:20000});
 await p.keyboard.type('ined',{delay:30});await quiet(p);
 const server=await wordsOf(sub);
 assert.ok(server.includes(text.slice(0,at)));assert.ok(server.includes('joined'+text.slice(at)),server.join(' | '));
 assert.deepEqual(await onPage(p),server);
 await ctx.close();
});
await check('a newline without an Enter key (as an input method sends it) splits the paragraph, never a space',async()=>{
 const {p,ctx}=await open(sub);
 const cdp=await ctx.newCDPSession(p);
 for(const n of [1,2]){
  const text=(await onPage(p))[n],at=text.indexOf(' ',Math.floor(text.length/2));
  await p.evaluate(([n,at])=>{const el=document.querySelectorAll('.wr-ed')[n];el.focus();el.setSelectionRange(at,at);},[n,at]);
  await cdp.send('Input.insertText',{text:'\n'});// no Enter key at all
  await quiet(p);
  const server=await wordsOf(sub);
  assert.ok(server.includes(text.slice(0,at))&&server.includes(text.slice(at).trim()),server.join(' | '));
  assert.ok(!server.includes(text));assert.deepEqual(await onPage(p),server);
 }
 await ctx.close();
});
await check('an assistant\'s page is read only: typing changes nothing and saves nothing',async()=>{
 const other=await subjectOf('the-first-cup'),before=await wordsOf(other);
 const {p,ctx}=await open(other,{actor:'agent:claude-code',search:'?reviewActor=agent:claude-code'});
 const posts=[];p.on('request',r=>{if(r.method()==='POST'&&/study-draft\/save/.test(r.url()))posts.push(r.url());});
 assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.wr-ed')].every(e=>!e.isContentEditable&&e.readOnly)),true);
 await p.click('.wr-ed');await p.keyboard.type('Typed by an assistant.');await p.waitForTimeout(2200);
 assert.deepEqual(posts,[]);assert.deepEqual(await wordsOf(other),before);
 assert.match(await p.textContent('.wr-bar [data-wr-saved]'),/Read only/);
 await ctx.close();
});
await check('Copy all my words works when pressed from a paragraph while the app is not answering',async()=>{
 const {p,ctx}=await open(sub);
 await p.route('**/api/study-draft/save',r=>r.abort());
 await caretAtEnd(p,'.wr-ed');await p.keyboard.type(' Unsaved while away.',{delay:5});
 await p.waitForSelector('[data-wr-fail]:not([hidden]) [data-wr="copy"]',{timeout:20000});
 await caretAtEnd(p,'.wr-ed');await p.keyboard.type(' More.',{delay:5});// the caret is in a paragraph: pressing the button starts a save
 await p.click('[data-wr-fail] [data-wr="copy"]');
 await p.waitForFunction(()=>/Copied all/.test(document.body.innerText),null,{timeout:5000});
 const clip=await p.evaluate(()=>navigator.clipboard.readText());
 assert.match(clip,/Unsaved while away\. More\./);
 await p.unroute('**/api/study-draft/save');await quiet(p);
 await ctx.close();
});
await check('a browser that cannot edit an element as plain text gets plain boxes, and his words save',async()=>{
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 await ctx.setExtraHTTPHeaders({'X-AR-Actor':'human:adrian','X-AR-Client':'ui'});
 // As Firefox before 136 does: the value is refused.
 await ctx.addInitScript(()=>{const d=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'contentEditable');Object.defineProperty(HTMLElement.prototype,'contentEditable',{configurable:true,get(){return d.get.call(this);},set(v){if(v==='plaintext-only')throw new DOMException('bad value','SyntaxError');d.set.call(this,v);}});});
 const p=await ctx.newPage();
 await p.goto(`${base}/v3/index.html#/write/${sub.id}?piece=${sub.piece}`);await p.waitForSelector('.wr-ed');await p.waitForTimeout(300);
 assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.wr-ed')].every(e=>e.tagName==='TEXTAREA')),true);
 const before=(await onPage(p))[0];
 await caretAtEnd(p,'.wr-ed');await p.keyboard.type(' In a plain box.',{delay:5});await quiet(p);
 assert.equal((await wordsOf(sub))[0],before+' In a plain box.');
 await ctx.close();
});
await check('a split the app cannot make leaves nothing unsaved, and the bar does not keep saying it is',async()=>{
 const {p,ctx}=await open(sub);
 const before=await wordsOf(sub);
 await p.evaluate(()=>{const el=document.querySelectorAll('.wr-ed')[1];el.focus();el.setSelectionRange(0,0);});
 await p.keyboard.press('Enter');// at the very start of a saved paragraph: the app refuses this split
 await p.waitForFunction(()=>/^Saved/.test(document.querySelector('.wr-bar [data-wr-saved]')?.textContent||'')&&document.querySelector('[data-wr-fail]').hidden,null,{timeout:20000});
 assert.deepEqual(await wordsOf(sub),before);assert.deepEqual(await onPage(p),before);
 await ctx.close();
});

// ---- Undo in the bar: only saved changes, one line, nothing moves ----
const geometry=p=>p.evaluate(()=>{const bar=document.querySelector('.wr-bar'),at=bar.getBoundingClientRect().top;/* the page may be scrolled: places are told from the bar */const r=e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top-at),Math.round(b.width),Math.round(b.height)].join(',');};
 return {bar:Math.round(bar.getBoundingClientRect().height),tools:[...bar.querySelectorAll('.wr-tools button')].filter(e=>e.offsetParent!==null).map(r),phone:[...document.querySelectorAll('.wr-pphone button')].filter(e=>e.offsetParent!==null).map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)].join(',');}),
  kids:[...bar.children].filter(e=>e.offsetParent!==null&&!e.matches('.wr-sp,.wr-sep')).map(e=>{const b=e.getBoundingClientRect();return Math.round(b.top-at+b.height/2);}),/* each part's middle: a part keeps its line */oneLine:[...bar.querySelectorAll('.wr-status, .wr-status *')].filter(e=>e.offsetParent!==null).every(e=>e.getBoundingClientRect().height<=34)};});
const same=(a,b,label)=>{assert.equal(a.bar,b.bar,label+': the bar keeps its height');assert.deepEqual(a.tools,b.tools,label+': the tools stay where they were');assert.deepEqual(a.phone,b.phone,label+': the phone bar stays where it was');assert.deepEqual(a.kids,b.kids,label+': one line');assert.equal(b.oneLine,true,label+': the status is one line');};
for(const [name,viewport,slug] of [['a computer',{width:1280,height:900},'studio-after-rain'],['a wide screen',{width:1600,height:900},'circle-of-twelve'],['a phone',{width:390,height:800},'the-first-cup']]){
 await check(`Undo at ${name}: off with unsaved words, off during a save, off offline; Ctrl or Cmd Z undoes typing; taking back four paragraphs asks first and Put back restores them; the bar never moves or wraps`,async()=>{
  const other=await subjectOf(slug);
  const ctx=await browser.newContext({viewport,permissions:['clipboard-read','clipboard-write']});await ctx.setExtraHTTPHeaders({'X-AR-Actor':'human:adrian','X-AR-Client':'ui'});
  const p=await ctx.newPage();await p.goto(`${base}/v3/index.html#/write/${other.id}?piece=${other.piece}`);await p.waitForSelector('.wr-ed');await p.waitForTimeout(400);
  const undo=p.locator('[data-wr="undo"]:visible');
  const idle=await geometry(p);
  const before=await wordsOf(other);
  // unsaved words: Undo is off and says why; the browser's own undo takes the typing back
  await caretAtEnd(p,'.wr-ed');await p.keyboard.type(' Oops.');
  assert.equal(await undo.isDisabled(),true);assert.match(await undo.getAttribute('aria-label'),/not saved yet.*Ctrl or Cmd Z/);same(idle,await geometry(p),'unsaved');
  for(let i=0;i<14&&(await onPage(p))[0]!==before[0];i++)await p.keyboard.press('ControlOrMeta+Z');// the browser takes the typing back a step at a time
  assert.equal((await onPage(p))[0],before[0],'the browser\'s own undo took the typing back, and nothing else');
  await quiet(p);assert.deepEqual(await wordsOf(other),before);
  // a save that is running
  const slow=async r=>{try{const res=await r.fetch();await new Promise(x=>setTimeout(x,1500));await r.fulfill({response:res});}catch{/* the page moved on */}};
  await p.route('**/api/study-draft/save',slow);
  await caretAtEnd(p,'.wr-ed');await p.keyboard.type(' Slow.');await p.keyboard.press('Tab');
  await p.waitForFunction(()=>/Saving/.test(document.querySelector('.wr-bar [data-wr-saved], .wr-bar [data-wr-saved-s]')?.textContent||document.querySelector('.wr-bar [data-wr-saved-s]')?.textContent||''),null,{timeout:5000}).catch(()=>{});
  assert.equal(await undo.isDisabled(),true);assert.match(await undo.getAttribute('title'),/Saving|not saved yet/);same(idle,await geometry(p),'saving');
  await p.unroute('**/api/study-draft/save',slow);await quiet(p);
  const saved=await wordsOf(other);before.splice(0,before.length,...saved);
  // offline for four paragraphs
  const down=r=>r.abort().catch(()=>{});
  await p.route('**/api/study-draft/save',down);
  for(let i=0;i<4;i++){await p.evaluate(i=>{const el=document.querySelectorAll('.wr-ed')[i];el.focus();el.setSelectionRange(el.value.length,el.value.length);},i);await p.keyboard.type(` Offline ${i+1}.`,{delay:3});await p.keyboard.press('Tab');}
  await p.waitForSelector('[data-wr-fail]:not([hidden])',{timeout:20000});
  assert.equal(await undo.isDisabled(),true);assert.match(await undo.getAttribute('aria-label'),/not answering|Trying to save/);same(idle,await geometry(p),'offline');
  await undo.click({force:true,timeout:1000}).catch(()=>{});
  const typed=(await onPage(p)).filter(x=>/Offline \d\./.test(x));assert.equal(typed.length,4,'all four sentences are still on the page');
  await p.unroute('**/api/study-draft/save',down);await p.click('.wr-bar [data-wr="retry"]');await quiet(p);
  assert.equal((await wordsOf(other)).filter(x=>/Offline \d\./.test(x)).length,4);
  // Undo asks first
  await undo.click();await p.waitForSelector('[data-wr-undo]:not([hidden])');
  assert.match(await p.textContent('[data-wr-undo]'),/This takes back 4 paragraphs saved at \d\d:\d\d\./);same(idle,await geometry(p),'asking');
  assert.equal((await wordsOf(other)).filter(x=>/Offline \d\./.test(x)).length,4,'nothing is taken back until he chooses');
  await p.click('[data-wr-undo] [data-wr="undo-yes"]');await p.waitForSelector('.wr-bar [data-wr="putback"]:not([hidden])');
  assert.deepEqual(await wordsOf(other),before);assert.deepEqual(await onPage(p),before);same(idle,await geometry(p),'taken back, Put back offered');
  assert.match(await p.textContent('.wr-bar [data-wr-saved], .wr-bar [data-wr-saved-s]'),/Taken back/);
  // a reload straight after Undo keeps them; Put back brings them back exactly
  await p.reload();await p.waitForSelector('.wr-ed');await p.waitForSelector('.wr-bar [data-wr="putback"]:not([hidden])');
  same(idle,await geometry(p),'after a reload');
  await p.click('.wr-bar [data-wr="putback"]');await quiet(p);
  assert.deepEqual((await wordsOf(other)).filter(x=>/Offline \d\./.test(x)),typed);assert.deepEqual((await onPage(p)).filter(x=>/Offline \d\./.test(x)),typed);
  same(idle,await geometry(p),'put back');
  await ctx.close();
 });
}
await check('a second Undo never writes over the words the first took back: both stay on the device and in Copy all my words',async()=>{
 const {p,ctx}=await open(sub);
 const undoNow=async()=>{await p.evaluate(()=>document.activeElement?.blur());await p.click('.wr-tools [data-wr="undo"]');
  await p.waitForFunction(()=>!document.querySelector('[data-wr-undo]').hidden||!document.querySelector('.wr-bar [data-wr="putback"]').hidden,null,{timeout:10000});
  if(await p.isVisible('[data-wr-undo] [data-wr="undo-yes"]'))await p.click('[data-wr-undo] [data-wr="undo-yes"]');
  await p.waitForSelector('.wr-bar [data-wr="putback"]:not([hidden])');};
 const settledText=p=>p.waitForFunction(()=>/^(Saved|Taken back)/.test(document.querySelector('.wr-bar [data-wr-saved]')?.textContent||''),null,{timeout:30000});
 await caretAtEnd(p,'.wr-ed');await p.keyboard.type(' First taken back.',{delay:5});await p.waitForTimeout(1900);await settledText(p);
 await undoNow();
 await p.evaluate(()=>{const el=document.querySelectorAll('.wr-ed')[2];el.focus();el.setSelectionRange(el.value.length,el.value.length);});
 await p.keyboard.insertText(' Second taken back.');await p.evaluate(()=>document.activeElement.blur());await p.waitForTimeout(1900);await settledText(p);
 await undoNow();
 assert.doesNotMatch((await wordsOf(sub)).join(' '),/First taken back|Second taken back/);
 await p.route('**/api/study-draft/save',r=>r.abort());
 await caretAtEnd(p,'.wr-ed');await p.keyboard.type(' z',{delay:5});
 await p.waitForSelector('[data-wr-fail]:not([hidden]) [data-wr="copy"]',{timeout:20000});
 await p.click('[data-wr-fail] [data-wr="copy"]');await p.waitForFunction(()=>/Copied all/.test(document.body.innerText),null,{timeout:5000});
 const clip=await p.evaluate(()=>navigator.clipboard.readText());
 assert.match(clip,/First taken back\./);assert.match(clip,/Second taken back\./);
 await p.unroute('**/api/study-draft/save');await ctx.close();
});
await browser.close();await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});
console.log(results.join('\n'));console.log(`# pass ${results.length-failed}\n# fail ${failed}`);
process.exit(failed?1:0);
