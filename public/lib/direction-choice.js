/** Managed decisions inside the existing human-direction Markdown authority. */
const START='<!-- ar-create:direction-choices:v1 -->';
const END='<!-- /ar-create:direction-choices:v1 -->';
const SCHEMA='ar-create.direction-choices.v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',');
const string=(v,max,blank=false)=>typeof v==='string'&&v.length<=max&&(blank||!!v.trim())&&!/[\x00-\x1f\x7f]/.test(v);
export function directionDecisionTargetKey(target){
 if(keys(target,['kind','bindingId'])&&target.kind==='native'&&UUID.test(target.bindingId))return 'native:'+target.bindingId;
 if(keys(target,['kind','outputId'])&&target.kind==='output'&&string(target.outputId,256))return 'output:'+target.outputId;
 throw Error('An exact native or output decision target is required.');
}
function validEvent(e){
 const legacy=['operationId','kind','action','optionId','text','reason','source'],modern=['actor','decisionRole','at','targetFingerprint'];
 if(!e||!UUID.test(e.operationId||'')||!['angle','title'].includes(e.kind))return false;
 const updated=Object.hasOwn(e,'actor')||Object.hasOwn(e,'target');
 const optional=['target','basis','preparedText'].filter(key=>Object.hasOwn(e,key));
 if(!keys(e,updated?[...legacy,...modern,...optional]:legacy))return false;
 if(updated){
  if(!string(e.actor,100)||!['human','stand-in'].includes(e.decisionRole)||e.decisionRole==='human'&&e.actor!=='human:adrian'||e.decisionRole==='stand-in'&&!/^agent:[a-z0-9-]+$/.test(e.actor)||typeof e.at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(e.at)||!Number.isFinite(Date.parse(e.at))||!HASH.test(e.targetFingerprint||''))return false;
  if(e.target){try{directionDecisionTargetKey(e.target);}catch{return false;}}
 }
 if(['inherit','not-applicable'].includes(e.action))return updated&&!!e.target&&e.optionId===null&&e.text===null&&e.source===null&&string(e.reason,2048,true)&&keys(e.basis,['subjectOperationId','revision','hash'])&&(e.basis.subjectOperationId===null||UUID.test(e.basis.subjectOperationId))&&Number.isSafeInteger(e.basis.revision)&&e.basis.revision>=0&&HASH.test(e.basis.hash||'')&&!Object.hasOwn(e,'preparedText');
 return ['use','reject'].includes(e.action)&&!Object.hasOwn(e,'basis')&&new RegExp('^'+e.kind+':[1-9][0-9]{0,3}$').test(e.optionId)&&string(e.text,2048)&&string(e.reason,2048,e.action==='use')&&keys(e.source,['artifactId','hash'])&&string(e.source.artifactId,512)&&HASH.test(e.source.hash)&&(!Object.hasOwn(e,'preparedText')||updated&&e.decisionRole==='human'&&string(e.preparedText,2048));
}
function section(body){
 if(!body.includes(START)&&!body.includes(END))return null;
 const start=body.indexOf(START),end=body.indexOf(END);
 if(start<0||end<start||body.split(START).length!==2||body.split(END).length!==2)throw Error('Direction choices need review; saved wording is preserved.');
 const text=body.slice(start+START.length,end),match=text.match(/^\n```json\n([\s\S]*)\n```\n$/);let value;
 try{value=match&&JSON.parse(match[1]);}catch{}
 if(!keys(value,['schema','events'])||value.schema!==SCHEMA||!Array.isArray(value.events)||value.events.length>2000||!value.events.every(validEvent)||new Set(value.events.map(e=>e.operationId)).size!==value.events.length)throw Error('Direction choices need review; saved wording is preserved.');
 return {start,end:end+END.length,events:value.events};
}
export function readDirectionChoices(body){
 try{const events=section(body)?.events||[],selected={angle:null,title:null},subjectDecisions={angle:null,title:null},pieceDecisions={};
  const sameOption=(a,b)=>a?.optionId===b.optionId&&a?.source?.artifactId===b.source?.artifactId&&a?.source?.hash===b.source?.hash;
  for(const e of events){
   if(e.target){const key=directionDecisionTargetKey(e.target),piece=pieceDecisions[key]||={target:e.target,angle:null,title:null,rejections:[],events:[]};piece.events.push(e);if(e.action==='reject'){piece.rejections.push(e);if(sameOption(piece[e.kind],e))piece[e.kind]=e;}else piece[e.kind]=e;continue;}
   if(e.action==='use'){selected[e.kind]=e;subjectDecisions[e.kind]=e;}else if(sameOption(selected[e.kind],e)){selected[e.kind]=null;subjectDecisions[e.kind]=e;}
  }
  return {available:true,events,selectedAngle:selected.angle,selectedTitle:selected.title,subjectDecisions,pieceDecisions,rejections:events.filter(e=>!e.target&&e.action==='reject')};
 }catch(error){return {available:false,events:[],selectedAngle:null,selectedTitle:null,subjectDecisions:{angle:null,title:null},pieceDecisions:{},rejections:[],reason:error.message};}
}
/** Resolve only the explicitly identified piece. Retained history remains data;
 * it never makes a sibling choice or an outdated inheritance applicable. */
export function effectiveDirectionChoices(bodyOrChoices,{parentStudyId,bindingId,outputId}={}){
 const choices=typeof bodyOrChoices==='string'?readDirectionChoices(bodyOrChoices):bodyOrChoices;
 const targets=[];if(outputId!==undefined)targets.push({kind:'output',outputId});if(bindingId!==undefined)targets.push({kind:'native',bindingId});
 const target=targets[0]||{kind:'subject'},key=targets.length?directionDecisionTargetKey(target):'subject';
 const scope={...target,key,...(parentStudyId!==undefined?{parentStudyId}:{}),...(outputId!==undefined&&bindingId!==undefined?{nativeBindingId:bindingId}:{})};
 const unavailable={state:'review-needed',action:null,value:null,event:null,origin:null};
 if(!choices?.available)return {role:'effective-scoped-direction-not-evidence-or-wording-approval',available:false,scope,angle:{...unavailable},title:{...unavailable},reason:choices?.reason||'Saved choices are unavailable.'};
 function resolve(kind){
  const selected=choices[kind==='angle'?'selectedAngle':'selectedTitle'],subject=choices.subjectDecisions?.[kind]||selected;let event=null,origin='subject';
  for(const t of targets){const candidate=choices.pieceDecisions?.[directionDecisionTargetKey(t)]?.[kind];if(candidate){event=candidate;origin=directionDecisionTargetKey(t);break;}}
  if(!event)return {state:selected?'chosen':subject?.action==='reject'?'rejected':'not-chosen',action:selected?'use':subject?.action||null,value:selected?.text||null,event:subject||null,origin};
  if(['inherit','not-applicable'].includes(event.action)&&event.basis?.subjectOperationId!==(selected?.operationId||null))return {state:'review-needed',action:event.action,value:null,event,origin,reason:'The saved subject choice changed after this piece decision.'};
  if(event.action==='inherit')return {state:selected?'chosen':'not-chosen',action:'inherit',value:selected?.text||null,event,origin,subjectEvent:selected||null};
  return {state:event.action==='use'?'chosen':event.action==='reject'?'rejected':'not-applicable',action:event.action,value:event.action==='use'?event.text:null,event,origin};
 }
 return {role:'effective-scoped-direction-not-evidence-or-wording-approval',available:true,scope,angle:resolve('angle'),title:resolve('title')};
}
export function stripDirectionChoices(body){const s=section(body);if(!s)return body;const start=s.start>=2&&body.slice(s.start-2,s.start)==='\n\n'?s.start-2:s.start;return body.slice(0,start)+body.slice(s.end);}
export function applyDirectionChoice(body,event){
 if(!validEvent(event))throw Error('An exact angle or title choice and rejection reason are required.');
 const s=section(body),events=s?.events||[];if(events.some(e=>e.operationId===event.operationId))throw Error('Direction choice operation already exists.');if(events.length>=2000)throw Error('Direction choice history is full.');
 const block=START+'\n```json\n'+JSON.stringify({schema:SCHEMA,events:[...events,event]},null,2)+'\n```\n'+END;
 return s?body.slice(0,s.start)+block+body.slice(s.end):body+'\n\n'+block;
}
const unformat=text=>text.trim().replace(/^\*\*([\s\S]*)\*\*$/,'$1').replace(/^__([\s\S]*)__$/,'$1').replace(/\\([*_`])/g,'$1').trim();
/** Read generic prepared Markdown without modifying its artifact or inventing decisions. */
export function parsePreparedDirections(raw,source){
 const result={angles:[],titles:[],source:{artifactId:source?.artifactId,hash:source?.hash}};
 if(typeof raw!=='string'||!string(source?.artifactId,512)||!HASH.test(source?.hash||''))return result;
 let mode=null,current=null;
 for(const line of raw.split(/\r?\n/)){
  if(/^##\s+/.test(line)){mode=/^##\s+Pick a direction\s*$/i.test(line)?'angle':/^##\s+Pick a title\s*$/i.test(line)?'title':null;current=null;continue;}
  if(!mode)continue;
  let match=mode==='angle'?line.match(/^\s*\*\*(\d+)\.\s+(.+?)\*\*\s*(.*)$/):line.match(/^\s*(\d+)\.\s+(.+)$/);
  if(mode==='angle'&&!match){const plain=line.match(/^\s*(\d+)\.\s+(.+)$/);if(plain)match=[plain[0],plain[1],plain[2],''];}
  if(match){const id=mode+':'+match[1],text=unformat(match[2]);if(!text||!new RegExp('^'+mode+':[1-9][0-9]{0,3}$').test(id))continue;const list=mode==='angle'?result.angles:result.titles;if(list.some(e=>e.id===id))continue;current={id,text,...(mode==='angle'?{description:match[3]||''}:{})};list.push(current);}
  else if(mode==='angle'&&current)current.description+=(current.description?'\n':'')+line;
 }
 for(const angle of result.angles)angle.description=angle.description.trim();return result;
}
