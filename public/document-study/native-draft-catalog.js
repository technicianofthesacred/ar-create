/* One page-scoped discovery snapshot. Exact operation guards request a fresh read. */
(()=>{
 if(window.nativeDraftCatalog)return;
 const endpoint='/api/study-draft/catalog';
 let snapshot=null,pending=null,epoch=0,sequence=0,discoveryReads=0,freshReads=0;
 const diagnostics=()=>{if(typeof document!=='undefined'&&document.documentElement){document.documentElement.dataset.nativeCatalogDiscoveryReads=String(discoveryReads);document.documentElement.dataset.nativeCatalogFreshReads=String(freshReads);}};
 diagnostics();
 const copy=value=>structuredClone(value);
 const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
 function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.drafts))throw Error('Saved manuscript discovery could not be verified.');
  for(const key of ['drafts','collections','outputBindings']){
   const rows=value[key];if(rows===undefined&&key!=='drafts')continue;
   if(!Array.isArray(rows)||rows.length>20000)throw Error('Saved manuscript discovery could not be verified.');
   const seen=new Set();
   for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Saved manuscript discovery could not be verified.');
    const identity=key==='drafts'?(row.originalId||row.id||row.bindingId):(row.bindingId||row.outputId);
    if(typeof identity!=='string'||!identity||seen.has(identity))throw Error('Saved manuscript discovery could not be verified.');
    seen.add(identity);
    for(const field of ['parentStudyId','parentStudyKey','bindingId','originalId','outputId'])if(row[field]!==undefined&&(typeof row[field]!=='string'||!row[field]))throw Error('Saved manuscript discovery could not be verified.');
   }
  }
  if(value.excludedProjectIds!==undefined&&(!Array.isArray(value.excludedProjectIds)||value.excludedProjectIds.some(id=>typeof id!=='string'||!id)||new Set(value.excludedProjectIds).size!==value.excludedProjectIds.length))throw Error('Saved project exclusions could not be verified.');
  return freeze(copy(value));
 }
 function invalidate(){epoch++;snapshot=null;pending=null;}
 function mutationSucceeded(route){
  const pathname=String(route||'').split('?')[0];
  const relevant=pathname==='/api/study/structure-tests'||/^\/api\/study-draft\/(?:open|create-collection|fork|register-output|recover-roots|reconnect|recover)$/.test(pathname)||/^\/api\/study\/outputs\/(?:create|copy-retained-carousel|copy-browser-carousel)$/.test(pathname)||/^\/api\/magazine\/working-draft\/(?:save|undo|history-restore)$/.test(pathname);
  if(relevant)invalidate();return relevant;
 }
 async function readOnce({fresh=false,settle=false}={}){
  if(!fresh&&!settle&&snapshot)return copy(snapshot);
  if(pending&&(!fresh||pending.fresh))return copy(await pending.promise);
  if(fresh)snapshot=null;
  const ticket={fresh,epoch,sequence:++sequence,promise:null};
  ticket.promise=(async()=>{
   if(fresh)freshReads++;else discoveryReads++;diagnostics();
   const response=await fetch(endpoint,{cache:'no-store'});
   if(!response.ok)throw Error('Saved manuscript discovery is unavailable. Retry when it is available.');
   let value;try{value=await response.json();}catch{throw Error('Saved manuscript discovery could not be verified.');}
   const checked=validate(value);
   if(ticket.epoch!==epoch)throw Object.assign(Error('Saved manuscript discovery changed. Read it again before continuing.'),{catalogInvalidated:true});
   if(ticket.sequence===sequence)snapshot=checked;
   return checked;
  })();
  pending=ticket;
  try{return copy(await ticket.promise);}finally{if(pending===ticket)pending=null;}
 }
 async function read({fresh=false,settle=false}={}){
  try{return await readOnce({fresh,settle});}catch(error){
   // Discovery admits no operation. Discard invalidated bytes and settle once
   // on the current GET, sharing it with other discovery consumers. Exact
   // operation guards must still refuse rather than silently refresh or retry.
   if(fresh||!error?.catalogInvalidated)throw error;
   return readOnce();
  }
 }
 // The live stream invalidates discovery once; its consumers keep their own
 // current-owner, revision, dirty-writing and navigation guards.
 function hook(){window.c3Shell?.live?.on?.({},event=>{if(event.reset||/^study-draft\.(?:open|create-collection|fork|register-output|recover-roots|reconnect)$/.test(event.kind||'')||/^study\.outputs\.(?:create|copy-retained-carousel|copy-browser-carousel)$/.test(event.kind||''))invalidate();});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook,{once:true});else hook();
 window.nativeDraftCatalog={read,invalidate,mutationSucceeded};
})();
