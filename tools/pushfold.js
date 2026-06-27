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
const { comboCards, classEquity, mulberry32 } = require('../js/equity');

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
  const round2 = (x) => Math.round(x * 100) / 100;
  const jamR = {}, callR = {};
  for (let k = 0; k < N; k++) { jamR[CLASSES[k]] = round(jam[k]); callR[CLASSES[k]] = round(call[k]); }
  // --- 每手 EV（相对 fold 的增量，>0 即 +EV）给 Nash 查询器 ---
  const totW = w.reduce((a, b) => a + b, 0);
  let cw = 0; for (let v = 0; v < N; v++) cw += w[v] * call[v];
  const pCall = cw / totW;
  const eqCalled = cw > 0 ? matvec(EQ, w.map((wi, v) => wi * call[v])).map((x) => x / cw) : null;
  const jamEV = {};
  for (let h = 0; h < N; h++) {
    const evJam = cw <= 0 ? 1 : (1 - pCall) + pCall * (S * (2 * eqCalled[h] - 1));
    jamEV[CLASSES[h]] = round2(evJam - (-0.5));        // SB fold = -0.5
  }
  let jw = 0; for (let s = 0; s < N; s++) jw += w[s] * jam[s];
  const eqVsJam = jw > 0 ? matvec(EQ, w.map((wi, s) => wi * jam[s])) : null;
  const callEV = {};
  for (let v = 0; v < N; v++) {
    const eq = eqVsJam ? eqVsJam[v] / jw : 0;
    callEV[CLASSES[v]] = round2(S * (2 * eq - 1) - (-1));  // BB fold = -1
  }
  const pct = (f) => {
    let a = 0, b = 0; for (let k = 0; k < N; k++) { a += w[k] * f[CLASSES[k]]; b += w[k]; }
    return a / b;
  };
  return { jam: jamR, call: callR, jamPct: pct(jamR), callPct: pct(callR), jamEV, callEV };
}

// matrix-vector product result[c] = sum_v EQ[c][v]*g[v]
function matvec(EQ, g) {
  const out = new Float64Array(N);
  for (let c = 0; c < N; c++) { const row = EQ[c]; let s = 0; for (let v = 0; v < N; v++) s += row[v] * g[v]; out[c] = s; }
  return out;
}

/*
 * solveRing — multiway jam/fold Nash for a full ring, no-overcall model.
 *
 * Decomposition: when it folds to seat i and i jams, every later seat only
 * CALLS (i pre-empts their open), and a call closes the action (so all
 * showdowns are heads-up and use the HU class-equity matrix). Each caller's
 * decision depends only on i's jam range, so the table splits into independent
 * sub-problems per jammer seat i = 0..SB. Seats: 0..nSeats-1, SB=nSeats-2,
 * BB=nSeats-1. BB never opens (folded-to-BB just wins).
 *
 * Net-chip EV (no antes): jammer fold loses its posted blind (SB only); all
 * fold to a jam -> win the dead blinds; on a heads-up all-in for S with equity
 * e and dead money D, the all-in player's net = S*(2e-1) + e*D.
 */
function solveRing(S, EQ, { nSeats = 9, iters = 700, damp = 0.15 } = {}) {
  const w = CLASSES.map(baseCount);
  const totW = w.reduce((a, b) => a + b, 0);
  const SB = nSeats - 2, BB = nSeats - 1;
  const D = (i, k) => (SB !== i && SB !== k ? 0.5 : 0) + (BB !== i && BB !== k ? 1 : 0);
  const netAllFold = (i) => (SB !== i ? 0.5 : 0) + (BB !== i ? 1 : 0);
  const jammerFold = (i) => (i === SB ? -0.5 : 0);
  const callerFold = (k) => (k === SB ? -0.5 : k === BB ? -1 : 0);

  const seats = {};
  for (let i = 0; i <= SB; i++) {                  // independent sub-problem per jammer seat
    const behind = []; for (let k = i + 1; k <= BB; k++) behind.push(k);
    let jam = new Float64Array(N).fill(1);
    const call = {}; for (const k of behind) call[k] = new Float64Array(N).fill(0);
    for (let it = 0; it < iters; it++) {
      // --- callers' best response vs i's jam range (one matvec shared by all callers) ---
      let jw = 0; for (let s = 0; s < N; s++) jw += w[s] * jam[s];
      const eqVsJam = jw > 0 ? matvec(EQ, w.map((wi, s) => wi * jam[s])) : null;
      const brCall = {};
      for (const k of behind) {
        const arr = new Float64Array(N), Dik = D(i, k), fEV = callerFold(k);
        for (let c = 0; c < N; c++) {
          const eq = eqVsJam ? eqVsJam[c] / jw : 0;
          arr[c] = (S * (2 * eq - 1) + eq * Dik > fEV) ? 1 : 0;
        }
        brCall[k] = arr;
      }
      // --- jammer's best response vs callers (one matvec per caller) ---
      const pCall = {}, eqK = {};
      for (const k of behind) {
        let m = 0; for (let c = 0; c < N; c++) m += w[c] * brCall[k][c];
        pCall[k] = m / totW;
        eqK[k] = m > 0 ? matvec(EQ, w.map((wi, c) => wi * brCall[k][c])).map((x) => x / m) : null;
      }
      const brJam = new Float64Array(N), jf = jammerFold(i);
      for (let c = 0; c < N; c++) {
        let pAll = 1; for (const k of behind) pAll *= (1 - pCall[k]);
        let ev = pAll * netAllFold(i), reach = 1;
        for (const k of behind) {
          const eq = eqK[k] ? eqK[k][c] : 0;
          ev += reach * pCall[k] * (S * (2 * eq - 1) + eq * D(i, k));
          reach *= (1 - pCall[k]);
        }
        brJam[c] = (ev > jf) ? 1 : 0;
      }
      // --- damped update ---
      for (const k of behind) { const a = call[k], b = brCall[k]; for (let c = 0; c < N; c++) a[c] += damp * (b[c] - a[c]); }
      for (let c = 0; c < N; c++) jam[c] += damp * (brJam[c] - jam[c]);
    }
    const round = (x) => Math.round(x * 1000) / 1000;
    const round2 = (x) => Math.round(x * 100) / 100;
    const jr = {}; for (let c = 0; c < N; c++) jr[CLASSES[c]] = round(jam[c]);
    const callers = {};
    for (const k of behind) { const cr = {}; for (let c = 0; c < N; c++) cr[CLASSES[c]] = round(call[k][c]); callers[k] = cr; }
    let a = 0; for (let c = 0; c < N; c++) a += w[c] * jam[c];
    // --- 收敛后导出每手 EV（相对 fold 的增量，>0 即该动作 +EV，对应绿色）给 Nash 查询器显示 ---
    const pCallF = {}, eqKF = {};
    for (const k of behind) {
      let m = 0; for (let c = 0; c < N; c++) m += w[c] * call[k][c];
      pCallF[k] = m / totW;
      eqKF[k] = m > 0 ? matvec(EQ, w.map((wi, c) => wi * call[k][c])).map((x) => x / m) : null;
    }
    const jfEV = jammerFold(i), jamEV = {};
    for (let c = 0; c < N; c++) {
      let pAll = 1; for (const k of behind) pAll *= (1 - pCallF[k]);
      let ev = pAll * netAllFold(i), reach = 1;
      for (const k of behind) {
        const eq = eqKF[k] ? eqKF[k][c] : 0;
        ev += reach * pCallF[k] * (S * (2 * eq - 1) + eq * D(i, k));
        reach *= (1 - pCallF[k]);
      }
      jamEV[CLASSES[c]] = round2(ev - jfEV);
    }
    let jwF = 0; for (let s = 0; s < N; s++) jwF += w[s] * jam[s];
    const eqVsJamF = jwF > 0 ? matvec(EQ, w.map((wi, s) => wi * jam[s])) : null;
    const callerEV = {};
    for (const k of behind) {
      const Dik = D(i, k), fEV = callerFold(k), ev = {};
      for (let c = 0; c < N; c++) { const eq = eqVsJamF ? eqVsJamF[c] / jwF : 0; ev[CLASSES[c]] = round2(S * (2 * eq - 1) + eq * Dik - fEV); }
      callerEV[k] = ev;
    }
    seats[i] = { jam: jr, jamPct: a / totW, callers, jamEV, callerEV };
  }
  return { seats, SB, BB, nSeats };
}

/*
 * ringRegret — exploitability of a solved ring: the largest EV (in bb/hand) a
 * player could gain by best-responding instead of following the solution.
 * 0 == exact Nash within the model; small == converged. Checks every jammer
 * seat's hands and every caller's hands against the solution's opposing ranges.
 */
function ringRegret(S, EQ, ring) {
  const w = CLASSES.map(baseCount); const totW = w.reduce((a, b) => a + b, 0);
  const SB = ring.SB, BB = ring.BB;
  const D = (i, k) => (SB !== i && SB !== k ? 0.5 : 0) + (BB !== i && BB !== k ? 1 : 0);
  const netAllFold = (i) => (SB !== i ? 0.5 : 0) + (BB !== i ? 1 : 0);
  const jammerFold = (i) => (i === SB ? -0.5 : 0);
  const callerFold = (k) => (k === SB ? -0.5 : k === BB ? -1 : 0);
  const arr = (dict) => { const a = new Float64Array(N); for (let c = 0; c < N; c++) a[c] = dict[CLASSES[c]] || 0; return a; };
  let max = 0;
  for (let i = 0; i <= SB; i++) {
    const seat = ring.seats[i]; if (!seat) continue;
    const jam = arr(seat.jam);
    const behind = []; for (let k = i + 1; k <= BB; k++) behind.push(k);
    const call = {}; for (const k of behind) call[k] = arr(seat.callers[k]);

    // callers' regret vs i's jam range (shared equity vector)
    let jw = 0; for (let s = 0; s < N; s++) jw += w[s] * jam[s];
    const eqVsJam = jw > 0 ? matvec(EQ, w.map((wi, s) => wi * jam[s])) : null;
    for (const k of behind) {
      const Dik = D(i, k), fEV = callerFold(k);
      for (let c = 0; c < N; c++) {
        const eq = eqVsJam ? eqVsJam[c] / jw : 0;
        const callEV = S * (2 * eq - 1) + eq * Dik;
        const best = Math.max(callEV, fEV);
        const actual = call[k][c] * callEV + (1 - call[k][c]) * fEV;
        if (best - actual > max) max = best - actual;
      }
    }
    // jammer's regret vs callers' ranges
    const pCall = {}, eqK = {};
    for (const k of behind) {
      let m = 0; for (let c = 0; c < N; c++) m += w[c] * call[k][c];
      pCall[k] = m / totW;
      eqK[k] = m > 0 ? matvec(EQ, w.map((wi, c) => wi * call[k][c])).map((x) => x / m) : null;
    }
    const jf = jammerFold(i);
    for (let c = 0; c < N; c++) {
      let pAll = 1; for (const k of behind) pAll *= (1 - pCall[k]);
      let ev = pAll * netAllFold(i), reach = 1;
      for (const k of behind) {
        const eq = eqK[k] ? eqK[k][c] : 0;
        ev += reach * pCall[k] * (S * (2 * eq - 1) + eq * D(i, k));
        reach *= (1 - pCall[k]);
      }
      const best = Math.max(ev, jf);
      const actual = jam[c] * ev + (1 - jam[c]) * jf;
      if (best - actual > max) max = best - actual;
    }
  }
  return { maxRegret: max };
}

module.exports = { CLASSES, IDX, baseCount, buildEqMatrix, solveHU, solveRing, ringRegret, matvec, N };
