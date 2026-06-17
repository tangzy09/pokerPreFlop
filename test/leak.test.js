'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.js');

const { PACKS, classifyMiss, LEAK_TYPES } = loadApp();
const rec = (t, hand, fmt, variant) => ({ t, hand, fmt, variant });

test('Leak Analyzer classifyMiss buckets misses from spot + hand alone', () => {
  const utg = PACKS.cash[6][0];            // open spot (UTG): raise/mix/fold bands
  // a clear-fold hand played wrong → 太松 (too loose)
  assert.equal(classifyMiss(rec(utg, '72o', 'cash', '6')), 'loose');
  // a pure-raise hand missed → 太紧 (folded a value hand)
  assert.equal(classifyMiss(rec(utg, 'AA', 'cash', '6')), 'tight');
  // a mix/edge hand → 边缘混合
  const edge = [...utg.M][0];
  assert.equal(classifyMiss(rec(utg, edge, 'cash', '6')), 'mix');
  // any ICM-variant miss → icm, regardless of the hand
  assert.equal(classifyMiss(rec(PACKS.mtt.icm[0], 'AA', 'mtt', 'icm')), 'icm');
  // every bucket classifyMiss can return has a display entry
  for (const k of ['loose', 'tight', 'mix', 'icm'])
    assert.ok(LEAK_TYPES[k] && LEAK_TYPES[k].name, `LEAK_TYPES.${k} present`);
});

test('classifyMiss never throws on a malformed record', () => {
  assert.equal(classifyMiss({ t: null, hand: 'AA' }), 'mix');         // missing spot
  assert.equal(classifyMiss({ t: { mode: 'nope' }, hand: 'AA' }), 'mix'); // unknown mode
});
