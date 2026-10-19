/* C3 canvas for Write, Read and Check. Adds the board's small heading line ("05 Write · …") above the manuscript, gives
   Read the inspector column (Margin, Decisions, Readiness pointing to where that work actually happens), and marks the
   page so Check's own panel can sit as the right-hand column. Owners keep their markup; this only adds and decorates.
   Install after inspector. */
(()=>{
 if(window.c3Canvas)return;
 const LINES={5:['Write','The same manuscript as Read and Check'],6:['Read','The same manuscript, read as your audience will'],7:['Check','The same manuscript, checked against its saved revision']};
 const TABS=[['margin','Margin'],['decisions','Decisions'],['readiness','Readiness']];
 let queued=false;
 const stage=()=>{const p=current();return p.view==='record'?Number(p.viewedStage)||0:p.view==='article'?5:0;};
 const status=()=>document.querySelector('#c3-surface-bar .sb-status')?.textContent.trim()||'';
 function titleHTML(n){const [name,line]=LINES[n],s=status();return `<span class="c3t-n">${String(n).padStart(2,'0')}</span><span class="c3t-name">${name}</span><span class="c3t-line">${line}${s?' · '+s.replace(/</g,'&lt;'):''}</span>`;}
 function ensureTitle(host,n,before){
  if(!host)return;
  let t=host.querySelector(':scope>.c3-ctitle');
  if(!t){t=document.createElement('div');t.className='c3-ctitle';host.insertBefore(t,before||host.firstChild);}
  const html=titleHTML(n);if(t.dataset.render!==html){t.innerHTML=html;t.dataset.render=html;}
 }
 const tab=()=>{const t=state.projectNavigation?.inspectorTab;return TABS.some(([k])=>k===t)?t:'margin';};
 function readInspector(reader){
  let side=reader.querySelector(':scope>#c3-read-insp');
  if(!side){side=document.createElement('aside');side.id='c3-read-insp';side.setAttribute('aria-label','Inspector');reader.append(side);}
  const t=tab();
  const body=t==='margin'?`<p class="ci-lead">Margin notes and discussion sit beside their passage in Write, on this same manuscript. Nothing pending changes until you approve it there.</p><button type="button" class="ci-go" data-c3-go="5">Open in Write</button>`
   :t==='decisions'?`<p class="ci-lead">The direction for this piece (opening, closing, audience) is saved in Direction and carried into Write.</p><button type="button" class="ci-go" data-c3-go="4">Open Direction</button>`
   :`<p class="ci-lead">Readiness is checked against a saved revision, not while you read.</p><div class="ci-row"><div><strong>Checks</strong><span>Mechanical checks and quote fidelity run in Check.</span></div><button type="button" class="ci-go" data-c3-go="7">Open Check</button></div><div class="ci-row"><div><strong>Export readiness</strong><span>Missing assets and out-of-date approvals are shown in Audience view.</span></div><button type="button" class="ci-go" data-c3-go="10">Open Audience view</button></div>`;
  const html=`<div class="c3-insp-tabs" role="tablist" aria-label="Inspector">${TABS.map(([k,l])=>`<button type="button" role="tab" class="ci-tab" data-c3-tab="${k}" aria-selected="${k===t}">${l}</button>`).join('')}</div><div class="c3-insp-body" role="tabpanel">${body}</div>`;
  if(side.dataset.render!==html){side.innerHTML=html;side.dataset.render=html;}
 }
 function decorate(){
  const n=stage();document.body.dataset.c3Stage=String(n);
  if(!LINES[n])return;
  const ws=document.querySelector('#app .workspace');if(!ws)return;
  if(n===5){const doc=ws.querySelector('.desk>.document');if(doc)ensureTitle(doc,5,doc.firstChild);return;}
  const layout=n===7?ws.querySelector(':scope>.wn-check-layout'):null;
  if(layout){layout.classList.add('c3-check');const m=layout.querySelector(':scope>.wn-check-manuscript');if(m)ensureTitle(m,7,m.firstChild);if(layout.querySelector('[data-current-check="run"]')&&!document.querySelector('#c3-surface-bar .sb-primary'))window.surfaceBar?.build?.();return;}
  const reader=ws.querySelector(':scope>.phaseReader');if(!reader)return;
  ensureTitle(reader,n,reader.firstChild);
  reader.classList.toggle('c3-read',n===6);reader.classList.toggle('c3-check',n===7);
  if(n===6)readInspector(reader);
  if(n===7&&reader.querySelector('[data-current-check="run"]')&&!document.querySelector('#c3-surface-bar .sb-primary'))window.surfaceBar?.build?.();
 }
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('#c3-read-insp [data-c3-tab]');if(t){state.projectNavigation||={recent:[]};state.projectNavigation.inspectorTab=t.dataset.c3Tab;try{save();}catch{}decorate();document.querySelector(`#c3-read-insp [data-c3-tab="${t.dataset.c3Tab}"]`)?.focus();return;}
  const g=event.target.closest?.('#c3-read-insp [data-c3-go]');if(g)void viewPhase(Number(g.dataset.c3Go));
 });
 const previousRender=window.render;
 window.render=function(...args){const result=previousRender.apply(this,args);if(result?.then)return result.then(value=>{decorate();return value;});decorate();return result;};
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 window.c3Canvas={decorate};
 decorate();
})();
