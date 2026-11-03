// The Instagram studio: transcript and photos in, two or three stories out, one default layout per format, his words
// exactly as said, and the two decisions (naming the dish, the final yes) left to Adrian. Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createInstagramStudio,deriveLines,secondsFor,hashtags} from '../runtime/services/instagram-studio.mjs';
import {FORMATS,NEW_TEMPLATES,catalog,renderFrame} from '../runtime/services/instagram-templates.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {describeRoutes} from '../runtime/commands.mjs';

const TRANSCRIPT='Invented fixture. Mender: Most old bowls arrive cracked. I think every crack is a record of the hands that used it.\n\nMender: When I sit with one bowl for a whole day, my own day gets quieter.\n\nMender: A mended bowl is like a person who kept going. I want to teach this, so the craft does not stop with me.';
const T_ID='11111111-2222-4333-8444-555555555555',T_HASH=crypto.createHash('sha256').update(TRANSCRIPT).digest('hex');
const PHOTOS=['21111111-2222-4333-8444-555555555555','31111111-2222-4333-8444-555555555555','41111111-2222-4333-8444-555555555555'];
const library={snapshot:async(id,{includeBody}={})=>{if(id===T_ID)return {id,hash:T_HASH,path:'/x/talk.md',text:includeBody?TRANSCRIPT:undefined};const i=PHOTOS.indexOf(id);if(i>=0)return {id,hash:'b'.repeat(64),path:'/x/photo-'+i+'.jpg'};throw Error('missing');}};
const as=(actor,fn)=>withActor({actor,client:'http'},fn);
const op=()=>crypto.randomUUID();
const ADRIAN='human:adrian',AGENT='agent:claude-code';
function fresh(teaTerms=[]){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ig-studio-'));return createInstagramStudio({dataDir:dir,library,teaTerms});}
const material={transcripts:[{sourceId:T_ID,sourceHash:T_HASH}],photos:PHOTOS.map((sourceId,i)=>({sourceId,caption:['The mended bowl','Kettle over coals','By the river'][i]}))};
const stories=lines=>{const id=t=>lines.find(l=>l.text.startsWith(t)).id;return [
 {title:'Every crack is a record',readback:'The mender says cracks are not damage: they record the people who used the bowl.',dish:'A reel about marks of use, in his own voice.',why:'The strongest line, and it turns toward the listener.',reader:'The maker',format:'reel',spine:[id('I think every crack'),id('A mended bowl'),id('I want to teach')],matches:[{photoId:'P1',lineId:id('I think every crack'),why:'The seam is the crack he means.'},{photoId:'P3',lineId:id('I want to teach'),why:'Open water, passing on.'}]},
 {title:'A quieter day',readback:'Spending a whole day with one bowl makes his own day quieter.',dish:'A story about slowing down beside one bowl.',why:'Simple and true; the reader can try it today.',reader:'The daily meditator',format:'story',spine:[id('When I sit')],matches:[{photoId:'P2',lineId:id('When I sit'),why:'The kettle is the slow day.'}]},
];};
async function start(s){
 const created=await as(AGENT,()=>s.propose({operationId:op(),subject:'proj-1',title:'The mender',door:'art',material}));
 return as(AGENT,()=>s.propose({id:created.id,operationId:op(),expectedRevision:created.revision,expectedHash:created.hash,stories:stories(created.lines),gaps:[{question:'Is the gold seam kintsugi, or a local repair?',why:'The caption should name it rightly.',storyIds:['S1']}]}));
}

test('lines are exact slices of the transcript, with speakers read from the page', () => {
 const {lines}=deriveLines(T_ID,TRANSCRIPT);
 for(const l of lines)assert.equal(TRANSCRIPT.slice(l.start,l.end),l.text);
 assert.ok(lines.some(l=>l.speaker==='Mender'&&l.text==='When I sit with one bowl for a whole day, my own day gets quieter.'));
 assert.equal(new Set(lines.map(l=>l.id)).size,lines.length);
 assert.equal(lines[0].text,'Invented fixture.');assert.equal(lines[1].text,'Most old bowls arrive cracked.');assert.equal(lines[1].speaker,'Mender');
 const memo='[00:12] Adrian: Here is the thing: the kettle sings first. Speaker 2: Then what?',m=deriveLines(T_ID,memo).lines;
 assert.deepEqual(m.map(l=>[l.speaker,l.text]),[['Adrian','Here is the thing: the kettle sings first.'],['Speaker 2','Then what?']]);for(const l of m)assert.equal(memo.slice(l.start,l.end),l.text);
 assert.ok(secondsFor('one two three four five')>=2);
 assert.equal(hashtags('slow tea #tea #craft and #kintsugi'),3);
});

test('an agent proposes two or three stories with photos matched to lines; references must be real', async () => {
 const s=fresh(),p=await start(s);
 assert.equal(p.stories.length,2);assert.equal(p.stories[0].origin,'machine');assert.equal(p.gaps[0].status,'open');
 const base={id:p.id,expectedRevision:p.revision,expectedHash:p.hash};
 await assert.rejects(as(AGENT,()=>s.propose({...base,operationId:op(),stories:[...stories(p.lines),...stories(p.lines)]})),e=>e.status===400,'at most three stories');
 await assert.rejects(as(AGENT,()=>s.propose({...base,operationId:op(),stories:[{...stories(p.lines)[0],spine:['L999']}]})),e=>e.status===400);
 await assert.rejects(as(AGENT,()=>s.propose({...base,operationId:op(),stories:[{...stories(p.lines)[0],matches:[{photoId:'P9',lineId:p.lines[0].id}]}]})),e=>e.status===400);
 await assert.rejects(as(AGENT,()=>s.propose({...base,operationId:op(),material:{transcripts:[{sourceId:T_ID,sourceHash:'c'.repeat(64)}],photos:[]}})),e=>e.status===409,'a changed transcript is read again first');
 await assert.rejects(as(AGENT,()=>s.propose({...base,operationId:op(),title:'stale',expectedRevision:p.revision-1})),e=>e.status===409);
});

test('naming the dish and the final yes are Adrian\'s; an agent records only what it heard him say', async () => {
 const s=fresh();let p=await start(s);
 const base=()=>({id:p.id,operationId:op(),expectedRevision:p.revision,expectedHash:p.hash});
 await assert.rejects(as(AGENT,()=>s.choose({...base(),storyId:'S1'})),e=>e.status===403);
 await assert.rejects(as(AGENT,()=>s.propose({...base(),chosen:{storyId:'S1'}})),e=>e.status===403);
 p=await as(AGENT,()=>s.propose({...base(),heard:{storyId:'S1',quote:'Go with the crack one, as a reel.'}}));
 assert.equal(p.heard.storyId,'S1');assert.equal(p.chosen,null,'hearing is not choosing');
 p=await as(AGENT,()=>s.layout({...base(),storyId:'S1',format:'reel',caption:'Every crack is a record. A morning with a bowl mender.'}));
 await assert.rejects(as(AGENT,()=>s.ready({...base(),format:'reel'})),e=>e.status===403);
 await assert.rejects(as(ADRIAN,()=>s.ready({...base(),format:'reel'})),e=>e.status===400,'pick or name the story first');
 p=await as(ADRIAN,()=>s.choose({...base(),storyId:'S1',forWhom:'The maker'}));
 assert.equal(p.chosen.by,ADRIAN);
 p=await as(ADRIAN,()=>s.ready({...base(),format:'reel',caption:'Every crack is a record of the hands that used it.'}));
 assert.equal(p.ready.reel.posted,false,'ready records his yes; nothing is posted');
 assert.equal(p.layouts.reel.captionFinal,'Every crack is a record of the hands that used it.');
 await assert.rejects(as(AGENT,()=>s.layout({...base(),storyId:'S1',format:'reel'})),e=>e.status===409,'an agent cannot change what he said yes to');
});

test('his words stay exactly as said on every frame', async () => {
 const s=fresh();let p=await start(s);
 const base=()=>({id:p.id,operationId:op(),expectedRevision:p.revision,expectedHash:p.hash});
 const line=p.lines.find(l=>l.text.startsWith('I think every crack'));
 const frame=t=>[{templateId:'AR-P1',words:[{lineId:line.id,text:t}],photos:[{photoId:'P1'}]}];
 await assert.rejects(as(AGENT,()=>s.layout({...base(),storyId:'S1',format:'post',frames:frame('I think every crack is a story of the hands that used it.')})),e=>e.status===403);
 await assert.rejects(as(AGENT,()=>s.layout({...base(),storyId:'S1',format:'post',frames:[{...frame(line.text)[0],text:'A nicer headline'}]})),e=>e.status===403);
 await assert.rejects(as(AGENT,()=>s.layout({...base(),storyId:'S1',format:'post',frames:[{...frame(line.text)[0],templateId:'AR-S1'}]})),e=>e.status===400,'a story template is not a post');
 await assert.rejects(as(AGENT,()=>s.layout({...base(),storyId:'S1',format:'post',frames:frame(line.text),caption:'#a #b #c #d #e #f'})),e=>e.status===400,'five hashtags at most');
 p=await as(AGENT,()=>s.layout({...base(),storyId:'S1',format:'post',frames:frame('every crack is a record of the hands that used it')}));
 assert.equal(p.layouts.post.frames[0].words[0].text,'every crack is a record of the hands that used it');
});

test('the default layout is one strong choice per format, within Instagram\'s limits', async () => {
 const s=fresh();let p=await start(s);
 for(const format of ['story','reel','post','carousel']){
  p=await as(AGENT,()=>s.layout({id:p.id,operationId:op(),expectedRevision:p.revision,expectedHash:p.hash,storyId:'S1',format}));
  const l=p.layouts[format],[min,max]=FORMATS[format].frames;
  assert.ok(l.frames.length>=min&&l.frames.length<=max,format);
  for(const f of l.frames){assert.ok(catalog().find(t=>t.id===f.templateId).formats.includes(format));for(const w of f.words)assert.ok(p.lines.find(x=>x.id===w.lineId).text.includes(w.text));}
  const html=await s.render({id:p.id,format,frame:0});assert.match(html,/<!doctype html>/);assert.doesNotMatch(html,/linear-gradient|res\.cloudinary\.com/);
 }
 assert.equal(p.layouts.reel.frames[0].templateId,'AR-R2','a reel opens on its grid-safe cover');
 assert.ok(p.layouts.reel.frames.slice(1).reduce((a,f)=>a+f.seconds,0)<=FORMATS.reel.maxSeconds);
 assert.equal(p.layouts.post.frames[0].templateId,'AR-P1');
 const srt=await s.captions({id:p.id});assert.match(srt,/^1\n00:00:00,000 --> /);assert.ok(srt.includes('I think every crack is a record of the hands that used it.'));
 const teajia=fresh();let q=await start(teajia);
 q=await as(AGENT,()=>teajia.propose({id:q.id,operationId:op(),expectedRevision:q.revision,expectedHash:q.hash,door:'teajia'}));
 q=await as(AGENT,()=>teajia.layout({id:q.id,operationId:op(),expectedRevision:q.revision,expectedHash:q.hash,storyId:'S1',format:'carousel'}));
 assert.ok(q.layouts.carousel.frames.every(f=>!f.templateId.startsWith('AR-')),'the Teajia door keeps its own catalog');
});

test('the four new templates keep their words inside each format\'s safe zone, in his look', () => {
 assert.deepEqual(Object.keys(NEW_TEMPLATES),['AR-S1','AR-R1','AR-R2','AR-P1']);
 const names=new Set(catalog().map(t=>t.name));assert.equal(names.size,catalog().length,'names are distinct from the existing catalog');
 for(const [id,t] of Object.entries(NEW_TEMPLATES))for(const format of t.formats){
  const f=FORMATS[format],b=t.box;
  assert.ok(b.left>=f.safe.left&&f.width-b.right>=f.safe.right&&b.top>=f.safe.top&&f.height-b.bottom>=f.safe.bottom,id+' in '+format);
  if(format==='reel'&&t.roles.includes('cover'))assert.ok(b.top>=f.grid.top&&b.bottom<=f.grid.bottom,id+' title survives the 3:4 grid crop');
  const html=renderFrame(id,{text:'x'.repeat(t.maxChars),label:'By the river',credit:'Mender',photos:[{src:'/api/sources/blob?id=abc',x:40,y:60}]},{index:1,total:4,start:3});
  assert.doesNotMatch(html,/gradient|border:|border-radius|#fff[;"]|#000[;"]/i,id+' has no gradients, borders or pure black and white');
  assert.match(html,/Lora|Cormorant/);
  assert.ok(html.includes('width:'+f.width+'px;height:'+f.height+'px'),id);
 }
 assert.doesNotMatch(renderFrame('AR-S1',{text:'<script>alert(1)</script>',photos:[{src:'https://res.cloudinary.com/x.jpg'}]}),/<script>|cloudinary/,'text is escaped and remote images never render');
});

test('the studio is in the one command registry, with the two decisions marked human', () => {
 const list=describeRoutes({});
 for(const route of ['/api/instagram/templates','/api/instagram/plans','/api/instagram/plan','/api/instagram/layout','/api/instagram/choose','/api/instagram/ready','/api/instagram/render','/api/instagram/sheet','/api/instagram/captions','/api/instagram/png'])assert.ok(list.some(c=>c.route===route),route);
 for(const route of ['/api/instagram/choose','/api/instagram/ready'])assert.deepEqual(list.find(c=>c.route===route).actors,['human'],route);
 assert.deepEqual(list.find(c=>c.route==='/api/instagram/layout').actors,['any']);
 assert.equal(list.find(c=>c.route==='/api/instagram/plan'&&c.method==='POST').section,'outputs');
});
