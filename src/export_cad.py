# -*- coding: utf-8 -*-
"""Gambar kerja struktur (STR-01) + lembar format PBG (PBG-01) per varian reklame.
A2 landscape 594x420 mm, PDF + DXF (ezdxf). Studi desain portofolio, bukan dokumen perizinan."""
import math, os, json
import numpy as np
import engine
from cadlib import Sheet, View

SW, SH = 594.0, 420.0
FR = (8.0, 6.0, 588.0, 414.0)        # frame
KX0 = 498.0                          # kop kiri
GREY = (205, 205, 205)
RED = (200, 30, 30)

# ---------------- daftar material ----------------
def bill(o, secs):
    rows = []
    for g, s in o["sections"].items():
        Ltot = sum(mb["L"] for mb in o["members"] if mb["g"] == g)
        rows.append(dict(g=g, nama=s["group"], profil=s["name"], L=round(Ltot, 2), w=s["w"],
                         kg=round(Ltot*s["w"], 1), ratio=s["ratio"]))
    prof_kg = sum(r["kg"] for r in rows)
    extra = []
    ncol = len(o["supports"])
    if o.get("baseplate"):
        b = o["baseplate"]; Dp, tp = b["Dp"]/1e3, b["tp"]/1e3
        plate = math.pi*Dp**2/4*tp*7850*ncol
        stiff = b["stiff"]*0.5*(0.30*0.25)*b["stiff_t"]/1e3*7850*ncol
        extra += [dict(item=f"Base plate PL D{b['Dp']} t{b['tp']} (BJ41)", qty=f"{ncol} bh", kg=round(plate, 1)),
                  dict(item=f"Pengaku PL t{b['stiff_t']} ({b['stiff']}/kolom)", qty=f"{ncol*b['stiff']} bh", kg=round(stiff, 1)),
                  dict(item=f"Angkur M{b['d']} {b['grade']}, L={b['hef']+250} mm", qty=f"{ncol*b['n']} bh", kg=None)]
    if o.get("anchors"):
        for nm, a in o["anchors"].items():
            nsup = sum(1 for n, t in o["supports"].items() if t == "pin")//2
            extra.append(dict(item=f"Angkur kimia M{a['d']} kelas 5.8 ({nm})", qty=f"{nsup*a['n']} bh", kg=None))
        npost = len(o["supports"])
        extra.append(dict(item="Pelat dasar PL 250x250x12 (BJ41)", qty=f"{npost} bh", kg=round(0.25*0.25*0.012*7850*npost, 1)))
    conn = round(prof_kg*0.15, 1)
    extra.append(dict(item="Pelat sambung, baut, las (taksiran 15%)", qty="ls", kg=conn))
    steel_total = round(prof_kg+sum(e["kg"] or 0 for e in extra), 1)
    conc = {}
    if o.get("footing"):
        f = o["footing"]
        conc = dict(beton=f["vol"], lantai_kerja=round(f["Lx"]*f["Ly"]*0.05, 2), tulangan_kg=f["rebar_kg"],
                    galian=round((f["Lx"]+0.6)*(f["Ly"]+0.6)*f["Df"], 1))
    panel = round(o["B"]*o["S"], 1)
    return dict(profil=rows, lain=extra, baja_kg=steel_total, profil_kg=round(prof_kg, 1), beton=conc,
                panel_m2=panel, cat_m2=round(sum(r["L"]*(math.pi*o["sections"][r["g"]]["dims"][0]/1e3 if o["sections"][r["g"]]["kind"] == "CHS"
                                                      else 2*(o["sections"][r["g"]]["dims"][0]+o["sections"][r["g"]]["dims"][1])/1e3)
                                                for r in rows), 1))

# ---------------- utilitas gambar ----------------
def elv(c):
    c = int(round(c))
    return "EL. ± 0" if c == 0 else f"EL. {'+' if c > 0 else '-'} {abs(c)}"

def _wid(s, a, n, vy):
    """lebar tampak profil tegak lurus sumbu terproyeksi"""
    if s["kind"] == "CHS": return s["D"]
    vy = np.array(vy, float); vy = vy - a*np.dot(vy, a); vy /= np.linalg.norm(vy); vz = np.cross(a, vy)
    return s["h"]*abs(np.dot(vy, n)) + s["b"]*abs(np.dot(vz, n))

def draw_frame(S, V, o, m, secs, axes, layer="STR", skip=(), only=None):
    """axes: (iu, iv, sign_u) indeks koordinat untuk proyeksi"""
    iu, iv, su = axes
    for mb in o["members"]:
        if mb["g"] in skip or (only and mb["g"] not in only): continue
        p = np.array(o["nodes"][mb["i"]]); q = np.array(o["nodes"][mb["j"]])
        a3 = (q-p)/np.linalg.norm(q-p)
        u0, v0, u1, v1 = su*p[iu], p[iv], su*q[iu], q[iv]
        du, dv = u1-u0, v1-v0; L = math.hypot(du, dv)
        if L < 1e-6:  # anggota sejajar arah pandang: gambar penampang
            s = secs[mb["g"]]
            if s["kind"] == "CHS": S.circle(V.p(u0, v0), s["D"]/2*V.k, layer)
            continue
        nu, nv = -dv/L, du/L
        n3 = np.zeros(3); n3[iu] = su*nu; n3[iv] = nv
        w = _wid(secs[mb["g"]], a3, n3, mb["vy"])/2
        pts = [(u0+nu*w, v0+nv*w), (u1+nu*w, v1+nv*w), (u1-nu*w, v1-nv*w), (u0-nu*w, v0-nv*w)]
        S.line(V.pts(pts), layer, closed=True)

def ground(S, V, u0, u1, z=0.0, hatch=True):
    S.line([V.p(u0, z), V.p(u1, z)], "GROUND")
    if hatch:
        k = 0.0
        while u0+k < u1-0.3:
            S.line([V.p(u0+k, z), V.p(u0+k-0.25, z-0.25)], "THIN"); k += 0.5

def leader(S, p, q, txt, h=1.6, al="ML"):
    S.line([p, q, (q[0]+(len(txt)*h*0.5 if al == "ML" else -len(txt)*h*0.5), q[1])], "DIM")
    S.circle(p, 0.45, "DIM")
    S.text(txt, q[0]+(0.5 if al == "ML" else -0.5), q[1]+0.4, h, "BL" if al == "ML" else "BR")

def table(S, x, y, cols, rows, h=1.6, rh=4.2, head_bold=True):
    """cols: list (judul, lebar); rows: list of list; y = atas tabel"""
    W = sum(c[1] for c in cols); n = len(rows)+1
    S.rect(x, y-n*rh, x+W, y, "STR")
    for r in range(1, n): S.line([(x, y-r*rh), (x+W, y-r*rh)], "THIN")
    S.line([(x, y-rh), (x+W, y-rh)], "STR")
    cx = x
    for k, (t, w) in enumerate(cols):
        if k: S.line([(cx, y), (cx, y-n*rh)], "THIN")
        S.text(t, cx+w/2, y-rh/2, h, "MC", bold=head_bold)
        for r, row in enumerate(rows):
            S.text(str(row[k]), cx+(1.0 if k == 0 else w/2), y-(r+1.5)*rh, h, "ML" if k == 0 else "MC")
        cx += w
    return y-n*rh

def north(S, x, y, r=6):
    S.circle((x, y), r, "THIN")
    S.fill([(x, y+r), (x-r*0.35, y-r*0.6), (x, y-r*0.3)], (0, 0, 0))
    S.line([(x, y+r), (x+r*0.35, y-r*0.6), (x, y-r*0.3)], "THIN", closed=True)
    S.text("U", x, y+r+2.2, 2.4, "MC", bold=True)

def kop(S, o, code, no, title_list, data_rows, sheet_name):
    x0, y0, x1, y1 = KX0, FR[1], FR[2], FR[3]
    S.rect(x0, y0, x1, y1, "FRAME")
    W = x1-x0; cy = y1
    def band(h, label=None):
        nonlocal cy
        top = cy; cy -= h; S.line([(x0, cy), (x1, cy)], "STR")
        if label:
            S.line([(x0, top-4.2), (x1, top-4.2)], "THIN")
            S.text(label, x0+2, top-2.1, 1.7, "ML", rs=True)
        return top
    t = band(30)
    S.text("adighanilham", x0+W/2, t-11, 6.0, "MC", bold=True)
    S.text("ARSITEKTUR / STRUKTUR / KOMPUTASI", x0+W/2, t-18, 1.9, "MC", rs=True)
    S.text("PORTOFOLIO STUDI DESAIN", x0+W/2, t-24, 1.9, "MC", rs=True)
    t = band(28, "PROYEK")
    S.text("STUDI DESAIN STRUKTUR", x0+W/2, t-9.5, 2.6, "MC", rs=True)
    S.text("REKLAME BAJA", x0+W/2, t-14, 2.6, "MC", rs=True)
    S.text(f"{o['typ_name'].upper()} - {o['B']:g} x {o['S']:g} m", x0+W/2, t-20, 2.2, "MC", rs=True)
    t = band(22, "LOKASI (ILUSTRATIF)")
    nm = engine.SITE["nama"]
    parts = [nm[:42], nm[42:84]] if len(nm) > 42 else [nm]
    for k, s in enumerate(parts): S.text(s, x0+W/2, t-9-k*3.6, 1.9, "MC", rs=True)
    S.text(f"{abs(engine.SITE['lat']):.4f} LS, {engine.SITE['lon']:.4f} BT", x0+W/2, t-17.5, 1.7, "MC", rs=True)
    t = band(6+5.2*len(title_list)+3, "NAMA GAMBAR                                SKALA")
    for k, (nmg, sk) in enumerate(title_list):
        S.text(f"{k+1}. {nmg}", x0+2, t-8-k*5.2, 1.8, "ML", rs=True)
        S.text(sk, x1-2, t-8-k*5.2, 1.8, "MR", rs=True)
    t = band(6+4.6*len(data_rows)+2, "DATA TEKNIS")
    for k, (a, b) in enumerate(data_rows):
        S.text(a, x0+2, t-7.6-k*4.6, 1.7, "ML", rs=True)
        S.text(b, x1-2, t-7.6-k*4.6, 1.7, "MR", rs=True)
    t = band(24, "STATUS DOKUMEN")
    S.rect(x0+3, t-21, x1-3, t-6, "FRAME", rgb=RED)
    S.text("STUDI DESAIN PORTOFOLIO", x0+W/2, t-10.2, 2.4, "MC", bold=True, rgb=RED)
    S.text("BUKAN DOKUMEN PERIZINAN RESMI", x0+W/2, t-14.6, 2.0, "MC", bold=True, rgb=RED)
    S.text("Asumsi beban & tanah wajib diverifikasi", x0+W/2, t-18.6, 1.6, "MC", rgb=RED)
    t = band(34, "PERENCANA / TENAGA AHLI                   PARAF")
    S.text("Perencana : adighanilham", x0+2, t-9, 1.8, "ML", rs=True)
    S.text("Tenaga ahli struktur :", x0+2, t-15, 1.8, "ML", rs=True)
    S.text("SKA/SKK : ................", x0+2, t-21, 1.8, "ML", rs=True)
    S.line([(x1-26, t-4.2), (x1-26, t-34)], "THIN")   # kolom paraf kosong
    t = band(30, "PEMOHON                                   MENGETAHUI")
    S.line([(x0+W/2, t-4.2), (x0+W/2, t-30)], "THIN")
    S.text("( .......................... )", x0+W/4, t-26, 1.7, "MC", rs=True)
    S.text("( .......................... )", x0+3*W/4, t-26, 1.7, "MC", rs=True)
    # kode gambar (paling bawah)
    yb = y0+16
    S.line([(x0, yb), (x1, yb)], "STR")
    for xx in (x0+W*0.45, x0+W*0.72): S.line([(xx, y0), (xx, yb)], "THIN")
    for xx, lab, val in ((x0, "KODE GAMBAR", code), (x0+W*0.45, "NO.", f"{no:02d}"), (x0+W*0.72, "JML", "02")):
        S.text(lab, xx+1.5, yb-3, 1.5, "ML", rs=True)
        S.text(val, xx+1.5, y0+5.5, 3.6, "ML", bold=True)
    S.text(sheet_name, x0+W/2, yb+3.2, 2.0, "MC", bold=True)
    S.line([(x0, yb+6.5), (x1, yb+6.5)], "THIN")
    # sisa ruang: tabel revisi kosong + id varian
    S.text(o["id"].upper(), x0+W/2, yb+11, 2.4, "MC", rs=True)
    S.line([(x0, yb+15), (x1, yb+15)], "THIN")
    top = cy; S.line([(x0, top-4.2), (x1, top-4.2)], "THIN")
    S.text("REVISI", x0+2, top-2.1, 1.7, "ML", rs=True)
    for xx, lab in ((x0+2, "NO"), (x0+12, "TANGGAL"), (x0+34, "URAIAN")):
        S.text(lab, xx, top-6.3, 1.5, "ML", rs=True)
    S.line([(x0, top-8.4), (x1, top-8.4)], "THIN")
    for xx in (x0+10, x0+32): S.line([(xx, top-4.2), (xx, yb+15)], "THIN")
    r = top-8.4-6
    while r > yb+15: S.line([(x0, r), (x1, r)], "THIN"); r -= 6

def export(S, base):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import RenderContext, Frontend
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    from ezdxf.addons.drawing.config import Configuration, LineweightPolicy, BackgroundPolicy, ColorPolicy
    fig = plt.figure(figsize=(SW/25.4, SH/25.4)); ax = fig.add_axes([0, 0, 1, 1])
    cfg = Configuration(lineweight_policy=LineweightPolicy.ABSOLUTE, lineweight_scaling=1.0,
                        background_policy=BackgroundPolicy.WHITE, color_policy=ColorPolicy.COLOR, min_lineweight=0.05)
    Frontend(RenderContext(S.doc), MatplotlibBackend(ax), config=cfg).draw_layout(S.msp, finalize=False)
    ax.set_xlim(0, SW); ax.set_ylim(0, SH); ax.set_aspect("equal"); ax.axis("off")
    fig.set_size_inches(SW/25.4, SH/25.4); ax.set_position([0, 0, 1, 1])
    fig.savefig(base+".pdf", dpi=200); plt.close(fig)
    S.doc.saveas(base+".dxf")

def _frame_sheet():
    S = Sheet(); S.rect(*FR, "FRAME"); return S

# ---------------- views ----------------
def view_elev(S, V, o, m, secs, side, title_xy, tag, name, scale_txt, show_panel=False):
    """side: 'front' (x-z, dari depan/-y), 'back' (x-z dari belakang), 'side' (y-z)"""
    gz = o["z0"] if o["typ"] == "rooftop" else 0.0
    xs = [n[0] for n in o["nodes"]]; ys = [n[1] for n in o["nodes"]]
    if side == "side":
        ax = (1, 2, -1); umin, umax = -max(ys)-1.5, -min(ys)+1.5
    else:
        su = 1 if side == "front" else -1
        ax = (0, 2, su); umin, umax = min(xs)-1.5, max(xs)+1.5
    if o["typ"] == "rooftop":
        # bangunan eksisting (garis putus)
        # pelat atap eksisting + dinding terpotong (garis putus) dengan tanda putus
        S.hatch(V.r(umin, gz-0.15, umax, gz), "ANSI31", 0.25)
        S.line([V.p(umin, gz), V.p(umax, gz)], "GROUND")
        S.line([V.p(umin, gz-0.15), V.p(umax, gz-0.15)], "WALL")
        for uu in (umin+0.3, umax-0.3):
            S.line([V.p(uu, gz-0.15), V.p(uu, gz-1.6)], "HIDDEN", lt="DASHED", ltscale=4)
        zb_ = gz-1.6
        S.line(V.pts([(umin, zb_), ((umin+umax)/2-0.3, zb_), ((umin+umax)/2-0.1, zb_+0.25), ((umin+umax)/2+0.1, zb_-0.25),
                      ((umin+umax)/2+0.3, zb_), (umax, zb_)]), "THIN")
        S.text("PELAT ATAP & STRUKTUR BANGUNAN EKSISTING (WAJIB DICEK AHLI STRUKTUR)", V.X((umin+umax)/2), V.Y(gz-0.8), 1.5, "MC")
    else:
        ground(S, V, umin, umax, 0.0)
        f = o["footing"]
        if f:
            cx = [o["nodes"][int(n)][ax[0]]*ax[2] for n in o["supports"]]
            c0 = (max(cx)+min(cx))/2; Lf = f["Lx"] if side != "side" else f["Ly"]
            yc = o["nodes"][int(list(o["supports"])[0])][1]*ax[2] if side == "side" else c0
            S.line(V.r(yc-Lf/2, -f["Df"], yc+Lf/2, -f["Df"]+f["Hf"]), "HIDDEN", lt="DASHED", closed=False, ltscale=6)
            S.line(V.pts([(yc-Lf/2, -f["Df"]), (yc+Lf/2, -f["Df"]), (yc+Lf/2, -f["Df"]+f["Hf"]), (yc-Lf/2, -f["Df"]+f["Hf"])]),
                   "HIDDEN", lt="DASHED", closed=True, ltscale=6)
            for c in cx:
                cc = c if side != "side" else yc
                S.line(V.pts([(cc-f["bp"]/2, -f["Df"]+f["Hf"]), (cc-f["bp"]/2, 0.3), (cc+f["bp"]/2, 0.3), (cc+f["bp"]/2, -f["Df"]+f["Hf"])]),
                       "HIDDEN", lt="DASHED", ltscale=6)
    if show_panel and side != "side":
        S.fill(V.r(-o["B"]/2, o["zb"], o["B"]/2, o["zt"]), (232, 232, 232))
        S.rect(*V.p(-o["B"]/2, o["zb"]), *V.p(o["B"]/2, o["zt"]), "WALL")
        S.text("BIDANG REKLAME", V.X(0), V.Y((o["zb"]+o["zt"])/2)+2, 2.4, "MC", bold=True)
        S.text(f"{o['B']:g} x {o['S']:g} m  (panel ACP/flexi + rangka)", V.X(0), V.Y((o["zb"]+o["zt"])/2)-2, 1.7, "MC")
        draw_frame(S, V, o, m, secs, ax, "STR", only=("COL", "POST", "STRUT", "KICK"))
        # bagian kolom di belakang panel tertutup: tutup dengan fill lagi di zona panel
        S.fill(V.r(-o["B"]/2+0.02, o["zb"]+0.02, o["B"]/2-0.02, o["zt"]-0.02), (232, 232, 232))
        S.text("BIDANG REKLAME", V.X(0), V.Y((o["zb"]+o["zt"])/2)+2, 2.4, "MC", bold=True)
        S.text(f"{o['B']:g} x {o['S']:g} m", V.X(0), V.Y((o["zb"]+o["zt"])/2)-2.4, 1.9, "MC")
    else:
        draw_frame(S, V, o, m, secs, ax, "STR")
        if side == "side":
            # panel tampak sisi
            yb = -o["yb"]
            S.fill(V.r(yb-0.03, o["zb"], yb+0.03, o["zt"]), (90, 90, 90))
    # dimensi & elevasi
    uR = umax+0.3
    zs = [gz, o["zb"], o["zt"]]
    S.chain_v(V.X(uR)+3, [V.Y(z) for z in zs], [f"{(zs[1]-zs[0])*1000:.0f}", f"{(zs[2]-zs[1])*1000:.0f}"], ext_from=V.X(uR)-1)
    S.dim_v(V.X(uR)+9, V.Y(gz), V.Y(o["zt"]), f"{(o['zt']-gz)*1000:.0f}", ext_from=V.X(uR)+4)
    for z in (zs if o["typ"] == "rooftop" else sorted(set((0.0,) + tuple(zs)))):
        S.elev_mark(V.X(umin)-1, V.Y(z), elv(z*100), side="L")
    if side != "side":
        S.dim_h(V.X(-o["B"]/2), V.X(o["B"]/2), V.Y(o["zt"])+5, f"{o['B']*1000:.0f}", ext_from=V.Y(o["zt"])+1)
    S.title(title_xy[0], title_xy[1], tag, name, scale_txt)

def label_groups(S, V, o, secs, axes, dx=12):
    iu, iv, su = axes; done = set(); k = 0
    for mb in o["members"]:
        g = mb["g"]
        if g in done: continue
        done.add(g)
        p = np.array(o["nodes"][mb["i"]]); q = np.array(o["nodes"][mb["j"]]); c = (p+q)/2
        P = V.p(su*c[iu], c[iv]); side = 1 if su*c[iu] >= 0 else -1
        Q = (P[0]+side*(dx+3*(k % 2)), P[1]+4+2*(k % 3))
        leader(S, P, Q, f"{g}: {secs[g]['name']}", 1.6, "ML" if side > 0 else "MR"); k += 1

def detail_baseplate(S, o, x, y):
    b = o["baseplate"]; s = o["sections"]["COL"]; D, t = s["dims"]
    V = View(x, y, 20)  # plan 1:20, satuan m
    R = b["Dp"]/2000; Rb = b["Db"]/2000
    S.circle(V.p(0, 0), R*V.k, "WALL")
    S.circle(V.p(0, 0), D/2000*V.k, "STR"); S.circle(V.p(0, 0), (D/2-t)/1000*V.k, "THIN")
    for k in range(b["n"]):
        a = 2*math.pi*(k+0.5)/b["n"]
        S.circle(V.p(Rb*math.cos(a), Rb*math.sin(a)), b["d"]/2000*V.k+0.4, "STR")
    for k in range(b["stiff"]):
        a = 2*math.pi*k/b["stiff"]
        S.line([V.p(D/2000*math.cos(a), D/2000*math.sin(a)), V.p(R*math.cos(a), R*math.sin(a))], "WALL")
    S.line([V.p(-R-0.05, 0), V.p(R+0.05, 0)], "GRID", lt="CENTER", ltscale=3)
    S.line([V.p(0, -R-0.05), V.p(0, R+0.05)], "GRID", lt="CENTER", ltscale=3)
    S.dim_h(V.X(-R), V.X(R), V.Y(-R)-4, f"Ø{b['Dp']}", ext_from=V.Y(-R)-1)
    S.text(f"{b['n']} angkur M{b['d']} pada Ø{b['Db']}", V.X(0), V.Y(-R)-9, 1.6, "MC")
    S.text(f"PL Ø{b['Dp']} t{b['tp']} + {b['stiff']} pengaku t{b['stiff_t']}", V.X(0), V.Y(-R)-12, 1.6, "MC")
    S.title(V.X(-R)+2, V.Y(R)+8, "S3", "DETAIL BASE PLATE", "SKALA 1 : 20", w=40)

def detail_footing(S, o, x, y):
    f = o["footing"]; b = o["baseplate"]
    V = View(x, y, 50)
    Lx = f["Ly"]; Hf = f["Hf"]; Df = f["Df"]; bp = f["bp"]; hp = Df-Hf+0.3
    # tanah
    S.line([V.p(-Lx/2-0.8, 0), V.p(Lx/2+0.8, 0)], "GROUND")
    # lantai kerja
    S.hatch(V.r(-Lx/2-0.05, -Df-0.05, Lx/2+0.05, -Df), "ANSI31", 0.3)
    # telapak + pedestal
    poly = [(-Lx/2, -Df), (Lx/2, -Df), (Lx/2, -Df+Hf), (bp/2, -Df+Hf), (bp/2, 0.3), (-bp/2, 0.3), (-bp/2, -Df+Hf), (-Lx/2, -Df+Hf)]
    S.hatch(V.pts(poly), "AR-CONC", 0.03, rgb=(150, 150, 150))
    S.line(V.pts(poly), "WALL", closed=True)
    # tulangan bawah
    c = 0.075
    S.line([V.p(-Lx/2+c, -Df+c+0.1), V.p(-Lx/2+c, -Df+c), V.p(Lx/2-c, -Df+c), V.p(Lx/2-c, -Df+c+0.1)], "STR")
    n = int((Lx-2*c)/0.25)
    for k in range(n+1):
        S.circle(V.p(-Lx/2+c+k*(Lx-2*c)/n, -Df+c+0.025), 0.35, "STR")
    # tulangan pedestal & angkur
    for sx in (-1, 1):
        S.line([V.p(sx*(bp/2-0.05), 0.25), V.p(sx*(bp/2-0.05), -Df+c+0.03), V.p(sx*(bp/2-0.05)+sx*0.3, -Df+c+0.03)], "STR")
        if b:
            xb = sx*b["Db"]/2000
            S.line([V.p(xb, 0.30+0.05), V.p(xb, 0.3-b["hef"]/1000)], "WALL")
            S.line([V.p(xb-0.04, 0.3-b["hef"]/1000), V.p(xb+0.04, 0.3-b["hef"]/1000)], "WALL")
    for k in range(int((hp-0.1)/0.15)):
        zz = -Df+Hf+0.05+k*0.15
        S.line([V.p(-bp/2+0.05, zz), V.p(bp/2-0.05, zz)], "THIN")
    # kolom + base plate
    D = o["sections"]["COL"]["dims"][0]/1000
    if b:
        S.fill(V.r(-b["Dp"]/2000, 0.35, b["Dp"]/2000, 0.35+b["tp"]/1000), (0, 0, 0))
        S.line(V.pts([(-D/2, 0.35+b["tp"]/1000), (-D/2, 1.0)]), "STR"); S.line(V.pts([(D/2, 0.35+b["tp"]/1000), (D/2, 1.0)]), "STR")
        S.text("grout non-susut 50", V.X(b["Dp"]/2000)+1, V.Y(0.33), 1.5, "ML")
    S.dim_h(V.X(-Lx/2), V.X(Lx/2), V.Y(-Df)-5, f"{Lx*1000:.0f}", ext_from=V.Y(-Df)-1)
    S.dim_v(V.X(Lx/2)+4, V.Y(-Df), V.Y(-Df+Hf), f"{Hf*1000:.0f}", ext_from=V.X(Lx/2)+1)
    S.dim_v(V.X(Lx/2)+9, V.Y(-Df), V.Y(0), f"{Df*1000:.0f}", ext_from=V.X(Lx/2)+1)
    S.elev_mark(V.X(-Lx/2)-1, V.Y(0), elv(0), "L"); S.elev_mark(V.X(-Lx/2)-1, V.Y(-Df), elv(-Df*100), "L")
    S.elev_mark(V.X(-bp/2)-1, V.Y(0.3), elv(30), "L")
    nb = max(8, math.ceil(b["As_ped"]/284/4)*4) if b else 8
    S.text(f"Tul. bawah 2 arah {f['bar']}", V.X(0), V.Y(-Df)-9.5, 1.6, "MC")
    S.text(f"Pedestal {bp*1000:.0f}x{bp*1000:.0f}: {nb} D19 + sk. D10-150", V.X(0), V.Y(-Df)-12.5, 1.6, "MC")
    S.text("Lantai kerja t=50, beton fc' 25 MPa, BJTS 420", V.X(0), V.Y(-Df)-15.5, 1.6, "MC")
    S.title(V.X(-Lx/2), V.Y(1.0)+8, "S4", "POTONGAN PONDASI", "SKALA 1 : 50", w=44)

def plan_footing(S, o, x, y):
    f = o["footing"]; V = View(x, y, 100)
    cx = [o["nodes"][int(n)][0] for n in o["supports"]]
    c0 = (max(cx)+min(cx))/2
    S.rect(*V.p(c0-f["Lx"]/2, -f["Ly"]/2), *V.p(c0+f["Lx"]/2, f["Ly"]/2), "WALL")
    for k, c in enumerate(sorted(cx)):
        S.rect(*V.p(c-f["bp"]/2, -f["bp"]/2), *V.p(c+f["bp"]/2, f["bp"]/2), "STR")
        S.circle(V.p(c, 0), o["sections"]["COL"]["dims"][0]/2000*V.k, "STR")
        S.line([V.p(c, -f["Ly"]/2-1.2), V.p(c, f["Ly"]/2+0.6)], "GRID", lt="CENTER", ltscale=4)
        S.bubble(V.X(c), V.Y(-f["Ly"]/2-1.2)-1.6, str(k+1))
    S.line([V.p(c0-f["Lx"]/2-0.8, 0), V.p(c0+f["Lx"]/2+0.6, 0)], "GRID", lt="CENTER", ltscale=4)
    S.bubble(V.X(c0-f["Lx"]/2-0.8)-1.6, V.Y(0), "A")
    S.dim_h(V.X(c0-f["Lx"]/2), V.X(c0+f["Lx"]/2), V.Y(f["Ly"]/2)+4, f"{f['Lx']*1000:.0f}", ext_from=V.Y(f["Ly"]/2)+1)
    S.dim_v(V.X(c0+f["Lx"]/2)+4, V.Y(-f["Ly"]/2), V.Y(f["Ly"]/2), f"{f['Ly']*1000:.0f}", ext_from=V.X(c0+f["Lx"]/2)+1)
    if len(cx) > 1:
        S.dim_h(V.X(min(cx)), V.X(max(cx)), V.Y(-f["Ly"]/2)-6.5, f"{(max(cx)-min(cx))*1000:.0f}", ext_from=V.Y(-f["Ly"]/2))
    S.text(f"PONDASI TELAPAK {'GABUNGAN ' if len(cx) > 1 else ''}{f['Lx']:g} x {f['Ly']:g} x {f['Hf']:g} m", V.X(c0), V.Y(-f["Ly"]/2)-10.5, 1.6, "MC")
    S.title(V.X(c0-f["Lx"]/2), V.Y(f["Ly"]/2)+12, "S2", "DENAH PONDASI", "SKALA 1 : 100", w=40)

def detail_roofanchor(S, o, x, y):
    V = View(x, y, 10); s = o["sections"]["POST"]; b = s["dims"][1]/1000
    a = o["anchors"]["kolom"]; P = 0.25
    S.rect(*V.p(-P/2, -P/2), *V.p(P/2, P/2), "WALL")
    S.rect(*V.p(-b/2, -b/2), *V.p(b/2, b/2), "STR")
    for sx in (-1, 1):
        for sy in (-1, 1):
            S.circle(V.p(sx*0.085, sy*0.085), a["d"]/2000*V.k+0.4, "STR")
    S.dim_h(V.X(-P/2), V.X(P/2), V.Y(-P/2)-4, "250", ext_from=V.Y(-P/2)-1)
    S.dim_h(V.X(-0.085), V.X(0.085), V.Y(P/2)+4, "170", ext_from=V.Y(P/2)+1)
    S.text(f"PL 250x250x12 + 4 angkur kimia M{a['d']} kelas 5.8", V.X(0), V.Y(-P/2)-9, 1.6, "MC")
    S.text("embed min. 10d, pada balok/kolom beton eksisting", V.X(0), V.Y(-P/2)-12, 1.6, "MC")
    S.text(f"Reaksi maks: tekan {a['R_tekan']} kN, tarik {a['R_tarik']} kN, geser {a['V']} kN", V.X(0), V.Y(-P/2)-15, 1.6, "MC")
    S.title(V.X(-P/2)-6, V.Y(P/2)+12, "S3", "DETAIL TUMPUAN ATAP", "SKALA 1 : 10", w=46)

def wind_diagram(S, o, x, y):
    """diagram tekanan angin kasus A/B/C pada bidang (tanpa skala)"""
    w = o["wind"]; qh = w["qh"]; G = engine.WIND["G"]
    pA = qh*G*w["Cf"]; kB = 2.4/o["B"]; cfc = w["CfC"]
    W, Hh = 42.0, 14.0
    S.text("DIAGRAM TEKANAN ANGIN PADA BIDANG (kPa)", x, y+26, 2.0, "ML", bold=True)
    for i, (nm, fn) in enumerate((("KASUS A (merata)", lambda u: pA),
                                  ("KASUS B (eksentris 0,2B)", lambda u: pA*(1+kB*(u-0.5)*o["B"])),
                                  ("KASUS C (tepi)", lambda u: qh*G*(cfc[0] if u*o["B"] <= o["S"] else (cfc[1] if u*o["B"] <= 2*o["S"] else 0))))):
        x0 = x+i*(W+8)
        S.rect(x0, y, x0+W, y+Hh*0.25, "STR")
        vals = [fn((k+0.5)/12) for k in range(12)]; vm = max(max(abs(v) for v in vals), 1e-6)
        pts = [(x0, y+Hh*0.25)]
        for k, v in enumerate(vals):
            xx = x0+W*(k+0.5)/12; hh = Hh*v/vm
            S.line([(xx, y+Hh*0.25+max(hh, 0)), (xx, y+Hh*0.25)], "DIM"); S.arrow((xx, y+Hh*0.25), 270, 0.9)
        prof = [(x0+W*(k+0.5)/12, y+Hh*0.25+Hh*v/vm) for k, v in enumerate(vals)]
        S.line(prof, "THIN")
        S.text(nm, x0+W/2, y-2.5, 1.5, "MC")
        S.text(f"maks {max(vals):.2f} / min {min(vals):.2f}", x0+W/2, y-5.5, 1.5, "MC")
    S.text(f"qh = {qh} kPa, G = {G}, Cf = {w['Cf']} (A/B), Cf C = {cfc[0]} / {cfc[1]}; papan B = {o['B']:g} m, s = {o['S']:g} m", x, y-9.5, 1.5, "ML")

def conn_design(o):
    """sambungan pelat ujung lengan/rel ke kolom: baut A325 tarik akibat momen maks lengan"""
    g = "ARM" if "ARM" in o["sections"] else "RAIL"
    sec = o["sections"][g]; h = sec["dims"][0]
    Mu = max([mb["M"] for mb in o["members"] if mb["g"] == g] + [1.0])
    for d, As in ((16, 157), (20, 245), (24, 353)):
        for nb in (4, 6, 8):
            rows_t = nb//2 - (1 if nb > 4 else 0)   # baris tarik (2 baut per baris)
            lever = (h+60)/1000
            T = Mu/lever/max(rows_t, 1)/2
            phiT = 0.75*620*As/1000
            if T/phiT <= 0.8:
                tp = max(12, int(math.ceil(math.sqrt(4*T*1e3*45/(0.9*250*(sec["dims"][1]+80)))/2))*2)
                return dict(g=g, prof=sec["name"], Mu=round(Mu, 1), d=d, n=nb, T=round(T, 1), phiT=round(phiT, 1),
                            ratio=round(T/phiT, 2), tp=tp, h=h, b=sec["dims"][1])
    return dict(g=g, prof=sec["name"], Mu=round(Mu, 1), d=24, n=8, T=0, phiT=0, ratio=0, tp=20, h=h, b=sec["dims"][1])

def detail_conn(S, o, x, y):
    c = conn_design(o); V = View(x, y, 10)
    h, b = c["h"]/1000, c["b"]/1000; tp = c["tp"]/1000
    ph, pb = h+0.16, b+0.08
    # tampak samping: kolom/stub | pelat ujung | profil
    S.fill(V.r(-0.02-tp, -ph/2, -0.02, ph/2), (0, 0, 0))
    S.fill(V.r(-0.02-2*tp, -ph/2, -0.02-tp, ph/2), (60, 60, 60))
    S.line(V.pts([(-0.40, -ph/2-0.05), (-0.02-2*tp, -ph/2-0.05)]), "THIN")
    S.rect(*V.p(-0.02, -h/2), *V.p(0.45, h/2), "STR")
    S.line(V.pts([(-0.02, -h/2+0.006), (0.45, -h/2+0.006)]), "THIN")
    S.line(V.pts([(-0.02, h/2-0.006), (0.45, h/2-0.006)]), "THIN")
    S.line([V.p(0.45, -h/2-0.03), V.p(0.45, h/2+0.03)], "THIN", lt="DASHED", ltscale=2)
    nrow = c["n"]//2
    zs = [h/2+0.04, -h/2-0.04] + ([0.0] if nrow == 3 else []) + ([h/6, -h/6] if nrow == 4 else [])
    for z in zs:
        S.line([V.p(-0.05-2*tp, z), V.p(0.0, z)], "WALL")
        S.circle(V.p(-0.05-2*tp, z), 0.6, "STR")
    S.text(f"{c['g']} {c['prof']}", V.X(0.22), V.Y(0), 1.6, "MC")
    leader(S, V.p(-0.02-tp/2, ph/2-0.02), (V.X(-0.02)+8, V.Y(ph/2)+6), f"PL ujung t{c['tp']} + pelat stub kolom t{c['tp']}", 1.5)
    leader(S, V.p(-0.05-2*tp, zs[0]), (V.X(-0.05)-18, V.Y(ph/2)+10), f"{c['n']} baut M{c['d']} A325 (2 baris)", 1.5, "MR")
    S.text("las sudut keliling a = 6 mm (E70XX)", V.X(0.2), V.Y(-ph/2)-5, 1.5, "MC")
    S.text(f"Mu = {c['Mu']} kNm; Tu/baut = {c['T']} kN; rasio {c['ratio']}", V.X(0.2), V.Y(-ph/2)-8.5, 1.5, "MC")
    S.title(V.X(-0.40), V.Y(ph/2)+18, "S5", "DETAIL SAMBUNGAN LENGAN" if c["g"] == "ARM" else "DETAIL SAMBUNGAN RANGKA", "SKALA 1 : 10", w=50)

# ---------------- sheets ----------------
def _scale_for(o, wmax=270.0, hmax=175.0, pbg=False):
    gz = o["z0"]-1.6 if o["typ"] == "rooftop" else -(o["footing"]["Df"] if o.get("footing") else 0)
    H = o["zt"]-gz
    ys = [n[1] for n in o["nodes"]]; dy = max(ys)-min(ys)+3
    Wd = (o["B"]+3) if pbg else (o["B"]+3+dy)
    for sc in (50, 75, 100, 125, 150):
        if Wd*1000/sc+(0 if pbg else 60) <= wmax and H*1000/sc <= hmax: return sc
    return 200

def sheet_str(o, m, secs, base):
    S = _frame_sheet(); sc = _scale_for(o, 270.0, 170.0); k = 1000/sc
    if o["typ"] == "rooftop":
        ybase = 215.0 - o["z0"]*k
    else:
        ybase = 200.0 + o["footing"]["Df"]*k
    Bv = o["B"]+3
    x1 = 30 + Bv/2*k
    view_elev(S, View(x1, ybase, sc), o, m, secs, "back", (24, ybase+(o["zt"])*k+18), "S1", "TAMPAK BELAKANG (RANGKA)", f"SKALA 1 : {sc}")
    label_groups(S, View(x1, ybase, sc), o, secs, (0, 2, -1))
    ys = [n[1] for n in o["nodes"]]; dy = max(ys)-min(ys)+3
    x2 = x1 + Bv/2*k + 30 + dy/2*k
    view_elev(S, View(x2, ybase, sc), o, m, secs, "side", (x2-dy/2*k-6, ybase+o["zt"]*k+18), "S1", "TAMPAK SAMPING", f"SKALA 1 : {sc}")
    xr = x2 + dy/2*k + 22
    # baris bawah: detail
    if o["typ"] != "rooftop":
        f = o["footing"]; xp = 24 + (f["Lx"]/2+1.2)*10
        plan_footing(S, o, xp, 95)
        xb = xp + f["Lx"]/2*10 + 22 + o["baseplate"]["Dp"]/2000*50
        detail_baseplate(S, o, xb, 100)
        xf = xb + o["baseplate"]["Dp"]/2000*50 + 30 + (f["Ly"]/2+0.8)*20
        detail_footing(S, o, xf, 108)
        detail_conn(S, o, max(xf + (f["Ly"]/2+0.8)*20 + 40, 400), 100)
    else:
        detail_roofanchor(S, o, 80, 100)
        detail_conn(S, o, 260, 100)
    B = bill(o, secs)
    rows = [[r["g"]+" "+r["nama"], r["profil"], f"{r['L']:.1f}", f"{r['kg']:.0f}", f"{r['ratio']:.2f}"] for r in B["profil"]]
    tx = max(min(xr, 358), 300)
    S.text("DAFTAR PROFIL & RASIO (LRFD)", tx, 392, 2.2, "ML", bold=True)
    yb = table(S, tx, 389, [("ANGGOTA", 54), ("PROFIL", 34), ("L (m)", 16), ("kg", 16), ("RASIO", 16)], rows, 1.5, 4.0)
    S.text(f"Baja profil {B['profil_kg']:.0f} kg; total baja termasuk pelat/sambungan ± {B['baja_kg']:.0f} kg", tx, yb-3, 1.5, "ML")
    notes = [
        "CATATAN:",
        "1. Acuan: SNI 1727:2020 (angin, ASCE 7-16 Bab 29), SNI 1729:2020 (AISC 360-16), SNI 2847:2019.",
        f"2. Angin V = {engine.WIND['V']:g} m/s (asumsi), eksposur {engine.WIND['exposure']}, Kd {engine.WIND['Kd']}, G {engine.WIND['G']}, Cf = {o['wind']['Cf']}.",
        f"   qh = {o['wind']['qh']} kPa pada h = {o['wind']['h']} m; kasus A, B (eksentris 0,2B) dan C.",
        "3. Kombinasi LRFD 1,4D; 1,2D+1,6L; 1,2D+1,0W+L; 0,9D+1,0W. Pondasi ASD D+0,6W; 0,6D+0,6W.",
        "4. Profil BJ41 fy 245 MPa (pipa/hollow); pelat fy 250 MPa; las E70XX; baut A325 / angkur F1554 Gr.55.",
        "5. Defleksi layan puncak <= H/100 (D+0,6W). Analisis rangka 3D linear (skrip Python).",
        f"6. Daya dukung tanah izin asumsi qa = {engine.SOIL['qa']:g} kPa, wajib uji sondir/boring." if o["typ"] != "rooftop"
        else "6. Kapasitas pelat/balok atap eksisting WAJIB dicek ahli struktur sebelum pemasangan.",
        "7. Model SAP2000 (.s2k) & IFC (Tekla) disertakan; SAP2000/Tekla tidak dijalankan pada studi ini.",
        "8. Finishing: sandblast Sa 2,5, primer zinc chromate + cat akhir 2 lapis; galvanis untuk angkur.",
    ]
    for kk, s in enumerate(notes):
        S.text(s, tx, yb-9-kk*3.6, 1.5 if kk else 1.8, "ML", bold=(kk == 0))
    wind_diagram(S, o, tx, yb-9-len(notes)*3.6-38)
    titles = [("TAMPAK BELAKANG (RANGKA)", f"1:{sc}"), ("TAMPAK SAMPING", f"1:{sc}")]
    if o["typ"] != "rooftop":
        titles += [("DENAH PONDASI", "1:100"), ("DETAIL BASE PLATE", "1:20"), ("POTONGAN PONDASI", "1:50"),
                   ("DETAIL SAMBUNGAN LENGAN", "1:10")]
    else:
        titles += [("DETAIL TUMPUAN ATAP", "1:10"), ("DETAIL SAMBUNGAN RANGKA", "1:10")]
    titles += [("DAFTAR PROFIL & CATATAN", "-")]
    data = [("Bidang reklame", f"{o['B']:g} x {o['S']:g} m"), ("Tinggi puncak", f"+{o['zt']:.2f} m"),
            ("Kolom utama", o["sections"].get("COL", o["sections"].get("POST"))["name"]),
            ("Defleksi / batas", f"{o['defl']['dmax']:.0f} / {o['defl']['dlim']:.0f} mm"),
            ("Berat baja (taksiran)", f"{B['baja_kg']:.0f} kg")]
    kop(S, o, "STR", 1, titles, data, "GAMBAR KERJA STRUKTUR")
    export(S, base)

def _site_xy(o):
    """posisi struktur di lahan 10x10 (x sepanjang jalan, y kedalaman; jalan di selatan)"""
    lx, ly = engine.SITE["lahan"]
    return lx/2, (engine.SITE["gsb"]+1.5 if o["typ"] != "rooftop" else engine.SITE["gsb"]+0.6)

def sheet_pbg(o, m, secs, base):
    S = _frame_sheet()
    lx, ly = engine.SITE["lahan"]; gsb = engine.SITE["gsb"]; rum = engine.SITE["rumija"]
    V = View(32, 262, 150)
    # jalan (sebagian)
    S.fill(V.r(-2.2, -8.0, lx+2.2, -1.0), (238, 238, 238))
    S.line([V.p(-2.2, -1.0), V.p(lx+2.2, -1.0)], "WALL")
    S.line([V.p(-2.2, -5.0), V.p(lx+2.2, -5.0)], "THIN", lt="DASHED", ltscale=10)
    S.text("JALAN RAYA (RUMIJA ± 20 m, ILUSTRATIF)", V.X(lx/2), V.Y(-3.0), 2.0, "MC", bold=True)
    S.text("trotoar / saluran", V.X(lx/2), V.Y(-0.5), 1.5, "MC")
    # lahan
    S.rect(*V.p(0, 0), *V.p(lx, ly), "WALL", lt="DASHDOT", ltscale=6)
    S.line([V.p(0, gsb), V.p(lx, gsb)], "THIN", lt="DASHED", ltscale=6)
    S.text(f"GSB {gsb:g} m", V.X(lx)-1, V.Y(gsb)+1.5, 1.5, "BR")
    cx, cy = _site_xy(o)
    if o["typ"] == "rooftop":
        S.fill(V.r(0.5, gsb, lx-0.5, ly-0.5), (225, 225, 225))
        S.rect(*V.p(0.5, gsb), *V.p(lx-0.5, ly-0.5), "WALL")
        S.text("BANGUNAN EKSISTING 2 LT (ATAP DAK +8.00)", V.X(lx/2), V.Y(ly-2), 1.7, "MC")
    xs = [n[0] for n in o["nodes"]]; ys = [n[1] for n in o["nodes"]]
    # jejak bidang reklame & tumpuan
    S.fill(V.r(cx-o["B"]/2, cy+o["yb"]-0.06, cx+o["B"]/2, cy+o["yb"]+0.06), (0, 0, 0))
    for n in o["supports"]:
        p = o["nodes"][int(n)]
        S.circle(V.p(cx+p[0], cy+p[1]), 0.9, "STR")
    if o.get("footing"):
        f = o["footing"]; c0 = np.mean([o["nodes"][int(n)][0] for n in o["supports"]])
        S.rect(*V.p(cx+c0-f["Lx"]/2, cy-f["Ly"]/2), *V.p(cx+c0+f["Lx"]/2, cy+f["Ly"]/2), "HIDDEN", lt="DASHED", ltscale=4)
    S.dim_v(V.X(-1.2), V.Y(0), V.Y(cy+o["yb"]), f"{(cy+o['yb'])*1000:.0f}", ext_from=V.X(cx-o["B"]/2))
    S.dim_h(V.X(0), V.X(lx), V.Y(ly)+4, f"{lx*1000:.0f}", ext_from=V.Y(ly)+1)
    S.dim_v(V.X(lx)+4, V.Y(0), V.Y(ly), f"{ly*1000:.0f}", ext_from=V.X(lx)+1)
    S.text("bidang reklame menghadap jalan (selatan)", V.X(cx), V.Y(cy+o["yb"])-3, 1.5, "TC")
    north(S, V.X(lx)+18, V.Y(ly)-6)
    S.title(28, V.Y(ly)+14, "A1", "SITUASI / RENCANA TAPAK", "SKALA 1 : 150", w=62)
    # tampak depan dengan panel
    sc = _scale_for(o, 160.0, 175.0, pbg=True); k = 1000/sc
    zlow = -(o["footing"]["Df"] if o.get("footing") else 0) if o["typ"] != "rooftop" else o["z0"]-1.6
    yb0 = 40 - zlow*k + 14
    xT = 172 + (o["B"]/2+1.5)*k
    view_elev(S, View(xT, yb0, sc), o, m, secs, "front", (xT-(o["B"]/2+1.5)*k, yb0+o["zt"]*k+18), "A2", "TAMPAK DEPAN", f"SKALA 1 : {sc}", show_panel=True)
    # perspektif aksonometri (wireframe)
    ax0, ay0 = 420, 268
    a1, a2 = math.radians(30), math.radians(150)
    kk = 5.2 if o["typ"] != "rooftop" else 6.0
    def iso(p): return (ax0 + kk*(p[0]*math.cos(a1) + p[1]*math.cos(a2)), ay0 + kk*(p[0]*math.sin(a1) + p[1]*math.sin(a2) + p[2]))
    gz = o["z0"] if o["typ"] == "rooftop" else 0
    base_poly = [(-o["B"]/2-1, -2, gz), (o["B"]/2+1, -2, gz), (o["B"]/2+1, 2, gz), (-o["B"]/2-1, 2, gz)]
    S.line([iso(p) for p in base_poly], "THIN", closed=True)
    pan = [(-o["B"]/2, o["yb"], o["zb"]), (o["B"]/2, o["yb"], o["zb"]), (o["B"]/2, o["yb"], o["zt"]), (-o["B"]/2, o["yb"], o["zt"])]
    for mb in o["members"]:
        S.line([iso(o["nodes"][mb["i"]]), iso(o["nodes"][mb["j"]])], "STR")
    S.fill([iso(p) for p in pan], (226, 226, 226)); S.line([iso(p) for p in pan], "WALL", closed=True)
    S.text("bidang reklame", *iso((0, o["yb"], (o["zb"]+o["zt"])/2)), 1.8, "MC")
    S.title(352, 392, "A3", "PERSPEKTIF STRUKTUR", "TANPA SKALA", w=52)
    # tabel data reklame
    B = bill(o, secs)
    rows = [["Jenis konstruksi", o["typ_name"]], ["Ukuran bidang", f"{o['B']:g} x {o['S']:g} m"],
            ["Luas bidang reklame", f"{o['B']*o['S']:.0f} m²"], ["Jumlah muka", "1 (satu) muka"],
            ["Tinggi bawah bidang", f"+{o['zb']:.2f} m"], ["Tinggi puncak", f"+{o['zt']:.2f} m"],
            ["Kolom / tiang", o["sections"].get("COL", o["sections"].get("POST"))["name"]],
            ["Berat baja (taksiran)", f"{B['baja_kg']:.0f} kg"],
            ["Pondasi", f"telapak {o['footing']['Lx']:g}x{o['footing']['Ly']:g}x{o['footing']['Hf']:g} m" if o.get("footing") else "angkur kimia ke struktur atap"],
            ["Angin rencana", f"V={engine.WIND['V']:g} m/s, qh={o['wind']['qh']} kPa"]]
    S.text("DATA REKLAME", 352, 196, 2.2, "ML", bold=True)
    yb = table(S, 352, 193, [("URAIAN", 52), ("KETERANGAN", 82)], rows, 1.55, 4.2)
    notes = ["CATATAN:",
             "1. Lembar ini meniru format gambar rencana PBG untuk keperluan portofolio.",
             "2. Lokasi, ukuran lahan, GSB & rumija bersifat ilustratif, bukan hasil survei.",
             "3. Jarak bidang reklame ke batas rumija mengikuti perda setempat (wajib dicek).",
             "4. Perhitungan lengkap & model SAP2000/IFC lihat lampiran STR-01 dan web."]
    for i, s in enumerate(notes):
        S.text(s, 352, yb-6-i*3.6, 1.5 if i else 1.8, "ML", bold=(i == 0))
    titles = [("SITUASI / RENCANA TAPAK", "1:150"), ("TAMPAK DEPAN", f"1:{sc}"), ("PERSPEKTIF STRUKTUR", "-"), ("DATA REKLAME", "-")]
    data = [("Luas lahan (ilustratif)", f"{lx*ly:.0f} m²"), ("Luas bidang reklame", f"{o['B']*o['S']:.0f} m²"),
            ("GSB", f"{gsb:g} m"), ("Tinggi puncak", f"+{o['zt']:.2f} m")]
    kop(S, o, "PBG", 2, titles, data, "GAMBAR RENCANA (FORMAT PBG)")
    export(S, base)

def run(typ, size, od):
    o, m, secs, res = engine.run_variant(typ, size)
    os.makedirs(od, exist_ok=True)
    sheet_str(o, m, secs, os.path.join(od, f"{o['id']}_STR-01"))
    sheet_pbg(o, m, secs, os.path.join(od, f"{o['id']}_PBG-01"))
    return o, bill(o, secs)

if __name__ == "__main__":
    import sys
    o, b = run(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else ".")
    print(o["id"], b["baja_kg"], b["beton"])
