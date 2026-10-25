/* Direct C-workbench Gather projection. Move maintained owners; never copy their
   editable HTML or replace source/session identities, handlers or revision state. */
(()=>{
 if(window.workbenchGatherMatch)return;
 const D=document,make=(tag,cls,text)=>{const n=D.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 function more(parent,node,label,cls){if(!node||node.closest('.'+cls))return;const detail=make('details',cls),summary=make('summary','',label);node.before(detail);detail.append(summary,node);return detail;}
 function inbox(root){
  root.classList.add('wbg-inbox','wrap');
  const drop=root.querySelector('.material-intake');
  if(drop&&!drop.querySelector(':scope>.wbg-intake-copy')){
   const text=make('div','t wbg-intake-copy'),title=drop.querySelector(':scope>span:first-child');
   if(title){const b=make('b','',title.textContent);title.replaceWith(text);text.append(b);}
   else drop.prepend(text);
   text.append(make('span','dim','Drop recordings, photos, PDFs or notes here — or paste a link.'));
   const button=drop.querySelector('[data-flow-action="files"]');if(button)button.textContent='Choose files';
   
   const folder=drop.querySelector('[data-flow-action="open-material-folder"]');if(folder){let extra=root.querySelector(':scope>.wbg-intake-extra');if(!extra){extra=make('details','wbg-intake-extra');extra.append(make('summary','','More intake options'));root.append(extra);}extra.append(folder);for(const n of [...drop.querySelectorAll(':scope>.small')])extra.append(n);}
  }
  // The browser owns source identity and selection. Its original buttons become
  // the approved mrow list; preview is the same reader inside a disclosure.
  
  const browser=root.querySelector('.mrb-browser');
  if(browser){browser.classList.add('wbg-material-list');const preview=browser.querySelector('.mrb-preview');if(preview)more(browser,preview,'Selected material preview','wbg-preview');for(const row of browser.querySelectorAll('.mrb-item'))row.classList.add('mrow');}
  for(const n of [...root.querySelectorAll(':scope>details.sws-secondary')])if(!n.closest('.wbg-inbox-more')){let tools=root.querySelector(':scope>.wbg-inbox-more');if(!tools){tools=make('details','wbg-inbox-more');tools.append(make('summary','','Context & preparation'));root.append(tools);}tools.append(n);}
  const secondary=[...root.querySelectorAll(':scope>.wb-intake-status,:scope>.wb-intake-more,:scope>.wbg-intake-extra')];if(secondary.length){let tools=root.querySelector(':scope>.wbg-inbox-more');if(!tools){tools=make('details','wbg-inbox-more');tools.append(make('summary','','More'));root.append(tools);}tools.querySelector(':scope>summary').textContent='More';for(const node of secondary)tools.append(node);}
 }
 function source(root){
  root.classList.add('wbg-source','wrap');
  const reader=root.querySelector('[data-source-reader]');
  if(!reader)return;
  const article=reader.querySelector(':scope>article'),notes=reader.querySelector('[data-source-reader-notes]');
  if(notes&&!notes.closest('.wbg-source-notes'))more(reader,notes,'Conversation notes','wbg-source-notes');
  const toolbar=reader.querySelector('.source-reader-toolbar');if(toolbar){
   toolbar.classList.add('tbar');
   const selector=toolbar.querySelector('.source-reader-selector'),select=toolbar.querySelector('[data-source-reader-select]');
   if(selector)for(const text of [...selector.childNodes])if(text.nodeType===3&&text.textContent.trim()){const label=make('span','wbg-session-label');text.before(label);label.append(text);}
   const refresh=toolbar.querySelector('[data-source-reader-action="refresh"]'),bilingual=toolbar.querySelector('.wb-bilingual');
   if(refresh&&!refresh.closest('.wbg-reader-more'))more(toolbar,refresh,'Source tools','wbg-reader-more');
   let tools=toolbar.querySelector('.wbg-reader-more');
   if(!tools&&bilingual)tools=more(toolbar,bilingual,'Source tools','wbg-reader-more');
   if(tools&&bilingual&&!tools.contains(bilingual))tools.append(bilingual);
   const title=article?.querySelector(':scope>.source-reader-title'),heading=title?.querySelector('h3'),chosen=select?.selectedOptions?.[0]?.textContent.trim(),name=heading?.textContent.trim();
   const duplicate=!!name&&!!chosen&&(chosen===name||chosen.startsWith(name+' · '));
   if(heading&&heading.hidden!==duplicate)heading.hidden=duplicate;
   if(title){const hide=duplicate&&![...title.children].some(node=>node!==heading&&node.textContent.trim());if(title.hidden!==hide)title.hidden=hide;}
  }
  // The original player remains playable and visible beside the session tools.
  for(const media of root.querySelectorAll('audio,video'))if(toolbar&&!media.closest('.source-reader-toolbar')&&!media.closest('details'))toolbar.prepend(media);
  const dialogue=reader.querySelector('[data-source-reader-dialogue]');if(dialogue&&article){const title=article.querySelector(':scope>.source-reader-title');if(title&&title.nextElementSibling!==dialogue)title.after(dialogue);const notesMore=article.querySelector(':scope>.wbg-source-notes');if(notesMore&&article.lastElementChild!==notesMore)article.append(notesMore);}
  // Keep retained files available, but avoid a second inventory over a connected
  // conversation. The reader and all correction forms remain in their owner.
  if(dialogue?.querySelector('.source-remark')){const layout=root.querySelector(':scope>.material-layout');if(layout&&!layout.closest('.wbg-retained'))more(root,layout,'Retained source files','wbg-retained');}
 }
 function decorate(){const ws=D.querySelector('#app #workspace');if(!ws)return;const root=ws.querySelector('.material-surface');const heading=ws.querySelector('#c3-surface-bar .sb-cp-name');if(heading&&ws.classList.contains('wb-inbox')){const label=root&&!ws.classList.contains('wfb-showing')?'Library › Inbox':'Library';if(heading.textContent!==label)heading.textContent=label;}if(ws.classList.contains('wb-inbox')&&root)inbox(root);if(ws.classList.contains('wb-source')&&root)source(root);const library=ws.querySelector('.wfb-browser.k-library');if(library)library.classList.add('lb','compact','k-lib');}
 window.workbenchGatherMatch={decorate};window.c3Shell?.register('approved Gather template',decorate,{order:110,ignore:'#c3-surface-bar .sb-cp-name'});decorate();
})();
