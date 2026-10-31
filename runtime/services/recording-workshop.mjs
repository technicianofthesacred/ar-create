import {correctionUI} from './transcript-correction-ui.mjs';
import { transcriptPage as magazineTranscriptPage } from './magazine/workshop-ui.mjs';
import {translationRequestReceipt} from './magazine/openai-translation.mjs';

// Keep the donor workshop's actual audio, speaker, correction and review UI.
// This presentation boundary describes ar-create's destinations and capabilities.
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function recordingDuration(result) {
  const duration = result?.metadata?.duration_seconds;
  if (duration !== null && duration !== undefined && duration !== '' && Number.isFinite(Number(duration)) && Number(duration) >= 0) return Number(duration);
  return Math.max(0, ...(result?.segments || []).map(segment => Number(segment.end)).filter(Number.isFinite));
}

function reviewContext(result) {
  if (!result) return '';
  const languages = [...new Set((result.metadata?.detected_languages || []).filter(language => typeof language === 'string' && language.trim()))];
  const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
  const detected = languages.map(language => {
    try { return languageNames.of(language) || language; } catch { return language; }
  });
  const notes = [];
  if (languages.length > 1) notes.push(`Mixed language detected: ${detected.join(' / ')}. Check against audio.`);
  const speakerWarning = (result.metadata?.warnings || []).some(warning => /speaker.*(?:not verified|unverified)/i.test(String(warning)));
  if (speakerWarning && result.metadata?.review?.status !== 'reviewed') notes.push('Speaker labels are unverified. Listen before naming.');
  return notes.length ? `<p class="ar-review-context" data-recording-review-context>${notes.map(escapeHtml).join(' ')}</p>` : '';
}

const CONTINUITY_CSS = `
body.ar-recording-workshop{--bg:#151413;--panel:#1d1b18;--text:#e0d7c9;--dim:#a99f91;--line:#3c372f;--accent:#bd9f7d;--on-accent:#151413;--body:#e0d7c9;color-scheme:dark}
.ar-recording-workshop .ar-workshop-header{height:64px;padding:0 24px;display:flex;align-items:center;gap:20px;border-bottom:1px solid var(--line);background:var(--panel)}
.ar-recording-workshop .ar-workshop-brand{font-size:20px;letter-spacing:-.6px;color:var(--text)}
.ar-recording-workshop .ar-workshop-brand span{color:var(--accent)}
.ar-recording-workshop .ar-workshop-context{font-size:12px;color:var(--dim)}
.ar-recording-workshop .ar-workshop-return{margin-left:auto;color:var(--accent);font-size:12px;display:inline-flex;align-items:center;min-height:44px}
.ar-recording-workshop .transcript-workspace{height:calc(100dvh - 64px);grid-template-columns:288px minmax(0,1fr)}
.ar-recording-workshop .workspace-sidebar{padding:18px 22px}
.ar-recording-workshop .workspace-sidebar h1{color:var(--text);white-space:normal;overflow-wrap:anywhere;font-size:17px}
.ar-recording-workshop .editor-header{position:static;width:auto;height:auto;overflow:visible;clip-path:none;white-space:normal;padding:16px 32px;border-bottom:1px solid var(--line);display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;font-size:12px;color:var(--dim)}
.ar-recording-workshop .conversation-guide button{min-height:44px}
.ar-recording-workshop .workspace-sidebar .save{display:block;width:100%;min-height:44px;border-radius:4px}
.ar-recording-workshop .view-switch,.ar-recording-workshop .view-switch button,.ar-recording-workshop .search-field input{border-radius:4px}
.ar-recording-workshop .view-switch button{min-height:44px}
.ar-recording-workshop .transcript-editor{padding:28px 36px}
.ar-recording-workshop .plain-transcript{max-width:820px;font-size:17px;line-height:1.75}
.ar-recording-workshop .conversation-turn{margin-bottom:18px}
.ar-recording-workshop .ar-translation-note{padding:10px 12px;border:1px solid var(--line);border-radius:4px;background:var(--bg)}
.ar-recording-workshop .ar-review-context{margin:0;padding:10px 32px;border-bottom:1px solid var(--line);color:var(--dim);font-size:12px;line-height:1.5}
.ar-recording-workshop .ar-correction-review{padding:10px 32px;border-bottom:1px solid var(--line);font-size:12px}
.ar-recording-workshop .ar-correction-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ar-recording-workshop .ar-correction-status{color:var(--accent)}
.ar-recording-workshop .ar-correction-review p{margin:6px 0}
.ar-recording-workshop .ar-correction-review button{min-height:44px;padding:8px 14px;border-radius:4px;font:inherit}
.ar-recording-workshop .ar-correction-action{background:var(--accent);color:var(--on-accent);border:1px solid var(--accent)}
.ar-recording-workshop .ar-correction-quiet{background:transparent;color:var(--dim);border:1px solid var(--line);margin-left:8px}
.ar-recording-workshop .ar-correction-review button:disabled{opacity:.5;cursor:default}
.ar-recording-workshop .ar-correction-files{margin-left:auto;color:var(--dim);max-width:100%}
.ar-recording-workshop .ar-correction-files summary{cursor:pointer;min-height:44px;align-content:center}
.ar-recording-workshop .ar-correction-files[open]{flex-basis:100%;margin-left:0}
.ar-recording-workshop .ar-correction-files code{display:block;overflow-wrap:anywhere;margin:8px 0}
.ar-recording-workshop .ar-correction-review textarea{display:block;width:100%;box-sizing:border-box;min-height:220px;background:var(--bg);color:var(--text);border:1px solid var(--line);padding:10px;font:inherit;margin:8px 0}
.ar-recording-workshop .ar-correction-review [role=status]:empty{display:none}
.ar-recording-workshop .ar-correction-change{border-top:1px solid var(--line);padding:12px 0;margin-top:10px}
.ar-recording-workshop .ar-correction-context{color:var(--dim)}
.ar-recording-workshop .ar-correction-label{display:block;color:var(--dim);font-size:11px;margin:8px 0 3px}
.ar-recording-workshop .ar-correction-before{display:block;color:var(--dim);text-decoration:none;line-height:1.5}
.ar-recording-workshop .ar-correction-after{color:var(--text);font-size:14px;line-height:1.5}
.ar-recording-workshop .ar-save-note{color:var(--dim);font-size:12px;line-height:1.5;margin:8px 0}
.ar-recording-workshop .workspace-sidebar .transcript-tools,.ar-recording-workshop .translation-review-actions{display:flex;flex-direction:column;align-items:stretch;gap:6px}
.ar-recording-workshop [data-chatgpt-import] textarea{display:block;width:100%;min-height:140px;box-sizing:border-box;resize:vertical;border:1px solid var(--line);background:var(--bg);color:var(--text);padding:10px;font:inherit;border-radius:4px}
.ar-recording-workshop .translation-source{margin:10px 0;padding:10px 12px;border-left:2px solid var(--accent);background:var(--panel)}
.ar-recording-workshop .translation-source p{margin:4px 0}
.ar-recording-workshop [data-translation-failure] p{overflow-wrap:anywhere}
.ar-recording-workshop .workspace-player{border-top:1px solid var(--line);background:var(--panel)}
@media(max-width:700px){
 .ar-recording-workshop .ar-workshop-header{height:auto;min-height:64px;padding:10px 16px;gap:8px 14px;flex-wrap:wrap}
 .ar-recording-workshop .ar-workshop-context{display:none}
 .ar-recording-workshop .transcript-workspace{display:block;height:auto}
 .ar-recording-workshop .workspace-sidebar{padding:12px 18px}
 .ar-recording-workshop .editor-header{padding:14px 20px}
 .ar-recording-workshop .transcript-editor{padding:22px 20px 160px}
 .ar-recording-workshop .pending-conversation{padding-bottom:32px}
}
`;

export function transcriptPage(job, result, translation = null) {
  let page = magazineTranscriptPage(job, result, translation);
  const english=(job.translations||[]).find(item=>item.language==='en'),glossary=english?.glossary||'';
  const fingerprint=result?translationRequestReceipt(result,{language:'en',glossary}).requestFingerprint:null;
  const incompatible=!!english&&english.requestFingerprint!==fingerprint;
  const pending=(job.translations||[]).some(item=>['queued','running'].includes(item.state));
  const complete=english?.state==='complete'&&!english.stale&&!english.outdated&&!incompatible;
  const regenerate=incompatible||complete;
  const label=pending?'Translating…':regenerate?'Regenerate English translation':english?'Resume English translation':'Translate to English';
  const autoForm=`<form data-translation-form="${escapeHtml(job.id)}"><select name="language" aria-label="Automatic translation language" hidden><option value="en">English</option></select><select name="engine" aria-label="Automatic translation engine" hidden><option value="openai-account">Codex account</option></select><details class="side-section"><summary>Translation options</summary><label>Confirmed vocabulary <span class="meta">optional</span><textarea name="glossary" maxlength="4000" placeholder="Confirmed names and tea terms">${escapeHtml(glossary)}</textarea></label>${english?`<label class="toggle"><input name="regenerate" type="checkbox" ${regenerate?'checked':''}>Regenerate, retaining the previous translation</label>`:'<input name="regenerate" type="checkbox" hidden>'}</details><button class="save" type="submit" ${pending||job.translationAvailable===false?'disabled':''}>${label}</button><span role="status" aria-live="polite"></span></form><p class="meta ar-translation-note">${job.translationAvailable===false?'Codex is unavailable. Start it in the Command room or use a manual packet.':'Uses your signed-in Codex account and its usage limits. Translation starts only when you choose it; original words stay saved.'}</p>`;
  const scriptStart = page.indexOf('<script>');
  let markup = page.slice(0, scriptStart);
  const script = page.slice(scriptStart)
    .replaceAll('Saving to Mag', 'Saving in ar-create')
    .replaceAll('Saved to Mag', 'Saved in ar-create')
    .replaceAll('mag-workspace:', 'ar-create-recording-workspace:')
    .replaceAll('mag-recordings-filter', 'ar-create-recordings-filter')
    .replaceAll('mag-conversation-view:', 'ar-create-conversation-view:')
    .replace("document.querySelectorAll('[data-translation-state]').forEach(el=>el.hidden=true)","document.querySelectorAll('[data-translation-state],[data-translation-failure-note],[data-translation-failure]').forEach(el=>el.hidden=true)")
    .replace("glossary:translate.querySelector('[name=glossary]').value", "glossary:translate.querySelector('[name=glossary]').value,regenerate:translate.querySelector('[name=regenerate]').checked");
  markup = markup
    .replace(/<form data-translation-form="[^"]*">[\s\S]*?<\/form><button[^>]*aria-label="About translation"[\s\S]*?<\/button>/, complete?`<a class="save" href="/transcription/${escapeHtml(job.id)}/view?language=en">Open English translation</a><details class="side-section"><summary>Regenerate translation</summary>${autoForm}</details>`:autoForm)
    .replaceAll('Save to Mag', 'Save in ar-create')
    .replaceAll('Saved to Mag', 'Saved in ar-create')
    .replace(/<button type="button" data-guide-step="translate"[^>]*>[\s\S]*?<\/button>/, '')
    .replace('4 · Save in ar-create', '3 · Save in ar-create')
    .replace('<summary>Translation</summary>', '<summary>Translation · optional</summary>')
    .replace('<summary>Needs review · ', '<summary>Flagged segments · ')
    .replace(/(<p class="meta recording-duration" data-recording-duration>)[^<]*(<\/p>)/, (_, start, end) => `${start}${Math.round(recordingDuration(result))} seconds${end}`)
    .replace('<article class="transcript-editor">', `${reviewContext(result)}<article class="transcript-editor">`)
    .replaceAll('href="/transcription">← Drop files', 'href="/#explore">← Source library')
    .replaceAll('href="/transcription">← Recordings', 'href="/#explore">← Source library')
    .replace('<section class="save-mag">', '<section class="save-mag"><p class="ar-save-note">Save Markdown and JSON in this workspace’s recording storage. The transcript is available in the source library.</p>')
    .replace('</style>', `${CONTINUITY_CSS}</style>`)
    .replace('<body>', '<body class="ar-recording-workshop"><header class="ar-workshop-header"><a class="ar-workshop-brand" href="/#explore">ar<span>·</span>create</a><span class="ar-workshop-context">Material / Recording workshop</span><a class="ar-workshop-return" href="/#explore">Return to source library ↗</a></header>');
  let statusIndex=0;
  markup=markup.replace(/<p class="meta" data-translation-state[^>]*>[\s\S]*?<\/p>/g,original=>{
    const status=(job.translations||[])[statusIndex++];if(!status||!['failed','interrupted'].includes(status.state))return original;
    const total=Number(status.coverage?.total??status.total)||result?.segments?.length||0;
    const completed=Math.min(total,Math.max(0,Number(status.coverage?.translated??status.completed)||0)),remaining=total-completed;
    const changed=status.stale||status.outdated||status.failure==='source-or-settings-changed'||status.language==='en'&&incompatible;
    const error=String(status.error||'The translation worker was interrupted. Saved passages are retained.').replace(/^Codex translation failed\. Sign in or resolve its permission screen in the Command room, then Resume\.\s*/,'');
    const reason=changed?'The source or settings changed. Regenerate from the current saved words.':/unsupported|not supported|unknown model|invalid model|model.*unavailable/i.test(error)?'Codex rejected the configured model or options.':/sign.?in|log.?in|permission/i.test(error)?'Resolve Codex sign-in or permissions in the Command room.':'Codex stopped before finishing this batch.';
    return `<p class="meta" data-translation-state role="status">${escapeHtml(status.language==='en'?'English':status.language)}: ${completed} / ${total} passages saved. ${changed?'Regenerate retains this draft in history.':remaining?`Resume continues with ${remaining} remaining ${remaining===1?'passage':'passages'}.`:'All passages are retained; resume finalizes the saved draft.'}</p><p class="meta" data-translation-failure-note>${reason}</p><details class="side-section" data-translation-failure><summary>Failure details</summary><p class="meta">${escapeHtml(error)}</p></details>`;
  });
  const correction=correctionUI(job.correctionSnapshot);
  markup=markup.replace('<article class="transcript-editor">',correction.markup+'<article class="transcript-editor">');
  const termsContext=JSON.stringify({sourceId:job.sourceId||null,jobId:job.id,expected:job.correctionSnapshot?.expected,segments:job.correctionSnapshot?.segments||[],external:job.correctionSnapshot?.external}).replace(/</g,'\\u003c');
  const termsScript=!translation&&job.correctionSnapshot?`<script type="module">import {createSourceTermsReview} from '/document-study/source-terms-review.js';const termsContext=${termsContext};const host=document.createElement('section');document.querySelector('[data-correction-review]').after(host);const terms=createSourceTermsReview({window,root:host,context:()=>({...termsContext,actor:window.arCreateUiActor?.actor||'human:adrian'}),onProposed:receipt=>{let button=document.querySelector('[data-correction-inspect="'+receipt.receiptId+'"]');if(!button){button=document.createElement('button');button.type='button';button.className='ar-correction-action';button.dataset.correctionInspect=receipt.receiptId;button.textContent='Inspect correction';document.querySelector('.ar-correction-bar').append(button);}button.click();document.querySelector('[data-correction-detail]').scrollIntoView({block:'nearest'});}});await terms.open();</script>`:'';
  return markup + correction.script + termsScript + script;
}
