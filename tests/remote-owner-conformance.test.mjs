// W6 real HTTP owners; only invented fixtures and private disposable connector state.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import net from 'node:net';
import {createRequire} from 'node:module';
import {createRemoteServer} from '../agents/remote/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {digest} from '../runtime/services/files.mjs';
import {createScopedTools,REMOTE_TOOLS} from '../agents/remote/tools.mjs';
const op=()=>randomUUID(),exact='  Invented speaker: keep the crack.\nThese exact words are mine.  ';
async function fixture(t){
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config)),stateDir=path.join(home.dir,'remote-state');fs.mkdirSync(stateDir,{mode:0o700});
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve('public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;let closed=false;
 const close=async()=>{if(!closed){closed=true;await new Promise(resolve=>server.close(resolve));}};
 t.after(async()=>{await close();fs.rmSync(home.dir,{recursive:true,force:true});});
 const request=async(route,input,actor='agent:claude-code')=>{const response=await fetch(url+route,{...(input?{method:'POST',body:JSON.stringify(input)}:{}),headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':actor.startsWith('human:')?'ui':'cli',Origin:url}});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
 const principal={id:'claude',actor:'agent:claude-code',provider:'claude',client:'claude-cloud',projectIds:['hk'],tools:REMOTE_TOOLS,expiresAt:new Date(Date.now()+3600000).toISOString()};
 const tools=(overrides={})=>createScopedTools({ownerUrl:url,stateDir,principal:{...principal,...overrides}});
 return {home,config,stateDir,server,url,request,principal,tools,close};
}
const guard=value=>({revision:value.revision,hash:value.hash});
async function concept(f){const created=await f.request('/api/concepts',{parentStudyId:'hk',title:'Invented remote cup',operationId:op()});return f.request('/api/concept/save',{parentStudyId:'hk',operationId:op(),expectedRevision:created.revision,expectedHash:created.hash,authorThoughts:exact,aiInterpretation:'Initial provisional reading.',suggestions:'An unadopted suggestion.',sourceSelections:[]},'human:adrian');}
async function native(f){
 const originalFile=path.join(f.home.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),raw=fs.readFileSync(originalFile,'utf8');
 const opened=await f.request('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(raw),operationId:op()});
 const copy=await f.request('/api/study/structure-tests',{sourceBindingId:opened.binding.id,sourceParentStudyId:'hk',expected:opened.expected,title:'Invented cloud proposal proof',operationId:op()});
 const scope={bindingId:copy.article.bindingId,parentStudyId:copy.parentStudyId},selector={parentStudyId:copy.parentStudyId,rootBindingId:copy.bindingId,outputId:copy.article.outputId};
 const read=await f.request('/api/study-ai/read?'+new URLSearchParams(scope)),group={rootBindingId:copy.bindingId,parentStudyId:copy.parentStudyId};
 const listing=await f.request('/api/study/outputs?'+new URLSearchParams(group)),root=await f.request('/api/study-draft/read?'+new URLSearchParams({bindingId:copy.bindingId,parentStudyId:copy.parentStudyId}));
 const sibling=await f.request('/api/study/outputs/stand-in-create',{...group,operationId:op(),expectedOutput:listing.expectedOutput,kind:'carousel',sourceBindingId:copy.bindingId,expectedNative:root.expected});
 return {originalFile,raw,opened,copy,scope,selector,read,group,sibling:sibling.view.output,remote:f.tools({projectIds:[copy.parentStudyId]})};
}
function noPrivateKeys(value){if(Array.isArray(value))for(const child of value)noPrivateKeys(child);else if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){assert.ok(!['path','paths','sourcePath','copiedPath','draftPath','localPath','filePath','absolutePath','rootPath','vaultRoot','filesRoot','dataDir','homeDir','canStandInReview','canStandInContracts'].includes(key),'private key '+key);noPrivateKeys(child);}}

function noHostLocations(value,f){const visit=(v,at='result')=>{if(typeof v==='string'){for(const root of [f.home.dir,f.home.vault,f.config.dataDir])assert.ok(!v.includes(root),at+' exposes a synthetic host location');}else if(Array.isArray(v))v.forEach((child,i)=>visit(child,at+'['+i+']'));else if(v&&typeof v==='object')for(const [key,child]of Object.entries(v))visit(child,at+'.'+key);};visit(value);}

test('remote provisional preparation, exact capture and second-client pickup use real concept owners without human authority',async t=>{
 const f=await fixture(t),before=await concept(f),a=f.tools(),selector={parentStudyId:'hk'};
 assert.deepEqual(a.definitions().map(([name])=>name),REMOTE_TOOLS);
 const first=await a.call('ar_create_current_work',{selector});assert.equal(first.intent.authorThoughts,exact);assert.equal(first.remote.actor,'agent:claude-code');assert.equal(first.remote.review.available,false);assert.equal(first.remote.media.delivery,'references-only');assert.equal(first.remote.media.bytesAvailable,false);noPrivateKeys(first);noHostLocations(first,f);
 const input={parentStudyId:'hk',operationId:op(),expected:guard(before),interpretation:'Prepared by Claude; still provisional.',suggestions:'Alternative, not adopted.'};
 const saved=await a.call('ar_create_save_preparation',input);assert.equal(saved.status,'saved-provisional');assert.equal(saved.mayApply,false);
 const after=await f.request('/api/concept?parentStudyId=hk');assert.equal(after.authorThoughts,exact);assert.equal(after.aiInterpretation,input.interpretation);assert.deepEqual(after.sourceSelections,before.sourceSelections);assert.equal(after.adoptedDirection,before.adoptedDirection);
 const replay=await a.call('ar_create_save_preparation',input);assert.equal(replay.replayed,true);assert.equal(replay.receiptIsHistorical,true);assert.equal((await f.request('/api/concept?parentStudyId=hk')).revision,after.revision);
 await assert.rejects(a.call('ar_create_save_preparation',{...input,interpretation:'Changed retry'}),e=>e.status===409&&e.code==='operation_reused');
 await assert.rejects(a.call('ar_create_save_preparation',{...input,operationId:op()}),e=>e.status===409&&e.code==='stale_owner');
 const quote='\n  SECOND_exact_quote — keep punctuation.  ',capture={operationId:op(),origin:{conversationId:'synthetic-chat',messageId:'selected-message',historyCoverage:'selected-only'},action:'append-thought',target:{parentStudyId:'hk'},contribution:{role:'human',text:quote},expected:guard(after)};
 const receipt=await a.call('ar_create_capture_contribution',capture);assert.equal(receipt.status,'captured');assert.equal(receipt.authority.authenticatedHuman,false);assert.equal(receipt.authority.mayApply,false);assert.equal(receipt.origin.ownerOrigin.provider,'claude');assert.equal(receipt.origin.ownerOrigin.client,'claude-cloud');assert.equal(receipt.origin.ownerOrigin.conversationId,'claude:synthetic-chat');
 const captured=await a.call('ar_create_current_work',{selector}),row=captured.contributions.captures.find(r=>r.id===receipt.receiptId);assert.equal(row.contribution.text,quote);assert.equal(row.authority.authenticatedHuman,false);assert.equal(captured.contributions.coverage.completeConversation,false);assert.ok(captured.intent.authorThoughts.startsWith(exact));assert.ok(captured.intent.authorThoughts.endsWith(quote));
 const duplicate=await a.call('ar_create_capture_contribution',capture);assert.equal(duplicate.replayed,true);assert.equal(duplicate.receiptId,receipt.receiptId);
 const current=await f.request('/api/concept?parentStudyId=hk'),amended=await f.request('/api/concept/save',{parentStudyId:'hk',operationId:op(),expectedRevision:current.revision,expectedHash:current.hash,authorThoughts:current.authorThoughts+'\nAPP exact amendment.',aiInterpretation:current.aiInterpretation,suggestions:current.suggestions,sourceSelections:current.sourceSelections},'human:adrian');
 const b=f.tools({id:'chatgpt',actor:'agent:chatgpt',provider:'openai',client:'chatgpt-cloud'}),seen=await b.call('ar_create_current_work',{selector});assert.equal(seen.intent.hash,amended.hash);assert.ok(seen.intent.authorThoughts.endsWith('APP exact amendment.'));
 const held=await b.call('ar_create_validate_work',{selector,expectedFingerprint:captured.fingerprint,preparedText:'Retain this exact unaccepted preparation.  '});assert.equal(held.status,'held-context-changed');assert.equal(held.mayApply,false);assert.equal(held.preparedText,'Retain this exact unaccepted preparation.  ');
 const events=await b.call('ar_create_changes',{parentStudyId:'hk',limit:2});assert.ok(events.bootId);assert.ok(events.events.every(event=>event.scope.id==='hk'));assert.ok(events.events.length<=2);
 assert.equal(fs.statSync(f.stateDir).mode&0o777,0o700);
});

test('remote exact native piece prepares and stages a valid pending paragraph proposal without changing manuscript or sibling',async t=>{
 const f=await fixture(t),n=await native(f),a=n.remote;
 const packet=await a.call('ar_create_current_work',{selector:n.selector});assert.equal(packet.piece.wordOwner.bindingId,n.scope.bindingId);assert.equal(packet.piece.words.body,n.read.raw);assert.equal(packet.proposalContext.bindingId,n.scope.bindingId);assert.equal(packet.remote.media.bytesAvailable,false);noPrivateKeys(packet);noHostLocations(packet,f);
 const sourceIds=packet.proposalContext.sourceCatalog.filter(r=>r.role==='source'&&!r.missing).map(r=>r.id),paragraph=packet.proposalContext.paragraphs.find(r=>r.proposalEditable&&r.words.includes('Synthetic opening'));assert.ok(sourceIds.length);assert.ok(paragraph);
 const input={selector:n.selector,operationId:op(),expectedFingerprint:packet.fingerprint,sourceIds};
 const prepared=await a.call('ar_create_prepare_proposal',input);assert.equal(prepared.status,'prepared');assert.equal(prepared.mayApply,false);assert.match(prepared.requestId,/^[a-f0-9-]{36}$/);
 assert.equal((await a.call('ar_create_prepare_proposal',input)).replayed,true);
 const context=await a.call('ar_create_proposal_context',{selector:n.selector,requestId:prepared.requestId});assert.equal(context.mayApply,false);assert.equal(context.media.delivery,'references-only');noPrivateKeys(context);noHostLocations(context,f);
 const fresh=await a.call('ar_create_current_work',{selector:n.selector}),proposalWords=paragraph.words.replace('Synthetic opening','Invented revised opening'),stage={selector:n.selector,operationId:op(),requestId:prepared.requestId,expectedFingerprint:fresh.fingerprint,replacements:[{id:paragraph.id,words:proposalWords}]};
 const staged=await a.call('ar_create_stage_proposal',stage);assert.equal(staged.status,'proposed-awaiting-app-review');assert.equal(staged.mayApply,false);assert.equal((await a.call('ar_create_stage_proposal',stage)).replayed,true);
 const review=await f.request('/api/study-ai/review?'+new URLSearchParams({...n.scope,requestId:prepared.requestId}));assert.equal(review.status,'pending');assert.equal(review.replacements[0].words,proposalWords);
 assert.equal((await f.request('/api/study-draft/read?'+new URLSearchParams(n.scope))).raw,n.read.raw);assert.equal(fs.readFileSync(n.originalFile,'utf8'),n.raw);
 const sibling=await f.request('/api/study/outputs?'+new URLSearchParams({...n.group,selectedOutputId:n.sibling.id}));assert.deepEqual(sibling.output,n.sibling,'independent sibling bytes remain unchanged');
 const changed=await f.request('/api/study-draft/save',{...n.scope,expected:n.read.expected,operationId:op(),operations:[{kind:'insert',id:op(),beforeId:null,raw:'Exact later app sentence.'}]},'human:adrian');
 const b=f.tools({id:'chatgpt',actor:'agent:chatgpt',provider:'openai',client:'chatgpt-cloud',projectIds:[n.copy.parentStudyId]}),latest=await b.call('ar_create_current_work',{selector:n.selector});assert.equal(latest.piece.words.body,changed.raw);
 await assert.rejects(a.call('ar_create_prepare_proposal',{...input,operationId:op()}),e=>e.status===409&&e.code==='context_changed');
});

test('remote principal scopes, tool allowlists and strict arguments cannot select arbitrary owners or claim human authority',async t=>{
 const f=await fixture(t),a=f.tools();await concept(f);
 assert.deepEqual((await a.call('ar_create_projects')).projects,[{parentStudyId:'hk'}]);
 await assert.rejects(a.call('ar_create_current_work',{selector:{parentStudyId:'other'}}),e=>e.status===403&&e.code==='scope_forbidden');
 await assert.rejects(a.call('ar_create_call',{name:'study-ai.accept'}),e=>e.status===403&&e.code==='tool_forbidden');
 const limited=f.tools({tools:['ar_create_current_work']});assert.equal(limited.definitions().length,1);await assert.rejects(limited.call('ar_create_projects'),e=>e.status===403&&e.code==='tool_forbidden');
 for(const forged of [{actor:'human:adrian'},{principal:{actor:'human:adrian'}},{authenticatedHuman:true},{ownerUrl:'http://127.0.0.1:8841'}])await assert.rejects(a.call('ar_create_current_work',{selector:{parentStudyId:'hk'},...forged}),e=>e.status===400&&e.code==='invalid_arguments');
 await assert.rejects(a.call('ar_create_capture_contribution',{operationId:op(),origin:{captureId:op(),historyCoverage:'selected-only'},action:'append-thought',target:{parentStudyId:'hk'},contribution:{role:'assistant',text:'Not human.'},expected:{revision:0,hash:'a'.repeat(64)}}),e=>e.status===400&&e.code==='invalid_arguments');
 await assert.rejects(a.call('ar_create_current_work',{selector:{parentStudyId:'hk',outputId:op()}}),e=>e.status===400&&e.code==='invalid_arguments');
});

test('remote owner outage is explicit and identical uncertain write never reruns',async t=>{
 const f=await fixture(t),before=await concept(f),a=f.tools();await f.close();
 await assert.rejects(a.call('ar_create_current_work',{selector:{parentStudyId:'hk'}}),e=>e.status===503&&e.code==='owner_unavailable');
 const input={parentStudyId:'hk',operationId:op(),expected:guard(before),interpretation:'Retain prepared words.',suggestions:''};
 await assert.rejects(a.call('ar_create_save_preparation',input),e=>e.status===503&&e.code==='owner_unavailable');
 await assert.rejects(a.call('ar_create_save_preparation',input),e=>e.status===409&&e.code==='outcome_uncertain');
 const files=fs.readdirSync(path.join(f.stateDir,'deliveries')),receipt=JSON.parse(fs.readFileSync(path.join(f.stateDir,'deliveries',files[0])));assert.equal(receipt.status,'unconfirmed');assert.equal(receipt.errorCode,'owner_unavailable');assert.doesNotMatch(JSON.stringify(receipt),/Retain prepared words/,'delivery ledger retains metadata, not another manuscript');
});


test('authenticated HTTP MCP SDK clients prepare, stage and resume the same real native owner',async t=>{
 const f=await fixture(t),n=await native(f),require=createRequire(new URL('../mcp/study/package.json',import.meta.url));
 const {Client,StreamableHTTPClientTransport}=require('@modelcontextprotocol/client');
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const base='http://127.0.0.1:'+port,resource=base+'/mcp',redirect='http://127.0.0.1:9999/callback';
 const principals=[{...f.principal,projectIds:[n.copy.parentStudyId]},{...f.principal,id:'chatgpt',actor:'agent:chatgpt',provider:'openai',client:'chatgpt-web',projectIds:[n.copy.parentStudyId]}];
 const adapter=createRemoteServer({schema:'ar-create.remote-config.v1',ownerUrl:f.url,resourceUrl:resource,issuerUrl:base,stateDir:f.stateDir,redirectUris:[redirect],principals,port});
 await adapter.listen();const clients=[];
 try{
  for(const principal of principals){
   // OAuth HTTP behavior has its own suite; use the actual authorization owner
   // here to issue independent PKCE-bound credentials, never bypass token checks.
   const auth=adapter.authorization,registered=auth.register({client_name:'Synthetic native journey',redirect_uris:[redirect],token_endpoint_auth_method:'none'}),verifier=randomBytes(32).toString('base64url');
   const pending=auth.requestAuthorization({client_id:registered.client_id,redirect_uri:redirect,response_type:'code',code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url'),resource,state:'synthetic-'+principal.id,scope:'ar-create'});
   assert.equal(auth.authorization(pending.ticket).status,'pending');auth.approve(pending.ticket,principal.id);const callback=new URL(auth.authorization(pending.ticket).redirectUri);
   const token=auth.token({grant_type:'authorization_code',client_id:registered.client_id,redirect_uri:redirect,code:callback.searchParams.get('code'),code_verifier:verifier,resource});
   // A client-supplied display name cannot turn this agent delegation into human authority.
   const client=new Client({name:'human:adrian',version:'synthetic'});
   await client.connect(new StreamableHTTPClientTransport(new URL(resource),{requestInit:{headers:{Authorization:'Bearer '+token.access_token}}}));clients.push(client);
  }
  const wrap=client=>({call:async(name,input={})=>{const reply=await client.callTool({name,arguments:input});assert.notEqual(reply.isError,true,JSON.stringify(reply.content));assert.ok(reply.structuredContent,'SDK result includes structured owner content');return reply.structuredContent;}}),a=wrap(clients[0]),b=wrap(clients[1]);
  assert.deepEqual((await clients[0].listTools()).tools.map(tool=>tool.name).sort(),[...REMOTE_TOOLS].sort());
  const initial=await a.call('ar_create_current_work',{selector:n.selector});assert.equal(initial.remote.actor,'agent:claude-code');assert.equal(initial.authority.authenticatedHuman,false);assert.equal(initial.piece.words.body,n.read.raw);noPrivateKeys(initial);noHostLocations(initial,f);
  const paragraph=initial.proposalContext.paragraphs.find(row=>row.proposalEditable&&row.words.includes('Synthetic opening')),sourceIds=initial.proposalContext.sourceCatalog.filter(row=>row.role==='source'&&!row.missing).map(row=>row.id);assert.ok(paragraph);assert.ok(sourceIds.length);
  const prepared=await a.call('ar_create_prepare_proposal',{selector:n.selector,operationId:op(),expectedFingerprint:initial.fingerprint,sourceIds});assert.equal(prepared.status,'prepared');
  const context=await a.call('ar_create_proposal_context',{selector:n.selector,requestId:prepared.requestId});assert.equal(context.mayApply,false);assert.equal(context.media.bytesAvailable,false);noPrivateKeys(context);noHostLocations(context,f);
  const fresh=await a.call('ar_create_current_work',{selector:n.selector}),proposed=paragraph.words.replace('Synthetic opening','Invented HTTP proposal'),stage={selector:n.selector,operationId:op(),requestId:prepared.requestId,expectedFingerprint:fresh.fingerprint,replacements:[{id:paragraph.id,words:proposed}]};
  const staged=await a.call('ar_create_stage_proposal',stage);assert.equal(staged.status,'proposed-awaiting-app-review');assert.equal((await a.call('ar_create_stage_proposal',stage)).replayed,true);
  const pickedUp=await b.call('ar_create_current_work',{selector:n.selector});assert.equal(pickedUp.remote.actor,'agent:chatgpt');assert.equal(pickedUp.authority.authenticatedHuman,false);assert.equal(pickedUp.piece.words.body,n.read.raw);assert.ok(JSON.stringify(pickedUp.pending.proposals).includes(prepared.requestId));
  const reviewed=await b.call('ar_create_proposal_context',{selector:n.selector,requestId:prepared.requestId});assert.equal(reviewed.review.status,'pending');assert.equal(reviewed.review.replacements[0].words,proposed);
  assert.equal((await f.request('/api/study-draft/read?'+new URLSearchParams(n.scope))).raw,n.read.raw,'proposal has not changed native manuscript bytes');assert.equal(fs.readFileSync(n.originalFile,'utf8'),n.raw,'original bytes remain exact');
  assert.deepEqual((await f.request('/api/study/outputs?'+new URLSearchParams({...n.group,selectedOutputId:n.sibling.id}))).output,n.sibling,'sibling Carousel remains independent');
  const amended=await f.request('/api/study-draft/save',{...n.scope,expected:n.read.expected,operationId:op(),operations:[{kind:'insert',id:op(),beforeId:null,raw:'Exact app amendment after HTTP proposal.'}]},'human:adrian');
  const after=await b.call('ar_create_current_work',{selector:n.selector});assert.equal(after.piece.words.body,amended.raw);assert.match(after.piece.words.body,/Exact app amendment after HTTP proposal/);
  const held=await b.call('ar_create_validate_work',{selector:n.selector,expectedFingerprint:pickedUp.fingerprint,preparedText:proposed});assert.equal(held.status,'held-context-changed');assert.equal(held.preparedText,proposed);assert.equal(held.mayApply,false);
 }finally{for(const client of clients)await client.close();await adapter.close();}
});
