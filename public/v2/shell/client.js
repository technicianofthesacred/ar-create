/* Version two: the command client. One way to reach the app: a registry command by name, over the same HTTP routes the
   existing workspace, the CLI and MCP use (GET /api/capabilities lists them). It carries the actor the way the existing
   page does (?reviewActor= for an assistant, kept for the tab; the same allowed names), adds an operation id to writes,
   and turns 403, 409 and 423 into plain words. It also hears the app's live change stream (/api/events), as the
   existing page does, and tells screens which records changed. No screen calls fetch for a command itself. */
(function(root){
 'use strict';
 // The same names the existing page accepts (public/document-study/review-mode.js); an unknown name blocks every request.
 const ACTORS=Object.freeze(['human:adrian','agent:claude-code','agent:codex','agent:claude-design','agent:hermes','agent:grok','agent:chatgpt']);
 const ACTOR_KEY='ar-create-ui-actor';
 const NAMES={'agent:claude-code':'Claude','agent:claude-design':'Claude Design','agent:codex':'Codex','agent:hermes':'Hermes','agent:grok':'Grok','agent:chatgpt':'ChatGPT'};
 function actorName(actor){actor=String(actor||'');if(actor.startsWith('human:'))return 'You';if(NAMES[actor])return NAMES[actor];if(actor.startsWith('cron:'))return 'A scheduled job';if(actor.startsWith('import:'))return 'An import';if(actor.startsWith('agent:'))return actor.slice(6);return 'Someone';}
 // Commands that take no operationId: the server rejects any key outside their small list.
 const NO_OPERATION_ID=new Set(['presence.post','study-ai.reject']);
 const optional=field=>String(field).endsWith('?')?String(field).slice(0,-1):String(field);

 /** The actor for this tab, read exactly as the existing page reads it. */
 function resolveActor(search,storage){
  const values=new URLSearchParams(search||'').getAll('reviewActor');
  let requested=values.length>1?'invalid:duplicate':values[0]??null;
  try{if(requested===null)requested=storage?.getItem(ACTOR_KEY)??null;else storage?.setItem(ACTOR_KEY,requested);}catch{}
  const actor=requested===null?'human:adrian':ACTORS.includes(requested)?requested:null;
  return Object.freeze({actor,explicit:requested!==null,requested});
 }

 /** {name,method,route,schema,mode} plus input -> {method,path,body}. The same rules as agents/lib/client.mjs. */
 function buildRequest(command,input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Input must be an object.');
  const body=JSON.parse(JSON.stringify(input));
  const route=command.route.replace(/\{(\w+)\}/g,(_,key)=>{
   if(typeof body[key]!=='string'||!body[key])throw new Error(command.name+' needs "'+key+'" for its path.');
   const value=encodeURIComponent(body[key]);delete body[key];return value;
  });
  const query=new URLSearchParams();
  if(command.method==='GET'||command.method==='HEAD'){
   if(command.mode==='input-json')query.set('input',JSON.stringify(body));
   else for(const [key,value] of Object.entries(body))for(const item of Array.isArray(value)?value:[value])query.append(key,typeof item==='object'?JSON.stringify(item):String(item));
   return {method:command.method,path:route+(String(query)?'?'+query:''),body:undefined};
  }
  if(command.mode==='scope'||command.mode==='scope-copy'){
   for(const key of (command.schema?.query||[]).map(optional)){
    if(body[key]===undefined)continue;
    query.set(key,String(body[key]));
    if(command.mode==='scope')delete body[key];
   }
  }
  return {method:command.method,path:route+(String(query)?'?'+query:''),body};
 }

 /** A refused or failed call, in words a screen can show as they are. kind: stale | held | consent | owner-only | refused | failed. */
 class V2Error extends Error{
  constructor(message,{status=0,kind='failed',command=null,body=null,holder=null,hold=null,fresh}={}){super(message);this.name='V2Error';this.status=status;this.kind=kind;this.command=command;this.body=body;this.holder=holder;this.hold=hold;if(fresh!==undefined)this.fresh=fresh;}
 }
 const clock=iso=>{try{return new Date(iso).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}catch{return '';}};
 function explain(status,body,{name,actor}){
  const said=typeof body?.error==='string'&&body.error?body.error:'';
  if(status===409)return new V2Error('This changed since it was opened here. Read it again before saving.',{status,kind:'stale',command:name,body});
  if(status===423&&(body?.code==='consent-hold'||body?.hold))return new V2Error(said||'This is held until everyone in it has said yes.',{status,kind:'consent',command:name,body,hold:body?.hold||null});
  if(status===423){const h=body?.holder,who=h?actorName(h.actor):'Someone',until=h?.expiresAt?clock(h.expiresAt):'';return new V2Error(`${who} ${who==='You'?'are':'is'} working on this${until?' until '+until:''}. Wait, or ask ${who==='You'?'your other window':'them'} to let it go.`,{status,kind:'held',command:name,body,holder:h||null});}
  if(status===403){const agent=String(actor||'').startsWith('agent:');return new V2Error(agent?`Only Adrian can decide this. ${actorName(actor)} can propose it, not do it.`:(said||'Only Adrian can do this, from his own page.'),{status,kind:'owner-only',command:name,body});}
  if(status>=400&&status<500)return new V2Error(said||'The app could not do this.',{status,kind:'refused',command:name,body});
  return new V2Error(said&&status!==500?said:'The app could not answer. Nothing was changed.',{status,kind:'failed',command:name,body});
 }
 const uuid=()=>{try{return root.crypto.randomUUID();}catch{const h=[...Array(32)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}};

 /** The client. fetchImpl and base are for tests; the page uses its own origin. */
 function createClient({base='',fetchImpl=(...a)=>root.fetch(...a),search=root.location?.search||'',storage=(()=>{try{return root.sessionStorage;}catch{return null;}})(),timeoutMs=20000}={}){
  const who=resolveActor(search,storage);let capabilities=null,loading=null;
  const headers=()=>who.explicit?{'X-AR-Actor':who.actor,'X-AR-Client':'ui'}:{};
  async function request(method,path,body,wait=timeoutMs){
   if(!who.actor)throw new V2Error('This page was opened with an assistant name the app does not know. Open it again with a listed name.',{kind:'refused'});
   let response;
   try{response=await fetchImpl(base+path,{method,credentials:'same-origin',...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(wait)}:{}),headers:{Accept:'application/json',...headers(),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
   catch{throw new V2Error('The app could not be reached. Nothing was changed.',{kind:'failed'});}
   const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch{value={text};}
   return {ok:response.ok,status:response.status,body:value};
  }
  // The command list is read with ?only=commands (no recordings, no retained copies, only the commands and the release's
  // commit), and kept for this browser session under that commit. A page shows from the kept list at once; one read in
  // the background confirms the commit and swaps the list in if the app was released again meanwhile.
  const KEPT='v2.commands';
  const isCommand=c=>!!c&&typeof c==='object'&&typeof c.name==='string'&&c.name&&typeof c.method==='string'&&typeof c.route==='string';
  const sound=list=>Array.isArray(list)&&list.length>0&&list.every(isCommand);
  const kept=()=>{try{const v=JSON.parse(storage?.getItem(KEPT)||'null');if(v&&typeof v.sha==='string'&&v.sha&&sound(v.commands))return v;if(v)storage?.removeItem?.(KEPT);}catch{try{storage?.removeItem?.(KEPT);}catch{}}return null;};
  const keep=(sha,list)=>{try{if(sha&&sound(list))storage?.setItem(KEPT,JSON.stringify({sha,commands:list}));}catch{}};
  const readCommands=()=>request('GET','/api/capabilities?only=commands').then(r=>{if(!r.ok||!sound(r.body?.commands))throw new V2Error('The list of commands could not be read.',{status:r.status});return {sha:typeof r.body.git?.sha==='string'?r.body.git.sha:null,commands:r.body.commands};});
  let confirming=null,confirmed=null,usedKept=false; // the one background read that checks a kept list against the running release
  async function commands(){
   if(capabilities)return capabilities;
   const have=kept();
   if(have){
    capabilities=have.commands;usedKept=true;
    confirming=confirmed=readCommands().then(fresh=>{if(fresh.sha!==have.sha)capabilities=fresh.commands;keep(fresh.sha,fresh.commands);return fresh.sha!==have.sha;}).catch(()=>false).finally(()=>{confirming=null;});
    return capabilities;
   }
   loading||=readCommands().then(fresh=>{capabilities=fresh.commands;keep(fresh.sha,fresh.commands);return capabilities;}).finally(()=>{loading=null;});
   return loading;
  }
  async function find(name){
   let command=(await commands()).find(c=>c.name===name);
   // A list kept from an earlier release may not know a command: wait for the running release's list before refusing.
   if(!command&&confirming){await confirming;command=(capabilities||[]).find(c=>c.name===name);}
   if(!command)throw new V2Error(`The app has no command called "${name}".`,{kind:'refused',command:name});
   return command;
  }
  async function once(command,input,wait){
   const built=buildRequest(command,input),r=await request(built.method,built.path,built.body,wait);
   if(r.ok)return r.body;
   throw explain(r.status,r.body,{name:command.name,actor:who.actor});
  }
  /** Call one command. A write gets a fresh operationId unless the input names one. On 409, with reread, the fresh
      record is read; with merge(fresh, error) returning a new input the write is tried once more, otherwise the error
      carries .fresh for the screen to show. timeoutMs (optional) is how long this one call may wait; the default is 20 seconds (a large upload asks for longer). */
  async function call(name,input={},{reread,merge,timeoutMs:wait}={}){
   const command=await find(name),write=!command.readOnly&&!NO_OPERATION_ID.has(name);
   const first=write&&input&&typeof input==='object'&&!input.operationId?{...input,operationId:uuid()}:input;
   try{
    try{return await once(command,first,wait);}
    catch(error){
     // On a list kept from an earlier release, the router's "API route was not found." is tried once more, and only when the
     // running release's list gives this command another route or method. Any other 404 is the app's answer and is never sent again.
     if(!(error instanceof V2Error)||error.status!==404||error.body?.error!=='API route was not found.'||!usedKept||!confirmed)throw error;
     const swapped=await confirmed;if(!swapped)throw error;
     const again=await find(name);
     if(again.route===command.route&&again.method===command.method)throw error;
     return await once(again,first,wait);
    }
   }
   catch(error){
    if(!(error instanceof V2Error)||error.kind!=='stale'||typeof reread!=='function')throw error;
    const fresh=await reread();error.fresh=fresh;error.message='This changed since it was opened here. It has been read again; look at it before saving.';
    const next=typeof merge==='function'?await merge(fresh,error):null;
    if(!next)throw error;
    // A merged write is a new attempt, so it gets its own operation id unless the screen chose one.
    return once(command,write&&(!next.operationId||next.operationId===first.operationId)?{...next,operationId:uuid()}:next,wait);
   }
  }
  return Object.freeze({call,commands,find,request,actor:()=>who.actor,explicit:()=>who.explicit,isHuman:()=>String(who.actor||'').startsWith('human:'),actorName});
 }

 /** The live change stream: one EventSource for the page, resumed from its last cursor, quiet while the page is hidden. */
 function createLive({base='',doc=root.document,win=root}={}){
  const listeners=new Set();let source=null,cursor=null,bootId=null,retry=0,timer=null,connected=false,stopped=false;
  const matches=(f,e)=>(!f.kind||e.scope?.kind===f.kind)&&(!f.id||e.scope?.id===f.id)&&(!f.kinds||f.kinds.some(k=>k.endsWith('*')?String(e.kind).startsWith(k.slice(0,-1)):e.kind===k));
  function dispatch(event){for(const l of [...listeners])if(event.reset||matches(l.filter,event)){try{l.fn(event);}catch(error){console.error('Version two: a screen could not take in a change.',error);}}}
  function reset(info){if(Number.isSafeInteger(info?.headCursor))cursor=info.headCursor;else if(Number.isSafeInteger(info?.cursor))cursor=info.cursor;if(info?.bootId)bootId=info.bootId;dispatch({reset:true,bootId,cursor});}
  const away=()=>stopped||!!doc?.hidden;
  function disconnect(){clearTimeout(timer);timer=null;source?.close?.();source=null;connected=false;}
  function connect(){
   if(away()||source||typeof win.EventSource!=='function')return;
   const q=new URLSearchParams();if(cursor!=null)q.set('since',String(cursor));if(bootId)q.set('bootId',bootId);
   const es=new win.EventSource(base+'/api/events'+(String(q)?'?'+q:''));source=es;
   es.addEventListener('hello',m=>{if(source!==es)return;let info;try{info=JSON.parse(m.data);}catch{return;}if(info.reset||(bootId&&info.bootId&&info.bootId!==bootId))reset(info);else{bootId=info.bootId||bootId;if(cursor==null&&Number.isSafeInteger(info.cursor))cursor=info.cursor;}});
   es.onopen=()=>{if(source===es){connected=true;retry=0;}};
   es.addEventListener('change',m=>{if(source!==es)return;let e;try{e=JSON.parse(m.data);}catch{return;}if(!Number.isSafeInteger(e.cursor))return;if(bootId&&e.bootId&&e.bootId!==bootId){reset(e);return;}bootId=e.bootId||bootId;if(cursor!=null&&e.cursor<=cursor)return;cursor=e.cursor;dispatch(e);});
   es.addEventListener('reset',m=>{if(source!==es)return;let info={};try{info=JSON.parse(m.data);}catch{}reset(info);});
   // Reopen with the newest cursor rather than letting the browser replay the first address.
   es.onerror=()=>{if(source!==es)return;disconnect();if(away())return;retry=Math.min(retry+1,6);timer=setTimeout(connect,Math.min(30000,1000*2**(retry-1)));};
  }
  if(doc?.addEventListener){doc.addEventListener('visibilitychange',()=>{if(doc.hidden)disconnect();else{connect();}});}
  if(win?.addEventListener){win.addEventListener('pagehide',()=>disconnect());win.addEventListener('pageshow',e=>{if(e.persisted)connect();});}
  return Object.freeze({
   /** fn(event) for each change matching {kind?, id?, kinds?} (kinds may end in *); fn({reset:true}) when everything should be read again. */
   on(filter,fn){const l={filter:filter||{},fn};listeners.add(l);connect();return ()=>listeners.delete(l);},
   connected:()=>connected,cursor:()=>cursor,
   stop(){stopped=true;disconnect();},
  });
 }

 const api=Object.freeze({ACTORS,resolveActor,buildRequest,createClient,createLive,V2Error,actorName,uuid});
 root.V2Client=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
