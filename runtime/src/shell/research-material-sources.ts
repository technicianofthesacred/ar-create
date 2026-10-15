/** Default Research shows the readable transcript, not duplicate export files.
 * Only the owned recording namespace and a matching recorded job UUID establish
 * this relationship. Titles, quoted text and generic .txt files are not clues.
 * Explicit Library selections remain available; this never changes the catalog.
 */
export function canonicalResearchSources(sources:any[],isReadable:(source:any)=>boolean,explicitIds:string[]=[]){
 const readable=sources.filter(isReadable),exports=new Set<string>();
 for(const source of readable){
  if(source.rootId!=='recordings'||source.kind!=='transcript'||source.missing)continue;
  const job=/^([^/]+)\/Transcription\/([a-f0-9-]{36})\/transcript\.md$/.exec(source.rel_path||'');
  if(!job||source.recordingId!==job[2])continue;
  exports.add(`${job[1]}/Transcription/${job[2]}/transcript.txt`);
  exports.add(`vault/Workflow/0-Inbox/RAW - ${job[1]}.md`);
 }
 const explicit=new Set(explicitIds);
 return readable.filter(source=>explicit.has(source.id)||source.rootId!=='recordings'||!exports.has(source.rel_path));
}
