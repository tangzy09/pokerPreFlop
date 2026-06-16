"""
test_streets.py — TESTS FIRST for adding STREETS (chance nodes) to the solver.

The river solver (postflop.py / test_postflop.py) is verified. The next layer
adds a chance node: a turn board (4 cards) deals a river, with a betting round
on each street. Multi-street GTO rarely has a closed form, so we anchor on
properties that DON'T need one:

  T1 reduces-to-river : a 5-card board through the general multi-street solver
                        must equal the verified RiverGame (no chance node ->
                        identical game). Guards backward-compatibility.
  T2 chance averaging : nuts-vs-air across ALL rivers -> air folds, OOP wins
                        100% -> value = +P/2 exactly, exploitability ~ 0.
  T3 convergence      : a real turn spot (4-card board, chance node, deeper
                        stack so both streets have betting) -> exploitability
                        -> ~0 (the solver reaches equilibrium of the game it built).

API contract the solver must add
--------------------------------
    pf.PostflopGame(board, oop, ip, pot, stack, bet_sizes)
        board length 3/4/5 (flop/turn/river); 5 == the existing river game.
        Deals the remaining streets as chance nodes, one betting round each.
    solve(game, iters, seed) -> Solution        # same interface as before
        .game_value, .exploitability(), .oop_strategy(hand), .ip_strategy(hand, facing)
    (exploitability must use a recursive best response — brute-forcing pure
     strategies does NOT scale once per-river infosets exist.)

Run:  python tools/solver/test_streets.py
"""

# river spot (stack==pot -> pot bet is all-in -> no further streets); reused for T1
RIVER_BOARD = ["2c", "7d", "9h", "Js", "4s"]
POLAR_RIVER = dict(board=RIVER_BOARD, oop=[("JhJc", 1.0), ("QdTh", 1.0)],
                   ip=[("AdAc", 1.0)], pot=1.0, stack=1.0, bet_sizes=[1.0])

# turn spots: 4-card RAINBOW board (no flush ever), deeper stack so the turn bet
# is NOT all-in and a river betting round really exists.
TURN_BOARD = ["Ah", "Kd", "7c", "2s"]
# OOP set of aces is the nuts on EVERY river; IP 8-3 off can never beat it.
NUTS_AIR_TURN = dict(board=TURN_BOARD, oop=[("AsAc", 1.0)], ip=[("8d3c", 1.0)],
                     pot=1.0, stack=4.0, bet_sizes=[1.0])
# polarized turn: OOP nuts + air vs IP a bluff-catcher (pair of kings)
POLAR_TURN = dict(board=TURN_BOARD, oop=[("AsAc", 1.0), ("8d3c", 1.0)],
                  ip=[("KsQh", 1.0)], pot=1.0, stack=4.0, bet_sizes=[1.0])

TOL = 0.06
results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
def near(a, b, tol=TOL):
    return abs(a - b) <= tol

def run():
    try:
        import postflop as pf
    except Exception as e:
        print(f"RED: solver import failed ({type(e).__name__}: {e})")
        return 1
    if not hasattr(pf, "PostflopGame"):
        print("RED: pf.PostflopGame not implemented yet — these tests define the contract.")
        return 1

    # --- T1: 5-card board through the general solver == river solver ---
    rsol = pf.solve(pf.RiverGame(**POLAR_RIVER), iters=20000, seed=1)
    gsol = pf.solve(pf.PostflopGame(**POLAR_RIVER), iters=20000, seed=1)
    check("reduces-to-river: value matches", near(gsol.game_value, rsol.game_value, 0.03),
          f"general={gsol.game_value:+.3f} river={rsol.game_value:+.3f}")
    check("reduces-to-river: nuts bet matches",
          near(gsol.oop_strategy("JhJc").get("bet", 0), rsol.oop_strategy("JhJc").get("bet", 0), 0.05))
    check("reduces-to-river: bluff-catcher call matches",
          near(gsol.ip_strategy("AdAc", "bet").get("call", 0), rsol.ip_strategy("AdAc", "bet").get("call", 0), 0.06))

    # --- T2: nuts-vs-air across all rivers ---
    nsol = pf.solve(pf.PostflopGame(**NUTS_AIR_TURN), iters=6000, seed=2)
    check("nuts-vs-air: value = +P/2 (OOP wins every river)", near(nsol.game_value, 0.5),
          f"value={nsol.game_value:+.3f}")
    check("nuts-vs-air: air folds to turn bet", nsol.ip_strategy("8d3c", "bet").get("fold", 0) > 0.9,
          f"fold={nsol.ip_strategy('8d3c','bet').get('fold',0):.3f}")
    check("nuts-vs-air: exploitability ~ 0", nsol.exploitability() < 0.03,
          f"expl={nsol.exploitability():.4f}")

    # --- T3: real turn spot converges (chance node + two betting streets) ---
    psol = pf.solve(pf.PostflopGame(**POLAR_TURN), iters=6000, seed=3)
    check("turn spot: exploitability ~ 0", psol.exploitability() < 0.05,
          f"expl={psol.exploitability():.4f}")

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
