/* Research: its home, a group of sources, and a topic. Every record comes from the research-topics commands (a thin
   layer over the inquiries, findings and kept answers the app already holds); nothing here keeps a copy past what it
   shows. Slim and quiet: read first, one decision at a time, nothing forced. Answers written in sentences need an AI
   provider the app does not have for asking yet, so the ask box finds exact words and says so. */
(function(v2){
 'use strict';
 const {esc,icon,say,undo,sheet,notBuilt}=v2.ui;
 const topicHref=id=>v2.href('research/topic/:id',{id}),groupHref=id=>v2.href('research/group/:id',{id});
 const VIEWS={week:'Made for you this week',saying:'Has something to say',none:'Not in a group',gone:'Let go'};
 const ORIGIN_KIND={conversation:'talk','fact-check':'check',saved:'saves',note:'note',started:'you',subject:'subject',library:'library'};
 const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
 const fail=error=>say(error?.message||'That could not be done. Nothing was changed.',{tone:'bad'});
 const origin=o=>o?.say?`<span class="rs-or"><i data-k="${esc(ORIGIN_KIND[o.kind]||'library')}" aria-hidden="true"></i><span>${esc(o.say)}</span></span>`:'';
 const stateMark=t=>t.stateSay?`<em class="rs-state${t.state==='quiet'?' quiet':''}">${esc(t.stateSay)}</em>`:'';
 const ARROW='<svg class="v2-ic rs-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';

 /* ---------- shared: the rail, a topic row, the ask, the pickers ---------- */
 /** The rail of groups. On a phone it folds into one control that opens the list in place. */
 function rail(list,current){
  const c=list?.counts||{},link=(href,label,n,on)=>`<a class="rs-rl${on?' on':''}" href="${esc(href)}"${on?' aria-current="page"':''}><span>${esc(label)}</span><small>${n??''}</small></a>`;
  const g=(list?.groups||[]).find(x=>x.id===current);
  const here=current==='all'?['All topics',c.all]:VIEWS[current]?[VIEWS[current],c[current]]:[g?.name||'Group',g?.count];
  const view=k=>v2.href('research',{},{show:k});
  return `<aside class="rs-rail" data-rs-rail>
 <button type="button" class="rs-railtog" data-rs-railtog aria-expanded="false" aria-controls="rs-railin"><span>${esc(here[0])}</span><small>${here[1]??''}</small>${ARROW}</button>
 <nav class="rs-railin" id="rs-railin" aria-label="Research">
  ${link(v2.href('research'),'All topics',c.all,current==='all')}${link(view('week'),VIEWS.week,c.week,current==='week')}${link(view('saying'),VIEWS.saying,c.saying,current==='saying')}
  <p class="rs-label">Groups</p>
  ${groupLinks(list?.groups||[],current,link)}
  ${link(view('none'),VIEWS.none,c.none,current==='none')}
  ${c.gone?link(view('gone'),VIEWS.gone,c.gone,current==='gone'):''}
  <button type="button" class="v2-ghost rs-add" data-rs-newgroup>${icon('plus')}<span>New group</span></button>
 </nav>
</aside>`;
 }
 /** The first few groups (those with something to say first, and the one open now), then a quiet "All groups" for the rest. */
 const RAIL_GROUPS=8;
 function groupLinks(groups,current,link){
  const order=[...groups].sort((a,b)=>(b.saying||0)-(a.saying||0)||a.name.localeCompare(b.name));
  const first=order.slice(0,RAIL_GROUPS),here=order.find(g=>g.id===current);if(here&&!first.includes(here))first.push(here);
  const rest=order.filter(g=>!first.includes(g));
  return first.map(g=>link(groupHref(g.id),g.name,g.count,current===g.id)).join('')
   +(rest.length?`<button type="button" class="v2-ghost rs-more" data-rs-allgroups aria-expanded="false" aria-controls="rs-moregroups">All groups · ${rest.length} more</button><div class="rs-moregroups" id="rs-moregroups" hidden>${rest.map(g=>link(groupHref(g.id),g.name,g.count,false)).join('')}</div>`:'');
 }
 function wireRail(el){
  const tog=el.querySelector('[data-rs-railtog]'),r=el.querySelector('[data-rs-rail]');
  const more=el.querySelector('[data-rs-allgroups]');
  more?.addEventListener('click',()=>{const box=el.querySelector('.rs-moregroups'),open=box.hidden;box.hidden=!open;more.setAttribute('aria-expanded',String(open));more.textContent=open?'Fewer groups':more.textContent;if(!open)more.textContent='All groups · '+box.children.length+' more';});
  tog?.addEventListener('click',()=>{const open=!r.classList.contains('open');r.classList.toggle('open',open);tog.setAttribute('aria-expanded',String(open));});
  el.querySelector('[data-rs-newgroup]')?.addEventListener('click',()=>newGroup());
 }
 function row(t,{groups=[],made=false}={}){
  const g=groups.find(x=>x.id===t.groupId),sug=t.suggestedGroupId?groups.find(x=>x.id===t.suggestedGroupId):null;
  const side=made?`<span class="rs-side">${sug?`<span class="rs-sug">Put in <b>${esc(sug.name)}</b>?<button type="button" class="v2-ghost" data-rs-group="${esc(t.id)}" data-rs-to="${esc(sug.id)}">Yes</button></span>`:`<span class="rs-in">${esc(g?.name||'No group yet')}</span>`}${t.status==='let-go'?'':`<button type="button" class="v2-ghost v2-icon-btn rs-x" data-rs-letgo="${esc(t.id)}" aria-label="Let ${esc(t.name)} go" title="Let it go">${icon('close')}</button>`}</span>`:'';
  return `<li class="rs-li${made?' made':''}" data-rs-topicrow="${esc(t.id)}"><a class="rs-tr" href="${esc(topicHref(t.id))}"><b>${esc(t.name)}</b>${origin(t.origin)}<small>${plural(t.sourceCount,'source')}</small>${stateMark(t)}</a>${side}</li>`;
 }
 function askBox(groupId){
  const where=groupId?'the ticked sources':'everything you have gathered';
  return `<form class="rs-ask" data-rs-ask role="search">
 <div class="rs-askbox">${icon('search')}<input name="q" type="search" autocomplete="off" maxlength="256" aria-label="Find words in ${esc(where)}" placeholder="Find words in ${esc(where)}"><button class="pri" type="submit">Find</button></div>
 <div data-rs-answer aria-live="polite"></div>
 <p class="rs-meta rs-nb" data-rs-notbuilt>Answers in sentences are not built yet: they need an AI provider for asking. Until then this finds the exact words.</p>
</form>`;
 }
 function wireAsk(el,groupId){
  const form=el.querySelector('[data-rs-ask]');if(!form)return;
  form.addEventListener('submit',async e=>{
   e.preventDefault();const q=form.querySelector('[name=q]').value.trim(),out=form.querySelector('[data-rs-answer]');if(!q)return;
   out.innerHTML='<p class="rs-meta">Looking…</p>';
   try{
    const a=await v2.call('research-topics.ask',{query:q,...(groupId?{groupId}:{})});
    const items=[...a.found.map(f=>({title:f.title,quote:f.quote})),...(a.atlas||[]).map(f=>({title:f.title+' · Atlas',quote:f.quote}))];
    out.innerHTML=`<div class="rs-turn"><p class="rs-you">${esc(q)}</p><p>${esc(a.said)}</p>${items.length?`<ol class="rs-found">${items.map((f,i)=>`<li><span class="rs-n">${i+1}</span><p>${esc(f.quote)}</p><small>${esc(f.title)}</small></li>`).join('')}</ol>`:''}</div>`;
   }catch(error){out.innerHTML='';fail(error);}
  });
 }
 /** Choose Library sources: a find field over the Library, with ticks. Resolves with the ids chosen, or null. */
 async function pickSources({title='Add from the Library',have=[]}={}){
  let tree;try{tree=await v2.call('sources.tree');}catch(error){fail(error);return null;}
  const name=x=>String(x.title||x.name||'Source');
  const all=(tree.sources||[]).filter(s=>!have.includes(s.id)).sort((a,b)=>name(a).localeCompare(name(b)));
  return new Promise(resolve=>{
   let done=false;const chosen=new Set();
   const s=sheet({title,body:`<div class="rs-pick"><label class="rs-field"><span>Find</span><input type="search" data-rs-find autocomplete="off" placeholder="A word in the title"></label><ul class="rs-picklist" data-rs-list></ul><div class="rs-row end"><button type="button" class="v2-ghost" data-v2-close>Cancel</button><button type="button" class="pri" data-rs-add disabled>Add</button></div></div>`,onClose:()=>{if(!done)resolve(null);}});
   const list=s.body.querySelector('[data-rs-list]'),find=s.body.querySelector('[data-rs-find]'),add=s.body.querySelector('[data-rs-add]');
   const paint=()=>{const q=find.value.trim().toLocaleLowerCase(),rows=all.filter(x=>!q||name(x).toLocaleLowerCase().includes(q)).slice(0,40);
    list.innerHTML=rows.length?rows.map(x=>`<li><label><input type="checkbox" value="${esc(x.id)}"${chosen.has(x.id)?' checked':''}><span><b>${esc(name(x))}</b><small>${esc(x.kind||'Source')}</small></span></label></li>`).join(''):'<li class="rs-meta">Nothing in the Library matches.</li>';};
   list.addEventListener('change',e=>{const b=e.target.closest('input[type=checkbox]');if(!b)return;if(b.checked)chosen.add(b.value);else chosen.delete(b.value);add.disabled=!chosen.size;add.textContent=chosen.size?'Add '+chosen.size:'Add';});
   find.addEventListener('input',paint);paint();
   add.addEventListener('click',()=>{done=true;resolve([...chosen]);s.close();});
  });
 }
 async function chooseSubject(){
  let cat;try{cat=await v2.call('study-draft.catalog');}catch(error){fail(error);return null;}
  const all=(cat.collections||[]).filter(c=>c.bindingStatus==='ready').sort((a,b)=>String(a.title).localeCompare(String(b.title)));
  return new Promise(resolve=>{
   let done=false;
   const s=sheet({title:'Use for a subject',body:`<div class="rs-pick"><label class="rs-field"><span>Find</span><input type="search" data-rs-find autocomplete="off" placeholder="A word in its name"></label><ul class="rs-picklist" data-rs-list></ul></div>`,onClose:()=>{if(!done)resolve(null);}});
   const list=s.body.querySelector('[data-rs-list]'),find=s.body.querySelector('[data-rs-find]');
   const paint=()=>{const q=find.value.trim().toLocaleLowerCase();list.innerHTML=all.filter(c=>!q||String(c.title).toLocaleLowerCase().includes(q)).slice(0,40).map(c=>`<li><button type="button" class="v2-ghost rs-pickone" data-id="${esc(c.parentStudyId)}">${esc(c.title||c.parentStudyId)}</button></li>`).join('')||'<li class="rs-meta">No subject matches.</li>';};
   list.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;done=true;resolve(b.dataset.id);s.close();});
   find.addEventListener('input',paint);paint();
  });
 }
 function newGroup(){
  const s=sheet({title:'New group',body:`<form class="rs-pick"><label class="rs-field"><span>Name</span><input name="name" required maxlength="200" autocomplete="off" placeholder="For example, Tea: growing"></label><div class="rs-row end"><button type="button" class="v2-ghost" data-v2-close>Cancel</button><button class="pri" type="submit">Make the group</button></div></form>`});
  s.body.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const name=e.target.name.value.trim();if(!name)return;
   try{const g=await v2.call('research-topics.group.save',{name,expectedRevision:0});s.close();v2.go('research/group/:id',{id:g.id});}catch(error){fail(error);}});
 }
 function newTopic(groups){
  const picked=new Set();
  const s=sheet({title:'New topic',body:`<form class="rs-pick">
 <label class="rs-field"><span>What do you want to understand?</span><input name="name" required maxlength="200" autocomplete="off"></label>
 <div class="rs-field"><span>Add what you already have</span><button type="button" data-rs-pick>${icon('plus')}Choose from the Library</button><small class="rs-meta" data-rs-picked></small></div>
 <fieldset class="rs-field rs-chips"><legend>Group</legend>${groups.map(g=>`<label><input type="radio" name="group" value="${esc(g.id)}"><span>${esc(g.name)}</span></label>`).join('')}<label><input type="radio" name="group" value="" checked><span>No group</span></label></fieldset>
 <div class="rs-row end"><button type="button" class="v2-ghost" data-v2-close>Cancel</button><button class="pri" type="submit">Start it</button></div></form>`});
  const form=s.body.querySelector('form');
  form.querySelector('[data-rs-pick]').addEventListener('click',async()=>{const ids=await pickSources({have:[...picked]});if(ids)ids.forEach(id=>picked.add(id));form.querySelector('[data-rs-picked]').textContent=picked.size?plural(picked.size,'source')+' added':'';});
  form.addEventListener('submit',async e=>{e.preventDefault();const name=form.name.value.trim();if(!name)return;const group=form.querySelector('input[name=group]:checked')?.value;
   try{const t=await v2.call('research-topics.start',{name,sourceIds:[...picked],...(group?{groupId:group}:{})});s.close();v2.go('research/topic/:id',{id:t.id});}catch(error){fail(error);}});
 }
 /** Let a topic go, with Undo. */
 async function letGo(id,after){
  try{
   const t=await v2.call('research-topics.read',{id}),r=await v2.call('research-topics.let-go',{id,...v2.expect(t)});await after?.();
   undo('“'+t.name+'” was let go. It will not be opened again.',async()=>{try{const now=await v2.call('research-topics.read',{id});await v2.call('research-topics.undo',{id,...v2.expect(now),undoOperationId:r.operationId});await after?.();}catch(error){fail(error);}});
  }catch(error){fail(error);}
 }
 async function fileIn(id,groupId,after){try{const t=await v2.call('research-topics.read',{id});await v2.call('research-topics.save',{id,...v2.expect(t),groupId});await after?.();}catch(error){fail(error);}}
 const problem=error=>`<p class="v2-msg" data-tone="bad">${esc(error?.message||'Research could not be read.')}</p>`;

 /* ---------- the research home ---------- */
 v2.screen({id:'research',route:'research',title:'Research',
  render:ctx=>`<div class="rs-lay" data-rs-home><div class="rs-railhost" data-rs-railhost>${rail(null,ctx.query.show in VIEWS?ctx.query.show:'all')}</div><div class="v2-page rs-main" data-rs-main><header><div><h1>${esc(VIEWS[ctx.query.show]||'Research')}</h1></div></header><p class="rs-meta">Reading your research…</p></div></div>`,
  async mount(el,ctx){
   const show=ctx.query.show in VIEWS?ctx.query.show:'all';
   ctx.setAdvanced({section:'research'});if(show!=='all')ctx.setTitle(VIEWS[show]);
   const paint=async()=>{
    let list,gone=null;
    try{list=await v2.call('research-topics');if(show==='gone')gone=await v2.call('research-topics',{gone:true});}catch(error){el.querySelector('[data-rs-main]').innerHTML=`<header><h1>Research</h1></header>${problem(error)}`;return;}
    if(ctx.signal.aborted)return;
    el.querySelector('[data-rs-railhost]').innerHTML=rail(list,show);wireRail(el);
    const groups=list.groups,topics=list.topics,main=el.querySelector('[data-rs-main]');
    const rows=show==='gone'?gone.topics:show==='week'?topics.filter(t=>t.madeForYou):show==='saying'?topics.filter(t=>t.hasSomethingToSay):show==='none'?topics.filter(t=>!t.groupId):topics;
    let body=`<header><div><h1>${esc(show==='all'?'Research':VIEWS[show])}</h1><p>${plural(show==='all'?list.counts.all:rows.length,'topic')}</p></div><button type="button" data-rs-new>${icon('plus')}New topic</button></header>`;
    if(show==='all'){
     body+=askBox(null);
     const made=topics.filter(t=>t.madeForYou);
     if(made.length)body+=`<section class="rs-sec" data-rs-made><div class="rs-sec-h"><h2>Made for you this week</h2><span>${made.length}</span></div><ul class="rs-list">${made.map(t=>row(t,{groups,made:true})).join('')}</ul></section>`;
     for(const g of groups){const inside=topics.filter(t=>t.groupId===g.id&&!t.madeForYou);body+=`<section class="rs-sec"><div class="rs-sec-h"><h2><a href="${esc(groupHref(g.id))}">${esc(g.name)}</a></h2><span>${plural(g.count,'topic')}</span><a class="rs-open" href="${esc(groupHref(g.id))}">Open the group${icon('chev')}</a></div>${inside.length?`<ul class="rs-list">${inside.map(t=>row(t,{groups})).join('')}</ul>`:'<p class="rs-meta">No topics in it yet. Open a topic and put it here.</p>'}</section>`;}
     const loose=topics.filter(t=>!t.groupId&&!t.madeForYou);
     if(loose.length)body+=`<section class="rs-sec"><div class="rs-sec-h"><h2>${VIEWS.none}</h2><span>${plural(loose.length,'topic')}</span></div><ul class="rs-list">${loose.map(t=>row(t,{groups})).join('')}</ul></section>`;
     if(!topics.length)body+=`<section class="rs-sec rs-empty"><h2>No topics yet</h2><p class="rs-meta">Topics come from conversations, fact checks, things you saved and your notes. Assistants propose them here for you to keep or let go, and you can start one.</p></section>`;
    }else body+=`<section class="rs-sec">${rows.length?`<ul class="rs-list">${rows.map(t=>row(t,{groups,made:show==='week'})).join('')}</ul>`:`<p class="rs-meta">${show==='week'?'Nothing new this week.':show==='saying'?'Nothing is waiting for you.':show==='gone'?'Nothing was let go.':'Every topic is in a group.'}</p>`}</section>`;
    main.innerHTML=body;
    wireAsk(main,null);
    main.querySelector('[data-rs-new]')?.addEventListener('click',()=>newTopic(groups));
   };
   el.addEventListener('click',e=>{
    const x=e.target.closest('[data-rs-letgo]');if(x){e.preventDefault();return letGo(x.dataset.rsLetgo,paint);}
    const g=e.target.closest('[data-rs-group]');if(g){e.preventDefault();return fileIn(g.dataset.rsGroup,g.dataset.rsTo,paint);}
   });
   ctx.on({kinds:['research-topics*','inquiries*']},()=>paint());
   ctx.on({},e=>{if(e.reset)paint();});
   await paint();
  }});

 /* ---------- a group: sources with ticks, the ask, the topics inside, where it is used, how it works ---------- */
 v2.screen({id:'research-group',route:'research/group/:id',title:'Research group',
  render:ctx=>`<div class="rs-lay" data-rs-groupscreen><div class="rs-railhost" data-rs-railhost>${rail(null,ctx.params.id)}</div><div class="v2-page rs-main rs-grp" data-rs-main><p class="rs-meta">Reading the group…</p></div></div>`,
  async mount(el,ctx){
   const id=ctx.params.id;ctx.setAdvanced({section:'research'});
   let g=null;
   const paint=async()=>{
    let list;
    try{[g,list]=await Promise.all([v2.call('research-topics.group',{id}),v2.call('research-topics')]);}catch(error){el.querySelector('[data-rs-main]').innerHTML=`<header><h1>Research group</h1></header>${problem(error)}`;return;}
    if(ctx.signal.aborted)return;
    ctx.setTitle(g.name);
    el.querySelector('[data-rs-railhost]').innerHTML=rail(list,id);wireRail(el);
    const ticked=g.sources.filter(s=>s.ticked).length;
    el.querySelector('[data-rs-main]').innerHTML=`
<section class="rs-g-ask"><div class="rs-g-h"><p class="rs-label">Research group</p><h1>${esc(g.name)}</h1><p class="rs-meta">${plural(g.topics.length,'topic')} · ${plural(g.sources.length,'source')} · used in ${plural(g.usedIn.length,'subject')}</p><p class="rs-path" title="Where this group is filed">${esc(g.folder.join(' / '))}</p></div>
 ${askBox(id)}${g.sources.length&&!ticked?'<p class="rs-meta">Tick at least one source to look in.</p>':''}
</section>
<section class="rs-g-src" data-rs-sources><div class="rs-sec-h"><h2>Sources</h2><span>${g.sources.length}</span><button type="button" class="v2-ghost rs-push" data-rs-addsrc>${icon('plus')}Add</button></div>
 <p class="rs-meta">Ticked sources are the ones it is asked from.</p>
 ${g.sources.length?`<ul class="rs-src">${g.sources.map(s=>`<li><button type="button" aria-pressed="${s.ticked}" data-rs-tick="${esc(s.id)}"><i class="rs-tick" aria-hidden="true"></i><span><b>${esc(s.title)}</b><small>${esc(s.missing?'No longer in the Library':s.from==='topic'?'From a topic inside':s.kind||'Source')}</small></span></button></li>`).join('')}</ul>`:'<p class="rs-meta">No sources yet. Add them from the Library, or put topics in this group and their sources come with them.</p>'}
</section>
<section class="rs-g-side">
 <div class="rs-sec-h"><h2>Topics inside</h2><span>${g.topics.length}</span></div>
 ${g.topics.length?`<ul class="rs-g-t">${g.topics.map(t=>`<li><a href="${esc(topicHref(t.id))}"><b>${esc(t.name)}</b>${origin(t.origin)}${stateMark(t)}</a></li>`).join('')}</ul>`:'<p class="rs-meta">None yet. Open a topic and put it in this group.</p>'}
 <div class="rs-sec-h"><h2>Used in</h2></div>
 ${g.usedIn.length?`<ul class="rs-g-t">${g.usedIn.map(u=>`<li><a href="${esc(v2.href('subject/:id',{id:u.parentStudyId}))}"><b>${esc(u.title)}</b><small>Subject</small></a></li>`).join('')}</ul>`:'<p class="rs-meta">No subject uses its topics yet.</p>'}
 <div class="rs-sec-h"><h2>How this group works</h2><button type="button" class="v2-ghost rs-push" data-rs-change>Change</button></div>
 <dl class="rs-how"><dt>Filed in</dt><dd>${esc(g.folder.join(' / '))}</dd><dt>New topics</dt><dd>${g.settings.opensTopics==='off'?'Only when you start one':'Assistants propose them for you to keep'}</dd><dt>Looks for new material</dt><dd>Not built yet. It needs a research provider.</dd></dl>
</section>`;
    wireAsk(el,id);
   };
   el.addEventListener('click',async e=>{
    const t=e.target.closest('[data-rs-tick]');
    if(t&&g){e.preventDefault();const on=t.getAttribute('aria-pressed')==='true';try{await v2.call('research-topics.group.sources',{id,...v2.expect(g),action:on?'untick':'tick',sourceIds:[t.dataset.rsTick]});}catch(error){fail(error);}await paint();return;}
    if(e.target.closest('[data-rs-addsrc]')&&g){const ids=await pickSources({have:g.sources.map(s=>s.id)});if(!ids?.length)return;try{await v2.call('research-topics.group.sources',{id,...v2.expect(g),action:'add',sourceIds:ids});}catch(error){fail(error);}await paint();return;}
    if(e.target.closest('[data-rs-change]')&&g){
     const s=sheet({title:'How this group works',body:`<form class="rs-pick"><label class="rs-field"><span>Name</span><input name="name" required maxlength="200" value="${esc(g.name)}"></label><label class="rs-field"><span>Filed in</span><input name="folder" maxlength="400" value="${esc(g.folder.join(' / '))}"><small class="rs-meta">Folders, with a slash between them.</small></label><fieldset class="rs-field rs-chips"><legend>New topics</legend><label><input type="radio" name="opens" value="propose"${g.settings.opensTopics!=='off'?' checked':''}><span>Assistants propose them</span></label><label><input type="radio" name="opens" value="off"${g.settings.opensTopics==='off'?' checked':''}><span>Only when I start one</span></label></fieldset><div class="rs-row end"><button type="button" class="v2-ghost" data-v2-close>Cancel</button><button class="pri" type="submit">Save</button></div></form>`});
     s.body.querySelector('form').addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.target,opens=f.querySelector('input[name=opens]:checked')?.value||'propose';try{await v2.call('research-topics.group.save',{id,...v2.expect(g),name:f.name.value.trim(),folder:f.folder.value.split('/').map(x=>x.trim()).filter(Boolean),settings:{opensTopics:opens}});s.close();await paint();}catch(error){fail(error);}});
    }
   });
   ctx.on({kinds:['research-topics*','inquiries*']},()=>paint());
   ctx.on({},e=>{if(e.reset)paint();});
   await paint();
  }});

 /* ---------- a topic: Read, Decide, Sources ---------- */
 /** The learning record as a calm page: headings and paragraphs, with no markup shown. */
 function prose(body){
  const blocks=String(body||'').replace(/\r/g,'').split(/\n{2,}/).map(b=>b.trim()).filter(Boolean);
  let first=true;
  return blocks.map((b,i)=>{
   if(/^#{1,6}\s/.test(b)){const text=b.replace(/^#{1,6}\s+/,'');return i===0?'':`<h2>${esc(text)}</h2>`;}
   const clean=s=>esc(s.replace(/\*\*|__|`/g,''));
   if(b.split('\n').every(l=>/^\s*[-*]\s+/.test(l)))return `<ul class="rs-bul">${b.split('\n').map(l=>`<li>${clean(l.replace(/^\s*[-*]\s+/,''))}</li>`).join('')}</ul>`;
   const lead=first;first=false;return `<p${lead?' class="rs-lead"':''}>${clean(b.replace(/\n/g,' '))}</p>`;
  }).join('');
 }
 const meter=(f,a)=>`<span class="rs-meter" aria-hidden="true">${'<i class="f"></i>'.repeat(Math.min(f,8))}${'<i class="a"></i>'.repeat(Math.min(a,8))}</span>`;
 function readTab(t,groups){
  const used=t.usedIn.filter(u=>u.status==='used'),human=v2.isHuman();
  const crumbs=[t.group?`<a href="${esc(groupHref(t.group.id))}">${esc(t.group.name)}</a>`:'',origin(t.origin),used.length?`<span>used in ${used.map(u=>`<a href="${esc(v2.href('subject/:id',{id:u.parentStudyId}))}">${esc(u.title)}</a>`).join(', ')}</span>`:''].filter(Boolean).join('<span class="rs-dot" aria-hidden="true">·</span>');
  const verdict=s=>s.dispute.length&&s.agree.length?'They disagree':s.dispute.length?'Disputed':s.agree.length>1?'Agreed':'One voice';
  return `<article class="rs-read">
 <p class="rs-crumbs">${crumbs}</p>
 <h1>${esc(t.name)}</h1>
 ${t.learning?.body?.trim()?prose(t.learning.body):'<p class="rs-lead rs-quietp">Nothing is written down about it yet.</p>'}
 ${t.note?`<p class="rs-meta">${esc(t.note)}</p>`:''}
 ${t.said.length?`<h2>What people say</h2><ul class="rs-say">${t.said.map(s=>`<li class="${s.dispute.length?'split':''}"><p>${esc(s.text)}</p><span>${meter(s.agree.length,s.dispute.length)}${esc(verdict(s))}</span>${s.agree.length||s.dispute.length?`<small>${s.agree.length?'Agree: '+esc(s.agree.join(', ')):''}${s.agree.length&&s.dispute.length?' · ':''}${s.dispute.length?'Dispute: '+esc(s.dispute.join(', ')):''}</small>`:''}</li>`).join('')}</ul>`:''}
 ${t.spoken.length?`<h2>In their words</h2><ol class="rs-talk">${t.spoken.map(s=>`<li><p class="v2-speech">“${esc(s.quote)}”</p><small>${esc([s.speaker,s.location].filter(Boolean).join(' · '))}</small></li>`).join('')}</ol>`:''}
 <section class="rs-take" data-rs-takebox><h2>In one line, what do you take from this?</h2>
  ${t.take?.text?`<p class="rs-mine">${esc(t.take.text)}</p>`:`<p class="rs-quietp">${human?'Not written yet.':'Adrian has not written it yet.'}</p>`}
  ${human?`<button type="button" class="v2-ghost rs-write" data-rs-write>${t.take?.text?'Change it':'Write it'}</button>
  <form class="rs-takeform" data-rs-take hidden><label class="rs-vh" for="rs-take-text">Your line</label><textarea id="rs-take-text" name="take" rows="2" maxlength="400">${esc(t.take?.text||'')}</textarea>
   <div class="rs-row"><button type="submit" class="pri">Keep my line</button><button type="button" class="v2-ghost" data-rs-cancel>Cancel</button><span class="rs-meta">Only you write here.</span></div></form>`:'<p class="rs-meta">Only Adrian writes here.</p>'}
 </section>
 ${t.status==='let-go'?'':`<div class="rs-file"><label class="rs-field inline"><span>Group</span><select data-rs-groupset><option value="">No group</option>${groups.map(g=>`<option value="${esc(g.id)}"${g.id===t.groupId?' selected':''}>${esc(g.name)}</option>`).join('')}</select></label><button type="button" data-rs-link>${icon('plus')}Use for a subject</button>${t.kind!=='subject'?'<button type="button" class="v2-ghost" data-rs-letgo-topic>Let it go</button>':''}</div>`}
</article>`;
 }
 function decideTab(t){
  const w=t.waitingNow[0];
  if(!w)return `<div class="rs-decwrap"><article class="rs-dec done">${icon('check')}<h2>Nothing needs you here.</h2>${t.waitingLeft.length?`<p class="rs-meta">${plural(t.waitingLeft.length,'thing')} left for later.</p><button type="button" data-rs-again="${esc(t.waitingLeft[0].key)}">Show it again</button>`:''}</article></div>`;
  const label={keep:'Keep','let-go':'Let it go',yes:'Yes','not-now':'Not now'};
  return `<div class="rs-decwrap"><article class="rs-dec" data-rs-waiting="${esc(w.key)}"><p class="rs-label">1 of ${t.waitingNow.length}</p><h2>${esc(w.title)}</h2>${w.detail?`<p class="rs-dec-s">${esc(w.detail)}</p>`:''}
  <div class="rs-row">${w.choices.map((c,i)=>`<button type="button"${i===0?' class="pri"':c==='not-now'?' class="v2-ghost"':''} data-rs-choice="${esc(c)}">${esc(label[c]||c)}</button>`).join('')}</div>
  <p class="rs-meta">You never have to. Not now keeps it here for later.</p></article></div>`;
 }
 function sourcesTab(t){
  return `<article class="rs-read rs-srcs"><div class="rs-row"><h1 class="small">Where this comes from</h1><span class="rs-grow"></span>${t.status!=='let-go'?`<button type="button" data-rs-addsrc>${icon('plus')}Add a source</button>`:''}</div>
 <p class="rs-meta">${plural(t.sources.length,'source')}. Each counts once, however long it is.</p>
 ${t.sources.length?`<ul class="rs-src wide">${t.sources.map(s=>`<li><span><b>${esc(s.title)}</b><small>${esc(s.missing?'No longer in the Library':s.kind||'Source')}</small></span></li>`).join('')}</ul>`:'<p class="rs-meta">No sources yet.</p>'}
 ${t.answers.length?`<h2>Questions asked</h2><ul class="rs-src wide">${t.answers.map(a=>`<li><span><b>${esc(a.question)}</b><small>${esc(a.keptAt?'Kept':a.status||'')}</small></span></li>`).join('')}</ul>`:''}
 ${t.usedIn.length?`<h2>Used in</h2><ul class="rs-src wide">${t.usedIn.map(u=>`<li><a href="${esc(v2.href('subject/:id',{id:u.parentStudyId}))}"><b>${esc(u.title)}</b><small>${u.status==='used'?'Subject':'Waiting for your yes'}</small></a></li>`).join('')}</ul>`:''}
 <h2>Looking for more</h2>${notBuilt('Looking for new sources and viewpoints needs a research provider.',{advanced:{section:'research',...(t.usedIn[0]?{subject:t.usedIn[0].parentStudyId}:{})}})}
</article>`;
 }
 v2.screen({id:'research-topic',route:'research/topic/:id',title:'Research topic',
  render:()=>`<div class="rs-topic" data-rs-topic><div class="rs-bar"><a class="rs-back" href="${esc(v2.href('research'))}">${icon('back')}<span>Research</span></a><nav class="rs-tabs" aria-label="Topic" data-rs-tabs></nav></div><div class="rs-topic1" data-rs-body><p class="rs-meta rs-pad">Reading the topic…</p></div></div>`,
  async mount(el,ctx){
   const id=ctx.params.id,tab=['read','decide','sources'].includes(ctx.query.tab)?ctx.query.tab:'read';let t=null,groups=[];
   const paint=async()=>{
    try{const [topic,list]=await Promise.all([v2.call('research-topics.read',{id}),v2.call('research-topics.groups')]);t=topic;groups=list.groups;}catch(error){el.querySelector('[data-rs-body]').innerHTML=`<div class="v2-page">${problem(error)}</div>`;return;}
    if(ctx.signal.aborted)return;
    ctx.setTitle(t.name);ctx.setAdvanced({section:'research',...(t.usedIn[0]?{subject:t.usedIn[0].parentStudyId}:{})});
    const tabs=[['read','Read'],['decide',t.waitingNow.length?'Decide · '+t.waitingNow.length:'Decide'],['sources','Sources · '+t.sources.length]];
    el.querySelector('[data-rs-tabs]').innerHTML=tabs.map(([k,l])=>`<a href="${esc(v2.href('research/topic/:id',{id},k==='read'?null:{tab:k}))}"${k===tab?' aria-current="page"':''} data-rs-tab="${k}">${esc(l)}</a>`).join('');
    el.querySelector('[data-rs-body]').innerHTML=(t.status==='let-go'?'<p class="rs-gone">This topic was let go. It is not opened or suggested again.</p>':'')+(tab==='decide'?decideTab(t):tab==='sources'?sourcesTab(t):readTab(t,groups));
   };
   const save=async input=>{try{await v2.call('research-topics.save',{id,...v2.expect(t),...input});}catch(error){fail(error);}await paint();};
   el.addEventListener('submit',async e=>{
    const f=e.target.closest('[data-rs-take]');if(!f)return;e.preventDefault();
    // His own words: on a newer version the screen shows it and never merges for him.
    const text=f.querySelector('textarea').value.trim();
    try{await v2.call('research-topics.take',{id,...v2.expect(t),text});say('Your line is kept.',{tone:'good'});await paint();}
    catch(error){fail(error);if(error.kind==='stale'){const mine=f.querySelector('textarea').value;await paint();const form=el.querySelector('[data-rs-take]');if(form){form.hidden=false;form.querySelector('textarea').value=mine;say('This topic changed since you opened it. Your line was not kept; it is still in the box.',{tone:'warn'});}}}
   });
   el.addEventListener('change',e=>{const s=e.target.closest('[data-rs-groupset]');if(s)save({groupId:s.value||null});});
   el.addEventListener('click',async e=>{
    if(!t)return;
    if(e.target.closest('[data-rs-letgo-topic]')){e.preventDefault();return letGo(id,paint);}
    if(e.target.closest('[data-rs-write]')){const f=el.querySelector('[data-rs-take]');f.hidden=false;e.target.closest('[data-rs-write]').hidden=true;f.querySelector('textarea').focus();return;}
    if(e.target.closest('[data-rs-cancel]')){const f=el.querySelector('[data-rs-take]');f.hidden=true;el.querySelector('[data-rs-write]').hidden=false;return;}
    if(e.target.closest('[data-rs-link]')){const sid=await chooseSubject();if(!sid)return;say('Linking it to the subject. You can keep reading.',{timeout:0});try{await v2.call('research-topics.link',{id,...v2.expect(t),parentStudyId:sid});say(v2.isHuman()?'It is used there now.':'Linked. It waits for Adrian\'s yes.',{tone:'good'});}catch(error){fail(error);}await paint();return;}
    if(e.target.closest('[data-rs-addsrc]')){const have=t.sources.map(s=>s.id),ids=await pickSources({have});if(ids?.length)await save({sourceIds:[...have,...ids]});return;}
    const again=e.target.closest('[data-rs-again]');if(again)return save({unleave:again.dataset.rsAgain});
    const c=e.target.closest('[data-rs-choice]');if(!c)return;
    const w=t.waitingNow[0],choice=c.dataset.rsChoice;if(!w)return;
    if(choice==='not-now')return save({leave:w.key});
    if(w.kind==='keep'&&choice==='let-go')return letGo(id,paint);
    try{
     if(w.kind==='keep')await v2.call('research-topics.keep',{id,...v2.expect(t)}),say('Kept. It is one of your topics now.',{tone:'good'});
     else if(w.kind==='group')await v2.call('research-topics.save',{id,...v2.expect(t),groupId:w.groupId});
     else if(w.kind==='use')await v2.call('research-topics.link',{id,...v2.expect(t),parentStudyId:w.parentStudyId});
    }catch(error){fail(error);}
    await paint();
   });
   ctx.on({kind:'research-topic',id},()=>paint());
   ctx.on({kinds:['inquiries*']},()=>paint());
   ctx.on({},e=>{if(e.reset)paint();});
   await paint();
  }});

 // For other screens (a subject can show the topics it uses): read-only helpers, on v2.shared when the shell allows it.
 try{if(!v2.shared)v2.shared={};}catch{}
 try{if(v2.shared&&!v2.shared.research)v2.shared.research=Object.freeze({topicHref,groupHref,topicsFor:parentStudyId=>v2.call('research-topics.subject',{parentStudyId})});}catch{}
})(window.v2);
