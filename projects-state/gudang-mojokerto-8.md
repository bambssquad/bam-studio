# GUDANG MOJOKERTO 8 — ptsap-to-web state
Sumber: GDJS_CONCEPT_R3.pdf (Archicad, 23 lembar A3, Nov 2026). Template: bam-studio/public/gudang-makassar.
## Keputusan (2026-11-09)
- Versi: V1 = Tahap 1, V2 = Tahap 1 + Tahap 2. Kop: PT Selaras Adhi Perkasa. Rilis: GitHub (public/gudang-mojokerto-8) + artifact.
- Lokasi: -7.3904568, 112.4712474 (dari link Maps Bam).
- Grafis: mode sinematik ala UE5 (Bam minta "UE 5.8 + DLSS 5, pakai caramu").
## PARAMS draft (meter; origin = tengah Tahap 1; -z = depan/sisi A/jalan; x = arah grid 2→19)
- Grid x: 2=-54,1=-48,3=-42,4=-36 … 18=48,19=54 (@6). Grid z: A=-30 … F=0 … K=+30 (@6).
- T1: sisi A–F x -54..54 (108), sisi F–K x -54..48 (102). Twin gable, bentang 30+30, ridge sejajar x di z=-15 & +15, lembah di F.
- eave/roof floor +9.5; ridge T1 ≈ +13.7 (DIUKUR dari skala potongan A-A & tampak 1-1, label tak ada); +15.1 = puncak ventilator; lantai 2 kantor +6.0; FFL ±0.0; jalan -0.2.
- Kolom HB 300×300 zincromate, pedestal +1.5 m (besi 16, ring 10, K350); rafter honeycomb 450; atap metal corrugated; talang stainless; dinding hebel double cat; lantai beton K400 + wiremesh M10.
- Partisi: grid 7 (penuh), F (7–19), 11 & 15 (sisi utara), 13 (sisi selatan). Unit: 2016 / 720 / 720 / 540 / 1080 / 1080 m2.
- Kantor 2 lt: grid 2–7 × A–C (36×12): Receptionist 144, 36, QC 36, Gudang 216 m2.
- Rolling door ~5×5 + kanopi: sisi A bay 8-9,10-11,12-13,15-16,17-18; sisi K bay 7-8,9-10,11-12,13-14,15-16,17-18.
- Timbangan jalan depan kantor (grid 2–6); mushalla + toilet pojok tenggara; rumah panel + pos dekat gerbang.
- T2 (V2): 84×24, x -36..48 (grid 4–18), z 50..74 (jarak 20 m dari T1), FFL +0.5, eave 9.5, ridge 11.9, mezzanine kantor +6.5 grid 8–11, ground tank sisi timur.
- Tapak: poligon dari siteplan AR.00.02 (vektor), titik level +0.067…+0.760 (utara), -0.2 (halaman), -1.2 (jalan umum).
## Build 2026-11-09 (V1 + V2)
- Template: gudang-makassar engine; model frame natural (x = grid 2→19, −z = sisi A/jalan), utara siteplan = +x model, peta diputar 3.5°.
- Gambar: 23 lembar PDF → kop SAP (vektor ringan; lembar >1.5 MB dirasterisasi 260 dpi di dalam SVG).
- Tapak: poligon dari vektor siteplan; DEM Copernicus/SRTM/ASTER grid 10 m; OSM jalan + bangunan sekitar (dilacak dari citra, indikatif).
- Grafis: level Ultra RTX (TAA supersampling saat diam, render 0.7× saat bergerak + CAS, grading filmik), path tracer three-gpu-pathtracer 0.0.23 (bundle lokal assets/js) opt-in tombol RTX; HP: dinonaktifkan.
- Ridge T1 +13.70 diukur dari skala (tidak berlabel di gambar).
