"""
gen-postflop-spots.py — solve a handful of CANONICAL heads-up postflop GTO teaching
spots with the (verified) vectorized CFR+ solver and emit js/data/postflop-spots.js
for the app to display. This is how the postflop solver chain "cashes in": real
computed GTO frequencies + measured exploitability, shipped as data (same pattern as
the push/fold tools). Honest scope: HU, single bet size, no raises — each spot
illustrates ONE concept (MDF, polarization/bluff ratio, indifference, nuts-vs-air).

Run:  python tools/gen-postflop-spots.py   (needs numpy; writes js/data/postflop-spots.js)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "solver"))
try:
    import numpy  # noqa: F401
except Exception:
    print("numpy required (pip install numpy)"); raise SystemExit(1)

import vriver

try:
    sys.stdout.reconfigure(encoding="utf-8")          # Windows console is cp1252 by default
except Exception:
    pass

SUITS = "shdc"
def combos_of(label):
    r1, r2 = label[0], label[1]; out = []
    if len(label) == 2:
        for a in range(4):
            for b in range(a + 1, 4):
                out.append(r1 + SUITS[a] + r1 + SUITS[b])
    elif label[2] == "s":
        for s in range(4):
            out.append(r1 + SUITS[s] + r2 + SUITS[s])
    else:
        for a in range(4):
            for b in range(4):
                if a != b:
                    out.append(r1 + SUITS[a] + r2 + SUITS[b])
    return [(h, 1.0) for h in out]

def is_combo(tok):                                    # e.g. "JhJc", "QdTh" = one specific combo
    return len(tok) == 4 and tok[1] in SUITS and tok[3] in SUITS
def parse_range(tokens):                              # tokens: class labels ("JJ","QTo") or explicit combos
    out = []
    for t in tokens:
        if is_combo(t):
            out.append((t, 1.0))
        else:
            out += combos_of(t)
    return out

PRETTY = {"s": "♠", "h": "♥", "d": "♦", "c": "♣"}
def board_str(cards):
    return "".join(c[0].upper() + PRETTY[c[1]] for c in cards)

def agg(sol, who, token, facing=None):
    """combo-weighted average strategy over a hand token (class or combo) -> {label: freq}."""
    acc = {}
    n = 0
    for h, _ in parse_range([token]):
        d = sol.oop_strategy(h) if who == "OOP" else sol.ip_strategy(h, facing)
        for k, v in d.items():
            acc[k] = acc.get(k, 0.0) + v
        n += 1
    return {k: round(v / n, 3) for k, v in acc.items()}

# Each spot: board, OOP/IP ranges, bet fraction, and what to report. Ranges use
# hand-class labels (e.g. "JJ", "QTs"); combos_of expands them. Reporting hands are
# chosen to make the concept legible.
# Polarized spots use BALANCED single-combo ranges (one value + one equal-weight bluff
# vs one bluff-catcher) — the canonical river toy that yields the clean closed-form
# numbers (nuts bets 100%, bluff-catcher calls = MDF). The range-level spot uses full
# combos to show MDF holds across a whole range, not just one hand.
SPOTS = [
    dict(id="polar-pot", concept="极化下注：MDF（最小防守频率）",
         board=["2c", "7d", "9h", "Js", "4s"], oop=["JhJc", "QdTh"], ip=["AdAc"], frac=1.0,
         desc="OOP 极化：坚果（J♥J♣ 成三条）+ 等量空气（Q♦T♥），IP 一手抓诈牌（A♦A♣ 超对），底池大小下注。",
         note="面对底池大小下注，抓诈方的最小防守频率 = 1 − 下注/(底池+下注) = 50%；"
              "OOP 把空气的诈唬量调到让对手跟注恰好无差异。",
         report=[("OOP", "JhJc", "坚果（J♥J♣）", None), ("OOP", "QdTh", "空气（Q♦T♥）", None),
                 ("IP", "AdAc", "抓诈（A♦A♣）·面对下注", "bet")]),
    dict(id="polar-half", concept="半池下注：MDF 随尺寸变化",
         board=["2c", "7d", "9h", "Js", "4s"], oop=["JhJc", "QdTh"], ip=["AdAc"], frac=0.5,
         desc="同一极化局面，改为半池下注。",
         note="下注越小，抓诈方需要防守得越多：半池下注的 MDF = 1 − 0.5/1.5 ≈ 67%。",
         report=[("IP", "AdAc", "抓诈（A♦A♣）·面对半池下注", "bet")]),
    dict(id="nuts-air", concept="坚果 vs 全空气：下注无差异（反直觉）",
         board=["2c", "7d", "9h", "Js", "4s"], oop=["JhJc"], ip=["QdTh"], frac=1.0,
         desc="OOP 永远是坚果（三条），IP 永远不成牌（Q 高，只能弃牌）。",
         note="反直觉：因为对手只能弃牌、且摊牌也必输，OOP 无论下注还是过牌都能拿下底池——"
              "两者 EV 完全相同，所以下注频率并不固定（这里收敛到约 1/3，是任意的无差异混合）。"
              "期望恒为 +底池/2（即 +0.5）。这说明“有坚果就下注”并非永远成立。",
         report=[("OOP", "JhJc", "坚果（J♥J♣）", None), ("IP", "QdTh", "空气（Q♦T♥）·面对下注", "bet")]),
    dict(id="range-mdf", concept="真实范围：MDF 在整段范围上成立",
         board=["2c", "3d", "4h", "5s", "7c"], oop=["QQ", "99"], ip=["JJ"], frac=1.0,
         desc="干燥低牌面，OOP 用 QQ（价值）+ 99（被超牌，当空气）极化，IP 用 JJ 抓诈（全部 6 个组合）。",
         note="跨整段范围聚合后，抓诈方 JJ 的跟注频率仍收敛到 ≈ 50%（底池下注的 MDF），"
              "说明 MDF 是范围层面的性质，不只对单手成立。",
         report=[("OOP", "QQ", "价值（QQ）", None), ("OOP", "99", "空气（99）", None),
                 ("IP", "JJ", "抓诈（JJ）·面对下注", "bet")]),
]

def solve_spot(sp):
    oop = parse_range(sp["oop"]); ip = parse_range(sp["ip"])
    g = vriver.VRiver(board=sp["board"], oop=oop, ip=ip, pot=1.0, stack=1.0,
                      bet_sizes=[sp["frac"]])
    sol = vriver.solve(g, iters=20000, seed=1)
    expl = sol.exploitability()
    lines = []
    for who, token, disp, facing in sp["report"]:
        freq = agg(sol, who, token, facing)
        lines.append({"who": who, "hand": disp, "freq": freq})
    return {
        "id": sp["id"], "concept": sp["concept"], "street": "river",
        "board": board_str(sp["board"]), "desc": sp["desc"], "note": sp["note"],
        "lines": lines, "value": round(sol.game_value, 3),
        "exploitability": round(expl, 4),
        "src": f"HU 翻后 CFR+ solver 自算（{20000} 次迭代，可利用度 {expl:.4f}；越接近 0 越精确）",
    }

def js_lit(spots):
    import json
    body = json.dumps(spots, ensure_ascii=False, indent=2)
    return ("// AUTO-GENERATED by tools/gen-postflop-spots.py — do not edit by hand.\n"
            "// Real HU postflop GTO solves (vectorized CFR+), shipped for the app to display.\n"
            "window.SOLVED_SPOTS = " + body + ";\n")

def main():
    spots = []
    for sp in SPOTS:
        print(f"solving {sp['id']} ...", flush=True)
        r = solve_spot(sp)
        print(f"  value={r['value']:+.3f} expl={r['exploitability']:.4f}")
        for ln in r["lines"]:
            print(f"    {ln['who']:3} {ln['hand']:24} {ln['freq']}")
        spots.append(r)
    out = os.path.join(HERE, "..", "js", "data", "postflop-spots.js")
    with open(os.path.abspath(out), "w", encoding="utf-8") as f:
        f.write(js_lit(spots))
    print(f"\nwrote {os.path.abspath(out)}")

if __name__ == "__main__":
    main()
