import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveTranslationReviewLineage} from '../runtime/services/kept-source-translation-lineage.mjs';
const clone=structuredClone;
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
const context=value=>hash(JSON.stringify(canonical(value)));
const raw=s=>s.turns.map(t=>`${t.speaker}: ${t.text}`).join('\n\n')+'\n';
// Fixture callback deliberately owns this projection. The validator must not
// duplicate it or discard metadata that this owner chooses to expose.
const projectSession=(s,sourceHash,undoOperationId)=>({id:s.id,title:s.title,date:s.date,location:s.location,sourceId:s.sourceId,sourceHash,version:s.version,turns:clone(s.turns),...(undoOperationId?{undoOperationId}:{})});
function fixture(count=3){
 let session={id:'invented-session',sourceId:'invented-source',title:'Invented conversation',date:'2020-01-02',location:'Imaginary garden',editorial:'keep',version:1,imported:{provider:'invented',identity:'original'},turns:[...['A','B','C'].slice(0,count).map((id,i)=>({id,speaker:'Invented speaker',sourceLanguage:'zh',text:['花园','河流','山'][i],originalText:['花园','河流','山'][i],start:i*2,end:i*2+1,metadata:{supplied:true}})),{id:'human',speaker:'Invented guest',text:'Older English.',originalText:'更早',start:8,end:9}]};
 const f={history:[],operations:[],revision:0,session};
 function save(turnId,text,{tagged=false,operationId=`op-${f.operations.length+1}`}={}){
  const before=clone(f.session),after=clone(before);after.turns.find(t=>t.id===turnId).text=text;after.version++;
  const beforeRaw=raw(before),afterRaw=raw(after),beforeHash=hash(beforeRaw),afterHash=hash(afterRaw),tag={schema:'ar-create.translation-acceptance.v1',receiptSha256:f.descriptor?.expectedSha256,sourceId:session.sourceId,sessionId:session.id,turnId};
  const h={sessionId:session.id,reason:'human-correction',operationId,before,after,beforeRaw,afterRaw,beforeHash,afterHash,...(tagged?{translationAcceptance:tag}:{})};
  const op={id:operationId,action:'edit',requestHash:hash(operationId),status:'committed',sessionId:session.id,beforeRevision:f.revision,beforeHash,afterHash,result:{operationId,status:'committed',revision:f.revision+2,sessionId:session.id,sourceHash:afterHash,undoOperationId:operationId},...(tagged?{translationAcceptance:clone(tag)}:{})};
  f.history.push(h);f.operations.push(op);f.revision+=2;f.session=after;return h;
 }
 function undo(target){
  const operationId=`undo-${f.operations.length+1}`,before=clone(f.session),beforeRaw=raw(before),after=clone(target.before),afterRaw=target.beforeRaw,beforeHash=hash(beforeRaw),afterHash=hash(afterRaw);
  const h={sessionId:session.id,reason:'human-undo',operationId,undoOf:target.operationId,before,after,beforeRaw,afterRaw,beforeHash,afterHash};
  f.operations.push({id:operationId,action:'undo',status:'committed',requestHash:hash(operationId),sessionId:session.id,beforeRevision:f.revision,beforeHash,afterHash,result:{operationId,status:'committed',revision:f.revision+2,sessionId:session.id,sourceHash:afterHash,undoOf:target.operationId}});
  target.undoneBy=operationId;f.history.push(h);f.revision+=2;f.session=after;return h;
 }
 f.save=save;f.undo=undo;f.priorHuman=save('human','Preserved human English.');
 f.receipt={purpose:'Invented proposals only',sourceId:session.sourceId,sourceHash:hash(raw(f.session)),applied:false,proposals:['A','B','C'].slice(0,count).map((turnId,i)=>({turnId,label:`Remark ${i+1}`,current:f.session.turns[i].text,proposal:['The invented garden.','The invented river.','The invented mountain.'][i],uncertainty:''}))};
 f.snapshot=()=>{
  const undone=new Set(f.history.filter(h=>h.reason==='human-undo').map(h=>h.undoOf)),sourceHash=hash(raw(f.session)),eligible=[...f.history].reverse().find(h=>h.reason==='human-correction'&&!undone.has(h.operationId)&&context(h.after)===context(f.session)&&h.afterHash===sourceHash)?.operationId;
  return {descriptor:clone(f.descriptor),receipt:clone(f.receipt),current:{revision:f.revision,session:projectSession(f.session,sourceHash,eligible)},history:clone(f.history),operations:clone(f.operations),projectSession};
 };
 f.descriptor={expectedSha256:hash(JSON.stringify(f.receipt)),sessionId:session.id,sourceId:session.sourceId,expectedRevision:f.revision,expectedSourceHash:f.receipt.sourceHash,expectedContextHash:context(f.snapshot().current.session)};
 f.accept=turnId=>save(turnId,f.receipt.proposals.find(p=>p.turnId===turnId).proposal,{tagged:true});
 return f;
}
function prove(f,classification,accepted,remaining){const input=f.snapshot(),before=JSON.stringify({...input,projectSession:undefined}),result=deriveTranslationReviewLineage(input);assert.equal(result.classification,classification);assert.deepEqual(result.acceptedTurnIds,accepted);assert.deepEqual(result.remainingTurnIds,remaining);assert.equal(result.preparationContext.expectedRevision,f.descriptor.expectedRevision);assert.equal(result.preparationContext.expectedSourceHash,f.descriptor.expectedSourceHash);assert.equal(result.preparationContext.expectedContextHash,f.descriptor.expectedContextHash);assert.equal(result.currentSourceContext?.expectedRevision,f.revision);assert.equal(JSON.stringify({...input,projectSession:undefined}),before);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.acceptedTurnIds)&&Object.isFrozen(result.preparationContext));return result;}

test('three targets: baseline → A → B → restart snapshot → UndoB → UndoA retains preparation and prior human Undo',()=>{
 const f=fixture();prove(f,'baseline',[],['A','B','C']);const a=f.accept('A');prove(f,'accepted-lineage',['A'],['B','C']);const b=f.accept('B');const accepted=prove(f,'accepted-lineage',['A','B'],['C']);
 const restarted=JSON.parse(JSON.stringify({...f.snapshot(),projectSession:undefined}));assert.deepEqual(deriveTranslationReviewLineage({...restarted,projectSession}),accepted);
 f.undo(b);prove(f,'accepted-lineage',['A'],['B','C']);f.undo(a);prove(f,'baseline',[],['A','B','C']);assert.equal(f.snapshot().current.session.undoOperationId,f.priorHuman.operationId);
});
test('two targets complete; reevaluating committed operation does not apply it twice',()=>{const f=fixture(2);f.accept('A');f.accept('B');const first=prove(f,'accepted-lineage',['A','B'],[]);assert.deepEqual(deriveTranslationReviewLineage(f.snapshot()),first);});
test('chronological Undo eligibility ignores future undoneBy while traversing A B UndoB',()=>{const f=fixture();const a=f.accept('A'),b=f.accept('B');f.undo(b);assert.equal(b.undoneBy,'undo-4');assert.equal(a.undoneBy,undefined);prove(f,'accepted-lineage',['A'],['B','C']);});
test('unrelated session history and newer global revision leave this proven source usable with fresh CAS',()=>{const f=fixture(2);f.accept('A');const input=f.snapshot();input.current.revision+=9;input.history.push({sessionId:'other',reason:'human-correction',operationId:'foreign-op',before:{id:'other'},after:{id:'other'}});input.operations.push({id:'foreign-op',sessionId:'other'});const r=deriveTranslationReviewLineage(input);assert.equal(r.classification,'accepted-lineage');assert.equal(r.currentSourceContext.expectedRevision,input.current.revision);assert.equal(r.preparationContext.expectedRevision,f.descriptor.expectedRevision);});
test('an older untagged save and exact Undo can restore the complete preparation projection',()=>{const f=fixture(2),h=f.save('A',f.receipt.proposals[0].proposal);assert.equal(deriveTranslationReviewLineage(f.snapshot()).classification,'earlier');f.undo(h);prove(f,'baseline',[],['A','B']);});
test('matching translated words without trusted tags never imply acceptance',()=>{const f=fixture(2);f.save('A',f.receipt.proposals[0].proposal);const r=deriveTranslationReviewLineage(f.snapshot());assert.equal(r.classification,'earlier');assert.equal(r.readOnly,true);assert.equal(r.currentSourceContext,undefined);assert.deepEqual(r.acceptedTurnIds,[]);});

const tamperCases={
 'manual edit after acceptance':f=>{f.save('human','External manual wording.');return f.snapshot();},
 'manual edit before acceptance':f=>{const m=f.save('human','External before next acceptance.');f.accept('B');return f.snapshot();},
 'speaker metadata':(_f,x)=>{x.history.at(-1).after.turns[0].speaker='Changed speaker';return x;},
 'timing metadata':(_f,x)=>{x.history.at(-1).after.turns[0].start=400;return x;},
 'original wording':(_f,x)=>{x.history.at(-1).after.turns[0].originalText='Changed original';return x;},
 'import metadata':(_f,x)=>{x.history.at(-1).after.imported.identity='foreign';return x;},
 'non-target text':(_f,x)=>{x.history.at(-1).after.turns.at(-1).text='Other edit';return x;},
 'version jump':(_f,x)=>{x.history.at(-1).after.version+=2;return x;},
 'before raw bytes':(_f,x)=>{x.history.at(-1).beforeRaw+='tamper';return x;},
 'after raw bytes':(_f,x)=>{x.history.at(-1).afterRaw+='tamper';return x;},
 'operation hash':(_f,x)=>{x.operations.at(-1).afterHash='0'.repeat(64);return x;},
 'operation before hash':(_f,x)=>{x.operations.at(-1).beforeHash='0'.repeat(64);return x;},
 'operation result source hash':(_f,x)=>{x.operations.at(-1).result.sourceHash='0'.repeat(64);return x;},
 'operation result id':(_f,x)=>{x.operations.at(-1).result.operationId='different';return x;},
 'operation result session':(_f,x)=>{x.operations.at(-1).result.sessionId='foreign';return x;},
 'operation result revision':(_f,x)=>{x.operations.at(-1).result.revision++;return x;},
 'operation status':(_f,x)=>{x.operations.at(-1).status='prepared';return x;},
 'operation action':(_f,x)=>{x.operations.at(-1).action='undo';return x;},
 'foreign operation session':(_f,x)=>{x.operations.at(-1).sessionId='foreign';return x;},
 'foreign history session':(_f,x)=>{x.history.at(-1).sessionId='foreign';return x;},
 'missing operation':(_f,x)=>{x.operations.pop();return x;},
 'duplicate operation':(_f,x)=>{x.operations.push(clone(x.operations.at(-1)));return x;},
 'duplicate history operation':(_f,x)=>{x.history.push(clone(x.history.at(-1)));return x;},
 'history missing operation id':(_f,x)=>{delete x.history.at(-1).operationId;return x;},
 'duplicate receipt targets':(_f,x)=>{x.receipt.proposals.push(clone(x.receipt.proposals[0]));return x;},
 'missing receipt target':(_f,x)=>{x.receipt.proposals[0].turnId='missing';return x;},
 'receipt current mismatch':(_f,x)=>{x.receipt.proposals[0].current='wrong';return x;},
 'receipt proposal mismatch':(_f,x)=>{x.receipt.proposals[0].proposal='Different English';return x;},
 'receipt foreign source':(_f,x)=>{x.receipt.sourceId='foreign';return x;},
 'receipt source hash':(_f,x)=>{x.receipt.sourceHash='0'.repeat(64);return x;},
 'tag foreign receipt':(_f,x)=>{x.history.at(-1).translationAcceptance.receiptSha256='0'.repeat(64);return x;},
 'tag extra key':(_f,x)=>{x.history.at(-1).translationAcceptance.other=true;return x;},
 'tag operation mismatch':(_f,x)=>{x.operations.at(-1).translationAcceptance.turnId='B';return x;},
 'missing history tag':(_f,x)=>{delete x.history.at(-1).translationAcceptance;return x;},
 'missing operation tag':(_f,x)=>{delete x.operations.at(-1).translationAcceptance;return x;},
 'context mismatch':(_f,x)=>{x.descriptor.expectedContextHash='0'.repeat(64);return x;},
 'current source change':(_f,x)=>{x.current.session.sourceHash='0'.repeat(64);return x;},
 'current unrelated text':(_f,x)=>{x.current.session.turns.at(-1).text='Unknown source edit';return x;},
 'current duplicate turns':(_f,x)=>{x.current.session.turns.push(clone(x.current.session.turns[0]));return x;},
 'missing history but committed operation':(_f,x)=>{x.history.pop();return x;},
 'unknown extra committed operation':(_f,x)=>{const o=clone(x.operations.at(-1));o.id='unlinked';o.result.operationId=o.id;x.operations.push(o);return x;}
};
for(const [name,tamper] of Object.entries(tamperCases))test('refuses '+name,()=>{const f=fixture(2);f.accept('A');const input=tamper(f,f.snapshot()),before=JSON.stringify({...input,projectSession:undefined}),result=deriveTranslationReviewLineage(input);assert.equal(result.classification,'earlier');assert.equal(result.currentSourceContext,undefined);assert.equal(result.readOnly,true);assert.equal(JSON.stringify({...input,projectSession:undefined}),before);});
for(const name of ['undo target','undo operation link','undo raw restore','undo canonical restore','undo eligibility','undoneBy mismatch'])test('refuses '+name,()=>{const f=fixture();f.accept('A');const b=f.accept('B');f.undo(b);const x=f.snapshot(),h=x.history.at(-1);if(name==='undo target')h.undoOf=x.history[1].operationId;if(name==='undo operation link')x.operations.at(-1).result.undoOf='foreign';if(name==='undo raw restore')h.afterRaw+='changed';if(name==='undo canonical restore')h.after.imported.identity='changed';if(name==='undo eligibility'){const extra=clone(x.history[1]);extra.operationId='intervening';x.history.splice(-1,0,extra);}if(name==='undoneBy mismatch')x.history[2].undoneBy='wrong';assert.equal(deriveTranslationReviewLineage(x).classification,'earlier');});
test('projection callback receives disposable clones and returned objects are deeply frozen',()=>{const f=fixture(2);f.accept('A');const input=f.snapshot(),before=JSON.stringify({...input,projectSession:undefined});input.projectSession=(rawSession,...args)=>{const result=projectSession(rawSession,...args);rawSession.imported.identity='callback mutation';return result;};const result=deriveTranslationReviewLineage(input);assert.equal(result.classification,'accepted-lineage');assert.equal(JSON.stringify({...input,projectSession:undefined}),before);assert.throws(()=>result.preparationContext.expectedRevision=900,TypeError);});
test('missing untouched target in receipt cannot manufacture a smaller approved batch',()=>{const f=fixture(3);f.accept('A');const x=f.snapshot();x.receipt.proposals.pop();assert.equal(deriveTranslationReviewLineage(x).classification,'earlier');});
test('baseline preserves the exact prior human Undo and all metadata, never just source words',()=>{const f=fixture(2);for(const mutate of [x=>delete x.current.session.undoOperationId,x=>x.current.session.turns[0].start++,x=>x.current.session.version++,x=>x.current.session.turns[0].originalText='Changed original']){const x=f.snapshot();mutate(x);const r=deriveTranslationReviewLineage(x);assert.equal(r.classification,'earlier');assert.equal(r.currentSourceContext,undefined);}});
for(const field of ['speaker','start','originalText','imported'])test('refuses internally consistent unauthorized '+field+' change alongside accepted text',()=>{const f=fixture(2);f.accept('A');const x=f.snapshot(),h=x.history.at(-1),op=x.operations.at(-1);if(field==='imported')h.after.imported.identity='foreign';else h.after.turns[0][field]=field==='start'?99:'Foreign metadata';h.afterRaw=raw(h.after);h.afterHash=hash(h.afterRaw);op.afterHash=h.afterHash;op.result.sourceHash=h.afterHash;x.current.session=projectSession(h.after,h.afterHash,op.id);assert.equal(deriveTranslationReviewLineage(x).classification,'earlier');});
test('missing intermediate acceptance cannot be bridged by final text/hash',()=>{const f=fixture();f.accept('A');f.accept('B');const x=f.snapshot();x.history.splice(1,1);assert.equal(deriveTranslationReviewLineage(x).classification,'earlier');});
test('unknown manual save and Undo after A remain earlier despite returning to A wording',()=>{const f=fixture();f.accept('A');const h=f.save('human','Unknown manual change');f.undo(h);assert.equal(deriveTranslationReviewLineage(f.snapshot()).classification,'earlier');});
test('restoring source bytes alone with changed prior Undo does not reset baseline',()=>{const f=fixture(),a=f.accept('A');f.undo(a);const x=f.snapshot();x.current.session.undoOperationId='other';assert.equal(deriveTranslationReviewLineage(x).classification,'earlier');});
test('malformed descriptors return bounded read-only results without exposing input objects',()=>{const x=deriveTranslationReviewLineage({descriptor:{sessionId:{private:'not a descriptor'}},receipt:{proposals:[{turnId:'A'}]}});assert.deepEqual(x,{classification:'earlier',readOnly:true,acceptedTurnIds:[],remainingTurnIds:['A'],preparationContext:null});assert.ok(Object.isFrozen(x));});
