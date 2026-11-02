/* C3 surface bar. The one bar above the work: where you are (i64 OS, piece, output, step) and one state word on the left;
   Undo, Margin/Focus, More and exactly one primary action, from the one piece state, on the right. History, Outputs,
   Receipts, Text size and Everything that's here are in More. There is no bottom location bar. Every control here presses the app's real control (still in the page, its row
   hidden), so study.js, draft-flow, draft-surface, workspace-navigation and i64-return keep owning their buttons, handlers
   and repaints. The save notice and failed-save recovery (.draft-bar) are never hidden. Install last. */
(()=>{
 if(window.surfaceBar)return;
 const ROWS=['.workspace>.topbar','.workspace>#work-context','.workspace>.workbar','.workspace>.historicalToolbar','.workspace #direction-writing-tools>.dwt-orientation','.workspace .draft-surface-more-body'];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const I={pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',undo:'<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',history:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4h4"/><path d="M12 8v4.5l3 2"/>',focus:'<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',margin:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M15 4.5v15"/>',more:'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',chev:'<path d="m7 10 5 5 5-5"/>',outputs:'<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5"/>',back:'<path d="M14.5 6 8.5 12l6 6"/>'};
 let reals=[],lastSig='',moreOpen=false,queued=false,primaryAction=null,focusedOutput=null,focusSerial=0;
 const visible=n=>n&&n.isConnected&&!n.hidden&&!n.closest('[hidden]')&&!(n.dataset?.wnConsolidated);
 const label=n=>(n.textContent||'').replace(/\s+/g,' ').trim()||n.getAttribute('aria-label')||n.title||'';
 const stage=()=>{const p=current();return p.view==='record'?Number(p.viewedStage)||0:p.view==='article'?5:0;};
 function rows(){return ROWS.map(s=>document.querySelector(s)).filter(Boolean);}
 // A focused format chooser projects only the original guarded controls. Its
 // exact owner and selected work must still agree when a choice is pressed.
 function outputMenuScope(){try{const p=current(),selected=window.studyOutputConnection?.selection?.(),binding=window.studyDraft?.currentBinding?.();return JSON.stringify([p.id,p.view,p.viewedStage,selected?.projectId,selected?.rootBindingId,selected?.output?.id,binding?.id,binding?.canonicalOutputId]);}catch{return null;}}
 function focusedOutputCurrent(){
  if(!focusedOutput||!focusedOutput.scope||focusedOutput.scope!==outputMenuScope()||!focusedOutput.owner.isConnected||focusedOutput.owner!==document.querySelector('#work-context .wn-new'))return false;
  const controls=[...focusedOutput.owner.querySelectorAll('[data-wn-create]')];return controls.length===focusedOutput.controls.length&&controls.every((node,i)=>node===focusedOutput.controls[i]);
 }
 function closeMore({focus=false}={}){const target=focusedOutput?.returnFocus;moreOpen=false;focusedOutput=null;lastSig='';build();if(focus)(target?.isConnected?target:document.querySelector('#c3-surface-bar [data-sb-more]'))?.focus({preventScroll:true});}

 // Sort the real controls of the hidden rows into bar slots. Unknown controls go to More, never away.
 function collect(){
  const out={undo:null,history:null,margin:null,focus:null,outputs:null,download:null,ret:null,primary:null,piece:null,mode:null,records:null,more:[]};reals=[];
  const add=(n,slot)=>{const i=reals.push(n)-1;if(slot)out[slot]=i;return i;};
  for(const row of rows()){
   if(row.matches('.dwt-orientation')&&stage()!==5)continue;
   const protectionOnly=row.matches('.draft-surface-more-body');
   if(protectionOnly&&![5,6].includes(stage()))continue;
   const group={title:row.matches('#work-context')?'This piece':row.matches('.topbar')?'View':row.matches('.dwt-orientation')?'Direction and voice':'Writing tools',items:[]};
   for(const n of row.querySelectorAll('button,select,a.i64-return')){
    // The nested donor More keeps its other tools. Project only its guarded
    // protection-list and exact draft download entrances, including late owner controls.
    if(reals.includes(n)||(protectionOnly&&!n.matches('[data-wording-action="list"],[data-draft-action="download-markdown"]')))continue;
    if(n.closest('#connected-work-receipts'))continue;
    if(n.matches('[data-wn-mode]')&&!window.workspaceNavigation?.selectedOutput?.())continue; // the sidebar steps cover these
    if(!visible(n)&&!n.closest('details'))continue;
    if(n.closest('details')&&n.closest('details').closest('[hidden]'))continue;
    if(n.matches('.themeSelect'))continue;
    const on=n.getAttribute('onclick')||'';
    if(n.matches('a.i64-return')){add(n,'ret');continue;}
    if(n.matches('[data-draft-action="download-markdown"]')){if(out.download==null)add(n,'download');continue;}
    if(n.matches('[data-wn-piece]')){add(n,'piece');continue;}
    if(row.matches('.historicalToolbar')&&n.tagName==='SELECT'&&out.records==null){add(n,'records');continue;}
    if(row.matches('.historicalToolbar')&&out.mode==null){add(n,'mode');continue;}
    if(n.matches('[data-wn-outputs]')&&out.outputs==null){add(n,'outputs');continue;}
    if(n.matches('[data-surface-mode="margin"]')&&out.margin==null&&row.matches('.topbar')){add(n,'margin');continue;}
    if(n.matches('[data-surface-mode="focus"]')&&out.focus==null&&row.matches('.topbar')){add(n,'focus');continue;}
    if(/^undo\(\)/.test(on)&&out.undo==null){add(n,'undo');continue;}
    if(/modal='history'/.test(on)&&out.history==null){add(n,'history');continue;}
    if(/openInstruction\(\)/.test(on)&&[5,6].includes(stage()))continue; // the piece-state primary presses it
    if(n.matches('.mobileProjects'))continue;
    const section=n.closest('details')?.querySelector('summary')?.textContent.trim();
    group.items.push({i:add(n),section:section&&section!=='More'?section:''});
   }
   if(group.items.length)out.more.push(group);
  }
  // The one primary action comes from the one piece state (piece-state.js, review C1), never from this bar's own guess.
  primaryAction=window.c3PieceState?.primary?.(stage())||null;
  return out;
 }
 function proxy(i,cls,inner,extra=''){const n=reals[i];if(n==null)return '';const dis=n.disabled?'disabled':'';const t=n.title||label(n);return `<button type="button" class="${cls}" data-sb="${i}" ${dis} title="${esc(t)}" ${n.getAttribute('aria-pressed')?`aria-pressed="${esc(n.getAttribute('aria-pressed'))}"`:''} ${n.getAttribute('aria-current')?'aria-current="page"':''} ${extra}>${inner}</button>`;}
 function inTabs(i){const n=reals[i];if(n==null||n.options.length<2||n.options.length>8)return '';return `<nav class="sb-in" aria-label="In"><span class="sb-in-l">In:</span>${[...n.options].map(o=>`<button type="button" class="sb-in-t" data-sb-in="${i}" data-sb-in-value="${esc(o.value)}" aria-pressed="${o.selected}" title="${esc(o.textContent)}" ${o.disabled||n.disabled?'disabled':''}>${esc(o.textContent.includes(' · ')?o.textContent.split(' · ').pop():o.textContent)}</button>`).join('')}</nav>`;}
 function selectProxy(i,cls,aria){const n=reals[i];if(n==null)return '';return `<select class="${cls}" data-sb-select="${i}" aria-label="${esc(aria||n.getAttribute('aria-label')||'Choose')}" ${n.disabled?'disabled':''}>${[...n.options].map(o=>`<option value="${esc(o.value)}" ${o.selected?'selected':''} ${o.disabled?'disabled':''}>${esc(o.textContent)}</option>`).join('')}</select>`;}
 function noteText(){const s=document.querySelector('.workspace>.historicalToolbar>span');const t=s?label(s):'';return /read-only/i.test(t)?'Read-only':/retained|historical/i.test(t)?'Earlier record':'';}
 // Middle trim: names past the limit keep their start and end, e.g. "Seven Lessons from…the Kiln"; the full name is the tooltip.
 function mid(t,max=40){t=String(t||'');if(t.length<=max)return t;const tail=Math.max(8,Math.floor(max*.35));return t.slice(0,max-tail-1).trimEnd()+'…'+t.slice(-tail).trimStart();}
 function checkpoint(){const p=current();if(p.view==='carousel')return {n:0,name:p.outputMode==='look'?'Carousel preview':'Carousel words'};const b=document.querySelector('.workflowNavigation .workflowStep[aria-current]')||document.querySelector('.workflowNavigation .workflowStep.isViewed');if(!b)return stage()===3?{n:3,name:'Research'}:null;return {n:Number(b.querySelector('.stepNumber')?.textContent.trim())||stage(),name:(b.querySelector('.stepName')?.textContent||'').trim()};}
 // The bottom location bar: i64 OS › piece › output › checkpoint, then read-only, output switch and save status.
 // A piece whose words are still only in this browser says so in the bottom bar, with the real working-copy control.
 const localOnly=()=>document.querySelector('#app .workspace>.draft-bar .draft-copy-row [data-draft-action^="open:"]:not(:disabled)');
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-cb-local]'))localOnly()?.click();});
 // A failed save offers Try again, which asks the save owner to save the current words once more.
 const saver=()=>window.studyOutputConnection?.flush||window.studyDraft?.flush||null;
 let retrying=false;
 document.addEventListener('click',async event=>{const b=event.target.closest?.('[data-cb-retry]');if(!b||retrying)return;const save=saver();if(!save)return;retrying=true;b.disabled=true;b.textContent='Trying again…';try{await save();}catch{}finally{retrying=false;lastSig='';window.surfaceBar?.build?.();}});
 // Someone else saved a newer version under unsaved words: Compare opens both, beside Keep mine, in the work column.
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-cb-compare]'))void window.studyDraft?.compare?.();});
 // The one text size (A- / A+, 87.5% to 137.5%), remembered on this device only under the reader's existing key. It sets
 // the root multiplier --z (type-scale.css), so the interface and the manuscript scale together on every screen.
 const SIZES=[.875,1,1.125,1.25,1.375];let size=1;try{const v=Number(localStorage.getItem('c3-doc-scale'));if(SIZES.includes(v))size=v}catch{}
 const applySize=()=>{document.documentElement?.style.setProperty('--z',String(size));document.body?.style.removeProperty('--c3-doc-scale');};applySize();
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-cb-size]');if(!b)return;const i=SIZES.indexOf(size)+Number(b.dataset.cbSize);if(i<0||i>=SIZES.length)return;size=SIZES[i];try{localStorage.setItem('c3-doc-scale',String(size))}catch{}applySize();lastSig='';window.surfaceBar?.build?.();});
 // Where you are and in what state, on the bar's left (the bottom location bar is gone, review A5): the way back to i64 OS,
 // the piece, the chosen output, the step, then one state word. The state word is the save owner's status or, on a
 // reading view, why it cannot be edited; a browser-only piece and a failed save keep their one recovery action here.
 function here(slots,id,status){
  const local=localOnly(),cp=checkpoint(),st=window.c3PieceState,ro=st?.readOnlyReason?.()||'';
  const tone=/fail|conflict|unavailable|not saved|could not/i.test(status)?'bad':/unsaved|pending|saving|only in this browser|newer version|held by/i.test(status)?'warn':'ok';
  const sep='<span class="sb-sep2" aria-hidden="true">›</span>',parts=[];
  if(slots.ret!=null)parts.push(`<a class="sb-ret" href="${esc(reals[slots.ret].getAttribute('href')||'')}" title="Return to i64 OS">i64 OS</a>`);
  parts.push(`<span class="sb-piece" title="${esc(id.piece)}">${esc(mid(id.piece,32))}</span>`);
  if(slots.piece!=null)parts.push(`${inTabs(slots.piece)}<label class="sb-out${inTabs(slots.piece)?' sb-out-tabs':''}"><span class="cb-sr">Output</span>${selectProxy(slots.piece,'sb-oselect','Choose output')}</label>`);
  else if(id.title)parts.push(`<span class="sb-on" title="${esc(id.title+(id.meta?' · '+id.meta:''))}">${esc(mid(id.title,28))}</span>`);
  if(cp)parts.push(`<span class="sb-cp"><span class="sb-cp-n">${String(cp.n).padStart(2,'0')}</span><span class="sb-cp-name">${esc(cp.name)}</span></span>`);
  let word='';
  if(local)word=`<span class="sb-status" data-tone="warn" role="status" title="These words are kept only in this browser until the piece has its project file.">Only in this browser</span><button type="button" class="sb-act" data-cb-local>Save to the project</button>`;
  else if(ro&&tone==='ok')word=`<span class="sb-status sb-ro" role="status" title="${esc(ro)}">${esc(ro)}</span>`;
  else if(status)word=`<span class="sb-status" data-tone="${tone}" role="status" title="${esc(status)}">${tone==='ok'?'✓ ':''}${esc(mid(status,36))}</span>${tone==='bad'&&saver()?'<button type="button" class="sb-act" data-cb-retry>Try again</button>':''}${/newer version/i.test(status)&&window.studyDraft?.compare?'<button type="button" class="sb-act" data-cb-compare>Compare</button>':''}`;
  const agent=window.arLive?.note?.();
  if(agent)word+=`<span class="sb-agent" role="status" title="${esc(agent.title)}">${esc(agent.text)}</span>`;
  return `<span class="sb-where">${parts.join(sep)}</span>${word}`;
 }
 function textSize(){return `<span class="cb-size wb-text-size" role="group" aria-label="Text size"><button type="button" data-cb-size="-1" aria-label="Smaller text" title="Smaller text" ${size<=SIZES[0]?'disabled':''}>A−</button><output aria-live="polite">${Math.round(size*100)}%</output><button type="button" data-cb-size="1" aria-label="Larger text" title="Larger text" ${size>=SIZES.at(-1)?'disabled':''}>A+</button></span>`;}
 // A retained-record select (e.g. "Checked against" on Check) is a control of the work, not of the bar: it sits at the
 // top of the column as a labelled proxy of the owner's select.
 function records(slots){
  const host=document.querySelector('#app .workspace>.phaseReader,#app .workspace>.wn-check-layout .wn-check-findings');let box=document.getElementById('c3-records');
  if(slots.records==null||!host){box?.remove();return;}
  if(!box){box=document.createElement('div');box.id='c3-records';}
  if(box.parentElement!==host||host.firstElementChild!==box)host.prepend(box);
  const html=`<label class="c3-records-l"><span>${stage()===7?'Checked against':'Record'}</span>${selectProxy(slots.records,'c3-records-select',stage()===7?'Checked against':'Jump to retained record')}</label>`;
  if(box.dataset.render!==html){box.innerHTML=html;box.dataset.render=html;}
 }
 function statusText(){const st=window.c3PieceState?.read?.();if(st)return st.save.text||'';const s=document.querySelector('.workspace>.workbar .saved')||document.querySelector('.workspace>.topbar .status');return s?label(s):'';}
 function identity(){const p=current(),ctx=document.querySelector('#work-context .wn-identity'),title=ctx?.querySelector('strong')?.textContent.trim(),meta=ctx?.querySelector(':scope>span')?.textContent.trim();return {piece:p.name,title:title&&title!=='Project workspace'?title:'',meta:meta||''};}
 function build(){
  const ws=document.querySelector('#app .workspace');if(!ws)return;
  if(focusedOutput&&!focusedOutputCurrent()){focusedOutput=null;moreOpen=false;}
  const slots=collect(),id=identity(),status=statusText();
  // Work receipts and the piece's own status line used to be a strip of their own; they now live in More and in the bar.
  const receipts=document.getElementById('connected-work-receipts'),msgNode=document.getElementById('wn-message'),msg=msgNode&&!msgNode.hidden?label(msgNode):'';
  const own=`<div class="sb-group" role="group" aria-label="This piece"><div class="sb-gh">This piece</div>${slots.download!=null?proxy(slots.download,'sb-item',esc(label(reals[slots.download]))):''}${proxy(slots.outputs,'sb-item','Outputs')}${proxy(slots.history,'sb-item','History · every saved version','aria-label="History · every saved version"')}${window.arLive?'<button type="button" class="sb-item" data-sb-recent>Recent changes · who did what</button>':''}${receipts?'<button type="button" class="sb-item" data-sb-receipts>Receipts</button>':''}${window.c3Tree?'<button type="button" class="sb-item" data-sb-everything>Everything that’s here</button>':''}</div>`;
  const ordinaryMore=own+slots.more.map(g=>`<div class="sb-group" role="group" aria-label="${esc(g.title)}"><div class="sb-gh">${esc(g.title)}</div>${g.items.map(({i,section})=>reals[i].tagName==='SELECT'?`<label class="sb-sel">${esc(reals[i].getAttribute('aria-label')||'Option')}${selectProxy(i,'sb-select')}</label>`:proxy(i,'sb-item',`${section?`<span class="sb-sec">${esc(section)} ·</span> `:''}${esc(label(reals[i]))}`)).join('')}</div>`).join('');
  const more=focusedOutput?`<div class="sb-group" role="group" aria-label="Output formats"><div class="sb-gh">Make an output</div>${focusedOutput.controls.map(real=>proxy(reals.indexOf(real),'sb-item',esc(label(real)),`data-sb-output-choice="${focusedOutput.id}"`)).join('')}<button type="button" class="sb-item" data-sb-close-output>Close</button></div>`:ordinaryMore;
  const sig=JSON.stringify([id,status,noteText(),checkpoint(),reals.map(n=>[label(n),n.disabled,n.getAttribute('aria-pressed'),n.getAttribute('aria-current'),n.tagName==='SELECT'?n.value:'']),stage(),moreOpen,focusedOutput?.id??null,!!saver(),retrying,primaryAction,document.body.classList.contains('c3-insp-sheet'),msg,!!receipts,size,window.c3PieceState?.readOnlyReason?.()||'',!!localOnly(),window.arLive?.note?.()?.text||'']);
  let bar=ws.querySelector(':scope>#c3-surface-bar');
  if(bar&&sig===lastSig)return;
  lastSig=sig;
  const cp=checkpoint();
  const html=`<div class="sb-left">${here(slots,id,status)}${msg?`<span class="sb-msg" role="status" title="${esc(msg)}">${esc(msg)}</span>`:''}</div>
<div class="sb-right">${textSize()}${proxy(slots.undo,'sb-icon',icon(I.undo),'aria-label="Undo"')}${slots.margin!=null||slots.focus!=null?'<span class="sb-sep" aria-hidden="true"></span>':''}${proxy(slots.margin,'sb-btn sb-margin',`${icon(I.margin)}<span>Margin</span>`)}${proxy(slots.focus,'sb-btn sb-focus',`${icon(I.focus)}<span>Focus</span>`)}<span class="sb-sep" aria-hidden="true"></span>${[5,6].includes(stage())&&document.querySelector('#app .desk>#margin,#app #c3-read-insp')?`<button type="button" class="sb-btn sb-insp" data-sb-insp aria-expanded="${document.body.classList.contains('c3-insp-sheet')}" aria-label="Notes beside the words">${icon(I.margin)}<span>Notes</span></button>`:''}${proxy(slots.mode,'sb-btn sb-mode',`<span class="sb-mode-i">${icon(I.pen)}</span><span class="sb-mode-t">${esc(slots.mode!=null?label(reals[slots.mode]):'')}</span>`)}${more?`<div class="sb-morew"><button type="button" class="sb-btn" data-sb-more aria-expanded="${moreOpen}" aria-haspopup="true">${icon(I.more)}<span>More</span></button>${moreOpen?`<div class="sb-menu" ${focusedOutput?'data-sb-focused-output':''} role="group" aria-label="${focusedOutput?'Make an output':'More for this checkpoint'}">${more}</div>`:''}</div>`:''}${primaryAction?`<span class="sb-pw">${primaryAction.disabled&&primaryAction.reason?`<span class="sb-why" id="sb-why">${esc(primaryAction.reason)}</span>`:''}<button type="button" class="sb-primary" data-sb-primary data-short="${esc(primaryAction.label==='Ask about words'?'Ask':primaryAction.label.replace(/^Next: /,''))}" aria-label="${esc(primaryAction.label)}" ${primaryAction.disabled?'disabled aria-describedby="sb-why"':''} ${primaryAction.reason?`title="${esc(primaryAction.reason)}"`:''} onmousedown="event.preventDefault()">${esc(primaryAction.label)}</button></span>`:''}</div>`;
  records(slots);document.getElementById('c3-crumb')?.remove();document.body.classList.add('c3-crumb-on');
  // The owner's control that the primary presses stays in the column, demoted, so one filled button shows per screen.
  const twin=primaryAction?.press?document.querySelector('#app .workspace '+primaryAction.press):null;
  for(const n of document.querySelectorAll('#app [data-c3-bar-twin]'))if(n!==twin)n.removeAttribute('data-c3-bar-twin');
  if(twin&&!twin.hasAttribute('data-c3-bar-twin'))twin.setAttribute('data-c3-bar-twin','');
  if(!bar){bar=document.createElement('header');bar.id='c3-surface-bar';bar.setAttribute('aria-label','This piece and its actions');ws.prepend(bar);}
  const retained=[...bar.querySelectorAll('[data-c3-retain-control]')];
  retained.forEach(n=>n.remove());
  bar.innerHTML=html;
  for(const node of retained)bar.querySelector('.sb-right').append(node);
  if(moreOpen){const rect=bar.querySelector('[data-sb-more]')?.getBoundingClientRect();if(rect)bar.style.setProperty('--c3-menu-top',Math.max(8,rect.bottom+6)+'px');}
  document.body.classList.add('c3-bar-on');
 }
 // Receipts open in a dialog of their own; connected-workspace keeps owning the panel and moves it back when it closes.
 function openReceipts(){
  let d=document.getElementById('c3-receipts');
  if(!d){d=document.createElement('dialog');d.id='c3-receipts';d.setAttribute('aria-labelledby','c3-receipts-title');d.innerHTML='<div class="te-head"><h2 id="c3-receipts-title">Receipts</h2><p>What was saved, handed over or held for this piece.</p><button type="button" class="te-close" data-receipts-close>Close</button></div><div id="c3-receipts-body"></div>';document.body.append(d);d.addEventListener('click',e=>{if(e.target.closest('[data-receipts-close]'))d.close?.();});}
  const r=document.getElementById('connected-work-receipts');if(r){d.querySelector('#c3-receipts-body').append(r);r.open=true;}
  if(!d.open)d.showModal?d.showModal():d.setAttribute('open','');
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;build();watch();});}
 // Proxies keep the editor selection: mousedown never moves focus out of the manuscript.
 document.addEventListener('mousedown',event=>{if(event.target.closest?.('#c3-surface-bar button,#c3-surface-bar .sb-menu'))event.preventDefault();},true);
 document.addEventListener('click',event=>{
  const more=event.target.closest?.('#c3-surface-bar [data-sb-more]');
  if(more){const wasFocused=!!focusedOutput;focusedOutput=null;moreOpen=wasFocused||!moreOpen;lastSig='';build();if(moreOpen)document.querySelector('#c3-surface-bar .sb-menu button,#c3-surface-bar .sb-menu select')?.focus({preventScroll:true});return;}
  if(event.target.closest?.('#c3-surface-bar [data-sb-close-output]')){closeMore({focus:true});return;}
  if(event.target.closest?.('#c3-surface-bar [data-sb-insp]')){document.body.classList.toggle('c3-insp-sheet');lastSig='';build();return;}
  if(document.body.classList.contains('c3-insp-sheet')&&!event.target.closest?.('#margin,#c3-insp-head,.ci-panel,#c3-read-insp')){document.body.classList.remove('c3-insp-sheet');lastSig='';schedule();}
  if(event.target.closest?.('#c3-surface-bar [data-sb-everything]')){moreOpen=false;lastSig='';build();window.c3Tree?.everything?.();return;}
  if(event.target.closest?.('#c3-surface-bar [data-sb-recent]')){moreOpen=false;lastSig='';build();window.arLive?.openRecent?.();return;}
  if(event.target.closest?.('#c3-surface-bar [data-sb-receipts]')){moreOpen=false;lastSig='';build();openReceipts();return;}
  const pa=event.target.closest?.('#c3-surface-bar [data-sb-primary]');if(pa){if(!pa.disabled&&primaryAction)void Promise.resolve(window.c3PieceState?.run?.(primaryAction)).finally(()=>{lastSig='';schedule();});return;}
  const b=event.target.closest?.('#c3-surface-bar [data-sb]');
  if(b&&b.getAttribute('aria-label')==='History · every saved version'&&window.studyDraft?.currentBinding?.()){void window.studyDraft.history();return;}
  if(b&&b.getAttribute('aria-label')==='Undo'&&typeof current==='function'&&current()?.view==='carousel'){if(!b.disabled&&typeof window.undo==='function')window.undo();lastSig='';build();watch();return;}
  if(b){
   const real=reals[Number(b.dataset.sb)];
   if(b.hasAttribute('data-sb-output-choice')&&(!focusedOutputCurrent()||String(focusedOutput.id)!==b.dataset.sbOutputChoice||!focusedOutput.controls.includes(real))){closeMore();return;}
   if(!real?.isConnected||real.disabled)return;
   if(b.closest('.sb-menu')){moreOpen=false;focusedOutput=null;}
   real.click();lastSig='';build();watch();return;
  }
  if(moreOpen&&!event.target.closest?.('#c3-surface-bar .sb-morew')){moreOpen=false;focusedOutput=null;lastSig='';schedule();}
 });
 document.addEventListener('click',event=>{const t=event.target.closest?.('#c3-surface-bar [data-sb-in]');if(!t||t.disabled)return;const real=reals[Number(t.dataset.sbIn)];if(!real?.isConnected||real.value===t.dataset.sbInValue)return;real.value=t.dataset.sbInValue;real.dispatchEvent(new Event('change',{bubbles:true}));lastSig='';schedule();});
 document.addEventListener('change',event=>{
  const s=event.target.closest?.('#c3-surface-bar [data-sb-select],#c3-records [data-sb-select]');if(!s)return;
  const real=reals[Number(s.dataset.sbSelect)];if(!real?.isConnected)return;
  real.value=s.value;real.dispatchEvent(new Event('change',{bubbles:true}));lastSig='';schedule();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('c3-insp-sheet')){document.body.classList.remove('c3-insp-sheet');lastSig='';build();return;}if(event.key==='Escape'&&moreOpen){closeMore({focus:true});}});
 // Rebuild after every render and whenever an owner repaints its row (labels, disabled, saved status).
 let watched=[];const observer=new MutationObserver(schedule);
 function watch(){const now=rows();if(now.length===watched.length&&now.every((r,i)=>r===watched[i]))return;observer.disconnect();watched=now;for(const r of now)observer.observe(r,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','hidden','aria-pressed','aria-current','href']});}
 window.c3Shell.register('bar',()=>{build();watch();},{order:30});
 for(const name of ['study-draft-change','study-output-selection','c3-piece-state'])window.addEventListener(name,()=>{lastSig='';schedule();});
 // New output opens a bounded chooser; other section hints keep ordinary More complete.
 function openMore(section){
  focusedOutput=null;
  if(section==='New output'){
   const owner=document.querySelector('#work-context .wn-new'),controls=owner?[...owner.querySelectorAll('[data-wn-create]')]:[];
   if(!owner||!controls.length){closeMore();return;}
   const scope=outputMenuScope();if(!scope){closeMore();return;}
   focusedOutput={id:++focusSerial,owner,controls,scope,returnFocus:document.querySelector('[data-wbf-make-output]')||document.activeElement};
  }
  moreOpen=true;lastSig='';build();const items=[...document.querySelectorAll('#c3-surface-bar .sb-menu .sb-item')];(focusedOutput?items.find(b=>!b.disabled):items.find(b=>section&&b.textContent.includes(section))||items[0])?.focus({preventScroll:true});
 }
 window.surfaceBar={build,openMore,reals:()=>reals};
 build();watch();
})();
