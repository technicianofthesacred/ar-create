/* Read-only subject Direction choices. HUMAN-DIRECTION.md remains the sole owner. */
import {readDirectionChoices} from '../lib/direction-choice.js';
const HASH=/^[a-f0-9]{64}$/i,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const rooms=new Map();
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function invalidate(id){if(id){const old=rooms.get(id);old?.abort.abort();rooms.delete(id);}else{for(const r of rooms.values())r.abort.abort();rooms.clear();}}
async function read(parentStudyId,{fresh=false}={}){
 if(typeof parentStudyId!=='string'||!parentStudyId)throw Error('Choose a subject first.');
 if(fresh)invalidate(parentStudyId);
 if(rooms.has(parentStudyId))return rooms.get(parentStudyId).pending;
 const abort=new AbortController(),room={abort};rooms.set(parentStudyId,room);
 room.pending=(async()=>{
  const response=await fetch('/api/study/human-direction?'+new URLSearchParams({parentStudyId,scope:'project'}),{method:'GET',cache:'no-store',signal:abort.signal}),record=await response.json();
  if(abort.signal.aborted||rooms.get(parentStudyId)!==room)throw Error('The saved direction changed.');
  if(!response.ok)throw Error(record.error||'Saved direction could not be read.');
  if(record.bound!==true||record.scope?.kind!=='project'||record.scope.parentStudyId!==parentStudyId||!UUID.test(record.scope.projectId||'')||!HASH.test(record.hash||'')||!Number.isSafeInteger(record.revision)||record.revision<0||typeof record.body!=='string'||record.externalEdit)throw Error('The saved direction could not be confirmed for this subject.');
  const choices=readDirectionChoices(record.body);
  if(!choices.available)throw Error(choices.reason||'Saved choices could not be read.');
  return {...choices,parentStudyId,projectId:record.scope.projectId,hash:record.hash,revision:record.revision};
 })().catch(error=>{if(rooms.get(parentStudyId)===room)rooms.delete(parentStudyId);throw error;});
 return room.pending;
}
function currentTarget(parentStudyId){const p=typeof current==='function'?current():null;if(p?.id!==parentStudyId)return null;const s=window.studyOutputConnection?.selection?.();if(Number(p.viewedStage)===9&&s?.projectId===parentStudyId&&s.output?.id)return {kind:'output',outputId:s.output.id};const b=window.studyDraft?.currentBinding?.();return b?.parentStudyId===parentStudyId&&b.id?{kind:'native',bindingId:b.id}:null;}
function resolve(value,target){const key=target?.kind==='native'&&target.bindingId?'native:'+target.bindingId:target?.kind==='output'&&target.outputId?'output:'+target.outputId:null,local=key?value?.pieceDecisions?.[key]:null,result={target};for(const kind of ['angle','title']){const event=local?.[kind],mode=event?.action||'inherit',subject=kind==='angle'?value?.selectedAngle:value?.selectedTitle;const needsReview=event?.action==='inherit'&&event.basis?.subjectOperationId!==(subject?.operationId||null);result[kind]={mode:needsReview?'review-needed':target?mode:'subject',choice:needsReview?null:mode==='use'?event:mode==='inherit'?subject:null,event};}return result;}
function render(host,value,{rejections=false,target=currentTarget(value.parentStudyId)}={}){
 host.replaceChildren();host.classList.remove('direction-choice-unavailable');
 const line=el('p');line.className='direction-choice-line';const effective=resolve(value,target);
 line.append(el('strong',target?'Piece direction · ':'Subject direction · '));for(const [index,kind]of ['angle','title'].entries()){const item=effective[kind],text=item.mode==='review-needed'?'Review needed':item.mode==='not-applicable'?'Not applicable':item.mode==='reject'?'No choice · rejected':item.choice?.text||'No '+kind+' chosen';line.append(el('span',(index?' · Title: ':'')+text+(target?' · '+(item.mode==='use'?'This piece':item.mode==='inherit'?'Inherited':item.mode==='not-applicable'?'Not applicable':item.mode==='review-needed'?'Subject changed':'Pending'):'')));if(item.event?.actor)line.append(el('small',' · '+item.event.actor+(item.event.decisionRole==='stand-in'?' · stand-in':'')));}host.append(line);
 if(rejections){const title=el('h3','Rejected angles');host.append(title);const rows=(value.rejections||[]).filter(row=>row.kind==='angle');if(!rows.length)host.append(el('p','No rejected angles saved for this subject.'));for(const row of rows){const entry=el('div');entry.className='direction-choice-rejection';entry.append(el('p',row.text));if(row.reason)entry.append(el('p',row.reason));host.append(entry);}}
}
function unavailable(host){host.replaceChildren(el('span','Subject direction · not connected'));host.classList.add('direction-choice-unavailable');}
function selection(){const p=typeof current==='function'?current():null,s=window.studyOutputConnection?.selection?.(),b=window.studyDraft?.currentBinding?.();return {p,signature:JSON.stringify([p?.id,p?.viewedStage,p?.view,s?.projectId,s?.rootBindingId,s?.output?.id,b?.id,b?.parentStudyId])};}
let epoch=0;
async function decorate(){
 const snapshot=selection(),p=snapshot.p,ticket=++epoch;
 const existing=document.querySelector('[data-direction-choice-context]');
 if(!p||!p.viewedStage){existing?.remove();return;}
 const hostParent=document.querySelector('#c3-surface-bar');if(!hostParent)return;
 let host=existing;if(!host||host.parentElement!==hostParent){host?.remove();host=el('div');host.dataset.directionChoiceContext='';host.className='direction-choice-context';hostParent.append(host);}
 if(host.dataset.choiceSignature!==snapshot.signature){host.dataset.choiceSignature=snapshot.signature;host.replaceChildren(el('span','Subject direction · reading…'));}
 try{const value=await read(p.id);if(ticket!==epoch||selection().signature!==snapshot.signature||!host.isConnected)return;render(host,value);}catch{if(ticket===epoch&&selection().signature===snapshot.signature&&host.isConnected)unavailable(host);}
}
window.directionChoiceContext={read,render,resolve,invalidate,decorate};
for(const name of ['study-direction-choice-change','study-human-direction-change','ar-live-change'])window.addEventListener(name,event=>{invalidate(event.detail?.parentStudyId||event.detail?.projectId);void decorate();});
for(const name of ['study-output-selection','study-draft-change'])window.addEventListener(name,()=>void decorate());
window.c3Shell?.register('saved subject Direction context',()=>void decorate(),{order:99,ignore:'[data-direction-choice-context]'});
void decorate();
