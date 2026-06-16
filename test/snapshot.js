'use strict';
/*
 * Builds a deterministic golden snapshot of all behaviour driven by MODES +
 * the range data, so any unintended change to decision logic, chart
 * categories, action labels or the ranges themselves is caught.
 *
 * Intended changes: regenerate with `npm run test:update`.
 */
const path = require('node:path');

const SNAP_PATH = path.join(__dirname, '__snapshots__', 'regression.snap.json');

const CATS = ['raise', 'shove', 'threebet', 'call', 'mix', 'mixjam',
  'edge-raise', 'edge-shove', 'edge-call', 'fold'];

function all169(handLabel) {
  const h = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) h.push(handLabel(r, c));
  return h;
}

function buildSnapshot(app) {
  const { MODES, PACKS, cellCat, catName, handLabel } = app;
  const hands = all169(handLabel);
  const snap = { modes: {}, charts: {} };

  // MODES: actions, answer names, the full decision + cell matrices, catNames
  for (const mode of Object.keys(MODES)) {
    const M = MODES[mode];
    const e = { actions: M.actions.map((a) => a[0]), names: M.names,
      decision: {}, cell: {}, freq: {}, catName: {} };
    for (let b = 0; b < 8; b++) {
      const isR = !!(b & 1), isC = !!(b & 2), isM = !!(b & 4);
      const k = `R${+isR}C${+isC}M${+isM}`;
      e.decision[k] = M.correct(isR, isC, isM);
      e.cell[k] = M.cell(isR, isC, isM);
      e.freq[k] = M.freq(isR, isC, isM);
    }
    // only record categories this mode actually names (skip undefined so the
    // snapshot is JSON-stable — JSON.stringify drops undefined values)
    for (const cat of CATS) {
      const n = catName(cat, mode);
      if (n !== undefined) e.catName[cat] = n;
    }
    snap.modes[mode] = e;
  }

  // Charts: every spot's non-fold hand -> category (folds omitted to stay compact)
  for (const fmt of Object.keys(PACKS)) {
    for (const v of Object.keys(PACKS[fmt])) {
      PACKS[fmt][v].forEach((t, i) => {
        const cats = {};
        for (const h of hands) {
          const cat = cellCat(t, h);
          if (cat !== 'fold') cats[h] = cat;
        }
        snap.charts[`${fmt}/${v}/${i}:${t.name}`] = cats;
      });
    }
  }
  return snap;
}

module.exports = { buildSnapshot, SNAP_PATH };
