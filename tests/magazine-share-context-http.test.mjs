import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {createReviewConnection} from '../scripts/review-connection.mjs';
import {run as runCLI} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {buildMagazineFixture,treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration,INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const draft='Workflow/3-Develop/DEV - Clay Teacher (story).md';
const feedback='Workflow/6-Feedback/FEEDBACK - Clay Teacher.md';
const route='/api/magazine/working-draft/share-context';
async function fixture(t,{writable=false}={}){
 const f=buildMagazineFixture();t.after(f.cleanup);
 fs.mkdirSync(path.dirname(path.join(f.vault,feedback)),{recursive:true});
 fs.writeFileSync(path.join(f.vault,feedback),'---\ntype: FEEDBACK\nstory: Clay Teacher\n---\n\n# A note to Mira\n\nThank you for showing me the kiln.\n');
 const plan=planRegistration({vault:f.vault,files:f.files});
 fs.mkdirSync(path.join(f.data,'magazine/projects'),{recursive:true});
 fs.writeFileSync(path.join(f.data,'magazine/index.json'),JSON.stringify({schema:INDEX_SCHEMA,vaultRoot:f.vault,filesRoot:f.files,stories:plan.stories.map(p=>({storyId:p.storyId,name:p.name}))}));
 for(const p of plan.stories)fs.writeFileSync(path.join(f.data,'magazine/projects',p.storyId+'.json'),JSON.stringify(p));
 const server=await createServer({dataDir:f.data,publicDir:path.resolve('public'),connections:[],magazineRoots:[],researchEnabled:false,magazineVault:{vaultRoot:f.vault,filesRoot:f.files,writable,machine:'synthetic-share-context'}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const input={storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',expectedHash:hash(fs.readFileSync(path.join(f.vault,draft)))};
 return {f,origin,input,get:extra=>fetch(origin+route+'?'+new URLSearchParams({...input,...extra}))};
}
test('Share context HTTP connects the exact registered Magazine article and feedback without creating records or returning prose',async t=>{
 const {f,origin,get,input}=await fixture(t),beforeVault=treeHashes(f.vault),beforeData=treeHashes(f.data);
 const response=await get();assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.schema,'ar-create.magazine-share-context.v1');
 assert.equal(value.authority.storyId,input.storyId);assert.equal(value.authority.pieceId,input.pieceId);assert.equal(value.draft.hash,input.expectedHash);
 assert.equal(value.references.feedback.length,1);assert.equal(value.references.feedback[0].path,feedback);assert.equal(value.references.feedback[0].state,'current');
 const raw=JSON.stringify(value);assert.ok(!raw.includes(f.vault));assert.ok(!raw.includes('Thank you for'));assert.ok(!raw.includes('I met Mira'));
 assert.deepEqual(treeHashes(f.vault),beforeVault);assert.deepEqual(treeHashes(f.data),beforeData);
 const cap=await(await fetch(origin+'/api/capabilities')).json(),command=cap.commands.find(c=>c.route===route);assert.ok(command);assert.equal(command.readOnly,true);assert.deepEqual(command.schema.query,['storyId','pieceId','edition','expectedHash']);
});
test('Share context HTTP refuses stale articles, caller paths, duplicate identities and mutating methods',async t=>{
 const {f,origin,input,get}=await fixture(t),before=treeHashes(f.vault);
 assert.equal((await get({expectedHash:'0'.repeat(64)})).status,409);
 assert.equal((await get({path:feedback})).status,400);
 assert.equal((await fetch(origin+route+'?'+new URLSearchParams(input)+'&pieceId=other')).status,400);
 assert.equal((await get({pieceId:'other:article'})).status,404);
 const post=await fetch(origin+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});assert.ok([404,405].includes(post.status));
 assert.deepEqual(treeHashes(f.vault),before);
});

test('Claude/Codex entrances discover and read the same Magazine context without a duplicate import',async t=>{
 const {f,origin,input}=await fixture(t),beforeVault=treeHashes(f.vault),beforeData=treeHashes(f.data);
 const args=['--url',origin,'--actor','agent:codex'];
 const discovery=await runCLI([...args,'list-commands']);assert.equal(discovery.exitCode,0);
 const command=discovery.result.commands.find(c=>c.route===route);assert.ok(command);assert.deepEqual(command.schema.query,Object.keys(input));
 const cli=await runCLI([...args,'call',command.name,'--input','-'],{stdin:async()=>JSON.stringify(input)});assert.equal(cli.exitCode,0);
 const tools=createTools({url:origin,actor:'agent:claude-code'});
 const mcp=await tools.callTool('ar_create_call',{name:command.name,input});
 assert.deepEqual(mcp,cli.result);assert.equal(mcp.draft.hash,input.expectedHash);assert.equal(mcp.references.feedback[0].path,feedback);
 const stale=await runCLI([...args,'call',command.name,'--input','-'],{stdin:async()=>JSON.stringify({...input,expectedHash:'0'.repeat(64)})});assert.equal(stale.exitCode,3);
 await assert.rejects(tools.callTool('ar_create_call',{name:command.name,input:{...input,expectedHash:'0'.repeat(64)}}),e=>e.status===409);
 assert.deepEqual(treeHashes(f.vault),beforeVault);assert.deepEqual(treeHashes(f.data),beforeData);
});

test('registered FEEDBACK HTTP and agent entrances return the same canonical owner without writes',async t=>{
 const {f,origin,input}=await fixture(t),body=fs.readFileSync(path.join(f.vault,feedback),'utf8');
 const query={...input,registeredFeedbackPath:feedback,expectedFeedbackHash:hash(body)},feedbackRoute='/api/magazine/working-draft/share-feedback';
 const beforeVault=treeHashes(f.vault),beforeData=treeHashes(f.data);
 const response=await fetch(origin+feedbackRoute+'?'+new URLSearchParams(query));assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.schema,'ar-create.magazine-share-feedback.v1');assert.equal(value.document.text,body);assert.equal(value.document.hash,query.expectedFeedbackHash);assert.equal(value.draft.hash,input.expectedHash);assert.equal(value.mapping.structured,false);assert.equal(value.readOnly,true);
 const command=(await(await fetch(origin+'/api/capabilities')).json()).commands.find(c=>c.route===feedbackRoute);
 assert.ok(command);assert.equal(command.readOnly,true);assert.deepEqual(command.schema.query,Object.keys(query));
 const cli=await runCLI(['--url',origin,'--actor','agent:codex','call',command.name,'--input','-'],{stdin:async()=>JSON.stringify(query)});assert.equal(cli.exitCode,0);
 const tools=createTools({url:origin,actor:'agent:claude-code'});assert.deepEqual(await tools.callTool('ar_create_call',{name:command.name,input:query}),cli.result);assert.deepEqual(cli.result,value);
 assert.deepEqual(treeHashes(f.vault),beforeVault);assert.deepEqual(treeHashes(f.data),beforeData);
});

test('registered FEEDBACK HTTP rejects independent hash drift, guessed paths, duplicate selectors and mutation',async t=>{
 const {f,origin,input}=await fixture(t),beforeVault=treeHashes(f.vault),beforeData=treeHashes(f.data),feedbackRoute='/api/magazine/working-draft/share-feedback';
 const query={...input,registeredFeedbackPath:feedback,expectedFeedbackHash:hash(fs.readFileSync(path.join(f.vault,feedback)))};
 const get=q=>fetch(origin+feedbackRoute+'?'+new URLSearchParams(q));
 assert.equal((await get({...query,expectedFeedbackHash:'0'.repeat(64)})).status,409);
 assert.equal((await get({...query,expectedHash:'0'.repeat(64)})).status,409);
 assert.equal((await get({...query,registeredFeedbackPath:'Workflow/6-Feedback/FEEDBACK - Other.md'})).status,404);
 assert.equal((await get({...query,path:feedback})).status,400);
 assert.equal((await fetch(origin+feedbackRoute+'?'+new URLSearchParams(query)+'&registeredFeedbackPath=other')).status,400);
 const incomplete={...query};delete incomplete.expectedFeedbackHash;assert.equal((await get(incomplete)).status,400);
 assert.ok([404,405].includes((await fetch(origin+feedbackRoute,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(query)})).status));
 assert.deepEqual(treeHashes(f.vault),beforeVault);assert.deepEqual(treeHashes(f.data),beforeData);
});


test('Share feedback HTTP uses the existing human save and exact Undo owner; agents only propose',async t=>{
 const {f,origin,input}=await fixture(t,{writable:true}),route='/api/magazine/working-draft/share-feedback',before=fs.readFileSync(path.join(f.vault,feedback),'utf8'),content=before.replace('Thank you for showing me the kiln.','Thank you for the invented visit.');
 const selection={...input,registeredFeedbackPath:feedback,expectedFeedbackHash:hash(before)};
 const post=async(action,payload,actor='human:adrian')=>{const r=await fetch(origin+route+'/'+action,{method:'POST',headers:{'content-type':'application/json','x-ar-actor':actor},body:JSON.stringify(payload)});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;};
 const prepared=await post('prepare',{...selection,content});assert.equal(prepared.content,content);assert.equal(fs.readFileSync(path.join(f.vault,feedback),'utf8'),before);
 const operationId=randomUUID(),saved=await post('save',{...selection,content,operationId});assert.equal(saved.written,true);assert.equal(saved.hash,hash(content));
 const replay=await post('save',{...selection,content,operationId});assert.equal(replay.replay,true);
 const current={...selection,expectedFeedbackHash:saved.hash},read=await(await fetch(origin+route+'?'+new URLSearchParams(current))).json();assert.equal(read.document.text,content);
 const historyResponse=await fetch(origin+route+'/history?'+new URLSearchParams(current),{headers:{'x-ar-actor':'human:adrian'}});assert.equal(historyResponse.status,200);assert.equal((await historyResponse.json()).history.at(-1).operationId,operationId);
 const eligibleResponse=await fetch(origin+route+'/undo-eligibility?'+new URLSearchParams({...current,operationId}));assert.equal(eligibleResponse.status,200);assert.equal((await eligibleResponse.json()).eligible,true);
 const undoInput={...current,operationId:randomUUID(),undoOperationId:operationId},undone=await post('undo',undoInput);assert.equal(undone.undone,operationId);assert.equal(fs.readFileSync(path.join(f.vault,feedback),'utf8'),before);assert.equal((await post('undo',undoInput)).replay,true);
 const proposed=await post('save',{...selection,content,operationId:randomUUID()},'agent:codex');assert.equal(proposed.proposed,true);assert.equal(fs.readFileSync(path.join(f.vault,feedback),'utf8'),before);
 assert.equal(hash(fs.readFileSync(path.join(f.vault,draft))),input.expectedHash);
});


test('the existing manuscript correction permission does not implicitly enable FEEDBACK writes in review',async t=>{
 const {f,origin,input}=await fixture(t,{writable:true}),review=createReviewConnection({authorityURL:origin,allowedAuthorityPort:Number(new URL(origin).port),actualWorkReview:true,magazineDraftCorrections:true});
 await new Promise(resolve=>review.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>review.close(resolve)));
 const reviewOrigin='http://127.0.0.1:'+review.address().port,beforeVault=treeHashes(f.vault),beforeData=treeHashes(f.data);
 for(const action of ['prepare','save','undo']){const response=await fetch(reviewOrigin+'/api/magazine/working-draft/share-feedback/'+action,{method:'POST',headers:{origin:reviewOrigin,'content-type':'application/json'},body:JSON.stringify({...input,registeredFeedbackPath:feedback,expectedFeedbackHash:hash(fs.readFileSync(path.join(f.vault,feedback))),content:'Unsent invented words.',operationId:randomUUID(),undoOperationId:randomUUID()})});assert.equal(response.status,423);}
 assert.deepEqual(treeHashes(f.vault),beforeVault);assert.deepEqual(treeHashes(f.data),beforeData);
});
