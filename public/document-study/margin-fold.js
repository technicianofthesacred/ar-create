/* Fold the margin away on mid-width windows (901-1279px) in Write, Read and Check, as a Material 3 side sheet.
   Closed, the text keeps the whole column. A "Margin" button in the heading row opens the margin over the right edge;
   its Close button or Escape folds it again, and focus moves into the sheet and back to the button. The choice is kept
   in this browser. Wide windows keep the docked pane (supporting-pane.css); narrow ones keep the margin under the text.
   Nothing here changes the margin's content or what it saves. Without a heading row to hold the button, nothing folds. */
(()=>{
 if(window.arMarginFold)return;
 const PREF='ar-margin-fold-v1',MID='(min-width:901px) and (max-width:1279px)';
 let open=false;try{open=localStorage.getItem(PREF)==='open';}catch{}
 const icon='<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M15 4.5v15"/></svg>';
 const mid=()=>window.matchMedia?.(MID)?.matches===true;
 const margin=()=>document.querySelector('#workspace>.desk>#margin');
 const applies=()=>{const b=document.body;return mid()&&!!margin()&&['5','6','7'].includes(b.dataset.c3Stage)&&!b.classList.contains('wbf-drawer-open')&&b.dataset.draftFocus!=='true';};
 function host(){
  for(const bar of [document.getElementById('c3-surface-bar'),document.getElementById('combined-piece-frame')]){
   if(!bar||!bar.getClientRects().length)continue;
   const focus=[...bar.querySelectorAll('button')].find(b=>/^\s*Focus\s*$/.test(b.textContent)&&b.getClientRects().length);
   if(focus)return {parent:focus.parentElement,before:focus};
   const group=bar.querySelector('.sb-right');if(group)return {parent:group,before:null};
  }
  return null;
 }
 function store(){try{localStorage.setItem(PREF,open?'open':'closed');}catch{}}
 function closeButton(m){
  let c=m.querySelector(':scope>.ar-fold-close');
  if(!c){c=document.createElement('button');c.type='button';c.className='ar-fold-close';c.dataset.arFold='close';c.textContent='Close';c.setAttribute('aria-label','Close the margin');m.prepend(c);}
  return c;
 }
 function decorate(){
  const b=document.body,m=margin(),h=applies()?host():null;
  let btn=document.querySelector('[data-ar-fold="toggle"]');
  if(!h){btn?.remove();m?.querySelector(':scope>.ar-fold-close')?.remove();if(b.dataset.arFold)delete b.dataset.arFold;return;}
  if(!btn){btn=document.createElement('button');btn.type='button';btn.className='sb-btn ar-fold-btn';btn.dataset.arFold='toggle';btn.setAttribute('aria-controls','margin');btn.innerHTML=`${icon}<span>Margin</span>`;}
  // Look like its neighbour: take the Focus button's classes, minus anything that names Focus itself.
  const look=h.before?[...h.before.classList].filter(c=>!/focus/i.test(c)).concat('ar-fold-btn').join(' '):'sb-btn ar-fold-btn';
  if(btn.className!==look)btn.className=look;
  if(btn.parentElement!==h.parent||btn.nextElementSibling!==h.before){const had=document.activeElement===btn;h.parent.insertBefore(btn,h.before);if(had)btn.focus();}
  const state=open?'open':'closed';
  if(btn.getAttribute('aria-expanded')!==String(open))btn.setAttribute('aria-expanded',String(open));
  btn.title=open?'Fold the margin away':'Show the margin beside the text';
  if(b.dataset.arFold!==state)b.dataset.arFold=state;
  const c=closeButton(m);c.hidden=!open;
  // The sheet starts below the heading row (a side sheet sits under the top bar), never above the work area.
  const barEl=h.parent.closest('#c3-surface-bar,#combined-piece-frame'),wsTop=document.getElementById('workspace')?.getBoundingClientRect().top||0;
  const top=Math.round(Math.max(0,wsTop,barEl?.getBoundingClientRect().bottom||0))+'px';
  if(b.style.getPropertyValue('--ar-sheet-top')!==top)b.style.setProperty('--ar-sheet-top',top);
 }
 function set(next,{returnFocus=false}={}){
  open=next;store();decorate();
  if(open)margin()?.querySelector(':scope>.ar-fold-close')?.focus?.();
  else if(returnFocus){const back=()=>document.querySelector('[data-ar-fold="toggle"]')?.focus?.();back();setTimeout(back,0);}
 }
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('[data-ar-fold]');if(!t)return;
  if(t.dataset.arFold==='toggle')return set(!open,{returnFocus:true});
  if(t.dataset.arFold==='close')return set(false,{returnFocus:true});
 });
 // The open sheet is the top layer, so its Escape stops here instead of also reaching the editor's own Escape.
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&open&&document.body.dataset.arFold==='open'){event.preventDefault();event.stopImmediatePropagation();set(false,{returnFocus:true});}},true);
 const previousRender=window.render;
 if(typeof previousRender==='function')window.render=function(...args){const result=previousRender.apply(this,args);if(result?.then)return result.then(value=>{decorate();return value;});decorate();return result;};
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 new MutationObserver(()=>decorate()).observe(document.body,{attributes:true,attributeFilter:['class','data-c3-stage','data-draft-focus']});
 window.matchMedia?.(MID)?.addEventListener?.('change',()=>decorate());
 window.addEventListener('resize',()=>decorate());
 document.addEventListener('scroll',()=>{if(open)decorate();},{capture:true,passive:true});
 window.arMarginFold={decorate,set,get open(){return open;}};
 decorate();
})();
