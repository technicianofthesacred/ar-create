/* Design round, November 2026: the invented story, generated pictures and small behaviours shared by the three
   mock-up directions. Everything here is made up for the mock-ups. Nothing reads or writes the app. */
(function(){
const K=window.K={};
const esc=K.esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- the invented story ---------- */
K.subject={name:'Mrs. Oda’s shaded garden',short:'Mrs. Oda’s garden',piece:'Twenty days of shade',saved:'10 Nov, 13:52',words:212};
K.stages=[
 {id:'gather',name:'Gather',sections:['Material','Source'],says:'What went in'},
 {id:'develop',name:'Develop',sections:['Research','Direction'],says:'What you understand'},
 {id:'make',name:'Make',sections:['Write','Read','Check','Media','Arrange'],says:'What you are making'},
 {id:'deliver',name:'Deliver',sections:['Audience','Share','Outputs'],says:'Where it goes'}];
K.subjects=[
 {id:'oda',name:K.subject.name,stage:2,cover:'shade',photos:['shade','hands','mill','kettle','ridge','cup'],has:'1 recording · 3 notes · 6 photographs',
  line:'Netting is cheaper and one person can hang it in a morning. I asked why she still bothers with straw.',
  stands:'Article half written · Carousel of 5 slides',next:'Continue writing',go:'write',waiting:'2 proposals and 1 question waiting',saved:'Today, 13:52',pieces:['page','slides']},
 {id:'potter',name:'The potter’s unglazed cups',stage:3,cover:'clay',photos:['clay','cup','hands'],has:'2 recordings · 5 notes · 14 photographs',
  line:'He will not glaze the inside, and he will not explain why until you have drunk from one.',
  stands:'Article finished and checked · Carousel of 7 slides',next:'See it as the audience',saved:'6 Nov',pieces:['page','slides']},
 {id:'springs',name:'Three springs: water for tea',stage:1,cover:'spring',photos:['spring','kettle'],has:'2 notes · 1 link · 2 photographs',
  line:'Research is ready: five findings. You have not written a direction yet.',
  stands:'Research ready · no direction yet',next:'Write my direction',saved:'8 Nov',pieces:[]},
 {id:'market',name:'Night market tea stall',stage:0,cover:'market',photos:['market','cup','kettle','hands'],has:'1 recording · 4 photographs',
  line:'The transcript of the 18 minute recording is ready to read.',
  stands:'Transcript ready to read',next:'Read the transcript',saved:'9 Nov',pieces:[]},
 {id:'winter',name:'Winter storage',stage:-1,cover:null,photos:[],has:'Nothing added yet',line:'A new subject. Nothing has been added yet.',stands:'New',next:'Add material',go:'new-subject',saved:'Today',pieces:[]}];
K.published={name:'First flush diary',cover:'flush',when:'Published 28 Oct 2026'};
K.question={who:'Claude',about:'Article, “The straw”',
 text:'In the recording Mrs. Oda says “my grandmother’s straw”. Your note says the method came from her mother-in-law. Which should the writing follow?',
 options:[{id:'rec',label:'Her words in the recording',hint:'“My grandmother’s straw”, at 14:48'},{id:'note',label:'My note',hint:'“her mother-in-law”'},{id:'skip',label:'Leave it out for now',hint:''}],
 fallback:'Until you answer, Claude keeps this line out of its proposals.'};
K.sources=[
 {id:'rec',kind:'Recording',name:'Kirihara garden walk',meta:'42 min · 2 speakers · transcript read',icon:'mic'},
 {id:'n1',kind:'Your note',name:'On the train home',meta:'The cup she gave me first was not her best tea. It was the one she drinks.',icon:'note'},
 {id:'n2',kind:'Your note',name:'Questions I forgot to ask',meta:'Who taught her the straw: her grandmother or her mother-in-law? How many pickers in May?',icon:'note'},
 {id:'n3',kind:'Your note',name:'Tasting, second infusion',meta:'Sweet like steamed greens, then something like the sea. No bitterness at all.',icon:'note'}];
K.photos=[['shade','Straw shades at dawn'],['hands','Her hands sorting leaf'],['mill','The stone mill'],['kettle','Steam over the kettle'],['ridge','Rows from the ridge'],['cup','Cup on the bench']];
K.loose={name:'Voice note, 10 Nov',meta:'0:48 · not in a subject yet'};
K.transcript=[
 {t:'09:12',who:'Mrs. Oda',text:'Twenty days. Twenty-two if the nights are cold. You don’t count, you look at the leaf.',link:'p1'},
 {t:'09:31',who:'You',text:'What do you look for?'},
 {t:'09:36',who:'Mrs. Oda',text:'It goes dark, like wet stone. And soft. When it feels like an earlobe, it is ready.'},
 {t:'14:20',who:'You',text:'Netting would be so much less work. Why still the straw?'},
 {t:'14:27',who:'Mrs. Oda',text:'Straw breathes. The dew comes through. And it falls apart slowly, so it feeds the bushes it was shading.',link:'p2'},
 {t:'14:48',who:'Mrs. Oda',text:'My grandmother’s straw, my straw. The net only takes the light away.',link:'p2'}];
K.direction='Shade is patience you can taste. Tell it through one morning of watching, in her words where I can.';
K.findings=[
 {text:'She decides by touching the leaf, not by counting days.',from:'Recording, 09:36',kind:'Her words'},
 {text:'About twenty days of shade keeps the sweetness in the leaf and the bitterness down.',from:'2 outside sources',kind:'Outside evidence'},
 {text:'Straw shading is now rare. Most gardens hang black netting.',from:'1 outside source',kind:'Outside evidence'}];
K.article={title:'Twenty days of shade',body:[
 {id:'a1',t:'p',text:'The straw goes up in the last week of April. Mrs. Oda does it the way it was done before the black netting came: bamboo poles, reed screens, then rice straw scattered by hand until the rows sit in a green dusk.'},
 {id:'a2',t:'p',text:'I arrived at six, expecting to help. She handed me a cup instead and pointed at the bench. “First you watch,” she said. So I watched the light change under the screens for most of an hour.'},
 {id:'a3',t:'p',text:'What the shade does is simple to say and slow to do. The bush, starved of sun, holds on to what would have turned bitter. The leaf goes dark and soft. ',tail:'Twenty days, she says, sometimes twenty-two if the nights stay cold.',prop:'p1'},
 {id:'h1',t:'h',text:'The straw'},
 {id:'a4',t:'p',text:'Netting is cheaper and one person can hang it in a morning. I asked why she still bothers with straw.',after:'p2'}],
 todo:['The mill','What I tasted','Leaving']};
K.props={
 p1:{kind:'Change',label:'Use her exact words',why:'From the recording at 09:12',time:'09:12',text:'“Twenty days,” she says. “Twenty-two if the nights are cold. You don’t count, you look at the leaf.”'},
 p2:{kind:'New paragraph',label:'A paragraph for “The straw”',why:'Drafted from the recording, 14:27 to 14:48. Every sentence is hers.',time:'14:27',text:'She laughed. Straw breathes, she said. The dew comes through, and it falls apart slowly, so it feeds the bushes it was shading. “The net only takes the light away.”'}};
K.slidesData=[
 {k:'cover',photo:'shade',eye:'Mrs. Oda’s shaded garden',text:'Twenty days of shade'},
 {k:'words',eye:'One',text:'“First you watch.”'},
 {k:'half',photo:'hands',text:'The leaf goes dark, like wet stone.'},
 {k:'words',eye:'Three',text:'Straw breathes. The net only takes the light away.'},
 {k:'words',eye:'Four',text:'Twenty days. Twenty-two if the nights are cold.'}];

/* ---------- state ---------- */
const S=K.state={view:'home',answer:null,props:{p1:'pending',p2:'pending'},capture:null,captured:null,attached:false,newForm:false,newName:'Winter storage',ui:{}};
K.pending=()=>Object.values(S.props).filter(v=>v==='pending').length;

/* ---------- icons ---------- */
const I={home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',library:'<path d="M4 4v16M9 4v16M14 5l5 15"/>',mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',note:'<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5"/>',photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5-8 9"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 5 5 9-10"/>',right:'<path d="M5 12h14M13 6l6 6-6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',chev:'<path d="m9 6 6 6-6 6"/>',back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.500 17.500 19 19M19 5l-1.500 1.500M6.500 17.500 5 19"/>',undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',eye:'<path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',share:'<path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6"/>',layers:'<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',pen:'<path d="M4 20h4L20 8l-4-4L4 16z"/>',book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 0 2 2h13"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',spark:'<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/>',ask:'<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9.500a2 2 0 1 1 2.600 1.900c-.4.200-.6.500-.6 1M12 14h.010"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',focus:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',side:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',film:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',play:'<path d="M7 5l12 7-12 7z"/>'};
K.icon=(n,c='')=>`<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]||''}</svg>`;

/* ---------- generated photographs (drawn shapes, never real pictures) ---------- */
let uid=0;
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const scenes={
 shade:u=>`<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3524"/><stop offset=".4" stop-color="#b3924e"/><stop offset=".56" stop-color="#55633a"/><stop offset="1" stop-color="#131c11"/></linearGradient><pattern id="p${u}" width="6" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(84)"><rect width="6" height="80" fill="#4d3f22"/><rect width="2.500" height="80" fill="#c7a862"/><rect x="4" width="1" height="80" fill="#8a713c"/></pattern><filter id="b${u}"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/><circle cx="292" cy="126" r="52" fill="#ffe9ad" opacity=".7" filter="url(#b${u})"/><path d="M-10-4H410V70L-10 98Z" fill="url(#p${u})"/><path d="M-10 98 410 70v7L-10 106Z" fill="#1f190e" opacity=".7"/><path d="M250 76h70l-90 230H110Z" fill="#ffe9ad" opacity=".13"/><path d="M120 86h40L60 306H-20Z" fill="#ffe9ad" opacity=".08"/><rect x="84" y="92" width="5" height="210" fill="#231c10"/><rect x="330" y="76" width="5" height="226" fill="#231c10"/><ellipse cx="200" cy="196" rx="270" ry="13" fill="#3d5630"/><ellipse cx="170" cy="190" rx="200" ry="5" fill="#86a253" opacity=".55"/><ellipse cx="200" cy="228" rx="280" ry="19" fill="#2b4124"/><ellipse cx="230" cy="219" rx="210" ry="6" fill="#6f8d48" opacity=".45"/><ellipse cx="200" cy="274" rx="300" ry="30" fill="#1b2c18"/><ellipse cx="160" cy="258" rx="230" ry="8" fill="#4f6d38" opacity=".4"/>`,
 hands:u=>{const r=mul(7);let leaf='';for(let i=0;i<70;i++){const a=r()*6.28,d=Math.sqrt(r())*86,x=200+Math.cos(a)*d,y=150+Math.sin(a)*d*.92;leaf+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(5+r()*6).toFixed(1)}" ry="2.400" transform="rotate(${(r()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${['#2f4a27','#3f5e2e','#557538','#22381d'][i%4]}"/>`;}
  return `<defs><radialGradient id="a${u}" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#6d5234"/><stop offset="1" stop-color="#261b11"/></radialGradient><filter id="b${u}"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/><circle cx="200" cy="154" r="118" fill="#1b130b" opacity=".5" filter="url(#b${u})"/><circle cx="200" cy="150" r="112" fill="#b8975c"/><circle cx="200" cy="150" r="112" fill="none" stroke="#8a6b3a" stroke-width="7"/><circle cx="200" cy="150" r="96" fill="#c9aa70"/>${leaf}<path d="M-20 250c60-40 110-50 150-30 20 10 14 34-10 40L-20 310Z" fill="#c69a78"/><path d="M420 40c-60 10-110 40-128 78-8 18 12 30 32 18l96-50Z" fill="#b98b6a"/>`;},
 mill:u=>`<defs><radialGradient id="a${u}" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#4a4a44"/><stop offset="1" stop-color="#151512"/></radialGradient><filter id="b${u}"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/><ellipse cx="200" cy="176" rx="150" ry="96" fill="#0d0d0b" opacity=".6" filter="url(#b${u})"/><ellipse cx="200" cy="170" rx="140" ry="88" fill="#6c6b63"/><ellipse cx="200" cy="170" rx="140" ry="88" fill="none" stroke="#7fa055" stroke-width="5" opacity=".8"/><ellipse cx="200" cy="150" rx="118" ry="72" fill="#8b897f"/><ellipse cx="200" cy="146" rx="118" ry="72" fill="#a09d92"/><ellipse cx="200" cy="146" rx="86" ry="52" fill="none" stroke="#8b897f" stroke-width="2"/><ellipse cx="200" cy="146" rx="18" ry="11" fill="#3a3933"/><rect x="286" y="96" width="92" height="12" rx="6" fill="#7a5630" transform="rotate(-14 286 96)"/><rect x="290" y="92" width="12" height="52" rx="5" fill="#5f4224"/>`,
 kettle:u=>`<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14120f"/><stop offset=".7" stop-color="#2a1c12"/><stop offset="1" stop-color="#7a3d16"/></linearGradient><filter id="b${u}"><feGaussianBlur stdDeviation="10"/></filter><filter id="c${u}"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/><ellipse cx="200" cy="300" rx="190" ry="40" fill="#f08a3c" opacity=".55" filter="url(#b${u})"/><path d="M150 40c-30 30 30 50 0 90M205 20c-34 36 30 60-4 104M252 48c-26 26 22 44 0 80" stroke="#efe9dc" stroke-width="16" fill="none" opacity=".34" filter="url(#b${u})"/><path d="M128 250c-22-40-10-92 72-92s94 52 72 92Z" fill="#0b0a09"/><ellipse cx="200" cy="160" rx="56" ry="10" fill="#201d19"/><circle cx="200" cy="150" r="8" fill="#0b0a09"/><path d="M270 196c26-6 40-26 52-44" stroke="#0b0a09" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M146 160c0-70 108-70 108 0" stroke="#0b0a09" stroke-width="7" fill="none"/><path d="M150 214c26 10 76 10 100 0" stroke="#3a322a" stroke-width="2" fill="none" filter="url(#c${u})"/>`,
 ridge:u=>`<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd6cf"/><stop offset=".5" stop-color="#9fb0a2"/><stop offset="1" stop-color="#2c4428"/></linearGradient><filter id="b${u}"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/><path d="M0 120c60-40 120-30 180-52s130 6 220 30V300H0Z" fill="#8ea398" filter="url(#b${u})"/><path d="M0 150c80-30 150-8 220-30s120 0 180 20V300H0Z" fill="#5f7c66"/><path d="M0 178c90-22 190-26 400 6V300H0Z" fill="#3b5a37"/>${[0,1,2,3,4,5,6].map(i=>`<path d="M-20 ${200+i*17}c120-${26-i*2} 300-${22-i*2} 440 ${8+i*3}" stroke="${i%2?'#27401f':'#58793f'}" stroke-width="${9+i*1.500}" fill="none"/>`).join('')}`,
 cup:u=>`<defs><linearGradient id="a${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d4127"/><stop offset=".5" stop-color="#7b5733"/><stop offset="1" stop-color="#4a321d"/></linearGradient><radialGradient id="t${u}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#b9c66a"/><stop offset="1" stop-color="#5e7a2c"/></radialGradient><filter id="b${u}"><feGaussianBlur stdDeviation="8"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/>${[58,122,190,252].map(y=>`<rect y="${y}" width="400" height="2" fill="#2e1e10" opacity=".7"/>`).join('')}<path d="M0 90c120 10 240-12 400 4" stroke="#8c6840" stroke-width="1.500" fill="none" opacity=".6"/><ellipse cx="236" cy="176" rx="96" ry="88" fill="#1c120a" opacity=".55" filter="url(#b${u})"/><circle cx="214" cy="152" r="84" fill="#e9e2d0"/><circle cx="214" cy="152" r="72" fill="#d6cdb8"/><circle cx="214" cy="152" r="66" fill="url(#t${u})"/><ellipse cx="190" cy="126" rx="26" ry="12" fill="#eef3c4" opacity=".35" transform="rotate(-28 190 126)"/>`,
 market:u=>{const r=mul(21);let b='';for(let i=0;i<16;i++)b+=`<circle cx="${(r()*400).toFixed(0)}" cy="${(20+r()*150).toFixed(0)}" r="${(8+r()*20).toFixed(0)}" fill="${['#f2b25c','#e8743c','#f6d48a','#d9483a'][i%4]}" opacity="${(.35+r()*.4).toFixed(2)}"/>`;
  return `<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10131f"/><stop offset="1" stop-color="#241a16"/></linearGradient><filter id="b${u}"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/><g filter="url(#b${u})">${b}</g><path d="M40 176h320l-22 26H62Z" fill="#7b2f22"/>${[0,1,2,3,4,5,6].map(i=>`<path d="M${62+i*46} 176h23l-3 26h-23Z" fill="#e6dccb" opacity=".85"/>`).join('')}<rect x="62" y="202" width="276" height="98" fill="#17120f"/><rect x="92" y="226" width="216" height="10" fill="#3a2a1c"/>${[120,170,220,270].map(x=>`<ellipse cx="${x}" cy="224" rx="13" ry="6" fill="#d9cfbb"/>`).join('')}<circle cx="200" cy="150" r="30" fill="#ffd591" opacity=".25" filter="url(#b${u})"/>`;},
 spring:u=>`<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25322f"/><stop offset="1" stop-color="#6f8f8a"/></linearGradient><filter id="b${u}"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/><ellipse cx="90" cy="92" rx="120" ry="64" fill="#3c4a45"/><ellipse cx="330" cy="70" rx="110" ry="70" fill="#2f3b37"/><ellipse cx="60" cy="250" rx="110" ry="60" fill="#46554f"/><ellipse cx="350" cy="262" rx="120" ry="58" fill="#35423d"/><ellipse cx="90" cy="76" rx="70" ry="22" fill="#6c8a52" opacity=".5"/><g filter="url(#b${u})" stroke="#e4f1ee" fill="none" stroke-linecap="round"><path d="M150 150c40-12 80 10 120 0" stroke-width="3" opacity=".7"/><path d="M130 184c50-14 110 12 170-2" stroke-width="2.500" opacity=".5"/><path d="M170 214c30-8 60 6 96 0" stroke-width="2" opacity=".5"/><path d="M196 0c-8 60 10 90 4 140" stroke-width="9" opacity=".55"/></g>`,
 clay:u=>`<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b0a2"/><stop offset=".62" stop-color="#8d8375"/><stop offset=".63" stop-color="#4d3b2b"/><stop offset="1" stop-color="#2f241a"/></linearGradient><filter id="b${u}"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="400" height="300" fill="url(#a${u})"/>${[[70,'#a0603c'],[170,'#8a5132'],[270,'#b06f48']].map(([x,c])=>`<ellipse cx="${x+38}" cy="192" rx="46" ry="9" fill="#1d150e" opacity=".5" filter="url(#b${u})"/><path d="M${x} 112h76l-8 70c-2 10-58 10-60 0Z" fill="${c}"/><ellipse cx="${x+38}" cy="112" rx="38" ry="9" fill="#3b2516"/><path d="M${x+8} 122l5 52" stroke="#e0b089" stroke-width="3" opacity=".35"/>`).join('')}`,
 flush:u=>{const r=mul(5);let l='';for(let i=0;i<40;i++){const x=r()*400,y=r()*300;l+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(22+r()*22).toFixed(0)}" ry="${(8+r()*6).toFixed(0)}" transform="rotate(${(r()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${['#4f7d33','#6a9a3f','#8dbb52','#3a6328','#a7cf68'][i%5]}"/>`;}
  return `<rect width="400" height="300" fill="#2c4a22"/>${l}`;}};
K.photo=(key,label)=>`<svg class="ph" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label||'Drawn stand-in for a photograph')}">${(scenes[key]||scenes.shade)(++uid)}</svg>`;
K.pic=(key,label,cls='')=>`<span class="pic ${cls}">${K.photo(key,label)}</span>`;
K.slide=i=>{const d=K.slidesData[i];return `<div class="sl ${d.k}">${d.photo?K.photo(d.photo,'Slide photograph'):''}<span>${d.eye?`<i>${esc(d.eye)}</i>`:''}<b>${esc(d.text)}</b></span></div>`;};
K.slides=()=>K.slidesData.map((_,i)=>K.slide(i)).join('');
K.page=()=>{const a=K.article;return `<div class="pg"><div><h5>${esc(a.title)}</h5>${a.body.map(b=>b.t==='h'?`<h6>${esc(b.text)}</h6>`:`<p>${esc(b.text+(b.tail||''))}</p>`).join('')}</div></div>`;};
K.pageDone=()=>`<div class="pg"><div><h5>The potter’s unglazed cups</h5><p>He will not glaze the inside, and he will not explain why until you have drunk from one.</p>${'<u></u>'.repeat(26)}</div></div>`;
K.wave=(seed=3,n=64,played=.34)=>{const r=mul(seed);let h='';for(let i=0;i<n;i++){const v=.18+Math.abs(Math.sin(i*.37+seed))*.5*r()+r()*.32;h+=`<s style="height:${Math.round(Math.min(1,v)*100)}%"${i/n<played?' class="on"':''}></s>`;}return `<span class="wave" aria-hidden="true">${h}</span>`;};

/* ---------- capture sheet (phone first, also works on a computer) ---------- */
K.newSheet=()=>S.newForm?`<div class="scrim" data-act="new-form:close"><form class="sheet" data-stop><h3>New subject</h3><label class="to" for="new-subject-name">Subject name</label><input class="field lg" id="new-subject-name" value="${esc(S.newName)}"><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn lg ghost" type="button" data-act="new-form:close">Cancel</button><button class="btn lg pri" type="submit">Create subject</button></div></form></div>`:'';
K.captureSheet=()=>{if(!S.capture)return '';const to=S.capture==='home'?'Inbox, to file later':K.subject.name;
 const body=S.captured?`<div class="cap-done">${K.icon('check')}<span><b>${esc(S.captured)}</b> added to ${esc(to)}.</span><button class="btn" data-act="captured-undo">Undo</button><button class="btn pri" data-act="capture-close">Done</button></div>`
  :`<div class="cap3"><button class="rec" data-act="captured:Voice note">${K.icon('mic')}Speak</button><button data-act="captured:Photograph">${K.icon('photo')}Photograph</button><button data-act="captured:Thought">${K.icon('pen')}Write a thought</button></div>`;
 return `<div class="scrim" data-act="capture-close"><div class="sheet" role="dialog" aria-label="Capture" data-stop><h3>Capture</h3><p class="to">Goes to <b>${esc(to)}</b>. It joins the subject’s one list of sources.</p>${body}</div></div>`;};

/* ---------- routing, actions, render ---------- */
const VIEWS=['home','subject','new-subject','write','focus'];
const acts={
 go:v=>{location.hash=v;if(S.view===v)paint();},
 theme:()=>{const dark=matchMedia('(prefers-color-scheme:dark)').matches,cur=document.documentElement.dataset.theme||(dark?'dark':'light');document.documentElement.dataset.theme=cur==='dark'?'light':'dark';paint(true);},
 answer:id=>{S.answer=id;paint(true);},'answer-undo':()=>{S.answer=null;paint(true);},
 prop:(id,what)=>{S.props[id]=what==='undo'?'pending':what;paint(true);},
 capture:w=>{S.capture=w||'subject';S.captured=null;paint(true);},'capture-close':()=>{S.capture=null;paint(true);},
 captured:k=>{S.captured=k;paint(true);},'captured-undo':()=>{S.captured=null;paint(true);},
 attach:v=>{S.attached=v!=='undo';paint(true);},
 'new-form':v=>{S.newForm=v!=='close';paint(true);const f=document.getElementById('new-subject-name');if(f&&S.newForm)f.focus();},
 create:()=>{const f=document.getElementById('new-subject-name');S.newName=(f&&f.value.trim())||S.newName;S.newForm=false;K.subjects[4].name=S.newName;acts.go('new-subject');},
 ui:(k,v)=>{S.ui[k]=S.ui[k]===v?null:v;paint(true);},
 set:(k,v)=>{S.ui[k]=v;paint(true);},
 src:()=>{const cur=S.ui.src||'auto',open=cur==='open'||(cur==='auto'&&innerWidth>850);S.ui.src=open?'closed':'open';paint(true);},
 noop:()=>{}};
K.on=(name,fn)=>{acts[name]=fn;};
K.paint=keep=>paint(keep);
function paint(keep){const y=scrollY;const app=K.app;if(!app)return;
 document.getElementById('app').innerHTML=app.render(S)+(app.captureSheet||K.captureSheet)();
 document.getElementById('mock').innerHTML=`<b>Mock-up · ${esc(app.title)}</b>${(app.screens||[['home','Home'],['subject','Subject'],['new-subject','New subject'],['write','Write'],['focus','Write, in focus']]).map(([v,l])=>`<a href="#${v}"${S.view===v?' aria-current="page"':''}>${l}</a>`).join('')}<span class="sp"></span><button data-act="theme">Light / dark</button>`;
 document.body.dataset.view=S.view;scrollTo(0,keep?y:0);}
function route(){const v=location.hash.slice(1);S.view=((K.app&&K.app.screens)?K.app.screens.map(x=>x[0]):VIEWS).includes(v)?v:'home';S.capture=null;paint();}
addEventListener('hashchange',route);
document.addEventListener('click',e=>{const t=e.target.closest('[data-act],[data-stop]');if(!t||t.hasAttribute('data-stop')&&!t.dataset.act)return;e.preventDefault();const [n,...a]=t.dataset.act.split(':');(acts[n]||acts.noop)(...a);});
document.addEventListener('submit',e=>{e.preventDefault();acts.create();});
K.start=app=>{K.app=app;route();};
})();
