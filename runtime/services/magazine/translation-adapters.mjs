// Copied Magazine machinery; isolated adapter owns configuration and permitted routes.
// Replaceable local translation boundary. No diarization or storage inside adapters.
import {openAITranslation} from './openai-translation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { translateTranscript, translationLanguage, translationSourceDigest, translatedMarkdown } from './translation.mjs';
import { readableTranscript } from './outputs.mjs';
import { atomicJson } from './intake.mjs';
import { translationCoverage } from './translation-coverage.mjs';

export const TRANSLATION_ENGINES = ['openai-account', 'whisper-audio', 'ollama'];
export function translationOptions(input = {}) {
  const engine = input.engine || 'openai-account';
  if (!TRANSLATION_ENGINES.includes(engine)) throw Error('Choose an available local translation adapter.');
  const language = translationLanguage(input.language);
  if (engine === 'whisper-audio' && language !== 'en') throw Error('Whisper audio translation supports English. Choose an explicit text adapter for another language.');
  const glossary = input.glossary || '';
  if (typeof glossary !== 'string' || glossary.length > 4000 || /[\x00-\x08\x0e-\x1f]/.test(glossary)) throw Error('Vocabulary hints must be text under 4,000 characters.');
  return { engine, language, glossary: glossary.trim() };
}

async function whisperAudio(config, job, result, options) {
  if (!job.source || !fs.existsSync(job.source)) throw Error('Original recording is unavailable. Restore the audio before translating.');
  const dir = path.join(job.output, 'translations');
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = path.join(dir, `${options.language}.state.json`);
  const state = { ...options, version: 3, method: 'audio-source-turns', state: 'running', pid: process.pid,
    model: config.translation?.whisperModel || 'mlx-community/whisper-large-v3-mlx', sourceDigest: translationSourceDigest(result), completed: 0, total: result.segments.length };
  const persist = () => atomicJson(stateFile, { ...state, updatedAt: new Date().toISOString() });
  const requestFile = path.join(dir, 'whisper.request.json'), outputFile = path.join(dir, 'whisper.candidates.json');
  const normalized = path.join(job.output, 'audio.wav');
  atomicJson(requestFile, { audio: fs.existsSync(normalized) ? normalized : job.source, segments: result.segments, model: state.model, sourceDigest: state.sourceDigest, glossary: options.glossary, cache: path.join(dir, 'whisper.cache.json') });
  persist();
  await new Promise((resolve, reject) => {
    const child = spawn(config.python || 'python3', ['-m', 'transcription.translation', '--request', requestFile, '--output', outputFile], { cwd: config.repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '', errors = '';
    child.stdout.on('data', data => { buffer += data; let newline; while ((newline = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1); try { const progress = JSON.parse(line); if (Number.isInteger(progress.completed)) { state.completed = progress.completed; persist(); } } catch {} } });
    child.stderr.on('data', data => { errors = (errors + data).slice(-2000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(Error(`Whisper audio translation failed. ${errors}`)));
  });
  const candidates = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  if (candidates.length !== result.segments.length) throw Error('Audio translation did not cover all source turns.');
  const segments = result.segments.map(({ words, ...segment }, index) => ({ ...segment, sourceText: segment.text, text: candidates[index].text, translationFlags: candidates[index].flags, detectedLanguage: candidates[index].detectedLanguage }));
  const translated = { ...result, language: options.language, segments, metadata: { ...result.metadata, review: { status: 'unreviewed' }, translation: { ...state, engine: options.engine, targetLanguage: options.language, sourceLanguage: result.language, wordAlignment: false, createdAt: new Date().toISOString() } } };
  delete translated.words;
  atomicJson(path.join(job.output, `translation.${options.language}.json`), translated);
  fs.writeFileSync(path.join(job.output, `translation.${options.language}.md`), translatedMarkdown(job, translated, config));
  fs.writeFileSync(path.join(job.output, `translation.${options.language}.txt`), 'Unreviewed audio translation draft.\n\n' + readableTranscript(translated));
  state.coverage=translationCoverage(result,translated);
  state.state=state.coverage.missing.length?'incomplete':'complete'; persist();
  return translated;
}

export async function runTranslationAdapter(config, job, result, input) {
  const options = translationOptions(input);
  if(options.engine==='openai-account')return openAITranslation(config,job,result,{...options,...(input.regenerate!==undefined?{regenerate:input.regenerate}:{}),...(input.requestFingerprint?{requestFingerprint:input.requestFingerprint}:{}),...(input.sourceDigest?{sourceDigest:input.sourceDigest}:{})});
  // Regenerating a draft must not destroy an earlier human-reviewed version.
  const existing = ['json', 'md', 'txt'].map(ext=>path.join(job.output, `translation.${options.language}.${ext}`)).filter(file=>fs.existsSync(file));
  if (existing.length) {
    const history = path.join(job.output, 'translations', 'history', options.language, randomUUID());
    fs.mkdirSync(history, {recursive:true});
    for (const file of existing) fs.copyFileSync(file,path.join(history,path.basename(file)));
  }
  if (options.engine === 'ollama') return translateTranscript({ ...config, translation: { ...config.translation, glossary: options.glossary } }, job, result, options.language);
  return whisperAudio(config, job, result, options);
}
