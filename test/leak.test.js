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
  for (const k of ['loose', 'tight', 'passive', 'aggro', 'mix', 'icm'])
    assert.ok(LEAK_TYPES[k] && LEAK_TYPES[k].name, `LEAK_TYPES.${k} present`);
});

test('classifyMiss uses the actual choice when present (precise 被动/过激)', () => {
  const def = PACKS.cash[6].find((t) => t.mode === 'defense');   // raise/call/fold spot
  const pureRaise = [...def.R].find((h) => !def.C.has(h) && !def.M.has(h));
  const pureCall = [...def.C].find((h) => !def.R.has(h) && !def.M.has(h));
  assert.ok(pureRaise && pureCall, 'found pure-raise + pure-call hands');
  // should 3-bet but only called → 被动 (passive)
  assert.equal(classifyMiss({ t: def, hand: pureRaise, choice: 'call' }), 'passive');
  // should 3-bet but folded → 太紧 (tight)
  assert.equal(classifyMiss({ t: def, hand: pureRaise, choice: 'fold' }), 'tight');
  // should just call but raised → 过激 (aggro)
  assert.equal(classifyMiss({ t: def, hand: pureCall, choice: 'raise' }), 'aggro');
  // clear-fold hand but played → 太松 (loose), regardless of which play action
  assert.equal(classifyMiss({ t: PACKS.cash[6][0], hand: '72o', choice: 'raise' }), 'loose');
  // no stored choice → falls back to the hand-type heuristic (old data still classifies)
  assert.equal(classifyMiss({ t: def, hand: pureRaise }), 'tight');
});

test('classifyMiss never throws on a malformed record', () => {
  assert.equal(classifyMiss({ t: null, hand: 'AA' }), 'mix');         // missing spot
  assert.equal(classifyMiss({ t: { mode: 'nope' }, hand: 'AA' }), 'mix'); // unknown mode
});
