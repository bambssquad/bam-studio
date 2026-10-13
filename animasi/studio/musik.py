#!/usr/bin/env python3
"""Studio Bam — 15 s score, pure code synthesis. 96 BPM (beat 0.625 s), 8 beats per shot, F major.
Shot 1 (0–5): plucked arpeggio (pencil). Shot 2 (5–10): + string pad + soft kick (house grows).
Shot 3 (10–15): chimes on window lights (beats 1,2,3), sign letters ticks, bell on hat tip (13.3 s), final chord.
Run: uv run --with numpy --with soundfile python musik.py
"""
import numpy as np, soundfile as sf
from pathlib import Path

SR, DUR, B = 48000, 15.0, 0.625
N = int(SR * DUR); L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(3)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

def add(sig, t, g=1.0, pan=0.0):
    s = int(t * SR)
    if s >= N: return
    sig = sig[: N - s] * g; a = (pan + 1) * np.pi / 4
    L[s:s + len(sig)] += sig * np.cos(a); R[s:s + len(sig)] += sig * np.sin(a)

def pluck(f, d=1.2):                      # Karplus-Strong
    n = int(SR * d); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out

def pad(f, d):
    t = np.arange(int(SR * d)) / SR; env = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.5)
    s = sum(np.sin(2 * np.pi * f * (1 + dt) * t + ph) for dt, ph in [(-0.004, 0), (0, 1), (0.004, 2)]) / 3
    return s * env * 0.5

def bell(f, d=2.0):
    t = np.arange(int(SR * d)) / SR
    return sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * dc) for k, a, dc in [(1, 1, 2.5), (2.76, 0.4, 4), (5.4, 0.2, 6)])

def kick():
    t = np.arange(int(SR * 0.35)) / SR; f = 50 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

def tick():
    t = np.arange(int(SR * 0.05)) / SR
    return rng.uniform(-1, 1, len(t)) * np.exp(-t * 120)

# chords per 2 beats: F  Dm  Bb  C  (repeat)
CH = [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55]]
for bar in range(12):                           # 12 × 2 beats = 24 beats = 15 s
    ch = CH[bar % 4]; t0 = bar * 2 * B
    for i, m in enumerate([ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24]):   # arpeggio eighths
        add(pluck(hz(m)), t0 + i * B / 2, 0.32, -0.3 + 0.2 * i)
    if bar >= 4:                                # shot 2+: pad + kick
        for m in ch: add(pad(hz(m), 2 * B + 0.3), t0, 0.22, 0)
        add(kick(), t0, 0.6); add(kick(), t0 + B, 0.45)
    if bar >= 8:                                # shot 3: bass pluck
        add(pluck(hz(ch[0] - 12), 1.0), t0, 0.5)
for k in (1, 2, 3):                             # window lights on beats of shot 3
    add(bell(hz(81 + [0, 3, 7][k - 1])), 10 + k * B, 0.35, [-0.4, 0, 0.4][k - 1])
for i in range(10):                             # sign letters painted (2B..5B of shot 3)
    add(tick(), 10 + 2 * B + i * 3 * B / 10, 0.15, 0.5)
add(bell(hz(89), 2.5), 13.3, 0.4)               # hat tip
for m in (65, 69, 72, 77): add(pad(hz(m), 1.6), 13.4, 0.25)

mix = np.stack([L, R], 1); mix /= np.max(np.abs(mix)) / 0.89
fade = np.minimum(1, (N - np.arange(N)) / (SR * 0.4))[:, None]
sf.write(Path(__file__).with_name('musik.wav'), mix * fade, SR)
print('musik.wav', DUR, 's')
