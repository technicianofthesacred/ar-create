/* C3 empty states. When a step has nothing in it yet, show the shape of what will fill it (faint outlines, no invented
   names), a card that says what the place is for, the real next step as buttons that press the app's own controls,
   and how the space fills. The owner's terse empty text is hidden only while the card is shown; nothing is removed.
   A disabled real control stays disabled here, with its own reason. Install after canvas-c3. */
(()=>{
 if(window.c3Empty)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const P={image:'<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3.5 16l5-4.5 4 3.5 3-2.5 5 4"/>',layers:'<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5"/>',arrange:'<rect x="3.5" y="4" width="7.5" height="7" rx="1"/><rect x="13" y="4" width="7.5" height="4" rx="1"/><rect x="13" y="10" width="7.5" height="10" rx="1"/><rect x="3.5" y="13" width="7.5" height="7" rx="1"/>',flask:'<path d="M9.5 3.5h5"/><path d="M10.5 3.5v6l-5.3 8.9A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.6-2.6L13.5 9.5v-6"/><path d="M7.6 15h8.8"/>',inbox:'<path d="M4 13.5 6.5 5h11l2.5 8.5"/><path d="M4 13.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5.5"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',wave:'<path d="M5 10v4"/><path d="M8.5 7v10"/><path d="M12 4.5v15"/><path d="M15.5 8v8"/><path d="M19 10.5v3"/>',compass:'<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',pen:'<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="M13 7l4 4"/>',read:'<path d="M3.5 6.5c2-1 5-1 8.5.5 3.5-1.5 6.5-1.5 8.5-.5V19c-2-1-5-1-8.5.5C8.5 18 5.5 18 3.5 19z"/><path d="M12 7v12.5"/>',check:'<path d="M4 7h9"/><path d="M4 12h9"/><path d="M4 17h6"/><path d="M14.5 16.5l2 2 4-4.5"/>',eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',send:'<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>'};
 const icon=(k,s=22)=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${P[k]||''}</svg>`;
 const GHOST={
  tiles:n=>`<div class="ce-ghost ce-tiles">${Array.from({length:n},()=>'<div><div class="ce-tile"></div><div class="ce-line" style="width:60%"></div><div class="ce-line ce-soft" style="width:40%"></div></div>').join('')}</div>`,
  rows:n=>`<div class="ce-ghost ce-rows">${Array.from({length:n},(_,i)=>`<div class="ce-row"><span class="ce-dot"></span><span class="ce-rowtext"><span class="ce-line" style="width:${[46,38,52][i%3]}%"></span><span class="ce-line ce-soft" style="width:${[30,24,34][i%3]}%"></span></span><span class="ce-pill"></span></div>`).join('')}</div>`,
  cards:n=>`<div class="ce-ghost ce-cards">${Array.from({length:n},()=>'<div class="ce-card"><span class="ce-line ce-soft" style="width:40%"></span><span class="ce-line" style="width:85%"></span><span class="ce-line" style="width:70%"></span><span class="ce-line ce-soft ce-end" style="width:50%"></span></div>').join('')}</div>`,
  lines:n=>`<div class="ce-ghost ce-lines">${Array.from({length:n},(_,i)=>`<div class="ce-turn"><span class="ce-line ce-soft" style="width:18%"></span><span class="ce-line ce-big" style="width:${[78,64,72,58][i%4]}%"></span><span class="ce-line ce-soft" style="width:${[40,32,44,36][i%4]}%"></span></div>`).join('')}</div>`,
  film:n=>`<div class="ce-ghost ce-film"><div class="ce-stage"><span class="ce-line ce-title" style="width:52%"></span><span class="ce-line ce-big" style="width:80%"></span><span class="ce-line ce-big" style="width:64%"></span></div><div class="ce-strip">${Array.from({length:n},(_,i)=>`<div class="ce-slot${i===0?' on':''}"><span class="ce-sn">${i+1}</span></div>`).join('')}<div class="ce-slot ce-add"><span>+</span></div></div></div>`,
  phone:n=>`<div class="ce-ghost ce-phone"><div class="ce-device"><span class="ce-notch"></span><div class="ce-screen"><span class="ce-line ce-soft" style="width:30%"></span><div class="ce-hero"></div><span class="ce-line ce-title" style="width:70%"></span>${Array.from({length:n},(_,i)=>`<span class="ce-line" style="width:${[92,84,96,70,88][i%5]}%"></span>`).join('')}</div></div></div>`,
  page:n=>`<div class="ce-ghost ce-page"><span class="ce-line ce-title" style="width:46%"></span>${Array.from({length:n},(_,i)=>`<span class="ce-line ce-big" style="width:${[92,86,95,70,88,60][i%6]}%"></span>`).join('')}</div>`};
 const at=sel=>document.querySelector('#app .workspace '+sel);
 const go=n=>({phase:n});
 // One entry per step: when it is empty, where the card goes, what it hides, its words and its real actions.
 const STEPS={
  1:{empty:()=>{const c=at('.material-surface.sws-material .mrb-count');return !!c&&parseInt(c.textContent,10)===0&&!at('.material-surface.sws-material .mrb-item');},host:()=>at('.material-surface.sws-material'),hide:['[data-material-browser-host]'],ghost:['rows',4],icon:'inbox',title:'No material in this piece yet',text:'Bring in what this piece grows from: recordings, transcripts, notes, photos and links. Everything here is shared by every output.',actions:[['Add files','[data-flow-action="files"]',true],['Write a note','summary:Write a note'],['Paste links','summary:Paste links']],steps:['Add material','Keep what matters','Read it in Source']},
  2:{empty:()=>!!at('.material-surface.sws-source')&&!at('.material-surface.sws-source .material-record'),host:()=>at('.material-surface.sws-source'),hide:['.material-layout'],ghost:['lines',4],icon:'wave',title:'No sessions to read yet',text:'Recordings and transcripts you add in Material appear here as sessions, each line with its speaker and time, ready to read and correct.',actions:[['Add material',go(1),true],['Open Research',go(3)]],steps:['Add a recording or transcript','Read and correct it','Research it']},
  3:{empty:()=>!!at('#stage-working-lane')&&!at('[data-research-point],.research-standard-row'),host:()=>at('#stage-working-lane'),hide:[],ghost:['cards',3],icon:'flask',title:'No findings for this piece yet',text:'Research reads your sources and returns points to learn from, each with its quote, speaker and evidence. You decide what goes into the plan.',actions:[['Research these sources','[data-flow-action="analyze"]',true],['Open Source',go(2)],['Research across pieces','research-tab']],steps:['Choose sources','Research them','Include or leave out']},
  4:{empty:()=>!!at('.flow-directions')&&!at('.flow-directions button'),host:()=>at('#stage-working-lane'),hide:['#stage-working-lane>.flow-lane-head','#stage-working-lane>h2','#stage-working-lane>p','.flow-directions'],ghost:['cards',3],icon:'compass',title:'No story directions yet',text:'Once Research has findings, story options appear here to compare: an angle, a title and a shape. You can also write your own.',actions:[['Write my own angle','[data-dwt-action="angle"]',true],['Open Research',go(3)]],steps:['Research the sources','Compare directions','Save one']},
  5:{empty:()=>{const m=at('#manuscript');return !!m&&!m.textContent.trim();},host:()=>at('.desk>.document'),hide:[],compact:true,icon:'pen',title:'The page is empty',text:'Start typing in the page below. Your direction and research stay one click away in the rail.',actions:[['Start writing','focus-manuscript',true],['Open Direction',go(4)]],steps:[]},
  6:{empty:()=>/has no appropriate record|no saved words/i.test(at('.phaseReader')?.textContent||''),host:()=>at('.phaseReader'),hide:['.phaseReader>.recordPage','.phaseReader>article'],ghost:['page',6],icon:'read',title:'Nothing to read yet',text:'Read shows the same manuscript as your audience will, once there are saved words in Write.',actions:[['Open the draft',go(5),true]],steps:['Write the draft','Save it','Read it here']},
  7:{empty:()=>!!at('#current-draft-check')&&!at('.wn-check-layout'),host:()=>at('.phaseReader'),hide:['#current-draft-check .draft-check-room'],ghost:['rows',3],icon:'check',title:'No saved draft to check yet',text:'Check runs against a saved revision: quote fidelity, pending rewrites and open questions, each opening its own passage.',actions:[['Load saved part','[data-current-check="open-part"]',true],['Open the draft',go(5)]],steps:['Save the draft','Load it here','Run the checks'],copy:st=>st.manuscript.local?{title:'These words are only in this browser',text:'Check runs on a saved revision. Save the draft to the project in Write, then check it here.'}:st.published&&!st.manuscript.bound?{title:'Published outside AR Create',text:'This piece was published elsewhere, so there is no saved working draft here to check. Open the draft to start one.'}:null},
  8:{empty:()=>/No photos added yet/i.test(at('#owned-photo-stage')?.textContent||''),host:()=>at('.c3-ws-title'),after:true,hide:['#owned-photos-mount','.mot-context'],ghost:['tiles',8],icon:'image',title:'No photos in this piece yet',text:'Photos and video you add can be placed in the article or carousel. Each one shows where it is used.',actions:[['Upload photos','.study-photos [data-add]',true],['From library','.study-photos [data-library]'],['Open Material',go(1)]],steps:['Add photos','Select the ones to use','Place them in Arrange'],copy:st=>st.media.figures?{title:'The photos in the words are not in Media yet',text:`The draft already shows ${st.media.figures} photograph${st.media.figures===1?'':'s'}. Add ${st.media.figures===1?'it':'them'} here to caption, credit and place ${st.media.figures===1?'it':'them'}.`}:null},
  9:{empty:()=>!!at('#study-output-canvas .oo-empty'),host:()=>at('.c3-ws-title'),after:true,hide:['#study-output-arrange'],ghost:['film',5],layout:'below',icon:'arrange',title:'Nothing to arrange yet',text:'Arrange lays out one output: an article in reading order, or every carousel slide in its approved portrait template.',actions:[['Make an output',go(12),true],['Open Media',go(8)]],steps:['Make an output','Place words and photos','See it in Audience view']},
  10:{empty:()=>/No connected audience preview/i.test(at('[data-oss-reader]')?.textContent||''),host:()=>at('.c3-ws-title'),after:true,hide:['[data-oss-reader]','.oss-readiness','.oss-surface>.oss-tool-row','.oss-retained'],ghost:['phone',5],layout:'side',icon:'eye',title:'No audience preview yet',text:'Audience view shows exactly what readers receive for one output and edition, and what blocks it from export.',actions:[['Open Outputs',go(12),true],['Open Arrange',go(9)]],steps:['Make an output','Arrange it','Review and export here']},
  11:{empty:()=>{const m=at('[data-oss-field="message"]');return !!m&&!m.value.trim();},host:()=>at('.c3-ws-title'),after:true,hide:[],compact:true,icon:'send',title:'Invite the people in this piece',text:'Write a warm note with the finished piece and ask whether it feels right to them. Copying is not sending; you mark it sent yourself.',actions:[['Write the message','focus:[data-oss-field="message"]',true],['Open Audience view',go(10)]],steps:[]},
  12:{empty:()=>!!at('#output-overview .oo-empty, .oo-panel .oo-empty'),host:()=>at('.c3-ws-title'),after:true,hide:['#output-overview','.oo-panel'],ghost:['rows',3],icon:'layers',title:'No outputs made yet',text:'An output is one finished form of this piece: an article, a carousel, a post. Each keeps its own words and layout.',actions:[['New article','[data-wn-create="article"]',true],['New carousel','[data-wn-create="carousel"]'],['Open the draft',go(5)]],steps:['Write the draft','Make an output','Review and export']}};
 const stage=()=>{const p=current();return p.view==='record'?Number(p.viewedStage)||0:p.view==='article'?5:0;};
 function real(target){
  if(typeof target!=='string')return null;
  if(target.startsWith('summary:')){const t=target.slice(8);return [...document.querySelectorAll('#app .workspace summary')].find(s=>(s.querySelector('.c3-tool-t')?.title||s.querySelector('.c3-tool-t')?.textContent||s.textContent).trim()===t)||null;}
  if(['research-tab','focus-manuscript'].includes(target)||target.startsWith('focus:'))return null;
  return document.querySelector('#app .workspace '+target)||document.querySelector(target);
 }
 function actionHTML([label,target,primary],i){
  const r=real(target),missing=typeof target==='string'&&!['research-tab','focus-manuscript'].includes(target)&&!target.startsWith('focus:')&&!r;
  const disabled=missing||(r&&r.disabled);const why=missing?'Not available for this piece yet':r?.disabled?(r.title||'Not available yet'):'';
  return `<button type="button" class="ce-btn ${primary?'pri':''}" data-ce-act="${i}" ${disabled?'disabled':''} ${why?`title="${esc(why)}"`:''}>${esc(label)}</button>`;
 }
 // The card's first button is the same action as the bar's one primary (piece-state.js), never a second opinion.
 function primaryHTML(s){const ps=window.c3PieceState;if(!ps)return '';const a=ps.primary(stage());if(!a)return '';return `<button type="button" class="ce-btn pri" data-ce-primary ${a.disabled?'disabled':''} ${a.reason?`title="${esc(a.reason)}"`:''}>${esc(a.label)}</button>`;}
 function cardHTML(s){
  const steps=s.steps.length?`<div class="ce-steps">${s.steps.map((t,i)=>`<span class="ce-step"><span class="ce-n">${i+1}</span>${esc(t)}</span>`).join('<span class="ce-arr" aria-hidden="true">→</span>')}</div>`:'';
  // Words come from the one piece state when it knows better than the step's generic copy (review F-08).
  const st=window.c3PieceState?.read?.(),c=(st&&s.copy?.(st))||{},title=c.title||s.title,text=c.text||s.text;
  return `<div class="ce-card-wrap" role="region" aria-label="${esc(title)}"><div class="ce-icon">${icon(s.icon)}</div><div class="ce-copy"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="ce-acts">${primaryHTML(s)}${s.actions.map((a,i)=>[a,i]).filter(([a])=>!(st&&a[2])).map(([a,i])=>actionHTML(st?[a[0],a[1],false]:a,i)).join('')}</div>${steps}</div></div>`;
 }
 let current_=null,revealed='';
 const KEEP='#c3-surface-bar,.c3-ctitle,.c3-ws-title,.c3-scope,#c3-next,#c3-records,.draft-bar,.topbar,.workbar,#work-context,.historicalToolbar,[role=alert],#c3-read-insp,#c3-insp-head,#margin,dialog,details.flow-retained,details.oss-retained,script,style';
 const key=()=>{const p=current();return p.id+':'+stage();};
 function clear(){document.querySelectorAll('#app [data-c3-empty-hidden]').forEach(n=>n.removeAttribute('data-c3-empty-hidden'));document.querySelectorAll('#app .c3-empty').forEach(n=>n.remove());current_=null;}
 // The empty card owns the screen (review A6): every tool block beside the path from the card up to the work column is
 // hidden, not removed, so nothing works on a step that has nothing yet except the card. Owners' notices stay.
 function own(block){
  const ws=block.closest('.workspace');if(!ws)return;
  for(let node=block;node&&node!==ws;node=node.parentElement)for(const sib of node.parentElement?.children||[])if(sib!==node&&!sib.matches(KEEP)&&!sib.contains(block)&&!sib.hasAttribute('data-c3-empty-hidden'))sib.setAttribute('data-c3-empty-hidden','');
 }
 // Skip what does not apply (review C6): a words-only piece has nothing to arrange and, with no one recorded in it,
 // no one to invite. The step says so in one line instead of showing an empty tool page; it stays one click away.
 const NAMES=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
 function notApplicable(n){
  const ps=window.c3PieceState,why=ps?.notApplicable?.(n);if(!why)return false;
  const ws=document.querySelector('#app .workspace');if(!ws)return false;
  const host=ws.querySelector(':scope>.c3-ws-title')||ws.querySelector(':scope>#c3-surface-bar');if(!host)return false;
  let block=document.querySelector('#app .c3-empty');
  if(!block||block.dataset.stage!==n+':na'){block?.remove();block=document.createElement('section');block.className='c3-empty ce-na';block.dataset.stage=n+':na';}
  if(block.previousElementSibling!==host)host.after(block);
  const html=`<div class="ce-card-wrap" role="region" aria-label="Not applicable to this piece"><div class="ce-icon">${icon(n===9?'arrange':'send')}</div><div class="ce-copy"><h3>Not applicable to this piece</h3><p>${esc(why)}</p><div class="ce-acts">${primaryHTML(STEPS[n])}<button type="button" class="ce-btn" data-ce-anyway>Open ${esc(NAMES[n-1])} anyway</button></div></div></div>`;
  if(block.dataset.render!==html){block.innerHTML=html;block.dataset.render=html;}
  own(block);current_=null;return true;
 }
 // When the person acts on a tool the card hid (Write my own angle, a disclosure), the card steps aside for this step.
 function reveal(){revealed=key();clear();}
 function decorate(){
  const n=stage(),s=STEPS[n];
  if(revealed&&revealed!==key())revealed='';
  if(!revealed&&notApplicable(n))return;
  if(!s||revealed||!s.empty()){if(document.querySelector('#app .c3-empty'))clear();return;}
  const host=s.host();if(!host)return;
  let block=document.querySelector('#app .c3-empty');
  const html=`${s.compact?'':`<div class="ce-shape" aria-hidden="true">${GHOST[s.ghost[0]](s.ghost[1])}</div>`}${cardHTML(s)}`;
  if(!block||block.dataset.stage!==String(n)){block?.remove();block=document.createElement('section');block.className='c3-empty'+(s.compact?' ce-compact':'')+(s.layout?' ce-'+s.layout:'');block.dataset.stage=String(n);}
  if(s.after){if(block.previousElementSibling!==host)host.after(block);}else if(block.parentElement!==host)host.insertBefore(block,host.firstChild);
  if(block.dataset.render!==html){block.innerHTML=html;block.dataset.render=html;}
  for(const sel of s.hide)for(const el of document.querySelectorAll('#app .workspace '+sel))if(!el.contains(block)&&!el.hasAttribute('data-c3-empty-hidden'))el.setAttribute('data-c3-empty-hidden','');
  if(!s.compact)own(block);
  current_=s;
 }
 document.addEventListener('click',event=>{
  if(event.target.closest?.('#app .c3-empty [data-ce-anyway]')){reveal();return;}
  if(event.target.closest?.('#app .c3-empty [data-ce-primary]')){const ps=window.c3PieceState,a=ps?.primary?.(stage());if(!a||a.disabled)return;const n=a.press&&document.querySelector('#app .workspace '+a.press);if(n?.closest('[data-c3-empty-hidden]'))reveal();void ps.run(a);return;}
  const b=event.target.closest?.('#app .c3-empty [data-ce-act]');if(!b||b.disabled)return;
  const s=current_;if(!s)return;const [,target]=s.actions[Number(b.dataset.ceAct)]||[];
  if(target&&typeof target==='object'&&target.phase){void viewPhase(target.phase);return;}
  if(target==='research-tab'){window.c3Research?.show?.();return;}
  if(target==='focus-manuscript'){const m=document.getElementById('manuscript');m?.focus();return;}
  if(typeof target==='string'&&target.startsWith('focus:')){reveal();document.querySelector('#app .workspace '+target.slice(6))?.focus();return;}
  const r=real(target);if(!r||r.disabled)return;
  if(r.closest('[data-c3-empty-hidden]'))reveal();
  if(r.tagName==='SUMMARY'){const d=r.parentElement;d.open=true;d.scrollIntoView?.({block:'nearest'});d.querySelector('input,textarea')?.focus();return;}
  r.click();
 });
 document.addEventListener('input',event=>{if(event.target.matches?.('#app .workspace textarea,#app .workspace input,#manuscript'))queueMicrotask(decorate);},true);
 window.c3Shell.register('empty states',decorate,{order:60,ignore:'.c3-empty'});
 // Home: no pieces at all, or none matching the search and filters.
 function homeEmpty(){
  const d=document.getElementById('project-library');if(!d?.open)return;
  const res=d.querySelector('[data-pl-results]'),pe=res?.querySelector('.pl-empty');
  if(!pe){d.querySelector('.ht-c3-empty')?.remove();return;}
  if(res.querySelector('.ht-c3-empty'))return;
  const none=!state.projects.some(p=>!p.archived),filtered=!!d.querySelector('.ht-facets [data-ht-clear]')||!!d.querySelector('[data-pl-search]')?.value;
  const box=document.createElement('section');box.className='c3-empty ht-c3-empty';
  box.innerHTML=`<div class="ce-shape" aria-hidden="true">${GHOST.tiles(8)}</div><div class="ce-card-wrap"><div class="ce-icon">${icon('layers')}</div><div class="ce-copy"><h3>${none?'Your first piece starts here':'No piece matches'}</h3><p>${none?'A piece holds everything for one story: its material, research, direction and every output you make from it.':'Nothing is hidden or deleted. Clear the search or a filter to see every piece again, or start a new one.'}</p><div class="ce-acts">${!none&&filtered?'<button type="button" class="ce-btn pri" data-ce-home-clear>Clear search and filters</button>':''}<button type="button" class="ce-btn ${none||!filtered?'pri':''}" data-pl-new>New piece</button></div>${none?'<div class="ce-steps"><span class="ce-step"><span class="ce-n">1</span>Name the piece</span><span class="ce-arr">→</span><span class="ce-step"><span class="ce-n">2</span>Add material</span><span class="ce-arr">→</span><span class="ce-step"><span class="ce-n">3</span>Make outputs</span></div>':''}</div></div>`;
  pe.setAttribute('data-c3-empty-hidden','');res.prepend(box);
 }
 document.addEventListener('click',event=>{
  if(!event.target.closest?.('[data-ce-home-clear]'))return;
  const d=document.getElementById('project-library'),q=d?.querySelector('[data-pl-search]');
  if(q&&q.value){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));}
  d?.querySelector('.ht-facets [data-ht-clear]')?.click();
 });
 new MutationObserver(()=>homeEmpty()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 window.c3Empty={decorate,reveal,steps:STEPS,ghost:GHOST,icon,homeEmpty};
 decorate();
})();
