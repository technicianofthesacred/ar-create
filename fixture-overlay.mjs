// fixturesDir: private reference fixtures replace the synthetic ones, read from the data home, never from code.
// Only the file names the interface loads are served from there, only to loopback hosts, only as regular files.
import fs from 'node:fs';
import path from 'node:path';
export const FIXTURE_FILES=new Set(['synthetic-study-data.js']);
export function installFixtureOverlay(server,{fixturesDir,port}){
 const original=server.listeners('request');server.removeAllListeners('request');
 const hostPattern=new RegExp(`^(127\\.0\\.0\\.1|localhost|\\[::1\\]):${port}$`);
 server.on('request',(request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname,name=pathname.startsWith('/document-study/')?pathname.slice('/document-study/'.length):'';
  if(request.method==='GET'&&FIXTURE_FILES.has(name)&&hostPattern.test(request.headers.host||'')){
   const file=path.join(fixturesDir,name),stat=fs.lstatSync(file,{throwIfNoEntry:false});
   if(stat?.isFile()&&!stat.isSymbolicLink()){response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return response.end(fs.readFileSync(file));}
  }
  for(const listener of original)listener.call(server,request,response);
 });
 return server;
}
