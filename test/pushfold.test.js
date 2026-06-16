'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEqMatrix, solveHU, CLASSES, baseCount } = require('../tools/pushfold');

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
