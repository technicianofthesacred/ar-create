// Teajia's image control uses only this isolated ar-create upload boundary.
// No authenticated original Teajia API, object store or account is imported.
export const localMediaApi = {
 async uploadImageProgress(file:File,onProgress:(n:number)=>void,_options?:{filename?:string}):Promise<string> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  if(file.size>5*1024*1024) throw new Error('Choose a photo smaller than 5 MB.');
  onProgress(.1);
  const response=await fetch('/api/media',{method:'POST',headers:{'Content-Type':file.type,'X-Filename':encodeURIComponent(file.name)},body:file});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error||'Could not save photo.');
  onProgress(1);return result.url;
 }
};
