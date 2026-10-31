"""ASR over exact saved ranges; no speaker inference and no canonical writes."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from .adapters import MLXWhisperAdapter
from .pipeline import atomic_json


def process_candidate(manifest, *, asr_factory=MLXWhisperAdapter, extract=subprocess.run):
    manifest = Path(manifest).resolve()
    request = json.loads(manifest.read_text())
    runtime, capture = request['runtime'], request['capture']
    model = Path(runtime['asrModelDirectory'])
    if not model.is_absolute() or not all((model / name).is_file() for name in ['config.json', 'weights.npz']):
        raise ValueError('Preinstalled speech model is unavailable')
    if os.environ.get('HF_HUB_OFFLINE') != '1' or os.environ.get('TRANSFORMERS_OFFLINE') != '1':
        raise ValueError('Offline inference is required')
    asr = asr_factory(str(model), speech_gating=False)
    segments = []
    for original in capture['segments']:
        with tempfile.TemporaryDirectory(prefix='audio-', dir=manifest.parent) as scratch:
            clip = Path(scratch) / 'selected.wav'
            extract(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe',
                     '-ss', str(original['start']), '-i', capture['audioPath'], '-t', str(original['end'] - original['start']),
                     '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', str(clip)],
                    check=True, capture_output=True, timeout=120)
            decoded = asr.transcribe(clip, language=None, prompt=None, progress=lambda event: None)
            rows = decoded.get('segments', [])
            text = ' '.join(' '.join(str(row.get('text', '')).split()) for row in rows).strip()
            if not text or len(text) > 12000:
                raise ValueError('Selected audio returned no bounded speech candidate')
            issues = []
            if any(row.get('confidence_unavailable') or 'avg_logprob' not in row for row in rows):
                issues.append('Decoder confidence unavailable; listen to verify.')
            if any(row.get('avg_logprob', 0) < -1 or row.get('no_speech_prob', 0) > .6 for row in rows):
                issues.append('Low-confidence speech; listen to verify.')
            if any(row.get('compression_ratio', 0) > 2.4 for row in rows):
                issues.append('Decoder reports repetition; listen to verify.')
            segments.append({key: original[key] for key in ['index', 'start', 'end', 'speaker']} |
                            {'text': text, 'uncertainty': ' '.join(issues)})
    candidate = {'id': request['id'], 'jobId': capture['jobId'], 'sourceAudioHash': capture['expected']['audioHash'],
                 'baselineRevision': capture['expected']['revision'], 'segments': segments,
                 'engine': 'local-mlx-whisper-selected-audio', 'actor': request['startedBy']}
    if 'sourceId' in capture:
        candidate['sourceId'] = capture['sourceId']
    atomic_json(manifest.parent / 'candidate.json', candidate)
    return candidate


if __name__ == '__main__':
    try:
        process_candidate(sys.argv[1])
    except Exception as error:
        print('Local candidate failed (' + type(error).__name__ + ').', file=sys.stderr)
        sys.exit(1)
