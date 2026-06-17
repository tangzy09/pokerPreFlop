'use strict';
/*
 * Regression coverage for rangeEquityBoard (js/equity.js) — the board-aware equity
 * that powers the calculator's 翻后胜率 mode. River boards (no cards left to deal)
 * are deterministic, so those equities are exact regardless of sample count.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const E = require('../js/equity.js');
const B = (s) => s.split(/\s+/).filter(Boolean).map(E.parseCard);
const rng = () => E.mulberry32(123);

test('river: set of aces beats kings 100% (deterministic full board)', () => {
  const e = E.rangeEquityBoard(['AA'], ['KK'], B('As 7s 2d 9c 3h'), 2000, rng());
  assert.ok(Math.abs(e - 1.0) < 1e-9, `got ${e}`);
});

test('river: board plays for everyone (royal) -> exact tie 0.5', () => {
  const e = E.rangeEquityBoard(['22'], ['33'], B('Ah Kh Qh Jh Th'), 2000, rng());
  assert.ok(Math.abs(e - 0.5) < 1e-9, `got ${e}`);
});

test('flop: an overpair set crushes a lower pair (>88%)', () => {
  const e = E.rangeEquityBoard(['AA'], ['KK'], B('Ac 7s 2d'), 40000, rng());
  assert.ok(e > 0.88, `got ${e}`);
});

test('empty board reduces to a preflop all-in equity in (0,1)', () => {
  const e = E.rangeEquityBoard(['AA'], ['KK'], [], 20000, rng());
  assert.ok(e > 0.7 && e < 0.9, `AA vs KK preflop should be ~0.8, got ${e}`);
});

test('board fully blocking a range returns null (undealable)', () => {
  // hero AA but all four... actually block via board holding 3 aces + villain AA needs the 4th
  const e = E.rangeEquityBoard(['AA'], ['AA'], B('As Ah Ad Kc Qc'), 500, rng());
  assert.strictEqual(e, null);
});

test('bad board length (1-2 cards) is rejected by the parser contract', () => {
  // rangeEquityBoard itself accepts any <=5; the app-layer parser enforces 3/4/5.
  // Here we just confirm a 5-card cap: 6 cards -> null.
  const e = E.rangeEquityBoard(['AA'], ['KK'], B('2c 3c 4c 5c 6c 7c'), 100, rng());
  assert.strictEqual(e, null);
});
