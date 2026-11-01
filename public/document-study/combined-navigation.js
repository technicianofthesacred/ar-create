/* Combined navigation. The existing owners still admit every transition and save.
   Stage numbers are retained protocol identities, never a visible sequence. */
(()=>{
 'use strict';
 if(window.combinedNavigation)return;
 const ITEMS=[['home','Home'],['subjects','Subjects'],['library','Library',1],['source','Source',2],['research','Research',3],['direction','Direction',4],['write','Write',5],['check','Check',7],['media','Media',8],['arrange','Arrange',9],['audience','Audience',10],['share','Share',11],['outputs','Outputs',12]];
 // The Spine: tools in four bands under Home, Subjects and Library. Read is a view of Write.
 const BANDS=[['','',['home','subjects','library']],['gather','Gather',['source']],['develop','Develop',['research','direction']],['make','Make',['write','check','media','arrange']],['deliver','Deliver',['audience','share','outputs']]];
 let busy=false,phoneGroup='',phoneReturn=null;
 const PHONE_GROUPS={develop:['library','source','research','direction'],make:['write','check','media','arrange'],deliver:['audience','share','outputs']};
 function closePhone({restoreFocus=true}={}){phoneGroup='';document.getElementById('combined-phone-sheet')?.remove();if(restoreFocus&&phoneReturn?.isConnected)phoneReturn.focus({preventScroll:true});}
 function openPhone(key,button){
  if(phoneGroup===key)return closePhone();closePhone();phoneGroup=key;phoneReturn=button;
  const panel=document.createElement('nav');panel.id='combined-phone-sheet';panel.setAttribute('aria-label',key==='develop'?'Develop':key==='make'?'Make':'Deliver');
  for(const item of ITEMS.filter(row=>PHONE_GROUPS[key]?.includes(row[0]))){const b=document.createElement('button');b.type='button';b.dataset.combinedNav=item[0];b.textContent=item[1];panel.append(b);}
  if(key==='make')for(const [selector,label]of [['[data-wbf-tool="understanding"]','Understanding'],['[data-wbf-thought]','Add a thought'],['[data-wbf-size="-1"]','Smaller text'],['[data-wbf-size="1"]','Larger text']]){const original=document.querySelector('.wbf-top-actions '+selector);if(!original)continue;const b=document.createElement('button');b.type='button';b.dataset.combinedTool=selector;b.textContent=label;b.disabled=original.disabled;panel.append(b);}
  document.body.append(panel);panel.querySelector('button')?.focus({preventScroll:true});
 }
 const stage=()=>{try{const p=current();return p.view==='article'?5:Number(p.viewedStage)||0;}catch{return 0;}};
 const home=()=>{const d=document.getElementById('project-library');return d?.open&&!d.dataset.plContext;};
 function status(message){let el=document.getElementById('combined-navigation-status');if(!el){el=document.createElement('p');el.id='combined-navigation-status';el.setAttribute('role','status');document.getElementById('c3-tabstrip')?.append(el);}el.textContent=message;el.hidden=!message;}
 function original(n){return [...document.querySelectorAll('.workflowNavigation .workflowStep')].find(b=>Number(b.querySelector('.stepNumber')?.textContent)===n);}
 async function go(key){
  if(busy)return false;
  const item=ITEMS.find(row=>row[0]===key);if(!item)return false;
  closePhone();
  busy=true;status('');decorate();
  try{
   if(key==='home'){const owner=document.querySelector('.workflowNavigation [data-tr-home]');if(!owner||owner.disabled)throw Error('Home is not connected.');window.combinedSubjects?.close?.();owner.click();}
   else if(key==='subjects'){if(typeof window.combinedSubjects?.open!=='function')throw Error('Subjects is not connected.');await window.combinedSubjects.open();}
   else {
    if(window.combinedSubjects?.currentSubject?.()){if(typeof window.combinedSubjects.openStage!=='function')throw Error('The visible subject board cannot open its section.');return await window.combinedSubjects.openStage(item[2]);}
    if(home())await window.projectLibrary.close();
    if(home())throw Error('Save or resolve the current changes before leaving.');
    const owner=original(item[2]);if(!owner||owner.disabled)throw Error(item[1]+' is not available for this piece.');
    if(key==='check'){if(typeof window.c3WorkbenchFrame?.openTool==='function')await window.c3WorkbenchFrame.openTool('check');else if(typeof window.workspaceNavigation?.changeMode==='function')await window.workspaceNavigation.changeMode('check');else throw Error('The selected piece checking connection is unavailable.');return true;}
    if(key==='write'){if(typeof window.workspaceNavigation?.changeMode!=='function')throw Error('The selected piece writing connection is unavailable.');await window.workspaceNavigation.changeMode('write');return true;}
    if(key==='arrange'){if(typeof window.workspaceNavigation?.changeMode!=='function')throw Error('The selected piece arrangement connection is unavailable.');await window.workspaceNavigation.changeMode('arrange');return true;}
    // Forward through the actual button: selection-aware Carousel admission,
    // dirty writing and all stage-specific guards remain in one owner.
    owner.click();
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
 function decorate(){
  const owner=document.querySelector('.workflowNavigation.wb-rail'),bar=document.getElementById('c3-tabstrip');if(!owner||!bar)return;
  document.body.classList.add('combined-on');
  let rail=owner.querySelector(':scope>.combined-rail');
  if(!rail){rail=document.createElement('nav');rail.className='combined-rail';rail.setAttribute('aria-label','AR Create');
   for(const [band,name,keys]of BANDS){const group=document.createElement('div');group.className='combined-rail-band';if(band){group.dataset.band=band;const strip=document.createElement('span');strip.className='combined-band-label';strip.setAttribute('aria-hidden','true');strip.textContent=name;group.append(strip);}const tools=document.createElement('div');tools.className='combined-band-tools';for(const [key,label]of ITEMS.filter(row=>keys.includes(row[0]))){const button=document.createElement('button');button.type='button';button.dataset.combinedNav=key;button.innerHTML='<i aria-hidden="true"></i><span></span>';button.querySelector('span').textContent=label;button.title=label;tools.append(button);}group.append(tools);rail.append(group);}owner.append(rail);
  }
  let phoneBar=owner.querySelector(':scope>.combined-phonebar');if(!phoneBar){phoneBar=document.createElement('nav');phoneBar.className='combined-phonebar';phoneBar.setAttribute('aria-label','AR Create');for(const [key,label]of [['home','Home'],['subjects','Subjects'],['develop','Develop'],['make','Make'],['deliver','Deliver']]){const b=document.createElement('button');b.type='button';if(PHONE_GROUPS[key])b.dataset.combinedGroup=key;else b.dataset.combinedNav=key;b.textContent=label;phoneBar.append(b);}owner.append(phoneBar);}
  const subjects=!!document.querySelector('#project-library[data-combined-subjects]'),n=stage(),selected=home()?(subjects?'subjects':'home'):ITEMS.find(row=>row[2]===(n===6?5:n))?.[0];
  for(const b of rail.querySelectorAll('button')){const on=b.dataset.combinedNav===selected;if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');if(b.disabled!==busy)b.disabled=busy;}
  for(const band of rail.querySelectorAll('.combined-rail-band[data-band]'))band.classList.toggle('is-active',!!band.querySelector('[aria-current]'));
  for(const b of phoneBar.querySelectorAll('button')){const key=b.dataset.combinedNav||b.dataset.combinedGroup,on=key===selected||PHONE_GROUPS[key]?.includes(selected);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');if(b.dataset.combinedGroup)b.setAttribute('aria-expanded',String(phoneGroup===b.dataset.combinedGroup));if(b.disabled!==busy)b.disabled=busy;}
  let switcher=bar.querySelector(':scope>.combined-piece-switch');
  const piece=!home()&&([5,6].includes(n)||n===9&&!!document.querySelector('#study-output-canvas .car-writing-page'));
  if(!piece){switcher?.remove();return;}
  if(!switcher){switcher=document.createElement('div');switcher.className='combined-piece-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Write view');for(const [key,label]of [['write','Edit'],['read','Read']]){const b=document.createElement('button');b.type='button';b.dataset.combinedMode=key;b.textContent=label;switcher.append(b);}bar.insertBefore(switcher,bar.querySelector('.wbf-top-actions'));}
  const carousel=document.querySelector('.car-writing-page'),view=n===7||window.workspaceNavigation?.isCarouselCheck?.()?'check':n===6||window.studyDraft?.viewMode?.()==='preview'||carousel?.dataset.writingView==='read'?'read':'write';
  for(const b of switcher.querySelectorAll('button')){const pressed=String(b.dataset.combinedMode===view);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);if(b.disabled!==busy)b.disabled=busy;}
 }
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-combined-nav],[data-combined-mode],[data-combined-group],[data-combined-home-board],[data-combined-tool]');if(!b||b.disabled)return;event.preventDefault();if(b.dataset.combinedTool){const original=document.querySelector('.wbf-top-actions '+b.dataset.combinedTool);closePhone();original&&!original.disabled&&original.click();return;}if(b.hasAttribute('data-combined-home-board')){void window.combinedSubjects.open(b.dataset.combinedHomeBoard?{projectId:b.dataset.combinedHomeBoard}:{}).then(decorate).catch(error=>status(error.message));return;}if(b.dataset.combinedGroup)openPhone(b.dataset.combinedGroup,b);else if(b.dataset.combinedMode)void mode(b.dataset.combinedMode);else void go(b.dataset.combinedNav);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&phoneGroup){event.preventDefault();closePhone();}});
 document.addEventListener('keydown',event=>{if(!event.target.closest?.('.combined-rail')||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;const list=[...document.querySelectorAll('.combined-rail button:not(:disabled)')],i=list.indexOf(event.target);if(i<0)return;event.preventDefault();list[event.key==='Home'?0:event.key==='End'?list.length-1:(i+(event.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();});
 document.addEventListener('toggle',event=>{if(event.target.id==='project-library')decorate();},true);
 window.addEventListener('c3-header-painted',decorate);
 // Context sheets intercept the group click before its normal navigation handler.
 const sheetOpenObserver=new MutationObserver(records=>{if(phoneGroup&&records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&node.id==='combined-sheet')))closePhone({restoreFocus:false});});sheetOpenObserver.observe(document.body,{childList:true});window.addEventListener('pagehide',()=>sheetOpenObserver.disconnect(),{once:true});
 window.combinedNavigation={go,decorate};
 window.c3Shell?.register('Combined navigation',decorate,{order:125,ignore:'.combined-rail,.combined-piece-switch,#combined-navigation-status'});
 decorate();
})();
