/* Direction C, "The work itself": no sidebar and no top bar. Subjects are covers, a subject page shows its pieces
   as large as they will look, and you open a thing to work on it. A floating dock carries the few controls. */
(function(){
const {esc,icon,subject:SUB}=K;
const segs=st=>`<span class="c-segs" aria-hidden="true">${[0,1,2,3].map(i=>`<i class="${i<st?'done':i===st?'now':''}"></i>`).join('')}</span>`;
const minis=s=>s.pieces.length?`<span class="c-minis">${s.id==='oda'?K.page()+K.slide(0)+K.slide(2):K.pageDone()+`<div class="sl words"><span><i>One</i><b>Unglazed, on purpose</b></span></div>`}</span>`:'';

function crumb(S){const inSub=S.view!=='home',name=S.view==='new-subject'?S.newName:SUB.name;
 return `<header class="c-crumb"><div class="c-glass"><button data-act="go:home" aria-label="Home"${inSub?'':' aria-current="page"'}>${icon('home')}${inSub?'':'<span>Home</span>'}</button>${inSub?`<i>/</i><button data-act="go:${S.view==='new-subject'?'new-subject':'subject'}"><b>${esc(name)}</b>${icon('down')}</button>${S.view==='write'?'<i class="c-w">/</i><span class="c-w">Article</span>':''}`:''}</div>
 <div class="c-glass"><button data-act="noop" aria-label="Find a subject or a tool">${icon('search')}<kbd>⌘K</kbd></button><button data-act="theme" aria-label="Switch theme">${icon('sun')}</button></div></header>`;}

function dock(S){const inSub=S.view!=='home',n=K.pending();
 if(S.view==='write'){const src=S.ui.src||'auto';return `<nav class="c-dock c-glass write" aria-label="Writing controls"><button class="btn ghost" data-act="go:subject" aria-label="Back to the subject">${icon('back')}</button><i></i>
 <div class="seg"><button aria-pressed="true" data-act="noop">Article</button><button aria-pressed="false" data-act="noop">Carousel</button><button aria-pressed="false" data-act="noop" class="c-w">Video</button><button aria-pressed="false" data-act="noop" aria-label="New piece" class="c-w">${icon('plus')}</button></div>
 <div class="seg c-w"><button aria-pressed="true" data-act="noop">Edit</button><button aria-pressed="false" data-act="noop">Read</button></div><i class="c-w"></i>
 <button class="btn${src==='closed'?' ghost':''}" data-act="src" data-srcbtn>${icon('side')}<span>Sources</span></button>${n?`<span class="c-count">${icon('spark')}${n}</span>`:''}<button class="btn ghost c-w" data-act="noop">Check</button><button class="btn ghost" data-act="go:focus" aria-label="Focus">${icon('focus')}<span class="c-w">Focus</span></button></nav>`;}
 return `<nav class="c-dock c-glass" aria-label="Places"><button class="btn ghost" data-act="go:home"${S.view==='home'?' aria-current="page"':''}>${icon('home')}<span>Home</span></button>${inSub?`<button class="btn ghost" data-act="ui:sheet:sections">${icon('grid')}<span>Sections</span></button>`:`<button class="btn ghost" data-act="noop">${icon('library')}<span>Library</span></button>`}
 <button class="btn pri cap" data-act="capture:${inSub?'subject':'home'}">${icon('plus')}<span>Capture</span></button>
 <button class="btn ghost" data-act="go:home">${icon('ask')}<span>Needs you</span>${S.answer?'':'<em>1</em>'}</button>${inSub?`<button class="btn ghost" data-act="go:write">${icon('pen')}<span>Write</span></button>`:`<button class="btn ghost" data-act="new-form">${icon('plus')}<span>New subject</span></button>`}</nav>`;}

function sections(S){if(S.ui.sheet!=='sections')return '';
 return `<div class="scrim" data-act="ui:sheet:sections"><div class="sheet c-sections" role="dialog" aria-label="Sections" data-stop><h3>Every section of ${esc(S.view==='new-subject'?S.newName:SUB.name)}</h3>${K.stages.map((g,i)=>`<div><p><b>${g.name}</b><span>${g.says}</span></p><div>${g.sections.map(x=>`<button class="btn" data-act="${x==='Write'?'go:write':'ui:sheet:sections'}">${x}</button>`).join('')}</div></div>`).join('')}</div></div>`;}

function question(S,where){const q=K.question;
 if(S.answer){const o=q.options.find(x=>x.id===S.answer);return `<div class="c-q answered">${icon('check')}<span>Answered: <b>${esc(o.label)}</b>.</span><button class="btn" data-act="answer-undo">${icon('undo')}Undo</button></div>`;}
 return `<section class="c-q"><span class="c-q-i">${icon('ask')}</span><div><p class="c-q-h"><b>${esc(q.who)} asks</b>${where?` about ${esc(SUB.name)}`:''}</p><p class="c-q-t">${esc(q.text)}</p><p class="c-q-f">${esc(q.fallback)}</p></div><div class="c-q-o">${q.options.map(o=>`<button class="btn lg" data-act="answer:${o.id}">${esc(o.label)}</button>`).join('')}</div></section>`;}

function home(S){const [first,...rest]=K.subjects,n=K.pending();
 const cover=s=>s.stage<0?`<article class="c-cover blank"><button data-act="go:new-subject"><span class="c-cover-top">${segs(-1)}New</span><span class="c-cover-b"><h3>${esc(s.name)}</h3><p>Nothing added yet.</p><span class="c-next">Add material${icon('right')}</span></span></button></article>`
  :`<article class="c-cover"><button data-act="go:${s.go||'subject'}">${K.photo(s.cover,'Photograph')}<span class="c-cover-top">${segs(s.stage)}${K.stages[s.stage].name}</span>${minis(s)}<span class="c-cover-b"><h3>${esc(s.name)}</h3><p>${esc(s.stands)}</p><span class="c-next">${esc(s.next)}${icon('right')}</span></span></button></article>`;
 return `<main class="c-main c-home">${question(S,true)}
 <section class="c-hero"><button class="c-hero-bg" data-act="go:subject" aria-label="Open the subject">${K.photo('shade','Straw shades at dawn')}</button><div class="c-hero-t"><p class="c-eye">Pick up where you left off · saved today, 13:52</p><h1>${esc(first.name)}</h1><blockquote>${esc(first.line)}<i></i></blockquote><div class="c-row"><button class="btn pri lg" data-act="go:write">Continue writing${icon('right')}</button><button class="btn lg c-onphoto" data-act="go:subject">Open the subject</button>${n?`<span class="c-onchip">${icon('spark')}${n} proposals waiting</span>`:''}</div></div>
 <button class="c-hero-p" data-act="go:subject" aria-label="Open the subject">${K.page()}${K.slides()}</button></section>
 <div class="c-wall-h"><h2>Subjects</h2><span>${K.subjects.length} under way · 1 published</span></div>
 <div class="c-wall">${rest.map(cover).join('')}<article class="c-cover pub"><button data-act="noop">${K.photo(K.published.cover,'Photograph')}<span class="c-cover-top">${icon('check')}Published</span><span class="c-cover-b"><h3>${esc(K.published.name)}</h3><p>28 Oct 2026</p></span></button></article>
 <article class="c-cover add"><button data-act="new-form">${icon('plus')}<span>New subject</span></button></article></div>
 <p class="c-quiet">Today Claude prepared 2 proposals and asked 1 question. <button data-act="noop">Details</button></p></main>`;}

function subject(S){const n=K.pending(),a=K.article;
 const hero=`<section class="c-shero">${K.photo('shade','Straw shades at dawn')}<div class="c-shero-t"><h1>${esc(SUB.name)}</h1><p>${esc(K.subjects[0].has)} · saved ${SUB.saved}</p></div>
 <div class="c-stages">${K.stages.map((g,i)=>`<button data-act="ui:sheet:sections" class="${i<2?'done':i===2?'now':''}"><i></i><b>${g.name}</b><span>${[`${S.attached?11:10} sources`,'Direction written','Article half written','Nothing sent yet'][i]}</span></button>`).join('')}<button class="btn pri lg" data-act="go:write">${n?`Next: decide ${n} proposal${n>1?'s':''}`:'Next: continue writing'}${icon('right')}</button></div></section>`;
 const pieces=`<section class="c-sec"><header><h2>Pieces</h2><span>as they look today</span><span class="sp"></span><button class="btn" data-act="noop">${icon('plus')}New piece</button></header>
 <article class="c-art"><button class="c-spread" data-act="go:write" aria-label="Open the writing">${K.page()}<div class="pg"><div><h6>Still to write</h6>${a.todo.map(t=>`<h6 class="todo">${esc(t)}</h6><u></u><u></u><u></u>`).join('')}</div></div></button>
 <div class="c-art-t"><p class="c-kind">Article · half written</p><h3>${esc(a.title)}</h3><p class="c-meta">${SUB.words} words · saved ${SUB.saved}</p>${n?`<p><span class="c-chip">${icon('spark')}${n} proposal${n>1?'s':''} waiting for you</span></p>`:''}<p class="c-lede">${esc(K.subjects[0].line)}</p><div class="c-row"><button class="btn pri lg" data-act="go:write">Write${icon('right')}</button><button class="btn lg" data-act="noop">Read</button><button class="btn lg" data-act="noop">Check</button></div></div></article>
 <article class="c-car"><div class="c-car-h"><p class="c-kind">Carousel · 5 slides · made from the writing on 9 Nov</p><span class="sp"></span><button class="btn" data-act="noop">Arrange</button><button class="btn" data-act="noop">See as the audience</button></div><div class="c-slides">${K.slides()}</div></article>
 <article class="c-vid"><span>${icon('film')}</span><p><b>Video · not started.</b> Making video is not connected yet. You can still write its script.</p><button class="btn" data-act="noop">Start the script</button></article></section>`;
 const material=`<section class="c-sec"><header><h2>Material</h2><span>${S.attached?11:10} sources, one list</span><span class="sp"></span><button class="btn" data-act="noop">Open Source</button><button class="btn" data-act="capture:subject">${icon('plus')}Add</button></header>
 <div class="c-tray"><button class="c-t rec" data-act="noop"><p class="c-kind">${icon('mic')}Recording · 42 min · 2 speakers</p><b>Kirihara garden walk</b>${K.wave(4,60,.34)}<span class="speech">“Straw breathes. The dew comes through.”</span></button>
 ${S.attached?`<div class="c-t note ok"><p class="c-kind">${icon('mic')}Voice note · just attached</p><b>${esc(K.loose.name)}</b><button class="btn" data-act="attach:undo">${icon('undo')}Undo</button></div>`:''}
 ${K.sources.slice(1).map(x=>`<button class="c-t note" data-act="noop"><p class="c-kind">${icon('note')}Your note</p><b>${esc(x.name)}</b><span>${esc(x.meta)}</span></button>`).join('')}
 ${K.photos.map(([k,l])=>`<button class="c-t ph" data-act="noop" title="${esc(l)}">${K.photo(k,l)}<span>${esc(l)}</span></button>`).join('')}
 ${S.attached?'':`<div class="c-t note loose"><p class="c-kind">${icon('mic')}Not in a subject yet</p><b>${esc(K.loose.name)}</b><span>0:48, from your phone today</span><button class="btn" data-act="attach">Use in this subject</button></div>`}</div></section>`;
 const und=`<section class="c-sec"><header><h2>Understanding</h2><span>what you want to say, and what was learned</span><span class="sp"></span><button class="btn" data-act="noop">${icon('plus')}Add a thought</button></header>
 <div class="c-und"><article><p class="c-kind">Your direction</p><blockquote>${esc(K.direction)}</blockquote><button class="c-link" data-act="noop">Open Direction${icon('chev')}</button></article>
 <ul>${K.findings.map(f=>`<li><p>${esc(f.text)}</p><small><b class="${f.kind==='Her words'?'hers':''}">${f.kind}</b>${esc(f.from)}</small></li>`).join('')}<li><button class="c-link" data-act="noop">Open Research${icon('chev')}</button></li></ul></div></section>
 <p class="c-quiet"><b>Deliver</b> Nothing has gone out yet. Posting is not connected; slides can be exported. <button data-act="noop">Audience</button> <button data-act="noop">Share</button> <button data-act="noop">Outputs</button></p>`;
 return `<main class="c-main c-subject">${hero}${question(S)}${pieces}${material}${und}</main>`;}

function fresh(S){
 return `<main class="c-main c-subject fresh"><section class="c-shero blank"><div class="c-shero-t"><h1>${esc(S.newName)}</h1><p>New today. Nothing has been added yet.</p></div>
 <div class="c-stages">${K.stages.map((g,i)=>`<button data-act="ui:sheet:sections" class="${i===0?'now':''}"><i></i><b>${g.name}</b><span>${i===0?'Start here':''}</span></button>`).join('')}</div></section>
 <section class="c-firsts"><article><p class="c-eye">First step</p><h2>Add material</h2><p>Speak, photograph or write. Each thing you add appears here as itself, under its own name.</p><div class="c-ways"><button data-act="capture:subject">${icon('mic')}Speak</button><button data-act="capture:subject">${icon('photo')}Photograph</button><button data-act="capture:subject">${icon('note')}A note or a file</button></div></article>
 <article class="alt"><p class="c-eye">Or</p><h2>Start writing</h2><p>Open a blank page for the Article. Material can come later.</p><button class="c-blankpg" data-act="go:write" aria-label="Start writing"><span class="pg"><div><i></i></div></span></button><button class="btn lg" data-act="go:write">${icon('pen')}Start writing</button></article></section>
 <section class="c-sec ghost"><header><h2>Pieces</h2><span>appear here as they will look</span></header><div class="c-ghosts"><i class="pgs"></i><i></i><i></i><i></i><i></i><i></i></div></section></main>`;}

function ctl(S,id){const p=K.props[id];return `<span class="c-ctl"><span>${icon('spark')}Claude · ${id==='p1'?'her exact words, 09:12':'a new paragraph, from the recording at 14:27'}</span><button class="btn pri" data-act="prop:${id}:accepted">${id==='p1'?'Use':'Add to my writing'}</button><button class="btn" data-act="noop">Edit</button><button class="btn ghost" data-act="prop:${id}:rejected">Not me</button></span>`;}
const after=(S,id)=>S.props[id]==='accepted'?`<p class="c-after">${icon('check')}${id==='p1'?'Changed to her exact words.':'Added to your writing.'} <button data-act="prop:${id}:undo">Undo</button></p>`:S.props[id]==='rejected'?`<p class="c-after">Proposal put away. <button data-act="prop:${id}:undo">Undo</button></p>`:'';
function page(S,plain){const a=K.article,q=K.question;
 return `<article class="c-page"><h1>${esc(a.title)}</h1>${a.body.map(b=>{
  if(b.t==='h')return `<h2>${esc(b.text)}</h2>${plain?'':S.answer?`<p class="c-after">${icon('check')}You answered: ${esc(q.options.find(x=>x.id===S.answer).label)}. <button data-act="answer-undo">Undo</button></p>`:`<aside class="c-ask"><p>${icon('ask')}<b>Claude asks</b> Her grandmother’s straw, or her mother-in-law’s? The recording and your note differ.</p><div class="c-row">${q.options.map(o=>`<button class="btn" data-act="answer:${o.id}">${esc(o.label)}</button>`).join('')}</div></aside>`}`;
  let h=`<p>${esc(b.text)}`;
  if(b.prop){const st=S.props[b.prop];h+=st==='accepted'?esc(K.props[b.prop].text):st==='pending'&&!plain?`<del>${esc(b.tail)}</del> <ins>${esc(K.props[b.prop].text)}</ins>${ctl(S,b.prop)}`:esc(b.tail);}
  h+='</p>';if(b.prop&&!plain)h+=after(S,b.prop);
  if(b.after){const st=S.props[b.after];if(st==='accepted')h+=`<p>${esc(K.props[b.after].text)}</p>`;else if(st==='pending'&&!plain)h+=`<p class="c-ins"><ins>${esc(K.props[b.after].text)}</ins>${ctl(S,b.after)}</p>`;if(!plain)h+=after(S,b.after);}
  return h;}).join('')}${plain?'<p class="c-caret"><i></i></p>':`<div class="c-todo"><p>Still to write</p>${a.todo.map(t=>`<button data-act="noop">${esc(t)}</button>`).join('')}</div>`}</article>`;}
function sources(S){const live=id=>S.props[id]==='pending';
 return `<aside class="c-src"><div class="c-src-h"><h2>Sources</h2><span>${S.attached?11:10} in this subject</span><button class="btn ghost" data-act="ui:src:closed" aria-label="Close sources">${icon('x')}</button></div>
 <div class="c-src-l"><button class="on" data-act="noop">${icon('mic')}Kirihara garden walk</button><button data-act="noop">${icon('note')}3 notes</button><button data-act="noop">${icon('photo')}6 photographs</button></div>
 <div class="c-play"><button data-act="noop" aria-label="Play">${icon('play')}</button>${K.wave(4,46,.34)}<span>14:27 / 42:10</span></div>
 <ol class="c-talk">${K.transcript.map((l,i)=>`${i===3?'<li class="gap">five minutes on</li>':''}<li class="${l.link&&live(l.link)?'hot':''}${l.who==='You'?' you':''}"><small>${l.t} · ${esc(l.who)}</small><p class="speech">${esc(l.text)}</p></li>`).join('')}</ol></aside>`;}
function write(S){const src=S.ui.src||'auto';
 if(S.view==='focus')return `<div class="c-focus">${page(S,true)}<button class="c-leave c-glass" data-act="go:write">${icon('focus')}Leave focus · saved ${SUB.saved}</button></div>`;
 return `${crumb(S)}<div class="c-write" data-src="${src}">${page(S)}${sources(S)}</div>${dock(S)}`;}

K.start({title:'Direction C, The work itself',render(S){
 if(S.view==='write'||S.view==='focus')return write(S);
 return `${crumb(S)}${S.view==='home'?home(S):S.view==='subject'?subject(S):fresh(S)}${dock(S)}${sections(S)}${K.newSheet()}`;}});
})();
