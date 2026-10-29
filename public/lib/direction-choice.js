/** Managed decisions inside the existing human-direction Markdown authority. */
const START='<!-- ar-create:direction-choices:v1 -->';
const END='<!-- /ar-create:direction-choices:v1 -->';
const SCHEMA='ar-create.direction-choices.v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',');
const string=(v,max,blank=false)=>typeof v==='string'&&v.length<=max&&(blank||!!v.trim())&&!/[\x00-\x1f\x7f]/.test(v);
function validEvent(e){return keys(e,['operationId','kind','action','optionId','text','reason','source'])&&UUID.test(e.operationId)&&['angle','title'].includes(e.kind)&&['use','reject'].includes(e.action)&&new RegExp('^'+e.kind+':[1-9][0-9]{0,3}$').test(e.optionId)&&string(e.text,2048)&&string(e.reason,2048,e.action==='use')&&keys(e.source,['artifactId','hash'])&&string(e.source.artifactId,512)&&HASH.test(e.source.hash);}
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
 try{const events=section(body)?.events||[],selected={angle:null,title:null};
  for(const e of events){if(e.action==='use')selected[e.kind]=e;else if(selected[e.kind]?.optionId===e.optionId&&selected[e.kind]?.source.artifactId===e.source.artifactId&&selected[e.kind]?.source.hash===e.source.hash)selected[e.kind]=null;}
  return {available:true,events,selectedAngle:selected.angle,selectedTitle:selected.title,rejections:events.filter(e=>e.action==='reject')};
 }catch(error){return {available:false,events:[],selectedAngle:null,selectedTitle:null,rejections:[],reason:error.message};}
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
