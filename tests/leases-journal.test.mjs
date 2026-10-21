import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';

const repo=path.resolve(import.meta.dirname,'..');
async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:claude-code')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 const app=async(route,input)=>{const response=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};};
 const journalLines=()=>{const dir=path.join(config.dataDir,'journal');return fs.existsSync(dir)?fs.readdirSync(dir).flatMap(name=>fs.readFileSync(path.join(dir,name),'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))):[];};
 return {url,cli,app,config,journalLines};
}
const conceptSave=(pid,current,extra={})=>({parentStudyId:pid,operationId:randomUUID(),expectedRevision:current.revision,expectedHash:current.hash,authorThoughts:'',aiInterpretation:'',suggestions:'',sourceSelections:[],...extra});

test('a foreign live lease answers 423 with the holder and changes no bytes; holder, release and expiry behave',async t=>{
 const f=await setup(t),pid='lease-'+randomUUID().slice(0,8);
 const made=await f.cli(['project','create'],{parentStudyId:pid,title:'Leased',operationId:randomUUID()});assert.equal(made.exitCode,0,JSON.stringify(made.result));
 const base=(await f.cli(['project','save'],conceptSave(pid,made.result,{aiInterpretation:'Start.'}))).result;assert.ok(base.path);
 const scope={kind:'project',id:pid};
 const lease=await f.cli(['lease','acquire'],{scope,reason:'Drafting suggestions'});
 assert.equal(lease.exitCode,0,JSON.stringify(lease.result));assert.equal(lease.result.lease.actor,'agent:claude-code');
 assert.ok(Date.parse(lease.result.lease.expiresAt)-Date.parse(lease.result.lease.acquiredAt)===15*60_000,'15 minutes');
 assert.ok(fs.existsSync(path.join(f.config.dataDir,'leases','project',pid+'.json')));
 // Another agent and the app are both held at 423, with the holder named.
 const other=await f.cli(['lease','acquire'],{scope},'agent:codex');assert.equal(other.exitCode,4);assert.equal(other.result.details.holder.actor,'agent:claude-code');
 const before=fs.readFileSync(base.path,'utf8');
 const human=await f.app('/api/concept/save',conceptSave(pid,base,{aiInterpretation:'Typed in the app.'}));
 assert.equal(human.status,423);assert.equal(human.body.holder.actor,'agent:claude-code');assert.equal(human.body.holder.reason,'Drafting suggestions');assert.match(human.body.error,/agent:claude-code/);
 assert.equal(fs.readFileSync(base.path,'utf8'),before,'no bytes changed under a foreign lease');
 // The holder writes; renewing keeps the same lease.
 const mine=await f.cli(['project','save'],conceptSave(pid,base,{aiInterpretation:'From the holder.'}));assert.equal(mine.exitCode,0,JSON.stringify(mine.result));
 const renewed=await f.cli(['lease','renew'],{scope});assert.equal(renewed.result.renewed,true);assert.equal(renewed.result.lease.leaseId,lease.result.lease.leaseId);
 // Another agent cannot release it; the human can, with force.
 assert.equal((await f.cli(['lease','release'],{scope},'agent:codex')).exitCode,4);
 assert.equal((await f.cli(['lease','release'],{scope,force:true},'agent:codex')).exitCode,4,'force is human-only');
 const broken=await f.app('/api/leases/release',{scope,force:true});assert.equal(broken.status,200);assert.equal(broken.body.lease.releasedBy,'human:adrian');
 const now=await f.cli(['project','read'],{parentStudyId:pid});
 assert.equal((await f.app('/api/concept/save',conceptSave(pid,now.result,{aiInterpretation:'After release.'}))).status,200);
 // A short lease expires and is claimable.
 const brief=await f.cli(['lease','acquire'],{scope,ttlMs:1000});assert.equal(brief.exitCode,0);
 await new Promise(r=>setTimeout(r,1100));
 assert.equal((await f.cli(['lease','acquire'],{scope},'agent:codex')).exitCode,0,'expired lease is claimable');
 assert.deepEqual((await f.cli(['lease','list'],{kind:'project'})).result.leases.map(l=>l.actor),['agent:codex']);
 // Malformed scopes cannot reach the file system.
 assert.equal((await f.cli(['lease','acquire'],{scope:{kind:'project',id:'../escape'}})).exitCode,1);
 assert.equal((await f.cli(['lease','acquire'],{scope:{kind:'nope',id:'x'}})).exitCode,1);
});

test('journal: one line per operation (committed, conflict, rejected), with actor; handoff and ask lines',async t=>{
 const f=await setup(t),pid='journal-'+randomUUID().slice(0,8);
 const startLines=f.journalLines().length;let operations=0;
 const made=await f.cli(['project','create'],{parentStudyId:pid,title:'Journaled',operationId:randomUUID()},'agent:codex');operations++;assert.equal(made.exitCode,0);
 const first=await f.app('/api/concept/save',conceptSave(pid,made.result,{authorThoughts:'Mine.'}));operations++;assert.equal(first.status,200);
 const stale=await f.cli(['project','save'],conceptSave(pid,made.result,{aiInterpretation:'Stale.'}),'agent:codex');operations++;assert.equal(stale.exitCode,3);
 const adopt=await f.cli(['project','save'],conceptSave(pid,first.body,{adoptedDirection:'Agent decides.'}),'agent:codex');operations++;assert.equal(adopt.exitCode,5);
 const second=await f.cli(['project','save'],conceptSave(pid,first.body,{authorThoughts:'Mine.',aiInterpretation:'A reading.'}),'agent:codex');operations++;assert.equal(second.exitCode,0);
 // Reads, presence and leases are not operations.
 await f.cli(['project','read'],{parentStudyId:pid});await f.cli(['status']);
 await fetch(f.url+'/api/presence',{method:'POST',headers:{'Content-Type':'application/json',Origin:f.url},body:JSON.stringify({scope:{kind:'project',id:pid},dirty:true,sequence:1})});
 const lines=f.journalLines().slice(startLines);
 assert.equal(lines.length,operations,'journal lines == operations');
 assert.deepEqual(lines.map(l=>[l.kind,l.status,l.actor,l.client]),[['concepts.post','committed','agent:codex','cli'],['concept.save','committed','human:adrian','ui'],['concept.save','conflict','agent:codex','cli'],['concept.save','rejected','agent:codex','cli'],['concept.save','committed','agent:codex','cli']]);
 for(const line of lines){assert.deepEqual(line.scope,{kind:'project',id:pid});assert.ok(Date.parse(line.ts));assert.match(line.operationId,/^[a-f0-9-]{36}$/);}
 assert.deepEqual(lines[1].before,{revision:made.result.revision,hash:made.result.hash});assert.equal(lines[1].after.revision,first.body.revision);assert.equal(lines[1].after.hash,first.body.hash);
 assert.match(lines[3].reason,/human-only/);
 // The month file is append-only JSONL.
 const month=new Date().toISOString().slice(0,7);assert.ok(fs.existsSync(path.join(f.config.dataDir,'journal',month+'.jsonl')));
 // An agent hands off and asks; both are lines the app can show.
 const handoff=await f.cli(['handoff'],{scope:{kind:'project',id:pid},to:'human:adrian',summary:'Interpretation saved; adopted direction is yours to decide.'},'agent:codex');
 assert.equal(handoff.exitCode,0,JSON.stringify(handoff.result));assert.equal(handoff.result.status,'handoff');
 const ask=await f.cli(['ask'],{scope:{kind:'project',id:pid},question:'Keep paragraph 4?',options:['Keep','Cut']},'agent:claude-code');
 assert.equal(ask.result.status,'needs-decision');assert.equal(ask.result.to,'human:adrian');
 assert.equal((await f.cli(['handoff'],{scope:{kind:'project',id:pid},to:'human:adrian',summary:'x'.repeat(281)})).exitCode,1,'summary is at most 280');
 const history=await f.cli(['history'],{kind:'project',id:pid});
 assert.equal(history.result.lines.length,operations+2);assert.equal(history.result.lines[0].status,'needs-decision');
 const waiting=await f.cli(['history'],{status:'needs-decision'});assert.equal(waiting.result.lines.length,1);
 assert.equal(f.journalLines().length-startLines,operations+2);
});
