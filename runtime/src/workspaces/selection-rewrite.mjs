// Positions use ProseMirror's UTF-16 offsets, relative to the saved passage doc.
const protectedMarks=new Set(['link','sourced','inlineQuote','paraphrase']);
const protectedNodes=new Set(['blockquoteAttributed','referenceCard']);
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
const size=node=>node.type==='text'?node.text.length:node.type==='hardBreak'?1:2+(node.content||[]).reduce((n,c)=>n+size(c),0);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function locate(doc,from,to){
 let found;
 function walk(node,start,path,protectedParent=false){
  const locked=protectedParent||protectedNodes.has(node.type);
  if(['paragraph','heading','blockquoteAttributed'].includes(node.type)&&from>=start+1&&to<=start+size(node)-1)found={node,start,path,locked};
  let offset=node.type==='doc'?0:start+1;
  for(const [index,child] of (node.content||[]).entries()){if(child.type!=='text'&&child.type!=='hardBreak')walk(child,offset,[...path,index],locked);offset+=size(child);}
 }
 walk(doc,-1,[]);return found;
}
export function captureSelection(doc,range){
 if(!range||!Number.isSafeInteger(range.from)||!Number.isSafeInteger(range.to)||range.from<0||range.to<=range.from||typeof range.text!=='string')fail('Select some accepted words to rewrite.');
 const block=locate(doc,range.from,range.to);
 if(!block)fail('Select words within one paragraph or heading.');
 if(block.locked)fail('Attributed quotes and references must remain unchanged. Select your own prose.');
 let position=block.start+1,text='',marks;const runs=[];
 for(const child of block.node.content||[]){
  const end=position+size(child);
  if(position<range.to&&end>range.from){
   if(child.type!=='text')fail('Select text without a line break.');
   if(child.marks?.some(mark=>protectedMarks.has(mark.type)))fail('Source wording and links must remain unchanged. Select your own prose.');
   const next=child.marks||[];
   const part=child.text.slice(Math.max(0,range.from-position),Math.min(child.text.length,range.to-position));
   const previous=runs.at(-1);if(previous&&same(previous.marks,next))previous.text+=part;else runs.push({text:part,marks:structuredClone(next)});
   marks=next;text+=part;
  }
  position=end;
 }
 if(text!==range.text)fail('The selected words changed. Select the current text again.');
 // Avoid bisecting a UTF-16 surrogate pair, which ProseMirror positions otherwise allow.
 if(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(text))fail('Select complete characters to rewrite.');
 return {from:range.from,to:range.to,text,marks:runs.length>1?[]:structuredClone(marks||[]),blockPath:block.path,...(runs.length>1?{runs}:{})};
}
export function replaceSelection(doc,selection,replacement){
 const captured=captureSelection(doc,selection);
 if(selection.marks&&!same(selection.marks,captured.marks)||selection.runs&&!same(selection.runs,captured.runs)||selection.blockPath&&!same(selection.blockPath,captured.blockPath))fail('The selected formatting changed. Select the current text again.');
 const parts=captured.runs?replacement:[replacement],runs=captured.runs||[{text:captured.text,marks:captured.marks}];
 if(!Array.isArray(parts)||parts.length!==runs.length||parts.some(part=>typeof part!=='string'||!part.length||/[\x00-\x1f\x7f]/.test(part))||!parts.join('').trim()||parts.join('').length>256*1024)fail('The rewrite must contain one nonempty plain-text part per formatting run, on one line.');
 const result=structuredClone(doc);let block=result;
 for(const index of captured.blockPath)block=block.content[index];
 const original=locate(doc,captured.from,captured.to);let position=original.start+1,inserted=false;const content=[];
 for(const child of block.content||[]){
  const end=position+size(child);
  if(position>=captured.to||end<=captured.from)content.push(child);
  else{
   const prefix=child.text.slice(0,Math.max(0,captured.from-position));
   const suffix=child.text.slice(Math.min(child.text.length,captured.to-position));
   if(prefix)content.push({...child,text:prefix});
   if(!inserted){for(const [index,part] of parts.entries())content.push({type:'text',text:part,...(runs[index].marks.length?{marks:structuredClone(runs[index].marks)}:{})});inserted=true;}
   if(suffix)content.push({...child,text:suffix});
  }
  position=end;
 }
 // Match ProseMirror's canonical adjacent text-node merging.
 block.content=content.reduce((out,node)=>{const previous=out.at(-1);if(previous?.type==='text'&&node.type==='text'&&same(previous.marks||[],node.marks||[]))previous.text+=node.text;else out.push(node);return out;},[]);
 return result;
}
export function validateSelectionCandidate(doc,selection,replacement,candidate){
 const expected=replaceSelection(doc,selection,replacement);
 if(!same(expected,candidate))fail('The rewrite changed content or formatting outside the selected words.');
 return expected;
}
