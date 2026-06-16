'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCard, evaluate7, comboCards, equityExact, rangeCombos, rangeEquity, mulberry32 } = require('../js/equity');

const ev = (...cs) => evaluate7(cs.map(parseCard));

test('evaluator orders hand categories correctly', () => {
  const royal = ev('As', 'Ks', 'Qs', 'Js', 'Ts', '2h', '3d');
  const quads = ev('Ah', 'Ad', 'Ac', 'As', 'Kd', '2h', '3d');
  const boat  = ev('Ah', 'Ad', 'Ac', 'Kd', 'Ks', '2h', '7d');
  const flush = ev('Ah', 'Jh', '9h', '5h', '2h', 'Kd', 'Qc');
  const strt  = ev('9h', '8d', '7c', '6s', '5h', '2d', 'Ah');
  const trips = ev('Ah', 'Ad', 'Ac', 'Kd', 'Qs', '2h', '7d');
  const twoP  = ev('Ah', 'Ad', 'Kc', 'Kd', 'Qs', '2h', '7d');
  const pair  = ev('Ah', 'Ad', 'Kc', 'Qd', 'Js', '2h', '7d');
  const high  = ev('Ah', 'Kd', 'Qc', 'Jd', '9s', '2h', '7d');
  const order = [royal, quads, boat, flush, strt, trips, twoP, pair, high];
  for (let i = 1; i < order.length; i++)
    assert.ok(order[i - 1] > order[i], `rank order broke at index ${i}`);
});

test('evaluator recognizes the wheel (A-2-3-4-5) as a straight', () => {
  const wheel = ev('Ah', '2d', '3c', '4s', '5h', 'Kd', 'Qc'); // 5-high straight
  const pairAces = ev('Ah', 'Ad', 'Kc', 'Qd', 'Js', '9h', '7d');
  assert.ok(wheel > pairAces, 'wheel should beat a pair');
  const sixHigh = ev('2h', '3d', '4c', '5s', '6h', 'Kd', 'Qc');
  assert.ok(sixHigh > wheel, '6-high straight should beat the wheel');
});

test('equityExact stays in [0,1] and is symmetric (exactly 0.5)', () => {
  const e1 = equityExact([parseCard('Ah'), parseCard('Kh')], [parseCard('As'), parseCard('Ks')]);
  assert.equal(e1, 0.5, 'AhKh vs AsKs must be exactly 0.5 by suit symmetry');
  const e2 = equityExact([parseCard('Ac'), parseCard('Ad')], [parseCard('Ah'), parseCard('As')]);
  assert.equal(e2, 0.5, 'AcAd vs AhAs must be exactly 0.5 by suit symmetry');
});

test('known matchups land in the expected bands', () => {
  const aaVsKk = equityExact([parseCard('Ah'), parseCard('Ad')], [parseCard('Ks'), parseCard('Kc')]);
  assert.ok(aaVsKk > 0.79 && aaVsKk < 0.84, `AA vs KK = ${aaVsKk}`);
  const race = equityExact([parseCard('Ah'), parseCard('Ks')], [parseCard('2c'), parseCard('2d')]);
  assert.ok(race > 0.44 && race < 0.52, `AKo vs 22 = ${race}`);
  const dom = equityExact([parseCard('Ah'), parseCard('Kd')], [parseCard('Ac'), parseCard('Qd')]);
  assert.ok(dom > 0.69 && dom < 0.76, `AK vs AQ = ${dom}`);
});

test('comboCards yields the right number of combinations', () => {
  assert.equal(comboCards('AA').length, 6);
  assert.equal(comboCards('AKs').length, 4);
  assert.equal(comboCards('AKo').length, 12);
  // no card appears twice within a combo
  for (const label of ['AA', 'AKs', 'AKo'])
    for (const [a, b] of comboCards(label)) assert.notEqual(a, b);
});

test('rangeCombos is combo-weighted and rangeEquity matches known matchups', () => {
  assert.equal(rangeCombos(['AA', 'AKo', 'AKs']).length, 6 + 12 + 4); // weighted, not 3
  const rng = mulberry32(0x5eed);
  // single-hand "ranges" reproduce the pairwise equity within MC error (~±1%)
  const aaVsKk = rangeEquity(['AA'], ['KK'], 40000, rng);
  assert.ok(aaVsKk > 0.79 && aaVsKk < 0.84, `AA vs KK = ${aaVsKk}`);
  // a dominating range should be a clear favourite
  const dom = rangeEquity(['QQ+', 'AKs', 'AKo'], ['TT', 'JJ', 'AQs', 'AQo'], 40000, rng);
  assert.ok(dom > 0.6 && dom < 0.78, `QQ+/AK vs JJ-/AQ = ${dom}`);
  // symmetric ranges must be ~50/50
  const mirror = rangeEquity(['AKs'], ['AKs'], 20000, rng);
  assert.ok(mirror > 0.47 && mirror < 0.53, `AKs vs AKs = ${mirror}`);
  // disjoint-but-blocked edge case still returns a number
  assert.equal(typeof rangeEquity(['AA'], ['AA'], 5000, rng), 'number');
});
