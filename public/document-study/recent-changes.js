/* What the other mode did, and what it is doing now (review A8, C2, C3, F-25, F-26, F-30).
   One reader of the coordination records the server keeps: who is here (presence), who holds a record (leases), and the
   journal of every operation. It gives the bar one quiet line ("Claude is editing ¶4 until 14:30"), turns an agent's
   question for the open piece into the bar's one primary ("Claude asks: …"), lists questions and handoffs for Home, and
   opens Recent changes: the journal for this piece grouped by who did it, each row opening the exact record.
   It only reads, except to send Adrian's answer to a question back as a journal handoff. Load after shell.js. */
(()=>{
 if(window.arLive)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const name=actor=>window.c3Shell?.actorName?.(actor)||String(actor||'Someone');
 const agent=actor=>String(actor||'').startsWith('agent:');
 const human=actor=>String(actor||'').startsWith('human:');
 const clock=at=>{const t=Date.parse(at);return Number.isFinite(t)?new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';};
 const when=at=>{const t=Date.parse(at);if(!Number.isFinite(t))return '';const d=new Date(t),today=new Date();return d.toDateString()===today.toDateString()?clock(at):d.toLocaleDateString([],{day:'numeric',month:'short'})+' '+clock(at);};
 const CLIENT={ui:'in the app',cli:'from the command line',mcp:'through a connected assistant',http:'over the local connection',file:'from a file'};
 const canFetch=()=>typeof fetch==='function';
 async function get(url){if(url.split('?')[0]==='/api/study-draft/catalog'&&window.nativeDraftCatalog)return window.nativeDraftCatalog.read();const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
 let presence=[],leases=[],asks=[],handoffs=[],humanLines=[],committedLines=[],committedStatus='pending',bindings=new Map(),loaded=false,ttlMs=120000,openAsk=null,askError='',answering=false;
 // ---------- the open piece: which records count as "here"
 function piece(){try{return typeof current==='function'?current():null;}catch{return null;}}
 function scopes(){
  const p=piece();if(!p)return [];const out=[{kind:'project',id:String(p.id)},{kind:'piece',id:String(p.id)}];
  const b=window.studyDraft?.currentBinding?.();if(b?.id)out.push({kind:'draft',id:b.id});
  if(typeof p.collectionBindingId==='string')out.push({kind:'draft',id:p.collectionBindingId},{kind:'collection',id:p.collectionBindingId});
  for(const o of window.c3PieceState?.read?.().outputs||[])if(o?.id)out.push({kind:'output',id:String(o.id)});
  for(const [id,parent] of bindings)if(parent===p.id)out.push({kind:'draft',id});
  return out;
 }
 const here=(scope,list=scopes())=>!!scope&&list.some(s=>s.kind===scope.kind&&s.id===scope.id);
 // Which piece a record belongs to, for Home.
 function pieceOf(scope){
  if(!scope)return null;const projects=(typeof state==='object'&&state?.projects)||[];
  if(['project','piece'].includes(scope.kind))return projects.find(p=>String(p.id)===scope.id)||null;
  if(scope.kind==='draft'||scope.kind==='collection'){const parent=bindings.get(scope.id);return projects.find(p=>p.id===parent||p.collectionBindingId===scope.id)||null;}
  return null;
 }
 // The section a record is worked on in; null means the whole piece.
 const STAGES={draft:[5,6,7],output:[9,10,12],source:[2],research:[3],media:[8],share:[11]};
 const stageOf=scope=>STAGES[scope?.kind]||null;
 // ---------- reading the records
 async function refreshNow(){
  if(!canFetch())return;
  const [pr,le,ask,hand,mine,committed]=await Promise.allSettled([get('/api/presence'),get('/api/leases'),get('/api/journal?status=needs-decision&limit=100'),get('/api/journal?status=handoff&limit=200'),get('/api/journal?'+new URLSearchParams({actor:'human:adrian',limit:'300'})),get('/api/journal?status=committed&limit=300')]);
  if(pr.status==='fulfilled'){presence=pr.value.presence||[];ttlMs=pr.value.ttlMs||ttlMs;}
  if(le.status==='fulfilled')leases=le.value.leases||[];
  if(ask.status==='fulfilled')asks=ask.value.lines||[];
  if(hand.status==='fulfilled')handoffs=hand.value.lines||[];
  if(mine.status==='fulfilled')humanLines=mine.value.lines||[];
  if(committed.status==='fulfilled'&&Array.isArray(committed.value.lines)){committedLines=committed.value.lines.filter(line=>line?.status==='committed');committedStatus='ready';}else committedStatus='unavailable';
  loaded=true;changed();
 }
 async function learnBindings(){if(!canFetch())return;try{const c=await get('/api/study-draft/catalog');const next=new Map();for(const r of c.drafts||[])if(r.bindingId)next.set(r.bindingId,r.parentStudyId||r.parentStudyKey);for(const r of c.collections||[])if(r.bindingId)next.set(r.bindingId,r.parentStudyId);bindings=next;changed();}catch{}}
 let queued=null;function refresh(delay=250){clearTimeout(queued);queued=setTimeout(()=>void refreshNow(),delay);}
 function changed(){window.dispatchEvent(new Event('c3-piece-state'));paintRecent();paintAsk();window.waitingBand?.paint?.();}
 // ---------- presence and leases: one quiet line for the bar
 function fresh(row){return Date.parse(row.lastSeen)+ttlMs>Date.now();}
 const VERB=/^(reading|editing|writing|proposing|checking|reviewing|drafting|researching|correcting|arranging|looking)\b/i;
 function note(){
  const list=scopes(),rows=presence.filter(r=>agent(r.actor)&&fresh(r)&&here(r.scope,list)),held=leases.filter(l=>agent(l.actor)&&Date.parse(l.expiresAt)>Date.now()&&here(l.scope,list));
  const who=[...new Set([...rows.map(r=>r.actor),...held.map(l=>l.actor)])];if(!who.length)return null;
  const first=who[0],row=rows.find(r=>r.actor===first),lease=held.find(l=>l.actor===first),stage=String(row?.stage||'').trim();
  // Short in the bar; the reason and the lease's end are in the title.
  let text=name(first)+' is '+(VERB.test(stage)?stage:stage?'working on '+stage:lease?'editing':'here');
  if(who.length>1)text+=' · and '+(who.length-1)+' more';
  return {text,title:who.map(a=>{const l=held.find(x=>x.actor===a),r=rows.find(x=>x.actor===a);return name(a)+(r?.stage?' · '+r.stage:'')+(l?' · holds this record until '+clock(l.expiresAt)+(l.reason?' ('+l.reason+')':''):'')+(r?' · seen '+clock(r.lastSeen):'');}).join('\n')};
 }
 // ---------- questions and handoffs
 const answered=line=>humanLines.some(h=>h.kind==='handoff'&&h.to===line.actor&&h.ts>line.ts&&h.scope?.kind===line.scope?.kind&&h.scope?.id===line.scope?.id&&((line.operationId&&h.operationId===line.operationId)||String(h.summary||'').includes('(asked '+line.ts+')')));
 const forMe=line=>!line.to||human(line.to);
 function openQuestions(){return asks.filter(l=>l.status==='needs-decision'&&forMe(l)&&!answered(l));}
 // A handoff waits until Adrian does anything on that record after it.
 function openHandoffs(){return handoffs.filter(l=>l.status==='handoff'&&agent(l.actor)&&forMe(l)&&!humanLines.some(h=>h.ts>l.ts&&h.scope?.kind===l.scope?.kind&&h.scope?.id===l.scope?.id));}
 /** The bar's primary on this section when an agent asks about the open piece. */
 function question(stage){
  const list=scopes(),q=openQuestions().find(l=>here(l.scope,list)&&(!stageOf(l.scope)||stageOf(l.scope).includes(stage)));
  if(!q)return null;const short=q.summary.length>38?q.summary.slice(0,36).trimEnd()+'…':q.summary;return {label:name(q.actor)+' asks: '+short,ask:q,reason:name(q.actor)+' asks: '+q.summary};
 }
 /** Questions first, then handoffs, for Home's Waiting band. */
 function waiting(){
  const row=(line,type)=>{const p=pieceOf(line.scope);return {type,line,projectId:p?.id||null,piece:p?.name||'',title:line.summary||'',who:name(line.actor),stage:stageOf(line.scope)?.[0]||null};};
  return [...openQuestions().map(l=>row(l,'question')),...openHandoffs().map(l=>row(l,'handoff'))];
 }
 // ---------- answering: the answer goes back to the asker as a journal handoff on the same record
 async function answer(line,text){
  text=String(text||'').trim();if(!text)throw Error('Choose or write an answer first.');
  // The tail names the question exactly (its time), so the asker and this page can match the answer to it.
  const tail=' (asked '+line.ts+')',summary=('Answer: '+text+' — to “'+String(line.summary||'').slice(0,120)+'”').slice(0,280-tail.length)+tail;
  const body={scope:line.scope,to:line.actor,summary,...(line.operationId?{operationId:line.operationId}:{})};
  const r=await fetch('/api/journal/handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let result={};try{result=await r.json();}catch{}
  if(!r.ok)throw Error(result.error||'The answer could not be sent. Try again.');
  humanLines=[result,...humanLines];changed();refresh(50);
  if(typeof toast==='function')toast('Answer sent to '+name(line.actor)+'.');
  return result;
 }
 // ---------- the question sheet, opened from the bar's primary
 function showAsk(line){openAsk=line;askError='';paintAsk();document.querySelector('#ar-ask button,#ar-ask input')?.focus({preventScroll:true});}
 function closeAsk(){openAsk=null;askError='';document.getElementById('ar-ask')?.remove();}
 function paintAsk(){
  let box=document.getElementById('ar-ask');const line=openAsk;
  if(!line||answered(line)&&!answering){box?.remove();if(line&&answered(line))openAsk=null;return;}
  if(!box){box=document.createElement('div');box.id='ar-ask';box.setAttribute('role','dialog');box.setAttribute('aria-labelledby','ar-ask-title');document.body.append(box);}
  const bar=document.getElementById('c3-surface-bar')?.getBoundingClientRect();box.style.setProperty('--ar-ask-top',Math.max(8,(bar?.bottom||56)+6)+'px');
  const html=`<p class="ar-ask-who" id="ar-ask-title">${esc(name(line.actor))} asks · ${esc(when(line.ts))}</p><p class="ar-ask-q">${esc(line.summary)}</p>${(line.options||[]).length?`<div class="ar-ask-options" role="group" aria-label="Answers">${line.options.map((o,i)=>`<button type="button" class="ar-ask-opt" data-ar-ask-option="${i}" ${answering?'disabled':''}>${esc(o)}</button>`).join('')}</div>`:''}<form class="ar-ask-own" data-ar-ask-form><label><span>${(line.options||[]).length?'Or answer in your own words':'Your answer'}</span><input type="text" maxlength="200" data-ar-ask-text ${answering?'disabled':''}></label><button type="submit" class="ar-ask-send" ${answering?'disabled':''}>Send</button></form>${askError?`<p class="ar-ask-err" role="alert">${esc(askError)}</p>`:''}<button type="button" class="ar-ask-later" data-ar-ask-close>Not now</button>`;
  if(box.dataset.render!==html){const typed=box.querySelector('[data-ar-ask-text]')?.value||'';box.innerHTML=html;box.dataset.render=html;const input=box.querySelector('[data-ar-ask-text]');if(input&&typed)input.value=typed;}
 }
 async function send(text){if(!openAsk||answering)return;answering=true;askError='';paintAsk();try{await answer(openAsk,text);closeAsk();}catch(error){askError=error.message;}finally{answering=false;paintAsk();window.dispatchEvent(new Event('c3-piece-state'));}}
 document.addEventListener('click',event=>{
  const opt=event.target.closest?.('#ar-ask [data-ar-ask-option]');if(opt&&openAsk){void send(openAsk.options[Number(opt.dataset.arAskOption)]);return;}
  if(event.target.closest?.('#ar-ask [data-ar-ask-close]')){closeAsk();return;}
 });
 document.addEventListener('submit',event=>{const form=event.target.closest?.('#ar-ask [data-ar-ask-form]');if(!form)return;event.preventDefault();void send(form.querySelector('[data-ar-ask-text]')?.value);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&openAsk){closeAsk();document.querySelector('#c3-surface-bar [data-sb-primary]')?.focus();}});
 // ---------- Recent changes: the journal for this piece, grouped by who did it
 const KINDS=[[/^study-draft\.save$/,'Saved the draft'],[/^study-draft\.undo$/,'Undid a saved edit'],[/^study-draft\.history-restore$/,'Restored an earlier version'],[/^study-draft\.open$/,'Opened a working copy'],[/^study-draft\.create-collection$/,'Started the piece'],[/^study-draft\./,'Changed the draft'],[/^study-ai\.propose/,'Proposed wording'],[/^study-ai\.accept/,'Accepted proposed wording'],[/^study-ai\.reject/,'Turned down proposed wording'],[/^study-ai\.prepare/,'Prepared to propose wording'],[/^study-ai\./,'Worked on proposals'],[/^concept\.save$/,'Saved the direction'],[/^concepts\.post$/,'Started the project'],[/^concept/,'Changed the direction'],[/^study\.human-direction/,'Changed the direction'],[/^study\.outputs/,'Changed an output'],[/^study\.share/,'Changed Share'],[/^study\.photos|^study\.media/,'Changed media'],[/^source-sessions/,'Corrected the source'],[/^lease\.override$/,'Saved while an assistant was working'],[/^handoff$/,'Handed over'],[/^ask$/,'Asked']];
 function label(line){const k=String(line.kind||'');const hit=KINDS.find(([re])=>re.test(k));return hit?hit[1]:'Changed '+k.replace(/[._-]+/g,' ');}
 function outcome(line){
  if(line.status==='committed')return '';
  if(line.status==='conflict')return line.kind==='lease.override'?'told '+name(line.to):line.http===423?'held: someone else was working on it':'not applied: a newer version existed';
  if(line.status==='rejected')return 'not applied'+(line.reason?': '+String(line.reason).slice(0,120):'');
  if(line.status==='needs-decision')return answered(line)?'answered':'waiting on you';
  if(line.status==='handoff')return 'to '+name(line.to);
  return line.status||'';
 }
 let recentOpen=false,recentLines=[],recentError='',recentLoading=false,recentAll=false;
 async function loadRecent(){
  if(!canFetch())return;recentLoading=true;recentError='';paintRecent();
  try{
   const list=recentAll?[null]:scopes().filter((s,i,a)=>a.findIndex(x=>x.kind===s.kind&&x.id===s.id)===i&&s.kind!=='piece');
   const parts=await Promise.all(list.map(s=>get('/api/journal?'+new URLSearchParams(s?{kind:s.kind,id:s.id,limit:'100'}:{limit:'150'})).then(v=>v.lines||[])));
   const seen=new Set();recentLines=parts.flat().filter(l=>{if(l.status!=='committed'||['first-flow.select','study.photos.select','study.human-direction.select','study-draft.open'].includes(l.kind))return false;const k=l.ts+'|'+l.operationId+'|'+l.kind+'|'+l.status;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,150);
  }catch(error){recentError='Recent changes could not be read. Nothing was changed.';}
  finally{recentLoading=false;paintRecent();}
 }
 function openRecent({all=false}={}){recentAll=all;recentOpen=true;paintRecent();void loadRecent();}
 function closeRecent(){recentOpen=false;const d=document.getElementById('ar-recent');if(d?.open)d.close?.();d?.removeAttribute('open');}
 function paintRecent(){
  if(!recentOpen)return;let d=document.getElementById('ar-recent');
  if(!d){d=document.createElement('dialog');d.id='ar-recent';d.setAttribute('aria-labelledby','ar-recent-title');document.body.append(d);d.addEventListener('close',()=>{recentOpen=false;});}
  const p=piece(),groups=new Map();for(const l of recentLines){const key=human(l.actor)?'human':l.actor;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(l);}
  // You first, then each assistant, newest activity first.
  const order=[...groups.keys()].sort((a,b)=>a==='human'?-1:b==='human'?1:groups.get(b)[0].ts.localeCompare(groups.get(a)[0].ts));
  let index=0;const rows=[];
  const body=order.map(key=>{const lines=groups.get(key),who=key==='human'?'You':name(key),kind=key==='human'?'':agent(key)?'Assistant · ':'';return `<section class="ar-rc-group" aria-label="${esc(who)}"><h3><span class="ar-rc-who">${esc(who)}</span><span class="ar-rc-kind">${esc(kind)}${lines.length} change${lines.length===1?'':'s'}</span></h3><ol>${lines.map(l=>{const i=index++;rows[i]=l;const o=outcome(l),via=CLIENT[l.client]||'';return `<li class="ar-rc-row" data-status="${esc(l.status)}"><div class="ar-rc-text"><span class="ar-rc-what">${esc(label(l))}${l.summary&&['handoff','needs-decision','conflict'].includes(l.status)?': '+esc(String(l.summary).slice(0,160)):''}</span><span class="ar-rc-meta">by ${esc(who)}${via?' '+esc(via):''} · ${esc(when(l.ts))}${o?' · '+esc(o):''}</span></div>${openable(l)?`<button type="button" class="ar-rc-open" data-ar-rc-open="${i}">${esc(openLabel(l))}</button>`:''}</li>`;}).join('')}</ol></section>`;}).join('');
  d._rows=rows;
  const html=`<div class="ar-rc-head"><h2 id="ar-recent-title">Recent changes</h2><p>${recentAll?'Everything recorded, by who did it.':'What happened to '+esc(p?.name||'this piece')+', by who did it.'}</p><div class="ar-rc-tools"><button type="button" data-ar-rc-versions title="Every saved version of this piece, with Preview and Restore">Earlier versions</button><button type="button" data-ar-rc-scope aria-pressed="${recentAll}">${recentAll?'Only this piece':'Everything'}</button><button type="button" data-ar-rc-close>Close</button></div></div>${recentError?`<p class="ar-rc-err" role="alert">${esc(recentError)}</p>`:''}${recentLoading&&!recentLines.length?'<p class="ar-rc-empty" role="status">Reading the record…</p>':!recentLines.length&&!recentError?'<p class="ar-rc-empty">Nothing recorded yet for this piece. Saves, answers and handovers appear here as they happen, whoever makes them.</p>':''}<div class="ar-rc-body">${body}</div>`;
  if(d.dataset.render!==html){d.innerHTML=html;d.dataset.render=html;}
  if(!d.open){if(d.showModal)try{d.showModal();}catch{d.setAttribute('open','');}else d.setAttribute('open','');}
 }
 const openable=l=>!!(pieceOf(l.scope)||here(l.scope))&&['draft','project','piece','collection','output','source'].includes(l.scope?.kind)&&!(l.status==='needs-decision'&&answered(l));
 const openLabel=l=>l.status==='needs-decision'?'Answer':l.scope?.kind==='draft'&&l.status==='committed'&&/^study-draft\.(save|undo|history-restore)$|^study-ai\.accept/.test(l.kind)&&l.operationId?'See this version':'Open';
 /** Open the exact record a journal line names: the saved version, the direction, the output or the source. */
 async function openRecord(line){
  const p=pieceOf(line.scope)||(here(line.scope)?piece():null);if(!p)return false;
  if(piece()?.id!==p.id&&typeof window.switchProject==='function'){await window.switchProject(p.id);if(piece()?.id!==p.id)throw Error('The piece did not open. Save or resolve the current changes first.');}
  if(document.getElementById('project-library')?.open)await window.projectLibrary?.close?.();
  closeRecent();
  const kind=line.scope.kind;
  if(line.status==='needs-decision'){const s=stageOf(line.scope);if(s&&!s.includes(window.c3PieceState?.stage?.()))await window.viewPhase?.(s[0]);showAsk(line);return true;}
  if(kind==='draft'){if(openLabel(line)==='See this version'&&await window.studyDraft?.previewVersion?.(line.operationId))return true;await window.viewPhase?.(5);return true;}
  if(kind==='output'){if(window.realOutputOverview?.onAction){try{await window.realOutputOverview.onAction({projectId:p.id,outputId:line.scope.id,kind:'native'});return true;}catch{}}await window.viewPhase?.(12);return true;}
  if(kind==='source'){await window.viewPhase?.(2);return true;}
  await window.viewPhase?.(4);return true;
 }
 document.addEventListener('click',event=>{
  if(event.target.closest?.('#ar-recent [data-ar-rc-close]')){closeRecent();return;}
  if(event.target.closest?.('#ar-recent [data-ar-rc-versions]')){closeRecent();if(!window.studyDraft?.showHistory?.())[...document.querySelectorAll('#app [onclick]')].find(n=>/modal='history'/.test(n.getAttribute('onclick')||''))?.click();return;}
  if(event.target.closest?.('#ar-recent [data-ar-rc-scope]')){recentAll=!recentAll;recentLines=[];paintRecent();void loadRecent();return;}
  const b=event.target.closest?.('#ar-recent [data-ar-rc-open]');if(b){const line=document.getElementById('ar-recent')?._rows?.[Number(b.dataset.arRcOpen)];if(line){b.disabled=true;void openRecord(line).catch(error=>{recentError=error.message;paintRecent();}).finally(()=>{if(b.isConnected)b.disabled=false;});}}
 });
 // ---------- staying current: the live stream says when anything changed
 function hook(){
  const live=window.c3Shell?.live;if(!live)return;
  live.on({},event=>{
   if(event.reset){void learnBindings();refresh(50);if(recentOpen)void loadRecent();return;}
   if(['presence','handoff','needs-decision'].includes(event.kind)||/^lease\./.test(event.kind||'')||human(event.actor)||agent(event.actor)&&event.status==='committed')refresh();
   if(/^study-draft\./.test(event.kind||'')&&event.scope?.kind!=='draft')void learnBindings();
   if(recentOpen&&(recentAll||here(event.scope))&&event.kind!=='presence'){clearTimeout(hook.t);hook.t=setTimeout(()=>void loadRecent(),300);}
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook,{once:true});else setTimeout(hook,0);
 // Presence fades after two minutes without a heartbeat; repaint the bar line when it may have.
 if(typeof EventSource==='function')setInterval(()=>{if(document.visibilityState!=='hidden'&&(presence.length||leases.length))changed();},30000);
 if(canFetch()){void learnBindings();void refreshNow();}
 window.arLive={note,question,waiting,answer,showAsk,closeAsk,openRecent,closeRecent,openRecord,refresh:refreshNow,label,state:()=>({loaded,presence,leases,asks,handoffs,humanLines,committedLines,committedStatus})};
})();
