"""English draft from audio using the installed upstream MLX Whisper decoder.

Source turns define clip boundaries and identity, not translation truth. Short
clips can lose context; every result requires audio-backed human review.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from .adapters import DEFAULT_MODEL


def clip_bounds(segment, frames, rate):
    start, end = float(segment['start']), float(segment['end'])
    if not all(math.isfinite(v) for v in (start, end)) or start < 0 or end < start:
        raise ValueError('Invalid source clip timestamps')
    left, right = round(start * rate), min(frames, round(end * rate))
    if left > right or left > frames:
        raise ValueError('Source clip is outside the recording')
    return left, right


def atomic_json(file, value):
    file = Path(file)
    temporary = file.with_suffix(file.suffix + '.part')
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False))
    temporary.replace(file)


def translate(request, output, decoder=None):
    import soundfile as sf
    if decoder is None:
        import mlx_whisper
        decoder = mlx_whisper.transcribe
    cache_file = Path(request['cache'])
    try:
        audio, rate = sf.read(request['audio'], dtype='float32', always_2d=True)
    except (RuntimeError, sf.LibsndfileError):
        audio, rate = None, None
    if rate != 16000 or audio is None or audio.shape[1] != 1:
        # Reuse the transcription pipeline's ffmpeg normalization for M4A/video.
        from .pipeline import normalize
        normalized = cache_file.parent / 'translation-audio.wav'
        normalize(Path(request['audio']), normalized)
        audio, rate = sf.read(normalized, dtype='float32', always_2d=True)
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    candidates = []
    for index, segment in enumerate(request['segments']):
        left, right = clip_bounds(segment, len(audio), rate)
        key = hashlib.sha256(json.dumps([request['sourceDigest'], request.get('model', DEFAULT_MODEL), request.get('glossary', ''), index, segment], sort_keys=True).encode()).hexdigest()
        candidate = cache.get(key)
        if candidate is None:
            result = decoder(audio[left:right, 0], path_or_hf_repo=request.get('model', DEFAULT_MODEL),
                             task='translate', language=None, word_timestamps=False,
                             initial_prompt=request.get('glossary') or None,
                             condition_on_previous_text=False, verbose=False) if right > left else {'text': '', 'segments': []}
            candidate = {'text': result.get('text', '').strip(), 'detectedLanguage': result.get('language'),
                         'flags': ['Audio translation draft; listen to confirm wording and clip context']}
            if not candidate['text']:
                candidate['flags'].append('Missing translation')
            if any(s.get('compression_ratio', 0) > 2.4 or s.get('avg_logprob', 0) < -1 for s in result.get('segments', [])):
                candidate['flags'].append('Uncertain audio decoding')
            cache[key] = candidate
            atomic_json(cache_file, cache)
        candidates.append(candidate)
        print(json.dumps({'completed': index + 1, 'total': len(request['segments'])}), flush=True)
    atomic_json(output, candidates)
    return candidates


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--request', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    translate(json.loads(Path(args.request).read_text()), args.output)
