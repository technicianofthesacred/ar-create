/* Version two: the shared pieces every screen may use. Each returns markup (a string) or works on an element the screen
   already drew, so a screen can stay a plain render function. Styles live in shell.css under the same names. */
(function(root){
 'use strict';
 const doc=root.document;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Line icons, drawn for version two. 24 by 24, stroke only, so they take the text colour.
 const PATHS={
  home:'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',search:'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l4 4',plus:'M12 5v14M5 12h14',
  sun:'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon:'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',ask:'M5 5h14v10H10l-5 4z',back:'M15 5l-7 7 7 7',chev:'M9 6l6 6-6 6',right:'M5 12h14M13 6l6 6-6 6',
  up:'M12 19V5M6 11l6-6 6 6',down:'M12 5v14M6 13l6 6 6-6',check:'M5 12l4 4L19 6',undo:'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2',
  mic:'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',photo:'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8.500 9.500v.01M21 15l-5-5-8 9',pen:'M4 20h4L20 8l-4-4L4 16z',
  close:'M6 6l12 12M18 6L6 18',out:'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',grip:'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
 };
 const icon=(name,label)=>`<svg class="v2-ic" viewBox="0 0 24 24" ${label?`role="img" aria-label="${esc(label)}"`:'aria-hidden="true"'} focusable="false"><path d="${PATHS[name]||''}"/></svg>`;

 /** How far something is, 0 to 1, as the one ring. label (optional) is said to screen readers and shown beside it. */
 function ring(progress,{label='',size='',title=''}={}){
  const p=Math.max(0,Math.min(1,Number(progress)||0));
  const mark=`<i class="v2-ring${p>=1?' full':''}${size?' '+size:''}" style="--p:${p.toFixed(2)}" aria-hidden="true"></i>`;
  return label?`<span class="v2-ringed"${title?` title="${esc(title)}"`:''}>${mark}<span>${esc(label)}</span></span>`:mark;
 }
 /** One step's marker. state: done | now | flag (needs a look) | todo | wait (waits for something). */
 const STEP_SAY={done:'Done',now:'Open now',flag:'Needs a look',todo:'To do',wait:'Waiting'};
 function step(state){const s=STEP_SAY[state]?state:'todo';return `<i class="v2-step" data-state="${s}" role="img" aria-label="${STEP_SAY[s]}"></i>`;}

 /** Says plainly that a part is not built yet; with advanced, links to the same place in the existing workspace. */
 function notBuilt(what='',{advanced=null}={}){
  const href=advanced?root.v2?.advanced?.(advanced===true?{}:advanced):'';
  return `<div class="v2-notbuilt" data-v2-notbuilt><p><b>Not built yet.</b>${what?' '+esc(what):''}</p>${href?`<a class="v2-out" href="${esc(href)}">Open in Advanced${icon('out')}</a>`:''}</div>`;
 }

 // ---- the message area: one quiet line at a time, read out to screen readers ----
 let area=null,timer=null;
 const msgArea=()=>area||=doc.getElementById('v2-messages');
 /** A plain message. tone: info | good | warn | bad. Returns a function that clears it. */
 function say(message,{tone='info',timeout=tone==='bad'||tone==='warn'?0:6000,action=null}={}){
  const box=msgArea();if(!box)return ()=>{};clearTimeout(timer);
  const row=doc.createElement('p');row.className='v2-msg';row.dataset.tone=tone;
  const text=doc.createElement('span');text.textContent=String(message||'');row.append(text);
  if(action){const b=doc.createElement('button');b.type='button';b.className='v2-ghost';b.innerHTML=(action.icon?icon(action.icon):'')+esc(action.label);b.addEventListener('click',()=>{try{action.run();}finally{clear();}});row.append(b);}
  const close=doc.createElement('button');close.type='button';close.className='v2-ghost v2-icon-btn';close.setAttribute('aria-label','Dismiss');close.innerHTML=icon('close');close.addEventListener('click',()=>clear());row.append(close);
  box.replaceChildren(row);const clear=()=>{if(row.isConnected)row.remove();};
  if(timeout)timer=setTimeout(clear,timeout);
  return clear;
 }
 /** An Undo note: the message with one Undo button. run() takes the change back. */
 const undo=(message,run,{timeout=10000}={})=>say(message,{tone:'good',timeout,action:{label:'Undo',icon:'undo',run}});

 /** A sheet over the screen (a dialog): a bottom sheet on a phone, a centred one on a computer. body is markup or a
     node. Returns {el, body, close}. Escape and the backdrop close it; focus returns to where it was. */
 function sheet({title,body='',label,onClose,close:closeButton=true}={}){
  const opener=doc.activeElement,d=doc.createElement('dialog');d.className='v2-sheet';d.setAttribute('aria-label',label||title||'Sheet');
  d.innerHTML=`<div class="v2-sheet-in"><header><h2 tabindex="-1">${esc(title||'')}</h2>${closeButton?`<button type="button" class="v2-ghost v2-icon-btn" data-v2-close aria-label="Close">${icon('close')}</button>`:''}</header><div class="v2-sheet-body"></div></div>`;
  const content=d.querySelector('.v2-sheet-body');if(typeof body==='string')content.innerHTML=body;else if(body)content.append(body);
  let done=false;const close=()=>{if(done)return;done=true;try{d.close();}catch{}d.remove();try{onClose?.();}finally{opener?.focus?.({preventScroll:true});}};
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-v2-close]'))close();});
  d.addEventListener('cancel',e=>{e.preventDefault();close();});
  doc.body.append(d);if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
  d.querySelector('h2')?.focus({preventScroll:true});
  return {el:d,body:content,close};
 }

 /** Reorder by dragging (mouse), and by Move up and Move down (touch and keys; Alt with an arrow key also moves the
     focused item). container holds the items; item is a selector for them. onMove(from, to) is told the indexes and
     does the saving; the shell only moves the element. Returns a function that stops it. */
 function reorder(container,{item,onMove,label=el=>el.textContent.trim().slice(0,60)}={}){
  if(!container||!item)return ()=>{};
  const items=()=>[...container.querySelectorAll(':scope > '+item)];
  const announce=(el,to,count)=>say(`${label(el)} moved to place ${to+1} of ${count}.`,{timeout:3000});
  const move=async(el,to)=>{const list=items(),from=list.indexOf(el);if(from<0||to<0||to>=list.length||to===from)return;
   const target=list[to];if(to>from)target.after(el);else target.before(el);decorate();
   try{await onMove?.(from,to);announce(el,to,list.length);}catch(error){/* put it back */const now=items(),back=now[from];if(back&&back!==el){if(from>to)back.after(el);else back.before(el);}decorate();say(error?.message||'The new order could not be saved.',{tone:'bad'});}};
  function decorate(){const list=items();list.forEach((el,i)=>{el.draggable=true;el.dataset.v2Reorder='';let bar=el.querySelector(':scope > .v2-move');if(!bar){bar=doc.createElement('span');bar.className='v2-move';bar.innerHTML=`<button type="button" class="v2-ghost v2-icon-btn" data-v2-up>${icon('up')}</button><button type="button" class="v2-ghost v2-icon-btn" data-v2-down>${icon('down')}</button>`;el.append(bar);}
   const name=label(el);bar.querySelector('[data-v2-up]').setAttribute('aria-label','Move up: '+name);bar.querySelector('[data-v2-down]').setAttribute('aria-label','Move down: '+name);
   bar.querySelector('[data-v2-up]').disabled=i===0;bar.querySelector('[data-v2-down]').disabled=i===list.length-1;});}
  /** Focus stays on the same card's Move button through the move and the save (moving the card in the page drops focus, and a button at the end of the list is disabled, so the other one is used). */
  const keep=(el,sel)=>{const bar=el.querySelector(':scope > .v2-move');if(!bar)return;let b=bar.querySelector(sel);if(!b||b.disabled)b=bar.querySelector(sel==='[data-v2-up]'?'[data-v2-down]':'[data-v2-up]');if(b&&!b.disabled&&doc.activeElement!==b)b.focus({preventScroll:true});};
  let dragging=null;
  const onClick=e=>{const b=e.target.closest('[data-v2-up],[data-v2-down]');if(!b||!container.contains(b))return;const el=b.closest('[data-v2-reorder]');const i=items().indexOf(el);e.preventDefault();const up=b.hasAttribute('data-v2-up'),done=move(el,i+(up?-1:1));keep(el,up?'[data-v2-up]':'[data-v2-down]');void done.then(()=>keep(el,up?'[data-v2-up]':'[data-v2-down]'));};
  const onKey=e=>{if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;const el=e.target.closest?.('[data-v2-reorder]');if(!el||el.parentElement!==container)return;e.preventDefault();const i=items().indexOf(el);const target=e.target,done=move(el,i+(e.key==='ArrowUp'?-1:1));if(target.matches?.('[data-v2-up],[data-v2-down]'))keep(el,target.hasAttribute('data-v2-up')?'[data-v2-up]':'[data-v2-down]');else target.focus?.();void done.then(()=>{if(target.matches?.('[data-v2-up],[data-v2-down]'))keep(el,target.hasAttribute('data-v2-up')?'[data-v2-up]':'[data-v2-down]');else target.focus?.();});};
  const onStart=e=>{const el=e.target.closest?.('[data-v2-reorder]');if(!el||el.parentElement!==container)return;dragging=el;el.classList.add('v2-dragging');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','');}catch{}};
  const onOver=e=>{if(!dragging)return;const el=e.target.closest?.('[data-v2-reorder]');if(!el||el.parentElement!==container)return;e.preventDefault();items().forEach(x=>x.classList.toggle('v2-drop',x===el&&x!==dragging));};
  const onDrop=e=>{if(!dragging)return;const el=e.target.closest?.('[data-v2-reorder]');e.preventDefault();const from=dragging;end();if(el&&el.parentElement===container)void move(from,items().indexOf(el));};
  const end=()=>{dragging?.classList.remove('v2-dragging');items().forEach(x=>x.classList.remove('v2-drop'));dragging=null;};
  container.addEventListener('click',onClick);container.addEventListener('keydown',onKey);container.addEventListener('dragstart',onStart);container.addEventListener('dragover',onOver);container.addEventListener('drop',onDrop);container.addEventListener('dragend',end);
  decorate();
  return ()=>{for(const [t,f] of [['click',onClick],['keydown',onKey],['dragstart',onStart],['dragover',onOver],['drop',onDrop],['dragend',end]])container.removeEventListener(t,f);};
 }

 root.V2Parts=Object.freeze({esc,icon,ring,step,notBuilt,say,undo,sheet,reorder});
})(window);
