import {createHash} from 'node:crypto';
import {prepareTranslationBatch} from '../../public/document-study/translation-readiness.js';

const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const contextHash=value=>digest(JSON.stringify(canonical(value)));
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&value.trim().length>0&&value.length<=240;
const revision=value=>Number.isSafeInteger(value)&&value>=0;
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const need=value=>{if(!value)throw Error('Unproven translation lineage');};
const unique=rows=>Array.isArray(rows)&&rows.every(row=>id(row?.id))&&new Set(rows.map(row=>row.id)).size===rows.length;
const dialogue=session=>session.turns.map(turn=>`${turn.speaker}: ${turn.text}`).join('\n\n')+'\n';

/**
 * Pure proof over already authenticated snapshots. The caller must authenticate
 * receipt bytes against descriptor.expectedSha256 with the maintained receipt
 * reader BEFORE passing the parsed receipt here. Parsed JSON cannot reproduce
 * an arbitrary original file's byte fingerprint. No writer or I/O is invoked.
 * projectSession(rawSession, sourceHash, undoOperationId) is the owner's trusted
 * public projection; it receives clones, never the caller's mutable snapshots.
 *
 * classification: baseline | accepted-lineage | earlier. Only proven results
 * carry currentSourceContext; preparationContext never moves to a later save.
 */
export function deriveTranslationReviewLineage(input={}) {
 let descriptor,receipt,current,history,operations,projectSession;
 try{({descriptor,receipt,current,history,operations}=structuredClone({...input,projectSession:undefined}));projectSession=input.projectSession;}catch{return freeze({classification:'earlier',readOnly:true,acceptedTurnIds:[],remainingTurnIds:[],preparationContext:null});}
 const validDescriptor=descriptor&&id(descriptor.sessionId)&&id(descriptor.sourceId)&&revision(descriptor.expectedRevision)&&['expectedSha256','expectedSourceHash','expectedContextHash'].every(k=>sha(descriptor[k]));
 const preparationContext=validDescriptor?{sessionId:descriptor.sessionId,sourceId:descriptor.sourceId,expectedRevision:descriptor.expectedRevision,expectedSourceHash:descriptor.expectedSourceHash,expectedContextHash:descriptor.expectedContextHash}:null;
 const targetIds=Array.isArray(receipt?.proposals)?receipt.proposals.slice(0,1000).map(p=>p?.turnId).filter(id):[];
 const earlier=()=>freeze({classification:'earlier',readOnly:true,acceptedTurnIds:[],remainingTurnIds:[...new Set(targetIds)],preparationContext});
 try{
  need(validDescriptor);
  need(typeof projectSession==='function'&&revision(current?.revision)&&current.revision>=descriptor.expectedRevision&&current.session?.id===descriptor.sessionId&&current.session.sourceId===descriptor.sourceId&&sha(current.session.sourceHash));
  need(receipt?.sourceId===descriptor.sourceId&&receipt.sourceHash===descriptor.expectedSourceHash&&receipt.applied===false&&id(receipt.purpose)&&Array.isArray(receipt.proposals)&&receipt.proposals.length>0&&receipt.proposals.length<=1000);
  need(new Set(targetIds).size===receipt.proposals.length&&targetIds.length===receipt.proposals.length);
  for(const row of receipt.proposals)need(id(row.label)&&typeof row.current==='string'&&row.current.trim()&&typeof row.proposal==='string'&&row.proposal.trim()&&!/\p{Script=Han}/u.test(row.proposal)&&(row.uncertainty===undefined||typeof row.uncertainty==='string'));
  need(Array.isArray(history)&&history.length<=100000&&Array.isArray(operations)&&operations.length<=100000&&unique(current.session.turns));
  const relevant=history.filter(h=>h?.sessionId===descriptor.sessionId||h?.before?.id===descriptor.sessionId||h?.after?.id===descriptor.sessionId);
  const referencedIds=new Set(relevant.map(h=>h.operationId)),opsById=new Map();
  for(const op of operations){const found=opsById.get(op?.id)||[];found.push(op);opsById.set(op?.id,found);}
  const relevantOps=operations.filter(o=>o?.sessionId===descriptor.sessionId||referencedIds.has(o?.id));
  need(relevantOps.every(o=>id(o.id))&&new Set(relevantOps.map(o=>o.id)).size===relevantOps.length);
  const historyIds=relevant.filter(h=>h.operationId!==undefined).map(h=>h.operationId);
  need(historyIds.every(id)&&new Set(historyIds).size===historyIds.length);
  const opFor=h=>{const matches=opsById.get(h.operationId)||[];need(matches.length===1);return matches[0];};
  const project=(raw,hash,undo)=>projectSession(structuredClone(raw),hash,undo);
  const matchesPreparation=projected=>{if(projected?.sourceHash!==descriptor.expectedSourceHash||contextHash(projected)!==descriptor.expectedContextHash)return false;const gaps=prepareTranslationBatch(projected,descriptor.expectedRevision).gapIds;return gaps.length===targetIds.length&&gaps.every(t=>targetIds.includes(t))&&receipt.proposals.every(row=>projected.turns.find(t=>t.id===row.turnId)?.text===row.current);};
  const result=(classification,accepted)=>freeze({classification,readOnly:false,acceptedTurnIds:targetIds.filter(t=>accepted.has(t)),remainingTurnIds:targetIds.filter(t=>!accepted.has(t)),preparationContext,currentSourceContext:{sessionId:descriptor.sessionId,sourceId:descriptor.sourceId,expectedRevision:current.revision,expectedSourceHash:current.session.sourceHash}});
  // Full projection includes version, originals, timing and prior eligible Undo.
  // Exact restoration can legitimately return to preparation at a new revision.
  if(matchesPreparation(current.session))return result('baseline',new Set());
  function eligible(prefix,raw,hash){
   const undone=new Set(prefix.filter(h=>h.reason==='human-undo').map(h=>h.undoOf));
   return [...prefix].reverse().find(h=>h.reason==='human-correction'&&id(h.operationId)&&!undone.has(h.operationId)&&h.afterHash===hash&&same(h.after,raw))?.operationId;
  }
  function validateEvent(h){
   need(h.sessionId===descriptor.sessionId&&h.before?.id===descriptor.sessionId&&h.after?.id===descriptor.sessionId&&h.before.sourceId===descriptor.sourceId&&h.after.sourceId===descriptor.sourceId&&unique(h.before.turns)&&unique(h.after.turns));
   need(typeof h.beforeRaw==='string'&&typeof h.afterRaw==='string'&&digest(h.beforeRaw)===h.beforeHash&&digest(h.afterRaw)===h.afterHash);
   const op=opFor(h);need(op.status==='committed'&&op.sessionId===descriptor.sessionId&&op.beforeHash===h.beforeHash&&op.afterHash===h.afterHash&&revision(op.beforeRevision)&&sha(op.requestHash));
   const r=op.result;need(r?.operationId===op.id&&r.status==='committed'&&r.sessionId===descriptor.sessionId&&r.sourceHash===h.afterHash&&r.revision===op.beforeRevision+2&&r.revision<=current.revision);
   return op;
  }
  let start=-1;
  for(let i=0;i<relevant.length;i++){
   const h=relevant[i],op=opsById.get(h.operationId)?.[0];
   if(op&&op.beforeRevision>=descriptor.expectedRevision&&matchesPreparation(project(h.before,h.beforeHash,eligible(relevant.slice(0,i),h.before,h.beforeHash)))){start=i;break;}
  }
  need(start>=0&&relevant.length-start<=10000);
  const chain=relevant.slice(start),seen=new Map(),accepted=new Map(),prefix=relevant.slice(0,start),undone=new Set(prefix.filter(h=>h.reason==='human-undo').map(h=>h.undoOf));
  let raw=structuredClone(chain[0].before),sourceHash=chain[0].beforeHash,lastRevision=descriptor.expectedRevision;
  const tagFor=turnId=>({schema:'ar-create.translation-acceptance.v1',receiptSha256:descriptor.expectedSha256,sourceId:descriptor.sourceId,sessionId:descriptor.sessionId,turnId});
  const processed=[...prefix];
  for(const h of chain){
   const op=validateEvent(h);need(op.beforeRevision>=lastRevision&&same(h.before,raw)&&h.beforeHash===sourceHash);
   if(h.reason==='human-correction'){
    const tag=h.translationAcceptance,row=receipt.proposals.find(p=>p.turnId===tag?.turnId);
    need(op.action==='edit'&&!Object.hasOwn(h,'undoOf')&&row&&same(tag,tagFor(row.turnId))&&same(op.translationAcceptance,tag)&&!accepted.has(row.turnId));
    need(op.result.undoOperationId===op.id&&!Object.hasOwn(op.result,'undoOf'));
    const next=structuredClone(raw),turn=next.turns.find(t=>t.id===row.turnId);need(turn?.text===row.current&&revision(next.version));turn.text=row.proposal;next.version++;
    need(same(h.after,next)&&h.afterRaw===dialogue(next));
    accepted.set(row.turnId,op.id);
   }else{
    need(h.reason==='human-undo'&&op.action==='undo'&&id(h.undoOf)&&op.result.undoOf===h.undoOf&&!Object.hasOwn(op.result,'undoOperationId'));
    const target=seen.get(h.undoOf);need(target&&!undone.has(h.undoOf)&&eligible(processed,raw,sourceHash)===h.undoOf&&same(raw,target.after)&&h.beforeRaw===target.afterRaw&&h.afterRaw===target.beforeRaw&&h.afterHash===target.beforeHash&&same(h.after,target.before));
    need(target.undoneBy===op.id);
    if(h.translationAcceptance!==undefined||op.translationAcceptance!==undefined)need(same(h.translationAcceptance,target.translationAcceptance)&&same(op.translationAcceptance,target.translationAcceptance));
    accepted.delete(target.translationAcceptance.turnId);undone.add(h.undoOf);
   }
   seen.set(op.id,h);processed.push(h);raw=structuredClone(h.after);sourceHash=h.afterHash;lastRevision=op.result.revision;
  }
  // A missing history entry must never be inferred from matching final words.
  const chainIds=new Set(chain.map(h=>h.operationId));
  need(relevantOps.filter(o=>o.beforeRevision>=opFor(chain[0]).beforeRevision).every(o=>chainIds.has(o.id)));
  for(const h of chain.filter(h=>h.reason==='human-correction')){const undo=chain.find(u=>u.reason==='human-undo'&&u.undoOf===h.operationId);need(h.undoneBy===undo?.operationId);}
  need(sourceHash===current.session.sourceHash&&same(project(raw,sourceHash,eligible(processed,raw,sourceHash)),current.session));
  return result(accepted.size?'accepted-lineage':'baseline',new Set(accepted.keys()));
 }catch{return earlier();}
}
