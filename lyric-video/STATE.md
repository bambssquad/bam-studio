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
- v2 MP4 selesai: out/berbicara.mp4 (1080x1920, 30 fps, 219 s, h264+aac, 85.7 MB, 6570 frame, render 19.6 min). Decode check OK. Web player v2 di URL artifact yang sama (version 2).
- 2026-10-12 v3 polish ("ga keliatan AI"): IG reel (3 link) tidak bisa diakses — www.instagram.com/scontent.cdninstagram.com diblok network policy; Bam perlu buka di Network access environment. Belum ada isi reel yang dipakai.
- align_words.py: start kata di-snap ke onset vokal (DP monoton, geser ≤0.6 s): 101 kata, median 0.09 s.
- flat.js: motion blur sub-frame (shutter 180°, 4 sampel; 10 sampel di 0.36 s awal cut), grain di display space (12 fps), push/whip antar section 0.26 s (shot baru tidak animasi masuk sendiri saat push), spring overshoot untuk slide-in, boil dikunci ke frame time. Lirik: kata masuk blur→tajam. Player live tanpa sub-frame.
- Bug ditemukan & diperbaiki: grain di ruang linear (warna kusam), autoClear menghapus akumulasi (energi 1/4), nama still 1 desimal saling timpa.
- 2026-10-12 v4 transisi (permintaan Bam: transisi unik & saling menyambung): yt-dlp juga ditolak proxy (403) untuk 3 reel IG + YouTube → belum dipakai.
- Semua 64 cut sekarang transisi yang tumbuh dari anchor shot sebelumnya, titik tengah = beat: pupil zoom (close→, 12), heart iris (duo/heart→, 18), star iris (rays/title→, 7), card colour block (cards→, 9), circle iris + rim aksen (motif→, 8), bands (walk→, 1), section: slash 3 warna (5) / whip push (4). Shader komposit A/B per sub-frame (motion blur tetap). Shot clock lead = d/2+0.3 s supaya isi sudah ada saat reveal.
- Render v4 pertama gagal (screenshot timeout, 0.4 fps: 4 page berbagi 1 GPU process SwiftShader, MSAA+HalfFloat RT). Fix: browser per worker, timeout 180 s, RT 8-bit sRGB tanpa MSAA + jitter Halton sub-pixel (AA dari sampel blur), sampel 3 normal / 6 transisi. Frame normal 4.2→1.6 s, transisi 9.9→2.0 s; warna terverifikasi sama.
