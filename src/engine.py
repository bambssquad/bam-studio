# -*- coding: utf-8 -*-
"""Studi desain reklame baja: geometri, beban angin SNI 1727:2020 (ASCE 7-16 Bab 29),
analisis rangka 3D (matriks kekakuan), cek LRFD SNI 1729:2020 (AISC 360-16), base plate,
angkur, pondasi telapak. Satuan: kN, m (kecuali dinyatakan)."""
import math, json
import numpy as np

E = 200e6; G = 77e6; RHO = 78.5  # kPa, kPa, kN/m3
FY_HSS = 245e3; FY_PL = 250e3; FU_PL = 410e3
FC = 25.0; FYR = 420.0  # MPa beton & BJTS

SITE = dict(nama="Jl. Raya Waru, dekat Bundaran Aloha, Sidoarjo", lat=-7.3466, lon=112.7286,
            ket="Lokasi ilustratif untuk studi desain portofolio (bukan lahan yang disurvei / bukan permohonan izin).",
            lahan=(16.0, 12.0), gsb=3.0, rumija=20.0, roof_z=8.0)
WIND = dict(V=36.0, exposure="C", Kzt=1.0, Kd=0.85, G=0.85, risk="II", Cf_col=1.2)
LOADS = dict(board_D=0.35, walk_D=0.40, walk_L=1.20)  # kPa panel, kN/m catwalk
SOIL = dict(qa=100.0, gamma=18.0, Df=1.8, mu=0.35)
SDS = 0.60

SIZES = {"4x8": (8.0, 4.0), "5x10": (10.0, 5.0), "6x12": (12.0, 6.0)}
TYPES = {"unipole": "Unipole (tiang tunggal)", "doublepole": "Tiang ganda", "rooftop": "Di atas atap (rooftop)"}

# ---------- katalog (mm) ----------
CHS = [(114.3,6),(139.8,6),(165.2,7),(216.3,8),(267.4,9),(318.5,9),(355.6,10),(406.4,10),(457.2,12),
       (508,12),(558.8,12),(609.6,14),(660.4,14),(711.2,16),(762,16),(812.8,16),(914.4,19),(1016,19)]
BRC = [(60.5,3.2),(76.3,3.2),(89.1,4),(114.3,4.5),(139.8,5),(165.2,6),(216.3,7)]
RHS = [(100,50,3.2),(125,75,4),(150,100,4.5),(200,100,6),(250,150,6),(300,200,8),(350,250,9),(400,200,9),(400,300,12)]
SHS = [(100,100,4),(125,125,5),(150,150,6),(175,175,6),(200,200,8),(250,250,9),(300,300,12),(350,350,12)]

def sec_props(kind, d):
    """kembalikan dict properti (m) ; d dalam mm"""
    if kind in ("CHS", "BRC"):
        D, t = d[0]/1e3, d[1]/1e3; ri = D/2-t
        A = math.pi*((D/2)**2-ri**2); I = math.pi/4*((D/2)**4-ri**4)
        Z = (D**3-(D-2*t)**3)/6; S = I/(D/2)
        return dict(kind="CHS", name=f"CHS {d[0]:g}x{d[1]:g}", D=D, t=t, A=A, Iy=I, Iz=I, J=2*I,
                    Zy=Z, Zz=Z, Sy=S, Sz=S, ry=math.sqrt(I/A), rz=math.sqrt(I/A), w=A*RHO, h=D, b=D)
    h, b, t = d[0]/1e3, d[1]/1e3, d[2]/1e3  # h sejajar sumbu lokal y
    A = b*h-(b-2*t)*(h-2*t)
    Iz = (b*h**3-(b-2*t)*(h-2*t)**3)/12; Iy = (h*b**3-(h-2*t)*(b-2*t)**3)/12
    Zz = b*h**2/4-(b-2*t)*(h-2*t)**2/4; Zy = h*b**2/4-(h-2*t)*(b-2*t)**2/4
    Am = (b-t)*(h-t); J = 4*Am**2*t/(2*(b-t)+2*(h-t))
    nm = ("SHS" if d[0] == d[1] else "RHS") + f" {d[0]:g}x{d[1]:g}x{d[2]:g}"
    return dict(kind="RHS", name=nm, h=h, b=b, t=t, A=A, Iy=Iy, Iz=Iz, J=J, Zy=Zy, Zz=Zz,
                Sy=Iy/(b/2), Sz=Iz/(h/2), ry=math.sqrt(Iy/A), rz=math.sqrt(Iz/A), w=A*RHO)

CATS = {"CHS": ("CHS", CHS), "BRC": ("BRC", BRC), "RHS": ("RHS", RHS), "SHS": ("RHS", SHS)}

# ---------- angin ----------
def Kz(z):
    a, zg = 9.5, 274.32
    return 2.01*(max(z, 4.57)/zg)**(2/a)

def qz(z):
    return 0.613*Kz(z)*WIND["Kzt"]*WIND["Kd"]*WIND["V"]**2/1000.0  # kPa

BS = [0.05,0.1,0.2,0.5,1,2,4,5,10,20,30,45]
SH = [1.0,0.9,0.7,0.5,0.3,0.2,0.16]
CFT = [[1.80,1.70,1.65,1.55,1.45,1.40,1.35,1.35,1.30,1.30,1.30,1.30],
       [1.85,1.75,1.70,1.60,1.55,1.50,1.45,1.45,1.40,1.40,1.40,1.40],
       [1.90,1.85,1.75,1.70,1.65,1.60,1.60,1.55,1.55,1.55,1.55,1.55],
       [1.95,1.85,1.80,1.75,1.75,1.70,1.70,1.70,1.70,1.70,1.70,1.75],
       [1.95,1.90,1.85,1.80,1.80,1.80,1.80,1.80,1.80,1.85,1.85,1.85],
       [1.95,1.90,1.85,1.80,1.80,1.80,1.80,1.80,1.85,1.90,1.90,1.95],
       [1.95,1.90,1.85,1.85,1.80,1.80,1.85,1.85,1.85,1.90,1.90,1.95]]

def Cf_AB(Bs, sh):
    row = lambda r: float(np.interp(Bs, BS, CFT[r]))
    sh = min(max(sh, 0.16), 1.0)
    vals = [row(i) for i in range(len(SH))]
    return float(np.interp(sh, SH[::-1], vals[::-1]))

def Cf_C(sh):
    """Gbr 29.3-1 Kasus C untuk B/s = 2: 0..s = 2.25, s..2s = 1.50; faktor reduksi bila s/h > 0.8"""
    red = 1.0 if sh <= 0.8 else (1.8-sh)
    return [2.25*red, 1.50*red]

# ---------- geometri ----------
class Model:
    def __init__(s): s.N = []; s.M = []; s.sup = {}; s.groups = {}
    def node(s, x, y, z, tag=""):
        for i, n in enumerate(s.N):
            if abs(n[0]-x) < 1e-6 and abs(n[1]-y) < 1e-6 and abs(n[2]-z) < 1e-6: return i
        s.N.append([x, y, z, tag]); return len(s.N)-1
    def mem(s, i, j, grp, vy=(0, 1, 0), Lb=None, role=""):
        s.M.append(dict(i=i, j=j, g=grp, vy=vy, Lb=Lb, role=role)); return len(s.M)-1
    def line(s, a, b, n, grp, vy=(0, 1, 0), Lb=None, role=""):
        pts = [s.node(*(np.array(a)+(np.array(b)-np.array(a))*k/n)) for k in range(n+1)]
        for k in range(n): s.mem(pts[k], pts[k+1], grp, vy, Lb, role)
        return pts

def geometry(typ, size):
    B, S = SIZES[size]
    m = Model(); m.B, m.S, m.typ, m.size = B, S, typ, size
    nb = max(4, int(math.ceil(B/2.0)));  nb += nb % 2  # jumlah bentang vertikal (genap)
    xs = [-B/2+B*k/nb for k in range(nb+1)]
    if typ == "rooftop":
        z0 = SITE["roof_z"]; zb = z0+1.5; yb = -0.15
    else:
        z0 = 0.0; zb = 8.0; yb = -0.70
    zt = zb+S; zm = zb+S/2
    m.z0, m.zb, m.zt, m.yb, m.xs = z0, zb, zt, yb, xs
    lv = [zb, zm, zt]
    # rangka papan: rel horizontal (RAIL) & tiang papan (STUD)
    for z in lv:
        for k in range(nb): m.mem(m.node(xs[k], yb, z), m.node(xs[k+1], yb, z), "RAIL", (0, 1, 0), role="rel")
    for x in xs:
        for a, b in ((zb, zm), (zm, zt)): m.mem(m.node(x, yb, a), m.node(x, yb, b), "STUD", (0, 1, 0), role="tiang papan")
    if typ in ("unipole", "doublepole"):
        zc = zb+0.75*S
        cols = [0.0] if typ == "unipole" else [-0.275*B, 0.275*B]
        # pastikan ada tiang papan di posisi kolom
        for xc in cols:
            if not any(abs(xc-x) < 1e-6 for x in xs):
                for a, b in ((zb, zm), (zm, zt)): m.mem(m.node(xc, yb, a), m.node(xc, yb, b), "STUD", (0, 1, 0), role="tiang papan")
                for z in lv:  # pecah rel di xc
                    for k, mm in enumerate(list(m.M)):
                        if mm["g"] == "RAIL":
                            pi, pj = m.N[mm["i"]], m.N[mm["j"]]
                            if abs(pi[2]-z) < 1e-6 and pi[0] < xc < pj[0]:
                                nc = m.node(xc, yb, z); jj = mm["j"]; mm["j"] = nc
                                m.mem(nc, jj, "RAIL", (0, 1, 0), role="rel")
        m.cols = cols; m.zc = zc
        for xc in cols:
            levels = sorted(set([0.0, 2.0, 4.0, 6.0, zb-1.2, zb, zm, zc]))
            levels = [z for z in levels if z <= zc+1e-9]
            pts = [m.node(xc, 0.0, z) for z in levels]
            for k in range(len(pts)-1): m.mem(pts[k], pts[k+1], "COL", (1, 0, 0), Lb=zc, role="kolom")
            m.sup[pts[0]] = "fixed"
            for z in (zb, zc if typ == "unipole" else zm):
                zz = z if z != zc else zm+0.0
            for z in (zb, zm):  # lengan (stub) kolom -> rangka papan
                m.mem(m.node(xc, 0.0, z), m.node(xc, yb, z), "ARM", (0, 0, 1), role="lengan")
            # stub atas di zc ke rel tengah-atas: tiang papan di zc dibuat node
            # kicker diagonal kolom -> ujung rel bawah & atas
        for xc in cols:
            side = [(-1, -B/2), (1, B/2)] if typ == "unipole" else ([(-1, -B/2)] if xc < 0 else [(1, B/2)])
            for sg, xe in side:
                xk = xc+0.62*(xe-xc)
                xk = min(xs, key=lambda x: abs(x-xk))
                m.mem(m.node(xc, 0.0, zb-1.2), m.node(xk, yb, zb), "KICK", (0, 0, 1), role="kicker")
                m.mem(m.node(xc, 0.0, zc), m.node(xk, yb, zt), "KICK", (0, 0, 1), role="kicker")
        # tumpuan lantai kerja (catwalk) tidak dimodelkan sbg elemen (beban saja)
    else:
        # rooftop: rangka segitiga tiap tiang papan (pakai semua xs bila <=2.5 m)
        H = zt-z0; d = round(0.55*H, 2); zs = z0+0.72*H
        m.posts = xs; m.d = d; m.zs = zs
        for x in xs:
            p0 = m.node(x, yb, z0); m.sup[p0] = "pin"
            m.mem(p0, m.node(x, yb, zb), "POST", (0, 1, 0), Lb=zb-z0, role="kolom rooftop")
            r0 = m.node(x, yb+d, z0); m.sup[r0] = "pin"
            m.mem(r0, m.node(x, yb, zs), "STRUT", (0, 0, 1), role="strut belakang")
        # rel tengah sudah ada; titik zs pada tiang papan: pecah STUD
        for mm in list(m.M):
            if mm["g"] == "STUD":
                pi, pj = m.N[mm["i"]], m.N[mm["j"]]
                if pi[2] < zs < pj[2]:
                    nc = m.node(pi[0], yb, zs); jj = mm["j"]; mm["j"] = nc
                    m.mem(nc, jj, "STUD", (0, 1, 0), role="tiang papan")
        for mm in m.M:
            if mm["g"] == "STUD": mm["g"] = "POST"; mm["role"] = "kolom rooftop"; mm["Lb"] = None
        # bracing diagonal bidang belakang & bidang tiang (bentang ujung)
        for k in (0, nb-1):
            a, b = xs[k], xs[k+1]
            m.mem(m.node(a, yb+d, z0), m.node(b, yb, zs), "BRACE", (0, 0, 1), role="bracing")
            m.mem(m.node(b, yb+d, z0), m.node(a, yb, zs), "BRACE", (0, 0, 1), role="bracing")
            m.mem(m.node(a, yb, z0), m.node(b, yb, zb), "BRACE", (0, 0, 1), role="bracing")
            m.mem(m.node(b, yb, z0), m.node(a, yb, zb), "BRACE", (0, 0, 1), role="bracing")
    return m

GROUP_CAT = {"COL": "CHS", "RAIL": "RHS", "STUD": "RHS", "ARM": "RHS", "KICK": "BRC",
             "POST": "SHS", "STRUT": "BRC", "BRACE": "BRC"}
GROUP_NAME = {"COL": "Kolom utama", "RAIL": "Rel horizontal papan", "STUD": "Tiang rangka papan",
              "ARM": "Lengan kolom-rangka", "KICK": "Kicker diagonal", "POST": "Kolom rooftop",
              "STRUT": "Strut belakang", "BRACE": "Bracing"}

# ---------- beban (kasus dasar) ----------
def board_nodes(m):
    return [i for i, n in enumerate(m.N) if abs(n[1]-m.yb) < 1e-6 and m.zb-1e-6 <= n[2] <= m.zt+1e-6]

def trib(vals, v):
    vals = sorted(set(round(x, 6) for x in vals)); i = vals.index(round(v, 6))
    lo = (vals[i]-vals[i-1])/2 if i > 0 else 0.0
    hi = (vals[i+1]-vals[i])/2 if i < len(vals)-1 else 0.0
    return lo, hi

def load_cases(m):
    B, S = m.B, m.S; nN = len(m.N)
    h = m.zt; sh = S/h; Bs = B/S
    cfab = Cf_AB(Bs, sh); cfc = Cf_C(sh)
    qh = qz(m.zt)
    P = {k: np.zeros((nN, 6)) for k in ("D", "L", "WA", "WB", "WC")}
    bn = board_nodes(m)
    xs_all = sorted(set(m.N[i][0] for i in bn)); zs_all = sorted(set(round(m.N[i][2], 6) for i in bn))
    zs_rail = [m.zb, m.zb+S/2, m.zt]
    for i in bn:
        x, y, z = m.N[i][:3]
        if not any(abs(z-zr) < 1e-6 for zr in zs_rail): continue
        lx, hx = trib(xs_all, x); lz, hz = trib(zs_rail, z)
        A = (lx+hx)*(lz+hz)
        P["D"][i, 2] -= LOADS["board_D"]*A
        # angin arah -y (dari depan ke belakang papan, papan menghadap -y)
        P["WA"][i, 1] += qh*WIND["G"]*cfab*A
        k = 2.4/B
        P["WB"][i, 1] += qh*WIND["G"]*cfab*A*(1+k*x)
        # Kasus C: region dari tepi kiri (x=-B/2)
        xl = x+B/2; f = 0.0
        for a0, a1, c in ((0, S, cfc[0]), (S, 2*S, cfc[1])):
            seg = max(0.0, min(x+hx, -B/2+a1)-max(x-lx, -B/2+a0)); f += seg*c
        P["WC"][i, 1] += qh*WIND["G"]*f*(lz+hz)
        if abs(z-m.zb) < 1e-6:
            P["D"][i, 2] -= LOADS["walk_D"]*(lx+hx)
            P["L"][i, 2] -= LOADS["walk_L"]*(lx+hx)
    return P, dict(qh=qh, Kz=Kz(m.zt), Cf=cfab, CfC=cfc, sh=sh, Bs=Bs, h=h, As=B*S,
                   F_A=qh*WIND["G"]*cfab*B*S, F_C=qh*WIND["G"]*(cfc[0]+cfc[1])*S*S)

def add_selfweight_and_colwind(m, P, secs):
    for e in m.M:
        i, j = e["i"], e["j"]; L = np.linalg.norm(np.subtract(m.N[j][:3], m.N[i][:3]))
        w = secs[e["g"]]["w"]*L*1.15  # +15% sambungan, pelat, cat
        P["D"][i, 2] -= w/2; P["D"][j, 2] -= w/2
        if e["g"] in ("COL", "POST", "STRUT"):
            zi, zj = m.N[i][2], m.N[j][2]; dz = abs(zj-zi)
            if dz < 1e-6: continue
            Dw = secs[e["g"]].get("D", secs[e["g"]].get("b"))
            f = qz((zi+zj)/2)*WIND["G"]*WIND["Cf_col"]*Dw*dz
            for kc in ("WA", "WB", "WC"):
                P[kc][i, 1] += f/2; P[kc][j, 1] += f/2

COMBOS = [("U1", "1,4D", {"D": 1.4}), ("U2", "1,2D+1,6L", {"D": 1.2, "L": 1.6})]
for c in ("A", "B", "C"):
    COMBOS += [(f"U3{c}", f"1,2D+1,0W{c}+L", {"D": 1.2, "W"+c: 1.0, "L": 1.0}),
               (f"U4{c}", f"0,9D+1,0W{c}", {"D": 0.9, "W"+c: 1.0})]
SERV = [(f"S{c}", f"D+0,6W{c}", {"D": 1.0, "W"+c: 0.6}) for c in "ABC"]
ASD = [(f"F1{c}", f"D+0,6W{c}", {"D": 1.0, "W"+c: 0.6}) for c in "ABC"] + \
      [(f"F2{c}", f"0,6D+0,6W{c}", {"D": 0.6, "W"+c: 0.6}) for c in "ABC"]

# ---------- solver rangka 3D ----------
def frame_rot(xi, xj, vy):
    ex = np.subtract(xj, xi); L = np.linalg.norm(ex); ex = ex/L
    v = np.array(vy, float); v = v-np.dot(v, ex)*ex
    if np.linalg.norm(v) < 1e-6:
        v = np.array([1.0, 0, 0]) if abs(ex[0]) < 0.9 else np.array([0, 0, 1.0]); v = v-np.dot(v, ex)*ex
    ey = v/np.linalg.norm(v); ez = np.cross(ex, ey)
    return np.vstack([ex, ey, ez]), L

def kloc(A, Iy, Iz, J, L):
    k = np.zeros((12, 12))
    a = E*A/L; t = G*J/L
    k[0, 0] = k[6, 6] = a; k[0, 6] = k[6, 0] = -a
    k[3, 3] = k[9, 9] = t; k[3, 9] = k[9, 3] = -t
    for (I, v, r, s) in ((Iz, 1, 5, 1), (Iy, 2, 4, -1)):
        c1 = 12*E*I/L**3; c2 = 6*E*I/L**2; c3 = 4*E*I/L; c4 = 2*E*I/L
        vi, ri, vj, rj = v, r, v+6, r+6
        k[vi, vi] = k[vj, vj] = c1; k[vi, vj] = k[vj, vi] = -c1
        k[vi, ri] = k[ri, vi] = s*c2; k[vi, rj] = k[rj, vi] = s*c2
        k[vj, ri] = k[ri, vj] = -s*c2; k[vj, rj] = k[rj, vj] = -s*c2
        k[ri, ri] = k[rj, rj] = c3; k[ri, rj] = k[rj, ri] = c4
    return k

def solve(m, secs, P):
    nN = len(m.N); nd = 6*nN
    K = np.zeros((nd, nd)); cache = []
    for e in m.M:
        s = secs[e["g"]]; R, L = frame_rot(m.N[e["i"]][:3], m.N[e["j"]][:3], e["vy"])
        T = np.kron(np.eye(4), R); kl = kloc(s["A"], s["Iy"], s["Iz"], s["J"], L)
        kg = T.T@kl@T; dof = list(range(6*e["i"], 6*e["i"]+6))+list(range(6*e["j"], 6*e["j"]+6))
        K[np.ix_(dof, dof)] += kg; cache.append((T, kl, dof, L))
    fixed = []
    for n, t in m.sup.items():
        fixed += [6*n+k for k in (range(6) if t == "fixed" else range(3))]
    # titik yang hanya terhubung sendi: kunci rotasi bebas yang tak berkekakuan
    free = [d for d in range(nd) if d not in fixed]
    diag = np.diag(K)
    for d in free:
        if abs(diag[d]) < 1e-9: K[d, d] = 1.0
    out = {}
    Kff = K[np.ix_(free, free)]
    for name, F in P.items():
        f = F.reshape(-1); u = np.zeros(nd); u[free] = np.linalg.solve(Kff, f[free])
        r = K@u-f
        forces = [kl@(T@u[dof]) for (T, kl, dof, L) in cache]
        out[name] = dict(u=u.reshape(-1, 6), R={n: r[6*n:6*n+6] for n in m.sup}, f=np.array(forces))
    return out, [c[3] for c in cache]

def combine(res, fac, key):
    acc = None
    for k, v in fac.items():
        x = res[k][key] if not isinstance(res[k][key], dict) else None
        if key == "R":
            x = {n: v*res[k]["R"][n] for n in res[k]["R"]}
            acc = x if acc is None else {n: acc[n]+x[n] for n in acc}
        else:
            acc = v*res[k][key] if acc is None else acc+v*res[k][key]
    return acc

# ---------- cek LRFD ----------
def Fcr_flex(KL_r, Fy, Q=1.0):
    if KL_r < 1e-6: return Q*Fy
    Fe = math.pi**2*E/KL_r**2; QF = Q*Fy
    return QF*0.658**(QF/Fe) if KL_r <= 4.71*math.sqrt(E/QF) else 0.877*Fe

def capacity(s, Lb, K):
    Fy = FY_HSS
    if s["kind"] == "CHS":
        Dt = s["D"]/s["t"]
        Q = 1.0 if Dt <= 0.11*E/Fy else 0.038*E/(Fy*Dt)+2/3
        Pc = 0.9*Fcr_flex(K*Lb/s["ry"], Fy, Q)*s["A"]
        if Dt <= 0.07*E/Fy: Mn = Fy*s["Zy"]
        else: Mn = (0.021*E/Dt+Fy)*s["Sy"]
        Fcrt = min(max(1.23*E/(math.sqrt(max(Lb, 0.1)/s["D"])*Dt**1.25), 0.60*E/Dt**1.5), 0.6*Fy)
        C = math.pi*(s["D"]-s["t"])**2*s["t"]/2
        return dict(Pc=Pc, Pt=0.9*Fy*s["A"], Mcy=0.9*Mn, Mcz=0.9*Mn, Vc=0.9*Fcrt*s["A"]/2, Tc=0.9*Fcrt*C,
                    cls="kompak" if Dt <= 0.07*E/Fy else "nonkompak")
    h, b, t = s["h"], s["b"], s["t"]
    lam = max((h-3*t)/t, (b-3*t)/t); lr = 1.40*math.sqrt(E/Fy)
    Q = 1.0 if lam <= lr else max(0.5, lr/lam)
    r = min(s["ry"], s["rz"])
    Pc = 0.9*Fcr_flex(K*Lb/r, Fy, Q)*s["A"]
    lp = 1.12*math.sqrt(E/Fy)
    def Mn(Z, S, bb):
        l = (bb-3*t)/t
        if l <= lp: return Fy*Z
        return max(Fy*S, Fy*Z-(Fy*Z-Fy*S)*(3.57*l*math.sqrt(Fy/E)-4.0))
    Aw = 2*h*t; Vc = 0.9*0.6*Fy*Aw
    Am = (b-t)*(h-t); Tc = 0.9*0.6*Fy*2*Am*t
    return dict(Pc=Pc, Pt=0.9*Fy*s["A"], Mcz=0.9*Mn(s["Zz"], s["Sz"], b), Mcy=0.9*Mn(s["Zy"], s["Sy"], h),
                Vc=Vc, Tc=Tc, cls="kompak" if lam <= lp else "nonkompak")

def check_member(s, f, Lb, K):
    """f: gaya ujung lokal (12) dari kombinasi LRFD"""
    c = capacity(s, Lb, K)
    worst = 0; det = None
    for end in (0, 6):
        N = -f[end] if end == 0 else f[end]  # tarik +
        Vy, Vz, Tq, My, Mz = f[end+1], f[end+2], f[end+3], f[end+4], f[end+5]
        Pr = abs(N); Pcap = c["Pt"] if N > 0 else c["Pc"]
        if s["kind"] == "CHS":
            Mr = math.hypot(My, Mz); Vr = math.hypot(Vy, Vz)
            r = Pr/Pcap+Mr/c["Mcy"]+(Vr/c["Vc"]+abs(Tq)/c["Tc"])**2
            if Pr/Pcap+Mr/c["Mcy"] < 0.2:
                r = Pr/(2*Pcap)+Mr/c["Mcy"]+(Vr/c["Vc"]+abs(Tq)/c["Tc"])**2
        else:
            pr = Pr/Pcap; mr = abs(My)/c["Mcy"]+abs(Mz)/c["Mcz"]
            r = pr+8/9*mr if pr >= 0.2 else pr/2+mr
            r = max(r, (abs(Vy)+abs(Vz))/c["Vc"]+abs(Tq)/c["Tc"])
        if r > worst: worst = r; det = dict(N=N, My=My, Mz=Mz, V=math.hypot(Vy, Vz), T=Tq)
    return worst, det, c

def analyze(typ, size, sel=None):
    m = geometry(typ, size)
    groups = sorted(set(e["g"] for e in m.M))
    if sel is None:
        sel = {g: 0 for g in groups}
        if "COL" in sel: sel["COL"] = 6 if typ == "unipole" else 3
    hist = []
    for it in range(80):
        secs = {g: sec_props(CATS[GROUP_CAT[g]][0], CATS[GROUP_CAT[g]][1][sel[g]]) for g in groups}
        P, wind = load_cases(m); add_selfweight_and_colwind(m, P, secs)
        res, Ls = solve(m, secs, P)
        ratios = {g: 0.0 for g in groups}; mdet = []
        for k, e in enumerate(m.M):
            Lb = e["Lb"] or Ls[k]; K = 2.1 if e["g"] == "COL" else 1.0
            best = (0, None, None, None)
            for cn, cd, fac in COMBOS:
                f = combine(res, fac, "f")[k]
                r, det, cap = check_member(secs[e["g"]], f, Lb, K)
                if r > best[0]: best = (r, cn, det, cap)
            ratios[e["g"]] = max(ratios[e["g"]], best[0]); mdet.append(best)
        # lendutan layan
        top = max(range(len(m.N)), key=lambda i: m.N[i][2])
        dmax = 0
        for cn, cd, fac in SERV:
            u = combine(res, fac, "u"); dmax = max(dmax, float(np.max(np.hypot(u[:, 0], u[:, 1]))))
        dlim = (m.zt-m.z0)/100
        bump = [g for g in groups if ratios[g] > 0.95]
        if dmax > dlim:
            bump.append("COL" if "COL" in groups else "STRUT")
        bump = [g for g in set(bump) if sel[g] < len(CATS[GROUP_CAT[g]][1])-1]
        hist.append(dict(it=it, sel=dict(sel), worst=max(ratios.values()), d=dmax))
        if not bump: break
        for g in bump: sel[g] += 1
    return m, secs, res, Ls, ratios, mdet, dict(dmax=dmax, dlim=dlim), wind, sel, hist

# ---------- base plate, angkur ----------
ANCH = [24, 30, 36, 42, 48, 56]; NB = [8, 12, 16, 20, 24]
PLT = [20, 25, 30, 32, 36, 40, 45, 50, 55, 60, 70]

def baseplate(s, R_list):
    """R_list: list reaksi tumpuan (Fx,Fy,Fz,Mx,My,Mz) kombinasi LRFD"""
    D = s["D"]*1e3
    for d in ANCH:
        Ab = math.pi*d**2/4*0.78  # luas tegangan ulir
        for n in NB:
            Db = D+4*d+80; Dp = Db+3.5*d
            worst = 0; gov = None
            for (cn, R) in R_list:
                M = math.hypot(R[3], R[4])*1e6; P = R[2]*1e3; V = math.hypot(R[0], R[1])*1e3; T = abs(R[5])*1e6
                tmax = 4*M/(n*Db)-P/n; vb = V/n+2*T/(n*Db)
                ft = max(tmax, 0)/(0.75*0.75*517*Ab); fv = vb/(0.75*0.45*517*Ab)
                r = ft**2+fv**2
                if r > worst: worst = r; gov = (cn, tmax/1e3, vb/1e3)
            if worst <= 1.0:
                T = max(gov[1], 1.0)*1e3; c = (Db-D)/2-0.0; beff = min(math.pi*Db/n, 2*c+d)
                treq = math.sqrt(4*T*c/(0.9*250*beff))
                tp = next(t for t in PLT if t >= treq)
                hef = max(15*d, 450)
                Asr = (gov[1]*n/2*1e3)/(0.75*FYR)  # tulangan pedestal sbg anchor reinforcement
                return dict(d=d, n=n, Db=round(Db), Dp=round(Dp/10)*10, tp=tp, treq=round(treq, 1), ratio=round(worst, 3),
                            gov=gov[0], Tu=round(gov[1], 1), Vu=round(gov[2], 1), hef=hef, As_ped=round(Asr),
                            grade="ASTM F1554 Gr.55", stiff=n, stiff_t=max(12, int(tp*0.6)))
    return None

def footing(R_asd, R_lrfd, bp, ped_h, typ, cols_x):
    """R: dict combo -> list (x, R6) per kolom. Pondasi telapak (tunggal / gabungan)"""
    Df = SOIL["Df"]
    Lx_min = (max(cols_x)-min(cols_x))+bp+2.0 if len(cols_x) > 1 else 0
    for L in np.arange(2.0, 14.01, 0.25):
        Lx = max(L, Lx_min) if len(cols_x) > 1 else L; Ly = L
        for Hf in (0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2):
            Wc = Lx*Ly*Hf*24 + len(cols_x)*bp*bp*(Df-Hf+0.3)*24
            Ws = (Lx*Ly-len(cols_x)*bp*bp)*(Df-Hf)*SOIL["gamma"]
            ok = True; qmax_s = 0; fs_min = 99; fss_min = 99
            for cn, lst in R_asd.items():
                P = sum(r[2] for x, r in lst); Vy = sum(r[1] for x, r in lst); Vx = sum(r[0] for x, r in lst)
                Mx = sum(-r[3] for x, r in lst)+Vy*(Df+0.3)  # guling thd sumbu x akibat angin y
                fac = 0.6 if cn.startswith("F2") else 1.0
                N = P+fac*(Wc+Ws); e = abs(Mx)/N
                if e <= Ly/6: q = N/(Lx*Ly)*(1+6*e/Ly)
                elif e < Ly/2: q = 2*N/(3*Lx*(Ly/2-e))
                else: q = 1e9
                if cn.startswith("F2"):
                    fs = N*Ly/2/max(abs(Mx), 1e-9); fs_min = min(fs_min, fs)
                    fss_min = min(fss_min, SOIL["mu"]*N/max(math.hypot(Vx, Vy), 1e-9))
                else: qmax_s = max(qmax_s, q)
            if qmax_s <= SOIL["qa"] and fs_min >= 1.5 and fss_min >= 1.5:
                # desain beton (LRFD)
                d = Hf-0.075-0.016
                qu = 0; Pu_max = 0
                for cn, lst in R_lrfd.items():
                    P = sum(r[2] for x, r in lst); Vy = sum(r[1] for x, r in lst)
                    Mx = sum(-r[3] for x, r in lst)+Vy*(Df+0.3)
                    N = P+(0.9 if cn.startswith("U4") else 1.2)*(Wc+Ws); e = abs(Mx)/N
                    q = N/(Lx*Ly)*(1+6*e/Ly) if e <= Ly/6 else (2*N/(3*Lx*(Ly/2-e)) if e < Ly/2 else 1e9)
                    qu = max(qu, q); Pu_max = max(Pu_max, N)
                c = (Ly-bp)/2
                Mu = qu*c**2/2  # kNm/m
                Vu = qu*max(c-d, 0)
                phiVc = 0.75*0.17*math.sqrt(FC)*1000*d  # kN/m
                if Vu > phiVc: continue
                As = max(Mu*1e6/(0.9*FYR*0.9*d*1e3), 0.0018*1000*Hf*1e3)  # mm2/m
                bar = 19 if As < 2600 else 22
                Ab = math.pi*bar**2/4; sp = min(250, int(1000*Ab/As/25)*25)
                if sp < 100: continue
                # geser pons (dua arah) di sekeliling pedestal, per kolom
                pu_col = max(max(r[2] for x, r in lst) for lst in R_lrfd.values())*1.0 + bp*bp*(Df-Hf+0.3)*24*1.2
                b0 = 4*(bp+d); Ap = (bp+d)**2
                Vp = max(pu_col - (Pu_max/(Lx*Ly))*Ap, 0)
                phiVp = 0.75*0.33*math.sqrt(FC)*b0*d*1000
                if Vp > phiVp: continue
                vol = Lx*Ly*Hf+len(cols_x)*bp*bp*(Df-Hf+0.3)
                return dict(Lx=round(float(Lx), 2), Ly=round(float(Ly), 2), Hf=Hf, Df=Df, bp=bp, qmax=round(qmax_s, 1),
                            FS_guling=round(fs_min, 2), FS_geser=round(fss_min, 2), qu=round(qu, 1), Mu=round(Mu, 1),
                            Vu=round(Vu, 1), phiVc=round(phiVc, 1), Vpons=round(Vp, 1), phiVpons=round(phiVp, 1), As=round(As), bar=f"D{bar}-{sp}", vol=round(vol, 2),
                            rebar_kg=round(2*As*1e-6*Lx*Ly*7850*1.15+0.5*As*1e-6*Lx*Ly*7850, 0))
    return None

def run_variant(typ, size):
    m, secs, res, Ls, ratios, mdet, defl, wind, sel, hist = analyze(typ, size)
    out = dict(id=f"{typ}-{size}", typ=typ, typ_name=TYPES[typ], size=size, B=m.B, S=m.S, zb=m.zb, zt=m.zt, z0=m.z0, yb=m.yb)
    out["wind"] = {k: (round(v, 3) if isinstance(v, float) else [round(x, 3) for x in v]) for k, v in wind.items()}
    out["sections"] = {g: dict(name=s["name"], kind=s["kind"], w=round(s["w"]/9.81*1000, 1), group=GROUP_NAME[g],
                               ratio=round(ratios[g], 3),
                               dims=([round(s["D"]*1e3, 1), round(s["t"]*1e3, 1)] if s["kind"] == "CHS"
                                     else [round(s["h"]*1e3, 1), round(s["b"]*1e3, 1), round(s["t"]*1e3, 1)]))
                       for g, s in secs.items()}
    out["defl"] = {k: round(v*1000, 1) for k, v in defl.items()}
    out["iter"] = len(hist)
    # anggota (geometri + rasio)
    out["nodes"] = [[round(n[0], 4), round(n[1], 4), round(n[2], 4)] for n in m.N]
    out["members"] = []
    for k, e in enumerate(m.M):
        r, cn, det, cap = mdet[k]
        out["members"].append(dict(i=e["i"], j=e["j"], g=e["g"], vy=list(e["vy"]), L=round(Ls[k], 3), ratio=round(r, 3), combo=cn,
                                   N=round(det["N"], 2) if det else 0, M=round(math.hypot(det["My"], det["Mz"]), 2) if det else 0))
    out["supports"] = {str(n): t for n, t in m.sup.items()}
    # reaksi
    out["W_total"] = round(sum(res["D"]["R"][n][2] for n in m.sup), 2)
    out["base_shear_W"] = round(max(abs(sum(res[c]["R"][n][1] for n in m.sup)) for c in ("WA", "WB", "WC")), 2)
    Ws = out["W_total"]
    if typ == "rooftop":
        out["E_ratio"] = round(min(1.6*SDS, 0.4*1.0*SDS*3/2.5)*Ws/out["base_shear_W"], 3); out["E_note"] = "Fp (SNI 1726 Ps.9) / gaya angin"
    else:
        out["E_ratio"] = round(SDS/3.0*Ws/out["base_shear_W"], 3); out["E_note"] = "Cs=SDS/(R/Ie), R=3 (papan reklame) / gaya angin"
    combos_R = {cn: combine(res, fac, "R") for cn, cd, fac in COMBOS}
    asd_R = {cn: combine(res, fac, "R") for cn, cd, fac in ASD}
    out["reactions"] = {cn: {str(n): [round(float(v), 2) for v in R[n]] for n in R} for cn, R in combos_R.items()}
    out["combos"] = [dict(id=c[0], desc=c[1]) for c in COMBOS+ASD+SERV]
    if typ in ("unipole", "doublepole"):
        base_nodes = list(m.sup.keys())
        bpd = baseplate(secs["COL"], [(cn, R[n]) for cn, R in combos_R.items() for n in base_nodes])
        out["baseplate"] = bpd
        bp = round(math.ceil((bpd["Dp"]+300)/100)/10, 1)
        fx = [m.N[n][0] for n in base_nodes]
        fd = footing({cn: [(m.N[n][0], R[n]) for n in base_nodes] for cn, R in asd_R.items()},
                     {cn: [(m.N[n][0], R[n]) for n in base_nodes] for cn, R in combos_R.items()}, bp, 0.3, typ, fx)
        out["footing"] = fd
    else:
        posts = [n for n, t in m.sup.items() if abs(m.N[n][1]-m.yb) < 1e-6]
        rear = [n for n in m.sup if n not in posts]
        def env(nodes):
            up = max(max(R[n][2] for n in nodes) for R in combos_R.values())
            dn = min(min(R[n][2] for n in nodes) for R in combos_R.values())
            V = max(max(math.hypot(R[n][0], R[n][1]) for n in nodes) for R in combos_R.values())
            return up, dn, V
        anc = {}
        for nm, nodes in (("kolom", posts), ("strut", rear)):
            up, dn, V = env(nodes)
            # 4 angkur kimia per tumpuan, kelas 5.8
            for d in (12, 16, 20, 24):
                As = 0.78*math.pi*d**2/4
                tb = max(-min(dn, 0), 0)/4; vb = V/4
                r = (tb*1e3/(0.75*0.75*500*As))**2+(vb*1e3/(0.75*0.45*500*As))**2
                if r <= 0.6:
                    anc[nm] = dict(n=4, d=d, grade="angkur kimia kelas 5.8", Tu=round(tb, 1), Vu=round(vb, 1), ratio=round(r, 3),
                                   R_tekan=round(max(up, 0), 1), R_tarik=round(max(-dn, 0), 1), V=round(V, 1)); break
        out["anchors"] = anc
        out["roof_note"] = "Reaksi disalurkan ke balok/kolom beton atap eksisting; kapasitas bangunan eksisting wajib dicek ahli struktur."
    return out, m, secs, res

if __name__ == "__main__":
    import sys
    o, m, s, r = run_variant(sys.argv[1], sys.argv[2])
    print(json.dumps({k: o[k] for k in ("sections", "defl", "wind", "W_total", "base_shear_W", "E_ratio")}, indent=1))
    print(json.dumps({k: o.get(k) for k in ("baseplate", "footing", "anchors")}, indent=1))
