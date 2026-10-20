import React,{useEffect,useRef,useState} from 'react';
import IG from '../donors/mag/carousel/ig-templates';
import {updateCarousel,locatorLabel,type Manuscript,type Output,type CarouselSlide} from './document';
import {localMediaApi} from './media';
import {importCarouselDraft,parseCarouselDraft} from './carousel-import.mjs';
import type {WorkspaceOptions} from './EditorWorkspace';
import './carousel-workbench.css';
import {fitCarouselTypography,normalizeTypography} from './carousel-typography.mjs';
import {carouselWordsHash} from './carousel-words.mjs';
import {assertOutputEditorialReady} from './editorial-state.mjs';
// ACTUAL-REUSE: mag-look.js frame/fit, crop drag and lineup reorder adapted
// to React-owned output state. Donor layout rendering supports optional small headings.
export function fitCarouselSlide(slide:CarouselSlide,template:string):CarouselSlide {
 const photos=slide.photos.map(p=>({...p}));while(photos.length<IG.T[template].photos)photos.push({src:'',x:50,y:50});return {...slide,template,photos};
}
function editableText(element:HTMLElement):string {
 const read=(node:Node):string=>node.nodeType===3?node.nodeValue||'':node.nodeType===1?(node as HTMLElement).tagName==='BR'?'\n':[...node.childNodes].map(read).join('')+(['DIV','P'].includes((node as HTMLElement).tagName)?'\n':''):'';
 return [...element.childNodes].map(read).join('').replace(/\n$/,'');
}
export function Frame({slide,title,width=420,interactive=false,onCrop,onPhoto,onOverflow,onText,onSelectPhoto,onFit}:{slide:CarouselSlide;title:string;width?:number;interactive?:boolean;onCrop?:(slot:number,x:number,y:number)=>void;onPhoto?:(slot:number,src:string)=>void;onOverflow?:(value:boolean)=>void;onText?:(field:'text'|'label'|'credit',value:string)=>void;onSelectPhoto?:(slot:number,inspect?:boolean)=>void;onFit?:(scale:number)=>void}){
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null),editing=useRef<HTMLElement|null>(null),cropCleanup=useRef<(()=>void)|null>(null),[size,setSize]=useState(width);
 const initialMarkup=useRef({__html:IG.render(slide.template,{...slide,label:slide.label??title},{})});
 const callbacks=useRef({onCrop,onPhoto,onOverflow,onText,onSelectPhoto,onFit});callbacks.current={onCrop,onPhoto,onOverflow,onText,onSelectPhoto,onFit};
 function measure(){const root=canvas.current?.firstElementChild as HTMLElement|null;if(root){const result=fitCarouselTypography(root,slide.typography);callbacks.current.onOverflow?.(result.overflow||(IG.T[slide.template] as any).textParts===0&&!!slide.text.trim());callbacks.current.onFit?.(result.scale);}}
 useEffect(()=>{const el=host.current;if(!el||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(([entry])=>setSize(Math.max(1,Math.min(width,entry.contentRect.width,entry.contentRect.height/1.25))));observer.observe(el);return()=>observer.disconnect();},[width]);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  if(!editing.current){element.innerHTML=IG.render(slide.template,{...slide,label:slide.label??title},{});
   if(interactive)for(const field of element.querySelectorAll<HTMLElement>('[data-edit]')){field.contentEditable='plaintext-only';field.setAttribute('contenteditable','plaintext-only');field.setAttribute('role','textbox');field.tabIndex=0;field.setAttribute('aria-label',field.dataset.edit==='text'?'Slide words':field.dataset.edit==='label'?'Small heading':'Slide credit');field.setAttribute('aria-multiline','true');field.spellcheck=true;}
  }
  measure();let alive=true;document.fonts?.ready.then(()=>{if(alive)measure();});return()=>{alive=false;};
 },[slide,title,interactive,size]);
 useEffect(()=>()=>{cropCleanup.current?.();editing.current=null;},[]);
 const crop=(event:React.PointerEvent)=>{
  if(!interactive||event.button!==0)return;const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(!slot)return;
  const index=Number(slot.dataset.slot),photo=slide.photos[index];callbacks.current.onSelectPhoto?.(index);if(!photo?.src)return;
  event.preventDefault();cropCleanup.current?.();const img=slot.querySelector('img'),rect=slot.getBoundingClientRect(),x0=event.clientX,y0=event.clientY;let x=photo.x,y=photo.y;
  const move=(e:PointerEvent)=>{x=Math.max(0,Math.min(100,photo.x-(e.clientX-x0)/rect.width*100));y=Math.max(0,Math.min(100,photo.y-(e.clientY-y0)/rect.height*100));if(img)img.style.objectPosition=x+'% '+y+'%';};
  const cleanup=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',end);removeEventListener('pointercancel',cleanup);cropCleanup.current=null;};
  const end=()=>{cleanup();callbacks.current.onCrop?.(index,x,y);};cropCleanup.current=cleanup;addEventListener('pointermove',move);addEventListener('pointerup',end);addEventListener('pointercancel',cleanup);
 };
 return <div ref={host} className={'car-artboard-slot'+(interactive?' car-interactive':'')} onPointerDown={crop}
  onClick={e=>{if(!interactive||(e.target as HTMLElement).closest('[data-edit]'))return;const slot=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(slot)callbacks.current.onSelectPhoto?.(Number(slot.dataset.slot),true);else if(IG.T[slide.template].photos===1)callbacks.current.onSelectPhoto?.(0,true);}}
  onFocusCapture={e=>{const field=(e.target as HTMLElement).closest<HTMLElement>('[data-edit]');if(interactive&&field)editing.current=field;}}
  onInput={e=>{if(!interactive)return;const field=(e.target as HTMLElement).closest<HTMLElement>('[data-edit]');if(!field)return;editing.current=field;const key=field.dataset.edit as 'text'|'label'|'credit';let value=editableText(field);if(key==='text'&&field.dataset.textPart!==undefined){value=[...canvas.current!.querySelectorAll<HTMLElement>('[data-edit="text"][data-text-part]')].sort((a,b)=>Number(a.dataset.textPart)-Number(b.dataset.textPart)).map(editableText).join('\n\n');}if(key==='text'&&slide.template==='H10'){const suffix=slide.text.match(/\s+·\s+[\s\S]*$/)?.[0]||'';value+=suffix;}callbacks.current.onText?.(key,value);measure();}}
  onBlurCapture={e=>{if((e.target as HTMLElement).closest('[data-edit]')){editing.current=null;measure();}}}
  onKeyDown={e=>{if(interactive&&(e.target as HTMLElement).closest('[data-edit]')&&(e.key==='Escape'||e.key==='Enter'&&(e.metaKey||e.ctrlKey))){e.preventDefault();(e.target as HTMLElement).blur();}}}
  onDragOver={e=>interactive&&e.preventDefault()} onDrop={e=>{if(!interactive)return;e.preventDefault();const slot=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');const src=e.dataTransfer.getData('text/plain');if(slot&&/^\/api\/sources\/blob\?id=/.test(src))callbacks.current.onPhoto?.(Number(slot.dataset.slot),src);}}>
  <div className="car-frame" style={{width:size,height:size*1.25}}><div ref={canvas} className="car-scale" style={{transform:`scale(${size/1080})`}} dangerouslySetInnerHTML={initialMarkup.current}/></div>
 </div>;
}

export function CarouselWorkspace({doc,output,change,options,onSelectOutput,onArrange}:{doc:Manuscript;output:Output;change:(doc:Manuscript)=>void;options:WorkspaceOptions;onSelectOutput?:(id:string)=>void;onArrange?:(request:{outputId:string;outputRevision:number;wordsHash:string})=>void|Promise<void>}){
 const [selected,setSelected]=useState(output.slides?.[0]?.id),[panel,setPanel]=useState<'canvas'|'slides'|'inspector'>('canvas'),[focused,setFocused]=useState(false),[mode,setMode]=useState<'words'|'slide'|'export'>(output.stage==='words'?'words':'slide'),[layoutsOpen,setLayoutsOpen]=useState(false),[layoutGroup,setLayoutGroup]=useState('All layouts'),[layoutSearch,setLayoutSearch]=useState(''),[layoutLimit,setLayoutLimit]=useState(12),[photoOpen,setPhotoOpen]=useState(false),[selectedPhoto,setSelectedPhoto]=useState<number|null>(null),[fitScale,setFitScale]=useState(1),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[overflow,setOverflow]=useState(false),[photos,setPhotos]=useState<any[]>([]),[saved,setSaved]=useState<any[]>([]);
 const importInput=useRef<HTMLInputElement>(null),imported=(output as any).importedDraft;
 const dragCleanup=useRef<(()=>void)|null>(null),ignorePointerClick=useRef(false);
 useEffect(()=>()=>{dragCleanup.current?.();},[output.id]);
 useEffect(()=>{if(!focused)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!(event.target instanceof Element&&event.target.closest('[contenteditable]')))setFocused(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[focused]);
 const latest=useRef(doc);latest.current=doc;const slides=output.slides||[],slide=slides.find(s=>s.id===selected)||slides[0],index=slides.findIndex(s=>s.id===slide?.id);
 useEffect(()=>{let active=true;options.api?.('/api/sources/tree').then(r=>{if(active)setPhotos((r.sources||[]).filter((s:any)=>/\.(jpe?g|png|webp)$/i.test(s.rel_path||'')));}).catch(()=>{});options.api?.('/api/carousel/exports').then(r=>{if(active)setSaved(r.exports||[]);}).catch(()=>{});return()=>{active=false;};},[options.api,output.id]);
 useEffect(()=>{
  const entry={outputId:output.id,focus:async(location:any)=>{
   const target=output.slides?.find(s=>s.id===location.slideId);
   if(location.kind!=='carousel'||!target||!Number.isSafeInteger(location.photoIndex)||location.photoIndex<0||location.photoIndex>=IG.T[target.template].photos||!target.photos[location.photoIndex]?.src)throw Error('This saved slide photograph is no longer available.');
   setSelected(target.id);setMode('slide');setPanel('canvas');setSelectedPhoto(location.photoIndex);setPhotoOpen(true);
   await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
   const frame=document.querySelector<HTMLElement>('.car-canvas [data-slot="'+location.photoIndex+'"]')||document.querySelector<HTMLElement>('.car-frame [data-slot="'+location.photoIndex+'"]');
   if(!frame)throw Error('The exact saved slide photograph is not rendered.');
   frame.tabIndex=-1;frame.scrollIntoView({block:'center'});frame.focus({preventScroll:true});return {outputId:output.id,slideId:target.id,photoIndex:location.photoIndex};
  }};
  (window as any).studyCompositionFocus=entry;return()=>{if((window as any).studyCompositionFocus===entry)delete (window as any).studyCompositionFocus;};
 },[output]);
 function update(fn:(o:Output)=>Output){const next=updateCarousel(latest.current,output.id,fn);latest.current=next;change(next);}
 function patchSlide(id:string,value:Partial<CarouselSlide>){update(o=>{const previous=o.slides!.find(row=>row.id===id)!;const words=['text','label','credit','role'].some(key=>Object.hasOwn(value,key)&&(value as any)[key] !== (previous as any)[key]);return {...o,slides:o.slides!.map(s=>s.id===id?{...s,...value}:s),...(words?{stage:'words',wordsReview:undefined}:{})};});}
 function patch(value:Partial<CarouselSlide>){if(slide)patchSlide(slide.id,value);}
 async function reviewWriting(){setBusy(true);setNotice('');try{if(options.onReviewCarouselWords){await options.ensureSaved?.();const selectedId=output.id;const saved=await options.onReviewCarouselWords(selectedId);if(saved?.id!==selectedId||saved.kind!=='carousel'||saved.stage!=='look'||!saved.wordsReview?.hash)throw Error('The carousel owner did not confirm its reviewed words.');if(latest.current.id!==doc.id||!latest.current.outputs.some(o=>o.id===selectedId))throw Error('The output changed while reviewing.');setMode('slide');await onArrange?.({outputId:saved.id,outputRevision:saved.outputRevision||0,wordsHash:saved.wordsReview.hash});return;}const current=latest.current.outputs.find(o=>o.id===output.id)!;assertOutputEditorialReady(current);const beforeHash=await carouselWordsHash(current);const reviewed={...current,slides:current.slides!.map(row=>({...row,label:row.label??(current as any).importedDraft?.label??current.title??''}))};const hash=await carouselWordsHash(reviewed);const fresh=latest.current.outputs.find(o=>o.id===output.id)!;if(await carouselWordsHash(fresh)!==beforeHash)throw new Error('The words changed during review. Review the current sequence again.');update(o=>({...o,slides:reviewed.slides,stage:'look',wordsReview:{hash,reviewedAt:new Date().toISOString()}}));await options.ensureSaved?.();const saved=latest.current.outputs.find(o=>o.id===output.id)!;setMode('slide');await onArrange?.({outputId:output.id,outputRevision:saved.outputRevision||0,wordsHash:hash});}catch(error:any){setNotice(error.message);}finally{setBusy(false);}}
 function typography(value:any){patch({typography:{...normalizeTypography(slide.typography),...value}});}
 function photo(slot:number,src:string){if(!slide)return;update(o=>({...o,slides:o.slides!.map(s=>{if(s.id!==slide.id)return s;const next=s.photos.map(p=>({...p}));while(next.length<=slot)next.push({src:'',x:50,y:50});next[slot]={src,x:50,y:50};return {...s,photos:next};})}));}
 function crop(slot:number,x:number,y:number){update(o=>({...o,slides:o.slides!.map(s=>s.id===slide.id?{...s,photos:s.photos.map((p,i)=>i===slot?{...p,x,y}:p)}:s)}));}
 function move(from:number,to:number){if(to<0||to>=slides.length||from===to)return;update(o=>{const rows=[...o.slides!],[s]=rows.splice(from,1);rows.splice(to,0,s);return {...o,slides:rows,stage:'words',wordsReview:undefined};});}
 // Donor pointer reorder: a short movement is a tap; lifting creates a ghost.
 function dragSlide(event:React.PointerEvent<HTMLButtonElement>,id:string){
  if(event.button!==0||slides.length<2)return;
  dragCleanup.current?.();event.preventDefault();
  const source=event.currentTarget,rail=source.closest<HTMLElement>('.car-lineup')!;
  const x0=event.clientX,y0=event.clientY,pointerId=event.pointerId;
  let ghost:HTMLElement|null=null,over:HTMLElement|null=null,x=x0,y=y0,frame=0;
  source.focus({preventScroll:true});
  const target=()=>{
   const hit=document.elementFromPoint?.(x,y)?.closest<HTMLElement>('[data-slide-id]');
   const next=hit&&hit!==source&&rail.contains(hit)?hit:null;
   if(over!==next){over?.classList.remove('car-drop-target');over=next;over?.classList.add('car-drop-target');}
  };
  const scroll=()=>{
   if(!ghost)return;const rect=rail.getBoundingClientRect();
   if(x>=rect.left-16&&x<=rect.right+16&&y>=rect.top-36&&y<=rect.bottom+36){
    const delta=y<rect.top+32?-Math.ceil((rect.top+32-y)/5):y>rect.bottom-32?Math.ceil((y-rect.bottom+32)/5):0;
    if(delta){rail.scrollTop+=Math.max(-12,Math.min(12,delta));target();}
   }
   frame=window.requestAnimationFrame(scroll);
  };
  const pointerMove=(e:PointerEvent)=>{
   if(e.pointerId!==pointerId)return;x=e.clientX;y=e.clientY;
   if(!ghost){if(Math.hypot(x-x0,y-y0)<6)return;
    const rect=source.getBoundingClientRect();ghost=source.cloneNode(true) as HTMLElement;
    ghost.classList.add('car-drag-ghost');ghost.removeAttribute('data-slide-id');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
    Object.assign(ghost.style,{width:rect.width+'px',height:rect.height+'px'});document.body.appendChild(ghost);source.classList.add('car-drag-source');
    frame=window.requestAnimationFrame(scroll);
   }
   e.preventDefault();ghost.style.left=(x-ghost.getBoundingClientRect().width/2)+'px';ghost.style.top=(y-ghost.getBoundingClientRect().height/2)+'px';target();
  };
  const cleanup=()=>{
   window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);
   window.cancelAnimationFrame(frame);ghost?.remove();source.classList.remove('car-drag-source');over?.classList.remove('car-drop-target');dragCleanup.current=null;
  };
  const end=(e:PointerEvent)=>{
   if(e.pointerId!==pointerId)return;
   const lifted=!!ghost,dropId=over?.dataset.slideId;cleanup();
   ignorePointerClick.current=true;window.setTimeout(()=>{ignorePointerClick.current=false;},0);
   if(!lifted){setSelected(id);setPanel('canvas');return;}
   if(!dropId)return;
   update(o=>{const rows=[...o.slides!],from=rows.findIndex(s=>s.id===id),to=rows.findIndex(s=>s.id===dropId);if(from<0||to<0||from===to)return o;const [moved]=rows.splice(from,1);rows.splice(to,0,moved);return {...o,slides:rows,stage:'words',wordsReview:undefined};});
  };
  const cancel=(e:PointerEvent)=>{if(e.pointerId===pointerId)cleanup();};
  dragCleanup.current=cleanup;window.addEventListener('pointermove',pointerMove,{passive:false});window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);
 }
 async function upload(slot:number,file?:File){if(!file)return;setBusy(true);try{const src=await (options.mediaApi||localMediaApi).uploadImageProgress(file,()=>{});photo(slot,src);const tree=await options.api?.('/api/sources/tree');if(tree)setPhotos(tree.sources.filter((s:any)=>/\.(jpe?g|png|webp)$/i.test(s.rel_path||'')));setNotice('Photograph saved in the local library.');}catch(e:any){setNotice(e.message);}finally{setBusy(false);}}
 async function importDraft(file?:File){
  if(!file)return;const documentId=latest.current.id;setBusy(true);setNotice('Reading carousel draft…');
  try{if(file.size>1024*1024)throw new Error('Choose a carousel draft smaller than 1 MB. Nothing was imported.');const raw=await file.text();if(latest.current.id!==documentId)throw new Error('The manuscript changed while reading. Choose the draft again.');const parsed=parseCarouselDraft(raw,file.name),tree=parsed.stage==='look'?await options.api?.('/api/sources/tree'):undefined;if(latest.current.id!==documentId)throw new Error('The manuscript changed while reading. Choose the draft again.');const result=importCarouselDraft(latest.current,raw,file.name,{sources:tree?.sources});latest.current=result.document;change(result.document);onSelectOutput?.(result.output.id);setNotice('Imported '+result.output.slides.length+' slides and caption as a new '+(result.output.stage==='look'?'composition':'draft')+'. Awaiting your review.');}
  catch(error:any){setNotice(error.message||'The carousel draft could not be read. Nothing was imported.');}finally{setBusy(false);}
 }
 async function exportSlides(){if(output.stage==='words'){setNotice('Review writing content before exporting.');setMode('words');return;}setBusy(true);setNotice('Rendering the saved carousel…');try{assertOutputEditorialReady(output);await options.ensureSaved?.();const r=await options.api?.('/api/carousel/exports',{method:'POST',body:{outputId:output.id,outputRevision:output.outputRevision||0}});if(!r?.export)throw new Error('The export service did not confirm files.');setSaved(rows=>[r.export,...rows]);setNotice('Saved '+r.export.files.filter((f:any)=>f.mimeType==='image/png').length+' PNG slides and caption.');}catch(e:any){setNotice(e.message);}finally{setBusy(false);}}
 const layoutEntries=Object.entries(IG.T) as [string,any][];
 const layoutGroups=[...new Set(layoutEntries.map(([,t])=>t.group||'Earlier layouts'))] as string[];
 const matchingLayouts=layoutEntries.filter(([id,t])=>(layoutGroup==='All layouts'||(t.group||'Earlier layouts')===layoutGroup)&&(!layoutSearch.trim()||(t.name+' '+(t.originalId||id)+' '+(t.group||'Earlier layouts')).toLowerCase().includes(layoutSearch.trim().toLowerCase())));
 if(!slide)return <div className="cwb-empty">This carousel has no slides. Create another output from the manuscript.</div>;
 const type=normalizeTypography(slide.typography);
 const baseSize=Number(IG.render(slide.template,{...slide,text:''},{}).match(/data-edit="text"[^>]*data-base-font-size="(\d+)"/)?.[1]||64);
 const requestedSize=Math.max(42,Math.round(baseSize*type.scale));
 const missing=slide.photos.slice(0,IG.T[slide.template].photos).filter(p=>!p.src).length+Math.max(0,IG.T[slide.template].photos-slide.photos.length),lineage=(output.manuscript||[]).filter(p=>slide.paragraphIds.includes(p.id));
 return <div className={'car-workspace'+(focused?' is-focused':'')}>
  <nav className="cwb-tabs car-tools" aria-label="Carousel tools">
   <button aria-selected={mode==='words'} onClick={()=>setMode('words')}>Writing content</button>
   <button aria-selected={mode==='slide'} onClick={()=>setMode('slide')}>Visual content</button>
   <button aria-selected={mode==='export'} disabled={output.stage==='words'} title={output.stage==='words'?'Review writing content before exporting':undefined} onClick={()=>{setMode('export');setPanel('inspector');}}>Export</button>
   <span className="car-dim">1080 × 1350</span>
   <details className="car-more" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))e.currentTarget.open=false;}}><summary>More<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5"/></svg></summary><div className="car-more-menu"><button onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');options.onShelfRequest?.('carousel-review:'+output.id);}}>Review wording changes</button><button onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');importInput.current?.click();}} disabled={busy}>Import carousel draft</button></div></details>
   <input ref={importInput} hidden type="file" accept=".md,.markdown,text/markdown,text/plain" aria-label="Carousel draft Markdown" disabled={busy} onChange={e=>{void importDraft(e.target.files?.[0]);e.target.value='';}}/>
  </nav>
  {mode==='words'?<main className="car-writing-page" aria-label="Carousel writing content"><header><div><h2>Writing content</h2><p>Read the whole sequence before arranging the slides.</p></div><div className="car-writing-guides"><button onClick={()=>options.onShelfRequest?.('voice')}>Voice</button><button onClick={()=>options.onShelfRequest?.('recipe')}>Recipe</button><button onClick={()=>options.onShelfRequest?.('sources')}>Sources</button></div></header>
   <div className="car-writing-sequence">{slides.map((row,i)=><section className="car-writing-slide" key={row.id}><header><strong>Slide {i+1}</strong><span>{row.role}</span><div><button aria-label={'Move slide '+(i+1)+' earlier'} disabled={i===0||busy} onClick={()=>move(i,i-1)}>Earlier</button><button aria-label={'Move slide '+(i+1)+' later'} disabled={i===slides.length-1||busy} onClick={()=>move(i,i+1)}>Later</button></div></header><textarea aria-label={'Writing for slide '+(i+1)} value={row.text} disabled={busy} rows={Math.max(2,Math.ceil(row.text.length/80))} onChange={e=>patchSlide(row.id,{text:e.target.value})}/><details><summary>Heading and credit</summary><label>Small heading<input aria-label={'Heading for slide '+(i+1)} maxLength={240} value={row.label??imported?.label??output.title??''} disabled={busy} onChange={e=>patchSlide(row.id,{label:e.target.value})}/></label><label>Credit<input aria-label={'Credit for slide '+(i+1)} value={row.credit} disabled={busy} onChange={e=>patchSlide(row.id,{credit:e.target.value})}/></label></details></section>)}</div>
   <label className="car-writing-caption">Caption<textarea aria-label="Writing caption" rows={4} value={output.caption||''} disabled={busy} onChange={e=>update(o=>({...o,caption:e.target.value,stage:'words',wordsReview:undefined}))}/></label><footer><span>Visual choices keep these words and their order.</span><button className="cwb-primary" disabled={busy||!slides.some(row=>row.text.trim())} onClick={()=>void reviewWriting()}>{busy?'Preparing…':'Review words and continue'}</button></footer>
  </main>:<>
  <div className="car-body" data-panel={panel}>
   <main className={'car-stage'+(slides.length===1?' car-single-slide':'')}>
    <div className="car-stage-label"><span>Slide {index+1} / {slides.length}</span><div className="car-view-controls"><button className="car-panel-toggle" aria-label="Show slides" aria-pressed={panel==='slides'} onClick={()=>setPanel(panel==='slides'?'canvas':'slides')}>Slides</button><button className="car-panel-toggle" aria-label={mode==='export'?'Show export controls':'Show slide controls'} aria-pressed={panel==='inspector'} onClick={()=>setPanel(panel==='inspector'?'canvas':'inspector')}>{mode==='export'?'Export':'Edit'}</button><button aria-label={focused?'Exit enlarged preview':'Enlarge slide'} aria-pressed={focused} onClick={()=>{setFocused(!focused);setPanel('canvas');}}>{focused?'Done':'Enlarge'}</button></div></div>
    <Frame key={slide.id} slide={slide} title={imported?.label??output.title??''} width={1080} interactive={mode==='slide'} onCrop={crop} onPhoto={photo} onOverflow={setOverflow} onFit={setFitScale} onText={(field,value)=>patch({[field]:value})} onSelectPhoto={(slot,inspect)=>{setSelectedPhoto(slot);setPhotoOpen(true);if(inspect)setPanel('inspector');}}/>
    <div className="car-messages">{output.stage==='words'&&<p className="car-warning">Words changed. <button onClick={()=>setMode('words')}>Review writing content</button></p>}
     {overflow&&<p className="car-warning" role="status">Words overflow. Choose a roomier layout.</p>}
     {missing>0&&<p className="car-warning">Needs {missing} photograph{missing===1?'':'s'}. <button onClick={()=>{setMode('slide');setSelectedPhoto(0);setPhotoOpen(true);setPanel('inspector');}}>Choose photos</button></p>}
    </div>
    <div className="car-slide-rail"><p className="car-reorder-help">Drag slides to reorder</p><div className="car-lineup" aria-label="Slide order">{slides.map((s,i)=><div className="car-lineup-item" key={s.id}>
     <button type="button" data-slide-id={s.id} aria-label={'Select slide '+(i+1)} aria-pressed={s.id===slide.id} title="Drag to reorder · click to edit" onPointerDown={e=>dragSlide(e,s.id)} onClick={e=>{if(e.detail===0||!ignorePointerClick.current){setSelected(s.id);setPanel('canvas');}}}><span className="car-lineup-preview" aria-hidden="true"><Frame slide={s} title={imported?.label??output.title??''} width={176}/></span><span className="car-lineup-copy"><small><span className="car-drag-grip" aria-hidden="true"><svg width="12" height="14" viewBox="0 0 12 18" fill="currentColor">{[4,9,14].flatMap(y=>[3,8].map(x=><circle key={x+'-'+y} cx={x} cy={y} r="1"/>))}</svg></span>Slide {i+1}</small><strong>{s.text||'Empty slide'}</strong></span></button>
     {s.id===slide.id&&<details className="car-slide-actions" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))e.currentTarget.open=false;}}><summary aria-label={'Actions for slide '+(i+1)} title="Slide actions"><svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="4" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="14" cy="9" r="1.5"/></svg></summary><div className="car-slide-action-menu"><button aria-label="Move earlier" disabled={index===0} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');move(index,index-1);}}>Move earlier</button><button aria-label="Move later" disabled={index===slides.length-1} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');move(index,index+1);}}>Move later</button><button aria-label="Cut slide" disabled={slides.length===1} onClick={()=>{update(o=>({...o,slides:o.slides!.filter(row=>row.id!==slide.id),stage:'words',wordsReview:undefined}));setSelected(slides[index+1]?.id||slides[index-1]?.id);}}>Cut slide</button></div></details>}
    </div>)}</div></div>
   </main>
   <aside className="cwb-inspector car-inspector" aria-label={mode==='slide'?'Slide inspector':'Carousel export inspector'}>
    {mode==='slide'?<>
     <div className="car-inspector-header"><div className="cwb-inspector-title"><h2>Slide {index+1}</h2><span>{slide.role}</span></div>
      <button className="car-current-layout" type="button" aria-label={'Change layout: '+IG.T[slide.template].name} aria-expanded={layoutsOpen} onClick={()=>setLayoutsOpen(!layoutsOpen)}><span className="car-current-layout-preview" aria-hidden="true"><Frame slide={slide} title={imported?.label??output.title??''} width={36}/></span><span><strong>{IG.T[slide.template].name}</strong><small>{IG.T[slide.template].photos===0?'Words only':IG.T[slide.template].photos+' photograph'+(IG.T[slide.template].photos===1?'':'s')}</small></span><span className="car-current-layout-action">Layout</span></button>
     </div>
     <div className="car-inspector-content">
      <p className="car-edit-hint">Click words to edit. Click a photo to choose or crop it.</p>
      <div className="car-typography-controls"><label>Font<select aria-label="Slide font" value={type.font} onChange={e=>typography({font:e.target.value as any})}><option value="original">Layout fonts</option><option value="caudex">Caudex</option><option value="serif">Source Serif</option><option value="sans">Instrument Sans</option></select></label><label>Size <span>{requestedSize}px{type.fit==='auto'&&Math.abs(fitScale-type.scale)>.01?' · fitted '+Math.round(baseSize*fitScale)+'px':''}</span><input aria-label="Text size" type="range" min="42" max={Math.floor(baseSize*1.5)} step="1" value={requestedSize} onChange={e=>typography({scale:Number(e.target.value)/baseSize})}/></label><label className="car-auto-fit"><input aria-label="Fit text automatically" type="checkbox" checked={type.fit==='auto'} onChange={e=>typography({fit:e.target.checked?'auto':'manual'})}/>Fit automatically</label></div>
      {layoutsOpen&&<fieldset className="car-layout-picker"><legend>Layouts · 58 original + 8 earlier</legend><div className="car-layout-filters"><select aria-label="Layout family" value={layoutGroup} onChange={e=>{setLayoutGroup(e.target.value);setLayoutLimit(12);}}><option>All layouts</option>{layoutGroups.map(group=><option key={group}>{group}</option>)}</select><input aria-label="Find layout" placeholder="Find a layout" value={layoutSearch} onChange={e=>{setLayoutSearch(e.target.value);setLayoutLimit(12);}}/></div><p className="car-layout-count">{matchingLayouts.length} layouts{matchingLayouts.length>layoutLimit?' · showing '+layoutLimit:''}</p><div className="car-layout-options">{matchingLayouts.slice(0,layoutLimit).map(([id,t]:any)=><button type="button" className="car-layout-option" key={id} aria-label={'Use '+t.name+' layout'} aria-pressed={slide.template===id} disabled={t.textParts===0&&!!slide.text.trim()} title={t.textParts===0?'Photo only · no text area':undefined} onClick={()=>{if(slide.template!==id)patch(fitCarouselSlide(slide,id));}}><span className="car-layout-preview" aria-hidden="true"><Frame slide={fitCarouselSlide(slide,id)} title={imported?.label??output.title??''} width={96}/>{slide.template===id&&<span className="car-layout-selected"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}</span><span className="car-layout-name">{t.originalId? t.originalId+' · ':''}{t.name}</span></button>)}</div>{matchingLayouts.length===0&&<p className="car-picker-help">No matching layouts.</p>}{matchingLayouts.length>layoutLimit&&<button className="car-layout-more" onClick={()=>setLayoutLimit(layoutLimit+12)}>Show more layouts</button>}</fieldset>}
      <details className="car-text-details"><summary>Text details</summary><label className="cwb-field">Small heading<input aria-label="Small heading" maxLength={240} value={slide.label??imported?.label??output.title??''} onChange={e=>patch({label:e.target.value})}/></label><label className="cwb-field">Words<textarea aria-label="Edit slide text" value={slide.text} onChange={e=>patch({text:e.target.value})} rows={4}/></label><label className="cwb-field">Credit<input aria-label="Credit" value={slide.credit} onChange={e=>patch({credit:e.target.value})}/></label></details>
      {IG.T[slide.template].photos>0?<details className="car-photos-details" open={photoOpen} onToggle={e=>setPhotoOpen(e.currentTarget.open)}><summary>Photos · {IG.T[slide.template].photos}</summary>{Array.from({length:IG.T[slide.template].photos},(_,slot)=><fieldset className={'car-photo'+(selectedPhoto===slot?' is-selected':'')} key={slot}><legend>Photograph {slot+1}</legend><div className="car-photo-picker" role="group" aria-label={'Photograph '+(slot+1)+' library'}>{slide.photos[slot]?.src&&<div className="car-current-photo"><img src={slide.photos[slot].src} alt={'Selected photograph '+(slot+1)} style={{objectPosition:slide.photos[slot].x+'% '+slide.photos[slot].y+'%'}}/><button type="button" aria-label={'Remove photograph '+(slot+1)} onClick={()=>photo(slot,'')}>Remove</button></div>}<div className="car-photo-library"><p className="car-photo-library-title">Library{photos.length>0?' · '+photos.length:''}</p>{photos.length===0?<p className="car-picker-help">Upload a photograph below.</p>:<div className="car-photo-options">{photos.map(p=>{const src='/api/sources/blob?id='+encodeURIComponent(p.id),name=p.name||p.rel_path;return <button type="button" className="car-photo-option" key={p.id} title={name} aria-label={'Use '+name+' for photograph '+(slot+1)} aria-pressed={slide.photos[slot]?.src===src} onClick={()=>{if(slide.photos[slot]?.src!==src)photo(slot,src);}}><img src={src} alt="" loading="lazy"/><span>{name}</span></button>;})}</div>}</div></div><label className="car-upload">Upload<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{upload(slot,e.target.files?.[0]);e.target.value='';}}/></label>{slide.photos[slot]?.src&&<><label className="car-crop">Horizontal focus<input aria-label={'Horizontal focus '+(slot+1)} type="range" min="0" max="100" value={slide.photos[slot].x} onChange={e=>crop(slot,+e.target.value,slide.photos[slot].y)}/></label><label className="car-crop">Vertical focus<input aria-label={'Vertical focus '+(slot+1)} type="range" min="0" max="100" value={slide.photos[slot].y} onChange={e=>crop(slot,slide.photos[slot].x,+e.target.value)}/></label></>}</fieldset>)}</details>:<button className="car-add-photo" onClick={()=>setLayoutsOpen(true)}>Choose a photo layout</button>}
      <details className="car-seal-details"><summary>Pillar seal</summary><div className="car-pillar-options" role="group" aria-label="Pillar seal">{(['','佳','家','嘉'] as const).map(pillar=><button type="button" key={pillar} aria-label={pillar?{'佳':'佳 · Leaf and craft','家':'家 · Table and practice','嘉':'嘉 · Journeys and shops'}[pillar]:'No pillar seal'} aria-pressed={(slide.pillar??'')===pillar} className={pillar?'car-pillar-character':'car-pillar-none'} onClick={()=>{if((slide.pillar??'')!==pillar)patch({pillar});}}>{pillar||'None'}</button>)}</div></details>
      <details className="car-lineage"><summary>Sources · manuscript r{output.manuscriptRevision}</summary><p>Slide edits stay separate from your manuscript.</p>{lineage.flatMap(p=>p.attributions).map(a=><blockquote key={a.id}>{a.excerpt}<footer>{a.sourceTitle} · {locatorLabel(a.locator)}</footer></blockquote>)}{!lineage.some(p=>p.attributions.length)&&<p>From your accepted manuscript.</p>}</details>
      {imported&&<details className="car-lineage"><summary>Imported {(output as any).stage==='look'?'composition':'draft'} · awaiting your review</summary><p>{imported.filename}</p><p>Story: {imported.story}<br/>Label: {imported.label}</p>{imported.cutFrom&&<p>Cut from: {imported.cutFrom}</p>}{imported.briefs&&<p>Briefs: {imported.briefs}</p>}<details><summary>Original draft and source notes</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{imported.raw}</pre></details></details>}
     </div>
    </>:<div className="car-inspector-content car-export-content"><div className="cwb-inspector-title"><h2>Carousel files</h2><span>Private export</span></div><details className="car-lineage"><summary>Caption</summary><p>{output.caption||'No caption yet.'}</p><button onClick={()=>setMode('words')}>Edit writing content</button></details><p className="cwb-help">Save all slides as actual 1080 × 1350 PNGs with a caption and source archive. Overflow or missing assets stops export.</p><button className="cwb-primary" onClick={exportSlides} disabled={busy||!options.api||output.stage==='words'}>{busy?'Rendering…':'Save PNG slides'}</button><p className="cwb-help">Download the files to share them. No account or posting connection is used.</p><section className="cwb-saved"><h3>Saved carousels</h3>{saved.filter(r=>r.outputId===output.id).map(r=><article key={r.id}><small>Output revision {r.outputRevision} · {new Date(r.createdAt).toLocaleString()}</small>{r.files.map((f:any)=><a key={f.name} href={f.url} download={f.name}>{f.name} ↓</a>)}<details><summary>File location</summary><p>{r.path}</p></details></article>)}</section>{imported&&<details className="car-lineage"><summary>Imported {(output as any).stage==='look'?'composition':'draft'} · awaiting your review</summary><p>{imported.filename}</p><p>Story: {imported.story}<br/>Label: {imported.label}</p>{imported.cutFrom&&<p>Cut from: {imported.cutFrom}</p>}{imported.briefs&&<p>Briefs: {imported.briefs}</p>}<p>Imported from /arcreate. The original file is retained below; this output has not been approved.</p><details><summary>Original draft and source notes</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{imported.raw}</pre></details></details>}</div>}
   </aside>
  </div>
  </>}
  <footer className="cwb-status"><span role="status">{notice||(imported?((output as any).stage==='look'?'Composition':'Words draft')+' · awaiting your review.':'Slide changes save with this output.')}</span><span>Output r{output.outputRevision||0}</span></footer>
 </div>;
}
