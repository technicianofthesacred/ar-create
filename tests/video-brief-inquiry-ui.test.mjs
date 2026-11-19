import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/video-briefs.js',import.meta.url),'utf8');
const collectionId='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function fixture({linked=true,unavailable=false}={}){
 const dom=new JSDOM('<main data-video-brief-page></main>',{url:`http://localhost/document-study/video-editing.html?subject=hk&brief=${id}`,runScripts:'outside-only'}),w=dom.window,calls=[];
 w.crypto.randomUUID=randomUUID;w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:globalThis.crypto.subtle});
 const brief={id,title:'Invented tea brief',findingId:'finding-steam',quote:'Steam rose.',...(linked?{collectionId}:{})};
 w.fetch=async(url,options={})=>{calls.push({url,options});let value;
  if(url.startsWith('/api/study/video-briefs/inquiry')){Object.assign(brief,{collectionId:JSON.parse(options.body).collectionId});value={brief};}
  else if(url.startsWith('/api/study/video-briefs?'))value={briefs:[brief]};
  else if(url.startsWith('/api/inquiries/catalog')){if(unavailable)return {ok:false,json:async()=>({error:'Library unavailable'})};value={collections:[{id:collectionId,name:'Why the kettle matters',sourceIds:[]}]};}
  else throw Error('Unexpected request '+url);
  return {ok:true,json:async()=>structuredClone(value)};
 };w.eval(code);for(let i=0;i<8;i++)await tick();return {w,dom,calls,brief,close:()=>w.close()};
}
test('a reopened brief exposes its exact saved inquiry without choosing the remembered topic',async()=>{
 const f=await fixture();try{const resume=[...f.w.document.querySelectorAll('a')].find(a=>a.textContent==='Resume inquiry');assert.ok(resume);const url=new URL(resume.href);assert.equal(url.searchParams.get('collection'),collectionId);assert.equal(url.searchParams.get('subject'),'hk');assert.match(f.w.document.body.textContent,/Why the kettle matters/);assert.equal(f.calls.some(c=>c.options.method==='POST'),false);}finally{f.close();}
});
test('linking an existing inquiry pins the brief and never creates a duplicate or edits notes',async()=>{
 const f=await fixture({linked:false});try{const select=f.w.document.querySelector('select[aria-label="Working inquiry"]');assert.ok(select);select.value=collectionId;const button=[...f.w.document.querySelectorAll('button')].find(b=>b.textContent==='Link inquiry');assert.ok(button);button.click();for(let i=0;i<200&&!f.w.document.querySelector('a[href*="collection="]');i++)await new Promise(resolve=>setTimeout(resolve,10));const writes=f.calls.filter(c=>c.options.method==='POST');assert.equal(writes.length,1,f.w.document.body.textContent);assert.equal(writes[0].url,'/api/study/video-briefs/inquiry');const body=JSON.parse(writes[0].options.body);assert.equal(body.id,id);assert.equal(body.expectedCollectionId,null);assert.equal(body.collectionId,collectionId);assert.ok(f.w.document.querySelector('a[href*="collection="]'));}finally{f.close();}
});
test('an unavailable inquiry catalog does not hide the saved quote or exact source action',async()=>{
 const f=await fixture({unavailable:true});try{assert.equal(f.w.document.querySelector('blockquote').textContent,'Steam rose.');assert.ok([...f.w.document.querySelectorAll('a')].some(a=>a.textContent==='Open exact source passage'));assert.match(f.w.document.body.textContent,/Library unavailable/);}finally{f.close();}
});
