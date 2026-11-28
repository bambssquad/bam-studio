# -*- coding: utf-8 -*-
"""Ekspor model analisis ke SAP2000 (.s2k teks) dan IFC4 (untuk Tekla Structures).
Model SAP2000 & Tekla TIDAK dijalankan di sini; file disiapkan untuk diimpor."""
import math, time, uuid, numpy as np
import engine

GRADE = "BJ41_fy245"

def _sec_id(s):
    return s["name"].replace(" ", "_").replace(".", "p")

def _sap_angle(pi, pj, vy):
    """sudut (deg) agar sumbu lokal-2 SAP = vy (sisi h profil)."""
    a = np.subtract(pj, pi); a = a/np.linalg.norm(a)
    if abs(a[2]) > 0.999:  # vertikal: default lokal-2 = +X global
        d2 = np.array([1.0, 0, 0])
    else:
        d2 = np.array([0, 0, 1.0]) - a*a[2]; d2 /= np.linalg.norm(d2)
    v = np.array(vy, float) - a*np.dot(vy, a); v /= np.linalg.norm(v)
    d3 = np.cross(a, d2)
    return round(math.degrees(math.atan2(np.dot(v, d3), np.dot(v, d2))), 3)

def write_s2k(path, o, m, secs):
    P, _ = engine.load_cases(m); engine.add_selfweight_and_colwind(m, P, secs)
    L = []; w = L.append
    w(f"File {o['id']}.s2k  -  studi desain portofolio adighanilham ({time.strftime('%Y-%m-%d')})")
    w("$ Model dibuat oleh skrip Python (bukan disimpan dari SAP2000). Satuan kN, m, C.")
    w("$ Berat sendiri sudah termasuk sebagai beban titik di pola DEAD (SelfWtMult=0, +15% sambungan).")
    w("")
    w('TABLE:  "PROGRAM CONTROL"')
    w('   ProgramName=SAP2000   Version=22.0.0   CurrUnits="KN, m, C"   SteelCode="AISC 360-16"   RegenHinge=Yes')
    w('TABLE:  "MATERIAL PROPERTIES 01 - GENERAL"')
    w(f'   Material={GRADE}   Type=Steel   SymType=Isotropic   TempDepend=No   Color=Blue')
    w('TABLE:  "MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES"')
    w(f'   Material={GRADE}   UnitWeight=76.9729   UnitMass=7.849   E1=200000000   G12=76923077   U12=0.3   A1=1.17E-05')
    w('TABLE:  "MATERIAL PROPERTIES 03A - STEEL DATA"')
    w(f'   Material={GRADE}   Fy=245000   Fu=410000   EffFy=269500   EffFu=451000   SSCurveOpt=Simple   SSHysType=Kinematic')
    w('TABLE:  "FRAME SECTION PROPERTIES 01 - GENERAL"')
    for g, s in secs.items():
        if s["kind"] == "CHS":
            w(f'   SectionName={_sec_id(s)}   Material={GRADE}   Shape=Pipe   t3={s["D"]:.4f}   tw={s["t"]:.4f}   Notes="{g}"')
        else:
            w(f'   SectionName={_sec_id(s)}   Material={GRADE}   Shape=Box/Tube   t3={s["h"]:.4f}   t2={s["b"]:.4f}   tf={s["t"]:.4f}   tw={s["t"]:.4f}   Notes="{g}"')
    w('TABLE:  "JOINT COORDINATES"')
    for k, n in enumerate(m.N):
        w(f'   Joint={k+1}   CoordSys=GLOBAL   CoordType=Cartesian   XorR={n[0]:.4f}   Y={n[1]:.4f}   Z={n[2]:.4f}   SpecialJt=No')
    w('TABLE:  "JOINT RESTRAINT ASSIGNMENTS"')
    for n, t in m.sup.items():
        r = "Yes" if t == "fixed" else "No"
        w(f'   Joint={n+1}   U1=Yes   U2=Yes   U3=Yes   R1={r}   R2={r}   R3={r}')
    w('TABLE:  "CONNECTIVITY - FRAME"')
    for k, e in enumerate(m.M):
        w(f'   Frame={k+1}   JointI={e["i"]+1}   JointJ={e["j"]+1}   IsCurved=No')
    w('TABLE:  "FRAME SECTION ASSIGNMENTS"')
    for k, e in enumerate(m.M):
        s = secs[e["g"]]
        st = "Pipe" if s["kind"] == "CHS" else "Box/Tube"
        w(f'   Frame={k+1}   SectionType={st}   AutoSelect=N.A.   AnalSect={_sec_id(s)}   MatProp=Default')
    w('TABLE:  "FRAME LOCAL AXES ASSIGNMENTS 1 - TYPICAL"')
    for k, e in enumerate(m.M):
        ang = _sap_angle(m.N[e["i"]][:3], m.N[e["j"]][:3], e["vy"])
        if abs(ang) > 1e-3: w(f'   Frame={k+1}   Angle={ang}   AdvanceAxes=No')
    pins = [k for k, e in enumerate(m.M) if e["g"] in ("KICK", "BRACE", "STRUT")]
    if pins:
        w('TABLE:  "FRAME RELEASE ASSIGNMENTS 1 - GENERAL"')
        for k in pins:
            w(f'   Frame={k+1}   PI=No   V2I=No   V3I=No   TI=No   M2I=Yes   M3I=Yes   PJ=No   V2J=No   V3J=No   TJ=No   M2J=Yes   M3J=Yes   PartialFix=No')
    pats = [("DEAD", "D", "Dead"), ("LIVE", "L", "Live"), ("WA", "WA", "Wind"), ("WB", "WB", "Wind"), ("WC", "WC", "Wind")]
    w('TABLE:  "LOAD PATTERN DEFINITIONS"')
    for nm, _, dt in pats: w(f'   LoadPat={nm}   DesignType={dt}   SelfWtMult=0')
    w('TABLE:  "LOAD CASE DEFINITIONS"')
    for nm, _, dt in pats:
        w(f'   Case={nm}   Type=LinStatic   InitialCond=Zero   DesTypeOpt="Prog Det"   DesignType={dt}   AutoType=None   RunCase=Yes')
    w('TABLE:  "CASE - STATIC 1 - LOAD ASSIGNMENTS"')
    for nm, _, _ in pats: w(f'   Case={nm}   LoadType="Load pattern"   LoadName={nm}   LoadSF=1')
    w('TABLE:  "JOINT LOADS - FORCE"')
    for nm, key, _ in pats:
        for k in range(len(m.N)):
            f = P[key][k]
            if np.abs(f).max() < 1e-6: continue
            w(f'   Joint={k+1}   LoadPat={nm}   CoordSys=GLOBAL   F1={f[0]:.4f}   F2={f[1]:.4f}   F3={f[2]:.4f}   M1=0   M2=0   M3=0')
    w('TABLE:  "COMBINATION DEFINITIONS"')
    mp = {"D": "DEAD", "L": "LIVE", "WA": "WA", "WB": "WB", "WC": "WC"}
    for cid, desc, fac in engine.COMBOS + engine.ASD + engine.SERV:
        first = True
        for kk, sf in fac.items():
            if first:
                w(f'   ComboName={cid}   ComboType="Linear Add"   AutoDesign=No   CaseType="Linear Static"   CaseName={mp[kk]}   ScaleFactor={sf}   SteelDesign={"Strength" if cid.startswith("U") else "None"}   Notes="{desc}"')
                first = False
            else:
                w(f'   ComboName={cid}   CaseType="Linear Static"   CaseName={mp[kk]}   ScaleFactor={sf}')
    w("")
    w("END TABLE DATA")
    open(path, "w", encoding="utf-8", newline="\r\n").write("\n".join(L)+"\n")

# ---------------- IFC4 ----------------
_CH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
def _gid():
    n = uuid.uuid4().int; s = ""
    for k in range(22):
        s = _CH[n % 64] + s; n //= 64
    return _CH[int(uuid.uuid4().int % 4)] + s[1:]

def _f(x):
    if abs(x) < 1e-9: return "0."
    t = f"{float(x):.4f}".rstrip("0")
    return t if not t.endswith(".") else t

class _Ifc:
    def __init__(s): s.lines = []; s.n = 0
    def add(s, txt):
        s.n += 1; s.lines.append(f"#{s.n}={txt};"); return f"#{s.n}"
    def pt(s, p): return s.add(f"IFCCARTESIANPOINT(({','.join(_f(v) for v in p)}))")
    def dir(s, d): return s.add(f"IFCDIRECTION(({','.join(_f(v) for v in d)}))")

def write_ifc(path, o, m, secs, fd=None, bp=None):
    I = _Ifc(); A = I.add
    owner_p = A("IFCPERSON($,'adighanilham',$,$,$,$,$,$)")
    org = A("IFCORGANIZATION($,'adighanilham',$,$,$)")
    po = A(f"IFCPERSONANDORGANIZATION({owner_p},{org},$)")
    app = A(f"IFCAPPLICATION({org},'1.0','porto-reklame export_model.py','porto-reklame')")
    oh = A(f"IFCOWNERHISTORY({po},{app},$,.ADDED.,$,$,$,{int(time.time())})")
    u_len = A("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)")
    u_area = A("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)")
    u_vol = A("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)")
    u_ang = A("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)")
    units = A(f"IFCUNITASSIGNMENT(({u_len},{u_area},{u_vol},{u_ang}))")
    o0 = I.pt((0., 0., 0.)); zz = I.dir((0., 0., 1.)); xx = I.dir((1., 0., 0.))
    wcs = A(f"IFCAXIS2PLACEMENT3D({o0},{zz},{xx})")
    ctx = A(f"IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,{wcs},$)")
    body = A(f"IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,{ctx},$,.MODEL_VIEW.,$)")
    proj = A(f"IFCPROJECT('{_gid()}',{oh},'adighanilham - Studi Reklame {o['id']}','STUDI DESAIN PORTOFOLIO - bukan dokumen perizinan',$,$,$,({ctx}),{units})")
    lp_site = A(f"IFCLOCALPLACEMENT($,{wcs})")
    site = A(f"IFCSITE('{_gid()}',{oh},'Site studi','{engine.SITE['nama']} (ilustratif)',$,{lp_site},$,$,.ELEMENT.,$,$,$,$,$)")
    lp_b = A(f"IFCLOCALPLACEMENT({lp_site},{wcs})")
    bld = A(f"IFCBUILDING('{_gid()}',{oh},'Reklame {o['typ_name']} {o['size']}',$,$,{lp_b},$,$,.ELEMENT.,$,$,$)")
    lp_s = A(f"IFCLOCALPLACEMENT({lp_b},{wcs})")
    sto = A(f"IFCBUILDINGSTOREY('{_gid()}',{oh},'Struktur',$,$,{lp_s},$,$,.ELEMENT.,0.)")
    A(f"IFCRELAGGREGATES('{_gid()}',{oh},$,$,{proj},({site}))")
    A(f"IFCRELAGGREGATES('{_gid()}',{oh},$,$,{site},({bld}))")
    A(f"IFCRELAGGREGATES('{_gid()}',{oh},$,$,{bld},({sto}))")
    steel = A("IFCMATERIAL('BJ 41 (fy 245 MPa)',$,'steel')")
    conc = A("IFCMATERIAL('Beton fc 25 MPa',$,'concrete')")
    prof = {}
    for g, s in secs.items():
        if s["kind"] == "CHS":
            prof[g] = A(f"IFCCIRCLEHOLLOWPROFILEDEF(.AREA.,'{s['name']}',$,{_f(s['D']*500)},{_f(s['t']*1e3)})")
        else:
            prof[g] = A(f"IFCRECTANGLEHOLLOWPROFILEDEF(.AREA.,'{s['name']}',$,{_f(s['h']*1e3)},{_f(s['b']*1e3)},{_f(s['t']*1e3)},$,$)")
    ent = {"COL": "IFCCOLUMN", "POST": "IFCCOLUMN", "STUD": "IFCMEMBER", "RAIL": "IFCBEAM", "ARM": "IFCBEAM",
           "KICK": "IFCMEMBER", "STRUT": "IFCMEMBER", "BRACE": "IFCMEMBER"}
    ptype = {"IFCCOLUMN": ".COLUMN.", "IFCBEAM": ".BEAM.", "IFCMEMBER": ".MEMBER."}
    ext0 = I.dir((0., 0., 1.))
    steel_el, conc_el = [], []
    # gabungkan segmen kolinier berurutan menjadi satu batang fisik
    phys = []
    for k, e in enumerate(m.M):
        pi, pj = np.array(m.N[e["i"]][:3]), np.array(m.N[e["j"]][:3])
        if phys and phys[-1]["g"] == e["g"] and phys[-1]["j"] == e["i"]:
            q = phys[-1]; a0 = q["pj"]-q["pi"]; a1 = pj-pi
            if np.linalg.norm(np.cross(a0/np.linalg.norm(a0), a1/np.linalg.norm(a1))) < 1e-6:
                q["pj"] = pj; q["j"] = e["j"]; q["n"] += 1; continue
        phys.append(dict(g=e["g"], vy=e["vy"], pi=pi, pj=pj, i=e["i"], j=e["j"], n=1))
    for k, q in enumerate(phys):
        g = q["g"]; pi, pj = q["pi"]*1e3, q["pj"]*1e3
        a = pj-pi; Lm = float(np.linalg.norm(a)); a /= Lm
        v = np.array(q["vy"], float) - a*np.dot(q["vy"], a); v /= np.linalg.norm(v)
        pl = A(f"IFCAXIS2PLACEMENT3D({I.pt(pi)},{I.dir(a)},{I.dir(v)})")
        lp = A(f"IFCLOCALPLACEMENT({lp_s},{pl})")
        sol = A(f"IFCEXTRUDEDAREASOLID({prof[g]},$,{ext0},{_f(Lm)})")
        rep = A(f"IFCSHAPEREPRESENTATION({body},'Body','SweptSolid',({sol}))")
        ps = A(f"IFCPRODUCTDEFINITIONSHAPE($,$,({rep}))")
        en = ent[g]
        el = A(f"{en}('{_gid()}',{oh},'{g}-{k+1}','{engine.GROUP_NAME[g]}; {secs[g]['name']}',$,{lp},{ps},'{g}-{k+1}',{ptype[en]})")
        steel_el.append(el)
    # base plate & pondasi (tipe tanah)
    if fd and bp:
        for n in m.sup:
            x, y, z = (np.array(m.N[n][:3])*1e3)
            Dp = bp["Dp"]; tp = bp["tp"]
            pl = A(f"IFCAXIS2PLACEMENT3D({I.pt((x, y, z-tp))},{zz},{xx})")
            lp = A(f"IFCLOCALPLACEMENT({lp_s},{pl})")
            circ = A(f"IFCCIRCLEPROFILEDEF(.AREA.,'PL D{Dp}',$,{_f(Dp/2)})")
            sol = A(f"IFCEXTRUDEDAREASOLID({circ},$,{ext0},{_f(tp)})")
            rep = A(f"IFCSHAPEREPRESENTATION({body},'Body','SweptSolid',({sol}))")
            ps = A(f"IFCPRODUCTDEFINITIONSHAPE($,$,({rep}))")
            steel_el.append(A(f"IFCPLATE('{_gid()}',{oh},'BP-{n+1}','Base plate D{Dp} t{tp}; {bp['n']} angkur M{bp['d']} {bp['grade']}',$,{lp},{ps},'BP',.BASE_PLATE.)"))
            # pedestal
            bpm = fd["bp"]*1e3; hp = (fd["Df"]-fd["Hf"]+0.3)*1e3
            pl = A(f"IFCAXIS2PLACEMENT3D({I.pt((x, y, z-tp-hp))},{zz},{xx})")
            lp = A(f"IFCLOCALPLACEMENT({lp_s},{pl})")
            rp = A(f"IFCRECTANGLEPROFILEDEF(.AREA.,'PED {bpm:.0f}',$,{_f(bpm)},{_f(bpm)})")
            sol = A(f"IFCEXTRUDEDAREASOLID({rp},$,{ext0},{_f(hp)})")
            rep = A(f"IFCSHAPEREPRESENTATION({body},'Body','SweptSolid',({sol}))")
            ps = A(f"IFCPRODUCTDEFINITIONSHAPE($,$,({rep}))")
            conc_el.append(A(f"IFCCOLUMN('{_gid()}',{oh},'PED-{n+1}','Pedestal beton',$,{lp},{ps},'PED',.COLUMN.)"))
        xs = [m.N[n][0] for n in m.sup]; xc = (max(xs)+min(xs))/2*1e3; yc = m.N[list(m.sup)[0]][1]*1e3
        zf = (-(fd["Df"])-0.0)*1e3
        pl = A(f"IFCAXIS2PLACEMENT3D({I.pt((xc, yc, zf))},{zz},{xx})")
        lp = A(f"IFCLOCALPLACEMENT({lp_s},{pl})")
        rp = A(f"IFCRECTANGLEPROFILEDEF(.AREA.,'FTG',$,{_f(fd['Lx']*1e3)},{_f(fd['Ly']*1e3)})")
        sol = A(f"IFCEXTRUDEDAREASOLID({rp},$,{ext0},{_f(fd['Hf']*1e3)})")
        rep = A(f"IFCSHAPEREPRESENTATION({body},'Body','SweptSolid',({sol}))")
        ps = A(f"IFCPRODUCTDEFINITIONSHAPE($,$,({rep}))")
        conc_el.append(A(f"IFCFOOTING('{_gid()}',{oh},'FTG','Pondasi telapak {fd['Lx']}x{fd['Ly']}x{fd['Hf']} m, tulangan {fd['bar']}',$,{lp},{ps},'FTG',.PAD_FOOTING.)"))
    allel = steel_el+conc_el
    A(f"IFCRELCONTAINEDINSPATIALSTRUCTURE('{_gid()}',{oh},$,$,({','.join(allel)}),{sto})")
    A(f"IFCRELASSOCIATESMATERIAL('{_gid()}',{oh},$,$,({','.join(steel_el)}),{steel})")
    if conc_el: A(f"IFCRELASSOCIATESMATERIAL('{_gid()}',{oh},$,$,({','.join(conc_el)}),{conc})")
    hdr = ["ISO-10303-21;", "HEADER;",
           "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
           f"FILE_NAME('{o['id']}.ifc','{time.strftime('%Y-%m-%dT%H:%M:%S')}',('adighanilham'),('adighanilham'),'porto-reklame','export_model.py','');",
           "FILE_SCHEMA(('IFC4'));", "ENDSEC;", "DATA;"]
    open(path, "w", encoding="utf-8").write("\n".join(hdr+I.lines+["ENDSEC;", "END-ISO-10303-21;"])+"\n")
    return len(phys)

if __name__ == "__main__":
    import sys, os
    t, z = sys.argv[1], sys.argv[2]; od = sys.argv[3] if len(sys.argv) > 3 else "."
    o, m, secs, res = engine.run_variant(t, z)
    write_s2k(os.path.join(od, f"{o['id']}.s2k"), o, m, secs)
    n = write_ifc(os.path.join(od, f"{o['id']}.ifc"), o, m, secs, o.get("footing"), o.get("baseplate"))
    print("ok", o["id"], n)
