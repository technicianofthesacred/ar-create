/* C3 "Waiting on you" band on Home. Reads the real output records of open and recent pieces (bounded) and lists outputs
   whose recorded status needs the author, each with its recorded next action. Nothing is invented: no record, no row;
   nothing waiting, no band. Opening a row switches piece through the wrapped switchProject (save-checked) and then uses
   the existing output owner. Install after home-tabs. */
(()=>{
 if(window.waitingBand)return;
 const MAX_PIECES=8,TTL=60000,SHOW=4,WAITING=new Set(['review-needed','correction-needed']);
 const LABELS={'review-needed':'Review needed','correction-needed':'Correction needed'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const DOC='<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 15h5"/>',SLIDES='<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 11h6"/>';
 const cache=new Map();let items=[],failed=0,expanded=false,loading=null,message='';
 const project=id=>state.projects.find(p=>p.id===id);
 function pieces(){const nav=state.projectNavigation||{},ids=[...(nav.openTabs||[]).map(t=>t.projectId),...(nav.recent||[])];return [...new Set(ids)].map(project).filter(p=>p&&!p.archived).slice(0,MAX_PIECES);}
 async function readPiece(p){
  const hit=cache.get(p.id);if(hit&&Date.now()-hit.at<TTL)return hit;
  try{const data=await window.realOutputOverview.read({projectId:p.id});if(data?.projectId!==p.id)throw Error('Another piece answered.');const entry={at:Date.now(),ok:true,rows:(data.outputs||[]).filter(o=>WAITING.has(o.status)).map(o=>({projectId:p.id,piece:p.name,id:o.id,title:o.title||'Untitled output',format:o.format||'Output',status:o.status,action:o.nextAction&&o.nextAction.kind?{kind:o.nextAction.kind,label:o.nextAction.label||'Open'}:null}))};cache.set(p.id,entry);return entry;}
  catch{return {at:Date.now(),ok:false,rows:[]};}
 }
 async function load(){
  if(typeof window.realOutputOverview?.read!=='function')return;
  if(loading)return loading;
  loading=(async()=>{const results=[];for(const p of pieces())results.push(await readPiece(p));items=results.flatMap(r=>r.rows);failed=results.filter(r=>!r.ok).length;})().finally(()=>{loading=null;paint();});
  return loading;
 }
 function row(x,i){return `<div class="wb-row"><span class="wb-ic">${icon(x.format==='Carousel'?SLIDES:DOC)}</span><div class="wb-text"><div class="wb-t" title="${esc(x.title)}">${esc(x.title)}</div><div class="wb-m">${esc(x.format)} · ${esc(LABELS[x.status])} · ${esc(x.piece)}</div></div><button type="button" class="wb-act" data-wb-open="${i}">${esc(x.action?x.action.label:'Open piece')}</button></div>`;}
 function paint(){
  const d=document.getElementById('project-library'),main=d?.querySelector('.ht-home-main');if(!d?.open||!main)return;
  let band=main.querySelector(':scope>.wb-band');
  if(!items.length&&!message){band?.remove();return;}
  const shown=expanded?items:items.slice(0,SHOW);
  const html=`<div class="wb-head"><span class="wb-title">Waiting on you</span><span class="wb-sub">${items.length} ${items.length===1?'output needs':'outputs need'} your judgment · the next action for each${failed?` · ${failed} piece${failed===1?'':'s'} could not be read`:''}</span>${items.length>SHOW?`<button type="button" class="wb-all" data-wb-all aria-expanded="${expanded}">${expanded?'Show fewer':`Show all ${items.length}`}</button>`:''}</div>${message?`<p class="wb-msg" role="status">${esc(message)}</p>`:''}<div class="wb-list">${shown.map(row).join('')}</div>`;
  if(!band){band=document.createElement('section');band.className='wb-band';band.setAttribute('aria-label','Waiting on you');main.prepend(band);}
  if(band.dataset.render!==html){band.innerHTML=html;band.dataset.render=html;}
 }
 async function open(x){
  message='';
  await window.switchProject(x.projectId);
  if(current().id!==x.projectId)throw Error('The piece did not open. Save or resolve the current changes first.');
  await window.projectLibrary.close();
  if(document.getElementById('project-library')?.open)throw Error('Home is still open because the current work needs saving first.');
  if(!x.action)return;
  await window.realOutputOverview.onAction({projectId:x.projectId,outputId:x.id,kind:x.action.kind});
  const stage={native:5,arrange:9,review:10}[x.action.kind];if(stage)await viewPhase(stage);
  cache.delete(x.projectId);
 }
 document.addEventListener('click',event=>{
  const all=event.target.closest?.('#project-library [data-wb-all]');if(all){expanded=!expanded;paint();return;}
  const b=event.target.closest?.('#project-library [data-wb-open]');if(!b)return;
  const x=(expanded?items:items.slice(0,SHOW))[Number(b.dataset.wbOpen)];if(!x)return;
  b.disabled=true;
  void open(x).catch(error=>{message=error.message||'That output could not be opened. Your current work is retained.';paint();}).finally(()=>{if(b.isConnected)b.disabled=false;});
 });
 // Load whenever Home opens.
 let watched=null;
 new MutationObserver(()=>{const d=document.getElementById('project-library');if(d&&d!==watched){watched=d;const onOpen=()=>{if(d.open){message='';paint();void load();}};new MutationObserver(onOpen).observe(d,{attributes:true,attributeFilter:['open']});onOpen();}}).observe(document.body,{childList:true});
 window.waitingBand={load,paint,items:()=>items,whenIdle:()=>loading||Promise.resolve()};
})();
