/* Version two: Check. The saved words of one Article, read only, with the findings of the check beside them. Address:
   #/check/<subject>?piece=<output id>. It reads the saved words with study-draft.read, the saved check with
   study-draft.check.get, runs it with study-draft.check.post (the revision he read goes with it), and reads the decisions
   in the piece with current-work.read and study-ai.read, compared by the app's own /lib/decision-coverage.js. Check never
   changes the draft: it saves a check receipt and nothing else. A change to the saved draft, the check or the decisions
   arrives from the change stream and is shown. The sub bar and the finding of the piece's words belong to Write
   (v2.shared.write.bar and .locate), read when this screen opens; without them it says so plainly. Every rule starts
   with .ck. */
(function(v2){
 'use strict';
 const {esc,icon}=v2.ui,root=window,doc=document;
 const uuid=()=>root.V2Client.uuid();

 // ---------- pure helpers (pinned by tests/v2-check.test.mjs) ----------
 /** Two values with the same content, whatever their key order. */
 function same(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
 }
 /** The passages he can see: an empty protected placeholder is hidden, as in Write. Used only when Write's own is missing. */
 function rowsOf(read){
  const own=v2.shared.write?.rowsOf;if(typeof own==='function')return own(read);
  return (read?.projection||[]).filter(b=>!(b.safe===false&&String(b.words||'')==='')).map(b=>({id:b.id,kind:b.blockKind||'paragraph',words:String(b.words||''),safe:b.safe!==false}));
 }
 /** A saved check covers the saved words only when it names this piece and the very revision he reads now. */
 function receiptCurrent(receipt,read,{bindingId,parentStudyId}){
  return !!receipt&&!!read&&receipt.bindingId===bindingId&&receipt.parentStudyId===parentStudyId&&receipt.status!=='stale'&&same(receipt.proof?.expected,read.expected);
 }
 /** How a part of the check turned out, in the existing workspace's own words. */
 function outcome(check,type){
  const status=check?.status;
  if(status==='checked-pass')return 'Matched captured source';
  if(status==='checked-no-split')return 'No split detected';
  if(status==='not-applicable')return type==='quote'?'No supported quotes to check':'No quote pairs to compare';
  if(status==='failed')return 'Needs review';
  if(status==='split-detected')return 'Possible split, review';
  if(status==='unsupported'||status==='held')return 'Held, needs manual review';
  return 'Not completed';
 }
 /** Why, when the check says why (or when it cannot say a pass). */
 function reason(check){
  if(check?.reason)return check.reason==='No captured SRC available.'?'Capture the source transcript before checking.':check.reason;
  if(check?.status==='unsupported')return 'Some quotations use marks or languages this check cannot read. Compare them by eye.';
  if(check?.status==='not-applicable')return 'This is not a pass: no supported material was available for this check.';
  return '';
 }
 /** "1 of 2 quoted passages found" out of the quote guard's own output, or null when it says no such thing. */
 function quoteCounts(check){
  const m=/(\d+) of (\d+) quoted passages? found/i.exec(String(check?.output||''));
  return m?{found:Number(m[1]),of:Number(m[2])}:null;
 }
 /** The one line the state is said in, and the sentence under it. */
 function stateOf(receipt,current){
  if(!receipt)return {label:'No saved check',line:'Ready to check the saved revision.',kind:'none'};
  if(!current)return {label:'Outdated check',line:'The manuscript or captured source changed. Check the saved draft again.',kind:'old'};
  const status=receipt.status;
  if(status==='checked')return {label:'Mechanical checks complete',line:'Covers the current saved revision.',kind:'ok'};
  if(status==='needs-review')return {label:'Review needed',line:'Covers the current saved revision.',kind:'review'};
  if(status==='held')return {label:'Checks held',line:'Covers the current saved revision.',kind:'held'};
  if(status==='running'||status==='interrupted')return {label:'Check unfinished',line:'This saved check did not finish. Check the saved draft again.',kind:'bad'};
  return {label:'Check did not finish',line:'This saved check did not finish. Check the saved draft again.',kind:'bad'};
 }
 /** Why a held check is held: each distinct reason once, in plain words. */
 function heldWhy(receipt){
  if(!receipt||receipt.status!=='held')return '';
  const said=[];
  for(const part of [receipt.integrity,receipt.source,receipt.quote,receipt.split,receipt.photos]){
   const r=reason(part);if(r&&!said.includes(r)&&part?.status!=='available'&&part?.status!=='checked')said.push(r);
  }
  return said.join(' ')||receipt.error||'';
 }
 /** A finding in the existing workspace's own words: its title, what to do, and the quoted words. */
 function finding(issue){
  const text=String(issue?.message||issue?.text||'Check finding');
  if(text.startsWith('NOT FOUND:'))return {title:'Quote needs review',action:'Compare these words with the captured source.',words:issue.locator?.passage||/^NOT FOUND: "(.*)"$/.exec(text)?.[1]};
  if(text.startsWith('INVALID BRACKET:'))return {title:'Bracket needs review',action:'Review the bracketed wording against the source.'};
  if(text.startsWith('SPLIT ('))return {title:'Possible quote split',action:'Check whether these quote blocks belong to one source paragraph.'};
  if(/outside ASCII word tokenization/i.test(text))return {title:'Passage held',action:'A quotation uses letters this check cannot match, such as Chinese or accented words. Compare it with the source by eye.'};
  return {title:issue?.severity==='held'?'Passage held':'Needs review',action:text.replace(/^UNSUPPORTED:\s*/,'')};
 }
 /** Why a finding cannot be pointed to on the page. */
 const locatorNote=text=>/No unique passage locator/i.test(text||'')?'The check could not point to one place in the draft.':text||'';
 /** The paragraph's words with the passage marked, as markup; null when the passage is not in them. */
 function passageMarkup(words,passage){
  const w=String(words??''),p=String(passage??'');if(!p)return null;
  const at=w.indexOf(p);if(at<0)return null;
  return esc(w.slice(0,at))+'<mark class="ck-mark">'+esc(p)+'</mark>'+esc(w.slice(at+p.length));
 }
 /** "Saved 14:02", or the day and time when it was not today. */
 function whenLabel(iso,now=new Date()){
  try{
   const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
   const time=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});
   const sameDay=d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
   return sameDay?time:d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+', '+time;
  }catch{return '';}
 }
 // The decisions in a piece, in the existing workspace's own words.
 const DECISION_TITLES={'intent-unassessed':'Personal intent','guidance-unassessed':'Piece instruction','protected-paragraph-unassessed':'Protected wording','protected-literal-absent':'Protected wording absent','source-support-unassessed':'Source support','native-contracts-unavailable':'Protection and rejection history','context-incomplete':'Incomplete context','direction-unassessed':'Chosen direction','rejected-literal-present':'Rejected wording present','rejected-direction-literal-present':'Rejected direction wording','source-stale':'Source changed'};
 const decisionWeight=code=>({'protected-literal-absent':0,'rejected-literal-present':0,'source-stale':0,'protected-paragraph-unassessed':1,'guidance-unassessed':2,'native-contracts-unavailable':3,'source-support-unassessed':5,'context-incomplete':6}[code]??4);
 v2.shared.check=Object.freeze({same,receiptCurrent,outcome,reason,quoteCounts,stateOf,heldWhy,finding,locatorNote,passageMarkup,whenLabel,decisionWeight,DECISION_TITLES});

 let live=null;// the open screen, so leaving it can clean up

 v2.screen({id:'check',route:'check/:id',title:'Check',
  render:()=>'<div class="v2-page wr ck" data-ck><p class="wr-wait" role="status">Opening the check.</p></div>',
  mount(el,ctx){live=open(el.querySelector('[data-ck]'),ctx);return live.ready;},
  unmount(){live?.leave();live=null;}});

 function open(page,ctx){
  const id=ctx.params.id,human=v2.isHuman();
  const st={loc:null,read:null,rows:[],receipt:null,receiptNote:'',busy:false,error:'',hit:null,mine:new Set(),
   dec:{state:'idle',packet:null,report:null,note:'',busyOn:null}};
  let timer=null,gone=false,wanted=false,reading=null;
  const $=sel=>page.querySelector(sel);
  const W=()=>v2.shared.write||{};
  const aborted=()=>gone||ctx.signal.aborted;
  const scope=()=>({bindingId:st.loc.bindingId,parentStudyId:id});
  const piece=()=>st.loc?.piece||undefined;
  const adv=section=>v2.advanced({subject:id,piece:piece(),section});
  const writeHref=()=>v2.href('write/:id',{id},{piece:piece()});

  // ---------- reading ----------
  async function loadDraft(){
   const read=await v2.call('study-draft.read',scope());if(aborted())return false;
   st.read=read;st.rows=rowsOf(read);return true;
  }
  async function loadReceipt(){
   try{
    const receipt=await v2.call('study-draft.check.get',scope());if(aborted())return;
    st.receipt=receipt&&typeof receipt==='object'?receipt:null;st.receiptNote='';
   }catch(error){if(aborted())return;st.receiptNote=error.message||'The saved check could not be read.';}
  }
  const current=()=>receiptCurrent(st.receipt,st.read,{bindingId:st.loc?.bindingId,parentStudyId:id});
  /** Unsaved words in Write on this device are his alone and are not part of what is checked. Only the human is told. */
  function deviceWords(){
   if(!human||!st.loc?.bindingId)return false;
   try{
    const kept=JSON.parse(root.localStorage.getItem('ar-v2-write:'+st.loc.bindingId)||'null');
    return !!kept&&(Array.isArray(kept.edits)&&kept.edits.length>0||Array.isArray(kept.added)&&kept.added.some(a=>String(a?.text||'').trim()));
   }catch{return false;}
  }

  // ---------- drawing ----------
  const fallbackBar=()=>`<div class="wr-bar" data-wr-bar><a class="wr-back" href="${esc(v2.href('subject/:id',{id}))}" aria-label="Back to the subject">${icon('back')}<span>The subject</span></a><span class="wr-sp"></span></div>`;
  function bar(){
   const status=stateLabel();
   const right=`<span class="wr-saved ck-bar" data-ck-bar>${esc(status)}</span>`;
   try{
    if(typeof W().bar==='function')return W().bar({id,forms:st.loc.forms||[],form:st.loc.form,piece:piece()||null,mode:'check',right});
   }catch{/* the plain bar below */}
   return fallbackBar();
  }
  function stateLabel(){
   if(st.busy)return 'Checking';
   if(!st.read)return '';
   return stateOf(st.receipt,current()).label;
  }
  function shell(){
   page.innerHTML=`${bar()}
   <div class="ck-work">
    <aside class="ck-side" aria-label="The check">
     <section class="ck-sec" data-ck-run aria-labelledby="ck-h-run"></section>
     <section class="ck-sec" data-ck-dec aria-labelledby="ck-h-dec"></section>
     <section class="ck-sec ck-more" aria-label="Comparing versions"><p class="ck-label">Comparing versions</p>${v2.ui.notBuilt('Comparing this saved draft with an earlier version.',{advanced:{subject:id,piece:piece(),section:'check'}})}</section>
    </aside>
    <article class="ck-paper"><div class="ck-sheet">
     <h1 class="ck-title">${esc(st.loc.form?.title||st.loc.standing?.title||'')}</h1>
     ${human?'':`<p class="ck-ro" role="status">${esc('Opened as '+v2.actorName(v2.actor())+'. Check only reads the saved words; a check can still be run and is saved as a receipt.')}</p>`}
     <div class="ck-text" data-ck-text></div>
    </div></article>
   </div>`;
   paintRun();paintWords();paintDec();
  }
  function paintBar(){
   const el=$('[data-ck-bar]');if(el)el.textContent=stateLabel();
  }
  /** Repaint a part of the screen and put his focus back on the same control. */
  function keepFocus(box,draw){
   const a=doc.activeElement,mark=a&&box?.contains(a)?{ck:a.dataset.ck,n:a.dataset.n}:null;
   draw();
   if(mark?.ck){const t=box.querySelector(`[data-ck="${CSS.escape(mark.ck)}"]${mark.n!==undefined?`[data-n="${CSS.escape(mark.n)}"]`:''}`);if(t&&!t.disabled)t.focus({preventScroll:true});}
  }
  const currentFindings=()=>{
   if(!st.receipt||!current())return [];
   return (st.receipt.issues||[]).map((issue,n)=>{
    const f=finding(issue),native=issue.locator?.kind==='native-paragraph'?issue.locator.nativeId:null,onPage=!!native&&st.rows.some(r=>r.id===native);
    return {n,f,issue,native,onPage};
   });
  };
  function paintRun(){
   const box=$('[data-ck-run]');if(!box)return;
   keepFocus(box,()=>{
    const c=st.receipt,cur=current(),s=stateOf(c,cur),why=heldWhy(c),empty=!st.rows.some(r=>r.words.trim());
    const finds=c&&cur&&!st.busy?currentFindings():[];
    const stale=c&&!cur;
    const quotes=c?(()=>{const n=quoteCounts(c.quote),said=outcome(c.quote,'quote');return said+(n&&c.quote?.status==='failed'?': '+n.found+' of '+n.of+' quoted passages matched the captured source':n&&n.found?': '+n.found+' of '+n.of+' quoted passages matched':'');})():'';
    const rows=c?`<dl class="ck-results"><div><dt>Quotes</dt><dd>${esc(quotes)}${reason(c.quote)?`<small>${esc(reason(c.quote))}</small>`:''}</dd></div><div><dt>Splits</dt><dd>${esc(outcome(c.split,'split'))}${reason(c.split)?`<small>${esc(reason(c.split))}</small>`:''}</dd></div></dl>`:'';
    const list=finds.map(({n,f,issue,onPage})=>`<li class="ck-find" data-find="${n}"><div class="ck-find-h"><strong>${esc(f.title)}</strong>${onPage?`<button type="button" class="v2-ghost" data-ck="go" data-n="${n}" aria-pressed="${st.hit?.n===n}">Show in the words</button>`:''}</div><p>${esc(f.action)}</p>${f.words?`<blockquote>${esc(f.words)}</blockquote>`:''}${onPage?'':`<p class="ck-dim">${esc(locatorNote(issue.locator?.reason)||'No unique passage jump is available. The words are on the page; compare them there.')}</p>`}</li>`).join('');
    const sourceNote=finds.some(x=>x.f.words)?`<div class="ck-src">${v2.ui.notBuilt('Viewing the captured source beside a finding.',{advanced:{subject:id,piece:piece(),section:'check'}})}</div>`:'';
    const proof=c?`<details class="ck-proof"><summary>Check details and saved proof</summary><p>${esc(c.staleReason||'')}</p><p>Meaning, narration, bracket intent, independent editorial review, blind reading and rating are not verified. No editorial approval was granted.</p><p class="ck-dim">${esc('Saved '+whenLabel(c.finishedAt||c.createdAt))}${c.checkId?esc(' · receipt '+String(c.checkId).slice(0,8)):''}</p></details>`:'';
    box.innerHTML=`<h2 id="ck-h-run">Check this piece</h2>
     <div class="ck-state" data-kind="${esc(st.busy?'busy':s.kind)}" role="status"><strong>${esc(st.busy?'Checking this saved draft':s.label)}</strong><span>${esc(st.busy?'Your words are not changed.':empty?'Nothing is written yet. Write some words, then check them here.':s.line)}</span></div>
     ${why&&!st.busy?`<p class="ck-why">${esc(why)}</p>`:''}
     ${deviceWords()?'<p class="ck-note" role="status">You have unsaved words in Write on this device. A check covers the saved draft only.</p>':''}
     <div class="ck-btns"><button type="button" class="pri" data-ck="run"${st.busy||empty||!st.read?' disabled':''}>${st.busy?'Checking':c?'Check saved draft again':'Check saved draft'}</button>${stale||st.error||st.receiptNote?'<button type="button" class="v2-ghost" data-ck="reload">Load current saved draft</button>':''}${empty?`<a class="wr-btn" href="${esc(writeHref())}">Go to Write</a>`:''}</div>
     ${st.error?`<p class="ck-bad" role="alert">${esc(st.error)}</p>`:''}${st.receiptNote?`<p class="ck-bad" role="alert">${esc(st.receiptNote)}</p>`:''}
     ${rows}${c&&c.error?`<p class="ck-bad">${esc(c.error)}</p>`:''}
     ${list?`<ol class="ck-finds" aria-label="Findings">${list}</ol>`:c&&cur&&!st.busy&&c.status!=='held'&&!(c.issues||[]).length?'<p class="ck-dim">The check found nothing to review.</p>':''}
     ${sourceNote}${proof}`;
   });
   paintBar();
  }
  function rowHTML(r,flags){
   const hit=st.hit&&st.hit.id===r.id,flagged=flags.has(r.id);
   const body=hit?(passageMarkup(r.words,st.hit.passage)||esc(r.words)):esc(r.words);
   const attrs=` data-ck-p="${esc(r.id)}"${hit?' data-hit="true"':''}${flagged?' data-flag="true"':''} tabindex="-1"`;
   if(r.kind==='heading')return `<h2 class="ck-h"${attrs}>${body}</h2>`;
   if(r.kind==='blockquote')return `<blockquote class="ck-q"${attrs}>${body}</blockquote>`;
   return `<p class="ck-p"${attrs}>${body}</p>`;
  }
  function paintWords(){
   const box=$('[data-ck-text]');if(!box)return;
   const flags=new Set(currentFindings().filter(x=>x.onPage).map(x=>x.native));
   const rows=st.rows.filter(r=>r.words.trim());
   box.innerHTML=rows.length?rows.map(r=>rowHTML(r,flags)).join(''):`<p class="ck-dim" role="status">There are no saved words in this piece yet. <a href="${esc(writeHref())}">Write them in Write</a>, then check them here.</p>`;
  }

  // ---------- pressing a finding: its words come into view on the page ----------
  function show(n){
   const f=currentFindings().find(x=>x.n===n);if(!f||!f.onPage)return;
   st.hit={n,id:f.native,passage:f.issue.locator?.passage||f.f.words||''};
   paintWords();paintRun();
   const el=$(`[data-ck-p="${CSS.escape(f.native)}"]`);if(!el)return;
   const calm=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
   try{el.scrollIntoView({block:'center',behavior:calm?'auto':'smooth'});}catch{/* not scrollable here */}
   try{el.focus({preventScroll:true});}catch{/* nothing to focus */}
  }

  // ---------- the check ----------
  async function run(){
   if(st.busy||!st.read)return;
   st.busy=true;st.error='';st.hit=null;paintRun();paintWords();
   const operationId=uuid();st.mine.add(operationId);
   try{
    const receipt=await v2.call('study-draft.check.post',{...scope(),expected:st.read.expected,operationId});
    if(aborted())return;
    st.receipt=receipt;st.receiptNote='';
   }catch(error){
    if(aborted())return;
    if(error.kind==='stale'){
     await Promise.all([loadDraft(),loadReceipt()]);
     st.error='The saved words changed before the check started. Press Check saved draft to cover the new words.';
    }else st.error=error.message||'This check could not finish. Your words remain unchanged.';
   }finally{
    st.busy=false;
    if(!aborted()){paintRun();paintWords();if(wanted)soon();}
   }
  }
  async function reload(){
   if(st.busy)return;
   st.error='';
   try{await Promise.all([loadDraft(),loadReceipt()]);}catch(error){if(aborted())return;st.error=error.message||'The saved draft could not be read.';}
   if(aborted())return;
   paintRun();paintWords();loadDecisions();
  }
  function soon(){
   wanted=true;clearTimeout(timer);
   timer=setTimeout(async()=>{
    if(aborted())return;
    if(st.busy)return;// shown after the check, which asks again
    wanted=false;
    try{await Promise.all([loadDraft(),loadReceipt()]);}catch{return;}
    if(aborted())return;
    paintRun();paintWords();loadDecisions();
   },250);
  }

  // ---------- decisions in this piece ----------
  const rootBindingId=()=>st.loc?.standing?.facts?.bindingId||null;
  const selector=()=>({parentStudyId:id,rootBindingId:rootBindingId(),outputId:piece()});
  const decisionsPossible=()=>!!piece()&&!!rootBindingId()&&st.loc.native!==false;
  let coverage=null;
  const coverageModule=()=>coverage||=import('/lib/decision-coverage.js');
  async function loadDecisions(){
   const d=st.dec,token=d.token=(d.token||0)+1;
   if(!decisionsPossible()){d.state='none';d.packet=null;d.report=null;paintDec();return;}
   d.state='reading';d.note='';paintDec();
   try{
    const packet=await v2.call('current-work.read',{selector:selector()});
    if(aborted()||token!==d.token)return;
    if(packet.piece?.wordOwner?.kind!=='native'||packet.piece.wordOwner.bindingId!==st.loc.bindingId||packet.piece.words?.hash!==st.read?.expected?.workflow?.draft)throw Error('The saved wording owner changed. Reload its current words before checking decisions.');
    const {projectDecisionCoverage}=await coverageModule();
    if(aborted()||token!==d.token)return;
    d.packet=packet;d.report=projectDecisionCoverage(packet,{selector:selector(),expectedFingerprint:packet.fingerprint});d.state='ready';
   }catch(error){
    if(aborted()||token!==d.token)return;
    d.packet=null;d.report=null;d.state='error';
    d.note=error.kind==='stale'?'The saved words or decisions changed while they were being read. Reload decisions.':error.message||'Saved decisions could not be read.';
   }
   paintDec();
  }
  function paintDec(){
   const box=$('[data-ck-dec]');if(!box)return;
   keepFocus(box,()=>{
    const d=st.dec,report=d.report;
    const head=`<div class="ck-dec-h"><h2 id="ck-h-dec">Decisions in this piece</h2>${decisionsPossible()?'<button type="button" class="v2-ghost" data-ck="decisions">Reload decisions</button>':''}</div>`;
    if(d.state==='none'||d.state==='idle'){box.innerHTML=head+`<p class="ck-dim">${esc(decisionsPossible()?'Reading saved words and decisions.':'Decisions are read for the saved words of an Article that Check can open. They are not available for this piece.')}</p>`;return;}
    if(d.state==='reading'){box.innerHTML=head+'<p class="ck-dim" role="status">Reading saved words and decisions.</p>';return;}
    if(d.state==='error'||!report){box.innerHTML=head+`<p class="ck-bad" role="alert">${esc(d.note||'Saved decisions are unavailable.')}</p>`;return;}
    const status=report.status==='partial'?'Literal comparison complete. Meaning and intent remain unassessed.':report.status==='stale'?'Saved context changed. Reload decisions before reviewing.':'Decision coverage is unavailable for these saved words.';
    const rows=[...report.findings].sort((a,b)=>decisionWeight(a.code)-decisionWeight(b.code)).map(f=>{
     const record=f.evidence?.record,words=f.evidence?.replacement?.words||record?.body||record?.text||record?.value;
     const nav=f.navigation||{};
     const canReview=!!(nav.recordedParagraph?.paragraphId&&record?.selectionBlockHash&&record?.text&&nav.passages?.length);
     const note=nav.source?.sourceId?'Opens the source record; an exact passage jump is unavailable.':(nav.passages?.length||nav.recordedParagraph)?(canReview?'The recorded paragraph is verified again before it is shown.':'An exact passage route is unavailable. Compare the recorded words on the page.'):'';
     const text=f.code==='source-support-unassessed'?`${record?.selectedSourceCount??0} selected source passages in this snapshot. Claim support and meaning remain unassessed.`:f.message;
     return `<li class="ck-dec" data-finding="${esc(f.id)}"><div class="ck-find-h"><strong>${esc(DECISION_TITLES[f.code]||'Needs review')}</strong><span class="ck-pill">${esc(f.assessment==='mechanical'?'Literal finding':'Unassessed')}</span></div>${words?`<blockquote>${esc(words)}</blockquote>`:''}${record?.reason?`<p>${esc('Recorded reason: '+record.reason)}</p>`:''}<p>${esc(text)}</p>${note?`<p class="ck-dim">${esc(note)}</p>`:''}${canReview?`<div class="ck-btns"><button type="button" class="v2-ghost" data-ck="passage" data-n="${esc(f.id)}">Review passage</button></div>`:''}${nav.source?.sourceId?`<div class="ck-src">${v2.ui.notBuilt('Opening the source record beside the finding.',{advanced:{subject:id,piece:piece(),section:'source'}})}</div>`:''}</li>`;
    }).join('');
    box.innerHTML=head+`<p class="ck-dim" role="status">${esc(status)}</p><p class="ck-dim">Saved Article, current saved words.</p>${d.msg?`<p class="ck-note" role="status">${esc(d.msg)}</p>`:''}<ul class="ck-decs">${rows}</ul><p class="ck-dim">Saved wording only. Literal comparisons do not assess meaning, factual support, voice or consent. This is not wording or publication approval.</p>`;
   });
  }
  /** Review passage: the packet is read again, the recorded paragraph is found exactly, and only then shown. */
  async function reviewPassage(findingId){
   const d=st.dec,f=d.report?.findings.find(x=>x.id===findingId),packet=d.packet;if(!f||!packet||d.busyOn)return;
   d.busyOn=findingId;d.msg='Confirming the saved revision.';paintDec();
   try{
    const fresh=await v2.call('current-work.read',{selector:selector()});
    if(aborted())return;
    if(fresh.fingerprint!==packet.fingerprint)throw Error('The saved words or decisions changed. Reload decisions before following this finding.');
    const record=f.evidence?.record,pid=f.navigation?.recordedParagraph?.paragraphId;
    const native=await v2.call('study-ai.read',scope());
    if(aborted())return;
    const matches=(native.projection||[]).filter(row=>row.id===pid);
    if(native.expected?.workflow?.draft!==packet.piece.words.hash||matches.length!==1||matches[0].blockHash!==record.selectionBlockHash||!String(matches[0].words||'').includes(record.text))throw Error('The recorded paragraph changed or cannot be resolved exactly. Read the saved words and review the decision; no passage was guessed.');
    const el=$(`[data-ck-p="${CSS.escape(pid)}"]`);
    if(!el)throw Error('This exact passage is unavailable on the page. Reload decisions and read the saved words.');
    st.hit={n:-1,id:pid,passage:record.text};d.msg='';paintWords();
    const again=$(`[data-ck-p="${CSS.escape(pid)}"]`),calm=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try{again.scrollIntoView({block:'center',behavior:calm?'auto':'smooth'});}catch{/* not scrollable here */}
    try{again.focus({preventScroll:true});}catch{/* nothing to focus */}
   }catch(error){if(!aborted())d.msg=error.message||'This passage could not be shown.';}
   finally{d.busyOn=null;if(!aborted())paintDec();}
  }

  // ---------- events ----------
  function onClick(e){
   const b=e.target.closest?.('[data-ck]');if(!b||!page.contains(b))return;
   const act=b.dataset.ck;
   if(act==='run')void run();
   else if(act==='reload')void reload();
   else if(act==='go')show(Number(b.dataset.n));
   else if(act==='decisions')void loadDecisions();
   else if(act==='passage')void reviewPassage(b.dataset.n);
  }
  page.addEventListener('click',onClick);
  ctx.on({kinds:['study-draft*','current-work*','study-ai*','concept*','study.outputs*']},e=>{
   if(e&&!e.reset&&e.operationId&&st.mine.has(e.operationId))return;// this screen's own check
   soon();
  });
  ctx.on({},e=>{if(e?.reset)soon();});

  // ---------- opening ----------
  function plain(text,{link=true}={}){
   page.innerHTML=`<div class="ck-none"><p role="status">${esc(text)}</p><p><a class="wr-btn" href="${esc(v2.href('subject/:id',{id}))}">${icon('back')}Back to the subject</a>${link?` <a class="wr-btn" href="${esc(adv('check'))}">Open in Advanced${icon('out')}</a>`:''}</p></div>`;
  }
  async function ready(){
   try{
    if(typeof W().locate!=='function'){plain('Check could not find this piece’s words here, because the part of version two that finds them is not loaded. It opens in Advanced.');return;}
    const loc=await W().locate(id,ctx.query.piece||undefined);if(aborted())return;
    st.loc=loc||{};
    ctx.setTitle(st.loc.standing?.title||'Check');if(st.loc.standing?.look)v2.brand(st.loc.standing.look);
    ctx.setAdvanced({subject:id,piece:piece(),section:'check'});
    if(ctx.query.piece&&!st.loc.form){plain('This piece is not one of this subject’s Articles, or it does not exist. Go back to the subject to choose one.',{link:false});return;}
    if(!st.loc.form){plain('This subject has no Article yet, so there is nothing to check here.',{link:false});return;}
    if(st.loc.native===false||!st.loc.bindingId){plain('The words of this piece are not kept where Check can open them. Check them in Advanced.');return;}
    await loadDraft();if(aborted())return;
    await loadReceipt();if(aborted())return;
    shell();loadDecisions();
   }catch(error){if(aborted())return;plain(error.message||'This piece could not be opened.');}
  }
  function leave(){
   gone=true;clearTimeout(timer);page.removeEventListener('click',onClick);
  }
  return {ready:ready(),leave,state:st};
 }
})(window.v2);
