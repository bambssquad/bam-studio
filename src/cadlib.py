"""Mini CAD helper di atas ezdxf — semua koordinat dalam mm kertas."""
import math, pathlib
import ezdxf
from ezdxf.fonts import fonts as _fonts
_fonts.font_manager.scan_folder(pathlib.Path(__file__).parent / "fonts")
from ezdxf.enums import TextEntityAlignment as TA

ALIGN = {"L": TA.LEFT, "C": TA.CENTER, "R": TA.RIGHT, "ML": TA.MIDDLE_LEFT,
         "MC": TA.MIDDLE_CENTER, "MR": TA.MIDDLE_RIGHT, "TL": TA.TOP_LEFT,
         "TC": TA.TOP_CENTER, "BL": TA.BOTTOM_LEFT, "BC": TA.BOTTOM_CENTER,
         "BR": TA.BOTTOM_RIGHT, "TR": TA.TOP_RIGHT}

LAYERS = {  # name: (aci, lineweight 1/100 mm)
    "FRAME": (7, 50), "WALL": (7, 50), "WALLTHIN": (7, 25), "COL": (7, 35),
    "FURN": (7, 13), "THIN": (7, 13), "DIM": (7, 13), "TEXT": (7, 18),
    "TEXTB": (7, 30), "GRID": (8, 9), "HATCH": (7, 9), "GROUND": (7, 70),
    "STR": (7, 25), "HIDDEN": (7, 18), "MEP_W": (5, 30), "MEP_K": (1, 30),
    "ELEC": (3, 18), "FADE": (253, 9), "SITE": (7, 18),
}


class Sheet:
    def __init__(self):
        self.doc = ezdxf.new("R2018", setup=True, units=4)  # mm
        self.msp = self.doc.modelspace()
        for n, (c, lw) in LAYERS.items():
            self.doc.layers.add(n, color=c, lineweight=lw)
        st = self.doc.styles
        st.add("ID", font="RobotoCondensed-Regular.ttf")     # anotasi (ala Arial Narrow)
        st.add("IDB", font="RobotoCondensed-Bold.ttf")       # judul/label ruang (ala Swiss BdCn)
        st.add("ROMANS", font="romans.shx")                   # kop (font AutoCAD romans)

    def line(self, pts, layer="THIN", lt=None, rgb=None, closed=False, ltscale=None, lw=None):
        a = {"layer": layer}
        if lt: a["linetype"] = lt
        if lw is not None: a["lineweight"] = lw
        e = self.msp.add_lwpolyline(pts, close=closed, dxfattribs=a)
        if rgb: e.rgb = rgb
        if ltscale: e.dxf.ltscale = ltscale
        return e

    def rect(self, x0, y0, x1, y1, layer="THIN", **kw):
        return self.line([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], layer, closed=True, **kw)

    def circle(self, c, r, layer="THIN", rgb=None, lt=None, lw=None):
        a = {"layer": layer}
        if lt: a["linetype"] = lt
        if lw is not None: a["lineweight"] = lw
        e = self.msp.add_circle(c, r, dxfattribs=a)
        if rgb: e.rgb = rgb
        return e

    def arc(self, c, r, a0, a1, layer="THIN", lw=None):
        a = {"layer": layer}
        if lw is not None: a["lineweight"] = lw
        return self.msp.add_arc(c, r, a0, a1, dxfattribs=a)

    def fill(self, pts, rgb=(0, 0, 0), layer="HATCH"):
        h = self.msp.add_hatch(dxfattribs={"layer": layer})
        h.rgb = rgb
        h.set_solid_fill(color=7, rgb=rgb)
        h.paths.add_polyline_path(pts, is_closed=True)
        return h

    def fill_rect(self, x0, y0, x1, y1, rgb=(0, 0, 0), layer="HATCH"):
        return self.fill([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], rgb, layer)

    def hatch(self, pts, pattern="ANSI31", scale=0.25, angle=0, rgb=None, layer="HATCH"):
        h = self.msp.add_hatch(dxfattribs={"layer": layer})
        h.set_pattern_fill(pattern, scale=scale, angle=angle)
        if rgb: h.rgb = rgb
        h.paths.add_polyline_path(pts, is_closed=True)
        return h

    def text(self, s, x, y, h=1.2, al="MC", rot=0, layer="TEXT", bold=False, rgb=None, wf=1.0, rs=False):
        e = self.msp.add_text(s, height=h, rotation=rot, dxfattribs={
            "layer": layer, "style": "ROMANS" if rs else ("IDB" if bold else "ID"), "width": wf})
        e.set_placement((x, y), align=ALIGN[al])
        if rgb: e.rgb = rgb
        return e

    def arrow(self, tip, ang, size=0.9):
        a = math.radians(ang)
        bx, by = tip[0] - size * math.cos(a), tip[1] - size * math.sin(a)
        nx, ny = -math.sin(a) * size * 0.28, math.cos(a) * size * 0.28
        self.fill([tip, (bx + nx, by + ny), (bx - nx, by - ny)], layer="DIM")

    def dim_h(self, x0, x1, y, txt, ext_from=None, h=1.0):
        for x in (x0, x1):
            y0 = ext_from if ext_from is not None else y - 1.2
            self.line([(x, y0), (x, y + 0.8)], "DIM")
        self.arrow((x0, y), 180); self.arrow((x1, y), 0)
        xm, g = (x0 + x1) / 2, len(txt) * h * 0.32 + 0.5
        if abs(x1 - x0) > 2 * g + 2:
            self.line([(x0, y), (xm - g, y)], "DIM"); self.line([(xm + g, y), (x1, y)], "DIM")
            self.text(txt, xm, y, h, "MC")
        else:
            self.line([(x0, y), (x1, y)], "DIM")
            self.text(txt, xm, y + 0.35, h * 0.85, "BC")

    def dim_v(self, x, y0, y1, txt, ext_from=None, h=1.0):
        for y in (y0, y1):
            x0 = ext_from if ext_from is not None else x - 1.2
            self.line([(x0, y), (x + 0.8, y)], "DIM")
        self.arrow((x, y0), 270); self.arrow((x, y1), 90)
        ym, g = (y0 + y1) / 2, len(txt) * h * 0.32 + 0.5
        if abs(y1 - y0) > 2 * g + 2:
            self.line([(x, y0), (x, ym - g)], "DIM"); self.line([(x, ym + g), (x, y1)], "DIM")
            self.text(txt, x, ym, h, "MC", rot=90)
        else:
            self.line([(x, y0), (x, y1)], "DIM")
            self.text(txt, x - 0.35, ym, h * 0.85, "BC", rot=90)

    def chain_h(self, xs, y, labels, ext_from=None):
        for i in range(len(xs) - 1):
            self.dim_h(xs[i], xs[i + 1], y, labels[i], ext_from)

    def chain_v(self, x, ys, labels, ext_from=None):
        for i in range(len(ys) - 1):
            self.dim_v(x, ys[i], ys[i + 1], labels[i], ext_from)

    def bubble(self, x, y, s, r=1.6):
        self.circle((x, y), r, "DIM")
        self.text(s, x, y, r * 0.95, "MC")

    def elev_mark(self, x, y, s, side="R"):
        """elevasi gaya template: garis + lingkaran kecil + teks 'EL. + 360'"""
        if side == "R":
            self.line([(x - 1.5, y), (x + 10, y)], "DIM")
            self.circle((x + 0.6, y), 0.45, "DIM")
            self.text(s, x + 1.6, y + 0.35, 1.05, "BL")
        else:
            self.line([(x - 10, y), (x + 1.5, y)], "DIM")
            self.circle((x - 0.6, y), 0.45, "DIM")
            self.text(s, x - 1.6, y + 0.35, 1.05, "BR")

    def ffl(self, x, y, s, h=1.0):
        """label FFL gaya template: teks + segitiga terbalik"""
        self.text(s, x, y, h, "MC")
        t = y - h * 1.1
        self.line([(x - 0.6, t), (x + 0.6, t), (x, t - 0.9), (x - 0.6, t)], "DIM", closed=True)

    def title(self, x, y, tag, name, scale, w=None):
        """judul gambar gaya template: lingkaran tag + busur tebal + nama bold bergaris + skala"""
        r = 2.9
        self.circle((x, y), r, "THIN", lw=25)
        self.arc((x + 0.35, y - 0.25), r + 0.55, 95, 300, "FRAME", lw=110)
        self.text(tag, x, y, 1.55, "MC")
        self.text(name, x + r + 0.9, y + 0.45, 2.3, "BL", bold=True)
        w = w or len(name) * 1.55 + 6
        self.line([(x + r + 0.3, y), (x + r + 0.9 + w, y)], "FRAME", lw=60)
        self.text(scale, x + r + 0.9 + w * 0.80, y - 0.45, 1.45, "TC")

    def tree(self, cx, cy, r):
        import random
        rnd = random.Random(int(cx * 100 + cy))
        for i in range(14):
            a = 2 * math.pi * i / 14
            rr = r * (0.82 + 0.18 * rnd.random())
            self.arc((cx + rr * math.cos(a), cy + rr * math.sin(a)), r * 0.22,
                     math.degrees(a) - 80, math.degrees(a) + 80, "FURN")


class View:
    """transformasi meter -> mm kertas"""
    def __init__(self, ox, oy, scale):
        self.ox, self.oy, self.k = ox, oy, 1000.0 / scale
    def p(self, x, y): return (self.ox + x * self.k, self.oy + y * self.k)
    def X(self, x): return self.ox + x * self.k
    def Y(self, y): return self.oy + y * self.k
    def r(self, x0, y0, x1, y1):
        return [self.p(x0, y0), self.p(x1, y0), self.p(x1, y1), self.p(x0, y1)]
    def pts(self, ps): return [self.p(x, y) for x, y in ps]
