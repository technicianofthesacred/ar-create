import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {atomicWrite,regular,systemAliasPath} from '../../runtime/services/files.mjs';

const SCOPE='ar-create';
const TTL={request:10*60_000,code:5*60_000,access:15*60_000,refresh:24*60*60_000,client:7*24*60*60_000};
const MAX={clients:64,requests:128,codes:256,tokens:2048,grants:512};
const ACTORS=new Set(['agent:claude-code','agent:codex','agent:claude-design','agent:hermes','agent:grok','agent:chatgpt']);
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const secret=()=>randomBytes(32).toString('base64url');
const hash=text=>createHash('sha256').update(text).digest('hex');
const own=(object,key)=>Object.hasOwn(object,key)?object[key]:undefined;
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
function fail(code='invalid_request',message='The authorization request is invalid.',status=400){throw Object.assign(new Error(message),{code,status});}
const ERRORS=new Set(['enrollment_closed','invalid_request','invalid_client','invalid_redirect_uri','invalid_client_metadata','invalid_target','invalid_grant','invalid_scope','invalid_token','unsupported_grant_type','temporarily_unavailable','server_error']);
function guarded(run){try{return run();}catch(error){if(ERRORS.has(error?.code)&&Number.isInteger(error.status))throw error;fail('server_error','Authorization is unavailable; preserve the local state for recovery.',503);}}
function object(input,allowed,required=[]){if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype&&Object.getPrototypeOf(input)!==null||Object.keys(input).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(input,k)))fail();return input;}
function text(value,max=256){if(typeof value!=='string'||!value.length||value.length>max||/[\x00-\x1f\x7f]/.test(value))fail();return value;}
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const loopback=url=>['127.0.0.1','localhost','[::1]'].includes(url.hostname);
function url(value,{http=false}={}){text(value,2048);let parsed;try{parsed=new URL(value);}catch{fail();}if(parsed.username||parsed.password||parsed.hash||parsed.protocol!=='https:'&&!(http&&parsed.protocol==='http:'&&loopback(parsed)))fail('invalid_request','Use an exact HTTPS address (loopback HTTP is synthetic only).');return parsed;}
const TABLES=['clients','requests','codes','tokens','grants','revokedPrincipals'];
const INERT_URLS=['client_uri','logo_uri','tos_uri','policy_uri'];
const INERT_TEXT=['software_id','software_version'];
function inertMetadata(input){
 const result={};
 for(const key of INERT_URLS)if(input[key]!==undefined){url(input[key]);result[key]=input[key];}
 for(const key of INERT_TEXT)if(input[key]!==undefined)result[key]=text(input[key],128);
 if(input.contacts!==undefined){if(!Array.isArray(input.contacts)||input.contacts.length>8||new Set(input.contacts).size!==input.contacts.length)fail('invalid_client_metadata','Client contacts must be a bounded list.');result.contacts=input.contacts.map(contact=>{text(contact,254);if(!/^[^@\s]+@[^@\s]+$/.test(contact))fail('invalid_client_metadata','Client contacts must be email addresses.');return contact;});}
 return result;
}
const empty=()=>({schema:'ar-create.remote-authorization.v1',...Object.fromEntries(TABLES.map(key=>[key,Object.create(null)]))});

/** A local operator grants a configured agent principal. OAuth proves possession
 * of that delegation, never human editorial authority or a provider account.
 * All methods are synchronous filesystem transactions, safe across the HTTP
 * process and the separate local approval CLI. Approval is never an HTTP route.
 * Replay revokes a token family only while its spent code/token record remains
 * retained (codes: five minutes; refresh: original grant deadline). Older replay
 * is still refused, but expired/pruned hashes cannot identify a token family.
 */
export function createAuthorization(options){return guarded(()=>configureAuthorization(options));}
function configureAuthorization({stateDir,resourceUrl,issuerUrl,principals,redirectUris,now=()=>Date.now()}={}){
 const resource=url(resourceUrl,{http:true}),synthetic=resource.protocol==='http:'&&loopback(resource),issuer=url(issuerUrl,{http:synthetic});
 if(issuer.pathname!=='/'||issuer.search||resource.search||issuer.origin!==resource.origin)fail('invalid_request','Issuer must be the exact resource origin.');
 const resourceId=resource.href,issuerId=issuer.origin;
 if(!Array.isArray(redirectUris)||!redirectUris.length||redirectUris.length>16)fail('invalid_request','Configure exact permitted client redirects.');
 const redirects=[...new Set(redirectUris.map(value=>{const parsed=url(value,{http:synthetic});if(['code','state','iss','error'].some(k=>parsed.searchParams.has(k)))fail();return parsed.href;}))];
 function bindRedirect(redirect,p){
  if(!redirects.includes(redirect))fail('invalid_grant','This callback is no longer permitted by the operator.');
  const parsed=new URL(redirect);
  // Only a synthetic loopback resource permits a generic loopback callback.
  if(synthetic&&loopback(parsed))return;
  const family=parsed.origin==='https://claude.ai'&&parsed.pathname==='/api/mcp/auth_callback'?['claude','claude-cloud']:parsed.origin==='https://chatgpt.com'&&(parsed.pathname==='/connector_platform_oauth_redirect'||/^\/connector\/oauth(?:\/[^/]+)?$/.test(parsed.pathname))?['openai','chatgpt-web']:null;
  if(!family||p.provider!==family[0]||p.client!==family[1])fail('invalid_grant','The configured principal does not match this callback provider and client.');
 }
 if(typeof stateDir!=='string'||!path.isAbsolute(stateDir))fail('invalid_request','Authorization state requires an external absolute directory.');
 const root=systemAliasPath(path.resolve(stateDir));
 if(root===repo||root.startsWith(repo+path.sep))fail('invalid_request','Authorization state must stay outside the code checkout.');
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 const rootStat=fs.lstatSync(root);
 if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||rootStat.mode&0o077||fs.realpathSync(root)!==root)fail('invalid_request','Authorization state requires a private real directory.');
 const file=path.join(root,'authorization.json'),lock=path.join(root,'authorization.lock');
 const clock=()=>{const at=now();if(!Number.isFinite(at))fail('server_error','Authorization clock is unavailable.',503);return at;};
 function load(){
  if(!fs.existsSync(file))return empty();
  const stat=regular(file);if(stat.mode&0o077||stat.size>4*1024*1024)fail('server_error','Authorization state is unavailable; preserve it for recovery.',503);
  let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch{fail('server_error','Authorization state is unavailable; preserve it for recovery.',503);}
  if(!data||data.schema!=='ar-create.remote-authorization.v1'||TABLES.some(k=>!data[k]||typeof data[k]!=='object'||Array.isArray(data[k])))fail('server_error','Authorization state is unavailable; preserve it for recovery.',503);
  for(const key of TABLES)data[key]=Object.assign(Object.create(null),data[key]);
  // Existing v1 stores predate enrollment. Preserve every client with evidence
  // of local approval, including a code or approved response not yet redeemed.
  const approvedIds=new Set([...Object.values(data.grants),...Object.values(data.codes),...Object.values(data.requests).filter(r=>r.status==='approved'||r.status==='delivered')].map(record=>record.clientId));
  for(const id of approvedIds){const c=own(data.clients,id);if(c&&c.approvedAt===undefined)c.approvedAt=Number.isFinite(c.client_id_issued_at)?c.client_id_issued_at*1000:0;}
  return data;
 }
 function prune(data,at){
  for(const key of ['requests','codes','tokens','grants'])for(const [id,value]of Object.entries(data[key]))if(value.expiresAt<=at)delete data[key][id];
  for(const [id,c]of Object.entries(data.clients))if(c.expiresAt<=at&&!Object.values(data.grants).some(g=>g.clientId===id))delete data.clients[id];
 }
 function transaction(fn,{pruneExpired=true}={}){
  let fd;try{fd=fs.openSync(lock,'wx',0o600);}catch(error){if(error.code==='EEXIST')fail('temporarily_unavailable','Authorization store is busy or needs local lock recovery; retry later.',503);throw error;}
  try{
   fs.writeFileSync(fd,JSON.stringify({pid:process.pid,nonce:randomUUID(),at:clock()})+'\n');fs.fsyncSync(fd);
   const data=load();if(pruneExpired)prune(data,clock());let result,error;
   try{result=fn(data);}catch(e){error=e;}
   // Persist even refusal-side revocation (a reused refresh/code revokes its grant).
   atomicWrite(file,JSON.stringify(data)+'\n');
   if(error)throw error;return result;
  }finally{if(fd!==undefined)fs.closeSync(fd);fs.rmSync(lock,{force:true});}
 }
 function principal(id,data=load()){
  const configured=typeof principals==='function'?principals():principals;
  if(!Array.isArray(configured)||configured.length>64)fail('server_error','Configured principals are unavailable.',503);
  const found=configured.filter(p=>p?.id===id);if(found.length!==1||own(data.revokedPrincipals,id))fail('invalid_token','This delegation is unavailable or revoked.',401);
  const p=found[0];object(p,['id','actor','provider','client','projectIds','tools','expiresAt'],['id','actor','provider','client','projectIds','tools','expiresAt']);
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id)||!ACTORS.has(p.actor)||!['claude','openai'].includes(p.provider))fail('server_error','Configured principal is invalid.',503);
  text(p.client,80);const expiry=typeof p.expiresAt==='number'?p.expiresAt:Date.parse(p.expiresAt);
  if(!Number.isFinite(expiry)||expiry<=clock())fail('invalid_token','This delegation has expired.',401);
  for(const key of ['projectIds','tools']){if(!Array.isArray(p[key])||p[key].length<1||p[key].length>64||new Set(p[key]).size!==p[key].length)fail('server_error','Configured principal scope is invalid.',503);for(const v of p[key])text(v,256);}
  return {...structuredClone(p),expiresAt:new Date(expiry).toISOString()};
 }
 const pin=p=>hash(canonical({...p,projectIds:[...p.projectIds].sort(),tools:[...p.tools].sort()}));
 function active(record,data,code='invalid_grant'){
  const associated=record?.grantId?own(data.grants,record.grantId):undefined;
  if(!record||record.resource!==resourceId||record.expiresAt<=clock()||record.revokedAt!==undefined||record.grantId&&(!associated||associated.expiresAt<=clock()||associated.revokedAt!==undefined))fail(code,'This delegation is unavailable, expired or revoked.',code==='invalid_token'?401:400);
  let p;try{p=principal(record.principalId,data);}catch(error){if(error.code==='invalid_token')fail(code,'This delegation is unavailable, expired or revoked.',code==='invalid_token'?401:400);throw error;}
  if(pin(p)!==record.principalPin)fail(code,'The configured delegation changed; reconnect for a fresh grant.',code==='invalid_token'?401:400);
  if(record.redirectUri)bindRedirect(record.redirectUri,p);
  return p;
 }
 function capacity(data,key){if(Object.keys(data[key]).length>=MAX[key])fail('temporarily_unavailable','Authorization capacity is temporarily full; retry later.',503);}
 function client(data,id,redirect){text(id,160);const c=own(data.clients,id);if(!c||c.expiresAt<=clock()||redirect!==undefined&&!c.redirect_uris.includes(redirect))fail('invalid_client','Client or redirect is not registered.',400);return c;}
 function grant(data,record,p){
  capacity(data,'tokens');if(Object.keys(data.tokens).length>MAX.tokens-2)fail('temporarily_unavailable','Authorization capacity is temporarily full; retry later.',503);
  const access=secret(),refresh=secret(),at=clock(),max=Date.parse(p.expiresAt),accessExpiry=Math.min(record.expiresAt,at+TTL.access,max),refreshExpiry=Math.min(record.expiresAt,at+TTL.refresh,max);
  const base={grantId:record.grantId,principalId:p.id,principalPin:pin(p),clientId:record.clientId,resource:resourceId,scope:SCOPE};
  data.tokens[hash(access)]={...base,kind:'access',expiresAt:accessExpiry};data.tokens[hash(refresh)]={...base,kind:'refresh',expiresAt:refreshExpiry};
  return {access_token:access,token_type:'Bearer',expires_in:Math.max(1,Math.floor((accessExpiry-at)/1000)),refresh_token:refresh,scope:SCOPE};
 }
 function revokeGrant(data,id){if(data.grants[id])data.grants[id].revokedAt=clock();}
 function enrollmentStatus(data){const expiry=data.enrollment?.expiresAt;return {open:Number.isFinite(expiry)&&expiry>clock(),expiresAt:Number.isFinite(expiry)?expiry:null};}
 function requireEnrollment(data){const status=enrollmentStatus(data);if(!status.open)fail('enrollment_closed','Enrollment is closed; ask the local operator to open a short connection window.',403);return status.expiresAt;}
 function cleanupUnapproved(data){
  let removedClients=0,removedRequests=0;
  for(const [id,c]of Object.entries(data.clients))if(c.approvedAt===undefined){delete data.clients[id];removedClients++;}
  for(const [id,r]of Object.entries(data.requests))if(r.status==='pending'){delete data.requests[id];removedRequests++;}
  return {removedClients,removedRequests};
 }
 const api={
  enrollment:()=>enrollmentStatus(load()),
  openEnrollment(seconds=300){if(!Number.isInteger(seconds)||seconds<30||seconds>600)fail('invalid_request','Enrollment must last between 30 and 600 whole seconds.');return transaction(data=>{const cleaned=cleanupUnapproved(data);data.enrollment={expiresAt:clock()+seconds*1000};return {...enrollmentStatus(data),...cleaned};},{pruneExpired:false});},
  closeEnrollment(){return transaction(data=>{data.enrollment={expiresAt:null};return {...enrollmentStatus(data),...cleanupUnapproved(data)};},{pruneExpired:false});},
  cleanupEnrollment(){return transaction(data=>({...enrollmentStatus(data),...cleanupUnapproved(data)}),{pruneExpired:false});},
  protectedMetadata:()=>({resource:resourceId,authorization_servers:[issuerId],bearer_methods_supported:['header'],scopes_supported:[SCOPE]}),
  metadata:()=>({issuer:issuerId,authorization_endpoint:issuerId+'/oauth/authorize',token_endpoint:issuerId+'/oauth/token',registration_endpoint:issuerId+'/oauth/register',revocation_endpoint:issuerId+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],revocation_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:[SCOPE],authorization_response_iss_parameter_supported:true}),
  register(input){
   object(input,['client_name','redirect_uris','token_endpoint_auth_method','grant_types','response_types','scope','application_type',...INERT_URLS,...INERT_TEXT,'contacts'],['redirect_uris']);
   if(input.client_name!==undefined)text(input.client_name,120);
   const inert=inertMetadata(input); // Display metadata only; never fetch these URLs or treat them as identity.
   if(input.scope!==undefined&&input.scope!==SCOPE||input.application_type!==undefined&&input.application_type!=='web')fail('invalid_client_metadata','Only the ar-create scope and web application type are supported.');
   const registeredMetadata={...inert,...(input.scope!==undefined?{scope:SCOPE}:{}),...(input.application_type!==undefined?{application_type:'web'}:{})};
   if(!Array.isArray(input.redirect_uris)||!input.redirect_uris.length||input.redirect_uris.length>4||new Set(input.redirect_uris).size!==input.redirect_uris.length||input.redirect_uris.some(r=>typeof r!=='string'||!redirects.includes(r)))fail('invalid_redirect_uri','Client redirects must exactly match the configured allowlist.');
   if(input.token_endpoint_auth_method!==undefined&&input.token_endpoint_auth_method!=='none'||input.grant_types!==undefined&&(!Array.isArray(input.grant_types)||!input.grant_types.includes('authorization_code')||input.grant_types.some(g=>!['authorization_code','refresh_token'].includes(g)))||input.response_types!==undefined&&canonical(input.response_types)!=='["code"]')fail('invalid_client_metadata','Only public authorization-code clients with PKCE are supported.');
   return transaction(data=>{const deadline=requireEnrollment(data);capacity(data,'clients');const id='client_'+secret(),at=clock(),c={...registeredMetadata,client_id:id,client_name:input.client_name||'Unverified remote MCP client',redirect_uris:[...input.redirect_uris],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],client_id_issued_at:Math.floor(at/1000),expiresAt:deadline};data.clients[id]=c;const {expiresAt,...response}=c;return response;});
  },
  requestAuthorization(input){
   object(input,['client_id','redirect_uri','response_type','code_challenge','code_challenge_method','resource','state','scope'],['client_id','redirect_uri','response_type','code_challenge','code_challenge_method','resource','state','scope']);
   text(input.state,1024);text(input.redirect_uri,2048);if(input.response_type!=='code'||input.code_challenge_method!=='S256'||typeof input.code_challenge!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(input.code_challenge)||input.scope!==SCOPE)fail();
   if(input.resource!==resourceId)fail('invalid_target','The requested resource is not this MCP endpoint.');
   return transaction(data=>{const c=client(data,input.client_id,input.redirect_uri);capacity(data,'requests');const ticket=secret(),expiresAt=c.approvedAt===undefined?Math.min(clock()+TTL.request,c.expiresAt,requireEnrollment(data)):clock()+TTL.request;data.requests[ticket]={ticket,clientId:c.client_id,clientName:c.client_name,redirectUri:input.redirect_uri,resource:resourceId,scopes:[SCOPE],state:input.state,challenge:input.code_challenge,expiresAt,status:'pending'};return {ticket,expiresAt,status:'pending'};});
  },
  requests(){const data=load();return Object.values(data.requests).filter(r=>r.expiresAt>clock()&&r.status!=='delivered').map(({ticket,clientId,clientName,redirectUri,resource,scopes,expiresAt,status,principalId})=>({ticket,clientId,clientName,redirectUri,resource,scopes,expiresAt,status,...(principalId?{principalId}:{})}));},
  approve(ticket,principalId){text(ticket,128);text(principalId,64);return transaction(data=>{const r=data.requests[ticket];if(!r||r.expiresAt<=clock()||r.status!=='pending')fail('invalid_request','This connection request is unavailable or already decided.');const c=client(data,r.clientId,r.redirectUri);if(c.approvedAt===undefined)requireEnrollment(data);const p=principal(principalId,data);bindRedirect(r.redirectUri,p);const at=clock();c.approvedAt??=at;c.expiresAt=at+TTL.client;r.expiresAt=Math.min(at+TTL.request,Date.parse(p.expiresAt));r.status='approved';r.principalId=p.id;r.principalPin=pin(p);return {ticket,status:'approved',principalId:p.id,projectIds:p.projectIds,tools:p.tools,expiresAt:r.expiresAt};});},
  authorization(ticket){text(ticket,128);return transaction(data=>{const r=data.requests[ticket];if(!r||r.expiresAt<=clock())fail('invalid_request','This connection request expired; reconnect.');if(r.status==='pending')return {ticket,status:'pending',expiresAt:r.expiresAt};if(r.status!=='approved')fail('invalid_request','This connection response was already delivered; reconnect if it was lost.');const p=principal(r.principalId,data);bindRedirect(r.redirectUri,p);if(pin(p)!==r.principalPin)fail('invalid_grant','The configured delegation changed; reconnect.');client(data,r.clientId,r.redirectUri);capacity(data,'codes');const code=secret(),at=clock();data.codes[hash(code)]={principalId:p.id,principalPin:pin(p),clientId:r.clientId,redirectUri:r.redirectUri,resource:resourceId,challenge:r.challenge,expiresAt:Math.min(at+TTL.code,Date.parse(p.expiresAt))};r.status='delivered';const redirect=new URL(r.redirectUri);redirect.searchParams.set('code',code);redirect.searchParams.set('state',r.state);redirect.searchParams.set('iss',issuerId);return {status:'approved',redirectUri:redirect.href};});},
  token(input){
   if(!input||typeof input!=='object')fail();
   if(input.grant_type==='authorization_code'){
    object(input,['grant_type','client_id','redirect_uri','code','code_verifier','resource'],['grant_type','client_id','redirect_uri','code','code_verifier','resource']);
    if(typeof input.code_verifier!=='string'||!/^[a-zA-Z0-9._~-]{43,128}$/.test(input.code_verifier))fail('invalid_grant','Code verifier is invalid.');text(input.code,128);text(input.redirect_uri,2048);
    return transaction(data=>{client(data,input.client_id,input.redirect_uri);const r=data.codes[hash(input.code)];if(!r)fail('invalid_grant','Authorization code is unavailable or expired.');if(input.resource!==resourceId||r.clientId!==input.client_id||r.redirectUri!==input.redirect_uri||!same(r.challenge,createHash('sha256').update(input.code_verifier).digest('base64url')))fail('invalid_grant','Code binding did not match this request.');if(r.usedAt!==undefined){revokeGrant(data,r.grantId);fail('invalid_grant','Authorization code was already consumed.');}const p=active(r,data);capacity(data,'grants');const id=randomUUID(),at=clock();r.usedAt=at;r.grantId=id;const g={grantId:id,principalId:p.id,principalPin:pin(p),clientId:r.clientId,resource:resourceId,expiresAt:Math.min(at+TTL.refresh,Date.parse(p.expiresAt))};data.grants[id]=g;return grant(data,g,p);});
   }
   if(input.grant_type==='refresh_token'){
    object(input,['grant_type','client_id','refresh_token','resource','scope'],['grant_type','client_id','refresh_token','resource']);text(input.refresh_token,128);if(input.scope!==undefined&&input.scope!==SCOPE)fail('invalid_scope','The requested scope is not supported.');
    return transaction(data=>{client(data,input.client_id);const r=data.tokens[hash(input.refresh_token)];if(!r||r.kind!=='refresh')fail('invalid_grant','Refresh token is unavailable or expired.');if(input.resource!==resourceId||r.clientId!==input.client_id)fail('invalid_grant','Refresh token binding did not match this request.');if(r.usedAt!==undefined){revokeGrant(data,r.grantId);fail('invalid_grant','Refresh token was already consumed; reconnect.');}const p=active(r,data),g=data.grants[r.grantId];if(!g)fail('invalid_grant','Delegation is unavailable.');r.usedAt=clock();return grant(data,g,p);});
   }
   fail('unsupported_grant_type','Only authorization code and refresh token grants are supported.');
  },
  verify(token){if(typeof token!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(token))fail('invalid_token','Bearer token is invalid.',401);const data=load(),record=data.tokens[hash(token)];if(record?.kind!=='access')fail('invalid_token','Bearer token is unavailable.',401);return active(record,data,'invalid_token');},
  revokePrincipal(id){text(id,64);if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id))fail();return transaction(data=>{if(!data.revokedPrincipals[id]){if(Object.keys(data.revokedPrincipals).length>=64)fail('temporarily_unavailable','Revocation capacity is full.',503);data.revokedPrincipals[id]={at:clock()};}return {revoked:true,principalId:id};});},
  revokeToken(token){text(token,256);return transaction(data=>{const r=data.tokens[hash(token)];if(r)revokeGrant(data,r.grantId);return {revoked:true};});},
 };
 // Validate configured principal shape at startup without granting or persisting anything.
 const configured=typeof principals==='function'?principals():principals;if(!Array.isArray(configured)||!configured.length||configured.length>64||new Set(configured.map(p=>p?.id)).size!==configured.length)fail('invalid_request','Configure unique bounded agent principals.');
 for(const p of configured){try{principal(p.id);}catch(error){if(error.code!=='invalid_token')throw error;}}
 return Object.fromEntries(Object.entries(api).map(([name,method])=>[name,(...args)=>guarded(()=>method(...args))]));
}
