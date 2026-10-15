/* Bind the supplied-resource browser to the maintained Material projection only. */
(()=>{
 if(window.studyMaterialBrowserIntegration)return;
 const projections=new Map();let active=null,queued=false,stopped=false;
 const original=window.MaterialSurface?.render;if(!original)return;
 const plain=(record,h)=>{const copy={...record};if(typeof copy.raw==='string')copy.raw=copy.raw.replace(/%%[\s\S]*?(?:%%|$)/g,'');else if(copy.html)copy.html=String(copy.html).replace(/%%[\s\S]*?(?:%%|$)/g,'');const root=document.createElement('div');root.innerHTML=h.recordWords(copy);root.querySelectorAll('script,iframe,object,embed').forEach(n=>n.remove());
  const parts=[],blocks=/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|SECTION|ARTICLE|UL|OL|DL|DT|DD|TABLE|TR|HR)$/;
  const visit=node=>{if(node.nodeType===3){parts.push(node.nodeValue);return;}if(node.nodeType!==1)return;if(node.tagName==='BR'){parts.push('\n');return;}const block=blocks.test(node.tagName);if(block)parts.push('\n\n');for(const child of node.childNodes)visit(child);if(['TD','TH'].includes(node.tagName))parts.push('\t');if(block)parts.push('\n\n');};
  for(const child of root.childNodes)visit(child);
  return window.MaterialSurface.redactText(parts.join('').replace(/\n(?:[ \t]*\n){2,}/g,'\n\n').trim());
 };
 window.MaterialSurface.render=function(c,stage,h){const html=original.apply(this,arguments);if(stage!==1)return html;
  const records=window.MaterialSurface.records(c,h),refs=new Map(),resources=[];
  records.forEach((r,index)=>{
   /* The original reader's actual key is its exact path. Pass it through; no slug,
      guessed UUID, file URL or new canonical identity is manufactured. */
   const id=r.id||r.sourceId||r.path;if(typeof id!=='string'||!id||refs.has(id))return;
   const revision=r.hash||r.modifiedAt||undefined;refs.set(id,{action:'history:'+index,revision});resources.push({id,projectId:c.id,sourceId:id,revision,name:window.MaterialSurface.redactText(r.title||r.name||'Source record'),kind:/^SRC\b/i.test(r.name||'')?'transcript':/^CONTEXT\b/i.test(r.name||'')?'note':'document',availability:r.missing?'missing':r.hash?'available':undefined,text:plain(r,h)});
  });
  for(const m of c.live.flow?.materials||[]){if(typeof m.sourceId!=='string'||!m.sourceId||refs.has(m.sourceId))continue;const revision=m.hash||undefined;refs.set(m.sourceId,{action:'open:'+m.sourceId,revision});const kind=['audio','video','image','transcript','note','link','text'].includes(m.kind)?m.kind:'document',media=['audio','video','image'].includes(kind),read=c.live.opened===m.sourceId?c.live.read:null;
   resources.push({id:m.sourceId,projectId:c.id,sourceId:m.sourceId,revision,name:window.MaterialSurface.redactText(m.title||'Added material'),kind,availability:media?'available':undefined,previewUrl:media?'/api/sources/blob?id='+encodeURIComponent(m.sourceId):undefined,thumbnailUrl:kind==='image'?'/api/sources/blob?id='+encodeURIComponent(m.sourceId):undefined,text:read?window.MaterialSurface.redactText(read.body??read.text??read.content??''):undefined});
  }
  for(const audio of c.live.originals?.audio||[]){if(typeof audio.id!=='string'||!audio.id||refs.has(audio.id))continue;resources.push({id:audio.id,projectId:c.id,name:window.MaterialSurface.redactText(audio.title||'Original recording'),kind:'audio',availability:'available',previewUrl:audio.url});}
  projections.set(c.id,{model:{projectId:c.id,resources},refs});
  const box=document.createElement('div');box.innerHTML=html;const surface=box.querySelector('.material-surface'),index=surface?.querySelector('.material-layout');if(index){surface.classList.add('material-browser-mounted');const host=document.createElement('div');host.dataset.materialBrowserHost=c.id;index.before(host);}return box.innerHTML;
 };
 // Preserve the maintained stage wrapper's installation marker so its observer
 // cannot wrap this projection again and duplicate all organization controls.
 window.MaterialSurface.render.swsWrapped=original.swsWrapped;

 function destroy(){active?.api.destroy();active=null;}
 function decorate(){if(stopped)return;const p=typeof current==='function'?current():null,host=document.querySelector('[data-material-browser-host]');if(p?.viewedStage!==1||p.view!=='record'||!host||host.dataset.materialBrowserHost!==p.id||!window.MaterialResourceBrowser){destroy();return;}const projection=projections.get(p.id);if(!projection)return;
  if(active&&active.projectId!==p.id)destroy();
  if(active&&active.host!==host){host.replaceWith(active.host);}
  const target=active?.host||host,stamp=JSON.stringify(projection.model);
  if(active){active.refs=projection.refs;if(active.stamp!==stamp){active.api.update(projection.model);active.stamp=stamp;}return;}
  const api=window.MaterialResourceBrowser.mount(target,projection.model,{onOpenSource:scope=>{
   const p=typeof current==='function'?current():null,row=active?.refs.get(scope.id);if(!active||p?.id!==scope.projectId||p.viewedStage!==1||!row||row.revision!==scope.revision)throw Error('This source changed. Reopen Material before following it.');
   const control=[...document.querySelectorAll('.material-surface [data-flow-action]')].find(n=>n.dataset.flowAction===row.action);if(!control||control.disabled)throw Error('This source reader is unavailable. The retained preview remains readable.');control.click();if(current()?.id===scope.projectId)viewPhase(2);
  }});
  active={projectId:p.id,host:target,refs:projection.refs,stamp,api};
 }
 const observer=new MutationObserver(()=>{if(stopped||queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate()});});observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>{stopped=true;observer.disconnect();destroy();},{once:true});window.studyMaterialBrowserIntegration={refresh:decorate};decorate();
})();
