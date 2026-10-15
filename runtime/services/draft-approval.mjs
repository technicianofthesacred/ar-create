import {createHash} from 'node:crypto';
import {approvalMarks,approveMarkedProse} from '../src/workspaces/editorial-state.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
// Keep UTF-16 offsets aligned with exact native raw. These are identities/literals,
// not ordinary connecting prose: editorial notes, code, terms and link targets.
const protectedParts=/%%rework%%[\s\S]*?%%\/rework%%|%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`|\[\[term:[^\]]+\]\]|\]\([^\n)]*\)/g;
const fail=message=>{throw Error(message);};
export function exactApprovalSpans(raw){
 if(typeof raw!=='string'||!raw.isWellFormed())return [];
 const t=raw.trim();if(!t||/^(?:\||```|~~~|<| {4}|\t)/.test(t))return [];
 const marks=approvalMarks(raw);if(marks.tokens!==marks.pairs*2)return [];
 const masked=raw.replace(protectedParts,p=>p.replace(/[^\r\n]/g,'\0')),spans=[];
 for(const match of masked.matchAll(/==(?=\S)([\s\S]*?\S)==/g)){
  const rawFrom=match.index,rawTo=rawFrom+match[0].length,markup=raw.slice(rawFrom,rawTo),inner=markup.slice(2,-2);
  if(raw[rawFrom-1]==='='||raw[rawTo]==='='||inner.startsWith('=')||inner.endsWith('=')||!match[1].replaceAll('\0','').trim())continue;
  const selected=approvalMarks(markup);if(selected.pairs!==1||selected.tokens!==2)continue;
  let approved;try{approved=approveMarkedProse(markup);}catch{continue;}
  if(approved!==inner)continue;
  spans.push({rawFrom,rawTo,seenMarkupHash:hash(markup)});
 }
 return spans;
}
export function approveExactSpan(raw,operation){
 if(operation.humanDecision!==true)fail('Explicit human approval decision required.');
 if(!Number.isSafeInteger(operation.rawFrom)||!Number.isSafeInteger(operation.rawTo)||operation.rawFrom<0||operation.rawTo<=operation.rawFrom||typeof operation.seenMarkupHash!=='string'||!/^[a-f0-9]{64}$/.test(operation.seenMarkupHash))fail('Exact native markup span/hash required.');
 const span=exactApprovalSpans(raw).find(s=>s.rawFrom===operation.rawFrom&&s.rawTo===operation.rawTo&&s.seenMarkupHash===operation.seenMarkupHash);
 if(!span)fail('Approval span changed, is incomplete, protected or ambiguous; preserve source bytes.');
 // Only four delimiter bytes are removed; every inner/outside byte is retained.
 const changed=raw.slice(0,span.rawFrom)+raw.slice(span.rawFrom+2,span.rawTo-2)+raw.slice(span.rawTo);
 if(approveMarkedProse(raw)!==approveMarkedProse(changed))fail('Approval changed more than the selected canonical delimiters.');
 return changed;
}
