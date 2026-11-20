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
  const carry=(href,fallback)=>{if(!window.ArI64Return?.carryReturnTarget)return href;const value=window.ArI64Return.carryReturnTarget(href,fallback);if(!value)throw Error('The workspace return address is unavailable.');return value;};
  const collectionAddress=(parentStudyId,collectionId,fallback)=>carry('/document-study/index.html?'+new URLSearchParams({subject:parentStudyId,collection:collectionId,...window.arCreateUiActor?.explicit?{reviewActor:window.arCreateUiActor.actor}:{}}),fallback);
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
        if(selected){const resume=node('div');resume.className='video-brief-actions';resume.append(link('Resume inquiry',collectionAddress(scope.parentStudyId,selected.id)));host.append(node('p',selected.name),resume);}
        const label=node('label','Choose inquiry '),select=node('select');select.setAttribute('aria-label','Working inquiry');
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
  const address = (parentStudyId,id,source=false,fallback) => {
    const query=new URLSearchParams({subject:parentStudyId});
    if(id)query.set('brief',id);
    if(source)query.set('source','1');
    if(window.arCreateUiActor?.explicit)query.set('reviewActor',window.arCreateUiActor.actor);
    return carry('/document-study/video-editing.html?'+query,fallback);
  };
  const researchAddress=(parentStudyId,findingId,fallback)=>carry('/document-study/index.html?'+new URLSearchParams({subject:parentStudyId,section:'research',...(findingId?{finding:findingId}:{}),...(window.arCreateUiActor?.explicit?{reviewActor:window.arCreateUiActor.actor}:{})}),fallback);
  const handoffAddress=pending=>{const value=new URL(address(pending.input.parentStudyId,null,false,pending.returnTarget),location.href);value.searchParams.set('handoff',pending.operationId);return value.href;};
  async function request(url,options={}) {
    const response=await fetch(url,{cache:'no-store',...options});
    const result=await response.json();
    if(!response.ok)throw Object.assign(Error(result.error||'Video Editing could not open this record.'),{status:response.status});
    return result;
  }
  let recovery;
  const outbox=()=>{if(!window.ArVideoHandoffRecovery)throw Error('Handoff recovery is unavailable. Keep this tab open.');return recovery||(recovery=window.ArVideoHandoffRecovery.createStore(()=>window.localStorage));};
  async function deliver(pending){
    const input=pending.input,scope=scopeFor(input.parentStudyId),saved=await request(endpoint+'?'+new URLSearchParams(scope)),existing=saved.briefs.find(b=>b.id===pending.operationId);
    let brief=existing;
    if(existing&&!window.ArVideoHandoffRecovery.matchesBrief(existing,pending))throw Error('The saved brief differs from this retained passage. Open Research to review it.');
    if(!brief){
      const retained=outbox().list(input.parentStudyId).find(row=>row.operationId===pending.operationId);
      if(!retained||JSON.stringify(retained.input)!==JSON.stringify(input))throw Error('This unfinished handoff changed in another tab. Open all briefs before continuing.');
      brief=(await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,operationId:pending.operationId})})).brief;
      if(!window.ArVideoHandoffRecovery.matchesBrief(brief,pending))throw Error('The saved brief did not match the retained passage. Keep this handoff for review.');
    }
    let warning='';try{outbox().remove(input.parentStudyId,pending.operationId,input);}catch{warning='Brief saved. Its device recovery marker could not be cleared; checking again will reopen this same brief.';}
    return {brief,warning};
  }
  function failedHandoff(pending,error){try{outbox().update(pending.input.parentStudyId,pending.operationId,error.status>=400&&error.status<500?'failed':'uncertain',error.message);}catch{/* The already retained exact request stays authoritative for retry. */}}
  function recoveryView(host,pending){
    const title=node('h2','Unfinished video handoff'),status=node('p');status.setAttribute('role','status');
    status.textContent=(pending.state==='failed'?'This brief could not be saved. ':'The save has not been confirmed. ')+(pending.message?pending.message+' ':'')+'The selected passage and inquiry are retained on this device.';
    const actions=node('div');actions.className='video-brief-actions';const retry=node('button','Check and retry save');retry.type='button';retry.className='ar-primary';
    retry.onclick=async()=>{retry.disabled=true;status.textContent='Checking for the saved brief…';try{const {brief,warning}=await deliver(pending);if(!host.isConnected)return;host.replaceChildren(node('h2','Brief saved'),link('Open saved video brief',address(pending.input.parentStudyId,brief.id,false,pending.returnTarget)));if(warning)host.append(node('p',warning));}catch(error){failedHandoff(pending,error);if(host.isConnected)status.textContent=error.message+' Your exact handoff remains retained.';}finally{retry.disabled=false;}};
    actions.append(retry,link('Open Research',researchAddress(pending.input.parentStudyId,pending.input.findingId,pending.returnTarget)));
    if(pending.input.collectionId)actions.append(link('Resume inquiry',collectionAddress(pending.input.parentStudyId,pending.input.collectionId,pending.returnTarget)));
    host.replaceChildren(title,node('h3',pending.input.title),status,...pending.inquiryName?[node('p',pending.inquiryName)]:[],node('blockquote',pending.input.quote),actions);
  }
  function pendingList(host,parentStudyId){
    try{const records=outbox().list(parentStudyId);host.replaceChildren();if(!records.length)return;host.append(node('h2','Unfinished handoffs'));for(const pending of records){const item=node('p');item.append(node('span',pending.input.title+' · '+(pending.state==='failed'?'Save failed':'Save not confirmed')+' '),link('Resume handoff',handoffAddress(pending)));host.append(item);}}
    catch(error){const status=node('p',error.message);status.setAttribute('role','alert');host.replaceChildren(status);}
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
      const [result,catalog]=await Promise.all([request('/api/study-originals?'+new URLSearchParams({projectKey:scope.projectKey})),request('/api/inquiries/catalog?input='+encodeURIComponent('{}'))]);
      if(!dialog.open)return;
      if(result.projectKey!==scope.projectKey)throw Error('The source catalog belongs to another subject.');
      const records=result.records.filter(record=>record.role==='source'&&!record.missing&&typeof record.raw==='string'&&record.hash);
      if(!records.length)throw Error('This subject has no readable original transcript.');
      status.textContent='';
      const form=node('form'),sourceLabel=node('label','Original source'),source=node('select');
      const textLabel=node('label','Select the exact words to carry into the brief'),text=node('textarea');
      const inquiryLabel=node('label','Working inquiry'),inquiry=node('select');inquiry.setAttribute('aria-label','Working inquiry');
      inquiry.append(Object.assign(node('option','No inquiry selected'),{value:''}));
      for(const row of catalog.collections||[])inquiry.append(Object.assign(node('option',row.name),{value:row.id}));
      const active=window.connectedWorkspace?.currentInquiry?.(point.projectId)||null;
      if(active&&!(catalog.collections||[]).some(row=>row.id===active))throw Error('Your active inquiry is unavailable. Return to it before saving the handoff.');
      inquiry.value=active||'';inquiryLabel.append(inquiry);
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
      form.append(sourceLabel,textLabel,inquiryLabel,actions);
      dialog.insertBefore(form,status);
      form.onsubmit=async event=>{
        event.preventDefault();
        const record=records[Number(source.value)];
        const from=rawOffset(record.raw,text.selectionStart),to=rawOffset(record.raw,text.selectionEnd);
        const quote=record.raw.slice(from,to);
        if(!quote.trim()){status.textContent='Select a passage in the original source first.';return;}
        const exact={...scope,findingId:point.id,title:point.title,sourcePath:record.path,sourceHash:record.hash,from,to,quote,...inquiry.value?{collectionId:inquiry.value}:{}};
        save.disabled=true;source.disabled=true;text.disabled=true;inquiry.disabled=true;
        status.textContent='Saving the brief…';
        let pending;
        try {
          const returnTarget=new URL(address(scope.parentStudyId,null),location.href).searchParams.get('i64osReturn');
          pending=outbox().prepare(exact,{operationId:crypto.randomUUID(),inquiryName:(catalog.collections||[]).find(row=>row.id===inquiry.value)?.name||'',returnTarget});
          const {brief,warning}=await deliver(pending);
          if(!dialog.open)return;
          const open=link('Open saved video brief',address(scope.parentStudyId,brief.id,false,pending.returnTarget));
          open.target='_blank';open.rel='noopener';
          form.replaceWith(node('p','Brief saved as a proposal.'),open);
          status.textContent=warning;
          open.focus();
        } catch(error) {
          if(pending)failedHandoff(pending,error);
          if(dialog.open){status.textContent=error.message+(pending?' Your exact handoff is retained.':'');if(pending){const resume=link('Resume unfinished handoff',handoffAddress(pending));resume.target='_blank';resume.rel='noopener';status.append(' ',resume);}}
        } finally { save.disabled=false;source.disabled=false;text.disabled=false;inquiry.disabled=false; }
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
    const research=scope?link('Back to Research',researchAddress(parentStudyId)):link('AR Create','/');
    nav.append(research);
    main.replaceChildren(nav,heading);
    if(!scope){main.append(node('p','Choose a subject with original research sources.'));return;}
    const section=node('section'),status=node('p','Reading briefs…');
    status.setAttribute('role','status');
    section.append(status);
    main.append(section);
    if(query.has('handoff')){
      nav.append(link('All briefs',address(parentStudyId)));
      try{const pending=outbox().list(parentStudyId).find(row=>row.operationId===query.get('handoff'));if(!pending)throw Error('This unfinished handoff is unavailable on this device. Open all briefs to continue.');recoveryView(section,pending);}catch(error){status.textContent=error.message;}
      return;
    }
    const unfinished=node('section');unfinished.setAttribute('aria-label','Unfinished handoffs');main.append(unfinished);pendingList(unfinished,parentStudyId);
    window.addEventListener('storage',event=>{if(event.key?.startsWith(window.ArVideoHandoffRecovery?.prefix||'ar-create.video-handoff.v1:'))pendingList(unfinished,parentStudyId);});
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
      research.href=researchAddress(parentStudyId,brief.findingId);
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
