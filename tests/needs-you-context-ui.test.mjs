import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';
const row=(extra={})=>({id,band:'only-adrian',question:'Two passages need review.',about:'Potter visit',choices:['Done'],scope:{kind:'recording-check',id},link:{label:'Check it',href:'/transcript-check/index.html?job='+id},status:'open',raisedBy:'cron:transcript-check',raisedAt:new Date().toISOString(),recording:{jobId:id,title:'Potter visit',recordedAt:null,wordCount:1,passageCount:1,wordsHref:'/document-study/index.html#words/check/'+id,transcriptHref:'/transcript-check/index.html?job='+id,items:[{kind:'word',text:'We visited Lu Yo at the kiln.',proposed:'Lu Yu',reason:'A confirmed spelling was heard differently.',start:12,end:18,audioUrl:'/transcription/'+id+'/audio#t=11,19'}]},...extra});
async function home(asks=[row()]){
 const dom=new JSDOM('<dialog id="project-library" open><div class="ht-home-main"></div></dialog>',{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>({asks,counts:null})});w.eval(read('needs-you.js'));await w.needsYou.load();
 return {w,d:w.document,close:()=>w.close()};
}
test('recording review gives source passage, proposal, reason and bounded audio beside both owner links',async()=>{
 const x=await home();try{
  const card=x.d.querySelector('.ny-ask');assert.match(card.textContent,/We visited Lu Yo at the kiln/);assert.match(card.textContent,/Lu Yu/);assert.match(card.textContent,/confirmed spelling/);
  assert.equal(card.querySelector('audio')?.getAttribute('src'),'/transcription/'+id+'/audio#t=11,19');assert.ok(card.querySelector('audio').controls);
  assert.equal(card.querySelector('[data-ny-choice="Done"]'),null,'queue cannot pretend editorial review is complete');
  assert.equal(card.querySelector('a[href="/document-study/index.html#words/check/'+id+'"]')?.textContent.trim(),'Review 1 word');
  assert.equal(card.querySelector('a[href="/transcript-check/index.html?job='+id+'"]')?.textContent.trim(),'Review 1 passage');
 }finally{x.close();}
});
test('unavailable recording audio is explicit and source text remains escaped',async()=>{
 const a=row();a.recording.items[0]={...a.recording.items[0],text:'<img src=x onerror=alert(1)>',audioUrl:null};
 const x=await home([a]);try{assert.match(x.d.querySelector('.ny-ask').textContent,/Audio unavailable/);assert.equal(x.d.querySelector('.ny-ask img'),null);assert.equal(x.d.querySelector('.ny-ask audio'),null);}finally{x.close();}
});
test('a background refresh does not interrupt playing review audio; errors offer a useful status',async()=>{
 const a=row(),x=await home([a]);try{
  const audio=x.d.querySelector('audio');assert.ok(audio,'review has audio');Object.defineProperty(audio,'paused',{value:false,configurable:true});audio.currentTime=14;
  a.question='A newer queue summary';await x.w.needsYou.load();assert.equal(x.d.querySelector('audio'),audio);assert.equal(audio.currentTime,14);
  Object.defineProperty(audio,'paused',{value:true,configurable:true});audio.dispatchEvent(new x.w.Event('error'));
  assert.match(x.d.querySelector('.ny-ask').textContent,/Audio could not be played/);
 }finally{x.close();}
});
test('listening starts at the contextual range and stops after it',async()=>{
 const x=await home();try{
  const audio=x.d.querySelector('audio');assert.ok(audio);audio.currentTime=0;
  Object.defineProperty(audio,'paused',{value:false,configurable:true});audio.dispatchEvent(new x.w.Event('play'));
  assert.equal(audio.currentTime,11,'play seeks to the supplied surrounding context');
  let pauses=0;audio.pause=()=>{pauses++;};audio.currentTime=19;audio.dispatchEvent(new x.w.Event('timeupdate'));
  assert.equal(pauses,1,'playback stops at the supplied end rather than continuing through the whole recording');
 }finally{x.close();}
});
test('ordinary questions keep their existing exact answer buttons',async()=>{
 const a=row({recording:null,scope:null,link:null,choices:['Keep','Change']});const x=await home([a]);try{assert.equal(x.d.querySelectorAll('[data-ny-choice]').length,2);assert.equal(x.d.querySelector('audio'),null);}finally{x.close();}
});
test('Words review exposes context and audio without expandable recording cards',async()=>{
 const dom=new JSDOM('<dialog id="project-library" open></dialog><dialog id="words-library" open></dialog>',{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
 w.fetch=async url=>({ok:true,json:async()=>url.includes('/checks')?{recordings:[{jobId:id,open:1}]}:url.includes('/check?')?{jobId:id,story:'Potter visit',open:1,items:[{key:'near-match:lu yo',status:'open',kind:'near-match',kindLabel:'Confirmed spelling',word:'Lu Yo',suggestion:'Lu Yu',sentence:'We visited Lu Yo at the kiln.',start:12,end:18,time:'0:12',audioUrl:'/transcription/'+id+'/audio#t=11,19'}]}:{entries:[],counts:{total:1}}});
 w.eval(read('words-library.js'));await w.wordsLibrary.load();try{
  assert.equal(w.document.querySelector('#words-library details[data-wl-rec]'),null);assert.match(w.document.querySelector('[data-wl-rec]').textContent,/We visited Lu Yo/);assert.ok(w.document.querySelector('[data-wl-rec] audio[controls]'));
 }finally{w.close();}
});
