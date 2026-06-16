"""
kuhn_cfr.py — CFR correctness anchor before building a real postflop solver.

Kuhn poker (3-card deck J<Q<K, 1 card each, 1 betting round) has a known
closed-form Nash equilibrium with game value exactly -1/18 to player 0. We run
vanilla CFR and verify it converges to that value, reproduces the
parameter-independent equilibrium frequencies, and has ~zero exploitability
(measured by exact brute-force best response). If this passes, the CFR
algorithm/implementation is trustworthy — then the same algorithm can be taken
to a heads-up postflop game (which only adds chance nodes + a showdown engine).

Run:  python tools/solver/kuhn_cfr.py
Pure stdlib, no dependencies.
"""
import random
import itertools

PASS, BET = 0, 1
ACTIONS = "pb"                       # p=pass/check/fold, b=bet/call
DEALS = [(a, b) for a in range(3) for b in range(3) if a != b]   # 6 deals, each 1/6

# ---- terminal payoff to player 0 (ante 1 each) ----
TERMINAL = {            # history -> magnitude sign rule
    "pp": ("show", 1),  # check-check showdown, pot 2 -> +/-1
    "bp": ("p0", 1),    # p0 bet, p1 fold -> p0 +1
    "bb": ("show", 2),  # bet-call showdown, pot 4 -> +/-2
    "pbp": ("p1", 1),   # p0 check, p1 bet, p0 fold -> p0 -1
    "pbb": ("show", 2), # check-bet-call showdown -> +/-2
}
def terminal_payoff0(cards, h):
    t = TERMINAL.get(h)
    if t is None:
        return None
    kind, mag = t
    if kind == "p0":
        return mag
    if kind == "p1":
        return -mag
    return mag if cards[0] > cards[1] else -mag      # showdown

# ---- CFR ----
class Node:
    __slots__ = ("regret", "strat_sum")
    def __init__(self):
        self.regret = [0.0, 0.0]
        self.strat_sum = [0.0, 0.0]
    def strategy(self):
        s = [r if r > 0 else 0.0 for r in self.regret]
        n = s[0] + s[1]
        return [s[0] / n, s[1] / n] if n > 0 else [0.5, 0.5]
    def average(self):
        n = self.strat_sum[0] + self.strat_sum[1]
        return [self.strat_sum[0] / n, self.strat_sum[1] / n] if n > 0 else [0.5, 0.5]

nodes = {}
def node(infoset):
    nd = nodes.get(infoset)
    if nd is None:
        nd = nodes[infoset] = Node()
    return nd

def cfr(cards, history, p0, p1):
    t = terminal_payoff0(cards, history)
    if t is not None:
        # return value to the player about to act (sign convention below)
        player = len(history) % 2
        return t if player == 0 else -t
    player = len(history) % 2
    nd = node(str(cards[player]) + history)
    strat = nd.strategy()
    util = [0.0, 0.0]
    node_util = 0.0
    for a in range(2):
        nxt = history + ACTIONS[a]
        util[a] = -cfr(cards, nxt, p0 * strat[a], p1) if player == 0 else -cfr(cards, nxt, p0, p1 * strat[a])
        node_util += strat[a] * util[a]
    reach_opp = p1 if player == 0 else p0
    reach_self = p0 if player == 0 else p1
    for a in range(2):
        nd.regret[a] += reach_opp * (util[a] - node_util)
        nd.strat_sum[a] += reach_self * strat[a]
    return node_util

def train(iters, seed=1):
    rng = random.Random(seed)
    deck = [0, 1, 2]
    total = 0.0
    for _ in range(iters):
        rng.shuffle(deck)
        total += cfr(deck[:2], "", 1.0, 1.0)
    return total / iters       # average game value to player 0

# ---- exact exploitability via brute-force best response ----
P0_INFOSETS = ["0", "1", "2", "0pb", "1pb", "2pb"]
P1_INFOSETS = ["0p", "1p", "2p", "0b", "1b", "2b"]

def ev0(cards, h, s0, s1):
    t = terminal_payoff0(cards, h)
    if t is not None:
        return t
    player = len(h) % 2
    strat = (s0 if player == 0 else s1)[str(cards[player]) + h]
    return strat[0] * ev0(cards, h + "p", s0, s1) + strat[1] * ev0(cards, h + "b", s0, s1)

def game_value(s0, s1):
    return sum(ev0(list(c), "", s0, s1) for c in DEALS) / len(DEALS)

def pure_strategies(infosets):
    for bits in itertools.product((0, 1), repeat=len(infosets)):
        yield {iset: ([0.0, 1.0] if b else [1.0, 0.0]) for iset, b in zip(infosets, bits)}

def exploitability(avg0, avg1):
    br0 = max(game_value(p0, avg1) for p0 in pure_strategies(P0_INFOSETS))     # best value to P0
    br1 = max(-game_value(avg0, p1) for p1 in pure_strategies(P1_INFOSETS))    # best value to P1
    return br0 + br1, br0, br1        # 0 at Nash (zero-sum)

# ---- run + verify ----
def main():
    iters = 400_000
    value = train(iters, seed=1)
    avg = {iset: nd.average() for iset, nd in nodes.items()}
    avg0 = {i: avg[i] for i in P0_INFOSETS}
    avg1 = {i: avg[i] for i in P1_INFOSETS}
    expl, br0, br1 = exploitability(avg0, avg1)

    bet = lambda iset: avg[iset][1]
    print(f"iterations      : {iters:,}")
    print(f"game value (P0) : {value:+.5f}   (exact Nash = {-1/18:+.5f})")
    print(f"exploitability  : {expl:.5f}   (best-response gain, 0 = exact Nash)")
    print("P2 (parameter-independent) bet/call frequencies:")
    print(f"  J facing check bet={bet('0p'):.3f} (=1/3)   Q facing bet call={bet('1b'):.3f} (=1/3)")
    print(f"  K facing check bet={bet('2p'):.3f} (=1)     J facing bet  call={bet('0b'):.3f} (=0)")
    print("P1 fixed points:")
    print(f"  Q open bet={bet('1'):.3f} (=0)   J call vs bet={bet('0pb'):.3f} (=0)   K call vs bet={bet('2pb'):.3f} (=1)")
    print(f"  bluff ratio K:J open = {bet('2'):.3f} : {bet('0'):.3f}  (K should be ~3x J)")

    ok = True
    def chk(name, got, want, tol):
        nonlocal ok
        good = abs(got - want) <= tol
        ok = ok and good
        if not good:
            print(f"  FAIL {name}: {got:.3f} vs {want} (tol {tol})")
    chk("game value", value, -1/18, 0.01)
    chk("exploitability", expl, 0.0, 0.03)
    chk("P2 J-check bet", bet("0p"), 1/3, 0.06)
    chk("P2 Q-bet call", bet("1b"), 1/3, 0.06)
    chk("P2 K-check bet", bet("2p"), 1.0, 0.05)
    chk("P2 J-bet call", bet("0b"), 0.0, 0.05)
    chk("P1 Q open bet", bet("1"), 0.0, 0.05)
    chk("P1 J call", bet("0pb"), 0.0, 0.05)
    chk("P1 K call", bet("2pb"), 1.0, 0.05)
    # bluff ratio K:J ~ 3:1 (only meaningful if J bluffs > ~2%)
    if bet("0") > 0.02:
        chk("bluff ratio K=3J", bet("2"), 3 * bet("0"), 0.08)

    print("\n" + ("PASS — CFR converged to the known Kuhn equilibrium" if ok
                  else "FAIL — CFR did not match the known equilibrium"))
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
