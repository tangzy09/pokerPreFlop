"""
endtoend.py — preflop solved with a REAL postflop-solver leaf.

The preflop solver's "see a flop" leaf is usually a cheap model. Here we wire it
to the actual multi-street postflop CFR solver: for each sampled board we solve
the postflop subgame (OOP=BB, IP=SB) and read off the per-(sb,bb) EV, then the
leaf returns the average over boards. This is the genuine preflop<->postflop
dependency, end to end. It is EXPENSIVE (a postflop solve per board), so the
demo uses tiny ranges, few boards, and shallow stacks.

EV bridge: at the limp-check node both players have committed 1bb, so the pot is
2 and each "owns" P/2 = 1bb — exactly the postflop P/2 baseline. Hence postflop
util_oop(BB) == BB's net-from-start, and SB's leaf EV = -util_oop.

Run:  python tools/solver/endtoend.py
"""
import random
import postflop
import preflop
from postflop import PostflopGame, hand_cards

RC, SC = "23456789TJQKA", "shdc"
def cstr(c):
    return RC[c >> 2] + SC[c & 3]

def make_postflop_leaf(sb, bb, behind, n_boards=3, board_cards=3, iters=200, seed=1, frac=1.0):
    """Returns (leaf_ev, table, calls, boards). leaf_ev(sb_hand, bb_hand, pot) ->
    EV to SB of seeing the board, = avg over sampled boards of a real postflop solve."""
    rng = random.Random(seed)
    used = set()
    for h, _ in list(sb) + list(bb):
        used |= set(hand_cards(h))
    deck = [c for c in range(52) if c not in used]
    boards, seen = [], set()
    while len(boards) < n_boards:
        cs = tuple(sorted(rng.sample(deck, board_cards)))
        if cs in seen:
            continue
        seen.add(cs)
        boards.append([cstr(c) for c in cs])
    acc, cnt = {}, {}
    for i, board in enumerate(boards):
        g = PostflopGame(board=board, oop=bb, ip=sb, pot=2.0, stack=behind, bet_sizes=[frac])
        sol = postflop.solve(g, iters=iters, seed=100 + i)
        for (bbs, sbs), u in sol.deal_values().items():      # u = util to OOP(BB)
            acc[(sbs, bbs)] = acc.get((sbs, bbs), 0.0) - u   # SB EV = -util_oop
            cnt[(sbs, bbs)] = cnt.get((sbs, bbs), 0) + 1
    table = {k: acc[k] / cnt[k] for k in acc}
    calls = {"n": 0}
    def leaf(sbh, bbh, pot):
        calls["n"] += 1
        return table.get((sbh, bbh), 0.0)
    return leaf, table, calls, boards

def main():
    SB = [("AhAc", 1.0), ("7h2d", 1.0)]
    BB = [("KsKd", 1.0), ("QsQd", 1.0)]
    PRE_STACK = 3.0                       # behind after the limp = 2.0
    NB, BOARD = 3, 3                       # 3 sampled flops (board_cards=3)
    leaf, table, calls, boards = make_postflop_leaf(
        SB, BB, behind=PRE_STACK - 1.0, n_boards=NB, board_cards=BOARD, iters=200, seed=1)

    print(f"postflop-solved leaf EV to SB (avg over {len(boards)} boards of {BOARD} cards):")
    for k in sorted(table):
        print(f"  SB {k[0]} vs BB {k[1]} : {table[k]:+.3f}")

    g = preflop.PreflopGame(SB, BB, stack=PRE_STACK, leaf_ev=leaf)
    s = preflop.solve(g, iters=4000, seed=1)
    expl = s.exploitability()
    print(f"\npreflop: value(SB)={s.game_value:+.3f}  exploitability={expl:.4f}  leaf calls={calls['n']}")
    for h in ("AhAc", "7h2d"):
        print(f"  SB {h}: {{{', '.join(f'{k}:{v:.2f}' for k, v in s.sb_strategy(h).items())}}}")

    ok = True
    def ck(name, cond, detail=""):
        nonlocal ok
        ok = ok and bool(cond)
        print(("  ok  " if cond else "  FAIL") + f" {name}" + (f"  [{detail}]" if detail else ""))
    ck("leaf (real postflop solve) was used", calls["n"] > 0, f"calls={calls['n']}")
    ck("leaf EVs are bounded by the stack", all(abs(v) <= PRE_STACK for v in table.values()))
    ck("AA realizes better than trash on the flop",
       min(table[("AhAc", b)] for b in ("KsKd", "QsQd")) > max(table[("7h2d", b)] for b in ("KsKd", "QsQd")))
    ck("preflop converges with the real leaf", expl < 0.05, f"expl={expl:.4f}")

    # --- 10 more (reuse the computed leaf table + preflop solution; cheap) ---
    # leaf table sanity (the postflop solves produced sane, differentiated EVs)
    ck("AA leaf EV > 0 vs both (wins postflop)", all(table[("AhAc", b)] > 0 for b in ("KsKd", "QsQd")))
    ck("trash leaf EV < 0 vs both (loses postflop)", all(table[("7h2d", b)] < 0 for b in ("KsKd", "QsQd")))
    ck("AA beats the weaker overpair more (QQ > KK)", table[("AhAc", "QsQd")] > table[("AhAc", "KsKd")])
    ck("trash loses less to the weaker overpair (QQ > KK)", table[("7h2d", "QsQd")] > table[("7h2d", "KsKd")])
    ck("leaf EVs are non-degenerate (real spread)", max(table.values()) - min(table.values()) > 1.0,
       f"spread={max(table.values()) - min(table.values()):.3f}")
    # full table is populated for every matchup
    ck("leaf table covers all 4 matchups", len(table) == 4, f"n={len(table)}")
    # preflop solution sanity
    ck("SB strategies are valid distributions",
       all(abs(sum(s.sb_strategy(h).values()) - 1) < 1e-6 for h in ("AhAc", "7h2d")))
    ck("AA never folds (plays its premium)", s.sb_strategy("AhAc").get("fold", 0) < 0.05,
       f"fold(AA)={s.sb_strategy('AhAc').get('fold', 0):.3f}")
    ck("preflop game value bounded by stack", abs(s.game_value) < PRE_STACK, f"value={s.game_value:+.3f}")
    # deterministic + convergent (cheap: leaf table is cached, only the preflop CFR re-runs)
    v2 = preflop.solve(preflop.PreflopGame(SB, BB, stack=PRE_STACK, leaf_ev=leaf), iters=4000, seed=1).game_value
    ck("deterministic: same seed -> same value", abs(v2 - s.game_value) < 1e-9, f"{v2:.6f} vs {s.game_value:.6f}")
    coarse = preflop.solve(preflop.PreflopGame(SB, BB, stack=PRE_STACK, leaf_ev=leaf), iters=120, seed=2).exploitability()
    ck("convergence: more iters -> less exploitable", expl < coarse, f"coarse={coarse:.4f} fine={expl:.4f}")

    print("\n" + ("PASS — preflop solved end-to-end with a real postflop-solver leaf"
                  if ok else "FAIL"))
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
