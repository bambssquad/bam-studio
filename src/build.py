# -*- coding: utf-8 -*-
"""Bangun semua keluaran studi reklame: data JSON web, PDF/DXF, .s2k, IFC, CSV material."""
import os, sys, json, csv, time
import numpy as np
import engine, export_cad, export_model

OUT = sys.argv[1] if len(sys.argv) > 1 else "../site"
FD = os.path.join(OUT, "files"); DD = os.path.join(OUT, "data")
os.makedirs(FD, exist_ok=True); os.makedirs(DD, exist_ok=True)

def clean(x):
    if isinstance(x, dict): return {str(k): clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [clean(v) for v in x]
    if isinstance(x, (np.floating,)): return round(float(x), 4)
    if isinstance(x, (np.integer,)): return int(x)
    if isinstance(x, float): return round(x, 4)
    return x

index = []
for typ in engine.TYPES:
    for size in engine.SIZES:
        t0 = time.time()
        o, m, secs, res = engine.run_variant(typ, size)
        vid = o["id"]
        export_cad.sheet_str(o, m, secs, os.path.join(FD, f"{vid}_STR-01"))
        export_cad.sheet_pbg(o, m, secs, os.path.join(FD, f"{vid}_PBG-01"))
        export_model.write_s2k(os.path.join(FD, f"{vid}.s2k"), o, m, secs)
        export_model.write_ifc(os.path.join(FD, f"{vid}.ifc"), o, m, secs, o.get("footing"), o.get("baseplate"))
        b = export_cad.bill(o, secs)
        with open(os.path.join(FD, f"{vid}_material.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["Kelompok", "Uraian", "Profil/Spesifikasi", "Panjang (m)", "Berat (kg)", "Rasio LRFD"])
            for r in b["profil"]: w.writerow(["Profil baja", f"{r['g']} {r['nama']}", r["profil"], r["L"], r["kg"], r["ratio"]])
            for e in b["lain"]: w.writerow(["Pelat/baut", e["item"], e["qty"], "", e["kg"] if e["kg"] is not None else "", ""])
            w.writerow(["Total baja", "", "", "", b["baja_kg"], ""])
            for k, v in b["beton"].items(): w.writerow(["Pondasi", k, "", "", v, ""])
            w.writerow(["Panel", "Bidang reklame (m2)", "", "", b["panel_m2"], ""])
            w.writerow(["Finishing", "Luas cat profil (m2)", "", "", b["cat_m2"], ""])
        # reaksi maks per tumpuan (envelope LRFD)
        combos_R = {}
        for cid, desc, fac in engine.COMBOS:
            R = {n: sum(np.array(res[k]["R"][n])*v for k, v in fac.items()) for n in m.sup}
            combos_R[cid] = R
        sup = list(m.sup.keys())
        reac = []
        for n in sup:
            reac.append(dict(node=n, Rz_max=max(float(R[n][2]) for R in combos_R.values()),
                             Rz_min=min(float(R[n][2]) for R in combos_R.values()),
                             V_max=max(float(np.hypot(R[n][0], R[n][1])) for R in combos_R.values()),
                             M_max=max(float(np.hypot(R[n][3], R[n][4])) for R in combos_R.values())))
        d = dict(o); d["bill"] = b; d["conn"] = export_cad.conn_design(o); d["reactions"] = reac
        d["site"] = {k: v for k, v in engine.SITE.items()}
        d["params"] = dict(WIND=engine.WIND, LOADS=engine.LOADS, SOIL=engine.SOIL, SDS=engine.SDS, FY=245, FC=engine.FC, FYR=engine.FYR)
        d["files"] = {k: f"files/{vid}{s}" for k, s in (("str_pdf", "_STR-01.pdf"), ("str_dxf", "_STR-01.dxf"), ("pbg_pdf", "_PBG-01.pdf"),
                                                     ("pbg_dxf", "_PBG-01.dxf"), ("s2k", ".s2k"), ("ifc", ".ifc"), ("csv", "_material.csv"))}
        json.dump(clean(d), open(os.path.join(DD, f"{vid}.json"), "w"), separators=(",", ":"))
        col = o["sections"].get("COL", o["sections"].get("POST"))
        index.append(dict(id=vid, typ=typ, typ_name=o["typ_name"], size=size, B=o["B"], S=o["S"], zt=o["zt"],
                          col=col["name"], steel_kg=b["baja_kg"], max_ratio=max(s["ratio"] for s in o["sections"].values()),
                          defl=o["defl"], footing=(f"{o['footing']['Lx']}x{o['footing']['Ly']}x{o['footing']['Hf']} m" if o.get("footing") else "angkur kimia"),
                          qh=o["wind"]["qh"]))
        print(f"{vid}: {time.time()-t0:.1f}s, baja {b['baja_kg']} kg", flush=True)
json.dump(clean(index), open(os.path.join(DD, "index.json"), "w"), indent=0)
print("selesai", len(index))
