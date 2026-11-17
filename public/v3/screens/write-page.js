/* Version three: Write, paragraphs, saving and keeping words on the device. Holds the paragraphs on the page, the save loop (study-draft.save), the Article started from the first saved words, the server version taken in, the newer-version choice, and his unsaved words kept on this device.
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
 v2.shared['write-page']=function(W){
  const {esc,uuid,clock,savedLabel,AUTOSAVE_MS,rowsOf,minimalDiff,buildOps,flat,bar,own}=W.lib;
  const {st,clk,page,ctx,id,$,scope,dirty,say,mine}=W;
  const loadProps=(...a)=>W.loadProps(...a);
  const paintNotes=(...a)=>W.paintNotes(...a);
  const presence=(...a)=>W.presence(...a);
  const readDraft=(...a)=>W.readDraft(...a);
  const sameRevision=(...a)=>W.sameRevision(...a);
  const undoOp=(...a)=>W.undoOp(...a);

   // Source links never enter the text saved by the editor. Only exact saved ranges are marked.
   let quoteRevision='',quoteLinks=[],quoteRead=0,sourceRead=0;
   function quoteHTML(row){
    const links=dirty()||quoteRevision!==JSON.stringify(st.base?.expected)?[]:quoteLinks.filter(l=>l.active&&l.paragraph.id===row.id&&l.paragraph.text===row.text.slice(l.paragraph.from,l.paragraph.to)).sort((a,b)=>a.paragraph.from-b.paragraph.from);
    let at=0,html='';
    for(const link of links){const p=link.paragraph;if(p.from<at||p.from<0||p.to>row.text.length||p.to<=p.from)continue;
     const left=p.from>at&&/[“\"‘']/.test(row.text[p.from-1])?p.from-1:p.from,right=p.to<row.text.length&&/[”\"’']/.test(row.text[p.to])?p.to+1:p.to;
     html+=esc(row.text.slice(at,left));
     const kept=(st.kept||[]).some(k=>k.id===row.id&&row.text.indexOf(k.text)>=0&&row.text.indexOf(k.text)===row.text.lastIndexOf(k.text)&&row.text.indexOf(k.text)<p.to&&row.text.indexOf(k.text)+k.text.length>p.from);
     html+=`<span class="wr-source-quote" data-quote-link="${esc(link.id)}" role="link" tabindex="0" aria-label="Open original source passage"><span>${esc(row.text.slice(left,p.from))}<span class="wr-source-dots${kept?' wr-source-dots-below':''}">${esc(p.text)}</span>${esc(row.text.slice(p.to,right))}</span></span>`;at=right;
    }
    return html+esc(row.text.slice(at));
   }
   function invalidateQuotes(){
    quoteRead++;sourceRead++;quoteLinks=[];quoteRevision='';
    // Unwrap in place. Native selection and manuscript nodes stay where the author left them.
    for(const span of page.querySelectorAll('[data-quote-link]'))span.replaceWith(...span.childNodes);
    for(const span of page.querySelectorAll('.wr-source-dots'))span.replaceWith(...span.childNodes);
   }
   async function loadQuoteLinks(){
    if(!st.bindingId||dirty()||clk.gone)return;
    const revision=JSON.stringify(st.base?.expected);if(revision===quoteRevision)return;quoteRevision=revision;quoteLinks=[];
    const ticket=++quoteRead;
    try{const result=await v2.call('study-draft.quote-link.get',scope());
     if(ticket!==quoteRead||clk.gone||ctx.signal.aborted||dirty()||revision!==JSON.stringify(st.base?.expected))return;
     quoteLinks=JSON.stringify(result.expected)===revision&&Array.isArray(result.links)?result.links:[];if(quoteLinks.some(l=>l.active))paintText();
    }catch{/* An unavailable source link never changes or decorates manuscript words. */}
   }
   async function openQuote(linkId){
    if(dirty()||clk.gone)return;
    const ticket=++sourceRead,revision=JSON.stringify(st.base?.expected);
    st.src=true;const work=$('.wr-work');if(work)work.dataset.src='open';
    const box=$('[data-wr-src]');if(!box)return;
    box.innerHTML='<p role="status">Checking the original passage…</p>';
    try{const result=await v2.call('study-draft.quote-link.source',{...scope(),id:linkId});
     if(ticket!==sourceRead||clk.gone||ctx.signal.aborted||dirty()||revision!==JSON.stringify(st.base?.expected))return;
     if(JSON.stringify(result.expected)!==revision){invalidateQuotes();return;}
     const source=result.source;
     box.innerHTML=`<div class="wr-src-h"><h2>${esc(source.title||'Source')}</h2><button type="button" class="wr-btn" data-quote-close>Close source</button></div><p class="wr-dim">Original source · read only</p><pre class="wr-quote-source">${esc(source.before)}<mark>${esc(source.quote)}</mark>${esc(source.after)}</pre>`;
    }catch(error){if(ticket!==sourceRead||clk.gone||ctx.signal.aborted)return;invalidateQuotes();box.innerHTML=`<p role="status">${esc(error.message)}</p>`;}
   }
   const onQuoteClick=e=>{const link=e.target.closest?.('[data-quote-link]');if(link){e.preventDefault();void openQuote(link.dataset.quoteLink);}else if(e.target.closest?.('[data-quote-close]')){sourceRead++;W.paintSources();}};
   page.addEventListener('click',onQuoteClick);
   page.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-quote-link]')){e.preventDefault();e.stopImmediatePropagation();void openQuote(e.target.dataset.quoteLink);}},true);

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

   // ---------- the unsaved words, kept on this device: his only, one key for each open tab ----------
   // Each tab writes only its own key: ar-v3-write:<binding>, or ar-v3-write:<binding>:<n> when another tab holds that one,
   // held by a Web Lock for as long as the tab is open, so two tabs on one piece never write over each other's words. The
   // record names the tab (kept for the tab's life in sessionStorage, so a reload of the same tab finds its own words and
   // puts them back as before). Words under a key whose lock is free, written by another tab, were left by a tab that has
   // closed: they are offered once, in place ("Put them back", "Leave them out"), while that key stays held by this page
   // until he chooses. Where the browser has no Web Locks there is one key for each piece, as before.
   const LOCKS=root.navigator?.locks,held=new Map();let tabKey=null;
   const TAB=(()=>{try{let t=root.sessionStorage.getItem('ar-v3-write-tab');if(!t){t=uuid();root.sessionStorage.setItem('ar-v3-write-tab',t);}return t;}catch{return uuid();}})();
   const BASE=()=>'ar-v3-write:'+st.bindingId,KEY=()=>tabKey||BASE();
   const slotKey=k=>k===BASE()||k.startsWith(BASE()+':')&&/^\d+$/.test(k.slice(BASE().length+1));
   const hold=name=>!LOCKS?Promise.resolve(true):new Promise(res=>{LOCKS.request('ar-v3-write-lock:'+name,{ifAvailable:true},lock=>{res(!!lock);return lock?new Promise(r=>held.set(name,r)):null;}).catch(()=>res(false));});
   const letGo=name=>{const r=held.get(name);held.delete(name);r?.();};
   const foreign=rec=>!!(LOCKS&&rec&&rec.tab&&rec.tab!==TAB);
   /** This page's own key: the first free one whose words, if any, are this tab's (or from before there was one key per tab). */
   async function claim(){
    if(!st.human||tabKey)return;
    for(let n=0;n<64&&!tabKey;n++){const k=n?BASE()+':'+n:BASE();if(!await hold(k))continue;if(foreign(unstash(k)))continue;/* held: another tab's words, offered below */tabKey=k;}
    tabKey||=BASE();
   }
   /** Words a closed tab left under its own key, now held by this page: {key, saved}, or null. */
   async function closedTab(){
    if(!st.human||!LOCKS)return null;
    let keys=[];try{for(let i=0;i<root.localStorage.length;i++){const k=root.localStorage.key(i);if(k&&k!==tabKey&&slotKey(k))keys.push(k);}}catch{return null;}
    for(const k of keys.sort()){if(!held.has(k)&&!await hold(k))continue;const saved=unstash(k);if(saved)return {key:k,saved};letGo(k);}
    return null;
   }
   /** Once a closed tab's words are on this page's own key, or set aside, or none of them is unsaved, their old key goes. */
   function forget(k,{always=false}={}){if(!k||k===tabKey)return;try{if(always||!dirty()||root.localStorage.getItem(KEY()))root.localStorage.removeItem(k);}catch{/* kept */}letGo(k);}
   function letAllGo(){for(const k of [...held.keys()])letGo(k);}
   /** Everything unsaved goes to the device under his key, with the saves whose answer has not come back (the operation
       and what it carried), so a reload in the middle of a save can tell his own committed save from a newer version. */
   function stash(){
    if(!st.human)return;// an assistant's page never keeps or restores words as if they were his
    try{
     if(!dirty()){root.localStorage.removeItem(KEY());return;}
     root.localStorage.setItem(KEY(),JSON.stringify({v:2,at:Date.now(),tab:TAB,draft:st.base?.expected?.workflow?.draft||'',
      edits:[...st.edits].map(([k,v])=>[k,v.text,v.orig]),times:[...st.edits].filter(([,v])=>v.at).map(([k,v])=>[k,v.at]),added:st.added.filter(a=>String(a.text).trim()).map(a=>({id:a.id,afterId:a.afterId,text:a.text})),
      sent:st.sent,base:[...st.baseWords]}));
    }catch{/* private window or blocked storage: the words are still on the page */}
   }
   function unstash(key=KEY()){
    if(!st.human)return null;
    try{
     const s=JSON.parse(root.localStorage.getItem(key)||'null');
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
    if(st.conflict?.pairs.has(r.id))return pairHTML(r,st.conflict.pairs.get(r.id),n);
    if(st.recovered?.ids.has(r.id))return recHTML(r,st.recovered.items.find(x=>x.id===r.id).kept);
    if(!r.safe)return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><p class="wr-lock" title="This passage has formatting that is kept as it is. Change it in Advanced.">${esc(r.text)}</p><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
    const cls=r.kind==='heading'?' wr-h':r.kind==='blockquote'?' wr-q':'';
    if(st.plain)return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><textarea class="wr-ed${cls}" rows="1" data-ed="${esc(r.id)}" aria-label="${esc(label)}" spellcheck="true"${st.human?'':' readonly'}${r.fresh&&!r.text?' placeholder="Write here"':''}>${esc(r.text)}</textarea><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
    const tag=r.kind==='heading'?'h2':'p';
    return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><${tag} class="wr-ed${cls}" data-ed="${esc(r.id)}" role="textbox" aria-multiline="false" aria-label="${esc(label)}" spellcheck="true" tabindex="0" contenteditable="${st.human?'plaintext-only':'false'}"${st.human?'':' aria-readonly="true"'}${r.fresh?' data-placeholder="Write here"':''}${r.text?'':' data-empty=""'}>${quoteHTML(r)}</${tag}><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
   }
   function paintText(){
    const box=$('[data-wr-text]');if(!box)return;
    // Never rebuilt under a word he is still composing (an accent, a phone's suggestion): it is drawn when he finishes it.
    if(st.composing&&doc.activeElement?.dataset?.ed&&box.contains(doc.activeElement)){st.paintWanted=true;return;}
    const keep=doc.activeElement?.dataset?.ed?{id:doc.activeElement.dataset.ed,a:doc.activeElement.selectionStart,b:doc.activeElement.selectionEnd}:null;
    ensureTail();let n=0;
    box.innerHTML=order().map(r=>rowHTML(r,r.kind==='heading'?0:++n)).join('');
    // New paragraphs a closed tab kept, in place after the paragraph they followed, until he decides.
    for(const a of st.recovered?.added||[]){const at=(a.afterId&&box.querySelector(`[data-row="${CSS.escape(a.afterId)}"]`))||[...box.querySelectorAll('[data-row]')].at(-1);const html=recHTML({id:'rec-'+uuid(),kind:'paragraph'},a.text);if(at)at.insertAdjacentHTML('afterend',html);else box.insertAdjacentHTML('beforeend',html);}
    box.querySelectorAll('[data-ed]').forEach(editable);
    box.querySelectorAll('textarea').forEach(fit);
    paintNotes();paintKept();paintConflict();void loadQuoteLinks();
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
    if(st.conflict){const n=st.conflict.pairs.size;return {text:n===1?'One paragraph has two versions':n+' paragraphs have two versions',short:'Two versions',mark:'warn',tone:'bad'};}
    if(st.recovered)return {text:'Words kept on this device',short:'Words kept here',mark:'warn',tone:'bad'};
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
     <div class="wr-acts"><button type="button" class="${CP} wr-b wr-pri" data-wr="retry"></button><button type="button" class="${CB} wr-b" data-wr="copy">${own('copy')}Copy all my words</button></div></div>`;
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
    // Every version he has not chosen yet, and every word set aside, here or on the app, so nothing of his is left behind.
    const other=[...(st.conflict?.pairs.values()||[])].map(p=>String(p.theirs).trim()).filter(Boolean);
    if(other.length)out.push('The other version, written elsewhere:',...other);
    const rec=st.recovered?[...st.recovered.items.map(x=>x.kept),...st.recovered.added.map(a=>a.text)].map(t=>String(t).trim()).filter(Boolean):[];
    if(rec.length)out.push('Kept on this device from a tab that closed:',...rec);
    const aside=st.human?[...(st.asides||[]),...deviceAsides()].flatMap(e=>e.paragraphs.map(p=>String(p.words||'').trim())).filter(Boolean):[];
    if(aside.length)out.push('Set aside:',...[...new Set(aside)]);
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
     <div class="wr-acts"><button type="button" class="${CP} wr-b wr-pri" data-wr="undo-yes">${esc(a.count>1?'Take back '+plural(a.count):'Take it back')}</button><button type="button" class="${CB} wr-b" data-wr="undo-no">${esc(a.count>1?'Keep them':'Keep it')}</button></div></div>`;
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

   // ---------- two versions of a paragraph: his unsaved words and a newer saved version, each kept until he chooses ----------
   // A newer saved version is taken paragraph by paragraph against the words he started from (st.baseWords): a paragraph
   // changed only elsewhere takes the saved words; one changed only here keeps his; one changed in both places shows both,
   // in place, each named by where and when it was written, with what differs marked, and nothing of it is saved until he
   // keeps one, or both one after the other. Nothing is mixed inside a paragraph. The version he does not keep is never
   // dropped: a saved one stays in the draft's history (Earlier versions); his unsaved one goes to study-draft.set-aside
   // first, or, when the app does not answer, stays on this device (Copy all my words includes it).
   const ASIDE=()=>'ar-v3-write-aside:'+st.bindingId;
   const deviceAsides=()=>{try{const v=JSON.parse(root.localStorage.getItem(ASIDE())||'[]');return Array.isArray(v)?v.filter(e=>e&&Array.isArray(e.paragraphs)):[];}catch{return [];}};
   const keepDeviceAsides=list=>{try{if(list.length)root.localStorage.setItem(ASIDE(),JSON.stringify(list));else root.localStorage.removeItem(ASIDE());return true;}catch{return false;}};
   /** His words he is not keeping on the page: to the app's set-aside store, or this device when the app does not answer.
       Resolves 'server', 'device', 'none' (nothing to keep) or false (kept nowhere: the caller changes nothing). */
   async function setAside(paragraphs,reason,operationId=uuid()){
    const list=paragraphs.filter(p=>String(p.words||'').trim()).map(p=>({...(p.id?{id:String(p.id)}:{}),words:String(p.words)}));
    if(!list.length)return 'none';
    if(!st.human)return false;
    try{await v2.call('study-draft.set-aside',{...scope(),operationId,reason,...(st.base?.expected?{expected:st.base.expected}:{}),paragraphs:list});void loadAsides();return 'server';}
    catch{const all=deviceAsides();if(!all.some(e=>e.operationId===operationId))all.push({v:1,at:Date.now(),reason,operationId,expected:st.base?.expected||null,paragraphs:list});return keepDeviceAsides(all)?'device':false;}
   }
   /** Words set aside on this device while the app did not answer go to the app as soon as it does, each once. */
   async function sendAsides(){
    if(!st.human||!st.bindingId)return;
    for(const e of deviceAsides()){
     try{await v2.call('study-draft.set-aside',{...scope(),operationId:e.operationId,reason:e.reason,...(e.expected?{expected:e.expected}:{}),paragraphs:e.paragraphs});keepDeviceAsides(deviceAsides().filter(x=>x.operationId!==e.operationId));}
     catch{return;}// still kept here; tried again next time
    }
    void loadAsides();
   }
   async function loadAsides(){if(!st.bindingId)return;try{const r=await v2.call('study-draft.set-aside.list',scope());st.asides=Array.isArray(r?.items)?r.items:[];}catch{st.asides=st.asides||[];}}

   /** The words of two versions with what differs marked: each word not in the other is marked in its own version. */
   function marked(a,b){
    const A=String(a).split(/(\s+)/),B=String(b).split(/(\s+)/),wa=A.filter((_,i)=>i%2===0),wb=B.filter((_,i)=>i%2===0);
    const n=wa.length,m=wb.length;
    if(n*m>250000)return [esc(a),esc(b)];
    const L=Array.from({length:n+1},()=>new Uint32Array(m+1));
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=wa[i]===wb[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
    const ka=new Set(),kb=new Set();let i=0,j=0;
    while(i<n&&j<m){if(wa[i]===wb[j]){ka.add(i);kb.add(j);i++;j++;}else if(L[i+1][j]>=L[i][j+1])i++;else j++;}
    // A run of words not in the other is one mark, spaces between them included.
    const draw=(parts,keep)=>{let out='',run='';const words=parts.length;
     for(let k=0;k<words;k++){const x=parts[k];if(k%2===0){if(x!==''&&!keep.has(k/2)){run+=x;continue;}if(run){out+=`<mark class="wr-dif">${esc(run)}</mark>`;run='';}out+=esc(x);}
      else{const next=parts[k+1];if(run&&next!==undefined&&next!==''&&!keep.has((k+1)/2))run+=x;else{if(run){out+=`<mark class="wr-dif">${esc(run)}</mark>`;run='';}out+=esc(x);}}}
     if(run)out+=`<mark class="wr-dif">${esc(run)}</mark>`;return out;};
    return [draw(A,ka),draw(B,kb)];
   }
   const wordsIn=t=>(String(t||'').match(/\S+/g)||[]).length;
   /** "Adds 4 words. Takes away none of yours." between the saved words and his. */
   function countLine(before,after){
    const A=String(before||'').split(/\s+/).filter(Boolean),B=String(after||'').split(/\s+/).filter(Boolean),n=A.length,m=B.length;
    let same=0;if(n*m<=250000){const L=Array.from({length:n+1},()=>new Uint32Array(m+1));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=A[i]===B[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);same=L[0][0];}
    const add=m-same,cut=n-same,w=k=>k===1?'1 word':k+' words';
    if(!cut)return `Adds ${w(add)}. Takes away none of yours.`;
    if(!add)return `Takes away ${w(cut)} of the saved words. Adds nothing.`;
    return `Takes away ${w(cut)} of the saved words, adds ${w(add)}.`;
   }
   /** Who wrote the newer saved version, and when: the latest saved change not made on this page. */
   function otherSave(read){const h=[...(read?.history||[])].filter(x=>x.state==='committed'&&!st.ops.has(x.operationId)).pop();return {actor:h?.actor||null,at:h?.modifiedAt||null};}
   const elsewhere=by=>{const who=by?.actor&&!/^human:/.test(by.actor)&&!/unknown/.test(by.actor)?'Written by '+v2.actorName(by.actor):'Written elsewhere';return who+(by?.at?', '+clock(by.at):'');};
   /** Each paragraph against a newer saved version: changed here only, there only, or in both places. */
   function classify(fresh){
    const rows=rowsOf(fresh),fm=new Map(rows.map(r=>[r.id,r])),base=st.baseWords,pairs=new Map(),mine=[],theirs=[];
    for(const [rid,e] of st.edits){
     const f=fm.get(rid),was=base.has(rid)?base.get(rid):e.orig;
     if(!f){if(String(e.text).trim())mine.push(rid);continue;}// gone there: his words come back as a new paragraph
     if(f.words===e.text)continue;
     if(!f.safe){if(String(e.text).trim())mine.push(rid);continue;}// now kept as it is there: his words come back as a new paragraph after it
     if(f.words===was)mine.push(rid);else pairs.set(rid,{id:rid,mine:e.text,theirs:f.words,was,at:e.at||Date.now(),kind:f.kind});
    }
    for(const r of rows)if(!st.edits.has(r.id)&&(!base.has(r.id)||base.get(r.id)!==r.words)&&String(r.words).trim()&&!st.added.some(a=>a.id===r.id))theirs.push({id:r.id,was:base.get(r.id)??null,now:r.words});
    for(const [rid,was] of base)if(!fm.has(rid)&&!st.edits.has(rid)&&String(was).trim())theirs.push({id:rid,was,now:null});
    for(const a of st.added)if(String(a.text).trim()&&!fm.has(a.id))mine.push(a.id);
    return {pairs,mine,theirs};
   }
   /** A newer version is saved. Paragraphs changed in one place are taken as they are and said; those changed in both wait. */
   function noticeNewer(fresh){
    const c=classify(fresh),by=otherSave(fresh);
    st.problem='';
    st.conflict=c.pairs.size?{fresh,pairs:c.pairs,by,decided:[]}:null;
    adopt(fresh);// his words stay on the page against the new version; a paragraph gone there comes back as a new one
    for(const p of c.pairs.values())st.baseWords.set(p.id,p.was);
    if(c.mine.length||c.theirs.length||c.pairs.size){
     const m=st.merged&&!st.merged.done?st.merged:{mine:[],theirs:[],decided:[]};
     st.merged={mine:[...new Set([...m.mine,...c.mine])],theirs:[...m.theirs.filter(t=>!c.theirs.some(x=>x.id===t.id)),...c.theirs],decided:m.decided,by,open:m.open||false,done:false};
    }
    paintText();paintSaved();stash();
    if(!st.conflict&&dirty())schedule(300);
   }
   /** He keeps one version of a paragraph changed in both places, or both one after the other. */
   async function keepVersion(rid,v){
    const c=st.conflict,p=c?.pairs.get(rid);if(!p||c.busy)return;
    if(v==='theirs'){
     c.busy=true;paintSaved();
     const where=await setAside([{id:rid,words:p.mine}],'conflict',p.op||=uuid());
     c.busy=false;
     if(!where){say('Your words in this paragraph could not be kept anywhere safe, so nothing was changed. Copy all my words, then try again.','bad');paintSaved();return;}
     if(st.conflict!==c||!c.pairs.has(rid))return;
     st.edits.delete(rid);p.where=where;
    }else if(v==='mine'){const e=st.edits.get(rid);if(e)e.orig=p.theirs;}
    else st.edits.set(rid,{text:p.theirs.trimEnd()+' '+p.mine.trimStart(),orig:p.theirs,at:Date.now()});
    st.baseWords.set(rid,p.theirs);
    p.kept=v;c.pairs.delete(rid);c.decided.push(p);
    if(st.merged)st.merged.decided=[...st.merged.decided,p];
    if(!c.pairs.size)st.conflict=null;
    paintText();paintSaved();stash();
    if(!st.conflict&&dirty())schedule(300);
    page.querySelector(`[data-row="${CSS.escape(rid)}"] [data-ed]`)?.focus({preventScroll:true});
   }
   /** From the list of paragraphs taken from elsewhere: put back the words he had there. The other version stays in history. */
   function useEarlier(rid){
    const t=st.merged?.theirs.find(x=>x.id===rid);if(!t||!st.human)return;
    const r=st.rows.find(x=>x.id===rid);
    if(r&&t.was!==null){if(r.safe)st.edits.set(rid,{text:t.was,orig:r.words,at:Date.now()});}
    else if(!r&&t.was!==null){const at=st.rows.length?st.rows.at(-1).id:null;st.added.push({id:uuid(),afterId:at,text:t.was});}
    else if(r&&t.was===null&&r.safe)st.edits.set(rid,{text:'',orig:r.words,at:Date.now()});
    st.merged.theirs=st.merged.theirs.filter(x=>x.id!==rid);
    paintText();paintSaved();stash();schedule(300);
   }
   // Kept for older callers: a page with no pair waiting has nothing to choose.
   const useSaved=async()=>{for(const rid of [...(st.conflict?.pairs.keys()||[])])await keepVersion(rid,'theirs');};
   const keepMine=async()=>{for(const rid of [...(st.conflict?.pairs.keys()||[])])await keepVersion(rid,'mine');};

   // ---------- words a closed tab left on this device: shown in place, his to put back or leave out ----------
   function headingBefore(rid){let h='';for(const r of st.rows){if(r.id===rid)break;if(r.kind==='heading'&&String(r.words).trim())h=String(r.words).trim();}return h;}
   /** Offers a closed tab's words: only what differs from what is saved now. Nothing differs: the key simply goes. */
   function offerRecovered(key,saved){
    const now=new Map(st.rows.map(r=>[r.id,r])),base=new Map(Array.isArray(saved.base)?saved.base:[]),items=[],added=[];
    const times=new Map(Array.isArray(saved.times)?saved.times:[]);
    for(const [rid,text,orig] of saved.edits){const r=now.get(rid),t=String(text),at=times.get(rid);if(r&&r.words===t)continue;/* a paragraph that now holds formatting kept as it is: his words are offered as a new one after it */if(r&&!r.safe){if(t.trim())added.push({afterId:rid,text:flat(t)});continue;}if(!r&&!t.trim())continue;items.push({id:rid,kept:t,saved:r?r.words:null,was:base.has(rid)?base.get(rid):String(orig??''),at});}
    for(const a of saved.added){if(!a||typeof a.text!=='string'||!a.text.trim())continue;const r=now.get(a.id);if(r&&r.words===a.text)continue;added.push({afterId:a.afterId??null,text:flat(a.text)});}
    if(!items.length&&!added.length){forget(key,{always:true});return false;}
    st.recovered={key,at:saved.at||null,items,added,ids:new Set(items.filter(x=>now.has(x.id)).map(x=>x.id)),op:uuid()};
    return true;
   }
   async function decideRecovered(v){
    const r=st.recovered;if(!r||!st.human||r.busy)return;
    if(v==='left'){
     r.busy=true;
     const where=await setAside([...r.items.map(x=>({id:x.id,words:x.kept})),...r.added.map(a=>({words:a.text}))],'recovery',r.op);
     r.busy=false;
     if(!where){say('These words could not be kept anywhere safe, so they stay as they are on this device.','bad');return;}
     if(st.recovered!==r)return;
     st.recovered=null;forget(r.key,{always:true});st.recDone={v,where};
    }else{
     st.recovered=null;
     const now=new Map(st.rows.map(x=>[x.id,x]));
     for(const x of r.items){
      const cur=now.get(x.id);
      if(cur){st.edits.set(x.id,{text:x.kept,orig:cur.words,at:x.at||r.at||Date.now()});st.baseWords.set(x.id,x.was);}
      else if(x.kept.trim())st.added.push({id:uuid(),afterId:st.rows.at(-1)?.id??null,text:x.kept});
     }
     for(const a of r.added)st.added.push({id:uuid(),afterId:now.has(a.afterId)?a.afterId:(st.rows.at(-1)?.id??null),text:a.text});
     stash();forget(r.key);st.recDone={v};
     noticeNewer(st.base);// what changed here since those words were written is taken paragraph by paragraph, as always
    }
    paintText();paintSaved();
   }
   /** A closed tab's words wait until this page has none unsaved and nothing else is asked, then are offered once. */
   async function offerNext(){
    if(!LOCKS||clk.gone||!st.human||st.offering||st.recovered||dirty()||st.conflict||st.saving||st.making||!st.base)return;
    st.offering=true;
    try{
     for(let k=0;k<64;k++){
      const d=await closedTab();if(!d||clk.gone)return;
      if(dirty()||st.conflict||st.saving||st.recovered){letGo(d.key);return;}
      const done=new Set((st.base.history||[]).filter(x=>x.state==='committed').map(x=>x.operationId));
      // A save of that tab's that the app holds: its words are settled the way a reload settles them, then the rest is offered.
      if((d.saved.sent||[]).some(i=>done.has(i?.operationId))){const read=await readDraft().catch(()=>null);if(!read||clk.gone||dirty()){letGo(d.key);return;}
       for(const i of d.saved.sent)if(i&&typeof i.operationId==='string')st.ops.add(i.operationId);
       const keep=st.edits;st.edits=new Map();for(const [rid,text,orig] of d.saved.edits)st.edits.set(rid,{text:String(text),orig:String(orig??'')});
       const added=st.added;st.added=d.saved.added.filter(a=>a&&typeof a.text==='string').map(a=>({id:a.id,afterId:a.afterId??null,text:a.text}));
       for(const info of d.saved.sent.filter(i=>done.has(i?.operationId))){noteSave(info);settleSent(read,info);}
       d.saved.edits=[...st.edits].map(([rid,e])=>[rid,e.text,e.orig]);d.saved.added=st.added.filter(a=>String(a.text).trim());d.saved.sent=[];
       st.edits=keep;st.added=added;adopt(read);
      }
      if(offerRecovered(d.key,d.saved)){paintText();paintSaved();return;}
     }
    }finally{st.offering=false;}
   }

   // ---------- what stands beside the page while two versions or kept words wait: one item, and on a phone at the top ----------
   function sideHTML(){
    const out=[];
    const c=st.conflict;
    if(c&&c.pairs.size){
     const n=c.pairs.size,first=[...c.pairs.values()][0];
     out.push(`<div class="wr-item wr-on" data-wr-side="conflict"><div class="wr-hd"><h2>${esc(n===1?'One paragraph, written in two places':n+' paragraphs, written in two places')}</h2></div>
      <p class="wr-says">${esc((n===1?'You changed this paragraph here at '+clock(first.at)+', and it was also changed '+(c.by.at?'elsewhere at '+clock(c.by.at):'elsewhere')+'.':'You changed these paragraphs here, and they were also changed '+(c.by.at?'elsewhere at '+clock(c.by.at):'elsewhere')+'.')+' Both are in the page with what differs marked. Keep one, or both. The one you do not keep stays in Earlier versions.')}</p></div>`);
    }
    const r=st.recovered;
    if(r){
     const first=r.items[0],before=first?first.saved??'':'',after=first?first.kept:r.added[0].text,where=first&&first.saved!==null?headingBefore(first.id):'';
     const [b,a]=marked(before,after),more=r.items.length+r.added.length-1;
     const closed=r.at?'The app closed at '+clock(new Date(r.at).toISOString())+' before ':'The app closed before ';
     out.push(`<div class="wr-item wr-on" data-wr-side="recovered"><div class="wr-hd"><h2>Words kept on this device</h2><p class="wr-by">${esc(closed+(more>0?'these changes were saved.':'this change'+(where?' in '+where:'')+' was saved.'))}<br>${esc(countLine(before,after)+(more>0?' And '+plural(more)+' more.':''))}</p></div>
      <div class="wr-ba"><div><p class="wr-label">Saved</p><p class="wr-pr">${before?b:'<i>Nothing here yet.</i>'}</p></div><div><p class="wr-label">Kept on this device</p><p class="wr-pr">${a}</p></div></div>
      <div class="wr-acts"><button type="button" class="${CP} wr-b wr-pri" data-act="rec" data-v="back">Put them back</button><button type="button" class="${CQ} wr-b wr-q" data-act="rec" data-v="left">Leave them out</button></div></div>`);
    }else if(st.recDone){
     const d=st.recDone;
     out.push(`<div class="wr-item" data-wr-side="recovered-done"><div class="wr-hd"><h2>Words kept on this device</h2></div><p class="wr-says">${esc(d.v==='back'?'Put back. They save with the rest of your words.':d.where==='server'?'Left out. They are kept in Earlier versions.':'Left out. They stay on this device, and Copy all my words includes them.')}</p><div class="wr-acts"><button type="button" class="${CQ} wr-b wr-q" data-act="side-done" data-v="rec">Done</button></div></div>`);
    }
    const m=st.merged;
    if(m&&!m.done&&!(c&&c.pairs.size)&&(m.mine.length||m.theirs.length||m.decided.length)){
     const lines=[];
     if(m.theirs.length)lines.push(plural(m.theirs.length)+' changed elsewhere '+(m.theirs.length===1?'was':'were')+' taken as '+(m.theirs.length===1?'it is':'they are')+'.');
     if(m.mine.length)lines.push('Your words in '+plural(m.mine.length)+' changed only here '+(m.mine.length===1?'stay':'stay')+' as you wrote them.');
     for(const p of m.decided)lines.push(p.kept==='both'?'You kept both versions of a paragraph, one after the other.':p.kept==='mine'?'You kept the version written here. The other is in Earlier versions.':p.where==='device'?'You kept the version written elsewhere. Yours stays on this device, and Copy all my words includes it.':'You kept the version written elsewhere. Yours is in Earlier versions.');
     const list=m.open&&m.theirs.length?`<ul class="wr-took">${m.theirs.map(t=>`<li><p class="wr-label">${esc(t.now===null?'Removed elsewhere':'Changed elsewhere')}</p><p class="wr-pr">${esc(t.now??t.was)}</p>${t.was!==null&&t.now!==null||t.now===null?`<div class="wr-acts wr-acts-in"><button type="button" class="${CB} wr-b" data-act="earlier" data-k="${esc(t.id)}">${esc(t.now===null?'Put this paragraph back':'Use the words you had')}</button></div>`:''}</li>`).join('')}</ul>`:'';
     out.push(`<div class="wr-item" data-wr-side="merged"><div class="wr-hd"><h2>${esc('A newer version was saved '+(m.by?.at?'elsewhere at '+clock(m.by.at):'elsewhere'))}</h2></div><p class="wr-says">${esc(lines.join(' '))}</p>${list}
      <div class="wr-acts">${m.theirs.length?`<button type="button" class="${CB} wr-b" data-act="merged-see" aria-expanded="${!!m.open}">${m.open?'Hide them':'See them'}</button>`:''}<button type="button" class="${CQ} wr-b wr-q" data-act="side-done" data-v="merged">Done</button></div></div>`);
    }
    return out.join('');
   }
   /** Draws the item beside the paragraph it is about (on a phone, at the top of the page) and the old top box no more. */
   function paintConflict(){
    const html=st.human?sideHTML():'';
    const top=$('[data-wr-conflict]');if(top){if(top._wrHtml!==html){top.innerHTML=html;top._wrHtml=html;}top.hidden=!html;}
    const box=$('[data-wr-text]');if(!box)return;
    box.querySelectorAll('[data-wr-side-m]').forEach(n=>n.remove());
    if(!html)return;
    const anchor=st.conflict?.pairs.size?[...st.conflict.pairs.keys()][0]:st.recovered?.ids.size?[...st.recovered.ids][0]:st.recovered?st.recovered.added[0]?.afterId:null;
    const row=(anchor&&box.querySelector(`[data-row="${CSS.escape(anchor)}"]`))||box.querySelector('[data-row]');
    row?.querySelector('.wr-margin')?.insertAdjacentHTML('afterbegin',`<div class="wr-side" data-wr-side-m>${html}</div>`);
   }
   function sideAct(act,v,k){
    if(act==='keep')return void keepVersion(k,v);
    if(act==='rec')return void decideRecovered(v);
    if(act==='earlier')return void useEarlier(k);
    if(act==='merged-see'&&st.merged){st.merged.open=!st.merged.open;paintConflict();return;}
    if(act==='side-done'){if(v==='rec')st.recDone=null;else if(st.merged)st.merged.done=true;paintConflict();}
   }
   /** A paragraph changed in both places, in place: both versions, each named, what differs marked, and the choice. */
   function pairHTML(r,p,n){
    const [t,m]=marked(p.theirs,p.mine),label=r.kind==='heading'?'heading':'paragraph '+n,h=r.kind==='heading'?' wr-h':'';
    return `<div class="wr-row" data-row="${esc(r.id)}" data-pair><div class="wr-main"><div class="wr-two${h}" role="group" aria-label="${esc('Two versions of '+label)}">
     <div class="wr-v"><p class="wr-k"><span>${esc(elsewhere(st.conflict.by))}</span><button type="button" class="${CB} wr-b" data-act="keep" data-v="theirs" data-k="${esc(r.id)}" aria-label="${esc('Keep the version '+elsewhere(st.conflict.by).replace(/^Written /,'written ').replace(/, .*$/,''))}">Keep this one</button></p><p class="wr-vt">${t}</p></div>
     <div class="wr-v"><p class="wr-k"><span>${esc('Written here, '+clock(new Date(p.at).toISOString()))}</span><button type="button" class="${CB} wr-b" data-act="keep" data-v="mine" data-k="${esc(r.id)}" aria-label="Keep the version written here">Keep this one</button></p><p class="wr-vt">${m}</p></div>
     <div class="wr-after"><button type="button" class="${CQ} wr-b wr-q" data-act="keep" data-v="both" data-k="${esc(r.id)}">Keep both, one after the other</button></div>
    </div></div><aside class="wr-margin"></aside></div>`;
   }
   /** Words a closed tab kept for a paragraph, in place and set into the page, until he puts them back or leaves them out. */
   function recHTML(r,text){
    const tag=r.kind==='heading'?'h2':'p',cls=r.kind==='heading'?' wr-h':'';
    return `<div class="wr-row" data-row="${esc(r.id)}" data-rec><div class="wr-main"><${tag} class="wr-ed wr-rec${cls}" aria-label="Words kept on this device">${esc(text)}</${tag}></div><aside class="wr-margin"></aside></div>`;
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
     // A paragraph that now holds formatting this page keeps as it is cannot take his words: they follow it as a new one.
     else if(!r.safe){st.edits.delete(rid);if(String(e.text).trim())st.added.push({id:uuid(),afterId:rid,text:flat(e.text)});}
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
    if(ok&&!dirty())setTimeout(offerNext,0);
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
    invalidateQuotes();
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
    {const e=st.edits.get(rid);if(e)e.at=Date.now();}
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

  return {claim,closedTab,forget,letAllGo,TAB,foreign,setAside,sendAsides,loadAsides,deviceAsides,classify,keepVersion,useEarlier,offerRecovered,decideRecovered,offerNext,sideHTML,sideAct,pairHTML,recHTML,marked,countLine,
   quoteHTML,invalidateQuotes,loadQuoteLinks,openQuote,textOf,offsetOf,pointAt,editable,status,paintFail,tryAgain,allWords,copyAll,loadKept,paintKept,undoLast,undoState,noteSave,paintAsk,noAsk,yesAsk,putBack,loadBack,endBack,takeBack,undoOp:takeBack,KEY,stash,unstash,ensureTail,order,removeAdded,rowHTML,paintText,fit,paintSaved,paintConflict,noticeNewer,useSaved,keepMine,wordsMap,foldAdded,adopt,carryAt,settleSent,takeOwn,say403,settled,save,run,startArticle,schedule,onInput,focusEditor,enter,join,refresh,onChange};
 };
})(window.v2);
