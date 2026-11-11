import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';
import {createServer} from '../runtime/server.mjs';
import {run,SUGAR} from '../agents/cli/ar-create.mjs';
import {createResearchTopics,topicKind} from '../runtime/services/research-topics.mjs';
import {withActor} from '../runtime/services/actor.mjs';

// Research topics and groups: a thin layer of records over the inquiries, findings and answers the app already keeps.
// Invented subjects and words only.
const repo=path.resolve(import.meta.dirname,'..');
async function setup(t,only=['a-teapot-for-guests','colour-from-clay','water-and-leaf']){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 if(only.length)await fillDemo(url,{only});
 const cli=async(args,input,actor='agent:codex')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 const send=(method,route,body)=>new Promise((resolve,reject)=>{
  const req=http.request(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),Origin:url}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:text?JSON.parse(text):null}));});
  req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 // The app's own page: same origin, no actor header (Adrian, client ui).
 const page=(method,route,body)=>send(method,route,body);
 const read=async id=>(await page('GET','/api/research-topics/read?id='+encodeURIComponent(id))).body;
 const list=async(q='')=>(await page('GET','/api/research-topics'+q)).body;
 return {url,cli,page,read,list,dataDir:config.dataDir,capabilities:await (await fetch(url+'/api/capabilities')).json()};
}
const expect=t=>({expectedRevision:t.revision,...(t.hash?{expectedHash:t.hash}:{})});

test('the commands are in the one registry: assistants read, file and propose; his line and his decisions are his',async t=>{
 const f=await setup(t,[]),by=Object.fromEntries(f.capabilities.commands.map(c=>[c.name,c]));
 for(const name of ['research-topics','research-topics.read','research-topics.subject','research-topics.groups','research-topics.group','research-topics.save','research-topics.propose','research-topics.link','research-topics.group.save','research-topics.group.sources','research-topics.ask']){assert.ok(by[name],name);assert.deepEqual(by[name].actors,['any'],name);assert.equal(by[name].section,'research');}
 for(const name of ['research-topics.take','research-topics.let-go','research-topics.undo','research-topics.keep','research-topics.start'])assert.deepEqual(by[name].actors,['human'],name+' is his alone');
 assert.equal(by['research-topics.ask'].readOnly,true,'asking only reads');
 assert.equal(by['research-topics.let-go'].undo,'research-topics.undo');
 assert.equal(SUGAR.research.topic,'research-topics.read');assert.equal(SUGAR.research.propose,'research-topics.propose');
});

test('a subject\'s existing research shows up as one topic, made on the fly; a record is written only when it changes',async t=>{
 const f=await setup(t);
 const all=await f.list(),teapot=all.topics.find(x=>x.name==='A teapot for guests: research');
 assert.equal((await f.cli(['research','save'],{id:teapot.id,expectedRevision:0,origin:{kind:'started'}})).exitCode,5,'an assistant cannot say he started it');
 assert.ok(teapot,'the inquiry the subject already uses is a topic');
 assert.equal(topicKind(teapot.id),'inquiry');
 assert.deepEqual([teapot.saved,teapot.revision,teapot.origin.kind,teapot.usedIn.map(u=>u.parentStudyId)],[false,0,'subject',['demo-a-teapot-for-guests']]);
 const dir=path.join(f.dataDir,'research-topics','topics');
 assert.equal(fs.existsSync(dir)?fs.readdirSync(dir).length:0,0,'nothing is written by reading');
 const forSubject=(await f.cli(['research','subject','demo-a-teapot-for-guests'])).result;
 assert.deepEqual(forSubject.topics.map(x=>x.id),[teapot.id],'the subject gathers the topics it uses');
 // Pointers resolve through the owners: the learning record, the Library sources, the subject.
 const topic=await f.read(teapot.id);
 assert.match(topic.learning.body,/What I found out about A teapot for guests/);
 assert.equal(topic.sources.length,2);assert.ok(topic.sources.every(s=>s.title&&!s.missing));
 assert.equal(topic.usedIn[0].title,'A teapot for guests');
 // An assistant files it in a group: now it has a record, stamped with who did it, and nothing is copied into it.
 const group=(await f.cli(['research','group-save'],{name:'Tea: objects'})).result;
 assert.equal(group.id,'g-tea-objects');assert.deepEqual(group.folder,['Research','Tea: objects']);
 const filed=await f.cli(['research','save'],{id:teapot.id,expectedRevision:0,groupId:group.id});
 assert.equal(filed.exitCode,0,JSON.stringify(filed.result));assert.equal(filed.result.revision,1);
 const record=JSON.parse(fs.readFileSync(path.join(dir,teapot.id+'.json'),'utf8'));
 assert.equal(record.operations[0].actor,'agent:codex');assert.equal(record.collectionId,teapot.id);
 assert.doesNotMatch(JSON.stringify(record),/What I found out/,'the findings stay with their owner');
 assert.deepEqual(record.sourceIds,[],'its sources stay with Library');
 // A stale save is refused, never overwritten.
 const stale=await f.cli(['research','save'],{id:teapot.id,expectedRevision:0,state:'ready'});
 assert.equal(stale.exitCode,3,JSON.stringify(stale.result));
 const wrong=await f.page('POST','/api/research-topics/save',{id:teapot.id,operationId:randomUUID(),expectedRevision:1,expectedHash:'0'.repeat(64),state:'ready'});
 assert.equal(wrong.status,409);
 const g=(await f.cli(['research','group',group.id])).result;
 assert.deepEqual(g.topics.map(x=>x.id),[teapot.id]);assert.equal(g.sources.length,2,'a group holds the sources its topics bring');assert.ok(g.sources.every(s=>s.ticked&&s.from==='topic'));
 assert.deepEqual(g.usedIn.map(u=>u.parentStudyId),['demo-a-teapot-for-guests']);
 const lines=(await f.cli(['history'],{kind:'research-topic',id:teapot.id})).result;
 assert.ok(JSON.stringify(lines).includes('research-topics.save'),'the journal names the change');
});

test('an assistant cannot write his line or decide; Adrian can, and letting a topic go has Undo',async t=>{
 const f=await setup(t);
 const topic=(await f.list()).topics.find(x=>x.name==='Colour from clay: research');
 const agentTake=await f.cli(['call','research-topics.take'],{id:topic.id,operationId:randomUUID(),expectedRevision:0,text:'Invented line an assistant may not write.'});
 assert.equal(agentTake.exitCode,5,'an assistant may not write his own line');
 assert.equal((await f.cli(['call','research-topics.let-go'],{id:topic.id,operationId:randomUUID(),expectedRevision:0})).exitCode,5);
 const mine=await f.page('POST','/api/research-topics/take',{id:topic.id,operationId:randomUUID(),expectedRevision:0,text:'Clay keeps the colour of where it was dug.'});
 assert.equal(mine.status,200,JSON.stringify(mine.body));
 const after=await f.read(topic.id);assert.equal(after.take.text,'Clay keeps the colour of where it was dug.');
 const op=randomUUID(),gone=await f.page('POST','/api/research-topics/let-go',{id:topic.id,operationId:op,...expect(after)});
 assert.equal(gone.status,200);
 assert.ok(!(await f.list()).topics.some(x=>x.id===topic.id),'a topic let go leaves the list');
 assert.ok((await f.list('?gone=true')).topics.some(x=>x.id===topic.id));
 const now=await f.read(topic.id);
 assert.equal((await f.cli(['research','save'],{id:topic.id,...expect(now),state:'ready'})).exitCode,3,'nothing is filed on a topic let go');
 const back=await f.page('POST','/api/research-topics/undo',{id:topic.id,operationId:randomUUID(),...expect(now),undoOperationId:op});
 assert.equal(back.status,200,JSON.stringify(back.body));
 assert.equal((await f.read(topic.id)).status,'kept');
 assert.equal((await f.read(topic.id)).take.text,'Clay keeps the colour of where it was dug.','his line is kept through it');
});

test('an assistant proposes a topic; he keeps it (it becomes an inquiry) or lets it go; linking waits for his yes',async t=>{
 const f=await setup(t);
 const cat=async()=>(await f.cli(['collection','list'])).result.collections;
 const before=(await cat()).length;
 const voice=(await f.read((await f.list()).topics.find(x=>x.name==='Colour from clay: research').id)).sources.find(x=>/Voice note/.test(x.title));
 // An assistant never says he started it, and names the real record a topic came from.
 const refused=async(origin,code)=>assert.equal((await f.cli(['research','propose'],{name:'Glaze from wood ash',origin})).exitCode,code,JSON.stringify(origin));
 await refused({kind:'started'},5);
 await refused({kind:'note',label:'My note'},1);
 await refused({kind:'note',ref:{kind:'note',id:'a1b2c3d4-0000-4000-8000-000000000999'}},1);
 await refused({kind:'fact-check',ref:{kind:'consent-claim',id:'invented-claim',parentStudyId:'demo-water-and-leaf'}},1);
 await refused({kind:'saved',ref:{kind:'library-topic',id:'nothing saved under this'}},1);
 const proposed=await f.cli(['research','propose'],{name:'Glaze from wood ash',origin:{kind:'conversation',label:'Voice note, 2:10',ref:{kind:'recording',id:voice.id}},note:'Mentioned twice, never followed.'});
 assert.equal(proposed.exitCode,0,JSON.stringify(proposed.result));
 const p=proposed.result;assert.equal(p.status,'proposed');assert.equal(p.madeForYou,true);assert.equal(p.origin.say,'From a conversation · Voice note, 2:10');
 const read=await f.read(p.id);assert.deepEqual(read.waitingNow.map(w=>w.kind),['keep']);
 assert.equal((await f.cli(['call','research-topics.keep'],{id:p.id,operationId:randomUUID(),...expect(read)})).exitCode,5,'an assistant may not keep its own proposal');
 assert.equal((await cat()).length,before,'no inquiry until he keeps it');
 // Not now: the waiting thing is left for later and can be shown again.
 assert.equal((await f.cli(['research','save'],{id:p.id,...expect(read),leave:'keep'})).exitCode,5,'an assistant may not hide what waits for him');
 // Putting it in a group stays open to an assistant.
 const grp=(await f.cli(['research','group-save'],{name:'Glaze',expectedRevision:0})).result;
 const filed=await f.cli(['research','save'],{id:p.id,...expect(read),groupId:grp.id});assert.equal(filed.exitCode,0,JSON.stringify(filed.result));assert.equal(filed.result.groupId,grp.id);
 const read2=await f.read(p.id);Object.assign(read,{revision:read2.revision,hash:read2.hash});
 const left=await f.page('POST','/api/research-topics/save',{id:p.id,operationId:randomUUID(),...expect(read),leave:'keep'});
 assert.equal(left.status,200);const l=await f.read(p.id);assert.deepEqual([l.waitingNow.length,l.waitingLeft.length],[0,1]);
 const kept=await f.page('POST','/api/research-topics/keep',{id:p.id,operationId:randomUUID(),...expect(l)});
 assert.equal(kept.status,200,JSON.stringify(kept.body));
 assert.equal((await cat()).length,before+1,'kept, it is an inquiry in Library');
 const k=await f.read(p.id);assert.equal(k.status,'kept');assert.ok(k.collectionId);
 assert.ok(!(await f.list()).topics.some(x=>x.id===k.collectionId),'the inquiry is shown once, under its topic');
 // An assistant links it to a subject: proposed, and it waits for him.
 const linked=await f.cli(['research','link'],{id:p.id,...expect(k),parentStudyId:'demo-water-and-leaf'});
 assert.equal(linked.exitCode,0,JSON.stringify(linked.result));
 const w=await f.read(p.id);
 assert.deepEqual(w.usedIn.map(u=>[u.parentStudyId,u.status]),[['demo-water-and-leaf','proposed']]);
 assert.deepEqual(w.waitingNow.map(x=>x.key),['use:demo-water-and-leaf']);
 const yes=await f.page('POST','/api/research-topics/link',{id:p.id,operationId:randomUUID(),...expect(w),parentStudyId:'demo-water-and-leaf'});
 assert.equal(yes.status,200,JSON.stringify(yes.body));
 assert.deepEqual((await f.read(p.id)).usedIn.map(u=>u.status),['used']);
 assert.ok((await f.cli(['research','subject','demo-water-and-leaf'])).result.topics.some(x=>x.id===p.id));
});

test('a group\'s sources are ticked for asking; asking finds his exact words and says it writes no answer',async t=>{
 const f=await setup(t,['colour-from-clay']);
 const topic=(await f.list()).topics[0],tree=(await f.cli(['library','tree'])).result;
 const extra=tree.sources.find(s=>/SRC - Synthetic/.test(s.title));
 const g=(await f.cli(['research','group-save'],{name:'Colour'})).result;
 const r=await f.read(topic.id);await f.cli(['research','save'],{id:topic.id,...expect(r),groupId:g.id});
 let group=(await f.cli(['research','group',g.id])).result;
 const added=await f.cli(['research','group-sources'],{id:g.id,...expect(group),action:'add',sourceIds:[extra.id]});
 assert.equal(added.exitCode,0,JSON.stringify(added.result));group=added.result;
 assert.equal(group.sources.length,3);
 const voice=group.sources.find(s=>/Voice note/.test(s.title));
 const ask=async()=>(await f.cli(['research','ask'],{query:'the waiting',groupId:g.id})).result;
 let a=await ask();
 assert.ok(a.found.some(x=>x.sourceId===voice.id),'the ticked voice note uses those words');
 assert.equal(a.ability.answers,false);assert.match(a.ability.needs,/AI provider/);
 group=(await f.cli(['research','group-sources'],{id:g.id,...expect(group),action:'untick',sourceIds:[voice.id]})).result;
 assert.equal(group.sources.find(s=>s.id===voice.id).ticked,false);
 a=await ask();assert.ok(!a.found.some(x=>x.sourceId===voice.id),'an unticked source is not asked');
 assert.equal((await f.cli(['research','group-sources'],{id:g.id,...expect(group),action:'remove',sourceIds:[voice.id]})).exitCode,3,'a topic\'s source is unticked, not removed, here');
 const everything=(await f.cli(['research','ask'],{query:'the waiting'})).result;
 assert.equal(everything.scope.kind,'everything');assert.ok(everything.found.length>=1);
 const none=(await f.cli(['research','ask'],{query:'words nobody wrote down'})).result;
 assert.equal(none.found.length,0);assert.match(none.said,/None of your sources/);
});

/* ---------- the service on its own, with stand-in owners ---------- */
function service(owners={}){
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||'/tmp'),'research-topics-'));
 return {dir,s:createResearchTopics({dataDir:dir,owners:{catalog:async()=>({revision:1,indexHash:'a'.repeat(64),collections:[]}),associations:async()=>[],...owners}})};
}
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn),agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);

test('a subject with research of its own but no inquiry shows it as one topic; things he saved under one topic are offered',async t=>{
 const {dir,s}=service({
  subjects:async()=>[{parentStudyId:'invented-kiln',title:'The old kiln',bindingId:'b1'},{parentStudyId:'invented-empty',title:'Empty',bindingId:'b2'}],
  subjectResearch:async x=>x.parentStudyId==='invented-kiln'?{answers:[{id:'11111111-1111-4111-8111-111111111111',question:'How hot did it get?',status:'kept',keptAt:'2026-11-01T00:00:00Z'}],findings:[{id:'p1',title:'Wood firing takes three days',supported:'Two firers agree',uncertain:'',spoken:[{quote:'We fed it every hour.',speaker:'An invented firer',location:'4:10'}]}]}:null,
  libraryTopics:async()=>[{sourceId:'a1b2c3d4-0000-4000-8000-000000000001',topics:['Ash glaze']},{sourceId:'a1b2c3d4-0000-4000-8000-000000000002',topics:['ash glaze']},{sourceId:'a1b2c3d4-0000-4000-8000-000000000003',topics:['Once']}],
 });
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const all=await s.list();
 assert.deepEqual(all.topics.map(x=>x.id).sort(),['saved.ash-glaze','subject.invented-kiln']);
 const kiln=await s.read({id:'subject.invented-kiln'});
 assert.equal(kiln.name,'The old kiln: research');assert.equal(kiln.answers[0].question,'How hot did it get?');
 assert.deepEqual(kiln.said.map(x=>x.text),['Wood firing takes three days']);assert.equal(kiln.spoken[0].quote,'We fed it every hour.');
 const saved=await s.read({id:'saved.ash-glaze'});assert.equal(saved.status,'proposed');assert.equal(saved.origin.say,'From things you saved · 2 things you saved');
 assert.deepEqual(fs.readdirSync(path.join(dir,'research-topics','topics')),[],'read on the fly; nothing written');
 await assert.rejects(agent(()=>s.letGo({id:'saved.ash-glaze',operationId:randomUUID(),expectedRevision:0})),{status:403});
 const op=randomUUID();await human(()=>s.letGo({id:'saved.ash-glaze',operationId:op,expectedRevision:0}));
 assert.ok(!(await s.list()).topics.some(x=>x.id==='saved.ash-glaze'),'let go, it is not offered again');
 const retry=await human(()=>s.letGo({id:'saved.ash-glaze',operationId:op,expectedRevision:0}));assert.equal(retry.replayed,true,'a retried operation is answered, not repeated');
 await assert.rejects(human(()=>s.letGo({id:'saved.ash-glaze',operationId:op,expectedRevision:0,extra:1})),{status:400});
});

test('asking reads the ticked sources themselves, ignores capitals, and says exactly what was not searched',async t=>{
 const ids=Array.from({length:1205},(_,i)=>'a1b2c3d4-0000-4000-8000-'+String(i).padStart(12,'0'));
 const text=i=>i===240?'Long before, the Reed Screens were laid over poles.':i===7?null:'An invented page about tea, number '+i+'.';
 let reads=0;
 const {dir,s}=service({allSourceIds:async()=>ids,readSource:async id=>{reads++;const i=ids.indexOf(id);return {id,title:'Invented source '+i,text:text(i)};},sources:async list=>list.map(id=>({id,title:'Invented source '+ids.indexOf(id),missing:false}))});
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const g=await s.saveGroup({name:'Invented',operationId:randomUUID(),expectedRevision:0});
 const added=await s.groupSources({id:g.id,operationId:randomUUID(),...expect(g),action:'add',sourceIds:ids.slice(0,200)});
 const more=await s.groupSources({id:g.id,operationId:randomUUID(),...expect(added),action:'add',sourceIds:ids.slice(200,250)});
 assert.equal(more.sources.length,250);
 const a=await s.ask({query:'reed screens',groupId:g.id});
 assert.deepEqual(a.found.map(f=>f.sourceId),[ids[240]],'found past the two hundredth source, in other capitals');
 assert.match(a.found[0].quote,/Reed Screens/);
 assert.deepEqual([a.searched.sources,a.searched.of,a.searched.notSearched,a.searched.unreadable],[250,250,0,1]);
 assert.match(a.said,/Searched all 250 sources/);assert.match(a.said,/1 source could not be read as text/);
 const off=await s.groupSources({id:g.id,operationId:randomUUID(),...expect(more),action:'untick',sourceIds:[ids[240]]});
 const none=await s.ask({query:'reed screens',groupId:g.id});assert.equal(none.found.length,0);assert.match(none.said,/None of the ticked sources uses these words/);
 reads=0;const all=await s.ask({query:'REED SCREENS'});
 assert.equal(all.scope.kind,'everything');assert.equal(all.found.length,1);
 assert.equal(reads,1000,'one search reads at most a thousand sources');
 assert.match(all.said,/Searched 1000 of 1205 sources; 205 were not searched/);
 const missed=await s.ask({query:'number 1100'});assert.equal(missed.found.length,0);assert.match(missed.said,/None of the sources searched uses these words/,'never says none when it did not look');
 assert.ok(off.revision>more.revision);
});

test('on the real server: where a topic came from and how a group works are changed only by Adrian',async t=>{
 const f=await setup(t);
 const topic=(await f.list()).topics.find(x=>x.name==='Colour from clay: research'),read=await f.read(topic.id);
 const voice=read.sources.find(x=>/Voice note/.test(x.title));
 const origin={kind:'conversation',label:'Invented talk',ref:{kind:'recording',id:voice.id}};
 assert.equal((await f.cli(['research','save'],{id:topic.id,...expect(read),origin})).exitCode,5,'an assistant cannot rewrite where a topic came from');
 assert.equal((await f.read(topic.id)).origin.kind,'subject','the origin is as it was');
 // A group set to "only when I start one" takes no assistant's proposals, and only he sets it.
 const g=(await f.page('POST','/api/research-topics/group/save',{name:'Quiet group',expectedRevision:0,operationId:randomUUID()})).body;
 assert.equal((await f.cli(['research','group-save'],{id:g.id,...expect(g),settings:{opensTopics:'off'}})).exitCode,5,'an assistant cannot switch it');
 const off=await f.page('POST','/api/research-topics/group/save',{id:g.id,operationId:randomUUID(),...expect(g),settings:{opensTopics:'off'}});assert.equal(off.status,200);
 const propose=input=>f.cli(['research','propose'],{name:'Glaze from ash',origin:{kind:'conversation',label:'Voice note',ref:{kind:'recording',id:voice.id}},...input});
 assert.equal((await propose({groupId:g.id})).exitCode,5,'refused by the command, not only the screen');
 assert.equal((await propose({suggestedGroupId:g.id})).exitCode,5);
 assert.equal((await propose({})).exitCode,0,'a proposal that names no such group is still welcome');
 // A search says what it skipped, by name.
 const add=await f.page('POST','/api/research-topics/group/sources',{id:g.id,operationId:randomUUID(),...expect((await f.page('GET','/api/research-topics/group?id='+g.id)).body),action:'add',sourceIds:[voice.id]});assert.equal(add.status,200);
 const off2=await f.page('POST','/api/research-topics/group/sources',{id:g.id,operationId:randomUUID(),...expect(add.body),action:'untick',sourceIds:[voice.id]});assert.equal(off2.status,200);
 const asked=(await f.page('POST','/api/research-topics/ask',{query:'anything',groupId:g.id})).body;
 assert.equal(asked.skipped.unticked.length,1);assert.match(asked.said,/not ticked: 1 \(Voice note/);
});

test('on the real server: reads never wait behind a link, and an assistant\'s link is a proposal that waits for his yes',async t=>{
 const f=await setup(t);
 const voice=(await f.read((await f.list()).topics.find(x=>x.name==='Colour from clay: research').id)).sources.find(x=>/Voice note/.test(x.title));
 const p=(await f.cli(['research','propose'],{name:'Glaze from wood ash',origin:{kind:'conversation',label:'Voice note',ref:{kind:'recording',id:voice.id}}})).result;
 const linked=await f.cli(['research','link'],{id:p.id,...expect(await f.read(p.id)),parentStudyId:'demo-water-and-leaf'});assert.equal(linked.exitCode,0,JSON.stringify(linked.result));
 let r=await f.read(p.id);
 assert.deepEqual(r.usedIn.map(u=>[u.parentStudyId,u.status]),[['demo-water-and-leaf','proposed']],'not used there yet');
 assert.deepEqual(r.waitingNow.map(w=>w.kind),['keep','use'],'it waits for his yes');
 assert.ok(!(await f.page('GET','/api/research-topics/subject?parentStudyId=demo-water-and-leaf')).body.topics.some(x=>x.id===p.id&&x.use==='used'));
 // His yes uses it.
 const yes=await f.page('POST','/api/research-topics/link',{id:p.id,operationId:randomUUID(),...expect(r),parentStudyId:'demo-water-and-leaf'});assert.equal(yes.status,200);
 r=await f.read(p.id);assert.equal(r.usedIn[0].status,'used');
 // While a link goes through Library, reads are answered at once.
 const inquiry=(await f.list()).topics.find(x=>x.name==='Colour from clay: research'),ir=await f.read(inquiry.id);
 let done=false;const slow=f.page('POST','/api/research-topics/link',{id:inquiry.id,operationId:randomUUID(),...expect(ir),parentStudyId:'demo-water-and-leaf'}).then(x=>{done=true;return x;});
 const reads=await Promise.all([f.list(),f.read(p.id),f.page('GET','/api/research-topics/groups'),f.page('GET','/api/research-topics/subject?parentStudyId=demo-water-and-leaf')]);
 assert.ok(reads.every(Boolean));assert.equal(done,false,'the reads came back before the link finished');
 assert.equal((await slow).status,200);
});
