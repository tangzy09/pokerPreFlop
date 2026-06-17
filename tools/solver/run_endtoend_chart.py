"""
run_endtoend_chart.py — a REAL (not toy) end-to-end preflop computation.

Computes a HU short-stack SB fold/limp/jam decision per hand, where the "see a
board" leaf EV comes from ACTUAL postflop CFR solves (OOP=BB, IP=SB) averaged over
sampled complete 5-card boards (board_cards=5 -> single-street river leaves, no
chance fan-out, so it's tractable at a real range size). CFR+ (default) converges
each solve fast. This is the genuine preflop<->postflop dependency at a presentable
scale — honest scope: HU, one short stack, fold/limp/jam tree (no open-raise sizing),
EV from real postflop play on sampled full runouts (not full multi-street strategy).

Run:  python tools/solver/run_endtoend_chart.py
"""
import time
import preflop
from endtoend import make_postflop_leaf

STACK = 8.0                          # effective bb (behind after limp = STACK-1)
N_BOARDS = 40                        # sampled complete 5-card boards per matchup
LEAF_ITERS = 1500                    # postflop CFR+ iters per board
PRE_ITERS = 6000

# SB hands: one combo per class, spanning premium -> trash (distinct-ish suits)
SB = [(h, 1.0) for h in [
    "AhAc", "KhKc", "QhQc", "JhJc", "ThTc", "7h7c", "5h5c", "2h2c",
    "AhKh", "AhQh", "AhJs", "KhQs", "AhTs", "Kh9s", "Qh8s", "Jh7s", "8h4s", "7h2d"]]
# BB defending range (fixed): strong pairs + a couple of broadways/suited
BB = [(h, 1.0) for h in ["KsKd", "QsQd", "JsJd", "AsKd", "AsQs", "Ts9s"]]

ORDER = {h: k for k, (h, _) in enumerate(SB)}

def main():
    t0 = time.time()
    leaf, table, calls, boards = make_postflop_leaf(
        SB, BB, behind=STACK - 1.0, n_boards=N_BOARDS, board_cards=5, iters=LEAF_ITERS, seed=7)
    t_leaf = time.time() - t0

    g = preflop.PreflopGame(SB, BB, stack=STACK, leaf_ev=leaf)
    s = preflop.solve(g, iters=PRE_ITERS, seed=1)
    expl = s.exploitability()
    t_all = time.time() - t0

    print(f"HU {STACK:.0f}bb  SB fold/limp/jam  (leaf = real postflop solve avg over "
          f"{len(boards)} full boards)")
    print(f"leaf compute {t_leaf:.0f}s | total {t_all:.0f}s | preflop expl={expl:.4f} | value(SB)={s.game_value:+.3f}")
    print(f"{'hand':6} {'fold':>6} {'limp':>6} {'jam':>6}")
    for h, _ in sorted(SB, key=lambda x: ORDER[x[0]]):
        st = s.sb_strategy(h)
        print(f"{h:6} {st.get('fold', 0):6.2f} {st.get('limp', 0):6.2f} {st.get('jam', 0):6.2f}")

if __name__ == "__main__":
    main()
