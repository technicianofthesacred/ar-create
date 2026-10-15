/** Conservative UI reading of backend processing facts. Unknown is never reviewed. */
export function pipeline(source:any) {
  const supplied=source?.pipelineStates||{};
  const read=(value:any,fallback:string)=>typeof value==='string'?value:value?.state||value?.status||fallback;
  const metadataOnly=source?.provenance?.kind==='link'&&!source?.pipelineStates;
  const extractionBlocked=metadataOnly||['queued','needs-extraction','failed','partial','retained-needs-extraction','retained-needs-transcription','link-only','extracting','transcribing'].includes(source?.status);
  const nativeText=['note','text','markdown','transcript','web'].includes(source?.kind);
  const retained=read(supplied.retention||supplied.retained,source?.hash?'retained':'unknown');
  const extracted=read(supplied.extraction||supplied.extracted,extractionBlocked?'pending':nativeText&&source?.status==='ready'?'available':'not available');
  const reviewed=read(supplied.review||supplied.reviewed,'unreviewed');
  const extractionReady=['ready','extracted','complete','completed','available','native-text','usable'].includes(extracted);
  const cardEligible=source?.cardEligibility?.eligible??supplied.cardEligible??(!extractionBlocked&&extractionReady);
  return {retained,extracted,reviewed,method:supplied.extraction?.method||'',cardEligible,reason:source?.cardEligibility?.reason||supplied.cardReason||(cardEligible?'':'Source text has not been extracted yet. Retained links and media are not quotation evidence.')};
}
