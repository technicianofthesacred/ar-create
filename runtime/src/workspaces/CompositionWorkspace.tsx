import {recomposeSelectedArticle,restorePreviousArticle} from './article-recompose';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import ConversationCanvas from '../donors/teajia/conversation/ConversationCanvas';
import {LocalStoryProvider,type PlacementUpdate} from '../donors/teajia/storyEdit';
import {snapshotOutput,snapshotCarousel,outputIsStale,type Manuscript,type Placement,type Output} from './document';
import {persistOutputExport,type ExportArtifact} from './exportOutput';
import type {WorkspaceOptions} from './EditorWorkspace';
import {outputSpec,articlePhotoPositions,articlePhotoPositionBaseline,articlePhotoSlotIsComposed} from './compositionSpec';
import './composition-workbench.css';
import '../shell/output-flow.css';
import {outputSelectionKey,readOutputSelection,writeOutputSelection} from './output-selection';
import {CarouselWorkspace} from './CarouselWorkspace';
import {MakeCarousel} from './MakeCarousel';
import {MakeArticleVisual} from './MakeArticleVisual';
import {restoreArticleArrangement} from './article-visual';
import {articleOrderBaseline,articleOrderGroups,moveArticleLayoutUnit,type ArticleOrderPosition} from './article-layout-order';
export {outputSpec} from './compositionSpec';
type Mode='outline'|'preview'|'photos'|'export';
type Format='html'|'markdown'|'json';
type NamedOutput=Output&{name?:string;importedDraft?:{label?:string;filename?:string;story?:string}};
const compactName=(value:string)=>value.replace(/\s+/g,' ').trim();
export function outputName(doc:Manuscript,output:NamedOutput):string {
 const imported=output.importedDraft;
 return compactName(output.name||imported?.label||imported?.filename?.replace(/^.*[\\/]/,'').replace(/\.(md|markdown)$/i,'').replace(/[_-]+/g,' ')||output.title||doc.title||'Untitled piece');
}
export function outputPurpose(output:Output):string {
 if(output.kind!=='carousel')return 'Article';
 return output.slides?.length===1?'Instagram post':'Carousel'+(output.slides?.length?' · '+output.slides.length+' slides':'');
}
export function renameOutput(doc:Manuscript,id:string,name:string):Manuscript {
 return {...doc,outputs:doc.outputs.map(output=>output.id===id?{...output,name:compactName(name)||undefined}:output)};
}
type LibraryPhoto={id:string;name?:string;rel_path:string};
const photoUrl=(photo:LibraryPhoto)=>'/api/sources/blob?id='+encodeURIComponent(photo.id);
const formats=[{id:'html' as Format,name:'Reading page',extension:'HTML',description:'A complete page with photographs and fonts.'},{id:'markdown' as Format,name:'Manuscript',extension:'Markdown',description:'The words and their source citations.'},{id:'json' as Format,name:'Output archive',extension:'JSON',description:'The manuscript, source records and photo placements.'}];
export function updateOutputPlacements(doc:Manuscript,id:string,update:PlacementUpdate):Manuscript{
 const target=doc.outputs.find(o=>o.id===id);if(!target)return doc;
 const result=typeof update==='function'?update(target.placements):update;if(result===target.placements)return doc;const rows=[...result];
 // A cleared photograph keeps its owned layout slot so words/structure remain intact.
 if(target.articleComposition){for(const old of target.placements)if(!rows.some(row=>row.slot===old.slot))rows.push({...old,url:''});}
 return {...doc,outputs:doc.outputs.map(o=>o.id===id?{...o,placements:rows.map(row=>({...o.placements.find(previous=>previous.slot===row.slot),...row}))}:o)};
}
export function updateArticlePhotoPosition(doc:Manuscript,outputId:string,slot:string,paragraphId:string|null,baseline:string):Manuscript{
 const output=doc.outputs.find(o=>o.id===outputId);if(!output||articlePhotoPositionBaseline(doc,output)!==baseline)throw Error('The Article changed. Choose its current photograph position again.');
 if(!output.placements.some(p=>p.slot===slot)||articlePhotoSlotIsComposed(doc,output,slot))throw Error('This photograph keeps its recorded composition position.');
 if(!articlePhotoPositions(doc,output).some(p=>p.paragraphId===paragraphId))throw Error('Choose a whole ordinary paragraph from this Article.');
 return updateOutputPlacements(doc,outputId,rows=>rows.map(p=>p.slot===slot?{...p,paragraphId}:p));
}
export function addArticlePhotoAtPosition(doc:Manuscript,outputId:string,paragraphId:string|null,baseline:string):{document:Manuscript;slot:string}{
 const output=doc.outputs.find(o=>o.id===outputId);if(!output||articlePhotoPositionBaseline(doc,output)!==baseline)throw Error('The Article changed. Choose its current photograph position again.');
 if(!articlePhotoPositions(doc,output).some(p=>p.paragraphId===paragraphId))throw Error('Choose a whole ordinary paragraph from this Article.');
 let n=1;while(output.placements.some(p=>p.slot==='photo-'+n))n++;const slot='photo-'+n;
 return {slot,document:updateOutputPlacements(doc,outputId,[...output.placements,{slot,url:'',x:.5,y:.5,zoom:1,alt:'Article photograph',paragraphId}])};
}
export function ArticleLayoutOutline({doc,output,change,onStatus}:{doc:Manuscript;output:Output;change:(next:Manuscript)=>void;onStatus:(message:string)=>void}){
 const host=useRef<HTMLElement>(null),latest=useRef({doc,output,change,onStatus}),dragCleanup=useRef<(()=>void)|null>(null);
 latest.current={doc,output,change,onStatus};
 useEffect(()=>()=>dragCleanup.current?.(),[doc.id,output.id]);
 let groups;try{groups=articleOrderGroups(doc,output);}catch(error){return <section className="cwb-article-outline"><p role="status">Layout order is unavailable: {(error as Error).message}</p></section>;}
 const move=(from:ArticleOrderPosition,to:ArticleOrderPosition,baseline:string,documentId:string,outputId:string)=>{
  const current=latest.current;
  if(current.doc.id!==documentId||current.output.id!==outputId){current.onStatus('The selected output changed. Choose its current layout before moving.');return;}
  try{const next=moveArticleLayoutUnit(current.doc,outputId,from,to,baseline);if(next===current.doc)return;current.change(next);current.onStatus('Layout order updated. Words unchanged.');
   requestAnimationFrame(()=>{const row=[...host.current?.querySelectorAll<HTMLElement>('[data-article-order-container]')||[]].find(el=>el.dataset.articleOrderContainer===to.container&&Number(el.dataset.articleOrderIndex)===to.index);row?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});});
  }catch(error){current.onStatus((error as Error).message);}
 };
 const drag=(event:React.PointerEvent<HTMLButtonElement>,from:ArticleOrderPosition)=>{
  if(event.button!==0)return;event.preventDefault();dragCleanup.current?.();
  const original=latest.current,baseline=articleOrderBaseline(original.doc,original.output),pointerId=event.pointerId,x=event.clientX,y=event.clientY;let target:ArticleOrderPosition|null=null,moved=false;
  const row=event.currentTarget.closest<HTMLElement>('[data-article-order-container]');if(row)row.style.opacity='.55';
  const cleanup=()=>{window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);if(row)row.style.opacity='';dragCleanup.current=null;};
  const pointerMove=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;e.preventDefault();moved||=Math.hypot(e.clientX-x,e.clientY-y)>4;
   const over=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-article-order-container]');target=over&&host.current?.contains(over)?{container:over.dataset.articleOrderContainer!,index:Number(over.dataset.articleOrderIndex)}:null;
  };
  const end=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;cleanup();if(moved&&target)move(from,target,baseline,original.doc.id,original.output.id);};
  const cancel=(e:PointerEvent)=>{if(e.pointerId===pointerId)cleanup();};dragCleanup.current=cleanup;window.addEventListener('pointermove',pointerMove,{passive:false});window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);
 };
 return <section ref={host} className="cwb-article-outline" aria-label="Article section order"><p className="dim small">Drag sections or blocks within their group. Words and photos stay together.</p>{groups.map(group=><section key={group.container} aria-label={group.label}><h3>{group.label}{group.fixed?' · fixed role':''}</h3><div className="lblocks">{group.rows.map((row,index)=><div className="lblock" key={group.container+':'+index} data-article-order-container={group.container} data-article-order-index={index}>{!group.fixed&&group.rows.length>1?<button type="button" className="handle" style={{touchAction:'none',cursor:'grab',minHeight:32}} aria-label={'Reorder '+group.label+' '+(index+1)} title="Drag within this group, or Alt + Up / Down" onPointerDown={event=>drag(event,{container:group.container,index})} onKeyDown={event=>{if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const to=index+(event.key==='ArrowUp'?-1:1);if(to>=0&&to<group.rows.length)move({container:group.container,index},{container:group.container,index:to},articleOrderBaseline(doc,output),doc.id,output.id);}}}>⠿</button>:<span className="x">{group.fixed?'—':index+1}</span>}<div>{row.label}</div></div>)}</div></section>)}<div className="tnote"><b>Articles use the magazine layout.</b> Preview and export read this saved arrangement. Original words and photographs remain unchanged.</div></section>;
}

type CompositionProps={options:WorkspaceOptions;doc:Manuscript;change:(d:Manuscript)=>void};
export function CompositionWorkspace(props:CompositionProps){
 return <CompositionDocumentWorkspace key={outputSelectionKey(props.options.project.id,props.doc.id)} {...props}/>;
}
function CompositionDocumentWorkspace({options,doc,change}:CompositionProps){
 const workspace=useRef<HTMLElement>(null),[titleActions,setTitleActions]=useState<HTMLElement|null>(null),[carouselActions,setCarouselActions]=useState<HTMLSpanElement|null>(null);
 useEffect(()=>{
  const owner=workspace.current,section=owner?.closest('#workspace.wb-arrange');
  if(!section||!document.body.classList.contains('wbf-on')||options.visible===false)return;
  // The shell explicitly retains these nodes when it repaints the title bar.
  // React still owns every control and its callback; nothing is copied or proxied.
  const host=document.createElement('div');host.className='wb-arrange-owner-actions';host.dataset.c3RetainControl='arrange';
  const attach=()=>{const right=section.querySelector('#c3-surface-bar>.sb-right');if(owner?.isConnected&&right&&!right.contains(host)){right.prepend(host);setTitleActions(host);}};
  const observer=new window.MutationObserver(attach);observer.observe(section,{childList:true,subtree:true});attach();
  return()=>{observer.disconnect();setTitleActions(null);host.remove();};
 },[options.visible]);
 const [mode,setMode]=useState<Mode>('outline'),[format,setFormat]=useState<Format>('html'),[selected,setSelected]=useState<string|null>(()=>readOutputSelection(options.project.id,doc.id,doc.outputs)),[phone,setPhone]=useState(false),[artifacts,setArtifacts]=useState<ExportArtifact[]>([]),[exportBusy,setExportBusy]=useState(false),[status,setStatus]=useState(''),[selectedPhoto,setSelectedPhoto]=useState<string|null>(null),[libraryPhotos,setLibraryPhotos]=useState<LibraryPhoto[]>([]);
 const [addingPhoto,setAddingPhoto]=useState(false),[photoPosition,setPhotoPosition]=useState<{value:string;baseline:string}|null>(null);
 const [refreshing,setRefreshing]=useState(false);
 const [making,setMaking]=useState(false),[makeOpened,setMakeOpened]=useState(false),[makeOutputId,setMakeOutputId]=useState<string|undefined>();
 const [articleVisualId,setArticleVisualId]=useState<string|null>(null);
 const newMenu=useRef<HTMLDetailsElement>(null);
 const openMake=(outputId?:string)=>{if(options.compositionCapabilities?.carouselAI===false){setStatus('AI carousel arrangement is unavailable for this native binding.');return;}setMakeOutputId(outputId);setMakeOpened(true);setMaking(true);if(newMenu.current)newMenu.current.open=false;};
 const closeMenu=()=>{if(newMenu.current)newMenu.current.open=false;};
 useEffect(()=>{
  const outside=(event:Event)=>{if(newMenu.current?.open&&!newMenu.current.contains(event.target as Node))closeMenu();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&newMenu.current?.open){closeMenu();newMenu.current.querySelector('summary')?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape);};
 },[]);
 const canvas=useRef<HTMLDivElement>(null),latest=useRef(doc);latest.current=doc;
 const output=doc.outputs.find(o=>o.id===(options.selectedOutputId??selected))||(options.selectedOutputId===undefined?doc.outputs.at(-1):undefined),relationship=output?options.outputRelationship?.(doc,output):undefined,stale=output?(relationship?.stale??outputIsStale(doc,output)):false;
 useEffect(()=>{setAddingPhoto(false);setPhotoPosition(null);},[doc.id,output?.id]);
 useEffect(()=>{
  if(!titleActions)return;
  titleActions.dataset.cwbDocumentId=doc.id;
  if(output)titleActions.dataset.cwbOutputId=output.id;else delete titleActions.dataset.cwbOutputId;
 },[titleActions,doc.id,output?.id]);
 const returnToWriting=()=>{if(options.onOutputWriting)options.onOutputWriting(output?.id);else options.onNavigate?.('create');};
 // Reconcile removed outputs without changing the document or a still-valid choice.
 useEffect(()=>{const id=output?.id||null;if(selected!==id)setSelected(id);writeOutputSelection(options.project.id,doc.id,id);},[selected,output?.id,options.project.id,doc.id]);
 const [nameDraft,setNameDraft]=useState(()=>output?outputName(doc,output):'');
 useEffect(()=>{setNameDraft(output?outputName(doc,output):'');},[output?.id,(output as NamedOutput)?.name]);
 const saveName=()=>{if(!output)return;const current=latest.current,currentOutput=current.outputs.find(item=>item.id===output.id);if(!currentOutput||compactName(nameDraft)===outputName(current,currentOutput))return;const next=renameOutput(current,output.id,nameDraft);latest.current=next;change(next);setNameDraft(outputName(next,next.outputs.find(item=>item.id===output.id)!));};
 const inspectedPhoto=output?.placements.find(p=>p.slot===selectedPhoto)||output?.placements[0];
 const photoPositions=output?.kind==='article'?articlePhotoPositions(doc,output):[],photoBaseline=output?.kind==='article'?articlePhotoPositionBaseline(doc,output):'',positionValue=(id:string|null)=>id===null?'end':'after:'+id;
 const inspectedPosition=inspectedPhoto?photoPositions.find(p=>p.paragraphId===(inspectedPhoto.paragraphId??null)):null,composedPhoto=!!(output?.kind==='article'&&inspectedPhoto&&articlePhotoSlotIsComposed(doc,output,inspectedPhoto.slot));
 const saved=artifacts.filter(a=>a.outputId===output?.id),chosenFormat=formats.find(f=>f.id===format)!;
 useEffect(()=>{let active=true;if(options.api)options.api('/api/exports').then(result=>{if(active)setArtifacts(result.artifacts||[]);}).catch(()=>{});return()=>{active=false;};},[output?.id,options.api]);
 useEffect(()=>{let active=true;if(mode==='photos'&&options.api)options.api('/api/sources/tree').then(result=>{if(active)setLibraryPhotos((result.sources||[]).filter((photo:LibraryPhoto)=>/\.(jpe?g|png|webp)$/i.test(photo.rel_path||'')));}).catch(()=>{if(active)setStatus('The photo library could not be loaded. Open Photos again to retry.');});return()=>{active=false;};},[mode,output?.id,options.api]);
 const createOwned=async(kind:'article'|'carousel')=>{if(!options.onCreateOutput)return;try{await options.ensureSaved?.();const id=await options.onCreateOutput(kind);setSelected(id);setStatus('New output created.');}catch(error){setStatus((error as Error).message);}};
 const makeCarousel=()=>{const next=snapshotCarousel({...doc,title:options.project.title||doc.title});next.slides=next.slides?.map(slide=>slide.photos.some(photo=>photo.src)?slide:{...slide,template:'M12'});change({...doc,outputs:[...doc.outputs,next]});setSelected(next.id);setStatus('Manual copy created: one paragraph per slide. Use Make carousel with AI for adapted writing.');};
 const make=()=>{const next=snapshotOutput({...doc,title:options.project.title||doc.title});change({...doc,outputs:[...doc.outputs,next]});setSelected(next.id);setStatus('New article created.');};
 const undoOwnedArrangement=async()=>{if(!output||!options.onUndoArrangement||options.canUndoArrangement!==true)return;const id=output.id;setRefreshing(true);setStatus('Restoring arrangement…');try{await options.onUndoArrangement(id);setStatus('Arrangement restored. Words unchanged.');}catch(error){setStatus((error as Error).message);}finally{setRefreshing(false);}};
 const refreshOwned=async()=>{if(!output||!options.onRefreshOutput||relationship?.canRefresh!==true||!(relationship?.writingStale===true&&relationship?.sourceStale===false||relationship?.canRefreshUnchangedWriting===true))return;const id=output.id;setRefreshing(true);setStatus('Updating from saved writing…');try{await options.ensureSaved?.();await options.onRefreshOutput(id);setStatus('Updated from saved writing.');}catch(error){setStatus((error as Error).message);}finally{setRefreshing(false);}};
 const recompose=()=>{if(!output)return;try{const current=latest.current,next=recomposeSelectedArticle({...current,title:options.project.title||current.title},output.id);latest.current=next;change(next);setSelected(output.id);setStatus('Article updated. Photo crops retained; previous copy kept in its archive.');}catch(error){setStatus((error as Error).message);}};
 const restoreArticle=()=>{if(!output)return;try{const next=restorePreviousArticle(latest.current,output.id);latest.current=next;change(next);closeMenu();setStatus('Previous article restored. Current manuscript and other outputs unchanged.');}catch(error){setStatus((error as Error).message);}};
 const placements=(update:PlacementUpdate)=>{if(!output)return;const current=latest.current,next=updateOutputPlacements(current,output.id,update);if(next===current)return;latest.current=next;change(next);};
 function patchPhoto(slot:string,patch:Partial<Placement>){placements(rows=>rows.map(photo=>photo.slot===slot?{...photo,...patch}:photo));}
 function selectCanvasPhoto(event:React.SyntheticEvent<HTMLDivElement>){
  if(mode!=='photos'||!(event.target instanceof Element))return;
  const frame=event.target.closest<HTMLElement>('[data-frame-slot]'),slot=frame?.dataset.frameSlot;
  if(slot&&frame&&event.currentTarget.contains(frame)&&output?.placements.some(photo=>photo.slot===slot))setSelectedPhoto(slot);
 }
 useEffect(()=>{
  if(output?.kind!=='article')return;
  const entry={outputId:output.id,focus:async(location:any)=>{
   if(location.kind!=='article'||!output.placements.some(p=>p.slot===location.slot))throw Error('This saved article photograph is no longer available.');
   setMode('photos');setSelectedPhoto(location.slot);
   await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
   const frames=Array.from(canvas.current?.querySelectorAll<HTMLElement>('[data-frame-slot]')||[]).filter(el=>el.dataset.frameSlot===location.slot),frame=frames[location.slotOccurrence||0];
   if(!frame)throw Error('The exact saved photograph occurrence is not rendered.');
   frame.scrollIntoView({block:'center'});frame.focus({preventScroll:true});return {outputId:output.id,slot:location.slot,slotOccurrence:location.slotOccurrence||0};
  }};
  (window as any).studyCompositionFocus=entry;return()=>{if((window as any).studyCompositionFocus===entry)delete (window as any).studyCompositionFocus;};
 },[output]);
 function focusPhoto(slot:string){setSelectedPhoto(slot);requestAnimationFrame(()=>{const frame=Array.from(canvas.current?.querySelectorAll<HTMLElement>('[data-frame-slot]')||[]).find(element=>element.dataset.frameSlot===slot);frame?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});frame?.focus({preventScroll:true});});}
 function addPhoto(cover=false){if(!output)return;if(!cover){setAddingPhoto(true);setPhotoPosition(null);setMode('photos');return;}
  if(!output.placements.some(p=>p.slot==='cover'))placements([...output.placements,{slot:'cover',url:'',x:.5,y:.5,zoom:1,alt:'Cover photograph',paragraphId:null}]);setMode('photos');focusPhoto('cover');
 }
 function confirmPhoto(){if(!output||!photoPosition)return;try{const current=latest.current;if(current.id!==doc.id)throw Error('The selected Article changed.');const next=addArticlePhotoAtPosition(current,output.id,photoPosition.value==='end'?null:photoPosition.value.slice(6),photoPosition.baseline);latest.current=next.document;change(next.document);setAddingPhoto(false);setPhotoPosition(null);focusPhoto(next.slot);setStatus('Photograph position chosen. Select its Library photograph.');}catch(error){setStatus((error as Error).message);setPhotoPosition(null);}}
 function movePhotoPosition(value:string){if(!output||!inspectedPhoto)return;try{const current=latest.current;if(current.id!==doc.id)throw Error('The selected Article changed.');const next=updateArticlePhotoPosition(current,output.id,inspectedPhoto.slot,value==='end'?null:value.slice(6),photoBaseline);latest.current=next;change(next);setStatus('Photograph position updated. Words unchanged.');}catch(error){setStatus((error as Error).message);}}
 async function exportFile(){if(!output||!options.api){setStatus('The export service is unavailable.');return;}setExportBusy(true);setStatus('Saving file…');
  try{await options.ensureSaved?.();const artifact=options.outputExport?await options.outputExport(doc,output,format):await persistOutputExport(options.api,doc,output,format,{readAsset:options.readOutputAsset});setArtifacts(previous=>[artifact,...previous.filter(a=>a.id!==artifact.id)]);setStatus('Saved '+artifact.name+'.');}catch(error){setStatus((error as Error).message);}finally{setExportBusy(false);}
 }
 const toolbar=<header className="cwb-toolbar">
   {titleActions&&output?.kind==='carousel'&&<span className="cwb-carousel-actions" ref={setCarouselActions}/> }
   <div className="cwb-output-identity"><strong title={output?outputName(doc,output):undefined}>{output?outputName(doc,output):'No output yet'}</strong><small id="cwb-output-purpose">{output?output.kind==='article'?'Reading page':outputPurpose(output):'Outputs'}</small></div>
   <details className="cwb-new-output" ref={newMenu}><summary>Output tools <span aria-hidden="true">⌄</span></summary><div className="cwb-new-options"><label className="cwb-rename">Output name<input id="cwb-output-name" aria-label="Output name" aria-describedby="cwb-output-purpose" maxLength={120} value={nameDraft} onChange={event=>setNameDraft(event.target.value)} onBlur={saveName} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}}}/></label>   <div className="cwb-output"><select id="cwb-output" aria-label="Selected output" value="" disabled={!output} onChange={event=>{saveName();if(options.selectedOutputId===undefined)setSelected(event.target.value);options.onOutputSelect?.(event.target.value);setStatus('');setSelectedPhoto(null);}}><option value="" disabled>Switch output{doc.outputs.length?' · '+doc.outputs.length:''}</option>{doc.outputs.map(item=><option key={item.id} value={item.id}>{outputName(doc,item)} · {outputPurpose(item)}</option>)}</select></div>
   {output?.kind==='article'&&options.compositionCapabilities?.articleAI!==false&&<button onClick={()=>{closeMenu();setArticleVisualId(output.id);}}>Arrange article with AI</button>}
   {options.compositionCapabilities?.restore!==false&&!!output?.articleVisualHistory?.length&&<button onClick={async()=>{try{const original=latest.current,next=await restoreArticleArrangement(original,output!.id);if(latest.current!==original)throw Error('The article changed during recovery. Retry.');latest.current=next;change(next);setStatus('Previous article arrangement restored. Words unchanged.');}catch(error){setStatus((error as Error).message);}}}>Restore previous arrangement</button>}
   {options.onUndoArrangement&&options.canUndoArrangement===true&&<button disabled={refreshing} onClick={()=>void undoOwnedArrangement()}>Undo arrangement</button>}
   {output?.kind!=='carousel'&&<div className="cwb-size" role="group" aria-label="Preview width"><button disabled={!output} aria-pressed={!phone} onClick={()=>setPhone(false)}>Fit</button><button disabled={!output} aria-pressed={phone} onClick={()=>setPhone(true)}>Phone</button></div>}
<span className="cwb-menu-label">New output</span>{options.compositionCapabilities?.carouselAI!==false&&<button className="cwb-primary" onClick={()=>openMake()} disabled={!doc.paragraphs.length}>Make carousel with AI</button>}{options.compositionCapabilities?.manualCreate!==false&&<><button onClick={()=>{closeMenu();if(options.onCreateOutput)void createOwned('article');else make();}} disabled={!doc.paragraphs.length}>Article from manuscript</button><button onClick={()=>{closeMenu();if(options.onCreateOutput)void createOwned('carousel');else makeCarousel();}} disabled={!doc.paragraphs.length}>{options.onCreateOutput?'Start carousel wording':'Manual slide copy'}</button></>}{options.compositionCapabilities?.restore!==false&&!!(output as any)?.recomposeHistory?.length&&<button onClick={restoreArticle}>Restore previous article</button>}{titleActions&&<button className="cwb-back" onClick={returnToWriting}>Back to writing</button>}</div></details>
   {!titleActions&&<button className="cwb-back" onClick={returnToWriting}>Back to writing</button>}
  </header>;
 return <section ref={workspace} className="ar-composition-workbench" aria-label="Composition workspace">
  {titleActions?createPortal(toolbar,titleActions):toolbar}
  <div className={'cwb-manuscript-receipt'+(stale?' is-stale':'')} role="status" aria-label="Manuscript relationship"><strong>{relationship?.label||(!output?'From your manuscript':stale?'Manuscript changed':'From current manuscript')}</strong>{stale&&output?.kind==='article'&&relationship?.canUpdate!==false&&<button className="cwb-update" onClick={recompose}>Update from manuscript</button>}{stale&&output?.kind==='article'&&options.onRefreshOutput&&relationship?.canRefresh===true&&(relationship?.writingStale===true&&relationship?.sourceStale===false||relationship?.canRefreshUnchangedWriting===true)&&<button className="cwb-update" disabled={refreshing} onClick={()=>void refreshOwned()}>Update from saved writing</button>}{stale&&output?.kind==='carousel'&&options.compositionCapabilities?.carouselAI!==false&&<button onClick={()=>openMake()}>Make new carousel</button>}</div>
  {makeOpened&&options.compositionCapabilities?.carouselAI!==false&&<MakeCarousel key={doc.id+':'+(makeOutputId||'words')} outputId={makeOutputId} options={options} doc={doc} open={making&&options.visible!==false} change={next=>{latest.current=next;change(next);}} onSelectOutput={setSelected} onClose={()=>setMaking(false)}/>}
  {articleVisualId&&options.compositionCapabilities?.articleAI!==false&&<MakeArticleVisual key={doc.id+':'+articleVisualId} outputId={articleVisualId} options={options} doc={doc} open={options.visible!==false} change={next=>{latest.current=next;change(next);}} onClose={()=>setArticleVisualId(null)}/>}
  {output?.kind==='carousel'?<><CarouselWorkspace actionTarget={titleActions?carouselActions:null} key={output.id} onArrange={options.compositionCapabilities?.carouselAI===false?undefined:({outputId}:any)=>openMake(outputId)} doc={doc} output={output} change={change} options={options} onSelectOutput={setSelected}/></>:<>
  <nav className="cwb-tabs" aria-label="Composition tools">{(['outline','preview','photos','export'] as Mode[]).map(item=><button key={item} aria-selected={mode===item} onClick={()=>setMode(item)}>{item==='outline'?'Article layout':item==='preview'?'Preview':item==='photos'?'Photos':'Export'}{item==='photos'&&output&&<span>{output.placements.filter(p=>p.url).length}</span>}{item==='export'&&saved.length>0&&<span>{saved.length}</span>}</button>)}</nav>
  {output?.articleCompositionNotice&&<div className="cwb-stale" role="status">{output.articleCompositionNotice}</div>}
  {output&&mode==='outline'?<ArticleLayoutOutline key={doc.id+':'+output.id} doc={doc} output={output} change={next=>{latest.current=next;change(next);}} onStatus={setStatus}/>:<div className={'cwb-body'+(mode!=='preview'&&output?' cwb-with-inspector':'')}>

   <div className="cwb-canvas" ref={canvas} onPointerDownCapture={selectCanvasPhoto} onFocusCapture={selectCanvasPhoto} aria-label={phone?'Phone article preview':'Article preview fitted to available space'}>
    {!output?<div className="cwb-empty"><span className="cwb-empty-mark" aria-hidden="true">Aa</span><h1>{doc.paragraphs.length?'Create your article':'Your article starts with the words'}</h1><p>{doc.paragraphs.length?'Bring the current manuscript onto the page, then place photographs and save a file.':'Write a passage in Write. Your sources and wording will come with it.'}</p><button className="cwb-primary" onClick={doc.paragraphs.length?make:returnToWriting}>{doc.paragraphs.length?'Create article':'Open manuscript'}</button></div>:<div className={'ar-output-reader cwb-paper'+(phone?' ar-phone-preview':'')}><LocalStoryProvider key={output.id} placements={output.placements} editing={mode==='photos'} onPlacements={placements} libraryImages={libraryPhotos.map(photoUrl)} mediaApi={options.mediaApi}><ConversationCanvas spec={outputSpec(doc,output)} paragraphs={output.manuscript||doc.paragraphs}/></LocalStoryProvider></div>}
   </div>
   {output&&mode==='photos'&&<aside className="cwb-inspector" aria-label="Photograph inspector"><div className="cwb-inspector-title"><h2>Photographs</h2><span>{output.placements.filter(p=>p.url).length} placed</span></div><div className="cwb-photo-actions"><button onClick={()=>addPhoto(true)}>{output.placements.some(p=>p.slot==='cover')?'Select cover':'Add cover'}</button><button onClick={()=>addPhoto()}>+ Add photograph</button></div>{addingPhoto&&<section className="cwb-photo-details" aria-label="New photograph position"><label className="cwb-field">Position<select aria-label="Position for new photograph" value={photoPosition?.value||''} onChange={event=>setPhotoPosition(event.target.value?{value:event.target.value,baseline:photoBaseline}:null)}><option value="">Choose position</option>{photoPositions.map(position=><option key={positionValue(position.paragraphId)} value={positionValue(position.paragraphId)}>{position.label}</option>)}</select></label><button onClick={confirmPhoto} disabled={!photoPosition}>Add at this position</button><button onClick={()=>{setAddingPhoto(false);setPhotoPosition(null);}}>Cancel</button></section>}<p className="cwb-help">Choose a Library photograph below, or drop, paste or upload on the frame. Adjust its focus and zoom there.</p><div className="cwb-photo-list">{output.placements.map((photo,index)=><button className="cwb-photo-row" key={photo.slot} aria-pressed={inspectedPhoto?.slot===photo.slot} onClick={()=>focusPhoto(photo.slot)}>{photo.url?<img src={photo.url} alt=""/>:<span className="cwb-no-photo" aria-hidden="true">+</span>}<span><strong>{photo.slot==='cover'?'Cover':'Photograph '+(index+(output.placements.some(p=>p.slot==='cover')?0:1))}</strong><small>{photo.url?'Click to adjust':'Choose a photograph'}</small></span></button>)}</div>{inspectedPhoto&&<section className="cwb-photo-details" aria-label="Selected photograph"><h3>{inspectedPhoto.slot==='cover'?'Cover':'Photograph'} details</h3>{composedPhoto?<p className="cwb-help">Recorded composition position · kept</p>:<label className="cwb-field">Position<select aria-label="Photograph position" value={inspectedPosition?positionValue(inspectedPosition.paragraphId):''} onChange={event=>movePhotoPosition(event.target.value)}>{!inspectedPosition&&<option value="" disabled>Existing position · kept</option>}{photoPositions.map(position=><option key={positionValue(position.paragraphId)} value={positionValue(position.paragraphId)}>{position.label}</option>)}</select></label>}<label className="cwb-field">Choose from library<select aria-label="Choose photograph from library" value={inspectedPhoto.url} onChange={event=>{patchPhoto(inspectedPhoto.slot,{url:event.target.value,x:.5,y:.5,zoom:1});setStatus(event.target.value?'Library photograph placed.':'Photograph cleared.');}}><option value="">No photograph</option>{inspectedPhoto.url&&!libraryPhotos.some(photo=>photoUrl(photo)===inspectedPhoto.url)&&<option value={inspectedPhoto.url}>Current photograph</option>}{libraryPhotos.map(photo=><option key={photo.id} value={photoUrl(photo)}>{photo.name||photo.rel_path}</option>)}</select></label>{!libraryPhotos.length&&<p className="cwb-help">Import photographs in Library to reuse them here.</p>}{inspectedPhoto.slot!=='cover'&&<label className="cwb-field">Caption<textarea aria-label="Photograph caption" rows={3} value={inspectedPhoto.caption||''} onChange={event=>patchPhoto(inspectedPhoto.slot,{caption:event.target.value})}/></label>}<label className="cwb-field">Alt text<input aria-label="Photograph alt text" value={inspectedPhoto.alt} onChange={event=>patchPhoto(inspectedPhoto.slot,{alt:event.target.value})}/></label><p className="cwb-help">Alt text describes the photograph for someone who cannot see it.</p></section>}{!output.placements.length&&<div className="cwb-inspector-empty"><p>No photographs placed.</p><p>The article also works with words alone.</p></div>}</aside>}
   {output&&mode==='export'&&<aside className="cwb-inspector" aria-label="Export inspector"><div className="cwb-inspector-title"><h2>Export</h2><span>Private file</span></div><label className="cwb-field" htmlFor="cwb-format">Format<select id="cwb-format" value={format} onChange={event=>setFormat(event.target.value as Format)}>{formats.map(item=><option value={item.id} key={item.id}>{item.name} · {item.extension}</option>)}</select></label><p className="cwb-help">{chosenFormat.description}</p><button className="cwb-primary" disabled={exportBusy} onClick={exportFile}>{exportBusy?'Saving…':'Save '+chosenFormat.name.toLowerCase()}</button><section className="cwb-saved" aria-label="Saved output files"><h3>Saved files <span>{saved.length}</span></h3>{saved.length?saved.map(artifact=><article key={artifact.id}><a href={artifact.url} download={artifact.name}>{artifact.name}<span aria-hidden="true">↓</span></a><small>{new Date(artifact.createdAt).toLocaleString()}</small><details><summary>File location</summary><p>{artifact.path}</p></details></article>):<p className="cwb-help">Saved files will appear here with a download link.</p>}</section></aside>}
  </div>
  }
  <footer className="cwb-status"><span role="status">{status||(!output?'No article selected':mode==='photos'?'Photo changes save with this article.':'Private article')}</span>{output&&<span title={'Based on manuscript revision '+output.manuscriptRevision}>r{output.manuscriptRevision}</span>}</footer>
 </>}
 </section>;
}
