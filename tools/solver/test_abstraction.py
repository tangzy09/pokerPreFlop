"""
test_abstraction.py — TESTS FIRST for board (card) ABSTRACTION.

Vectorization scaled the range dimension; abstraction scales the BOARD dimension.
Here we bucket the chance-node runout cards by RANK (the 4 suits of a rank ->
one representative + a count weight), which shrinks the fan-out ~4x. On a
FLUSH-PROOF board (a rainbow 4-card turn: a 5th card can never make a flush)
suits only matter through blockers, so rank-bucketing is a close (near-lossless)
approximation. We verify: bucketed value ~= full value, bucketed is a valid
low-exploitability solve, far fewer runouts, and it's faster.

API addition:  vturn.VTurn(..., bucket=True)  groups river cands by rank.
Run:  python tools/solver/test_abstraction.py
"""
try:
    import numpy  # noqa: F401
except Exception:
    print("SKIP: numpy not available (exit 0).")
    raise SystemExit(0)

import time
import vturn

TURN = ["Ah", "Kd", "7c", "2s"]                      # rainbow -> flush-proof
POLAR = dict(board=TURN, oop=[("AsAc", 1.0), ("8d3c", 1.0)], ip=[("KsQh", 1.0)],
             pot=1.0, stack=4.0, bet_sizes=[1.0])
NA = dict(board=TURN, oop=[("AsAc", 1.0)], ip=[("8d3c", 1.0)], pot=1.0, stack=4.0, bet_sizes=[1.0])

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
def near(a, b, tol=0.03):
    return abs(a - b) <= tol

def run():
    gf = vturn.VTurn(**POLAR)
    gb = vturn.VTurn(**POLAR, bucket=True)
    nfull = len(gf.cset); nbkt = len(gb.cset)
    check("abstraction shrinks the runout fan-out", nbkt < nfull and nbkt <= 13,
          f"cards={nfull} buckets={nbkt}")
    # structural: rank-bucketing is a proper PARTITION (no runout dropped or double-counted)
    check("bucket weights partition all runouts", sum(w for _, w in gb.cset) == nfull,
          f"sum(weights)={sum(w for _, w in gb.cset):.0f} cards={nfull}")
    check("full mode is unweighted (weight 1 per card)",
          len(gf.cset) == nfull and all(w == 1.0 for _, w in gf.cset))

    t0 = time.time(); full = vturn.solve(gf, iters=2500, seed=1); tf = time.time() - t0
    t0 = time.time(); bkt = vturn.solve(gb, iters=2500, seed=1); tb = time.time() - t0
    check("bucketed value ~= full value (flush-proof board)", near(bkt.game_value, full.game_value, 0.03),
          f"bucket={bkt.game_value:+.3f} full={full.game_value:+.3f}")
    check("bucketed is a valid low-exploitability solve", bkt.exploitability() < 0.05,
          f"expl={bkt.exploitability():.4f}")
    check("bucketed is faster than full", tb < tf, f"bucket={tb:.0f}s full={tf:.0f}s")
    check("bucketed strategy ~= full strategy (nuts bet)",
          near(bkt.oop_strategy("AsAc").get("bet", 0), full.oop_strategy("AsAc").get("bet", 0), 0.12))

    # bucketed still gets the degenerate spot exactly
    nb = vturn.solve(vturn.VTurn(**NA, bucket=True), iters=2000, seed=2)
    check("bucketed nuts-vs-air value = +P/2", near(nb.game_value, 0.5), f"value={nb.game_value:+.3f}")
    check("bucketed air folds", nb.ip_strategy("8d3c", "bet").get("fold", 0) > 0.9,
          f"fold={nb.ip_strategy('8d3c', 'bet').get('fold', 0):.3f}")

    again = vturn.solve(vturn.VTurn(**POLAR, bucket=True), iters=2500, seed=1)
    check("deterministic: same seed -> same value", abs(again.game_value - bkt.game_value) < 1e-9)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
