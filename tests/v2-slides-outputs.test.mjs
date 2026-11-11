import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

// Version two: the slide studio opens an older Outputs carousel read only, at #/slides/<output id>?kind=output&subject=<id>.
// Invented words only. The screen runs in a DOM against a stand-in for v2 that answers each command from a table.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),code=fs.readFileSync(path.join(repo,'public/v2/screens/slides.js'),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const settle=(ms=30)=>new Promise(r=>setTimeout(r,ms));

const PIECE='aaaaaaaa-0000-4000-8000-000000000001',ARTICLE='aaaaaaaa-0000-4000-8000-000000000002';
const slide=(id,text,role='inner',template='M12')=>({id,role,text,credit:'',template,photos:[],paragraphIds:[]});
const carousel=()=>({id:PIECE,kind:'carousel',title:'The lantern night',placements:[],outputRevision:0,caption:'',slides:[slide('s1','The lantern night','cover','H6'),slide('s2','Lanterns went up at dusk.'),slide('s3','The wind came near midnight.'),{...slide('s4','Only string was left.','close'),credit:'A neighbour'}]});
const view=(outputs,owner={kind:'carousel-words',projectId:'p',documentId:'d',outputId:PIECE})=>({outputs,outputBindings:[{outputId:PIECE,wordOwner:owner}]});
const standing={id:'demo-lantern',title:'The lantern night',look:'teajia',facts:{bindingId:'b1'},forms:[{key:'out:'+PIECE,kind:'carousel'}]};

async function mount({answers,params={id:PIECE},query={kind:'output',subject:'demo-lantern'},width=1000}={}) {
 const dom=new JSDOM('<!doctype html><div id="main"></div>',{url:'http://local.test/v2/index.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;windows.push(w);const calls=[];let def=null,adv=null,title=null;
 w.innerWidth=width;delete w.IntersectionObserver;delete w.ResizeObserver;
 w.fetch=()=>Promise.reject(new Error('no fetch'));
 w.IG={T:{H6:{},M12:{}},render:(t,s)=>'<p data-t="'+t+'">'+esc(s.text)+'</p>'};
 w.v2={screen:d=>{def=d;},href:(r,p={},q)=>'#/'+r.replace(/:(\w+)/g,(_,k)=>p[k])+(q&&Object.keys(q).length?'?'+new URLSearchParams(q):''),
  advanced:o=>'/document-study/index.html?subject='+o.subject+'&piece='+o.piece+'&section='+o.section,
  call:async(name,input={})=>{calls.push({name,input});const a=answers[name];if(a===undefined)throw Object.assign(new Error('Unknown '+name),{kind:'refused'});if(a instanceof Error)throw a;return typeof a==='function'?a(input):JSON.parse(JSON.stringify(a));},
  isHuman:()=>true,actor:()=>'human:adrian',actorName:a=>a,brand:()=>{},
  ui:{esc,icon:n=>'<i data-ic="'+n+'"></i>',say(){return ()=>{};},reorder:()=>()=>{}}};
 w.eval(code);
 const el=w.document.getElementById('main');el.innerHTML=def.render({});
 const aborter=new w.AbortController();
 await def.mount(el,{params,query,signal:aborter.signal,setTitle(t){title=t;},setAdvanced(o){adv=o;},on(){return ()=>{};}});
 await settle();
 return {w,doc:w.document,calls,adv:()=>adv,title:()=>title};
}
const ok={'subject.standing':standing,'study.outputs':()=>view([{id:ARTICLE,kind:'article',title:'x'},carousel()])};
const cur=doc=>[...doc.querySelectorAll('.sl-thumb')].findIndex(t=>t.getAttribute('aria-current')==='true');
const key=(w,k)=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));

test('an Outputs carousel opens read only: the slide large, the strip, its real words, and only reads are sent', async () => {
 const {doc,calls,adv,title}=await mount({answers:ok});
 assert.equal(doc.querySelectorAll('.sl-thumb').length,4);
 assert.ok(doc.querySelector('.sl-big iframe').srcdoc.includes('The lantern night'));
 assert.equal(doc.querySelector('.sl-thumb:nth-child(3) iframe').srcdoc.includes('The wind came near midnight.'),true);
 assert.ok(doc.querySelector('.sl-field').textContent==='The lantern night');
 assert.deepEqual(calls.map(c=>c.name),['subject.standing','study.outputs']);
 assert.equal(JSON.stringify(calls[1].input),JSON.stringify({rootBindingId:'b1',parentStudyId:'demo-lantern',selectedOutputId:PIECE}));
 assert.equal(title(),'The lantern night');
 assert.equal(JSON.stringify(adv()),JSON.stringify({subject:'demo-lantern',piece:PIECE,section:'outputs'}));
 assert.equal(doc.querySelectorAll('textarea,input,[contenteditable],[data-sl="mv"],[data-sl="mix"],[data-sl="save-open"]').length,0,'nothing that changes it');
 assert.ok(/read only/i.test(doc.querySelector('.sl-n').textContent));
});

test('the header names the subject and links back; one Open in Advanced lands on this piece', async () => {
 const {doc}=await mount({answers:ok});
 const back=doc.querySelector('.sl-back');
 assert.equal(back.textContent.trim(),'The lantern night');assert.ok(back.getAttribute('href').startsWith('#/subject/demo-lantern'));
 const adv=[...doc.querySelectorAll('a')].filter(a=>/Open in Advanced/.test(a.textContent));
 assert.equal(adv.length,1);
 assert.equal(adv[0].getAttribute('href'),'/document-study/index.html?subject=demo-lantern&piece='+PIECE+'&section=outputs');
 assert.ok(/done in Advanced/.test(doc.querySelector('.sl-ro').textContent));
});

test('keys, buttons, the strip and a swipe move between slides', async () => {
 const {w,doc}=await mount({answers:ok});
 assert.equal(cur(doc),0);
 key(w,'ArrowRight');assert.equal(cur(doc),1);
 assert.ok(doc.querySelector('.sl-field').textContent==='Lanterns went up at dusk.');
 key(w,'End');assert.equal(cur(doc),3);assert.ok(doc.querySelector('[data-sl="next"]').disabled);
 assert.ok(doc.querySelector('.sl-pbody').textContent.includes('A neighbour'));
 key(w,'ArrowLeft');assert.equal(cur(doc),2);key(w,'Home');assert.equal(cur(doc),0);assert.ok(doc.querySelector('[data-sl="prev"]').disabled);
 key(w,'ArrowLeft');assert.equal(cur(doc),0,'it stops at the first slide');
 doc.querySelector('.sl-thumb[data-n="2"]').click();assert.equal(cur(doc),2);
 doc.querySelector('[data-sl="next"]').click();assert.equal(cur(doc),3);
 const big=doc.querySelector('.sl-big');
 const ev=(type,x)=>{const e=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:10});Object.defineProperty(e,'pointerType',{value:'touch'});big.dispatchEvent(e);};
 ev('pointerdown',200);ev('pointerup',60);assert.equal(cur(doc),3,'a swipe left at the last slide stays');
 ev('pointerdown',60);ev('pointerup',200);assert.equal(cur(doc),2,'a swipe right goes earlier');
});

test('an unknown id, a piece that is not a carousel, and a missing subject each say so and offer the way back', async () => {
 let r=await mount({answers:{...ok,'study.outputs':()=>view([carousel()])},params:{id:'nope'}});
 assert.ok(/was not found/.test(r.doc.querySelector('.sl-empty h1').textContent));assert.ok(r.doc.querySelector('.sl-empty a').getAttribute('href').startsWith('#/subject/demo-lantern'));
 r=await mount({answers:{...ok,'study.outputs':()=>view([{id:ARTICLE,kind:'article',title:'x'}])},params:{id:ARTICLE}});
 assert.ok(/not a Carousel/.test(r.doc.querySelector('.sl-empty h1').textContent));assert.ok(/Article/.test(r.doc.querySelector('.sl-empty').textContent));assert.ok(r.doc.querySelector('.sl-empty a'));
 r=await mount({answers:ok,query:{kind:'output'}});
 assert.ok(r.doc.querySelector('.sl-empty a').getAttribute('href')==='#/');assert.equal(r.calls.length,0);
 r=await mount({answers:{...ok,'subject.standing':new Error('The subject could not be read.')}});
 assert.ok(/could not be read/.test(r.doc.querySelector('.sl-empty').textContent));
});

test('without kind=output the screen still reads an Instagram plan and never the Outputs commands', async () => {
 const r=await mount({answers:{'instagram.plan.get':{id:PIECE,layouts:{}}},query:{}});
 assert.deepEqual(r.calls.map(c=>c.name),['instagram.plan.get']);
 assert.ok(r.doc.querySelector('[data-sl-empty]'));
});

test('the new code keeps the screens\' rules', () => {
 assert.ok(!/—/.test(code));assert.ok(!/\bfetch\s*\(/.test(code));
 const css=fs.readFileSync(path.join(repo,'public/v2/screens/slides.css'),'utf8');
 assert.ok(!/—/.test(css));assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css.replace(/\/\*[\s\S]*?\*\//g,'')));
});
