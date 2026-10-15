/** Resolve explicitly selected recordings to their existing canonical text.
 * Never choose a translation, a title match or an unrelated transcript. The
 * recording source and returned readable source retain their own identities.
 */
export function resolveRecordingSourceSelection(requestedIds, sources, jobs, isReadable = source => source?.cardEligibility?.eligible === true) {
 const sourceIds = [], substitutions = [], unresolvedIds = [];
 for (const id of [...new Set(requestedIds || [])]) {
  const source = (sources || []).find(item => item.id === id && !item.missing);
  if (source && isReadable(source)) { if (!sourceIds.includes(id)) sourceIds.push(id); continue; }
  const linked = source?.kind === 'audio' ? (jobs || []).filter(job => job.sourceId === id && job.transcriptReady === true) : [];
  const candidates = linked.length === 1 ? (sources || []).filter(item => !item.missing && item.rootId === 'recordings' && item.kind === 'transcript' && item.recordingId === linked[0].id && /(^|\/)transcript\.md$/i.test(item.rel_path || '') && isReadable(item)) : [];
  if (candidates.length !== 1) { unresolvedIds.push(id); continue; }
  const transcript = candidates[0];
  if (!sourceIds.includes(transcript.id)) sourceIds.push(transcript.id);
  substitutions.push({ recordingSourceId: id, recordingId: linked[0].id, transcriptSourceId: transcript.id });
 }
 return { sourceIds, substitutions, unresolvedIds };
}
