/* C3 Research tab: research across pieces, as on the board. Reads saved findings through the existing read-only route
   (GET /api/study-research/findings) for pieces whose research is connected, shows them as columns of finding cards with a
   reader drawer, and sends every decision to the piece's own Research (checkpoint 3), where Include / Leave out are saved
   against that piece's draft with their scope checks. Nothing here saves, searches outside, or asks a model.
   The editor stays mounted underneath. Install after home-tabs. */
(()=>{
 if(window.c3Research)return;
 const KEYS={hk:'hk','ref-an-cha':'ancha','ref-collector':'collector'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=(d,s=18)=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const I={x:'<path d="M7 7l10 10M17 7 7 17"/>',search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',quote:'<path d="M7 11h4v6H5v-4a6 6 0 0 1 2-4.5"/><path d="M15 11h4v6h-6v-4a6 6 0 0 1 2-4.5"/>',doc:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',more:'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',chev:'<path d="m7 10 5 5 5-5"/>'};
 let open=false,data=new Map(),loading=null,ui={forId:'',q:'',ev:'all',src:'',panel:'sources',reader:null,moreOpen:false,cardMenu:null};
 const connected=()=>state.projects.filter(p=>KEYS[p.id]&&!p.archived);
 const project=id=>state.projects.find(p=>p.id===id);
 async function readPiece(p){
  try{const r=await fetch(`/api/study-research/findings?projectKey=${encodeURIComponent(KEYS[p.id])}&parentStudyId=${encodeURIComponent(p.id)}`);const v=await r.json();
   if(!r.ok)return {ok:false,reason:v?.error||'Research could not be read.'};
   if(!v.available)return {ok:false,reason:v.reason||v.message||'No saved research findings for this piece yet.'};
   return {ok:true,verification:v.verification||'',stale:!!v.stale,points:(v.points||[]).map(pt=>({projectId:p.id,piece:p.name,id:pt.id,title:pt.title||'Untitled finding',kind:pt.kind||'Finding',quote:pt.spoken?.[0]?.quote||'',speaker:pt.spoken?.[0]?.speaker||'',location:pt.spoken?.[0]?.location||'',supported:pt.clarity?.supported||'',uncertain:pt.clarity?.uncertain||'',implication:pt.clarity?.storyImplication||'',sources:(pt.sources||[]).map(s=>({name:s.name||s.path||'Source',role:s.role||'',lines:s.lineStart?`lines ${s.lineStart}–${s.lineEnd||s.lineStart}`:''})),text:pt.originalText||'',stale:!!pt.stale}))};}
  catch{return {ok:false,reason:'Research could not be read. Your pieces are unchanged.'};}
 }
 async function load(){if(loading)return loading;loading=(async()=>{for(const p of connected())data.set(p.id,await readPiece(p));})().finally(()=>{loading=null;paint();});return loading;}
 function points(){const ids=ui.forId?[ui.forId]:connected().map(p=>p.id);return ids.flatMap(id=>data.get(id)?.ok?data.get(id).points:[]);}
 function visible(){const q=ui.q.trim().toLocaleLowerCase();return points().filter(p=>(ui.ev==='all'||(ui.ev==='supported'?p.supported:p.uncertain))&&(!ui.src||p.sources.some(s=>s.name===ui.src))&&(!q||[p.title,p.quote,p.speaker,p.piece].join(' ').toLocaleLowerCase().includes(q)));}
 const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1).replace(/[-_]/g,' ');
 function card(p,i){const src=p.sources[0]?.name||'';return `<div class="rt-card ${ui.reader===i?'on':''}"><button type="button" class="rt-cardo" data-rt-open="${i}"><span class="rt-k">${p.speaker?`<span class="rt-av" aria-hidden="true">${esc(p.speaker.trim().charAt(0).toLocaleUpperCase())}</span>`:icon(I.quote,15)}<span>${esc(p.speaker||cap(p.kind))}</span></span>${p.quote?`<span class="rt-q">${esc(p.quote)}</span>`:''}<span class="rt-c">${esc(p.title)}</span><span class="rt-f">${src?`<span class="rt-src">${icon(I.doc,13)}${esc(src)}</span>`:''}${p.supported?'<span class="rt-ev good">Supported</span>':''}${p.uncertain?'<span class="rt-ev warn">Uncertain</span>':''}${p.stale?'<span class="rt-ev bad">Changed since</span>':''}<span class="rt-used">${esc(p.piece)}</span></span></button><button type="button" class="rt-cm" data-rt-cmore="${i}" aria-label="More for ${esc(p.title)}" aria-expanded="${ui.cardMenu===i}" title="Reader, source, decide">${icon(I.more,16)}</button>${ui.cardMenu===i?`<div class="rt-menu rt-cmenu" role="group" aria-label="More for ${esc(p.title)}"><button type="button" data-rt-open="${i}">Open in the reader</button>${src?`<button type="button" data-rt-src="${esc(src)}">Show only ${esc(src)}</button>`:''}<button type="button" data-rt-decide="${esc(p.projectId)}">Decide in ${esc(p.piece)}</button><button type="button" disabled>Search outside sources · not connected</button><button type="button" disabled>Ask about this point · not connected</button></div>`:''}</div>`;}
 function board(list){
  if(!connected().length)return `<section class="c3-empty rt-c3-empty"><div class="ce-shape" aria-hidden="true">${window.c3Empty?window.c3Empty.ghost.cards(6):''}</div><div class="ce-card-wrap"><div class="ce-icon">${window.c3Empty?window.c3Empty.icon('flask'):''}</div><div class="ce-copy"><h3>No research across your pieces yet</h3><p>Findings from every piece gather here as columns you can search, with quotes, speakers and evidence. They appear once a piece has saved source analysis.</p><div class="ce-acts"><button type="button" class="ce-btn pri" data-rt-decide="${esc(current().id)}">Research this piece</button></div><div class="ce-steps"><span class="ce-step"><span class="ce-n">1</span>Add sources to a piece</span><span class="ce-arr">→</span><span class="ce-step"><span class="ce-n">2</span>Research them there</span><span class="ce-arr">→</span><span class="ce-step"><span class="ce-n">3</span>Findings gather here</span></div></div></div></section>`;
  if(loading&&!data.size)return '<p class="rt-empty" role="status">Reading saved research…</p>';
  if(!points().length)return `<section class="c3-empty rt-c3-empty"><div class="ce-shape" aria-hidden="true">${window.c3Empty?window.c3Empty.ghost.cards(6):''}</div><div class="ce-card-wrap"><div class="ce-icon">${window.c3Empty?window.c3Empty.icon('flask'):''}</div><div class="ce-copy"><h3>No saved findings yet</h3><p>${ui.forId?'This piece has':'These pieces have'} no saved findings to read yet. Research a piece’s sources and its findings appear here, ready to compare across pieces.</p><div class="ce-acts"><button type="button" class="ce-btn pri" data-rt-decide="${esc(ui.forId||current().id)}">Research ${esc(project(ui.forId||current().id)?.name||'this piece')}</button></div><div class="ce-steps"><span class="ce-step"><span class="ce-n">1</span>Add sources to a piece</span><span class="ce-arr">→</span><span class="ce-step"><span class="ce-n">2</span>Research them there</span><span class="ce-arr">→</span><span class="ce-step"><span class="ce-n">3</span>Findings gather here</span></div></div></div></section>`;
  if(!list.length)return `<div class="rt-empty"><h2>No findings match</h2><p>Nothing is hidden or deleted. Clear the search or a filter to see every finding.</p><button type="button" class="rt-btn" data-rt-clear>Show every finding</button></div>`;
  const all=visible(),cols=new Map();all.forEach((p,i)=>{const k=cap(p.kind);if(!cols.has(k))cols.set(k,[]);cols.get(k).push([p,i]);});
  return [...cols].map(([k,rows])=>`<section class="rt-col" aria-label="${esc(k)}"><div class="rt-colh"><div class="rt-colt">${esc(k)}</div><div class="rt-colm">${rows.length} finding${rows.length===1?'':'s'}</div></div>${rows.map(([p,i])=>card(p,i)).join('')}</section>`).join('');
 }
 function panel(){
  const tabs=[['sources','Sources'],['notebook','Notebook'],['questions','Questions']].map(([k,l])=>`<button type="button" role="tab" class="rt-seg ${ui.panel===k?'on':''}" data-rt-panel="${k}" aria-selected="${ui.panel===k}">${l}</button>`).join('');
  let body='';
  if(ui.panel==='sources'){const groups=new Map();for(const p of points())for(const s of p.sources){const g=groups.get(p.piece)||new Map();g.set(s.name,(g.get(s.name)||0)+1);groups.set(p.piece,g);}
   body=groups.size?`<p class="rt-m">Choose a source to show only its findings.</p>${[...groups].map(([piece,g])=>`<div class="rt-sg"><div class="rt-fh">${esc(piece)}</div>${[...g].map(([n,c])=>`<button type="button" class="rt-src ${ui.src===n?'on':''}" data-rt-src="${esc(n)}" aria-pressed="${ui.src===n}">${icon(I.doc,16)}<span class="rt-srct">${esc(n)}</span><span class="rt-cnt">${c}</span></button>`).join('')}</div>`).join('')}`:'<p class="rt-m">No sources are cited by the findings shown.</p>';}
  else if(ui.panel==='notebook')body='<p class="rt-m">The research notebook is not connected yet, so there is nowhere to save a note here. Notes you make inside a piece stay with that piece.</p>';
  else body='<p class="rt-m">No open questions are recorded in these findings. Questions you raise inside a piece’s Research stay there.</p>';
  return `<aside class="rt-panel" aria-label="Sources, notebook and questions"><div class="rt-segs full" role="tablist" aria-label="Research panel">${tabs}</div><div class="rt-pbody">${body}</div></aside>`;
 }
 function reader(p){
  if(!p)return '';
  const v=data.get(p.projectId)?.verification||'';
  return `<button type="button" class="rt-scrim" data-rt-close-reader aria-label="Close the reader"></button><aside class="rt-drawer" role="dialog" aria-label="Finding reader"><div class="rt-dh">${icon(I.quote)}<div class="rt-dt"><div class="rt-t">${esc(p.title)}</div><div class="rt-m">${esc([p.speaker,p.location,p.piece].filter(Boolean).join(' · '))}</div></div><div class="rt-morew"><button type="button" class="rt-btn ghost" data-rt-more aria-expanded="${ui.moreOpen}">${icon(I.more)}<span>More</span></button>${ui.moreOpen?`<div class="rt-menu" role="group" aria-label="More for this finding"><button type="button" disabled title="Not connected">Search outside sources · not connected</button><button type="button" disabled title="Not connected">Find in Tea Atlas · not connected</button><button type="button" disabled title="Not connected">Ask about this point · not connected</button></div>`:''}</div><button type="button" class="rt-ib" data-rt-close-reader aria-label="Close the reader">${icon(I.x)}</button></div>
<div class="rt-db">${p.quote?`<blockquote class="rt-dq">“${esc(p.quote)}”</blockquote>`:'<p class="rt-m">No exact words are kept for this finding.</p>'}
<div class="rt-fh">Evidence</div>${p.supported?`<p><span class="rt-ev good">Supported</span> ${esc(p.supported)}</p>`:''}${p.uncertain?`<p><span class="rt-ev warn">Uncertain</span> ${esc(p.uncertain)}</p>`:''}${!p.supported&&!p.uncertain?'<p class="rt-m">No evidence note recorded.</p>':''}${v?`<p class="rt-m">${esc(v)}</p>`:''}
${p.implication?`<div class="rt-fh">For the story</div><p>${esc(p.implication)}</p>`:''}
<div class="rt-fh">Sources</div>${p.sources.length?`<ul class="rt-sl">${p.sources.map(s=>`<li>${esc(s.name)}${s.lines?` <span class="rt-m">${esc(s.lines)}</span>`:''}</li>`).join('')}</ul>`:'<p class="rt-m">No source recorded.</p>'}
<div class="rt-fh">Plan for ${esc(p.piece)}</div><p class="rt-m">Include in plan, Leave out and speaker wording are decided inside the piece, against its saved draft.</p><button type="button" class="rt-btn pri" data-rt-decide="${esc(p.projectId)}">Decide in ${esc(p.piece)}</button>
${p.text?`<div class="rt-fh">Passage</div><div class="rt-psg">${esc(p.text).split(/\n\s*\n/).map(x=>`<p>${x}</p>`).join('')}</div>`:''}</div></aside>`;
 }
 function layer(){let n=document.getElementById('c3-research');if(!n){n=document.createElement('section');n.id='c3-research';n.setAttribute('aria-label','Research across pieces');n.hidden=true;document.body.append(n);}return n;}
 function paint(){
  const n=layer();n.hidden=!open;document.body.classList.toggle('c3-research-open',open);
  const r=document.querySelector('#c3-tabstrip [data-ht-research]');if(r){r.classList.toggle('on',open);open?r.setAttribute('aria-current','page'):r.getAttribute('aria-current')&&!document.body.classList.contains('c3-research-open')&&r.removeAttribute('aria-current');}
  if(!open)return;
  const list=visible(),total=points().length,pieces=connected();
  const forOpts=[`<option value="" ${!ui.forId?'selected':''}>Every piece · learning only</option>`,...pieces.map(p=>`<option value="${esc(p.id)}" ${ui.forId===p.id?'selected':''}>${esc(p.name)}</option>`)].join('');
  const failed=pieces.filter(p=>data.get(p.id)&&!data.get(p.id).ok);
  const focus=document.activeElement?.matches?.('#c3-research [data-rt-q]');
  n.innerHTML=`<header class="rt-bar"><div class="rt-bl">${window.c3ResearchScope?window.c3ResearchScope(true).outerHTML:''}<label class="rt-for"><span class="rt-m">Working for</span><select data-rt-for aria-label="Working for">${forOpts}</select></label><label class="rt-search">${icon(I.search)}<span class="rt-sr">Search findings</span><input type="search" data-rt-q value="${esc(ui.q)}" placeholder="Search ${total} findings, quotes and speakers" autocomplete="off"></label></div><div class="rt-br">${ui.forId?`<button type="button" class="rt-btn pri" data-rt-decide="${esc(ui.forId)}">Open ${esc(project(ui.forId)?.name||'piece')} Research</button>`:''}</div></header>
<div class="rt-body">${panel()}<section class="rt-bw" aria-label="Findings"><div class="rt-tool"><span class="rt-m">Show</span><div class="rt-segs" role="group" aria-label="Evidence">${[['all','All'],['supported','Supported'],['uncertain','Uncertain']].map(([k,l])=>`<button type="button" class="rt-seg ${ui.ev===k?'on':''}" data-rt-ev="${k}" aria-pressed="${ui.ev===k}">${l}<span class="rt-cnt">${k==='all'?total:points().filter(p=>k==='supported'?p.supported:p.uncertain).length}</span></button>`).join('')}</div>${ui.src||ui.q||ui.ev!=='all'?`<span class="rt-grow"></span><span class="rt-m">${list.length} of ${total} shown</span><button type="button" class="rt-btn ghost" data-rt-clear>Show every finding</button>`:''}</div>${failed.length?`<p class="rt-m rt-note">${failed.map(p=>`${esc(p.name)}: ${esc(data.get(p.id).reason)}`).join(' · ')}</p>`:''}<div class="rt-board">${board(list)}</div></section></div>${ui.reader!=null?reader(list[ui.reader]):''}`;
  if(focus){const q=n.querySelector('[data-rt-q]');q?.focus();q?.setSelectionRange(q.value.length,q.value.length);}
 }
 function show(){open=true;ui.reader=null;paint();void load();}
 function hide(){open=false;ui.reader=null;ui.moreOpen=false;paint();}
 async function decide(id){
  hide();
  await window.switchProject(id);
  if(current().id!==id){window.homeTabs?.paint?.();return;}
  await viewPhase(3);
 }
 // The strip's Research button opens this tab; Home or any open tab closes it.
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('#c3-tabstrip [data-ht-research]');
  if(t){event.preventDefault();event.stopImmediatePropagation();
   if(window.connectedWorkspace?.openContext){if(open)hide();void window.connectedWorkspace.openContext('inquiries').catch(error=>{const status=document.querySelector('#c3-tabstrip [data-ht-status]');if(status){status.hidden=false;status.textContent=error.message;}});return;}
   const go=async()=>{if(document.getElementById('project-library')?.open)await window.projectLibrary.close();if(document.getElementById('project-library')?.open)return;open?hide():show();};void go();return;}
  if(open&&event.target.closest?.('#c3-tabstrip [data-ht-home],#c3-tabstrip [data-ht-tab],#c3-tabstrip [data-pl-open]'))hide();
 },true);
 document.addEventListener('click',event=>{
  const n=event.target.closest?.('#c3-research [data-rt-open],#c3-research [data-rt-panel],#c3-research [data-rt-src],#c3-research [data-rt-ev],#c3-research [data-rt-clear],#c3-research [data-rt-close-reader],#c3-research [data-rt-more],#c3-research [data-rt-decide],#c3-research [data-rt-cmore]');if(!n){if(ui.cardMenu!=null&&!event.target.closest?.('#c3-research .rt-cmenu')){ui.cardMenu=null;paint();}return;}
  if(n.dataset.rtCmore!=null){const k=Number(n.dataset.rtCmore);ui.cardMenu=ui.cardMenu===k?null:k;paint();document.querySelector('#c3-research .rt-cmenu button')?.focus();return;}
  ui.cardMenu=null;
  if(n.dataset.rtOpen!=null){ui.reader=Number(n.dataset.rtOpen);ui.moreOpen=false;paint();document.querySelector('#c3-research .rt-drawer [data-rt-close-reader]')?.focus();return;}
  if(n.dataset.rtPanel){ui.panel=n.dataset.rtPanel;paint();return;}
  if(n.dataset.rtSrc!=null){ui.src=ui.src===n.dataset.rtSrc?'':n.dataset.rtSrc;ui.reader=null;paint();return;}
  if(n.dataset.rtEv){ui.ev=n.dataset.rtEv;ui.reader=null;paint();return;}
  if(n.hasAttribute('data-rt-clear')){ui.q='';ui.ev='all';ui.src='';ui.reader=null;paint();return;}
  if(n.hasAttribute('data-rt-close-reader')){ui.reader=null;ui.moreOpen=false;paint();return;}
  if(n.hasAttribute('data-rt-more')){ui.moreOpen=!ui.moreOpen;paint();return;}
  if(n.dataset.rtDecide){void decide(n.dataset.rtDecide).catch(()=>{});}
 });
 document.addEventListener('input',event=>{if(!event.target.matches?.('#c3-research [data-rt-q]'))return;ui.q=event.target.value;ui.reader=null;paint();});
 document.addEventListener('change',event=>{if(!event.target.matches?.('#c3-research [data-rt-for]'))return;ui.forId=event.target.value;ui.reader=null;ui.src='';paint();});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape'||!open||document.getElementById('project-library')?.open)return;event.preventDefault();event.stopImmediatePropagation();if(ui.cardMenu!=null){const k=ui.cardMenu;ui.cardMenu=null;paint();document.querySelector(`#c3-research [data-rt-cmore="${k}"]`)?.focus();}else if(ui.moreOpen){ui.moreOpen=false;paint();}else if(ui.reader!=null){ui.reader=null;paint();}else hide();},true);
 window.c3Research={show,hide,load,isOpen:()=>open,whenIdle:()=>loading||Promise.resolve(),points};
})();
