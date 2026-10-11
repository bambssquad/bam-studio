"""Transcribe a song into timed lyric lines (sherpa-onnx Whisper + Silero VAD).

usage: python transcribe.py <audio> <out.json> <model_dir>
Word timings inside a VAD segment are spread by vowel-group (syllable) count;
fix any line by hand in lyrics.json afterwards.
"""
import json, re, subprocess, sys
import numpy as np
import sherpa_onnx

src, out, md = sys.argv[1], sys.argv[2], sys.argv[3]
SR = 16000
pcm = subprocess.run(["ffmpeg", "-v", "quiet", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)

rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=f"{md}/medium-encoder.int8.onnx", decoder=f"{md}/medium-decoder.int8.onnx",
    tokens=f"{md}/medium-tokens.txt", language="id", task="transcribe", num_threads=4)

cfg = sherpa_onnx.VadModelConfig()
cfg.silero_vad.model = f"{md}/../silero_vad.onnx"
cfg.silero_vad.threshold = 0.35
cfg.silero_vad.min_silence_duration = 0.35
cfg.silero_vad.min_speech_duration = 0.4
cfg.silero_vad.max_speech_duration = 9
cfg.sample_rate = SR
vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=240)

segs = []
def drain():
    while not vad.empty():
        s = vad.front
        segs.append((s.start / SR, np.array(s.samples, dtype=np.float32)))
        vad.pop()
win = cfg.silero_vad.window_size
for i in range(0, len(audio), win):
    vad.accept_waveform(audio[i:i + win]); drain()
vad.flush(); drain()

syl = lambda w: max(1, len(re.findall(r"[aiueoy]+", w.lower())))
lines = []
for st, samples in segs:
    s = rec.create_stream(); s.accept_waveform(SR, samples); rec.decode_stream(s)
    text = s.result.text.strip()
    if not text or re.fullmatch(r"[\W\d]*|.*(terima kasih|subtitle|musik).*", text.lower()):
        continue
    dur = len(samples) / SR
    words = text.split()
    w8 = np.array([syl(w) for w in words], float); edges = np.concatenate([[0], np.cumsum(w8)]) / w8.sum() * dur
    lines.append({"start": round(st, 2), "end": round(st + dur, 2), "text": text,
                  "words": [{"w": w, "s": round(st + edges[k], 2), "e": round(st + edges[k + 1], 2)} for k, w in enumerate(words)]})
    print(f"{st:6.1f}-{st + dur:6.1f} {len(words):2d} words", flush=True)
json.dump(lines, open(out, "w"), ensure_ascii=False, indent=1)
print("lines", len(lines))
