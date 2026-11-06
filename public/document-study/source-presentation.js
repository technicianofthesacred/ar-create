/* Approved Source navigation. Move maintained nodes; never clone words or correction controls. */
(()=>{
 if(window.studySourcePresentation)return;
 const doc=document,rooms=new WeakMap();let queued=false;
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const button=(text,fn)=>{const n=make('button','ar-destination',text);n.type='button';n.onclick=fn;return n;};
 function decorate(){
  const p=typeof current==='function'?current():null;if(p?.view!=='record'||Number(p.viewedStage)!==2)return;
  const lane=doc.getElementById('stage-working-lane');if(!lane)return;
  const root=lane.querySelector('.material-surface')||(lane.querySelector('.flow-existing')?lane:null);if(!root)return;
  let view=rooms.get(root);if(view&&!root.querySelector('.sp-heading')){rooms.delete(root);view=null;}if(!view){
   view={page:'reader',opener:null};rooms.set(root,view);root.classList.add('source-presentation');
   const heading=make('header','sp-heading'),title=make('div');title.append(make('h1','','Source'),make('p','',p.name||'Current project'));
   heading.append(title,button('Back to Write',()=>{if(window.studyDraft?.edit)window.studyDraft.edit();else setView('article');}));
   const toolbar=make('nav','sp-toolbar');toolbar.setAttribute('aria-label','Source selection and tools');
   const select=make('select');select.setAttribute('aria-label','Selected source');const rows=[...root.querySelectorAll('.material-record,.flow-source-tab')];
   rows.forEach((row,i)=>{const label=row.querySelector('.small')?.textContent||row.querySelector('span')?.textContent||row.textContent;const option=make('option','',label.trim());option.value=String(i);option.selected=row.classList.contains('is-current')||row.getAttribute('aria-pressed')==='true';select.append(option);});
   select.onchange=()=>{const row=rows[Number(select.value)];(row?.matches('button')?row:row?.querySelector('[data-flow-action]'))?.click();};
   if(rows.length)toolbar.append(select);else toolbar.append(make('span','sp-empty','Choose a kept conversation below'));
   const actions=make('div');actions.append(button('Details',e=>go('details',e.currentTarget)),button('Tools',e=>go('tools',e.currentTarget)));toolbar.append(actions);
   const details=make('section','sp-task sp-details'),tools=make('section','sp-task sp-tools');details.dataset.spPage='details';tools.dataset.spPage='tools';
   for(const [node,name]of [[details,'Source details'],[tools,'Tools & context']]){node.append(button('Back to Source',()=>go('reader')),make('h2','',name));}
   // Provenance and operational tools leave the reading column, keeping their exact nodes/handlers.
   for(const n of [...root.querySelectorAll('.material-document>header,.material-document>.flow-details,.material-choice-details,.flow-history-words>.flow-details,.flow-source-meta')])details.append(n);
   if(!details.querySelector('.flow-details'))details.append(make('p','','Source identities and revisions remain with the connected source reader.'));
   const taskPages=[];
   const addTask=(node,label,key)=>{if(!node)return;const page=make('section','sp-task');page.dataset.spPage=key;page.hidden=true;page.append(button('Back to Tools',()=>go('tools')),make('h2','',label),node);root.append(page);taskPages.push(page);tools.append(button(label,e=>go(key,e.currentTarget)));};
   const index=root.querySelector('.material-index');if(index){index.classList.add('sp-source-index');addTask(index,'Connected sources','sources');}
   for(const [selector,label,key]of [['[data-sws-tool="versions"]','Compare source records','compare'],['[data-sws-tool="correction"]','Prepare a correction','correction'],['[data-sws-tool="audio"]','Recording & playback','recording'],['[data-disclosure="sws-source-context"],#material-human-direction','Your context & direction','context']])addTask(root.querySelector(selector),label,key);
   tools.querySelector('h2').after(make('p','','Retained source words stay unchanged. Choose a tool to inspect context or work on a connected transcript.'));
   addTask(make('p','','Find exact words in connected kept conversations. This is source recall, not factual verification.'),'Find a passage','find');tools.append(button('Add material',()=>viewPhase(1)));
   const noticeNode=make('p','sp-notice');noticeNode.setAttribute('role','status');tools.append(noticeNode);function notice(value){noticeNode.textContent=value;}

   const status=make('p','sp-source-status','Retained source · read-only');root.prepend(heading,toolbar);if(status.parentElement!==root&&!root.querySelector('.flow-transcript,.source-reader [data-source-reader-dialogue],.src-timed'))toolbar.after(status);root.append(details,tools);view.nodes={heading,toolbar,details,tools};
   for(const old of [...root.querySelectorAll('details')]){if(old.closest('.source-reader'))continue;const section=make('section',old.className);for(const attr of [...old.attributes])if(attr.name!=='open')section.setAttribute(attr.name,attr.value);for(const child of [...old.childNodes]){if(child.nodeType===1&&child.tagName==='SUMMARY'){const h=make('h3','',child.textContent);section.append(h);}else section.append(child);}old.replaceWith(section);}
   function go(page,opener){view.page=page;view.opener=opener||view.opener;apply();const target=page==='reader'?view.opener:root.querySelector(`[data-sp-page="${page}"] h2`);if(target){target.tabIndex=target.matches('button')?0:-1;target.focus({preventScroll:true});}doc.getElementById('workspace')?.scrollTo?.({top:0});}
   view.go=go;view.apply=apply;
   function apply(){root.dataset.sourcePage=view.page;details.hidden=view.page!=='details';tools.hidden=view.page!=='tools';for(const task of taskPages)task.hidden=task.dataset.spPage!==view.page;toolbar.hidden=view.page!=='reader';for(const n of [...root.children])if(![heading,toolbar,details,tools,...taskPages].includes(n)){n.classList.add('sp-reader-node');n.hidden=view.page!=='reader'&&!(n.matches('.source-reader')&&view.page==='find');}}
   apply();
  }
  // Empty kept-reader notices belong with Tools; the retained document remains the entrance.
  const imported=root.querySelector('.source-reader');if(imported&&!imported.querySelector('[data-source-reader-dialogue]'))imported.classList.add('sp-unconnected-reader');else imported?.classList.remove('sp-unconnected-reader');
 }
 doc.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const root=doc.querySelector('.source-presentation[data-source-page]:not([data-source-page="reader"])');if(root){e.preventDefault();rooms.get(root)?.go('reader');}});
 const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});});observer.observe(doc.getElementById('app'),{childList:true,subtree:true});
 window.studySourcePresentation={decorate};decorate();window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
