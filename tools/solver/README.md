# tools/solver — experimental CFR solver (Python, offline)

Exploratory work toward a **heads-up postflop CFR solver**. Separate from the
shipped app (which stays zero-build JS); this is offline Python that, if it pans
out, would *produce data* (freqTables) like the push/fold tools already do.

**Honesty rule (same as the rest of the project):** prove the engine against a
known answer before trusting it on a real spot, and measure exploitability.

**Run all suites:** `python tools/solver/run_all.py` (or `npm run test:solver`;
`npm run test:all` also runs the app's JS tests).

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
3. ✅ **Multi-street (turn/river)** — `PostflopGame` adds chance nodes between
   streets; river (5-card) reduces to the verified single-street game. Recursive
   best response gives exploitability without enumerating per-river infosets.
   `test_streets.py` GREEN: reduces-to-river matches (+0.250), nuts-vs-air over
   all rivers → value +0.5 / air folds / expl 0.0005, real turn spot expl 0.002.
   Run: `python tools/solver/test_streets.py`. Scope: one bet size, no raises.
4. ✅ **Preflop ↔ postflop** — `preflop.py`: HU SB/BB preflop CFR (fold / limp /
   jam) that values "see a flop" leaves via an INJECTED `leaf_ev` callback
   (the postflop solver or an EV model plugs in here); all-in leaves use preflop
   all-in equity. `test_preflop.py` GREEN: leaf_ev=None reduces to a push/fold
   Nash (exploitability 0.016, AA always jams); leaf_ev is invoked; the combined
   game converges (expl 0.011 / 0.033 deep). Run: `python tools/solver/test_preflop.py`.
   NOTE: a *correct* leaf_ev needs the postflop solve of the arriving ranges
   (chicken-and-egg). v1 injects a cheap labelled model; raises are v2.
5. ✅ **End-to-end: preflop fed by the REAL postflop solver** — `endtoend.py`
   wires the preflop `leaf_ev` to actual multi-street postflop solves (one per
   sampled board; OOP=BB, IP=SB; `deal_values()` gives per-matchup EV; SB leaf
   EV = −util_oop via the P/2-baseline bridge). Verified: AA realizes +EV / trash
   −EV postflop, preflop converges (expl ~0.008). EXPENSIVE (~45s for 3 flops,
   tiny ranges, shallow stacks) — a standalone demo, NOT in run_all.
   Run: `python tools/solver/endtoend.py`.
6. ✅ **Preflop raises (v2)** — `PreflopGame(..., open_size=R)` adds an
   open-raise (and re-raise = jam) on top of fold/limp/jam; gated on a flop
   existing (leaf_ev=None still reduces to push/fold, matching the plain
   jam/fold value exactly). `test_preflop_raise.py` GREEN (10/10): reduction,
   raise/limp offered, exploitability ~0, determinism, convergence.
7. ⬜ Next (all heavy): raises in the POSTFLOP trees; bigger ranges (needs
   vectorised CFR); flop-range iteration (the real chicken-and-egg joint solve).

## Why HU only
CFR provably converges to Nash only in 2-player zero-sum games. Multiway
(3+/6-max) postflop has no clean GTO target and is a research-grade/abstraction
problem (cf. Pluribus) — explicitly out of scope.

## Why postflop is bigger than preflop
Chance nodes: turn (48 cards) and river (47 cards) branch the tree, so a real
solve needs vectorization over the 1326-combo range *and* over board runouts,
plus bet-size abstraction and card-removal handling.
