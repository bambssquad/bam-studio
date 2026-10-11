# Lyric video "Berbicara" — state

## PARAMS (terkunci)
- Format 9:16, 1080x1920, 30 fps. Durasi 219.0 s. BPM 112.3 (librosa), 380 beat.
- Gaya: 3D WebGL (Three.js) ilustrasi sesuai lirik + lirik motion graphic di bawah.
- Output: web player (audio) + MP4. Engine: seek(t) deterministik + Playwright + ffmpeg (doktrin bam-motiondesign).
- Lagu ciptaan Bam (transkripsi diizinkan). Audio tidak di-commit (.gitignore).

## Keputusan / log
- 2026-10-11: Referensi tweet chetaslua tidak bisa diakses (x.com diblok proxy); gaya diambil dari jawaban Bam.
- HF diblok → Whisper-medium int8 via sherpa-onnx (GitHub release). Hasil: 20 segmen VAD, banyak salah dengar + halusinasi di instrumental. Perlu koreksi lirik.
- Section (librosa): 0, 8.3, 60.6, 71.7, 84.8, 136.9, 175.3, 191.2, 200.9, 213.8. Energi puncak ~110-135 s, drop 140-165 s, outro 200 s+.
