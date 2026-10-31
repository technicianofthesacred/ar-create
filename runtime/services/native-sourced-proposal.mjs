// Pure validation only. Exact quotations establish traceability, not semantic truth.
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const fail=message=>{throw Object.assign(Error(message),{status:409});};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const readable=(value,max)=>typeof value==='string'&&!!value.trim()&&value.length<=max&&value.isWellFormed()&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const evidenceRoles=new Set(['source','transcript','author-page','context']);
function captured(context){
 if(!context||typeof context!=='object'||!Array.isArray(context.sources)||context.sources.length>100)fail('Use the exact prepared native source context.');
 const ids=new Set(),sources=context.sources.map(source=>{
  if(!source||!readable(source.id,1024)||ids.has(source.id)||!readable(source.role,128))fail('Captured source identities or roles are ambiguous.');ids.add(source.id);
  const text=source.raw??source.text;
  if(typeof text!=='string'||!text.isWellFormed()||!(/^[a-f0-9]{64}$/).test(source.hash||'')||digest(text)!==source.hash)fail('Captured source hash or bytes changed.');
  return {id:source.id,role:source.role,hash:source.hash,text};
 });
 if(sources.reduce((n,s)=>n+Buffer.byteLength(s.text),0)>4*1024*1024)fail('Captured sources exceed the bounded limit; none were truncated.');
 return {sources,contextHash:digest(stable(context))};
}
function plainParagraph(value){
 if(!readable(value,2048)||/[\r\n\u2028\u2029\x00-\x1f\[\]*_`<>=]/.test(value)||value.includes('%%'))fail('Claims require ordinary paragraph wording without structural markup.');
 if(/^\s*(?:#{1,6}\s|[-+>]\s|\d+[.)]\s|(?:-\s*){3,}$|[|])/u.test(value))fail('Claims require exact ordinary paragraph wording.');
 return value;
}
function normalize(candidate,context,{saved=false}={}){
 if(!exact(candidate,['claims','gaps'])||!Array.isArray(candidate.claims)||candidate.claims.length>20||!Array.isArray(candidate.gaps)||candidate.gaps.length>20||!candidate.claims.length&&!candidate.gaps.length)fail('Supply bounded sourced claims or explicit open questions.');
 const {sources,contextHash}=captured(context);
 const claims=candidate.claims.map(claim=>{
  if(!exact(claim,['text','citations'])||!Array.isArray(claim.citations)||!claim.citations.length||claim.citations.length>10)fail('Every claim needs exact captured source citations.');
  const text=plainParagraph(claim.text),citations=claim.citations.map(citation=>{
   if(!exact(citation,saved?['sourceId','sourceHash','start','end','quote','sourceRole']:['sourceId','quote']))fail('Use only the exact supported citation fields.');
   const source=sources.find(row=>row.id===citation.sourceId);
   if(!source||!evidenceRoles.has(source.role))fail('Unknown or non-evidence source role cannot support manuscript claims. Research, guidance and planning remain provisional.');
   const quote=citation.quote;
   if(!readable(quote,12000))fail('A source citation needs a readable exact quote.');
   let start=source.text.indexOf(quote);
   if(start<0||start!==source.text.lastIndexOf(quote))fail('A citation must match one unique exact captured quote.');
   const normalized={sourceId:source.id,sourceHash:source.hash,start,end:start+quote.length,quote,sourceRole:source.role};
   if(saved&&stable(citation)!==stable(normalized))fail('Saved citation locator, source role or hash changed.');
   return normalized;
  });
  return {text,citations};
 });
 const paragraph=claims.map(claim=>claim.text).join(' ');
 if(paragraph.length>8000)fail('Keep one proposed paragraph under 8,000 characters.');
 const gaps=candidate.gaps.map(gap=>{
  if(!exact(gap,['question','answerableBy'])||!readable(gap.question,2048)||gap.answerableBy!==null&&(!readable(gap.answerableBy,256)||!sources.some(source=>evidenceRoles.has(source.role)&&source.text.includes(gap.answerableBy))))fail('An open question needs an unknown respondent or an answerer named in captured evidence.');
  return {question:gap.question,answerableBy:gap.answerableBy};
 });
 return {sourcedParagraph:paragraph||null,sourcedEvidence:{schema:'ar-create.native-sourced-proposal.v1',contextHash,claims,gaps,traceabilityOnly:true}};
}
export function validateNativeSourcedResponse(candidate,context){return normalize(candidate,context);}
export function revalidateNativeSourcedProposal({payload,context}){
 if(!payload||!Object.hasOwn(payload,'sourcedParagraph')||!exact(payload.sourcedEvidence,['schema','contextHash','claims','gaps','traceabilityOnly']))fail('Saved sourced proposal envelope is unavailable.');
 const evidence=payload.sourcedEvidence,checked=normalize({claims:evidence.claims,gaps:evidence.gaps},context,{saved:true});
 if(stable(checked.sourcedEvidence)!==stable(evidence)||checked.sourcedParagraph!==payload.sourcedParagraph)fail('Saved source context, evidence or proposed paragraph changed.');
 return true;
}
