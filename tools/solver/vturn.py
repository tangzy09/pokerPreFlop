"""
vturn.py — VECTORIZED turn+river CFR (full-range capable, needs numpy).

Extends the vectorized river (vriver.py) with a CHANCE node: a 4-card turn
board, a river card is dealt, then a river betting round. Per-hand reach vectors
flow through both streets; the chance node averages the river subtrees over all
river cards with per-hand card-removal (a hand can't hold a card that's on the
board). Showdown counterfactual values are matrix-vector products with per-river
SHARE matrices built from precomputed 7-card scores. Same EV convention as
postflop.py (pot co-owned P/2 -> zero-sum). Verified against the scalar
multi-street solver in test_vturn.py.
"""
import numpy as np
from postflop import evaluate7, parse_card, hand_cards

CLOSED_PROCEED = {"xx", "bc", "xbc"}
CLOSED_FOLD = {"bf", "xbf"}
def actor(h):
    return 0 if len(h) % 2 == 0 else 1
def legal(h):
    return "fc" if h.endswith("b") else "xb"

class VTurn:
    def __init__(self, board, oop, ip, pot, stack, bet_sizes, bucket=False):
        bd = [parse_card(c) for c in board]
        assert len(bd) == 4, "VTurn expects a 4-card (turn) board"
        self.board = bd
        self.pot = float(pot); self.stack = float(stack); self.frac = float(bet_sizes[0])
        bset = set(bd)
        def mk(rng):
            return [(h, float(w), hand_cards(h)) for h, w in rng if not (set(hand_cards(h)) & bset)]
        self.oop = mk(oop); self.ip = mk(ip)
        self.oidx = {h: k for k, (h, _, _) in enumerate(self.oop)}
        self.iidx = {h: k for k, (h, _, _) in enumerate(self.ip)}
        No, Ni = len(self.oop), len(self.ip)
        ocs = [set(c) for _, _, c in self.oop]; ics = [set(c) for _, _, c in self.ip]
        # hand-vs-hand conflict (board-independent)
        self.VALID = np.array([[0.0 if ocs[a] & ics[b] else 1.0 for b in range(Ni)] for a in range(No)])
        # river candidates + per-card scores + card-removal masks
        self.cands = [c for c in range(52) if c not in bset]
        Nc = len(self.cands)
        self.OS = np.zeros((Nc, No)); self.IS = np.zeros((Nc, Ni))
        self.NOTO = np.ones((Nc, No)); self.NOTI = np.ones((Nc, Ni))
        for ci, c in enumerate(self.cands):
            full = bd + [c]
            for a, (_, _, cards) in enumerate(self.oop):
                if c in cards: self.NOTO[ci, a] = 0.0
                self.OS[ci, a] = evaluate7(list(cards) + full)
            for b, (_, _, cards) in enumerate(self.ip):
                if c in cards: self.NOTI[ci, b] = 0.0
                self.IS[ci, b] = evaluate7(list(cards) + full)
        # cset = list of (river-card index, weight). full mode: every card, weight 1.
        # bucket mode: group cands by RANK (c>>2) -> one representative + count weight.
        # On a flush-proof board the suit of the 5th card only matters through
        # blockers, so rank-bucketing is near-lossless and shrinks the fan-out ~4x.
        if bucket:
            by_rank = {}
            for ci, c in enumerate(self.cands):
                by_rank.setdefault(c >> 2, []).append(ci)
            self.cset = [(g[0], float(len(g))) for g in by_rank.values()]
        else:
            self.cset = [(ci, 1.0) for ci in range(Nc)]
        # weighted runout counts per hand (denominator of the chance average)
        self.cnt_o = sum(w * self.NOTO[ci] for ci, w in self.cset)
        self.cnt_i = sum(w * self.NOTI[ci] for ci, w in self.cset)
        self.cnt_o[self.cnt_o == 0] = 1; self.cnt_i[self.cnt_i == 0] = 1
        self.ow = self._norm([w for _, w, _ in self.oop])
        self.iw = self._norm([w for _, w, _ in self.ip])

    @staticmethod
    def _norm(ws):
        a = np.array(ws, float); s = a.sum(); return a / s if s > 0 else a

    def step(self, a, pl, o, i, h):
        if a in ("x", "f"):
            return o, i, h + a
        if a == "b":
            cur = self.pot + o + i; rem = self.stack - (o if pl == 0 else i)
            amt = min(self.frac * cur, rem)
            return (o + amt, i, h + "b") if pl == 0 else (o, i + amt, h + "b")
        d = abs(o - i)
        return (o + d, i, h + "c") if pl == 0 else (o, i + d, h + "c")

    def showdown_cfv(self, ci, o, i, oor, ipr):
        oa = self.OS[ci][:, None]; ib = self.IS[ci][None, :]
        eq = (oa == ib); gt = (oa > ib)
        P = self.pot
        share_o = (gt * 1.0 + eq * 0.5) * self.VALID
        ev_o = (P + o + i) * (share_o @ ipr) - (o + P / 2) * (self.VALID @ ipr)
        share_i = ((~gt & ~eq) * 1.0 + eq * 0.5) * self.VALID
        ev_i = (P + o + i) * (share_i.T @ oor) - (i + P / 2) * (self.VALID.T @ oor)
        return ev_o, ev_i

    def fold_cfv(self, folder, o, i, oor, ipr):
        P = self.pot
        u = (i + P / 2) if folder == 1 else (-o - P / 2)
        return u * (self.VALID @ ipr), (-u) * (self.VALID.T @ oor)

    # average over river runouts (with per-hand card removal). subfn(ci, oor_c, ipr_c)
    # returns (cfv_o, cfv_i) for the river subtree on card ci.
    def chance(self, oor, ipr, subfn):
        No, Ni = len(self.oop), len(self.ip)
        acc_o = np.zeros(No); acc_i = np.zeros(Ni)
        for ci, w in self.cset:
            mo, mi = self.NOTO[ci], self.NOTI[ci]
            co, ci_ = subfn(ci, oor * mo, ipr * mi)
            acc_o += w * co * mo; acc_i += w * ci_ * mi
        return acc_o / self.cnt_o, acc_i / self.cnt_i

def solve(game, iters=4000, seed=0, plus=True):
    # plus=True -> CFR+ (regret-matching+, linear averaging, alternating updates):
    # ~O(1/t) convergence vs vanilla ~O(1/sqrt(t)). plus=False = vanilla CFR.
    g = game; No, Ni = len(g.oop), len(g.ip)
    regret, strat_sum = {}, {}
    aw = [1.0]; up = [None]                           # iteration averaging weight; player to update
    def node(key, pn):
        if key not in regret:
            regret[key] = np.zeros((pn, 2)); strat_sum[key] = np.zeros((pn, 2))
        return regret[key], strat_sum[key]
    def strat(key, pn):
        r, _ = node(key, pn); pos = np.maximum(r, 0.0); s = pos.sum(1, keepdims=True)
        return np.where(s > 0, pos / np.where(s > 0, s, 1), 0.5)

    def decide(key, h, o, i, oor, ipr, child):
        # child(action, no, ni, nh, oor', ipr') -> (cfv_o, cfv_i)
        pl = actor(h); acts = legal(h); pn = No if pl == 0 else Ni
        s = strat(key, pn); r, ss = node(key, pn)
        if pl == 0:
            cfv_i = np.zeros(Ni); kids = []
            for k, a in enumerate(acts):
                no, ni, nh = g.step(a, 0, o, i, h)
                co, ci = child(a, no, ni, nh, oor * s[:, k], ipr)
                kids.append(co); cfv_i = cfv_i + ci
            st = np.stack(kids, 1); cfv_o = (s * st).sum(1)
            if up[0] is None or up[0] == 0:
                r += st - cfv_o[:, None]
                if plus: np.maximum(r, 0.0, out=r)
                ss += aw[0] * oor[:, None] * s
            return cfv_o, cfv_i
        cfv_o = np.zeros(No); kids = []
        for k, a in enumerate(acts):
            no, ni, nh = g.step(a, 1, o, i, h)
            co, ci = child(a, no, ni, nh, oor, ipr * s[:, k])
            kids.append(ci); cfv_o = cfv_o + co
        st = np.stack(kids, 1); cfv_i = (s * st).sum(1)
        if up[0] is None or up[0] == 1:
            r += st - cfv_i[:, None]
            if plus: np.maximum(r, 0.0, out=r)
            ss += aw[0] * ipr[:, None] * s
        return cfv_o, cfv_i

    def river_cfr(th, ci, h, o, i, oor, ipr):
        if h in CLOSED_FOLD:
            return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
        if h in CLOSED_PROCEED:
            return g.showdown_cfv(ci, o, i, oor, ipr)
        # key includes the turn line `th` so different pot sizes don't conflate
        return decide(f"R|{th}|{ci}|{h}", h, o, i, oor, ipr,
                      lambda a, no, ni, nh, oo, ii: river_cfr(th, ci, nh, no, ni, oo, ii))

    def turn_cfr(h, o, i, oor, ipr):
        if h in CLOSED_FOLD:
            return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
        if h in CLOSED_PROCEED:
            allin = o >= g.stack - 1e-9 or i >= g.stack - 1e-9
            if allin:
                return g.chance(oor, ipr, lambda ci, oo, ii: g.showdown_cfv(ci, o, i, oo, ii))
            return g.chance(oor, ipr, lambda ci, oo, ii: river_cfr(h, ci, "", o, i, oo, ii))
        return decide(f"T|{h}", h, o, i, oor, ipr,
                      lambda a, no, ni, nh, oo, ii: turn_cfr(nh, no, ni, oo, ii))

    for t in range(iters):
        aw[0] = float(t + 1) if plus else 1.0
        up[0] = (t % 2) if plus else None
        turn_cfr("", 0.0, 0.0, g.ow.copy(), g.iw.copy())
    return Solution(g, strat_sum)

class Solution:
    def __init__(self, game, strat_sum):
        self.g = game; self.oop = game.oop; self.ip = game.ip
        self._avg = {}
        for k, ss in strat_sum.items():
            s = ss.sum(1, keepdims=True)
            self._avg[k] = np.where(s > 0, ss / np.where(s > 0, s, 1), 0.5)
        self.game_value = float(game.ow @ self._eval(None)[0])

    def _avg_at(self, key, pn):
        return self._avg.get(key, np.full((pn, 2), 0.5))

    def _eval(self, hero):                       # hero None -> avg EV; 0/1 -> best response for hero
        g = self.g; No, Ni = len(g.oop), len(g.ip)
        def combine(key, h, o, i, oor, ipr, child):
            pl = actor(h); acts = legal(h); pn = No if pl == 0 else Ni
            s = self._avg_at(key, pn)
            if pl == 0:
                cfv_i = np.zeros(Ni); kids = []
                for k, a in enumerate(acts):
                    no, ni, nh = g.step(a, 0, o, i, h)
                    scale = oor if hero == 0 else oor * s[:, k]   # BR: don't pre-scale hero
                    co, ci = child(a, no, ni, nh, scale, ipr)
                    kids.append(co); cfv_i = cfv_i + ci
                st = np.stack(kids, 1)
                cfv_o = st.max(1) if hero == 0 else (s * st).sum(1)
                return cfv_o, cfv_i
            cfv_o = np.zeros(No); kids = []
            for k, a in enumerate(acts):
                no, ni, nh = g.step(a, 1, o, i, h)
                scale = ipr if hero == 1 else ipr * s[:, k]
                co, ci = child(a, no, ni, nh, oor, scale)
                kids.append(ci); cfv_o = cfv_o + co
            st = np.stack(kids, 1)
            cfv_i = st.max(1) if hero == 1 else (s * st).sum(1)
            return cfv_o, cfv_i
        def river(th, ci, h, o, i, oor, ipr):
            if h in CLOSED_FOLD:
                return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
            if h in CLOSED_PROCEED:
                return g.showdown_cfv(ci, o, i, oor, ipr)
            return combine(f"R|{th}|{ci}|{h}", h, o, i, oor, ipr,
                           lambda a, no, ni, nh, oo, ii: river(th, ci, nh, no, ni, oo, ii))
        def turn(h, o, i, oor, ipr):
            if h in CLOSED_FOLD:
                return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
            if h in CLOSED_PROCEED:
                allin = o >= g.stack - 1e-9 or i >= g.stack - 1e-9
                if allin:
                    return g.chance(oor, ipr, lambda ci, oo, ii: g.showdown_cfv(ci, o, i, oo, ii))
                return g.chance(oor, ipr, lambda ci, oo, ii: river(h, ci, "", o, i, oo, ii))
            return combine(f"T|{h}", h, o, i, oor, ipr,
                           lambda a, no, ni, nh, oo, ii: turn(nh, no, ni, oo, ii))
        return turn("", 0.0, 0.0, g.ow.copy(), g.iw.copy())

    def _br(self, hero):
        co, ci = self._eval(hero)
        return float(self.g.ow @ co) if hero == 0 else float(self.g.iw @ ci)
    def exploitability(self):
        return self._br(0) + self._br(1)

    def oop_strategy(self, hand):
        k = self.g.oidx.get(hand)
        a = self._avg_at("T|", len(self.g.oop))[k] if k is not None else np.array([0.5, 0.5])
        return {"check": float(a[0]), "bet": float(a[1])}
    def ip_strategy(self, hand, facing):
        key = "T|b" if facing == "bet" else "T|x"
        k = self.g.iidx.get(hand)
        a = self._avg_at(key, len(self.g.ip))[k] if k is not None else np.array([0.5, 0.5])
        lab = ("fold", "call") if facing == "bet" else ("check", "bet")
        return {lab[0]: float(a[0]), lab[1]: float(a[1])}
