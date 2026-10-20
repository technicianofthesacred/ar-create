/* C3 inspector. In the writing view the right-hand column gets the board's tabs: Margin (study.js #margin, untouched and
   still aligned beside its passages), Decisions (the human-direction record #downstream-human-direction, moved here by
   id; its owner keeps repainting it) and Readiness (where checks and export readiness actually live: Check and Audience).
   Nothing here saves, approves or exports. Install after human-direction and surface-bar. */
(()=>{
 if(window.c3Inspector)return;
 const TABS=[['margin','Margin'],['decisions','Decisions'],['readiness','Readiness']];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let queued=false;
 const tab=()=>{const t=state.projectNavigation?.inspectorTab;return TABS.some(([k])=>k===t)?t:'margin';};
 function setTab(t){state.projectNavigation||={recent:[]};state.projectNavigation.inspectorTab=t;try{save();}catch{}decorate();}
 function decorate(){
  const desk=document.querySelector('#app .workspace .desk'),margin=desk?.querySelector(':scope>#margin');
  if(!desk||!margin)return;
  desk.classList.add('c3-insp-desk');
  const t=tab();desk.dataset.insp=t;
  let head=desk.querySelector(':scope>#c3-insp-head');
  if(!head){head=document.createElement('div');head.id='c3-insp-head';head.setAttribute('role','tablist');head.setAttribute('aria-label','Inspector');desk.insertBefore(head,margin);}
  const headHTML=TABS.map(([k,l])=>`<button type="button" role="tab" class="ci-tab" data-ci-tab="${k}" aria-selected="${k===t}" aria-controls="c3-insp-${k}">${l}</button>`).join('');
  if(head.dataset.render!==headHTML){head.innerHTML=headHTML;head.dataset.render=headHTML;}
  let dec=desk.querySelector(':scope>#c3-insp-decisions');
  if(!dec){dec=document.createElement('section');dec.id='c3-insp-decisions';dec.className='ci-panel';dec.setAttribute('role','tabpanel');dec.setAttribute('aria-label','Decisions');desk.append(dec);}
  const record=document.getElementById('downstream-human-direction');
  if(record&&record.parentElement!==dec)dec.append(record);
  let empty=dec.querySelector(':scope>.ci-empty');
  if(!record||!record.textContent.trim()){if(!empty){empty=document.createElement('p');empty.className='ci-empty';empty.textContent='No saved direction for this piece yet. Decisions are made in Direction and carried here.';dec.prepend(empty);}}
  else empty?.remove();
  let ready=desk.querySelector(':scope>#c3-insp-readiness');
  if(!ready){ready=document.createElement('section');ready.id='c3-insp-readiness';ready.className='ci-panel';ready.setAttribute('role','tabpanel');ready.setAttribute('aria-label','Readiness');desk.append(ready);
   ready.innerHTML=`<p class="ci-lead">Readiness is checked against a saved revision, not while you type.</p><div class="ci-row"><div><strong>Checks</strong><span>Mechanical checks and quote fidelity run in Check, on the saved manuscript.</span></div><button type="button" class="ci-go" data-ci-go="7">Open Check</button></div><div class="ci-row"><div><strong>Export readiness</strong><span>Missing assets and out-of-date approvals that block export are shown in Audience view for the selected output.</span></div><button type="button" class="ci-go" data-ci-go="10">Open Audience view</button></div>`;}
 }
 document.addEventListener('click',event=>{
  const b=event.target.closest?.('#c3-insp-head [data-ci-tab]');if(b){setTab(b.dataset.ciTab);document.querySelector(`#c3-insp-head [data-ci-tab="${b.dataset.ciTab}"]`)?.focus();return;}
  const go=event.target.closest?.('#c3-insp-readiness [data-ci-go]');if(go){void viewPhase(Number(go.dataset.ciGo));}
 });
 document.addEventListener('keydown',event=>{
  const b=event.target.closest?.('#c3-insp-head [data-ci-tab]');if(!b||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  const i=TABS.findIndex(([k])=>k===b.dataset.ciTab),n=TABS[(i+(event.key==='ArrowRight'?1:TABS.length-1))%TABS.length][0];event.preventDefault();setTab(n);document.querySelector(`#c3-insp-head [data-ci-tab="${n}"]`)?.focus();
 });
 const previousRender=window.render;
 window.render=function(...args){const result=previousRender.apply(this,args);if(result?.then)return result.then(value=>{decorate();return value;});decorate();return result;};
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 window.c3Inspector={decorate,tab};
 decorate();
})();
