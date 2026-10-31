/* Read-only locations from existing owners; never logical filing or source authority. */
(()=>{
 'use strict';
 const HASH=/^[a-f0-9]{64}$/i,fail=message=>{throw Error(message);};
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 function token(value){if(typeof value!=='string'||!value||value.length>512||/[\u0000-\u001f\u007f]/.test(value))fail('Location owner identity is unconfirmed.');return value;}
 function relative(value,empty=false){if(typeof value!=='string'||value.length>8192||/[\\\u0000-\u001f\u007f]/.test(value)||value.startsWith('/')||/^[a-z][a-z0-9+.-]*:/i.test(value)||(!empty&&!value)||value&&value.split('/').some(p=>!p||p==='.'||p==='..'))fail('Location needs a safe relative path.');return value;}
 const identity=row=>JSON.stringify([row.id,row.authority,row.hash??null,row.artifactId??null,row.storyId??null,row.rootId??null,row.rel_path??null,row.relativePath??null]);
 function project({sourceTree,sources,scope,revision}={}){
  if(!HASH.test(scope||'')||!HASH.test(revision||'')||!HASH.test(sourceTree?.indexHash||''))fail('The location connection revision is unconfirmed.');
  if(!Array.isArray(sources)||sources.length>10000||!Array.isArray(sourceTree.roots)||!Array.isArray(sourceTree.sources))fail('The location catalog is unavailable.');
  const catalog=new Map(),indexed=new Map(),roots=new Map(),files=new Map(),locations=new Map();
  for(const row of sources){token(row?.id);token(row.authority);if(row.hash!=null&&!HASH.test(row.hash))fail('The source revision is unconfirmed.');const old=catalog.get(row.id);if(old&&identity(old)!==identity(row))fail('Conflicting source identities.');catalog.set(row.id,row);}
  for(const row of sourceTree.sources){token(row?.id);token(row.rootId);relative(row.rel_path);if(row.authority!==undefined&&row.authority!=='library')fail('Foreign source location authority.');if(row.hash!=null&&!HASH.test(row.hash))fail('The source location revision is unconfirmed.');const old=indexed.get(row.id);if(old&&identity(old)!==identity(row))fail('Conflicting indexed source identities.');indexed.set(row.id,row);}
  let nodes=0;
  for(const root of sourceTree.roots){token(root?.id);if(roots.has(root.id))fail('Conflicting location roots.');roots.set(root.id,root);
   function visit(folder,parent=''){
    if(++nodes>20000)fail('Location tree exceeds the browse limit.');const path=relative(folder?.rel_path,true);if(path!==parent)fail('Location tree parent changed.');
    if(!Array.isArray(folder.files)||!Array.isArray(folder.folders))fail('Location tree is unavailable.');
    for(const file of folder.files){token(file?.sourceId);const filePath=relative(file.rel_path);if(filePath.split('/').slice(0,-1).join('/')!==path)fail('Location file parent changed.');const key=JSON.stringify([root.id,filePath]),old=files.get(key);if(old&&old!==file.sourceId)fail('Conflicting location file identities.');files.set(key,file.sourceId);}
    for(const child of folder.folders){const childPath=relative(child?.rel_path);if(childPath.split('/').slice(0,-1).join('/')!==path)fail('Location tree parent changed.');visit(child,childPath);}
   }
   visit(root.tree);
  }
  function add(owner,path,sourceId){
   let parentKey=null;const parts=path.split('/').slice(0,-1);
   for(let depth=0;depth<=parts.length;depth++){
    const key=JSON.stringify([owner.authority,owner.rootId??null,owner.storyId??null,parts.slice(0,depth)]);
    if(!locations.has(key))locations.set(key,{...owner,name:depth?parts[depth-1]:owner.name,parentKey,sourceIds:new Set()});
    if(depth===parts.length)locations.get(key).sourceIds.add(sourceId);parentKey=key;
   }
  }
  for(const row of catalog.values()){
   if(row.authority!=='library'&&indexed.has(row.id))fail('Foreign source location authority.');
   if(row.authority==='library'){
    const saved=indexed.get(row.id);if(!saved)continue;
    // A deferred hash on both sides is not a changed revision; it waits outside the folders until it is hashed.
    if(row.hash==null&&saved.hash==null)continue;
    if(!HASH.test(row.hash||'')||row.hash!==saved.hash||row.rootId!==undefined&&row.rootId!==saved.rootId||row.rel_path!==undefined&&row.rel_path!==saved.rel_path)fail('Source location identity or revision changed.');
    const root=roots.get(saved.rootId);if(!root||files.get(JSON.stringify([saved.rootId,saved.rel_path]))!==row.id)fail('Source location does not match its existing owner.');
    add({authority:'library',rootId:root.id,name:typeof root.name==='string'?root.name:'Library'},saved.rel_path,row.id);
   }else if(row.authority==='magazine-original'){
    token(row.storyId);if(row.artifactId!==row.id||!HASH.test(row.hash||''))fail('Original location needs its exact artifact owner.');
    const path=relative(row.relativePath);add({authority:row.authority,storyId:row.storyId,name:'Magazine · '+row.storyId},path,row.id);
   }
  }
  const keys=[...locations.keys()].sort(),ids=new Map(keys.map((key,i)=>[key,'location-'+(i+1)]));
  const folders=keys.map(key=>{const {parentKey,sourceIds,...row}=locations.get(key);return {...row,id:ids.get(key),parentId:parentKey===null?null:ids.get(parentKey),sourceIds:[...sourceIds].sort()};});
  return freeze({scope,revision,treeRevision:sourceTree.indexHash,readOnly:true,folders});
 }
 function locationDescriptor(projection,id,{scope,revision,treeRevision,ready}={}){
  if(!ready||projection?.scope!==scope||projection?.revision!==revision||projection?.treeRevision!==treeRevision)fail('The locations changed. Refresh before browsing.');
  const folder=projection.folders.find(row=>row.id===id);if(!folder)fail('The location is no longer available.');
  return freeze({id:folder.id,scope,revision,treeRevision,authority:folder.authority,...folder.rootId?{rootId:folder.rootId}:{storyId:folder.storyId}});
 }
 window.arCreateSourceLocations=Object.freeze({project,locationDescriptor});
})();
