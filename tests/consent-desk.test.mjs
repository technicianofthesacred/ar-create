// The truth and consent desk (How I Work, step 6): claims linked to their source moments, people with how they
// appear and their consent, Share's two questions and the release hold. Agents find, link, list and draft;
// sending, consent answers, the Share answers, the override and the final yes are Adrian's.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const TRANSCRIPT='Invented fixture. Potter: I fire the kiln for three days and three nights.\n\nPotter: My teacher said the clay remembers the river.\n';
function tinyPng(){
 const crcTable=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c;});
 const crc=buf=>{let c=-1;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^-1)>>>0;};
 const chunk=(type,data)=>{const t=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,sum]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(2,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.alloc(14,120))),chunk('IEND',Buffer.alloc(0))]);
}

async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const call=async(name,input,actor='agent:claude-code')=>run(['--url',url,'--actor',actor,'call',name,'--input','-'],{stdin:async()=>JSON.stringify(input)});
 const imported=await (await fetch(url+'/api/sources/import',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian','X-AR-Client':'http'},body:JSON.stringify({rootId:'library',folder:'',urls:[],files:[{name:'Invented potter conversation.md',content:TRANSCRIPT},{name:'Invented kiln.png',base64:tinyPng().toString('base64')}]})})).json();
 const [transcriptId,photoId]=imported.receipts.map(r=>r.source?.id);
 assert.ok(transcriptId&&photoId,'invented Library sources were imported');
 const scope={parentStudyId:'consent-'+randomUUID().slice(0,8),pieceKey:'main'};
 const read=async()=>{const r=await call('consent.desk',scope);assert.equal(r.exitCode,0,JSON.stringify(r.result));return r.result;};
 // Every write carries the record's revision and hash and a fresh operationId.
 const write=async(name,body,actor)=>{const d=await read();return call(name,{...scope,operationId:randomUUID(),expectedRevision:d.revision,expectedHash:d.hash,...body},actor);};
 return {url,call,read,write,scope,transcriptId,photoId,dataDir:config.dataDir};
}
const ADRIAN='human:adrian';

test('every consent route is a registered command; decisions are human-only, finding and drafting are open to agents',async t=>{
 const f=await setup(t),caps=await (await fetch(f.url+'/api/capabilities')).json(),by=name=>caps.commands.find(c=>c.name===name);
 for(const name of ['consent.people.sent','consent.people.answer','consent.people.remove','consent.share.answer','consent.share.override','consent.share.release'])assert.deepEqual(by(name)?.actors,['human'],name);
 for(const name of ['consent.claims.record','consent.claims.link','consent.claims.flag','consent.claims.clear-flag','consent.people.record','consent.people.draft-request'])assert.deepEqual(by(name)?.actors,['any'],name);
 for(const name of ['consent.desk','consent.open']){assert.equal(by(name)?.readOnly,true,name);assert.equal(by(name)?.method,'GET');}
 assert.ok(caps.commands.filter(c=>c.route.startsWith('/api/consent/')).every(c=>c.section==='consent'));
});

test('claims link to a Library passage, a recording moment or a photo; unsourced claims are flagged',async t=>{
 const f=await setup(t);
 const source=(await f.call('concept.source',{sourceId:f.transcriptId})).result,quote='My teacher said the clay remembers the river.',start=source.text.indexOf(quote);
 assert.ok(start>=0);
 // An agent records what it finds in the piece. One claim has no source yet.
 assert.equal((await f.write('consent.claims.record',{claim:{kind:'claim',text:'He fires the kiln for three days.'}})).exitCode,0);
 const quoted=await f.write('consent.claims.record',{claim:{kind:'quote',text:'"My teacher said the clay remembers the river."',source:{type:'library',sourceId:f.transcriptId,sourceHash:source.hash,start,quote}}});
 assert.equal(quoted.exitCode,0,JSON.stringify(quoted.result));
 let desk=await f.read();
 assert.equal(desk.summary.unsourced,1);assert.equal(desk.summary.sourced,1);
 assert.equal(desk.claims.find(c=>c.kind==='quote').fidelity,'exact');
 assert.equal(desk.claims.find(c=>c.kind==='quote').source.linked.by,'agent:claude-code');
 // Linking the unsourced claim to the recording moment where it was said.
 const claimId=desk.claims.find(c=>c.status==='unsourced').id;
 const linked=await f.write('consent.claims.link',{claimId,source:{type:'recording',sourceId:f.transcriptId,atMs:12000,quote:'I fire the kiln for three days and three nights.'}});
 assert.equal(linked.exitCode,0,JSON.stringify(linked.result));
 desk=linked.result;assert.equal(desk.summary.unsourced,0);assert.equal(desk.claims.find(c=>c.id===claimId).source.atMs,12000);
 // A photo backs a claim about what is pictured.
 assert.equal((await f.write('consent.claims.record',{claim:{kind:'claim',text:'The kiln is wood-fired.',source:{type:'photo',sourceId:f.photoId}}})).exitCode,0);
 // A passage that is not in the source, or a stale hash, is refused: nothing is linked on trust.
 assert.equal((await f.write('consent.claims.link',{claimId,source:{type:'library',sourceId:f.transcriptId,sourceHash:source.hash,start,quote:'The clay forgets.'}})).exitCode,3);
 assert.equal((await f.write('consent.claims.link',{claimId,source:{type:'library',sourceId:f.transcriptId,sourceHash:'0'.repeat(64),start,quote}})).exitCode,3);
 assert.equal((await f.write('consent.claims.link',{claimId,source:{type:'recording',sourceId:f.transcriptId,atMs:5,quote:'Words nobody said.'}})).exitCode,3);
 assert.equal((await f.write('consent.claims.link',{claimId,source:{type:'photo',sourceId:randomUUID()}})).exitCode,1,'an unknown source is not found');
 // A quote that drifted from its source is shown as differing.
 assert.equal((await f.write('consent.claims.record',{claim:{kind:'quote',text:'My teacher said clay remembers rivers.',source:{type:'library',sourceId:f.transcriptId,sourceHash:source.hash,start,quote}}})).exitCode,0);
 assert.equal((await f.read()).summary.quotesDiffering,1);
});

test('agents raise only doubtful claims and may withdraw their own doubt; only Adrian clears another\'s',async t=>{
 const f=await setup(t);
 await f.write('consent.claims.record',{claim:{kind:'claim',text:'The village has made tea for a thousand years.'}});
 const claimId=(await f.read()).claims[0].id;
 const flagged=await f.write('consent.claims.flag',{claimId,reason:'No source gives a date; a thousand years may be legend.'});
 assert.equal(flagged.result.claims[0].status,'doubtful');assert.equal(flagged.result.summary.doubtful,1);
 assert.equal((await f.write('consent.claims.clear-flag',{claimId},'agent:codex')).exitCode,5,'another agent cannot clear it');
 assert.equal((await f.write('consent.claims.clear-flag',{claimId,note:'Found the county record.'})).exitCode,0,'the agent that raised it may withdraw it');
 await f.write('consent.claims.flag',{claimId,reason:'Still unsure.'},'agent:codex');
 assert.equal((await f.write('consent.claims.clear-flag',{claimId},ADRIAN)).exitCode,0,'Adrian clears any doubt');
});

test('agents list people and draft a request; agent cannot set consent or record sending',async t=>{
 const f=await setup(t);
 const listed=await f.write('consent.people.record',{person:{name:'Invented Potter',appears:['named','quoted','pictured']}});
 assert.equal(listed.exitCode,0,JSON.stringify(listed.result));
 const person=listed.result.people[0];assert.equal(person.consent.state,'not-asked');assert.deepEqual(person.appears,['named','pictured','quoted']);
 assert.equal((await f.write('consent.people.record',{person:{name:'invented potter',appears:['named']}})).exitCode,3,'the same person is not listed twice');
 const drafted=await f.write('consent.people.draft-request',{personId:person.id,text:'I wrote about our afternoon at the kiln. Would you read it and tell me if you are happy to be named and pictured?'});
 assert.equal(drafted.result.people[0].request.by,'agent:claude-code');assert.equal(drafted.result.people[0].consent.state,'not-asked','drafting is not asking');
 // Agent cannot set consent, record that a message was sent, or take someone off the piece.
 for(const state of ['yes','yes-with-changes','no','asked'])assert.equal((await f.write('consent.people.answer',{personId:person.id,state,...(state==='yes-with-changes'?{changes:'x'}:{})})).exitCode,5,'agent cannot set consent: '+state);
 assert.equal((await f.write('consent.people.sent',{personId:person.id,sentAt:'2026-11-03',channel:'WeChat'})).exitCode,5,'agent cannot record sending');
 assert.equal((await f.write('consent.people.remove',{personId:person.id,reason:'cut'})).exitCode,5);
 // Not over raw HTTP either.
 const d=await f.read(),raw=await fetch(f.url+'/api/consent/people/answer',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'agent:hermes','X-AR-Client':'http'},body:JSON.stringify({...f.scope,operationId:randomUUID(),expectedRevision:d.revision,expectedHash:d.hash,personId:person.id,state:'yes'})});
 assert.equal(raw.status,403);
 assert.equal((await f.read()).people[0].consent.state,'not-asked');
 // An agent changing how someone appears cannot touch their consent either.
 const moved=await f.write('consent.people.record',{person:{personId:person.id,name:'Invented Potter',appears:['named']}});
 assert.equal(moved.result.people[0].consent.state,'not-asked');
 // Adrian records that he sent it, then their answer.
 assert.equal((await f.write('consent.people.sent',{personId:person.id,sentAt:'2026-11-03',channel:'WeChat'},ADRIAN)).result.people[0].consent.state,'asked');
 const answered=await f.write('consent.people.answer',{personId:person.id,state:'yes-with-changes',changes:'Use my first name only.'},ADRIAN);
 assert.equal(answered.result.people[0].consent.state,'yes-with-changes');assert.equal(answered.result.people[0].consent.by,ADRIAN);
 assert.equal((await f.write('consent.people.answer',{personId:person.id,state:'yes-with-changes'},ADRIAN)).exitCode,1,'changes are required with yes-with-changes');
});

test('release blocked while unanswered; Share asks comfort and accuracy; the final yes is Adrian\'s',async t=>{
 const f=await setup(t);
 await f.write('consent.people.record',{person:{name:'Invented Host',appears:['named']}});
 await f.write('consent.people.record',{person:{name:'Invented Neighbour',appears:['pictured']}});
 let desk=await f.read();const [host,neighbour]=desk.people;
 assert.equal(desk.release.held,true);assert.equal(desk.release.ready,false);assert.equal(desk.release.blockers.length,2);
 for(const question of ['comfort','accuracy'])assert.equal((await f.write('consent.share.answer',{question,answer:'yes'})).exitCode,5,'agent cannot answer Share: '+question);
 await f.write('consent.share.answer',{question:'comfort',answer:'yes'},ADRIAN);
 await f.write('consent.share.answer',{question:'accuracy',answer:'yes'},ADRIAN);
 // Release blocked while unanswered: even for Adrian.
 const blocked=await f.write('consent.share.release',{},ADRIAN);
 assert.equal(blocked.exitCode,3,JSON.stringify(blocked.result));assert.match(blocked.result.details.error,/on hold/);assert.match(blocked.result.details.error,/2 people have not given consent/);
 await f.write('consent.people.answer',{personId:host.id,state:'yes'},ADRIAN);
 desk=await f.read();assert.equal(desk.release.blockers.length,1);assert.equal((await f.write('consent.share.release',{},ADRIAN)).exitCode,3,'still one person unanswered');
 // A no holds too.
 await f.write('consent.people.answer',{personId:neighbour.id,state:'no'},ADRIAN);
 assert.equal((await f.read()).release.blockers[0].reason,'said no');
 await f.write('consent.people.answer',{personId:neighbour.id,state:'yes'},ADRIAN);
 desk=await f.read();assert.equal(desk.release.ready,true);
 assert.equal((await f.write('consent.share.release',{})).exitCode,5,'agent cannot give the final yes');
 const released=await f.write('consent.share.release',{},ADRIAN);
 assert.equal(released.exitCode,0,JSON.stringify(released.result));assert.equal(released.result.release.released.by,ADRIAN);assert.equal(released.result.release.released.current,true);
 // Someone who said yes to being named, now pictured as well, is open again and holds the release.
 await f.write('consent.people.record',{person:{personId:host.id,name:'Invented Host',appears:['named','pictured']}});
 desk=await f.read();assert.equal(desk.release.held,true);assert.match(desk.release.blockers[0].reason,/now pictured since answering/);assert.equal(desk.release.released.current,false);
 // Comfort "not yet" holds as well.
 await f.write('consent.people.answer',{personId:host.id,state:'yes'},ADRIAN);
 await f.write('consent.share.answer',{question:'comfort',answer:'not-yet',note:'Sleep on it.'},ADRIAN);
 assert.deepEqual((await f.read()).release.reasons,['You have not said you are comfortable sharing this.']);
});

test('agent cannot override the hold; Adrian can, with a reason that is journaled, and new people hold again',async t=>{
 const f=await setup(t);
 await f.write('consent.people.record',{person:{name:'Invented Teacher',appears:['quoted']}});
 await f.write('consent.share.answer',{question:'comfort',answer:'yes'},ADRIAN);
 await f.write('consent.share.answer',{question:'accuracy',answer:'yes'},ADRIAN);
 const refused=await f.write('consent.share.override',{reason:'They would not mind.'});
 assert.equal(refused.exitCode,5,'agent cannot override the hold');
 assert.equal((await f.read()).release.held,true);
 assert.equal((await f.write('consent.share.override',{reason:'  '},ADRIAN)).exitCode,1,'an override needs a reason');
 const operationId=randomUUID(),d=await f.read();
 const overridden=await f.call('consent.share.override',{...f.scope,operationId,expectedRevision:d.revision,expectedHash:d.hash,reason:'He passed away; his family asked me to share his words.'},ADRIAN);
 assert.equal(overridden.exitCode,0,JSON.stringify(overridden.result));
 assert.equal(overridden.result.release.held,false);assert.equal(overridden.result.release.overridden,true);assert.equal(overridden.result.release.ready,true);
 assert.equal(overridden.result.journal[0].reason,'He passed away; his family asked me to share his words.');
 const history=await (await fetch(f.url+'/api/journal?actor=human:adrian')).json(),line=history.lines.find(l=>l.operationId===operationId);
 assert.ok(line,'the override is a journal line');assert.equal(line.kind,'consent.share.override');assert.equal(line.actor,ADRIAN);assert.equal(line.reason,'He passed away; his family asked me to share his words.');
 // The override covered the people unanswered at the time, not anyone added later.
 await f.write('consent.people.record',{person:{name:'Invented Student',appears:['pictured']}});
 const later=await f.read();assert.equal(later.release.held,true);assert.equal(later.release.blockers.length,2);
 assert.equal((await f.write('consent.share.release',{},ADRIAN)).exitCode,3);
});

test('writes are idempotent and refuse stale reads',async t=>{
 const f=await setup(t),d=await f.read(),input={...f.scope,operationId:randomUUID(),expectedRevision:d.revision,expectedHash:d.hash,person:{name:'Invented Friend',appears:['named']}};
 const first=await f.call('consent.people.record',input),again=await f.call('consent.people.record',input);
 assert.equal(first.exitCode,0);assert.equal(again.exitCode,0);assert.equal(again.result.people.length,1,'the same operation is applied once');
 assert.equal((await f.call('consent.people.record',{...input,operationId:randomUUID()})).exitCode,3,'a stale revision is a conflict');
 assert.equal((await f.call('consent.people.record',{...input,person:{name:'Someone else',appears:['named']}})).exitCode,3,'a reused operationId for a different change is refused');
});

test('open consent items are listed read-only across pieces for a needs-you list',async t=>{
 const f=await setup(t);
 await f.write('consent.people.record',{person:{name:'Invented Elder',appears:['named','quoted']}});
 await f.write('consent.people.record',{person:{name:'Invented Child',appears:['pictured']}});
 const second={parentStudyId:f.scope.parentStudyId,pieceKey:'carousel-1'},d=(await f.call('consent.desk',second)).result;
 await f.call('consent.people.record',{...second,operationId:randomUUID(),expectedRevision:d.revision,expectedHash:d.hash,person:{name:'Invented Elder',appears:['pictured']}});
 const elder=(await f.read()).people.find(p=>p.name==='Invented Elder');
 await f.write('consent.people.answer',{personId:elder.id,state:'yes'},ADRIAN);
 const listing=await f.call('consent.open',{parentStudyId:f.scope.parentStudyId});
 assert.equal(listing.exitCode,0,JSON.stringify(listing.result));
 assert.equal(listing.result.count,2);assert.equal(listing.result.pieces,2);
 assert.deepEqual(listing.result.items.map(i=>[i.pieceKey,i.name]).sort(),[['carousel-1','Invented Elder'],['main','Invented Child']]);
 assert.ok(listing.result.items.every(i=>i.band==='only-adrian'&&i.ifUnanswered==='Release stays on hold.'));
 const all=await f.call('consent.open',{});assert.ok(all.result.count>=2);
 // A GET: nothing to write, no actor needed.
 assert.equal((await fetch(f.url+'/api/consent/open')).status,200);
 assert.equal((await fetch(f.url+'/api/consent/open',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':ADRIAN},body:'{}'})).status,405);
});

test('agents reach the desk through consent sugar in the CLI',async t=>{
 const f=await setup(t),caps=await (await fetch(f.url+'/api/capabilities')).json(),names=new Set(caps.commands.map(c=>c.name));
 const {SUGAR}=await import('../agents/cli/ar-create.mjs');
 for(const [verb,name] of Object.entries(SUGAR.consent))assert.ok(names.has(name),'consent '+verb+' -> '+name);
 assert.ok(!Object.values(SUGAR.consent).some(name=>caps.commands.find(c=>c.name===name).actors.includes('human')),'sugar offers agents only what agents may do');
 const listed=await run(['--url',f.url,'--actor','agent:claude-code','consent','open','--input','-'],{stdin:async()=>'{}'});
 assert.equal(listed.exitCode,0,JSON.stringify(listed.result));assert.equal(listed.result.schema,'ar-create.consent-open.v1');
});
