"""
test_preflop_raise.py — TESTS FIRST for adding a real open-RAISE to the preflop
tree (v2). Until now jam was the only raise; this adds an open-raise to a size
`open_size` (and a re-raise = jam). The flop-leaf and jam machinery are reused.

Extended HU tree when open_size=R is set and leaf_ev is provided:
    SB:                 fold / limp / raise(to R) / jam
    BB facing limp:     check(->flop) / raise(to R) / jam
    BB facing raise:    fold / call(->flop) / jam
    BB facing jam:      fold / call
    SB facing BB raise: fold / call(->flop) / jam
    (any re-raise is a jam; a call over a non-jam goes to a flop leaf)
Gating: with leaf_ev=None there are no flops, so limp/raise are disabled and the
tree collapses to push/fold (fold/jam) — the reduction must still hold.

API addition:  PreflopGame(sb, bb, stack, leaf_ev=None, open_size=None)
   open_size = the open-raise size in bb (None => v1 fold/limp/jam tree).

Run:  python tools/solver/test_preflop_raise.py
"""
SB = [("AhAc", 1.0), ("7h2d", 1.0)]
BB = [("KsKd", 1.0), ("QsQd", 1.0)]
R = 3.0

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))

def run():
    try:
        import preflop as pf
    except Exception as e:
        print(f"RED: import failed ({type(e).__name__}: {e})")
        return 1
    import inspect
    if "open_size" not in inspect.signature(pf.PreflopGame.__init__).parameters:
        print("RED: PreflopGame has no open_size parameter yet — implement v2 raises.")
        return 1

    # --- reduces to push/fold: open_size set but leaf_ev=None -> only fold/jam ---
    g0 = pf.PreflopGame(SB, BB, stack=10.0, leaf_ev=None, open_size=R)
    s0 = pf.solve(g0, iters=8000, seed=1)
    check("reduce: exploitability ~ 0", s0.exploitability() < 0.03, f"expl={s0.exploitability():.4f}")
    # value must equal the plain jam/fold game (gating: raises truly disabled w/o a flop)
    plain = pf.solve(pf.PreflopGame(SB, BB, stack=10.0, leaf_ev=None), iters=8000, seed=1)
    check("reduce: value == plain jam/fold", abs(s0.game_value - plain.game_value) < 1e-9,
          f"{s0.game_value:.6f} vs {plain.game_value:.6f}")
    check("reduce: actions are exactly {fold,jam}", set(s0.sb_strategy("AhAc")) == {"fold", "jam"},
          f"{set(s0.sb_strategy('AhAc'))}")

    # --- with a flop + raises: the richer tree ---
    g = pf.PreflopGame(SB, BB, stack=10.0, leaf_ev=lambda a, b, p: 0.0, open_size=R)
    s = pf.solve(g, iters=8000, seed=2)
    acts = set(s.sb_strategy("AhAc"))
    check("raise+limp are offered to SB", {"raise", "limp"} <= acts, f"{acts}")
    check("with raises: exploitability ~ 0", s.exploitability() < 0.04, f"expl={s.exploitability():.4f}")
    check("with raises: AA never folds", s.sb_strategy("AhAc").get("fold", 0) < 0.05,
          f"fold(AA)={s.sb_strategy('AhAc').get('fold', 0):.3f}")
    check("with raises: SB strategies are valid distributions",
          all(abs(sum(s.sb_strategy(h).values()) - 1) < 1e-6 for h in ("AhAc", "7h2d")))
    check("with raises: |game value| < stack", abs(s.game_value) < 10.0, f"value={s.game_value:+.3f}")

    # --- determinism + convergence ---
    s_again = pf.solve(pf.PreflopGame(SB, BB, stack=10.0, leaf_ev=lambda a, b, p: 0.0, open_size=R), iters=8000, seed=2)
    check("deterministic: same seed -> same value", abs(s.game_value - s_again.game_value) < 1e-9,
          f"{s.game_value:.6f} vs {s_again.game_value:.6f}")
    coarse = pf.solve(pf.PreflopGame(SB, BB, stack=10.0, leaf_ev=lambda a, b, p: 0.0, open_size=R),
                      iters=150, seed=3).exploitability()
    check("convergence: more iters -> less exploitable", s.exploitability() < coarse,
          f"coarse={coarse:.4f} fine={s.exploitability():.4f}")

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
