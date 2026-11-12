/* Version three: Write, paragraphs, saving and keeping words on the device. Holds the paragraphs on the page, the save loop (study-draft.save), the Article started from the first saved words, the server version taken in, the newer-version choice, and his unsaved words kept on this device.
   Moved out of write.js without a change to what it does: the same code, in the same order, now in a function that write.js
   calls once for each open page with the page's shared state (W). Names it needs from the other files are reached through W. */
(function(v2){
 'use strict';
 const root=window,doc=document;
 v2.shared['write-page']=function(W){
  const {esc,uuid,clock,savedLabel,AUTOSAVE_MS,rowsOf,minimalDiff,buildOps,flat,bar,own}=W.lib;
  const {st,clk,page,ctx,id,$,scope,dirty,say,mine}=W;
  const loadProps=(...a)=>W.loadProps(...a);
  const paintNotes=(...a)=>W.paintNotes(...a);
  const presence=(...a)=>W.presence(...a);
  const readDraft=(...a)=>W.readDraft(...a);
  const sameRevision=(...a)=>W.sameRevision(...a);
  const undoOp=(...a)=>W.undoOp(...a);

   // ---------- one paragraph, one editable line of the page ----------
   // Each paragraph is its own contenteditable="plaintext-only" element. What it holds is read as text only: a ring (any
   // node marked data-ring, never editable) is skipped, so nothing but his words ever reaches the save. The element is given
   // the same small surface a text box has (value, selectionStart, selectionEnd, setSelectionRange, readOnly), so the save
   // loop below reads and places his words and his caret exactly as it did, in offsets of his text.
   const SKIP=n=>n.nodeType===1&&n.hasAttribute('data-ring');
   function textOf(el){
    let out='';
    const walk=n=>{for(const c of n.childNodes){if(c.nodeType===3)out+=c.data;else if(c.nodeType===1&&!SKIP(c)){if(c.tagName==='BR'){if(c.nextSibling)out+='\n';}else walk(c);}}};
    walk(el);return out;
   }
   /** How many characters of his text come before a point in the element (a node and an offset, as a selection gives). */
   function offsetOf(el,node,offset){
    if(node===el||node.nodeType===1){
     let n=0;const kids=[...node.childNodes].slice(0,offset);
     for(const k of kids)n+=k.nodeType===3?k.data.length:k.nodeType===1&&!SKIP(k)&&k.tagName!=='BR'?textOf(k).length:0;
     return node===el?n:offsetOf(el,node.parentNode,[...node.parentNode.childNodes].indexOf(node))+n;
    }
    let n=0,found=false;
    const walk=p=>{for(const c of p.childNodes){if(found)return;if(c===node){n+=offset;found=true;return;}if(c.nodeType===3)n+=c.data.length;else if(c.nodeType===1&&!SKIP(c))walk(c);}};
    walk(el);return found?n:textOf(el).length;
   }
   /** The text node and offset where his text reaches n characters. */
   function pointAt(el,n){
    let left=Math.max(0,n),last=null;
    const walk=p=>{for(const c of p.childNodes){if(c.nodeType===3){last=c;if(left<=c.data.length)return [c,left];left-=c.data.length;}else if(c.nodeType===1&&!SKIP(c)){const r=walk(c);if(r)return r;}}return null;};
    return walk(el)||(last?[last,last.data.length]:[el,0]);
   }
   // Only an element the browser itself edits has a caret of its own; otherwise the last place set is kept here.
   function selOf(el){
    if(el.isContentEditable===true)try{
     const s=doc.getSelection?.();
     if(s&&s.rangeCount){const r=s.getRangeAt(0);if(el.contains(r.startContainer)&&el.contains(r.endContainer)){el._wrSel=[offsetOf(el,r.startContainer,r.startOffset),offsetOf(el,r.endContainer,r.endOffset)];return el._wrSel;}}
    }catch{/* no selection here */}
    const n=textOf(el).length;return el._wrSel?el._wrSel.map(x=>Math.min(x,n)):[n,n];
   }
   function editable(el){
    if(!el||el.tagName==='TEXTAREA'||el._wrEd)return el;el._wrEd=true;
    Object.defineProperties(el,{
     value:{configurable:true,get(){return textOf(el);},set(v){el.textContent=String(v??'');el.toggleAttribute('data-empty',!el.textContent);}},
     selectionStart:{configurable:true,get(){return selOf(el)[0];}},
     selectionEnd:{configurable:true,get(){return selOf(el)[1];}},
     readOnly:{configurable:true,get(){return el.getAttribute('contenteditable')==='false';}},
     setSelectionRange:{configurable:true,value(a,b=a){
      const n=textOf(el).length;a=Math.max(0,Math.min(a,n));b=Math.max(a,Math.min(b,n));el._wrSel=[a,b];
      if(el.isContentEditable===true)try{const s=doc.getSelection(),r=doc.createRange(),[sn,so]=pointAt(el,a),[en,eo]=pointAt(el,b);r.setStart(sn,so);r.setEnd(en,eo);s.removeAllRanges();s.addRange(r);}catch{/* the caret stays where it is */}
     }}
    });
    return el;
   }

   // ---------- the unsaved words, kept on this device: his only ----------
   const KEY=()=>'ar-v3-write:'+st.bindingId;
   /** Everything unsaved goes to the device under his key, with the saves whose answer has not come back (the operation
       and what it carried), so a reload in the middle of a save can tell his own committed save from a newer version. */
   function stash(){
    if(!st.human)return;// an assistant's page never keeps or restores words as if they were his
    try{
     if(!dirty()){root.localStorage.removeItem(KEY());return;}
     root.localStorage.setItem(KEY(),JSON.stringify({v:2,at:Date.now(),draft:st.base?.expected?.workflow?.draft||'',
      edits:[...st.edits].map(([k,v])=>[k,v.text,v.orig]),added:st.added.filter(a=>String(a.text).trim()).map(a=>({id:a.id,afterId:a.afterId,text:a.text})),
      sent:st.sent,base:[...st.baseWords]}));
    }catch{/* private window or blocked storage: the words are still on the page */}
   }
   function unstash(){
    if(!st.human)return null;
    try{
     const s=JSON.parse(root.localStorage.getItem(KEY())||'null');
     if(!s||(s.v!==1&&s.v!==2)||!Array.isArray(s.edits)||!Array.isArray(s.added))return null;
     if(!Array.isArray(s.sent))s.sent=[];return s;
    }catch{return null;}
   }

   // ---------- the order on the page: his passages, with new paragraphs after the one they follow ----------
   function ensureTail(){
    if(!st.human)return;
    const last=st.rows.length?st.rows[st.rows.length-1].id:null;
    const tail=st.added[st.added.length-1];
    if(!tail||String(tail.text).trim()){
     const lastAdded=st.added.length?st.added[st.added.length-1]:null;
     st.added.push({id:uuid(),afterId:lastAdded?lastAdded.id:last,text:''});
    }
   }
   function order(){
    const out=[],ids=new Set(st.rows.map(r=>r.id)),kids=new Map();
    for(const a of st.added){const key=ids.has(a.afterId)||st.added.some(x=>x.id===a.afterId)?a.afterId:(st.rows.at(-1)?.id??null);if(!kids.has(key))kids.set(key,[]);kids.get(key).push(a);}
    const addKids=key=>{for(const a of kids.get(key)||[]){out.push({id:a.id,kind:'paragraph',level:0,text:a.text,safe:true,fresh:true});addKids(a.id);}};
    addKids(null);
    for(const r of st.rows){out.push({id:r.id,kind:r.kind,level:r.level,text:st.edits.get(r.id)?.text??r.words,safe:r.safe,fresh:false});addKids(r.id);}
    return out;
   }
   function removeAdded(a){st.added=st.added.filter(x=>x!==a);for(const k of st.added)if(k.afterId===a.id)k.afterId=a.afterId;}

   function rowHTML(r,n){
    const label=r.kind==='heading'?'Heading':'Paragraph '+n;
    if(!r.safe)return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><p class="wr-lock" title="This passage has formatting that is kept as it is. Change it in Advanced.">${esc(r.text)}</p><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
    const cls=r.kind==='heading'?' wr-h':r.kind==='blockquote'?' wr-q':'';
    if(st.plain)return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><textarea class="wr-ed${cls}" rows="1" data-ed="${esc(r.id)}" aria-label="${esc(label)}" spellcheck="true"${st.human?'':' readonly'}${r.fresh&&!r.text?' placeholder="Write here"':''}>${esc(r.text)}</textarea><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
    const tag=r.kind==='heading'?'h2':'p';
    return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><${tag} class="wr-ed${cls}" data-ed="${esc(r.id)}" role="textbox" aria-multiline="false" aria-label="${esc(label)}" spellcheck="true" tabindex="0" contenteditable="${st.human?'plaintext-only':'false'}"${st.human?'':' aria-readonly="true"'}${r.fresh?' data-placeholder="Write here"':''}${r.text?'':' data-empty=""'}>${esc(r.text)}</${tag}><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
   }
   function paintText(){
    const box=$('[data-wr-text]');if(!box)return;
    // Never rebuilt under a word he is still composing (an accent, a phone's suggestion): it is drawn when he finishes it.
    if(st.composing&&doc.activeElement?.dataset?.ed&&box.contains(doc.activeElement)){st.paintWanted=true;return;}
    const keep=doc.activeElement?.dataset?.ed?{id:doc.activeElement.dataset.ed,a:doc.activeElement.selectionStart,b:doc.activeElement.selectionEnd}:null;
    ensureTail();let n=0;
    box.innerHTML=order().map(r=>rowHTML(r,r.kind==='heading'?0:++n)).join('');
    box.querySelectorAll('[data-ed]').forEach(editable);
    box.querySelectorAll('textarea').forEach(fit);
    paintNotes();paintKept();
    if(keep){const t=box.querySelector(`[data-ed="${CSS.escape(keep.id)}"]`);if(t){t.focus({preventScroll:true});try{t.setSelectionRange(keep.a,keep.b);}catch{}}}
   }
   function fit(t){if(t.tagName!=='TEXTAREA')return;t.style.height='auto';t.style.height=(t.scrollHeight+1)+'px';}

   // ---------- the status: one place in the bar, one line, a short form when narrow ----------
   const ICON={check:'check',cloud:'cloud',warn:'warn',lock:'lock',undo:'undo'};
   /** What the bar says, in its long and short forms, with its mark and whether Try again stands beside it. */
   function status(){
    const tried=st.fail?.tries||[],since=st.fail?.since;
    if(st.none)return {text:''};
    if(!st.human)return {text:'Read only',short:'Read only'};
    if(st.making)return {text:'Starting the Article',short:'Starting',mark:'spin'};
    if(st.fail&&st.saving)return {text:'Trying to save',short:'Trying',mark:'spin',tone:'bad',retry:'busy'};
    if(st.fail&&!st.stopped&&!st.conflict)return {text:tried.length>1?'Still not saved, tried '+clock(tried.at(-1)):since?'Not saved since '+clock(since):'Not saved yet, the app is not answering',short:'Not saved',mark:'cloud',tone:'bad',retry:true};
    if(st.problem)return {text:st.problem,short:'Not saved',mark:'cloud',tone:'bad'};
    if(st.saving)return {text:'Saving',short:'Saving',mark:'spin'};
    if(st.conflict)return {text:'Not saved: a newer version exists',short:'Two versions',mark:'warn',tone:'bad'};
    if(dirty())return {text:'Not saved yet',short:'Not saved',mark:'cloud'};
    if(st.back){const n=st.back.ids.size,said='Taken back '+(n===1?'1 paragraph':n+' paragraphs');return {text:said,short:'Taken back',mark:'undo',back:true};}
    const saved=st.savedAt?savedLabel(st.savedAt):'Saved';
    return {text:saved,short:saved,mark:'check'};
   }
   function paintSaved(){
    // Put back is offered while the paragraphs stand as Undo left them; once they change, the offer ends (the words stay on the device).
    if(st.back&&!dirty()&&!st.saving&&!stillAsUndoLeftThem()){st.back=null;const c=backCopy();if(c){c.ended=true;keepBackCopy(c);}}
    const s=status();
    page.querySelectorAll('[data-wr-saved]').forEach(el=>{el.textContent=s.text;el.dataset.tone=s.tone||'';el.closest('[data-wr-status]')?.setAttribute('title',s.text);});
    page.querySelectorAll('[data-wr-saved-s]').forEach(el=>{el.textContent=s.short||s.text;el.dataset.tone=s.tone||'';});
    const ic=$('[data-wr-st-ic]');if(ic)ic.innerHTML=s.mark==='spin'?'<span class="wr-spin"></span>':s.mark?own(ICON[s.mark]):'';
    const retry=$('[data-wr="retry"]');if(retry){retry.hidden=!s.retry;retry.disabled=s.retry==='busy';}
    const back=$('[data-wr="putback"]');if(back)back.hidden=!s.back;
    // Undo never acts on words that are not saved, so it says why it is off, in its name and its title, and stays in its place.
    const us=undoState();
    page.querySelectorAll('[data-wr="undo"]').forEach(b=>{const label=us.why?'Undo is not available. '+us.why:'Undo';b.disabled=!!us.why;b.setAttribute('aria-label',label);b.title=label;});
    if(st.ask&&us.why)st.ask=null;
    paintAsk();
    paintFail();
   }
   /** A save that did not reach the app: what Try again does, what is safe meanwhile, and Copy all my words. */
   function paintFail(){
    const box=$('[data-wr-fail]');if(!box)return;
    const f=st.human&&st.fail&&!st.stopped&&!st.conflict?st.fail:null;box.hidden=!f;if(!f){box.innerHTML='';box._wrHtml='';return;}
    const trying=st.saving,tried=f.tries.map(clock),list=tried.length>1?tried.slice(0,-1).join(', ')+' and '+tried.at(-1):tried[0];
    // Rebuilt only when what it says changes, never because a save started: pressing Copy all my words while a paragraph
    // has the caret starts a save (leaving the paragraph saves it), and a button rebuilt under the pointer loses the click.
    const html=`<div class="wr-item wr-on"><div class="wr-hd"><h2>${esc(f.tries.length>1?'Still not saved':f.since?'Your changes since '+clock(f.since)+' are not saved yet':'Your words are not saved yet')}</h2>${f.tries.length>1?`<p class="wr-by">${esc('Tried at '+list+'. The app has not answered.')}</p>`:''}</div>
     <p class="wr-says"><b>Try again</b> sends them to the app now.</p>
     <p class="wr-says"><b>Meanwhile</b> they are kept on this device, so you can keep writing.</p>
     <p class="wr-says"><b>If it fails again</b>, copy all your words and paste them anywhere safe, such as a note.</p>
     <div class="wr-acts"><button type="button" class="wr-b wr-pri" data-wr="retry"></button><button type="button" class="wr-b" data-wr="copy">${own('copy')}Copy all my words</button></div></div>`;
    if(box._wrHtml!==html){box.innerHTML=html;box._wrHtml=html;}
    const retry=box.querySelector('[data-wr="retry"]');if(retry){retry.disabled=!!trying;retry.innerHTML=trying?'<span class="wr-spin"></span>Trying':'Try again';}
   }
   /** Try again, now: the same save, with the same words. */
   function tryAgain(){if(!st.human||st.saving)return;clearTimeout(clk.timer);st.stopped=false;void save({quiet:true});}
   /** Every word of the piece as it stands on this page, saved or not: the title, then each passage, a blank line between. */
   function allWords(){
    const out=[],title=String(st.form?.title||st.standing?.title||'').trim();if(title)out.push(title);
    for(const r of order()){const t=String(r.text??'').trim();if(t)out.push(t);}
    const copies=st.human?[...earlierBack(),backCopy()].filter(Boolean):[],kept=copies.flatMap(c=>c.before.map(e=>String(e.words||'').trim()).filter(Boolean));
    if(kept.length)out.push('Taken back with Undo:',...kept);
    return out.join('\n\n');
   }
   async function copyAll(){
    const text=allWords(),n=(text.match(/\S+/g)||[]).length;let ok=false;
    try{await root.navigator.clipboard.writeText(text);ok=true;}catch{/* the older way below */}
    if(!ok){try{const ta=doc.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';doc.body.appendChild(ta);ta.select();ok=!!doc.execCommand?.('copy');ta.remove();}catch{ok=false;}}
    say(ok?`Copied all ${n} words. Paste them anywhere safe.`:'The words could not be copied here. Select them on the page and copy them by hand.',ok?'good':'bad');
    return ok?text:null;
   }

   // ---------- kept phrases: a hairline under words he keeps exactly, drawn without touching the text ----------
   async function loadKept(){
    if(!st.bindingId)return;
    try{const c=await v2.call('study-ai.contracts',scope());if(ctx.signal.aborted)return;st.kept=(c?.protections||[]).filter(p=>p&&p.active&&typeof p.text==='string'&&p.text).map(p=>({id:p.paragraphId,text:p.text}));}catch{st.kept=[];}
    paintKept();
   }
   function paintKept(){
    const reg=root.CSS?.highlights,H=root.Highlight;if(!reg||!H)return;// where the browser cannot draw it, nothing is drawn
    const ranges=[];
    for(const k of st.kept||[]){
     const el=page.querySelector(`[data-ed="${CSS.escape(k.id)}"]`);if(!el||el.tagName==='TEXTAREA')continue;
     const text=textOf(el),at=text.indexOf(k.text);if(at<0||text.lastIndexOf(k.text)!==at)continue;
     try{const r=doc.createRange(),[sn,so]=pointAt(el,at),[en,eo]=pointAt(el,at+k.text.length);r.setStart(sn,so);r.setEnd(en,eo);ranges.push(r);}catch{/* not drawn */}
    }
    try{if(ranges.length)reg.set('wr-kept',new H(...ranges));else reg.delete('wr-kept');}catch{/* not drawn */}
   }

   // ---------- Undo in the bar: only his latest saved change, never his unsaved words ----------
   // Undo never saves anything first and never reaches past the latest saved change. While there are unsaved words, a save is
   // running or the app is not answering, it is off and says why (typing is undone by the browser's own Ctrl or Cmd Z). What it
   // takes back is captured first and offered back with Put back, kept on this device too.
   const latestOf=read=>[...(read?.history||[])].filter(h=>h.state==='committed').pop()||null;
   const plural=n=>n===1?'1 paragraph':n+' paragraphs';
   function undoState(){
    if(!st.human)return {why:'This page was opened as '+v2.actorName(v2.actor())+'. Only Adrian writes here.'};
    if(st.making)return {why:'The Article is being started. Undo is ready in a moment.'};
    if(st.conflict)return {why:'A newer version of this piece is saved. Choose which to keep first.'};
    if(st.saving)return {why:st.fail?'Trying to save your words. Undo is ready when they are saved.':'Saving. Undo is ready when the save is done.'};
    if(st.fail||st.problem)return {why:st.fail?'The app is not answering, so your words are not saved yet. Undo is ready when they are saved.':'Your words could not be saved yet. Undo is ready when they are saved.'};
    if(dirty())return {why:'Your words are not saved yet. Undo takes back saved changes. To undo typing, press Ctrl or Cmd Z.'};
    const h=latestOf(st.base),at=h&&h.modifiedAt?' at '+clock(h.modifiedAt):'';
    if(!h)return {why:'Nothing has been saved here yet.'};
    if(!h.canUndo)return {why:'The latest saved change'+at+' can no longer be undone, so Undo leaves everything as it is.'};
    if(!st.ops.has(h.operationId))return {why:'The latest saved change'+at+' was not made on this page, so Undo leaves it. Undo only takes back your own latest change.'};
    return {entry:h};
   }
   /** The paragraphs a save touched, counted as the places it changed (a split or a join counts once). */
   function noteSave(info){
    const ids=new Set([...(info.edits||[]).map(e=>e[0]),...(info.added||[]).map(a=>a[0]),...(info.splits||[]).map(x=>x.id),...(info.joins||[]).map(x=>x.leftId)]);
    st.saves.set(info.operationId,{count:ids.size});
   }
   async function undoLast(){
    const s=undoState();
    if(s.why){say(s.why,'info');paintSaved();return;}
    st.ask=null;
    let fresh;
    try{fresh=await readDraft();}catch{say('The app is not answering, so nothing was taken back.','bad');return;}
    if(ctx.signal.aborted||undoState().why)return;// he typed, or a save began, while it was being read
    const h=latestOf(fresh);
    if(!sameRevision(fresh,st.base)){
     adopt(fresh);paintSaved();
     say('A change was saved since this page was drawn, and the page now shows it. Nothing was taken back. Press Undo again to take back the latest change.','warn');return;
    }
    if(!h||!h.canUndo||!st.ops.has(h.operationId)){say('The latest saved change can no longer be undone, so nothing was taken back.','warn');paintSaved();return;}
    const n=st.saves.get(h.operationId)?.count||0;
    // One paragraph is taken back at once (and put back with one press). More than one asks first, saying what it will take back.
    if(n!==1){st.ask={operationId:h.operationId,count:n,at:h.modifiedAt};paintAsk();return;}
    await takeBack(h.operationId,{latestOnly:true});paintSaved();
   }
   function paintAsk(){
    const box=$('[data-wr-undo]');if(!box)return;
    const a=st.human?st.ask:null;box.hidden=!a;
    if(!a){box.innerHTML='';box._wrHtml='';return;}
    const when=a.at?clock(a.at):'',what=a.count>1?plural(a.count)+(when?' saved at '+when:' saved'):'your latest saved change'+(when?', made at '+when:'');
    const html=`<div class="wr-item wr-on"><div class="wr-hd"><h2>${esc('This takes back '+what+'.')}</h2></div>
     <p class="wr-says">${esc('Straight after, Put back brings those words back.')}</p>
     <div class="wr-acts"><button type="button" class="wr-b wr-pri" data-wr="undo-yes">${esc(a.count>1?'Take back '+plural(a.count):'Take it back')}</button><button type="button" class="wr-b" data-wr="undo-no">${esc(a.count>1?'Keep them':'Keep it')}</button></div></div>`;
    if(box._wrHtml!==html){box.innerHTML=html;box._wrHtml=html;}
   }
   const noAsk=()=>{st.ask=null;paintAsk();};
   async function yesAsk(){
    const a=st.ask;if(!a)return;noAsk();
    const s=undoState();
    if(s.why||s.entry.operationId!==a.operationId){say('Things changed while you were deciding, so nothing was taken back.','warn');paintSaved();return;}
    await takeBack(a.operationId,{latestOnly:true});paintSaved();
   }

   // ---------- Put back: the words Undo took back, kept in this page and on this device ----------
   const BACK=()=>'ar-v3-write-back:'+st.bindingId;
   function backCopy(){try{const c=JSON.parse(root.localStorage.getItem(BACK())||'null');return c&&c.v===1&&Array.isArray(c.before)?c:null;}catch{return null;}}
   function keepBackCopy(c){
    if(!st.human)return;
    try{
     // A new Undo never writes over the words an earlier Undo took back: those are set aside under their own key first, so they
     // stay on this device (and in Copy all my words) even when they were never put back.
     if(c&&c.state==='pending'){const old=backCopy();if(old&&old.before.some(e=>String(e.words||'').trim()))root.localStorage.setItem(BACK()+':'+(old.at||Date.now()),JSON.stringify({...old,ended:true}));}
     if(c)root.localStorage.setItem(BACK(),JSON.stringify(c));else root.localStorage.removeItem(BACK());
    }catch{/* the words are still held by the page */}
   }
   /** Words taken back by earlier Undos, set aside on this device, oldest first. */
   function earlierBack(){
    const out=[];
    try{const ls=root.localStorage,pre=BACK()+':';for(let i=0;i<ls.length;i++){const k=ls.key(i);if(k&&k.startsWith(pre))try{const c=JSON.parse(ls.getItem(k));if(c&&Array.isArray(c.before))out.push(c);}catch{/* left alone */}}}catch{/* blocked storage */}
    return out.sort((a,b)=>(a.at||0)-(b.at||0));
   }
   /** What Undo changed: the paragraphs that differ between the page as it stood and as Undo left it. Those, as they stood, are what
       Put back writes again. Returns false when Undo changed no words. */
   function settleBack(before,afterRead,time){
    const after=rowsOf(afterRead),bm=new Map(before.map(r=>[r.id,r])),am=new Map(after.map(r=>[r.id,r])),ids=[];
    for(const r of before)if(!am.has(r.id)||am.get(r.id).words!==r.words)ids.push(r.id);
    for(const r of after)if(!bm.has(r.id))ids.push(r.id);
    if(!ids.length){st.back=null;keepBackCopy(null);return false;}
    const prev=new Map(before.map((r,i)=>[r.id,i?before[i-1].id:null]));
    const c={v:1,at:Date.now(),time:time||null,ids,before:ids.filter(id=>bm.has(id)).map(id=>({id,words:bm.get(id).words,safe:bm.get(id).safe,afterId:prev.get(id)})),now:ids.map(id=>[id,am.has(id)?am.get(id).words:null]),ended:false};
    st.back={...c,ids:new Set(ids)};keepBackCopy(c);return true;
   }
   /** The offer ends when he types over those paragraphs or they change. The words stay on the device, in Copy all my words. */
   function endBack(){
    if(!st.back)return;st.back=null;
    const c=backCopy();if(c){c.ended=true;keepBackCopy(c);}
    paintSaved();
   }
   const stillAsUndoLeftThem=()=>{const now=new Map(st.rows.map(r=>[r.id,r]));return st.back.now.every(([id,words])=>words===null?!now.has(id):now.get(id)?.words===words);};
   /** After a reload: the device holds what Undo took back. Offered again when the paragraphs still stand as Undo left them. */
   function loadBack(){
    if(!st.human||!st.bindingId)return;
    const c=backCopy();if(!c||c.ended)return;
    if(c.state==='pending'){// the page closed with the answer to Undo still on its way: did the server take it back?
     if(!settleBack(c.before,st.base,c.time))return;
     return;
    }
    const ids=new Set(c.ids||[]);
    st.back={...c,ids};
    if([...ids].some(id=>st.edits.has(id))||!stillAsUndoLeftThem()){st.back=null;c.ended=true;keepBackCopy(c);say('Words you took back with Undo are kept on this device. Copy all my words includes them.','info');}
   }
   /** Takes back one saved change, found by its own operation. The paragraphs it will change are captured first, as they stand. */
   async function takeBack(operationId,{latestOnly=false}={}){
    if(!st.human)return false;
    let before=null;
    try{
     const fresh=await readDraft();
     const entry=(fresh.history||[]).find(h=>h.operationId===operationId&&h.state==='committed'&&h.canUndo);
     if(!entry){say('That can no longer be undone, because the words have changed since.','warn');return false;}
     if(latestOnly&&(latestOf(fresh)?.operationId!==operationId||dirty()||st.saving)){say('The latest saved change is not that one any more, so nothing was taken back.','warn');return false;}
     before=rowsOf(fresh);
     keepBackCopy({v:1,at:Date.now(),state:'pending',time:entry.modifiedAt||null,before:before.map(r=>({id:r.id,words:r.words,safe:r.safe})),now:null});
     const result=await v2.call('study-draft.undo',{...scope(),expected:fresh.expected,undoOperationId:operationId});
     const after=Array.isArray(result?.projection)?result:await readDraft();
     settleBack(before,after,entry.modifiedAt);
     adopt(after);loadProps();paintSaved();
     return true;
    }catch(error){
     if(before){
      // Refused for good: nothing changed. Anything else (the app did not answer): look, because it may have been taken back.
      if(['stale','refused','owner-only','held'].includes(error.kind))keepBackCopy(null);
      else{try{const now=await readDraft();if(settleBack(before,now,null))adopt(now);}catch{/* kept as pending: the next open settles it */}}
     }
     say(error.message,'bad');paintSaved();return false;
    }
   }
   /** Put back: the words Undo took back go on the page as his unsaved words and are saved the ordinary way, with the revision
       he read. A paragraph that is gone comes back as a new one after the one before it. If the app's version has moved on, the
       save is refused and he chooses between the two versions as always. */
   async function putBack(){
    const b=st.back;if(!b||!st.human||dirty()||st.saving||st.conflict)return;
    if(!stillAsUndoLeftThem()){endBack();say('Those paragraphs have changed since, so they were not put back. The taken back words stay on this device.','warn');return;}
    const byId=new Map(st.rows.map(r=>[r.id,r])),made=new Map(),before=new Map(b.before.map(e=>[e.id,e]));
    for(const e of b.before){
     const r=byId.get(e.id);
     if(r){if(r.safe&&r.words!==e.words)st.edits.set(e.id,{text:e.words,orig:r.words});continue;}
     if(!e.safe||!String(e.words).trim())continue;
     let at=e.afterId,guard=0;
     while(at&&!byId.has(at)&&!made.has(at)&&guard++<1000)at=before.get(at)?.afterId??null;
     const fresh={id:uuid(),afterId:at?made.get(at)||at:null,text:e.words};
     st.added.push(fresh);made.set(e.id,fresh.id);
    }
    for(const [id,words] of b.now){if(words!==null&&!before.has(id)){const r=byId.get(id);if(r&&r.safe)st.edits.set(id,{text:'',orig:r.words});}}
    if(!dirty()){st.back=null;keepBackCopy(null);paintSaved();return;}
    clearTimeout(clk.timer);stash();paintText();paintSaved();
    const ok=await save({hold:null});
    if(ok&&!dirty()){st.back=null;keepBackCopy(null);say('Put back.','good');}
    paintSaved();
   }

   // ---------- the conflict: his words and the newer saved ones, side by side ----------
   function paintConflict(){
    const box=$('[data-wr-conflict]');if(!box)return;
    const c=st.conflict;box.hidden=!c;if(!c){box.innerHTML='';return;}
    // Both sides, paragraph by paragraph: what he has changed, and what the saved version changed that he has not seen.
    const rows=rowsOf(c.fresh),fresh=new Map(rows.map(r=>[r.id,r])),base=st.baseWords,items=[];
    const says=(label,body)=>`<p><b>${label}</b> ${body}</p>`,note=text=>`<i>${esc(text)}</i>`;
    for(const r of rows){
     const e=st.edits.get(r.id),was=base.has(r.id)?base.get(r.id):e?.orig;
     if(was===undefined){items.push(says('Yours',note('Nothing here yet.'))+says('Saved',note('A new paragraph in the saved version: ')+esc(r.words)));continue;}
     const changed=was!==r.words;
     if(e)items.push(says('Yours',e.text.trim()?esc(e.text):note('You emptied this paragraph.'))+says('Saved',changed?esc(r.words):note('Not changed in the saved version.')));
     else if(changed)items.push(says('Yours',note('You have not changed this paragraph.'))+says('Saved',esc(r.words)));
    }
    for(const [rid,e] of st.edits){if(!fresh.has(rid))items.push(says('Yours',e.text.trim()?esc(e.text):note('You emptied this paragraph.'))+says('Saved',note('This paragraph is not in the saved version.')));}
    for(const [rid,was] of base){if(!fresh.has(rid)&&!st.edits.has(rid))items.push(says('Yours',esc(was))+says('Saved',note('This paragraph was removed in the saved version.')));}
    for(const a of st.added.filter(a=>String(a.text).trim()))items.push(says('Yours',esc(a.text))+says('Saved',note('A new paragraph. It is not in the saved version.')));
    const shown=items.slice(0,24),lines=shown.map(x=>`<li>${x}</li>`).join('')+(items.length>shown.length?`<li><p class="wr-dim">${esc('And '+(items.length-shown.length)+' more paragraphs differ.')}</p></li>`:'');
    const h=(c.fresh.history||[]).filter(x=>x.state==='committed').slice(-1)[0];
    const by=h&&h.actor&&!/unknown/.test(h.actor)?v2.actorName(h.actor)+(h.modifiedAt?' at '+clock(h.modifiedAt):''):'';
    box.innerHTML=`<h2>A newer version of this piece is saved${by?' by '+esc(by.replace(/^You/,'you')):''}</h2>
     <p class="wr-dim">Your words are still here and are not saved. Choose which to keep. Nothing is mixed for you.</p>
     <ul class="wr-pairs">${lines||'<li><p class="wr-dim">You have no unsaved words. The saved version is the newer one.</p></li>'}</ul>
     <div class="wr-row-btns"><button type="button" class="pri" data-act="mine">Keep my words</button><button type="button" data-act="theirs">Use the saved version</button></div>`;
   }
   function noticeNewer(fresh){
    st.conflict={fresh};st.problem='';paintConflict();paintSaved();
   }
   async function useSaved(){
    const fresh=st.conflict?.fresh||await readDraft();
    st.edits.clear();st.added=[];st.conflict=null;adopt(fresh);paintConflict();stash();presence();paintSaved();
   }
   async function keepMine(){
    const c=st.conflict;if(!c)return;
    // His edits go on top of the saved version. A paragraph the saved version no longer has comes back as a new one.
    const fresh=new Map(rowsOf(c.fresh).map(r=>[r.id,r]));let after=c.fresh?rowsOf(c.fresh).at(-1)?.id??null:null;
    for(const [rid,e] of [...st.edits]){
     const f=fresh.get(rid);
     if(!f||!f.safe){st.edits.delete(rid);if(String(e.text).trim())st.added.push({id:uuid(),afterId:after,text:e.text});}
     else if(f.words===e.text)st.edits.delete(rid);else st.edits.set(rid,{text:e.text,orig:f.words});
    }
    st.base=c.fresh;st.rows=rowsOf(c.fresh);st.baseWords=wordsMap(st.rows);foldAdded();st.conflict=null;st.problem='';st.stopped=false;paintConflict();paintText();stash();await save({hold:null});
   }

   // ---------- taking in a server version ----------
   const wordsMap=rows=>new Map(rows.map(r=>[r.id,r.words]));
   /** A new paragraph the server now holds is an edit of that saved paragraph, never a second insert with the same id. */
   function foldAdded(){
    const now=new Map(st.rows.map(r=>[r.id,r]));
    for(const a of [...st.added]){
     const r=now.get(a.id);if(!r)continue;
     st.added=st.added.filter(x=>x!==a);
     if(a.text!==r.words&&r.safe)st.edits.set(r.id,{text:a.text,orig:r.words});
    }
   }
   /** Puts the server's version on the page. Nothing he typed is dropped: a paragraph he is still editing keeps his words
       against the new text, one that has just been saved as new becomes an edit of the saved paragraph, and words typed into
       a paragraph that is gone come back as a new paragraph after the one before it. */
   function adopt(read){
    const old=st.rows;
    st.base=read;st.rows=rowsOf(read);st.baseWords=wordsMap(st.rows);
    const h=(read.history||[]).filter(x=>x.state==='committed'&&x.modifiedAt).slice(-1)[0];
    if(h&&!st.savedAt)st.savedAt=h.modifiedAt;
    const now=new Map(st.rows.map(r=>[r.id,r]));
    for(const [rid,e] of [...st.edits]){
     const r=now.get(rid);
     if(!r){
      st.edits.delete(rid);
      if(String(e.text).trim()){
       let after=st.rows.length?st.rows[st.rows.length-1].id:null;const at=old.findIndex(x=>x.id===rid);
       if(at>=0){after=null;for(let i=at-1;i>=0;i--)if(now.has(old[i].id)){after=old[i].id;break;}}
       st.added.push({id:uuid(),afterId:after,text:e.text});
      }
     }else if(r.words===e.text)st.edits.delete(rid);
     else e.orig=r.words;
    }
    foldAdded();
    paintText();
   }
   /** Where a position in the old text lands in the new one, through the one change between them. */
   function carryAt(d,at){return at<=d.from?at:at>=d.to?at+d.insert.length-(d.to-d.from):d.from+d.insert.length;}
   /** A save of his own has been answered, or is found committed after a reload. What it carried is settled; what he typed
       after it was sent is carried onto the paragraphs it made (the difference between the text sent and his text now), so
       nothing typed meanwhile is lost and nothing is saved twice. Returns where his caret belongs in a new paragraph. */
   function settleSent(read,info){
    const now=new Map(rowsOf(read).map(r=>[r.id,r])),later=[],caret={};
    const cur=id=>st.edits.has(id)?st.edits.get(id).text:null;
    for(const sp of info.splits||[]){
     // What was written after the whole paragraph now follows its second half, so the empty box stays after the last paragraph.
     for(const a of st.added)if(a.afterId===sp.id)a.afterId=sp.newId;
     const typed=cur(sp.id),c=typed===null?sp.text:typed;st.edits.delete(sp.id);
     if(c===sp.text)continue;
     const d=minimalDiff(sp.text,c),m=carryAt(d,sp.at);
     later.push([sp.id,c.slice(0,m).trimEnd()],[sp.newId,c.slice(m).trimStart()]);
     caret[sp.newId]=Math.max(0,d.from+d.insert.length-m);
    }
    for(const j of info.joins||[]){
     const l=cur(j.leftId),r=cur(j.rightId),cl=l===null?j.leftText:l,cr=r===null?j.rightText:r;st.edits.delete(j.leftId);st.edits.delete(j.rightId);
     if(cl===j.leftText&&cr===j.rightText)continue;
     const joined=now.get(j.leftId)?.words||'',sep=joined.startsWith(j.leftText)&&joined.endsWith(j.rightText)&&joined.length>=j.leftText.length+j.rightText.length?joined.slice(j.leftText.length,joined.length-j.rightText.length):' ';
     later.push([j.leftId,cl+sep+cr]);
    }
    for(const [rid,text] of info.edits||[]){if(st.edits.get(rid)?.text===text)st.edits.delete(rid);}
    const sentAdd=new Map(info.added||[]);
    st.added=st.added.filter(a=>!(sentAdd.has(a.id)&&sentAdd.get(a.id)===a.text));
    adopt(read);
    for(const [rid,text] of later){const r=now.get(rid);if(r&&r.safe&&text!==r.words)st.edits.set(rid,{text,orig:r.words});}
    if(later.length)paintText();
    return caret;
   }
   /** After a refusal or a read, are the new committed saves all his own, saves whose answers never reached this page? If
       so they are settled and the server's version taken in, and it is not a newer version. */
   function takeOwn(fresh){
    const known=new Set((st.base?.history||[]).map(h=>h.operationId));
    const fresh_=(fresh.history||[]).filter(h=>h.state==='committed'&&!known.has(h.operationId));
    if(!fresh_.length||fresh_.some(h=>!st.ops.has(h.operationId)))return false;
    const done=new Set(fresh_.map(h=>h.operationId));
    const infos=st.sent.filter(i=>done.has(i.operationId));st.sent=st.sent.filter(i=>!done.has(i.operationId));
    if(infos.length)for(const info of infos){noteSave(info);settleSent(fresh,info);}else adopt(fresh);
    stash();return true;
   }

   // ---------- saving ----------
   function say403(error){st.problem=error.message;st.stopped=true;say(error.message,'bad');}
   const settled=async()=>{while(st.saving){try{await st.running;}catch{/* its own caller shows it */}}};
   /** One save: his unsaved words (and any extra operation such as a join or a split) in one study-draft.save, with the
       revision he read. Resolves true when it was saved. */
   function save(opts={}){
    if(!st.human)return Promise.resolve(false);
    // While the Article is being made nothing is saved (the create needs the draft as it was read); what he types waits in
    // the boxes and is saved the moment the Article exists.
    if(st.making)return Promise.resolve(false);
    if(st.saving){st.again=true;return st.running;}
    st.running=run(opts);return st.running;
   }
   async function run({quiet=false,extra=[],hold,undoText='',focus=null}={}){
    if(st.conflict||!st.bindingId)return false;
    const holdId=hold===undefined?(doc.activeElement?.dataset?.ed||null):hold;
    const ops=buildOps({rows:st.rows,edits:st.edits,added:st.added,hold:holdId}).concat(extra);
    // Nothing left to send: no save is failing any more (a refused split leaves nothing unsaved), so the bar stops saying so.
    if(!ops.length){st.problem='';st.fail=null;paintSaved();stash();return false;}
    // What goes in this save, in a plain record kept with his words until the answer is in (a reload cannot lose it).
    const textOf=id=>st.edits.has(id)?st.edits.get(id).text:(st.rows.find(r=>r.id===id)?.words??''),addedById=new Map(st.added.map(a=>[a.id,a]));
    const info={operationId:mine(uuid()),
     edits:ops.filter(o=>o.kind==='text'||o.kind==='delete').map(o=>[o.id,o.kind==='delete'?'':st.edits.get(o.id)?.text??'']),
     added:ops.filter(o=>o.kind==='insert').map(o=>[o.id,addedById.get(o.id)?.text??o.raw]),
     splits:ops.filter(o=>o.kind==='split').map(o=>({id:o.id,at:o.at,newId:o.newId,text:textOf(o.id)})),
     joins:ops.filter(o=>o.kind==='join').map(o=>({leftId:o.leftId,rightId:o.rightId,leftText:textOf(o.leftId),rightText:textOf(o.rightId)}))};
    const operationId=info.operationId;
    st.sent=[...st.sent,info].slice(-6);st.saving=true;st.problem='';stash();paintSaved();
    let ok=false,retry=false;
    try{
     const result=await v2.call('study-draft.save',{...scope(),operationId,expected:st.base.expected,operations:ops});
     st.sent=st.sent.filter(x=>x!==info);noteSave(info);
     const caret=settleSent(result,info);st.savedAt=new Date().toISOString();st.stopped=false;st.fail=null;ok=true;
     stash();presence();loadProps();
     const text=undoText||(ops.some(o=>o.kind==='delete')?'Paragraph deleted.':'');
     if(text&&(result.history||[]).some(h=>h.operationId===operationId&&h.canUndo))v2.ui.undo(text,()=>undoOp(operationId));
     if(focus)focusEditor(focus.id,caret[focus.id]??focus.at);
    }catch(error){
     if(error.kind==='stale'||error.kind==='refused'||error.kind==='owner-only')st.sent=st.sent.filter(x=>x!==info);// not committed
     if(error.kind==='stale'||error.kind==='owner-only'||error.kind==='refused'||error.kind==='held')st.fail=null;
     if(error.kind==='stale'){
      // Only a newer revision on the server is a newer version, and a save of his own that this page never heard back from
      // is not newer. Any other refusal is the server's own words.
      let fresh=null;try{fresh=await readDraft();}catch{/* the words stay on this device */}
      if(fresh&&!sameRevision(fresh,st.base)){
       if(takeOwn(fresh))retry=true;else noticeNewer(fresh);
      }
      else{st.problem=error.body?.error||'The app could not save these words.';st.stopped=true;if(!quiet)say(st.problem,'bad');}
     }
     else if(error.kind==='owner-only'){say403(error);}
     else{
      st.problem=error.kind==='held'||error.kind==='refused'?error.message:'Could not save. Your words are kept on this device.';st.stopped=error.kind==='refused'||error.kind==='held';if(!quiet)say(error.message,'bad');
      // The app did not answer: the bar says since when, Try again stands beside it, and it is tried again by itself.
      if(!st.stopped){st.fail={since:st.fail?.since??st.savedAt,tries:[...(st.fail?.tries||[]),new Date().toISOString()].slice(-6)};schedule(5000);}
     }
    }finally{
     st.saving=false;st.saveSeq++;stash();paintSaved();
     if(retry&&dirty())schedule(300);
     if(st.again){st.again=false;if(dirty())schedule(300);}
     if(st.refreshWanted){st.refreshWanted=false;void refresh();}
    }
    if(ok&&st.starting)void startArticle();
    return ok;
   }
   /** His first saved words start the Article, as Add a form does in the existing workspace: study-draft.save has put the
       words in the subject's draft, and study.outputs.create (from that draft, with the revisions just read) makes the
       Article. Anything he types while the first save runs is saved first. The boxes stay as they are, open for typing, while the
       Article is made, and the page is not rebuilt afterwards. If it cannot be made, his words stay saved and it is tried again. */
   async function startArticle(){
    if(st.creating||clk.gone||!st.starting||!st.human||st.startStopped)return;
    st.creating=true;
    try{
     for(let i=0;i<8&&(dirty()||st.saving)&&!st.conflict&&!st.stopped;i++){clearTimeout(clk.timer);if(st.saving)await settled();else await save({quiet:true,hold:null});}
     if(dirty()||st.conflict||st.stopped||clk.gone){st.creating=false;return;}
     st.making=true;clearTimeout(clk.timer);paintSaved();
     try{
      const standing=await v2.call('subject.standing',{parentStudyId:id});
      const articleOf=s=>((s.forms||[]).find(f=>f.kind==='article'&&/^out:/.test(f.key||''))||{}).id||null;
      let outId=articleOf(standing);
      if(!outId){
       const sc={rootBindingId:st.bindingId,parentStudyId:id};
       const [native,outs]=await Promise.all([readDraft(),v2.call('study.outputs',sc)]);
       try{
        const r=await v2.call('study.outputs.create',{...sc,kind:'article',sourceBindingId:st.bindingId,expectedNative:native.expected,expectedOutput:outs.expectedOutput});
        outId=r?.view?.output?.id||null;
       }catch(error){
        // Refused because the Article now exists (made by another tab): look again at once and open that one, with no message.
        outId=articleOf(await v2.call('subject.standing',{parentStudyId:id}));
        if(!outId)throw error;
       }
       if(!outId)outId=articleOf(await v2.call('subject.standing',{parentStudyId:id}));
      }
      if(!outId)throw new v2.Error('The Article was made, but its address could not be found. Go back to the subject to open it.');
      if(clk.gone)return;
      // The page he is typing in is not rebuilt: the same boxes stay, with his cursor, and only the tabs, the address and the
      // state change. The Article's words are this draft's own words.
      const found=await v2.shared.write.locate(id,outId);
      if(clk.gone)return;
      if(found.bindingId!==st.bindingId||!found.form){st.creating=false;st.making=false;v2.go('write/:id',{id},{piece:outId});return;}
      st.standing=found.standing;st.forms=found.forms;st.form=found.form;st.piece=found.piece;st.starting=false;ctx.query.piece=outId;
      const fresh=doc.createElement('div');fresh.innerHTML=bar({id,forms:st.forms,form:st.form,piece:st.piece,mode:'write'});
      for(const sel of ['.wr-tabs','.wr-seg']){const from=fresh.querySelector(sel),to=$(sel);if(from&&to)to.innerHTML=from.innerHTML;}
      const title=$('.wr-title');if(title)title.textContent=st.form?.title||st.standing?.title||'';
      ctx.setAdvanced({subject:id,piece:st.piece||undefined,section:'write'});
      try{root.history.replaceState(root.history.state,'',v2.href('write/:id',{id},{piece:outId}));}catch{/* the address stays as it was */}
      st.creating=false;st.making=false;paintSaved();
      if(dirty())schedule(300);
     }catch(error){
      st.creating=false;st.making=false;paintSaved();
      if(clk.gone)return;
      if(dirty())schedule(300);
      // Said once, plainly. A refusal for good (403: only Adrian decides this, and the page is his) is not tried again; a hold
      // (423) or any other failure is tried again, quietly, a little less often each time.
      if(!st.startSaid){st.startSaid=true;say('Your words are saved, but the Article could not be started.','bad');}
      if(error?.kind==='owner-only'){st.startStopped=true;return;}
      clearTimeout(clk.startTimer);const wait=st.retryMs;st.retryMs=Math.min(60000,Math.round(st.retryMs*1.5));clk.startTimer=setTimeout(()=>{void startArticle();},wait);
     }finally{st.making=false;}
    }catch(error){st.creating=false;st.making=false;}
   }
   function schedule(ms=AUTOSAVE_MS){clearTimeout(clk.timer);if(clk.gone||st.stopped||st.conflict||!st.human)return;clk.timer=setTimeout(()=>{void save({quiet:true});},ms);}

   // ---------- typing ----------
   function onInput(t){
    if(!st.human)return;
    const rid=t.dataset.ed,raw=t.value,value=flat(raw);
    // A newline that arrived with nothing to say it was one (some phone keyboards): it is Enter at that place, not a space.
    {const row=st.rows.find(r=>r.id===rid),a=row?null:st.added.find(x=>x.id===rid),prev=row?(st.edits.get(rid)?.text??row.words):a?String(a.text??''):null;
     const d=prev===null||st.composing?null:minimalDiff(prev,raw);
     if(d&&d.to===d.from&&/^\r?\n$/.test(d.insert)){t.value=prev;try{t.setSelectionRange(d.from,d.from);}catch{}void enter(t);return;}}
    // A newline pasted or typed into a paragraph stays in it as a space. Never rewritten while a word is being composed.
    if(value!==raw&&!st.composing){const at=t.selectionStart,before=flat(raw.slice(0,at)).length;t.value=value;try{t.setSelectionRange(before,before);}catch{}}
    if(t.tagName!=='TEXTAREA')t.toggleAttribute('data-empty',!value);
    fit(t);paintKept();
    const row=st.rows.find(r=>r.id===rid);
    if(row){if(value===row.words)st.edits.delete(rid);else st.edits.set(rid,{text:value,orig:st.edits.get(rid)?.orig??row.words});}
    else{const a=st.added.find(x=>x.id===rid);if(a)a.text=value;}
    if(st.back?.ids.has(rid))endBack();
    st.problem='';st.stopped=false;paintSaved();stash();presence();schedule();
   }
   function focusEditor(rid,at){
    const t=page.querySelector(`[data-ed="${CSS.escape(rid)}"]`);if(!t)return;t.focus();try{t.setSelectionRange(at,at);}catch{}
    t.scrollIntoView?.({block:'nearest'});
   }
   async function enter(t){
    if(st.making)return;// while the Article is being made Enter does nothing: not queued, not run later, the caret stays
    const rid=t.dataset.ed,at=t.selectionStart,atEnd=at>=t.value.length&&t.selectionEnd>=t.value.length;
    const a=st.added.find(x=>x.id===rid);
    if(atEnd){
     const nextAdded=st.added.find(x=>x.afterId===rid);
     if(!t.value.trim())return;// a paragraph that is empty is not followed by another
     if(nextAdded&&!String(nextAdded.text).trim()){focusEditor(nextAdded.id,0);return;}
     const fresh={id:uuid(),afterId:rid,text:''};
     st.added.splice(a?st.added.indexOf(a)+1:st.added.length,0,fresh);paintText();focusEditor(fresh.id,0);return;
    }
    if(a){const head=t.value.slice(0,at),tail=t.value.slice(at);a.text=head;const fresh={id:uuid(),afterId:rid,text:tail};st.added.splice(st.added.indexOf(a)+1,0,fresh);paintText();stash();focusEditor(fresh.id,0);return;}
    // In the middle of a saved paragraph: his words and the split go in one save, so nothing typed in between can be lost.
    // A save may be running: the split waits for it. The place he pressed Enter is carried through whatever he typed while
    // it waited (what he typed at that place goes after the break, into the new paragraph), and the caret goes after it.
    const pressed=t.value;
    clearTimeout(clk.timer);await settled();
    const row=st.rows.find(r=>r.id===rid);if(!row||!row.safe)return;
    const text=st.edits.get(rid)?.text??row.words,newId=uuid();
    let cut=Math.min(at,text.length);
    if(text!==pressed){const d=minimalDiff(pressed,text);if(d)cut=Math.min(carryAt(d,at),text.length);}
    const now=page.querySelector(`[data-ed="${CSS.escape(rid)}"]`);let after=0;
    if(now&&doc.activeElement===now){const p=now.selectionStart;if(p>cut)after=p-cut;}
    await save({hold:null,extra:[{kind:'split',id:rid,at:cut,newId}],undoText:'Split a paragraph.',focus:{id:newId,at:after}});
   }
   /** Backspace at the start of a paragraph joins it to the one before. A paragraph that was never saved is joined on the
       page; a saved one is saved first and joined in the same save. A paragraph he emptied is deleted. */
   async function join(t){
    if(st.making)return;// likewise Backspace at the start of a paragraph
    const rid=t.dataset.ed,list=order(),i=list.findIndex(x=>x.id===rid);if(i<1)return;
    const prev=list[i-1],cur=list[i];if(!prev.safe||!cur.safe)return;
    const curAdded=st.added.find(a=>a.id===rid),prevAdded=st.added.find(a=>a.id===prev.id);
    clearTimeout(clk.timer);
    if(prevAdded&&!String(prevAdded.text).trim()){removeAdded(prevAdded);paintText();focusEditor(rid,0);return;}
    if(curAdded){
     const at=prev.text.length;
     if(prevAdded)prevAdded.text+=curAdded.text;
     else{const r=st.rows.find(x=>x.id===prev.id),e=st.edits.get(prev.id),text=prev.text+curAdded.text;if(text===r.words)st.edits.delete(prev.id);else st.edits.set(prev.id,{text,orig:e?.orig??r.words});}
     removeAdded(curAdded);paintText();stash();presence();schedule();focusEditor(prev.id,at);return;
    }
    await settled();
    if(prevAdded){if(!await save({hold:null})||st.conflict||st.problem)return;await settled();}
    const left=st.rows.find(x=>x.id===prev.id),right=st.rows.find(x=>x.id===rid);if(!left||!right||!left.safe||!right.safe)return;
    const at=(st.edits.get(left.id)?.text??left.words).length,rightText=st.edits.get(rid)?.text??right.words;
    if(!String(rightText).trim()){
     if(!st.edits.has(rid))st.edits.set(rid,{text:'',orig:right.words});else st.edits.get(rid).text='';
     await save({hold:null,focus:{id:left.id,at}});return;
    }
    await save({hold:null,extra:[{kind:'join',leftId:left.id,rightId:rid}],undoText:'Joined two paragraphs.',focus:{id:left.id,at}});
   }

   // ---------- keeping up with other hands ----------
   async function refresh(){
    if(clk.gone||!st.bindingId)return;
    if(st.saving){st.refreshWanted=true;return;}// shown as soon as the save is over
    const seq=st.saveSeq;let fresh;try{fresh=await readDraft();}catch{return;}
    if(ctx.signal.aborted||clk.gone)return;
    // A save began or ended while this was being read: the answer may be older than what he has saved, and is not to be
    // taken for a newer version or put on the page. Read again once the save is over.
    if(st.saving){st.refreshWanted=true;return;}
    if(st.saveSeq!==seq){void refresh();return;}
    if(!sameRevision(fresh,st.base)){
     if(takeOwn(fresh)){if(dirty())schedule(300);}
     else if(dirty()||st.conflict)noticeNewer(fresh);else{adopt(fresh);}
    }
    await loadProps();
   }
   function onChange(e){
    if(e?.reset){refresh();return;}
    if(e?.operationId&&st.ops.has(e.operationId))return;
    clearTimeout(clk.propTimer);clk.propTimer=setTimeout(refresh,250);
   }

  return {textOf,offsetOf,pointAt,editable,status,paintFail,tryAgain,allWords,copyAll,loadKept,paintKept,undoLast,undoState,noteSave,paintAsk,noAsk,yesAsk,putBack,loadBack,endBack,takeBack,undoOp:takeBack,KEY,stash,unstash,ensureTail,order,removeAdded,rowHTML,paintText,fit,paintSaved,paintConflict,noticeNewer,useSaved,keepMine,wordsMap,foldAdded,adopt,carryAt,settleSent,takeOwn,say403,settled,save,run,startArticle,schedule,onInput,focusEditor,enter,join,refresh,onChange};
 };
})(window.v2);
