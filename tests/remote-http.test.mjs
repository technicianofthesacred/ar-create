import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createRemoteServer,validateConfig,createOAuthAdmission} from '../agents/remote/server.mjs';
import {REMOTE_TOOLS} from '../agents/remote/tools.mjs';
const require=createRequire(new URL('../mcp/study/package.json',import.meta.url));
const {Client,StreamableHTTPClientTransport}=require('@modelcontextprotocol/client');
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ar-remote-http-'));fs.chmodSync(root,0o700);
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const base='http://127.0.0.1:'+port,resource=base+'/mcp';let at=Date.now(),unchanged=true;
 const principals=['claude','chatgpt'].map((id,i)=>({id,actor:i?'agent:chatgpt':'agent:claude-code',provider:i?'openai':'claude',client:i?'chatgpt-web':'claude-cloud',projectIds:[i?'project-b':'project-a'],tools:REMOTE_TOOLS,expiresAt:new Date(at+86400000).toISOString()}));
 const config={schema:'ar-create.remote-config.v1',ownerUrl:'http://127.0.0.1:1',resourceUrl:resource,issuerUrl:base,stateDir:root,redirectUris:['http://127.0.0.1:9999/callback'],principals,port};
 const adapter=createRemoteServer(config,{now:()=>at,unchanged:()=>unchanged});await adapter.listen();t.after(async()=>{await adapter.close();fs.rmSync(root,{recursive:true,force:true});});
 async function request(route,body,type='application/json',headers={}){return fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'content-type':type,...headers},...(body!==undefined?{body:type==='application/json'?JSON.stringify(body):new URLSearchParams(body)}:{}),redirect:'manual'});}
 async function authorize(principalId='claude'){
  adapter.authorization.openEnrollment(300);
  const reg=await request('/oauth/register',{client_name:'synthetic SDK client',redirect_uris:config.redirectUris,token_endpoint_auth_method:'none'});assert.equal(reg.status,201);const client=await reg.json();const verifier=randomBytes(32).toString('base64url');
  const start=await request('/oauth/authorize?'+new URLSearchParams({client_id:client.client_id,redirect_uri:config.redirectUris[0],response_type:'code',code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url'),resource,state:'synthetic-state',scope:'ar-create'}));assert.equal(start.status,303);const pending=start.headers.get('location'),ticket=new URL(pending,base).searchParams.get('ticket');
  assert.equal((await request(pending)).status,200);adapter.authorization.approve(ticket,principalId);adapter.authorization.closeEnrollment();const approved=await request(pending);assert.equal(approved.status,302);const callback=new URL(approved.headers.get('location'));assert.equal(callback.searchParams.get('state'),'synthetic-state');assert.equal(callback.searchParams.get('iss'),base);
  const token=await request('/oauth/token',{grant_type:'authorization_code',client_id:client.client_id,redirect_uri:config.redirectUris[0],code:callback.searchParams.get('code'),code_verifier:verifier,resource},'application/x-www-form-urlencoded');assert.equal(token.status,200);return {...await token.json(),client_id:client.client_id};
 }
 return {adapter,config,base,resource,request,authorize,advance:ms=>at+=ms,change:()=>unchanged=false};
}
test('actual SDK clients authenticate separately and cannot widen project, action or actor authority',async t=>{
 const f=await fixture(t),unauth=await f.request('/mcp',{});assert.equal(unauth.status,401);assert.match(unauth.headers.get('www-authenticate'),/resource_metadata=/);
 assert.equal((await (await f.request('/.well-known/oauth-protected-resource/mcp')).json()).resource,f.resource);
 const a=await f.authorize(),b=await f.authorize('chatgpt');
 const clients=[];for(const token of [a,b]){const client=new Client({name:'synthetic',version:'1.0'});await client.connect(new StreamableHTTPClientTransport(new URL(f.resource),{requestInit:{headers:{Authorization:'Bearer '+token.access_token}}}));clients.push(client);t.after(()=>client.close());}
 const defs=await clients[0].listTools();assert.equal(defs.tools.length,REMOTE_TOOLS.length);assert.ok(defs.tools.every(x=>x.inputSchema.additionalProperties===false));
 for(let i=0;i<2;i++){const r=await clients[i].callTool({name:'ar_create_projects',arguments:{}});assert.equal(r.structuredContent.projects[0].parentStudyId,i?'project-b':'project-a');assert.equal(r.structuredContent.authority.authenticatedHuman,false);}
 for(const [name,args]of [['ar_create_current_work',{selector:{parentStudyId:'project-b'}}],['ar_create_projects',{actor:'human:adrian'}]]){const r=await clients[0].callTool({name,arguments:args});assert.equal(r.isError,true);}
 await assert.rejects(clients[0].callTool({name:'ar_create_accept',arguments:{}}),/not found/);
 const offline=await clients[0].callTool({name:'ar_create_current_work',arguments:{selector:{parentStudyId:'project-a'}}});assert.equal(offline.isError,true);assert.match(offline.content[0].text,/owner_unavailable/);
 const forged=await f.request('/mcp',{},'application/json',{Authorization:'Bearer '+a.access_token,'X-AR-Actor':'human:adrian'});assert.equal(forged.status,403);
 f.adapter.authorization.revokePrincipal('claude');assert.equal((await f.request('/mcp',{},'application/json',{Authorization:'Bearer '+a.access_token})).status,401);
 assert.equal((await clients[1].callTool({name:'ar_create_projects',arguments:{}})).isError,undefined);
 f.advance(16*60_000);assert.equal((await f.request('/mcp',{},'application/json',{Authorization:'Bearer '+b.access_token})).status,401);
});
test('HTTP rejects unexpected host/origin, oversized and malicious JSON, remote approval and changed config',async t=>{
 const f=await fixture(t),token=await f.authorize(),headers={Authorization:'Bearer '+token.access_token};
 assert.equal(await new Promise(resolve=>{const r=http.get(f.base+'/health',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',()=>resolve(0));}),403);
 assert.equal((await f.request('/health',undefined,undefined,{Origin:'https://evil.example'})).status,403);
 assert.equal((await f.request('/oauth/approve',{principalId:'claude'})).status,404);
 for(const value of [[],JSON.parse('{"__proto__":{}}'),{nested:'x'.repeat(270000)}]){const r=await f.request('/mcp',value,'application/json',headers);assert.ok([400,413].includes(r.status));}
 const get=await f.request('/mcp',undefined,undefined,headers);assert.equal(get.status,405);
 f.change();assert.equal((await f.request('/mcp',{},'application/json',headers)).status,503);
});
test('configuration refuses generic proxies, human principals, installed listener and non-HTTPS remote endpoints',()=>{
 const c={schema:'ar-create.remote-config.v1',ownerUrl:'http://127.0.0.1:8872',resourceUrl:'https://example.com/mcp',port:8873,principals:[{actor:'agent:chatgpt',provider:'openai',client:'chatgpt-web',tools:REMOTE_TOOLS}]};assert.doesNotThrow(()=>validateConfig(c));
 for(const changed of [{port:8841},{ownerUrl:'https://example.com'},{resourceUrl:'http://example.com/mcp'},{principals:[{actor:'human:adrian',tools:REMOTE_TOOLS}]}])assert.throws(()=>validateConfig({...c,...changed}));
});

test('OAuth admission bounds each endpoint before work and isolates token/discovery capacity from DCR',()=>{
 let at=1000;const admit=createOAuthAdmission({now:()=>at}),held=[admit('/oauth/register'),admit('/oauth/register')];
 assert.throws(()=>admit('/oauth/register'),e=>e.status===429&&e.retryAfter===1);admit('/oauth/token')();admit('/.well-known/oauth-authorization-server')();
 held[0]();held[0]();held[1]();for(let i=0;i<6;i++)admit('/oauth/register')();
 assert.throws(()=>admit('/oauth/register'),e=>e.status===429&&e.retryAfter===3);at+=3000;admit('/oauth/register')();assert.throws(()=>admit('/oauth/register'),e=>e.status===429);
 at-=10000;assert.throws(()=>admit('/oauth/register'),e=>e.status===429,'clock rollback cannot refill');
 for(const route of ['/oauth/authorize','/oauth/revoke','/oauth/unknown']){for(let i=0;i<20;i++)admit(route)();assert.throws(()=>admit(route),e=>e.status===429);}
 admit('/mcp')();admit('/health')();
});

test('closed enrollment and exhausted DCR budget refuse before body/store work; local cleanup preserves live grants',async t=>{
 const f=await fixture(t),file=path.join(f.config.stateDir,'authorization.json');
 assert.equal(f.adapter.authorization.enrollment().open,false);
 const closed=await f.request('/oauth/register',{junk:'x'.repeat(270000)});assert.equal(closed.status,403);assert.equal(fs.existsSync(file),false,'closed DCR never creates authorization state');
 f.advance(3000);const approved=await f.authorize();f.adapter.authorization.openEnrollment(300);f.advance(30000);
 for(let i=0;i<8;i++)assert.equal((await f.request('/oauth/register',{redirect_uris:f.config.redirectUris})).status,201);
 const before=fs.readFileSync(file),limited=await f.request('/oauth/register',{junk:'x'.repeat(270000)});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'3');assert.deepEqual(fs.readFileSync(file),before,'rate refusal cannot parse or transact against auth state');
 const closedState=f.adapter.authorization.closeEnrollment();assert.equal(closedState.open,false);assert.equal(closedState.removedClients,8);assert.equal(f.adapter.authorization.verify(approved.access_token).id,'claude');
 const refresh=await f.request('/oauth/token',{grant_type:'refresh_token',client_id:approved.client_id,refresh_token:approved.refresh_token,resource:f.resource},'application/x-www-form-urlencoded');assert.equal(refresh.status,200,'registration flood does not exhaust token endpoint budget');
 f.advance(3000);f.adapter.authorization.openEnrollment(30);assert.equal((await f.request('/oauth/register',{redirect_uris:f.config.redirectUris})).status,201);f.advance(30001);assert.equal((await f.request('/oauth/register',{redirect_uris:f.config.redirectUris})).status,403);
 for(const route of ['/oauth/open-enrollment','/oauth/close-enrollment','/oauth/cleanup-enrollment'])assert.equal((await f.request(route,{})).status,404);
});

test('local CLI opens, inspects, cleans and closes enrollment; invalid duration cannot extend it',async t=>{
 const f=await fixture(t),file=path.join(f.config.stateDir,'operator-config.json');fs.writeFileSync(file,JSON.stringify(f.config),{mode:0o600});
 const admin=(...args)=>spawnSync(process.execPath,['agents/remote/admin.mjs','--config',file,...args],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 let out=admin('enrollment');assert.equal(out.status,0,out.stderr);assert.equal(JSON.parse(out.stdout).open,false);
 out=admin('open-enrollment','300');assert.equal(out.status,0,out.stderr);const opened=JSON.parse(out.stdout);assert.equal(opened.open,true);assert.equal(f.adapter.authorization.enrollment().expiresAt,opened.expiresAt);
 assert.equal(admin('open-enrollment','0').status,1);assert.equal(f.adapter.authorization.enrollment().expiresAt,opened.expiresAt);
 f.adapter.authorization.register({redirect_uris:f.config.redirectUris});out=admin('cleanup-enrollment');assert.equal(out.status,0,out.stderr);assert.equal(JSON.parse(out.stdout).removedClients,1);assert.equal(JSON.parse(out.stdout).open,true);
 out=admin('close-enrollment');assert.equal(out.status,0,out.stderr);assert.equal(JSON.parse(out.stdout).open,false);assert.equal(f.adapter.authorization.enrollment().open,false);
 const lock=path.join(f.config.stateDir,'authorization.lock');fs.writeFileSync(lock,'synthetic active transaction',{mode:0o600});assert.equal(admin('cleanup-enrollment').status,1);assert.equal(fs.readFileSync(lock,'utf8'),'synthetic active transaction');fs.rmSync(lock);
});
