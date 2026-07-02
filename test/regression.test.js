'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadApp } = require('./load-app');
const { buildSnapshot, SNAP_PATH } = require('./snapshot');

const app = loadApp();
// the data files are canonical Chinese; pin i18n to zh so prose assertions + the
// golden snapshot read the source language (English is purely a display layer).
if (app.setLang) app.setLang('zh');
const { MODES, PACKS, expand, handLabel, combosOf, catName, handFreq, freqNote, confOf } = app;

const approx1 = (s) => Math.abs(s - 1) < 1e-9;
const sumFreq = (f) => Object.values(f).reduce((a, b) => a + b, 0);
const support = (f) => Object.keys(f).filter((k) => f[k] > 0).sort();

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

test('MODES.freq is a valid distribution and matches correct() support', () => {
  for (const [mode, M] of Object.entries(MODES)) {
    for (let b = 0; b < 8; b++) {
      const isR = !!(b & 1), isC = !!(b & 2), isM = !!(b & 4);
      const f = M.freq(isR, isC, isM);
      assert.ok(approx1(sumFreq(f)), `${mode}@${b}: freq sums to ${sumFreq(f)}`);
      for (const k in f) assert.ok(f[k] > 0 && f[k] <= 1, `${mode}@${b}: weight ${k}=${f[k]}`);
      // the safety lock: which actions have weight must equal which are "correct"
      assert.deepEqual(support(f), [...M.correct(isR, isC, isM)].sort(),
        `${mode}@${b}: freq support != correct()`);
    }
  }
});

test('handFreq returns a valid distribution for every spot x 169 hands', () => {
  for (const fmt of Object.keys(PACKS))
    for (const v of Object.keys(PACKS[fmt]))
      for (const t of PACKS[fmt][v])
        for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) {
          const f = handFreq(t, handLabel(r, c));
          assert.ok(approx1(sumFreq(f)), `${fmt}/${v}/${t.name}: sum != 1`);
        }
});

test('every spot has a confidence tag', () => {
  for (const fmt of Object.keys(PACKS))
    for (const v of Object.keys(PACKS[fmt]))
      for (const t of PACKS[fmt][v])
        assert.ok(['precise', 'curated', 'approx'].includes(t.confidence),
          `${fmt}/${v}/${t.name}: bad confidence "${t.confidence}"`);
});

test('computed push spots (8/10/12/15/20bb) loaded as precise with freqTable', () => {
  for (const v of ['d8p', 'd10', 'd12p', 'd15p', 'd20p']) {
    const arr = PACKS.mtt[v];
    assert.ok(arr && arr.length === 5, `${v} should have 5 spots`);
    for (const t of arr) {
      assert.equal(t.confidence, 'precise', `${v}/${t.name}: computed data should have loaded`);
      assert.ok(t.freqTable && Object.keys(t.freqTable).length > 0, `${v}/${t.name}: has freqTable`);
      assert.match(t.src, /可剥削度~[\d.]+bb/, `${v}/${t.name}: src discloses exploitability`);
    }
  }
  // 求解器船运的每手 EV 表(evTable)应挂到全部 precise 推弃档(反馈面板的真 EV 行依赖它)
  for (const v of ['d10', 'hu10', 'p6_10', 'co10']) {
    for (const t of PACKS.mtt[v]) {
      assert.ok(t.evTable && Object.keys(t.evTable).length >= 100, `${v}/${t.name}: evTable missing/thin`);
      assert.ok(['shove', 'call'].includes(t.evAct), `${v}/${t.name}: bad evAct "${t.evAct}"`);
      assert.equal(typeof t.evTable.AA, 'number', `${v}/${t.name}: evTable.AA not a number`);
      assert.ok(t.evTable.AA > 0, `${v}/${t.name}: AA 的 ${t.evAct} 应为 +EV`);
    }
  }
  const sb = (v) => PACKS.mtt[v].find((t) => t.pf === 'SB');
  const utg = (v) => PACKS.mtt[v].find((t) => t.pf === 'UTG');
  // within a stack: SB jams wider than UTG; premiums in, trash out
  assert.ok(sb('d10').union.length > utg('d10').union.length, 'SB wider than UTG');
  assert.ok(utg('d10').R.has('AA') && !utg('d10').R.has('72o'), 'UTG jams AA not 72o');
  // shallower stacks jam wider (pure jam/fold): 8bb widest, 20bb tightest
  assert.ok(sb('d8p').union.length > sb('d20p').union.length, 'SB jams wider at 8bb than 20bb');
});

test('HU push/fold spots (jam + call) loaded as precise from computed Nash', () => {
  for (const v of ['hu10', 'hu15', 'hu20']) {
    const arr = PACKS.mtt[v];
    assert.ok(arr && arr.length === 2, `${v} should have 2 spots (SB jam + BB call)`);
    for (const t of arr) {
      assert.equal(t.confidence, 'precise', `${v}/${t.name}: computed`);
      assert.ok(t.freqTable && Object.keys(t.freqTable).length > 0, `${v}/${t.name}: freqTable`);
      assert.match(t.src, /HU Nash/, `${v}/${t.name}: src says HU`);
    }
    const jam = arr.find((t) => t.huSide === 'jam');     // push mode -> R = shove range
    const call = arr.find((t) => t.huSide === 'call');   // callshove mode -> C = call range
    assert.equal(jam.mode, 'push'); assert.equal(call.mode, 'callshove');
    assert.ok(jam.R.has('AA') && call.C.has('AA'), 'AA both jams and calls');
    assert.ok(jam.union.length > call.union.length, 'SB jams wider than BB calls');
  }
  // deeper stacks: both jam and call tighter
  assert.ok(PACKS.mtt.hu10.find((t) => t.huSide === 'jam').union.length
          > PACKS.mtt.hu20.find((t) => t.huSide === 'jam').union.length, 'HU jam tighter at 20bb');
});

test('UI labels computed spots as precise (real freq) and curated as placeholder', () => {
  const precise = PACKS.mtt.d10.find((t) => t.pf === 'UTG');
  const curated = PACKS.cash['6'][0];
  assert.equal(confOf(precise).txt, 'Nash 博弈论最优');
  assert.equal(confOf(curated).txt, '手搓参考');
  // precise spot shows a computed frequency; curated mix stays a placeholder
  assert.match(freqNote(precise, 'AA', false, false), /计算频率/);
  assert.match(freqNote(curated, 'AA', true, false), /占位/);
});

test('range DSL expand() parses representative tokens', () => {
  assert.deepEqual([...expand('AA')], ['AA']);
  assert.deepEqual([...expand('AKs')], ['AKs']);
  assert.deepEqual([...expand('KQo')], ['KQo']);
  assert.equal(expand('22+').size, 13);          // all pocket pairs
  assert.equal(expand('A2s+').size, 12);          // A2s..AKs
  const r = expand('A2s+');
  assert.ok(r.has('A2s') && r.has('AQs') && !r.has('AKo'));
  // dash 区间的三种标准写法（此前连子区间会静默展开成错误范围）
  assert.deepEqual([...expand('T9s-65s')].sort(), ['65s','76s','87s','98s','T9s'], '同 gap 对角连子区间');
  assert.deepEqual([...expand('K9s-Q9s')].sort(), ['K9s','Q9s'], '同 kicker 高张区间');
  assert.equal(expand('A2s-A9s').size, 8, '同高张 kicker 区间（原行为）');
  // 同点数非法标签必须拒绝（'AAs' 曾生成重复牌组合导致胜率算错）
  assert.equal(expand('AAs').size, 0);
  assert.equal(expand('22o').size, 0);
  assert.equal(expand('AAs+').size, 0);
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
