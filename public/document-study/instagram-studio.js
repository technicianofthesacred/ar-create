// Instagram studio: what a voice transcript and photos could become on Instagram. Shows the two or three stories an
// agent found (each line with the photo matched to it, and the research worth doing), lets Adrian pick one or name his
// own, shows the made story, reel, post or carousel at real proportions, and takes his final yes. Opens from Media,
// Arrange and Outputs, or from a link ending #instagram=<plan id>. Nothing here posts or sends anything.
(function(){
 if(window.arInstagram)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const actor=()=>window.arCreateUiActor?.actor||'human:adrian',isAdrian=()=>/^human:/.test(actor());
 const headers=()=>({'Content-Type':'application/json','X-AR-Actor':actor(),'X-AR-Client':'ui'});
 const who=by=>{const m=/^agent:(.+)$/.exec(by||'');if(!m)return 'you';return /^claude/.test(m[1])?'Claude':m[1].replace(/^./,c=>c.toUpperCase());};
 const FORMAT={story:'Story',reel:'Reel',post:'Post',carousel:'Carousel'},SIZE={story:[1080,1920],reel:[1080,1920],post:[1080,1350],carousel:[1080,1350]};
 const STATUS={open:'Open',checking:'Being checked',answered:'Answered',resting:'Resting'};
 let dlg=null,plan=null,plans=[],format=null,ctx={},busy=false,opener=null;
 const $=sel=>dlg.querySelector(sel);
 async function call(url,options={}){const r=await fetch(url,{cache:'no-store',...options,headers:{...headers(),...options.headers}}),v=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(v.error||'The request was refused ('+r.status+').'),{status:r.status});return v;}
 const blob=id=>'/api/sources/blob?id='+encodeURIComponent(id);
 const photo=id=>plan.material.photos.find(p=>p.id===id);
 const line=id=>plan.lines.find(l=>l.id===id);
 const hashtags=t=>[...String(t||'').matchAll(/(^|\s)#[\p{L}\p{N}_]+/gu)].length;
 const clock=sec=>{sec=Math.max(0,Math.round(sec||0));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,x=sec%60;return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(x).padStart(2,'0');};
 const momentOf=lineId=>(plan.moments||[]).find(m=>m.lineIds.includes(lineId));
 const at=lineId=>{const m=momentOf(lineId);return m?(m.estimated?'about ':'')+clock(m.at):'';};
 const COVER={used:'Used','in-story':'In a proposed story',saved:'Saved for later',skipped:'Skipped on purpose',unplaced:'Not placed yet'};
 const useText=u=>[...new Set(u.map(x=>FORMAT[x.format]+(x.frame?' frame '+x.frame:' caption')))].join(', ');
 // The coverage strip: every moment of the recording along its timeline, coloured by where it went.
 function stripHTML(){
  const c=plan.coverage;if(!c||!c.total)return '';
  const end=Math.max(1,...c.moments.map(m=>m.until||m.at));
  const segs=c.moments.map(m=>'<button type="button" class="igs-seg s-'+m.status+'" style="flex-grow:'+Math.max(1,(m.until||m.at)-m.at)+'" data-igs="moment" data-id="'+esc(m.id)+'" title="'+esc(m.id+' · '+clock(m.at)+' · '+COVER[m.status]+(m.uses.length?': '+useText(m.uses):m.why?': '+m.why:''))+'" aria-label="'+esc(m.id+' at '+clock(m.at)+', '+COVER[m.status])+'"></button>').join('');
  const legend=Object.keys(COVER).map(k=>'<span class="igs-key"><i class="s-'+k+'"></i>'+esc(COVER[k])+' '+c.counts[k]+'</span>').join('');
  return '<section class="igs-cover" aria-label="Coverage of the whole recording"><div class="igs-cover-head"><span class="igs-lab">Every moment of the recording · '+c.total+' moments · '+clock(end)+'</span>'+(c.counts.unplaced?'<span class="igs-warn">'+c.counts.unplaced+' not placed yet</span>':'<span class="igs-ok">Nothing left unplaced</span>')+'</div><div class="igs-strip-time" role="group" aria-label="Moments along the timeline">'+segs+'</div><div class="igs-ticks"><span>0:00</span><span>'+clock(end/2)+'</span><span>'+clock(end)+'</span></div><div class="igs-legend">'+legend+'</div><div class="igs-moment" hidden></div></section>';
 }
 function momentDetail(id){
  const m=plan.moments.find(x=>x.id===id),c=plan.coverage.moments.find(x=>x.id===id),box=$('.igs-moment');if(!m||!box)return;
  box.hidden=false;box.innerHTML='<p class="igs-lab">'+esc(m.id)+' · '+(m.estimated?'about ':'')+esc(clock(m.at))+'–'+esc(clock(m.until))+' · '+esc(COVER[c.status])+(c.uses.length?' · '+esc(useText(c.uses)):'')+(c.why?' · '+esc(c.why):'')+'</p><p class="igs-speech igs-exact">'+esc(m.text)+'</p><p class="igs-dim">Exact words from the transcript, unchanged.</p>'
   +(isAdrian()?'<div class="igs-row"><button type="button" data-igs="mark" data-id="'+esc(m.id)+'" data-s="saved">Save for later</button><button type="button" data-igs="mark" data-id="'+esc(m.id)+'" data-s="skipped">Skip on purpose</button></div>':'');
 }
 const KIND={'tea-term':'Tea term',name:'Name or place',place:'Place',number:'Number',date:'Date',other:'Word'};
 function flagsHTML(){
  const st=new Map((plan.flagStatus||[]).map(x=>[x.id,x])),flags=plan.flags||[];if(!flags.length)return '';
  const open=flags.filter(f=>st.get(f.id)?.status==='open'),inUse=open.filter(f=>st.get(f.id)?.inUse);
  const row=f=>{const l=line(f.lineId),c=plan.confirmations?.[f.id];const before=l?l.text.slice(Math.max(0,f.start-48),f.start):'',after=l?l.text.slice(f.start+f.heard.length,f.start+f.heard.length+48):'';
   return '<li data-flag="'+esc(f.id)+'"><p class="igs-lab">'+esc(KIND[f.kind]||'Word')+' · '+esc(at(f.lineId))+(st.get(f.id)?.inUse?' · in use':'')+'</p><p class="igs-speech">'+(f.start>48?'…':'')+esc(before)+'<mark>'+esc(f.heard)+'</mark>'+esc(after)+(l&&f.start+f.heard.length+48<l.text.length?'…':'')+'</p>'+(f.suggestion?'<p class="igs-dim">The tea-term library writes it: '+esc(f.suggestion)+'</p>':'')
    +(c?'<p class="igs-ok">'+(c.verdict==='as-heard'?'You confirmed it as heard.':'You corrected it to “'+esc(c.correction)+'”.')+'</p>':isAdrian()?'<form class="igs-row" data-igs="confirm" data-id="'+esc(f.id)+'"><button type="button" data-igs="as-heard" data-id="'+esc(f.id)+'">As heard</button><input name="correction" maxlength="200" placeholder="Or what you said" aria-label="Your correction"><button type="submit">Correct it</button></form>':'<p class="igs-dim">Waiting for Adrian.</p>')+'</li>';};
  const shown=[...inUse,...flags.filter(f=>!inUse.includes(f))];
  return '<section aria-label="Words to confirm"><h2>Words to confirm</h2><p class="igs-dim">Heard but not certain: names, places, tea terms, numbers and dates. Nothing is corrected without you. '+(inUse.length?inUse.length+' in what is being made, '+(open.length-inUse.length)+' elsewhere.':open.length?open.length+' open, none in what is being made.':'All confirmed.')+'</p><ul class="igs-flags">'+shown.slice(0,inUse.length+6).map(row).join('')+'</ul>'+(shown.length>inUse.length+6?'<p class="igs-dim">'+(shown.length-inUse.length-6)+' more in moments not used yet.</p>':'')+'</section>';
 }
 function note(text,bad){const n=$('.igs-note');n.hidden=!text;n.className='igs-note'+(bad?' bad':'');n.textContent=text||'';}

 /* ---------- rendering ---------- */
 function storyCard(s){
  const chosen=plan.chosen?.storyId===s.id,heard=plan.heard?.storyId===s.id,gaps=plan.gaps.filter(g=>g.storyIds.includes(s.id));
  const lines=s.spine.map(id=>{const l=line(id);if(!l)return '';const ms=s.matches.filter(m=>m.lineId===id);
   return '<li class="igs-line">'+(ms.length?ms.map(m=>{const p=photo(m.photoId);return p?'<img src="'+esc(blob(p.sourceId))+'" alt="'+esc(p.caption||'Photo')+'" title="'+esc(m.why||p.caption||'')+'" loading="lazy">':'';}).join(''):'<span class="igs-nophoto" title="No photo matched this line">no photo</span>')+'<div><p class="igs-speech">“'+esc(l.text)+'”</p><span class="igs-who">'+esc([at(id),l.speaker].filter(Boolean).join(' · '))+'</span>'+(ms[0]?.why?'<span class="igs-why">'+esc(ms[0].why)+'</span>':'')+'</div></li>';}).join('');
  return '<article class="igs-story'+(chosen?' on':'')+'" data-story="'+esc(s.id)+'"><header><span class="igs-lab">'+esc(FORMAT[s.format]||'Story')+' · from '+esc(who(s.by))+'</span>'+(heard?'<span class="igs-heard" title="Recorded by '+esc(who(plan.heard.by))+'">You said in chat: “'+esc(plan.heard.quote)+'”</span>':'')+'</header>'
   +'<h3>'+esc(s.title)+'</h3><p class="igs-dish">'+esc(s.dish)+'</p>'+(s.why?'<p class="igs-dim">'+esc(s.why)+'</p>':'')+(s.reader?'<p class="igs-dim">For: '+esc(s.reader)+'</p>':'')
   +'<div class="igs-readback"><span class="igs-lab">What this says</span><p>'+esc(s.readback||'')+'</p>'+(s.meaning?'<p class="'+(s.meaning.verdict==='right'?'igs-ok':'igs-warn')+'">'+(s.meaning.verdict==='right'?'You said: that is it.':'You said: “'+esc(s.meaning.words)+'”')+'</p>':isAdrian()?'<div class="igs-row"><button type="button" data-igs="meant" data-id="'+esc(s.id)+'">That is it</button><button type="button" data-igs="not-meant" data-id="'+esc(s.id)+'">Not what I meant</button></div><form class="igs-notmeant" data-igs="meaning" data-id="'+esc(s.id)+'" hidden><textarea name="words" rows="3" maxlength="1200" placeholder="What you meant, in your words"></textarea><button type="submit">Save what I meant</button></form>':'')+'</div>'
   +'<ol class="igs-lines">'+lines+'</ol>'
   +(gaps.length?'<div class="igs-gaps-mini"><span class="igs-lab">Worth checking</span>'+gaps.map(g=>'<p>'+esc(g.question)+' <span class="igs-status">'+esc(STATUS[g.status])+'</span></p>').join('')+'</div>':'')
   +'<button type="button" class="'+(chosen?'igs-primary':'')+'" data-igs="choose" data-id="'+esc(s.id)+'" aria-pressed="'+chosen+'" '+(isAdrian()?'':'disabled title="Only Adrian picks the story"')+'>'+(chosen?'Chosen':'This one')+'</button></article>';
 }
 function framesHTML(l){
  const [w,h]=SIZE[l.format],cw=l.format==='post'||l.format==='carousel'?220:180,scale=cw/w;let t=0;
  return l.frames.map((f,i)=>{const src='/api/instagram/render?'+new URLSearchParams({id:plan.id,format:l.format,frame:String(i)}),png='/api/instagram/png?'+new URLSearchParams({id:plan.id,format:l.format,frame:String(i)});
   const time=f.seconds?'<span>'+Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+' · '+f.seconds+'s</span>':'';if(f.seconds)t+=f.seconds;
   return '<figure class="igs-frame"><div class="igs-clip" style="width:'+cw+'px;height:'+Math.round(h*scale)+'px"><iframe title="Frame '+(i+1)+'" src="'+esc(src)+'" loading="lazy" tabindex="-1" style="width:'+w+'px;height:'+h+'px;transform:scale('+scale+')"></iframe></div><figcaption><span>'+(i+1)+'</span>'+time+'<a href="'+esc(src)+'" target="_blank" rel="noopener">Full size</a>'+(held()?'<span class="igs-off" title="On hold for consent">PNG</span>':'<a href="'+esc(png)+'" download>PNG</a>')+'</figcaption></figure>';}).join('');
 }
 // The consent hold: the same check the server enforces on the yes, the PNGs and the reel words. Says who is unanswered and where to answer.
 // Files for posting are held only by a real hold; a plan with no piece to check against just cannot be marked ready yet.
 const held=()=>!!plan?.publishHold&&!plan.publishHold.unlinked;
 function holdHTML(hold,after){if(!hold)return '';if(hold.unlinked)return '<span class="ar-hold igs-hold" '+(after?'':'id="igs-hold-note" ')+'role="status">'+esc(hold.summary)+'</span>';return '<span class="ar-hold igs-hold" '+(after?'':'id="igs-hold-note" ')+'role="status">'+(after?'Held again for consent. ':'On hold for consent. ')+esc(hold.summary)+(hold.link?' <a class="ar-hold-link" href="'+esc(hold.link)+'" data-igs="consent">Open the consent desk ›</a>':'')+'</span>';}
 function madeHTML(){
  const made=Object.keys(plan.layouts);if(!made.length)return '<div class="igs-empty"><p><b>Nothing made yet.</b> Once you pick a story, Claude lays it out with one template per frame: your words exactly as you said them, a caption drafted for you to change.</p></div>';
  if(!made.includes(format)){const pick=plan.stories.find(x=>x.id===(plan.chosen?.storyId||plan.heard?.storyId));format=pick&&made.includes(pick.format)?pick.format:made[0];}
  const l=plan.layouts[format],story=plan.stories.find(s=>s.id===l.storyId),r=plan.ready?.[format];
  const otherStory=plan.chosen?.storyId&&plan.chosen.storyId!==l.storyId,caption=l.captionFinal??l.caption.text??'';
  const hold=plan.publishHold,reason=hold?(hold.unlinked?hold.summary:'On hold for consent'):!isAdrian()?'Only Adrian gives the final yes':!plan.chosen?'Pick or name the story first':otherStory?'This was made for another story than the one you chose':'';
  return '<div class="igs-tabs" role="tablist">'+Object.keys(FORMAT).map(f=>'<button type="button" role="tab" data-igs="format" data-f="'+f+'" aria-selected="'+(f===format)+'" '+(plan.layouts[f]?'':'disabled title="Not made yet"')+'>'+FORMAT[f]+(plan.ready?.[f]?' · ready':'')+'</button>').join('')+'</div>'
   +'<p class="igs-dim">'+esc(FORMAT[format])+' of “'+esc(story?.title||'a story')+'”, laid out by '+esc(who(l.builtBy))+'. '+l.frames.length+' frame'+(l.frames.length>1?'s':'')+(format==='reel'?' · '+Math.round(l.frames.reduce((a,f)=>a+(f.seconds||0),0))+' seconds · '+(held()?'<span class="igs-off" title="On hold for consent">On-screen words (.srt)</span>':'<a href="/api/instagram/captions?id='+esc(plan.id)+'" download>On-screen words (.srt)</a>'):'')+'</p>'
   +'<div class="igs-strip">'+framesHTML(l)+'</div>'
   +'<details class="igs-said"><summary>On screen, word for word</summary><ol>'+l.frames.map((f,i)=>'<li><span class="igs-lab">Frame '+(i+1)+'</span>'+f.words.map(w=>'<p><span class="igs-speech">“'+esc(w.text)+'”</span> <span class="igs-who">'+esc(at(w.lineId))+(w.corrected?' · with your correction':'')+'</span></p>').join('')+'</li>').join('')+'</ol></details>'
   +((l.caption.parts||[]).length?'<div class="igs-parts"><span class="igs-lab">Caption, part by part</span>'+l.caption.parts.map(p=>p.kind==='quote'?'<p><span class="igs-tag">His words · '+esc(at(p.lineId))+'</span><span class="igs-speech">“'+esc(p.text)+'”</span></p>':p.kind==='suggested'?'<p><span class="igs-tag warn">Suggested wording</span>'+esc(p.text)+'<span class="igs-orig">Original, '+esc(at(p.lineId))+': <span class="igs-speech">“'+esc(p.original)+'”</span></span></p>':'<p><span class="igs-tag">Drafted by '+esc(who(l.caption.by))+'</span>'+esc(p.text)+'</p>').join('')+'</div>':'')
   +'<label class="igs-cap"><span class="igs-lab">Caption · '+(l.captionFinal!=null?'yours':l.caption.text?'drafted by '+esc(who(l.caption.by))+', yours to change':'not drafted yet')+'</span><textarea rows="5" maxlength="2200" data-igs="caption" '+(isAdrian()&&!r?'':'readonly')+'>'+esc(caption)+'</textarea><span class="igs-count" data-igs="count"></span></label>'
   +(r?'<p class="igs-ready">You said yes '+esc(new Date(r.at).toLocaleString())+'. Nothing was posted from here: post it yourself when you are ready.</p>'+holdHTML(hold,true)
     :'<div class="igs-go"><button type="button" class="igs-primary" data-igs="ready" '+(reason?'disabled title="'+esc(reason)+'"':'')+(hold?' aria-describedby="igs-hold-note"':'')+'>Ready to post</button>'+(hold?holdHTML(hold,false):'<span class="igs-dim">'+esc(reason||'Ready records your yes with this caption. Nothing is posted from here.')+'</span>')+'</div>');
 }
 function render(){
  const body=$('.igs-body');
  if(!plan){body.innerHTML='<div class="igs-empty igs-first"><h2>Nothing here yet</h2><p>This is where a voice note and photos become a story, reel, post or carousel.</p><ol><li>In a Claude chat, give it your voice transcript and photos and say “make Instagram from this”.</li><li>Claude files them in Library and brings back two or three possible stories, each line with its photo, and what is worth researching.</li><li>You pick one or name your own; Claude lays it out; you say ready here.</li></ol></div>';return;}
  const m=plan.material,chosen=plan.chosen;
  body.innerHTML='<section class="igs-mat" aria-label="Material"><span class="igs-lab">Material</span><span>'+esc(m.transcripts.map(t=>t.title||'Transcript').join(', ')||'No transcript')+' · '+plan.lines.length+' lines · '+m.photos.length+' photos</span><div class="igs-thumbs">'+m.photos.map(p=>'<img src="'+esc(blob(p.sourceId))+'" alt="'+esc(p.caption||'Photo')+'" title="'+esc(p.caption||'')+'" loading="lazy">').join('')+'</div></section>'
   +stripHTML()+'<section aria-label="Possible stories"><h2>It could become</h2><p class="igs-dim">'+(chosen?(chosen.storyId?'You chose “'+esc(plan.stories.find(s=>s.id===chosen.storyId)?.title||'')+'”':'You named it: “'+esc(chosen.named)+'”')+(chosen.forWhom?', for '+esc(chosen.forWhom):'')+'.':'What Claude found in what was said. Pick one, or name it yourself.')+'</p><div class="igs-stories">'+plan.stories.map(storyCard).join('')+'</div>'
   +'<form class="igs-name" data-igs="name"><label><span class="igs-lab">Or name it yourself</span><input name="named" maxlength="400" placeholder="This is …" value="'+esc(chosen&&!chosen.storyId?chosen.named:'')+'" '+(isAdrian()?'':'disabled')+'></label><label><span class="igs-lab">For</span><input name="forWhom" maxlength="200" placeholder="Who it is for" value="'+esc(chosen?.forWhom||'')+'" '+(isAdrian()?'':'disabled')+'></label><button type="submit" '+(isAdrian()?'':'disabled title="Only Adrian names the dish"')+'>Name it</button></form></section>'
   +flagsHTML()+'<section aria-label="Made"><h2>Made</h2>'+madeHTML()+'</section>'
   +(plan.gaps.length?'<section aria-label="Research worth doing"><h2>Worth researching</h2><ul class="igs-gaps">'+plan.gaps.map(g=>'<li><p><b>'+esc(g.question)+'</b> <span class="igs-status">'+esc(STATUS[g.status])+'</span></p>'+(g.why?'<p class="igs-dim">'+esc(g.why)+'</p>':'')+(g.finding?'<p>'+esc(g.finding)+'</p>':'')+(g.sources.length?'<p class="igs-dim">'+g.sources.map(s=>s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title||s.url)+'</a>':esc(s.title)).join(' · ')+'</p>':'')+'</li>').join('')+'</ul></section>':'');
  count();
 }
 function count(){const t=$('[data-igs="caption"]'),c=$('[data-igs="count"]');if(!t||!c)return;const n=hashtags(t.value);c.textContent=t.value.length+' / 2200 · '+n+' of 5 hashtags';c.classList.toggle('bad',n>5);}

 /* ---------- actions (Adrian's) ---------- */
 const stamp=()=>({id:plan.id,operationId:crypto.randomUUID(),expectedRevision:plan.revision,expectedHash:plan.hash});
 async function act(path,body,done){if(busy)return;busy=true;note('Saving…');try{plan=await call(path,{method:'POST',body:JSON.stringify({...stamp(),...body})});note(done);render();}catch(e){note(e.status===409?'This changed somewhere else (Claude may have updated it). Reopen to see the newest.':e.message,true);}finally{busy=false;}}
 function onClick(e){
  const b=e.target.closest('[data-igs]');if(!b||b.disabled)return;const what=b.dataset.igs;
  if(what==='close')return close();
  if(what==='consent'){e.preventDefault();const id=plan?.publishHold?.parentStudyId||plan?.subject||'';close();if(id)void window.arConsentDesk?.open?.(id);return;}
  if(what==='choose')return act('/api/instagram/choose',{storyId:b.dataset.id,forWhom:dlg.querySelector('[name=forWhom]')?.value||''},'Chosen. Claude can lay it out now.');
  if(what==='format'){format=b.dataset.f;return render();}
  if(what==='moment')return momentDetail(b.dataset.id);
  if(what==='mark')return act('/api/instagram/plan',{coverage:[{momentId:b.dataset.id,status:b.dataset.s,why:b.dataset.s==='skipped'?'Skipped by you.':'Saved by you.'}]},b.dataset.s==='saved'?'Saved for later.':'Skipped on purpose.');
  if(what==='meant')return act('/api/instagram/meaning',{storyId:b.dataset.id,verdict:'right'},'Noted: that is what you meant.');
  if(what==='not-meant'){const form=dlg.querySelector('form[data-igs="meaning"][data-id="'+CSS.escape(b.dataset.id)+'"]');form.hidden=false;form.querySelector('textarea').focus();return;}
  if(what==='as-heard')return act('/api/instagram/confirm',{flagId:b.dataset.id,verdict:'as-heard'},'Confirmed as heard.');
  if(what==='ready')return act('/api/instagram/ready',{format,caption:$('[data-igs="caption"]').value},'Marked ready. Nothing was posted.');
 }
 async function load(planId){
  const subject=ctx.subject;
  if(!planId){plans=(await call('/api/instagram/plans'+(subject?'?subject='+encodeURIComponent(subject):''),{method:'GET'})).plans;planId=plans[0]?.id;}
  plan=planId?await call('/api/instagram/plan?id='+encodeURIComponent(planId),{method:'GET'}):null;
  const pick=$('.igs-pick');pick.hidden=plans.length<2;pick.innerHTML=plans.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===plan?.id?'selected':'')+'>'+esc(p.title||'Untitled')+'</option>').join('');
  $('.igs-title b').textContent=plan?.title||ctx.title||'Instagram';render();
 }
 function shell(){
  const d=document.createElement('dialog');d.className='igs';d.setAttribute('aria-label','Instagram');
  d.innerHTML='<div class="igs-bar"><span class="igs-title"><b></b> · Instagram</span><select class="igs-pick" aria-label="Other Instagram plans" hidden></select><button type="button" class="igs-quiet" data-igs="close">Close</button></div><div class="igs-note" role="status" hidden></div><div class="igs-body"></div>';
  d.addEventListener('click',onClick);
  d.addEventListener('input',e=>{if(e.target.matches('[data-igs="caption"]'))count();});
  d.addEventListener('change',e=>{if(e.target.matches('.igs-pick'))void load(e.target.value).catch(err=>note(err.message,true));});
  d.addEventListener('submit',e=>{const form=e.target;if(form.matches('[data-igs="meaning"]')){e.preventDefault();return act('/api/instagram/meaning',{storyId:form.dataset.id,verdict:'not-meant',words:form.words.value},'Kept, in your words. Claude will propose it again from them.');}if(form.matches('[data-igs="confirm"]')){e.preventDefault();return act('/api/instagram/confirm',{flagId:form.dataset.id,verdict:'corrected',correction:form.correction.value},'Corrected, in your words. The transcript itself is unchanged.');}if(!e.target.matches('[data-igs="name"]'))return;e.preventDefault();const f=new FormData(e.target);act('/api/instagram/choose',{storyId:null,named:String(f.get('named')||''),forWhom:String(f.get('forWhom')||'')},'Named. Claude can lay it out now.');});
  d.addEventListener('close',()=>{d.remove();if(dlg===d)dlg=null;opener?.focus?.();if(/^#instagram=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);});
  return d;
 }
 async function open({subject,title,planId}={}){
  if(dlg)close();opener=document.activeElement;ctx={subject:subject||'',title:title||''};
  dlg=shell();document.body.append(dlg);dlg.showModal();note('Opening…');
  try{await load(planId);note('');}catch(e){note(e.message,true);plan=null;render();}
 }
 function close(){if(dlg?.open)dlg.close();}

 /* ---------- entrances ---------- */
 // Media, Arrange and Outputs carry an Instagram button in their heading line, for the piece's project.
 const STAGES=new Set([8,9,12]);
 function decorate(){
  let p=null;try{p=typeof current==='function'?current():null;}catch{}
  const title=document.querySelector('#app .workspace>.c3-ws-title'),stage=p?.view==='record'?Number(p.viewedStage):0;
  const btn=title?.querySelector('[data-instagram-open]');
  if(!title||!STAGES.has(stage)){btn?.remove();return;}
  if(btn&&btn.dataset.instagramOpen===String(p.id||''))return;btn?.remove();
  const b=document.createElement('button');b.type='button';b.className='btn igs-open';b.dataset.instagramOpen=p.id||'';b.dataset.instagramTitle=p.name||'';b.textContent='Instagram';b.title='What this could become on Instagram';title.append(b);
 }
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}).observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-instagram-open]');if(!b||b.disabled)return;e.preventDefault();void open({subject:b.dataset.instagramOpen,title:b.dataset.instagramTitle});});
 // A link an agent or the Needs you list hands over: …/document-study/index.html?instagram=<plan id> (or #instagram=)
 const fromHash=()=>{const m=/^#instagram=([a-f0-9-]{36})$/i.exec(location.hash)||/[?&]instagram=([a-f0-9-]{36})(?:&|$)/i.exec(location.search);if(m)void open({planId:m[1]});};
 window.addEventListener('hashchange',fromHash);if(document.readyState==='complete')setTimeout(fromHash,800);else window.addEventListener('load',()=>setTimeout(fromHash,800));
 window.arInstagram={open,close,state:()=>plan&&JSON.parse(JSON.stringify(plan))};
})();
