/* Shared pure projection of existing recording quality flags. */
export function reviewIssues(result) {
  return (result.segments || []).flatMap((segment,index,all)=>{
    const reasons=[];
    if(!segment.speaker)reasons.push('Missing speaker');
    if(segment.confidence_unavailable|| (Number.isFinite(segment.avg_logprob)&&segment.avg_logprob < -1))reasons.push('Unclear speech');
    if(!reasons.includes('Unclear speech')&&(segment.words||[]).some(w=>Number.isFinite(w.probability)&&w.probability<0.35))reasons.push('Unclear speech');
    for(const flag of result.metadata?.quality_flags||[]){if(Number(flag.start)<segment.end&&Number(flag.end)>segment.start){const reason=flag.kind==='confidence'?'Unclear speech':'Possible repetition';if(!reasons.includes(reason))reasons.push(reason)}}
    const text=segment.text.trim();
    if(text && ((all[index-1]?.text.trim()===text&&all[index+1]?.text.trim()===text)||/(.{4,80}?)\1\1/u.test(text)))reasons.push('Repeated text');
    return reasons.length?[{index,start:segment.start,end:segment.end,reasons}]:[];
  });
}
