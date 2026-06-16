# tools/solver — experimental CFR solver (Python, offline)

Exploratory work toward a **heads-up postflop CFR solver**. Separate from the
shipped app (which stays zero-build JS); this is offline Python that, if it pans
out, would *produce data* (freqTables) like the push/fold tools already do.

**Honesty rule (same as the rest of the project):** prove the engine against a
known answer before trusting it on a real spot, and measure exploitability.

## Staged plan
1. ✅ **CFR engine correctness** — `kuhn_cfr.py`. Vanilla CFR on Kuhn poker,
   verified against the closed-form Nash (game value −1/18, parameter-independent
   equilibrium frequencies, exploitability → 0 via exact best response).
   Run: `python tools/solver/kuhn_cfr.py` (pure stdlib).
2. ✅ **HU river** — `postflop.py` (betting-tree CFR + ported `evaluate7`
   showdown), verified by `test_postflop.py` against closed-form river GTO:
   polarized pot bet → nuts bet 100%, air bluffs 50%, bluff-catcher calls 50%
   (MDF), exploitability ~0.004. Run: `python tools/solver/test_postflop.py`.
   Scope: one bet size, no raises (v1). A nice GTO truth it surfaces: vs a
   range that can only fold, betting the nuts is EV-indifferent (not forced).
3. 🚧 **Add streets** — `test_streets.py` written first (TDD, currently RED):
   pins the multi-street solver to (a) reduces-to-river (5-card board ==
   RiverGame), (b) chance averaging (nuts-vs-air over all rivers → value +P/2,
   air folds), (c) exploitability → 0 on a real turn spot. Next: implement
   `PostflopGame` (turn/river chance nodes on top of the betting CFR + a
   recursive best response that scales past per-river infosets).
4. ⬜ Output strategy as data; only then consider feeding preflop leaves.

## Why HU only
CFR provably converges to Nash only in 2-player zero-sum games. Multiway
(3+/6-max) postflop has no clean GTO target and is a research-grade/abstraction
problem (cf. Pluribus) — explicitly out of scope.

## Why postflop is bigger than preflop
Chance nodes: turn (48 cards) and river (47 cards) branch the tree, so a real
solve needs vectorization over the 1326-combo range *and* over board runouts,
plus bet-size abstraction and card-removal handling.
