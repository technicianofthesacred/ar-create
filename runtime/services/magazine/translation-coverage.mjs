// Copied Magazine machinery; isolated adapter owns configuration and permitted routes.
// Coverage is deterministic; it is separate from linguistic correctness.
export function translationCoverage(source, target) {
  const segments=source.segments || [], output=target?.segments || [], missing=[];
  for (let index=0;index<segments.length;index++) {
    const original=segments[index], translated=output[index];
    if (!translated || (original.id ?? null)!==(translated.id ?? null) || typeof translated.text!=='string' || (original.text.trim() && !translated.text.trim())) missing.push(index);
  }
  return {translated:segments.length-missing.length,total:segments.length,missing,extra:Math.max(0,output.length-segments.length)};
}
