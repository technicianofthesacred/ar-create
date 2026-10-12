import {guidanceRegions} from '../../../public/lib/guidance-body.js';
// Bounded browser adaptation of the original owned donor:
// splitBlocks, plain, editable and rebuild. No original file writer or log API.
// Added ordinary Markdown link/emphasis preservation and protected guidance
// preamble/queue boundaries; every untouched byte and separator is retained.
export function splitBlocks(md:string){const fm=(md.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)||[''])[0];return {fm,parts:md.slice(fm.length).split(/(\r?\n\s*\r?\n)/)};}
const protectedMarks=/%%[\s\S]*?%%|<!--[\s\S]*?-->/g;
export function plain(raw:string){return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g,'/$1/').replace(/\s*%%[\s\S]*?%%/g,'').replace(/<!--[\s\S]*?-->/g,'').replace(/^>\s?/gm,'').replace(/^#{1,6}\s+/,'').replace(/==([\s\S]*?)==/g,'$1').replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1').replace(/(?<!\w)_([^_\n]+)_(?!\w)/g,'$1').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'$1').replace(/`([^`]+)`/g,'$1').trim();}
export function editable(raw:string){const t=raw.trim();if(!t||t==='---'||/^%%[\s\S]*%%$/.test(t)||/^<!--[\s\S]*-->$/.test(t)||/^\|/.test(t)||/^```/.test(t)||/^~~~/.test(t))return false;if(/^[-*] /m.test(t)&&t.split('\n').every(line=>/^\s*([-*] |\d+\. )/.test(line)||/^\s+/.test(line)))return false;if(/^\d+[.)] /m.test(t))return false;if(/^\*\*[^*]+:\*\*\s*$/m.test(t.split('\n')[0]))return false;return true;}
export function rebuild(raw:string,text:string){
 const t=raw.trim().replace(/%%rework%%([\s\S]*?)%%\/rework%%/g,'$1'),notes=t.match(protectedMarks)||[],bare=t.replace(protectedMarks,'').trim();let s=text.trim().replace(/\r/g,'');
 // Donor behavior: only marks whose words survived are reattached, in place.
 const wrap=(word:string,wrapped:string)=>{const index=s.indexOf(word);if(index>=0)s=s.slice(0,index)+wrapped+s.slice(index+word.length);};
 for(const m of bare.matchAll(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g))wrap(m[2],`[[term:${m[1]}|${m[2]}]]`);
 for(const m of bare.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g))wrap(m[1],`[${m[1]}](${m[2]})`);
 for(const m of bare.matchAll(/\*\*([^*]+)\*\*/g))wrap(m[1],`**${m[1]}**`);
 for(const m of bare.matchAll(/__([^_]+)__/g))wrap(m[1],`__${m[1]}__`);
 for(const m of bare.matchAll(/(?<!\w)_([^_\n]+)_(?!\w)/g))wrap(m[1],`_${m[1]}_`);
 for(const m of bare.matchAll(/(?<!\*)\*([^*\n]+)\*(?!\*)/g))wrap(m[1],`*${m[1]}*`);
 for(const m of bare.matchAll(/`([^`]+)`/g))wrap(m[1],'`'+m[1]+'`');
 const head=bare.match(/^(#{1,6})\s+/);if(head)s=head[1]+' '+s.replace(/\n+/g,' ');else if(/^==[\s\S]*==$/.test(bare.replace(/^>\s?/gm,'')))s='=='+s+'==';if(bare.startsWith('>'))s=s.split('\n').map(line=>'> '+line).join('\n');
 return notes.length?s+' '+notes.join(' '):s;
}
export type MarkdownBlock={index:number;partIndex:number;raw:string;plain:string;editable:boolean};
export function documentParts(raw:string,protectGuidanceQueue=true){
 const projection=protectGuidanceQueue?guidanceRegions(raw):{prefix:splitBlocks(raw).fm,regions:[{raw:raw.slice(splitBlocks(raw).fm.length),pending:false}]};
 const parts:string[]=[],blocks:MarkdownBlock[]=[],separators=new Set<number>();
 for(const region of projection.regions){
  if(region.pending){parts.push(region.raw);continue;}
  const chunk=region.raw.split(/(\r?\n\s*\r?\n)/);
  for(let index=0;index<chunk.length;index++){
   const partIndex=parts.length,part=chunk[index];parts.push(part);
   if(index%2)separators.add(partIndex);
   else blocks.push({index:blocks.length,partIndex,raw:part,plain:plain(part),editable:editable(part)});
  }
 }
 if(!blocks.some(block=>block.raw.trim())&&blocks[0])blocks[0].editable=true;
 return {prefix:projection.prefix,suffix:'',parts,blocks,separators};
}
export class DocumentConflict extends Error {constructor(){super('This file changed since you started editing. Your words are still here; reload the saved file before retrying.');}}
export function editBlock(currentRaw:string,index:number,seenRaw:string,seenBlock:string,text:string,protectGuidanceQueue=true):string {
 if(currentRaw!==seenRaw)throw new DocumentConflict();const model=documentParts(currentRaw,protectGuidanceQueue),k=model.blocks[index]?.partIndex,raw=model.parts[k];if(raw===undefined||raw!==seenBlock)throw new DocumentConflict();if(!model.blocks[index]?.editable)throw new Error('This part is protected.');const next=text.replace(/\u00a0/g,' ').trim();if(next===plain(raw))return currentRaw;
 if(!next){const notes=raw.match(protectedMarks)||[];if(notes.length)model.parts[k]=notes.join('\n');else if(model.separators.has(k+1))model.parts.splice(k,2);else if(model.separators.has(k-1))model.parts.splice(k-1,2);else model.parts.splice(k,1);}else {const trimmed=raw.trim(),offset=raw.indexOf(trimmed),lineEnding=raw.includes('\r\n')?'\r\n':'\n';model.parts[k]=raw.slice(0,offset)+rebuild(raw,next.replace(/(^|[\s"'(])\/([^\/\n]+?)\/(?=$|[\s.,;:!?"')])/g,(_match,pre,segment)=>pre+'%%rework%%'+segment+'%%/rework%%')).replace(/\n/g,lineEnding)+raw.slice(offset+trimmed.length);}
 if(!raw&&next&&model.parts[k+1]&&!/^[\r\n]/.test(model.parts[k+1]))model.parts[k]+='\n\n';
 const accepted=model.parts.join('');return model.prefix+accepted+(model.suffix&&accepted&&!/\r?\n$/.test(accepted)?'\n\n':'')+model.suffix;
}
export function readableBlock(raw:string){return raw.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g,'/$1/').replace(protectedMarks,'').replace(/==([\s\S]*?)==/g,'**$1**').replace(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g,'$2');}
