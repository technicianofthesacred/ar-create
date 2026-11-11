import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run,SUGAR,USAGE} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';

// Where a subject lives (folder, tags, pin, archived, hand order) is one saved record per subject, reached by the app,
// the CLI and MCP through the same commands. Invented subjects and folders only.
const repo=path.resolve(import.meta.dirname,'..');
async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:codex')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 const send=(method,route,{body,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:text?JSON.parse(text):null}));});
  req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 // The app's own page: same origin, no actor header (Adrian, client ui).
 const page=(method,route,body)=>send(method,route,{body,headers:{Origin:url}});
 return {url,cli,send,page,dataDir:config.dataDir,capabilities:await (await fetch(url+'/api/capabilities')).json()};
}
const one=async(f,id)=>(await f.cli(['subject','places'],{parentStudyId:id})).result.places[0];

test('the commands are in the one registry, open to assistants, with folder Undo and CLI verbs',async t=>{
 const f=await setup(t),byName=Object.fromEntries(f.capabilities.commands.map(c=>[c.name,c]));
 for(const name of ['subject-places','subject-places.save','subject-places.reorder','subject-places.carry','subject-places.folders.get','subject-places.folders.post']){
  assert.ok(byName[name],name+' is registered');assert.deepEqual(byName[name].actors,['any'],name+' is open to assistants');assert.equal(byName[name].section,'subjects');
 }
 assert.equal(byName['subject-places'].readOnly,true);assert.equal(byName['subject-places.folders.get'].readOnly,true);
 assert.equal(byName['subject-places.save'].readOnly,false);assert.equal(byName['subject-places.folders.post'].undo,'subject-places.folders.post');
 assert.match(JSON.stringify(byName['subject-places.save'].schema),/expectedRevision/);
 assert.deepEqual(SUGAR.subject,{places:'subject-places',place:'subject-places.save',reorder:'subject-places.reorder',folders:'subject-places.folders.get',folder:'subject-places.folders.post'});
 assert.ok(USAGE.commands.includes('subject places|place|reorder|folders|folder'));
});

test('an assistant saves a place and reads it back; the record is a plain named file with its author and a journal line',async t=>{
 const f=await setup(t),id='invented-tea-house';
 const before=await one(f,id);
 assert.deepEqual([before.saved,before.revision,before.folder,before.pinnedAt,before.archived],[false,0,[],null,false]);
 const saved=await f.cli(['subject','place'],{parentStudyId:id,expectedRevision:0,folder:['Tea','Houses'],tags:['oolong','visit',' Oolong '],pinned:true,order:3});
 assert.equal(saved.exitCode,0,JSON.stringify(saved.result));
 assert.deepEqual([saved.result.revision,saved.result.folder,saved.result.tags,saved.result.order,saved.result.updatedBy],[1,['Tea','Houses'],['oolong','visit'],3,'agent:codex']);
 assert.ok(Date.parse(saved.result.pinnedAt)>0);
 const file=path.join(f.dataDir,'subject-places','subjects',id+'.json'),record=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(record.parentStudyId,id);assert.equal(record.operations[0].actor,'agent:codex');
 const all=(await f.page('GET','/api/subject-places')).body;
 assert.deepEqual(all.places.map(p=>p.parentStudyId),[id],'the app sees the same record');
 assert.deepEqual(all.folders.folders.map(x=>[x.path,x.saved,x.count]),[[['Tea'],false,0],[['Tea','Houses'],false,1]],'a folder in use is listed with its parent');
 const again=await f.cli(['subject','place'],{parentStudyId:id,expectedRevision:1,expectedHash:saved.result.hash,archived:true,pinned:false});
 assert.equal(again.exitCode,0,JSON.stringify(again.result));
 assert.deepEqual([again.result.archived,again.result.pinnedAt,again.result.folder],[true,null,['Tea','Houses']],'fields not named are kept');
 const lines=(await f.cli(['history'],{kind:'project',id})).result;
 assert.ok(JSON.stringify(lines).includes('subject-places.save'));assert.ok(JSON.stringify(lines).includes('agent:codex'));
 // An id that cannot be a plain file name is still saved, under its digest.
 const odd='mag:invented story';
 assert.equal((await f.cli(['subject','place'],{parentStudyId:'mag:invented-story',expectedRevision:0,archived:true})).exitCode,0);
 assert.equal((await f.cli(['subject','place'],{parentStudyId:odd,expectedRevision:0,archived:true})).exitCode,1,'a space is not part of a project id');
});

test('a stale write answers 409 and changes nothing; a retried operation is the same change',async t=>{
 const f=await setup(t),id='invented-clay',operationId=randomUUID();
 const first=await f.cli(['subject','place'],{parentStudyId:id,operationId,expectedRevision:0,folder:['Clay']});
 assert.equal(first.exitCode,0);
 const retry=await f.cli(['subject','place'],{parentStudyId:id,operationId,expectedRevision:0,folder:['Clay']});
 assert.equal(retry.exitCode,0);assert.equal(retry.result.replayed,true);assert.equal(retry.result.revision,1);
 const reused=await f.cli(['subject','place'],{parentStudyId:id,operationId,expectedRevision:0,folder:['Other']});
 assert.equal(reused.exitCode,3);
 const stale=await f.cli(['subject','place'],{parentStudyId:id,expectedRevision:0,folder:['Elsewhere']});
 assert.equal(stale.exitCode,3,JSON.stringify(stale.result));assert.equal(stale.result.error,'revision_conflict');
 const wrongHash=await f.page('POST','/api/subject-places/save',{parentStudyId:id,operationId:randomUUID(),expectedRevision:1,expectedHash:'0'.repeat(64),archived:true});
 assert.equal(wrongHash.status,409);
 assert.equal((await f.page('POST','/api/subject-places/save',{parentStudyId:id,operationId:randomUUID(),expectedRevision:1,archived:true})).status,400,'a saved place needs its hash');
 assert.equal((await f.page('POST','/api/subject-places/save',{parentStudyId:id,operationId:randomUUID(),expectedRevision:1,expectedHash:first.result.hash,colour:'red'})).status,400,'unknown fields are refused');
 assert.equal((await f.page('POST','/api/subject-places/save',{parentStudyId:id,operationId:randomUUID(),expectedRevision:1,expectedHash:first.result.hash,folder:['a/b']})).status,400,'a folder name is a plain name');
 const now=await one(f,id);assert.deepEqual([now.revision,now.folder,now.archived],[1,['Clay'],false]);
 assert.equal((await f.send('POST','/api/subject-places/save',{body:{parentStudyId:id,operationId:randomUUID(),expectedRevision:1,expectedHash:now.hash,archived:true}})).status,400,'a write names its author');
});

test('reorder sets a hand order for several subjects in one call, and refuses all of it when one is stale',async t=>{
 const f=await setup(t),ids=['invented-a','invented-b','invented-c'];
 const placed=[];for(const id of ids)placed.push((await f.cli(['subject','place'],{parentStudyId:id,expectedRevision:0,folder:['Tea']})).result);
 const items=[{parentStudyId:'invented-c',expectedRevision:1,expectedHash:placed[2].hash},{parentStudyId:'invented-a',expectedRevision:1,expectedHash:placed[0].hash},{parentStudyId:'invented-b',expectedRevision:1,expectedHash:placed[1].hash},{parentStudyId:'invented-unsaved',expectedRevision:0}];
 const done=await f.cli(['subject','reorder'],{items});
 assert.equal(done.exitCode,0,JSON.stringify(done.result));
 assert.deepEqual(done.result.places.map(p=>[p.parentStudyId,p.order]),[['invented-c',0],['invented-a',1],['invented-b',2],['invented-unsaved',3]]);
 const stale=await f.cli(['subject','reorder'],{items:items.map(i=>({...i}))});
 assert.equal(stale.exitCode,3);assert.match(JSON.stringify(stale.result),/invented-c/);
 const after=(await f.cli(['subject','places'])).result.places;
 assert.deepEqual(after.map(p=>[p.parentStudyId,p.order,p.revision]).sort(),[['invented-a',1,2],['invented-b',2,2],['invented-c',0,2],['invented-unsaved',3,1]],'nothing moved on the refused call');
 assert.equal((await f.cli(['subject','reorder'],{items:[items[0],items[0]]})).exitCode,1,'each subject once');
});

test('folders: create (an empty one stays), rename moves its subjects, Undo takes it back, remove only when empty',async t=>{
 const f=await setup(t);
 let list=(await f.cli(['subject','folders'])).result;
 assert.deepEqual([list.revision,list.folders,list.undoOperationId],[0,[],null]);
 const change=async(input,actor='agent:codex')=>{const r=await f.cli(['subject','folder'],{expectedRevision:list.revision,expectedHash:list.hash,...input},actor);if(r.exitCode===0)list=r.result;return r;};
 assert.equal((await change({action:'create',path:['Art','Studio']})).exitCode,0);
 assert.deepEqual(list.folders.map(x=>[x.path,x.saved]),[[['Art'],true],[['Art','Studio'],true]],'its parent is created with it');
 assert.equal((await change({action:'create',path:['Tea']})).exitCode,0);
 assert.equal((await change({action:'create',path:['Tea']})).exitCode,3,'no two folders with one path');
 assert.equal((await change({action:'reorder',order:[['Tea'],['Art'],['Art','Studio']]})).exitCode,0);
 assert.deepEqual(list.folders.map(x=>x.path.join('/')),['Tea','Art','Art/Studio']);
 const filed=(await f.cli(['subject','place'],{parentStudyId:'invented-kiln',expectedRevision:0,folder:['Art','Studio']})).result;
 list=(await f.cli(['subject','folders'])).result;
 assert.equal(list.folders.find(x=>x.path.join('/')==='Art/Studio').count,1);
 const renamed=await change({action:'rename',path:['Art'],name:'Making'});
 assert.equal(renamed.exitCode,0,JSON.stringify(renamed.result));
 assert.deepEqual(list.folders.map(x=>x.path.join('/')),['Tea','Making','Making/Studio']);
 assert.deepEqual((await one(f,'invented-kiln')).folder,['Making','Studio'],'the subject moved with its folder');
 assert.equal((await one(f,'invented-kiln')).revision,filed.revision+1);
 assert.equal(list.undoOperationId,renamed.result.receipt.operationId);
 assert.equal((await change({action:'undo',undoOperationId:list.undoOperationId})).exitCode,0);
 assert.deepEqual(list.folders.map(x=>x.path.join('/')),['Tea','Art','Art/Studio']);
 assert.deepEqual((await one(f,'invented-kiln')).folder,['Art','Studio'],'Undo moved the subject back');
 assert.equal(list.undoOperationId,null,'an Undo is not undone again');
 assert.equal((await change({action:'remove',path:['Art','Studio']})).exitCode,3,'a folder with a subject in it stays');
 assert.equal((await change({action:'remove',path:['Art']})).exitCode,3,'a folder with a folder in it stays');
 assert.equal((await change({action:'remove',path:['Tea']})).exitCode,0,'an empty folder can be removed');
 assert.deepEqual(list.folders.map(x=>x.path.join('/')),['Art','Art/Studio']);
 const stale=await f.cli(['subject','folder'],{action:'create',path:['Late'],expectedRevision:1,expectedHash:list.hash});
 assert.equal(stale.exitCode,3);
 assert.ok(fs.existsSync(path.join(f.dataDir,'subject-places','folders.json')));
 const lines=JSON.stringify((await f.cli(['history'],{kind:'subjects',id:'folders'})).result);
 assert.ok(lines.includes('subject-places.folders.post'));
});

test('the browser\'s own filing is carried over once, stamped as an import; afterwards the saved place wins',async t=>{
 const f=await setup(t),id='invented-garden',pinnedAt='2026-11-01T09:30:00.000Z';
 const carried=await f.page('POST','/api/subject-places/carry',{parentStudyId:id,operationId:randomUUID(),folder:['Garden'],archived:false,pinnedAt});
 assert.equal(carried.status,200,JSON.stringify(carried.body));
 assert.deepEqual([carried.body.carried,carried.body.updatedBy,carried.body.importedFrom,carried.body.carriedBy,carried.body.pinnedAt,carried.body.revision],[true,'import:browser','browser','human:adrian',pinnedAt,1]);
 const second=await f.page('POST','/api/subject-places/carry',{parentStudyId:id,operationId:randomUUID(),folder:['Another browser'],archived:true,pinnedAt:null});
 assert.equal(second.status,200);
 assert.deepEqual([second.body.carried,second.body.folder,second.body.archived,second.body.revision],[false,['Garden'],false,1],'the saved place wins and nothing changes');
 const lines=(await f.cli(['history'],{kind:'project',id})).result;
 assert.match(JSON.stringify(lines),/import:browser/);
 // Later changes are ordinary saves by whoever makes them.
 const moved=await f.cli(['subject','place'],{parentStudyId:id,expectedRevision:1,expectedHash:carried.body.hash,folder:['Garden','Beds']},'agent:claude-code');
 assert.equal(moved.exitCode,0);assert.equal(moved.result.updatedBy,'agent:claude-code');assert.equal(moved.result.importedFrom,'browser');
});

test('MCP reaches the same organising commands as an assistant, and the page sees what it did',async t=>{
 const f=await setup(t),tools=createTools({url:f.url,actor:'agent:claude-code'}),id='invented-ferment';
 const read=await tools.callTool('ar_create_call',{name:'subject-places',input:{parentStudyId:id}});
 assert.equal(read.places[0].saved,false);
 const saved=await tools.callTool('ar_create_call',{name:'subject-places.save',input:{parentStudyId:id,operationId:randomUUID(),expectedRevision:0,pinned:true,tags:['jars']}});
 assert.equal(saved.updatedBy,'agent:claude-code');
 const folder=await tools.callTool('ar_create_call',{name:'subject-places.folders.get',input:{}});
 const made=await tools.callTool('ar_create_call',{name:'subject-places.folders.post',input:{action:'create',path:['Kitchen'],operationId:randomUUID(),expectedRevision:folder.revision,expectedHash:folder.hash}});
 assert.deepEqual(made.folders.map(x=>x.path),[['Kitchen']]);
 const app=(await f.page('GET','/api/subject-places')).body;
 assert.deepEqual(app.places.map(p=>[p.parentStudyId,p.tags,!!p.pinnedAt]),[[id,['jars'],true]]);
 assert.deepEqual(app.folders.folders.map(x=>x.path),[['Kitchen']]);
});

test('subjects with no saved place still list exactly as before',async t=>{
 const f=await setup(t),id='invented-old-subject';
 const made=await f.cli(['project','create'],{parentStudyId:id,title:'Invented old subject',operationId:randomUUID()});
 assert.equal(made.exitCode,0,JSON.stringify(made.result));
 const listed=await f.cli(['project','list']);
 assert.equal(listed.exitCode,0,JSON.stringify(listed.result));
 const before=JSON.stringify(listed.result);
 assert.ok(before.includes(id),'the old subject lists');
 assert.deepEqual((({saved,revision,folder,archived,pinnedAt})=>({saved,revision,folder,archived,pinnedAt}))(await one(f,id)),{saved:false,revision:0,folder:[],archived:false,pinnedAt:null});
 const places=(await f.cli(['subject','places'])).result;
 assert.deepEqual([places.places,places.folders.folders],[[],[]],'no place is invented for an old subject');
 assert.equal(fs.existsSync(path.join(f.dataDir,'subject-places','subjects')),true);
 assert.equal(fs.readdirSync(path.join(f.dataDir,'subject-places','subjects')).length,0,'reading writes no records');
 assert.equal(JSON.stringify((await f.cli(['project','list'])).result),before,'project list is unchanged by reading places');
});

test('ids that differ only in capitals keep separate files on a case-insensitive disk; a lower-case id keeps its plain name',async t=>{
 const f=await setup(t);
 assert.equal((await f.cli(['subject','place'],{parentStudyId:'abc',expectedRevision:0,folder:['Lower']})).exitCode,0);
 assert.equal((await f.cli(['subject','place'],{parentStudyId:'Abc',expectedRevision:0,folder:['Upper']})).exitCode,0);
 const dir=path.join(f.dataDir,'subject-places','subjects'),names=fs.readdirSync(dir);
 assert.ok(names.includes('abc.json'),'the lower-case id is found under its own name');
 assert.equal(new Set(names.map(n=>n.toLowerCase())).size,names.length,'no two files differ only in capitals');
 assert.deepEqual((await one(f,'abc')).folder,['Lower']);assert.deepEqual((await one(f,'Abc')).folder,['Upper']);
 assert.equal((await f.cli(['subject','places'])).result.places.length,2);
});

test('a carry fills only the fields the saved place does not hold yet',async t=>{
 const f=await setup(t),id='invented-tagged';
 const tagged=(await f.cli(['subject','place'],{parentStudyId:id,expectedRevision:0,tags:['jars']})).result;
 assert.deepEqual(tagged.held,['tags']);
 const carried=await f.page('POST','/api/subject-places/carry',{parentStudyId:id,operationId:randomUUID(),folder:['Kitchen'],pinnedAt:'2026-11-02T10:00:00.000Z',tags:['other']});
 assert.equal(carried.status,200,JSON.stringify(carried.body));
 assert.deepEqual([carried.body.carried,carried.body.tags,carried.body.folder,carried.body.pinnedAt,carried.body.updatedBy,carried.body.revision],[true,['jars'],['Kitchen'],'2026-11-02T10:00:00.000Z','import:browser',2]);
 const again=await f.page('POST','/api/subject-places/carry',{parentStudyId:id,operationId:randomUUID(),folder:['Elsewhere']});
 assert.deepEqual([again.body.carried,again.body.folder,again.body.revision],[false,['Kitchen'],2]);
});

test('the desk keeps its own hand order (deskOrder), apart from the order in a folder; an older place has none',async t=>{
 const f=await setup(t),ids=['invented-d1','invented-d2','invented-d3'];
 const placed=[];for(const [i,id] of ids.entries())placed.push((await f.cli(['subject','place'],{parentStudyId:id,expectedRevision:0,folder:['Tea'],pinned:true,order:i})).result);
 assert.deepEqual(placed.map(p=>p.deskOrder),[null,null,null],'no desk order until one is set: the desk goes by pin time');
 // The desk order is set through reorder with which:desk, and the folder order is untouched.
 const items=[2,0,1].map(i=>({parentStudyId:ids[i],expectedRevision:1,expectedHash:placed[i].hash}));
 const desk=await f.cli(['subject','reorder'],{which:'desk',items});
 assert.equal(desk.exitCode,0,JSON.stringify(desk.result));
 assert.deepEqual(desk.result.places.map(p=>[p.parentStudyId,p.deskOrder,p.order]),[['invented-d3',0,2],['invented-d1',1,0],['invented-d2',2,1]]);
 // Reordering the folder leaves the desk as it was.
 const now=desk.result.places;
 const folder=await f.cli(['subject','reorder'],{items:[1,2,0].map(i=>({parentStudyId:now[i].parentStudyId,expectedRevision:now[i].revision,expectedHash:now[i].hash}))});
 assert.equal(folder.exitCode,0,JSON.stringify(folder.result));
 assert.deepEqual(folder.result.places.map(p=>[p.parentStudyId,p.order,p.deskOrder]),[['invented-d1',0,1],['invented-d2',1,2],['invented-d3',2,0]]);
 // deskOrder through save, and null clears it; a bad value or an unknown order name is refused.
 const d1=folder.result.places[0];
 const saved=await f.cli(['subject','place'],{parentStudyId:'invented-d1',expectedRevision:d1.revision,expectedHash:d1.hash,deskOrder:9});
 assert.deepEqual([saved.result.deskOrder,saved.result.order,saved.result.folder],[9,0,['Tea']]);
 const cleared=await f.cli(['subject','place'],{parentStudyId:'invented-d1',expectedRevision:saved.result.revision,expectedHash:saved.result.hash,deskOrder:null});
 assert.equal(cleared.result.deskOrder,null);
 assert.equal((await f.cli(['subject','place'],{parentStudyId:'invented-d1',expectedRevision:cleared.result.revision,expectedHash:cleared.result.hash,deskOrder:'first'})).exitCode,1);
 assert.equal((await f.cli(['subject','reorder'],{which:'shelf',items:[{parentStudyId:'invented-d9',expectedRevision:0}]})).exitCode,1);
 // A place saved before the desk had its own order: read, hashed and saved exactly as before.
 const file=path.join(f.dataDir,'subject-places','subjects','invented-old.json');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify({schema:'ar-create.subject-place.v1',parentStudyId:'invented-old',folder:['Tea'],tags:[],pinnedAt:'2026-11-01T00:00:00.000Z',archived:false,order:4,held:['folder','pinnedAt','order'],revision:3,operations:[]},null,1)+'\n');
 const old=await one(f,'invented-old');
 assert.deepEqual([old.deskOrder,old.order,old.revision],[null,4,3]);
 const tagged=await f.cli(['subject','place'],{parentStudyId:'invented-old',expectedRevision:3,expectedHash:old.hash,tags:['kept']});
 assert.equal(tagged.exitCode,0,JSON.stringify(tagged.result));
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).deskOrder,undefined,'nothing is written for a desk order never set');
});
