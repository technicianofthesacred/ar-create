/* Version two: Write, paragraphs, saving and keeping words on the device. Holds the paragraphs on the page, the save loop (study-draft.save), the Article started from the first saved words, the server version taken in, the newer-version choice, and his unsaved words kept on this device.
   Moved out of write.js without a change to what it does: the same code, in the same order, now in a function that write.js
   calls once for each open page with the page's shared state (W). Names it needs from the other files are reached through W. */
(function(v2){
 'use strict';
 const root=window,doc=document;
 v2.shared['write-page']=function(W){
  const {esc,uuid,clock,savedLabel,AUTOSAVE_MS,rowsOf,minimalDiff,buildOps,flat,bar}=W.lib;
  const {st,clk,page,ctx,id,$,scope,dirty,say,mine}=W;
  const loadProps=(...a)=>W.loadProps(...a);
  const paintNotes=(...a)=>W.paintNotes(...a);
  const presence=(...a)=>W.presence(...a);
  const readDraft=(...a)=>W.readDraft(...a);
  const sameRevision=(...a)=>W.sameRevision(...a);
  const undoOp=(...a)=>W.undoOp(...a);

   // ---------- the unsaved words, kept on this device: his only ----------
   const KEY=()=>'ar-v2-write:'+st.bindingId;
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
    return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><textarea class="wr-ed${cls}" rows="1" data-ed="${esc(r.id)}" aria-label="${esc(label)}" spellcheck="true"${st.human?'':' readonly'}${r.fresh&&!r.text?' placeholder="Write here"':''}>${esc(r.text)}</textarea><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
   }
   function paintText(){
    const box=$('[data-wr-text]');if(!box)return;
    const keep=doc.activeElement?.dataset?.ed?{id:doc.activeElement.dataset.ed,a:doc.activeElement.selectionStart,b:doc.activeElement.selectionEnd}:null;
    ensureTail();let n=0;
    box.innerHTML=order().map(r=>rowHTML(r,r.kind==='heading'?0:++n)).join('');
    box.querySelectorAll('textarea').forEach(fit);
    paintNotes();
    if(keep){const t=box.querySelector(`[data-ed="${CSS.escape(keep.id)}"]`);if(t){t.focus({preventScroll:true});try{t.setSelectionRange(keep.a,keep.b);}catch{}}}
   }
   function fit(t){t.style.height='auto';t.style.height=(t.scrollHeight+1)+'px';}
   function paintSaved(){
    const text=st.none?'':!st.human?'Read only':st.making?'Starting the Article':st.problem?st.problem:st.saving?'Saving':dirty()||st.conflict?(st.conflict?'Not saved: a newer version exists':'Not saved yet'):st.savedAt?savedLabel(st.savedAt):'Saved';
    page.querySelectorAll('[data-wr-saved]').forEach(el=>{el.textContent=text;el.dataset.tone=st.problem||st.conflict?'bad':'';});
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
    if(infos.length)for(const info of infos)settleSent(fresh,info);else adopt(fresh);
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
    if(!ops.length){st.problem='';paintSaved();stash();return false;}
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
     st.sent=st.sent.filter(x=>x!==info);
     const caret=settleSent(result,info);st.savedAt=new Date().toISOString();st.stopped=false;ok=true;
     stash();presence();loadProps();
     const text=undoText||(ops.some(o=>o.kind==='delete')?'Paragraph deleted.':'');
     if(text&&(result.history||[]).some(h=>h.operationId===operationId&&h.canUndo))v2.ui.undo(text,()=>undoOp(operationId));
     if(focus)focusEditor(focus.id,caret[focus.id]??focus.at);
    }catch(error){
     if(error.kind==='stale'||error.kind==='refused'||error.kind==='owner-only')st.sent=st.sent.filter(x=>x!==info);// not committed
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
     else{st.problem=error.kind==='held'||error.kind==='refused'?error.message:'Could not save. Your words are kept on this device.';st.stopped=error.kind==='refused'||error.kind==='held';if(!quiet)say(error.message,'bad');if(!st.stopped)schedule(5000);}
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
    const rid=t.dataset.ed,value=flat(t.value);
    if(value!==t.value){const at=t.selectionStart;t.value=value;try{t.setSelectionRange(at,at);}catch{}}
    fit(t);
    const row=st.rows.find(r=>r.id===rid);
    if(row){if(value===row.words)st.edits.delete(rid);else st.edits.set(rid,{text:value,orig:st.edits.get(rid)?.orig??row.words});}
    else{const a=st.added.find(x=>x.id===rid);if(a)a.text=value;}
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
    clearTimeout(clk.timer);await settled();
    const row=st.rows.find(r=>r.id===rid);if(!row||!row.safe)return;
    const text=st.edits.get(rid)?.text??row.words,newId=uuid();
    await save({hold:null,extra:[{kind:'split',id:rid,at:Math.min(at,text.length),newId}],undoText:'Split a paragraph.',focus:{id:newId,at:0}});
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

  return {KEY,stash,unstash,ensureTail,order,removeAdded,rowHTML,paintText,fit,paintSaved,paintConflict,noticeNewer,useSaved,keepMine,wordsMap,foldAdded,adopt,carryAt,settleSent,takeOwn,say403,settled,save,run,startArticle,schedule,onInput,focusEditor,enter,join,refresh,onChange};
 };
})(window.v2);
