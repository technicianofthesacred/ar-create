import fs from 'node:fs';
import {currentActor,provenance} from './actor.mjs';
import path from 'node:path';
import {createTranscriptCorrections} from './transcript-corrections.mjs';
import {correctionRecoveryPage} from './transcript-correction-ui.mjs';
import {transcriptPage} from './recording-workshop.mjs';
import {loadTranslation} from './magazine/translation.mjs';
import { startLocalIntake, localJobs, publicJob, handleLocalRoute } from './magazine/jobs.mjs';
import { withIsolatedConfig } from './magazine/isolated-config.mjs';
import { atomicWrite, readJson, resolveInside, ensurePrivateDirectory, regular, digest } from './files.mjs';
import { StateError } from '../store.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {codexTranslationAvailable,TRANSLATION_MODEL} from './magazine/openai-translation.mjs';

/** Actual Magazine saved jobs and workshop, with no original config or writable proxy. */
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function createRecordings({ dataDir, library, transcriptionRuntime = null }) {
  const dir = ensurePrivateDirectory(dataDir, 'recordings');
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runtime');
  const python = transcriptionRuntime?.python || process.env.AR_CREATE_PYTHON || null;
  const config = { magFiles: dir, magVault: path.join(dir, 'vault'), magDrops: [], i64Export: { enabled: false }, reviewBaseUrl: '', conversationTimestamps: true, python, repoRoot, __file: path.join(dir, 'runner-config.json'), runtimeEnvironment: { PYTHONDONTWRITEBYTECODE: '1', HF_HOME: path.join(dir, 'models', 'huggingface'), HUGGINGFACE_HUB_CACHE: path.join(dir, 'models', 'huggingface', 'hub'), TORCH_HOME: path.join(dir, 'models', 'torch'), MAG_DIARIZATION_MODELS: path.join(dir, 'models', 'diarization'), XDG_CACHE_HOME: path.join(dir, 'cache'), PYANNOTE_METRICS_ENABLED: '0' } };
  // Only trusted host startup can supply an executable, never an HTTP request.
  if(transcriptionRuntime?.translation?.codexPath){if(typeof transcriptionRuntime.translation.codexPath!=='string'||!path.isAbsolute(transcriptionRuntime.translation.codexPath))throw new StateError('Codex translation must name an installed absolute executable.');config.translation={codexPath:transcriptionRuntime.translation.codexPath};}
  // Explicit host configuration may reuse already-installed model weights.
  // These directories are read by inference; outputs/caches stay in our storage.
  let modelProblem = null;
  for (const [option, names] of [['asrModelDirectory', ['config.json', 'weights.npz']], ['diarizationModelDirectory', ['sherpa-onnx-pyannote-segmentation-3-0/model.onnx', 'wespeaker_en_voxceleb_resnet34_LM.onnx']]]) {
    const folder = transcriptionRuntime?.[option];
    if (!folder) continue;
    if (typeof folder !== 'string' || !path.isAbsolute(folder)) throw new StateError('Cached transcription model directory must be an absolute path.');
    try {
      if (!fs.statSync(folder).isDirectory() || names.some(name => !fs.statSync(path.join(folder, name)).isFile())) modelProblem = 'Configured transcription models are incomplete. Reconnect the local model directory before starting a recording.';
    } catch (error) {
      if (!['ENOENT','ENOTDIR','EACCES'].includes(error.code)) throw error;
      modelProblem = 'Configured transcription models are unavailable. Reconnect the local model directory before starting a recording.';
    }
    config[option] = folder;
  }
  if (transcriptionRuntime?.diarizationEngine) {
    if (!['auto', 'community', 'sherpa'].includes(transcriptionRuntime.diarizationEngine)) throw new StateError('Unknown diarization engine.');
    config.diarizationEngine = transcriptionRuntime.diarizationEngine;
  }
  if (config.diarizationModelDirectory) config.runtimeEnvironment.MAG_DIARIZATION_MODELS = config.diarizationModelDirectory;
  if (transcriptionRuntime?.offline === true) {
    if (!config.asrModelDirectory || !config.diarizationModelDirectory || config.diarizationEngine !== 'sherpa') throw new StateError('Offline transcription requires complete local speech and sherpa speaker models.');
    Object.assign(config.runtimeEnvironment, { HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' });
  }
  ensurePrivateDirectory(dir, 'vault/Workflow/0-Inbox');
  ensurePrivateDirectory(dir, '.transcription-jobs');
  atomicWrite(config.__file, JSON.stringify(config));
  const linksFile = path.join(dir, 'source-links.json'); let links = readJson(linksFile, {});
  let ready = false, dependencies = null, problem = 'An isolated transcription interpreter is not configured.';
  if (python) {
    try {
      if (!path.isAbsolute(python) || !fs.statSync(python).isFile()) throw new Error('Python must name an installed interpreter.');
      dependencies = JSON.parse(execFileSync(python, ['-c', 'import importlib.util,json,shutil; print(json.dumps({**{n:importlib.util.find_spec(n) is not None for n in ["mlx_whisper","torch","pyannote","sherpa_onnx"]},"ffmpeg":bool(shutil.which("ffmpeg"))}))'], { timeout: 5000, cwd: repoRoot, env: { ...process.env, ...config.runtimeEnvironment }, encoding: 'utf8' }));
      // Explicit engines do not load the other diarizer. Auto keeps both the
      // Community path and its maintained Sherpa fallback available.
      const engine=config.diarizationEngine||'auto',required=['mlx_whisper','ffmpeg',...(engine==='sherpa'?['sherpa_onnx']:engine==='community'?['torch','pyannote']:['torch','pyannote','sherpa_onnx'])];
      ready = required.every(name=>dependencies?.[name]===true); problem = ready ? null : 'The isolated runner is missing transcription dependencies.';
    } catch (error) { problem = `The isolated runner is unavailable: ${error.message}`; }
  }
  if (modelProblem) { ready = false; problem = modelProblem; }
  const translationReady=codexTranslationAvailable(config);
  const translation={ready:translationReady,engine:'codex-chatgpt',model:TRANSLATION_MODEL,language:'en',status:translationReady?'available-on-explicit-start':'manual-only',verification:'Installed CLI only; account sign-in and permissions are checked by Codex on an explicit translation request.',problem:translationReady?null:'Codex is unavailable. Start it in the Command room or use a manual translation packet.'};
  const capability = { ready, engine: 'Magazine local intake/jobs/workshop/outputs', status: ready ? 'available-on-explicit-start' : 'saved-only', dependencies, problem, verification: ready ? config.asrModelDirectory ? 'Local speech and speaker models are configured. Recordings run only when you choose Start.' : 'Local runtime dependencies are installed. The first recording may require model downloads.' : 'Recordings can be retained; local transcription is not ready.', models: config.asrModelDirectory ? 'Explicit preinstalled model directories are read; outputs and scratch caches remain in ar-create-owned recording storage.' : 'Model caches and any downloads use ar-create-owned recording storage.', translation };
  const corrections=createTranscriptCorrections({dir,config});
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  async function input(req){let bytes='';for await(const chunk of req){bytes+=chunk;if(Buffer.byteLength(bytes)>2*1024*1024)throw new StateError('Request exceeds 2 MB.',413);}return bytes.trim()?JSON.parse(bytes):{};}
  return {
    // Magazine intake (magazine-vault/intake.mjs): transcribe one filed recording in this isolated
    // runner. Its RAW stays here until magazine-vault files it into the real Inbox under the lock.
    magazineIntake:{
      ready:()=>ready,
      start:(story,file)=>withIsolatedConfig(config,()=>startLocalIntake(story,file,{})),
      job:id=>withIsolatedConfig(config,()=>{const job=localJobs().find(j=>j.id===id);return job?{id:job.id,state:job.state,stage:job.stage,error:job.error||null,raw:job.raw||null,rawSha256:job.rawCandidateSha256||null,transcriptReady:!!job.transcriptReady}:null;}),
    },
    // Trusted in-process candidate reader. No request can supply an executable,
    // model directory, source file path, or alternate canonical job.
    candidateRuntime:()=>({ready:ready&&!!config.asrModelDirectory,problem:!ready?problem:!config.asrModelDirectory?'Reconnect the preinstalled local speech model before generating a candidate.':null,python:config.python,repoRoot:config.repoRoot,asrModelDirectory:config.asrModelDirectory||null,environment:{...config.runtimeEnvironment,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}}),
    captureCandidateAudio({jobId,expected}){const snapshot=corrections.peek(jobId);if(snapshot.external?.changed||JSON.stringify(Object.entries(snapshot.expected).sort())!==JSON.stringify(Object.entries(expected||{}).sort()))throw new StateError('Selected recording baseline changed.',409);const audioPath=resolveInside(dir,path.relative(dir,snapshot.provenance.audio));regular(audioPath);if(digest(fs.readFileSync(audioPath))!==snapshot.expected.audioHash)throw new StateError('Selected recording audio changed.',409);return {snapshot,audioPath};},
    transcriptCorrections:corrections,
    async registerSource(input={}) {
      if(currentActor()?.actor!=='human:adrian')throw new StateError('Using a recording transcript as Source requires the author.',403);
      if(!input||Object.keys(input).some(key=>!['jobId','expected','operationId'].includes(key))||!UUID.test(input.jobId||'')||!UUID.test(input.operationId||'')||!input.expected||typeof input.expected!=='object')throw new StateError('Choose one recording, its exact saved proof and an operation UUID.',400);
      const validate=()=>{const snapshot=corrections.peek(input.jobId),keys=object=>JSON.stringify(Object.entries(object||{}).sort(([a],[b])=>a.localeCompare(b)));if(snapshot.external?.changed||keys(snapshot.expected)!==keys(input.expected))throw new StateError('Recording transcript or audio changed. Open its current Source before using it.',409);return snapshot;};
      const snapshot=validate(),job=readJson(path.join(dir,'.transcription-jobs',input.jobId+'.json'),null);if(!job||job.id!==input.jobId||job.state!=='done'||job.transcriptReady!==true)throw new StateError('This recording transcript is not ready.',409);
      const file=resolveInside(dir,path.relative(dir,path.join(job.output,'transcript.md')));regular(file);
      const result=await library.registerRecordingSource({jobId:job.id,file,title:job.story||job.file||'Recording transcript',expected:snapshot.expected,operationId:input.operationId,validate,provenance:provenance()});return {...result,jobId:job.id,canonicalSourceChanged:false,reviewStatus:snapshot.reviewStatus};
    },

    sourceSnapshot:source=>corrections.sourceSnapshot(source),
    async readTranscriptSource(sourceId){const {source}=await library.blob(sourceId);const managed=corrections.sourceSnapshot(source);if(!managed.managed)throw new StateError('Choose this recording’s canonical transcript.',400);const snapshot=corrections.read(managed.jobId);return {...snapshot,sourceId};},
    async proposeTranscriptSource({sourceId,expected,corrections:changes,reason}){const selected=await this.readTranscriptSource(sourceId);return {...corrections.propose(selected.jobId,{expected,corrections:changes,reason}),sourceId};},
    async retain(source) {
      if (source.kind !== 'audio' || links[source.id]) return;
      const { file } = await library.blob(source.id);
      const id = withIsolatedConfig(config, () => startLocalIntake((source.title || source.name || 'Recording').replace(/[\/\\\r\n]/g, '-').slice(0, 120), file, { defer: true }));
      links[source.id] = id; atomicWrite(linksFile, JSON.stringify(links));
    },
    state(sourceId) {
      const id = links[sourceId]; if (!id) return null;
      try {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new StateError('Unknown recording.',404);
        const job = readJson(path.join(dir, '.transcription-jobs', `${id}.json`), null); if (!job) return null;
        let reviewStatus = 'unreviewed';
        if (job.transcriptReady) {
          if (typeof job.output !== 'string' || !path.isAbsolute(job.output)) throw new StateError('Invalid recording location.');
          const resultFile = resolveInside(dir, path.relative(dir, path.join(job.output, 'transcript.json')));
          const result = readJson(resultFile, null);
          if (result?.metadata?.review?.status === 'reviewed') {
            const snapshot = corrections.sourceSnapshot({rootId:'recordings',rel_path:path.relative(dir,path.join(job.output,'transcript.md')),path:path.join(job.output,'transcript.md')});
            if (snapshot.coherent) reviewStatus = 'reviewed';
          }
        }
        return {state:job.state,transcriptReady:Boolean(job.transcriptReady),reviewStatus};
      } catch {
        // One unavailable job must not disable the rest of the Library. Keep
        // the existing path guard; never infer a replacement recording root.
        return {state:'unavailable',transcriptReady:false,reviewStatus:'unreviewed',reason:'Saved transcript location is unavailable. Reconnect the recording or recover its saved files before use.'};
      }
    },
    async list() {
      // Reconcile physical renames without changing the original recording job ID.
      for (const [sourceId, id] of Object.entries(links)) {
        try {
          const { file } = await library.blob(sourceId); const jobFile = path.join(dir, '.transcription-jobs', `${id}.json`);
          const job = readJson(jobFile, null); if (job.state === 'saved' && job.source !== file) { job.source = file; atomicWrite(jobFile, JSON.stringify(job)); }
        } catch (error) { if (error.status !== 404) throw error; }
      }
      const jobs = withIsolatedConfig(config, () => localJobs().map(publicJob));
      return { capability, jobs: jobs.map(job => {const privateJob=readJson(path.join(dir,'.transcription-jobs',job.id+'.json'),null);const snapshot=privateJob?.output?corrections.sourceSnapshot({rootId:'recordings',rel_path:path.relative(dir,path.join(privateJob.output,'transcript.md')),path:path.join(privateJob.output,'transcript.md')}):null;return ({ ...job, ...(snapshot?.managed?{reviewStatus:snapshot.reviewStatus,transcriptNeedsInspection:!snapshot.coherent}:{}), sourceId: Object.keys(links).find(key => links[key] === job.id), url: `/transcription/${job.id}/view` });}) };
    },
    async route(req, res, url) {
      if (!url.pathname.startsWith('/transcription/')) return false;
      const guarded=url.pathname.match(/^\/transcription\/([a-f0-9-]{36})(?:\/(view|segment|speakers|review|save|snapshot|external-inspect|markdown-propose|recover|recovery|corrections|corrections\/[a-f0-9-]{36}(?:\/decision)?|transcript\.(?:md|json|txt)))?$/);
      if(guarded){
        const id=guarded[1],action=guarded[2]||'';
        try{
          if(req.method==='POST'){
            if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw new StateError('Not from this page.',403);
            const body=await input(req);let value;
            if(action==='segment')value=corrections.edit(id,{expected:body.expected,corrections:[{index:body.index,text:body.text,speaker:body.speaker||null}]});
            else if(action==='speakers')value=corrections.speakers(id,body);
            else if(action==='review')value=corrections.review(id,body);
            else if(action==='save')value=corrections.save(id,body);
            else if(action==='corrections')value=corrections.propose(id,body);
            else if(action==='markdown-propose')value=corrections.proposeMarkdown(id,body);
            else if(action==='external-inspect')value=corrections.inspectExternal(id,body.expected);
            else if(action==='recover')value=corrections.recover(id);
            else if(/^corrections\/[^/]+\/decision$/.test(action))value=corrections.decide(id,action.split('/')[1],body);
            if(value){const job=readJson(path.join(dir,'.transcription-jobs',id+'.json'),null);send(res,200,{...value,result:value.result,job:withIsolatedConfig(config,()=>publicJob(job))});return true;}
          }
          if(req.method==='GET'){
            if(action==='recovery'){send(res,200,corrections.recoveryInfo(id));return true;}
            const readOnly=action==='snapshot'&&url.searchParams.get('readOnly')==='1';
            if(action==='snapshot'&&([...url.searchParams.keys()].some(key=>key!=='readOnly')||url.searchParams.getAll('readOnly').length>1||url.searchParams.has('readOnly')&&!readOnly))throw new StateError('Choose the existing snapshot or its read-only inspection.',400);
            if(readOnly)regular(path.join(dir,'.transcription-jobs',id+'.json'));
            const statusJob=readJson(path.join(dir,'.transcription-jobs',id+'.json'),null);
            if(statusJob?.transcriptReady){
              if(/^corrections\/[^/]+$/.test(action)){send(res,200,corrections.inspect(id,action.split('/')[1]));return true;}
              const snapshot=readOnly?corrections.peek(id):corrections.read(id),job=readJson(path.join(dir,'.transcription-jobs',id+'.json'),null);
              if(action==='snapshot'){send(res,200,snapshot);return true;}
              if(action==='view'){const translated=url.searchParams.has('language')?loadTranslation(job,snapshot.result,url.searchParams.get('language')):null;res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(transcriptPage({...withIsolatedConfig(config,()=>publicJob(job)),translationAvailable:translation.ready,correctionSnapshot:snapshot},snapshot.result,translated));return true;}
              if(/^transcript\.(md|json|txt)$/.test(action)){const file=path.join(job.output,action);regular(file);res.writeHead(200,{'Content-Type':action.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(file));return true;}
              if(!action){send(res,200,{job:withIsolatedConfig(config,()=>publicJob(job)),result:snapshot.result,expected:snapshot.expected,external:snapshot.external});return true;}
            }
          }
        }catch(error){if(action==='view'&&req.method==='GET'){let info;try{info=corrections.recoveryInfo(id);}catch{}res.writeHead(error.status||409,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(correctionRecoveryPage(id,error.message,info));return true;}send(res,error.status||400,{error:error.message});return true;}
      }
      const raw=url.pathname.match(/^\/transcription\/([a-f0-9-]{36})\/raw\.md$/);
      if(raw&&req.method==='GET'){
        const jobsRoot=ensurePrivateDirectory(dir,'.transcription-jobs'),job=readJson(path.join(jobsRoot,`${raw[1]}.json`),null);
        if(!job||job.id!==raw[1]||typeof job.raw!=='string'||!path.isAbsolute(job.raw))throw new StateError('A retained machine RAW transcript is not available for this recording.',404);
        const rawRoot=resolveInside(dir,'vault/Workflow/0-Inbox',{directory:true}),file=resolveInside(rawRoot,path.relative(rawRoot,job.raw));regular(file);const bytes=fs.readFileSync(file);
        if(job.rawCandidateSha256&&digest(bytes)!==job.rawCandidateSha256)throw new StateError('The retained RAW bytes changed; this file requires review.',409);
        res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="machine-raw-${raw[1]}.md"`});res.end(bytes);return true;
      }
      if (req.method === 'POST') {
        if (/\/export-retry$/.test(url.pathname)) throw new StateError('External export providers are not enabled in ar-create.', 503);
        if (/\/translate$/.test(url.pathname)&&!translation.ready)throw new StateError(translation.problem,503);
        if (/\/(?:start|retry)$/.test(url.pathname) || url.pathname === '/transcription/join') { if (!capability.ready) throw new StateError(capability.problem, 503); }
        if (Number(req.headers['content-length']) > 2 * 1024 * 1024) throw new StateError('Request exceeds 2 MB.', 413);
      }
      const originalReader=url.pathname.match(/^\/transcription\/([a-f0-9-]{36})\/(?:translate|chatgpt-import|chatgpt\.json|translation-review|translation\.(?:md|txt|json)|bilingual\.md)$/);
      if(originalReader){const job=readJson(path.join(ensurePrivateDirectory(dir,'.transcription-jobs'),originalReader[1]+'.json'),null);if(!job||job.id!==originalReader[1])throw new StateError('Unknown recording.',404);if(job.state!=='done'||!job.transcriptReady)throw new StateError('Transcript is not ready.',400);const snap=corrections.read(originalReader[1]);if(snap.external.changed)throw new StateError('Inspect physical Markdown edits in the recording workshop first.',409);}
      await this.list();
      return withIsolatedConfig(config, () => handleLocalRoute(req, res, url));
    },
  };
}
