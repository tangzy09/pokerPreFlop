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
2. ⬜ **HU postflop, single flop** — vectorized (range × board) CFR + the
   `evaluate7` showdown logic, a few discrete bet sizes, solve flop→turn→river.
   Verify: exploitability small; sanity on a dry board (nut hands bet, air
   bluffs at the right frequency).
3. ⬜ Output strategy as data; only then consider feeding preflop leaves.

## Why HU only
CFR provably converges to Nash only in 2-player zero-sum games. Multiway
(3+/6-max) postflop has no clean GTO target and is a research-grade/abstraction
problem (cf. Pluribus) — explicitly out of scope.

## Why postflop is bigger than preflop
Chance nodes: turn (48 cards) and river (47 cards) branch the tree, so a real
solve needs vectorization over the 1326-combo range *and* over board runouts,
plus bet-size abstraction and card-removal handling.
