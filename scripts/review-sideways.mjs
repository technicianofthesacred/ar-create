// Nothing scrolls sideways. Visits every destination of the demo (and the sheets and menus that open over them) at 390, 700,
// 1000 and 1440 wide in light and dark, and reports (a) any page wider than the window and (b) any element whose own
// overflow-x is auto or scroll and which holds more than it shows, and (c) words that run past the window's right edge where
// they are cut off instead of scrolling (under a fixed bar or a clipping box), and (d) items of one row laid over each
// other because the row could not fit. Exit code 1 when anything is found.
// Start the demo first (npm run demo), then:
//   AR_CREATE_PLAYWRIGHT=/opt/node-tools/node_modules/playwright/index.mjs node scripts/review-sideways.mjs [flags] [shotDir] [widths] [themes]
// shotDir (optional) receives a PNG of every view that has a finding, named destination-width-theme.png.
// Flags:
//   --stress     before measuring, make each view hold what a full library holds: every invented title (the demo's start
//                with "Synthetic") and every title-like label grows to about 90 characters with one long unbroken word,
//                and every repeated row, tab, chip, pill or bar item is repeated (20 in a row that runs sideways, 150 in a list).
//   --plant      put one deliberate offender on every view (a scrolling strip and a too-wide block), to prove the check fails.
//   --shoot-all  save a PNG of every view, not only those with a finding.
//   --explain    add, to each finding, the chain of boxes that holds it (width, wrapping, display), to find the rule to change.
//   --v2         visit only version two (public/v2/). Without it, version two is visited after the existing workspace.
//   --no-v2      visit only the existing workspace, as before version two.
//   --only=NAMES check only these views (comma separated), e.g. --only=v2:home or --only=Home,Write or --only=v2.
//                The names it accepts:
//                existing workspace: Home, Subjects, Library, Material, Source, Research, Direction, Write, Read, Check,
//                  Media, Arrange, Audience, Share, Outputs, Instagram, and the menus over Home: sheet-develop,
//                  sheet-make, sheet-deliver (phone widths only), subject-switch;
//                version two: v2 (every view), v2:<screen id> (v2:home, v2:subject, v2:slides, v2:looks, v2:research,
//                  v2:research-group, v2:research-topic, and any screen registered later), v2:capture, v2:ask.
//                SIDEWAYS_ONLY=NAMES in the environment does the same. One screen at four widths and two themes takes a
//                minute or two; add widths and themes after shotDir to narrow it further, e.g. "" 390,1440 dark.
// It prints one line per view as it goes (ok, or found with what was found), then every finding again at the end.
// Version two: every screen version two has registered (v2.screens()), opened by its address, and its Capture and Ask
// sheets, with the same widths, themes and checks. A route's :id is a real record of the demo where one exists (the
// first subject, the first Instagram plan); SIDEWAYS_V2_IDS='{"subject":"..."}' names others by screen id. Write, Read and Check open the first subject, and the piece named by SIDEWAYS_V2_IDS='{"subject":"...","piece":"<output id>"}'.
// It only reads and clicks the demo (port 8854 by default). It never targets 8841, and nothing it changes in the page is saved.
import fs from 'node:fs';import path from 'node:path';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const base=process.env.AR_CREATE_URL||'http://127.0.0.1:8854';
if(/:8841\b/.test(base))throw Error('The sideways check never runs against the installed app on 8841.');
const url=`${base}/document-study/index.html?reviewActor=${encodeURIComponent(process.env.AR_CREATE_ACTOR||'agent:claude-code')}`;
const flags=new Set(process.argv.slice(2).filter(a=>a.startsWith('--'))),args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const EXPLAIN=flags.has('--explain'),STRESS=flags.has('--stress'),PLANT=flags.has('--plant'),SHOOT_ALL=flags.has('--shoot-all');
const shotDir=args[0]||'';if(shotDir)fs.mkdirSync(shotDir,{recursive:true});
const widths=(args[1]||'390,700,1000,1440').split(',').map(Number),themes=(args[2]||'light,dark').split(',');
const onlyText=[...flags].filter(a=>a.startsWith('--only=')).map(a=>a.slice(7)).join(',')||process.env.SIDEWAYS_ONLY||'';
for(const f of [...flags])if(f.startsWith('--only='))flags.delete(f);
const ONLY=onlyText?onlyText.split(',').map(n=>n.trim()).filter(Boolean):null,V2_ONLY=flags.has('--v2');
const DEST_ALL='Home,Subjects,Library,Material,Source,Research,Direction,Write,Read,Check,Media,Arrange,Audience,Share,Outputs,Instagram'.split(',');
const OVER_NAMES=['sheet-develop','sheet-make','sheet-deliver','subject-switch'];
const isV2=n=>n==='v2'||n.startsWith('v2:');
const unknown=(ONLY||[]).filter(n=>!DEST_ALL.includes(n)&&!OVER_NAMES.includes(n)&&!isV2(n));
if(unknown.length)throw Error(`--only does not know ${unknown.join(', ')}. It accepts ${[...DEST_ALL,...OVER_NAMES].join(', ')}, v2, v2:<screen id>, v2:capture and v2:ask.`);
const DEST=V2_ONLY?[]:(ONLY?DEST_ALL.filter(n=>ONLY.includes(n)):DEST_ALL);
const overWanted=name=>!V2_ONLY&&(!ONLY||ONLY.includes(name));
const OLD_WANTED=!V2_ONLY&&(DEST.length>0||OVER_NAMES.some(overWanted));
const V2_WANTED=!flags.has('--no-v2')&&(V2_ONLY||!ONLY||ONLY.some(isV2));
const v2Wanted=id=>!ONLY||ONLY.includes('v2')||ONLY.includes('v2:'+id);
const v2url=`${base}/v2/index.html?reviewActor=${encodeURIComponent(process.env.AR_CREATE_ACTOR||'agent:claude-code')}`;
// Material has no entry in the phone bar today, so it cannot be measured at phone widths. That is noted, not counted.
const PHONE={Library:'develop',Source:'develop',Research:'develop',Direction:'develop',Write:'make',Read:'make',Check:'make',Media:'make',Arrange:'make',Audience:'deliver',Share:'deliver',Outputs:'deliver'};
const KNOWN_UNREACHABLE=new Set(['Material@phone']);
// Runs in the page. Grows titles and repeats items so the view holds what a full library holds.
const stress=()=>{
 // Safe to run again: grown text is not grown twice and a group already at its count is left alone. Some screens redraw
 // their header on their own, so the script runs it again just before it measures and before it takes the picture.
 const WORD='Gardenkeeperswinterledgerofteapickingdaysnotebook';
 const LONG=t=>('The tea garden keepers of the far hills, '+t.trim()+' '+WORD).slice(0,96);
 const visible=e=>{const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 const skip=e=>e.closest('svg,script,style,select,textarea,input,canvas,video,[contenteditable="true"],.ProseMirror,#sideways-planted');
 // 1. Invented titles wherever they appear.
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const texts=[];
 for(let n;(n=walker.nextNode());)if(/Synthetic/.test(n.nodeValue)&&!/The tea garden/.test(n.nodeValue)&&n.parentElement&&!skip(n.parentElement))texts.push(n);
 for(const n of texts)n.nodeValue=n.nodeValue.replace(/Synthetic[^\n·•|]*/,m=>LONG(m));
 // 2. Title-like labels that carry data (names, tags, folders, chips). Piece tabs are named by kind (Article, Video), so
 //    they are repeated below but not grown.
 const TITLEISH='h1,h2,h3,h4,[class*="title" i],[class*="name" i],[class*="tag" i],[class*="chip" i],[class*="pill" i],[class*="folder" i]';
 for(const e of document.querySelectorAll(TITLEISH)){
  if(skip(e)||e.children.length||!visible(e))continue;const t=e.textContent;if(!t||t.trim().length<2||t.length>60||/The tea garden/.test(t))continue;
  e.textContent=LONG(t);
 }
 // 3. Repeated items: rows, tabs, chips, pills, bars. Inner groups first, so outer copies carry full inner groups.
 const ITEMISH=/tab|chip|pill|tag|item|row|card|piece|folder|subject|facet|crumb|step|choice|option|entry|link/i;
 const groups=[];
 for(const p of document.querySelectorAll('body *')){
  if(skip(p)||p.children.length===0||p.children.length>60||!visible(p))continue;
  const kids=[...p.children].filter(k=>!/^(SCRIPT|STYLE|TEMPLATE|DIALOG)$/.test(k.tagName)&&visible(k));if(!kids.length)continue;
  const key=k=>k.tagName+'.'+(k.classList[0]||''),tally={};for(const k of kids)tally[key(k)]=(tally[key(k)]||0)+1;
  const common=Object.keys(tally).sort((a,b)=>tally[b]-tally[a])[0],same=kids.filter(k=>key(k)===common);
  const named=k=>ITEMISH.test(String(k.className)+' '+(k.getAttribute('role')||''));
  // Only items that carry data (a grown title) or are named as items; a pair of controls such as A- and A+ is not a list,
  // and a lone heading is not a list either.
  const last=same[same.length-1];
  if(same.length<2?!(kids.length===1&&named(last)):!(named(last)||/The tea garden/.test(last.textContent)))continue;
  if(/^H[1-6]$/.test(last.tagName))continue;
  if(same.length<Math.max(1,kids.length*0.5))continue;
  let depth=0;for(let n=p;n;n=n.parentElement)depth++;
  groups.push({p,item:same[same.length-1],count:same.length,depth});
 }
 groups.sort((a,b)=>b.depth-a.depth);let added=0;const LIMIT=25000;
 for(const g of groups){
  if(added>LIMIT)break;if(!g.p.isConnected||!g.item.isConnected)continue;
  const cs=getComputedStyle(g.p);const sideways=(/flex/.test(cs.display)&&!/column/.test(cs.flexDirection))||(/grid/.test(cs.display)&&cs.gridTemplateColumns.split(' ').length>1)||getComputedStyle(g.item).display.startsWith('inline');
  const target=sideways?20:150,size=g.item.querySelectorAll('*').length+1;
  for(let i=g.count;i<target&&added<LIMIT;i++){const c=g.item.cloneNode(true);c.removeAttribute('id');c.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));g.item.after(c);added+=size;}
 }
};
// Runs in the page. One strip that scrolls sideways and one block wider than any window: both must be reported.
const plant=()=>{
 if(document.getElementById('sideways-planted'))return;
 const host=document.querySelector('#app')||document.body,box=document.createElement('div');box.id='sideways-planted';
 box.innerHTML='<div class="planted-strip" style="overflow-x:auto;white-space:nowrap;width:200px">'+'planted '.repeat(80)+'</div><div class="planted-wide" style="width:3000px;height:4px"></div>';
 host.prepend(box);
};
const measure=()=>{
 const view=document.documentElement.clientWidth,out=[];
 // With --explain, each finding carries the box chain that holds it (width, wrapping, display), to find the rule to change.
 const explain=e=>{const o=[];for(let n=e;n&&n!==document.body&&o.length<7;n=n.parentElement){const c=getComputedStyle(n),r=n.getBoundingClientRect();o.push(`${n.tagName.toLowerCase()}.${[...n.classList].join('.')} x${Math.round(r.left)} w${Math.round(r.width)} ${c.display} ws=${c.whiteSpace} ow=${c.overflowWrap} minw=${c.minWidth} ox=${c.overflowX}${c.display.includes('grid')?' cols='+c.gridTemplateColumns:''}${c.display.includes('flex')?' fw='+c.flexWrap+' f='+c.flex:''}`);}return o;};
 const path=e=>{const bits=[];for(let n=e;n&&n!==document.body&&bits.length<3;n=n.parentElement)bits.unshift(n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+[...n.classList].slice(0,2).map(c=>'.'+c).join(''));return bits.join(' > ');};
 for(const e of document.querySelectorAll('body *')){
  const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')continue;
  if(!/(auto|scroll)/.test(cs.overflowX))continue;
  const r=e.getBoundingClientRect();if(r.width<=0||r.height<=0)continue;
  const by=e.scrollWidth-e.clientWidth;if(by>1)out.push({el:path(e),by,...(window.__sidewaysExplain?{why:[...e.querySelectorAll('*')].filter(k=>{const r=k.getBoundingClientRect();return r.width>0&&(r.right>e.getBoundingClientRect().right+1||k.scrollWidth>k.clientWidth+1&&k.clientWidth>0);}).slice(-2).map(explain)}:{})});
 }
 // Words that run past the window's right edge without the page growing (cut by a fixed bar or a clipping box).
 const cut=[],seen=new Set();
 for(const e of document.querySelectorAll('body *')){
  if(cut.length>=12)break;
  if(![...e.childNodes].some(n=>n.nodeType===3&&n.nodeValue.trim()))continue;
  const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||cs.textOverflow==='ellipsis'||getComputedStyle(e.parentElement).textOverflow==='ellipsis')continue;
  if(e.closest('[aria-hidden="true"],.sr-only,.visually-hidden'))continue;
  const r=e.getBoundingClientRect();if(r.width<=1||r.height<=1||r.bottom<0||r.top>innerHeight*3)continue;
  const range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();
  let scroller=false;for(let n=e.parentElement;n;n=n.parentElement)if(/(auto|scroll)/.test(getComputedStyle(n).overflowX)&&n!==document.documentElement&&n!==document.body){scroller=true;break;}
  if(!scroller&&t.left<view&&t.right>view+2&&!seen.has(path(e))){seen.add(path(e));cut.push({el:path(e),by:Math.round(t.right-view),...(window.__sidewaysExplain?{why:explain(e)}:{})});}
 }
 // Items of one row laid over each other: a row that cannot fit spills sideways onto its neighbours instead of wrapping.
 const overlap=[];
 for(const row of document.querySelectorAll('body *')){
  if(overlap.length>=8)break;const rs=getComputedStyle(row);if(!/flex|grid/.test(rs.display)||rs.visibility==='hidden'||rs.display==='none')continue;
  const kids=[...row.children].filter(k=>{const c=getComputedStyle(k);if(c.display==='none'||c.visibility==='hidden'||/absolute|fixed/.test(c.position)||+c.opacity===0)return false;const r=k.getBoundingClientRect();return r.width>1&&r.height>1&&r.bottom>0&&r.top<innerHeight*3;}).slice(0,40);
  for(let i=0;i<kids.length&&overlap.length<8;i++)for(let j=i+1;j<kids.length;j++){
   const a=kids[i].getBoundingClientRect(),b=kids[j].getBoundingClientRect(),x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
   // Grid items may share an area on purpose (a whole-row button under its details), so in a grid only a spill past
   // the row's own edges counts; flex items never sit on each other unless the row ran out of room.
   const box=row.getBoundingClientRect(),spills=[a,b].some(r=>r.left<box.left-2||r.right>box.right+2);
   if(x>3&&y>3&&(/flex/.test(rs.display)||spills)){overlap.push({el:path(kids[i])+' over '+path(kids[j]).split(' > ').pop(),by:Math.round(x)});break;}
  }
 }
 return {page:document.documentElement.scrollWidth>view?document.documentElement.scrollWidth-view:0,scrollers:out,cut,overlap};
};
const findings=[],notes=[];let views=0,v2views=0;
// One line per view as it goes, so a long run shows that it is moving.
const pushFinding=findings.push.bind(findings);findings.push=(...entries)=>{for(const f of entries)console.log('found '+JSON.stringify(f));return pushFinding(...entries);};
console.log(`Checking${OLD_WANTED?` the existing workspace (${DEST.length?DEST.join(', '):'menus only'})`:''}${OLD_WANTED&&V2_WANTED?' and':''}${V2_WANTED?' version two':''} at ${widths.join(', ')} wide, ${themes.join(' and ')}${STRESS?', under stress':''}.`);
// Real records of the demo to open version two's screens on, read through the app's own commands.
const v2ids=await (async()=>{const ids={};const get=async route=>{try{const r=await fetch(base+route,{headers:{'X-AR-Actor':'agent:claude-code','X-AR-Client':'http'}});return r.ok?await r.json():null;}catch{return null;}};
 const catalog=await get('/api/study-draft/catalog'),first=[...(catalog?.collections||[]),...(catalog?.drafts||[])].map(r=>r.parentStudyId||r.parentStudyKey).find(Boolean);if(first)ids.subject=first;
 const plans=await get('/api/instagram/plans'),plan=(plans?.plans||[]).find(p=>p?.id);if(plan)ids.slides=plan.id;
 try{Object.assign(ids,JSON.parse(process.env.SIDEWAYS_V2_IDS||'{}'));}catch{}return ids;})();
const browser=await chromium.launch();
for(const width of widths)for(const theme of themes){
 const phone=width<=850,height=phone?844:900;
 const context=await browser.newContext({viewport:{width,height},hasTouch:phone});let page=await context.newPage();
 if(OLD_WANTED){await page.goto(url,{waitUntil:'load'});await page.waitForTimeout(3000);
 if(await page.evaluate(()=>document.documentElement.dataset.theme)!==theme){await page.getByRole('button',{name:/Switch to (light|dark) theme/}).first().click();await page.waitForTimeout(400);}}
 // Stressing changes the page; reload between views so every view starts from what the app itself drew. The theme is kept.
 const fresh=async()=>{if(!STRESS&&!PLANT)return;await page.goto(url,{waitUntil:'load'});await page.waitForTimeout(2200);};
 const phoneGo=async name=>{await page.locator(`.combined-phonebar [data-combined-group="${PHONE[name]}"]`).click();await page.waitForTimeout(300);await page.locator('#combined-phone-sheet button',{hasText:new RegExp('^\\s*'+name)}).first().click();};
 const go=async name=>{
  if(name==='Home')return phone?page.locator('.combined-phonebar [data-combined-nav="home"]').click():page.locator('.combined-rail [data-combined-nav="home"]').click();
  if(name==='Subjects')return phone?page.locator('.combined-phonebar [data-combined-nav="subjects"]').click():page.evaluate(()=>window.combinedSubjects.open());
  if(name==='Read'){await (phone?phoneGo('Write'):page.locator('.combined-rail button',{hasText:/^\s*Write\s*\d*$/}).first().click());await page.waitForTimeout(1500);// Write redraws its header often, so a pointer click can keep missing; press the visible Read switch from the page itself.
  if(!await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^\s*Read\s*$/.test(b.textContent)&&b.offsetParent);b?.click();return !!b;}))throw Error('no visible Read switch');return;}
  // The Instagram button in the heading line is hidden by the current look, so open the studio the way the page itself does.
  if(name==='Instagram'){await (phone?phoneGo('Media'):page.locator('.combined-rail button',{hasText:/^\s*Media\s*\d*$/}).first().click());await page.waitForTimeout(1500);await page.evaluate(()=>window.arInstagram.open({subject:document.querySelector('[data-instagram-open]')?.dataset.instagramOpen||'',title:'Synthetic'}));await page.waitForTimeout(2500);return;}
  if(phone){if(!PHONE[name])throw Error('not reachable from the phone bar');return phoneGo(name);}
  return page.locator('.combined-rail button',{hasText:new RegExp('^\\s*'+name+'\\s*\\d*$')}).first().click({timeout:4000});
 };
 // Things that open over a screen: the phone sheets and the subject switcher.
 const OVER=[];if(OLD_WANTED){if(phone)for(const g of ['develop','make','deliver'])if(overWanted('sheet-'+g))OVER.push(['sheet-'+g,()=>page.locator(`.combined-phonebar [data-combined-group="${g}"]`).click()]);
 if(overWanted('subject-switch'))OVER.push(['subject-switch',async()=>{await page.locator('.ht-switch-label').first().click({timeout:3000});}]);}
 const check=async label=>{
  await page.waitForTimeout(1300);views++;
  if(STRESS)await page.evaluate(stress);if(PLANT)await page.evaluate(plant);
  if(EXPLAIN)await page.evaluate(()=>{window.__sidewaysExplain=true;});
  const m=await page.evaluate(([s,p,me])=>{for(const f of [s,p])if(f)(0,eval)('('+f+')')();return (0,eval)('('+me+')')();},[STRESS?stress.toString():'',PLANT?plant.toString():'',measure.toString()]);const found=m.page||m.scrollers.length||m.cut.length||m.overlap.length;
  if(found)findings.push({view:label,width,theme,...m});else console.log(`ok    ${label} ${width} ${theme}`);
  if(shotDir&&(found||SHOOT_ALL)){if(STRESS)await page.evaluate(stress);await page.screenshot({path:path.join(shotDir,`${label}-${width}-${theme}.png`)});}
 };
 for(const name of DEST){
  await fresh();
  try{await go(name);}catch(error){const entry={view:name,width,theme,unreachable:String(error.message).split('\n')[0].slice(0,100)};(KNOWN_UNREACHABLE.has(name+'@'+(phone?'phone':'desk'))?notes:findings).push(entry);if(shotDir&&!phone||shotDir&&PHONE[name])await page.screenshot({path:path.join(shotDir,`${name.toLowerCase()}-unreachable-${width}-${theme}.png`)});await page.keyboard.press('Escape');continue;}
  await check(name.toLowerCase());
  if(name==='Instagram'){await page.evaluate(()=>window.arInstagram?.close?.());}
 }
 for(const [label,open] of OVER){
  await fresh();
  try{await go('Home');await page.waitForTimeout(600);await open();}catch(error){findings.push({view:label,width,theme,unreachable:String(error.message).split('\n')[0].slice(0,100)});continue;}
  await check(label);await page.keyboard.press('Escape');
 }
 // Version two: each registered screen by its address, then the sheets over the frame.
 if(V2_WANTED){
  const v2page=await context.newPage();page=v2page;
  const open=async hash=>{await page.goto(v2url+hash,{waitUntil:'load'});await page.waitForTimeout(900);
   if(await page.evaluate(()=>document.documentElement.dataset.theme)!==theme){await page.locator('[data-v2-theme]').click();await page.waitForTimeout(300);}};
  await open('#/');
  const routes=await page.evaluate(()=>window.v2?.screens?.()||[]);
  if(!routes.length)findings.push({view:'v2',width,theme,unreachable:'version two did not start (no screens registered)'});
  for(const r of routes){
   if(!v2Wanted(r.id))continue;
   // Write, Read and Check open the words of one piece: the subject (the first one, or SIDEWAYS_V2_IDS's write, read or check) and, when named, its piece (SIDEWAYS_V2_IDS's piece, an output id).
   const words=['write','read','check'].includes(r.id);
   const hash='#/'+r.route.split('/').map(p=>p.startsWith(':')?encodeURIComponent(v2ids[r.id]||(words&&v2ids.subject)||'none'):p).join('/')+(words&&v2ids.piece?'?piece='+encodeURIComponent(v2ids.piece):'');
   await open(hash);
   if(await page.evaluate(()=>window.v2?.route?.()?.id)!==r.id){findings.push({view:'v2:'+r.id,width,theme,unreachable:'its address did not open it'});continue;}
   await check('v2-'+r.id);v2views++;
  }
  for(const [id,selector] of [['capture','[data-v2-capture]'],['ask','[data-v2-ask]']]){
   if(!v2Wanted(id))continue;
   // On a phone, Ask or find has no place in the phone bar (Home, Research, Capture, Needs you), as in the mock-up.
   if(id==='ask'&&phone){notes.push({view:'v2:ask',width,theme,note:'not in the phone bar'});continue;}
   await open('#/');
   try{await page.locator(selector+':visible').first().click({timeout:3000});}catch(error){findings.push({view:'v2:'+id,width,theme,unreachable:String(error.message).split('\n')[0].slice(0,100)});continue;}
   await check('v2-'+id);v2views++;await page.keyboard.press('Escape');
  }
 }
 await context.close();
}
await browser.close();
console.log(`Measured ${views} views (${DEST.length} destinations plus sheets and menus, ${widths.length} widths, ${themes.length} themes)${STRESS?' under stress':''}${PLANT?' with a planted offender':''}${v2views?`, of which ${v2views} are version two`:''}.`);
for(const n of notes)console.log('note '+JSON.stringify(n));
for(const f of findings)console.log(JSON.stringify(f));
if(!findings.length)console.log('Nothing scrolls sideways.');
process.exitCode=findings.length?1:0;
