"""Corrected lyrics -> data/lyrics.json. Groups = (start, end, [phrases]); phrase and word times
are spread by syllable count inside each group (VAD-derived windows). Edit GROUPS to fix timing."""
import json, re
GROUPS = [
 (7.8, 15.6, ["Senja datang perlahan", "Menyelimuti kota penuh harapan"]),
 (16.6, 21.0, ["Suara angin menyapa rindu"]),
 (21.5, 25.7, ["Menari di bawah langit biru"]),
 (27.2, 31.3, ["Di jalanan yang lebar ini"]),
 (31.4, 37.6, ["Kita berdua menitip mimpi", "Berjalan tanpa berpikir"]),
 (47.2, 56.3, ["Kutemukan cinta yang sederhana", "Dalam keheningan yang membawa"]),
 (57.0, 64.5, ["Hatiku dan hatimu berbicara"]),
 (66.7, 76.6, ["Deburan ombak berbisik", "Mengajakku bernyanyi", "Langit malam yang manis"]),
 (77.0, 86.3, ["Mau menyentuh hati", "Hadirkan kamu dalam diri"]),
 (87.1, 98.4, ["Tawa kita berdua menggema", "Seperti simfoni jiwa", "Hanya ada kau dan aku"]),
 (98.9, 108.3, ["Menyelami waktu yang tak jemu", "Di bawah lampu kota yang pudar"]),
 (109.0, 118.0, ["Aku temukan cinta yang sederhana", "Dalam keheningan yang membawa"]),
 (118.1, 122.4, ["Hatiku dan hatimu berbicara"]),
 (139.5, 143.6, ["Tawa kita berdua menggema"]),
 (144.5, 152.6, ["Seperti simfoni jiwa", "Hanya ada kau dan aku"]),
 (152.9, 162.9, ["Menyelami waktu yang tak jemu", "Di bawah lampu kota yang pudar"]),
 (163.7, 172.0, ["Aku temukan cinta yang sederhana", "Dalam keheningan yang membawa"]),
 (172.0, 179.0, ["Hatiku dan hatimu berbicara"]),
 (179.1, 190.3, ["na na na na na", "na na na na na"]),
]
syl = lambda w: max(1, len(re.findall(r"[aiueo]+", w.lower())))
lines = []
for s, e, phrases in GROUPS:
    ps = [sum(syl(w) for w in p.split()) for p in phrases]
    tot, acc = sum(ps), 0
    for p, n in zip(phrases, ps):
        ls, le = s + (e - s) * acc / tot, s + (e - s) * (acc + n) / tot; acc += n
        ws, a2, words = p.split(), 0, []
        for w in ws:
            k = syl(w); words.append({"w": w, "s": round(ls + (le - ls) * a2 / n, 2), "e": round(ls + (le - ls) * (a2 + k) / n, 2)}); a2 += k
        lines.append({"start": round(ls, 2), "end": round(le, 2), "text": p, "words": words})
json.dump(lines, open("data/lyrics.json", "w"), ensure_ascii=False, indent=1)
print(len(lines), "lines")
