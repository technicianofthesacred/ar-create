/* Adopt the approved Export cards using only the maintained current-edition
   controls. No export generator, publication action or approval authority here. */
(()=>{
 if(window.workbenchExportsMatch)return;
 let panel=null,section=null,entries=[];
 function clear(){for(const e of entries){if(e.marker.isConnected)e.marker.replaceWith(e.button);else e.button.remove();}entries=[];section?.remove();section=null;panel=null;}
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 function decorate(){
  const workspace=document.getElementById('workspace'),next=workspace?.classList.contains('wb-outputs')?workspace.querySelector('#output-overview .oo-panel'):null;
  if(next!==panel){clear();panel=next;}if(!panel)return;
  const rows=[...panel.querySelectorAll('.oo-row[data-overview-output]')];
  if(entries.some(e=>!e.row.isConnected)){clear();panel=next;}
  const available=rows.map(row=>({row,button:row.querySelector('[data-output-action="export"]')})).filter(e=>e.button&&!entries.some(old=>old.row===e.row));
  if(!section&&!available.length)return;
  if(!section){section=node('section','wb-export-section');section.setAttribute('aria-label','Export saved outputs');section.append(node('h2','sec block','Export'),node('div','exp'));panel.append(section);}
  const grid=section.querySelector('.exp');
  for(const {row,button} of available){const format=(row.querySelector('.oo-meta')?.textContent||'Output').split(' · ')[0],title=row.querySelector('.oo-title')?.textContent||format,card=node('div','x');card.append(node('b','',format),node('span','',title));const marker=document.createComment('Native export return');button.before(marker);button.classList.add('btn');card.append(button);grid.append(card);entries.push({row,button,marker,format});}
  const carousel=entries.find(e=>/carousel/i.test(e.format));let caption=grid.querySelector('[data-wb-caption-card]');
  if(carousel&&!caption){caption=node('div','x');caption.dataset.wbCaptionCard='';caption.append(node('b','','Caption'),node('span','','Plain text, with carousel files'));const button=node('button','btn','Open files');button.type='button';button.onclick=()=>{const e=entries.find(e=>/carousel/i.test(e.format));if(e?.button.isConnected&&!e.button.disabled)e.button.click();};caption.append(button);grid.append(caption);}
  if(caption)caption.querySelector('button').disabled=!carousel||carousel.button.disabled;
  if(!grid.querySelector('[data-wb-bundle-card]')){const card=node('div','x');card.dataset.wbBundleCard='';card.append(node('b','','Everything'),node('span','','A folder with all outputs'));const button=node('button','btn','Not connected');button.type='button';button.disabled=true;button.title='Combined bundle export is not connected. Each saved output above keeps its own export and review checks.';card.append(button);grid.append(card);}
 }
 window.workbenchExportsMatch={decorate};window.c3Shell?.register('approved Export cards',decorate,{order:113});decorate();
})();
