'use strict';
/*
 * Loads the single-file app (gto-trainer.html) inside Node by:
 *  1. extracting its <script> block,
 *  2. running it in a vm context where every browser/DOM global is a
 *     bulletproof Proxy stub (so the top-level boot code that touches
 *     document/window/localStorage can't throw), and
 *  3. capturing the internal consts/functions we want to test.
 *
 * This is what lets us unit-test the pure logic (MODES, range DSL, charts)
 * without a browser or any dependencies.  Override the target file with the
 * APP_HTML env var.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A Proxy whose every operation yields another callable/iterable Proxy, so any
// chain of DOM calls (document.getElementById('x').children, .forEach, .style…)
// silently succeeds during the app's boot sequence.
function mkStub() {
  const f = function () {};
  return new Proxy(f, {
    apply: () => mkStub(),
    construct: () => mkStub(),
    has: () => true,
    set: () => true,
    deleteProperty: () => true,
    get: (_t, p) => {
      if (p === Symbol.iterator) return function* () {};
      if (p === Symbol.toPrimitive) return () => '';
      if (p === 'toString' || p === 'valueOf') return () => '';
      if (p === 'length') return 0;
      return mkStub();
    },
  });
}

const EXPORTS = [
  'MODES', 'PACKS', 'CORRECT', 'CELL', 'ACT_LABEL', 'CAT_NAME',
  'cellCat', 'catName', 'handLabel', 'expand', 'combosOf',
  'RANKS', 'RIDX', 'PREMIUM',
  'FORMATS', 'VARIANTS', 'GAMETYPES', 'gameOf', 'HANDFILTERS',
];

function loadApp(htmlPath) {
  const file = htmlPath
    || process.env.APP_HTML
    || path.join(__dirname, '..', 'gto-trainer.html');
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error(`no <script> block found in ${file}`);

  const stub = mkStub();
  const ctx = {
    Math, JSON, Object, Array, Set, Map, String, Number, Boolean, RegExp,
    Symbol, parseInt, parseFloat, isNaN, console, Date,
    document: stub, window: stub, localStorage: stub, navigator: stub,
    performance: stub, location: stub,
    AudioContext: function () { return stub; },
    webkitAudioContext: function () { return stub; },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    addEventListener: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    innerWidth: 390, innerHeight: 780,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const capture = `;globalThis.__app={${EXPORTS.join(',')}};`;
  vm.runInContext(m[1] + capture, ctx, { filename: 'gto-trainer.inline.js' });
  return ctx.__app;
}

module.exports = { loadApp, mkStub, EXPORTS };
