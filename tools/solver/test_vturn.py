"""
test_vturn.py — TESTS FIRST for a VECTORIZED multi-street (turn+river) CFR.

vriver.py vectorized the single-street river. This adds a CHANCE node: a 4-card
turn board, a river is dealt (each remaining card), then a river betting round.
The hard parts are per-river showdown matrices and card-removal at the chance
node. We anchor on: (a) it must MATCH the verified scalar multi-street solver
(postflop.PostflopGame on a 4-card board) and (b) it must SCALE.

API (mirrors PostflopGame):
    import vturn
    g = vturn.VTurn(board4, oop, ip, pot, stack, bet_sizes)
    sol = vturn.solve(g, iters, seed)
    sol.game_value, sol.exploitability(), sol.oop_strategy(hand), sol.ip_strategy(hand, facing)

Needs numpy; skips (exit 0) if absent so the runner stays green.
Run:  python tools/solver/test_vturn.py
"""
try:
    import numpy  # noqa: F401
except Exception:
    print("SKIP: numpy not available (exit 0).")
    raise SystemExit(0)

import postflop
import vturn

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

TURN = ["Ah", "Kd", "7c", "2s"]
POLAR = dict(board=TURN, oop=[("AsAc", 1.0), ("8d3c", 1.0)], ip=[("KsQh", 1.0)],
             pot=1.0, stack=4.0, bet_sizes=[1.0])
NUTS_AIR = dict(board=TURN, oop=[("AsAc", 1.0)], ip=[("8d3c", 1.0)],
                pot=1.0, stack=4.0, bet_sizes=[1.0])

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
def near(a, b, tol=0.06):
    return abs(a - b) <= tol

def run():
    # --- equivalence to the scalar multi-street solver ---
    sc = postflop.solve(postflop.PostflopGame(**POLAR), iters=2500, seed=1)
    vx = vturn.solve(vturn.VTurn(**POLAR), iters=2500, seed=1)
    check("matches scalar value", near(vx.game_value, sc.game_value, 0.03),
          f"vec={vx.game_value:+.3f} scalar={sc.game_value:+.3f}")
    check("matches scalar OOP root bet", near(vx.oop_strategy("AsAc").get("bet", 0),
          sc.oop_strategy("AsAc").get("bet", 0), 0.08))
    check("matches scalar IP call", near(vx.ip_strategy("KsQh", "bet").get("call", 0),
          sc.ip_strategy("KsQh", "bet").get("call", 0), 0.08))
    check("exploitability ~ 0", vx.exploitability() < 0.05, f"expl={vx.exploitability():.4f}")

    # --- chance averaging: nuts-vs-air over all rivers ---
    na = vturn.solve(vturn.VTurn(**NUTS_AIR), iters=2500, seed=2)
    check("nuts-vs-air value = +P/2", near(na.game_value, 0.5), f"value={na.game_value:+.3f}")
    check("nuts-vs-air air folds to turn bet", na.ip_strategy("8d3c", "bet").get("fold", 0) > 0.9,
          f"fold={na.ip_strategy('8d3c', 'bet').get('fold', 0):.3f}")
    # value robust across stacks (chance handling is stack-independent for nuts/air)
    na8 = vturn.solve(vturn.VTurn(**dict(NUTS_AIR, stack=8.0)), iters=2500, seed=2)
    check("nuts-vs-air value +P/2 at stack 8", near(na8.game_value, 0.5), f"value={na8.game_value:+.3f}")

    # --- SCALE: many combos through the chance node ---
    BOARD2 = ["2c", "3d", "4h", "5s"]              # turn board, low cards
    big = dict(board=BOARD2, oop=combos_of("AA") + combos_of("KK"), ip=combos_of("QQ"),
               pot=1.0, stack=2.0, bet_sizes=[1.0])
    vb = vturn.solve(vturn.VTurn(**big), iters=1200, seed=3)
    check("scales to many combos (solves)", len(vb.oop) + len(vb.ip) >= 15,
          f"combos={len(vb.oop) + len(vb.ip)}")
    check("scale: exploitability ~ 0", vb.exploitability() < 0.05, f"expl={vb.exploitability():.4f}")

    # --- determinism + convergence ---
    again = vturn.solve(vturn.VTurn(**POLAR), iters=2500, seed=1)
    check("deterministic: same seed -> same value", abs(again.game_value - vx.game_value) < 1e-9)
    coarse = vturn.solve(vturn.VTurn(**POLAR), iters=80, seed=4).exploitability()
    check("convergence: more iters -> less exploitable", vx.exploitability() < coarse,
          f"coarse={coarse:.4f} fine={vx.exploitability():.4f}")

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
