// Home has one list of what needs Adrian (4 November 2026). The older "Needs your decision" box is gone: the decisions
// about his own editorial work (angle, title, marked passages, carousel words, marked wording) are "Only you" rows in
// the Needs you list. Nothing they showed may drop out, and none of them can apply itself.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
const ask=(over={})=>({id:'11111111-1111-4111-8111-111111111111',band:'only-adrian',question:'Who is this piece for?',about:'Tea Teacher',choices:['Tea drinker','Maker'],scope:null,link:null,default:null,applyAt:null,status:'open',raisedBy:'agent:claude-code',raisedClient:'cli',raisedAt:new Date().toISOString(),resolution:null,earlier:0,...over});
async function home({asks=[],decisions={state:'ready',items:[],note:''}}={}){
 const dom=new JSDOM('<dialog id="project-library" open><div class="ht-home-main"></div></dialog>',{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>({asks,counts:null})});
 w.current=()=>({id:'p'});w.c3WorkbenchFrame={decisionAsks:()=>decisions};
 w.eval(read('needs-you.js'));await w.needsYou.load();
 return {w,d:w.document,band:()=>w.document.querySelector('.ny-band'),close:()=>w.close()};
}
const decisions=(...items)=>({state:'ready',note:'',items:items.map((item,i)=>({kind:'decision',key:'k'+i,subject:'Tea Teacher',step:'Direction',detail:'',canOpen:true,...item}))});

test('decisions about his own editorial work are Only you rows in the Needs you list, next to what agents asked',async()=>{
 const x=await home({asks:[ask()],decisions:decisions({label:'Choose an angle'},{label:'Review marked passages',detail:'10 pending passages',step:'Audience'})});
 try{
  const band=x.band();assert.ok(band);assert.equal(x.d.querySelectorAll('.ny-band').length,1);
  assert.equal(band.querySelector('.ny-title').textContent,'Needs you');
  assert.match(band.querySelector('.ny-sub').textContent,/3 only you can decide/);
  const rows=[...band.querySelectorAll('.ny-ask')];assert.equal(rows.length,3);
  const mine=rows.filter(r=>r.dataset.nyDecision);assert.equal(mine.length,2);
  for(const row of mine){assert.equal(row.dataset.band,'only-adrian');assert.equal(row.querySelector('.ny-tag').textContent,'Only you');assert.match(row.querySelector('.ny-foot').textContent,/Nothing applies on its own/);assert.equal(row.querySelector('[data-ny-choice]'),null,'no answer buttons: it opens the step where he decides');}
  assert.match(mine[0].textContent,/Choose an angle/);assert.match(mine[0].textContent,/Tea Teacher/);assert.match(mine[0].querySelector('button').textContent,/Open it in Direction/);
  assert.equal(mine[0].querySelector('button').dataset.wbfAuthorDecision,'k0');assert.match(mine[1].textContent,/10 pending passages/);
  assert.doesNotMatch(x.d.body.textContent,/Needs your decision/);
 }finally{x.close();}
});
test('the marked-wording review opens through its own hook, and an unopenable decision is shown but off',async()=>{
 const x=await home({decisions:decisions({kind:'wording-review',key:'wr',label:'Review marked wording · 10 highlights',step:'Audience'},{label:'Review Carousel words',canOpen:false})});
 try{const [wording,words]=[...x.band().querySelectorAll('[data-ny-decision]')];
  assert.equal(wording.querySelector('button').dataset.wbfWordingReview,'wr');assert.equal(wording.querySelector('button').disabled,false);
  assert.match(words.textContent,/Review Carousel words/);assert.equal(words.querySelector('button').disabled,true);
 }finally{x.close();}
});
test('a partial read still lists the confirmed decisions and says the rest could not be read, never "nothing waits"',async()=>{
 const x=await home({decisions:{...decisions({label:'Review Carousel words'}),state:'unavailable',note:'Some editorial decisions could not be read. The confirmed items above remain waiting.'}});
 try{const text=x.band().textContent;assert.match(text,/Review Carousel words/);assert.match(text,/could not be read/);assert.doesNotMatch(text,/Nothing needs you right now/);
 }finally{x.close();}
 const reading=await home({decisions:{state:'reading',items:[],note:'Reading saved editorial decisions…'}});
 try{assert.match(reading.band().textContent,/Reading saved editorial decisions/);assert.doesNotMatch(reading.band().textContent,/Nothing needs you right now/);}finally{reading.close();}
 const failedRead=await home({decisions:{state:'unavailable',items:[],note:'Editorial decisions could not be read. Reopen this subject to check them.'}});
 try{assert.match(failedRead.band().textContent,/could not be read/);}finally{failedRead.close();}
});
test('with no asks and no decisions the list is honestly empty',async()=>{
 const x=await home();try{assert.match(x.band().textContent,/Nothing needs you right now/);assert.equal(x.band().querySelector('.ny-ask'),null);}finally{x.close();}
});
test('the decisions are listed even when the asks list cannot be read',async()=>{
 const dom=new JSDOM('<dialog id="project-library" open><div class="ht-home-main"></div></dialog>',{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
 w.fetch=async()=>({ok:false,status:500,json:async()=>({error:'The list could not be read or saved.'})});w.c3WorkbenchFrame={decisionAsks:()=>decisions({label:'Choose a title'})};
 w.eval(read('needs-you.js'));await w.needsYou.load();
 try{const text=w.document.querySelector('.ny-band').textContent;assert.match(text,/Choose a title/);assert.match(text,/The list could not be read/);}finally{w.close();}
});
test('a decision past the first four stays behind Show all, counted, not dropped',async()=>{
 const x=await home({decisions:decisions(...Array.from({length:6},(_,i)=>({label:'Decision '+i})))});
 try{assert.equal(x.band().querySelectorAll('[data-ny-decision]').length,4);const more=x.band().querySelector('[data-ny-all]');assert.match(more.textContent,/Show all 6/);more.click();assert.equal(x.band().querySelectorAll('[data-ny-decision]').length,6);
 }finally{x.close();}
});
