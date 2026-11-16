/* Version three: Write, suggestions and notes. Holds an assistant's suggestions (study-ai.requests, study-ai.review, study-ai.accept, study-ai.reject, study-ai.finish), the read-through he has begun, the notes in the margin. (Undo by operation lives in write-page.js, with the bar's Undo and Put back.)
   Moved out of write.js without a change to what it does: the same code, in the same order, now in a function that write.js
   calls once for each open page with the page's shared state (W). Names it needs from the other files are reached through W. */
(function(v2){
 'use strict';
 // coss ui's button look (window.coss, from /ui/kit/coss-classes.js) where version three loads it: primary for the
 // main action, outline for ordinary ones, ghost for quiet and icon buttons. Version two does not load the script, so
 // there the classes are empty and every button keeps its own look.
 const coss=o=>{try{return window.coss.button(o);}catch{return '';}};
 const CP=coss({variant:'default',size:'sm'}),CB=coss({variant:'outline',size:'sm'}),CQ=coss({variant:'ghost',size:'sm'}),CI=coss({variant:'ghost',size:'icon-sm'});
 const root=window,doc=document;
 v2.shared['write-margin']=function(W){
  const {esc,icon,uuid,flat,proposalView}=W.lib;
  const {st,ctx,id,$,scope,dirty,say,mine}=W;
  const adopt=(...a)=>W.adopt(...a);
  const adv=(...a)=>W.adv(...a);
  const fit=(...a)=>W.fit(...a);
  const leave=(...a)=>W.leave(...a);
  const readDraft=(...a)=>W.readDraft(...a);
  const save=(...a)=>W.save(...a);

   // ---------- suggestions ----------
   async function loadProps(){
    if(!st.bindingId)return;
    try{
     const list=await v2.call('study-ai.requests',scope());if(ctx.signal.aborted)return;
     const items=list.items||[],pending=items.filter(i=>i.status==='pending'&&!i.stale);
     const reviews=await Promise.all(pending.map(i=>v2.call('study-ai.review',{...scope(),requestId:i.id}).catch(()=>null)));
     if(ctx.signal.aborted)return;
     st.props=pending.map((i,k)=>reviews[k]&&reviews[k].status==='pending'&&!reviews[k].stale?proposalView(i,reviews[k]):null).filter(Boolean);
     st.dropped=items.filter(i=>i.status==='pending'&&i.stale).length;
    }catch{st.props=[];}
    paintNotes();
   }
   // A read-through he has begun (the words he changed, the paragraphs he marked Not me) is kept on this device, only his,
   // under the same key the existing workspace uses, so it carries over between the two.
   const readKey=id=>'ar-create:read-through:'+id;
   function reading(p){
    if(!st.reading.has(p.id)){
     let v=null;if(st.human)try{v=JSON.parse(root.localStorage.getItem(readKey(p.id))||'null');}catch{/* blocked storage */}
     st.reading.set(p.id,v&&typeof v==='object'&&v.words&&v.marks&&v.notes?v:{words:{},marks:{},notes:{}});
    }
    return st.reading.get(p.id);
   }
   const keepReading=p=>{if(!st.human)return;try{root.localStorage.setItem(readKey(p.id),JSON.stringify(reading(p)));}catch{/* the words are still on the page */}};
   function forgetReading(id){st.reading.delete(id);try{root.localStorage.removeItem(readKey(id));}catch{/* nothing to forget */}}
   const markedOf=p=>new Set(Object.keys(reading(p).marks).filter(k=>reading(p).marks[k]));
   function paintNotes(){
    const box=$('[data-wr-text]');if(!box)return;
    const live=doc.activeElement?.dataset?.rt?{p:doc.activeElement.dataset.rt,r:doc.activeElement.dataset.rid,a:doc.activeElement.selectionStart,b:doc.activeElement.selectionEnd}:null;
    box.querySelectorAll('.wr-drafts').forEach(n=>{n.innerHTML='';});box.querySelectorAll('.wr-margin').forEach(n=>{n.innerHTML='';});
    const loose=$('[data-wr-loose]');let looseHTML='';
    st.props.forEach((p,k)=>{
     const n=k+1,by=v2.actorName(p.by||'agent:'),shown=p.replacements.filter(r=>box.querySelector(`[data-row="${CSS.escape(r.id)}"]`)),off=markedOf(p),rd=p.reads?reading(p):null;
     for(const r of shown){
      const row=box.querySelector(`[data-row="${CSS.escape(r.id)}"]`),left=off.has(r.id);
      const mark=p.reads&&st.human&&p.replacements.length>1?`<button type="button" class="wr-mark" data-act="mark" data-id="${esc(p.id)}" data-rid="${esc(r.id)}" aria-pressed="${left}">Not me</button>`:'';
      // A read-through is his to rewrite before it becomes his: the words are a box he can change, as in the existing workspace.
      const words=rd?String(rd.words[r.id]??r.words):r.words;
      const body=rd&&st.human?`<textarea class="wr-dt" rows="1" data-rt="${esc(p.id)}" data-rid="${esc(r.id)}" aria-label="${esc(by+'’s words for this paragraph. Change them to rewrite them.')}" spellcheck="true"${left?' readonly':''}>${esc(words)}</textarea>`:`<span class="wr-dtx">${esc(words)}</span>`;
      row.querySelector('.wr-drafts').insertAdjacentHTML('beforeend',`<div class="wr-draft${left?' wr-left':''}"><sup>${n}</sup>${body}${mark}</div>`);
     }
     const note=noteHTML(p,n,by);
     if(shown.length)box.querySelector(`[data-row="${CSS.escape(shown[0].id)}"] .wr-margin`).insertAdjacentHTML('beforeend',note);
     else looseHTML+=`<div class="wr-loosenote">${note}</div>`;
    });
    box.querySelectorAll('textarea.wr-dt').forEach(fit);
    if(live){const t=box.querySelector(`[data-rt="${CSS.escape(live.p)}"][data-rid="${CSS.escape(live.r)}"]`);if(t){t.focus({preventScroll:true});try{t.setSelectionRange(live.a,live.b);}catch{}}}
    if(loose)loose.innerHTML=looseHTML+(st.dropped?`<p class="wr-dim wr-stale">${esc(st.dropped===1?'A suggestion was set aside because the words changed after it was made.':st.dropped+' suggestions were set aside because the words changed after they were made.')}</p>`:'');
    W.paintConflict?.();// two versions, or words kept on the device, stand in the margin too
   }
   function noteHTML(p,n,by){
    const ok=p.simple&&p.replacements.length||p.reads;
    const head=`<p class="wr-note-h"><sup>${n}</sup>${esc(ok?by+' suggests new words':by+' wrote more for this piece')}</p>`;
    if(!ok)return `<div class="wr-note" data-prop="${esc(p.id)}">${head}<p class="wr-dim">This kind of suggestion is read through in Advanced, where you choose what becomes yours.</p><div class="wr-row-btns"><a class="wr-btn" href="${esc(adv('write'))}">Read it in Advanced${icon('out')}</a></div></div>`;
    const many=p.replacements.length>1?` for ${p.replacements.length} paragraphs`:'';
    const asked=p.reads&&p.instruction?`<p class="wr-dim">${esc('Asked: '+p.instruction)}</p>`:'';
    // A read-through is read as a whole: he changes any words that are not his, or marks a paragraph Not me, and what he leaves
    // alone counts as read (the existing workspace's own account). A plain suggestion goes in exactly as it stands, so its
    // button says that, in the existing workspace's own words: Accept and Reject.
    const buttons=p.reads?`<div class="wr-row-btns"><button type="button" class="${CP} pri" data-act="finish" data-id="${esc(p.id)}">Rewrite it as mine</button><button type="button" class="${CQ} v2-ghost" data-act="leave" data-id="${esc(p.id)}">Not me</button></div>`
     :`<div class="wr-row-btns"><button type="button" class="${CP} pri" data-act="accept" data-id="${esc(p.id)}">Accept</button><button type="button" class="${CQ} v2-ghost" data-act="reject" data-id="${esc(p.id)}">Reject</button></div>`;
    const how=p.reads?'Shown dim'+many+'. Change any words that are not yours, or use Not me'+(p.replacements.length>1?' under a paragraph':'')+' to leave it out. What you leave alone counts as read, and becomes yours when you press Rewrite it as mine.'
     :'Shown dim'+many+'. If you accept, they go in exactly as they stand. They stay dim until you do.';
    return `<div class="wr-note" data-prop="${esc(p.id)}">${head}${asked}<p class="wr-dim">${esc(how)}</p>${buttons}</div>`;
   }

   // ---------- suggestions: his to take or turn down ----------
   async function decide(kind,rid){
    if(st.human&&dirty()){say('Your words are not saved yet. They save by themselves in a moment; then you can decide.','warn');return;}
    const prop=st.props.find(p=>p.id===rid);if(!prop)return;
    const operationId=mine(uuid()),who=v2.actorName(prop.by||'agent:');
    try{
     if(kind==='accept'||kind==='finish'){
      let result,edited=false;
      if(kind==='accept')result=await v2.call('study-ai.accept',{...scope(),requestId:rid,operationId});
      else{
       const off=markedOf(prop),all=prop.replacements.every(r=>off.has(r.id)),rd=reading(prop),edits=[];
       if(all){await leaveOut(prop,operationId);return;}
       for(const r of prop.replacements){
        if(off.has(r.id))continue;
        const words=flat(rd.words[r.id]??r.words).trim();if(words&&words!==r.words)edits.push({id:r.id,words});
       }
       edited=edits.length>0;
       result=await v2.call('study-ai.finish',{...scope(),requestId:rid,operationId,...(edits.length?{edits}:{}),...(off.size?{marks:[...off].map(x=>({id:x}))}:{})});
      }
      if(Array.isArray(result?.projection)&&!dirty())adopt(result);else adopt(await readDraft());
      forgetReading(rid);
      const entry=(st.base.history||[]).find(h=>h.operationId===operationId&&h.canUndo);
      const said=kind==='finish'&&edited?'Changed to your words.':`Changed to ${who}’s words.`;
      if(entry)v2.ui.undo(said,()=>W.undoOp(operationId));else say(said,'good');
     }else if(kind==='leave'){await leaveOut(prop,operationId);return;}
     else{
      await v2.call('study-ai.reject',{...scope(),requestId:rid});say('Left as you wrote it.','good');
     }
     await loadProps();
    }catch(error){
     if(error.kind==='owner-only'){say(error.message,'bad');}
     else{say(error.message,'bad');await loadProps();}
    }
   }
   /** "Not me" on a read-through: every paragraph of it is marked left out, so nothing of it is written and it is not offered again. */
   async function leaveOut(prop,operationId){
    try{
     await v2.call('study-ai.finish',{...scope(),requestId:prop.id,operationId,marks:prop.replacements.map(r=>({id:r.id}))});
     forgetReading(prop.id);say('Left as you wrote it.','good');await loadProps();
    }catch(error){say(error.message,'bad');if(error.kind!=='owner-only')await loadProps();}
   }
  return {loadProps,readKey,reading,keepReading,forgetReading,markedOf,paintNotes,noteHTML,decide,leaveOut};
 };
})(window.v2);
