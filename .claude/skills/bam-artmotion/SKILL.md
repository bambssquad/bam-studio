---
name: bam-artmotion
description: Animasi seni & explainer via kode (35 gaya seni, 9 grammar explainer, musik BPM sintesis, QA + review independen + gate delivery) di atas huashu-art-motion. Pakai saat Bam minta animasi gaya Van Gogh/Monet/Bauhaus/Ghibli/8-bit dll, explainer 3b1b/Vox/Kurzgesagt/whiteboard/kinetic type/finance chart, recreate animasi referensi, atau film "time travel" lintas gaya.
---

# bam-artmotion

Wrapper workflow Bam untuk skill `huashu-art-motion` (MIT, alchaincyf, commit e47f792). Docs asli berbahasa Mandarin di `.claude/skills/huashu-art-motion/` — baca, tapi bicara ke Bam dalam Bahasa Indonesia ringkas. `SK=.claude/skills/huashu-art-motion`.

## 0. Cek environment (wajib, sekali per sesi)
- `uv`, `ffmpeg`, Chromium di `/opt/pw-browsers`.
- **Pin Playwright**: `uv run --with playwright==1.56.0 ...` (cocok chromium-1194). Versi lain → error "playwright install". Jangan `playwright install`.
- `export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.
- Render 1 detik 1080p gaya berat (Van Gogh) ≈ 15–20 detik CPU.

## 1. Clarify (pilihan ganda, maks 4 pertanyaan)
Topik, audiens, orientasi (16:9 / 9:16 / 1:1), durasi, musik (ya/tidak), ada orang (lihat langkah 4).

## 2. Tiga arah gaya (hard gate)
- Pilih 3 gaya dari **material layer** di `$SK/references/风格配方/INDEX.md`, utamakan ★★★ (09_postimp, 13_pop, 14_8bit, 26_vaporwave, 30_matisse, 16_2026, 22_constructivism, 12_bauhaus, 04_roman).
- Komposisi baru untuk subjek Bam, beda satu sama lain — **jangan salin ruangan kucing+gadis dari sampel**.
- Render 1 still per arah: `render.py --solo <id> --stills 1.5 --out 渲染/<id>`; kirim ke Bam, tunggu pilihan.

## 3. Produksi
- Tulis shot list dulu (`$SK/references/镜头表模板.md`): lock gaya + palet (`色板.md`, tanpa biru-ungu) + karakter. Lint: `uv run $SK/scripts/storyboard_lint.py <proj>/镜头表.md`.
- `cp -R $SK/scripts/engine <proj>/代码工程`, tulis `scenes/<id>.js`, daftarkan di `eras.js`.
- Tiap scene: 1 aksi utama + 2 motif loop dari kartu gaya (mis. Van Gogh: langit berpusar + halo lampu meluas).
- Musik: sintesis BPM dari `$SK/references/05-节奏与配乐.md`, gerak dikunci ke beat.
- Kamera: diam saat jelas, push pelan untuk transisi, snap hanya untuk aksen; jangan 3 push-in berturut.

## 4. Orang di layar — tanya dulu
Pilihan: (a) art karakter milik Bam, (b) frame dari image model (Higgsfield MCP tersedia), (c) hanya tangan / figur dari belakang. Kode tidak menggambar wajah/robot.

## 5. QA & delivery (urut, red = render ulang)
1. `uv run $SK/scripts/qa.py --project <proj>/代码工程 --ids <ids> --out <proj>/qa/scenes`
2. Spawn subagent yang **tidak ikut produksi**, hanya menonton film jadi (ekstrak frame via ffmpeg), tulis temuan ke `<proj>/审片/review.md`.
3. `uv run $SK/scripts/deliver.py 成片.mp4 --root <proj> --qa <proj>/qa/... --out output/`
   Gate merah: gerak cepat <3.5%, frame kosong ≥0.3 dtk di tengah, latar biru-ungu >30%.
4. Cek manual 6 kegagalan umum (SKILL asli): PPT-style, salin sampel, tanpa objek konkret, latar mati, kode menggambar padahal ada materi asli, AI-slop.

## Log
- 2026-10-13: diinstal & smoke-test OK — 09_postimp still + klip 3 dtk, film_gate lulus (gerak cepat 8.6%).
