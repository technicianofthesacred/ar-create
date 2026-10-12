// Copied Magazine machinery; isolated adapter owns configuration and permitted routes.
// A reading projection only: source segments, IDs and word timings stay untouched.
export function conversationTurns(result) {
  const turns=[];
  for(const [index,segment] of (result.segments || []).entries()) {
    const last=turns.at(-1), text=String(segment.text || '').trim();
    if(last && segment.speaker && last.speaker===segment.speaker) {
      last.end=segment.end;last.indices.push(index);last.text=[last.text,text].filter(Boolean).join(' ');
    } else turns.push({speaker:segment.speaker || null,start:segment.start,end:segment.end,text,indices:[index]});
  }
  return turns;
}
export const markdownText = value => String(value ?? '').replace(/([\\`*_[\]<>#])/g,'\\$1');
