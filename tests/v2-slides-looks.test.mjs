import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

// Version two, piece 5: the slide studio and the Looks page. Invented words only. The screens run in a DOM against a
// stand-in for v2 that answers each command from a table, so what they send can be checked.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),read=f=>fs.readFileSync(path.join(repo,'public/v2/screens',f),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const settle=(ms=30)=>new Promise(r=>setTimeout(r,ms));

test('the four files follow the rules of the screens', () => {
 for (const f of ['slides.js','looks.js','slides.css','looks.css']) {
  const t=read(f);
  assert.ok(!/—/.test(t), f+' has an em dash');
  if (f.endsWith('.js')) {
   assert.ok(!/\bfetch\s*\(/.test(t), f+' calls fetch for a command');
   assert.ok(!/localStorage|sessionStorage/.test(t), f+' keeps a record in the browser');
   assert.ok(!/SpeechRecognition|webkitSpeech|getUserMedia|MediaRecorder/.test(t), f+' has a speech button');
  } else {
   const sizes=[...t.replace(/\/\d+(?:\.\d+)?px/g,'').matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?px)/g)].map(m=>m[1]);
   assert.deepEqual(sizes.filter(s=>!['12px','13px','14px','15px','18px','22px'].includes(s)), [], f+' uses a size outside the six');
   assert.ok(!/#[0-9a-f]{3,8}\b/i.test(t.replace(/\/\*[\s\S]*?\*\//g,'')), f+' hard-codes a colour');
   for (const rule of t.replace(/\/\*[\s\S]*?\*\//g,'').split('}')) {
    const sel=rule.split('{')[0].trim();
    if (sel&&!sel.startsWith('@')&&!/^(\s*\d|\s*from|\s*to)/.test(sel)&&!rule.includes('@font-face')) assert.ok(/\.(sl|lk)\b/.test(sel), f+': "'+sel.slice(0,60)+'" is not scoped');
   }
  }
 }
});

/** A DOM with the screen mounted. `answers`: command -> value or function(input). Returns the page and the call log. */
async function mountScreen(file, answers, params={}, query={}) {
 const dom=new JSDOM('<!doctype html><div id="main"></div>',{url:'http://local.test/v2/index.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;windows.push(w);const calls=[],messages=[];let def=null;
 delete w.IntersectionObserver;
 w.fetch=()=>Promise.reject(new Error('no fetch'));
 w.v2={screen:d=>{def=d;},href:(r,p={},q)=>'#/'+r.replace(/:(\w+)/g,(_,k)=>p[k])+(q?'?'+new URLSearchParams(q):''),
  call:async(name,input={})=>{calls.push({name,input});const a=answers[name];if(a===undefined)throw Object.assign(new Error('Unknown '+name),{kind:'refused'});return typeof a==='function'?a(input):JSON.parse(JSON.stringify(a));},
  expect:r=>({expectedRevision:r?.revision??0,...(r?.hash?{expectedHash:r.hash}:{})}),isHuman:()=>true,actorName:a=>a,brand:()=>{},
  ui:{esc,icon:()=>'',ring:()=>'',notBuilt:t=>'<p data-not-built>'+esc(t)+'</p>',say:t=>{messages.push(t);return ()=>{};},undo:t=>{messages.push(t);},reorder:()=>()=>{},sheet:()=>({})}};
 w.eval(read(file));
 const el=w.document.getElementById('main');el.innerHTML=def.render({});
 const aborter=new w.AbortController();
 await def.mount(el,{params,query,signal:aborter.signal,setTitle(){},setAdvanced(){},on(){return ()=>{};}});
 await settle();
 return {w,el,calls,messages,doc:w.document};
}

const frame=(templateId,text,role='inner',photos=['P1'])=>({templateId,role,words:[{lineId:'L1',text}],label:'',credit:'',photos:photos.map(p=>({photoId:p,x:50,y:50}))});
const planOf=()=>({id:'11111111-1111-4111-8111-111111111111',revision:3,hash:'h3',subject:'',title:'An invented plan',drawnIn:{id:'teajia'},account:{id:'teajia',name:'Teajia'},ready:{},
 material:{photos:[{id:'P1',sourceId:'s1',caption:'Invented rows'},{id:'P2',sourceId:'s2',caption:'Invented bench'}]},
 layouts:{carousel:{storyId:'S1',frames:[frame('T1','Words one','cover'),frame('T2','Words two'),frame('T3','Words three')]}}});
const tpl=(id,code,row='C',extra={})=>({id,code,name:'Layout '+code,formats:['carousel'],photos:1,roles:['cover','inner'],textParts:1,maxChars:400,rowLetter:row,row:'Row '+row,...extra});
const commonAnswers=plan=>({
 'instagram.plan.get':plan,
 'instagram.templates':{templates:[tpl('T1','C1'),tpl('T2','C2'),tpl('T3','S1','S'),tpl('T4','S2','S')]},
 looks:{looks:[{id:'teajia',name:'Teajia',drawable:true},{id:'art',name:'Art',drawable:true}]},
 look:{id:'teajia',name:'Teajia',revision:0,hash:'x',roles:{dark:{ground:'#111111',headline:'#eeeeee',accent:'#aa8844'},light:{ground:'#eeeeee',headline:'#111111',accent:'#886622'},logo:{dark:'',light:'',wordmark:'inv'},fonts:{}},text:'---\nname: Teajia\n---\n\n## Do\'s and Don\'ts\n\n- **Do** keep it calm.\n- **Don\'t** use italics.\n',wanted:[]},
 'look.assets':{assets:[{id:'wm',name:'Invented wordmark',kind:'logo'}]},
 accounts:{accounts:[{id:'teajia',name:'Teajia',service:'instagram',looks:['teajia']}],forLook:['teajia']},
 templates:{templates:[],next:{}},'instagram.plans':{plans:[]}});

test('the studio draws the slides, the layouts and the panel from the plan, and never offers to write his words', async () => {
 const plan=planOf(),{doc,calls}=await mountScreen('slides.js',commonAnswers(plan),{id:plan.id});
 assert.equal(doc.querySelectorAll('.sl-thumb').length,3);
 assert.ok(doc.querySelector('.sl-big iframe').getAttribute('src').startsWith('/api/instagram/render?'));
 assert.ok(doc.querySelectorAll('.sl-tile').length>=2, 'layouts are offered');
 assert.equal([...doc.querySelectorAll('[data-sl="ptab"]')].map(b=>b.textContent).join(),'Layout,Photographs,Add,Words');
 doc.querySelector('[data-sl="ptab"][data-id="words"]').click();
 assert.ok(doc.querySelector('.sl-field').textContent==='Words one');
 assert.equal(doc.querySelectorAll('.sl-pbody textarea, .sl-pbody [contenteditable]').length,0,'words are read-only');
 assert.ok(!doc.querySelector('[data-region="head"] button[aria-label*="peak" i]'),'no speech button');
 assert.ok(calls.every(c=>!/save|write/.test(c.name)));
});

test('using a layout, mixing and moving a slide send the whole plan to instagram.layout and keep his words exactly', async () => {
 const plan=planOf(),sent=[];
 const answers={...commonAnswers(plan),'instagram.layout':input=>{sent.push(input);const next=planOf();next.revision++;next.layouts.carousel.frames=input.frames;return next;}};
 const {doc,messages}=await mountScreen('slides.js',answers,{id:plan.id});
 doc.querySelector('.sl-tile[data-id="T4"]').click();await settle();
 assert.equal(sent.length,1);
 assert.equal(sent[0].frames[0].templateId,'T4');assert.equal(sent[0].frames.map(f=>f.words[0].text).join('|'),'Words one|Words two|Words three');
 assert.equal(sent[0].expectedRevision,3);assert.equal(sent[0].storyId,'S1');
 assert.ok(messages.some(m=>/Slide 1 is now S2/.test(m)));
 doc.querySelector('[data-sl="mix"]').click();await settle();
 assert.equal(sent.length,2);
 const ids=sent[1].frames.map(f=>f.templateId);
 assert.notEqual(ids[0],ids[1]);assert.notEqual(ids[1],ids[2]);
 assert.equal(sent[1].frames.map(f=>f.words[0].text).join('|'),'Words one|Words two|Words three');
});

test('a photograph for a slide is one of the plan\'s own, set through instagram.layout', async () => {
 const plan=planOf(),sent=[];
 const answers={...commonAnswers(plan),'instagram.layout':input=>{sent.push(input);const n=planOf();n.revision=4;n.layouts.carousel.frames=input.frames;return n;}};
 const {doc}=await mountScreen('slides.js',answers,{id:plan.id});
 doc.querySelector('[data-sl="ptab"][data-id="photos"]').click();
 doc.querySelector('.sl-photo[data-id="P2"]').click();await settle();
 assert.equal(sent[0].frames[0].photos.map(p=>p.photoId).join(),'P2');
});

test('a plan with no Carousel says so and points to Advanced', async () => {
 const plan=planOf();delete plan.layouts.carousel;
 const {doc}=await mountScreen('slides.js',commonAnswers(plan),{id:plan.id});
 assert.ok(doc.querySelector('[data-not-built]'));assert.ok(doc.querySelector('a[href*="instagram="]'));
});

test('Looks shows a tab per look, its colours with role names, its rules and its assets', async () => {
 const {doc}=await mountScreen('looks.js',commonAnswers(planOf()),{});
 assert.equal([...doc.querySelectorAll('.lk-pills button[data-id]')].map(b=>b.textContent).join(),'Teajia,Art');
 assert.ok(/Boxes and bands/.test(doc.querySelector('.lk-sws').textContent));
 assert.equal(doc.querySelectorAll('.lk-sws code').length,10);
 assert.equal([...doc.querySelectorAll('.lk-rules li')].map(l=>l.textContent).join('|'),'Do keep it calm.|Don\'t use italics.');
 assert.equal(doc.querySelectorAll('.lk-assets li').length,1);
 assert.ok(doc.querySelector('[data-lk="asset-open"]'));
});

test('importing a look shows every guess, lets one be corrected, and saves only the corrected text', async () => {
 const saved=[];
 const text='---\nname: Grove\ncolors:\n  a: "#101010"\n  b: "#f0f0f0"\n---\n# slides: x\nslides:\n  dark:\n    ground: "{colors.a}"\n    headline: "{colors.b}"\n';
 const answers={...commonAnswers(planOf()),'look.import':{id:'grove',name:'Grove',text,keptOwnSlides:false,guesses:[{role:'dark.ground',value:'{colors.a}',why:'It is the darkest.'},{role:'dark.headline',value:'{colors.b}',why:'It reads best.'}]},
  'look.save':i=>{saved.push(i);return {id:i.id};}};
 const {doc,w}=await mountScreen('looks.js',answers,{});
 doc.querySelector('[data-lk="import"]').click();
 doc.querySelector('[name="text"]').value=text;
 doc.querySelector('[data-lk-form="read"]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(doc.querySelectorAll('.lk-guesses li').length,2);
 assert.ok(/It is the darkest/.test(doc.querySelector('.lk-guesses').textContent));
 const g=doc.querySelector('[data-lk="guess"][data-i="0"]');g.value='#202020';g.dispatchEvent(new w.Event('input',{bubbles:true}));
 doc.querySelector('[data-lk-form="save"]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(saved.length,1);assert.equal(saved[0].id,'grove');
 assert.ok(/ground: "#202020"/.test(saved[0].text));assert.ok(/headline: "\{colors\.b\}"/.test(saved[0].text));
});

test('a look with nothing set says so and offers the import', async () => {
 const answers={...commonAnswers(planOf()),look:{id:'bare',name:'Bare',revision:0,text:'',roles:null,wanted:[]}};
 const {doc}=await mountScreen('looks.js',answers,{});
 assert.ok(/Nothing is set for this look/.test(doc.querySelector('.lk-empty').textContent));
 assert.ok(doc.querySelector('.lk-empty [data-lk="import"]'));
});

test('an import must be given a name no other look has, and the name is written into what is saved', async () => {
 const saved=[];
 const text='---\nname: Art\ncolors:\n  a: "#101010"\n  b: "#f0f0f0"\n---\nslides:\n  dark:\n    ground: "{colors.a}"\n';
 const answers={...commonAnswers(planOf()),'look.import':{id:'grove',name:'Art',text,guesses:[]},'look.save':i=>{saved.push(i);return {id:i.id};}};
 const {doc,w}=await mountScreen('looks.js',answers,{});
 doc.querySelector('[data-lk="import"]').click();doc.querySelector('[name="text"]').value=text;
 doc.querySelector('[data-lk-form="read"]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 doc.querySelector('[data-lk-form="save"]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(saved.length,0);assert.ok(/already called "Art"/.test(doc.querySelector('.lk-bad').textContent));
 doc.querySelector('[data-lk-form="save"] [name="name"]').value='Grove';
 doc.querySelector('[data-lk-form="save"]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(saved.length,1);assert.ok(/^name: "Grove"$/m.test(saved[0].text));
});

test('an account is saved with its handle and link, and a refused link is explained in the form', async () => {
 const sent=[];
 const answers={...commonAnswers(planOf()),'account.save':i=>{sent.push(i);if(i.link==='nope')throw Object.assign(new Error('The link must be a web address.'),{kind:'refused'});return {id:'x'};}};
 const {doc,w}=await mountScreen('looks.js',answers,{});
 doc.querySelector('[data-lk="acct-open"]').click();
 const form=()=>doc.querySelector('[data-lk-form="acct"]');
 form().querySelector('[name="name"]').value='Invented account';form().querySelector('[name="handle"]').value='@inv';form().querySelector('[name="link"]').value='nope';
 form().dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(sent[0].link,'nope');assert.equal(sent[0].handle,'@inv');
 assert.ok(/web address/.test(doc.querySelector('.lk-bad').textContent));
});

test('rules come from the Do\'s and Don\'ts section, whether it holds a list or only prose', async () => {
 for (const body of ['## Do\'s and Don\'ts\n\n### Do:\n\n- **Do** keep it calm.\n\n### Don\'t:\n\n- **Don\'t** crowd it.\n','## Do\'s and Don\'ts\n\nKeep it calm.\nLeave room.\n']) {
  const answers=commonAnswers(planOf());answers.look.text='---\nname: T\n---\n\n'+body;
  const {doc}=await mountScreen('looks.js',answers,{});
  assert.ok(doc.querySelectorAll('.lk-rules li').length>=2,body.slice(0,40));
 }
});

test('the layout panel switches between layouts that suit the slide, all of them and his own', async () => {
 const plan=planOf(),answers=commonAnswers(plan);
 answers['instagram.templates']={templates:[tpl('T1','C1'),tpl('T2','C2'),tpl('T3','S1','S'),tpl('T9','S9','S',{owner:true,status:'kept',looks:null})]};
 const {doc}=await mountScreen('slides.js',answers,{id:plan.id});
 const labels=()=>[...doc.querySelectorAll('[aria-label="Which layouts"] button')].map(b=>b.textContent.trim().replace(/\s+/g,' ')).join('|');
 assert.ok(/^Suits this slide\|All \d\|Yours \u00b7 1$/.test(labels()),labels());
 doc.querySelector('[data-sl="lset"][data-id="yours"]').click();
 assert.equal(doc.querySelectorAll('.sl-tile').length,1);
});

test('the studio bar, caption row and panel follow the sample: star, Make a layout, say line above the tabs, no account names as looks', async () => {
 const plan=planOf(),{doc}=await mountScreen('slides.js',commonAnswers(plan),{id:plan.id});
 assert.ok(doc.querySelector('.sl-bar .sl-seg[aria-label="Look"]'),'the look switch is in the bar');
 assert.ok(doc.querySelector('[data-sl="fav"]')&&doc.querySelector('[data-sl="make"]'),'the star and Make a layout are there');
 assert.ok(doc.querySelector('[data-sl="save-open"]'));
 const panel=doc.querySelector('[data-region="panel"]');
 assert.ok(panel.querySelector('.sl-say')&&panel.querySelector('.sl-say').compareDocumentPosition(panel.querySelector('.sl-ptabs'))&4,'the say line sits above the tabs');
 assert.ok(!doc.querySelector('[data-sl="filter"]'),'the layout search is gone');
});

test('Looks has the sample blocks: New look, files, Posts to, Slide templates, What Claude knows you like, Used by', async () => {
 const {doc}=await mountScreen('looks.js',commonAnswers(planOf()),{});
 assert.ok(/New look/.test(doc.querySelector('.lk-add').textContent));
 assert.ok(doc.querySelector('.lk-files')&&doc.querySelector('.lk-acct'));
 const t=doc.querySelector('.lk-body').textContent;
 for (const w of ['Slide templates','What Claude knows you like','Used by','Rules Claude follows','Change it by talking','Open the folder']) assert.ok(t.includes(w),w);
 assert.ok(/not built yet/.test(t),'the unbuilt block says so');
});
