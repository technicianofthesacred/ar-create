import IG from '../donors/mag/carousel/ig-templates.js';
// ACTUAL-REUSE: mag-preview.mjs sectionOf/lineupOf grammar, adapted to
// owned output snapshots. Invalid lines fail instead of silently disappearing.
const MAX_BYTES=1024*1024;
const sectionOf=(body,name)=>(body.split(new RegExp('^## '+name+'[ \\t]*$', 'm'))[1]||'').split(/^## /m)[0];
const scalar=value=>value.trim().replace(/^(["'])([\s\S]*)\1$/,'$2');
const imageName=/\.(jpe?g|png|webp)$/i;
function lookFields(parts,index){
 const fields={};
 for(const part of parts.slice(1)){
  const match=part.match(/^(template|photo|crop):\s*(.*)$/i);if(!match)continue;
  const key=match[1].toLowerCase();if(Object.hasOwn(fields,key))throw new Error('Slide '+(index+1)+' repeats its '+key+' instruction. Nothing was imported.');fields[key]=match[2].trim();
 }
 const template=fields.template;if(!Object.hasOwn(IG.T,template))throw new Error('Slide '+(index+1)+' needs a known template from /arcreate (for example H6, N9 or M12).');
 const count=IG.T[template].photos;
 if(count===0){if(fields.photo||fields.crop)throw new Error('Slide '+(index+1)+' uses Words only and cannot carry photo or crop instructions.');return {template,photos:[]};}
 const refs=(fields.photo||'').split(',').map(value=>value.trim()),crops=(fields.crop||'').split(',').map(value=>value.trim());
 if(refs.length!==count||refs.some(ref=>!ref))throw new Error('Slide '+(index+1)+' needs '+count+' photo reference'+(count===1?'':'s')+' for '+template+'. Use - for an explicitly unmatched photograph.');
 if(crops.length!==count||crops.some(crop=>!crop))throw new Error('Slide '+(index+1)+' needs one crop focus per photo, written across/down in percent.');
 const photos=refs.map((ref,slot)=>{
  const match=crops[slot].match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/),x=Number(match?.[1]),y=Number(match?.[2]);
  if(!match||!Number.isFinite(x)||!Number.isFinite(y)||x>100||y>100)throw new Error('Slide '+(index+1)+' has an invalid crop. Focus must be 0–100 across/down.');
  if(ref!=='-'&&!ref.startsWith('source:')&&(ref.startsWith('/')||ref.includes('\\')||ref.split('/').some(part=>part==='.'||part==='..'||!part)||/^[a-z][a-z\d+.-]*:/i.test(ref)))throw new Error('Slide '+(index+1)+' must name a library photograph, not a URL or filesystem path.');
  return {ref,x,y};
 });
 return {template,photos};
}
export function parseCarouselDraft(raw,filename='Carousel draft.md'){
 if(typeof raw!=='string'||!raw.trim())throw new Error('Choose a nonempty carousel Markdown draft.');
 if(new TextEncoder().encode(raw).length>MAX_BYTES)throw new Error('Choose a carousel draft smaller than 1 MB. Nothing was imported.');
 const normalized=raw.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),front=normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
 if(!front)throw new Error('This draft needs its /arcreate frontmatter: kind, story and stage.');
 const field=key=>scalar((front[1].match(new RegExp('^'+key+':[ \\t]*(.*)$','m'))||[])[1]||'');
 if(field('kind').toUpperCase()!=='CAROUSEL')throw new Error('Choose a CAROUSEL draft made by /arcreate.');
 const pillarFields=front[1].match(/^pillar:/gm)||[],pillar=field('pillar');
 if(pillarFields.length>1||pillarFields.length&&!['','佳','家','嘉'].includes(pillar))throw new Error('The carousel pillar must be 佳, 家, 嘉 or empty, written once. Nothing was imported.');
 const pillarValue=pillarFields.length?{pillar}:{};
 const stage=field('stage');if(!['words','look'].includes(stage))throw new Error('Choose the words or look stage of a carousel draft.');
 const story=field('story');if(!story)throw new Error('The carousel draft needs its story name.');
 const body=normalized.slice(front[0].length);
 for(const name of ['Slides','Caption'])if((body.match(new RegExp('^## '+name+'[ \\t]*$','gm'))||[]).length!==1)throw new Error('The draft needs exactly one ## '+name+' section.');
 const allowed=new Set(['cover','hook','line','quote','teach','chapter','photo','scene','close']);
 const slides=sectionOf(body,'Slides').split('\n').filter(line=>line.trim()).map((line,index)=>{
  const match=line.match(/^(\d+)\.\s*\[([^\]]+)\]\s*(.*)$/);
  if(!match)throw new Error('Slide '+(index+1)+' must be one numbered [role] line. Nothing was imported.');
  if(Number(match[1])!==index+1)throw new Error('Slide numbers must run in order from 1, without duplicates or gaps.');
  const parts=match[2].split(/\s+·\s+/).map(value=>value.trim()),role=parts[0].toLowerCase();
  if(!allowed.has(role))throw new Error('Slide '+(index+1)+' has an unknown role: '+parts[0]+'.');
  if(stage==='words'&&parts.slice(1).some(value=>/^(photo|template|crop):/i.test(value)))throw new Error('Slide '+(index+1)+' includes look-stage photo/layout instructions. Mark the completed composition stage: look, or import its words-stage version.');
  const text=match[3].trim(),look=stage==='look'?lookFields(parts,index):null;if(look&&IG.T[look.template]?.textParts===0&&text)throw new Error('Slide '+(index+1)+' uses a photo-only layout that would hide its words. Choose a layout with text.');if(!text&&role!=='photo')throw new Error('Slide '+(index+1)+' needs words, or the photo role.');
  if(text.length>20000)throw new Error('Slide '+(index+1)+' exceeds the supported slide text length. Nothing was imported.');
  return {...pillarValue,role,credit:parts.slice(1).filter(value=>!/^(photo|template|crop):/i.test(value)).join(' · '),text,...(look||{})};
 });
 if(!slides.length||slides.length>40)throw new Error('A carousel draft needs 1–40 slides. No slides were dropped.');
 const caption=sectionOf(body,'Caption').trim();if(!caption)throw new Error('The carousel draft needs a caption.');
 return {filename,raw,stage,story,...pillarValue,label:field('label')||story,briefs:field('briefs'),cutFrom:field('cut-from'),sourceStatus:field('status'),slides,caption};
}
function resolvePhotograph(ref,sources,index){
 if(ref==='-')return '';
 if(!Array.isArray(sources))throw new Error('Load the local library before importing this completed composition. Nothing was imported.');
 const images=sources.filter(source=>source&&typeof source.id==='string'&&source.id&&!source.missing&&imageName.test(source.rel_path||source.name||''));
 const found=images.filter(source=>ref.startsWith('source:')?source.id===ref.slice(7):ref.includes('/')?source.rel_path===ref:(source.rel_path||source.name||'').split('/').at(-1)===ref);
 if(found.length>1)throw new Error('Slide '+(index+1)+' photograph '+ref+' is ambiguous: more than one library photograph has that name. Use its exact library relative path or source:<id>. Nothing was imported.');
 if(!found.length)throw new Error('Slide '+(index+1)+' photograph '+ref+' was not found among the library JPEG, PNG or WebP photographs. Add that real photograph to the library, use its exact relative path or source:<id>, or mark it -. Nothing was imported.');
 return '/api/sources/blob?id='+encodeURIComponent(found[0].id);
}
// Reusable skill adapter: the model composes externally using the real /arcreate
// Markdown grammar; this only validates/resolves that composition against a
// fresh library tree. It does not generate words, choose photos or approve them.
export function importCarouselDraft(document,raw,filename,{sources}={}){
 const parsed=parseCarouselDraft(raw,filename);
 if(document.outputs.length>=100)throw new Error('This manuscript already has 100 outputs. Nothing was imported.');
 const {slides,caption,stage,...importedDraft}=parsed;
 const prepared=slides.map((slide,index)=>({...slide,id:crypto.randomUUID(),template:stage==='look'?slide.template:slide.role==='photo'?'F1':'M12',photos:stage==='look'?slide.photos.map(({ref,x,y})=>({src:resolvePhotograph(ref,sources,index),x,y})):[],paragraphIds:[]}));
 const output={id:crypto.randomUUID(),kind:'carousel',status:'for-your-yes',stage,outputRevision:0,manuscriptRevision:document.revision,placements:[],createdAt:new Date().toISOString(),manuscript:structuredClone(document.paragraphs.map(({proposal,...accepted})=>accepted)),title:document.title,caption,importedDraft:{...importedDraft,stage},slides:prepared};
 return {document:{...document,outputs:[...document.outputs,output]},output};
}
