/* The approved Audience header holds the actual edition picker and return action.
   Keep its native listeners and selected edition; never make a second output state. */
(()=>{
 if(window.workbenchAudienceMatch)return;
 let placed=null;
 function restore(){if(!placed)return;placed.node.querySelector('[data-wb-audience-identity]')?.remove();const {node,marker}=placed;if(marker.isConnected)marker.replaceWith(node);else node.remove();delete node.dataset.c3RetainControl;node.classList.remove('wb-audience-title-tools');placed=null;}
 function decorate(){
  const workspace=document.getElementById('workspace'),owner=workspace?.querySelector('[data-output-stage-surface="10"]'),bar=workspace?.querySelector('#c3-surface-bar>.sb-right');
  if(!workspace?.classList.contains('wb-audience')||!owner||!bar){restore();return;}
  const next=owner.querySelector(':scope>.wb-audience-selection');
  if(placed&&(!placed.node.isConnected||placed.owner!==owner||next&&next!==placed.node))restore();
  if(next&&!placed){const marker=document.createComment('Audience selection return');next.before(marker);placed={node:next,marker,owner,projectId:typeof current==='function'?current()?.id:null};next.dataset.c3RetainControl='';next.classList.add('wb-audience-title-tools');}
  if(placed&&placed.node.parentElement!==bar)bar.prepend(placed.node);
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
