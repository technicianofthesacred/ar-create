/* C3 canvas for Write, Read and Check. Adds the board's small heading line ("05 Write · …") above the manuscript, gives
   Read the inspector column (Margin, Decisions, Readiness pointing to where that work actually happens), and marks the
   page so Check's own panel can sit as the right-hand column. Owners keep their markup; this only adds and decorates.
   Install after inspector. */
(()=>{
 if(window.c3Canvas)return;
 const LINES={1:['Material','Shared by every output of this piece'],2:['Source','Shared by every output of this piece · what was said, and its corrections'],3:['Research','What Research found that this piece can use'],4:['Direction','Your direction for this piece'],5:['Write','The same manuscript as Read and Check'],8:['Media','Photos and video from Material, with where each one is used'],9:['Arrange','Words and photos in reading order for this output'],10:['Audience view','What the audience receives · the same edition as Arrange'],11:['Share','A personal invitation to the people in the piece'],12:['Outputs','Every output of this piece'],6:['Read','The same manuscript, read as your audience will'],7:['Check','The same manuscript, checked against its saved revision']};
 const TABS=[['margin','Margin'],['decisions','Decisions'],['readiness','Readiness']];
 let queued=false;
 const stage=()=>{const p=current();return p.view==='record'?Number(p.viewedStage)||0:p.view==='article'?5:0;};
 const status=()=>document.querySelector('#c3-surface-bar .sb-status')?.textContent.trim()||'';
 function titleHTML(n){const [name,line]=LINES[n],s=status();return `<span class="c3t-n">${String(n).padStart(2,'0')}</span><span class="c3t-name">${name}</span><span class="c3t-line">${line}</span>`;}
 function ensureTitle(host,n,before){
  if(!host)return;
  let t=host.querySelector(':scope>.c3-ctitle')||document.querySelector('#app .c3-page-notes>.c3-ctitle');
  if(!t){t=document.createElement('div');t.className='c3-ctitle';host.insertBefore(t,before||host.firstChild);}
  const html=titleHTML(n);if(t.dataset.render!==html){t.innerHTML=html;t.dataset.render=html;}
 }
 // Each checkpoint remembers its own inspector tab; Material and Source open on Decisions, as on the board.
 const tab=()=>'margin'; // Read's inspector is the margin and this page's notes only (review A7)
 function readInspector(reader,n=6){
  let side=reader.querySelector(':scope>#c3-read-insp');
  if(!side){side=document.createElement('aside');side.id='c3-read-insp';side.setAttribute('aria-label','Inspector');reader.append(side);}
  const t=tab();
  const body=t==='margin'?`<p class="ci-lead">${n<3?'Margin notes belong to the writing, not to this material. They sit beside their passage in Write.':'Margin notes and discussion sit beside their passage in Write, on this same manuscript. Nothing pending changes until you approve it there.'}</p><button type="button" class="ci-go" data-c3-go="5">Open the draft</button>`
   :t==='decisions'?`<p class="ci-lead">The direction for this piece (opening, closing, audience) is saved in Direction and carried into Write.</p><button type="button" class="ci-go" data-c3-go="4">Open Direction</button>`
   :`<p class="ci-lead">Readiness is checked against a saved revision, not while you read.</p><div class="ci-row"><div><strong>Checks</strong><span>Mechanical checks and quote fidelity run in Check.</span></div><button type="button" class="ci-go" data-c3-go="7">Open Check</button></div><div class="ci-row"><div><strong>Export readiness</strong><span>Missing assets and out-of-date approvals are shown in Audience view.</span></div><button type="button" class="ci-go" data-c3-go="10">Open Audience view</button></div>`;
  const html=`<div class="c3-insp-body" role="region" aria-label="Margin">${body}</div>`;
  if(side.dataset.render!==html){const keep=side.querySelector(':scope>.c3-page-notes');side.innerHTML=html;side.dataset.render=html;if(keep)side.prepend(keep);}
 }
 function notesBox(col,before){let box=col.querySelector(':scope>.c3-page-notes');if(!box){box=document.createElement('section');box.className='c3-page-notes';box.setAttribute('aria-label','About this page');}if(before===box)before=box.nextElementSibling;const want=before||null;if(box.parentElement!==col||(want?box.nextElementSibling!==want:col.firstElementChild!==box))col.insertBefore(box,want||col.firstChild);return box;}
 function gather(box,nodes){for(const n of nodes)if(n&&n.matches?.('.c3-ctitle')&&n.parentElement!==box&&!n.contains(box))box.append(n);}
 // One Research screen with a scope: this piece (step 3 itself) or all pieces (research-tab's layer over it).
 function scopeSwitch(all){const g=document.createElement('div');g.className='c3-scope';g.setAttribute('role','group');g.setAttribute('aria-label','Research scope');g.innerHTML=`<button type="button" data-c3-scope="piece" aria-pressed="${!all}">This piece</button><button type="button" data-c3-scope="all" aria-pressed="${all}">All pieces</button>`;return g;}
 window.c3ResearchScope=scopeSwitch;
 const mirrored=[];
 function mirror(box,nodes){
  const rows=[];mirrored.length=0;
  for(const n of nodes){if(!n||!n.isConnected)continue;n.setAttribute('data-c3-mirrored','');
   const acts=[...n.querySelectorAll('button,summary')].filter(b=>!b.closest('[hidden]')&&(()=>{const d=b.closest('details');if(!d||!n.contains(d))return true;if(!b.matches('details>summary')||b.parentElement!==d)return false;const outer=d.parentElement?.closest('details');return !outer||!n.contains(outer);})());
   const skip=new Set(acts.map(a=>(a.textContent||'').trim()));
   const text=n.matches('details')?'':([...n.childNodes].filter(c=>!(c.nodeType===1&&c.matches('details,button'))).map(c=>c.textContent).join('\n')||'').split('\n').map(t=>t.trim()).filter(t=>t&&!skip.has(t)&&!acts.some(a=>a.contains(n))).slice(0,3).join(' · ');
   const btns=acts.map(a=>{const i=mirrored.push(a)-1;return `<button type="button" class="c3-mirror-btn${a.getAttribute('aria-pressed')==='true'||a.closest('details')?.open&&a.matches('summary')?' on':''}" data-c3-mirror="${i}" ${a.disabled?'disabled':''}>${(a.textContent||'').trim().replace(/</g,'&lt;')}</button>`;}).join('');
   rows.push(`<div class="c3-mirror-row c3-mr-${n.classList[0]||'x'}">${text?`<span>${text.replace(/</g,'&lt;')}</span>`:''}${btns}</div>`);}
  let m=box.querySelector(':scope>.c3-mirror');if(!m){m=document.createElement('div');m.className='c3-mirror';box.append(m);}
  const html=rows.join('');if(m.dataset.render!==html){m.innerHTML=html;m.dataset.render=html;}
 }
 function quiet(){const db=document.querySelector('#app .workspace>.draft-bar');if(db)db.classList.toggle('c3-quiet',!db.innerText.trim());}
 // Material and Source tools: each disclosure becomes a row with an icon, what it is for (taken from its own contents)
 // and, where its own text says so, that it is not connected or not saved. The summary keeps its words and its toggle.
 const TI={pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',compass:'<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',layers:'<path d="m12 4 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4"/><path d="m4 16 8 4 8-4"/>',mic:'<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',check:'<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',cols:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>',replace:'<path d="M4 7h11M4 12h7M4 17h11"/><path d="m16 14 3 3-3 3"/>',play:'<circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 5 3.5-5 3.5z"/>',file:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>'};
 const TOOLS=[['Write a note','pen','A titled note in your own words'],['Paste links','link','Keep source links with this material'],['Author context','compass','Direction for the piece or a part'],['Group & choose context','layers','Group whole resources for a piece'],['Record audio or use a folder','mic','For a recording, use Add files'],['Keep / remove review','check','Check a resource before keeping it'],['Add more material','plus','Files, notes and links'],['Compare source records','cols','Read two records side by side'],['Correct a repeated term','replace','Find a term, preview the fix'],['Recording relationship','play','Playback and timing for this source'],['Original record details','file','Where the original lives, unchanged']];
 const FLAG=[[/preparation only/i,'Preparation only','warn'],[/not connected/i,'Not connected','bad'],[/not saved/i,'Not saved','warn']];
 // What works now, for a tool whose own text says it is not connected: one step that presses or opens a real control.
 const GO={'Record audio or use a folder':['Add a recording file',{press:'[data-flow-action="files"]'}],'Group & choose context':['Write opening and closing notes',{open:'Author context',focus:'textarea[data-human-direction]'}],'Keep / remove review':['See your sources',{show:'[data-material-browser-host],.material-layout'}],'Compare source records':['Read two records side by side',{open:'Compare source records',focus:'[data-sws-action="versions"]'}],'Correct a repeated term':['Note the correction',{open:'Author context',focus:'textarea[data-human-direction]'}]};
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 // The tool's own sentence that says why, found in its own text (never written here).
 function why(d,re){const w=document.createTreeWalker(d,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(n.parentElement.closest('summary'))continue;const t=n.data.trim();if(re.test(t)){const ss=t.split(/(?<=\.)\s+/),i=Math.max(0,ss.findIndex(x=>re.test(x)));return ss.slice(i,ss[i].length<45?i+2:i+1).join(' ').trim();}}return '';}
 function tools(ws){
  for(const s of ws.querySelectorAll('.material-surface details>summary')){
   if(s.classList.contains('c3-tool'))continue;const d=s.parentElement;if(d.parentElement.closest('details'))continue;
   const text=s.textContent.trim(),t=TOOLS.find(([k])=>text.startsWith(k));if(!t)continue;
   const f=FLAG.find(([re])=>re.test(d.textContent)),go=f&&GO[t[0]];const reason=f?why(d,f[0]).replace(new RegExp('^'+f[1]+'\\s*·?\\s*','i'),'').replace(/^./,c=>c.toUpperCase()):'';
   s.classList.add('c3-tool');d.classList.add('c3-tool-row');
   s.innerHTML=`<span class="c3-tool-i"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${TI[t[1]]}</svg>${f?`<span class="c3-tool-flag" data-tone="${f[2]}" title="${f[1]}"></span>`:''}</span><span class="c3-tool-t" title="${esc(text)}">${esc(text)}${f?`<span class="c3-sr"> · ${f[1]}</span>`:''}</span><span class="c3-tool-d">${t[2]}</span><svg class="c3-tool-c" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>`;
   if(f){d.querySelector(':scope>.c3-tool-banner')?.remove();const b=document.createElement('div');b.className='c3-tool-banner';b.dataset.tone=f[2];b.innerHTML=`<strong title="${esc(reason)}">${f[1]}</strong>${go?`<button type="button" class="c3-tool-go" data-c3-now="${esc(t[0])}">${esc(go[0])}<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`:''}`;s.after(b);}
  }
 }
 // A tool that is not connected says so at the top of its own opened panel, with the one step that works now. explains itself without opening or closing the tool; its button does the one thing that works now.
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function bring(el,focusEl){el.scrollIntoView({block:'center',behavior:reduce()?'auto':'smooth'});el.classList.remove('c3-arrive');void el.offsetWidth;el.classList.add('c3-arrive');setTimeout(()=>el.classList.remove("c3-arrive"),1700);(focusEl||el).focus?.({preventScroll:true});}
 function act(key,from){
  const g=GO[key];if(!g)return;const [,a]=g;const ws=document.querySelector('#app .workspace');if(!ws)return;
  if(a.press){const b=ws.querySelector(a.press);if(b&&!b.disabled)b.click();return;}
  if(a.show){const el=ws.querySelector(a.show);if(el)bring(el);return;}
  if(a.open){const row=[...ws.querySelectorAll('details.c3-tool-row')].find(d=>(d.querySelector(':scope>summary .c3-tool-t')?.title||'').startsWith(a.open));if(!row)return;if(from&&from!==row)from.open=false;row.open=true;const f=a.focus?row.querySelector(a.focus):null;for(let d=f?.parentElement?.closest('details');d&&row.contains(d);d=d.parentElement?.closest('details'))d.open=true;requestAnimationFrame(()=>bring(row,f));}
 }
 document.addEventListener('click',event=>{const go=event.target.closest?.('[data-c3-now]');if(go){event.preventDefault();act(go.dataset.c3Now,go.closest('details.c3-tool-row'));}});
 function decorate(){
  const n=stage();document.body.dataset.c3Stage=String(n);
  if(!LINES[n])return;
  const ws=document.querySelector('#app .workspace');if(!ws)return;
  quiet();
  if(n===1||n===2)tools(ws);
  if(n===5){const desk=ws.querySelector('.desk'),doc=desk?.querySelector(':scope>.document');if(doc){ensureTitle(doc,5,doc.firstChild);const head=desk.querySelector(':scope>#c3-insp-head');if(head){const box=notesBox(desk,head);gather(box,[doc.querySelector(':scope>.c3-ctitle')]);mirror(box,[ws.querySelector(':scope>details.flow-retained'),doc.querySelector(':scope>.reference'),doc.querySelector(':scope>.draft-surface-document-meta'),doc.querySelector(':scope>.draft-tabs')]);}}return;}
  const layout=n===7?ws.querySelector(':scope>.wn-check-layout'):null;
  if(layout){layout.classList.add('c3-check');const m=layout.querySelector(':scope>.wn-check-manuscript'),f=layout.querySelector(':scope>.wn-check-findings');if(m)ensureTitle(m,7,m.firstChild);if(f&&m)gather(notesBox(f,null),[m.querySelector(':scope>.c3-ctitle')]);if(layout.querySelector('[data-current-check="run"]')&&!document.querySelector('#c3-surface-bar .sb-primary'))window.surfaceBar?.build?.();return;}
  if(n>=8&&n<=12){
   let t=ws.querySelector(':scope>.c3-ctitle');
   if(!t){const after=ws.querySelector(':scope>.historicalToolbar')||ws.querySelector(':scope>#work-context');t=document.createElement('div');t.className='c3-ctitle c3-ws-title';(after?after.after(t):ws.prepend(t));}
   const html=titleHTML(n);if(t.dataset.render!==html){t.innerHTML=html;t.dataset.render=html;}
   ws.querySelector(':scope>#c3-read-insp')?.remove(); // review A7: no inspector on 8–12
   if(!document.querySelector('#c3-surface-bar .sb-primary')&&ws.querySelector({8:'.study-photos [data-add]',9:'[data-oss-action="look"]',11:'[data-oss-action="copy"]'}[n]||':not(*)'))window.surfaceBar?.build?.();
   return;
  }
  const reader=ws.querySelector(':scope>.phaseReader');if(!reader)return;
  ensureTitle(reader,n,reader.firstChild);
  reader.classList.toggle('c3-read',n===6);reader.classList.toggle('c3-check',n===7);reader.classList.toggle('c3-flow',n>=1&&n<=4);for(const k of [1,2,3,4])reader.classList.toggle('c3-s'+k,n===k);
  if(n===6)readInspector(reader,n);else reader.querySelector(':scope>#c3-read-insp')?.remove(); // review A7: no inspector on 1–4
  if(n===6){const side=reader.querySelector(':scope>#c3-read-insp');if(side){const box=notesBox(side,side.querySelector(':scope>.c3-insp-tabs'));gather(box,[reader.querySelector(':scope>.c3-ctitle')]);mirror(box,[reader.querySelector(':scope>.draft-row'),reader.querySelector(':scope>.draft-details'),reader.querySelector(':scope>details.flow-retained'),ws.querySelector(':scope>details.flow-retained')]);}}
  // Workbench may keep this same control in its Research heading outside the
  // retained-record reader. Reuse it rather than recreating it on every mount.
  if(n===3&&window.c3Research){const t=reader.querySelector(':scope>.c3-ctitle');if(t&&!ws.querySelector('.c3-scope'))t.after(scopeSwitch(false));}
  if(n===7&&reader.querySelector('[data-current-check="run"]')&&!document.querySelector('#c3-surface-bar .sb-primary'))window.surfaceBar?.build?.();
 }
 document.addEventListener('click',event=>{
  const mb=event.target.closest?.('.c3-mirror [data-c3-mirror]');if(mb){const real=mirrored[Number(mb.dataset.c3Mirror)];if(real?.isConnected&&!real.disabled){if(real.matches('summary')){const d=real.parentElement;d.open=!d.open;d.closest('[data-c3-mirrored]')?.classList.toggle('c3-mirror-open',d.open);if(d.open)d.scrollIntoView({block:'nearest'});}else real.click();}return;}
  const sc=event.target.closest?.('[data-c3-scope]');if(sc){if(sc.dataset.c3Scope==='all')window.c3Research?.show?.();else window.c3Research?.hide?.();return;}
  const t=event.target.closest?.('#c3-read-insp [data-c3-tab]');if(t){state.projectNavigation||={recent:[]};state.projectNavigation.inspectorTabs||={};state.projectNavigation.inspectorTabs[stage()]=t.dataset.c3Tab;try{save();}catch{}decorate();document.querySelector(`#c3-read-insp [data-c3-tab="${t.dataset.c3Tab}"]`)?.focus();return;}
  const g=event.target.closest?.('#c3-read-insp [data-c3-go]');if(g)void viewPhase(Number(g.dataset.c3Go));
 });
 window.c3Canvas={decorate};
 window.c3Shell.register('canvas',decorate,{order:45,ignore:'.c3-page-notes,#c3-read-insp'});
})();
