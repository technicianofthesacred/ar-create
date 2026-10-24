import {randomUUID} from 'node:crypto';

/**
 * What changed, for anyone watching: the app (SSE) and agents (since a cursor).
 * One event per successful write: {cursor, kind, scope:{kind,id}, revision,
 * actor, client, at, operationId}. Kept in memory (the last `limit` events);
 * the journal is the durable record. A cursor from another boot, or one older
 * than the buffer, answers reset:true so the reader re-reads what it holds.
 */
export function createEventBus({limit=1000}={}){
 const bootId=randomUUID(),buffer=[],listeners=new Set();let cursor=0;
 const matches=(event,filter={})=>(!filter.kind||event.scope?.kind===filter.kind)&&(!filter.id||event.scope?.id===filter.id);
 return {
  bootId,
  get cursor(){return cursor;},
  emit(event){
   const value=Object.freeze({cursor:++cursor,bootId,at:new Date().toISOString(),...event});
   buffer.push(value);if(buffer.length>limit)buffer.splice(0,buffer.length-limit);
   for(const listener of listeners){try{listener(value);}catch{}}
   return value;
  },
  since(since=0,filter={},max=200){
   const from=Number.isSafeInteger(since)&&since>=0?since:0;
   const oldest=buffer.length?buffer[0].cursor:cursor+1;
   const reset=from>cursor||(from>0&&from<oldest-1);
   const events=buffer.filter(event=>event.cursor>(reset?0:from)&&matches(event,filter));
   return {schema:'ar-create.events.v1',bootId,cursor,reset,events:events.slice(-Math.max(1,Math.min(max,1000)))};
  },
  subscribe(listener,filter={}){const wrapped=event=>{if(matches(event,filter))listener(event);};listeners.add(wrapped);return ()=>listeners.delete(wrapped);},
 };
}

const pick=(...values)=>values.find(value=>typeof value==='string'&&value&&value.length<=256);
/** The record a write touched, as {kind,id}, from its input, query and reply. */
export function scopeOf({input,result,query,section}){
 const i=input&&typeof input==='object'&&!Array.isArray(input)?input:{},q=query||new URLSearchParams(),r=result&&typeof result==='object'?result:{};
 if(i.scope&&typeof i.scope==='object'&&typeof i.scope.kind==='string')return {kind:i.scope.kind,id:pick(i.scope.id,i.scope.outputId,i.scope.bindingId,i.scope.collectionId,i.scope.parentStudyId)||null};
 if(section==='library'&&['library','media'].includes(i.domain))return {kind:'library',id:'folders-'+i.domain};
 const draft=pick(i.bindingId,q.get('bindingId'),r.binding?.id);if(draft)return {kind:'draft',id:draft};
 const collection=pick(i.collectionId);if(collection)return {kind:'collection',id:collection};
 const output=pick(i.outputId,i.selectedOutputId,q.get('outputId'));if(output)return {kind:'output',id:output};
 const project=pick(i.parentStudyId,q.get('parentStudyId'),r.parentStudyId);if(project)return {kind:'project',id:project};
 const source=pick(i.sourceId,i.sessionId);if(source)return {kind:'source',id:source};
 const piece=pick(i.projectId,i.expectedProjectId);if(piece)return {kind:'piece',id:piece};
 return {kind:section||'system',id:null};
}
/** The revision a write produced, when its reply says. */
export function revisionOf(result){
 const r=result&&typeof result==='object'?result:{};
 for(const value of [r.revision,r.after?.revision,r.record?.revision,r.expected?.revision,r.document?.revision])if(Number.isSafeInteger(value))return value;
 return null;
}
