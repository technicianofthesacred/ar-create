import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {buildRequest} from '../agents/lib/client.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {createExistingWorkReview} from '../scripts/review-existing.mjs';

const repo=path.resolve(import.meta.dirname,'..');
async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:codex')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 return {url,cli,capabilities:await (await fetch(url+'/api/capabilities')).json()};
}
/** Every '/api/...' literal the app's own files call. */
function uiRoutes(){
 const out=new Set(),dir=path.join(repo,'public/document-study');
 const walk=d=>{for(const entry of fs.readdirSync(d,{withFileTypes:true})){const full=path.join(d,entry.name);if(entry.isDirectory())walk(full);else if(/\.(m?js|html)$/.test(entry.name)&&!entry.name.endsWith('.test.mjs'))for(const m of fs.readFileSync(full,'utf8').matchAll(/['"`](\/api\/[A-Za-z0-9_./-]*)/g))out.add(m[1]);}};
 walk(dir);return [...out].filter(route=>route!=='/api/');
}

test('every app route belongs to runtime capabilities or an explicit read-only review-host route',async t=>{
 const f=await setup(t),routes=f.capabilities.commands.map(c=>c.route);
 assert.equal(f.capabilities.schema,'ar-create.capabilities.v1');
 assert.ok(f.capabilities.git && 'sha' in f.capabilities.git);
 assert.ok(f.capabilities.commands.length>=200,'whole route map, not a hand-picked subset');
 const pattern=route=>new RegExp('^'+route.replace(/\{\w+\}/g,'[^/]+')+'$');
 // Review readers belong to the separate review host, never the agent command
 // registry. Derive the exact mounted routes; an unknown /api/review/* still fails.
 const reviewSource=fs.readFileSync(path.join(repo,'scripts/review-existing.mjs'),'utf8');
 const reviewRoutes=[...reviewSource.matchAll(/\['(\/api\/review\/[A-Za-z0-9_./-]+)',result\(/g)].map(match=>match[1]);
 assert.ok(reviewRoutes.length>0,'the maintained review-host route table is inspected');
 const matches=(ui,registered)=>registered.some(route=>route===ui||pattern(route).test(ui)||route.startsWith(ui));
 const missing=uiRoutes().filter(ui=>!matches(ui,routes)&&!matches(ui,reviewRoutes));
 assert.deepEqual(missing,[],'UI routes missing from the registry');
 const {server:review}=await createExistingWorkReview({config:{authorityURL:f.url,allowedAuthorityPort:Number(new URL(f.url).port),magazineRoots:[]}});
 await new Promise(resolve=>review.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>review.close(resolve)));
 const reviewURL='http://127.0.0.1:'+review.address().port;
 for(const route of reviewRoutes){
  assert.equal(matches(route,routes),false,'review-only reader is not an agent command: '+route);
  assert.equal((await fetch(f.url+route)).status,404,'runtime must not mount review-only reader: '+route);
  const denied=await fetch(reviewURL+route,{method:'POST'});
  assert.equal(denied.status,423,'review reader must reject mutation: '+route);
  assert.equal(denied.headers.get('allow'),'GET, HEAD');
 }
 // Names are unique; every entry is described.
 const names=f.capabilities.commands.map(c=>c.name);assert.equal(new Set(names).size,names.length);
 for(const c of f.capabilities.commands){assert.ok(c.section&&c.method&&c.route&&c.schema&&Array.isArray(c.actors)&&typeof c.readOnly==='boolean',c.name);}
 // Decisions stay human; undo points at a real command.
 for(const name of ['study-ai.accept','study-ai.reject','study.share.fact','shared-articles.requests.id.accept','source-sessions.translation-accept'])assert.deepEqual(f.capabilities.commands.find(c=>c.name===name).actors,['human'],name);
 for(const c of f.capabilities.commands.filter(c=>c.undo))assert.ok(names.includes(c.undo),c.name+' -> '+c.undo);
 assert.equal(f.capabilities.commands.find(c=>c.name==='study-draft.save').undo,'study-draft.undo');
 // Existing keys are unchanged.
 assert.equal(f.capabilities.library,'file-backed');
});

test('agent Carousel review and decisions keep physical identity in the query and exact proof in the closed body',async t=>{
 const f=await setup(t),scope={projectId:randomUUID(),documentId:randomUUID(),outputId:randomUUID()},id=randomUUID(),binding={requestId:id,proposalHash:'a'.repeat(64),reviewHash:'b'.repeat(64),contextHash:'c'.repeat(64),wordsIdentity:'d'.repeat(64)};
 for(const action of ['review','accept','reject']){
  const command=f.capabilities.commands.find(c=>c.route==='/api/shared-carousels/requests/{id}/'+action),body=action==='review'?{raw:'Invented complete carousel Markdown.'}:binding,request=buildRequest(command,{id,...scope,...body}),url=new URL(request.path,f.url);
  assert.deepEqual(Object.fromEntries(url.searchParams),scope);assert.deepEqual(request.body,body,'the maintained review/decision owner refuses extra physical scope fields');assert.equal(url.pathname,'/api/shared-carousels/requests/'+id+'/'+action);if(action!=='review')assert.deepEqual(command.actors,['human']);
 }
 const prepare=f.capabilities.commands.find(c=>c.route==='/api/shared-carousels/prepare');assert.deepEqual(buildRequest(prepare,scope).body,scope,'preparation still requires repeated exact physical scope');
});

test('the route map mounts with identical behaviour: 405 with Allow, origin and actor guards',async t=>{
 const f=await setup(t);
 const wrong=await fetch(f.url+'/api/concept/save');assert.equal(wrong.status,405);assert.equal(wrong.headers.get('allow'),'POST');
 assert.equal((await fetch(f.url+'/api/concept/save',{method:'POST',headers:{'Content-Type':'text/plain','X-AR-Actor':'agent:codex'},body:'{}'})).status,415);
 assert.equal((await fetch(f.url+'/api/no-such-thing')).status,404);
 // A read-only POST needs no actor; a write does.
 const search=await fetch(f.url+'/api/concept/sources/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'x'})});const searched=await search.json();assert.doesNotMatch(String(searched.error||''),/X-AR-Actor/);
 assert.equal((await fetch(f.url+'/api/concepts',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,400);
});

test('a CLI-created collection owns a draft, and the draft records the agent',async t=>{
 const f=await setup(t),pid='cli-collection-'+randomUUID().slice(0,8);
 assert.equal((await run(['--url',f.url,'project','list'],{env:{}})).exitCode,2,'--actor is required');
 const created=await f.cli(['project','create'],{parentStudyId:pid,title:'Made by an agent',operationId:randomUUID()});
 assert.equal(created.exitCode,0,JSON.stringify(created.result));
 const bindingId=created.result.bindingId;assert.match(bindingId,/^[a-f0-9-]{36}$/);
 const draft=await f.cli(['draft','read'],{bindingId,parentStudyId:pid});
 assert.equal(draft.exitCode,0,JSON.stringify(draft.result));
 assert.equal(draft.result.binding.authority,'owned-working-copy');assert.equal(draft.result.readiness.ready,true);
 const operationId=randomUUID();
 const saved=await f.cli(['draft','save'],{bindingId,parentStudyId:pid,expected:draft.result.expected,operationId,operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Words placed by the agent.'}]});
 assert.equal(saved.exitCode,0,JSON.stringify(saved.result));
 assert.match(fs.readFileSync(saved.result.paths.draft,'utf8'),/Words placed by the agent\./);
 assert.equal(saved.result.history.find(h=>h.operationId===operationId).actor,'agent:codex');
 // A stale save is a conflict (exit 3), never a silent overwrite.
 const stale=await f.cli(['call','study-draft.save'],{bindingId,parentStudyId:pid,expected:draft.result.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Stale.'}]});
 assert.equal(stale.exitCode,3);
 // The same collection is visible to the concept list and to the app's catalog.
 const list=await f.cli(['call','study-draft.catalog']);assert.ok(list.result.collections.some(c=>c.parentStudyId===pid&&c.bindingId===bindingId));
 const listed=await f.cli(['list-commands','--section','draft']);assert.ok(listed.result.commands.every(c=>c.section==='draft'));
});

test('the real CLI process and the MCP tools speak the same registry; human-only stays human',async t=>{
 const f=await setup(t);
 const child=spawn(process.execPath,[path.join(repo,'agents/cli/ar-create.mjs'),'--url',f.url,'--actor','agent:claude-code','status'],{stdio:['ignore','pipe','pipe']});
 let stdout='';child.stdout.on('data',c=>stdout+=c);const [code]=await once(child,'exit');assert.equal(code,0);
 const status=JSON.parse(stdout);assert.equal(status.actor,'agent:claude-code');assert.equal(status.commands,f.capabilities.commands.length);
 const tools=createTools({url:f.url,actor:'agent:claude-code'});
 assert.equal((await tools.callTool('ar_create_list_commands',{})).count,f.capabilities.commands.length);
 await assert.rejects(tools.callTool('ar_create_call',{name:'study-ai.accept',input:{bindingId:randomUUID(),parentStudyId:'hk',requestId:randomUUID()}}),error=>error.status===403);
 const catalog=await tools.callTool('ar_create_call',{name:'study-draft.catalog'});assert.ok(Array.isArray(catalog.collections));
 assert.throws(()=>createTools({url:f.url,actor:'agent:unknown'}),/Unknown --actor/);
 const anonymous=createTools({url:f.url});await assert.rejects(anonymous.callTool('ar_create_list_commands',{}),/Name the agent/);
});

test('`collection list` with no input reaches the catalog (an empty selector is still sent)',async t=>{
 const f=await setup(t),answer=await f.cli(['collection','list']);
 assert.equal(answer.exitCode,0,JSON.stringify(answer.result));
 assert.notEqual(answer.result?.error,'request_failed');
});

test('requests are built from the registry: path ids, scoped queries, input-json',()=>{
 assert.deepEqual(buildRequest({name:'a',method:'POST',route:'/api/passage/revisions/{id}/run',schema:{}},{id:'abc',x:1}),{method:'POST',path:'/api/passage/revisions/abc/run',body:{x:1}});
 assert.deepEqual(buildRequest({name:'b',method:'POST',route:'/api/study-ai/propose',mode:'scope',schema:{query:['bindingId','parentStudyId','requestId?']}},{bindingId:'b',parentStudyId:'p',requestId:'r',replacements:[]}),{method:'POST',path:'/api/study-ai/propose?bindingId=b&parentStudyId=p&requestId=r',body:{replacements:[]}});
 assert.deepEqual(buildRequest({name:'c',method:'POST',route:'/api/shared-carousels/prepare',mode:'scope-copy',schema:{query:['projectId','documentId','outputId']}},{projectId:'1',documentId:'2',outputId:'3'}).body,{projectId:'1',documentId:'2',outputId:'3'});
 assert.equal(buildRequest({name:'d',method:'GET',route:'/api/inquiries/read',mode:'input-json',schema:{}},{collectionId:'x'}).path,'/api/inquiries/read?input='+encodeURIComponent(JSON.stringify({collectionId:'x'})).replace(/%20/g,'+'));
 assert.equal(buildRequest({name:'f',method:'GET',route:'/api/inquiries/catalog',mode:'input-json',schema:{}},{}).path,'/api/inquiries/catalog?input=%7B%7D','an empty selector is still sent: the server answers 400 without one');
 assert.equal(buildRequest({name:'e',method:'GET',route:'/api/study/media-usage',schema:{}},{sourceId:['a','b']}).path,'/api/study/media-usage?sourceId=a&sourceId=b');
});

test('agents/mcp/server.mjs over real STDIO: registry tools plus the six manuscript tools; actor from the MCP client name',async t=>{
 const f=await setup(t),{createRequire}=await import('node:module'),require=createRequire(new URL('../mcp/study/package.json',import.meta.url));
 const {Client}=await import(require.resolve('@modelcontextprotocol/client')),{StdioClientTransport}=await import(require.resolve('@modelcontextprotocol/client/stdio'));
 const env={...process.env};delete env.AR_CREATE_ACTOR;
 const client=new Client({name:'codex-mcp-client',version:'1.0.0'}),transport=new StdioClientTransport({command:process.execPath,args:[path.join(repo,'agents/mcp/server.mjs'),'--url',f.url],env,stderr:'pipe'});
 await client.connect(transport);t.after(()=>client.close());
 const names=(await client.listTools()).tools.map(tool=>tool.name).sort();
 assert.deepEqual(names,['ar_create_call','ar_create_events','ar_create_list_commands','study_draft_context','study_draft_prepare','study_draft_propose','study_draft_read','study_draft_review','study_draft_status']);
 const listed=await client.callTool({name:'ar_create_list_commands',arguments:{section:'draft'}});assert.equal(listed.isError,undefined);assert.ok(listed.structuredContent.count>5);
 const pid='mcp-'+randomUUID().slice(0,8),made=await client.callTool({name:'ar_create_call',arguments:{name:'concepts.post',input:{parentStudyId:pid,title:'Made over MCP',operationId:randomUUID()}}});
 assert.equal(made.isError,undefined,JSON.stringify(made.content));
 const start=made.structuredContent,saved=await client.callTool({name:'ar_create_call',arguments:{name:'concept.save',input:{parentStudyId:pid,operationId:randomUUID(),expectedRevision:start.revision,expectedHash:start.hash,authorThoughts:'',aiInterpretation:'A reading.',suggestions:'',sourceSelections:[]}}});
 assert.equal(saved.isError,undefined,JSON.stringify(saved.content));
 assert.deepEqual([saved.structuredContent.history.at(-1).actor,saved.structuredContent.history.at(-1).client],['agent:codex','mcp']);
 const refused=await client.callTool({name:'ar_create_call',arguments:{name:'study-ai.reject',input:{bindingId:randomUUID(),parentStudyId:pid,requestId:randomUUID()}}});
 assert.equal(refused.isError,true);assert.equal(JSON.parse(refused.content[0].text).status,403);
});
