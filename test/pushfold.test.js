'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEqMatrix, solveHU, solveRing, ringRegret, CLASSES, baseCount } = require('../tools/pushfold');

// one modest-sample seeded matrix shared by all asserts (build is the cost)
const EQ = buildEqMatrix(400, 7);
const idx = {}; CLASSES.forEach((l, i) => { idx[l] = i; });

test('equity matrix is zero-sum and sane', () => {
  for (const [a, b, lo, hi] of [['AA', 'KK', 0.78, 0.85], ['AA', 'AKo', 0.88, 0.97]]) {
    const e = EQ[idx[a]][idx[b]];
    assert.ok(e > lo && e < hi, `${a} vs ${b} = ${e}`);
  }
  // symmetry EQ[i][j] + EQ[j][i] == 1 (exact by construction) and diagonal ~0.5
  assert.equal(EQ[idx.AA][idx.KK] + EQ[idx.KK][idx.AA], 1);
  assert.ok(Math.abs(EQ[idx.QJs][idx.QJs] - 0.5) < 0.06, 'diagonal ~0.5');
});

test('HU 10bb push/fold Nash matches known structure', () => {
  const r = solveHU(10, EQ);
  // premium hands jam and call for sure
  for (const h of ['AA', 'KK', 'AKs', 'AKo', '22']) {
    assert.equal(r.jam[h], 1, `${h} should jam`);
    assert.equal(r.call[h], 1, `${h} should be a call`);
  }
  // trash folds both ways
  for (const h of ['72o', '32o']) {
    assert.equal(r.jam[h], 0, `${h} should fold (SB)`);
    assert.equal(r.call[h], 0, `${h} should fold (BB)`);
  }
  // SB shoves wider than BB calls; both in known bands for 10bb HU
  assert.ok(r.jamPct > 0.48 && r.jamPct < 0.68, `jamPct=${r.jamPct}`);
  assert.ok(r.callPct > 0.28 && r.callPct < 0.46, `callPct=${r.callPct}`);
  assert.ok(r.jamPct > r.callPct, 'SB jams wider than BB calls');
});

test('shorter stacks jam wider (monotonic in stack depth)', () => {
  const short = solveHU(6, EQ).jamPct;
  const deep = solveHU(16, EQ).jamPct;
  assert.ok(short >= deep, `jamPct should not increase with stack: 6bb=${short} 16bb=${deep}`);
});

test('jam frequency respects dominance (AA >= A2o >= 72o)', () => {
  const r = solveHU(10, EQ);
  assert.ok(r.jam.AA >= r.jam.A2o && r.jam.A2o >= r.jam['72o'], 'jam monotonic by strength');
});

test('solver is near-Nash: exploitability is small and shrinks with iterations', () => {
  // HU is the cleanest case
  const hu = solveRing(10, EQ, { nSeats: 2, iters: 3000, damp: 0.05 });
  assert.ok(ringRegret(10, EQ, hu).maxRegret < 0.08, 'HU 10bb should be near equilibrium');
  // more iterations / less damping must reduce exploitability (convergence)
  const coarse = ringRegret(10, EQ, solveRing(10, EQ, { nSeats: 9, iters: 120, damp: 0.15 })).maxRegret;
  const fine = ringRegret(10, EQ, solveRing(10, EQ, { nSeats: 9, iters: 4000, damp: 0.03 })).maxRegret;
  assert.ok(fine >= 0, 'regret is non-negative');
  assert.ok(fine < coarse, `more iters should reduce regret: coarse=${coarse} fine=${fine}`);
  assert.ok(fine < 0.25, `converged 10bb 9-max exploitability bounded: ${fine}`);
});

test('multiway ring jam ranges widen by position and match HU at the SB seat', () => {
  const ring = solveRing(10, EQ);
  const s = ring.seats;                            // 0=UTG .. 6=BTN, 7=SB
  // monotonic widening from early to late
  assert.ok(s[0].jamPct < s[5].jamPct && s[5].jamPct < s[6].jamPct && s[6].jamPct < s[7].jamPct,
    `jam% should widen: UTG=${s[0].jamPct} CO=${s[5].jamPct} BTN=${s[6].jamPct} SB=${s[7].jamPct}`);
  // the SB sub-problem must reduce to the (independently verified) HU solve
  assert.ok(Math.abs(s[7].jamPct - solveHU(10, EQ).jamPct) < 0.06, 'SB seat ~= HU solve');
  // UTG tight, premiums in / trash out; SB wide
  assert.equal(s[0].jam.AA, 1); assert.equal(s[0].jam['72o'], 0);
  assert.ok(s[0].jamPct > 0.05 && s[0].jamPct < 0.17, `UTG jam%=${s[0].jamPct}`);
  assert.ok(s[7].jamPct > 0.50 && s[7].jamPct < 0.66, `SB jam%=${s[7].jamPct}`);
});
