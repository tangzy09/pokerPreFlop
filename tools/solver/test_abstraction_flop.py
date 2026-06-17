"""
test_abstraction_flop.py — TESTS FIRST: board (rank) ABSTRACTION on the TWO-chance
flop solver (vflop). test_abstraction.py bucketed vturn's ONE chance node; vflop
has TWO (flop->turn and turn->river), and the NESTED fan-out (~48*47 ~= 2256 runouts
traversed every CFR iteration on the check-down line) is the practical wall.
Bucketing the runouts by RANK at BOTH chance nodes shrinks each ~4x, so the nested
cost drops ~13x here -- the real enabler for a tractable flop solve.

Anchoring losslessness honestly: a tight "bucketed == full value" comparison would
need the FULL solve converged, but full convergence IS the fan-out wall bucketing
exists to break (vanilla CFR full@120 takes ~2min and is nowhere near converged).
So we anchor on a spot whose TRUE value is known analytically and where bucketing is
PROVABLY lossless: flopped quad aces (board "Ah Ad Ac", OOP holds the 4th ace) win
EVERY runout, so the showdown share is runout-independent and rank-bucketing the
chance nodes is exact -> the bucketed solve must converge to +P/2. We also verify
the abstraction is a valid low-exploitability solve on a real varying flush-proof
spot, that both chance fan-outs shrink, that it's faster, and determinism.

The varying spot uses SPADE-ONLY ranges over a no-spade board ("Ah Kd 7c"): a spade
flush needs 5 spades but the board has none and hole+runout give at most 4, so a
flush is impossible and suits matter only through blockers -> rank-bucketing is
near-lossless there too.

API addition:  vflop.VFlop(..., bucket=True)  groups both chance nodes' runouts by
rank, exposing g.tset (flop->turn buckets) and g.rset[ti] (turn->river buckets).
Run:  python tools/solver/test_abstraction_flop.py   (~3min)
"""
try:
    import numpy  # noqa: F401
except Exception:
    print("SKIP: numpy not available (exit 0).")
    raise SystemExit(0)

import time
import vflop

# varying, flush-proof spot (spade-only hands, no spade on board)
POLAR = dict(board=["Ah", "Kd", "7c"], oop=[("AsTs", 1.0), ("8s3s", 1.0)], ip=[("QsJs", 1.0)],
             pot=1.0, stack=4.0, bet_sizes=[1.0])
# flopped quad aces = unbeatable on every runout -> bucketing is EXACTLY lossless,
# true value is +P/2 regardless of how the chance nodes are abstracted
NUTS = dict(board=["Ah", "Ad", "Ac"], oop=[("AsKc", 1.0)], ip=[("QhJd", 1.0)],
            pot=1.0, stack=3.0, bet_sizes=[1.0])

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
def near(a, b, tol=0.04):
    return abs(a - b) <= tol

def run():
    gf = vflop.VFlop(**POLAR)
    gb = vflop.VFlop(**POLAR, bucket=True)
    check("flop->turn fan-out shrinks", len(gb.tset) < len(gf.tset) and len(gb.tset) <= 13,
          f"turn cards={len(gf.tset)} buckets={len(gb.tset)}")
    check("turn->river fan-out shrinks", len(gb.rset[0]) < len(gf.rset[0]) and len(gb.rset[0]) <= 13,
          f"river cards={len(gf.rset[0])} buckets={len(gb.rset[0])}")
    # structural: each chance node's buckets are a proper PARTITION (no runout dropped/double-counted)
    check("flop->turn weights partition all turn cards", sum(w for _, w in gb.tset) == len(gf.tset),
          f"sum={sum(w for _, w in gb.tset):.0f} cards={len(gf.tset)}")
    check("turn->river weights partition all river cards", sum(w for _, w in gb.rset[0]) == len(gf.rset[0]),
          f"sum={sum(w for _, w in gb.rset[0]):.0f} cards={len(gf.rset[0])}")

    # speed: same iters, full vs bucketed (low iters -- the claim is structural, not convergence)
    t0 = time.time(); full = vflop.solve(gf, iters=50, seed=1); tf = time.time() - t0
    t0 = time.time(); fast = vflop.solve(gb, iters=50, seed=1); tb = time.time() - t0
    check("bucketed is much faster than full (same iters)", tb < tf,
          f"bucket={tb:.0f}s full={tf:.0f}s  value_full={full.game_value:+.3f}")

    # lossless value anchor: flopped quads -> converges to the analytic +P/2
    nb = vflop.solve(vflop.VFlop(**NUTS, bucket=True), iters=600, seed=2)
    check("bucketed flopped-quads value = +P/2 (lossless)", near(nb.game_value, 0.5, 0.04),
          f"value={nb.game_value:+.3f}")
    check("bucketed flopped-quads is a valid low-exploitability solve", nb.exploitability() < 0.05,
          f"expl={nb.exploitability():.4f}")
    check("bucketed air folds to flop bet", nb.ip_strategy("QhJd", "bet").get("fold", 0) > 0.9,
          f"fold={nb.ip_strategy('QhJd', 'bet').get('fold', 0):.3f}")

    # valid solve on a real varying flush-proof spot
    pb = vflop.solve(vflop.VFlop(**POLAR, bucket=True), iters=600, seed=1)
    check("bucketed varying spot is a valid low-exploitability solve", pb.exploitability() < 0.06,
          f"expl={pb.exploitability():.4f} value={pb.game_value:+.3f}")

    # determinism (cheap)
    d1 = vflop.solve(vflop.VFlop(**POLAR, bucket=True), iters=80, seed=7)
    d2 = vflop.solve(vflop.VFlop(**POLAR, bucket=True), iters=80, seed=7)
    check("deterministic: same seed -> same value", abs(d1.game_value - d2.game_value) < 1e-9)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
