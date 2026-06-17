"""
test_cfrplus_scalar.py — TESTS FIRST: CFR+ for the SCALAR solvers (postflop.py and
preflop.py). The vectorized chain already has CFR+ (test_cfrplus.py); the end-to-end
"preflop fed by a real postflop solve" path (endtoend.py) runs the SCALAR solvers, so
those need it too to make a real preflop-data run tractable.

Scalar CFR+ = regret-matching+ (floor cumulative regret at 0 each iteration) + linear
averaging (weight iteration t's strategy by t), with SIMULTANEOUS updates. (Unlike
the vectorized solvers it does NOT alternate: the per-deal traversal visits each
infoset once per deal, and alternating + RM+ then plateaus multi-street
exploitability; simultaneous CFR+ is stable and already gives the big multi-street
win.) Same Nash, far fewer iterations.

We anchor on already-verified spots. The headline speedup is on a real MULTI-STREET
turn (chance node + two betting streets) — the case that actually matters for
end-to-end and where vanilla is slowest. The polarized river (single street) is used
for closed-form CORRECTNESS (MDF, nuts value-bet, value); it's a trivial spot that
converges fast either way, so it isn't the speed demonstrator.

API: postflop.solve(..., plus=True) / preflop.solve(..., plus=True), default True.
Run:  python tools/solver/test_cfrplus_scalar.py
"""
import postflop
import preflop

# real multi-street turn: 4-card rainbow board, deep stack (turn bet NOT all-in -> a
# river betting round exists); OOP nuts+air vs IP bluff-catcher. Vanilla is slow here.
TURN = dict(board=["Ah", "Kd", "7c", "2s"], oop=[("AsAc", 1.0), ("8d3c", 1.0)],
            ip=[("KsQh", 1.0)], pot=1.0, stack=4.0, bet_sizes=[1.0])
# polarized river (single street) — closed form: bluff-catcher calls 1/2, nuts bets 100%
RIVER = dict(board=["2c", "7d", "9h", "Js", "4s"], oop=[("JhJc", 1.0), ("QdTh", 1.0)],
             ip=[("AdAc", 1.0)], pot=1.0, stack=1.0, bet_sizes=[1.0])
SB = [("AhAc", 1.0), ("7h2d", 1.0)]
BB = [("KsKd", 1.0), ("QsJc", 1.0)]
N = 200

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
def near(a, b, tol=0.04):
    return abs(a - b) <= tol

def run():
    # ---- headline: multi-street turn (chance node + two streets) ----
    van = postflop.solve(postflop.PostflopGame(**TURN), iters=N, seed=1, plus=False)
    plus = postflop.solve(postflop.PostflopGame(**TURN), iters=N, seed=1, plus=True)
    ev, pv = van.exploitability(), plus.exploitability()
    check("turn: CFR+ far less exploitable than vanilla at low iters", pv < ev / 3,
          f"plus={pv:.4f} vanilla={ev:.4f} iters={N}")
    check("turn: vanilla is NOT yet converged (shows the gap)", ev > 0.05, f"vanilla={ev:.4f}")
    check("turn: CFR+ is already near-converged", pv < 0.02, f"plus={pv:.4f}")
    check("turn: CFR+ value ~ +P/2 (nuts polarized, extracts)", near(plus.game_value, 0.5, 0.03),
          f"value={plus.game_value:+.3f}")

    # ---- river: closed-form CORRECTNESS under CFR+ ----
    r = postflop.solve(postflop.RiverGame(**RIVER), iters=4000, seed=2, plus=True)
    ref = postflop.solve(postflop.RiverGame(**RIVER), iters=20000, seed=9, plus=False)
    check("river: CFR+ recovers MDF (bluff-catcher calls ~ 1/2)",
          near(r.ip_strategy("AdAc", "bet").get("call", 0), 0.5, 0.05),
          f"call={r.ip_strategy('AdAc', 'bet').get('call', 0):.3f}")
    check("river: CFR+ nuts value-bets ~100%", r.oop_strategy("JhJc").get("bet", 0) > 0.9,
          f"bet={r.oop_strategy('JhJc').get('bet', 0):.3f}")
    check("river: CFR+ value matches the converged equilibrium", near(r.game_value, ref.game_value, 0.02),
          f"plus={r.game_value:+.3f} ref={ref.game_value:+.3f}")

    # ---- preflop push/fold (leaf_ev=None -> Nash) ----
    pvan = preflop.solve(preflop.PreflopGame(SB, BB, stack=10.0), iters=N, seed=1, plus=False)
    pplus = preflop.solve(preflop.PreflopGame(SB, BB, stack=10.0), iters=N, seed=1, plus=True)
    check("preflop: CFR+ less exploitable than vanilla at low iters",
          pplus.exploitability() < pvan.exploitability(),
          f"plus={pplus.exploitability():.4f} vanilla={pvan.exploitability():.4f}")
    check("preflop: CFR+ AA always jams (known push/fold property)",
          pplus.sb_strategy("AhAc").get("jam", 0) > 0.95, f"jam(AA)={pplus.sb_strategy('AhAc').get('jam', 0):.3f}")

    # ---- determinism ----
    again = postflop.solve(postflop.PostflopGame(**TURN), iters=N, seed=1, plus=True)
    check("deterministic: same seed -> same value", abs(again.game_value - plus.game_value) < 1e-9)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
