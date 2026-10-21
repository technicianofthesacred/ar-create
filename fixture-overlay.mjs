// fixturesDir: private reference fixtures replace the synthetic ones, read from the data home, never from code.
// Only the known JavaScript fixture and flat image names in the two legacy asset folders are served.
// Private assets stay outside the release, restricted to loopback hosts and regular files.
import fs from 'node:fs';
import path from 'node:path';
export const FIXTURE_FILES=new Set(['synthetic-study-data.js']);
const IMAGE_TYPES={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif'};
function imageFixture(fixturesDir,pathname){
 // Match raw URL paths: no URL normalization, decoding, nested names or active formats.
 const match=/^\/(document-study\/assets\/photos|porcelain-assets)\/([A-Za-z0-9][A-Za-z0-9_.-]*\.(?:jpg|jpeg|png|webp|gif|avif))$/i.exec(pathname);
 if(!match)return null;
 let fd;
 try{
  let file=fixturesDir;
  if(!fs.lstatSync(file).isDirectory()||fs.lstatSync(file).isSymbolicLink())return null;
  const parts=[...match[1].split('/'),match[2]];
  for(const [i,part] of parts.entries()){
   file=path.join(file,part);const stat=fs.lstatSync(file);
   if(stat.isSymbolicLink()||(i<parts.length-1?!stat.isDirectory():!stat.isFile()))return null;
  }
  fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const stat=fs.fstatSync(fd);
  if(!stat.isFile()||stat.nlink!==1)return null;
  // Recheck the resolved path after opening: intermediate symlinks must not escape the configured root.
  const root=fs.realpathSync(fixturesDir),actual=fs.realpathSync(file);
  if(actual!==path.join(root,...parts))return null;
  return {body:fs.readFileSync(fd),type:IMAGE_TYPES[path.extname(file).toLowerCase()]};
 }catch{return null;}finally{if(fd!==undefined)fs.closeSync(fd);}
}
export function installFixtureOverlay(server,{fixturesDir,port}){
 const original=server.listeners('request');server.removeAllListeners('request');
 const hostPattern=new RegExp(`^(127\\.0\\.0\\.1|localhost|\\[::1\\]):${port}$`);
 server.on('request',(request,response)=>{
  const rawPath=request.url.split('?')[0];
  if(['GET','HEAD'].includes(request.method)&&hostPattern.test(request.headers.host||'')){
   const image=imageFixture(fixturesDir,rawPath);
   if(image){response.writeHead(200,{'Content-Type':image.type,'Content-Length':image.body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return response.end(request.method==='HEAD'?undefined:image.body);}
  }
  const pathname=new URL(request.url,'http://localhost').pathname,name=pathname.startsWith('/document-study/')?pathname.slice('/document-study/'.length):'';
  if(request.method==='GET'&&FIXTURE_FILES.has(name)&&hostPattern.test(request.headers.host||'')){
   const file=path.join(fixturesDir,name),stat=fs.lstatSync(file,{throwIfNoEntry:false});
   if(stat?.isFile()&&!stat.isSymbolicLink()){response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return response.end(fs.readFileSync(file));}
  }
  for(const listener of original)listener.call(server,request,response);
 });
 return server;
}
