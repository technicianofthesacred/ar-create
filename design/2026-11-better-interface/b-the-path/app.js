/* Direction B, "The path": no sidebar. Every subject is a line with four stations (Gather, Develop, Make, Deliver).
   Home lays the lines side by side like a timetable; a subject is its line turned upright, with the work at each station. */
(function(){
const {esc,icon,subject:SUB}=K;
const extra={
 oda:{develop:K.direction,make:()=>K.page()+K.slide(0)+K.slide(2),deliver:''},
 potter:{develop:'He will not explain it. Let the cup do the explaining.',make:()=>K.pageDone()+`<div class="sl words"><span><i>One</i><b>Unglazed, on purpose</b></span></div>`,deliver:'Ready to show. Waiting for your yes.'},
 springs:{develop:'Five findings. No direction written yet.',make:null,deliver:''},
 market:{develop:'',make:null,deliver:''},winter:{develop:'',make:null,deliver:''}};
const dots=st=>`<span class="b-dots" aria-hidden="true">${[0,1,2,3].map(i=>`<i class="${i<st?'done':i===st?'now':''}"></i>`).join('')}</span>`;

function top(S){const inSub=S.view!=='home',name=S.view==='new-subject'?S.newName:SUB.name;
 return `<header class="b-top"><button class="b-mark" data-act="go:home" aria-label="Home"><i></i><span>Home</span></button>${inSub?`<span class="b-sl">/</span><button class="b-crumb" data-act="go:${S.view==='new-subject'?'new-subject':'subject'}"><span>${esc(name)}</span>${icon('down')}</button>`:`<button class="b-lib" data-act="noop">Library</button>`}
 <span class="sp"></span><button class="btn ghost b-wide" data-act="noop">${icon('search')}Find<kbd>⌘K</kbd></button>${S.answer?'':`<button class="btn ghost b-wide b-needs" data-act="go:home"><i></i>Needs you · 1</button>`}<button class="btn ghost b-wide" data-act="capture:${inSub?'subject':'home'}">${icon('plus')}Capture</button><button class="btn ghost" data-act="theme" aria-label="Switch theme">${icon('sun')}</button></header>`;}
function phonebar(S){const inSub=S.view!=='home';return `<nav class="b-phone" aria-label="Places"><button data-act="go:home"${S.view==='home'?' aria-current="page"':''}>${icon('home')}Subjects</button><button class="cap" data-act="capture:${inSub?'subject':'home'}">${icon('plus')}Capture</button><button data-act="go:home">${icon('ask')}Needs you${S.answer?'':'<em>1</em>'}</button></nav>`;}

function question(S,where){const q=K.question;
 if(S.answer){const o=q.options.find(x=>x.id===S.answer);return `<div class="b-q answered">${icon('check')}<span>You answered: <b>${esc(o.label)}</b>.</span><button class="btn" data-act="answer-undo">${icon('undo')}Undo</button></div>`;}
 return `<section class="b-q"><div class="b-q-l"><p class="b-label warm">${icon('ask')}Needs you</p><p class="b-q-who">${esc(q.who)} asks${where?`, in ${esc(SUB.name)}`:''}</p></div><div class="b-q-r"><p class="b-q-t">${esc(q.text)}</p><div class="b-q-o">${q.options.map(o=>`<button class="btn lg" data-act="answer:${o.id}">${esc(o.label)}</button>`).join('')}</div><p class="b-q-f">${esc(q.fallback)}</p></div></section>`;}

function home(S){
 const row=s=>{const x=extra[s.id],st=s.stage,cell=(i,inner)=>`<div class="b-st ${i<st?'done':i===st?'now':''}${i<=st?' reached':''}"><i></i>${i<=st?inner:''}</div>`;
  if(st<0)return `<article class="b-line new"><div class="b-who"><h3><button data-act="go:new-subject">${esc(s.name)}</button></h3><p>${esc(s.line)}</p><button class="btn" data-act="go:new-subject">${esc(s.next)}${icon('right')}</button></div>${[0,1,2,3].map(i=>`<div class="b-st"><i></i>${i===0?'<span class="b-hole">First step: add material</span>':''}</div>`).join('')}</article>`;
  return `<article class="b-line"><div class="b-who"><h3><button data-act="go:subject">${esc(s.name)}</button></h3><p class="b-mini">${dots(st)}${K.stages[st].name} · ${esc(s.stands.split(' · ')[0])}</p><p>${esc(s.line)}</p><div class="b-thumbs b-mini">${s.photos.slice(0,3).map(p=>K.pic(p,'Photograph')).join('')}${x.make?x.make():''}</div><div class="b-row"><button class="btn${s.id==='oda'?' pri':''}" data-act="go:${s.go||'subject'}">${esc(s.next)}${icon('right')}</button>${s.waiting?`<span class="b-wait">${esc(s.waiting)}</span>`:''}</div></div>
  ${cell(0,`<span class="b-thumbs">${s.photos.slice(0,3).map(p=>K.pic(p,'Photograph')).join('')}</span><small>${esc(s.has)}</small>`)}
  ${cell(1,`<p>${esc(x.develop)}</p>`)}
  ${cell(2,x.make?`<span class="b-thumbs tall">${x.make()}</span><small>${esc(s.stands)}</small>`:'')}
  ${cell(3,`<p>${esc(x.deliver)}</p>`)}</article>`;};
 return `<main class="b-main b-home"><div class="b-head"><div><h1>Your subjects</h1><p>Five under way. ${S.answer?'Nothing is waiting for you.':'One question is waiting for you.'}</p></div><div>${S.newForm?`<form class="b-newform"><label for="new-subject-name">Subject name</label><input class="field" id="new-subject-name" value="${esc(S.newName)}"><button class="btn pri" type="submit">Create subject</button><button class="btn ghost" type="button" data-act="new-form:close">Cancel</button></form>`:`<button class="btn lg" data-act="new-form">${icon('plus')}New subject</button>`}</div></div>
 ${question(S,true)}
 <section class="b-table"><div class="b-line b-cols" aria-hidden="true"><div></div>${K.stages.map(g=>`<div><b>${g.name}</b><span>${g.says}</span></div>`).join('')}</div>${K.subjects.map(row).join('')}</section>
 <p class="b-pub"><b>Published</b><span>${K.pic(K.published.cover,'Photograph')}</span>${esc(K.published.name)} · 28 Oct 2026 <button data-act="noop">Open in Outputs</button></p>
 <p class="b-quiet">Today Claude prepared 2 proposals and asked 1 question. <button data-act="noop">Details</button></p></main>`;}

function spine(S,fresh){const st=fresh?0:2,n=K.pending(),status=fresh?['Start here','','','']:[`${S.attached?11:10} sources`,'Direction written','Article half written','Nothing sent yet'];
 return `<aside class="b-spine"><h1>${esc(fresh?S.newName:SUB.name)}</h1><p class="b-meta">${fresh?'New today':'Saved '+SUB.saved}</p>
 <ol>${K.stages.map((g,i)=>`<li class="${fresh?(i===0?'now':''):(i<st?'done':i===st?'now':'')}"><i></i><a href="#${S.view}" data-act="noop"><b>${g.name}</b><small>${status[i]}</small></a><p>${g.sections.map(x=>`<button data-act="${x==='Write'?'go:write':'noop'}">${x}</button>`).join('')}</p></li>`).join('')}</ol>
 <div class="b-next"><p class="b-label">Next</p>${fresh?`<button class="btn pri lg" data-act="capture:subject">${icon('plus')}Add material</button>`:`<button class="btn pri lg" data-act="go:write">${n?`Decide ${n} proposal${n>1?'s':''}`:'Continue writing'}${icon('right')}</button>`}</div></aside>`;}
const band=(g,inner,cls='',action='')=>`<section class="b-band ${cls}" id="st-${g.id}"><header><h2>${g.name}</h2><p>${g.says}</p><span class="sp"></span>${action}</header>${inner}</section>`;

function subject(S){const n=K.pending(),G=K.stages;
 const gather=`<div class="b-g"><article class="b-rec"><p class="b-label">${icon('mic')}Recording · 42 min · 2 speakers</p><h3>Kirihara garden walk</h3><div class="b-play"><button class="b-playb" data-act="noop" aria-label="Play">${icon('play')}</button>${K.wave(4,90,.34)}<span>14:27</span></div>
 <ol class="b-talk">${K.transcript.slice(3,6).map(l=>`<li class="${l.who==='You'?'you':''}"><small>${l.t} · ${esc(l.who)}</small><p class="speech">${esc(l.text)}</p></li>`).join('')}</ol><button class="b-link" data-act="noop">Read the whole transcript in Source${icon('chev')}</button></article>
 <ul class="b-notes">${K.sources.slice(1).map(n=>`<li><button data-act="noop"><p class="b-label">${icon('note')}Your note</p><b>${esc(n.name)}</b><span>${esc(n.meta)}</span></button></li>`).join('')}</ul></div>
 <div class="b-contact">${K.photos.map(([k,l])=>`<figure>${K.pic(k,l)}<figcaption>${esc(l)}</figcaption></figure>`).join('')}</div>
 ${S.attached?`<p class="b-loose ok">${icon('check')}<span><b>${esc(K.loose.name)}</b> is now a source of this subject.</span><button class="btn" data-act="attach:undo">${icon('undo')}Undo</button></p>`:`<p class="b-loose">${icon('mic')}<span><b>${esc(K.loose.name)}</b> · ${esc(K.loose.meta)}</span><button class="btn" data-act="attach">Use in this subject</button></p>`}`;
 const develop=`${question(S)}<div class="b-d"><article><p class="b-label">Your direction</p><blockquote>${esc(K.direction)}</blockquote><button class="b-link" data-act="noop">Open Direction${icon('chev')}</button></article>
 <article><p class="b-label">What was learned</p><ul class="b-learn">${K.findings.map(f=>`<li><p>${esc(f.text)}</p><small><b class="${f.kind==='Her words'?'hers':''}">${f.kind}</b>${esc(f.from)}</small></li>`).join('')}</ul><button class="b-link" data-act="noop">Open Research${icon('chev')}</button></article></div>`;
 const a=K.article,make=`<div class="b-m"><article class="b-sheet"><button data-act="go:write" aria-label="Open the writing"><p class="b-label">Article · half written · ${SUB.words} words</p><h3>${esc(a.title)}</h3><p>${esc(a.body[0].text)}</p><p>${esc(a.body[1].text)}</p></button><footer>${n?`<span class="b-chip">${icon('spark')}${n} proposal${n>1?'s':''} waiting</span>`:''}<span class="sp"></span><button class="btn" data-act="noop">Read</button><button class="btn" data-act="noop">Check</button><button class="btn pri" data-act="go:write">Continue writing${icon('right')}</button></footer></article>
 <div class="b-side"><article><p class="b-label">Carousel · 5 slides · made from the writing on 9 Nov</p><div class="b-film">${K.slides()}<button class="b-add" data-act="noop" aria-label="Add a slide">${icon('plus')}</button></div><div class="b-row"><button class="btn" data-act="noop">Arrange</button><button class="btn" data-act="noop">Media</button></div></article>
 <article class="b-none"><span class="b-frame">${icon('film')}</span><div><p class="b-label">Video · not started</p><p class="b-meta">Making video is not connected yet. You can still write its script.</p><button class="btn" data-act="noop">Start the script</button></div></article>
 <button class="btn" data-act="noop">${icon('plus')}New piece</button></div></div>`;
 const deliver=`<div class="b-v"><article><span class="b-phoneframe">${K.slide(0)}</span><div><p class="b-label">Audience</p><p>See the Carousel and the Article the way a reader will.</p><button class="btn" data-act="noop">Open Audience</button></div></article>
 <article><div><p class="b-label">Share</p><p>Before it goes out, send Mrs. Oda her own words to check.</p><button class="btn" data-act="noop">Open Share</button></div></article>
 <article><div><p class="b-label">Outputs</p><p>Nothing has gone out yet.</p><p class="b-meta">Posting is not connected. Slides can be exported.</p><button class="btn" data-act="noop">Open Outputs</button></div></article></div>`;
 return `<div class="b-subject">${spine(S)}<main class="b-main">${stepper(2)}${band(G[0],gather,'done',`<button class="btn" data-act="capture:subject">${icon('plus')}Add material</button>`)}${band(G[1],develop,'done',`<button class="btn" data-act="noop">${icon('plus')}Add a thought</button>`)}${band(G[2],make,'now',`<span class="b-here">You are here</span>`)}${band(G[3],deliver,'')}</main></div>`;}
const stepper=st=>`<nav class="b-stepper" aria-label="Stages">${K.stages.map((g,i)=>`<a href="#st-${g.id}" data-act="noop" class="${i<st?'done':i===st?'now':''}"><i></i>${g.name}</a>`).join('')}</nav>`;

function fresh(S){const G=K.stages;
 const first=`<div class="b-first"><h3>Start with what you have.</h3><div class="b-ways"><button data-act="capture:subject">${icon('mic')}<b>A recording</b><span>Record now, or add one you have.</span></button><button data-act="capture:subject">${icon('note')}<b>A note</b><span>A thought, a page, a link.</span></button><button data-act="capture:subject">${icon('photo')}<b>Photographs</b><span>From this device or the Library.</span></button></div><p class="b-meta">Or begin with words: <button class="b-link" data-act="go:write">Start writing${icon('chev')}</button></p></div>`;
 const later=t=>`<p class="b-later">${t}</p>`;
 return `<div class="b-subject fresh">${spine(S,true)}<main class="b-main">${stepper(0)}${band(G[0],first,'now',`<span class="b-here">First step</span>`)}${band(G[1],later('Research and your direction appear here once there is material to learn from.'))}${band(G[2],later('The Article, and any Carousel or Video made from it, appear here as they will look.'))}${band(G[3],later('What your audience sees, who it is shared with, and what has gone out.'))}</main></div>`;}

function note(S,id,num){const p=K.props[id],st=S.props[id];
 if(st==='accepted')return `<aside class="b-note quiet">${icon('check')}<span>${id==='p1'?'Changed to her exact words.':'Added to your writing.'}</span><button data-act="prop:${id}:undo">Undo</button></aside>`;
 if(st==='rejected')return `<aside class="b-note quiet"><span>Proposal put away.</span><button data-act="prop:${id}:undo">Undo</button></aside>`;
 return `<aside class="b-note"><p class="b-label warm"><sup>${num}</sup>${icon('spark')}Claude proposes</p><p class="b-note-t">${id==='p1'?esc(p.text):'A new paragraph for “The straw”, drafted from her answer. It is shown in place, in the page.'}</p><p class="b-note-w">${esc(p.why)}</p><div class="b-row"><button class="btn pri" data-act="prop:${id}:accepted">${id==='p1'?'Use her words':'Add to my writing'}</button><button class="btn" data-act="noop">Edit</button><button class="btn ghost" data-act="prop:${id}:rejected">Not me</button></div></aside>`;}
function ask(S){const q=K.question;if(S.answer){const o=q.options.find(x=>x.id===S.answer);return `<aside class="b-note quiet">${icon('check')}<span>You answered: ${esc(o.label)}.</span><button data-act="answer-undo">Undo</button></aside>`;}
 return `<aside class="b-note"><p class="b-label warm"><sup>2</sup>${icon('ask')}Claude asks</p><p class="b-note-t">Her grandmother’s straw, or her mother-in-law’s? The recording and your note differ.</p><div class="b-col">${q.options.map(o=>`<button class="btn" data-act="answer:${o.id}">${esc(o.label)}</button>`).join('')}</div></aside>`;}
function page(S,plain){const a=K.article,inl=h=>plain?'':`<div class="b-inline">${h}</div>`;
 const text=a.body.map(b=>{
  if(b.t==='h')return `<h2>${esc(b.text)}${!plain&&!S.answer?'<sup>2</sup>':''}</h2>${inl(ask(S))}`;
  let h=`<p>${esc(b.text)}`;
  if(b.prop){const st=S.props[b.prop];h+=st==='accepted'?esc(K.props[b.prop].text):`<span class="${st==='pending'&&!plain?'b-hl':''}">${esc(b.tail)}</span>${st==='pending'&&!plain?'<sup>1</sup>':''}`;}
  h+=`</p>${b.prop?inl(note(S,b.prop,1)):''}`;
  if(b.after){const st=S.props[b.after];if(st==='accepted')h+=`<p>${esc(K.props[b.after].text)}</p>`;else if(st==='pending'&&!plain)h+=`<p class="b-ghost"><em>Proposed<sup>3</sup></em>${esc(K.props[b.after].text)}</p>`;h+=inl(note(S,b.after,3));}
  return h;}).join('');
 const waiting=K.pending()+(S.answer?0:1);
 return `<article class="b-page${plain?' plain':''}"><div class="b-text"><h1>${esc(a.title)}</h1>${text}${plain?'<p class="b-caret"><i></i></p>':`<div class="b-todo"><p class="b-label">Still to write</p>${a.todo.map(t=>`<button data-act="noop">${esc(t)}</button>`).join('')}</div>`}</div>
 ${plain?'':`<div class="b-margin"><p class="b-label">${waiting?`Waiting for you · ${waiting}`:'Nothing is waiting'}</p>${note(S,'p1',1)}${ask(S)}${note(S,'p2',3)}</div>`}</article>`;}
function sources(S){const live=id=>S.props[id]==='pending';
 return `<aside class="b-src"><div class="b-src-h"><h2>Sources</h2><span>${S.attached?11:10}, one list for this subject</span><button class="btn ghost" data-act="ui:src:closed" aria-label="Close sources">${icon('x')}</button></div>
 <ul class="b-src-l"><li class="on"><button data-act="noop">${icon('mic')}<span><b>Kirihara garden walk</b><small>Recording · 42 min</small></span></button></li>${K.sources.slice(1).map(n=>`<li><button data-act="noop">${icon('note')}<span><b>${esc(n.name)}</b><small>Your note</small></span></button></li>`).join('')}<li class="ph"><button data-act="noop">${K.photos.map(([k,l])=>K.pic(k,l)).join('')}</button></li></ul>
 <div class="b-play"><button class="b-playb" data-act="noop" aria-label="Play">${icon('play')}</button>${K.wave(4,40,.34)}<span>14:27</span></div>
 <ol class="b-talk">${K.transcript.map((l,i)=>`${i===3?'<li class="gap">five minutes on</li>':''}<li class="${l.link&&live(l.link)?'hot':''}${l.who==='You'?' you':''}"><small>${l.t} · ${esc(l.who)}</small><p class="speech">${esc(l.text)}</p></li>`).join('')}</ol></aside>`;}
function write(S){const focus=S.view==='focus',n=K.pending(),src=S.ui.src||'auto';
 if(focus)return `<div class="b-focus"><header><span>${esc(SUB.name)} / Article</span><button class="btn ghost" data-act="go:write">Leave focus</button></header>${page(S,true)}</div>`;
 return `${top(S)}<div class="b-bar"><button class="b-backto" data-act="go:subject">${icon('back')}<span>${dots(2)}Make</span></button><div class="b-tabs" role="tablist"><button aria-current="page" data-act="noop">Article</button><button data-act="noop">Carousel</button><button data-act="noop">Video</button><button data-act="noop" aria-label="New piece">${icon('plus')}</button></div><div class="seg"><button aria-pressed="true" data-act="noop">Edit</button><button aria-pressed="false" data-act="noop">Read</button></div><span class="sp"></span><span class="b-saved">Saved ${SUB.saved}</span>
 <button class="btn${src==='closed'?' ghost':''}" data-act="src" data-srcbtn>${icon('side')}Sources</button><button class="btn ghost" data-act="noop">Check</button><button class="btn ghost" data-act="go:focus" data-focusbtn aria-label="Focus">${icon('focus')}<span>Focus</span></button></div>
 <div class="b-write" data-src="${src}">${sources(S)}${page(S)}</div>${phonebar(S)}`;}

K.start({title:'Direction B, The path',render(S){
 if(S.view==='write'||S.view==='focus')return write(S);
 return `${top(S)}${S.view==='home'?home(S):S.view==='subject'?subject(S):fresh(S)}${phonebar(S)}`;}});
})();
