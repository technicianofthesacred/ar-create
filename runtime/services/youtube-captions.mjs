// Adapted directly from i64os capture/extractors/youtube.ts.
// Original metadata and serial yt-dlp gate retained; captions now retain exact VTT + timestamps.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export function youtubeCapability(executable = process.env.AR_CREATE_YT_DLP || null) { try { const version = execFileSync(executable, ['--ignore-config', '--version'], {encoding:'utf8',timeout:3000}).trim(); return { ready: true, executable, version, backend: 'copied-i64os-yt-dlp', verification: 'Executable version only; no user video requested.' }; } catch { return { ready: false, executable, problem: 'yt-dlp is unavailable; set AR_CREATE_YT_DLP to an installed executable.' }; } }
// execFile's message begins with the entire command and warnings. Keep the cause
// from stderr first so a short UI diagnostic still explains what needs attention.
function extractionDiagnostic(error,max=500){
 const lines=String(error.stderr||error.message||error).replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const causes=lines.filter(line=>/^ERROR:/i.test(line));
 const useful=causes.length?causes:lines.filter(line=>!/^WARNING:|^\[|^Command failed:|^It is strongly recommended|^You installed|^To suppress/i.test(line));
 const cause=(useful.length?useful.join(' '):error.killed?'yt-dlp request timed out':error.code?`yt-dlp failed (${error.code})`:String(error.message||error));
 return cause.length>max?cause.slice(0,max-1)+'…':cause;
}
export function parseVtt(vtt                           )         {
  if (!vtt || typeof vtt !== 'string') return '';
  const lines = vtt.split('\n');
  const textLines           = [];
  let prev = '';

  for (const line of lines) {
    const l = line.trim();
    // Skip WEBVTT header, blank lines, cue timing lines (-->), and NOTE blocks
    if (!l || l.startsWith('WEBVTT') || l.includes('-->') || l.startsWith('NOTE') || /^\d+$/.test(l)) {
      continue;
    }
    // Strip VTT tags like <00:00:00.000><c> and </c>
    const clean = l.replace(/<[^>]+>/g, '').trim();
    if (!clean || clean === prev) continue;
    textLines.push(clean);
    prev = clean;
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}
export function createYouTubeCaptions(options) {
const YT_DLP_TIMEOUT_MS = 90_000; // 90 s — network + metadata fetch
const LIST_CHANNEL_UPLOADS_TIMEOUT_MS = 60_000; // 60 s — per the reading-pull brief

// ---------------------------------------------------------------------------
// The one serial door every yt-dlp process spawn goes through.
//
// fetchMetadata, fetchTranscript, resolveChannel, and listChannelUploads all
// call runYtDlp() below — there is exactly one gate, and nothing outside this
// file spawns yt-dlp directly. Concurrency is 1 (calls are chained, never
// parallel) and at least YT_DLP_MIN_GAP_MS elapses between the END of one
// process and the START of the next, so a channel-follow poll running
// alongside a manual paste can never trip YouTube's bot detection by hammering
// it with concurrent/back-to-back requests.
// ---------------------------------------------------------------------------
const YT_DLP_MIN_GAP_MS = 4_000;

function sleep(ms        )                {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

                           
                 
                 
 

                                                                                  

const realYtDlpSpawn             = (args, timeoutMs) =>
  execFileAsync(options.executable, ['--ignore-config', '--no-cache-dir', ...args], {
    timeout: timeoutMs,
    env: { ...process.env, PYTHONWARNINGS: 'ignore', PYTHONDONTWRITEBYTECODE: '1' }, cwd: options.workDir, maxBuffer: 4 * 1024 * 1024,
  });

let ytDlpSpawn             = options.spawn || realYtDlpSpawn;
let ytDlpChain                = Promise.resolve();
let ytDlpLastFinishedAt = 0;

/** Test-only: swap the underlying process spawn (e.g. a mock) and/or reset
 *  the gate's shared timing state between test files. Pass null to restore
 *  the real yt-dlp spawn. */
function __setYtDlpSpawnForTests(fn                   )       {
  ytDlpSpawn = fn ?? realYtDlpSpawn;
  ytDlpChain = Promise.resolve();
  ytDlpLastFinishedAt = 0;
}

async function runYtDlp(args          , timeoutMs        )                           {
  const previous = ytDlpChain;
  let release             = () => {};
  ytDlpChain = new Promise      ((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    const waitMs =
      ytDlpLastFinishedAt === 0
        ? 0
        : Math.max(0, (options.minGapMs ?? YT_DLP_MIN_GAP_MS) - (Date.now() - ytDlpLastFinishedAt));
    if (waitMs > 0) await sleep(waitMs);
    return await ytDlpSpawn(args, timeoutMs);
  } finally {
    ytDlpLastFinishedAt = Date.now();
    release();
  }
}

// ---------------------------------------------------------------------------
                           
                
                  
                                                     
                                  
                      
                                                                        
                                                                              
                              
                               
                                                                           
                                                                            
                                                
                            
                             
                                                                          
                                                       
                        
 

/**
 * oEmbed fallback for when yt-dlp is blocked (YouTube bot-detection on
 * datacenter IPs). Returns title + channel + thumbnail; duration/description/
 * publish date are unavailable from oEmbed and stay blank/null.
 */
async function fetchMetadataOEmbed(url        )                                  {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json())     
                     
                           
                             
     ;
    if (!data.title) return null;
    return {
      title: data.title,
      channel: data.author_name ?? 'Unknown Channel',
      duration: 'Unknown',
      duration_seconds: null,
      description: '',
      published_at: null,
      thumbnail_url: data.thumbnail_url ?? null,
      // oEmbed has no channel identity fields at all.
      channel_id: null,
      channel_url: null,
      handle: null,
    };
  } catch {
    return null;
  }
}

/** Optional cookies file unlocks yt-dlp on bot-blocked IPs. */
function ytCookiesArg()           {
  return []; // Original cookies/configuration are never read.
}

async function fetchMetadata(url        )                           {
  const jsonArgs = [
    '--no-playlist',
    '--dump-single-json',
    '--skip-download',
    ...ytCookiesArg(),
    url,
  ];

  let data                         ;
  try {
    const { stdout } = await runYtDlp(jsonArgs, YT_DLP_TIMEOUT_MS);
    data = JSON.parse(stdout.trim())                           ;
  } catch (err) {
    // Bot-blocked or stale yt-dlp: fall back to oEmbed so a clip still
    // produces a real card (title/channel) instead of failing the capture.
    const fallback = options.allowOEmbed === false ? null : await fetchMetadataOEmbed(url);
    if (fallback) return fallback;
    throw new Error(`yt-dlp metadata failed: ${extractionDiagnostic(err,500)}`);
  }

  const title = String(data.title ?? 'Unknown Title');
  const channel = String(
    data.channel ?? data.uploader ?? data.uploader_id ?? 'Unknown Channel',
  );
  const rawDuration = Number(data.duration ?? 0);
  const minutes = Math.floor(rawDuration / 60);
  const seconds = rawDuration % 60;
  const duration =
    rawDuration > 0
      ? `${minutes}:${String(seconds).padStart(2, '0')}`
      : 'Unknown';
  const durationSeconds = rawDuration > 0 ? Math.round(rawDuration) : null;
  const description = String(data.description ?? '').slice(0, 2000);

  // yt-dlp's upload_date is YYYYMMDD; reshape to ISO YYYY-MM-DD so it reads
  // as a real date everywhere else in the system (surfaces, sort, filter).
  const rawUploadDate = typeof data.upload_date === 'string' ? data.upload_date : null;
  const publishedAt =
    rawUploadDate && /^\d{8}$/.test(rawUploadDate)
      ? `${rawUploadDate.slice(0, 4)}-${rawUploadDate.slice(4, 6)}-${rawUploadDate.slice(6, 8)}`
      : null;

  const thumbnailUrl =
    typeof data.thumbnail === 'string' && data.thumbnail ? data.thumbnail : null;

  const channelId =
    typeof data.channel_id === 'string' && data.channel_id ? data.channel_id : null;
  const channelUrl =
    typeof data.channel_url === 'string' && data.channel_url ? data.channel_url : null;
  const uploaderId = typeof data.uploader_id === 'string' ? data.uploader_id : null;
  const handle = uploaderId && uploaderId.startsWith('@') ? uploaderId : null;

  return {
    title,
    channel,
    duration,
    duration_seconds: durationSeconds,
    description,
    published_at: publishedAt,
    thumbnail_url: thumbnailUrl,
    channel_id: channelId,
    channel_url: channelUrl,
    handle,
  };
}


return { async extract(url) {
 const metadata = await fetchMetadata(url);
 const folder = fs.mkdtempSync(path.join(options.workDir, 'captions-'));
 let rawVtt = null, rawFiles = [], captionError = null;
 try {
  try {await runYtDlp(['--no-playlist','--skip-download','--write-subs','--write-auto-subs','--sub-format','vtt','--sub-langs','en.*,zh.*,id.*,tr.*','-o',path.join(folder,'video.%(ext)s'),url],YT_DLP_TIMEOUT_MS);}
  catch(error){captionError=extractionDiagnostic(error);}
  // A later language may fail after an earlier track completed. Completed VTT
  // files remain real evidence; .part downloads never count as transcripts.
  const names = fs.readdirSync(folder).filter(name => name.endsWith('.vtt')).sort((a,b)=>Number(!a.includes('.en.'))-Number(!b.includes('.en.')) || a.localeCompare(b));
  rawFiles = names.map(name => { const file=path.join(folder,name);if(fs.statSync(file).size>4*1024*1024)throw new Error('Caption track exceeds the 4 MB extraction limit.');return { name, content: fs.readFileSync(file,'utf8') }; });
  rawVtt = rawFiles.find(file=>parseVttSegments(file.content).length)?.content || null;
  if(!rawVtt&&!captionError)captionError=rawFiles.length?'Caption tracks contained no readable timestamped cues.':'No caption tracks were returned.';
 } catch (error) { captionError = extractionDiagnostic(error); }
 finally { fs.rmSync(folder,{recursive:true,force:true}); }
 const segments = rawVtt ? parseVttSegments(rawVtt) : [];
 return { ...metadata, videoId: new URL(url).searchParams.get('v') || new URL(url).pathname.split('/').filter(Boolean).at(-1), rawFiles, rawVtt, segments, text: rawVtt ? parseVtt(rawVtt) : '', captionError, hasTranscript: segments.length > 0 };
}};
}
export function parseVttSegments(raw) {
 const segments=[]; const blocks=String(raw).replace(/\r/g,'').split(/\n\s*\n/);
 const seconds=t=>t.split(':').reduce((sum,part)=>sum*60+Number(part),0);
 for(const block of blocks) { const lines=block.split('\n'); const i=lines.findIndex(line=>line.includes('-->')); if(i<0) continue; const timing=lines[i].match(/([\d:.]+)\s+-->\s+([\d:.]+)/); if(!timing) continue; const text=parseVtt(lines.slice(i+1).join('\n')); const start=seconds(timing[1]),end=seconds(timing[2]); if(text&&Number.isFinite(start)&&Number.isFinite(end)&&end>=start) segments.push({start,end,text}); }
 return segments;
}
