/* One shell render. The chrome around the work is three regions and one bar: the sidebar, the bar, the work column and,
   only where passages are anchored, the inspector. The chrome layers used to each wrap render() and watch #app with their
   own observer, and each appended its own bar; now each registers one mount here, and after every render and after any
   change inside #app the shell runs the mounts once, in order. Content owners (study.js, draft-flow, photos, outputs...)
   keep producing the work column. Load before the chrome layers (checkpoint-rail and later). */
(()=>{
 if(window.c3Shell)return;
 const mounts=[];let queued=false,installed=false,running=false;
 function run(){
  if(running)return;running=true;
  try{for(const m of mounts){try{m.fn();}catch(error){console.error('AR Create shell: the '+m.name+' region could not mount.',error);}}}
  finally{running=false;}
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;run();});}
 function install(){
  if(installed||typeof window.render!=='function')return;installed=true;
  const previous=window.render;
  window.render=function(...args){const result=previous.apply(this,args);if(result?.then)return result.then(value=>{run();return value;});run();return result;};
  new MutationObserver(records=>{if(records.every(r=>mounts.some(m=>m.ignore&&r.target.closest?.(m.ignore))))return;schedule();}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 }
 // order: lower mounts first. ignore: a selector whose own repaints never need another pass.
 function register(name,fn,{order=50,ignore=''}={}){
  const at=mounts.findIndex(m=>m.name===name);if(at>=0)mounts.splice(at,1);
  mounts.push({name,fn,order,ignore});mounts.sort((a,b)=>a.order-b.order);install();
  try{fn();}catch(error){console.error('AR Create shell: the '+name+' region could not mount.',error);}
 }
 // Scroll something into view inside the work column and mark its arrival.
 function reveal(node){if(!node)return;node.scrollIntoView?.({block:'center'});node.querySelector?.('summary,button,input,textarea,select')?.focus?.({preventScroll:true});}
 // Who wrote something, in plain words. The UI is always Adrian; another window or the command line still reads "You".
 const NAMES={'agent:claude-code':'Claude','agent:claude-design':'Claude Design','agent:codex':'Codex','agent:hermes':'Hermes','agent:grok':'Grok','agent:chatgpt':'ChatGPT'};
 function actorName(actor){actor=String(actor||'');if(actor.startsWith('human:'))return 'You';if(NAMES[actor])return NAMES[actor];if(actor.startsWith('cron:'))return 'Scheduled job '+actor.slice(5);if(actor.startsWith('import:'))return 'Import from '+actor.slice(7);if(actor.startsWith('release:'))return 'Release '+actor.slice(8,15);if(actor.startsWith('agent:'))return actor.slice(6);return 'Someone earlier';}
 const isAgent=actor=>String(actor||'').startsWith('agent:');
 // Live sync: one event stream for the whole app (GET /api/events). Each surface subscribes for the records it shows and
 // calls its own existing refresh; a reset (server restarted, or this window fell too far behind) asks every surface to
 // re-read what it holds. Reconnects carry the last cursor, so nothing in between is lost. Without EventSource (tests,
 // old browsers) the app keeps its earlier refresh-on-focus behaviour.
 const live=(()=>{
  const listeners=new Set();let source=null,cursor=null,bootId=null,connected=false,retry=0,timer=null,stopped=false,pageAway=false,focused=typeof document.hasFocus!=='function'||document.hasFocus(),epoch=0,needsRefresh=document.hidden||!focused,pendingAPI=0;
  const matches=(filter,event)=>(!filter.kind||event.scope?.kind===filter.kind)&&(!filter.id||event.scope?.id===filter.id)&&(!filter.kinds||filter.kinds.some(k=>k.endsWith('*')?String(event.kind).startsWith(k.slice(0,-1)):event.kind===k));
  function dispatch(event){for(const l of [...listeners]){if(event.reset||matches(l.filter,event)){try{l.fn(event);}catch(error){console.error('AR Create live sync: a surface could not refresh.',error);}}}window.dispatchEvent(new CustomEvent('ar-live-change',{detail:event}));}
  function reset(info){cursor=Number.isSafeInteger(info?.headCursor)?info.headCursor:Number.isSafeInteger(info?.cursor)?info.cursor:cursor;if(info?.bootId)bootId=info.bootId;dispatch({reset:true,bootId,cursor,reason:info?.resetReason||null});}
  const available=()=>!stopped&&!pageAway&&!document.hidden&&focused&&pendingAPI===0;
  function disconnect(){epoch++;clearTimeout(timer);timer=null;source?.close?.();source=null;const was=connected;connected=false;if(was)window.dispatchEvent(new CustomEvent('ar-live-status',{detail:{connected:false}}));}
  function suspend(){needsRefresh=true;disconnect();}
  function resume(){if(!available())return;if(needsRefresh){needsRefresh=false;dispatch({reset:true,bootId,cursor});}return connect();}
  let learning=null;
  async function connect(){
   if(!available()||source||typeof EventSource!=='function')return;
   const token=epoch;clearTimeout(timer);timer=null;
   // Consume the initial page too: its cursor is delivered-through, not the stream's head.
   // A reset deliberately replaces replay with each owner's canonical read.
   if(cursor==null&&typeof fetch==='function'){learning||=fetch('/api/events/since?since=0&limit=1').then(r=>r.ok?r.json():null).then(v=>{
    if(cursor!=null||!Number.isSafeInteger(v?.cursor))return;
    bootId=v.bootId||bootId;cursor=v.cursor;
    if(!available()){needsRefresh=true;return;}
    if(v.reset)reset(v);else for(const event of v.events||[])dispatch(event);
   }).catch(()=>{}).finally(()=>{learning=null;});await learning;if(token!==epoch||!available()||source)return;}
   const query=new URLSearchParams();if(cursor!=null)query.set('since',String(cursor));if(bootId)query.set('bootId',bootId);
   const es=new EventSource('/api/events'+(query.size?'?'+query:''));source=es;let lastReset=null;
   const recover=info=>{const key=String(info?.bootId)+':'+String(info?.headCursor??info?.cursor);if(lastReset===key)return;lastReset=key;reset(info);};
   // Always sent on connection, including an idle new boot with no subsequent write.
   es.addEventListener('hello',message=>{if(source!==es||!available())return;let info;try{info=JSON.parse(message.data);}catch{return;}
    if(info.reset||cursor==null||bootId&&info.bootId&&info.bootId!==bootId)recover(info);else bootId=info.bootId||bootId;
   });
   es.onopen=()=>{if(source!==es||!available())return;connected=true;retry=0;window.dispatchEvent(new CustomEvent('ar-live-status',{detail:{connected:true}}));};
   es.addEventListener('change',message=>{if(source!==es||!available())return;let event;try{event=JSON.parse(message.data);}catch{return;}
    if(!Number.isSafeInteger(event.cursor)||event.cursor<0)return;
    if(bootId&&event.bootId&&event.bootId!==bootId){recover(event);return;}
    bootId=event.bootId||bootId;if(cursor!=null&&event.cursor<=cursor)return;cursor=event.cursor;dispatch(event);});
   es.addEventListener('reset',message=>{if(source!==es||!available())return;let info={};try{info=JSON.parse(message.data);}catch{}recover(info);});
   // The browser's own retry would replay the first URL's cursor; reopen with the newest one instead.
   es.onerror=()=>{if(source!==es||!available())return;const was=connected;connected=false;es.close();if(source===es)source=null;if(was)window.dispatchEvent(new CustomEvent('ar-live-status',{detail:{connected:false}}));if(!available())return;retry=Math.min(retry+1,6);timer=setTimeout(connect,Math.min(30000,1000*2**(retry-1)));};
  }
  // Hidden or unfocused documents release scarce per-origin connections. Returning owners refresh
  // their current records while the stream replays from the retained cursor.
  window.addEventListener('blur',()=>{focused=false;suspend();});
  window.addEventListener('focus',()=>{focused=true;resume();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else resume();});
  window.addEventListener('pagehide',()=>{pageAway=true;suspend();});
  window.addEventListener('pageshow',event=>{if(event.persisted){pageAway=false;resume();}});
  // Finite work takes priority over this page's long-lived stream. Older open
  // tabs can otherwise occupy every per-origin connection and strand a click.
  // Retain the cursor; transport yielding itself never requests a record reset.
  if(typeof window.fetch==='function'&&typeof EventSource==='function'){
   const fetch=window.fetch;
   window.fetch=function(...args){
    let url;try{url=new URL(typeof args[0]==='string'?args[0]:args[0]?.url||String(args[0]),location.href);}catch{return fetch.apply(this,args);}
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/events'))return fetch.apply(this,args);
    pendingAPI++;disconnect();
    const release=()=>{pendingAPI--;if(pendingAPI===0)void resume();};
    let request;try{request=fetch.apply(this,args);}catch(error){release();throw error;}
    return Promise.resolve(request).finally(release);
   };
  }
  return {
   /** fn(event) for each change matching {kind?, id?, kinds?}; fn({reset:true}) when everything should be re-read. */
   on(filter,fn){const l={filter:filter||{},fn};listeners.add(l);if(!source&&!stopped)connect();return ()=>listeners.delete(l);},
   connected:()=>connected,cursor:()=>cursor,connect,
   stop(){stopped=true;disconnect();},
   resume(){if(!stopped)return;stopped=false;needsRefresh=true;return resume();},
  };
 })();
 window.c3Shell={register,run,schedule,reveal,mounts:()=>mounts.map(m=>m.name),live,actorName,isAgent};
 if(typeof EventSource==='function')queueMicrotask(()=>live.connect());
})();
