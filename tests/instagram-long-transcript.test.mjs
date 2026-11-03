// A 24-minute, 3,000-word invented voice note through the Instagram studio: nothing lost, nothing reworded unlabelled,
// every moment placed, doubtful words confirmed by Adrian only, and each story's claim read back before drafting.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createInstagramStudio} from '../runtime/services/instagram-studio.mjs';
import {deriveLines,deriveMoments,wholeness,detectFlags} from '../runtime/services/instagram-transcript.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const BODY=fs.readFileSync(path.join(repo,'tests/fixtures/instagram-long-voice-note.txt'),'utf8');
const T_ID='11111111-2222-4333-8444-555555555555',T_HASH=crypto.createHash('sha256').update(BODY).digest('hex'),P_ID='21111111-2222-4333-8444-555555555555';
// Entries in the shape of the Teajia tea-term library (invented subset; the real file is read on Adrian's Mac).
const TERMS=[{en:'Celadon',zh:'青瓷',pinyin:'qīng cí',cat:'ceramics',variants:['celadon','qing ci','cellar don']},{en:'Dancong',zh:'单丛',pinyin:'dān cóng',cat:'tea',variants:['dan cong','don cong']},
 {en:'Yixing',zh:'宜兴',pinyin:'yí xīng',cat:'place',variants:['yixing','ee shing']},{en:'Kintsugi',zh:'金缮',pinyin:'jīn shàn',cat:'ceramics',variants:['kintsugi','kinsugi','gold repair']},
 {en:'Jingdezhen',zh:'景德镇',pinyin:'jǐng dé zhèn',cat:'place',variants:['jingdezhen','jing der jen']},{en:'Yancha (Wuyi rock tea)',zh:'岩茶',cat:'tea',variants:['rock tea']}];
const library={snapshot:async(id,{includeBody}={})=>{if(id===T_ID)return {id,hash:T_HASH,path:'/x/voice.txt',text:includeBody?BODY:undefined};if(id===P_ID)return {id,hash:'b'.repeat(64),path:'/x/bowl.jpg'};throw Error('missing');}};
const as=(actor,fn)=>withActor({actor,client:'http'},fn);
const op=()=>crypto.randomUUID(),ADRIAN='human:adrian',AGENT='agent:claude-code';
const stamp=p=>({id:p.id,operationId:op(),expectedRevision:p.revision,expectedHash:p.hash});
const lineStarting=(p,t)=>p.lines.find(l=>l.text.startsWith(t)).id;

test('the whole 24 minutes goes in: every character in a line or a label, numbered moments with their timestamps', () => {
 const {lines,labels}=deriveLines(T_ID,BODY),w=wholeness(BODY,lines,labels);
 assert.ok(w.words>=3000,'a long fixture: '+w.words+' words');
 assert.equal(w.missing,0,'nothing left out');assert.equal(w.inLines+w.inLabels,w.characters);
 for(const l of lines)assert.equal(BODY.slice(l.start,l.end),l.text,'lines are exact slices');
 const moments=deriveMoments(T_ID,BODY,lines);
 const stamps=[...BODY.matchAll(/^\[(\d+):(\d+)\]/gm)].map(m=>+m[1]*60+ +m[2]);
 for(const at of stamps)assert.ok(moments.some(m=>m.at===at&&!m.estimated),'a moment starts at '+at+'s');
 assert.equal(moments.at(-1).at,24*60+21);
 const seen=moments.flatMap(m=>m.lineIds);assert.deepEqual(seen,lines.map(l=>l.id),'every line is in exactly one moment, in order');
 for(const m of moments)assert.equal(BODY.slice(m.start,m.end),m.text,'a moment keeps the exact words');
 assert.ok(moments.every(m=>m.words<=200),'long stretches split into readable moments');
});

test('doubtful words are flagged with the library\'s spelling as a suggestion, never corrected', () => {
 const {lines}=deriveLines(T_ID,BODY),flags=detectFlags(lines,TERMS),heard=k=>flags.filter(f=>f.kind===k).map(f=>f.heard);
 for(const t of ['cellar don','don cong','ee shing','kinsugi'])assert.ok(heard('tea-term').some(h=>h.toLowerCase()===t),t);
 assert.match(flags.find(f=>f.heard==='ee shing').suggestion,/Yixing · 宜兴/);
 assert.ok(!heard('tea-term').includes('rock tea'),'plain English descriptions are not mishearings');
 assert.ok(heard('date').includes('1987')&&heard('date').includes('March')&&heard('date').includes('Saturdays'));
 assert.ok(heard('number').includes('Forty one')&&heard('number').includes('Twelve'));
 assert.ok(!heard('name').includes('Jingdezhen'),'a correctly spelled library term is not a doubtful name');
 assert.ok(!heard('name').includes('Japanese'));
 for(const f of flags){const l=lines.find(x=>x.id===f.lineId);assert.equal(l.text.slice(f.start,f.start+f.heard.length),f.heard);}
});

async function opened(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ig-long-')),s=createInstagramStudio({dataDir:dir,library,teaTerms:TERMS});
 let p=await as(AGENT,()=>s.propose({operationId:op(),title:'The bowl mender',door:'art',material:{transcripts:[{sourceId:T_ID,sourceHash:T_HASH}],photos:[{sourceId:P_ID,caption:'The mended bowl'}]}}));
 const L=t=>lineStarting(p,t);
 p=await as(AGENT,()=>s.propose({...stamp(p),stories:[
  {title:'Every crack is a record',readback:'The mender says a crack is not damage: it is a record of the people who used the bowl, and he mends to keep them.',dish:'A reel in his voice.',spine:[L('I think every crack'),L('When I mend the crack'),L('But for me')],matches:[{photoId:'P1',lineId:L('I think every crack')}]},
  {title:'So it does not stop with me',readback:'He is teaching two students on Saturdays so the craft continues after him.',dish:'A carousel about passing it on.',spine:[L('I want to teach this'),L('So I have started taking two students')],matches:[]},
 ]}));
 return {s,p};
}

test('the coverage map places every moment: used, in a story, saved, skipped, or flagged as not yet placed', async () => {
 let {s,p}=await opened();
 assert.equal(p.coverage.total,p.moments.length);assert.ok(p.coverage.counts.unplaced>0,'unplaced moments are shown, never hidden');
 const placed=new Set(p.coverage.moments.filter(m=>m.status!=='unplaced').map(m=>m.id));
 const rest=p.moments.filter(m=>!placed.has(m.id));
 await assert.rejects(as(AGENT,()=>s.propose({...stamp(p),coverage:[{momentId:rest[0].id,status:'skipped'}]})),e=>e.status===400,'skipping needs a reason');
 p=await as(AGENT,()=>s.propose({...stamp(p),coverage:rest.map((m,i)=>({momentId:m.id,status:i%2?'skipped':'saved',why:i%2?'Interview logistics, not story.':'Strong on its own; another piece.'}))}));
 assert.equal(p.coverage.counts.unplaced,0);
 p=await as(AGENT,()=>s.layout({...stamp(p),storyId:'S1',format:'post'}));
 const used=p.coverage.moments.filter(m=>m.status==='used');assert.ok(used.length>=1);assert.deepEqual(used[0].uses[0],{format:'post',frame:1});
 p=await as(ADRIAN,()=>s.propose({...stamp(p),coverage:[{momentId:rest[0].id,status:'saved',why:'Keep this.'}]}));
 await assert.rejects(as(AGENT,()=>s.propose({...stamp(p),coverage:[{momentId:rest[0].id,status:'skipped',why:'no'}]})),e=>e.status===403,'an agent leaves his marks');
});

test('doubtful words in use block the final yes until Adrian confirms them; his correction may then be quoted', async () => {
 let {s,p}=await opened();
 const L=lineStarting(p,'I went there in March'),line=p.lines.find(l=>l.id===L);
 p=await as(AGENT,()=>s.propose({...stamp(p),stories:[{title:'Celadon',readback:'He learned in Jingdezhen that a mend must hold hot water.',dish:'A post.',spine:[L]}]}));
 p=await as(AGENT,()=>s.layout({...stamp(p),storyId:'S1',format:'story',frames:[{templateId:'AR-S1',words:[{lineId:L,text:line.text.slice(0,line.text.indexOf(','))}]}]}));
 p=await as(ADRIAN,()=>s.choose({...stamp(p),storyId:'S1'}));
 const flag=p.flags.find(f=>f.lineId===L&&f.heard==='March');assert.ok(flag);
 assert.ok(p.flagStatus.find(f=>f.id===flag.id).inUse);
 await assert.rejects(as(ADRIAN,()=>s.ready({...stamp(p),format:'story'})),e=>e.status===409&&/March/.test(e.message));
 await assert.rejects(as(AGENT,()=>s.confirm({...stamp(p),flagId:flag.id,verdict:'as-heard'})),e=>e.status===403,'only Adrian confirms');
 for(const f of p.flags.filter(x=>x.lineId===L))p=await as(ADRIAN,()=>s.confirm({...stamp(p),flagId:f.id,verdict:f.id===flag.id?'corrected':'as-heard',...(f.id===flag.id?{correction:'April'}:{})}));
 p=await as(ADRIAN,()=>s.ready({...stamp(p),format:'story'}));assert.equal(p.ready.story.posted,false);
 assert.ok(p.lines.find(l=>l.id===L).text.includes('March'),'the transcript itself never changes');
 p=await as(AGENT,()=>s.layout({...stamp(p),storyId:'S1',format:'post',frames:[{templateId:'AR-P1',words:[{lineId:L,text:'I went there in April'}]}]}));
 assert.equal(p.layouts.post.frames[0].words[0].corrected,true,'his correction is marked as his');
});

test('captions label every part: his exact quote, a suggested wording beside the original, or a draft', async () => {
 let {s,p}=await opened();const L=lineStarting(p,'I think every crack');
 await assert.rejects(as(AGENT,()=>s.layout({...stamp(p),storyId:'S1',format:'post',caption:'He told me “every crack is a story of a life”.'})),e=>e.status===403,'invented quotation');
 await assert.rejects(as(AGENT,()=>s.layout({...stamp(p),storyId:'S1',format:'post',caption:{parts:[{kind:'quote',lineId:L,text:'Every crack tells a story.'}]}})),e=>e.status===403);
 p=await as(AGENT,()=>s.layout({...stamp(p),storyId:'S1',format:'post',caption:{parts:[{kind:'draft',text:'A morning in a mender\'s workshop.'},{kind:'quote',lineId:L,text:'I think every crack is a record of the hands that used it.'},{kind:'suggested',lineId:L,text:'Every crack records the hands that held it.'}]}}));
 const parts=p.layouts.post.caption.parts;assert.deepEqual(parts.map(x=>x.kind),['draft','quote','suggested']);
 assert.equal(parts[2].original,p.lines.find(l=>l.id===L).text,'a suggested wording carries the original');
 assert.ok(p.coverage.moments.some(m=>m.uses.some(u=>u.caption==='quote')));
});

test('a read-back Adrian says is not what he meant stops drafting, and his words are kept', async () => {
 let {s,p}=await opened();
 await assert.rejects(as(AGENT,()=>s.meaning({...stamp(p),storyId:'S2',verdict:'right'})),e=>e.status===403);
 await assert.rejects(as(ADRIAN,()=>s.meaning({...stamp(p),storyId:'S2',verdict:'not-meant'})),e=>e.status===400,'his own words are required');
 p=await as(ADRIAN,()=>s.meaning({...stamp(p),storyId:'S2',verdict:'not-meant',words:'It is not about students. It is about the box under the counter.'}));
 await assert.rejects(as(AGENT,()=>s.layout({...stamp(p),storyId:'S2',format:'carousel'})),e=>e.status===409&&/box under the counter/.test(e.message));
 const s2=p.stories[1];
 p=await as(AGENT,()=>s.propose({...stamp(p),stories:[p.stories[0],{...s2,readback:'What carries on is the box of broken bowls his uncle left him.'}]}));
 assert.equal(p.stories[1].meaning,null,'a new claim is read back afresh');
 assert.equal(p.meaningLog[0].words,'It is not about students. It is about the box under the counter.');
 await assert.rejects(as(AGENT,()=>s.propose({...stamp(p),stories:[{title:'x',dish:'y',spine:[p.lines[0].id]}]})),e=>e.status===400,'every story carries a read-back');
});

test('over HTTP, words to confirm reach the Needs you list as one Only-Adrian ask that links back', async t => {
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const call=async(p,body,actor=AGENT)=>{const r=await fetch(url+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'http'},body:body&&JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error),{status:r.status});return v;};
 const imp=await call('/api/sources/import',{rootId:'library',folder:'',urls:[],files:[{name:'Invented voice note.txt',content:BODY}]});const src=imp.receipts[0].source;
 let p=await call('/api/instagram/plan',{operationId:op(),title:'The bowl mender',material:{transcripts:[{sourceId:src.id,sourceHash:src.hash}],photos:[]}});
 assert.equal(p.material.transcripts[0].wholeness.missing,0);assert.ok(p.moments.length>=23);
 const L=lineStarting(p,'My uncle closed it in 1987');
 p=await call('/api/instagram/plan',{...stamp(p),stories:[{title:'The box',readback:'His uncle gave him the broken bowls in 1987.',dish:'A story.',spine:[L]}]});
 assert.equal(p.asks.length,1,'one ask for the batch');assert.ok(p.asks[0].askId,p.asks[0].error);
 const list=await call('/api/needs-you?status=open');const ask=(list.asks||list.items||[]).find(a=>a.id===p.asks[0].askId);
 assert.ok(ask,'the ask is on the list');assert.equal(ask.band,'only-adrian');assert.match(ask.link.href,new RegExp('instagram='+p.id));
 await assert.rejects(call('/api/instagram/confirm',{...stamp(p),flagId:p.flags[0].id,verdict:'as-heard'}),e=>e.status===403);
 p=await call('/api/instagram/plan',{...stamp(p),title:'The bowl mender, again'});assert.equal(p.asks.length,1,'no second ask for the same words');
});
