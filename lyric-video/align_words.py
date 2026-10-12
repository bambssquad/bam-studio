"""Snap word starts to vocal onsets inside each phrase window (monotonic DP), keeps phrase bounds.
usage: python align_words.py data/berbicara.mp3 data/lyrics.json"""
import json, sys, numpy as np, librosa, scipy.signal as ss
src, path = sys.argv[1], sys.argv[2]
y, sr = librosa.load(src, sr=22050, mono=False)
mid = y.mean(0) if y.ndim > 1 else y
side = (y[0] - y[1]) / 2 if y.ndim > 1 else 0 * mid
voc = mid - 0.6 * side                                 # centre-panned vocal emphasis
b, a = ss.butter(4, [250 / (sr / 2), 3500 / (sr / 2)], 'band'); voc = ss.filtfilt(b, a, voc)
hop = 220; env = librosa.onset.onset_strength(y=voc, sr=sr, hop_length=hop, aggregate=np.median)
on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, units='time', backtrack=True, delta=0.04)
strength = np.interp(on, librosa.frames_to_time(np.arange(len(env)), sr=sr, hop_length=hop), env)
lines = json.load(open(path)); moved = []
for l in lines:
    ws = l['words']; n = len(ws); lo, hi = l['start'] - 0.25, l['end']
    cand = [(t, s) for t, s in zip(on, strength) if lo <= t <= hi]
    if len(cand) < n: continue
    ct = np.array([c[0] for c in cand]); cs = np.array([c[1] for c in cand]); cs = cs / max(cs.max(), 1e-6)
    prior = np.array([w['s'] for w in ws])
    # DP: pick n increasing onsets maximising strength minus distance to syllable prior
    m = len(ct); INF = -1e9; D = np.full((n, m), INF); B = np.zeros((n, m), int)
    cost = lambda i, j: cs[j] - 1.6 * abs(ct[j] - prior[i]) if abs(ct[j] - prior[i]) <= 0.6 else INF
    for j in range(m): D[0, j] = cost(0, j)
    if (D[0] <= INF / 2).all(): continue
    for i in range(1, n):
        best, arg = INF, -1
        for j in range(m):
            if j > 0 and D[i - 1, j - 1] > best: best, arg = D[i - 1, j - 1], j - 1
            if arg >= 0 and ct[j] - ct[arg] >= 0.1 and cost(i, j) > INF / 2: D[i, j] = best + cost(i, j); B[i, j] = arg
    j = int(np.argmax(D[n - 1])); 
    if D[n - 1, j] <= INF / 2: continue
    pick = [0] * n
    for i in range(n - 1, -1, -1): pick[i] = j; j = B[i, j]
    new = [float(ct[k]) for k in pick]
    moved += [abs(a_ - b_) for a_, b_ in zip(new, prior)]
    for i, w in enumerate(ws):
        w['s'] = round(new[i], 2); w['e'] = round(new[i + 1] if i + 1 < n else max(l['end'], new[i] + 0.3), 2)
    l['start'] = ws[0]['s']
json.dump(lines, open(path, 'w'), ensure_ascii=False, indent=1)
print(f"onsets {len(on)} · words moved {len(moved)} · median shift {np.median(moved):.2f}s · max {np.max(moved):.2f}s")
