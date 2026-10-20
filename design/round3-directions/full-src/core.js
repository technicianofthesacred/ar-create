    const go=(v,extra)=>()=>{const pieceV=['write','read','check','media','arrange','audience','share'];const o={view:v,returned:false,panel:s.panel==='uses'?null:s.panel};if(pieceV.indexOf(s.view)>=0&&['source','research','thoughts','direction','library'].indexOf(v)>=0)o.ret={view:s.view,piece:s.pieceId};self.set(Object.assign(o,extra||{}));};
    const T=(t)=>()=>self.set({toast:t});
    const st=s.st;
    const P={water:'Water first',mend:'Mending',yix:'Yixing clay notes',night:'Night market teas'};
    const TOP={tw:{t:'Why water changes tea',p:['water'],n:9},tc:{t:'Clay and teapots',p:['yix'],n:74},tm:{t:'Keeping old things in use',p:['mend'],n:6},tr:{t:'Tea water reading list',p:[],n:4}};
    const inScope=(proj,topic)=>s.scope==='all'||s.scope==='p:'+proj||(topic&&s.scope==='t:'+topic)||(s.scope==='t:tw'&&proj==='water'&&!topic);
    const SCOPES=[['all','Everything'],['p:water','Water first'],['p:mend','Mending'],['p:yix','Yixing clay notes'],['t:tw','Topic: Why water changes tea']];
    const STEPS=[['gather','Gather','What do I have?',[['material','Material','bring in, keep, sort'],['source','Source','correct what was said']]],['develop','Develop','What does it mean?',[['research','Research','what you’ve learned'],['thoughts','Your thoughts','your own words'],['direction','Direction','what you want to say']]],['make','Make','Say it well',[['write','Write','write and edit'],['read','Read','read as a reader'],['check','Check','quotes and facts'],['media','Media','photos and video'],['arrange','Arrange','order and layout']]],['deliver','Deliver','Send it out',[['audience','Audience','see it as people will'],['share','Share','thank people'],['outputs','Outputs','everything you made']]]];
    const STEPNAME={};STEPS.forEach(a=>a[3].forEach(x=>{STEPNAME[x[0]]=[x[1],x[2],a[1]];}));
    const P3a='The spring above her garden runs through limestone, so the water is soft, and it carries the leaf’s sweetness forward.';
    const P3b='The spring above her garden runs through limestone, so the water is hard with calcium, and somehow it still carries the leaf’s sweetness forward.';
    // ---------- recordings
    const REC={r1:{t:'Spring walk',proj:'water',topic:'tw',meta:'38 min · Lin Yun and you · 14 Oct',open:'Recorded walking up to the spring. Wind noise from minute 20.',close:'She asked that the garden’s location not be named.',
        turns:[['02:10','Lin Yun','We carry water from up there every morning. Not for the garden, for the tea.',null],['02:35','Lin Yun','Winter especially. The guests come in winter.',null],['12:40','Lin Yun','The water here is soft, it comes through the white stone.','a'],['12:58','Lin Yun','Tea is a guest in the water. If the house is unkind, the guest leaves early.','u'],['21:09','Lin Yun','[unclear, wind] … only to wash the cups.','b']],
        notes:'Stories: carrying water each morning · Interest: limestone spring · Purchases: none'},
      r2:{t:'Yixing clay talk',proj:'yix',topic:'tc',meta:'24 min · Master Wu and you · 2 Oct',open:'In the workshop, kilns running.',close:'Master Wu is happy to be named.',turns:[['03:15','Master Wu','This is real zeesha, from the mountain.','c'],['04:12','Unknown','My father dug here forty years.','d']],notes:'Stories: three generations of diggers · Purchases: one teapot, price agreed'},
      r3:{t:'Night market stall',proj:'night',topic:'',meta:'9 min · stall owner and you · 27 Sep',open:'Very noisy.',close:'',turns:[['02:02','Stall owner','This one is eighty for a bag.','e']],notes:'Purchases: one bag of oolong, price unclear'}};
    const FL={a:['The recording may say “hard”, not “soft”. Water through limestone is usually hard.','Change to “hard”','hard'],b:['The words before this are lost in the wind.','Mark as unclear',''],c:['Probably “zisha”, the clay name.','Change to “zisha”',''],d:['Who is speaking? Two voices sound alike.','It’s Master Wu',''],e:['Eighty or eighteen? The noise covers it.','It’s eighteen','']};
    const recOpen=(k)=>REC[k].turns.filter(t=>t[3]&&t[3]!=='u'&&!s.flags[t[3]]).length;
    const corrected=s.flags.a==='fix';
    // ---------- topics / questions
    const QS=[['q1','tw','Does the spring’s hardness change by season?','Limestone springs usually give hard water. Nothing yet on seasons.'],['q2','tw','Is “only to wash the cups” about taste or habit?','The reason was lost in the wind at 21:09.'],['q3','tc','Which Yixing clay holds heat longest?','Two videos disagree: zhuni or zisha.'],['q4','tm','Does an old repaired cup change the taste?','No one has tested repaired cups.']];
    // ---------- pieces
    const PC={art:{t:'The water is half the tea',kind:'Article',proj:'water',topic:'tw',path:['write','read','check','media','audience','share']},car:{t:'Three waters, one leaf',kind:'Carousel',proj:'water',topic:'tw',path:['arrange','media','audience','share']},lst:{t:'Spring-water tasting set',kind:'Shop listing',proj:'water',topic:'',path:['write','read','share'],body:'A tasting set of three waters and one oolong, so you can taste the difference at home.'},scr:{t:'At the spring',kind:'Video script · 60 s',proj:'water',topic:'tw',path:['write','read','share'],body:'0:00 Walking up the path. Voice: “Every morning she carries water up from here.”'},post:{t:'The bowl with a gold seam',kind:'Post',proj:'mend',topic:'tm',path:['write','read','share'],body:'An old bowl, a gold seam, and a cup of tea that tasted like someone cared.'},story:{t:'Porcelain and Tea',kind:'Magazine story · published',proj:'mend',topic:'tm',path:['story']}};
    // ---------- sort at scale (Material)
    const sel=s.sel;const GN=s.gnames;
    const unsureList=s.vids.filter(v=>v.g==='unsure');
    const queueV=unsureList.filter(v=>s.skipped.indexOf(v.id)<0).concat(unsureList.filter(v=>s.skipped.indexOf(v.id)>=0));
    const curV=queueV[0];
    const placeV=(id,g)=>self.set({vids:s.vids.map(v=>v.id===id?Object.assign({},v,{g:g}):v),skipped:s.skipped.filter(x=>x!==id)});
    const counts={};s.vids.forEach(v=>{counts[v.g]=(counts[v.g]||0)+1;});
    const destTxt={water:'→ Why water changes tea',new:'→ new topic',mend:'→ Keeping old things in use',hold:'→ Library only'};
    const gk=s.gsel;const gq=(s.gq||'').toLowerCase();
    const inG=s.vids.filter(v=>v.g===gk&&(!gq||v.title.toLowerCase().indexOf(gq)>=0||v.channel.toLowerCase().indexOf(gq)>=0));
    // ---------- intake (keep or remove)
    const INT=[['k1','cabin-window.jpg','Photo · Water first','Keep: shows the kettle you write about in paragraph 1.','keep'],['k2','IMG_2231.jpg','Photo · Water first','Remove from view: blurred duplicate of cabin-window.jpg.','remove'],['k3','Voice memo 0:14','Recording · no project','Not sure: only a few words, “remember the second spring”.','unsure'],['k4','Interpreter test.m4a','Recording · no project','Remove from view: a sound check before an interview, no content.','remove'],['k5','Tasting notes, 12 Oct','Note · Water first','Keep: your own words about the three waters.','keep']];
    // ---------- queues per step
    const pieceDone=(k)=>k==='art'?s.p3done:(k==='car'?s.slide4:false);
    const Q={
      material:[{id:'m1',title:'444 YouTube links to sort',sub:unsureList.length+' need you · Claude sorted the rest',proj:'',topic:'',go:go('material',{matTab:'sort'})},{id:'m2',title:'5 new items: keep or remove?',sub:'photos, a voice memo, notes',proj:'water',topic:'tw',go:go('material',{matTab:'intake'})},{id:'m3',title:'Bring in more',sub:'files, links, albums, recordings',proj:'water',topic:'',w:false,go:go('material',{matTab:'add'})}],
      source:Object.keys(REC).map(k=>({id:k,title:REC[k].t,sub:recOpen(k)?recOpen(k)+' line'+(recOpen(k)>1?'s':'')+' to check':'all checked',proj:REC[k].proj,topic:REC[k].topic,done:!recOpen(k),go:go('source',{recId:k})})),
      research:Object.keys(TOP).filter(k=>k!=='tr').map(k=>{const open=QS.filter(q=>q[1]===k&&!s.rqDone[q[0]]).length;return {id:k,title:TOP[k].t,sub:open?open+' open question'+(open>1?'s':''):'no open questions',proj:TOP[k].p[0]||'',topic:k,done:!open,go:go('research',{topicId:k})};}),
      thoughts:[{id:'th1',title:'Water first',sub:'your thoughts · 3 linked items',proj:'water',topic:'tw',w:false,go:go('thoughts',{thoughtId:'water'})},{id:'th2',title:'Mending',sub:'your thoughts · 1 linked item',proj:'mend',topic:'tm',w:false,go:go('thoughts',{thoughtId:'mend'})}],
      direction:[{id:'d1',title:'Where should “hard water” change?',sub:s.decided?'decided':'needs your decision',proj:'water',topic:'tw',done:!!s.decided,go:go('direction')}],
      write:['art','post','lst','scr'].map(k=>({id:k,title:PC[k].t,sub:PC[k].kind+(k==='art'&&!s.p3done?' · 1 sentence to fix':' · draft'),proj:PC[k].proj,topic:PC[k].topic,w:k==='art'&&!s.p3done,go:go('write',{pieceId:k})})),
      read:[{id:'art',title:PC.art.t,sub:'read it through once',proj:'water',topic:'tw',go:go('read',{pieceId:'art'})}],
      check:[{id:'c1',title:'Article says “soft”, the recording says “hard”',sub:'paragraph 3',proj:'water',topic:'tw',done:s.p3done||!corrected,go:go('check',{pieceId:'art'})},{id:'c2',title:'“Turns flat” is only backed up for black tea',sub:'paragraph 5',proj:'water',topic:'tw',go:go('check',{pieceId:'art'})}],
      media:[{id:'md1',title:'lin-yun-hands.jpg',sub:'permission asked, no reply',proj:'water',topic:'tw',go:go('media',{pieceId:'car'})},{id:'md2',title:'kettle.jpg',sub:'no caption yet',proj:'water',topic:'',go:go('media',{pieceId:'art'})}],
      arrange:[{id:'car',title:PC.car.t,sub:(s.slide4||!corrected)?'all slides up to date':'slide 4 still says “soft”',proj:'water',topic:'tw',done:s.slide4||!corrected,go:go('arrange',{pieceId:'car'})}],
      audience:[{id:'au1',title:PC.car.t,sub:'final version ready to download',proj:'water',topic:'tw',go:go('audience',{pieceId:'car'})},{id:'au2',title:PC.art.t,sub:'preview as a web page',proj:'water',topic:'tw',w:false,go:go('audience',{pieceId:'art'})}],
      share:[{id:'sh1',title:'Thank Lin Yun',sub:s.copied.sh1?'copied · no reply yet':'message ready',proj:'water',topic:'tw',go:go('share',{msgId:'sh1'})},{id:'sh2',title:'Thank Tomas',sub:'copied 16 Oct · no reply yet',proj:'water',topic:'',w:false,go:go('share',{msgId:'sh2'})},{id:'sh3',title:'Replies to Porcelain and Tea',sub:'2 replies to read',proj:'mend',topic:'tm',go:go('share',{msgId:'sh3'})}],
      outputs:Object.keys(PC).map(k=>({id:k,title:PC[k].t,sub:PC[k].kind,proj:PC[k].proj,topic:PC[k].topic,w:false,go:k==='story'?go('story',{pieceId:'story'}):go(PC[k].path[0],{pieceId:k})}))
    };
    const qFor=(step)=>(Q[step]||[]).filter(x=>inScope(x.proj,x.topic)).map(x=>Object.assign({},x,{projName:x.proj?P[x.proj]:'No project yet'}));
    const waiting=(step)=>qFor(step).filter(x=>!x.done&&x.w!==false).length;
    // ---------- slides
    const S=[['Title','Three waters, one leaf','spring-path.jpg'],['Photo + line','Same leaf. Three cups.','three-cups.jpg'],['Quote','“Tea is a guest in the water.” Lin Yun','lin-yun-hands.jpg'],['Photo + line',s.slide4?'Her spring runs through limestone: hard water, still sweet.':'Her spring runs through limestone: soft water, sweet tea.','limestone.jpg'],['Split','Tap · filtered · spring','three-cups.jpg'],['Words only','Too few minerals: thin. Too many: flat.','none'],['Words only','What I still don’t know','none'],['Closing','The full story is on Teajia','cabin-window.jpg']];
    const flag4=corrected&&!s.slide4;
    const slides=s.order.map((idx,pos)=>({n:pos+1,tpl:S[idx][0],text:S[idx][1],photo:S[idx][2],flag:idx===3&&flag4,cls:[s.selS===pos?'sel':'',(idx===3&&(flag4||st==='stale'))?'flag':''].join(' '),pressed:s.selS===pos?'true':'false',pick:()=>self.set({selS:pos}),dragStart:(e)=>e.dataTransfer.setData('text/plain',String(pos)),dragOver:(e)=>e.preventDefault(),drop:(e)=>{e.preventDefault();const f=Number(e.dataTransfer.getData('text/plain'));const o=s.order.slice();const [m]=o.splice(f,1);o.splice(pos,0,m);self.set({order:o,selS:pos});}}));
    const move=(d)=>()=>{const p=s.selS,q=p+d;if(q<0||q>7)return;const o=s.order.slice();[o[p],o[q]]=[o[q],o[p]];self.set({order:o,selS:q});};
    // ---------- where used
    const WU={a:['Spring walk 12:40',corrected?'Changed to “hard” by you. Places that use it are marked; nothing there was changed.':'May be misheard. It appears in:',[['Article · paragraph 3','write','art'],['Carousel · slide 4','arrange','car'],['Research · point 1','research','']]],u:['Spring walk 12:58','Exact words, protected everywhere:',[['Article · paragraph 2','write','art'],['Carousel · slide 3','arrange','car'],['Your thoughts · Water first','thoughts','']]],pdf:['Water chemistry and brewing.pdf','One saved item in two topics:',[['Topic · Why water changes tea','research',''],['Topic · Keeping old things in use','research','']]],ph1:['three-cups.jpg','Photo by you, placed in:',[['Article · figure 2','write','art'],['Carousel · slides 2 and 5','arrange','car']]],ph2:['lin-yun-hands.jpg','By Lin Yun · permission asked:',[['Carousel · slide 3','arrange','car'],['Share · Lin Yun','share','']]],boot:['The Book of Tea passage','Saved once, used in:',[['Your thoughts · Water first','thoughts',''],['Topic · Keeping old things in use','research','']]]};
    const openWu=(k)=>()=>self.set({panel:'uses',usesKey:k});
    const wu=WU[s.usesKey]||null;
    // ---------- save status
    let saveText='Saved 09:41',saveTone='good';
    if(s.p3done)saveText='Saved 09:52 · version 9';
    if(st==='unsaved'||s.dirty){saveText='Saving…';saveTone='warn';}
    if(st==='failed'){saveText='Couldn’t save. Your words are safe on this device.';saveTone='bad';}
    if(st==='readonly'){saveText='Viewing an earlier version';saveTone='warn';}
    const pc=PC[s.pieceId]||PC.art;
    // ---------- next step for pieces
    let nx=null;const pv=['write','read','check'].indexOf(s.view)>=0&&s.pieceId==='art';
    if(pv){nx=!corrected?['Check the recording first: 12:40 may say “hard”.','Open Spring walk',go('source',{recId:'r1'})]:(!s.p3done?['Fix “soft water” in paragraph 3. You changed it to “hard” in the recording.','Fix it',()=>self.set({view:'write',editing:true,draft:s.draft||P3a})]:(!s.slide4?['Slide 4 of the carousel still says “soft water”.','Go to slide 4',go('arrange',{pieceId:'car',selS:3})]:['Read it through once as a reader would.','Read it',go('read')]));}
    if(s.view==='arrange')nx=flag4?['Change slide 4 to say “hard water, still sweet”.','Change it',()=>self.set({slide4:true})]:['Look at the whole carousel as people will see it.','Preview',go('audience',{pieceId:'car'})];
    // ---------- checklist (totality)
    const CL=[['Home','Purpose line, pick up where you stopped, what needs you, start something new','home'],['Working on switch','Everything, one project or one topic; every queue follows it','home'],['Material · bring in','Files, notes, links, albums, folder; processing and failed states','material'],['Material · keep or remove','Claude’s recommendation with a reason; restore','material'],['Material · sort into topics','Needs-you one at a time, groups table, filter, bulk move, rules','material'],['Source','Opening and closing notes, every turn, flagged lines, correct or keep, undo, notes, where used','source'],['Research','What we know, points with how well backed, evidence, different views, open questions, your experience, Claude’s additions','research'],['Your thoughts','Your own words, linked Library items, tentative ideas, make pieces from this','thoughts'],['Direction','Decisions with where they apply, needs-you choice, changed mind and rejected with reasons','direction'],['Write','Document, protected quote, marked sentence edit, notes, decisions, ready?, history, ask Claude','write'],['Read','Clean reading view','read'],['Check','Findings that jump to their sentence, check again','check'],['Media','Photos with captions, credits, permission, where used; video preview','media'],['Arrange','All 8 slides, drag or move earlier and later, edit, flagged slide','arrange'],['Audience','Whole carousel as people see it, download, translation and posting marked not available yet','audience'],['Share','Messages, copy to send yourself, replies, no reply yet','share'],['Outputs','Every piece, its kind, status and where it went; new piece','outputs'],['Magazine story','Map, plan, draft, checks, edit passes, photos, publish, feedback, with the real Porcelain and Tea','story'],['Library','Everything saved once, search, kinds, used in','library'],['Topics','Each topic with items, questions and what uses it','topics'],['Projects','All 48 projects, search, brand and status filters, pin','projects'],['Where used','Two-way links for quotes, photos and saved items','write'],['History','Earlier versions, read-only preview, going back makes a new version','write'],['Detour return','Leaving a piece for Source or Research offers the way back','write'],['States','Empty, saving, failed save, processing, out of date, read-only, from the state menu','home']];
    const projAll=['Water first','Mending','Yixing clay notes','Night market teas','Spring harvest diary','An Cha visit, part 1','An Cha visit, part 2','Tea teacher interview','Studio open day','Gold seam workshop','Universal Language sculptures','Collector viewing, autumn','Card 12 commentary','Smoked black tea','Cabin water tests','Gaiwan sizes guide','Wuyi rock teas','Kiln firing log','Tea and breath','Newsletter, November'];
    const pq=(s.projQ||'').toLowerCase();
    const C={
      st,go,T,
      scope:s.scope,scopes:SCOPES.map(o=>({v:o[0],l:o[1]})),onScope:(e)=>self.set({scope:e.target.value}),scopeName:(SCOPES.find(o=>o[0]===s.scope)||SCOPES[0])[1],
      themeClass:s.light?'light':'',themeLabel:s.light?'Dark':'Light',toggleTheme:()=>self.set({light:!s.light}),onState:(e)=>self.set({st:e.target.value}),
      hasToast:!!s.toast,toast:s.toast,clearToast:()=>self.set({toast:''}),
      // view flags
      vHome:s.view==='home',vMaterial:s.view==='material',vSource:s.view==='source',vResearch:s.view==='research',vThoughts:s.view==='thoughts',vDirection:s.view==='direction',vWrite:s.view==='write'&&['art'].indexOf(s.pieceId)>=0,vWriteSimple:s.view==='write'&&['post','lst','scr'].indexOf(s.pieceId)>=0,vRead:s.view==='read',vCheck:s.view==='check',vMedia:s.view==='media',vArrange:s.view==='arrange',vAudience:s.view==='audience',vShare:s.view==='share',vOutputs:s.view==='outputs',vStory:s.view==='story',vLibrary:s.view==='library',vTopics:s.view==='topics',vProjects:s.view==='projects',vChecklist:s.view==='checklist',
      isEmpty:st==='empty',notEmpty:st!=='empty',isProcessing:st==='processing',isFailed:st==='failed',isStale:st==='stale'||(corrected&&!s.rqDone.q0),isReadOnly:st==='readonly',
      // home
      showIntro:s.intro,hideIntro:()=>self.set({intro:false}),resume:go('write',{pieceId:'art'}),
      homeActs:STEPS.map(a=>({label:a[1],q:a[2],steps:a[3].map(x=>({label:x[1],n:waiting(x[0]),has:waiting(x[0])>0,go:go(x[0])})) ,n:a[3].reduce((t,x)=>t+waiting(x[0]),0)})),
      needs:[!corrected?{t:'Check line 12:40 in Spring walk',go:go('source',{recId:'r1'})}:null,corrected&&!s.p3done?{t:'Fix “soft water” in the article',go:go('write',{pieceId:'art'})}:null,!s.decided?{t:'Decide where “hard water” changes',go:go('direction')}:null,{t:unsureList.length+' YouTube links need a topic',go:go('material',{matTab:'sort'})}].filter(Boolean).map(x=>({t:x.t,go:x.go})),
      // material
      matTabs:[['add','Bring in'],['intake','Keep or remove'],['sort','Sort into topics']].map(t=>({label:t[1],cls:s.matTab===t[0]?'on':'',pressed:s.matTab===t[0]?'true':'false',go:()=>self.set({matTab:t[0]})})),
      mAdd:s.matTab==='add',mIntake:s.matTab==='intake',mSort:s.matTab==='sort',
      intake:INT.map(r=>{const d=s.intake[r[0]];return {name:r[1],kind:r[2],why:r[3],rec:r[4],decided:!!d,open:!d,result:d==='keep'?'Kept':(d==='remove'?'Removed from view':'Left for later'),keep:()=>{const I=Object.assign({},s.intake);I[r[0]]='keep';self.set({intake:I});},remove:()=>{const I=Object.assign({},s.intake);I[r[0]]='remove';self.set({intake:I});},later:()=>{const I=Object.assign({},s.intake);I[r[0]]='later';self.set({intake:I});},undo:()=>{const I=Object.assign({},s.intake);delete I[r[0]];self.set({intake:I});}};}),
      acceptAll:()=>{const I=Object.assign({},s.intake);INT.forEach(r=>{if(!I[r[0]])I[r[0]]=r[4]==='unsure'?'later':r[4];});self.set({intake:I});},
      sortTotal:s.vids.length,sortUnsure:32,
      sortTabs:[['needs','Needs you · '+unsureList.length],['groups','All groups · '+s.gorder.length],['rules','Rules · '+s.rules.length]].map(t=>({label:t[1],cls:s.sortTab===t[0]?'on':'',pressed:s.sortTab===t[0]?'true':'false',go:()=>self.set({sortTab:t[0]})})),
      tabNeeds:s.sortTab==='needs',tabGroups:s.sortTab==='groups',tabRules:s.sortTab==='rules',
      hasCur:!!curV,noCur:!curV,triPos:32-unsureList.length+1,triPct:Math.round((32-unsureList.length)/32*100)+'%',
      cur:curV?{title:curV.title,sub:curV.channel+' · '+curV.len,why:curV.why,opts:[[curV.a],[curV.b],['out']].map(o=>({label:o[0]==='out'?'Leave it out':GN[o[0]],go:()=>placeV(curV.id,o[0])})),other:(e)=>{if(e.target.value)placeV(curV.id,e.target.value);},skip:()=>self.set({skipped:s.skipped.concat([curV.id])})}:{title:'',sub:'',why:'',opts:[],other:()=>{},skip:()=>{}},
      upNext:queueV.slice(1,4).map(v=>({title:v.title,sub:'between '+GN[v.a]+' and '+GN[v.b]})),groupOpts:s.gorder.map(k=>({k:k,label:GN[k]})),
      glist:s.gorder.map(k=>({name:GN[k],n:counts[k]||0,dest:destTxt[s.gdest[k]],cls:gk===k?'on':'',pick:()=>self.set({gsel:k,gq:'',glimit:25,sel:[]})})),
      gsel:{name:GN[gk],destKey:s.gdest[gk],rename:(e)=>{const G=Object.assign({},s.gnames);G[gk]=e.target.value;self.set({gnames:G});},setDest:(e)=>{const D=Object.assign({},s.gdest);D[gk]=e.target.value;self.set({gdest:D});}},
      gq:s.gq,onGq:(e)=>self.set({gq:e.target.value,glimit:25}),gShown:inG.length,selectShown:()=>self.set({sel:inG.map(v=>v.id)}),
      gitems:inG.slice(0,s.glimit).map(v=>({title:v.title,channel:v.channel,len:v.len,checked:sel.indexOf(v.id)>=0,cls:sel.indexOf(v.id)>=0?'sel':'',toggle:()=>{const S2=sel.slice();const i=S2.indexOf(v.id);if(i>=0)S2.splice(i,1);else S2.push(v.id);self.set({sel:S2});}})),
      hasMore:inG.length>s.glimit,moreN:Math.min(50,inG.length-s.glimit),showMore:()=>self.set({glimit:s.glimit+50}),
      selCount:sel.length,hasSel:sel.length>0,clearSel:()=>self.set({sel:[]}),
      moveSel:(e)=>{const g=e.target.value;if(!g)return;self.set({vids:s.vids.map(v=>sel.indexOf(v.id)>=0?Object.assign({},v,{g:g}):v),sel:[]});},
      makeRule:()=>{const ch=(s.vids.find(v=>v.id===sel[0])||{}).channel||'';self.set({rules:s.rules.concat([{text:(gq?'Titles with “'+s.gq+'”':'Videos from '+ch)+' go to '+GN[gk]}]),sel:[],toast:'Rule saved. Future batches use it; Claude still asks when an item fits two rules.'});},
      rules:s.rules.map((r,i)=>({text:r.text,del:()=>self.set({rules:s.rules.filter((x,j)=>j!==i)})})),noRules:s.rules.length===0,
      saveGroups:T('Demo: new topics would be made and every link filed into its topics. An item can sit in more than one topic. Nothing is copied.'),
      // source
      rec:(()=>{const r=REC[s.recId]||REC.r1;return {t:r.t,proj:P[r.proj],meta:r.meta,open:r.open,close:r.close,hasClose:!!r.close,notes:r.notes,openN:recOpen(s.recId),
        turns:r.turns.map(t=>{const f=t[3]&&t[3]!=='u'?t[3]:null;const v=f?s.flags[f]:null;let text=t[2];if(f==='a'&&v==='fix')text=t[2].replace('soft','hard');return {t:t[0],who:t[1],text,flag:!!f&&!v,fixed:!!v,cls:f?(v?'ok':'warn'):'',q:f?FL[f][0]:'',fix:f?FL[f][1]:'',result:v==='keep'?'Kept as heard.':'Changed by you. The original is kept.',
          accept:()=>{if(!f)return;const F=Object.assign({},s.flags);F[f]='fix';self.set({flags:F});},keep:()=>{if(!f)return;const F=Object.assign({},s.flags);F[f]='keep';self.set({flags:F});},undo:()=>{if(!f)return;const F=Object.assign({},s.flags);delete F[f];self.set({flags:F});},
          hasWu:t[3]==='a'||t[3]==='u',wu:openWu(t[3]==='u'?'u':'a'),listen:T('Demo: plays 10 seconds around '+t[0]+'.')};})};})(),
      recTabs:Object.keys(REC).map(k=>({label:REC[k].t,cls:s.recId===k?'on':'',go:()=>self.set({recId:k})})),
      recNext:()=>{const ks=Object.keys(REC).filter(k=>recOpen(k)&&k!==s.recId);if(ks.length)self.set({recId:ks[0]});else self.set({toast:'All recordings are checked.'});},
      // research
      topic:(()=>{const k=s.topicId||'tw';const tp=TOP[k];return {t:tp.t,n:tp.n,known:k==='tw'?'Minerals change how flavour leaves the leaf. Moderate hardness tends to give body; very soft water can taste thin. How this applies to Lin Yun’s oolong is not established.':(k==='tc'?'Clay type and wall thickness change how a pot holds heat. Sources disagree on which clay is best.':'Repair keeps an object in daily use and carries its history forward.'),isWater:k==='tw',
        qs:QS.filter(q=>q[1]===k).map(q=>({t:q[2],known:q[3],done:!!s.rqDone[q[0]],cls:s.rqDone[q[0]]?'ok':'',open:!s.rqDone[q[0]],status:s.rqDone[q[0]]||'',save:()=>{const D=Object.assign({},s.rqDone);D[q[0]]='answered';self.set({rqDone:D});},leave:()=>{const D=Object.assign({},s.rqDone);D[q[0]]='left open';self.set({rqDone:D});},ask:go('share',{msgId:'sh1'})})),
        usedBy:(tp.p.length?tp.p.map(p=>P[p]).join(', '):'no project yet')};})(),
      topicTabs:Object.keys(TOP).map(k=>({label:TOP[k].t,cls:(s.topicId||'tw')===k?'on':'',go:()=>self.set({topicId:k})})),
      p1Word:corrected?'hard':'soft',p1Stale:corrected&&!s.rqDone.q0,markP1:()=>{const D=Object.assign({},s.rqDone);D.q0='checked';self.set({rqDone:D});},
      // thoughts
      thought:s.thoughts[s.thoughtId]||'',onThought:(e)=>{const O=Object.assign({},s.thoughts);O[s.thoughtId]=e.target.value;self.set({thoughts:O});},thoughtProj:s.thoughtId==='mend'?'Mending':'Water first',
      linked:(s.thoughtId==='mend'?[['Gold repair at home','video · 14 min','boot']]:[['Mountain spring water is best, river water next, well water last.','The Book of Tea · public domain','boot'],['Tea is a guest in the water.','Spring walk 12:58 · Lin Yun','u'],['Hardness above 150 mg/L dulled aroma in every black tea tested.','Water chemistry and brewing.pdf p.14','pdf']]).map(l=>({text:l[0],src:l[1],wu:openWu(l[2])})),
      makeFrom:(s.thoughtId==='mend'?['post','story']:['art','car','lst','scr']).map(k=>({t:PC[k].t,kind:PC[k].kind,go:k==='story'?go('story',{pieceId:'story'}):go(PC[k].path[0],{pieceId:k})})),
      // direction
      decided:s.decided,notDecided:!s.decided,decide:(v)=>()=>self.set({decided:v}),undoDecide:()=>self.set({decided:null}),decA:()=>self.set({decided:'Article and slide 4'}),decB:()=>self.set({decided:'Article only'}),
      // write
      p3:s.p3done?(s.draft||P3b):P3a,p3cls:s.p3done?'':(corrected?'mark':''),editing:s.editing,notEditing:!s.editing,editP3:()=>self.set({view:'write',pieceId:'art',editing:true,draft:s.draft||P3a}),
      draft:s.draft,onDraft:(e)=>self.set({draft:e.target.value,dirty:true}),saveP3:()=>self.set({editing:false,p3done:true,dirty:false}),cancelP3:()=>self.set({editing:false,dirty:false}),
      p3Open:corrected&&!s.p3done,p3Done:s.p3done,p3Wait:!corrected&&!s.p3done,
      insp:[['notes','Notes'],['dec','Decisions'],['ready','Ready?'],['hist','History']].map(x=>({label:x[1],cls:s.insp===x[0]?'on':'',pressed:s.insp===x[0]?'true':'false',go:()=>self.set({insp:x[0]})})),
      inspNotes:s.insp==='notes',inspDec:s.insp==='dec',inspReady:s.insp==='ready',inspHist:s.insp==='hist',
      readyText:s.p3done?'Checks ran on version 8; you are on 9. Check again before sharing.':'1 thing to fix. Then it can be downloaded as a web page with photos.',
      previewOld:()=>self.set({st:'readonly'}),backCurrent:()=>self.set({st:'normal'}),restoreOld:T('Demo: going back makes a new version. Nothing in between is lost.'),
      decText:s.decided?'Hard water: '+s.decided.toLowerCase():'Hard water: not decided yet',
      returned:s.returned,hasRet:!!s.ret&&['write','read','check','media','arrange','audience','share'].indexOf(s.view)<0,retLabel:s.ret?(PC[s.ret.piece]||PC.art).t:'',goRet:()=>self.set({view:s.ret.view,pieceId:s.ret.piece,ret:null,returned:true}),clearRet:()=>self.set({ret:null}),
      simpleBody:s.bodies[s.pieceId]!==undefined?s.bodies[s.pieceId]:(pc.body||''),onSimple:(e)=>{const B=Object.assign({},s.bodies);B[s.pieceId]=e.target.value;self.set({bodies:B,dirty:true});},
      // check
      chk1:s.p3done?'Paragraph 3 now matches the recording':(corrected?'Says “soft”, but the recording now says “hard”':'Paragraph 3 matches the recording as heard'),c1Open:corrected&&!s.p3done,c1Ok:!corrected||s.p3done,checkAgain:T('Demo: the checks run again on the current version.'),
      // media
      photos:[['spring-path.jpg','The path to the spring','by you','Article fig. 1 · slide 1','',null],['three-cups.jpg','Tap, filtered, spring','by you','Article fig. 2 · slides 2, 5','','ph1'],['lin-yun-hands.jpg','Pouring','by Lin Yun','Slide 3','Permission asked 16 Oct, no reply yet','ph2'],['limestone.jpg','White stone above the garden','by you','Slide 4','',null],['cabin-window.jpg','Cabin kettle','by you','Selected, not placed','',null],['kettle.jpg','No caption yet','by you','Not used','Needs a caption',null]].map(p=>({name:p[0],cap:p[1],credit:p[2],uses:p[3],warn:p[4],hasWarn:!!p[4],hasWu:!!p[5],wu:p[5]?openWu(p[5]):()=>{}})),
      // arrange
      slides,selSlide:slides[s.selS]||slides[0],fixSlide:()=>self.set({slide4:true}),moveEarlier:move(-1),moveLater:move(1),
      // audience
      audCar:s.pieceId!=='art',audArt:s.pieceId==='art',download:T('Demo: 8 images and the caption download. Downloading is not posting.'),downloadArt:T('Demo: the article downloads as a web page with photos.'),
      // share
      msgs:[['sh1','Lin Yun','For the article','Thank you for the walk to the spring. Your line about the guest is in it exactly as you said it. Is it right to call your spring limestone? I left the garden’s place unnamed, as you asked.',s.copied.sh1?'Copied · no reply yet':'Ready to send'],['sh2','Tomas','Thank-you note','Thank you for the tasting. Your three cups became the heart of the piece.','Copied 16 Oct · no reply yet'],['sh3','Yan Jinwen','Porcelain and Tea · replies','2 replies: he likes the photos; asks to spell the studio name 缮隐漆物.','2 replies to read']].map(m=>({id:m[0],who:m[1],about:m[2],text:m[3],status:m[4],cls:s.msgId===m[0]?'on':'',pick:()=>self.set({msgId:m[0]}),copy:()=>{const C2=Object.assign({},s.copied);C2[m[0]]=true;self.set({copied:C2,toast:'Copied. Nothing is sent; you send it yourself.'});}})),
      // outputs
      pieces:Object.keys(PC).map(k=>({t:PC[k].t,kind:PC[k].kind,proj:P[PC[k].proj],status:k==='story'?'Published 29 Sep':(k==='car'?(flag4?'Slide 4 needs a change':'Final version ready'):(k==='art'?(s.p3done?'Draft · up to date':'Draft · 1 fix'):'Draft')),go:k==='story'?go('story',{pieceId:'story'}):go(PC[k].path[0],{pieceId:k}),show:inScope(PC[k].proj,PC[k].topic)})).filter(x=>x.show),
      newPiece:T('Demo: pick a kind (article, carousel, post, listing, script) and it opens empty, with its own words and finish.'),
      // story (magazine)
      mag:[['Map','The moments and quotes, chosen with you','done'],['Plan','A conversation, richer: you chose this shape on 1 Oct','done'],['Draft','Your questions in your words, his words exact','done'],['Checks','Every quote traced back to the transcript','done'],['Edit passes','Three passes, including a fresh read','done'],['Photos','Placed last, between thoughts, each credited','done'],['Publish','Live on teajia.com, 29 Sep','done'],['Feedback','2 replies from the people in the story','open']].map(m=>({t:m[0],d:m[1],cls:m[2]==='done'?'ok':'warn',state:m[2]==='done'?'Done':'Needs you'})),
      // library / topics / projects
      libRows:[['Spring walk','Recording · 38 min','Why water changes tea','a',go('source',{recId:'r1'})],['444 YouTube links','Video links · this week','sorting in Material','',go('material',{matTab:'sort'})],['Water chemistry and brewing.pdf','Reading · 3 passages marked by you','2 topics','pdf',go('research',{topicId:'tw'})],['The Book of Tea passage','Reading · public domain','2 places','boot',go('thoughts',{thoughtId:'water'})],['three-cups.jpg','Photo · by you','article and carousel','ph1',go('media',{pieceId:'art'})],['Tasting notes, 12 Oct','Your note','Why water changes tea','',go('thoughts',{thoughtId:'water'})]].map(r=>({t:r[0],kind:r[1],inn:r[2],hasWu:!!r[3],wu:r[3]?openWu(r[3]):()=>{},open:r[4]})),
      topicRows:Object.keys(TOP).map(k=>({t:TOP[k].t,sub:TOP[k].n+' items · '+(TOP[k].p.length?'used by '+TOP[k].p.map(p=>P[p]).join(', '):'no project yet'),go:go('research',{topicId:k==='tr'?'tw':k})})),
      projQ:s.projQ,onProjQ:(e)=>self.set({projQ:e.target.value}),
      projRows:projAll.filter(n=>!pq||n.toLowerCase().indexOf(pq)>=0).map((n,i)=>({t:n,sub:i<4?['1 topic · 4 pieces','1 topic · 2 pieces','1 topic · 1 recording to correct','1 recording to correct'][i]:'1 topic · '+(1+i%4)+' pieces',pinLabel:s.pins.indexOf(n)>=0?'Unpin':'Pin',pin:()=>{const Pn=s.pins.slice();const j=Pn.indexOf(n);if(j>=0)Pn.splice(j,1);else Pn.push(n);self.set({pins:Pn});},go:()=>self.set({scope:n==='Water first'?'p:water':(n==='Mending'?'p:mend':(n==='Yixing clay notes'?'p:yix':'all')),view:'home'})})),
      projCount:48,pinned:s.pins.map(n=>({t:n,go:()=>self.set({scope:n==='Water first'?'p:water':(n==='Mending'?'p:mend':'all'),view:'home'})})),
      // panels
      panel:s.panel,pLib:s.panel==='lib',pUses:s.panel==='uses',pHist:s.panel==='hist',hasPanel:!!s.panel,closePanel:()=>self.set({panel:null}),
      openLib:()=>self.set({panel:s.panel==='lib'?null:'lib'}),openHist:()=>self.set({panel:s.panel==='hist'?null:'hist'}),
      wuTitle:wu?wu[0]:'Where it’s used',wuSub:wu?wu[1]:'Press “Where it’s used” on a quote, photo or saved item.',wuList:wu?wu[2].map(u=>({t:u[0],go:go(u[1],u[2]?{pieceId:u[2]}:{})})):[],
      wuA:openWu('a'),wuU:openWu('u'),
      // header / footer
      saveText,saveTone,saveFailed:st==='failed',retry:()=>self.set({st:'normal'}),footCls:st==='failed'?'bad':'',
      hasNext:!!nx,nextText:nx?nx[0]:'',nextBtn:nx?nx[1]:'',nextGo:nx?nx[2]:()=>{},
      inPiece:['write','read','check','media','arrange','audience'].indexOf(s.view)>=0&&!!PC[s.pieceId],pieceTitle:pc.t,pieceKind:pc.kind,pieceProj:P[pc.proj],
      piecePath:(pc.path||[]).map(v=>({label:STEPNAME[v]?STEPNAME[v][0]:v,hint:STEPNAME[v]?STEPNAME[v][1]:'',cls:s.view===v?'on':'',cur:s.view===v?'page':'false',go:go(v)})),
      stepName:STEPNAME[s.view]?STEPNAME[s.view][0]:({home:'Home',library:'Library',topics:'Topics',projects:'Projects',story:'Magazine story',checklist:'Everything that’s here'})[s.view]||'',
      stepHint:STEPNAME[s.view]?STEPNAME[s.view][1]:'',actName:STEPNAME[s.view]?STEPNAME[s.view][2]:'',
      checklist:CL.map(c=>({t:c[0],d:c[1],go:go(c[2])})),goChecklist:go('checklist'),
      goHome:go('home'),goLibrary:go('library'),goTopics:go('topics'),goProjects:go('projects'),
      textSize:'A− 100% A+',soon:T('Demo: this works in the full app; here it only shows where it lives.'),goDirection:go('direction')
    };
    const qList=(step)=>qFor(step).map(x=>Object.assign({},x,{cls:(x.done?'done ':'')+(curQId(step,x)?'on':''),go:x.go}));
    const curQId=(step,x)=>({source:s.recId,research:s.topicId,write:s.pieceId,read:s.pieceId,arrange:s.pieceId,audience:s.pieceId==='art'?'au2':'au1',share:s.msgId,thoughts:s.thoughtId==='mend'?'th2':'th1'})[step]===x.id;
