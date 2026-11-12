/* AR Create version two: Write, Read and Check for a piece. A static mock-up with invented content only.
   Every screen and state is reachable by an address fragment (#write, #check ...). No network requests. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- icons ---------- */
const P={
 back:'<path d="M15 18l-6-6 6-6"/>',right:'<path d="M9 6l6 6-6 6"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z"/>',
 focus:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
 check:'<path d="M5 12l5 5 9-10"/>',play:'<path d="M8 5v14l11-7z"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
 rec:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',note:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>',
 photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 8"/>',
 topic:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4M9 11h4"/>',quote:'<path d="M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6"/>',
 ask:'<path d="M4 5h16v11H9l-5 4z"/>',warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
 history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
 cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/>',slides:'<rect x="3" y="5" width="13" height="15" rx="2"/><path d="M19 7v11"/>'};
const icon=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[n]||''}</svg>`;

/* ---------- the screens ---------- */
const SCREENS=[
 ['start','Nothing written yet'],['write','Write'],['select','Words selected'],['proposal-edit','Change a proposal first'],
 ['quote','Quote a source'],['speak','Speaking'],['history','Earlier versions'],['focus','Focus'],
 ['read','Read'],['read-working','Read, Claude working'],['check','Check'],['carousel','Carousel words'],
 ['finish','Finished'],['conflict','Two versions'],['recovered','Writing recovered'],['save-failed','Save failed']];
const S={screen:'write',theme:'dark',ui:{}};
const fresh=()=>({p1:'wait',p2:'wait',conf:null,rec:null,fail:true,fin:false,para:null,fd:'f1',src:'walk',srcOpen:false,ver:null,split:false,keep:false,mine:false,speaking:true,stopped:false});

/* ---------- invented content: "Straw over the rows" (Tea), Article "Twenty days of shade" ---------- */
const lockI=icon('lock');
const src=(t,label='recording')=>`<span class="q-src" title="Exact, from the ${label}">${icon('rec')} ${t}</span>`;
const SUBJ='Straw over the rows';
const PARTS=[['The mill','The leaves go to the steamer the same afternoon'],['What I tasted','The bench, the second infusion'],['Leaving','What is still unknown']];

function para(id,u){
 u=Object.assign({},u);if(!['write','select','speak','quote','proposal-edit'].includes(S.screen))u.noMk=1;
 const kept=`<span class="kept">the rows sit in a green dusk${lockI}</span>`;
 if(id==='p1'){const net=u.selNet?'<span class="selwrap"><span class="selbar" role="toolbar" aria-label="Selected words">'+selbar()+'</span><span class="sel">the black netting came</span></span>':u.flagNet?`<span class="${u.flagNet}">the black netting came</span>`:'the black netting came';
  const apr=u.flagApr?`<span class="${u.flagApr}">the last week of April</span>`:'the last week of April';
  return `The straw goes up in ${apr}. Mrs. Oda does it the way it was done before ${net}: bamboo poles, reed screens, then rice straw scattered by hand until ${kept}.`;}
 if(id==='p2')return `I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,”${src('03:40')} she said. So I watched the light change under the screens for most of an hour.`;
 if(id==='p3'){const first=u.mine?'What the shade does is simple to say and slow to do.':`<span class="${u.flagMine||'taken'}" title="Taken from Claude's proposal on 10 Nov, not yet changed by you">What the shade does is simple to say and slow to do.</span>`;
  const end=S.ui.p1==='taken'?`“Twenty days,” she says. “Twenty-two if the nights are cold. You don’t count, you look at the leaf.”${src('09:12')}`:`<span${u.p1hl?' class="hl"':''}>Twenty days, she says, sometimes twenty-two if the nights stay cold.</span>${S.ui.p1==='wait'&&!u.noMk?'<button class="mk warm" data-act="fd-none" aria-label="Proposal 1">1</button>':''}`;
  return `${first} The bush, starved of sun, holds on to what would have turned bitter. The leaf goes dark and soft. ${end}${u.quoteIn?` “It goes dark, like wet stone. And soft.”${src('09:36')}`:''}${u.caret?'<span class="caret"></span>':''}`;}
 if(id==='p4')return `Netting is cheaper and one person can hang it in a morning. I asked why she still bothers with straw${u.recIns?'<ins class="hl" style="text-decoration:none">, and whether her son will</ins>':S.ui.rec==='back'?', and whether her son will':''}.`;
 if(id==='p5')return `She laughed. “Straw breathes,” she said. “The net only takes the light away.”${src('14:32')}${S.ui.p2==='wait'&&!u.noMk?'<button class="mk warm" data-act="fd-none" aria-label="Proposal 2">2</button>':''}`;
 if(id==='p6')return S.screen==='finish'?'She lets the old straw fall where it lies. By July it has gone back into the soil, and the rows are greener for it.':`<span class="taken">She lets the old straw fall where it lies. By July it has gone back into the soil, and the rows are greener for it.</span>`;
 return '';
}
function selbar(){return `<button data-act="keep">${icon('lock')}Keep exact</button><button data-act="note" data-note="Picture only: asks Claude for another way to say these words. The answer arrives beside the paragraph as a proposal.">${icon('ask')}Ask for another way</button><button data-act="note" data-note="Picture only: a note to yourself beside these words. Nobody else acts on it.">${icon('note')}Note to self</button>`;}

/* ---------- the top bar (version two's shell) ---------- */
function top(){
 const chips=[SUBJ,'The first cup','Circle of twelve','Small paintings of doors','The road north'];
 return `<header class="top"><button class="logo" data-act="note" data-note="Picture only: goes Home." aria-label="Home"><i></i></button>
 <nav class="places" aria-label="Places">${['Home','Research','Looks','Library'].map(p=>`<button class="place" data-act="note" data-note="Picture only: opens ${p}.">${p}</button>`).join('')}</nav>
 <div class="desk" aria-label="On your desk">${chips.map((c,i)=>`<button class="chip"${i===0?' aria-current="page"':''} data-act="note" data-note="${i===0?'You are in this subject.':'Picture only: opens '+esc(c)+' at the place you left it.'}"><i></i><span>${esc(c)}</span></button>`).join('')}</div>
 <span class="grow"></span>
 <button class="ghost wide" data-act="note" data-note="Picture only: find any subject, piece or source.">${icon('search')}<kbd>⌘K</kbd></button>
 <button class="ghost wide needs" data-act="note" data-note="Picture only: the questions only you can answer."><i></i>Needs you · 4</button>
 <button class="ghost wide" data-act="note" data-note="Picture only: add a recording, photograph or thought to this subject.">${icon('plus')}Capture</button>
 <button class="ghost" data-act="theme" aria-label="Light or dark">${icon('sun')}</button>
 <button class="adv" data-act="note" data-note="Picture only: the existing workspace, at this piece and section.">Advanced</button></header>`;
}

/* ---------- the piece bar ---------- */
function status(){
 const u=S.ui,s=S.screen;
 if(s==='save-failed'&&u.fail)return `<span class="saved bad">${icon('cloud')}Not saved yet</span><button class="btn" data-act="retry">Try again</button>`;
 if(s==='recovered'&&!u.rec)return `<span class="saved warn">${icon('warn')}2 changes not saved yet</span>`;
 if(s==='conflict'&&!u.conf)return `<span class="saved warn">${icon('warn')}One paragraph has two versions</span>`;
 if(s==='read-working')return `<span class="working"><i></i>Claude is checking quotes against the recording, 3 of 5</span><button class="ghost" data-act="note" data-note="Picture only: stops Claude. Nothing on the page changes either way.">Stop</button>`;
 if(s==='speak'&&u.speaking)return `<span class="saved warn">${icon('mic')}Listening</span>`;
 if(s==='start')return '';
 return `<span class="saved">${icon('check')}Saved ${s==='save-failed'?'14:09':'14:06'}</span>`;
}
function pbar(){
 const s=S.screen,car=s==='carousel';
 const mode=s==='read'||s==='read-working'?'read':s==='check'||s==='finish'?'check':'write';
 const pieces=`<nav class="tabs" aria-label="Pieces in this subject"><button class="tab"${!car?' aria-current="page"':''} data-go="write">Article</button><button class="tab"${car?' aria-current="page"':''} data-go="carousel">Carousel</button></nav>`;
 const modes=`<nav class="tabs" aria-label="Way of looking"><button class="tab"${mode==='write'?' aria-current="page"':''} data-go="${car?'carousel':'write'}">Write</button><button class="tab"${mode==='read'?' aria-current="page"':''} data-go="${car?'carousel':'read'}" ${car?'data-act="note" data-note="Picture only: reads the Carousel slide by slide, as it will look on a phone."':''}>Read</button><button class="tab"${mode==='check'?' aria-current="page"':''} data-go="${car?'carousel':'check'}" ${car?'data-act="note" data-note="Picture only: the same check for the Carousel: quotes, characters, words that fit."':''}>Check${s==='finish'||s==='start'||car?'':'<span class="n">4</span>'}</button></nav>`;
 if(s==='focus')return `<div class="pbar"><button class="back" data-go="write">${icon('back')}<span>Leave focus</span></button><span class="grow"></span>${status()}<button class="ghost speak" data-go="speak">${icon('mic')}Speak</button></div>`;
 const srcBtn=mode!=='read'?`<button class="ghost wide" aria-pressed="${S.ui.srcOpen}" data-act="srcToggle">${icon('book')}Sources</button>`:'';
 return `<div class="pbar">
 <button class="back" data-act="note" data-note="Picture only: back to ${SUBJ}, with The words open where you left it."> ${icon('back')}<span>${SUBJ}</span></button>
 <span class="wide" style="display:contents">${pieces}<span class="sep"></span>${modes}</span>
 <span class="grow"></span>${status()}
 <span class="tools wide">${mode==='write'&&s!=='start'?`<button class="ghost" data-act="undo" title="Undo (⌘Z)">${icon('undo')}Undo</button><button class="ghost" aria-pressed="${s==='history'}" data-go="${s==='history'?'write':'history'}">${icon('history')}Earlier versions</button>`:''}${srcBtn}${mode==='write'&&s!=='start'?`<button class="ghost" data-go="focus">${icon('focus')}Focus</button><button class="ghost speak${s==='speak'&&S.ui.speaking?' on':''}" data-act="speak">${icon('mic')}${s==='speak'&&S.ui.speaking?'Stop':'Speak'}</button>`:''}</span>
 <div class="line2" hidden>${pieces}${modes}</div></div>`;
}
function phonebar(){
 const s=S.screen;if(s==='read'||s==='read-working'||s==='check'||s==='finish')return '';
 const on=s==='speak'&&S.ui.speaking;
 if(s==='select')return `<nav class="pphone sel3" aria-label="Selected words">${selbar()}</nav>`;
 return `<nav class="pphone" aria-label="Writing"><button data-act="undo">${icon('undo')}<span>Undo</span></button><button class="speak${on?' on':''}" data-act="speak">${icon('mic')}${on?'Stop':'Speak'}</button><button aria-pressed="${S.ui.split}" data-act="split">${icon('book')}<span>Sources</span></button></nav>`;
}

/* ---------- sources ---------- */
const WAVE=[5,9,14,8,12,18,10,6,13,20,9,15,7,11,17,12,6,10,16,8,13,19,9,7,12,15,10,6,14,9,11,16,7,12,18,10,8,13,6,11];
function wave(at){return `<span class="wave" aria-hidden="true">${WAVE.map((h,i)=>`<i class="${i<at?'past':'fut'}" style="height:${h+4}px"></i>`).join('')}</span>`;}
function transcript(on){
 const L=[['03:40','Mrs. Oda','First you watch. Then you can help.'],['09:12','Mrs. Oda','Twenty days. Twenty-two if the nights are cold. You don’t count, you look at the leaf.'],['09:31','You','What do you look for?'],['09:36','Mrs. Oda','It goes dark, like wet stone. And soft. When it feels like an earlobe, it is ready.'],['gap','five minutes on'],['14:20','You','Netting would be so much less work. Why still the straw?'],['14:32','Mrs. Oda','Straw breathes. The net only takes the light away.'],['16:05','Mrs. Oda','The old straw I leave where it falls. By July you cannot find it.']];
 return `<ol class="tr">${L.map(l=>l[0]==='gap'?`<li class="gap">${l[1]}</li>`:`<li class="${l[1]==='You'?'you ':''}${l[0]===on?'on':''}"><div class="who"><span>${l[0]} · ${l[1]}</span><span class="sp"></span><button class="mini" data-act="note" data-note="Picture only: plays the recording from ${l[0]}.">${icon('play')}Play</button><button class="mini" data-act="quote" data-at="${l[0]}">${icon('quote')}Quote</button></div><p>${esc(l[2])}</p></li>`).join('')}</ol>`;
}
function sources(){
 const u=S.ui,open=u.src;
 const item=(id,ic,name,meta,body)=>`<div class="src${open===id?' open':''}"><button class="src-h" data-act="src" data-id="${id}" aria-expanded="${open===id}">${icon(ic)}<span><b>${name}</b><small>${meta}</small></span></button>${open===id?`<div class="src-body">${body}</div>`:''}</div>`;
 const on=S.screen==='quote'?'09:36':S.screen==='write'&&u.p1==='wait'?'09:12':S.screen==='check'?'':'';
 return `<aside class="col srccol" aria-label="Sources"><div class="src-find">${icon('search')}<span>Find in sources</span></div>
 ${item('walk','rec','Kirihara garden walk','Recording, 42 min · Mrs. Oda and you',`<div class="player"><button class="play" data-act="note" data-note="Picture only: plays the recording." aria-label="Play">${icon('play')}</button>${wave(14)}<time>09:12</time></div>${transcript(on)}`)}
 ${item('memo','mic','Walking back','Your voice memo, 6 min',`<p class="note-txt">The straw goes up by hand, pole by pole, until the rows sit in a green dusk. I came to help and she handed me a cup. Netting is cheaper, one person can hang it in a morning. She still does straw. I don’t know if the straw matters to the tea or only to her.</p>`)}
 ${item('train','note','On the train home','Your note',`<p class="note-txt">She never looked at the clock once. ${S.screen==='check'?'<span class="hl">Early May, she said, is when the straw used to go up</span>':'Early May, she said, is when the straw used to go up'} when she was a girl. Ask about the mill.</p>`)}
 ${item('taste','note','Tasting, second infusion','Your note',`<p class="note-txt">Second infusion, colour of wet moss. Broth, then morning.</p>`)}
 ${item('photos','photo','Photographs','6, from the garden walk',`<div class="photos">${['','b','c','d','e','f'].map(c=>`<span class="ph ${c}"></span>`).join('')}</div>`)}
 ${item('topic','topic','Shading tea','Research topic · 12 findings',`<p class="quiet">Shade before picking raises the savoury taste and lowers the bitter. Straw, reed and netting are all used; straw is the oldest. <button class="link" data-act="note" data-note="Picture only: opens the topic in Research.">Open the topic${icon('right')}</button></p>`)}
 </aside>`;
}

/* ---------- proposals ---------- */
function prop1(inline){
 const u=S.ui;
 if(u.p1==='taken')return `<div class="card${inline?' inline-card':''}"><p class="who">Her exact words · Claude</p><p class="done">${icon('check')}You used it, 14:06 <button class="link" data-act="p1" data-v="wait">Undo</button></p></div>`;
 if(u.p1==='left')return `<div class="card${inline?' inline-card':''}"><p class="who">Her exact words · Claude</p><p class="done" style="color:var(--dim)">You left it. It won’t be proposed again. <button class="link" data-act="p1" data-v="wait">Undo</button></p></div>`;
 return `<div class="card on${inline?' inline-card':''}"><h3><span class="mk warm">1</span>Her exact words here?</h3><p class="who">Claude · from Kirihara garden walk at 09:12</p><p class="prop"><del>Twenty days, she says, sometimes twenty-two if the nights stay cold.</del> <ins>“Twenty days,” she says. “Twenty-two if the nights are cold. You don’t count, you look at the leaf.”</ins></p><div class="row"><button class="btn pri" data-act="p1" data-v="taken">Use it</button><button class="btn" data-go="proposal-edit">Change it first</button><button class="ghost" data-act="p1" data-v="left">Leave it</button></div></div>`;
}
function prop2(inline){
 const u=S.ui;
 if(u.p2==='taken')return `<div class="card${inline?' inline-card':''}"><p class="who">A paragraph after “Straw breathes” · Claude</p><p class="done">${icon('check')}You used it, 14:07 <button class="link" data-act="p2" data-v="wait">Undo</button></p></div>`;
 if(u.p2==='left')return `<div class="card${inline?' inline-card':''}"><p class="who">A paragraph after “Straw breathes” · Claude</p><p class="done" style="color:var(--dim)">You left it. It won’t be proposed again. <button class="link" data-act="p2" data-v="wait">Undo</button></p></div>`;
 return `<div class="card${inline?' inline-card':''}"><h3><span class="mk">2</span>A paragraph after “Straw breathes”</h3><p class="who">Claude · from the recording at 16:05 and your note On the train home</p><p class="prop">She lets the old straw fall where it lies. By July it has gone back into the soil, and the rows are greener for it.</p><div class="row"><button class="btn pri" data-act="p2" data-v="taken">Use it</button><button class="btn" data-act="note" data-note="Picture only: opens these words in the text for you to change before they go in (see Change a proposal first).">Change it first</button><button class="ghost" data-act="p2" data-v="left">Leave it</button></div></div>`;
}

/* ---------- the article page ---------- */
function todo(){return `<div class="todo"><p class="label">Still to write</p><ol>${PARTS.map(([n,w])=>`<li><b>${n}</b><span>${w}</span><button class="ghost" data-act="note" data-note="Picture only: puts the cursor in ${n} so you can type.">Write</button><button class="ghost" data-go="speak">${icon('mic')}Speak</button></li>`).join('')}</ol></div>`;}
function article(o={}){
 const u=S.ui,s=S.screen;
 const P=(id,x={})=>{const cls=[x.cls||''];return `<p id="${id}" class="${cls.join(' ')}">${para(id,Object.assign({},o,x))}</p>`;};
 let p2=P('p2');
 if(s==='conflict'&&!u.conf)p2=`<div class="two" id="p2"><div><p class="k"><span>On your phone, 14:10</span><span class="sp"></span><button class="btn" data-act="conf" data-v="phone">Keep this one</button></p><p>I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,” she said. So I watched <ins>the straw darken and the light go green</ins> for most of an hour.</p></div><div><p class="k"><span>Here, 14:12</span><span class="sp"></span><button class="btn" data-act="conf" data-v="here">Keep this one</button></p><p>I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,” she said. So I watched the light change under the screens for most of an hour<ins>, and did not once think of helping</ins>.</p></div><div class="row" style="background:none;padding:0 16px"><button class="ghost" data-act="conf" data-v="both">Keep both, one after the other</button></div></div>`;
 if(s==='conflict'&&u.conf){const t={phone:'So I watched the straw darken and the light go green for most of an hour.',here:'So I watched the light change under the screens for most of an hour, and did not once think of helping.',both:'So I watched the straw darken and the light go green for most of an hour. So I watched the light change under the screens for most of an hour, and did not once think of helping.'}[u.conf];
  p2=`<p id="p2">I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,”${src('03:40')} she said. ${t}</p>`;}
 let p3=P('p3',{p1hl:s==='write'&&u.p1==='wait',caret:s==='quote',quoteIn:s==='quote'&&u.quoted,flagMine:s==='check'?(u.fd==='f3'?'hl':'flag'):'',noMk:s==='check'||s==='finish'});
 if(s==='proposal-edit')p3=`<div class="edit-in" id="p3"><p class="k">Claude’s proposal, open for you to change before it goes in</p><p contenteditable="true" spellcheck="false">What the shade does is simple to say and slow to do. The bush, starved of sun, holds on to what would have turned bitter. The leaf goes dark and soft. “Twenty days,” she says. “Twenty-two<span class="caret"></span> if the nights are cold.” She doesn’t count. She looks at the leaf.</p><div class="row"><button class="btn pri" data-act="p1" data-v="taken" data-then="write">Put it in</button><button class="ghost" data-go="write">Cancel</button></div></div>`;
 const p4cls=s==='save-failed'&&u.fail?'mark-left bad':s==='recovered'&&!u.rec?'mark-left lift':'';
 const p4=P('p4',{cls:p4cls,recIns:s==='recovered'&&!u.rec});
 const inl=(s==='write'||s==='select'||s==='speak'||s==='quote');
 const done=s==='finish';
 let mill='';
 if(s==='speak')mill=`<h2>The mill</h2><p>The leaves go to the steamer the same afternoon, ${u.speaking?'<span class="hearing">still cool from the shade. Her son runs the mill now<span class="caret"></span></span>':'still cool from the shade. Her son runs the mill now.'}</p>`;
 const rest=done?`<h2>The mill</h2><p>The leaves go to the steamer the same afternoon, still cool from the shade. Her son runs the mill now. He talks about the straw as if it were weather.</p><h2>What I tasted</h2><p>On the bench she poured the second infusion. It was the colour of wet moss and it tasted of nothing I could name at first, then of broth, then of the morning.</p><h2>Leaving</h2><p>I still do not know whether the straw matters to the tea or only to her. She would say that is the wrong question.</p>`:'';
 const phoneMsg=phoneMessage();
 return `<div class="text">${phoneMsg}<h1>Twenty days of shade</h1>${P('p1',{selNet:s==='select',flagNet:s==='check'?(u.fd==='f2'?'hl':'flag'):'',flagApr:s==='check'?(u.fd==='f1'?'hl':'flag'):''})}${p2}${p3}${inl?prop1(true):''}<h2>The straw</h2>${p4}${P('p5',{noMk:s==='check'||s==='finish'})}${u.p2==='taken'||done?P('p6'):''}${inl?prop2(true):''}${mill}${rest}${done?'':s==='speak'?todo().replace('<li><b>The mill</b>','<li hidden><b>The mill</b>'):todo()}</div>`;
}
/* On a phone the margin cannot sit beside the page, so its one message sits at the top of the page. */
function phoneMessage(){
 const s=S.screen,u=S.ui;let m='';
 if(s==='save-failed'&&u.fail)m=`<p class="says"><b>Not saved.</b> Your words are kept on this phone and will be saved when the app answers.</p><div class="row"><button class="btn pri" data-act="retry">Try again</button></div>`;
 if(s==='recovered'&&!u.rec)m=`<p class="says"><b>Words kept on this phone.</b> The app closed at 13:58 before your last change in The straw was saved.</p><div class="row"><button class="btn pri" data-act="rec" data-v="back">Put them back</button><button class="ghost" data-act="rec" data-v="left">Leave them out</button></div>`;
 if(s==='conflict'&&!u.conf)m=`<p class="says"><b>One paragraph was changed in two places.</b> Both are kept until you choose.</p>`;
 if(s==='history')m=`<p class="says"><b>Earlier versions</b></p>${versions(true)}`;
 if(s==='check')m=checkSummary(true)+findings();
 if(s==='finish')m=finishPanel();
 return m?`<div class="phone-msg">${m}</div>`:'';
}

/* ---------- margins ---------- */
function versions(){
 const u=S.ui;
 const V=[['Today'],['14:06','You used Claude’s words in Opening','Proposed by Claude, chosen by you'],['13:58','Kept on this device when the app closed','Put back by you at 14:01'],['13:40','You typed in The straw','2 sentences'],['13:12','You spoke in Opening','41 words'],['10 Nov'],['18:20','You kept “the rows sit in a green dusk” exact',''],['17:55','You started from your own words','9 sentences from Walking back and 2 notes']];
 return `<ol class="ver">${V.map(v=>v.length===1?`<li class="day">${v[0]}</li>`:`<li class="${u.ver===v[0]?'on':''}"><time>${v[0]}</time><b>${v[1]}</b>${v[2]?`<small>${v[2]}</small>`:''}<div class="row">${u.ver===v[0]?`<button class="btn pri" data-act="bring" data-v="${v[0]}">Bring this back</button><button class="ghost" data-act="ver" data-v="">Close</button>`:`<button class="ghost" data-act="ver" data-v="${v[0]}">Look</button>`}</div></li>`).join('')}</ol>`;
}
function checkSummary(){
 return `<div class="sum"><h3>4 things to look at</h3><p class="quiet">Checked at 14:06 against 6 sources.</p><div class="row"><button class="link" data-go="read-working">Check again</button></div></div>`;
}
const FD=[
 ['f1','warn','Opening, first paragraph','Your note On the train home says the straw went up in <q>early May</q>. The page says <q>the last week of April</q>.',[['Go to it','fd','f1'],['Show the note','showsrc','train']]],
 ['f2','bad','Opening, first paragraph','Nothing in your sources says when black netting came in.',[['It’s what I know','note','Picture only: marks it as your own knowledge. The check stops asking.'],['Show the sources','showsrc','topic']]],
 ['f3','warn','Opening, third paragraph','This sentence came from Claude and you haven’t changed it: <q>What the shade does is simple to say and slow to do.</q>',[['It’s mine now','mine',''],['Rewrite it','go','write']]],
 ['f4','todo','Still to write','Three parts have no words yet: The mill, What I tasted, Leaving.',[['Go to The mill','go','speak']]]];
function findings(){
 const u=S.ui;
 return FD.map(([id,k,where,txt,acts])=>{if(id==='f3'&&u.mine)return `<div class="fd ok"><p class="k">${where}</p><p>You said this sentence is yours. <button class="link" data-act="mine" data-v="0">Undo</button></p></div>`;
  return `<div class="fd ${k==='bad'?'bad':k==='todo'?'':''}${u.fd===id?' on':''}" data-act="fd" data-v="${id}"><p class="k">${where}</p><p>${txt}</p><div class="row">${acts.map(([l,a,v])=>a==='go'?`<button class="btn" data-go="${v}">${l}</button>`:a==='note'?`<button class="btn" data-act="note" data-note="${esc(v)}">${l}</button>`:`<button class="btn" data-act="${a}" data-v="${v}">${l}</button>`).join('')}</div></div>`;}).join('')+
 `<div class="oks"><p class="label">Matches your sources</p><span>${icon('check')}“First you watch” matches the recording at 03:40.</span><span>${icon('check')}“Straw breathes…” matches the recording at 14:32.</span><span>${icon('check')}Your kept words “the rows sit in a green dusk” are unchanged.</span></div>`;
}
function finishPanel(){
 const u=S.ui;
 if(u.fin)return `<div class="fin"><h3>${icon('check')}Finished, 14 Nov</h3><p class="quiet">Kept as the first edition. A change from here makes a second edition; the first stays as it is.</p><div class="steps-mini"><div><span class="st done"></span>The words</div><div><span class="st now"></span>Your yes</div><div><span class="st"></span>Publish</div></div><div class="row"><button class="btn pri lg" data-act="note" data-note="Picture only: opens ${SUBJ} at Share, on the step Your yes.">Go to Share${icon('right')}</button><button class="ghost" data-go="write">Change something</button></div></div>`;
 return `<div class="fin"><h3>Nothing left to look at</h3><ul><li>${icon('check')}All five parts are written.</li><li>${icon('check')}Four quotes match the recording.</li><li>${icon('check')}Your kept words are unchanged.</li><li>${icon('check')}Every sentence is yours or one you chose.</li></ul><div class="row"><button class="btn pri lg" data-act="fin">Mark the Article finished</button></div></div>`;
}
function margin(){
 const s=S.screen,u=S.ui;let h='';
 if(['write','select','speak','quote'].includes(s))h=prop1()+prop2();
 if(s==='proposal-edit')h=`<div class="card on"><h3><span class="mk warm">1</span>Her exact words here?</h3><p class="who">Claude · from Kirihara garden walk at 09:12</p><p class="says">Open in your text. The words in quote marks stay exactly as she said them.</p></div>`+prop2();
 if(s==='history')h=`<div class="mg"><div class="row"><button class="btn" data-act="undo">${icon('undo')}Undo: using Claude’s words</button></div><h3>Earlier versions</h3>${versions()}<p class="quiet">Bringing one back keeps today’s words as a version too.</p></div>`;
 if(s==='check')h=checkSummary()+findings();
 if(s==='finish')h=finishPanel();
 if(s==='conflict')h=u.conf?`<div class="card"><p class="done">${icon('check')}You kept ${u.conf==='both'?'both':'the one written '+(u.conf==='phone'?'on your phone':'here')}. ${u.conf==='both'?'':'The other is in Earlier versions.'} <button class="link" data-act="conf" data-v="">Undo</button></p></div>`:`<div class="card on"><h3>${icon('warn')}Changed in two places</h3><p class="says">You changed the second paragraph on your phone at 14:10 and here at 14:12. Both are kept until you choose. The one you don’t keep stays in Earlier versions.</p></div>`;
 if(s==='recovered')h=u.rec?`<div class="card"><p class="done">${icon('check')}${u.rec==='back'?'Put back and saved, 14:01':'Left out. They are still in Earlier versions.'} <button class="link" data-act="rec" data-v="">Undo</button></p></div>`:`<div class="card on"><h3>Words kept on this device</h3><p class="says">The app closed at 13:58 before your last change in The straw reached the subject.</p><div class="row"><button class="btn pri" data-act="rec" data-v="back">Put them back</button><button class="ghost" data-act="rec" data-v="left">Leave them out</button></div></div>`;
 if(s==='save-failed')h=u.fail?`<div class="card on"><h3>${icon('cloud')}Your words are safe here</h3><p class="says">Every change since 14:06 is kept on this device and will be saved when the app answers. You can keep writing.</p><div class="row"><button class="btn pri" data-act="retry">Try again</button></div></div>`:`<div class="card"><p class="done">${icon('check')}Saved, 14:09</p></div>`;
 if(s==='start')h=``;
 return `<aside class="col mgcol"><div class="mg">${h}</div></aside>`;
}

/* ---------- the screens ---------- */
function writeScreen(){
 const s=S.screen,u=S.ui;
 if(s==='focus')return `<main class="desk3 read"><article class="page">${article()}</article></main>`;
 const noSrc=['check','finish','history','conflict','recovered','save-failed','proposal-edit'].includes(s)&&!u.srcOpen;
 const cls=['desk3',noSrc?'nosrc':'',u.srcOpen?'srcopen':'',u.split?'split':''].join(' ');
 return `<main class="${cls}">${noSrc?'':sources()}<article class="page${s==='history'&&u.ver?' hist':''}">${s==='history'&&u.ver?`<p class="quiet" style="max-width:660px;margin:-30px auto 20px">As it was at ${u.ver}</p>`:''}${article()}</article>${margin()}${noSrc&&u.split?sources():''}</main>`;
}
function startScreen(){
 const g=(part,lines)=>`<h2>${part}${lines?'':''}</h2>${lines?lines.map(([t,w])=>`<p>${t}${src(w,'source')}</p>`).join(''):'<p class="empty-part">Nothing of yours for this part yet.</p>'}`;
 return `<main class="desk3 nomg${S.ui.split?' split':''}">${sources()}<article class="page"><div class="text"><h1>Twenty days of shade</h1>
 <div class="start-ways"><button class="btn pri lg" data-go="write">Start from your own words</button><button class="btn lg" data-go="speak">${icon('mic')}Speak</button><button class="btn lg" data-act="note" data-note="Picture only: puts the cursor on the empty page under the title.">Type</button></div>
 <div class="gathered"><p class="quiet" style="margin-bottom:6px">9 sentences you said or wrote, in the order of your plan. Mrs. Oda’s words stay in Sources, ready to quote.</p>
 ${g('Opening',[['The straw goes up by hand, pole by pole, until the rows sit in a green dusk.','Walking back 00:40'],['I came to help and she handed me a cup.','Walking back 01:15'],['She never looked at the clock once.','On the train home']])}
 ${g('The straw',[['Netting is cheaper, one person can hang it in a morning. She still does straw.','Walking back 02:30'],['Why still the straw?','Kirihara garden walk 14:20']])}
 ${g('The mill',[['Ask about the mill.','On the train home']])}
 ${g('What I tasted',[['Second infusion, colour of wet moss. Broth, then morning.','Tasting, second infusion']])}
 ${g('Leaving',[['I don’t know if the straw matters to the tea or only to her.','Walking back 05:10']])}
 </div></div></article></main>`;
}
function readScreen(){
 const u=S.ui;
 const rp=(id,html)=>`<p class="read-para${u.para===id?' on':''}" data-act="para" data-v="${id}">${html}</p>${u.para===id?`<div class="para-act"><button class="btn" data-go="write">Change this</button><button class="ghost" data-act="note" data-note="Picture only: a note to yourself beside this paragraph.">Note to self</button></div>`:''}`;
 const strip=h=>h.replace(/<span class="q-src"[^]*?<\/span>/g,'').replace(/<button class="mk[^]*?<\/button>/g,'').replace(/class="(kept|taken)"/g,'').replace(/<svg[^]*?<\/svg>/g,'');
 return `<main class="desk3 read"><article class="page"><div class="text"><h1>Twenty days of shade</h1><figure><div class="lead-photo" role="img" aria-label="Straw screens over the rows at dawn (drawn)"></div><figcaption class="cap">Straw screens over the rows at dawn.</figcaption></figure>
 ${rp('p1',strip(para('p1',{})))}${rp('p2',strip(para('p2',{})))}${rp('p3',strip(para('p3',{noMk:1})))}<h2>The straw</h2>${rp('p4',strip(para('p4',{})))}${rp('p5',strip(para('p5',{noMk:1})))}
 <div class="read-end"><p>Three parts are not written yet: The mill, What I tasted, Leaving.</p><div class="row"><button class="btn pri lg" data-go="check">Next: Check</button><button class="ghost" data-go="write">Back to writing</button></div></div></div></article></main>`;
}
function carouselScreen(){
 const u=S.ui;
 const SL=[['Cover','Twenty days of shade','linear-gradient(170deg,#5d6b43,#212817)','Fits'],['Slide 2','Bamboo, reed, then straw, scattered by hand.','linear-gradient(170deg,#9a8a6a,#3e3526)','Fits'],['Slide 3','<span class="kept">“Straw breathes.”'+lockI+'</span>'+src('14:32'),'linear-gradient(170deg,#455646,#1b241c)','Fits · exact, from the recording'],['Slide 4',u.c4==='taken'?'The leaf goes dark and soft.':'In twenty days of shade the leaf goes dark, soft and sweet, and the bitterness never comes.','linear-gradient(170deg,#7d6447,#2f2418)',u.c4==='taken'?'Fits':'Two lines too long for this layout'],['Close','Read the whole piece in the magazine.','linear-gradient(170deg,#58533f,#1f1d16)','Fits']];
 const c4=u.c4==='taken'?`<div class="card"><p class="who">Slide 4 · Claude</p><p class="done">${icon('check')}You used it, 14:12 <button class="link" data-act="c4" data-v="">Undo</button></p></div>`:u.c4==='left'?`<div class="card"><p class="who">Slide 4 · Claude</p><p class="done" style="color:var(--dim)">You left it. <button class="link" data-act="c4" data-v="">Undo</button></p></div>`:`<div class="card on"><h3><span class="mk warm">1</span>Shorter words for slide 4</h3><p class="who">Claude · cut from your own sentence in the Article</p><p class="prop"><del>In twenty days of shade the leaf goes dark, soft and sweet, and the bitterness never comes.</del> <ins>The leaf goes dark and soft.</ins></p><div class="row"><button class="btn pri" data-act="c4" data-v="taken">Use it</button><button class="btn" data-act="note" data-note="Picture only: opens these words on slide 4 for you to change first.">Change it first</button><button class="ghost" data-act="c4" data-v="left">Leave it</button></div></div>`;
 const studio=`<div class="card"><h3>${icon('slides')}The slides</h3><p class="says">5 slides in the Teajiā look. Layouts, photographs and marks are in the slide studio; the words are the same words as here.</p><div class="row"><button class="btn" data-act="note" data-note="Picture only: opens version two's slide studio on this Carousel, at the slide you are on.">Open the slide studio${icon('right')}</button></div></div>`;
 return `<main class="desk3${u.srcOpen?' srcopen':''}${u.split?' split':''}">${sources()}<article class="page"><div class="text">
 <section class="post"><p class="label" style="margin-bottom:8px">Post text</p><p style="font:400 var(--t18)/1.65 var(--prose)">Twenty days under straw. Mrs. Oda still shades her tea the old way, pole by pole and armful by armful, because <span class="kept">straw breathes${lockI}</span> and netting only takes the light away. The whole story is in the magazine.</p><p class="count">214 of 2,200 characters</p></section>
 <p class="label" style="margin-bottom:12px">On each slide</p>
 <ol class="slides-words">${SL.map(([k,w,bg,fit],i)=>`<li class="sw"><div class="slide" style="--sbg:${bg}"><small>${i===0?'TEAJIĀ':''}</small><b>${w.replace(/<span class="q-src"[^]*?<\/span>/,'').replace(/<svg[^]*?<\/svg>/,'').replace(/<[^>]+>/g,'')}</b></div><div><p class="k"><span>${k}</span></p><p>${w}</p><p class="fit${/long/.test(fit)?' warn':''}">${fit}</p>${i===3?`<div class="inline-card${u.c4?'':' on'}" style="margin-top:12px">${c4.replace(/^<div class="card[^"]*">/,'').replace(/<\/div>$/,'')}</div>`:''}</div></li>`).join('')}</ol>
 </div></article><aside class="col mgcol"><div class="mg">${c4}${studio}</div></aside></main>`;
}

/* ---------- render ---------- */
function mockStrip(){return `<nav class="mock" aria-label="Mock-up screens"><b>Mock-up, not part of the design</b>${SCREENS.map(([id,n])=>`<a href="#${id}"${S.screen===id?' aria-current="page"':''}>${n}</a>`).join('')}<a href="#" data-act="theme">Light / dark</a><span class="mock-note" id="mock-note">${esc(S.noteText||'')}</span></nav>`;}
function render(){
 const s=S.screen;
 document.documentElement.classList.toggle('focus',s==='focus');
 let body='';
 if(s==='start')body=startScreen();
 else if(s==='read'||s==='read-working')body=readScreen();
 else if(s==='carousel')body=carouselScreen();
 else body=writeScreen();
 $('#app').innerHTML=mockStrip()+top()+pbar()+body+phonebar();
 const l2=document.querySelector('.line2');if(l2)l2.hidden=!matchMedia('(max-width:850px)').matches;
}
function note(t){S.noteText=t;const n=$('#mock-note');if(n)n.textContent=t;}
function go(id){if(location.hash==='#'+id||(!location.hash&&id==='write')){note('Already open here.');}else location.hash=id;}
function applyDefaults(){
 const u=S.ui,s=S.screen;
 if(s==='start')u.src='memo';
 if(s==='speak'){u.p1='taken';}
 if(s==='history'){u.p1='taken';u.ver='';}
 if(s==='finish'){u.p1='taken';u.p2='taken';u.mine=true;}
 if(s==='check'){u.fd='f1';}
 if(s==='quote'){u.p1='taken';u.split=true;}
 if(s==='save-failed')u.fail=true;
 if(s==='write'||s==='select'||s==='proposal-edit'){}
}
function route(){
 const id=(location.hash||'#write').slice(1).split('?')[0];
 S.screen=SCREENS.some(x=>x[0]===id)?id:'write';S.ui=fresh();S.noteText='';applyDefaults();render();scrollTo(0,0);
}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-go],[data-act]');if(!el)return;
 if(!el.dataset.act){e.preventDefault();go(el.dataset.go);return;}
 {const a=el;
  const act=a.dataset.act,v=a.dataset.v,u=S.ui;
  e.preventDefault();
  switch(act){
   case 'note':note(a.dataset.note);return;
   case 'theme':setTheme(S.theme==='dark'?'light':'dark');return;
   case 'p1':u.p1=v;if(a.dataset.then){go(a.dataset.then);setTimeout(()=>{S.ui.p1=v;render();},0);return;}break;
   case 'p2':u.p2=v;break;
   case 'c4':u.c4=v;break;
   case 'conf':u.conf=v||null;break;
   case 'rec':u.rec=v||null;break;
   case 'retry':u.fail=false;break;
   case 'fin':u.fin=true;break;
   case 'mine':u.mine=v!=='0';break;
   case 'src':u.src=u.src===a.dataset.id?'':a.dataset.id;break;
   case 'srcToggle':u.srcOpen=!u.srcOpen;break;
   case 'split':u.split=!u.split;break;
   case 'showsrc':u.srcOpen=true;u.src=v;break;
   case 'fd':u.fd=v;render();{const t=document.getElementById(v==='f3'?'p3':'p1');if(t)t.scrollIntoView({block:'center'});}note('The words this finding is about are marked in the text.');return;
   case 'para':u.para=u.para===v?null:v;break;
   case 'ver':u.ver=v;break;
   case 'bring':u.ver='';note('Brought back the version from '+v+'. Today’s words are kept as a version too.');break;
   case 'keep':note('Kept exact: “the black netting came”. Nobody, you included, changes these words without first undoing Keep exact.');S.screen='write';break;
   case 'undo':if(u.p1==='taken'){u.p1='wait';note('Undone: using Claude’s words in Opening.');}else note('Undo takes back your last change. Nothing to undo in this picture.');break;
   case 'speak':if(S.screen==='speak'){u.speaking=!u.speaking;if(!u.speaking)note('Stopped. What you said is in The mill as your words, marked “You, spoken” in Earlier versions.');}else{go('speak');return;}break;
   case 'quote':u.p1='taken';u.quoted=true;note('Quoted at the cursor: her words from '+a.dataset.at+', in quote marks, linked to the recording.');if(S.screen!=='quote'){go('quote');return;}break;
   case 'fd-none':note('This number matches a proposal beside the page.');return;
  }
  render();}
});
function setTheme(t){S.theme=t;document.documentElement.dataset.theme=t;try{localStorage.setItem('arw-theme',t);}catch{}}
let t='dark';try{t=localStorage.getItem('arw-theme')||'dark';}catch{}
const q=new URLSearchParams(location.search);if(q.get('theme'))t=q.get('theme');if(q.get('shot'))document.documentElement.classList.add('shot');
setTheme(t);
addEventListener('hashchange',route);addEventListener('resize',()=>{const l2=document.querySelector('.line2');if(l2)l2.hidden=!matchMedia('(max-width:850px)').matches;});
route();
})();
