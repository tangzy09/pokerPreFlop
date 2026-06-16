"""
test_preflop.py — TESTS FIRST for connecting preflop <-> postflop.

A correct preflop solver must value "see a flop" leaves with a postflop EV
(that's the preflop->postflop dependency). We model that as an INJECTED
`leaf_ev` callback so the postflop solver (or any EV model) can be plugged in,
and so the dependency is explicit and testable.

Heads-up SB-vs-BB, chip-EV, minimal tree:
    SB: fold / limp(complete to 1bb) / jam(all-in)
    BB facing a limp: check(-> see a flop, leaf_ev) / jam
    BB facing a jam : fold / call(all-in -> showdown equity)
    SB facing BB's jam-over-limp: fold / call

Anchors that need no closed form:
  T1 reduces-to-pushfold : leaf_ev=None disables the flop (jam/fold only) -> the
       solver must be a Nash of the push/fold game: exploitability ~0, and the
       best hand always jams.
  T2 leaf plumbing       : when leaf_ev is provided it actually gets CALLED, and
       the combined game still converges (exploitability ~0).
  T3 combined convergence: deeper stack so limping to a flop is a real option;
       with a neutral flop (leaf_ev = breakeven) exploitability -> ~0.

API contract the solver must provide
------------------------------------
    import preflop as pf
    g = pf.PreflopGame(sb, bb, stack, leaf_ev=None)
        sb, bb : list of (hand, weight)
        stack  : effective stack in bb (blinds 0.5/1)
        leaf_ev(sb_hand, bb_hand, pot) -> EV to SB of seeing a flop (None disables limping)
    sol = pf.solve(g, iters, seed)
        sol.game_value, sol.exploitability()
        sol.sb_strategy(hand)             -> {action: prob}  (fold/limp/jam)
        sol.bb_strategy(hand, facing)     -> facing in {"jam","limp"}

Run:  python tools/solver/test_preflop.py
"""

SB = [("AhAc", 1.0), ("7h2d", 1.0)]      # a premium + a trash hand
BB = [("KsKd", 1.0), ("QsQd", 1.0)]

TOL = 0.06
results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))

def run():
    try:
        import preflop as pf
    except Exception as e:
        print(f"RED: preflop solver not implemented yet ({type(e).__name__}: {e})")
        print("These tests define the preflop<->postflop contract; implement tools/solver/preflop.py.")
        return 1

    # --- T1: jam/fold only (no flop) reduces to a push/fold Nash ---
    g1 = pf.PreflopGame(SB, BB, stack=10.0, leaf_ev=None)
    s1 = pf.solve(g1, iters=8000, seed=1)
    check("jam/fold: exploitability ~ 0", s1.exploitability() < 0.03, f"expl={s1.exploitability():.4f}")
    check("jam/fold: best hand (AA) always jams", s1.sb_strategy("AhAc").get("jam", 0) > 0.9,
          f"jam(AA)={s1.sb_strategy('AhAc').get('jam',0):.3f}")

    # --- T2: leaf_ev is actually invoked, and the combined game still converges ---
    calls = {"n": 0}
    def leaf(sbh, bbh, pot):
        calls["n"] += 1
        return 0.0                      # neutral flop
    g2 = pf.PreflopGame(SB, BB, stack=10.0, leaf_ev=leaf)
    s2 = pf.solve(g2, iters=6000, seed=2)
    check("leaf_ev gets called (flop leaves valued by it)", calls["n"] > 0, f"calls={calls['n']}")
    check("with-flop: exploitability ~ 0", s2.exploitability() < 0.03, f"expl={s2.exploitability():.4f}")

    # --- T3: deeper stack, neutral flop -> still converges ---
    g3 = pf.PreflopGame(SB, BB, stack=25.0, leaf_ev=lambda a, b, p: 0.0)
    s3 = pf.solve(g3, iters=6000, seed=3)
    check("deep + flop: exploitability ~ 0", s3.exploitability() < 0.04, f"expl={s3.exploitability():.4f}")
    check("deep + flop: game value is finite", abs(s3.game_value) < 100, f"value={s3.game_value:+.3f}")

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
