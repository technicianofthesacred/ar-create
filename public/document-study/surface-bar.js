/* C3 surface bar. One bar above the work: piece and output on the left; save status, Undo, History, Margin/Focus, More and
   at most one primary action on the right. Every control here presses the app's real control (still in the page, its row
   hidden), so study.js, draft-flow, draft-surface, workspace-navigation and i64-return keep owning their buttons, handlers
   and repaints. The save notice and failed-save recovery (.draft-bar) are never hidden. Install last. */
(()=>{
 if(window.surfaceBar)return;
 const ROWS=['.workspace>.topbar','.workspace>#work-context','.workspace>.workbar'];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const I={undo:'<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',history:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4h4"/><path d="M12 8v4.5l3 2"/>',focus:'<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',margin:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M15 4.5v15"/>',more:'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',chev:'<path d="m7 10 5 5 5-5"/>',outputs:'<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5"/>',back:'<path d="M14.5 6 8.5 12l6 6"/>'};
 let reals=[],lastSig='',moreOpen=false,queued=false;
 const visible=n=>n&&n.isConnected&&!n.hidden&&!n.closest('[hidden]')&&!(n.dataset?.wnConsolidated);
 const label=n=>(n.textContent||'').replace(/\s+/g,' ').trim()||n.getAttribute('aria-label')||n.title||'';
 const stage=()=>{const p=current();return p.view==='record'?Number(p.viewedStage)||0:p.view==='article'?5:0;};
 function rows(){return ROWS.map(s=>document.querySelector(s)).filter(Boolean);}
 // Sort the real controls of the hidden rows into bar slots. Unknown controls go to More, never away.
 function collect(){
  const out={undo:null,history:null,margin:null,focus:null,outputs:null,ret:null,primary:null,piece:null,more:[]};reals=[];
  const add=(n,slot)=>{const i=reals.push(n)-1;if(slot)out[slot]=i;return i;};
  for(const row of rows()){
   const group={title:row.matches('#work-context')?'This piece':row.matches('.topbar')?'View':'Writing tools',items:[]};
   for(const n of row.querySelectorAll('button,select,a.i64-return')){
    if(!visible(n)&&!n.closest('details'))continue;
    if(n.closest('details')&&n.closest('details').closest('[hidden]'))continue;
    if(n.matches('.themeSelect'))continue;
    const on=n.getAttribute('onclick')||'';
    if(n.matches('a.i64-return')){add(n,'ret');continue;}
    if(n.matches('[data-wn-piece]')){add(n,'piece');continue;}
    if(n.matches('[data-wn-outputs]')&&out.outputs==null){add(n,'outputs');continue;}
    if(n.matches('[data-surface-mode="margin"]')&&out.margin==null&&row.matches('.topbar')){add(n,'margin');continue;}
    if(n.matches('[data-surface-mode="focus"]')&&out.focus==null&&row.matches('.topbar')){add(n,'focus');continue;}
    if(/^undo\(\)/.test(on)&&out.undo==null){add(n,'undo');continue;}
    if(/modal='history'/.test(on)&&out.history==null){add(n,'history');continue;}
    if(/openInstruction\(\)/.test(on)&&[5,6,7].includes(stage())&&out.primary==null){add(n,'primary');continue;}
    if(n.matches('.mobileProjects'))continue;
    const section=n.closest('details')?.querySelector('summary')?.textContent.trim();
    group.items.push({i:add(n),section:section&&section!=='More'?section:''});
   }
   if(group.items.length)out.more.push(group);
  }
  return out;
 }
 function proxy(i,cls,inner,extra=''){const n=reals[i];if(n==null)return '';const dis=n.disabled?'disabled':'';const t=n.title||label(n);return `<button type="button" class="${cls}" data-sb="${i}" ${dis} title="${esc(t)}" ${n.getAttribute('aria-pressed')?`aria-pressed="${esc(n.getAttribute('aria-pressed'))}"`:''} ${n.getAttribute('aria-current')?'aria-current="page"':''} ${extra}>${inner}</button>`;}
 function selectProxy(i,cls,aria){const n=reals[i];if(n==null)return '';return `<select class="${cls}" data-sb-select="${i}" aria-label="${esc(aria||n.getAttribute('aria-label')||'Choose')}" ${n.disabled?'disabled':''}>${[...n.options].map(o=>`<option value="${esc(o.value)}" ${o.selected?'selected':''} ${o.disabled?'disabled':''}>${esc(o.textContent)}</option>`).join('')}</select>`;}
 function statusText(){const s=document.querySelector('.workspace>.workbar .saved')||document.querySelector('.workspace>.topbar .status');return s?label(s):'';}
 function identity(){const p=current(),ctx=document.querySelector('#work-context .wn-identity'),title=ctx?.querySelector('strong')?.textContent.trim(),meta=ctx?.querySelector(':scope>span')?.textContent.trim();return {piece:p.name,title:title&&title!=='Project workspace'?title:'',meta:meta||''};}
 function build(){
  const ws=document.querySelector('#app .workspace');if(!ws)return;
  const slots=collect(),id=identity(),status=statusText();
  const more=slots.more.map(g=>`<div class="sb-group" role="group" aria-label="${esc(g.title)}"><div class="sb-gh">${esc(g.title)}</div>${g.items.map(({i,section})=>reals[i].tagName==='SELECT'?`<label class="sb-sel">${esc(reals[i].getAttribute('aria-label')||'Option')}${selectProxy(i,'sb-select')}</label>`:proxy(i,'sb-item',`${section?`<span class="sb-sec">${esc(section)} ·</span> `:''}${esc(label(reals[i]))}`)).join('')}</div>`).join('');
  const sig=JSON.stringify([id,status,reals.map(n=>[label(n),n.disabled,n.getAttribute('aria-pressed'),n.getAttribute('aria-current'),n.tagName==='SELECT'?n.value:'']),stage(),moreOpen]);
  let bar=ws.querySelector(':scope>#c3-surface-bar');
  if(bar&&sig===lastSig)return;
  lastSig=sig;
  const html=`<div class="sb-left">${slots.ret!=null?`<a class="sb-ret" href="${esc(reals[slots.ret].getAttribute('href')||'')}" aria-label="Return to i64 OS" title="Return to i64 OS">${icon(I.back)}<span>i64 OS</span></a><span class="sb-slash" aria-hidden="true">/</span>`:''}<span class="sb-piece" title="${esc(id.piece)}">${esc(id.piece)}</span>${id.title?`<span class="sb-slash" aria-hidden="true">/</span><span class="sb-out"><strong title="${esc(id.title)}">${esc(id.title)}</strong>${id.meta?`<small>${esc(id.meta)}</small>`:''}</span>`:''}${slots.piece!=null?selectProxy(slots.piece,'sb-piece-select','Choose output'):''}</div>
<div class="sb-right">${status?`<span class="sb-status" role="status" title="${esc(status)}">${esc(status)}</span>`:''}${proxy(slots.undo,'sb-icon',icon(I.undo),'aria-label="Undo"')}${proxy(slots.history,'sb-icon',icon(I.history),'aria-label="History · every saved version"')}${slots.margin!=null||slots.focus!=null?'<span class="sb-sep" aria-hidden="true"></span>':''}${proxy(slots.margin,'sb-btn',`${icon(I.margin)}<span>Margin</span>`)}${proxy(slots.focus,'sb-btn',`${icon(I.focus)}<span>Focus</span>`)}<span class="sb-sep" aria-hidden="true"></span>${proxy(slots.outputs,'sb-btn',`${icon(I.outputs)}<span>Outputs</span>`)}${more?`<div class="sb-morew"><button type="button" class="sb-btn" data-sb-more aria-expanded="${moreOpen}" aria-haspopup="true">${icon(I.more)}<span>More</span></button>${moreOpen?`<div class="sb-menu" role="group" aria-label="More for this checkpoint">${more}</div>`:''}</div>`:''}${slots.primary!=null?proxy(slots.primary,'sb-primary',esc(label(reals[slots.primary])),'onmousedown="event.preventDefault()"'):''}</div>`;
  if(!bar){bar=document.createElement('header');bar.id='c3-surface-bar';bar.setAttribute('aria-label','This piece and its actions');ws.prepend(bar);}
  bar.innerHTML=html;
  document.body.classList.add('c3-bar-on');
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;build();watch();});}
 // Proxies keep the editor selection: mousedown never moves focus out of the manuscript.
 document.addEventListener('mousedown',event=>{if(event.target.closest?.('#c3-surface-bar button,#c3-surface-bar .sb-menu'))event.preventDefault();},true);
 document.addEventListener('click',event=>{
  const more=event.target.closest?.('#c3-surface-bar [data-sb-more]');
  if(more){moreOpen=!moreOpen;lastSig='';build();if(moreOpen)document.querySelector('#c3-surface-bar .sb-menu button,#c3-surface-bar .sb-menu select')?.focus({preventScroll:true});return;}
  const b=event.target.closest?.('#c3-surface-bar [data-sb]');
  if(b){const real=reals[Number(b.dataset.sb)];if(!real?.isConnected||real.disabled)return;if(b.closest('.sb-menu'))moreOpen=false;real.click();lastSig='';build();watch();return;}
  if(moreOpen&&!event.target.closest?.('#c3-surface-bar .sb-morew')){moreOpen=false;lastSig='';schedule();}
 });
 document.addEventListener('change',event=>{
  const s=event.target.closest?.('#c3-surface-bar [data-sb-select]');if(!s)return;
  const real=reals[Number(s.dataset.sbSelect)];if(!real?.isConnected)return;
  real.value=s.value;real.dispatchEvent(new Event('change',{bubbles:true}));lastSig='';schedule();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&moreOpen){moreOpen=false;lastSig='';build();document.querySelector('#c3-surface-bar [data-sb-more]')?.focus();}});
 // Rebuild after every render and whenever an owner repaints its row (labels, disabled, saved status).
 let watched=[];const observer=new MutationObserver(schedule);
 function watch(){const now=rows();if(now.length===watched.length&&now.every((r,i)=>r===watched[i]))return;observer.disconnect();watched=now;for(const r of now)observer.observe(r,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','hidden','aria-pressed','aria-current','href']});}
 const previousRender=window.render;
 window.render=function(...args){const result=previousRender.apply(this,args);if(result?.then)return result.then(value=>{lastSig='';build();watch();return value;});lastSig='';build();watch();return result;};
 new MutationObserver(()=>{if(!document.querySelector('#app .workspace>#c3-surface-bar')){lastSig='';schedule();}else if(rows().some(r=>!watched.includes(r)))schedule();}).observe(document.getElementById('app')||document.body,{childList:true,subtree:false});
 for(const name of ['study-draft-change','study-output-selection'])window.addEventListener(name,()=>{lastSig='';schedule();});
 window.surfaceBar={build,reals:()=>reals};
 build();watch();
})();
