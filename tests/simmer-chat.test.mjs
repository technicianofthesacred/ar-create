// Simmer from a Claude chat: intake (his photos and exact words), agent proposals, the dish he names feeding
// Direction, and the material an agent reads. Every route runs through the real server and the agent CLI, on an
// invented fixture: no installed app, no metered service.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run, SUGAR} from '../agents/cli/ar-create.mjs';
import {inventedPhoto} from './helpers/simmer-demo.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const WORDS=['I keep going back to the kettle at dawn. Nobody else is awake.','The cracks in the old cup are the part I trust.'];
async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const photos=fs.mkdtempSync(path.join(os.tmpdir(),'simmer-chat-photos-'));
 for(let i=0;i<5;i++)fs.writeFileSync(path.join(photos,'Kettle '+(i+1)+'.png'),inventedPhoto(i,64,80));
 fs.writeFileSync(path.join(photos,'notes.txt'),'not a photo');fs.writeFileSync(path.join(photos,'.hidden.png'),inventedPhoto(0,8,8));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});fs.rmSync(photos,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:claude-code')=>{const out=await run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});return out;};
 const ok=async(...a)=>{const out=await cli(...a);assert.equal(out.exitCode,0,JSON.stringify(out.result));return out.result;};
 const post=async(route,body,actor)=>{const r=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'http'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 return {url,cli,ok,post,photos,dataDir:config.dataDir};
}
const allBlocks=board=>board.groups.flatMap(g=>g.blocks);
const unwrap=r=>r.data??r.result??r;

test('the chat commands are registered for every entrance, open to agents, and the CLI has a simmer shortcut',async t=>{
 const f=await setup(t),caps=await (await fetch(f.url+'/api/capabilities')).json();
 for(const [name,method] of [['simmer.intake','POST'],['simmer.propose','POST'],['simmer.dish','POST'],['simmer.material','GET']]){const c=caps.commands.find(x=>x.name===name);assert.ok(c,name);assert.equal(c.method,method);assert.deepEqual(c.actors,['any'],name);assert.equal(c.readOnly,method==='GET');}
 assert.deepEqual(SUGAR.simmer,{board:'simmer.board.get',material:'simmer.material',intake:'simmer.intake',propose:'simmer.propose',name:'simmer.dish'});
});

test('one chat, start to finish through the CLI: 5 photos and his words in, proposals on the board, the dish he names in Direction',async t=>{
 const f=await setup(t);
 // 1. Intake: a new subject from a title, the five photos in the folder he named, and his words exactly as he said them.
 const intake=unwrap(await f.ok(['simmer','intake'],{title:'Kettle at dawn',folder:f.photos,words:[{text:WORDS[0],said:'spoken'},{text:WORDS[1],said:'typed'}]}));
 const subject=intake.subject;assert.match(subject,/^simmer-kettle-at-dawn-/);assert.equal(intake.created,true);
 const gathered=intake.groups.find(g=>g.id==='g-gathered');assert.equal(gathered.origin,'machine');assert.equal(gathered.by,'agent:claude-code');
 const photos=gathered.blocks.filter(b=>b.kind==='photo'),mine=gathered.blocks.filter(b=>b.kind==='mine');
 assert.deepEqual(photos.map(b=>b.caption),['Kettle 1','Kettle 2','Kettle 3','Kettle 4','Kettle 5'],'the five photos, not the text file or the hidden one');
 assert.deepEqual(mine.map(b=>b.text),WORDS,'his words, verbatim and in his order');
 for(const b of mine){assert.equal(b.origin,'human');assert.equal(b.by,'human:adrian');assert.equal(b.dictated.carriedBy,'agent:claude-code');assert.equal(b.dictated.via,'chat');assert.equal(b.source.quote,b.text);}
 assert.deepEqual(mine.map(b=>b.dictated.said),['spoken','typed']);
 // The words are a Library note of his, and the Collection holds the note and the photos.
 const note=unwrap(await f.ok(['library','file'],{id:mine[0].source.sourceId}));
 assert.equal(note.text.slice(mine[1].source.start,mine[1].source.start+WORDS[1].length),WORDS[1]);
 assert.equal(note.provenance.kind,'dictated');assert.equal(note.provenance.author,'human:adrian');assert.equal(note.provenance.carriedBy,'agent:claude-code');
 const {collections}=unwrap(await f.ok(['library','collections']));const collection=collections.find(c=>c.id===intake.collectionId);
 assert.equal(collection.name,'Kettle at dawn');assert.equal(collection.sourceIds.length,6);
 // The subject is a real project: Direction can be read for it.
 assert.equal(unwrap(await f.ok(['project','read'],{parentStudyId:subject})).title,'Kettle at dawn');

 // 2. The agent reads the material, then proposes: a grouping, a reflection letter, dishes, a question, a feeling check.
 const material=unwrap(await f.ok(['simmer','material',subject]));
 assert.equal(material.collection.id,intake.collectionId);assert.ok(material.texts.some(x=>x.dictated&&x.text.includes(WORDS[0])));
 const proposal=unwrap(await f.ok(['simmer','propose'],{subject,expectedRevision:material.revision,expectedHash:material.hash,
  groups:[{key:'dawn',title:'Before anyone wakes',sub:'proposed',blockIds:[mine[0].id,photos[0].id,photos[1].id]}],
  letter:{recurs:'The kettle, and being alone with it.',voice:'You speak more slowly about the cracks.',unresolved:'Who the cup belonged to.',group:'dawn'},
  dishes:[{title:'A short personal essay',why:'Dawn as the way in.'},{title:'A carousel of the five photos',why:'One line each.'}],
  questions:['Whose cup was it first?'],feelings:[{text:'Is the dawn yours, or borrowed from a film?',group:'dawn'}]}));
 const dawn=proposal.groups.find(g=>g.title==='Before anyone wakes');assert.equal(dawn.origin,'machine');
 assert.deepEqual(dawn.blocks.slice(0,3).map(b=>b.id),[mine[0].id,photos[0].id,photos[1].id],'his blocks moved, untouched');
 assert.equal(allBlocks(proposal).find(b=>b.id===mine[0].id).text,WORDS[0]);
 const proposed=allBlocks(proposal).filter(b=>b.proposal);
 assert.deepEqual(proposed.map(b=>b.kind).sort(),['feeling','letter','question']);
 for(const b of proposed){assert.equal(b.origin,'machine');assert.equal(b.by,'agent:claude-code');}
 assert.equal(proposed.find(b=>b.kind==='letter').letter.voice,'You speak more slowly about the cracks.');
 assert.ok(proposal.groups.some(g=>g.title==='From Claude'&&g.blocks.some(b=>b.kind==='question')),'unplaced proposals gather in a group labelled as Claude\'s');
 assert.deepEqual(proposal.forming.dishes.map(d=>[d.origin,d.by]),[['machine','agent:claude-code'],['machine','agent:claude-code']]);
 assert.equal(proposal.forming.named,null,'proposing never names the dish');

 // 3. Adrian names the dish in chat; the agent carries his exact sentence. Direction holds it as the commit sentence.
 const sentence='It is a short essay about dawn and the cracked cup, for the host who wakes first.';
 const named=unwrap(await f.ok(['simmer','name'],{subject,sentence,said:'spoken'}));
 assert.equal(named.named.text,sentence);assert.equal(named.named.dictated.carriedBy,'agent:claude-code');assert.equal(named.direction.status,'saved');
 const direction=unwrap(await f.ok(['project','read'],{parentStudyId:subject}));
 assert.equal(direction.adoptedDirection,sentence,'the commit sentence in Direction, word for word');
 assert.equal(direction.authorThoughts,'','nothing else in Direction was written');
 const board=unwrap(await f.ok(['simmer','board',subject]));assert.equal(board.forming.named.text,sentence);assert.equal(board.forming.named.direction,'saved');
 // The history says who carried each change.
 const history=unwrap(await f.ok(['history'],{}));
 assert.ok(JSON.stringify(history).includes('simmer.dish'));
});

test('intake: only Adrian or an agent he is talking to carries his words; the folder is his, and something must come in',async t=>{
 const f=await setup(t);
 assert.equal((await f.post('/api/simmer/intake',{title:'X',words:['hello'],operationId:randomUUID()},'cron:nightly')).status,403);
 assert.equal((await f.post('/api/simmer/intake',{title:'X',words:['hello'],operationId:randomUUID()},'import:vault')).status,403);
 assert.equal((await f.post('/api/simmer/intake',{title:'X',operationId:randomUUID()},'agent:codex')).status,400);
 assert.equal((await f.post('/api/simmer/intake',{title:'X',folder:f.dataDir,operationId:randomUUID()},'agent:codex')).status,403,'never from inside AR Create\'s data');
 assert.equal((await f.post('/api/simmer/intake',{title:'X',folder:'relative/path',operationId:randomUUID()},'agent:codex')).status,400);
 assert.equal((await f.post('/api/simmer/intake',{title:'X',folder:f.photos,photos:['../secret.png'],operationId:randomUUID()},'agent:codex')).status,404);
 assert.equal((await f.post('/api/simmer/intake',{title:'X',words:['   '],operationId:randomUUID()},'agent:codex')).status,400,'blank is not his words');
 assert.equal((await f.post('/api/simmer/intake',{title:'X',words:['a'],paraphrase:true,operationId:randomUUID()},'agent:codex')).status,400,'unknown fields are refused');
 // Adrian himself may carry them too.
 assert.equal((await f.post('/api/simmer/intake',{title:'Mine',words:['typed by me'],operationId:randomUUID()},'human:adrian')).status,200);
});

test('intake appends to an existing subject, chosen photos only, and a retried operation adds nothing twice',async t=>{
 const f=await setup(t),first=(await f.post('/api/simmer/intake',{title:'River',words:[WORDS[0]],operationId:randomUUID()},'agent:claude-code')).body,subject=first.subject;
 const op=randomUUID(),again={subject,folder:f.photos,photos:['Kettle 2.png','Kettle 4.png'],words:[WORDS[1]],operationId:op};
 const second=(await f.post('/api/simmer/intake',again,'agent:claude-code')).body;
 const g=second.groups.find(x=>x.id==='g-gathered');
 assert.deepEqual(g.blocks.map(b=>b.kind==='photo'?b.caption:b.text),[WORDS[0],'Kettle 2','Kettle 4',WORDS[1]],'what was there keeps its place; the new arrives after');
 assert.equal(second.collectionId,first.collectionId,'the same Collection grows');
 const replay=(await f.post('/api/simmer/intake',again,'agent:claude-code')).body;
 assert.equal(replay.replayed,true);assert.equal(replay.revision,second.revision);
 assert.equal((await f.post('/api/simmer/intake',{...again,operationId:randomUUID(),group:'g-missing'},'agent:claude-code')).status,404);
});

test('his dictated words are protected: an agent board save cannot change, delete or forge them',async t=>{
 const f=await setup(t),start=(await f.post('/api/simmer/intake',{title:'Bowls',words:[WORDS[0]],operationId:randomUUID()},'agent:claude-code')).body;
 const save=(board,actor='agent:claude-code')=>f.post('/api/simmer/board',{subject:start.subject,operationId:randomUUID(),expectedRevision:start.revision,expectedHash:start.hash,board:{title:start.title,groups:board,links:start.links,forming:start.forming}},actor);
 const g=start.groups[0],word=g.blocks[0];
 assert.equal((await save([{...g,blocks:[{...word,text:'A cleaner version of what he said',source:{...word.source,quote:'A cleaner version of what he said'}}]}])).status,403,'no rewording');
 assert.equal((await save([{...g,blocks:[]}])).status,403,'no deleting');
 const forged={id:'b-forged',kind:'mine',origin:'human',by:'human:adrian',text:'Words he never said',wide:true,dictated:{carriedBy:'agent:claude-code',via:'chat',at:new Date().toISOString()}};
 assert.equal((await save([{...g,blocks:[word,forged]}])).status,403,'an agent cannot add words in his name through the board');
 assert.equal((await save([{...g,blocks:[word,{...forged,origin:'machine',by:'agent:claude-code'}]}])).status,403,'and cannot stamp its own words dictated');
});

test('propose: agents only, against the board they read, and only blocks that exist',async t=>{
 const f=await setup(t),start=(await f.post('/api/simmer/intake',{title:'Tea',words:[WORDS[0],WORDS[1]],operationId:randomUUID()},'agent:claude-code')).body;
 const base={subject:start.subject,operationId:randomUUID(),expectedRevision:start.revision,expectedHash:start.hash};
 assert.equal((await f.post('/api/simmer/propose',{...base,questions:['Q?']},'human:adrian')).status,403,'Adrian adds his own on the board, not as a proposal');
 assert.equal((await f.post('/api/simmer/propose',{...base,questions:['Q?']},'cron:nightly')).status,403);
 assert.equal((await f.post('/api/simmer/propose',{...base},'agent:codex')).status,400,'propose something');
 assert.equal((await f.post('/api/simmer/propose',{...base,groups:[{title:'G',blockIds:['b-nope']}]},'agent:codex')).status,404);
 assert.equal((await f.post('/api/simmer/propose',{...base,dishes:[{title:'1'},{title:'2'},{title:'3'},{title:'4'}]},'agent:codex')).status,400,'two or three dishes at a time');
 assert.equal((await f.post('/api/simmer/propose',{subject:start.subject,operationId:randomUUID(),questions:['Q?']},'agent:codex')).status,400,'a proposal names the board it read');
 const ok=await f.post('/api/simmer/propose',{...base,questions:['Where were you standing?']},'agent:codex');assert.equal(ok.status,200);
 assert.ok(ok.body.groups.some(g=>g.title==='From Codex'),'labelled with the agent that proposed it');
 assert.equal((await f.post('/api/simmer/propose',{...base,operationId:randomUUID(),questions:['Again?']},'agent:codex')).status,409,'stale: re-read, never force');
 // His words stay his after any proposal.
 const words=allBlocks(ok.body).filter(b=>b.kind==='mine').map(b=>b.text);assert.deepEqual(words,WORDS);
});

test('dish: his exact sentence; a renaming replaces his earlier chat sentence; a direction he chose another way is never replaced',async t=>{
 const f=await setup(t),start=(await f.post('/api/simmer/intake',{title:'Clay',words:[WORDS[0]],operationId:randomUUID()},'agent:claude-code')).body,subject=start.subject;
 const name=(sentence,actor='agent:claude-code')=>f.post('/api/simmer/dish',{subject,sentence,operationId:randomUUID()},actor);
 assert.equal((await name('  ')).status,400);
 assert.equal((await name('A sentence','cron:nightly')).status,403);
 assert.equal((await name('x'.repeat(601))).status,400);
 const first=await name('A carousel about clay, for the maker.');assert.equal(first.body.direction.status,'saved');
 const second=await name('No: an essay about clay, for the considered collector.');assert.equal(second.body.direction.status,'saved');
 const read=async()=>(await (await fetch(f.url+'/api/concept?parentStudyId='+encodeURIComponent(subject))).json());
 let concept=await read();assert.equal(concept.adoptedDirection,'No: an essay about clay, for the considered collector.');
 // Adrian writes Direction himself; a later chat naming waits on the board and Direction is untouched.
 const human=await f.post('/api/concept/save',{parentStudyId:subject,operationId:randomUUID(),expectedRevision:concept.revision,expectedHash:concept.hash,authorThoughts:'Mine.',adoptedDirection:'I chose this in Direction.',aiInterpretation:'',suggestions:'',sourceSelections:[]},'human:adrian');
 assert.equal(human.status,200,JSON.stringify(human.body));
 const third=await name('A third idea, said in chat.');assert.equal(third.status,200);assert.equal(third.body.direction.status,'held');assert.match(third.body.named.reason,/another way/);
 concept=await read();assert.equal(concept.adoptedDirection,'I chose this in Direction.');assert.equal(concept.authorThoughts,'Mine.');
 assert.equal(third.body.forming.named.text,'A third idea, said in chat.');
 // An agent still cannot write Direction itself.
 assert.equal((await f.post('/api/concept/save',{parentStudyId:subject,operationId:randomUUID(),expectedRevision:concept.revision,expectedHash:concept.hash,authorThoughts:'Mine.',adoptedDirection:'Agent words',aiInterpretation:'',suggestions:'',sourceSelections:[]},'agent:claude-code')).status,403);
 // A subject with no project folder keeps the sentence on the board.
 const loose=await f.post('/api/simmer/dish',{subject:'loose-subject',sentence:'Kept on the board.',operationId:randomUUID()},'agent:claude-code');
 assert.equal(loose.status,200);assert.equal(loose.body.direction.status,'held');assert.equal(loose.body.forming.named.text,'Kept on the board.');
});

test('material: the board, the Collection and its text, and Direction, for an agent to read before proposing',async t=>{
 const f=await setup(t),start=(await f.post('/api/simmer/intake',{title:'Smoke',folder:f.photos,photos:['Kettle 1.png'],words:[WORDS[1]],operationId:randomUUID()},'agent:claude-code')).body;
 const r=await fetch(f.url+'/api/simmer/material?subject='+encodeURIComponent(start.subject),{headers:{'X-AR-Actor':'agent:claude-code'}}),m=await r.json();
 assert.equal(r.status,200);assert.equal(m.schema,'ar-create.simmer-material.v1');assert.equal(m.revision,start.revision);assert.equal(m.hash,start.hash);
 assert.equal(m.groups[0].blocks[0].photo.title.length>0,true);assert.equal(m.groups[0].blocks[1].dictated.via,'chat');
 assert.deepEqual(m.texts.map(x=>x.dictated),[true]);assert.equal(m.direction.adoptedDirection,'');assert.ok(m.rules.length>=3);
 assert.equal((await fetch(f.url+'/api/simmer/material?subject='+encodeURIComponent('bad subject'))).status,400);
});
