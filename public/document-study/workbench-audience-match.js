/* The approved Audience header holds the actual edition picker and return action.
   Keep its native listeners and selected edition; never make a second output state. */
(()=>{
 if(window.workbenchAudienceMatch)return;
 let placed=null;
 function restore(){if(!placed)return;placed.node.querySelector('[data-wb-audience-identity]')?.remove();const {node,marker}=placed;if(marker.isConnected)marker.replaceWith(node);else node.remove();delete node.dataset.c3RetainControl;node.classList.remove('wb-audience-title-tools');placed=null;}
 // Project only facts already displayed by the current edition's readiness owner.
 // The detailed desk remains intact; this is a phone shortcut to its existing action.
 function compactReadiness(owner){
  const readiness=owner.querySelector('[data-oss-readiness]');let summary=owner.querySelector('[data-wb-audience-readiness]');
  if(!readiness){summary?.remove();return;}
  const hold=readiness.querySelector('[data-oss-hold] [role="status"]'),issue=readiness.querySelector('[data-oss-before] li'),state=readiness.querySelector(':scope>strong'),source=hold||issue||state;
  if(!source){summary?.remove();return;}
  const copy=source.cloneNode(true);copy.querySelectorAll('a,button').forEach(n=>n.remove());
  const text=copy.textContent.replace(/\s+/g,' ').trim(),action=source.querySelector('a,button');
  if(!summary){summary=document.createElement('div');summary.dataset.wbAudienceReadiness='';summary.className='wb-audience-compact-readiness';const words=document.createElement('span'),button=document.createElement('button');button.type='button';button.textContent='Review readiness';button.addEventListener('click',()=>{const current=owner.querySelector('[data-oss-readiness]');const control=current?.querySelector('[data-oss-hold] a')||current?.querySelector('[data-oss-before] button');if(control&&!control.disabled)control.click();else {current?.scrollIntoView?.({block:'start'});const heading=current?.querySelector('h3,strong');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}});summary.append(words,button);owner.prepend(summary);}
  const words=summary.querySelector('span');if(words.textContent!==text)words.textContent=text;
  const button=summary.querySelector('button'),label=hold?'Review consent':action?.textContent.replace(/\s+/g,' ').trim()||'Review readiness';if(button.textContent!==label)button.textContent=label;
 }
 function decorate(){
  const workspace=document.getElementById('workspace'),owner=workspace?.querySelector('[data-output-stage-surface="10"]'),bar=workspace?.querySelector('#c3-surface-bar>.sb-right');
  if(!workspace?.classList.contains('wb-audience')||!owner||!bar){restore();return;}
  const next=owner.querySelector(':scope>.wb-audience-selection');
  if(placed&&(!placed.node.isConnected||placed.owner!==owner||next&&next!==placed.node))restore();
  if(next&&!placed){const marker=document.createComment('Audience selection return');next.before(marker);placed={node:next,marker,owner,projectId:typeof current==='function'?current()?.id:null};next.dataset.c3RetainControl='';next.classList.add('wb-audience-title-tools');}
  if(placed&&placed.node.parentElement!==bar)bar.prepend(placed.node);
  compactReadiness(owner);
  if(!placed)return;
  const select=placed.node.querySelector('[data-oss-output]'),selection=window.studyOutputConnection?.selection?.(),output=selection?.output,projectId=typeof current==='function'?current()?.id:null;
  const kind={article:'Article',carousel:'Carousel',post:'Post','product-listing':'Product listing'}[output?.kind];
  let identity=placed.node.querySelector('[data-wb-audience-identity]');
  if(!projectId||placed.projectId!==projectId||selection?.projectId!==projectId||!select||select.value!==output?.id||!kind){identity?.remove();return;}
  if(!identity){identity=document.createElement('span');identity.dataset.wbAudienceIdentity='';identity.className='wb-audience-identity';(select.closest('.oss-output')||select).after(identity);}
  const parts=[kind,...[output.language,output.edition].filter(value=>typeof value==='string'&&value.trim())];
  const text=parts.join(' · '),title=[output.name||output.title,...parts].filter(Boolean).join(' · ');
  if(identity.textContent!==text)identity.textContent=text;
  if(identity.title!==title)identity.title=title;
 
 }
 document.addEventListener('change',event=>{if(placed?.node.contains(event.target)&&event.target.matches('[data-oss-output]'))decorate();});
 window.addEventListener('study-output-selection',decorate);
 window.workbenchAudienceMatch={decorate};window.c3Shell?.register('approved Audience title',decorate,{order:112});decorate();
})();
