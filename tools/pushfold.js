'use strict';
/*
 * pushfold.js — compute heads-up SB-vs-BB jam/fold Nash equilibria ourselves.
 *
 * Chip-EV (no ICM), the canonical short-stack model the published "Nash charts"
 * use. SB may jam all-in or fold; BB facing a jam may call or fold. We:
 *  1. build a 169x169 hand-class all-in equity matrix (Monte-Carlo, seeded), and
 *  2. iterate damped best-responses to the equilibrium jam/call frequencies.
 *
 * Methodology notes (kept honest): equity is class-vs-class averaged over
 * combos+boards; opponent card-removal is approximated at the class level via
 * combo-count weights. This reproduces standard push/fold charts closely; it is
 * a computed approximation, not a claim of bit-exact solver output.
 */
const { comboCards, classEquity, mulberry32 } = require('./equity');

// 169 hand-class labels (rank order high->low) + base combo counts
const ORD = 'AKQJT98765432';
const LABELS = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
  if (i === j) LABELS.push(ORD[i] + ORD[i]);
  else if (i < j) LABELS.push(ORD[i] + ORD[j] + 's');
  else LABELS.push(ORD[j] + ORD[i] + 'o');
}
// dedupe (the loop above lists each suited/offsuit once already); keep stable order
const SEEN = new Set(); const CLASSES = [];
for (const l of LABELS) if (!SEEN.has(l)) { SEEN.add(l); CLASSES.push(l); }
const IDX = {}; CLASSES.forEach((l, i) => { IDX[l] = i; });
const baseCount = (l) => (l.length === 2 ? 6 : l[2] === 's' ? 4 : 12);
const N = CLASSES.length;                          // 169

// 169x169 class equity matrix; EQ[i][j] = equity of class i vs class j
function buildEqMatrix(samples = 1200, seed = 12345) {
  const rng = mulberry32(seed);
  const EQ = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) {
    EQ[i][i] = classEquity(CLASSES[i], CLASSES[i], samples, rng);
    for (let j = i + 1; j < N; j++) {
      const e = classEquity(CLASSES[i], CLASSES[j], samples, rng);
      EQ[i][j] = e; EQ[j][i] = 1 - e;              // equity is zero-sum (win+tie/2)
    }
  }
  return EQ;
}

/*
 * Solve HU SB(jam/fold) vs BB(call/fold) at effective stack S (bb).
 * Net-chip EVs (relative to start of hand): SB fold = -0.5; SB jam & BB folds
 * = +1; all-in for S with SB equity e -> SB net = S*(2e-1).
 * Returns per-class jam (SB) and call (BB) frequencies in [0,1].
 */
function solveHU(S, EQ, { iters = 400, damp = 0.2 } = {}) {
  const w = CLASSES.map(baseCount);
  let jam = new Float64Array(N).fill(1);           // SB jam freq
  let call = new Float64Array(N).fill(0);          // BB call freq
  for (let it = 0; it < iters; it++) {
    // BB best-response to SB's jam range
    let jw = 0; for (let s = 0; s < N; s++) jw += w[s] * jam[s];
    const brCall = new Float64Array(N);
    for (let v = 0; v < N; v++) {
      if (jw <= 0) { brCall[v] = 0; continue; }
      let num = 0; for (let s = 0; s < N; s++) num += w[s] * jam[s] * EQ[v][s];
      const eq = num / jw;
      brCall[v] = (S * (2 * eq - 1) > -1) ? 1 : 0; // call beats folding the BB
    }
    // SB best-response to BB's call range
    const totW = w.reduce((a, b) => a + b, 0);
    let cw = 0; for (let v = 0; v < N; v++) cw += w[v] * call[v];
    const brJam = new Float64Array(N);
    for (let h = 0; h < N; h++) {
      const pCall = cw / totW;
      let evJam;
      if (cw <= 0) evJam = 1;                       // never called -> win the BB
      else {
        let num = 0; for (let v = 0; v < N; v++) num += w[v] * call[v] * EQ[h][v];
        const eqWhenCalled = num / cw;
        evJam = (1 - pCall) * 1 + pCall * (S * (2 * eqWhenCalled - 1));
      }
      brJam[h] = (evJam > -0.5) ? 1 : 0;            // jam beats folding the SB
    }
    // damped update (smooths toward equilibrium; near-indifferent hands settle fractional)
    for (let k = 0; k < N; k++) {
      jam[k] += damp * (brJam[k] - jam[k]);
      call[k] += damp * (brCall[k] - call[k]);
    }
  }
  const round = (x) => Math.round(x * 1000) / 1000;
  const jamR = {}, callR = {};
  for (let k = 0; k < N; k++) { jamR[CLASSES[k]] = round(jam[k]); callR[CLASSES[k]] = round(call[k]); }
  const pct = (f) => {
    let a = 0, b = 0; for (let k = 0; k < N; k++) { a += w[k] * f[CLASSES[k]]; b += w[k]; }
    return a / b;
  };
  return { jam: jamR, call: callR, jamPct: pct(jamR), callPct: pct(callR) };
}

module.exports = { CLASSES, IDX, baseCount, buildEqMatrix, solveHU, N };
