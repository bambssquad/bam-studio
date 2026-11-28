# -*- coding: utf-8 -*-
"""Skenario ekstrem untuk halaman analisis: sapuan kecepatan angin dan gempa SNI 1726.
Profil, pondasi dan angkur dikunci sesuai hasil desain; hanya bebannya yang diubah.
Hasil ditambahkan sebagai kunci "scen" ke data/<id>.json (dipanggil setelah build.py)."""
import os, sys, json, math
import numpy as np
import engine as E

DD = os.path.join(sys.argv[1] if len(sys.argv) > 1 else "../site", "data")
V0 = E.WIND["V"]
SPEEDS = list(range(20, 58, 2))


def members_ratio(m, secs, res, Ls, combos):
    out = []
    for k, e in enumerate(m.M):
        Lb = e["Lb"] or Ls[k]; K = 2.1 if e["g"] == "COL" else 1.0
        r = 0.0
        for cn, fac in combos:
            f = E.combine(res, fac, "f")[k]
            r = max(r, E.check_member(secs[e["g"]], f, Lb, K)[0])
        out.append(r)
    return out


def defl(res, combos):
    d = 0.0
    for fac in combos:
        u = E.combine(res, fac, "u"); d = max(d, float(np.max(np.hypot(u[:, 0], u[:, 1]))))
    return d * 1000


def footing_check(m, res, fd, base, combos):
    """Cek tanah, guling, geser dengan dimensi pondasi terkunci (rumus sama dengan engine.footing)."""
    Df = E.SOIL["Df"]; Lx, Ly, Hf, bp = fd["Lx"], fd["Ly"], fd["Hf"], fd["bp"]; nc = len(base)
    Wc = Lx * Ly * Hf * 24 + nc * bp * bp * (Df - Hf + 0.3) * 24
    Ws = (Lx * Ly - nc * bp * bp) * (Df - Hf) * E.SOIL["gamma"]
    q = 0; fs = 99; fss = 99
    for cn, fac in combos:
        R = E.combine(res, fac, "R")
        P = sum(R[n][2] for n in base); Vy = sum(R[n][1] for n in base); Vx = sum(R[n][0] for n in base)
        Mx = sum(-R[n][3] for n in base) + Vy * (Df + 0.3)
        f = 0.6 if cn.startswith("F2") else 1.0
        N = P + f * (Wc + Ws); e = abs(Mx) / N
        if cn.startswith("F2"):
            fs = min(fs, N * Ly / 2 / max(abs(Mx), 1e-9))
            fss = min(fss, E.SOIL["mu"] * N / max(math.hypot(Vx, Vy), 1e-9))
        else:
            qq = N / (Lx * Ly) * (1 + 6 * e / Ly) if e <= Ly / 6 else (2 * N / (3 * Lx * (Ly / 2 - e)) if e < Ly / 2 else 9999)
            q = max(q, qq)
    return q, fs, fss


def anchor_check(m, res, anc, groups, combos):
    worst = 0.0
    for nm, nodes in groups.items():
        a = anc.get(nm)
        if not a: continue
        As = 0.78 * math.pi * a["d"] ** 2 / 4
        for fac in combos:
            R = E.combine(res, fac, "R")
            for n in nodes:
                tb = max(-R[n][2], 0) / 4; vb = math.hypot(R[n][0], R[n][1]) / 4
                r = (tb * 1e3 / (0.75 * 0.75 * 500 * As)) ** 2 + (vb * 1e3 / (0.75 * 0.45 * 500 * As)) ** 2
                worst = max(worst, r)
    return worst  # batas desain engine 0,6; batas kapasitas 1,0


def lrfd(k):
    return [(cn, {kk: (v * k if kk.startswith("W") else v) for kk, v in fac.items()}) for cn, cd, fac in E.COMBOS]


def run(typ, size):
    o, _, _, _ = E.run_variant(typ, size)
    m, secs, res, Ls, ratios, mdet, dfl, wind, sel, hist = E.analyze(typ, size)
    # beban gempa: gaya lateral = koefisien x berat mati di tiap titik (arah y, sama dengan angin)
    coef = min(1.6 * E.SDS, 0.4 * 1.0 * E.SDS * 3 / 2.5) if typ == "rooftop" else E.SDS / 3.0
    PE = np.zeros((len(m.N), 6))
    PD, _ = E.load_cases(m); E.add_selfweight_and_colwind(m, PD, secs)
    PE[:, 1] = coef * (-PD["D"][:, 2])
    res["E"] = E.solve(m, secs, {"E": PE})[0]["E"]
    sd = 0.2 * E.SDS
    eq_lrfd = [("G1", {"D": 1.2 + sd, "E": 1.0, "L": 1.0}), ("G2", {"D": 0.9 - sd, "E": 1.0})]
    eq_asd = [("F1E", {"D": 1.0 + 0.14 * E.SDS, "E": 0.7}), ("F2E", {"D": 0.6 - 0.14 * E.SDS, "E": 0.7})]
    eq_serv = [{"D": 1.0, "E": 0.7}]

    base = [int(n) for n in o["supports"]]
    if typ == "rooftop":
        posts = [n for n in m.sup if abs(m.N[n][1] - m.yb) < 1e-6]
        groups = {"kolom": posts, "strut": [n for n in m.sup if n not in posts]}

    def found(k=None, eq=False):
        if typ == "rooftop":
            combos = [f for _, f in eq_lrfd] if eq else [f for _, f in lrfd(k)]
            return dict(angkur=round(anchor_check(m, res, o["anchors"], groups, combos), 3))
        if eq: combos = eq_asd
        else: combos = [(cn, {kk: (v * k if kk.startswith("W") else v) for kk, v in fac.items()}) for cn, cd, fac in E.ASD]
        q, fs, fss = footing_check(m, res, o["footing"], base, combos)
        return dict(qmax=round(q, 1), FS_guling=round(fs, 2), FS_geser=round(fss, 2))

    sweep = []
    for V in SPEEDS:
        k = (V / V0) ** 2
        r = members_ratio(m, secs, res, Ls, lrfd(k))
        d = defl(res, [{kk: (v * k if kk.startswith("W") else v) for kk, v in fac.items()} for cn, cd, fac in E.SERV])
        sweep.append(dict(V=V, r=[round(x, 3) for x in r], dmax=round(d, 1), **found(k)))
    # cek: V desain harus sama dengan hasil desain
    s36 = next(s for s in sweep if s["V"] == V0)
    assert abs(max(s36["r"]) - max(x["ratio"] for x in o["members"])) < 0.01, (typ, size, max(s36["r"]))
    req = members_ratio(m, secs, res, Ls, eq_lrfd)
    eq = dict(coef=round(coef, 3), SDS=E.SDS, r=[round(x, 3) for x in req], dmax=round(defl(res, eq_serv), 1),
              F=round(float(PE[:, 1].sum()), 1), **found(eq=True))
    return o["id"], dict(V0=V0, speeds=SPEEDS, sweep=sweep, eq=eq,
                         note="Profil, pondasi dan angkur dikunci sesuai desain; beban angin diskalakan (V/V0)^2; gempa = koef x berat mati, arah y.")


if __name__ == "__main__":
    for typ in E.TYPES:
        for size in E.SIZES:
            vid, sc = run(typ, size)
            p = os.path.join(DD, f"{vid}.json")
            d = json.load(open(p, encoding="utf-8")); d["scen"] = sc
            json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            first = next((s["V"] for s in sc["sweep"] if max(s["r"]) > 1), None)
            print(vid, "rasio maks gempa", max(sc["eq"]["r"]), "batang lewat 1,0 pada V =", first)
