import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

// Version two's Research screens: the hooks they keep, against answers shaped like the research-topics commands'.
// Invented topics and words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v2dir=path.join(repo,'public/v2');
const COMMANDS=[['research-topics','GET','/api/research-topics',true],['research-topics.read','GET','/api/research-topics/read',true],['research-topics.groups','GET','/api/research-topics/groups',true],['research-topics.group','GET','/api/research-topics/group',true],
 ['research-topics.ask','POST','/api/research-topics/ask',true],['research-topics.save','POST','/api/research-topics/save',false],['research-topics.take','POST','/api/research-topics/take',false],['research-topics.let-go','POST','/api/research-topics/let-go',false],['research-topics.undo','POST','/api/research-topics/undo',false],['research-topics.keep','POST','/api/research-topics/keep',false],['research-topics.group.sources','POST','/api/research-topics/group/sources',false],
 ['needs-you','GET','/api/needs-you',true],['subject-places','GET','/api/subject-places',true],['study-draft.catalog','GET','/api/study-draft/catalog',true],['subjects.standing','GET','/api/subjects/standing',true],['research-topics.link','POST','/api/research-topics/link',false],['inquiries.projects','GET','/api/inquiries/projects',true]].map(([name,method,route,readOnly])=>({name,method,route,readOnly,schema:{},actors:['any']}));
const origin={kind:'conversation',label:'Invented recording, 2:10',say:'From a conversation · Invented recording, 2:10',ref:null,at:new Date().toISOString()};
const topic=(over={})=>({id:'p-1111',kind:'proposal',name:'Reed screens and who still makes them',saved:true,revision:1,origin,status:'kept',state:'new',stateSay:'',note:'',groupId:'g-tea',suggestedGroupId:null,sourceCount:2,usedIn:[],hasSomethingToSay:false,waiting:0,madeThisWeek:true,madeForYou:false,...over});
const LIST={schema:'ar-create.research-topics.v1',topics:[topic(),topic({id:'p-2222',name:'Soil under straw',status:'proposed',madeForYou:true,groupId:null,suggestedGroupId:'g-tea',stateSay:'Waiting for you',hasSomethingToSay:true,waiting:1}),topic({id:'p-3333',name:'A topic with a very long name that keeps going and going so that it must wrap on a phone',groupId:null})],
 groups:[{id:'g-tea',name:'Tea: growing',folder:['Research','Tea: growing'],count:1}],counts:{all:3,week:1,saying:1,none:2,gone:0}};
const READ={...topic({status:'proposed',hash:'a'.repeat(64)}),group:{id:'g-tea',name:'Tea: growing',folder:['Research','Tea: growing']},usedIn:[{parentStudyId:'invented-garden',title:'An invented garden',status:'used'}],
 learning:{body:'# Heading the page leaves out\n\nScreens of reed were laid over poles.\n\n## Where it went\n\n- One maker left\n- Two stopped',revision:1,hash:'b'.repeat(64)},
 sources:[{id:'s1',title:'Invented recording',kind:'transcript',missing:false}],said:[{text:'Straw gives a sweeter leaf',agree:['Invented grower'],dispute:['Invented notes'],from:'relationships'},{text:'Shade for three weeks',agree:[],dispute:[],supported:'Two growers say so',uncertain:'Nobody measured it',from:'finding'}],
 spoken:[{quote:'The net only takes the light away.',speaker:'An invented grower',location:'14:48'}],answers:[],findings:[],take:null,waitingNow:[{key:'keep',kind:'keep',title:'Keep this topic?',detail:'From a conversation',choices:['keep','let-go','not-now']}],waitingLeft:[]};
const GROUP={schema:'ar-create.research-group-view.v1',id:'g-tea',name:'Tea: growing',folder:['Research','Tea: growing'],settings:{opensTopics:'propose'},revision:1,hash:'c'.repeat(64),saved:true,
 sources:[{id:'s1',title:'Invented recording',kind:'transcript',missing:false,ticked:true,from:'group',topics:[]},{id:'s2',title:'Invented notes',kind:'note',missing:false,ticked:false,from:'topic',topics:['p-1111']}],topics:[topic()],usedIn:[],ask:{find:true,answers:false}};
const windows=[];after(()=>{for(const w of windows)w.close();});
async function page(hash,{actor=null,answers={}}={}){
 const html=fs.readFileSync(path.join(v2dir,'index.html'),'utf8');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html'+(actor?'?reviewActor='+actor:'')+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 w.EventSource=class{constructor(){}addEventListener(){}close(){}};
 if(!w.HTMLDialogElement.prototype.showModal)w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 const table={'/api/subjects/standing':{subjects:[{id:'invented-garden',title:'An invented garden',archived:false},{id:'invented-old',title:'An old one',archived:true}]},'/api/research-topics':LIST,'/api/research-topics/read':READ,'/api/research-topics/groups':{groups:LIST.groups},'/api/research-topics/group':GROUP,'/api/research-topics/ask':{query:'reed',scope:{kind:'everything'},found:[{sourceId:'s1',title:'Invented recording',quote:'reed screens over poles'}],atlas:[],ability:{answers:false},said:'These are the places your sources use these exact words.'},...answers};
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href);calls.push({path:u.pathname+u.search,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  const answer=u.pathname==='/api/capabilities'?{commands:COMMANDS}:table[u.pathname]??{};const [status,body]=Array.isArray(answer)?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};};
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])){const file=src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src);w.eval(fs.readFileSync(file,'utf8'));}
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await new Promise(r=>setTimeout(r,120));
 return {w,doc:w.document,calls};
}
const settle=(ms=80)=>new Promise(r=>setTimeout(r,ms));

test('the research home: a rail of groups that folds into one control, made for you this week, topics by group, and an honest ask',async()=>{
 const {doc,calls}=await page('#/research');
 const rail=doc.querySelector('[data-rs-rail]'),tog=doc.querySelector('[data-rs-railtog]');
 assert.ok(rail&&tog,'the rail and its one folding control');
 assert.equal(tog.getAttribute('aria-expanded'),'false');assert.match(tog.textContent,/All topics/);
 tog.click();assert.ok(rail.classList.contains('open'));assert.equal(tog.getAttribute('aria-expanded'),'true');
 assert.ok([...rail.querySelectorAll('.rs-rl')].some(a=>a.textContent.includes('Tea: growing')&&a.getAttribute('href')==='#/research/group/g-tea'));
 const made=doc.querySelector('[data-rs-made]');assert.ok(made,'made for you this week');
 assert.match(made.textContent,/Soil under straw/);assert.match(made.textContent,/Put in Tea: growing/);
 assert.ok(made.querySelector('[data-rs-letgo="p-2222"]'),'each can be let go');
 assert.ok(doc.querySelector('a.rs-tr[href="#/research/topic/p-1111"]'),'a topic opens its page');
 assert.match(doc.querySelector('.rs-or').textContent,/From a conversation/);
 assert.match(doc.querySelector('[data-rs-notbuilt]').textContent,/not built yet: they need an AI provider/,'answers in sentences say they are not built');
 const form=doc.querySelector('[data-rs-ask]');form.querySelector('[name=q]').value='reed';form.dispatchEvent(new doc.defaultView.Event('submit',{cancelable:true}));await settle();
 assert.ok(calls.some(c=>c.path==='/api/research-topics/ask'&&c.body.query==='reed'));
 assert.match(doc.querySelector('[data-rs-answer]').textContent,/reed screens over poles/);
 assert.doesNotMatch(doc.body.innerHTML,/—/,'no em dash');
});

test('the rail shows eight groups, those with something to say first, and a quiet All groups for the rest',async()=>{
 const groups=Array.from({length:12},(_,i)=>({id:'g-'+i,name:'Invented group '+String(i).padStart(2,'0'),folder:['Research'],count:1,saying:i===11?1:0}));
 const {doc}=await page('#/research',{answers:{'/api/research-topics':{...LIST,groups}}});
 const shown=[...doc.querySelectorAll('.rs-railin > .rs-rl')].map(a=>a.textContent).filter(t=>/Invented group/.test(t));
 assert.equal(shown.length,8);assert.match(shown[0],/Invented group 11/,'the one with something to say comes first');
 const more=doc.querySelector('[data-rs-allgroups]');assert.match(more.textContent,/All groups · 4 more/);
 assert.equal(doc.querySelector('.rs-moregroups').hidden,true);more.click();assert.equal(doc.querySelector('.rs-moregroups').hidden,false);
});

test('a group: sources with ticks that call the command, its folder, and how it works',async()=>{
 const {doc,calls}=await page('#/research/group/g-tea');
 assert.match(doc.querySelector('.rs-g-h h1').textContent,/Tea: growing/);
 assert.match(doc.querySelector('.rs-path').textContent,/Research \/ Tea: growing/);
 const ticks=[...doc.querySelectorAll('[data-rs-tick]')];assert.deepEqual(ticks.map(b=>b.getAttribute('aria-pressed')),['true','false']);
 ticks[1].click();await settle();
 const sent=calls.find(c=>c.path==='/api/research-topics/group/sources');
 assert.ok(sent,'ticking calls the command');assert.equal(sent.body.action,'tick');assert.deepEqual(sent.body.sourceIds,['s2']);assert.equal(sent.body.expectedHash,'c'.repeat(64));
 assert.match(doc.querySelector('.rs-how').textContent,/Looks for new material.*Not built yet/);
});

test('a topic reads first (spoken words in Lora, his line his alone), decides one thing at a time, and lists its sources',async()=>{
 let r=await page('#/research/topic/p-1111');
 const tabs=[...r.doc.querySelectorAll('[data-rs-tab]')].map(a=>a.textContent);assert.deepEqual(tabs,['Read','Decide · 1','Sources · 1']);
 const read=r.doc.querySelector('.rs-read');
 assert.doesNotMatch(read.textContent,/Heading the page leaves out|#/,'no markup shown');
 assert.match(read.textContent,/One maker left/);assert.match(read.textContent,/Challenged by: Invented notes/);assert.match(read.textContent,/Supported: Two growers say so/);assert.match(read.textContent,/Uncertain: Nobody measured it/);assert.doesNotMatch(read.textContent,/disagree|Dispute|Agree/i,'a finding is never turned into a quarrel');
 assert.ok(read.querySelector('.rs-talk .v2-speech'),'spoken words take the speech face');
 assert.equal(r.doc.querySelector('[data-rs-take]').hidden,true,'his line reads as prose first');assert.equal(r.doc.querySelector('.rs-take.rs-dec'),null);
 r.doc.querySelector('[data-rs-write]').click();assert.equal(r.doc.querySelector('[data-rs-take]').hidden,false,'a quiet way to write it');
 r=await page('#/research/topic/p-1111',{actor:'agent:codex'});
 assert.equal(r.doc.querySelector('[data-rs-write]'),null,'an assistant cannot');assert.equal(r.doc.querySelector('[data-rs-take]'),null);
 assert.match(r.doc.querySelector('[data-rs-takebox]').textContent,/Only Adrian writes here/);
 r=await page('#/research/topic/p-1111?tab=decide');
 const card=r.doc.querySelector('[data-rs-waiting="keep"]');assert.ok(card,'one waiting thing');
 assert.deepEqual([...card.querySelectorAll('[data-rs-choice]')].map(b=>b.textContent),['Keep','Let it go','Not now']);
 card.querySelector('[data-rs-choice="not-now"]').click();await settle();
 const left=r.calls.find(c=>c.path==='/api/research-topics/save');assert.equal(left.body.leave,'keep','Not now leaves it for later');
 r=await page('#/research/topic/p-1111?tab=sources');
 assert.match(r.doc.querySelector('.rs-srcs').textContent,/Invented recording/);
 assert.ok(r.doc.querySelector('.rs-srcs [data-v2-notbuilt]'),'looking for more says it is not built');
});

test('linking a topic to a subject lists subjects from the one fast read, never inquiries.projects, and links just that subject',async()=>{
 const r=await page('#/research/topic/p-1111');
 r.doc.querySelector('[data-rs-link]').click();await settle(200);
 const names=[...r.doc.querySelectorAll('.rs-pickone')].map(b=>b.textContent);assert.deepEqual(names,['An invented garden'],'archived subjects are left out');
 r.doc.querySelector('.rs-pickone').click();await settle(200);
 const link=r.calls.find(c=>c.path==='/api/research-topics/link');assert.equal(link.body.parentStudyId,'invented-garden');
 assert.ok(r.calls.some(c=>c.path==='/api/subjects/standing'));
 assert.ok(!r.calls.some(c=>/inquiries\/projects/.test(c.path)),'no call that reads every subject authority');
});

test('Not now is his alone: an assistant who presses it is refused and the plain message is shown',async()=>{
 const r=await page('#/research/topic/p-1111?tab=decide',{actor:'agent:codex',answers:{'/api/research-topics/save':[403,{error:'Only Adrian leaves a waiting thing for later or brings it back. An assistant may not hide what waits for him.'}]}});
 r.doc.querySelector('[data-rs-choice="not-now"]').click();await settle(200);
 assert.match(r.doc.body.textContent,/Only Adrian can decide this. Codex can propose it, not do it/);
});

test('the match pass: the sample\'s subtitle, an always-present week section, three group columns in the sample\'s order, a bold lead, a Listen place and a boxed one-line take',async()=>{
 let r=await page('#/research');
 assert.match(r.doc.querySelector('.rs-main>header p').textContent,/^3 topics\. Most make themselves from what you gather, record and check\.$/);
 assert.ok(r.doc.querySelector('[data-rs-made]'),'the week section is where the sample has it');
 assert.doesNotMatch(r.doc.querySelector('.rs-main').textContent,/No topics yet/,'no empty line under a group');
 assert.match(r.doc.querySelector('.rs-ask .rs-askbox button').textContent,/Find/,'the build finds words, so the chip says Find');
 r=await page('#/research/group/g-tea');
 assert.deepEqual([...r.doc.querySelectorAll('.rs-grp>section')].map(x=>x.className),['rs-g-src','rs-g-ask','rs-g-side'],'sources, the conversation, then topics and settings');
 assert.match(r.doc.querySelector('.rs-g-side').textContent,/Made from this group[\s\S]*Not built yet/);
 r=await page('#/research/topic/p-1111');
 assert.ok(r.doc.querySelector('.rs-lead'),'the opening paragraph is the lead');
 assert.match(r.doc.querySelector('.rs-crumbs').textContent,/Tea: growing\s*\/\s*From a conversation/);
 const listen=r.doc.querySelector('[data-rs-listen]');assert.ok(listen,'Listen sits at the right of the bar');
 listen.click();await settle(100);assert.match(r.doc.querySelector('dialog')?.textContent||'',/Not built yet/,'it says so rather than pretending');
 assert.ok(r.doc.querySelector('button.rs-fieldbox[data-rs-write]'),'his line sits in a box');
 assert.match(r.doc.querySelector('.rs-take').textContent,/Only you write here\. That is all Research asks of you\./);
 const css=fs.readFileSync(path.join(v2dir,'screens/research.css'),'utf8');
 assert.match(css,/\.rs-topic \.rs-lead\{font:500 var\(--v2-t15\)/,'the lead stands out at weight 500');
 assert.doesNotMatch(fs.readFileSync(path.join(v2dir,'screens/research.js'),'utf8')+css,/—/,'no em dash');
});
