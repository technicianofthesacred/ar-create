/* Pure projection: the caller owns records, media URLs, privacy filtering and all mutations.
 * mount(host, model, callbacks) -> { update(model), getSelection(), destroy() }.
 * See HANDOFF.md for the normalized record and callback contracts. No auto-install. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MaterialResourceBrowser = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const instances = new WeakMap();
  const kinds = {text:'Text',transcript:'Transcript',note:'Note',document:'Document',image:'Image',audio:'Audio',video:'Video',link:'Link'};
  const marks = {text:'≡',transcript:'≡',note:'✎',document:'▤',image:'▧',audio:'♪',video:'▶',link:'↗'};
  const string = value => typeof value === 'string' ? value : '';
  function safeURL(value, document) {
    if (!string(value).trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      // Never interpret paths as original files or allow executable/data content.
      return ['https:', 'http:', 'blob:'].includes(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  }
  function mount(host, initialModel, callbacks = {}) {
    if (!host || !host.ownerDocument) throw new TypeError('A DOM host is required');
    instances.get(host)?.destroy();
    const d = host.ownerDocument;
    const root = d.createElement('section'); root.className = 'mrb-browser'; root.setAttribute('aria-label','Project material');
    host.append(root);
    let model, records = [], selected = null, view = 'list', batch = new Set(), destroyed = false, generation = 0, actionSequence = 0;
    let message = '', busy = false;
    const node = (tag, className, text) => { const n = d.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
    const button = (label, action) => {const b=node('button','',label);b.type='button';if(action)b.dataset.mrbAction=action;return b;};
    function scope(r) {
      // Pass only explicit identity/version fields, never guessed paths or ordinals.
      return Object.freeze({projectId:model.projectId,id:r.id,sourceId:r.sourceId,revision:r.revision,versionId:r.versionId});
    }
    function enabled() { return !['loading','error','stale'].includes(model.state); }
    function current() {return records.find(r=>r.id===selected)||null;}
    function stopMedia() {
      root.querySelectorAll('audio,video').forEach(el=>{try { if(!el.paused) el.pause(); } catch (_) {} el.removeAttribute('src');el.querySelectorAll('source').forEach(n=>n.remove());});
    }
    function typeIcon(r) {const icon=node('span','mrb-icon',marks[r.kind]||'▤');icon.setAttribute('aria-hidden','true');return icon;}
    function availability(r) {
      return ({missing:'Original unavailable',offline:'Original offline',loading:'Preview loading',error:'Preview failed',stale:'Preview changed · refresh required'})[r.availability] || (r.kind==='text'||r.kind==='note'||r.kind==='transcript' ? 'Text-only source' : r.availability==='available'?'Available':'Availability not connected');
    }
    function preview(r) {
      const panel=node('article','mrb-preview');panel.setAttribute('aria-label','Selected material preview');
      if(!r){panel.append(node('p','mrb-muted',records.length?'Choose a resource to preview.':'Add files, notes or links with the existing Material tools.'));return panel;}
      const head=node('header','mrb-preview-head');head.append(typeIcon(r),node('h3','',r.name));panel.append(head);
      panel.append(node('p','mrb-meta',(kinds[r.kind]||'File')+' · '+availability(r)+' · Read-only preview'));
      const allowed=enabled()&&!['loading','error','stale'].includes(r.availability);
      const mediaURL=allowed?safeURL(r.previewUrl,d):null;
      let content=false;
      if(mediaURL&&['image','audio','video'].includes(r.kind)) {
        const media=node(r.kind==='image'?'img':r.kind,'mrb-media');media.src=mediaURL;
        if(r.kind==='image')media.alt=r.alt||r.name;else {media.controls=true;media.preload='metadata';}
        media.addEventListener('error',()=>{if(!destroyed&&panel.isConnected){let error=panel.querySelector('.mrb-media-error');if(!error){error=node('p','mrb-media-error','Preview could not load. The original has not been changed.');error.setAttribute('role','status');media.after(error);}}},{once:true});
        panel.append(media);content=true;
      }
      if(allowed&&typeof r.text==='string') {panel.append(node('div','mrb-reading',r.text));content=true;}
      if(!content||(['image','audio','video'].includes(r.kind)&&!mediaURL))panel.append(node('p','mrb-muted',mediaURL&&r.kind==='link'?'Open the connected source to read this link.':'Preview not connected. Choose a connected source or use the existing source tools to inspect this resource.'));
      const actions=node('div','mrb-actions');
      if(allowed&&typeof callbacks.onOpenSource==='function'&&r.sourceId)actions.append(button('Read source','source'));
      if(allowed&&typeof callbacks.onOpenOriginal==='function'&&r.canOpenOriginal===true)actions.append(button('Open original','original'));
      if(actions.children.length)panel.append(actions);
      else panel.append(node('p','mrb-muted','Source and original actions appear when their connections are supplied. Browsing does not approve or edit a source.'));
      if(r.details){const details=node('details','mrb-details');details.append(node('summary','','Resource details'),node('p','',string(r.details)));panel.append(details);}
      return panel;
    }
    function render(focusId) {
      if(destroyed)return;
      stopMedia();root.replaceChildren();
      const toolbar=node('header','mrb-toolbar');toolbar.append(node('strong','','Resources'),node('span','mrb-count',records.length+' resources'));
      const views=node('div','mrb-view-controls');views.setAttribute('role','group');views.setAttribute('aria-label','Resource view');
      for(const value of ['list','grid']){const b=button(value==='list'?'List':'Grid');b.dataset.mrbView=value;b.setAttribute('aria-pressed',String(view===value));views.append(b);}toolbar.append(views);root.append(toolbar);
      if(!enabled())root.append(node('p','mrb-state',model.message||({loading:'Loading connected material…',error:'Material could not load. Retry with the existing connection.',stale:'Material changed. Refresh this project before taking action.'})[model.state]));
      const layout=node('div','mrb-layout'),collection=node('div','mrb-collection');collection.dataset.view=view;collection.setAttribute('role','group');collection.setAttribute('aria-label','Choose material');
      if(!records.length)collection.append(node('p','mrb-muted','No material connected to this project.'));
      records.forEach(r=>{
        const row=node('div','mrb-item');if(r.id===selected)row.classList.add('is-selected');
        if(typeof callbacks.onBatch==='function') {const label=node('label','mrb-batch-check');const check=node('input');check.type='checkbox';check.dataset.mrbCheck=r.id;check.checked=batch.has(r.id);check.disabled=!enabled()||busy;check.setAttribute('aria-label','Include '+r.name+' in selection');label.append(check);row.append(label);}
        const choose=button('');choose.dataset.mrbResource=r.id;choose.className='mrb-resource';choose.setAttribute('aria-pressed',String(r.id===selected));choose.tabIndex=r.id===selected?0:-1;
        const thumb=safeURL(r.thumbnailUrl,d);if(thumb&&!['loading','error','stale'].includes(r.availability)){const image=node('img','mrb-thumb');image.src=thumb;image.alt='';image.loading='lazy';image.addEventListener('error',()=>{if(!destroyed&&image.isConnected)image.replaceWith(typeIcon(r));},{once:true});choose.append(image);}else choose.append(typeIcon(r));
        const info=node('span','mrb-item-info');info.append(node('strong','',r.name),node('span','mrb-meta',(kinds[r.kind]||'File')+' · '+availability(r)));choose.append(info);row.append(choose);collection.append(row);
      });
      const left=node('div','mrb-list-side');left.append(collection);
      if(typeof callbacks.onBatch==='function'){const bar=node('div','mrb-batch-bar');const b=button('Use selected ('+batch.size+')','batch');b.disabled=!batch.size||!enabled()||busy;bar.append(b,node('span','mrb-muted','Selection prepares a request; it does not move or approve files.'));left.append(bar);}
      layout.append(left,preview(current()));root.append(layout);
      const status=node('p','mrb-status',message);status.setAttribute('role','status');root.append(status);
      if(focusId)Array.from(root.querySelectorAll('[data-mrb-resource]')).find(n=>n.dataset.mrbResource===focusId)?.focus();
    }
    async function choose(id,focus=false) {
      if(!records.some(r=>r.id===id))return;
      selected=id;generation++;busy=false;message='';render(focus?id:null);
      if(typeof callbacks.onSelect!=='function')return;
      const epoch=generation,token=++actionSequence;
      try {await callbacks.onSelect(scope(current()));}
      catch(_) {if(!destroyed&&epoch===generation&&token===actionSequence){message='Selection kept. The connected tool could not open; no resource changed in this browser.';render(focus?id:null);}}
    }
    async function request(action) {
      if(busy||!enabled())return;
      const r=current(),fn=action==='source'?callbacks.onOpenSource:action==='original'?callbacks.onOpenOriginal:callbacks.onBatch;
      if(typeof fn!=='function'||(action!=='batch'&&!r))return;
      if(action==='source'&&!r.sourceId||action==='original'&&r.canOpenOriginal!==true)return;
      const chosen=records.filter(r=>batch.has(r.id));if(action==='batch'&&!chosen.length)return;
      const payload=action==='batch'?Object.freeze({projectId:model.projectId,resources:Object.freeze(chosen.map(scope))}):scope(r);
      const token=++actionSequence,epoch=generation;busy=true;message='Opening connected tool…';render();
      try {await fn(payload);if(!destroyed&&epoch===generation&&token===actionSequence){message='Request handed to connected tool. No resource changed in this browser.';busy=false;render();}}
      catch(_){if(!destroyed&&epoch===generation&&token===actionSequence){message='The connected tool could not open. Retry there; no resource changed in this browser.';busy=false;render();}}
    }
    function onClick(event){const item=event.target.closest?.('[data-mrb-resource]');if(item&&root.contains(item)){choose(item.dataset.mrbResource,true);return;}const toggle=event.target.closest?.('[data-mrb-view]');if(toggle&&root.contains(toggle)){view=toggle.dataset.mrbView;render();root.querySelector('[data-mrb-view="'+view+'"]').focus();return;}const action=event.target.closest?.('[data-mrb-action]');if(action&&root.contains(action))request(action.dataset.mrbAction);}
    function onChange(event){const id=event.target.dataset?.mrbCheck;if(!id||!enabled())return;event.target.checked?batch.add(id):batch.delete(id);render();Array.from(root.querySelectorAll('[data-mrb-check]')).find(n=>n.dataset.mrbCheck===id)?.focus();}
    function onKey(event){const item=event.target.closest?.('[data-mrb-resource]');if(!item)return;const index=records.findIndex(r=>r.id===item.dataset.mrbResource);let next=index;switch(event.key){case 'ArrowDown':case 'ArrowRight':next=Math.min(records.length-1,index+1);break;case 'ArrowUp':case 'ArrowLeft':next=Math.max(0,index-1);break;case 'Home':next=0;break;case 'End':next=records.length-1;break;default:return;}event.preventDefault();choose(records[next].id,true);}
    root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('keydown',onKey);
    const api={
      update(next) {
        if(destroyed)return;
        if(!next||!string(next.projectId))throw new TypeError('An explicit projectId is required');
        const switched=model?.projectId!==next.projectId;model={projectId:next.projectId,state:string(next.state),message:string(next.message)};
        const seen=new Set();records=(Array.isArray(next.resources)?next.resources:[]).filter(r=>r&&r.projectId===model.projectId&&string(r.id)&&!seen.has(r.id)&&(seen.add(r.id),true)).map(r=>Object.freeze({...r,name:string(r.name)||'Untitled resource',kind:Object.hasOwn(kinds,r.kind)?r.kind:'document'}));
        if(switched){batch.clear();selected=null;view='list';}
        if(!records.some(r=>r.id===selected))selected=records[0]?.id||null;
        batch=new Set([...batch].filter(id=>records.some(r=>r.id===id)));generation++;busy=false;message='';render();
      },
      getSelection(){return current()?scope(current()):null;},
      destroy(){if(destroyed)return;destroyed=true;generation++;stopMedia();root.removeEventListener('click',onClick);root.removeEventListener('change',onChange);root.removeEventListener('keydown',onKey);root.remove();if(instances.get(host)===api)instances.delete(host);records=[];batch.clear();selected=null;}
    };
    instances.set(host,api);try{api.update(initialModel);}catch(error){api.destroy();throw error;}return api;
  }
  return Object.freeze({mount,create:mount});
});
