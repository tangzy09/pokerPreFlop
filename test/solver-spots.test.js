'use strict';
/*
 * Regression coverage for the SHIPPED postflop GTO data (js/data/postflop-spots.js),
 * produced offline by tools/gen-postflop-spots.py (the vectorized CFR+ solver). These
 * pin that the displayed numbers are real, well-formed, near-Nash, and match the
 * textbook closed forms (MDF, polarization, indifference) — so a regression in the
 * solver or generator is caught before the data reaches the UI.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

function loadSpots() {
  global.window = {};
  delete require.cache[require.resolve('../js/data/postflop-spots.js')];
  require('../js/data/postflop-spots.js');
  return global.window.SOLVED_SPOTS;
}
const SPOTS = loadSpots();
const byId = (id) => SPOTS.find((s) => s.id === id);
const line = (spot, sub) => spot.lines.find((l) => l.hand.includes(sub));
const near = (a, b, tol = 0.06) => Math.abs(a - b) <= tol;

test('data file loads a non-empty list of well-formed spots', () => {
  assert.ok(Array.isArray(SPOTS) && SPOTS.length >= 4, `got ${SPOTS && SPOTS.length}`);
  for (const s of SPOTS) {
    assert.ok(s.id && s.concept && s.board && s.desc && s.note && s.src, `missing fields on ${s.id}`);
    assert.strictEqual(typeof s.value, 'number');
    assert.ok(Array.isArray(s.lines) && s.lines.length >= 1, `${s.id} has no lines`);
    for (const l of s.lines) {
      assert.ok(l.who === 'OOP' || l.who === 'IP', `${s.id} bad who`);
      assert.ok(l.hand && l.freq && typeof l.freq === 'object');
      const sum = Object.values(l.freq).reduce((a, b) => a + b, 0);
      assert.ok(near(sum, 1, 1e-6), `${s.id}/${l.hand} freq sums to ${sum}`);
      for (const v of Object.values(l.freq)) assert.ok(v >= -1e-9 && v <= 1 + 1e-9);
    }
  }
});

test('every spot is a near-Nash solve (measured exploitability ~ 0)', () => {
  for (const s of SPOTS) {
    assert.strictEqual(typeof s.exploitability, 'number');
    assert.ok(s.exploitability < 0.02, `${s.id} exploitability ${s.exploitability}`);
  }
});

test('polarized pot bet: bluff-catcher defends at MDF 50%, nuts bets 100%, air bluffs ~50%', () => {
  const s = byId('polar-pot');
  assert.ok(near(line(s, '坚果').freq.bet, 1.0), 'nuts should bet 100%');
  assert.ok(near(line(s, '空气').freq.bet, 0.5), 'air bluffs ~50%');
  assert.ok(near(line(s, '抓诈').freq.call, 0.5), 'MDF call ~50%');
  assert.ok(near(s.value, 0.25), `value ${s.value}`);
});

test('half-pot bet: bluff-catcher defends at MDF ~67%', () => {
  const s = byId('polar-half');
  assert.ok(near(line(s, '抓诈').freq.call, 2 / 3), `call ${line(s, '抓诈').freq.call}`);
});

test('nuts vs air: air folds 100%, OOP value = +P/2 (betting is indifferent)', () => {
  const s = byId('nuts-air');
  assert.ok(near(line(s, '空气').freq.fold, 1.0), 'air must fold');
  assert.ok(near(s.value, 0.5), `value ${s.value}`);
});

test('range-level MDF: the whole bluff-catcher class defends ~50% to a pot bet', () => {
  const s = byId('range-mdf');
  assert.ok(near(line(s, '抓诈').freq.call, 0.5), `call ${line(s, '抓诈').freq.call}`);
});
