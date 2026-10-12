// Copied Magazine machinery; isolated adapter owns configuration and permitted routes.
// Human review is bound to the exact source and translated passage, never a model score.
import crypto from 'node:crypto';
import { timestamp } from './outputs.mjs';
import { conversationTurns } from './conversation.mjs';
import { translationCoverage } from './translation-coverage.mjs';
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const escape = value => String(value ?? '').replace(/([\\`*_[\]<>#])/g, '\\$1');
export const translationSegmentSourceDigest = segment => digest({ id: segment.id ?? null, start: segment.start, end: segment.end, speaker: segment.speaker ?? null, text: segment.text });
const sourceDigest = source => digest({ language: source.language, segments: (source.segments || []).map(({ id, start, end, speaker, text }) => ({ id, start, end, speaker, text })) });
const numbers = text => (String(text || '').match(/\d+(?:[.,]\d+)*/g) || []).sort();
function aligned(sourceSegment, translatedSegment) {
  return !!sourceSegment && !!translatedSegment && (sourceSegment.id == null ? translatedSegment.id == null : sourceSegment.id === translatedSegment.id);
}
export function translationSegmentFlags(translated, source, index) {
  const original = source.segments?.[index], target = translated.segments?.[index];
  if (!original) return ['missing-source'];
  const flags = target?.translationUncertainty?.trim() ? ['translation-uncertain'] : [];
  if (!aligned(original, target)) flags.push('segment-mismatch');
  if (!target || typeof target.text !== 'string' || (original.text.trim() && !target.text.trim())) flags.push('missing-translation');
  if (target?.text && translated.language?.split('-')[0] === 'en' && /\p{Script=Han}/u.test(original.text) && original.text.trim() === target.text.trim()) flags.push('untranslated-chinese');
  if (target?.text && JSON.stringify(numbers(original.text)) !== JSON.stringify(numbers(target.text))) flags.push('changed-numbers');
  return flags;
}
export function translationReviewSummary(translated, source) {
  const entries = translated.metadata?.translationReview?.segments || {};
  const staleTranslation = translated.stale || (translated.metadata?.translation?.sourceDigest && translated.metadata.translation.sourceDigest !== sourceDigest(source));
  const passages = (source.segments || []).map((segment, index) => {
    const entry = entries[index], target = translated.segments?.[index];
    const stale = !!entry && (entry.sourceDigest !== translationSegmentSourceDigest(segment) || entry.textDigest !== digest(target?.text));
    const confirmed = !stale && !!entry?.confirmed && aligned(segment, target) && typeof target.text === 'string' && !!target.text.trim();
    return { index, sourceDigest: translationSegmentSourceDigest(segment), confirmed, stale, flags: translationSegmentFlags(translated, source, index) };
  });
  const approved = passages.filter(p => p.confirmed).length;
  const stale = !!staleTranslation || passages.some(p => p.stale);
  return { status: !stale && passages.length > 0 && approved === passages.length && (translated.segments?.length || 0) === passages.length ? 'approved' : 'draft', approved, total: passages.length, remaining: passages.length - approved, stale, extraSegments: Math.max(0, (translated.segments?.length || 0) - passages.length), passages };
}
export function reviewTranslationSegment(translated, source, request) {
  const { index, text, confirmed, sourceDigest: expected } = request || {};
  if (!Number.isInteger(index) || index < 0 || index >= (source.segments?.length || 0)) throw new Error('Choose an existing source passage.');
  if (typeof confirmed !== 'boolean') throw new Error('Specify whether this passage was checked against the audio and original.');
  const original = source.segments[index], target = translated.segments?.[index];
  if (!aligned(original, target)) throw new Error('Translation passage does not match the original segment ID.');
  if (expected !== translationSegmentSourceDigest(original)) throw new Error('Original passage changed. Reload it before reviewing.');
  if ((translated.segments?.length || 0) !== source.segments.length || source.segments.some((s,i)=>!aligned(s,translated.segments[i]))) throw new Error('Source segment structure changed. Regenerate the translation before review.');
  if (text !== undefined && (typeof text !== 'string' || !text.trim())) throw new Error('Enter a nonempty translation.');
  const updated = structuredClone(translated);
  if (text !== undefined) updated.segments[index].text = text.trim();
  updated.segments[index].sourceText = original.text;
  updated.segments[index].start = original.start; updated.segments[index].end = original.end; updated.segments[index].speaker = original.speaker;
  if (confirmed && !updated.segments[index].text?.trim()) throw new Error('A missing translation cannot be approved.');
  updated.metadata ||= {};
  updated.metadata.translationReview ||= { segments: {} };
  updated.metadata.translationReview.segments ||= {};
  updated.metadata.translationReview.segments[index] = { confirmed, sourceDigest: expected, textDigest: digest(updated.segments[index].text), confirmedAt: confirmed ? new Date().toISOString() : null };
  if (source.segments.every((s,i)=>updated.segments[i].sourceText===s.text && updated.segments[i].speaker===s.speaker && updated.segments[i].start===s.start && updated.segments[i].end===s.end)) {
    updated.metadata.translation = {...updated.metadata.translation,sourceDigest:sourceDigest(source)}; updated.stale=false;
  }
  updated.metadata.translationReview.status = translationReviewSummary(updated, source).status;
  return updated;
}
export function bilingualMarkdown(job, original, translated, config = {}) {
  const summary = translationReviewSummary(translated, original), scalar = JSON.stringify;
  const coverage = translationCoverage(original, translated);
  const names = new Map((original.speakers || []).map((speaker, index) => [speaker.id, speaker.name || `Speaker ${index + 1}`]));
  const base = (config.reviewBaseUrl || 'http://localhost:8766').replace(/\/$/, '');
  const body = conversationTurns(original).map(turn => {
    const targets=turn.indices.map(index=>({segment:original.segments[index],target:translated.segments?.[index],review:summary.passages[index]}));
    const targetText=targets.map(({segment,target})=>aligned(segment,target)&&target.text?.trim()?target.text.trim():'[Missing translation]').join(' ');
    const uncertainties=targets.filter(({target})=>target?.translationUncertainty?.trim()).map(({target})=>target.translationUncertainty.trim());
    const timing=config.conversationTimestamps ? ` [${timestamp(turn.start)}–${timestamp(turn.end)}]` : '';
    return `**${escape(names.get(turn.speaker) || 'Unassigned')}${timing}**\n\n**Original (${escape(original.language || 'unknown')})** ${escape(turn.text)}\n\n**Translation (${escape(translated.language || 'unknown')})** ${escape(targetText)}${uncertainties.length?'\n\n**Uncertainty:** '+escape(uncertainties.join(' ')):''}${config.conversationReviewLinks ? `\n\n[Listen and review](${base}/transcription/${encodeURIComponent(job.id)}/view?review=${turn.indices[0]})` : ''}`;
  }).join('\n\n');
  return `---\ntype: bilingual-transcript\nkind: transcript\nlanguage: ${scalar(original.language || 'unknown')}\ntranslation: true\ntranslation_source_language: ${scalar(original.language || 'unknown')}\ntranslation_source_digest: ${scalar(translated.metadata?.translation?.sourceDigest || null)}\ntranslation_stale: ${summary.stale}\ntranslation_coverage_status: ${coverage.missing.length || coverage.extra ? 'incomplete' : 'complete'}\nsource_url: ${scalar(`${base}/transcription/${encodeURIComponent(job.id)}/view`)}\ntitle: ${scalar(job.story || '')}\nrecording_id: ${scalar(job.id)}\nsource_language: ${scalar(original.language || 'unknown')}\ntranslation_language: ${scalar(translated.language || 'unknown')}\ntranslation_review_status: ${summary.status}\ntranslation_reviewed_passages: ${summary.approved}\ntranslation_total_passages: ${summary.total}\ntranscription_review_status: ${scalar(original.metadata?.review?.status || 'unreviewed')}\nspeaker_map: ${scalar(Object.fromEntries((original.speakers || []).map(speaker => [speaker.id, speaker.name || null])))}\n---\n\n# ${escape(String(job.story || 'Conversation').replace(/[\r\n]/g, ' '))}\n\n${summary.status === 'approved' ? 'Translation passages were explicitly confirmed by a reviewer. This does not certify unresolved source transcription.' : 'Draft translation. Unapproved passages require checking against the original and recording.'}\n\n${body}\n`;
}
