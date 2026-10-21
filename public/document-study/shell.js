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
 window.c3Shell={register,run,schedule,reveal,mounts:()=>mounts.map(m=>m.name)};
})();
