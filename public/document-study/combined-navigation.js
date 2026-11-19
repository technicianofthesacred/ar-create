/* Combined navigation. The existing owners still admit every transition and save.
   Stage numbers are retained protocol identities, never a visible sequence. */
(()=>{
 'use strict';
 if(window.combinedNavigation)return;
 const ITEMS=[['home','Home'],['subjects','Subjects'],['library','Library',1],['material','Material',1],['source','Source',2],['research','Research',3],['learning','Learning library'],['os','i64 OS'],['direction','Direction',4],['write','Write',5],['check','Check',7],['media','Media',8],['arrange','Arrange',9],['audience','Audience',10],['share','Share',11],['outputs','Outputs',12]];
 // One line icon per tool, as in Workbench Revision 4 (a blank square read as a checkbox).
 const ICONS={"home": "<path d=\"M4 11l8-7 8 7v9H4zM10 20v-6h4v6\">", "library": "<path d=\"M5 4v16M9 4v16M13 5l5 15\">", "material": "<path d=\"M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5\">", "source": "<path d=\"M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2\">", "research": "<path d=\"M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l4 4\">", "direction": "<path d=\"M12 3v18M5 5h11l3 3-3 3H5zM9 15h-4\">", "write": "<path d=\"M4 20h4L19 9l-4-4L4 16zM14 6l4 4\">", "check": "<path d=\"M5 12l4 4L19 6\">", "media": "<path d=\"M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01\">", "arrange": "<path d=\"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z\">", "audience": "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z\">", "share": "<path d=\"M4 12v7h16v-7M12 3v12M8 7l4-4 4 4\">", "outputs": "<path d=\"M12 3l9 5-9 5-9-5zM3 13l9 5 9-5\">", "subjects": "<path d=\"M4 7h16M4 12h16M4 17h10\"></path>"};
 // The Spine: tools in four bands under Home, Subjects and Library. Read is a view of Write.
 const BANDS=[['','',['home','library']],['gather','Gather',['material','source']],['develop','Develop',['research','learning','direction']],['make','Make',['write','check','media','arrange']],['deliver','Deliver',['audience','share','outputs']]];
 const returnTarget=()=>{const link=document.querySelector('.i64-return[href]'),href=link&&window.ArI64Return?.validateReturnTarget?.(link.getAttribute('href'));return href&&link.href===href?{link,href}:null;};
 const railWide=()=>{try{return localStorage.getItem('combined-rail-wide')!=='false';}catch{return true;}};
 let busy=false,phoneGroup='',phoneReturn=null;
 const PHONE_GROUPS={develop:['library','source','research','learning','direction','os'],make:['write','check','media','arrange'],deliver:['audience','share','outputs']};
 function closePhone({restoreFocus=true}={}){phoneGroup='';document.getElementById('combined-phone-sheet')?.remove();if(restoreFocus&&phoneReturn?.isConnected)phoneReturn.focus({preventScroll:true});}
 function openPhone(key,button){
  if(phoneGroup===key)return closePhone();closePhone();phoneGroup=key;phoneReturn=button;
  const panel=document.createElement('nav');panel.id='combined-phone-sheet';panel.setAttribute('aria-label',key==='develop'?'Develop':key==='make'?'Make':'Deliver');panel.dataset.band=key;const bandLabel=document.createElement('span');bandLabel.className='combined-phone-band-label';bandLabel.textContent=key==='develop'?'Develop':key==='make'?'Make':'Deliver';bandLabel.setAttribute('aria-hidden','true');const tools=document.createElement('div');tools.className='combined-phone-tools';panel.append(bandLabel,tools);
  for(const item of ITEMS.filter(row=>PHONE_GROUPS[key]?.includes(row[0])&&(row[0]!=='os'||returnTarget()))){const b=document.createElement('button');b.type='button';b.dataset.combinedNav=item[0];b.textContent=item[1];tools.append(b);}

  document.body.append(panel);panel.querySelector('button')?.focus({preventScroll:true});
 }
 const stage=()=>{try{if(window.c3Research?.isOpen?.())return 3;const p=current();return p.view==='article'?5:Number(p.viewedStage)||0;}catch{return 0;}};
 const home=()=>{const d=document.getElementById('project-library');return d?.open&&!d.dataset.plContext;};
 function status(message){let el=document.getElementById('combined-navigation-status');if(!el){el=document.createElement('p');el.id='combined-navigation-status';el.setAttribute('role','status');document.getElementById('c3-tabstrip')?.append(el);}el.textContent=message;el.hidden=!message;}
 function original(n){return [...document.querySelectorAll('.workflowNavigation .workflowStep')].find(b=>Number(b.querySelector('.stepNumber')?.textContent)===n);}
 async function go(key){
  if(busy)return false;
  const item=ITEMS.find(row=>row[0]===key);if(!item)return false;
  closePhone();
  busy=true;status('');decorate();
  try{
   const researchOpen=!!window.c3Research?.isOpen?.();
   if(key!=='research'&&researchOpen&&window.c3Research.hide()===false)return false;
   if(key==='write'&&researchOpen&&stage()===5&&document.getElementById('manuscript')&&window.studyDraft?.viewMode?.()==='edit')return true;
   if(key==='os'){const target=returnTarget();if(!target)throw Error('Return to i64 OS is unavailable. Reopen AR Create from i64 OS.');target.link.click();}
   else if(key==='learning'){if(typeof window.connectedWorkspace?.openContext!=='function')throw Error('Learning library is not connected.');if(home())await window.projectLibrary.close();if(home())throw Error('Save or resolve the current changes before leaving.');await window.connectedWorkspace.openContext('inquiries');}
   else if(key==='home'){const owner=document.querySelector('.workflowNavigation [data-tr-home]');if(!owner||owner.disabled)throw Error('Home is not connected.');window.combinedSubjects?.close?.();owner.click();}
   else if(key==='subjects'){if(typeof window.combinedSubjects?.open!=='function')throw Error('Subjects is not connected.');await window.combinedSubjects.open();}
   else {
    if(window.combinedSubjects?.currentSubject?.()){if(typeof window.combinedSubjects.openStage!=='function')throw Error('The visible subject board cannot open its section.');const result=await window.combinedSubjects.openStage(item[2]);if(result!==false&&key==='research'&&typeof window.c3Research?.openLearning==='function')await window.c3Research.openLearning({parentStudyId:current().id});return result;}
    if(home())await window.projectLibrary.close();
    if(home())throw Error('Save or resolve the current changes before leaving.');
    if(key==='research'&&typeof window.c3Research?.openLearning==='function'){await window.c3Research.openLearning({parentStudyId:current().id});return true;}
    const owner=original(item[2]);if(!owner||owner.disabled)throw Error(item[1]+' is not available for this piece.');
    if(key==='check'){if(typeof window.c3WorkbenchFrame?.openTool==='function')await window.c3WorkbenchFrame.openTool('check');else if(typeof window.workspaceNavigation?.changeMode==='function')await window.workspaceNavigation.changeMode('check');else throw Error('The selected piece checking connection is unavailable.');return true;}
    if(key==='write'){if(typeof window.workspaceNavigation?.changeMode!=='function')throw Error('The selected piece writing connection is unavailable.');await window.workspaceNavigation.changeMode('write');return true;}
    if(key==='arrange'){if(typeof window.workspaceNavigation?.changeMode!=='function')throw Error('The selected piece arrangement connection is unavailable.');await window.workspaceNavigation.changeMode('arrange');return true;}
    // Forward through the actual button: selection-aware Carousel admission,
    // dirty writing and all stage-specific guards remain in one owner.
    owner.click();
    // Material is the Library step's intake mode; Library is the same step without it.
    if(key==='material'||key==='library'){await new Promise(r=>setTimeout(r,60));document.querySelector(key==='material'?'[data-mi-open]':'.mi-open [data-mi-back]')?.click();}
   }
   return true;
  }catch(error){status(error.message||'This work could not open. Your words are retained.');return false;}
  finally{busy=false;decorate();}
 }
 async function mode(value){
  if(busy)return;
  busy=true;status('');decorate();
  try{if(typeof window.workspaceNavigation?.changeMode!=='function')throw Error('The piece view is not connected.');await window.workspaceNavigation.changeMode(value);}
  catch(error){status(error.message||'The view could not change. Your words are retained.');}
  finally{busy=false;decorate();}
 }
 // Keyboard: a "Skip to the page" link is the first Tab stop, and a control hidden by the look (clipped to 1px) is not a Tab stop.
 function keyboardAids(){
  if(!document.querySelector('.combined-skip')){const a=document.createElement('a');a.className='combined-skip';a.href='#workspace';a.textContent='Skip to the page';a.addEventListener('click',event=>{const page=document.getElementById('workspace');if(!page)return;event.preventDefault();page.setAttribute('tabindex','-1');page.focus({preventScroll:false});});document.body.prepend(a);}
  // Sizes decide first: only a box of 2px or less is asked for its computed style, so a repaint does not style every control and its ancestors.
  // A page that is not laid out (no body width) measures every box as zero, so nothing can be judged clipped there and the scan is skipped.
  if(!document.body.offsetWidth)return;
  const clipped=el=>{for(let x=el;x&&x!==document.body;x=x.parentElement){if(!(x.offsetWidth<=2&&x.offsetHeight<=2))continue;const c=getComputedStyle(x);if(c.clip!=='auto'&&c.position==='absolute')return true;}return false;};
  for(const el of document.querySelectorAll('#workspace :is(a[href],button,input,select,textarea,summary,[tabindex]):not([tabindex="-1"]):not([disabled])')){if(clipped(el)){el.dataset.combinedUntabbed=el.getAttribute('tabindex')??'';el.setAttribute('tabindex','-1');}}
  for(const el of document.querySelectorAll('#workspace [data-combined-untabbed]')){if(!clipped(el)){const was=el.dataset.combinedUntabbed;if(was==='')el.removeAttribute('tabindex');else el.setAttribute('tabindex',was);delete el.dataset.combinedUntabbed;}}
 }
 function decorate(){
  const owner=document.querySelector('.workflowNavigation.wb-rail'),bar=document.getElementById('c3-tabstrip');if(!owner||!bar)return;
  keyboardAids();
  document.body.classList.add('combined-on');
  let rail=owner.querySelector(':scope>.combined-rail');
  if(!rail){rail=document.createElement('nav');rail.className='combined-rail';rail.setAttribute('aria-label','AR Create');
   for(const [band,name,keys]of BANDS){const group=document.createElement('div');group.className='combined-rail-band';if(band){group.dataset.band=band;const strip=document.createElement('span');strip.className='combined-band-label';strip.setAttribute('aria-hidden','true');strip.textContent=name;group.append(strip);const count=document.createElement('b');count.className='combined-band-count';count.setAttribute('aria-hidden','true');group.append(count);}const tools=document.createElement('div');tools.className='combined-band-tools';for(const [key,label]of ITEMS.filter(row=>keys.includes(row[0]))){const button=document.createElement('button');button.type='button';button.dataset.combinedNav=key;button.innerHTML='<svg class="combined-ic" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[key==='learning'?'library':key]||'')+'</svg><span></span>';button.querySelector('span').textContent=key==='learning'?'Learning':label;button.title=label;if(key==='learning'){button.className='btn quiet';button.setAttribute('aria-label',label);}tools.append(button);}group.append(tools);rail.append(group);}owner.append(rail);
  }
  const returnOwner=returnTarget();let exit=rail.querySelector('[data-combined-nav="os"]');
  if(!returnOwner)exit?.remove();else if(!exit){exit=document.createElement('button');exit.type='button';exit.dataset.combinedNav='os';exit.className='btn quiet';exit.title='Return to i64 OS';exit.innerHTML='<svg class="combined-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l-7 7 7 7M2 12h14M15 4h7v16h-7"/></svg><span>i64 OS</span>';rail.querySelector('.combined-band-tools')?.append(exit);}
  let phoneBar=owner.querySelector(':scope>.combined-phonebar');if(!phoneBar){phoneBar=document.createElement('nav');phoneBar.className='combined-phonebar';phoneBar.setAttribute('aria-label','AR Create');for(const [key,label]of [['home','Home'],['subjects','Subjects'],['develop','Develop'],['make','Make'],['deliver','Deliver']]){const b=document.createElement('button');b.type='button';if(PHONE_GROUPS[key])b.dataset.combinedGroup=key;else b.dataset.combinedNav=key;b.textContent=label;phoneBar.append(b);}owner.append(phoneBar);}
  const subjects=!!document.querySelector('#project-library[data-combined-subjects]'),n=stage(),selected=home()?(subjects?'subjects':'home'):n===1&&document.querySelector('.mi-open')?'material':ITEMS.find(row=>row[2]===(n===6?5:n))?.[0];
  for(const b of rail.querySelectorAll('button')){const on=b.dataset.combinedNav===(selected==='subjects'?'home':selected);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');if(b.disabled!==busy)b.disabled=busy;}
  for(const band of rail.querySelectorAll('.combined-rail-band[data-band]'))band.classList.toggle('is-active',!!band.querySelector('[aria-current]'));
  // The Spine's waiting counts: what is waiting on Adrian at each step.
  const counts=window.c3WorkbenchFrame?.waitingCounts?.()||{};for(const b of rail.querySelectorAll('[data-combined-nav]')){const item=ITEMS.find(row=>row[0]===b.dataset.combinedNav),n=b.dataset.combinedNav==='home'?counts.home:item?.[2]?counts[item[2]]:0;let badge=b.querySelector(':scope>b');const name=item?.[1]||b.title;if(n){if(!badge){badge=document.createElement('b');badge.className='combined-count';badge.setAttribute('aria-hidden','true');b.append(badge);}if(badge.textContent!==String(n))badge.textContent=String(n);}else badge?.remove();const tip=n?name+' · '+n+' waiting on you':name;if(b.title!==tip)b.title=tip;}
  for(const band of rail.querySelectorAll('.combined-rail-band[data-band]')){const row=BANDS.find(r=>r[0]===band.dataset.band),sum=(row?.[2]||[]).reduce((t,key)=>{const step=ITEMS.find(r=>r[0]===key)?.[2];return t+(step&&Number(counts[step])||0);},0),text=sum?String(sum):'',el=band.querySelector(':scope>.combined-band-count');if(el&&el.textContent!==text)el.textContent=text;const tip=sum?row[1]+' · '+sum+' waiting on you':'';if(band.title!==tip)band.title=tip;}
  let toggle=rail.querySelector(':scope>[data-combined-rail-toggle]');if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.dataset.combinedRailToggle='';toggle.innerHTML='<svg class="combined-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6l-6 6 6 6M19 6l-6 6 6 6"/></svg><span></span>';rail.prepend(toggle);}const wide=railWide();document.body.classList.toggle('combined-rail-wide',wide);const label=wide?'Collapse':'Expand',action=label+' sidebar';if(toggle.querySelector('span').textContent!==label)toggle.querySelector('span').textContent=label;if(toggle.title!==action){toggle.title=action;toggle.setAttribute('aria-label',action);}if(toggle.getAttribute('aria-expanded')!==String(wide))toggle.setAttribute('aria-expanded',String(wide));
  for(const b of phoneBar.querySelectorAll('button')){const key=b.dataset.combinedNav||b.dataset.combinedGroup,on=key===selected||selected!=='library'&&PHONE_GROUPS[key]?.includes(selected);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');if(b.dataset.combinedGroup)b.setAttribute('aria-expanded',String(phoneGroup===b.dataset.combinedGroup));if(b.disabled!==busy)b.disabled=busy;}
  let switcher=bar.querySelector(':scope>.combined-piece-switch');
  const piece=!home()&&([5,6].includes(n)||n===9&&!!document.querySelector('#study-output-canvas .car-writing-page'));
  if(!piece||document.body.classList.contains('combined-piece-on')&&document.getElementById('combined-piece-frame')){switcher?.remove();return;}
  if(!switcher){switcher=document.createElement('div');switcher.className='combined-piece-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Write view');for(const [key,label]of [['write','Edit'],['read','Read']]){const b=document.createElement('button');b.type='button';b.dataset.combinedMode=key;b.textContent=label;switcher.append(b);}bar.insertBefore(switcher,bar.querySelector('.wbf-top-actions'));}
  const carousel=document.querySelector('.car-writing-page'),view=n===7||window.workspaceNavigation?.isCarouselCheck?.()?'check':n===6||window.studyDraft?.viewMode?.()==='preview'||carousel?.dataset.writingView==='read'?'read':'write';
  for(const b of switcher.querySelectorAll('button')){const pressed=String(b.dataset.combinedMode===view);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);if(b.disabled!==busy)b.disabled=busy;}
 }
 document.addEventListener('click',event=>{const t=event.target.closest?.('[data-combined-rail-toggle]');if(!t)return;event.preventDefault();try{localStorage.setItem('combined-rail-wide',String(!railWide()));}catch{}decorate();});
 window.addEventListener('combined-counts',()=>decorate());
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-combined-nav],[data-combined-mode],[data-combined-group],[data-combined-home-board],[data-combined-tool]');if(!b||b.disabled)return;event.preventDefault();if(b.dataset.combinedTool){const original=document.querySelector('.wbf-top-actions '+b.dataset.combinedTool);closePhone();original&&!original.disabled&&original.click();return;}if(b.hasAttribute('data-combined-home-board')){void window.combinedSubjects.open(b.dataset.combinedHomeBoard?{projectId:b.dataset.combinedHomeBoard}:{}).then(decorate).catch(error=>status(error.message));return;}if(b.dataset.combinedGroup)openPhone(b.dataset.combinedGroup,b);else if(b.dataset.combinedMode)void mode(b.dataset.combinedMode);else void go(b.dataset.combinedNav);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&phoneGroup){event.preventDefault();closePhone();}});
 document.addEventListener('keydown',event=>{if(!event.target.closest?.('.combined-rail')||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;const list=[...document.querySelectorAll('.combined-rail button:not(:disabled)')],i=list.indexOf(event.target);if(i<0)return;event.preventDefault();list[event.key==='Home'?0:event.key==='End'?list.length-1:(i+(event.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();});
 document.addEventListener('toggle',event=>{if(event.target.id==='project-library')decorate();},true);
 window.addEventListener('c3-header-painted',decorate);
 // Context sheets intercept the group click before its normal navigation handler.
 const sheetOpenObserver=new MutationObserver(records=>{if(phoneGroup&&records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&node.id==='combined-sheet')))closePhone({restoreFocus:false});});sheetOpenObserver.observe(document.body,{childList:true});window.addEventListener('pagehide',event=>{if(!event.persisted)sheetOpenObserver.disconnect();});
 window.combinedNavigation={go,decorate,closePhone};
 window.c3Shell?.register('Combined navigation',decorate,{order:125,ignore:'.combined-rail,.combined-piece-switch,#combined-navigation-status'});
 decorate();
})();
