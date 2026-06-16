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
2. 🚧 **HU postflop** — `test_postflop.py` written first (TDD, currently RED):
   pins the solver to closed-form river GTO (polarized MDF: nuts bet 100%, air
   bluffs 50%, bluff-catcher calls 50% vs a pot bet), nuts-vs-air degeneracy,
   and exploitability → 0. Next: implement `postflop.py` (betting-tree CFR +
   `evaluate7` showdown) to make them pass — start RIVER-only (no chance nodes),
   then add turn/river runouts.
3. ⬜ Output strategy as data; only then consider feeding preflop leaves.

## Why HU only
CFR provably converges to Nash only in 2-player zero-sum games. Multiway
(3+/6-max) postflop has no clean GTO target and is a research-grade/abstraction
problem (cf. Pluribus) — explicitly out of scope.

## Why postflop is bigger than preflop
Chance nodes: turn (48 cards) and river (47 cards) branch the tree, so a real
solve needs vectorization over the 1326-combo range *and* over board runouts,
plus bet-size abstraction and card-removal handling.
