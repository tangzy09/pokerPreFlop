# tools/solver — experimental CFR solver (Python, offline)

A verified **heads-up postflop CFR/CFR+ solver chain**. Separate from the shipped
app (which stays zero-build JS); this is offline Python. `tools/gen-postflop-spots.py`
runs the vectorized CFR+ solver on a handful of canonical river spots and writes
`js/data/postflop-spots.js` (real GTO frequencies + measured exploitability, validated
by `test/solver-spots.test.js`). This is kept as an **offline artifact** — the in-app
**🧠 翻后GTO** display screen was removed (product decision); the app keeps the
interactive 翻后 board-equity calculator instead. Honest limit: a full end-to-end
*preflop* chart fed by real postflop EV needs the joint full-range solve (the open
frontier, step 14) and is not shippable yet.

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
7. ✅ **Vectorized river CFR (full-range)** — `vriver.py` (needs numpy):
   propagates per-hand reach VECTORS through the public tree, evaluates
   showdowns as matrix-vector products (SHARE/VALID matrices), so it scales to
   large ranges. `test_vector.py` GREEN (11/11): matches the scalar solver
   exactly on the toy, half-pot MDF, scale (MDF holds with many combos),
   determinism. ~50×38 combos solve in ~0.2s. (numpy absent -> suite skips.)
8. ✅ **Vectorized multi-street (turn+river)** — `vturn.py` (needs numpy): vector
   CFR with a CHANCE node (per-river showdown matrices + per-hand card-removal).
   `test_vturn.py` GREEN (11/11): matches the scalar multi-street solver
   (value within 0.01, exploitability ~0.005), chance averaging (nuts-vs-air
   +0.5), scale (MDF holds with many combos), determinism, convergence. A bug
   worth noting: river infosets must be keyed by the TURN line too (different pot
   sizes reach the same river card+history) — without that, mixed multi-hand
   spots plateaued at ~0.1 exploitability. EXPENSIVE (48-card chance fan-out,
   ~2min) -> standalone, not in run_all. Run: `python tools/solver/test_vturn.py`.
9. ✅ **Vectorized two-chance (flop→turn→river)** — `vflop.py` (needs numpy): two
   chance nodes; all-in runouts use PRECOMPUTED average-equity matrices (O(1), no
   fan-out), only the deep checked-betting path pays the ~48×47 board fan-out.
   `test_vflop.py` GREEN (10/10): matches the scalar solver (value), flopped-quads
   +P/2, scale, determinism. KEY FINDING: vectorization shrinks the RANGE
   dimension (done) but NOT the board fan-out — a full deep flop solve traverses
   ~2300 runouts per iteration, so it's only tractable at low iters here.
   **The real next step for practical flop solving is card/board ABSTRACTION
   (bucketing), a different technique than vectorization.** ~6min -> standalone.
10. ✅ **Board (card) abstraction** — `vturn.VTurn(..., bucket=True)`: where
    vectorization shrinks the RANGE dimension, abstraction shrinks the BOARD
    dimension. The chance node buckets river runouts by RANK (the 4 suits of a
    rank → one representative + a count weight), so cfv_o[a] = Σ_b w_b·co_b·mo_b /
    Σ_b w_b·mo_b. On a FLUSH-PROOF board (rainbow turn: a 5th card can't make a
    flush) the suit only matters through blockers, so rank-bucketing is
    near-lossless. `test_abstraction.py` GREEN (8/8): 48 cards → 13 buckets,
    value identical (+0.500), exploitability 0.008, ~4× faster (8s vs 30s),
    nuts-vs-air still +P/2, determinism. Full mode (weights 1) reduces to the
    old `vturn` behavior exactly. Run: `python tools/solver/test_abstraction.py`.
    Caveat: lossy on flush-possible boards (suits then matter beyond blockers);
    a full solver suit-isomorphism-buckets per board texture.
11. ✅ **Board abstraction on the two-chance flop** — `vflop.VFlop(..., bucket=True)`:
    rank-buckets BOTH chance nodes (flop→turn and turn→river), exposing `g.tset` and
    `g.rset[ti]`. The NESTED fan-out (~48×47 ≈ 2256 runouts/iteration on the
    check-down line) is the practical flop wall; bucketing each node ~4× drops the
    nested cost ~13×. `test_abstraction_flop.py` GREEN (8/8): 49→13 and 48→13
    buckets, ~13× faster (4s vs 50s same iters), flopped-quads converges to the
    analytic +P/2 (bucketing is *exactly* lossless when the winner is
    runout-independent), valid low-exploitability solves, determinism. Losslessness
    is anchored on the analytic +P/2 (not an unconverged full solve — full
    convergence IS the wall bucketing breaks). Run: `python tools/solver/test_abstraction_flop.py` (~3min).
12. ✅ **CFR+ (faster convergence)** — `vriver`/`vturn`/`vflop` `solve(..., plus=True)`
    (default). Three ingredients: regret-matching+ (floor cumulative regret at 0 each
    update, so a line that turned out bad doesn't climb back from deep-negative
    regret), linear averaging (weight iteration t's strategy by t), and ALTERNATING
    updates (each traversal updates one player vs the other's current strategy).
    Together they give ~O(1/t) convergence vs vanilla's ~O(1/sqrt(t)) — same Nash,
    far fewer iterations. `test_cfrplus.py` GREEN (7/7, in run_all): on the verified
    polarized river toy, CFR+ at 300 iters is ~7× less exploitable than vanilla and
    already hits MDF; the ratio GROWS with iters (the rate change). Measured speedups
    at moderate iters: vriver ~25×, vturn ~35×, vflop ~70×. `plus=False` recovers
    vanilla. NOTE: CFR+ cuts the iteration COUNT; it does NOT touch the per-iteration
    board fan-out (that's what ABSTRACTION addresses) — the two are orthogonal and a
    practical flop solve needs both. Run: `python tools/solver/test_cfrplus.py`.
13. ✅ **CFR+ for the scalar solvers** — `postflop.solve(..., plus=True)` and
    `preflop.solve(..., plus=True)` (default). Same regret-matching+ & linear
    averaging, but SIMULTANEOUS (no alternating): the per-deal scalar traversal visits
    each infoset once *per deal* per iteration, and alternating + RM+ then plateaus
    multi-street exploitability (a scalar-only failure mode — the vectorized solvers
    visit each infoset once per iteration, so they alternate fine). Simultaneous CFR+
    is stable and wins big where it matters: ~40-70× on the multi-street turn solve.
    `test_cfrplus_scalar.py` GREEN (10/10, in run_all). End-to-end (`endtoend.py`)
    exploitability improved to ~0.003 (was ~0.008). Honest caveat: on a degenerate
    near-indifferent spot (deep stack + neutral leaf_ev=0) simultaneous CFR+ lags
    vanilla slightly — CFR+ is not uniformly faster, but the postflop multi-street win
    is what end-to-end needs. Run: `python tools/solver/test_cfrplus_scalar.py`.
14. ⬜ Next: raises in postflop trees (multi-bet-size); flop-range iteration (the
    chicken-and-egg joint solve); a real end-to-end run producing preflop freqTables
    to import into the app (the original data-pipeline goal).

## Heavier standalone suites (not in run_all)
- `python tools/solver/endtoend.py` — preflop fed by the real postflop solver; also exercises scalar CFR+ (~45s)
- `python tools/solver/test_vturn.py` — vectorized turn+river (~2min)
- `python tools/solver/test_abstraction.py` — board/rank bucketing on vturn (~40s)
- `python tools/solver/test_vflop.py` — vectorized flop (two chance nodes, ~6min)
- `python tools/solver/test_abstraction_flop.py` — rank bucketing on both flop chance nodes (~3min)

## Why HU only
CFR provably converges to Nash only in 2-player zero-sum games. Multiway
(3+/6-max) postflop has no clean GTO target and is a research-grade/abstraction
problem (cf. Pluribus) — explicitly out of scope.

## Why postflop is bigger than preflop
Chance nodes: turn (48 cards) and river (47 cards) branch the tree, so a real
solve needs vectorization over the 1326-combo range *and* over board runouts,
plus bet-size abstraction and card-removal handling.
