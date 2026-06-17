"""
test_cfrplus.py — TESTS FIRST for CFR+ (regret-matching+ & linear averaging).

The solver chain is bottlenecked by SLOW convergence: vanilla CFR needs thousands
of iterations, which is why the expensive multi-street / flop solves can't be run
to convergence (we had to anchor abstraction losslessness on analytic values). CFR+
typically converges ~10-50x faster by (1) FLOORING cumulative regret at 0 each
update (regret-matching+, so a line that turned out bad doesn't have to climb back
from deep-negative regret) and (2) weighting iteration t's strategy contribution by
t (linear averaging). It targets the SAME Nash equilibrium, just reaches it sooner.

We anchor on the verified polarized river toy (vriver, known closed form: pot-bet ->
bluff-catcher calls 1/2 = MDF, value/exploitability known). At a LOW iteration count
CFR+ must be near-converged (low exploitability, right MDF) while vanilla is NOT,
and both must agree on the equilibrium value. API addition: vriver.solve(..., plus=True),
default True. plus=False recovers vanilla CFR.

Run:  python tools/solver/test_cfrplus.py
"""
try:
    import numpy  # noqa: F401
except Exception:
    print("SKIP: numpy not available (exit 0).")
    raise SystemExit(0)

import vriver

POLAR = dict(board=["2c", "7d", "9h", "Js", "4s"], oop=[("JhJc", 1.0), ("QdTh", 1.0)],
             ip=[("AdAc", 1.0)], pot=1.0, stack=1.0, bet_sizes=[1.0])
N = 300                                              # deliberately LOW: vanilla won't have converged

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
def near(a, b, tol=0.04):
    return abs(a - b) <= tol

def run():
    van = vriver.solve(vriver.VRiver(**POLAR), iters=N, seed=1, plus=False)
    plus = vriver.solve(vriver.VRiver(**POLAR), iters=N, seed=1, plus=True)
    ev, pv = van.exploitability(), plus.exploitability()
    check("CFR+ far less exploitable than vanilla at equal low iters", pv < ev / 3,
          f"plus={pv:.4f} vanilla={ev:.4f}  iters={N}")
    check("vanilla is NOT yet converged at low iters (shows the gap)", ev > 0.02, f"vanilla expl={ev:.4f}")
    check("CFR+ is already near-converged at low iters", pv < 0.02, f"plus expl={pv:.4f}")

    # CFR+ targets the SAME equilibrium: a long vanilla run is the reference value
    ref = vriver.solve(vriver.VRiver(**POLAR), iters=20000, seed=9, plus=False)
    check("CFR+ value matches the converged equilibrium value", near(plus.game_value, ref.game_value, 0.02),
          f"plus={plus.game_value:+.3f} ref={ref.game_value:+.3f}")
    check("CFR+ recovers MDF (bluff-catcher calls ~ 1/2) at low iters",
          near(plus.ip_strategy("AdAc", "bet").get("call", 0), 0.5, 0.05),
          f"call={plus.ip_strategy('AdAc', 'bet').get('call', 0):.3f}")

    # half-pot closed form (call 2/3), reached fast by CFR+
    ph = vriver.solve(vriver.VRiver(**dict(POLAR, bet_sizes=[0.5])), iters=N, seed=2, plus=True)
    check("CFR+ half-pot bluff-catcher calls ~ 2/3 at low iters",
          near(ph.ip_strategy("AdAc", "bet").get("call", 0), 2 / 3, 0.05),
          f"call={ph.ip_strategy('AdAc', 'bet').get('call', 0):.3f}")

    # known GTO of a polarized pot bet: the value/nuts hand bets ~100% -- reached fast
    check("CFR+ nuts value-bets ~100% at low iters", plus.oop_strategy("JhJc").get("bet", 0) > 0.9,
          f"bet={plus.oop_strategy('JhJc').get('bet', 0):.3f}")

    # the RATE change is visible: the CFR+/vanilla exploitability ratio GROWS with iters
    # (vanilla ~O(1/sqrt t), CFR+ ~O(1/t), so the gap widens)
    M = 4 * N
    vanM = vriver.solve(vriver.VRiver(**POLAR), iters=M, seed=1, plus=False).exploitability()
    plusM = vriver.solve(vriver.VRiver(**POLAR), iters=M, seed=1, plus=True).exploitability()
    check("CFR+ advantage grows with iters (rate change, not a constant factor)",
          (vanM / plusM) > (ev / pv), f"ratio@{M}={vanM / plusM:.1f}x > ratio@{N}={ev / pv:.1f}x")

    # the averaged strategies are valid probability distributions
    sJ = plus.oop_strategy("JhJc"); sA = plus.ip_strategy("AdAc", "bet")
    check("CFR+ averaged strategies are valid distributions",
          near(sJ.get("check", 0) + sJ.get("bet", 0), 1.0, 1e-6) and
          near(sA.get("fold", 0) + sA.get("call", 0), 1.0, 1e-6),
          f"OOP sum={sJ.get('check', 0) + sJ.get('bet', 0):.6f} IP sum={sA.get('fold', 0) + sA.get('call', 0):.6f}")

    again = vriver.solve(vriver.VRiver(**POLAR), iters=N, seed=1, plus=True)
    check("deterministic: same seed -> same value", abs(again.game_value - plus.game_value) < 1e-9)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
