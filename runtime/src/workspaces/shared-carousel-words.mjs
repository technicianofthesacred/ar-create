// Owned carousel words, not the legacy /arcreate new-output import grammar.
// Parsing produces a candidate only. The caller owns acceptance, persistence,
// review invalidation and outputRevision. No layout or source fields are read
// from Markdown, and stable slide IDs keep those fields attached when reordered.
export const CAROUSEL_WORDS_SCHEMA = 'ar-create.carousel-words.v1';
export const CAROUSEL_WORDS_LIMITS = Object.freeze({maxBytes:1024*1024,maxSlides:40,maxFieldCharacters:20000,maxIdentityCharacters:240});
const bytes = value => new TextEncoder().encode(value);
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const slidesOf = output => own(output,'slides')?output.slides:[];
const fail = message => {throw new Error(message+' No carousel changes were applied.');};
function wellFormed(value) {
 // TextEncoder replaces lone UTF-16 surrogates. Refuse before hashing or
 // writing UTF-8 so a physical file cannot silently change stored wording.
 for(let index=0;index<value.length;index++){
  const unit=value.charCodeAt(index);
  if(unit>=0xd800&&unit<=0xdbff){
   const next=value.charCodeAt(++index);
   if(!(next>=0xdc00&&next<=0xdfff))fail('Ill-formed Unicode: a lone surrogate cannot be written losslessly.');
  }else if(unit>=0xdc00&&unit<=0xdfff)fail('Ill-formed Unicode: a lone surrogate cannot be written losslessly.');
 }
 return value;
}
function identity(value,name) {
 if(typeof value!=='string'||!value||value.length>CAROUSEL_WORDS_LIMITS.maxIdentityCharacters||/[\u0000-\u001f\u007f]/.test(value))fail('Invalid '+name+' identity.');
 return wellFormed(value);
}
function words(value,name,optional=false) {
 if(optional&&value==null)return '';
 if(typeof value!=='string')fail('The '+name+' must be a string.');
 if(value.length>CAROUSEL_WORDS_LIMITS.maxFieldCharacters)fail('The '+name+' exceeds the supported length limit.');
 return wellFormed(value);
}
function role(value) {
 if(typeof value!=='string'||value.length>240||/[\u0000-\u001f\u007f]/.test(value))fail('The slide role must be a string of at most 240 characters.');
 return wellFormed(value);
}
function effectiveLabel(output,slide) {
 return words(slide.label??output.importedDraft?.label??output.title??'','small heading');
}
function validateOutput(output) {
 if(!output||output.kind!=='carousel')fail('Choose an existing carousel output.');
 identity(output.id,'output');
 // Existing legacy placeholders may be empty or omit slides entirely. This
 // codec preserves either stored shape; a present non-array remains invalid.
 // New-output validation remains separate.
 const slides=slidesOf(output);
 if(!Array.isArray(slides)||slides.length>CAROUSEL_WORDS_LIMITS.maxSlides)fail('An existing carousel must have 0–40 slides.');
 const ids=new Set();
 for(const slide of slides){
  if(!slide||typeof slide!=='object')fail('Invalid existing slide identity.');
  identity(slide.id,'slide');if(ids.has(slide.id))fail('Duplicate existing slide identity '+slide.id+'.');ids.add(slide.id);
  role(slide.role??'');words(slide.text,'slide text');words(slide.credit,'slide credit',true);
  if(slide.label!=null)words(slide.label,'slide label');effectiveLabel(output,slide);
 }
 words(output.caption,'caption',true);
}
// Effective headings are included because an absent label still prints the
// inherited label on the actual slide. This manifest is separate from the
// existing legacy receipt; callers must not substitute its hash for that hash.
export function carouselWordsManifest(projectId,documentId,output) {
 identity(projectId,'project');identity(documentId,'document');validateOutput(output);
 return {schema:CAROUSEL_WORDS_SCHEMA,projectId,documentId,outputId:output.id,outputRevision:output.outputRevision??0,words:verbalRecord(output)};
}
function verbalRecord(output) {
 return {slides:slidesOf(output).map(slide=>({id:slide.id,role:slide.role??'',text:slide.text,credit:slide.credit??'',label:effectiveLabel(output,slide),labelMode:slide.label==null?'inherited':'explicit'})),caption:output.caption??''};
}
export async function sharedCarouselWordsHash(output) {
 validateOutput(output);
 const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes(JSON.stringify(verbalRecord(output))));
 return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}
function metadata(tag,value) {
 // A JSON string containing '-->' cannot terminate its hidden Markdown anchor.
 return '<!-- '+tag+':'+JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')+' -->\n';
}
function block(heading,value) {
 const runs=value.match(/`+/g)||[],fence='`'.repeat(Math.max(3,...runs.map(run=>run.length+1)));
 // Exactly one framing newline is removed on parse. Value's own final newline,
 // or its absence, remains exact, including an entirely empty value.
 return '### '+heading+'\n'+fence+'text\n'+value+'\n'+fence+'\n\n';
}
export function renderCarouselWords(projectId,documentId,output) {
 const manifest=carouselWordsManifest(projectId,documentId,output);
 let raw=metadata('ar-carousel-words',{schema:manifest.schema,projectId,documentId,outputId:output.id})+'# Carousel words\n\n';
 for(const slide of slidesOf(output)){
  raw+='## Slide\n'+metadata('ar-carousel-slide',{id:slide.id,role:slide.role??'',labelMode:slide.label==null?'inherited':'explicit'})+'\n';
  raw+=block('Words',slide.text)+block('Small heading',effectiveLabel(output,slide))+block('Credit',slide.credit??'');
 }
 raw+='## Caption\n\n'+block('Caption',output.caption??'')+'<!-- ar-carousel-end -->\n';
 if(bytes(raw).length>CAROUSEL_WORDS_LIMITS.maxBytes)fail('The carousel Markdown exceeds the 1 MB size limit.');
 return raw;
}

// Parse a flat map of JSON strings explicitly: JSON.parse alone would accept
// duplicate identity keys by silently keeping only the last value.
function flatMetadata(raw,tag,keys) {
 if(raw.length>16384)fail('Carousel metadata exceeds its length limit.');
 const prefix='<!-- '+tag+':';
 if(!raw.startsWith(prefix)||!raw.endsWith(' -->'))fail('Missing or malformed '+(tag==='ar-carousel-words'?'version header':'slide identity anchor')+'.');
 const json=raw.slice(prefix.length,-4),result={},token=/\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*/y;
 if(json[0]!=='{'||json.at(-1)!=='}')fail('Malformed carousel metadata structure.');
 let cursor=1;
 while(cursor<json.length-1){
  token.lastIndex=cursor;const match=token.exec(json);if(!match)fail('Malformed carousel metadata fields.');
  let key,value;try{key=JSON.parse(match[1]);value=JSON.parse(match[2]);}catch{fail('Malformed carousel metadata fields.');}
  if(!keys.includes(key)||own(result,key))fail('Unknown or duplicate carousel metadata field '+key+'.');
  result[key]=value;cursor=token.lastIndex;
  if(cursor===json.length-1)break;
  if(json[cursor]!==','||cursor+1===json.length-1)fail('Malformed carousel metadata fields.');cursor++;
 }
 if(keys.some(key=>!own(result,key)))fail('Missing carousel metadata field.');
 return result;
}
export function parseCarouselWords(raw,{projectId,documentId,output}={}) {
 if(typeof raw!=='string')fail('Carousel Markdown must be a string.');
 wellFormed(raw);
 if(bytes(raw).length>CAROUSEL_WORDS_LIMITS.maxBytes)fail('The carousel Markdown exceeds the 1 MB size limit.');
 if(raw.startsWith('\uFEFF'))fail('A file BOM is not supported in the carousel version header. Save UTF-8 without a BOM.');
 identity(projectId,'project');identity(documentId,'document');validateOutput(output);
 let cursor=0;
 const line=()=>{const end=raw.indexOf('\n',cursor);if(end===-1)fail('Malformed carousel structure: a required line ending is missing.');const value=raw.slice(cursor,end);cursor=end+1;if(value.endsWith('\r'))fail('Structural line endings must use LF; CRLF in the carousel structure is not supported. Carriage returns inside text blocks remain literal.');return value;};
 const expect=value=>{if(line()!==value)fail('Unexpected carousel structure; expected '+value+'.');};
 const blank=()=>{while(raw[cursor]==='\n')cursor++;};
 const header=flatMetadata(line(),'ar-carousel-words',['schema','projectId','documentId','outputId']);
 if(header.schema!==CAROUSEL_WORDS_SCHEMA)fail('Unsupported carousel words schema version.');
 if(header.projectId!==projectId||header.documentId!==documentId||header.outputId!==output.id)fail('This carousel identity belongs to another project, document or output.');
 expect('# Carousel words');blank();
 const readBlock=heading=>{
  expect('### '+heading);const opening=line(),match=opening.match(/^(`{3,})text$/);
  if(!match)fail('Malformed '+heading+' text block: use its text fence.');
  const closing='\n'+match[1]+'\n',end=raw.indexOf(closing,cursor);
  if(end===-1)fail('Malformed '+heading+' text block: its closing fence is missing.');
  const value=raw.slice(cursor,end);cursor=end+closing.length;blank();return words(value,heading);
 };
 const originalSlides=slidesOf(output),baseline=new Map(originalSlides.map(slide=>[slide.id,slide])),seen=new Set(),slides=[],changedSlideIds=[];
 while(raw.startsWith('## Slide\n',cursor)){
  expect('## Slide');const meta=flatMetadata(line(),'ar-carousel-slide',['id','role','labelMode']);blank();
  identity(meta.id,'slide');if(seen.has(meta.id))fail('Duplicate slide identity '+meta.id+'.');
  const original=baseline.get(meta.id);if(!original)fail('Unknown slide identity '+meta.id+'. Adding slides is not supported by this words file.');
  seen.add(meta.id);role(meta.role);
  if(meta.labelMode!==(original.label==null?'inherited':'explicit'))fail('The small heading label mode was changed. Edit its heading text instead.');
  const text=readBlock('Words'),label=readBlock('Small heading'),credit=readBlock('Credit');
  const next=structuredClone(original);next.text=text;
  if(meta.role!==(original.role??''))next.role=meta.role;
  if(credit!==(original.credit??''))next.credit=credit;
  // A heading unchanged from what was displayed keeps its actual stored state
  // (missing, undefined, null, or explicit). Empty edited text is explicit.
  if(label!==effectiveLabel(output,original))next.label=label;
  if(meta.role!==(original.role??'')||text!==original.text||credit!==(original.credit??'')||label!==effectiveLabel(output,original))changedSlideIds.push(meta.id);
  slides.push(next);
 }
 const missing=originalSlides.filter(slide=>!seen.has(slide.id));
 if(missing.length)fail('Missing slide identities: '+missing.map(slide=>slide.id).join(', ')+'. Adding or removing slides is not supported by this words file.');
 expect('## Caption');blank();const caption=readBlock('Caption');expect('<!-- ar-carousel-end -->');
 if(cursor!==raw.length)fail('Unexpected content after the carousel end.');
 const candidate=structuredClone(output);if(own(output,'slides'))candidate.slides=slides;
 const captionChanged=caption!==(output.caption??'');if(captionChanged)candidate.caption=caption;
 const reordered=slides.some((slide,index)=>slide.id!==originalSlides[index].id);
 return {output:candidate,summary:{changed:reordered||captionChanged||changedSlideIds.length>0,changedSlideIds,reordered,captionChanged}};
}
