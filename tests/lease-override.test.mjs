// Human words win over an agent's lease (Adrian, 2026-10-21): the human's save goes through, and the agent that held the
// lease is told once per lease term by a `conflict` journal line addressed to it and a `lease.override` event.
// Agent against agent stays 423 with the holder named.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {createLeases} from '../runtime/services/leases.mjs';
import {createEventBus} from '../runtime/services/events.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const settle=()=>new Promise(r=>setTimeout(r,40));
async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:claude-code')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 const app=async(route,input)=>{const response=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};};
 const journal=async query=>(await (await fetch(url+'/api/journal?'+new URLSearchParams(query))).json()).lines;
 return {url,cli,app,journal,config};
}
const conceptSave=(pid,current,extra={})=>({parentStudyId:pid,operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.hash,authorThoughts:'',aiInterpretation:'',suggestions:'',sourceSelections:[],...extra});

test('a human save under an agent lease succeeds and tells the holder once per lease term; agent vs agent stays 423',async t=>{
 const f=await setup(t),pid='override-'+randomUUID().slice(0,8),scope={kind:'project',id:pid};
 const made=await f.cli(['project','create'],{parentStudyId:pid,title:'Overridden',operationId:randomUUID()});assert.equal(made.exitCode,0,JSON.stringify(made.result));
 const lease=await f.cli(['lease','acquire'],{scope,reason:'Drafting suggestions'});assert.equal(lease.exitCode,0);
 // Agent against agent: 423, the holder named, nothing written.
 const codex=await f.cli(['project','save'],conceptSave(pid,made.result,{aiInterpretation:'Codex words.'}),'agent:codex');
 assert.equal(codex.exitCode,4);assert.equal(codex.result.details.holder.actor,'agent:claude-code');assert.equal(codex.result.details.outcome,'not-applied');
 const {cursor,bootId}=await (await fetch(f.url+'/api/events/since?since=0')).json();
 // The human writes over the agent's lease: it lands.
 const first=await f.app('/api/concept/save',conceptSave(pid,made.result,{authorThoughts:'My own words.'}));
 assert.equal(first.status,200,JSON.stringify(first.body));
 const read=await f.cli(['project','read'],{parentStudyId:pid});assert.equal(read.result.authorThoughts,'My own words.');
 // The original holder's lease is advisory, never permission to overwrite a newer human save.
 const humanBytes=fs.readFileSync(read.result.path);
 const staleHolder=await f.cli(['project','save'],conceptSave(pid,made.result,{aiInterpretation:'Prepared before the human save.'}));
 assert.equal(staleHolder.exitCode,3,JSON.stringify(staleHolder.result));
 assert.deepEqual(fs.readFileSync(read.result.path),humanBytes,'stale holder preserves the exact saved human bytes');
 const afterStale=await f.cli(['project','read'],{parentStudyId:pid});
 assert.equal(afterStale.result.revision,first.body.revision);
 assert.equal(afterStale.result.hash,first.body.hash);
 assert.equal(afterStale.result.authorThoughts,'My own words.');
 await settle();
 let notices=(await f.journal({kind:'project',id:pid,status:'conflict'})).filter(l=>l.kind==='lease.override');
 assert.equal(notices.length,1,'one notice for the holder');
 assert.equal(notices[0].kind,'lease.override');assert.equal(notices[0].to,'agent:claude-code');assert.equal(notices[0].actor,'human:adrian');
 assert.match(notices[0].summary,/Adrian saved this record while agent:claude-code held its lease \(Drafting suggestions\)\. Re-read/);
 assert.equal(notices[0].after.revision,first.body.revision);
 // Order in the journal (newest first): the notice follows the human's committed save.
 const lines=await f.journal({kind:'project',id:pid});
 assert.deepEqual(lines.filter(l=>l.actor==='human:adrian').slice(0,2).map(l=>[l.kind,l.status,l.actor]),[['lease.override','conflict','human:adrian'],['concept.save','committed','human:adrian']]);
 // The holder can see it as an event too, addressed to it.
 const since=(await (await fetch(f.url+'/api/events/since?since='+cursor+'&bootId='+bootId+'&kind=project&id='+pid)).json()).events;
 const override=since.find(e=>e.kind==='lease.override');assert.ok(override,'lease.override event');assert.equal(override.to,'agent:claude-code');assert.equal(override.lease.actor,'agent:claude-code');
 // The lease itself stays (advisory); a second human save in the same term does not repeat the notice.
 assert.equal((await f.cli(['lease','list'],{kind:'project',id:pid})).result.leases.length,1);
 const second=await f.app('/api/concept/save',conceptSave(pid,first.body,{authorThoughts:'More of my words.'}));assert.equal(second.status,200);
 await settle();
 assert.equal(((await f.journal({kind:'project',id:pid,status:'conflict'})).filter(l=>l.kind==='lease.override')).length,1,'one notice per lease term');
 // The holder renews (a new term): the next human save tells it again.
 assert.equal((await f.cli(['lease','renew'],{scope})).exitCode,0);
 const third=await f.app('/api/concept/save',conceptSave(pid,second.body,{authorThoughts:'Still mine.'}));assert.equal(third.status,200);
 await settle();
 notices=(await f.journal({kind:'project',id:pid,status:'conflict'})).filter(l=>l.kind==='lease.override');assert.equal(notices.length,2);
 // A refused human write (stale revision) sends no notice: only a write that landed counts.
 assert.equal((await f.cli(['lease','renew'],{scope})).exitCode,0);
 const stale=await f.app('/api/concept/save',conceptSave(pid,made.result,{authorThoughts:'Stale.'}));assert.equal(stale.status,409);
 await settle();
 assert.equal((await f.journal({kind:'project',id:pid,status:'conflict',actor:'human:adrian'})).filter(l=>l.kind==='lease.override').length,2);
});

test('leases.check returns the overridden holder for a human and still throws 423 between agents',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-lease-check-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const events=createEventBus(),leases=createLeases({dataDir,events}),scope={kind:'draft',id:'d-1'};
 await leases.acquire({scope,reason:'Proposing'},{actor:'agent:codex',client:'cli'});
 assert.equal(leases.check(scope,{actor:'human:adrian',client:'ui'}).overridden.actor,'agent:codex');
 assert.throws(()=>leases.check(scope,{actor:'agent:claude-code',client:'cli'}),error=>error.status===423&&error.holder.actor==='agent:codex');
 assert.equal(leases.check(scope,{actor:'agent:codex',client:'cli'}),null);
});
