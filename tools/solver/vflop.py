"""
vflop.py — VECTORIZED two-chance (flop->turn->river) CFR (needs numpy).

vturn.py had one chance node; this adds a second (flop deals turn, then river),
with a betting round on each of the three streets. Reuses the learnings from
vturn: river/turn infosets are keyed by the FULL betting line (so different pot
sizes don't conflate), and chance nodes average over cards with per-hand
card-removal. All-in runouts use PRECOMPUTED average-equity matrices (so they're
O(1), no fan-out); only the deep checked-betting path pays the ~48x47 board
fan-out, which is the practical wall (real solvers use card abstraction here).

Same EV convention as postflop.py (pot co-owned P/2 -> zero-sum).
"""
import numpy as np
from postflop import evaluate7, parse_card, hand_cards

CLOSED_PROCEED = {"xx", "bc", "xbc"}
CLOSED_FOLD = {"bf", "xbf"}
def actor(h):
    return 0 if len(h) % 2 == 0 else 1
def legal(h):
    return "fc" if h.endswith("b") else "xb"

class VFlop:
    def __init__(self, board, oop, ip, pot, stack, bet_sizes, bucket=False):
        flop = [parse_card(c) for c in board]
        assert len(flop) == 3, "VFlop expects a 3-card (flop) board"
        self.flop = flop
        self.pot = float(pot); self.stack = float(stack); self.frac = float(bet_sizes[0])
        bset = set(flop)
        def mk(rng):
            return [(h, float(w), hand_cards(h)) for h, w in rng if not (set(hand_cards(h)) & bset)]
        self.oop = mk(oop); self.ip = mk(ip)
        self.oidx = {h: k for k, (h, _, _) in enumerate(self.oop)}
        self.iidx = {h: k for k, (h, _, _) in enumerate(self.ip)}
        No, Ni = len(self.oop), len(self.ip)
        ocs = [c for _, _, c in self.oop]; ics = [c for _, _, c in self.ip]
        self.VALID = np.array([[0.0 if set(ocs[a]) & set(ics[b]) else 1.0 for b in range(Ni)] for a in range(No)])
        self.tcands = [c for c in range(52) if c not in bset]
        # per turn card: river candidates; per (ti,rj): 7-card scores; masks
        self.rc = []           # rc[ti] = list of river card ints
        self.OS = {}; self.IS = {}
        self.MT_O = np.ones((len(self.tcands), No)); self.MT_I = np.ones((len(self.tcands), Ni))
        self.MR_O = []; self.MR_I = []
        for ti, tc in enumerate(self.tcands):
            for a in range(No):
                if tc in ocs[a]: self.MT_O[ti, a] = 0.0
            for b in range(Ni):
                if tc in ics[b]: self.MT_I[ti, b] = 0.0
            rivers = [c for c in self.tcands if c != tc]
            self.rc.append(rivers)
            mro = np.ones((len(rivers), No)); mri = np.ones((len(rivers), Ni))
            for rj, rcd in enumerate(rivers):
                full = flop + [tc, rcd]
                self.OS[(ti, rj)] = np.array([evaluate7(list(ocs[a]) + full) for a in range(No)])
                self.IS[(ti, rj)] = np.array([evaluate7(list(ics[b]) + full) for b in range(Ni)])
                for a in range(No):
                    if rcd in ocs[a]: mro[rj, a] = 0.0
                for b in range(Ni):
                    if rcd in ics[b]: mri[rj, b] = 0.0
            self.MR_O.append(mro); self.MR_I.append(mri)
        # cset per chance node: list of (runout index, weight). full mode: every
        # card, weight 1. bucket mode: group runouts by RANK (c>>2) -> one
        # representative + count weight, shrinking each fan-out ~4x (and the nested
        # flop fan-out ~16x). Near-lossless on flush-proof spots (suit -> blockers only).
        nT = len(self.tcands)
        if bucket:
            def by_rank(cards):
                br = {}
                for idx, c in enumerate(cards): br.setdefault(c >> 2, []).append(idx)
                return [(grp[0], float(len(grp))) for grp in br.values()]
            self.tset = by_rank(self.tcands)
            self.rset = [by_rank(self.rc[ti]) for ti in range(nT)]
        else:
            self.tset = [(ti, 1.0) for ti in range(nT)]
            self.rset = [[(rj, 1.0) for rj in range(len(self.rc[ti]))] for ti in range(nT)]
        # weighted runout counts (denominators of the chance averages)
        self.cnt_T_o = sum(w * self.MT_O[ti] for ti, w in self.tset)
        self.cnt_T_i = sum(w * self.MT_I[ti] for ti, w in self.tset)
        self.cnt_R_o = [sum(w * self.MR_O[ti][rj] for rj, w in self.rset[ti]) for ti in range(nT)]
        self.cnt_R_i = [sum(w * self.MR_I[ti][rj] for rj, w in self.rset[ti]) for ti in range(nT)]
        for arr in [self.cnt_T_o, self.cnt_T_i] + self.cnt_R_o + self.cnt_R_i:
            arr[arr == 0] = 1
        self._precompute_runouts()
        self.ow = self._norm([w for _, w, _ in self.oop]); self.iw = self._norm([w for _, w, _ in self.ip])

    @staticmethod
    def _norm(ws):
        a = np.array(ws, float); s = a.sum(); return a / s if s > 0 else a

    def _share(self, ti, rj):
        oa = self.OS[(ti, rj)][:, None]; ib = self.IS[(ti, rj)][None, :]
        eq = (oa == ib); gt = (oa > ib)
        return gt * 1.0 + eq * 0.5, ((~gt & ~eq) * 1.0 + eq * 0.5)   # oop share, ip share

    def _precompute_runouts(self):
        No, Ni = len(self.oop), len(self.ip)
        # turn all-in (board flop+tc): average IP/OOP share over river rj, per ti
        self.AVG_O_turn = []; self.AVG_I_turn = []
        SO_flop = np.zeros((No, Ni)); SI_flop = np.zeros((No, Ni)); CN_flop = np.zeros((No, Ni))
        for ti in range(len(self.tcands)):
            so = np.zeros((No, Ni)); si = np.zeros((No, Ni)); cn = np.zeros((No, Ni))
            for rj in range(len(self.rc[ti])):
                sho, shi = self._share(ti, rj)
                vm = (self.MR_O[ti][rj][:, None]) * (self.MR_I[ti][rj][None, :])
                so += sho * vm; si += shi * vm; cn += vm
            cnf = np.where(cn > 0, cn, 1)
            self.AVG_O_turn.append(np.where(cn > 0, so / cnf, 0) * self.VALID)
            self.AVG_I_turn.append(np.where(cn > 0, si / cnf, 0) * self.VALID)
            # accumulate into flop-runout, weighted by whether tc is live for the pair
            tm = (self.MT_O[ti][:, None]) * (self.MT_I[ti][None, :])
            SO_flop += so * tm; SI_flop += si * tm; CN_flop += cn * tm
        cnf = np.where(CN_flop > 0, CN_flop, 1)
        self.AVG_O_flop = np.where(CN_flop > 0, SO_flop / cnf, 0) * self.VALID
        self.AVG_I_flop = np.where(CN_flop > 0, SI_flop / cnf, 0) * self.VALID

    def _cfv(self, share_o, share_i, o, i, oor, ipr):
        P = self.pot
        ev_o = (P + o + i) * (share_o @ ipr) - (o + P / 2) * (self.VALID @ ipr)
        ev_i = (P + o + i) * (share_i.T @ oor) - (i + P / 2) * (self.VALID.T @ oor)
        return ev_o, ev_i

    def showdown_cfv(self, ti, rj, o, i, oor, ipr):
        sho, shi = self._share(ti, rj)
        return self._cfv(sho * self.VALID, shi * self.VALID, o, i, oor, ipr)

    def flop_runout(self, o, i, oor, ipr):
        return self._cfv(self.AVG_O_flop, self.AVG_I_flop, o, i, oor, ipr)
    def turn_runout(self, ti, o, i, oor, ipr):
        return self._cfv(self.AVG_O_turn[ti], self.AVG_I_turn[ti], o, i, oor, ipr)

    def fold_cfv(self, folder, o, i, oor, ipr):
        P = self.pot
        u = (i + P / 2) if folder == 1 else (-o - P / 2)
        return u * (self.VALID @ ipr), (-u) * (self.VALID.T @ oor)

    def step(self, a, pl, o, i, h):
        if a in ("x", "f"):
            return o, i, h + a
        if a == "b":
            cur = self.pot + o + i; rem = self.stack - (o if pl == 0 else i)
            amt = min(self.frac * cur, rem)
            return (o + amt, i, h + "b") if pl == 0 else (o, i + amt, h + "b")
        d = abs(o - i)
        return (o + d, i, h + "c") if pl == 0 else (o, i + d, h + "c")

    def chance(self, oor, ipr, MO, MI, cnt_o, cnt_i, cset, subfn):
        No, Ni = len(self.oop), len(self.ip)
        acc_o = np.zeros(No); acc_i = np.zeros(Ni)
        for idx, w in cset:
            mo, mi = MO[idx], MI[idx]
            co, ci = subfn(idx, oor * mo, ipr * mi)
            acc_o += w * co * mo; acc_i += w * ci * mi
        return acc_o / cnt_o, acc_i / cnt_i

def _decider(g, strat_fn, node_fn, plus, aw, up):
    """returns decide(key,h,o,i,oor,ipr,child) -> (cfv_o,cfv_i) with regret update.
    CFR+ (plus): floor regret at 0, weight strategy by aw[0], update only player up[0]."""
    No, Ni = len(g.oop), len(g.ip)
    def decide(key, h, o, i, oor, ipr, child):
        pl = actor(h); acts = legal(h); pn = No if pl == 0 else Ni
        s = strat_fn(key, pn); r, ss = node_fn(key, pn)
        if pl == 0:
            cfv_i = np.zeros(Ni); kids = []
            for k, a in enumerate(acts):
                no, ni, nh = g.step(a, 0, o, i, h)
                co, ci = child(no, ni, nh, oor * s[:, k], ipr)
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
            co, ci = child(no, ni, nh, oor, ipr * s[:, k])
            kids.append(ci); cfv_o = cfv_o + co
        st = np.stack(kids, 1); cfv_i = (s * st).sum(1)
        if up[0] is None or up[0] == 1:
            r += st - cfv_i[:, None]
            if plus: np.maximum(r, 0.0, out=r)
            ss += aw[0] * ipr[:, None] * s
        return cfv_o, cfv_i
    return decide

def solve(game, iters=300, seed=0, plus=True):
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
    decide = _decider(g, strat, node, plus, aw, up)

    def river(fh, ti, rj, h, o, i, oor, ipr):
        if h in CLOSED_FOLD:
            return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
        if h in CLOSED_PROCEED:
            return g.showdown_cfv(ti, rj, o, i, oor, ipr)
        return decide(f"R|{fh}|{ti}|{rj}|{h}", h, o, i, oor, ipr,
                      lambda no, ni, nh, oo, ii: river(fh, ti, rj, nh, no, ni, oo, ii))
    def turn(fh, ti, h, o, i, oor, ipr):
        if h in CLOSED_FOLD:
            return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
        if h in CLOSED_PROCEED:
            if o >= g.stack - 1e-9 or i >= g.stack - 1e-9:
                return g.turn_runout(ti, o, i, oor, ipr)
            return g.chance(oor, ipr, g.MR_O[ti], g.MR_I[ti], g.cnt_R_o[ti], g.cnt_R_i[ti], g.rset[ti],
                            lambda rj, oo, ii: river(fh, ti, rj, "", o, i, oo, ii))
        return decide(f"T|{fh}|{ti}|{h}", h, o, i, oor, ipr,
                      lambda no, ni, nh, oo, ii: turn(fh, ti, nh, no, ni, oo, ii))
    def flop(h, o, i, oor, ipr):
        if h in CLOSED_FOLD:
            return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
        if h in CLOSED_PROCEED:
            if o >= g.stack - 1e-9 or i >= g.stack - 1e-9:
                return g.flop_runout(o, i, oor, ipr)
            return g.chance(oor, ipr, g.MT_O, g.MT_I, g.cnt_T_o, g.cnt_T_i, g.tset,
                            lambda ti, oo, ii: turn(h, ti, "", o, i, oo, ii))
        return decide(f"F|{h}", h, o, i, oor, ipr,
                      lambda no, ni, nh, oo, ii: flop(nh, no, ni, oo, ii))
    for t in range(iters):
        aw[0] = float(t + 1) if plus else 1.0
        up[0] = (t % 2) if plus else None
        flop("", 0.0, 0.0, g.ow.copy(), g.iw.copy())
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

    def _eval(self, hero):
        g = self.g; No, Ni = len(g.oop), len(g.ip)
        def combine(key, h, o, i, oor, ipr, child):
            pl = actor(h); acts = legal(h); pn = No if pl == 0 else Ni
            s = self._avg_at(key, pn)
            if pl == 0:
                cfv_i = np.zeros(Ni); kids = []
                for k, a in enumerate(acts):
                    no, ni, nh = g.step(a, 0, o, i, h)
                    co, ci = child(no, ni, nh, oor if hero == 0 else oor * s[:, k], ipr)
                    kids.append(co); cfv_i = cfv_i + ci
                st = np.stack(kids, 1)
                return (st.max(1) if hero == 0 else (s * st).sum(1)), cfv_i
            cfv_o = np.zeros(No); kids = []
            for k, a in enumerate(acts):
                no, ni, nh = g.step(a, 1, o, i, h)
                co, ci = child(no, ni, nh, oor, ipr if hero == 1 else ipr * s[:, k])
                kids.append(ci); cfv_o = cfv_o + co
            st = np.stack(kids, 1)
            return cfv_o, (st.max(1) if hero == 1 else (s * st).sum(1))
        def river(fh, ti, rj, h, o, i, oor, ipr):
            if h in CLOSED_FOLD:
                return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
            if h in CLOSED_PROCEED:
                return g.showdown_cfv(ti, rj, o, i, oor, ipr)
            return combine(f"R|{fh}|{ti}|{rj}|{h}", h, o, i, oor, ipr,
                           lambda no, ni, nh, oo, ii: river(fh, ti, rj, nh, no, ni, oo, ii))
        def turn(fh, ti, h, o, i, oor, ipr):
            if h in CLOSED_FOLD:
                return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
            if h in CLOSED_PROCEED:
                if o >= g.stack - 1e-9 or i >= g.stack - 1e-9:
                    return g.turn_runout(ti, o, i, oor, ipr)
                return g.chance(oor, ipr, g.MR_O[ti], g.MR_I[ti], g.cnt_R_o[ti], g.cnt_R_i[ti], g.rset[ti],
                                lambda rj, oo, ii: river(fh, ti, rj, "", o, i, oo, ii))
            return combine(f"T|{fh}|{ti}|{h}", h, o, i, oor, ipr,
                           lambda no, ni, nh, oo, ii: turn(fh, ti, nh, no, ni, oo, ii))
        def flop(h, o, i, oor, ipr):
            if h in CLOSED_FOLD:
                return g.fold_cfv(actor(h[:-1]), o, i, oor, ipr)
            if h in CLOSED_PROCEED:
                if o >= g.stack - 1e-9 or i >= g.stack - 1e-9:
                    return g.flop_runout(o, i, oor, ipr)
                return g.chance(oor, ipr, g.MT_O, g.MT_I, g.cnt_T_o, g.cnt_T_i, g.tset,
                                lambda ti, oo, ii: turn(h, ti, "", o, i, oo, ii))
            return combine(f"F|{h}", h, o, i, oor, ipr,
                           lambda no, ni, nh, oo, ii: flop(nh, no, ni, oo, ii))
        return flop("", 0.0, 0.0, g.ow.copy(), g.iw.copy())

    def _br(self, hero):
        co, ci = self._eval(hero)
        return float(self.g.ow @ co) if hero == 0 else float(self.g.iw @ ci)
    def exploitability(self):
        return self._br(0) + self._br(1)

    def oop_strategy(self, hand):
        k = self.g.oidx.get(hand)
        a = self._avg_at("F|", len(self.g.oop))[k] if k is not None else np.array([0.5, 0.5])
        return {"check": float(a[0]), "bet": float(a[1])}
    def ip_strategy(self, hand, facing):
        key = "F|b" if facing == "bet" else "F|x"
        k = self.g.iidx.get(hand)
        a = self._avg_at(key, len(self.g.ip))[k] if k is not None else np.array([0.5, 0.5])
        lab = ("fold", "call") if facing == "bet" else ("check", "bet")
        return {lab[0]: float(a[0]), lab[1]: float(a[1])}
