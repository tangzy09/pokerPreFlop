'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadApp } = require('./load-app');
const { buildSnapshot, SNAP_PATH } = require('./snapshot');

const app = loadApp();
const { MODES, PACKS, expand, handLabel, combosOf, catName } = app;

// ---------- contract invariants (robust to intended range tweaks) ----------

test('every mode used in PACKS has a MODES entry', () => {
  const used = new Set();
  for (const fmt of Object.keys(PACKS))
    for (const v of Object.keys(PACKS[fmt]))
      for (const t of PACKS[fmt][v]) used.add(t.mode);
  for (const mode of used) assert.ok(MODES[mode], `missing MODES["${mode}"]`);
});

test('MODES entries are well-formed and self-consistent', () => {
  for (const [mode, M] of Object.entries(MODES)) {
    assert.ok(Array.isArray(M.actions) && M.actions.length >= 2, `${mode}: actions`);
    const actionKeys = M.actions.map((a) => a[0]);
    const allowed = new Set([...actionKeys, 'fold']);
    // every button has a display name
    for (const k of actionKeys) assert.ok(M.names[k], `${mode}: names["${k}"]`);
    // correct() + cell() valid for all 8 (isR,isC,isM) combos
    for (let b = 0; b < 8; b++) {
      const isR = !!(b & 1), isC = !!(b & 2), isM = !!(b & 4);
      const corr = M.correct(isR, isC, isM);
      assert.ok(Array.isArray(corr) && corr.length >= 1, `${mode}: correct empty @${b}`);
      for (const a of corr)
        assert.ok(allowed.has(a), `${mode}: correct produced unknown action "${a}"`);
      const cell = M.cell(isR, isC, isM);
      assert.equal(typeof cell, 'string');
      assert.ok(cell.length > 0, `${mode}: empty cell @${b}`);
      // whatever category a cell can produce must have a display name
      assert.ok(catName(cell, mode), `${mode}: catName("${cell}") undefined`);
    }
    assert.ok(Array.isArray(M.legend) && M.legend.length >= 2, `${mode}: legend`);
  }
});

test('range DSL expand() parses representative tokens', () => {
  assert.deepEqual([...expand('AA')], ['AA']);
  assert.deepEqual([...expand('AKs')], ['AKs']);
  assert.deepEqual([...expand('KQo')], ['KQo']);
  assert.equal(expand('22+').size, 13);          // all pocket pairs
  assert.equal(expand('A2s+').size, 12);          // A2s..AKs
  const r = expand('A2s+');
  assert.ok(r.has('A2s') && r.has('AQs') && !r.has('AKo'));
});

test('handLabel + combosOf produce canonical forms', () => {
  assert.equal(handLabel(0, 0), 'AA');   // pair
  assert.equal(handLabel(0, 1), 'AKs');  // r<c -> suited
  assert.equal(handLabel(1, 0), 'AKo');  // r>c -> offsuit
  assert.equal(combosOf('AA'), 6);
  assert.equal(combosOf('AKs'), 4);
  assert.equal(combosOf('AKo'), 12);
});

test('PACKS tables carry the fields the engine relies on', () => {
  for (const fmt of Object.keys(PACKS))
    for (const v of Object.keys(PACKS[fmt]))
      for (const t of PACKS[fmt][v]) {
        const where = `${fmt}/${v}/${t.name}`;
        assert.ok(t.mode && t.name && t.who, `${where}: meta`);
        assert.ok(t.R instanceof Set && t.C instanceof Set && t.M instanceof Set, `${where}: R/C/M sets`);
        assert.ok(Array.isArray(t.union), `${where}: union`);
      }
});

// ---------- golden snapshot (catches any unintended logic/range drift) ----------

test('decision + chart snapshot matches golden', () => {
  const actual = buildSnapshot(app);
  if (!fs.existsSync(SNAP_PATH)) {
    assert.fail(`no snapshot at ${SNAP_PATH} — generate it with: npm run test:update`);
  }
  const expected = JSON.parse(fs.readFileSync(SNAP_PATH, 'utf8'));
  // round-trip through JSON so the comparison has the same semantics as the
  // on-disk golden (drops undefined-valued keys; key order is irrelevant)
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected,
    'behaviour changed vs golden snapshot. If intended, run: npm run test:update');
});
