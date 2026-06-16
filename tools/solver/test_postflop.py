"""
test_postflop.py — TESTS FIRST for the heads-up postflop CFR solver.

Written before the implementation (tools/solver/postflop.py). Defines the API
contract and pins the solver to analytically-known answers, the same way
kuhn_cfr.py pins the engine to Kuhn's -1/18.

We start with RIVER spots: the board is complete, so there are no chance nodes
left — the cleanest case, and it has closed-form GTO targets (MDF, the
value:bluff ratio). Once these pass, the engine extends to flop/turn (which only
add chance/runout nodes on top of the same betting-tree CFR).

API contract the solver must provide
------------------------------------
    import postflop as pf
    g = pf.RiverGame(board, oop, ip, pot, stack, bet_sizes)
        board     : list of 5 card strings, e.g. ["2c","7d","9h","Js","4s"]
        oop, ip   : list of (hand, weight), hand = 4-char combo, e.g. ("JhJc", 1.0)
                    OOP acts first.
        pot       : starting pot (units)
        stack     : effective stack behind for EACH player
        bet_sizes : list of bet sizes as fractions of pot, e.g. [1.0]
    sol = pf.solve(g, iters=..., seed=...)
        sol.game_value                      -> float (EV to OOP, in pot units)
        sol.exploitability()                -> float (sum of best-response gains; 0 = Nash)
        sol.oop_strategy(hand)              -> {action: prob} at OOP's first decision
        sol.ip_strategy(hand, facing)       -> {action: prob} facing OOP's `facing` action
    Action labels: "check", "bet" (single size), "fold", "call".  (Multi-size /
    raises can extend the label set later; these tests use one pot-sized bet.)

Run:  python tools/solver/test_postflop.py
"""

# ---- the classic polarized river toy (board chosen so ranks are unambiguous) ----
# Board 2c 7d 9h Js 4s : no flush/straight possible for the hands below.
#   OOP "JhJc" = set of jacks  (NUTS)
#   IP  "AdAc" = pair of aces  (BLUFF-CATCHER: beats air, loses to the set)
#   OOP "QdTh" = queen-high     (AIR: loses to the pair)
# So NUTS > BLUFF-CATCHER > AIR, with no card conflicts.
BOARD = ["2c", "7d", "9h", "Js", "4s"]
POLAR = dict(
    board=BOARD,
    oop=[("JhJc", 1.0), ("QdTh", 1.0)],   # 50% nuts, 50% air
    ip=[("AdAc", 1.0)],                    # pure bluff-catcher
    pot=1.0, stack=1.0, bet_sizes=[1.0],   # one pot-sized bet
)

# Closed-form GTO for a pot-sized bet (pot p=1, bet b=1), equal nuts/air counts:
#   caller indifference  -> P(bluff | bet) = b/(p+2b) = 1/3  (value:bluff = 2:1)
#     with 1 nut combo always betting, bluff freq f gives f/(1+f)=1/3 -> f = 1/2
#   bettor indifference  -> caller MDF = 1 - b/(p+b) = 1/2   (call 50% of bluff-catchers)
EXP_OOP_VALUEBET = 1.0     # always bet the nuts
EXP_OOP_BLUFF = 0.5        # bluff air half the time
EXP_IP_CALL = 0.5          # call the bluff-catcher half the time

# nuts-vs-air: OOP only nuts, IP only worse -> OOP bets, IP must fold to a pot bet
TRIVIAL = dict(
    board=BOARD,
    oop=[("JhJc", 1.0)],     # only the set
    ip=[("QdTh", 1.0)],      # only worse-than-a-pair air
    pot=1.0, stack=1.0, bet_sizes=[1.0],
)

TOL = 0.06
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))

def near(a, b, tol=TOL):
    return abs(a - b) <= tol

def run():
    try:
        import postflop as pf
    except Exception as e:
        print(f"RED: postflop solver not implemented yet ({type(e).__name__}: {e})")
        print("These tests define the contract; implement tools/solver/postflop.py to make them pass.")
        return 1

    # --- 1. polarized river: exploitability -> ~0 (universal CFR correctness) ---
    g = pf.RiverGame(**POLAR)
    sol = pf.solve(g, iters=20000, seed=1)
    expl = sol.exploitability()
    check("polarized: exploitability ~ 0", expl < 0.02, f"expl={expl:.4f}")

    # --- 2. polarized river: GTO frequencies match the closed form ---
    oj = sol.oop_strategy("JhJc")
    oq = sol.oop_strategy("QdTh")
    ia = sol.ip_strategy("AdAc", "bet")
    check("nuts value-bet ~ 1.0", near(oj.get("bet", 0), EXP_OOP_VALUEBET), f"bet(JJ)={oj.get('bet',0):.3f}")
    check("air bluff ~ 0.5", near(oq.get("bet", 0), EXP_OOP_BLUFF), f"bet(QT)={oq.get('bet',0):.3f}")
    check("bluff-catcher call ~ 0.5 (MDF)", near(ia.get("call", 0), EXP_IP_CALL), f"call(AA)={ia.get('call',0):.3f}")

    # --- 3. nuts vs air: degenerate-correct ---
    # NOTE: when the villain can only ever fold, betting vs checking the nuts is
    # EV-INDIFFERENT (OOP wins the pot either way) — so we do NOT require betting.
    # The real invariants are: air must fold to a pot bet, and OOP (winning 100%
    # of showdowns) earns exactly its fair share +P/2.
    sol2 = pf.solve(pf.RiverGame(**TRIVIAL), iters=8000, seed=2)
    fq = sol2.ip_strategy("QdTh", "bet").get("fold", 0)
    check("air must fold to pot bet", fq > 0.9, f"fold(QT)={fq:.3f}")
    check("OOP wins 100% -> value = +P/2", near(sol2.game_value, 0.5), f"value={sol2.game_value:+.3f}")

    # --- 4. value sanity: polarized bettor (OOP) has positive EV from dead money + bluffs ---
    check("polarized OOP value > 0", sol.game_value > 0, f"value={sol.game_value:+.4f}")

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    raise SystemExit(run())
