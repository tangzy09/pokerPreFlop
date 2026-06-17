"""
preflop.py — heads-up SB-vs-BB preflop CFR with an injected postflop leaf.

Minimal v1 tree (no general raises yet; jam is the only raise):
    SB: fold / limp(complete to 1bb) / jam(all-in)
    BB facing a limp: check(-> see a flop, leaf_ev) / jam
    BB facing a jam : fold / call(all-in showdown)
    SB facing BB jam-over-limp: fold / call
leaf_ev(sb_hand, bb_hand, pot) -> EV to SB of seeing a flop (None disables limp,
collapsing the tree to push/fold). All-in showdowns use preflop all-in equity
(Monte-Carlo, computed once and cached so CFR and the best response agree).

EV: net chips to SB relative to start of hand (zero-sum). Blinds 0.5 / 1.0.
Reuses evaluate7 from postflop.py. Pure stdlib otherwise.
"""
import random
from postflop import evaluate7, hand_cards

SBP, BBP = 0.5, 1.0                      # blinds
TERMINAL = {"f", "lx", "jf", "jc", "ljf", "ljc"}
LABEL = {"f": "fold", "l": "limp", "j": "jam", "x": "check", "c": "call"}
def actor(hist):
    return len(hist) % 2                 # 0 = SB, 1 = BB

def _mc_equity(sbc, bbc, rng, n):
    dead = {sbc[0], sbc[1], bbc[0], bbc[1]}
    deck = [c for c in range(52) if c not in dead]
    m = len(deck)
    s7 = [sbc[0], sbc[1], 0, 0, 0, 0, 0]; b7 = [bbc[0], bbc[1], 0, 0, 0, 0, 0]
    win = tie = 0
    for _ in range(n):
        for k in range(5):
            j = k + int(rng.random() * (m - k))
            deck[k], deck[j] = deck[j], deck[k]
            s7[2 + k] = b7[2 + k] = deck[k]
        sv = evaluate7(s7); bv = evaluate7(b7)
        if sv > bv: win += 1
        elif sv == bv: tie += 1
    return (win + 0.5 * tie) / n

class PreflopGame:
    def __init__(self, sb, bb, stack, leaf_ev=None, eq_samples=20000, eq_seed=99):
        self.stack = float(stack)
        self.leaf_ev = leaf_ev
        def mk(rng):
            return [(h, float(w), hand_cards(h)) for h, w in rng]
        self.sb = mk(sb); self.bb = mk(bb)
        rng = random.Random(eq_seed)
        self.eq = {}          # (sb_str, bb_str) -> SB all-in equity
        self.deals = []; Z = 0.0
        for ss, sw, sc in self.sb:
            for bs, bw, bc in self.bb:
                if set(sc) & set(bc):
                    continue
                e = _mc_equity(sc, bc, rng, eq_samples)
                self.eq[(ss, bs)] = e
                w = sw * bw
                self.deals.append([ss, bs, sc, bc, w, e]); Z += w
        if Z <= 0:
            raise ValueError("no valid deals")
        for d in self.deals:
            d[4] /= Z

    def legal(self, hist):
        if hist == "":
            return ["f", "l", "j"] if self.leaf_ev is not None else ["f", "j"]
        if hist == "l":
            return ["x", "j"]
        return ["f", "c"]                # facing a jam ("j" or "lj")

    def apply(self, a, pl, o, i, hist):
        if a in ("f", "x"):
            return o, i, hist + a
        if a == "l":
            return BBP, i, hist + "l"     # SB completes to 1bb
        if a == "j":
            return (self.stack, i, hist + "j") if pl == 0 else (o, self.stack, hist + "j")
        return (self.stack, i, hist + "c") if pl == 0 else (o, self.stack, hist + "c")  # call all-in

    def util_sb(self, hist, o, i, sb_str, bb_str, eq):
        if hist == "lx":
            return self.leaf_ev(sb_str, bb_str, o + i)
        if hist[-1] == "f":
            folder = actor(hist[:-1])
            return -o if folder == 0 else i      # SB folds -> -o ; BB folds -> SB wins pot-o = i
        return (o + i) * eq - o                  # showdown

def RiverGame(*a, **k):
    raise RuntimeError("RiverGame lives in postflop.py")

class _Node:
    __slots__ = ("acts", "regret", "strat_sum")
    def __init__(self, acts):
        self.acts = acts
        self.regret = {a: 0.0 for a in acts}
        self.strat_sum = {a: 0.0 for a in acts}
    def strategy(self):
        pos = {a: (r if r > 0 else 0.0) for a, r in self.regret.items()}
        n = sum(pos.values())
        return {a: (pos[a] / n if n > 0 else 1.0 / len(self.acts)) for a in self.acts}
    def average(self):
        n = sum(self.strat_sum.values())
        return {a: (self.strat_sum[a] / n if n > 0 else 1.0 / len(self.acts)) for a in self.acts}

def solve(game, iters=8000, seed=0):
    g = game; nodes = {}
    def node(key, acts):
        nd = nodes.get(key)
        if nd is None:
            nd = nodes[key] = _Node(acts)
        return nd
    def cfr(d, hist, o, i, p_sb, p_bb):
        ss, bs, sc, bc, w, e = d
        if hist in TERMINAL:
            return g.util_sb(hist, o, i, ss, bs, e)
        pl = actor(hist); acts = g.legal(hist)
        hs = ss if pl == 0 else bs
        nd = node((hs, hist), acts); strat = nd.strategy()
        util = {}; nu = 0.0
        for a in acts:
            no, ni, nh = g.apply(a, pl, o, i, hist)
            if pl == 0:
                u = cfr(d, nh, no, ni, p_sb * strat[a], p_bb)
            else:
                u = cfr(d, nh, no, ni, p_sb, p_bb * strat[a])
            util[a] = u; nu += strat[a] * u
        s = 1 if pl == 0 else -1
        ro = p_bb if pl == 0 else p_sb
        rs = p_sb if pl == 0 else p_bb
        for a in acts:
            nd.regret[a] += d[4] * ro * (s * util[a] - s * nu)
            nd.strat_sum[a] += rs * strat[a]
        return nu
    for _ in range(iters):
        for d in g.deals:
            cfr(d, "", SBP, BBP, 1.0, 1.0)
    return Solution(g, nodes)

class Solution:
    def __init__(self, game, nodes):
        self.g = game
        self._avg = {k: nd.average() for k, nd in nodes.items()}
        self.game_value = self._tree_ev()
    def _avg_at(self, hand, hist):
        acts = self.g.legal(hist)
        return self._avg.get((hand, hist), {a: 1.0 / len(acts) for a in acts})
    def sb_strategy(self, hand):
        return {LABEL[a]: p for a, p in self._avg_at(hand, "").items()}
    def bb_strategy(self, hand, facing):
        hist = "j" if facing == "jam" else "l"
        return {LABEL[a]: p for a, p in self._avg_at(hand, hist).items()}
    # exact value under the average strategy
    def _ev(self, d, hist, o, i):
        ss, bs, sc, bc, w, e = d
        if hist in TERMINAL:
            return self.g.util_sb(hist, o, i, ss, bs, e)
        pl = actor(hist); hs = ss if pl == 0 else bs
        strat = self._avg_at(hs, hist)
        tot = 0.0
        for a, p in strat.items():
            no, ni, nh = self.g.apply(a, pl, o, i, hist)
            tot += p * self._ev(d, nh, no, ni)
        return tot
    def _tree_ev(self):
        return sum(d[4] * self._ev(d, "", SBP, BBP) for d in self.g.deals)
    # recursive best response -> exploitability
    def _br(self, hero):
        g = self.g
        hero_hands = g.sb if hero == 0 else g.bb
        opp_hands = g.bb if hero == 0 else g.sb
        def util_hero(hist, o, i, hhs, ostr):
            sbs, bbs = (hhs, ostr) if hero == 0 else (ostr, hhs)
            e = g.eq.get((sbs, bbs), 0.0)
            u_sb = g.util_sb(hist, o, i, sbs, bbs, e)
            return u_sb if hero == 0 else -u_sb
        def rec(hhs, hist, o, i, reach):
            if hist in TERMINAL:
                return sum(p * util_hero(hist, o, i, hhs, ostr) for ostr, p in reach.items())
            pl = actor(hist); acts = g.legal(hist)
            if pl == hero:
                best = None
                for a in acts:
                    no, ni, nh = g.apply(a, pl, o, i, hist)
                    v = rec(hhs, nh, no, ni, reach)
                    best = v if best is None or v > best else best
                return best
            tot = 0.0
            for a in acts:
                nr = {}
                for ostr, p in reach.items():
                    sig = self._avg_at(ostr, hist)
                    nr[ostr] = p * sig[a]
                no, ni, nh = g.apply(a, pl, o, i, hist)
                tot += rec(hhs, nh, no, ni, nr)
            return tot
        total = 0.0; W = 0.0
        for hhs, hw, hhc in hero_hands:
            reach = {}
            for ostr, ow, oc in opp_hands:
                if set(oc) & set(hhc):
                    continue
                reach[ostr] = ow
            Z = sum(reach.values())
            if Z <= 0:
                continue
            reach = {k: v / Z for k, v in reach.items()}
            total += hw * Z * rec(hhs, "", SBP, BBP, reach)
            W += hw * Z
        return total / W if W > 0 else 0.0
    def exploitability(self):
        return self._br(0) + self._br(1)
