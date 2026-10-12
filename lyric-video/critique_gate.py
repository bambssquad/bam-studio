"""Critique gate (bam-motiondesign): code decides pass / retry / human_review, not the critic.
usage: python critique_gate.py critique/critique_r2.json
critique json: {"round": n, "scores": {7 axes 1-10}, "flags": {3 anti-default booleans}, "issues": [{"t": sec, "problem": str} x3]}
"""
import json, sys, pathlib
AXES = ["composition", "typography", "color", "motion", "transitions", "lyric_sync", "craft"]
FLAGS = ["centered_text_on_gradient", "fade_in_everything", "logo_slapped_at_end"]
TARGET, FLOOR, CAP = 8.0, 7, 3
p = pathlib.Path(sys.argv[1]); c = json.loads(p.read_text())
assert set(c["scores"]) == set(AXES), f"scores must be exactly {AXES}"
assert set(c["flags"]) == set(FLAGS), f"flags must be exactly {FLAGS}"
assert len(c["issues"]) == 3 and all("t" in i and i["problem"] for i in c["issues"]), "exactly 3 timestamped issues"
mean = sum(c["scores"].values()) / len(AXES); low = min(c["scores"], key=c["scores"].get)
prev = p.with_name(f"critique_r{c['round'] - 1}.json")
pm = None
if prev.exists():
    q = json.loads(prev.read_text()); pm = sum(q["scores"].values()) / len(AXES)
if mean >= TARGET and c["scores"][low] >= FLOOR and not any(c["flags"].values()): verdict = "pass"
elif c["round"] >= CAP or (pm is not None and mean <= pm): verdict = "human_review"
else: verdict = "retry"
print(json.dumps({"round": c["round"], "mean": round(mean, 2), "lowest": [low, c["scores"][low]], "prev_mean": pm and round(pm, 2), "flags_on": [f for f, v in c["flags"].items() if v], "verdict": verdict,
                  "fix_only": [f"{i['t']}s {i['problem']}" for i in c["issues"]] if verdict == "retry" else []}, ensure_ascii=False))
