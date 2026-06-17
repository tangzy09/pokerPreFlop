"""
postflop.py — heads-up multi-street CFR solver (flop/turn/river).

A betting round per street; between streets a CHANCE node deals the next board
card. River (5-card board) has no chance node and reduces to the verified
single-street solver. Showdowns use a ported evaluate7; all-in lines run the
board out (expected equity). Exploitability uses a recursive best response
(scales past per-river infosets, unlike pure-strategy enumeration).

Scope v1: one bet size, no raises (facing a bet -> fold/call). EV convention:
the dead pot P is co-owned 50/50 at the start, so utilities are zero-sum;
game_value 0 = breakeven for OOP. Pure stdlib.
"""
import itertools

# ---------- cards (int 0..51 = rank*4+suit) + 7-card evaluator ----------
RV = {c: i for i, c in enumerate("23456789TJQKA")}
SU = {c: i for i, c in enumerate("shdc")}
def parse_card(s):
    return RV[s[0]] * 4 + SU[s[1].lower()]
def hand_cards(h):
    return (parse_card(h[0:2]), parse_card(h[2:4]))

def _straight_high(mask):
    for top in range(12, 3, -1):
        if all(mask & (1 << (top - k)) for k in range(5)):
            return top
    if (mask & (1 << 12)) and (mask & 0b1111) == 0b1111:
        return 3
    return -1
def _ranks(mask):
    return [r for r in range(12, -1, -1) if mask & (1 << r)]
def _score(cat, tb):
    v = cat
    for k in range(5):
        v = v * 16 + (tb[k] if k < len(tb) else 0)
    return v
def evaluate7(cards):
    rc = [0] * 13; sc = [0] * 4; srm = [0, 0, 0, 0]; rm = 0
    for c in cards:
        r = c >> 2; s = c & 3
        rc[r] += 1; sc[s] += 1; srm[s] |= 1 << r; rm |= 1 << r
    flush = next((s for s in range(4) if sc[s] >= 5), -1)
    if flush >= 0:
        sf = _straight_high(srm[flush])
        if sf >= 0:
            return _score(8, [sf])
    quad = -1; trips = []; pairs = []
    for r in range(12, -1, -1):
        if rc[r] == 4: quad = r
        elif rc[r] == 3: trips.append(r)
        elif rc[r] == 2: pairs.append(r)
    if quad >= 0:
        k = next((r for r in range(12, -1, -1) if r != quad and rc[r] > 0), -1)
        return _score(7, [quad, k])
    if trips and (pairs or len(trips) >= 2):
        t = trips[0]; p = pairs[0] if pairs else -1
        if len(trips) >= 2: p = max(p, trips[1])
        return _score(6, [t, p])
    if flush >= 0:
        return _score(5, _ranks(srm[flush])[:5])
    st = _straight_high(rm)
    if st >= 0:
        return _score(4, [st])
    if trips:
        t = trips[0]; ks = [r for r in range(12, -1, -1) if r != t and rc[r] > 0][:2]
        return _score(3, [t] + ks)
    if len(pairs) >= 2:
        p1, p2 = pairs[0], pairs[1]
        k = next((r for r in range(12, -1, -1) if r != p1 and r != p2 and rc[r] > 0), -1)
        return _score(2, [p1, p2, k])
    if len(pairs) == 1:
        p = pairs[0]; ks = [r for r in range(12, -1, -1) if r != p and rc[r] > 0][:3]
        return _score(1, [p] + ks)
    return _score(0, _ranks(rm)[:5])

# ---------- betting tree (one bet size, no raises) ----------
CLOSED_PROCEED = {"xx", "bc", "xbc"}   # street closes, hand continues
CLOSED_FOLD = {"bf", "xbf"}            # someone folded
LABEL = {"x": "check", "b": "bet", "f": "fold", "c": "call"}
def actor(hist):
    return len(hist) % 2               # 0 = OOP, 1 = IP
def legal(hist):
    return "fc" if hist.endswith("b") else "xb"

class PostflopGame:
    def __init__(self, board, oop, ip, pot, stack, bet_sizes):
        self.board = tuple(parse_card(c) for c in board)
        self.pot = float(pot); self.stack = float(stack); self.frac = float(bet_sizes[0])
        def mk(rng):
            return [(h, float(w), hand_cards(h)) for h, w in rng]
        self.oop = mk(oop); self.ip = mk(ip)
        self.deals = []; Z = 0.0
        for ohs, ow, ohc in self.oop:
            for ihs, iw, ihc in self.ip:
                if set(ohc) & set(ihc) or (set(ohc) | set(ihc)) & set(self.board):
                    continue
                w = ow * iw
                self.deals.append([ohs, ihs, ohc, ihc, w]); Z += w
        if Z <= 0:
            raise ValueError("no valid deals")
        for d in self.deals:
            d[4] /= Z
        self._eq = {}

    # apply an action; returns (o, i, new_hist).  board is unchanged.
    def apply(self, a, pl, o, i, hist):
        if a == "x" or a == "f":
            return o, i, hist + a
        if a == "b":
            cur = self.pot + o + i
            rem = self.stack - (o if pl == 0 else i)
            amt = min(self.frac * cur, rem)
            return (o + amt, i, hist + "b") if pl == 0 else (o, i + amt, hist + "b")
        diff = abs(o - i)               # call
        return (o + diff, i, hist + "c") if pl == 0 else (o, i + diff, hist + "c")

    def equity_oop(self, ohc, ihc, board):
        key = (ohc, ihc, board)
        e = self._eq.get(key)
        if e is not None:
            return e
        bl = list(board)
        if len(board) == 5:
            so = evaluate7(list(ohc) + bl); si = evaluate7(list(ihc) + bl)
            e = 1.0 if so > si else (0.5 if so == si else 0.0)
        else:
            dead = set(board) | set(ohc) | set(ihc)
            rem = [c for c in range(52) if c not in dead]
            win = tie = tot = 0
            for combo in itertools.combinations(rem, 5 - len(board)):
                b2 = bl + list(combo)
                so = evaluate7(list(ohc) + b2); si = evaluate7(list(ihc) + b2)
                if so > si: win += 1
                elif so == si: tie += 1
                tot += 1
            e = (win + 0.5 * tie) / tot
        self._eq[key] = e
        return e

    def util_fold(self, folder, o, i):
        share = (self.pot + o + i) if folder == 1 else 0.0   # non-folder wins
        return share - o - self.pot / 2
    def util_show(self, equity, o, i):
        return (self.pot + o + i) * equity - o - self.pot / 2

def RiverGame(board, oop, ip, pot, stack, bet_sizes):       # alias: 5-card == river
    return PostflopGame(board, oop, ip, pot, stack, bet_sizes)

# ---------- CFR ----------
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

def solve(game, iters=6000, seed=0, plus=True):
    # plus=True -> CFR+: regret-matching+ (floor cumulative regret at 0 each
    # iteration) + linear averaging (weight iteration t's strategy by t).
    # ~O(1/t) vs vanilla ~O(1/sqrt(t)); same Nash. plus=False = vanilla.
    # NOTE: SIMULTANEOUS updates (no alternating). This per-deal traversal visits each
    # infoset once PER DEAL per iteration; combining that with alternating + RM+
    # plateaus multi-street exploitability, whereas simultaneous CFR+ is stable and
    # already gives the large multi-street speedup (~40-70x). (The vectorized solvers
    # visit each infoset once per iteration, so they DO use alternating.)
    g = game; nodes = {}
    aw = [1.0]                                       # iteration averaging weight (linear)
    def node(key, acts):
        nd = nodes.get(key)
        if nd is None:
            nd = nodes[key] = _Node(acts)
        return nd
    def cfr(d, board, hist, o, i, p0, p1, pc):
        ohs, ihs, ohc, ihc, w = d
        if hist in CLOSED_FOLD:
            return g.util_fold(actor(hist[:-1]), o, i)
        if hist in CLOSED_PROCEED:
            allin = o >= g.stack - 1e-9 or i >= g.stack - 1e-9
            if len(board) == 5 or allin:
                return g.util_show(g.equity_oop(ohc, ihc, board), o, i)
            rem = [c for c in range(52) if c not in board and c not in ohc and c not in ihc]
            tot = 0.0
            for c in rem:
                tot += cfr(d, board + (c,), "", o, i, p0, p1, pc / len(rem))
            return tot / len(rem)
        pl = actor(hist); acts = legal(hist)
        hs = ohs if pl == 0 else ihs
        key = (hs, board, hist, round(o, 4), round(i, 4))
        nd = node(key, acts); strat = nd.strategy()
        util = {}; nu = 0.0
        for a in acts:
            no, ni, nh = g.apply(a, pl, o, i, hist)
            if pl == 0:
                u = cfr(d, board, nh, no, ni, p0 * strat[a], p1, pc)
            else:
                u = cfr(d, board, nh, no, ni, p0, p1 * strat[a], pc)
            util[a] = u; nu += strat[a] * u
        s = 1 if pl == 0 else -1
        ro = p1 if pl == 0 else p0; rs = p0 if pl == 0 else p1
        for a in acts:
            nd.regret[a] += pc * ro * (s * util[a] - s * nu)
            nd.strat_sum[a] += aw[0] * rs * strat[a]
        return nu
    for t in range(iters):
        aw[0] = float(t + 1) if plus else 1.0
        for d in g.deals:
            cfr(d, g.board, "", 0.0, 0.0, 1.0, 1.0, d[4])
        if plus:                                     # regret-matching+: floor cumulative regret at 0
            for nd in nodes.values():
                for a in nd.acts:
                    if nd.regret[a] < 0.0:
                        nd.regret[a] = 0.0
    return Solution(g, nodes)

class Solution:
    def __init__(self, game, nodes):
        self.g = game
        self._avg = {k: nd.average() for k, nd in nodes.items()}
        self.game_value = self._tree_ev()

    def _avg_at(self, key, acts):
        nd = self._avg.get(key)
        return nd if nd is not None else {a: 1.0 / len(acts) for a in acts}

    # ---- strategy lookups (root) ----
    def oop_strategy(self, hand):
        key = (hand, self.g.board, "", 0.0, 0.0)
        return {LABEL[a]: p for a, p in self._avg_at(key, "xb").items()}
    def ip_strategy(self, hand, facing):
        if facing == "bet":
            amt = round(min(self.g.frac * self.g.pot, self.g.stack), 4)
            key = (hand, self.g.board, "b", amt, 0.0)
        else:
            key = (hand, self.g.board, "x", 0.0, 0.0)
        return {LABEL[a]: p for a, p in self._avg_at(key, legal("b" if facing == "bet" else "x")).items()}

    # ---- exact game value under the average strategy ----
    def _ev(self, d, board, hist, o, i):
        ohs, ihs, ohc, ihc, w = d
        if hist in CLOSED_FOLD:
            return self.g.util_fold(actor(hist[:-1]), o, i)
        if hist in CLOSED_PROCEED:
            allin = o >= self.g.stack - 1e-9 or i >= self.g.stack - 1e-9
            if len(board) == 5 or allin:
                return self.g.util_show(self.g.equity_oop(ohc, ihc, board), o, i)
            rem = [c for c in range(52) if c not in board and c not in ohc and c not in ihc]
            return sum(self._ev(d, board + (c,), "", o, i) for c in rem) / len(rem)
        pl = actor(hist); acts = legal(hist); hs = ohs if pl == 0 else ihs
        strat = self._avg_at((hs, board, hist, round(o, 4), round(i, 4)), acts)
        tot = 0.0
        for a in acts:
            no, ni, nh = self.g.apply(a, pl, o, i, hist)
            tot += strat[a] * self._ev(d, board, nh, no, ni)
        return tot
    def _tree_ev(self):
        return sum(d[4] * self._ev(d, self.g.board, "", 0.0, 0.0) for d in self.g.deals)
    def deal_values(self):
        """EV to OOP for each (oop_hand, ip_hand) matchup under the average strategy."""
        return {(d[0], d[1]): self._ev(d, self.g.board, "", 0.0, 0.0) for d in self.g.deals}

    # ---- recursive best response -> exploitability ----
    def _br_value(self, hero):
        g = self.g
        hero_hands = g.oop if hero == 0 else g.ip
        opp_hands = g.ip if hero == 0 else g.oop
        def rec(hh, board, hist, o, i, reach):     # reach: {opp_str: (opp_cards, prob)}
            if hist in CLOSED_FOLD:
                u_oop = g.util_fold(actor(hist[:-1]), o, i)
                u = u_oop if hero == 0 else -u_oop
                return u * sum(p for _, p in reach.values())
            if hist in CLOSED_PROCEED:
                allin = o >= g.stack - 1e-9 or i >= g.stack - 1e-9
                if len(board) == 5 or allin:
                    tot = 0.0
                    for oc, p in reach.values():
                        if p <= 0: continue
                        oopc, ipc = (hh, oc) if hero == 0 else (oc, hh)
                        u_oop = g.util_show(g.equity_oop(oopc, ipc, board), o, i)
                        tot += p * (u_oop if hero == 0 else -u_oop)
                    return tot
                used = set(board) | set(hh)
                for oc, p in reach.values():
                    if p > 0: used |= set(oc)
                cand = [c for c in range(52) if c not in used]
                tot = 0.0
                for c in cand:
                    tot += rec(hh, board + (c,), "", o, i,
                               {k: (oc, p / len(cand)) for k, (oc, p) in reach.items()})
                return tot
            pl = actor(hist); acts = legal(hist)
            if pl == hero:
                best = None
                for a in acts:
                    no, ni, nh = g.apply(a, pl, o, i, hist)
                    v = rec(hh, board, nh, no, ni, reach)
                    best = v if best is None or v > best else best
                return best
            tot = 0.0                                # opponent node: split by their avg strategy
            for a in acts:
                nr = {}
                for k, (oc, p) in reach.items():
                    sig = self._avg_at((k, board, hist, round(o, 4), round(i, 4)), acts)
                    nr[k] = (oc, p * sig[a])
                no, ni, nh = g.apply(a, pl, o, i, hist)
                tot += rec(hh, board, nh, no, ni, nr)
            return tot
        total = 0.0; W = 0.0
        for hhs, hw, hhc in hero_hands:
            if set(hhc) & set(g.board):
                continue
            reach = {}
            for ohs, ow, ohc in opp_hands:
                if set(ohc) & set(hhc) or set(ohc) & set(g.board):
                    continue
                reach[ohs] = (ohc, ow)
            Z = sum(p for _, p in reach.values())
            if Z <= 0:
                continue
            reach = {k: (oc, p / Z) for k, (oc, p) in reach.items()}
            total += hw * Z * rec(hhc, g.board, "", 0.0, 0.0, reach)
            W += hw * Z
        return total / W if W > 0 else 0.0
    def exploitability(self):
        return self._br_value(0) + self._br_value(1)
