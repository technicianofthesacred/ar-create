/* C3 inspector. In the writing view the right-hand column gets two tabs: Margin (study.js #margin, untouched and
   still aligned beside its passages) and Decisions (the human-direction record #downstream-human-direction, moved here
   by id; its owner keeps repainting it). Readiness is not a tab: checks live on Check, export readiness on Audience.
   Nothing here saves, approves or exports. Install after human-direction and surface-bar. */
(()=>{
 if(window.c3Inspector)return;
 const TABS=[['margin','Margin'],['decisions','Decisions']]; // Readiness lives on Check and Audience (review A7)
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
  if(record&&record.parentElement!==dec&&!record.closest('#wbf-drawer'))dec.append(record);
  let empty=dec.querySelector(':scope>.ci-empty');
  if(!record||!record.textContent.trim()){if(!empty){empty=document.createElement('p');empty.className='ci-empty';empty.textContent='No saved direction for this piece yet. Decisions are made in Direction and carried here.';dec.prepend(empty);}}
  else empty?.remove();
  desk.querySelector(':scope>#c3-insp-readiness')?.remove();
  sample(desk.querySelector(':scope>#margin'));
 }
 // A sample proposal never opens by itself: it waits behind one quiet line until the person asks for it, and when it is
 // shown it carries a visible Sample badge (i64 OS: mock data must say so). Starting a discussion shows it at once.
 let sampleShown=false;
 function sample(margin){
  const d=margin?.querySelector('#discussion');let gate=margin?.querySelector(':scope>.ci-sample-gate');
  if(!d){gate?.remove();return;}
  d.classList.add('ci-sample');
  if(sampleShown){d.hidden=false;gate?.remove();return;}
  d.hidden=true;
  if(!gate){gate=document.createElement('div');gate.className='ci-sample-gate';gate.innerHTML='<span class="ci-badge">Sample</span><span>A sample editorial discussion is kept for this passage. It is not a live AI response.</span><button type="button" data-ci-sample>Show the sample</button>';d.before(gate);}
 }
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-ci-sample]')||event.target.closest?.('#app [onclick^="openInstruction"],#app [onclick^="prepareNote"]')){sampleShown=true;queueMicrotask(decorate);}},true);
 document.addEventListener('click',event=>{
  const b=event.target.closest?.('#c3-insp-head [data-ci-tab]');if(b){setTab(b.dataset.ciTab);document.querySelector(`#c3-insp-head [data-ci-tab="${b.dataset.ciTab}"]`)?.focus();return;}
 });
 document.addEventListener('keydown',event=>{
  const b=event.target.closest?.('#c3-insp-head [data-ci-tab]');if(!b||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  const i=TABS.findIndex(([k])=>k===b.dataset.ciTab),n=TABS[(i+(event.key==='ArrowRight'?1:TABS.length-1))%TABS.length][0];event.preventDefault();setTab(n);document.querySelector(`#c3-insp-head [data-ci-tab="${n}"]`)?.focus();
 });
 window.c3Inspector={decorate,tab,showSample:()=>{sampleShown=true;decorate();}};
 window.c3Shell.register('inspector',decorate,{order:40});
})();
