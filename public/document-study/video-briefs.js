(() => {
  const endpoint = '/api/study/video-briefs';
  const pendingKey = 'ar-create.video-brief.pending';
  const projectKeys = {hk:'hk','ref-an-cha':'ancha','ref-collector':'collector'};
  const scopeFor = parentStudyId => Object.hasOwn(projectKeys,parentStudyId)
    ? {projectKey:projectKeys[parentStudyId],parentStudyId} : null;
  const node = (tag,text) => {
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    return element;
  };
  const link = (label,href) => {
    const anchor=node('a',label);
    anchor.href=href;
    return anchor;
  };
  const collectionAddress=(parentStudyId,collectionId)=>'/document-study/index.html?'+new URLSearchParams({subject:parentStudyId,collection:collectionId,...window.arCreateUiActor?.explicit?{reviewActor:window.arCreateUiActor.actor}:{}});
  async function inquiryConnection(section,scope,brief) {
    const host=node('section'),status=node('p','Reading working inquiries…');
    host.setAttribute('aria-label','Working inquiry');host.append(node('h3','Working inquiry'),status);section.append(host);
    try {
      const catalog=await request('/api/inquiries/catalog?input='+encodeURIComponent('{}'));
      if(!Array.isArray(catalog.collections))throw Error('The inquiry catalog is unavailable.');
      const current=catalog.collections.find(row=>row.id===brief.collectionId);
      if(brief.collectionId&&!current)throw Error('The linked inquiry is unavailable. Its saved connection has been retained.');
      const actions=node('div');actions.className='video-brief-actions';
      const render=()=>{
        host.replaceChildren(node('h3','Working inquiry'));
        const selected=catalog.collections.find(row=>row.id===brief.collectionId);
        if(selected)host.append(node('p',selected.name),link('Resume inquiry',collectionAddress(scope.parentStudyId,selected.id)));
        const label=node('label','Working inquiry '),select=node('select');select.setAttribute('aria-label','Working inquiry');
        select.append(Object.assign(node('option','Choose a saved inquiry'),{value:''}));
        for(const row of catalog.collections)select.append(Object.assign(node('option',row.name),{value:row.id}));
        select.value=brief.collectionId||'';label.append(select);
        const save=node('button',brief.collectionId?'Change inquiry':'Link inquiry');save.type='button';save.className='btn quiet';
        const message=node('p');message.setAttribute('role','status');
        save.onclick=async()=>{
          if(!select.value){message.textContent='Choose an existing inquiry first.';return;}
          const exact={...scope,id:brief.id,expectedCollectionId:brief.collectionId??null,collectionId:select.value};save.disabled=true;
          try{const pending=await operationFor(exact),result=await request(endpoint+'/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...exact,operationId:pending.operationId})});Object.assign(brief,result.brief);clearOperation(pending.operationId);render();}
          catch(error){message.textContent=error.message;}finally{save.disabled=false;}
        };
        actions.replaceChildren(label,save);host.append(actions,message);
      };
      render();
    }catch(error){status.textContent=error.message;}
  }
  const address = (parentStudyId,id,source=false) => {
    const query=new URLSearchParams({subject:parentStudyId});
    if(id)query.set('brief',id);
    if(source)query.set('source','1');
    if(window.arCreateUiActor?.explicit)query.set('reviewActor',window.arCreateUiActor.actor);
    return '/document-study/video-editing.html?'+query;
  };
  async function request(url,options={}) {
    const response=await fetch(url,{cache:'no-store',...options});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Video Editing could not open this record.');
    return result;
  }
  function rawOffset(raw,normalizedOffset) {
    let offset=0;
    for(let index=0;index<normalizedOffset;index++,offset++) {
      if(raw[offset]==='\r'&&raw[offset+1]==='\n')offset++;
    }
    return offset;
  }
  async function operationFor(exact) {
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(exact)));
    const signature=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
    const pending={signature,operationId:crypto.randomUUID()};
    try {
      const earlier=JSON.parse(sessionStorage.getItem(pendingKey));
      if(earlier?.signature===signature)return earlier;
      sessionStorage.setItem(pendingKey,JSON.stringify(pending));
    } catch {}
    return pending;
  }
  function clearOperation(operationId) {
    try {
      if(JSON.parse(sessionStorage.getItem(pendingKey))?.operationId===operationId)sessionStorage.removeItem(pendingKey);
    } catch {}
  }
  async function choosePassage(point) {
    const scope=scopeFor(point.projectId);
    if(!scope)return;
    const prior=document.activeElement;
    const dialog=node('dialog'),heading=node('h2','Choose a source passage');
    dialog.className='video-brief-picker';
    dialog.setAttribute('aria-labelledby','video-brief-picker-title');
    heading.id='video-brief-picker-title';
    const close=node('button','Back to finding'),status=node('p','Reading original sources…');
    close.type='button';
    close.onclick=()=>dialog.close();
    status.setAttribute('role','status');
    dialog.append(heading,close,status);
    dialog.addEventListener('close',()=>{
      dialog.remove();
      if(prior?.isConnected)prior.focus();
    },{once:true});
    document.body.append(dialog);
    dialog.showModal();
    try {
      const result=await request('/api/study-originals?'+new URLSearchParams({projectKey:scope.projectKey}));
      if(!dialog.open)return;
      if(result.projectKey!==scope.projectKey)throw Error('The source catalog belongs to another subject.');
      const records=result.records.filter(record=>record.role==='source'&&!record.missing&&typeof record.raw==='string'&&record.hash);
      if(!records.length)throw Error('This subject has no readable original transcript.');
      status.textContent='';
      const form=node('form'),sourceLabel=node('label','Original source'),source=node('select');
      const textLabel=node('label','Select the exact words to carry into the brief'),text=node('textarea');
      const actions=node('div'),save=node('button','Save to Video Editing');
      actions.className='video-brief-actions';
      save.type='submit';
      text.readOnly=true;
      records.forEach((record,index)=>{
        const option=node('option',record.name);
        option.value=String(index);
        source.append(option);
      });
      const preview=()=>{
        text.value=records[Number(source.value)].raw;
        text.setSelectionRange(0,0);
        status.textContent='';
      };
      source.onchange=preview;
      preview();
      sourceLabel.append(source);
      textLabel.append(text);
      actions.append(save);
      form.append(sourceLabel,textLabel,actions);
      dialog.insertBefore(form,status);
      let pending;
      form.onsubmit=async event=>{
        event.preventDefault();
        const record=records[Number(source.value)];
        const from=rawOffset(record.raw,text.selectionStart),to=rawOffset(record.raw,text.selectionEnd);
        const quote=record.raw.slice(from,to);
        if(!quote.trim()){status.textContent='Select a passage in the original source first.';return;}
        const exact={...scope,findingId:point.id,title:point.title,sourcePath:record.path,sourceHash:record.hash,from,to,quote};
        save.disabled=true;
        status.textContent='Saving the brief…';
        try {
          const signature=JSON.stringify(exact);
          if(pending?.input!==signature)pending={...await operationFor(exact),input:signature};
          const {brief}=await request(endpoint,{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({...exact,operationId:pending.operationId}),
          });
          if(!dialog.open)return;
          clearOperation(pending.operationId);
          const open=link('Open saved video brief',address(scope.parentStudyId,brief.id));
          open.target='_blank';open.rel='noopener';
          form.replaceWith(node('p','Brief saved as a proposal.'),open);
          status.textContent='';
          open.focus();
        } catch(error) {
          if(dialog.open)status.textContent=error.message;
        } finally { save.disabled=false; }
      };
    } catch(error) {
      if(dialog.open)status.textContent=error.message;
    }
  }
  async function openPage(main) {
    const query=new URLSearchParams(location.search),parentStudyId=query.get('subject'),id=query.get('brief');
    const scope=scopeFor(parentStudyId);
    const heading=node('h1','Video Editing'),nav=node('nav');
    nav.className='video-brief-actions';
    const researchAddress=findingId=>'/document-study/index.html?'+new URLSearchParams({
      subject:parentStudyId,section:'research',...(findingId?{finding:findingId}:{}),
      ...(window.arCreateUiActor?.explicit?{reviewActor:window.arCreateUiActor.actor}:{}),
    });
    const research=scope?link('Back to Research',researchAddress()):link('AR Create','/');
    nav.append(research);
    main.replaceChildren(nav,heading);
    if(!scope){main.append(node('p','Choose a subject with original research sources.'));return;}
    const section=node('section'),status=node('p','Reading briefs…');
    status.setAttribute('role','status');
    section.append(status);
    main.append(section);
    try {
      const {briefs}=await request(endpoint+'?'+new URLSearchParams(scope));
      if(!id){
        section.replaceChildren();
        if(!briefs.length)section.append(node('p','No saved video briefs for this subject.'));
        else{
          const list=node('ul');
          for(const brief of briefs){
            const item=node('li');
            item.append(link(brief.title,address(parentStudyId,brief.id)));
            list.append(item);
          }
          section.append(list);
        }
        return;
      }
      nav.append(link('All briefs',address(parentStudyId)));
      const brief=briefs.find(item=>item.id===id);
      if(!brief)throw Error('This brief is unavailable in the selected subject.');
      research.href=researchAddress(brief.findingId);
      section.replaceChildren(node('h2',brief.title));
      if(query.get('source')!=='1'){
        const actions=node('div');
        actions.className='video-brief-actions';
        actions.append(link('Open exact source passage',address(parentStudyId,id,true)));
        section.append(node('p','Proposed passage'),node('blockquote',brief.quote),actions);
        void inquiryConnection(section,scope,brief);
        return;
      }
      nav.replaceChildren(link('Back to brief',address(parentStudyId,id)),link('All briefs',address(parentStudyId)));
      section.append(status);
      status.textContent='Checking the saved source revision…';
      const {source}=await request(endpoint+'/source?'+new URLSearchParams({...scope,id}));
      if(source.quote!==brief.quote)throw Error('The source passage differs from the brief.');
      const excerpt=node('pre');
      excerpt.append(source.before,node('mark',source.quote),source.after);
      status.replaceWith(node('h3',source.title+' · line '+source.line),excerpt);
      document.querySelector('mark')?.scrollIntoView({block:'nearest'});
    }catch(error){status.textContent=error.message;if(!status.isConnected)section.append(status);}
  }
  window.studyVideoBriefs={choosePassage,address,scopeFor};
  const page=document.querySelector('[data-video-brief-page]');
  if(page)void openPage(page);
})();
