# adighanilham

Portofolio statis + studi desain reklame baja (unipole, double pole, rooftop × 4x8, 5x10, 6x12 m).

- `site/` — web statis (three.js via CDN). Deploy dengan output directory `site`.
- `src/` — mesin hitung (SNI 1727 angin, SNI 1729 LRFD, base plate, pondasi), ekspor SAP2000 .s2k / IFC4, gambar PDF/DXF.
  Bangun ulang: `cd src && python3 build.py ../site && python3 scenario.py`

Studi portofolio, bukan dokumen perizinan. V angin, qa tanah dan SDS adalah asumsi. File .s2k dan IFC belum dijalankan di SAP2000/Tekla.
