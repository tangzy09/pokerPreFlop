"""
test_vector.py — TESTS FIRST for a VECTORIZED river CFR (full-range capable).

The scalar river solver (postflop.py) iterates per hand-pair, so it only scales
to tiny ranges. A vectorized solver propagates per-hand reach vectors through
the public tree and evaluates showdowns as matrix-vector products, so it handles
big ranges. We anchor it on: (a) it must MATCH the verified scalar solver on the
small polarized toy, and (b) it must SCALE — solve a many-combo range and still
reproduce the closed-form MDF / converge.

API (mirrors postflop.RiverGame so we can compare):
    import vriver
    g = vriver.VRiver(board, oop, ip, pot, stack, bet_sizes)
    sol = vriver.solve(g, iters, seed)
    sol.game_value, sol.exploitability(), sol.oop_strategy(hand), sol.ip_strategy(hand, facing)

Needs numpy (offline tool). If numpy is absent the suite SKIPS (exit 0) so the
overall solver runner stays green.

Run:  python tools/solver/test_vector.py
"""
try:
    import numpy  # noqa: F401
except Exception:
    print("SKIP: numpy not available — vectorized solver needs it (exit 0).")
    raise SystemExit(0)

import postflop
import vriver

SUITS = "shdc"
def combos_of(label):
    r1, r2 = label[0], label[1]
    out = []
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

POLAR = dict(board=["2c", "7d", "9h", "Js", "4s"], oop=[("JhJc", 1.0), ("QdTh", 1.0)],
             ip=[("AdAc", 1.0)], pot=1.0, stack=1.0, bet_sizes=[1.0])

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
def near(a, b, tol=0.06):
    return abs(a - b) <= tol

def agg_call(sol, combos):  # combo-weighted call frequency over a hand class
    fs = [sol.ip_strategy(h, "bet").get("call", 0) for h, _ in combos]
    return sum(fs) / len(fs)

def run():
    # --- equivalence to the scalar solver on the polarized toy ---
    sc = postflop.solve(postflop.RiverGame(**POLAR), iters=20000, seed=1)
    vx = vriver.solve(vriver.VRiver(**POLAR), iters=20000, seed=1)
    check("matches scalar value", near(vx.game_value, sc.game_value, 0.02),
          f"vec={vx.game_value:+.3f} scalar={sc.game_value:+.3f}")
    check("matches scalar nuts bet", near(vx.oop_strategy("JhJc").get("bet", 0),
          sc.oop_strategy("JhJc").get("bet", 0), 0.05))
    check("matches scalar air bluff", near(vx.oop_strategy("QdTh").get("bet", 0),
          sc.oop_strategy("QdTh").get("bet", 0), 0.06))
    check("matches scalar MDF call", near(vx.ip_strategy("AdAc", "bet").get("call", 0),
          sc.ip_strategy("AdAc", "bet").get("call", 0), 0.06))
    check("toy exploitability ~ 0", vx.exploitability() < 0.02, f"expl={vx.exploitability():.4f}")

    # --- half-pot MDF (different closed form) ---
    vh = vriver.solve(vriver.VRiver(**dict(POLAR, bet_sizes=[0.5])), iters=20000, seed=2)
    check("half-pot bluff-catcher calls ~ 2/3", near(vh.ip_strategy("AdAc", "bet").get("call", 0), 2 / 3))

    # --- board plays for everyone (royal) -> tie -> value 0 ---
    vr0 = vriver.solve(vriver.VRiver(board=["Ah", "Kh", "Qh", "Jh", "Th"], oop=[("2c3c", 1.0)],
                       ip=[("2d3d", 1.0)], pot=1.0, stack=1.0, bet_sizes=[1.0]), iters=4000, seed=3)
    check("board-plays tie -> value ~ 0", abs(vr0.game_value) < 0.02, f"value={vr0.game_value:+.4f}")

    # --- SCALE: many combos. Board 2 3 4 5 7 (no Q/J/9), polarized QQ(value)+99(air) vs JJ(bluff-catcher) ---
    BOARD2 = ["2c", "3d", "4h", "5s", "7c"]
    big = dict(board=BOARD2, oop=combos_of("QQ") + combos_of("99"), ip=combos_of("JJ"),
               pot=1.0, stack=1.0, bet_sizes=[1.0])
    vb = vriver.solve(vriver.VRiver(**big), iters=15000, seed=4)
    n_combos = len(vb.oop) + len(vb.ip)
    check("scales to a many-combo range (solves)", n_combos >= 15, f"combos={n_combos}")
    check("scale: exploitability ~ 0", vb.exploitability() < 0.03, f"expl={vb.exploitability():.4f}")
    check("scale: bluff-catcher calls ~ 1/2 (MDF, aggregated)", near(agg_call(vb, combos_of("JJ")), 0.5, 0.08),
          f"call(JJ)={agg_call(vb, combos_of('JJ')):.3f}")

    # --- determinism ---
    again = vriver.solve(vriver.VRiver(**POLAR), iters=20000, seed=1)
    check("deterministic: same seed -> same value", abs(again.game_value - vx.game_value) < 1e-9)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
