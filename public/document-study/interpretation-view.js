/* Pure display projection. Source speech, corrections, language metadata and registry identity never change. */
const GENERIC_SPEAKER=/^speaker[\s_-]*\d+$/i;
function boundary(turn){return !!turn&&(['editorial','session','session-boundary','editorial-boundary','boundary'].includes(turn.kind)||String(turn.id||'').startsWith('editorial-')||/^\[Editorial session boundary/.test(turn.originalText||''));}
function originalLanguage(turn){
 if(!turn||boundary(turn))return null;
 // An explicit source-language field, including an unknown/null value, must not be replaced by display language.
 const value=Object.hasOwn(turn,'sourceLanguage')?turn.sourceLanguage:turn.language;
 if(typeof value!=='string')return null;const language=value.trim().toLowerCase();
 if(/^(?:zh|cmn|yue)(?:[-_]|$)/.test(language)||['chinese','mandarin','cantonese','中文','汉语','普通话','粤语'].includes(language))return 'zh';
 if(/^en(?:[-_]|$)/.test(language)||language==='english')return 'en';
 return null;
}
const label=language=>language==='zh'?'Chinese side':language==='en'?'English side':null;
/** Original-language metadata plus an actual paired source/current form, or an explicit session choice. */
export function detectInterpretation(session){
 if(!session||session.interpretation===false)return false;if(session.interpretation===true)return true;
 const turns=Array.isArray(session.turns)?session.turns:[],languages=new Set(turns.map(originalLanguage).filter(Boolean));
 return languages.has('zh')&&languages.has('en')&&turns.some(t=>!boundary(t)&&typeof t.originalText==='string'&&t.originalText.length>0&&typeof t.text==='string'&&t.originalText!==t.text);
}
/** Generic diarization labels collapse by source-language side; reliable supplied names stay exact. */
export function sourceSide(turn){
 if(!turn||boundary(turn)||typeof turn.speaker!=='string'||!GENERIC_SPEAKER.test(turn.speaker.trim()))return turn?.speaker;
 return label(originalLanguage(turn))||turn.speaker;
}
/** The original-language classification is derived; both supplied wording fields are returned verbatim. */
export function pairingInfo(turn){
 const sourceLanguage=originalLanguage(turn);
 return {originalText:turn?.originalText,text:turn?.text,sourceLanguage,side:label(sourceLanguage)};
}
/** A detached display copy. No new fields, rewritten words or persisted speaker corrections. */
export function presentationSession(session){
 if(session===null||typeof session!=='object')return session;
 const shown=structuredClone(session);
 if(detectInterpretation(session)&&Array.isArray(shown.turns))for(const turn of shown.turns)if(turn&&typeof turn==='object'&&Object.hasOwn(turn,'speaker'))turn.speaker=sourceSide(turn);
 return shown;
}

export {boundary as isSourceBoundary};
