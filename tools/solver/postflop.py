"""
postflop.py — heads-up RIVER CFR solver (the first real postflop solver).

River = board complete, so there are NO chance nodes — just the betting tree +
showdown. This isolates the betting-tree CFR (verified here against closed-form
river GTO in test_postflop.py) before turn/river runouts are layered on.

Scope (v1): one bet size, no raises (facing a bet → fold/call). With stack==pot
a pot-sized bet is all-in, which is exactly the toy the tests use. Multi-size /
raises are a later extension of the same tree.

Model / EV convention: the dead pot P is treated as co-owned 50/50 at river
start, so utilities are zero-sum (sum to 0); game_value 0 = breakeven for OOP,
>0 = OOP profits. Pure stdlib.
"""
import itertools

# ---------- card parsing + 7-card evaluator (port of tools/equity.js) ----------
RV = {c: i for i, c in enumerate("23456789TJQKA")}
SU = {c: i for i, c in enumerate("shdc")}
def parse_card(s):
    return (RV[s[0]], SU[s[1].lower()])

def _straight_high(mask):
    for top in range(12, 3, -1):
        if all(mask & (1 << (top - k)) for k in range(5)):
            return top
    if (mask & (1 << 12)) and (mask & 0b1111) == 0b1111:   # wheel A-2-3-4-5
        return 3
    return -1
def _ranks(mask):
    return [r for r in range(12, -1, -1) if mask & (1 << r)]
def _score(cat, tb):
    v = cat
    for i in range(5):
        v = v * 16 + (tb[i] if i < len(tb) else 0)
    return v
def evaluate7(cards):
    rc = [0] * 13; sc = [0] * 4; srm = [0, 0, 0, 0]; rm = 0
    for (r, s) in cards:
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

def hand_cards(h):
    return [parse_card(h[0:2]), parse_card(h[2:4])]

# ---------- river betting tree (one bet size, no raises) ----------
TERMINAL = {"xx", "bf", "bc", "xbf", "xbc"}
LEGAL = {"": "xb", "x": "xb", "b": "fc", "xb": "fc"}
LABEL = {"x": "check", "b": "bet", "f": "fold", "c": "call"}
def actor(h):
    return 0 if len(h) % 2 == 0 else 1     # 0 = OOP, 1 = IP

class RiverGame:
    def __init__(self, board, oop, ip, pot, stack, bet_sizes):
        self.board = [parse_card(c) for c in board]
        self.pot = float(pot)
        self.stack = float(stack)
        self.bet = min(bet_sizes[0] * pot, stack)     # v1: single size
        self.oop = [(h, float(w)) for h, w in oop]
        self.ip = [(h, float(w)) for h, w in ip]
        used = set()
        for h, _ in self.oop + self.ip:
            for c in hand_cards(h):
                pass
        # precompute showdown sign (to OOP) per (oop_hand, ip_hand), and valid deals
        self.deals = []      # (oh, ih, weight, oop_wins_sign)
        Z = 0.0
        for oh, wo in self.oop:
            oc = hand_cards(oh)
            for ih, wi in self.ip:
                ic = hand_cards(ih)
                if set(oc) & set(ic) or (set(oc) | set(ic)) & set(self.board):
                    continue                     # card conflict -> impossible deal
                so = evaluate7(oc + self.board); si = evaluate7(ic + self.board)
                sign = 1 if so > si else (0 if so == si else -1)
                w = wo * wi
                self.deals.append([oh, ih, w, sign]); Z += w
        if Z <= 0:
            raise ValueError("no valid deals (all hands conflict)")
        for d in self.deals:
            d[2] /= Z                            # normalise deal weights

    def util_oop(self, sign, h):
        P, b = self.pot, self.bet
        def show(fp, o):
            pot_won = fp if sign > 0 else (fp / 2 if sign == 0 else 0)
            return pot_won - o - P / 2
        if h == "xx":  return show(P, 0)
        if h == "bf":  return P / 2              # OOP bet, IP folded
        if h == "bc":  return show(P + 2 * b, b)
        if h == "xbf": return -P / 2             # OOP checked, IP bet, OOP folded
        if h == "xbc": return show(P + 2 * b, b)
        raise ValueError(h)

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

class Solution:
    def __init__(self, game, nodes):
        self.game = game
        self._avg = {k: nd.average() for k, nd in nodes.items()}
        self.game_value = self._tree_ev(self._strat_avg)

    # strategy lookups (label-keyed) ------------------------------------------
    def _avg_at(self, hand, h):
        nd = self._avg.get((hand, h))
        acts = LEGAL[h]
        if nd is None:
            return {a: 1.0 / len(acts) for a in acts}
        return nd
    def _labeled(self, hand, h):
        return {LABEL[a]: p for a, p in self._avg_at(hand, h).items()}
    def oop_strategy(self, hand):
        return self._labeled(hand, "")
    def ip_strategy(self, hand, facing):
        return self._labeled(hand, "b" if facing == "bet" else "x")

    # EV under arbitrary strategy functions -----------------------------------
    def _ev(self, deal, h, strat_fn):
        oh, ih, w, sign = deal
        if h in TERMINAL:
            return self.game.util_oop(sign, h)
        pl = actor(h); hand = oh if pl == 0 else ih
        strat = strat_fn(pl, hand, h)
        return sum(strat[a] * self._ev(deal, h + a, strat_fn) for a in LEGAL[h])
    def _tree_ev(self, strat_fn):
        return sum(d[2] * self._ev(d, "", strat_fn) for d in self.game.deals)
    def _strat_avg(self, pl, hand, h):
        return self._avg_at(hand, h)

    # exact exploitability via brute-force best response (small games only) ----
    def _infosets(self, player):
        hands = self.game.oop if player == 0 else self.game.ip
        hsets = ["", "xb"] if player == 0 else ["x", "b"]
        return [(hand, h) for hand, _ in hands for h in hsets]
    def _pure_value(self, hero):
        infos = self._infosets(hero)
        best = -1e18
        for choice in itertools.product(*[LEGAL[h] for (_, h) in infos]):
            pure = {infos[i]: choice[i] for i in range(len(infos))}
            def fn(pl, hand, h, _pure=pure):
                if pl == hero:
                    a = _pure[(hand, h)]
                    return {x: (1.0 if x == a else 0.0) for x in LEGAL[h]}
                return self._avg_at(hand, h)
            v = self._tree_ev(fn)
            v = v if hero == 0 else -v          # value to the hero
            best = max(best, v)
        return best
    def exploitability(self):
        return self._pure_value(0) + self._pure_value(1)   # 0 at Nash (zero-sum)

def solve(game, iters=20000, seed=0):
    nodes = {}
    def node(key, acts):
        nd = nodes.get(key)
        if nd is None:
            nd = nodes[key] = _Node(acts)
        return nd
    def cfr(deal, h, p_oop, p_ip, p_chance):
        oh, ih, w, sign = deal
        if h in TERMINAL:
            return game.util_oop(sign, h)
        pl = actor(h); hand = oh if pl == 0 else ih; acts = LEGAL[h]
        nd = node((hand, h), acts)
        strat = nd.strategy()
        util = {}; node_util = 0.0
        for a in acts:
            if pl == 0:
                u = cfr(deal, h + a, p_oop * strat[a], p_ip, p_chance)
            else:
                u = cfr(deal, h + a, p_oop, p_ip * strat[a], p_chance)
            util[a] = u; node_util += strat[a] * u
        s = 1 if pl == 0 else -1                      # actor's value sign vs util_oop
        reach_opp = p_ip if pl == 0 else p_oop
        reach_self = p_oop if pl == 0 else p_ip
        for a in acts:
            nd.regret[a] += p_chance * reach_opp * (s * util[a] - s * node_util)
            nd.strat_sum[a] += reach_self * strat[a]
        return node_util
    for _ in range(iters):
        for d in game.deals:
            cfr(d, "", 1.0, 1.0, d[2])
    return Solution(game, nodes)
