import json, sys, numpy as np, librosa
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
bt = librosa.frames_to_time(beats, sr=sr)
hop = 735  # 30 fps at 22050
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
f = librosa.fft_frequencies(sr=sr, n_fft=2048)
band = lambda lo, hi: S[(f >= lo) & (f < hi)].mean(0)
bass, mid, high = band(20, 160), band(160, 2000), band(2000, 8000)
on = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
nz = lambda a: np.round(a / (np.percentile(a, 99) + 1e-9), 3).clip(0, 1.5).tolist()
# section boundaries via agglomerative clustering on chroma+mfcc
feat = np.vstack([librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=2048), librosa.feature.mfcc(y=y, sr=sr, hop_length=2048, n_mfcc=13)])
bd = librosa.segment.agglomerative(feat, 10)
secs = np.round(librosa.frames_to_time(bd, sr=sr, hop_length=2048), 2).tolist()
out = dict(fps=30, duration=round(len(y) / sr, 2), bpm=round(float(np.atleast_1d(tempo)[0]), 1), beats=np.round(bt, 3).tolist(),
           sections=secs, rms=nz(rms), bass=nz(bass), mid=nz(mid), high=nz(high), onset=nz(on))
json.dump(out, open(sys.argv[2], "w"))
print("bpm", out["bpm"], "beats", len(bt), "dur", out["duration"], "sections", secs)
r = np.array(out["rms"]); 
for i in range(0, len(r), 300): print(f"{i/30:5.0f}s energy {r[i:i+300].mean():.2f}")
