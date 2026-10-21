/* Stage 12 read surface. Install after the existing study scripts. */
(()=>{
 const rooms=new Map();let epoch=0;
 const examples=false; // Real output owner only; the old layout-review query has no data authority.
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const statusLabels={'in-progress':'In progress','review-needed':'Review needed','correction-needed':'Correction needed',complete:'Complete',paused:'Paused'};
 const kinds=new Set(['native','words','arrange','review','destination','export','history','correction','new-edition','request-expression','follow-up','create-article','create-carousel','create-post','create-product-listing']);
 const active=p=>p.view==='record'&&Number(p.viewedStage)===12;
 const room=id=>{if(!rooms.has(id))rooms.set(id,{data:null,error:'',loading:false});return rooms.get(id)};
 const date=value=>{if(!value)return 'Date not recorded';const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Date not recorded';};
 function delivery(output){const d=output.delivery||{},lines=[];
  if(d.published)lines.push(`<span class="oo-delivery-line" title="${esc(d.published.platform||'Publication')} · ${esc(date(d.published.date))}"><strong>Published</strong>${''}</span>`);
  if(d.exported)lines.push(`<span class="oo-delivery-line" title="${esc(d.exported.label||'Export')} · ${esc(date(d.exported.date))}"><strong>Exported</strong>${''}</span>`);
  return lines.length?lines.join(''):`<span class="oo-detail" title="${esc(output.exportError||'No export or publication recorded')}">${output.status==='complete'?'No proof':'—'}</span>`;
 }
 function details(output){const d=output.delivery||{};return `<details class="oo-more"><summary aria-label="Details for ${esc(output.title)}">More</summary><div class="oo-detail-body"><p><strong>${esc(output.title)}</strong><br>${esc(output.format)} · ${esc(output.language||'Language not recorded')} · edition ${esc(output.edition||'not recorded')}</p><p>${esc(output.followUp||'No follow-up recorded')}</p><p>Completed: ${esc(date(d.completedAt))}</p>${d.published?`<p>Published edition ${esc(d.published.edition??output.edition??'not recorded')} · ${esc(date(d.published.date))}</p>`:''}${d.exported?`<p>Export version ${esc(d.exported.version??'not recorded')} · ${esc(date(d.exported.date))}</p>`:''}${!examples?`${d.published?.url?button(output,{kind:'destination',label:'Open live edition'},d.published.edition):''}${d.exported?.fileId?button(output,{kind:'export',label:'Get export'},output.edition):''}${(Array.isArray(output.actions)?output.actions:[]).filter(action=>action&&kinds.has(action.kind)).map(action=>button(output,action,output.edition)).join('')}`:''}</div></details>`;}
 function button(output,action,edition){const available=!examples&&typeof window.realOutputOverview?.onAction==='function'&&kinds.has(action.kind);return `<button type="button" class="oo-action" data-output-action="${esc(action.kind)}" data-output-id="${esc(output.id??'')}" data-output-edition="${esc(edition??output.edition??'')}" ${available?'':'disabled'}>${esc(action.label)}</button>`;}
 function row(output){const action=output.nextAction&&kinds.has(output.nextAction.kind)?output.nextAction:null;return `<article class="oo-row" data-overview-output="${esc(output.id)}"><div class="oo-identity"><h3 title="${esc(output.title)}"><button type="button" class="oo-title" data-output-action="${['post','product-listing'].includes(output.kind)?'native':'arrange'}" data-output-id="${esc(output.id)}" data-output-edition="${esc(output.edition??'')}">${esc(output.title||'Untitled output')}</button></h3><p class="oo-meta" title="${esc([output.format,output.language,output.edition?'Edition '+output.edition:null].filter(Boolean).join(' · '))}">${esc([output.format||'Output',output.language,output.edition?'Edition '+output.edition:null].filter(Boolean).join(' · '))}</p></div><div class="oo-state" data-status="${esc(output.status)}"><strong>${esc(statusLabels[output.status]||'Status not recorded')}</strong></div><div class="oo-delivery">${delivery(output)}</div><div class="oo-actions">${action?button(output,action):'<span class="oo-detail">No next action recorded</span>'}${details(output)}</div></article>`;}
 function surface(p){const r=room(p.id),data=r.data;
  return `<section class="oo-panel" aria-label="Project outputs"><header class="oo-heading"><h2>Outputs</h2>${examples?'<span class="oo-example-label">Examples · read-only</span>':data?.outputs?.length?button({id:null},{kind:'request-expression',label:'New expression'}):''}</header>${r.error&&!examples?`<div class="oo-empty"><p role="alert">${esc(r.error)}</p>${/approve|approval|marked/i.test(r.error)&&r.data?.existingDraft?button({id:null},{kind:'native',label:'Review in Draft'}):'<button type="button" class="oo-action" data-output-retry>Try again</button>'}</div>`:data?.availability&&data.availability.state!=='ready'?`<div class="oo-empty"><p role="status">${esc(data.availability.message||'Saved outputs are unavailable for this project.')}</p><button type="button" class="oo-action" data-output-retry>Try again</button></div>`:!data?'<p class="oo-empty" role="status">Reading this project’s outputs…</p>':data.outputs.length?`<div class="oo-columns" aria-hidden="true"><span>Expression</span><span>Work status</span><span>Delivery</span><span>Next action</span></div><div class="oo-register">${data.outputs.map(row).join('')}</div>`:`<div class="oo-empty"><p>No connected outputs yet.</p>${esc(data.emptyMessage||'')}${(data.emptyActions?.length?data.emptyActions:data.existingDraft?[{kind:'native',label:'Continue Draft'}]:[]).map(action=>button({id:null},action)).join('')}${!data.existingDraft?'<span class="oo-detail">Open the draft to continue this project.</span>':''}</div>`}</section>`;
 }
 function paint(){const p=current();if(!active(p))return;const host=document.getElementById('output-overview');if(!host)return;host.innerHTML=surface(p);wire(p);}
 let delegated=false;
 function wire(){if(delegated)return;delegated=true;document.addEventListener('click',async event=>{
   const el=event.target.closest?.('#output-overview [data-output-action],#output-overview [data-output-retry]');if(!el||el.disabled)return;
   const p=current(),host=el.closest('#output-overview');if(examples||!active(p)||host!==document.getElementById('output-overview')||host.dataset.outputProject!==p.id)return;
   if(el.hasAttribute('data-output-retry'))return load();
   if(typeof window.realOutputOverview?.onAction!=='function')return;
   const data=room(p.id).data,output=el.dataset.outputId?data?.outputs.find(item=>item.id===el.dataset.outputId):null;
   if(el.dataset.outputId&&!output)return;
   el.disabled=true;
   try{await window.realOutputOverview.onAction({projectId:p.id,outputId:output?.id??null,edition:el.dataset.outputEdition||null,kind:el.dataset.outputAction,...(output?.delivery?.published&&el.dataset.outputAction==='destination'?{publication:structuredClone(output.delivery.published)}:{}),...(output?.delivery?.exported&&el.dataset.outputAction==='export'?{export:structuredClone(output.delivery.exported)}:{}),...(!output&&el.dataset.outputAction==='native'?{bindingId:data?.existingDraft?.bindingId??null}:{})});}
   catch(error){if(current().id===p.id){room(p.id).error=error.message||'This output could not be opened.';paint();}}
   finally{if(el.isConnected)el.disabled=false;}
  });
 }

 async function load(){const p=current();if(!active(p)||examples)return;const r=room(p.id),token=epoch;r.loading=true;r.error='';
  if(typeof window.realOutputOverview?.read!=='function'){r.data=null;r.error='Outputs are unavailable. Your existing work is unchanged.';r.loading=false;paint();return;}
  try{const data=await window.realOutputOverview.read({projectId:p.id});if(token!==epoch||current().id!==p.id||!active(current()))return;if(!data||data.projectId!==p.id||!Array.isArray(data.outputs)||data.outputs.some(output=>!output||typeof output.id!=='string')||new Set(data.outputs.map(output=>output.id)).size!==data.outputs.length)throw Error('The output register returned another project or invalid output identities.');r.data=data;r.error='';}
  catch(error){if(token===epoch&&current().id===p.id)r.error=error.message||'Outputs could not be read.';}
  finally{r.loading=false;if(token===epoch&&current().id===p.id)paint();}
 }
 const previousNotice=historicalNotice;historicalNotice=function(p,stage){return stage===12?'':previousNotice(p,stage)};
 const previousWorkflow=workflowBar;workflowBar=function(p){return previousWorkflow(p).replace('View step 12: Confirmed (read-only)','View step 12: Outputs (private register)').replace('>Confirmed</span>','>Outputs</span>').replace('Viewing: 12. Confirmed','Viewing: 12. Outputs')};
 const previousPhase=phaseReader;phaseReader=function(p){return active(p)?`<section class="phaseReader oo-stage" id="output-overview" data-output-project="${esc(p.id)}">${surface(p)}</section>`:previousPhase(p)};
 const previousRender=render;render=function(){epoch++;previousRender();if(active(current())){wire(current());load();}};
 window.outputOverview={refresh(){if(active(current())){epoch++;return load();}}};
 wire();
 if(examples)viewPhase(12);else if(active(current()))render();
})();
