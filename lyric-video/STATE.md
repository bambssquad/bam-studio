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
- Bam pilih: lirik ditebak-koreksi Claude (review nanti), look paper-cut diorama, lirik mask slide-up, mode AUTO sampai MP4.
- Lirik terkoreksi: build_lyrics.py (GROUPS = waktu per frasa). Baris tidak pasti: "jalanan yang lebar", "menitip mimpi", "Deburan ombak berbisik", "Langit malam yang manis", "waktu yang tak jemu". Bagian 191-200 s & 37-47 s dibiarkan instrumental.
- Engine: src/world.js (9 scene pop-up, palet per waktu, orb matahari/bulan di tali), src/lyrics.js (strip kertas sobek, mask slide-up per baris + warna karaoke per kata), render.mjs (Playwright swiftshader → ffmpeg, worker paralel).
- Critique: r1 6.5 (lirik bolong/tumpuk, kertas flat, figur kecil) → r2 7.6 (bayangan orb di langit) → r3 8.1 pass.
- Web player: https://claude.ai/artifact/7fymR1Fx6W5rzoZc4PDuyt (privat). Build: vite build --outDir dist-web, lalu player.html (head/body di-strip).
- 2026-10-12: Bam koreksi lirik: 'meniti mimpi', 'Berjalan tanpa suara'. Referensi desain baru: YouTube mcHiJn7NgII (diblok di container) → menunggu screenshot dari Bam. Render v1 dihentikan (~30%, kena batas waktu background).
- 2026-10-12 v2: Bam upload referensi (_us__ Motion Graphics, 13.5 s) → ganti total ke flat 2D (style_guide.md). Lirik bold sans (Unbounded) di hitam, hard cut on-beat (verse 8 beat, reff 4, outro 16), 65 shot, motif dari kata kunci lirik. Karakter orisinal A (kuning/keriting/kacamata lime) & B (ungu/bob putih/anting merah).
- Engine v2: src/flat.js (Three.js ortho, scissor 1440 px atas). world.js/figures.js dihapus. Render ~0.2-0.6 s/frame.
- Critique v2: r1 6.8 (kontras bob putih, kartu keluar frame, motif kosong, label idle tumpuk) → r2 8.0 pass (+ fix label nomor terpotong).
