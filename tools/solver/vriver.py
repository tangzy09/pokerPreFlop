"""
vriver.py — VECTORIZED heads-up river CFR (full-range capable, needs numpy).

Instead of iterating per hand-pair (scalar postflop.py), this propagates per-hand
REACH VECTORS through the public betting tree and evaluates terminals as
matrix-vector products, so it scales to large ranges. Same game/EV convention as
postflop.py (single bet size, no raises; pot co-owned P/2, so utilities are
zero-sum). Verified against the scalar solver in test_vector.py.

Counterfactual value at a showdown (committed o,i; pot P), per OOP hand:
    cfv_oop = (P+o+i) * (SHARE_O @ ip_reach) - (o+P/2) * (VALID @ ip_reach)
where SHARE_O[a,b] = OOP's pot share vs IP hand b (1/0.5/0, 0 if the two hands
share a card) and VALID[a,b] = 1 if the pair is possible. (Symmetric for IP.)
"""
import numpy as np
from postflop import evaluate7, parse_card, hand_cards

CLOSED_PROCEED = {"xx", "bc", "xbc"}
CLOSED_FOLD = {"bf", "xbf"}
LABEL = {"x": "check", "b": "bet", "f": "fold", "c": "call"}
def actor(h):
    return 0 if len(h) % 2 == 0 else 1
def legal(h):
    return "fc" if h.endswith("b") else "xb"

class VRiver:
    def __init__(self, board, oop, ip, pot, stack, bet_sizes):
        bd = [parse_card(c) for c in board]
        self.board = bd
        self.pot = float(pot); self.stack = float(stack); self.bet = min(bet_sizes[0] * pot, stack)
        bset = set(bd)
        def mk(rng):
            return [(h, float(w), hand_cards(h)) for h, w in rng if not (set(hand_cards(h)) & bset)]
        self.oop = mk(oop); self.ip = mk(ip)
        self.oidx = {h: k for k, (h, _, _) in enumerate(self.oop)}
        self.iidx = {h: k for k, (h, _, _) in enumerate(self.ip)}
        No, Ni = len(self.oop), len(self.ip)
        so = [evaluate7(list(c) + bd) for _, _, c in self.oop]
        si = [evaluate7(list(c) + bd) for _, _, c in self.ip]
        ocs = [set(c) for _, _, c in self.oop]; ics = [set(c) for _, _, c in self.ip]
        SHARE = np.zeros((No, Ni)); VALID = np.zeros((No, Ni))
        for a in range(No):
            for b in range(Ni):
                if ocs[a] & ics[b]:
                    continue
                VALID[a, b] = 1.0
                SHARE[a, b] = 1.0 if so[a] > si[b] else (0.5 if so[a] == si[b] else 0.0)
        self.SHARE_O = SHARE
        self.SHARE_I = (1.0 - SHARE) * VALID            # IP share (valid pairs only)
        self.VALID = VALID
        self.ow = self._norm([w for _, w, _ in self.oop])
        self.iw = self._norm([w for _, w, _ in self.ip])

    @staticmethod
    def _norm(ws):
        a = np.array(ws, float); s = a.sum()
        return a / s if s > 0 else a

    def showdown_cfv(self, o, i, oor, ipr):
        P, c = self.pot, self.pot
        ev_o = (P + o + i) * (self.SHARE_O @ ipr) - (o + c / 2) * (self.VALID @ ipr)
        ev_i = (P + o + i) * (self.SHARE_I.T @ oor) - (i + c / 2) * (self.VALID.T @ oor)
        return ev_o, ev_i

    def fold_cfv(self, folder, o, i, oor, ipr):
        P = self.pot
        u_oop = (i + P / 2) if folder == 1 else (-o - P / 2)   # P/2-baseline fold util to OOP
        return u_oop * (self.VALID @ ipr), (-u_oop) * (self.VALID.T @ oor)

    def step(self, a, pl, o, i, h):
        if a in ("x", "f"):
            return o, i, h + a
        if a == "b":
            return (o + self.bet, i, h + "b") if pl == 0 else (o, i + self.bet, h + "b")
        d = abs(o - i)
        return (o + d, i, h + "c") if pl == 0 else (o, i + d, h + "c")

def solve(game, iters=20000, seed=0, plus=True):
    # plus=True -> CFR+: (1) regret-matching+ (floor cumulative regret at 0 each
    # update), (2) linear averaging (weight iteration t's strategy by t), and (3)
    # ALTERNATING updates (each traversal updates one player vs the other's current
    # strategy). Together these give ~O(1/t) convergence vs vanilla's ~O(1/sqrt(t)),
    # so the same Nash is reached in far fewer iterations. plus=False = vanilla.
    g = game; No, Ni = len(g.oop), len(g.ip)
    regret, strat_sum = {}, {}
    aw = [1.0]                                       # averaging weight for the current iteration
    def node(h):
        if h not in regret:
            n = No if actor(h) == 0 else Ni
            regret[h] = np.zeros((n, 2)); strat_sum[h] = np.zeros((n, 2))
        return regret[h], strat_sum[h]
    def strat(h):
        r, _ = node(h)
        pos = np.maximum(r, 0.0); s = pos.sum(1, keepdims=True)
        out = np.where(s > 0, pos / np.where(s > 0, s, 1), 0.5)
        return out
    def cfr(h, o, i, oor, ipr, up):                      # up = player to update (None -> both)
        if h in CLOSED_FOLD:
            return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
        if h in CLOSED_PROCEED:
            return g.showdown_cfv(o, i, oor, ipr)
        pl = actor(h); acts = legal(h); s = strat(h); r, ss = node(h)
        if pl == 0:
            cfv_i = np.zeros(Ni); child = []
            for k, a in enumerate(acts):
                no, ni, nh = g.step(a, 0, o, i, h)
                co, ci = cfr(nh, no, ni, oor * s[:, k], ipr, up)
                child.append(co); cfv_i = cfv_i + ci
            stacked = np.stack(child, 1)                 # (No, 2)
            cfv_o = (s * stacked).sum(1)
            if up is None or up == 0:
                r += stacked - cfv_o[:, None]
                if plus: np.maximum(r, 0.0, out=r)       # regret-matching+
                ss += aw[0] * oor[:, None] * s
            return cfv_o, cfv_i
        cfv_o = np.zeros(No); child = []
        for k, a in enumerate(acts):
            no, ni, nh = g.step(a, 1, o, i, h)
            co, ci = cfr(nh, no, ni, oor, ipr * s[:, k], up)
            child.append(ci); cfv_o = cfv_o + co
        stacked = np.stack(child, 1)                     # (Ni, 2)
        cfv_i = (s * stacked).sum(1)
        if up is None or up == 1:
            r += stacked - cfv_i[:, None]
            if plus: np.maximum(r, 0.0, out=r)           # regret-matching+
            ss += aw[0] * ipr[:, None] * s
        return cfv_o, cfv_i
    for t in range(iters):
        aw[0] = float(t + 1) if plus else 1.0            # linear averaging
        cfr("", 0.0, 0.0, g.ow.copy(), g.iw.copy(), (t % 2) if plus else None)
    return Solution(g, strat_sum)

class Solution:
    def __init__(self, game, strat_sum):
        self.g = game
        self._avg = {}
        for h, ss in strat_sum.items():
            s = ss.sum(1, keepdims=True)
            self._avg[h] = np.where(s > 0, ss / np.where(s > 0, s, 1), 0.5)
        self.oop = game.oop; self.ip = game.ip
        self.game_value = float(game.ow @ self._pass("avg", 0)[0])

    def _avg_at(self, h):
        if h in self._avg:
            return self._avg[h]
        n = len(self.g.oop) if actor(h) == 0 else len(self.g.ip)
        return np.full((n, 2), 0.5)

    # one forward pass; mode "avg" uses average strategy, "br<hero>" best-responds for hero
    def _pass(self, mode, br_hero=None):
        g = self.g; No, Ni = len(g.oop), len(g.ip)
        def rec(h, o, i, oor, ipr):
            if h in CLOSED_FOLD:
                return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
            if h in CLOSED_PROCEED:
                return g.showdown_cfv(o, i, oor, ipr)
            pl = actor(h); acts = legal(h); s = self._avg_at(h)
            if pl == 0:
                cfv_i = np.zeros(Ni); child = []
                for k, a in enumerate(acts):
                    no, ni, nh = g.step(a, 0, o, i, h)
                    co, ci = rec(nh, no, ni, oor * s[:, k], ipr)
                    child.append(co); cfv_i = cfv_i + ci
                st = np.stack(child, 1)
                cfv_o = st.max(1) if (mode == "br" and br_hero == 0) else (s * st).sum(1)
                return cfv_o, cfv_i
            cfv_o = np.zeros(No); child = []
            for k, a in enumerate(acts):
                no, ni, nh = g.step(a, 1, o, i, h)
                co, ci = rec(nh, no, ni, oor, ipr * s[:, k])
                child.append(ci); cfv_o = cfv_o + co
            st = np.stack(child, 1)
            cfv_i = st.max(1) if (mode == "br" and br_hero == 1) else (s * st).sum(1)
            return cfv_o, cfv_i
        # for a best response we must NOT pre-scale the hero's reach by its (avg)
        # strategy; the max picks per-hand, and the hero reach only weights the
        # final value. The recursion above scales by s for whoever acts, which is
        # correct for the opponent; for the hero under BR we still scale by avg s
        # but then take max of children — this double-counts. So BR uses a clean
        # variant: scale only the opponent, max for hero. Implemented in _br.
        return rec("", 0.0, 0.0, g.ow.copy(), g.iw.copy())

    def _br(self, hero):
        g = self.g; No, Ni = len(g.oop), len(g.ip)
        def rec(h, o, i, oor, ipr):
            if h in CLOSED_FOLD:
                return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
            if h in CLOSED_PROCEED:
                return g.showdown_cfv(o, i, oor, ipr)
            pl = actor(h); acts = legal(h)
            if pl == hero:
                child = []
                for a in acts:
                    no, ni, nh = g.step(a, pl, o, i, h)
                    child.append(rec(nh, no, ni, oor, ipr))   # don't scale hero reach
                co = np.stack([c[0] for c in child], 1)
                ci = np.stack([c[1] for c in child], 1)
                if hero == 0:
                    return co.max(1), ci.sum(1)               # hero=OOP: max OOP cfv; IP sees sum
                return co.sum(1), ci.max(1)
            s = self._avg_at(h)
            cfv_o = np.zeros(No); cfv_i = np.zeros(Ni)
            for k, a in enumerate(acts):
                no, ni, nh = g.step(a, pl, o, i, h)
                if pl == 0:
                    co, ci = rec(nh, no, ni, oor * s[:, k], ipr)
                else:
                    co, ci = rec(nh, no, ni, oor, ipr * s[:, k])
                cfv_o = cfv_o + co; cfv_i = cfv_i + ci
            return cfv_o, cfv_i
        cfv_o, cfv_i = rec("", 0.0, 0.0, g.ow.copy(), g.iw.copy())
        return float(g.ow @ cfv_o) if hero == 0 else float(g.iw @ cfv_i)

    def exploitability(self):
        return self._br(0) + self._br(1)

    def oop_strategy(self, hand):
        k = self.g.oidx.get(hand)
        a = self._avg_at("")[k] if k is not None else np.array([0.5, 0.5])
        return {"check": float(a[0]), "bet": float(a[1])}
    def ip_strategy(self, hand, facing):
        h = "b" if facing == "bet" else "x"
        k = self.g.iidx.get(hand)
        a = self._avg_at(h)[k] if k is not None else np.array([0.5, 0.5])
        lab = ("fold", "call") if facing == "bet" else ("check", "bet")
        return {lab[0]: float(a[0]), lab[1]: float(a[1])}
