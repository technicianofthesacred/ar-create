/* Navigate existing editorial notes. No manuscript or note authority is introduced. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ArSourceNoteNavigation=api;})(typeof window!=='undefined'?window:null,function(){
 const text=(doc,html)=>{const node=doc.createElement('div');node.innerHTML=html||'';return node.textContent.replace(/\s+/g,' ').trim()};
 function resolveNote(project,note,records,doc){
  const fail=reason=>({ok:false,reason});
  if(!project||!note||!note.anchor)return fail('This note has no linked passage.');
  const blocks=(project.blocks||[]).filter(b=>b.id===note.anchor);
  if(blocks.length!==1)return fail(blocks.length?'This passage link is ambiguous.':'The linked passage is no longer in this writing.');
  const manuscript=doc.getElementById('manuscript');
  const nodes=manuscript?[...manuscript.querySelectorAll('[data-block]')].filter(n=>n.dataset.block===note.anchor):[];
  if(nodes.length!==1)return fail(nodes.length?'This passage link is ambiguous.':'Open the current writing to see this passage.');
  const block=blocks[0],target=nodes[0];
  if(text(doc,target.innerHTML)!==text(doc,block.html))return fail('This passage has unsaved changes. Save before following its note.');
  if(Number.isInteger(note.anchorIndex)){
   const sources=(records?.words||[]).filter(r=>r.path===note.path);
   if(sources.length!==1)return fail(sources.length?'This source link is ambiguous.':'The source for this note is unavailable.');
   const source=doc.createElement('div');source.innerHTML=sources[0].html||'';
   const original=source.children[note.anchorIndex];
   if(!original)return fail('This note has no verified passage in its source.');
   if(text(doc,original.innerHTML)!==text(doc,block.html))return fail('This passage has changed since the note was recorded. Review the note before reconnecting it.');
  }
  if(note.path&&block.source&&note.path!==block.source&&block.source!=='Owned working copy · '+block.id)return fail('This note belongs to a different source.');
  return {ok:true,target};
 }
 function install({document:doc,getProject,getRecords=()=>null,getSelection=()=>null,setSelection=()=>{},onMobileSelection=()=>{}}){
  function clear(){doc.querySelectorAll('[data-source-note-active]').forEach(n=>n.removeAttribute('data-source-note-active'));doc.querySelectorAll('.source-note-focus').forEach(n=>n.classList.remove('source-note-focus'));doc.querySelectorAll('[data-source-note-selected]').forEach(n=>n.removeAttribute('data-source-note-selected'));doc.querySelectorAll('.originalNote button[aria-pressed]').forEach(n=>n.setAttribute('aria-pressed','false'));}
  function status(card,message){let el=card?.querySelector('.source-note-status');if(!el&&card){el=doc.createElement('div');el.className='source-note-status';el.setAttribute('role','status');card.append(el)}if(el)el.textContent=message;}
  function select(index,{scroll=true,persist=true}={}){
   clear();const p=getProject(),note=p?.originalNotes?.[index],card=[...doc.querySelectorAll('.originalNote[data-note-index]')].find(n=>Number(n.dataset.noteIndex)===index);
   const result=resolveNote(p,note,getRecords(p),doc);
   doc.querySelectorAll('.source-note-status').forEach(n=>n.remove());
   if(!result.ok){status(card,result.reason);if(persist)setSelection(null);return result;}
   result.target.setAttribute('data-source-note-active','true');doc.getElementById('manuscript').classList.add('source-note-focus');
   card?.setAttribute('data-source-note-selected','true');card?.querySelector('button')?.setAttribute('aria-pressed','true');
   if(persist)setSelection({projectId:p.id,index,anchor:note.anchor,path:note.path||''});
   if(scroll){result.target.scrollIntoView?.({behavior:'instant',block:'center'});onMobileSelection(result.target);}
   return result;
  }
  function decorate(){
   clear();const p=getProject();
   doc.querySelectorAll('.originalNote[data-note-index]').forEach(card=>{
    const index=Number(card.dataset.noteIndex),button=card.querySelector('button');
    card.setAttribute('role','group');card.setAttribute('aria-label','Editorial note '+(index+1));
    if(button){button.removeAttribute('onclick');button.type='button';button.textContent='Show passage';button.setAttribute('aria-label','Show passage for note '+(index+1));button.setAttribute('aria-pressed','false');}
    if(!card.dataset.sourceNoteWired){card.dataset.sourceNoteWired='true';card.addEventListener('click',event=>{if(event.target.closest('a,input,textarea,select'))return;event.preventDefault();event.stopPropagation();select(index);});}
   });
   const saved=getSelection();if(saved&&saved.projectId===p?.id){const note=p.originalNotes?.[saved.index];if(note&&note.anchor===saved.anchor&&(note.path||'')===saved.path)select(saved.index,{scroll:false,persist:false});}
  }
  doc.addEventListener('input',event=>{if(event.target.closest?.('#manuscript')){clear();setSelection(null)}});
  return {decorate,select,clear};
 }
 if(typeof window!=='undefined'&&typeof document!=='undefined'&&typeof current==='function'){
  const navigation=install({document,getProject:()=>current(),getRecords:p=>typeof WORKFLOW_RECORDS==='object'?WORKFLOW_RECORDS[p.id]:null,getSelection:()=>state.sourceNoteSelection,setSelection:value=>{state.sourceNoteSelection=value;save()},onMobileSelection:target=>{if(innerWidth<=850){marginOpen=false;document.getElementById('margin')?.classList.remove('mobileVisible');target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}});
  const priorRender=render;render=function(){const result=priorRender.apply(this,arguments);navigation.decorate();return result};
  const priorRefresh=refreshDiscussion;refreshDiscussion=function(){const result=priorRefresh.apply(this,arguments);navigation.decorate();return result};
  /* Keep legacy callers safe: a shared anchor does not identify one note. */
  window.jumpSourceNote=function(anchor){const notes=current()?.originalNotes||[],matches=notes.map((n,i)=>n.anchor===anchor?i:-1).filter(i=>i>=0);if(matches.length===1)return navigation.select(matches[0]);navigation.clear();};
  navigation.decorate();window.studySourceNotes=navigation;
 }
 return {resolveNote,install};
});
