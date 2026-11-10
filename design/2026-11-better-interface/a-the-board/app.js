/* Direction A, "The board": today's frame kept (top bar, left rail), with the rail turned into a path,
   Home turned into a desk of subject cards, and the Subject board made the centre of each subject. */
(function(){
const {esc,icon,subject:SUB}=K;
const tile=(s,n=4)=>{const t=[];s.photos.slice(0,s.pieces.length?n-2:n).forEach(p=>t.push(K.pic(p,'Photograph')));
 if(s.pieces.includes('page'))t.push(s.id==='oda'?K.page():K.pageDone());if(s.pieces.includes('slides'))t.push(s.id==='oda'?K.slide(0):`<div class="sl words"><span><i>One</i><b>Unglazed, on purpose</b></span></div>`);return t.join('');};
const steps=st=>`<span class="a-steps" aria-hidden="true">${[0,1,2,3].map(i=>`<i class="${i<st?'done':i===st?'now':''}"></i>`).join('')}</span>`;
const stageWord=s=>s.stage<0?'New':K.stages[s.stage].name;

function top(S,inSubject){const name=S.view==='new-subject'?S.newName:SUB.name;
 return `<header class="a-top"><button class="a-back" data-act="go:${S.view==='write'||S.view==='focus'?'subject':'home'}" aria-label="Back">${icon('back')}</button>
 <button class="a-subject" data-act="go:${inSubject?'subject':'home'}"><i></i><span>${inSubject?esc(name):'All subjects'}</span>${icon('down')}</button>
 <button class="a-find" data-act="noop">${icon('search')}<span>Find a subject or a tool</span><kbd>⌘K</kbd></button><span class="sp"></span>
 ${S.answer?'':`<button class="btn ghost a-needs" data-act="go:${inSubject?'subject':'home'}"><i></i>Needs you · 1</button>`}
 <button class="btn ghost a-hide" data-act="capture:${inSubject?'subject':'home'}">${icon('plus')}Capture</button>
 <button class="btn ghost" data-act="theme" aria-label="Switch theme">${icon('sun')}</button></header>`;}

function rail(S,inSubject,cur){
 const open=S.ui.stage||(S.view==='new-subject'?'gather':'make');
 const status=S.view==='new-subject'?['Start here','','','']:['10 sources','Direction set','Article, Carousel','Nothing sent yet'];
 const st=S.view==='new-subject'?0:2;
 const path=!inSubject?`<p class="a-rail-h">Subjects</p>${K.subjects.map(s=>`<button class="a-nav sub" data-act="go:${s.go||'subject'}">${steps(s.stage)}<span>${esc(s.name)}</span></button>`).join('')}`
 :`<p class="a-rail-h">${esc(S.view==='new-subject'?S.newName:SUB.name)}</p><button class="a-nav${cur==='board'?' on':''}" data-act="go:${S.view==='new-subject'?'new-subject':'subject'}">${icon('grid')}Subject board</button>
 <ol class="a-path">${K.stages.map((g,i)=>`<li class="${i<st?'done':i===st?'now':''}${open===g.id?' open':''}"><button class="a-stage" data-act="ui:stage:${g.id}"><i></i><b>${g.name}</b><small>${status[i]}</small></button>
 ${open===g.id?`<div class="a-secs">${g.sections.map(x=>`<button class="a-nav${cur===x?' on':''}" data-act="${x==='Write'?'go:write':'noop'}">${x}${x==='Write'&&K.pending()&&S.view!=='new-subject'?`<em>${K.pending()}</em>`:''}</button>`).join('')}</div>`:''}</li>`).join('')}</ol>`;
 return `<nav class="a-rail" aria-label="Places"><button class="a-nav${cur==='Home'?' on':''}" data-act="go:home">${icon('home')}Home</button><button class="a-nav" data-act="noop">${icon('library')}Library</button><hr>${path}</nav>`;}

function phonebar(S,inSubject){return `<nav class="a-phone" aria-label="Places"><button data-act="go:home"${S.view==='home'?' aria-current="page"':''}>${icon('home')}Home</button><button data-act="go:subject"${S.view==='subject'?' aria-current="page"':''}>${icon('grid')}Subject</button><button class="cap" data-act="capture:${inSubject?'subject':'home'}" aria-label="Capture">${icon('plus')}</button><button data-act="go:write"${S.view==='write'?' aria-current="page"':''}>${icon('pen')}Write</button><button data-act="go:home">${icon('ask')}Needs you${S.answer?'':'<em>1</em>'}</button></nav>`;}

function question(S,where){const q=K.question;
 if(S.answer){const o=q.options.find(x=>x.id===S.answer);return `<div class="a-q answered">${icon('check')}<span>Answered: <b>${esc(o.label)}</b>. Claude carries on with that.</span><button class="btn" data-act="answer-undo">${icon('undo')}Undo</button></div>`;}
 return `<section class="a-q"><p class="a-q-h">${icon('ask')}<b>Needs you</b><span>${esc(q.who)} asks${where?' · '+esc(SUB.name):''} · ${esc(q.about)}</span></p><p class="a-q-t">${esc(q.text)}</p>
 <div class="a-q-o">${q.options.map(o=>`<button class="btn lg" data-act="answer:${o.id}"><span>${esc(o.label)}</span>${o.hint?`<small>${esc(o.hint)}</small>`:''}</button>`).join('')}</div><p class="a-q-f">${esc(q.fallback)}</p></section>`;}

function home(S){const [first]=K.subjects;
 return `<main class="a-main a-home"><div class="a-head"><div><h1>Home</h1><p>Tuesday 10 Nov 2026</p></div><div class="a-new">${S.newForm?`<form class="a-newform"><label for="new-subject-name">Subject name</label><input class="field" id="new-subject-name" value="${esc(S.newName)}"><button class="btn pri" type="submit">Create subject</button><button class="btn ghost" type="button" data-act="new-form:close">Cancel</button></form>`:`<button class="btn lg" data-act="new-form">${icon('plus')}New subject</button>`}</div></div>
 ${question(S,true)}
 <section class="a-pick"><div class="a-pick-t"><p class="a-eye">Pick up where you left off</p><h2>${esc(first.name)}</h2><blockquote>${esc(first.line)}<i></i></blockquote><p class="a-meta">Article · saved today, 13:52${K.pending()?` · <span class="a-chip">${K.pending()} proposals waiting</span>`:''}</p><div class="a-row"><button class="btn pri lg" data-act="go:write">Continue writing${icon('right')}</button><button class="btn lg" data-act="go:subject">Open the subject</button></div></div>
 <button class="a-pick-v" data-act="go:subject" aria-label="Open the subject"><span class="a-strip">${K.photos.map(([k,l])=>K.pic(k,l)).join('')}</span><span class="a-film">${K.slides()}</span></button></section>
 <div class="a-sub-h"><h2>Subjects <span>${K.subjects.length}</span></h2><button class="a-find small" data-act="noop">${icon('search')}<span>Filter subjects</span></button></div>
 <div class="a-cards">${K.subjects.map(s=>s.stage<0?`<article class="a-card empty"><button class="a-card-open" data-act="go:new-subject"><span class="a-card-v"><i></i><i></i><i></i></span><h3>${esc(s.name)}</h3><p>${esc(s.line)}</p></button><div class="a-card-f"><span>${steps(-1)}New</span><button class="btn" data-act="go:new-subject">Add material${icon('right')}</button></div></article>`
  :`<article class="a-card"><button class="a-card-open" data-act="go:${s.go?'subject':'subject'}"><span class="a-card-v">${tile(s)}</span><h3>${esc(s.name)}</h3><p>${esc(s.line)}</p></button><div class="a-card-f"><span>${steps(s.stage)}${stageWord(s)} · ${esc(s.stands.split(' · ')[0])}</span><button class="btn" data-act="go:${s.go||'subject'}">${esc(s.next)}${icon('right')}</button></div></article>`).join('')}
 <article class="a-card pub"><button class="a-card-open" data-act="noop"><span class="a-card-v">${K.pic(K.published.cover,'Photograph')}</span><h3>${esc(K.published.name)}</h3><p>${esc(K.published.when)}</p></button></article></div>
 <p class="a-quiet">Today Claude prepared 2 proposals and asked 1 question in ${esc(SUB.name)}. Nothing else changed. <button data-act="noop">Details</button></p></main>`;}

function origins(S){const rec=K.sources[0];
 return `<section class="a-col" data-col="origins"><div class="a-col-h"><h2>Origins <span>${S.attached?11:10} sources</span></h2><button class="btn" data-act="capture:subject">${icon('plus')}Add material</button></div>
 <article class="a-rec"><p class="a-kind">${icon('mic')}Recording · 42 min · 2 speakers</p><h3>${esc(rec.name)}</h3><div class="a-play"><button class="a-playb" data-act="noop" aria-label="Play">${icon('play')}</button>${K.wave(4,56,.34)}<span>14:27</span></div><p class="speech">“Straw breathes. The dew comes through.”<small>Mrs. Oda, 14:27</small></p><button class="a-link" data-act="noop">Open in Source${icon('chev')}</button></article>
 <ul class="a-notes">${K.sources.slice(1).map(n=>`<li><button data-act="noop">${icon('note')}<span><b>${esc(n.name)}</b><small>${esc(n.meta)}</small></span></button></li>`).join('')}
 ${S.attached?`<li class="new"><button data-act="noop">${icon('mic')}<span><b>${esc(K.loose.name)}</b><small>Attached just now.</small></span></button><button class="btn" data-act="attach:undo">${icon('undo')}Undo</button></li>`:''}</ul>
 <div class="a-photos">${K.photos.map(([k,l])=>`<button data-act="noop" title="${esc(l)}">${K.pic(k,l)}</button>`).join('')}</div><p class="a-cap">6 photographs · <button data-act="noop">Open in Media</button></p>
 ${S.attached?'':`<div class="a-loose"><span>${icon('mic')}<b>${esc(K.loose.name)}</b><small>${esc(K.loose.meta)}</small></span><button class="btn" data-act="attach">Use in this subject</button></div>`}</section>`;}
function understanding(S){
 return `<section class="a-col" data-col="understanding"><div class="a-col-h"><h2>Understanding</h2><button class="btn" data-act="noop">${icon('plus')}Add a thought</button></div>
 ${question(S)}
 <article class="a-dir"><p class="a-kind">Your direction</p><blockquote>${esc(K.direction)}</blockquote><button class="a-link" data-act="noop">Open Direction${icon('chev')}</button></article>
 <article class="a-learn"><p class="a-kind">What was learned</p><ul>${K.findings.map(f=>`<li><p>${esc(f.text)}</p><small><b class="${f.kind==='Her words'?'hers':''}">${f.kind}</b>${esc(f.from)}</small></li>`).join('')}</ul><button class="a-link" data-act="noop">Open Research${icon('chev')}</button></article></section>`;}
function pieces(S){const n=K.pending();
 return `<section class="a-col" data-col="pieces"><div class="a-col-h"><h2>Pieces <span>2 of 3 started</span></h2><button class="btn" data-act="noop">${icon('plus')}New piece</button></div>
 <article class="a-piece"><button class="a-piece-v" data-act="go:write" aria-label="Open the writing">${K.page()}</button><div><p class="a-kind">Article · half written</p><h3>${esc(K.article.title)}</h3><p class="a-meta">${SUB.words} words · saved ${SUB.saved}</p>${n?`<p><span class="a-chip">${icon('spark')}${n} proposal${n>1?'s':''} waiting for you</span></p>`:''}<p class="a-meta">Still to write: ${K.article.todo.join(' · ')}</p><div class="a-row"><button class="btn pri" data-act="go:write">Write</button><button class="btn" data-act="noop">Read</button><button class="btn" data-act="noop">Check</button></div></div></article>
 <article class="a-piece car"><p class="a-kind">Carousel · 5 slides · made from the writing on 9 Nov</p><div class="a-film big">${K.slides()}</div><div class="a-row"><button class="btn" data-act="noop">Arrange</button><button class="btn" data-act="noop">See as the audience</button><span class="a-meta">The words follow the Article.</span></div></article>
 <article class="a-piece none"><div class="a-frame">${icon('film')}</div><div><p class="a-kind">Video · not started</p><p class="a-meta">Making video is not connected yet. You can still write its script.</p><div class="a-row"><button class="btn" data-act="noop">Start the script</button></div></div></article>
 <p class="a-deliver"><b>Deliver</b> Nothing has gone out yet. <button data-act="noop">Audience</button><button data-act="noop">Share</button><button data-act="noop">Outputs</button></p></section>`;}

function board(S){const n=K.pending(),tab=S.ui.tab||'pieces';
 return `<main class="a-main a-board" data-tab="${tab}"><div class="a-head"><div><h1>${esc(SUB.name)}</h1><p>${esc(K.subjects[0].has)} · 2 pieces under way</p></div><div class="a-row"><button class="btn ghost" data-act="noop" aria-label="Rename, pin or archive this subject">${icon('dots')}</button><button class="btn pri lg" data-act="go:write">${n?`Next: decide ${n} proposal${n>1?'s':''}`:'Next: continue writing'}${icon('right')}</button></div></div>
 <div class="a-ptabs seg" role="tablist">${[['pieces','Pieces'],['origins','Origins'],['understanding','Understanding']].map(([k,l])=>`<button data-act="ui:tab:${k}" aria-pressed="${tab===k}">${l}</button>`).join('')}</div>
 <div class="a-cols">${origins(S)}${understanding(S)}${pieces(S)}</div></main>`;}

function fresh(S){
 return `<main class="a-main a-board fresh"><div class="a-head"><div><h1>${esc(S.newName)}</h1><p>A new subject, made just now. Nothing has been added yet.</p></div><button class="btn ghost" data-act="noop" aria-label="Rename or archive">${icon('dots')}</button></div>
 <section class="a-first"><p class="a-eye">First step</p><h2>Bring in what you have, or start with words.</h2><div class="a-row"><button class="btn pri lg" data-act="capture:subject">${icon('plus')}Add material</button><button class="btn lg" data-act="go:write">${icon('pen')}Start writing</button></div><p class="a-meta">A recording, a note, a link or photographs. Each one shows here under its own name.</p></section>
 <div class="a-cols"><section class="a-col"><div class="a-col-h"><h2>Origins</h2></div><div class="a-ghost"><i class="g-rec"></i><i class="g-row"></i><i class="g-row"></i><span class="g-ph"><i></i><i></i><i></i></span><p>Recordings, notes and photographs you add appear here as themselves.</p></div></section>
 <section class="a-col"><div class="a-col-h"><h2>Understanding</h2></div><div class="a-ghost"><i class="g-q"></i><i class="g-row"></i><i class="g-row"></i><p>Your direction and what is learned from the material fill this column as you go.</p></div></section>
 <section class="a-col"><div class="a-col-h"><h2>Pieces</h2></div><div class="a-ghost"><span class="g-pieces"><i class="g-pg"></i><i class="g-sl"></i><i class="g-sl"></i><i class="g-sl"></i></span><p>The Article, and any Carousel or Video made from it, appear here as they will look.</p></div></section></div></main>`;}

function proposal(S,id){const p=K.props[id],st=S.props[id];
 if(st==='accepted')return `<p class="a-after">${icon('check')}${id==='p1'?'Changed to her exact words.':'Added to your writing.'} <button data-act="prop:${id}:undo">Undo</button></p>`;
 if(st==='rejected')return `<p class="a-after">Proposal put away. <button data-act="prop:${id}:undo">Undo</button></p>`;
 return `<aside class="a-prop" data-prop="${id}"><p class="a-prop-h">${icon('spark')}<b>Claude proposes</b><span>${esc(p.kind)} · ${esc(p.why)}</span></p><p class="a-prop-t">${esc(p.text)}</p><div class="a-row"><button class="btn pri" data-act="prop:${id}:accepted">${id==='p1'?'Use her words':'Add to my writing'}</button><button class="btn" data-act="noop">Edit first</button><button class="btn ghost" data-act="prop:${id}:rejected">Not me</button></div></aside>`;}
function page(S,plain){const a=K.article;
 return `<article class="a-page"><h1>${esc(a.title)}</h1>${a.body.map(b=>{
  if(b.t==='h')return `<h2>${esc(b.text)}</h2>`;
  let h=`<p>${esc(b.text)}`;
  if(b.prop){const st=S.props[b.prop];h+=st==='accepted'?esc(K.props[b.prop].text):`<span class="${st==='pending'&&!plain?'a-mark':''}">${esc(b.tail)}</span>`;}
  h+='</p>';if(b.prop&&!plain)h+=proposal(S,b.prop);
  if(b.after){const st=S.props[b.after];if(st==='accepted')h+=`<p>${esc(K.props[b.after].text)}</p>`;if(!plain)h+=proposal(S,b.after);}
  return h;}).join('')}${plain?'<p class="a-caret"><i></i></p>':`<div class="a-todo"><p>Still to write</p>${a.todo.map(t=>`<button data-act="noop">${esc(t)}</button>`).join('')}</div>`}</article>`;}
function sourcePane(S){const live=id=>S.props[id]==='pending';
 return `<aside class="a-src"><div class="a-src-h"><h2>Sources <span>${S.attached?11:10}</span></h2><button class="btn ghost" data-act="ui:src:closed" aria-label="Close sources">${icon('x')}</button></div>
 <ul class="a-src-l"><li class="on"><button data-act="noop">${icon('mic')}Kirihara garden walk</button></li><li><button data-act="noop">${icon('note')}3 notes</button></li><li><button data-act="noop">${icon('photo')}6 photographs</button></li></ul>
 <div class="a-play"><button class="a-playb" data-act="noop" aria-label="Play">${icon('play')}</button>${K.wave(4,44,.34)}<span>14:27 / 42:10</span></div>
 <ol class="a-tr">${K.transcript.map((l,i)=>`${i===3?'<li class="gap">five minutes on</li>':''}<li class="${l.link&&live(l.link)?'hot':''}${l.who==='You'?' you':''}"><small>${l.t} · ${esc(l.who)}</small><p class="speech">${esc(l.text)}</p></li>`).join('')}</ol>
 <p class="a-meta">Recording · transcript read on 8 Nov. The same list shows in Source and Research.</p></aside>`;}
function write(S){const focus=S.view==='focus',n=K.pending(),src=S.ui.src||'auto';
 if(focus)return `<div class="a-focus"><header><span>${esc(SUB.name)} · Article</span><button class="btn ghost" data-act="go:write">Leave focus</button></header>${page(S,true)}<footer>Saved ${SUB.saved}${n?` · ${n} proposals waiting outside focus`:''}</footer></div>`;
 return `${top(S,true)}<div class="a-shell">${rail(S,true,'Write')}<main class="a-main a-write" data-src="${src}">
 <div class="a-bar"><div class="a-tabs" role="tablist"><button aria-current="page" data-act="noop">Article</button><button data-act="noop">Carousel</button><button data-act="noop">Video</button><button data-act="noop" aria-label="New piece">${icon('plus')}</button></div><div class="seg"><button aria-pressed="true" data-act="noop">Edit</button><button aria-pressed="false" data-act="noop">Read</button></div><span class="sp"></span>
 <button class="btn${src==='closed'?' ghost':''}" data-act="src" data-srcbtn>${icon('side')}Sources</button>${n?`<span class="a-chip">${icon('spark')}${n} waiting</span>`:''}<button class="btn ghost" data-act="noop">Check</button><button class="btn ghost" data-act="go:focus" data-focusbtn aria-label="Focus">${icon('focus')}<span>Focus</span></button></div>
 <div class="a-desk">${page(S)}${sourcePane(S)}</div>
 <footer class="a-status"><span>${esc(SUB.name)} › Article › Write</span><span>Saved ${SUB.saved} · ${SUB.words+(S.props.p2==='accepted'?34:0)} words</span></footer></main></div>${phonebar(S,true)}`;}

K.start({title:'Direction A, The board',render(S){
 if(S.view==='write'||S.view==='focus')return write(S);
 const inSub=S.view!=='home';
 return `${top(S,inSub)}<div class="a-shell">${rail(S,inSub,S.view==='home'?'Home':'board')}${S.view==='home'?home(S):S.view==='subject'?board(S):fresh(S)}</div>${phonebar(S,inSub)}`;}});
})();
