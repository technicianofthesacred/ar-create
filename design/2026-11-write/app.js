/* AR Create version two: Write, Read and Check for a piece. A static mock-up, second pass, invented content only.
   Every screen and state is reachable by an address fragment (#write, #check ...). No network requests. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- icons ---------- */
const IC={
 back:'<path d="M15 18l-6-6 6-6"/>',right:'<path d="M9 6l6 6-6 6"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z"/>',
 focus:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',check:'<path d="M5 12l5 5 9-10"/>',play:'<path d="M8 5v14l11-7z"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
 rec:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',note:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>',
 photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 8"/>',
 topic:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4M9 11h4"/>',quote:'<path d="M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6"/>',
 ask:'<path d="M4 5h16v11H9l-5 4z"/>',warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
 history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
 cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/>',stop:'<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
 restore:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
 refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/>',layout:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 13h16"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'};
const icon=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||''}</svg>`;

/* ---------- the screens ---------- */
const SCREENS=[
 ['start','Nothing written yet'],['write','Write'],['select','Words selected'],['proposal-edit','Edit a proposal first'],
 ['quote','A quote and its source'],['speak','Speaking'],['speak-done','Spoken words in'],['history','Earlier versions'],['focus','Focus'],
 ['read','Read'],['read-working','Read, Claude working'],['check','Check'],['finish','Finished'],
 ['carousel','Carousel'],['carousel-post','Carousel post text'],
 ['conflict','Two versions'],['recovered','Writing recovered'],['save-failed','Save failed'],['states','Control states']];
const S={screen:'write',theme:'dark',ui:{},noteText:''};
const fresh=()=>({p1:'wait',p2:'wait',q:null,conf:null,rec:null,save:'failed',fin:false,para:null,fd:'f1',src:'walk',srcOpen:false,split:false,ver:null,mine:false,kept:false,speak:null,res:{},rewrite:false,slide:3,lay:false,ph:false,c4:'wait',b4:'B2'});

/* ---------- a word-level comparison: which of his words go, which come ---------- */
function diff(a,b){
 const A=a?a.split(/\s+/).filter(Boolean):[],B=b?b.split(/\s+/).filter(Boolean):[];
 const n=A.length,m=B.length,L=Array.from({length:n+1},()=>new Array(m+1).fill(0));
 const N=w=>w.toLowerCase().replace(/[^a-z0-9’'-]/g,'').replace(/’/g,"'"),eq=(x,y)=>N(x)===N(y);
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=eq(A[i],B[j])?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
 const out=[];let i=0,j=0;
 while(i<n&&j<m){if(eq(A[i],B[j])){out.push(['=',A[i],B[j]]);i++;j++;}else if(L[i+1][j]>=L[i][j+1])out.push(['-',A[i++]]);else out.push(['+',B[j++]]);}
 while(i<n)out.push(['-',A[i++]]);while(j<m)out.push(['+',B[j++]]);
 const join=(keep,mark)=>{let h='',run=[];const flush=()=>{if(run.length){h+=mark(run.join(' '))+' ';run=[];}};
  for(const [op,w,w2] of out){if(op==='=')(flush(),h+=esc(keep==='+'?w2:w)+' ');else if(op===keep)run.push(esc(w));else flush();}flush();return h.trim();};
 const cut=out.filter(x=>x[0]==='-').length,add=out.filter(x=>x[0]==='+').length;
 return {before:join('-',w=>`<del class="cut">${w}</del>`),after:join('+',w=>`<ins class="add">${w}</ins>`),cut,add};
}
const words=n=>n===1?'1 word':n+' words';
function countLine(d,onlyAdds){
 if(onlyAdds||!d.cut)return `Adds ${words(d.add)}. Takes away none of yours.`;
 if(!d.add)return `Takes away ${words(d.cut)} of yours. Adds nothing.`;
 return `Takes away ${words(d.cut)} of yours, adds ${words(d.add)}.`;
}

/* ---------- invented content: "Straw over the rows" (Tea), Article "Twenty days of shade" ---------- */
const SUBJ='Straw over the rows';
const LINES=[['03:40','Mrs. Oda','First you watch. Then you can help.'],['09:12','Mrs. Oda','Twenty days. Twenty-two if the nights are cold. You don’t count, you look at the leaf.'],['09:31','You','What do you look for?'],['09:36','Mrs. Oda','It goes dark, like wet stone. And soft. When it feels like an earlobe, it is ready.'],['gap','five minutes on'],['14:20','You','Netting would be so much less work. Why still the straw?'],['14:32','Mrs. Oda','Straw breathes. The net only takes the light away.'],['16:05','Mrs. Oda','The old straw I leave where it falls. By July you cannot find it.']];
const line=t=>LINES.find(l=>l[0]===t);
const PROPS={
 p1:{title:'Use her exact words',by:'Claude, from the garden walk recording at 09:12',heard:'09:12',
  before:'Twenty days, she says, sometimes twenty-two if the nights stay cold.',
  after:'“Twenty days,” she says. “Twenty-two if the nights are cold. You don’t count, you look at the leaf.”',ctx:'The leaf goes dark and soft.'},
 p2:{title:'A new paragraph after “Straw breathes”',by:'Claude, from the recording at 16:05 and your note On the train home',heard:'16:05',
  before:'',after:'She lets the old straw fall where it lies. By July it has gone back into the soil, and the rows are greener for it.',ctx:'“The net only takes the light away.”'}};
const PARTS=[['The mill','The leaves go to the steamer the same afternoon'],['What I tasted','The bench, the second infusion'],['Leaving','What is still unknown']];
const qm=(at)=>`<button class="qm${S.ui.q===at?' on':''}" data-act="qm" data-at="${at}" aria-label="Where this was said: the recording at ${at}" title="The recording at ${at}"></button>`;
const excerpt=at=>{const l=line(at);return S.ui.q===at?`<div class="excerpt"><q>${esc(l[2])}</q><span>${l[1]}, Kirihara garden walk, ${at}</span><button class="iconb" data-act="note" data-note="Picture only: plays the recording from ${at}." aria-label="Play from ${at}" title="Play from ${at}">${icon('play')}</button><button class="iconb" data-act="qm" data-at="${at}" aria-label="Close" title="Close">${icon('x')}</button></div>`:'';};

function para(id){
 const u=S.ui,s=S.screen;
 const inW=['write','select','proposal-edit','quote','speak','speak-done'].includes(s);
 if(id==='p1'){
  const apr=s==='check'?`<span class="${u.fd==='f1'?'hl':'flag'}">${u.res.f1==='change'?'early May':'the last week of April'}</span>`:'the last week of April';
  let net='the black netting came';
  if(s==='select')net=u.kept?'<span class="kept">the black netting came</span>':'<span class="sel">the black netting came</span>';
  if(s==='check'&&!u.res.f2)net=`<span class="${u.fd==='f2'?'hl':'flag'}">${net}</span>`;
  return `The straw goes up in ${apr}. Mrs. Oda does it the way it was done before ${net}: bamboo poles, reed screens, then rice straw scattered by hand until <span class="kept">the rows sit in a green dusk</span>.`;}
 if(id==='p2')return `I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,”${qm('03:40')} she said. So I watched the light change under the screens for most of an hour.`;
 if(id==='p3'){
  let first='What the shade does is simple to say and slow to do.';
  if(s==='check'&&!u.res.f3)first=`<span class="${u.fd==='f3'?'hl':'flag'}">${first}</span>`;
  if(s==='check'&&u.res.f3==='rewrite')first='Shade is easy to explain and slow to give.';
  const taken=s==='history'?(!u.ver||u.ver==='v1'):(u.p1==='taken'||!inW);
  const end=taken?`“Twenty days,” she says. “Twenty-two if the nights are cold. You don’t count, you look at the leaf.”${qm('09:12')}`:`<span class="${inW&&u.p1==='wait'?'anchor':''}">Twenty days, she says, sometimes twenty-two if the nights stay cold.</span>`;
  return `${first} The bush, starved of sun, holds on to what would have turned bitter. The leaf goes dark and soft. ${end}`;}
 if(id==='p4'){
  if(s==='history'&&u.ver==='v3')return `<ins class="add">Netting is cheaper and one person can hang it in a morning. I asked why she still bothers with straw.</ins>`;
  return `Netting is cheaper and one person can hang it in a morning. I asked why she still bothers with straw${s==='recovered'&&u.rec!=='left'?', and whether her son will':''}.`;}
 if(id==='p5'){
  const caret=s==='write'?`<span class="caret"></span><button class="ghost atcaret" data-act="speak" title="Speak here: your words go in at the cursor">${icon('mic')}Speak</button>`:'';
  return `She laughed. “Straw breathes,” she said. “The net only takes the light away.”${qm('14:32')}${caret}`;}
 if(id==='p6')return `<span class="${s==='write'?'':''}">She lets the old straw fall where it lies. By July it has gone back into the soil, and the rows are greener for it.</span>`;
 return '';
}
const PIDS={p2:'03:40',p3:'09:12',p5:'14:32'};
function P(id,cls=''){return `<p id="${id}" class="${cls}">${para(id)}</p>${PIDS[id]?excerpt(PIDS[id]):''}`;}

/* ---------- the top bar (version two's shell) ---------- */
function top(){
 const chips=[[SUBJ,'#5d6b43'],['The first cup','#9b7a52'],['Circle of twelve','#6d7a7c'],['Small paintings of doors','#a0705a'],['The road north','#7b7f5a']];
 return `<header class="top"><button class="logo" data-act="note" data-note="Picture only: goes Home." aria-label="Home"><i></i></button>
 <nav class="places" aria-label="Places">${['Home','Research','Looks','Library'].map(p=>`<button class="place" data-act="note" data-note="Picture only: opens ${p}.">${p}</button>`).join('')}</nav>
 <div class="desk" aria-label="On your desk">${chips.map(([c,col],i)=>`<button class="chip" style="--c:${col}"${i===0?' aria-current="page"':''} data-act="note" data-note="${i===0?'You are in this subject.':'Picture only: opens '+esc(c)+' where you left it.'}" title="${esc(c)}"><i></i><span>${esc(c)}</span></button>`).join('')}<button class="ghost more" data-act="note" data-note="Picture only: lists the subjects on your desk that do not fit here." hidden>+0</button></div>
 <span class="grow"></span>
 <button class="ghost wide" data-act="note" data-note="Picture only: find any subject, piece or source." aria-label="Find">${icon('search')}<kbd>⌘K</kbd></button>
 <button class="ghost wide needs" data-act="note" data-note="Picture only: the questions only you can answer."><i></i>Needs you · 4</button>
 <button class="ghost wide" data-act="note" data-note="Picture only: add a recording, photograph or thought to this subject.">${icon('plus')}Capture</button>
 <button class="iconb" data-act="theme" aria-label="Light or dark" title="Light or dark">${icon('sun')}</button>
 <button class="ghost adv" data-act="note" data-note="Picture only: the existing workspace, at this piece and section.">Advanced</button></header>`;
}
/* the desk keeps whole chips: the ones that do not fit go into "+n" */
function fitDesk(){
 const d=$('.desk');if(!d||getComputedStyle(d).display==='none')return;
 const chips=[...d.querySelectorAll('.chip')],more=d.querySelector('.more');
 chips.forEach(c=>c.hidden=false);more.hidden=true;
 let hidden=0;
 for(let i=chips.length-1;i>0&&d.scrollWidth>d.clientWidth+1;i--){chips[i].hidden=true;hidden++;more.hidden=false;more.textContent='+'+hidden;}
}

/* ---------- the piece bar: one line, fixed height; the status has one fixed place ---------- */
function stat(cls,ic,long,short,extra=''){return `<span class="st ${cls}" title="${esc(long)}">${ic}<span class="long">${long}</span><span class="short">${short||long}</span></span>${extra}`;}
function status(){
 const u=S.ui,s=S.screen;
 if(s==='start')return stat('',icon('cloud'),'Nothing written yet','Empty');
 if(s==='save-failed'){
  if(u.save==='trying')return stat('warn','<span class="spin"></span>','Trying to save','Trying',`<button class="btn" disabled>Try again</button>`);
  if(u.save==='saved')return stat('',icon('check'),'Saved 14:10','Saved 14:10');
  return stat('bad',icon('cloud'),u.save==='failed2'?'Still not saved, tried 14:09':'Not saved since 14:06','Not saved',`<button class="btn" data-act="retry">Try again</button>`);}
 if(s==='recovered'&&!u.rec)return stat('warn',icon('warn'),'Words kept on this device','Words kept here');
 if(s==='conflict'&&!u.conf)return stat('warn',icon('warn'),'Two versions of one paragraph','Two versions');
 if(s==='read-working')return stat('','<span class="dot"></span>','Claude is checking quotes against the recording, 3 of 5','Checking quotes, 3 of 5',`<button class="iconb" data-act="note" data-note="Picture only: stops Claude. Nothing on the page changes either way." aria-label="Stop Claude" title="Stop Claude">${icon('stop')}</button>`);
 if(s==='speak'&&u.speak!=='done')return stat('','<span class="dot live"></span>','Listening to you','Listening');
 if(s==='speak-done'||u.speak==='done')return stat('',icon('check'),'Saved 14:08 · 14 spoken words in','Saved 14:08',`<button class="iconb" data-act="undo" aria-label="Undo the spoken words" title="Undo the spoken words">${icon('undo')}</button>`);
 return stat('',icon('check'),'Saved 14:06','Saved 14:06');
}
function pbar(){
 const s=S.screen,car=s==='carousel'||s==='carousel-post';
 const mode=s==='read'||s==='read-working'?'read':s==='check'||s==='finish'?'check':'write';
 const pieces=`<nav class="tabs" aria-label="Pieces in this subject"><button class="tab"${!car?' aria-current="page"':''} data-go="write">Article</button><button class="tab"${car?' aria-current="page"':''} data-go="carousel">Carousel</button></nav>`;
 const cnote=k=>car?` data-act="note" data-note="Picture only: ${k}"`:'';
 const modes=`<nav class="tabs" aria-label="Way of looking"><button class="tab"${mode==='write'?' aria-current="page"':''} data-go="${car?'carousel':'write'}">Write</button><button class="tab"${mode==='read'?' aria-current="page"':''} data-go="read"${cnote('Read shows the Carousel one slide at a time, at phone size, as it will be seen.')}>Read</button><button class="tab"${mode==='check'?' aria-current="page"':''} data-go="check"${cnote('Check for a Carousel: quotes against the recording, every Chinese character, words that fit, the seal only on the close.')}>Check<span class="n">${s==='finish'||s==='start'||car?'':'4'}</span></button></nav>`;
 if(s==='focus')return `<div class="pbar"><button class="back" data-go="write">${icon('back')}<span>Leave focus</span></button><div class="status">${status()}</div><span class="tools"><button class="ghost" data-act="speak" title="Speak: your words go in at the cursor">${icon('mic')}<span class="lbl">Speak</span></button></span><div class="line2" hidden></div></div>`;
 const w=mode==='write';
 const tools=`${w?`<button class="ghost" data-act="undo" title="Undo your last change (⌘Z)"${s==='start'?' disabled':''}>${icon('undo')}<span class="lbl">Undo</span></button><button class="ghost" aria-pressed="${s==='history'}" data-go="${s==='history'?'write':'history'}" title="Earlier versions">${icon('history')}<span class="lbl">Versions</span></button>`:''}${mode!=='read'?`<button class="ghost" aria-pressed="${S.ui.srcOpen}" data-act="srcToggle" title="Sources">${icon('book')}<span class="lbl">Sources</span></button>`:''}${w&&!car?`<button class="ghost" data-go="focus" title="Focus: only the page">${icon('focus')}<span class="lbl">Focus</span></button><button class="ghost" data-act="speak" aria-pressed="${s==='speak'&&S.ui.speak!=='done'}" title="Speak: your words go in at the cursor">${icon('mic')}<span class="lbl">Speak</span></button>`:''}`;
 return `<div class="pbar">
 <button class="back" data-act="note" data-note="Picture only: back to ${SUBJ}, with this piece's step open where you left it." title="Back to ${SUBJ}">${icon('back')}<span>${SUBJ}</span></button>
 <span class="wide" style="display:contents">${pieces}<span class="sep"></span>${modes}</span>
 <div class="status">${status()}</div>
 <span class="tools">${tools}</span>
 <div class="line2" hidden>${pieces}${modes}</div></div>`;
}
function phonebar(){
 const s=S.screen,u=S.ui;
 if(['read','read-working','check','finish','states','focus'].includes(s))return '';
 if(s==='select'&&!u.kept)return `<nav class="pphone selbar" aria-label="Selected words">${selActs(true)}</nav>`;
 const live=s==='speak'&&u.speak!=='done';
 return `<nav class="pphone" aria-label="Writing"><button class="ghost" data-act="undo"${s==='start'?' disabled':''}>${icon('undo')}<span>Undo</span></button><button class="ghost" data-act="speak" aria-pressed="${live}">${live?'<span class="live-dot"></span><span>Stop</span>':icon('mic')+'<span>Speak</span>'}</button><button class="ghost" aria-pressed="${u.split}" data-act="split">${icon('book')}<span>Sources</span></button></nav>`;
}

/* ---------- sources ---------- */
const WAVE=[5,9,14,8,12,18,10,6,13,20,9,15,7,11,17,12,6,10,16,8,13,19,9,7,12,15,10,6,14,9,11,16,7,12,18,10,8,13,6,11];
const wave=at=>`<span class="wave" aria-hidden="true">${WAVE.map((h,i)=>`<i class="${i<at?'':'fut'}" style="height:${h+4}px"></i>`).join('')}</span>`;
function transcript(){
 const on=S.ui.q||(S.screen==='write'&&S.ui.p1==='wait'?'09:12':S.screen==='quote'?'09:36':'');
 return `<ol class="tr">${LINES.map(l=>l[0]==='gap'?`<li class="gap">${l[1]}</li>`:`<li class="${l[1]==='You'?'you ':''}${l[0]===on?'on':''}"><div class="who"><span>${l[0]} · ${l[1]}</span><button class="iconb" data-act="note" data-note="Picture only: plays the recording from ${l[0]}." aria-label="Play from ${l[0]}" title="Play from ${l[0]}">${icon('play')}</button><button class="ghost" data-act="quote" data-at="${l[0]}" title="Put these exact words in your text at the cursor, in quote marks">${icon('quote')}Quote</button></div><p>${esc(l[2])}</p></li>`).join('')}</ol>`;
}
function sources(){
 const u=S.ui,open=u.src;
 const item=(id,ic,name,meta,body)=>`<div class="src${open===id?' open':''}"><button class="src-h" data-act="src" data-id="${id}" aria-expanded="${open===id}">${icon(ic)}<span><b>${name}</b><small>${meta}</small></span></button>${open===id?`<div class="src-body">${body}</div>`:''}</div>`;
 return `<aside class="col srccol" aria-label="Sources"><label class="field">${icon('search')}<input placeholder="Find in your sources" aria-label="Find in your sources"></label>
 ${item('walk','rec','Kirihara garden walk','Recording, 42 min · Mrs. Oda and you',`<div class="player"><button class="iconb" data-act="note" data-note="Picture only: plays the recording." aria-label="Play" title="Play">${icon('play')}</button>${wave(14)}<time>09:12</time></div>${transcript()}`)}
 ${item('memo','mic','Walking back','Your voice memo, 6 min',`<p class="note-txt">The straw goes up by hand, pole by pole, until the rows sit in a green dusk. I came to help and she handed me a cup. Netting is cheaper, one person can hang it in a morning. She still does straw. I don’t know if the straw matters to the tea or only to her.</p>`)}
 ${item('train','note','On the train home','Your note',`<p class="note-txt">She never looked at the clock once. Early May, she said, is when the straw used to go up when she was a girl. Ask about the mill.</p>`)}
 ${item('taste','note','Tasting, second infusion','Your note',`<p class="note-txt">Second infusion, colour of wet moss. Broth, then morning.</p>`)}
 ${item('photos','photo','Photographs','6, from the garden walk',`<div class="photos">${PHOTOS.map(g=>`<span class="ph" style="--pg:${g}"></span>`).join('')}</div>`)}
 ${item('topic','topic','Shading tea','Research topic · 12 findings',`<p class="says">Shade before picking raises the savoury taste and lowers the bitter. Straw, reed and netting are all used; straw is the oldest.</p>`)}
 </aside>`;
}
const PHOTOS=['linear-gradient(170deg,#62724a,#26301f)','linear-gradient(170deg,#9a8a6a,#3e3526)','linear-gradient(170deg,#455646,#1b241c)','linear-gradient(170deg,#7d6447,#2f2418)','linear-gradient(170deg,#a3b08a,#4b5a3a)','linear-gradient(170deg,#58533f,#1f1d16)'];

/* ---------- a proposal: what goes, what comes, in his words ---------- */
function proposal(id){
 const p=PROPS[id],st=S.ui[id],d=diff(p.before,p.after),adds=!p.before;
 if(st==='taken')return `<div class="item"><h3>${p.title}</h3><p class="done">${icon('check')}<span>Put in your text at 14:06.</span><button class="ghost" data-act="prop" data-id="${id}" data-v="wait">${icon('undo')}Undo</button></p></div>`;
 if(st==='left')return `<div class="item"><h3>${p.title}</h3><p class="done"><span>You kept your words. Claude will not propose this again.</span><button class="ghost" data-act="prop" data-id="${id}" data-v="wait">${icon('undo')}Undo</button></p></div>`;
 const heard=line(p.heard);
 return `<div class="item${id==='p1'?' on':''}"><div class="hd"><h3>${p.title}</h3><p class="by">${p.by}.<br>${countLine(d,adds)}</p></div>
 <div class="ba">${adds?`<div><p class="label">After your paragraph</p><p class="pr ctx">…${p.ctx}</p></div>`:`<div><p class="label">Your words now</p><p class="pr">${d.before}</p></div>`}<div><p class="label">${adds?'The new paragraph':'With this change'}</p><p class="pr">${d.after}</p></div></div>
 <p class="by">She said at ${heard[0]}: “${esc(heard[2])}”</p>
 <div class="acts"><button class="btn pri" data-act="prop" data-id="${id}" data-v="taken">Put it in my text</button>${id==='p1'?`<button class="btn" data-go="proposal-edit">Edit it first</button>`:`<button class="btn" data-act="note" data-note="Picture only: opens the new paragraph in your text to edit before it goes in (see Edit a proposal first).">Edit it first</button>`}<button class="ghost" data-act="prop" data-id="${id}" data-v="left">Keep my words</button></div></div>`;
}
function proposals(){
 const n=['p1','p2'].filter(k=>S.ui[k]==='wait').length;
 return `<p class="mg-h"><span>${n?`Proposals, ${n} waiting`:'Proposals'}</span></p>${proposal('p1')}${proposal('p2')}${n?'':'<p class="empty">No proposals waiting.</p>'}`;
}
function selActs(phone){
 const a=[['lock','keep',phone?'Keep exactly':'Keep these words exactly'],['ask','note:Picture only: asks Claude for another way to say these words. It comes back beside the paragraph as a proposal, with before and after.',phone?'Ask Claude':'Ask Claude for another way'],['note','note:Picture only: a note to yourself beside these words. Nobody else acts on it.',phone?'Note':'Add a note for myself']];
 return a.map(([ic,act,l])=>act.startsWith('note:')?`<button class="ghost" data-act="note" data-note="${esc(act.slice(5))}">${icon(ic)}<span>${l}</span></button>`:`<button class="ghost" data-act="${act}">${icon(ic)}<span>${l}</span></button>`).join('');
}

/* ---------- the article page ---------- */
function todo(){
 const s=S.screen;
 return `<div class="todo"><p class="label">Still to write</p><ol>${PARTS.filter(p=>!(['speak','speak-done'].includes(s)&&p[0]==='The mill')).map(([n,w])=>`<li><b>${n}</b><span>${w}</span><div class="row"><button class="ghost" data-act="note" data-note="Picture only: puts the cursor in ${n} so you can type." title="Type in ${n}">${icon('pen')}Type</button><button class="ghost" data-act="speak" title="Speak into ${n}">${icon('mic')}Speak</button></div></li>`).join('')}</ol></div>`;
}
function article(){
 const u=S.ui,s=S.screen,inW=['write','select','quote','speak','speak-done'].includes(s),done=s==='finish';
 let p2=P('p2');
 if(s==='conflict'&&!u.conf){
  const A='I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,” she said. So I watched the straw darken and the light go green for most of an hour.';
  const B='I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,” she said. So I watched the light change under the screens for most of an hour, and did not once think of helping.';
  const d=diff(B,A);
  p2=`<div class="two" id="p2"><div><p class="k"><span>Written on your phone, 14:10</span><span class="grow"></span><button class="btn" data-act="conf" data-v="phone">Keep this one</button></p><p>${d.after}</p></div><div><p class="k"><span>Written here, 14:12</span><span class="grow"></span><button class="btn" data-act="conf" data-v="here">Keep this one</button></p><p>${d.before.replace(/class="cut"/g,'class="add" style="text-decoration:none;color:inherit;background:var(--ins-bg)"').replace(/<del /g,'<ins ').replace(/<\/del>/g,'</ins>')}</p></div><div class="after"><button class="ghost" data-act="conf" data-v="both">Keep both, one after the other</button></div></div>`;}
 if(s==='conflict'&&u.conf){const t={phone:'So I watched the straw darken and the light go green for most of an hour.',here:'So I watched the light change under the screens for most of an hour, and did not once think of helping.',both:'So I watched the straw darken and the light go green for most of an hour. So I watched the light change under the screens for most of an hour, and did not once think of helping.'}[u.conf];
  p2=`<p id="p2">I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,”${qm('03:40')} she said. ${t}</p>${excerpt('03:40')}`;}
 let p3=P('p3');
 if(s==='proposal-edit')p3=`<div class="edit-in" id="p3"><p class="k">Claude’s words, open for you to change before they go in</p><p contenteditable="true" spellcheck="false">What the shade does is simple to say and slow to do. The bush, starved of sun, holds on to what would have turned bitter. The leaf goes dark and soft. “Twenty days,” she says. “Twenty-two<span class="caret"></span> if the nights are cold.” She doesn’t count. She looks at the leaf.</p><div class="row"><button class="btn pri" data-act="prop" data-id="p1" data-v="taken" data-then="write">Put it in my text</button><button class="ghost" data-go="write">Cancel</button></div></div>`;
 if(s==='check'&&u.rewrite)p3=`<div class="edit-in" id="p3"><p class="k">Rewrite Claude’s sentence in your own words</p><p contenteditable="true" spellcheck="false">Shade is easy to explain and slow to give.<span class="caret"></span> The bush, starved of sun, holds on to what would have turned bitter. The leaf goes dark and soft. “Twenty days,” she says. “Twenty-two if the nights are cold. You don’t count, you look at the leaf.”</p><div class="row"><button class="btn pri" data-act="res" data-id="f3" data-v="rewrite">Done</button><button class="ghost" data-act="rewrite" data-v="0">Cancel</button></div></div>`;
 if(s==='quote'&&u.quoted)p3=p3.replace('</p>',` “It goes dark, like wet stone. And soft.”${qm('09:36')}<span class="caret"></span></p>`);
 else if(s==='quote')p3=p3.replace('</p>','<span class="caret"></span></p>');
 const p4=P('p4',s==='recovered'&&!u.rec?'recovered':'');
 let mill='';
 if(s==='speak'||s==='speak-done'){
  const live=s==='speak'&&u.speak!=='done';
  mill=`<h2>The mill</h2><p>The leaves go to the steamer the same afternoon, ${live?'<span class="hearing">still cool from the shade. Her son runs the mill now</span><span class="caret"></span><button class="ghost atcaret live" data-act="speak" title="Stop listening (Esc)"><span class="live-dot"></span>Listening · Stop</button>':'still cool from the shade. Her son runs the mill now.<span class="caret"></span><button class="ghost atcaret" data-act="speak" title="Speak here">'+icon('mic')+'Speak</button>'}</p>`;}
 const rest=done?`<h2>The mill</h2><p>The leaves go to the steamer the same afternoon, still cool from the shade. Her son runs the mill now. He talks about the straw as if it were weather.</p><h2>What I tasted</h2><p>On the bench she poured the second infusion. It was the colour of wet moss and it tasted of nothing I could name at first, then of broth, then of the morning.</p><h2>Leaving</h2><p>I still do not know whether the straw matters to the tea or only to her. She would say that is the wrong question.</p>`:'';
 const inl=inW?`<div class="inline">${proposal('p1')}</div>`:'';
 const inl2=inW?`<div class="inline">${proposal('p2')}</div>`:'';
 return `<div class="text">${phoneMessage()}<h1>Twenty days of shade</h1>${P('p1')}${p2}${p3}${inl}<h2>The straw</h2>${p4}${P('p5')}${u.p2==='taken'||done?P('p6'):''}${inl2}${mill}${rest}${done?'':todo()}</div>`;
}
/* On a phone the margin cannot sit beside the page, so what it holds sits at the top of the page, in place. */
function phoneMessage(){
 const s=S.screen;let m='';
 if(['save-failed','recovered','conflict','history','finish','check'].includes(s))m=marginBody();
 return m?`<div class="phone-only"><div class="mg">${m}</div></div>`:'';
}

/* ---------- margins ---------- */
const VERS=[['Today'],['cur','Current version','14:06 · You','You'],['v1','Her exact words put in, in Opening','14:06 · You, from Claude’s proposal','Claude'],['v2','Two changes put back after the app closed','14:01 · You','You'],['v3','Two sentences typed in The straw','13:40 · You','You'],['v4','41 words spoken into Opening','13:12 · You, spoken','You'],['10 November'],['v5','“the rows sit in a green dusk” kept exactly','18:20 · You','You','Before Lin read it'],['v6','First draft, from 9 of your own sentences','17:55 · You','You']];
function versions(){
 const u=S.ui,sel=VERS.find(v=>v[0]===u.ver);
 const head=sel&&sel[0]!=='cur'?`<div class="vhead"><div class="row"><h3 class="grow">${sel[1]}</h3><button class="iconb" data-act="ver" data-v="" aria-label="Back to the current version" title="Back to the current version">${icon('x')}</button></div><p class="quiet">${sel[2]}. What changed is marked in the page.</p><div class="acts"><button class="btn pri" data-act="restore" data-v="${sel[0]}">${icon('restore')}Restore this version</button><button class="ghost" data-act="note" data-note="Picture only: give this version a name, like “Before Lin read it”. Named versions are kept for good.">${icon('tag')}Name it</button></div></div>`:'';
 return `${head}<p class="mg-h"><span>Earlier versions</span></p><div class="ver">${VERS.map(v=>v.length===1?`<p class="day">${v[0]}</p>`:`<button class="v" aria-pressed="${u.ver===v[0]||(!u.ver&&v[0]==='cur')}" data-act="ver" data-v="${v[0]==='cur'?'':v[0]}">${v[4]?`<h3>${v[4]}</h3><span class="what">${v[1]}</span>`:`<h3>${v[1]}</h3>`}<small>${v[2]}</small></button>`).join('')}</div><p class="quiet" style="padding:4px 0 0 12px">Restoring keeps the current words as a version too. Nothing is lost.</p>`;
}
const FD=[
 {id:'f1',k:'warn',h:'Your note gives a different date',where:'Opening, first paragraph',
  ev:[['Your page','The straw goes up in <span class="hl">the last week of April</span>.'],['Your note, On the train home','<span class="hl">Early May</span>, she said, is when the straw used to go up when she was a girl.']],
  acts:[['change','Change the page to “early May”'],['keep','Keep “the last week of April”']],
  res:{change:'The page now says “early May”.',keep:'Kept as it is. Check will not ask about this again.'}},
 {id:'f2',k:'bad',h:'Nothing in your sources says this',where:'Opening, first paragraph',
  ev:[['Your page','…the way it was done before <span class="hl">the black netting came</span>…'],['Closest, in the research topic Shading tea','Straw, reed and netting are all used; straw is the oldest.']],
  acts:[['know','Keep it: I know this myself'],['ask','Ask Research to find a source']],
  res:{know:'Kept as your own knowledge. Check will not ask again.',ask:'Research is looking. What it finds will appear here, beside this finding.'}},
 {id:'f3',k:'warn',h:'This sentence is still Claude’s words',where:'Opening, third paragraph',
  ev:[['Your page','<span class="hl">What the shade does is simple to say and slow to do.</span>'],['Where it came from','Claude proposed it on 10 November and you put it in without changing it.',1]],
  acts:[['mine','It is mine now: keep it'],['rewrite','Rewrite it here']],
  res:{mine:'Kept as yours.',rewrite:'Rewritten in your words.'}},
 {id:'f4',k:'todo',h:'Three parts have no words yet',where:'Still to write',
  ev:[['From your plan','The mill · What I tasted · Leaving',1]],acts:[['go','Start writing The mill']],res:{}}];
function findings(){
 const u=S.ui,left=FD.filter(f=>!u.res[f.id]).length;
 return `<p class="mg-h"><span>${left?`${left} to look at`:'Nothing left to look at'}</span><span class="quiet">checked 14:06</span><span class="grow"></span><button class="ghost" data-go="read-working" title="Check again against all six sources">${icon('refresh')}Check again</button></p>`+
 FD.map(f=>{const r=u.res[f.id];
  if(r)return `<div class="fd ok"><h3>${f.h}</h3><p class="done">${icon('check')}<span>${f.res[r]}</span><button class="ghost" data-act="res" data-id="${f.id}" data-v="">${icon('undo')}Undo</button></p></div>`;
  return `<div class="fd ${f.k}${u.fd===f.id?' on':''}" data-act="fd" data-v="${f.id}"><div class="hd"><h3>${f.h}</h3><p class="where">${f.where}</p></div><div class="evs">${f.ev.map(([l,t,ui])=>`<div><p class="label">${l}</p><p class="${ui?'says':'pr'}">${t}</p></div>`).join('')}</div><div class="acts">${f.acts.map(([a,l],i)=>a==='go'?`<button class="btn${i?'':' pri'}" data-go="speak">${l}</button>`:a==='rewrite'?`<button class="btn" data-act="rewrite" data-v="1">${l}</button>`:`<button class="btn${i?'':' pri'}" data-act="res" data-id="${f.id}" data-v="${a}">${l}</button>`).join('')}</div></div>`;}).join('')+
 `<div class="oks"><h3>Matches your sources</h3><span>${icon('check')}“First you watch” is what she said at 03:40.</span><span>${icon('check')}“Twenty days…” is what she said at 09:12.</span><span>${icon('check')}“Straw breathes…” is what she said at 14:32.</span><span>${icon('check')}Your kept words “the rows sit in a green dusk” are unchanged.</span></div>`;
}
function finishPanel(){
 const u=S.ui;
 if(u.fin)return `<div class="item fin"><h3>Finished, 14 November</h3><p class="says">Kept as the first edition. A change from here makes a second edition; the first stays as it is.</p><div class="steps-mini"><div><span class="stp done"></span>The words</div><div><span class="stp now"></span>Your yes</div><div><span class="stp"></span>Publish</div></div><div class="acts"><button class="btn pri" data-act="note" data-note="Picture only: opens ${SUBJ} at Share, on the step Your yes.">Go to Share${icon('right')}</button><button class="ghost" data-act="fin" data-v="0">Undo</button></div></div>`;
 return `<div class="item fin"><h3>Nothing left to look at</h3><ul><li>${icon('check')}All five parts are written.</li><li>${icon('check')}Four quotes are what she said.</li><li>${icon('check')}Your kept words are unchanged.</li><li>${icon('check')}Every sentence is yours or one you chose.</li></ul><div class="acts"><button class="btn pri" data-act="fin" data-v="1">Mark the Article finished</button></div></div>`;
}
function saveItem(){
 const u=S.ui;
 if(u.save==='saved')return `<div class="item"><h3>Saved</h3><p class="done">${icon('check')}Everything since 14:06 is saved, at 14:10.</p></div>`;
 const trying=u.save==='trying';
 return `<div class="item on"><div class="hd"><h3>${u.save==='failed2'?'Still not saved':'Your changes since 14:06 are not saved yet'}</h3>${u.save==='failed2'?'<p class="by">Tried at 14:06, 14:08 and 14:09. The app has not answered.</p>':''}</div>
 <p class="says"><b>Try again</b> sends them to the app now.</p>
 <p class="says"><b>Meanwhile</b> they are kept on this device, so you can keep writing.</p>
 <p class="says"><b>If it fails again</b>, copy all your words and paste them anywhere safe, such as a note.</p>
 <div class="acts"><button class="btn pri" data-act="retry"${trying?' disabled':''}>${trying?'<span class="spin"></span>Trying':'Try again'}</button><button class="btn" data-act="copy">${icon('copy')}Copy all my words</button></div>
 </div>`;
}
function marginBody(){
 const s=S.screen,u=S.ui;
 if(s==='write'||s==='quote'||s==='speak'||s==='speak-done')return proposals();
 if(s==='select')return (u.kept?`<div class="item"><h3>Kept exactly</h3><p class="says">“the black netting came” cannot be changed by anyone, Claude included, until you unkeep it.</p><p class="done"><button class="ghost" data-act="keep" data-v="0">${icon('undo')}Undo</button></p></div>`:`<div class="selp"><p class="label">Selected</p><p class="ev">“the black netting came”</p><div class="acts">${selActs(false)}</div></div>`)+proposals();
 if(s==='proposal-edit')return `<div class="item on"><h3>${PROPS.p1.title}</h3><p class="says">Open in your text. Change anything, then put it in. Her words in quote marks stay exactly as she said them.</p></div>`+proposal('p2');
 if(s==='history')return versions();
 if(s==='check')return findings();
 if(s==='finish')return finishPanel();
 if(s==='conflict')return u.conf?`<div class="item"><h3>Two versions</h3><p class="done">${icon('check')}You kept ${u.conf==='both'?'both':'the one written '+(u.conf==='phone'?'on your phone':'here')}. ${u.conf==='both'?'':'The other is in Earlier versions.'} <button class="ghost" data-act="conf" data-v="">${icon('undo')}Undo</button></p></div>`:`<div class="item on"><h3>One paragraph, written in two places</h3><p class="says">You changed the second paragraph on your phone at 14:10 and here at 14:12. Both are in the page with what differs marked. Keep one, or both. The one you do not keep stays in Earlier versions.</p></div>`;
 if(s==='recovered'){
  if(u.rec)return `<div class="item"><h3>Words kept on this device</h3><p class="done">${icon('check')}${u.rec==='back'?'Put back and saved at 14:01.':'Left out. They stay in Earlier versions.'} <button class="ghost" data-act="rec" data-v="">${icon('undo')}Undo</button></p></div>`;
  const d=diff('Netting is cheaper and one person can hang it in a morning. I asked why she still bothers with straw.','Netting is cheaper and one person can hang it in a morning. I asked why she still bothers with straw, and whether her son will.');
  return `<div class="item on"><div class="hd"><h3>Words kept on this device</h3><p class="by">The app closed at 13:58 before this change in The straw was saved.<br>${countLine(d)}</p></div><div class="ba"><div><p class="label">Saved</p><p class="pr">${d.before}</p></div><div><p class="label">Kept on this device</p><p class="pr">${d.after}</p></div></div><div class="acts"><button class="btn pri" data-act="rec" data-v="back">Put them back</button><button class="ghost" data-act="rec" data-v="left">Leave them out</button></div></div>`;}
 if(s==='save-failed')return saveItem()+proposals();
 return '';
}
const margin=()=>`<aside class="col mgcol"><div class="mg">${marginBody()}</div></aside>`;

/* ---------- screens ---------- */
function writeScreen(){
 const s=S.screen,u=S.ui;
 if(s==='focus')return `<main class="desk3 one"><article class="page">${article()}</article></main>`;
 const noSrc=['check','finish','history','conflict','recovered','save-failed','proposal-edit'].includes(s)&&!u.srcOpen;
 const cls=['desk3',noSrc?'nosrc':'',u.srcOpen?'srcopen':'',u.split?'split':''].join(' ');
 const vn=s==='history'&&u.ver?`<p class="vnote"><span class="grow">The version from ${VERS.find(v=>v[0]===u.ver)[2]}. What changed in it is marked.</span></p>`:'';
 return `<main class="${cls}">${noSrc&&!u.split?'':sources()}<article class="page">${vn}${article()}</article>${margin()}</main>`;
}
function startScreen(){
 const g=(part,lines)=>`<h2>${part}</h2>${lines?lines.map(([t,w])=>`<p>${t}<button class="qm" data-act="note" data-note="Picture only: shows where you said or wrote this: ${w}." aria-label="From ${w}" title="From ${w}"></button></p>`).join(''):''}`;
 return `<main class="desk3 nomg${S.ui.split?' split':''}">${sources()}<article class="page"><div class="text"><h1>Twenty days of shade</h1>
 <div class="row" style="margin:6px 0 10px"><button class="btn pri" data-go="write">Start from your own words</button><button class="btn" data-go="speak">${icon('mic')}Speak</button><button class="btn" data-act="note" data-note="Picture only: puts the cursor on the empty page under the title.">${icon('pen')}Type</button></div>
 <p class="quiet" style="margin-bottom:30px">Below: 9 sentences you said or wrote, in the order of your plan. Mrs. Oda’s words stay in Sources, ready to quote.</p>
 <div>
 ${g('Opening',[['The straw goes up by hand, pole by pole, until the rows sit in a green dusk.','Walking back, 00:40'],['I came to help and she handed me a cup.','Walking back, 01:15'],['She never looked at the clock once.','On the train home']])}
 ${g('The straw',[['Netting is cheaper, one person can hang it in a morning. She still does straw.','Walking back, 02:30'],['Why still the straw?','Kirihara garden walk, 14:20']])}
 ${g('The mill',[['Ask about the mill.','On the train home']])}
 ${g('What I tasted',[['Second infusion, colour of wet moss. Broth, then morning.','Tasting, second infusion']])}
 ${g('Leaving',[['I don’t know if the straw matters to the tea or only to her.','Walking back, 05:10']])}
 </div></div></article></main>`;
}
function readScreen(){
 const u=S.ui;
 const rp=id=>`<p class="read-para${u.para===id?' on':''}" data-act="para" data-v="${id}">${para(id)}</p>${PIDS[id]?excerpt(PIDS[id]):''}${u.para===id?`<div class="para-act"><button class="btn" data-go="write">${icon('pen')}Change this paragraph</button><button class="ghost" data-act="note" data-note="Picture only: a note to yourself beside this paragraph.">${icon('note')}Add a note for myself</button></div>`:''}`;
 return `<main class="desk3 one"><article class="page"><div class="text"><h1>Twenty days of shade</h1><figure><div class="lead-photo" role="img" aria-label="Straw screens over the rows at dawn (drawn)"></div><figcaption class="cap">Straw screens over the rows at dawn.</figcaption></figure>
 ${rp('p1')}${rp('p2')}${rp('p3')}<h2>The straw</h2>${rp('p4')}${rp('p5')}
 <div class="read-end"><p class="quiet">Three parts are not written yet: The mill, What I tasted, Leaving.</p><div class="row"><button class="btn pri" data-go="check">Check it</button><button class="ghost" data-go="write">${icon('pen')}Back to writing</button></div></div></div></article></main>`;
}

/* ---------- the Carousel: the slides themselves ---------- */
const LAYOUTS={C1:{name:'Cover, night bleed',max:40,lines:2,holds:'a photograph and a title of up to 40 characters, on 2 lines'},S2:{name:'Photograph above words',max:90,lines:3,holds:'a photograph and up to 90 characters, on 3 lines'},P1:{name:'Plate',max:60,lines:3,holds:'words only, up to 60 characters, on 3 lines'},B2:{name:'Box on a photograph',max:50,lines:2,holds:'a photograph and up to 50 characters, on 2 lines'},F1:{name:'Full picture',max:0,lines:0,holds:'a photograph only, no words'},E1:{name:'Close',max:50,lines:2,holds:'up to 50 characters and the seal'}};
const SHORT='The leaf goes dark and soft.';
const LONG='In twenty days of shade the leaf goes dark, soft and sweet, and the bitterness never comes.';
function slides(){const u=S.ui;return [
 {code:'C1',role:'Cover',w:'Twenty days of shade',pg:'linear-gradient(170deg,#5d6b43,#212817)'},
 {code:'S2',role:'Slide 2',w:'Bamboo, reed, then straw, scattered by hand.',pg:'linear-gradient(170deg,#9a8a6a,#3e3526)'},
 {code:'P1',role:'Slide 3',w:'“Straw breathes.”',q:'14:32'},
 {code:u.b4,role:'Slide 4',w:u.c4==='taken'?SHORT:LONG,pg:'linear-gradient(170deg,#7d6447,#2f2418)'},
 {code:'F1',role:'Slide 5',w:'',pg:'linear-gradient(170deg,#455646,#1b241c)'},
 {code:'E1',role:'Close',w:'Read the whole piece in the magazine.'}];}
const fits=s=>{const L=LAYOUTS[s.code];return !L.max||s.w.length<=L.max;};
function slideHTML(s,o={}){
 const L=LAYOUTS[s.code],over=!fits(s);
 const inner=s.code==='B2'?`<div class="box"><div class="w"${o.edit?' contenteditable="true" spellcheck="false"':''}>${esc(s.w)}</div></div>`:`<div class="w"${o.edit?' contenteditable="true" spellcheck="false"':''}>${esc(s.w)}</div>`;
 return `<div class="sl ${s.code}${over?' over':''}${o.mini?' mini':''}" role="img" aria-label="${s.role}, layout ${s.code} ${L.name}">${['C1','S2','B2','F1'].includes(s.code)?`<div class="pic" style="--pg:${s.pg||'linear-gradient(170deg,#5d6b43,#212817)'}"></div>`:''}${s.code==='C1'?'<span class="mark">TEAJIĀ</span>':''}${inner}${s.code==='E1'?'<span class="seal">佳</span>':''}</div>`;
}
function fitLine(s){
 const L=LAYOUTS[s.code];if(!L.max)return `<p class="fitline">This layout holds no words. The photograph speaks.</p>`;
 const n=s.w.length,over=n>L.max,pct=Math.min(100,Math.round(n/L.max*100));
 return `<p class="fitline${over?' over':''}"><span class="meter"><i style="width:${pct}%"></i></span><span>${over?`${n} of ${L.max} characters: ${n-L.max} too many, the end is cut off`:`${n} of ${L.max} characters`}</span></p>`;
}
function carouselScreen(){
 const u=S.ui,post=S.screen==='carousel-post',SL=slides(),cur=SL[u.slide];
 const strip=`<nav class="strip" aria-label="Slides and post text">${SL.map((s,i)=>`<button${!post&&u.slide===i?' aria-current="true"':''} data-act="slide" data-v="${i}" title="${s.role}, ${s.code} ${LAYOUTS[s.code].name}">${slideHTML(s,{mini:1})}${fits(s)?'':'<span class="warnmark" role="img" aria-label="Words do not fit"></span>'}<span class="lbl">${i+1} · ${s.code}</span></button>`).join('')}<button${post?' aria-current="true"':''} data-go="carousel-post" title="The post text"><span class="postthumb">${icon('note')}</span><span class="lbl">Post text</span></button></nav>`;
 let stage,panel;
 if(post){
  stage=`<div class="stage"><div class="post"><p class="acct"><i></i>teajia</p>${slideHTML(SL[0],{mini:1})}<p class="caption" contenteditable="true" spellcheck="false">Twenty days under straw. Mrs. Oda still shades her tea the old way, pole by pole and armful by armful, because <span class="kept">straw breathes</span> and netting only takes the light away. The whole story is in the magazine.</p><p class="quiet">214 of 2,200 characters. The first 125 show before “more”, ending at “pole by pole”.</p></div></div>`;
  panel=`<div class="item"><h3>Post text</h3><p class="says">The words under the Carousel on Instagram. Change them right on the post.</p></div><p class="mg-h"><span>Proposals</span></p><p class="empty">No proposals waiting.</p>`;
 }else{
  const L=LAYOUTS[cur.code],over=!fits(cur);
  stage=`<div class="stage"><p class="cap2"><b>${cur.role}</b><span>${cur.code} · ${L.name}</span><span class="grow"></span><span>${u.slide+1} of ${SL.length}</span></p>${slideHTML(cur,{edit:1})}<div style="width:min(100%,460px)">${fitLine(cur)}</div></div>`;
  const alts=['S2','B2','E1'].filter(c=>c!==cur.code).concat(cur.code==='S2'?[]:[]).slice(0,3);
  const layItem=`<div class="item"><h3>Layout: ${cur.code}, ${L.name}</h3><p class="says">Holds ${L.holds}.</p>${u.lay?`<p class="label">Layouts with room for these words</p><div class="lays">${['S2','B2','P1'].map(c=>{const s2={...cur,code:c};return `<button${c===cur.code?' aria-current="true"':''} data-act="lay" data-v="${c}">${slideHTML(s2,{mini:1})}<span>${c} ${LAYOUTS[c].name}</span><small>${fits(s2)?'Fits':'Too long'}</small></button>`;}).join('')}</div><div class="acts"><button class="ghost" data-act="layopen" data-v="0">${icon('x')}Close</button><button class="ghost" data-act="note" data-note="Picture only: every layout in the Teajiā look, grouped by row, with a find field, as the slide studio has today.">All 59 layouts</button></div>`:`<div class="acts"><button class="btn" data-act="layopen" data-v="1">${icon('layout')}Change the layout</button></div>`}</div>`;
  let propItem='';
  if(u.slide===3&&cur.code==='B2'){
   const d=diff(LONG,SHORT);
   if(u.c4==='wait')propItem=`<div class="item on"><div class="hd"><h3>Shorter words for this slide</h3><p class="by">Claude, cut from your own sentence. Nothing new is added.<br>${countLine(d)}</p></div><div class="ba2"><div><p class="label">Now</p>${slideHTML({...cur,w:LONG},{mini:1})}</div><div><p class="label">With this change</p>${slideHTML({...cur,w:SHORT},{mini:1})}</div></div><div class="ba"><div><p class="label">Your words now</p><p class="pr">${d.before}</p></div><div><p class="label">With this change</p><p class="pr">${d.after}</p></div></div><div class="acts"><button class="btn pri" data-act="c4" data-v="taken">Put it on the slide</button><button class="btn" data-act="note" data-note="Picture only: puts the shorter words on the slide for you to change before they stay.">Edit it first</button><button class="ghost" data-act="c4" data-v="left">Keep my words</button></div></div>`;
   else propItem=`<div class="item"><h3>Shorter words for this slide</h3><p class="done">${u.c4==='taken'?icon('check')+'<span>On the slide at 14:12.</span>':'<span>You kept your words.</span>'}<button class="ghost" data-act="c4" data-v="wait">${icon('undo')}Undo</button></p></div>`;
  }
  const phItem=['C1','S2','B2','F1'].includes(cur.code)?`<div class="item"><h3>Photograph</h3><p class="says">Her hands, sorting the leaves.</p>${u.ph?`<div class="photos">${PHOTOS.map((g,i)=>`<button class="ph" style="--pg:${g};border:0;padding:0${i===3?';outline:2px solid var(--ink);outline-offset:1px':''}" data-act="ph" data-v="0" aria-label="Photograph ${i+1}"></button>`).join('')}</div>`:`<div class="acts"><button class="btn" data-act="ph" data-v="1">${icon('photo')}Change the photograph</button></div>`}</div>`:'';
  const wordsItem=`<div class="item"><h3>Words</h3><p class="says">${cur.w?'Click the words on the slide to change them. The Article keeps its own words.':'None on this slide.'}</p>${cur.q?`<p class="by">Exactly what she said at ${cur.q}.</p>`:''}</div>`;
  panel=`${over?`<p class="mg-h need">${icon('warn')}<span>These words do not fit this layout</span></p>`:''}${propItem}${layItem}${wordsItem}${phItem}`;
 }
 return `<main class="car${u.srcOpen?' srcopen':''}">${strip}${stage}<aside class="col cpanel"><div class="mg">${panel}</div></aside>${u.srcOpen?sources():''}</main>`;
}

/* ---------- the control states sheet ---------- */
function statesScreen(){
 const cols=['Rest','Hover','Focus','Pressed','Disabled','Working'],cls=['','is-hover','is-focus','is-pressed','',''];
 const row=(name,mk)=>`<section class="strow"><p class="label">${name}</p><div class="stcells">${cols.map((c,i)=>`<figure><figcaption>${c}</figcaption>${mk(cls[i],i===4,i===5)}</figure>`).join('')}</div></section>`;
 const b=(k,lab)=>(c,dis,work)=>`<button class="${k} ${c}"${dis||work?' disabled':''} data-act="note" data-note="A picture of the ${cols[0]}…${cols[5]} states.">${work?'<span class="spin"></span>':''}${lab}</button>`;
 return `<main class="states"><h3>Control states</h3><p class="quiet">Three button kinds and icon buttons, the same on every screen. Each keeps its size and place in every state. Hover changes the background; focus adds an outline outside the control; working keeps the label and adds a turning mark.</p><div class="stlist">
 ${row('Main action: one per item, the result he came for',b('btn pri','Put it in my text'))}${row('Ordinary action',b('btn','Edit it first'))}${row('Quiet action: undo, cancel, keep as it is',(c,d,w)=>`<button class="ghost ${c}"${d||w?' disabled':''} data-act="note" data-note="States picture.">${w?'<span class="spin"></span>':icon('undo')}Undo</button>`)}
 ${row('Icon button: play, close, stop, undo in the bar',(c,d,w)=>`<button class="iconb ${c}"${d||w?' disabled':''} data-act="note" data-note="States picture." aria-label="Play">${w?'<span class="spin"></span>':icon('play')}</button>`)}
 </div></main>`;
}

/* ---------- render ---------- */
function mockStrip(){return `<nav class="mock" aria-label="Mock-up screens"><b>Mock-up, not part of the design</b>${SCREENS.map(([id,n])=>`<a href="#${id}"${S.screen===id?' aria-current="page"':''}>${n}</a>`).join('')}<a href="#" data-act="theme">Light / dark</a><span class="mock-note" id="mock-note">${esc(S.noteText||'')}</span></nav>`;}
function render(){
 const s=S.screen;
 document.documentElement.classList.toggle('focus',s==='focus');
 let body;
 if(s==='states')body=statesScreen();
 else if(s==='start')body=startScreen();
 else if(s==='read'||s==='read-working')body=readScreen();
 else if(s==='carousel'||s==='carousel-post')body=carouselScreen();
 else body=writeScreen();
 $('#app').innerHTML=mockStrip()+top()+(s==='states'?'':pbar())+body+phonebar();
 syncPhone();fitDesk();
}
function syncPhone(){const l2=document.querySelector('.line2');if(l2)l2.hidden=!matchMedia('(max-width:850px)').matches;}
function note(t){S.noteText=t;const n=$('#mock-note');if(n)n.textContent=t;}
function go(id){if(location.hash==='#'+id||(!location.hash&&id==='write'))note('Already open here.');else location.hash=id;}
function applyDefaults(){
 const u=S.ui,s=S.screen;
 if(s==='start')u.src='memo';
 if(['speak','speak-done','history','quote','finish','focus','read','read-working','check','conflict','recovered','save-failed'].includes(s))u.p1='taken';
 if(s==='speak-done')u.speak='done';
 if(s==='history')u.ver='v3';
 if(s==='finish'){u.p2='taken';}
 if(s==='quote'){u.split=true;u.q='09:36';u.quoted=true;}
 if(s==='carousel-post')u.slide=-1;
}
function route(){
 const id=(location.hash||'#write').slice(1);
 S.screen=SCREENS.some(x=>x[0]===id)?id:'write';S.ui=fresh();S.noteText='';applyDefaults();render();scrollTo(0,0);
}
let timer=null;
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-go],[data-act]');if(!el)return;
 if(!el.dataset.act){e.preventDefault();go(el.dataset.go);return;}
 const act=el.dataset.act,v=el.dataset.v,u=S.ui;
 e.preventDefault();
 switch(act){
  case 'note':note(el.dataset.note);return;
  case 'theme':setTheme(S.theme==='dark'?'light':'dark');return;
  case 'prop':u[el.dataset.id]=v;if(el.dataset.then){location.hash=el.dataset.then;setTimeout(()=>{S.ui.p1=v;render();note('Put in your text, with the words you changed.');},0);return;}note(v==='taken'?'Put in your text. Undo is beside it, and in Earlier versions.':v==='left'?'Your words stay as they are.':'Back as it was.');break;
  case 'c4':u.c4=v;break;
  case 'conf':u.conf=v||null;break;
  case 'rec':u.rec=v||null;break;
  case 'retry':{const was=u.save;u.save='trying';render();clearTimeout(timer);timer=setTimeout(()=>{S.ui.save=was==='failed'?'failed2':'saved';render();},900);return;}
  case 'copy':note('Copied all 612 words of the Article. Paste them anywhere safe.');return;
  case 'fin':u.fin=v==='1';break;
  case 'res':u.res[el.dataset.id]=v||undefined;if(el.dataset.id==='f3')u.rewrite=false;break;
  case 'rewrite':u.rewrite=v==='1';u.fd='f3';break;
  case 'src':u.src=u.src===el.dataset.id?'':el.dataset.id;break;
  case 'srcToggle':u.srcOpen=!u.srcOpen;if(matchMedia('(max-width:850px)').matches)u.split=u.srcOpen;break;
  case 'split':u.split=!u.split;break;
  case 'fd':u.fd=v;render();{const t=document.getElementById(v==='f3'?'p3':'p1');if(t)t.scrollIntoView({block:'center'});}note('The words this finding is about are marked in the page.');return;
  case 'para':u.para=u.para===v?null:v;break;
  case 'ver':if((u.ver||'')===(v||'')){note('This version is already shown in the page.');return;}u.ver=v||null;break;
  case 'restore':note('Restored the version from '+VERS.find(x=>x[0]===v)[2]+'. The words you had are kept as a version too.');u.ver=null;break;
  case 'keep':u.kept=v!=='0';break;
  case 'qm':u.q=u.q===el.dataset.at?null:el.dataset.at;u.src='walk';break;
  case 'undo':if(S.screen==='speak-done'||u.speak==='done'){note('Undone: the 14 spoken words are out. They stay in Earlier versions.');u.speak=null;if(S.screen==='speak-done'){location.hash='write';return;}}else if(u.p1==='taken'&&S.screen!=='start'){u.p1='wait';note('Undone: her exact words are out; your sentence is back.');}else{note('Nothing to undo here.');return;}break;
  case 'speak':if(S.screen==='speak'){u.speak=u.speak==='done'?null:'done';if(u.speak==='done')note('Stopped. What you said is in The mill as your words, marked “You, spoken” in Earlier versions.');}else{location.hash='speak';return;}break;
  case 'quote':u.quoted=true;u.q=el.dataset.at;note('Her words from '+el.dataset.at+' are in your text at the cursor, in quote marks, with a small mark that opens this line.');if(S.screen!=='quote'){location.hash='quote';return;}break;
  case 'slide':if(S.screen==='carousel'&&u.slide===+v){note('This slide is already open.');return;}u.slide=+v;u.lay=false;u.ph=false;if(S.screen!=='carousel'){location.hash='carousel';setTimeout(()=>{S.ui.slide=+v;render();},0);return;}break;
  case 'lay':u.b4=v;u.lay=false;break;
  case 'layopen':u.lay=v==='1';break;
  case 'ph':u.ph=v==='1';break;
 }
 render();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.screen==='speak'&&S.ui.speak!=='done'){S.ui.speak='done';render();}});
function setTheme(t){S.theme=t;document.documentElement.dataset.theme=t;try{localStorage.setItem('arw-theme',t);}catch{}}
let t='dark';try{t=localStorage.getItem('arw-theme')||'dark';}catch{}
const q=new URLSearchParams(location.search);if(q.get('theme'))t=q.get('theme');if(q.get('shot'))document.documentElement.classList.add('shot');
setTheme(t);
addEventListener('hashchange',route);addEventListener('resize',()=>{syncPhone();fitDesk();});
document.fonts&&document.fonts.ready.then(fitDesk);
route();
})();
