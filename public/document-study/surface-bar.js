/* C3 surface bar. One bar above the work: piece and output on the left; save status, Undo, History, Margin/Focus, More and
   at most one primary action on the right. Every control here presses the app's real control (still in the page, its row
   hidden), so study.js, draft-flow, draft-surface, workspace-navigation and i64-return keep owning their buttons, handlers
   and repaints. The save notice and failed-save recovery (.draft-bar) are never hidden. Install last. */
(()=>{
 if(window.surfaceBar)return;
 const ROWS=['.workspace>.topbar','.workspace>#work-context','.workspace>.workbar','.workspace>.historicalToolbar','.workspace #direction-writing-tools>.dwt-orientation'];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const I={pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',undo:'<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',history:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4h4"/><path d="M12 8v4.5l3 2"/>',focus:'<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',margin:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M15 4.5v15"/>',more:'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',chev:'<path d="m7 10 5 5 5-5"/>',outputs:'<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5"/>',back:'<path d="M14.5 6 8.5 12l6 6"/>'};
 let reals=[],lastSig='',moreOpen=false,queued=false;
 const visible=n=>n&&n.isConnected&&!n.hidden&&!n.closest('[hidden]')&&!(n.dataset?.wnConsolidated);
 const label=n=>(n.textContent||'').replace(/\s+/g,' ').trim()||n.getAttribute('aria-label')||n.title||'';
 const stage=()=>{const p=current();return p.view==='record'?Number(p.viewedStage)||0:p.view==='article'?5:0;};
 function rows(){return ROWS.map(s=>document.querySelector(s)).filter(Boolean);}
 // Sort the real controls of the hidden rows into bar slots. Unknown controls go to More, never away.
 function collect(){
  const out={undo:null,history:null,margin:null,focus:null,outputs:null,ret:null,primary:null,piece:null,mode:null,more:[]};reals=[];
  const add=(n,slot)=>{const i=reals.push(n)-1;if(slot)out[slot]=i;return i;};
  for(const row of rows()){
   if(row.matches('.dwt-orientation')&&stage()!==5)continue;
   const group={title:row.matches('#work-context')?'This piece':row.matches('.topbar')?'View':row.matches('.dwt-orientation')?'Direction and voice':'Writing tools',items:[]};
   for(const n of row.querySelectorAll('button,select,a.i64-return')){
    if(!visible(n)&&!n.closest('details'))continue;
    if(n.closest('details')&&n.closest('details').closest('[hidden]'))continue;
    if(n.matches('.themeSelect'))continue;
    const on=n.getAttribute('onclick')||'';
    if(n.matches('a.i64-return')){add(n,'ret');continue;}
    if(n.matches('[data-wn-piece]')){add(n,'piece');continue;}
    if(row.matches('.historicalToolbar')&&out.mode==null){add(n,'mode');continue;}
    if(n.matches('[data-wn-outputs]')&&out.outputs==null){add(n,'outputs');continue;}
    if(n.matches('[data-surface-mode="margin"]')&&out.margin==null&&row.matches('.topbar')){add(n,'margin');continue;}
    if(n.matches('[data-surface-mode="focus"]')&&out.focus==null&&row.matches('.topbar')){add(n,'focus');continue;}
    if(/^undo\(\)/.test(on)&&out.undo==null){add(n,'undo');continue;}
    if(/modal='history'/.test(on)&&out.history==null){add(n,'history');continue;}
    if(/openInstruction\(\)/.test(on)&&[5,6].includes(stage())&&out.primary==null){add(n,'primary');continue;}
    if(n.matches('.mobileProjects'))continue;
    const section=n.closest('details')?.querySelector('summary')?.textContent.trim();
    group.items.push({i:add(n),section:section&&section!=='More'?section:''});
   }
   if(group.items.length)out.more.push(group);
  }
  // Check: its own run button is the one primary action, as on the board.
  // Material and Source: the lane's own add / save action is the one primary action.
  const OWN={1:'[data-flow-action="files"]',2:'[data-flow-action="save-transcript"]',3:'[data-flow-action="analyze"]',4:'[data-direction-save]',8:'.study-photos [data-add]',9:'[data-oss-action="look"]',10:'[data-output-action="export"]',11:'[data-oss-action="copy"]'};
  if(out.primary==null&&OWN[stage()]){const own=[...document.querySelectorAll('.workspace '+OWN[stage()])].find(n=>visible(n)||n.closest('details'));if(own)out.primary=reals.push(own)-1;}
  if(out.primary==null&&stage()===7){const run=document.querySelector('.workspace [data-current-check="run"]');if(visible(run)){out.primary=reals.push(run)-1;}}
  return out;
 }
 function proxy(i,cls,inner,extra=''){const n=reals[i];if(n==null)return '';const dis=n.disabled?'disabled':'';const t=n.title||label(n);return `<button type="button" class="${cls}" data-sb="${i}" ${dis} title="${esc(t)}" ${n.getAttribute('aria-pressed')?`aria-pressed="${esc(n.getAttribute('aria-pressed'))}"`:''} ${n.getAttribute('aria-current')?'aria-current="page"':''} ${extra}>${inner}</button>`;}
 function selectProxy(i,cls,aria){const n=reals[i];if(n==null)return '';return `<select class="${cls}" data-sb-select="${i}" aria-label="${esc(aria||n.getAttribute('aria-label')||'Choose')}" ${n.disabled?'disabled':''}>${[...n.options].map(o=>`<option value="${esc(o.value)}" ${o.selected?'selected':''} ${o.disabled?'disabled':''}>${esc(o.textContent)}</option>`).join('')}</select>`;}
 function noteText(){const s=document.querySelector('.workspace>.historicalToolbar>span');const t=s?label(s):'';return /read-only/i.test(t)?'Read-only':/retained|historical/i.test(t)?'Earlier record':'';}
 // Middle trim: names past the limit keep their start and end, e.g. "Seven Lessons from…the Kiln"; the full name is the tooltip.
 function mid(t,max=40){t=String(t||'');if(t.length<=max)return t;const tail=Math.max(8,Math.floor(max*.35));return t.slice(0,max-tail-1).trimEnd()+'…'+t.slice(-tail).trimStart();}
 function checkpoint(){const b=document.querySelector('.workflowNavigation .workflowStep[aria-current]')||document.querySelector('.workflowNavigation .workflowStep.isViewed');if(!b)return stage()===3?{n:3,name:'Research'}:null;return {n:Number(b.querySelector('.stepNumber')?.textContent.trim())||stage(),name:(b.querySelector('.stepName')?.textContent||'').trim()};}
 // The bottom location bar: i64 OS › piece › output › checkpoint, then read-only, output switch and save status.
 // A piece whose words are still only in this browser says so in the bottom bar, with the real working-copy control.
 const localOnly=()=>document.querySelector('#app .workspace>.draft-bar .draft-copy-row [data-draft-action^="open:"]:not(:disabled)');
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-cb-local]'))localOnly()?.click();});
 // Reader's own text size for the manuscript on Write, Read and Check (A- / A+), remembered on this device only.
 const SIZES=[.875,1,1.125,1.25,1.375];let size=1;try{const v=Number(localStorage.getItem('c3-doc-scale'));if(SIZES.includes(v))size=v}catch{}
 const applySize=()=>document.body?.style.setProperty('--c3-doc-scale',String(size));applySize();
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-cb-size]');if(!b)return;const i=SIZES.indexOf(size)+Number(b.dataset.cbSize);if(i<0||i>=SIZES.length)return;size=SIZES[i];try{localStorage.setItem('c3-doc-scale',String(size))}catch{}applySize();const o=document.querySelector('#c3-crumb .cb-size output');if(o)o.textContent=Math.round(size*100)+'%';const bar=document.getElementById('c3-crumb');if(bar)delete bar.dataset.render;window.surfaceBar?.build?.();});
 function crumb(slots,id,status){
  const local=localOnly();if(local)status='';
  let bar=document.getElementById('c3-crumb');
  if(!bar){bar=document.createElement('footer');bar.id='c3-crumb';bar.setAttribute('aria-label','Where you are');document.body.append(bar);document.body.classList.add('c3-crumb-on');}
  const cp=checkpoint(),tone=/fail|conflict|unavailable|not saved|could not/i.test(status)?'bad':/unsaved|pending|saving/i.test(status)?'warn':'ok';
  const seg=(t,cls='')=>`<span class="cb-seg ${cls}" title="${esc(t)}">${esc(mid(t))}</span>`;
  const sep='<span class="cb-sep" aria-hidden="true">›</span>';
  const parts=[];
  if(slots.ret!=null)parts.push(`<a class="cb-seg cb-ret" href="${esc(reals[slots.ret].getAttribute('href')||'')}" title="Return to i64 OS">i64 OS</a>`);
  parts.push(seg(id.piece,'cb-piece'));
  if(slots.piece!=null)parts.push(`<label class="cb-out"><span class="cb-sr">Output</span>${selectProxy(slots.piece,'cb-select','Choose output')}</label>`);
  else if(id.title)parts.push(`<span class="cb-seg cb-on" title="${esc(id.title+(id.meta?' · '+id.meta:''))}">${esc(mid(id.title))}</span>`);
  if(cp)parts.push(seg(cp.name));
  const note=noteText();
  const sizing=cp&&[5,6,7].includes(cp.n)?`<span class="cb-size" role="group" aria-label="Text size"><button type="button" data-cb-size="-1" aria-label="Smaller text" ${size<=SIZES[0]?'disabled':''}>A−</button><output aria-live="polite">${Math.round(size*100)}%</output><button type="button" data-cb-size="1" aria-label="Larger text" ${size>=SIZES.at(-1)?'disabled':''}>A+</button></span>`:'';
  const html=`<div class="cb-path">${parts.join(sep)}</div><div class="cb-right">${sizing}${note?`<span class="cb-note">${esc(note)}</span>`:''}${local?`<span class="cb-status" data-tone="warn" role="status" title="These words are kept only in this browser until the piece has its project file.">Only in this browser</span><button type="button" class="cb-act" data-cb-local>Save to the project</button>`:''}${status?`<span class="cb-status" data-tone="${tone}" role="status" title="${esc(status)}">${tone==='ok'?'✓ ':''}${esc(status)}</span>`:''}</div>`;
  if(bar.dataset.render!==html){bar.innerHTML=html;bar.dataset.render=html;}
 }
 function statusText(){const s=document.querySelector('.workspace>.workbar .saved')||document.querySelector('.workspace>.topbar .status');return s?label(s):'';}
 function identity(){const p=current(),ctx=document.querySelector('#work-context .wn-identity'),title=ctx?.querySelector('strong')?.textContent.trim(),meta=ctx?.querySelector(':scope>span')?.textContent.trim();return {piece:p.name,title:title&&title!=='Project workspace'?title:'',meta:meta||''};}
 function build(){
  const ws=document.querySelector('#app .workspace');if(!ws)return;
  const slots=collect(),id=identity(),status=statusText();
  const more=slots.more.map(g=>`<div class="sb-group" role="group" aria-label="${esc(g.title)}"><div class="sb-gh">${esc(g.title)}</div>${g.items.map(({i,section})=>reals[i].tagName==='SELECT'?`<label class="sb-sel">${esc(reals[i].getAttribute('aria-label')||'Option')}${selectProxy(i,'sb-select')}</label>`:proxy(i,'sb-item',`${section?`<span class="sb-sec">${esc(section)} ·</span> `:''}${esc(label(reals[i]))}`)).join('')}</div>`).join('');
  const sig=JSON.stringify([id,status,noteText(),checkpoint(),reals.map(n=>[label(n),n.disabled,n.getAttribute('aria-pressed'),n.getAttribute('aria-current'),n.tagName==='SELECT'?n.value:'']),stage(),moreOpen]);
  let bar=ws.querySelector(':scope>#c3-surface-bar');
  if(bar&&sig===lastSig)return;
  lastSig=sig;
  const cp=checkpoint();
  const html=`<div class="sb-left">${cp?`<span class="sb-cp"><span class="sb-cp-n">${String(cp.n).padStart(2,'0')}</span><span class="sb-cp-name">${esc(cp.name)}</span></span>`:''}</div>
<div class="sb-right">${''&&status?`<span class="sb-status" role="status" data-tone="${/fail|conflict|unavailable|not saved|could not/i.test(status)?'bad':/unsaved|pending|saving/i.test(status)?'warn':'ok'}" title="${esc(status)}">${esc(status)}</span>`:''}${proxy(slots.undo,'sb-icon',icon(I.undo),'aria-label="Undo"')}${proxy(slots.history,'sb-icon',icon(I.history),'aria-label="History · every saved version"')}${slots.margin!=null||slots.focus!=null?'<span class="sb-sep" aria-hidden="true"></span>':''}${proxy(slots.margin,'sb-btn sb-margin',`${icon(I.margin)}<span>Margin</span>`)}${proxy(slots.focus,'sb-btn sb-focus',`${icon(I.focus)}<span>Focus</span>`)}<span class="sb-sep" aria-hidden="true"></span>${proxy(slots.mode,'sb-btn sb-mode',`<span class="sb-mode-i">${icon(I.pen)}</span><span class="sb-mode-t">${esc(slots.mode!=null?label(reals[slots.mode]):'')}</span>`)}${proxy(slots.outputs,'sb-btn',`${icon(I.outputs)}<span>Outputs</span>`)}${more?`<div class="sb-morew"><button type="button" class="sb-btn" data-sb-more aria-expanded="${moreOpen}" aria-haspopup="true">${icon(I.more)}<span>More</span></button>${moreOpen?`<div class="sb-menu" role="group" aria-label="More for this checkpoint">${more}</div>`:''}</div>`:''}${slots.primary!=null?proxy(slots.primary,'sb-primary',esc(label(reals[slots.primary])),'onmousedown="event.preventDefault()"'):''}</div>`;
  crumb(slots,id,status);
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
  const s=event.target.closest?.('#c3-surface-bar [data-sb-select],#c3-crumb [data-sb-select]');if(!s)return;
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
