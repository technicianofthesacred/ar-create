/* C3 compact checkpoint list. After every render, the twelve grouped checkpoint buttons (built by study.js workflowBar,
   patched by its wrappers, grouped by workspace-navigation) move out of the scrolling workspace into a slim left column.
   The buttons themselves, their viewPhase(n) handlers, aria labels and titles are untouched; this adds an icon, a state
   dot and a phone picker. If the grouped bar is missing or incomplete, nothing moves. Install after workspace-navigation. */
(()=>{
 if(window.checkpointRail)return;
 const ICONS=['<path d="M4 13.5 6.5 5h11l2.5 8.5"/><path d="M4 13.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5.5"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>','<path d="M5 10v4"/><path d="M8.5 7v10"/><path d="M12 4.5v15"/><path d="M15.5 8v8"/><path d="M19 10.5v3"/>','<path d="M9.5 3.5h5"/><path d="M10.5 3.5v6l-5.3 8.9A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.6-2.6L13.5 9.5v-6"/><path d="M7.6 15h8.8"/>','<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>','<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="M13 7l4 4"/>','<path d="M3.5 6.5c2-1 5-1 8.5.5 3.5-1.5 6.5-1.5 8.5-.5V19c-2-1-5-1-8.5.5C8.5 18 5.5 18 3.5 19z"/><path d="M12 7v12.5"/>','<path d="M4 7h9"/><path d="M4 12h9"/><path d="M4 17h6"/><path d="M14.5 16.5l2 2 4-4.5"/>','<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3.5 16l5-4.5 4 3.5 3-2.5 5 4"/>','<rect x="3.5" y="4" width="7.5" height="7" rx="1"/><rect x="13" y="4" width="7.5" height="4" rx="1"/><rect x="13" y="10" width="7.5" height="10" rx="1"/><rect x="3.5" y="13" width="7.5" height="7" rx="1"/>','<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>','<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>','<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5"/>'];
 const svg=d=>`<svg class="cr-icon" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const number=b=>Number(b.querySelector('.stepNumber')?.textContent.trim());
 function viewed(){const p=current();return p.view==='record'&&Number(p.viewedStage)||(p.view==='article'?5:0);}
 function decorate(){
  const shell=document.querySelector('#app>.shell'),workspace=shell?.querySelector(':scope>.workspace');
  const nav=document.querySelector('.workflowNavigation'),grid=nav?.querySelector('.workflowSteps[data-work-groups]');
  if(!shell||!workspace||!nav||!grid)return;
  const buttons=[...grid.querySelectorAll('.workflowStep')];
  if(buttons.length!==12||buttons.some(b=>!(number(b)>=1&&number(b)<=12)))return;
  for(const b of buttons){
   if(!b.querySelector('.cr-icon'))b.insertAdjacentHTML('afterbegin',svg(ICONS[number(b)-1]));
   let dot=b.querySelector('.cr-dot');if(!dot){dot=document.createElement('span');dot.className='cr-dot';dot.setAttribute('aria-hidden','true');b.append(dot);}
   dot.dataset.state=b.classList.contains('isCurrent')?'current':b.querySelector('.recordDot')?'record':'none';
  }
  const n=viewed(),here=buttons.find(b=>number(b)===n),name=here?.querySelector('.stepName')?.textContent||'';
  let picker=nav.querySelector(':scope>.cr-picker');
  if(!picker){picker=document.createElement('button');picker.type='button';picker.className='cr-picker';picker.setAttribute('aria-expanded','false');nav.prepend(picker);}
  const pickerHTML=`<span class="cr-picker-text"><span class="cr-picker-count">${n?`Checkpoint ${n} of 12`:'Checkpoints'}</span><strong>${name||'Choose a checkpoint'}</strong></span><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m7 10 5 5 5-5"/></svg>`;
  if(picker.dataset.key!==n+'|'+name){picker.innerHTML=pickerHTML;picker.dataset.key=n+'|'+name;}
  picker.setAttribute('aria-label',`${n?`Checkpoint ${n} of 12, ${name}. `:''}Show all twelve checkpoints`);
  nav.classList.add('c3-rail');
  if(nav.parentElement!==shell||nav.nextElementSibling!==workspace)shell.insertBefore(nav,workspace);
  document.body.classList.add('c3-rail-on');
 }
 document.addEventListener('click',event=>{
  const picker=event.target.closest?.('.workflowNavigation.c3-rail>.cr-picker');if(!picker)return;
  const nav=picker.parentElement,open=!nav.classList.contains('cr-open');
  nav.classList.toggle('cr-open',open);picker.setAttribute('aria-expanded',String(open));
  if(open)nav.querySelector('.workflowStep[aria-current],.workflowStep')?.focus();
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const nav=document.querySelector('.workflowNavigation.c3-rail.cr-open');if(!nav)return;
  nav.classList.remove('cr-open');const picker=nav.querySelector('.cr-picker');picker?.setAttribute('aria-expanded','false');picker?.focus();
 });
 const previousRender=window.render;
 window.render=function(...args){const result=previousRender.apply(this,args);if(result?.then)return result.then(value=>{decorate();return value;});decorate();return result;};
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 window.checkpointRail={decorate};
 decorate();
})();
