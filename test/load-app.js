'use strict';
/*
 * Loads the app inside Node by:
 *  1. reading gto-trainer.html and collecting its <script src="js/..."> files
 *     in load order (the same order the browser uses),
 *  2. concatenating them and running them in one vm context where every
 *     browser/DOM global is a bulletproof Proxy stub (so the top-level boot
 *     code that touches document/window/localStorage can't throw) — this
 *     reproduces the browser's shared global scope across classic scripts, and
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
  'MODES', 'PACKS', 'CORRECT', 'CELL', 'FREQ', 'ACT_LABEL', 'CAT_NAME',
  'cellCat', 'catName', 'handFreq', 'normFreq', 'freqNote', 'confOf', 'handLabel', 'expand', 'combosOf',
  'RANKS', 'RIDX', 'PREMIUM',
  'FORMATS', 'VARIANTS', 'GAMETYPES', 'gameOf', 'HANDFILTERS',
  'classifyMiss', 'LEAK_TYPES',
  'handFamily', 'FAMILIES', 'FAM_COARSE', 'famCoarse', 'smartOrder',
  'L', 'tr', 'setLang', 'curLang',
  'coachPlanDays', 'coachScenes', 'coachAggregate', 'coachVerdict', 'coachBuildPlan',
  'coachHandsForMinutes', 'COACH_MIN_SAMPLE', 'COACH_FAM_MIN', 'coachRightOf',
  'coachBuildDiagQueue', 'coachApplyRecheck', 'COACH_RECHECK_HANDS', 'COACH_RECHECK_PASS',
  'tableModel', 'tablePlayers', 'posKey', 'POS_RING',
  'gradeHand', 'Q_OF',
];

function loadApp(htmlPath) {
  const file = htmlPath
    || process.env.APP_HTML
    || path.join(__dirname, '..', 'gto-trainer.html');
  const html = fs.readFileSync(file, 'utf8');
  const baseDir = path.dirname(file);

  // collect external scripts in order; fall back to a legacy inline block
  const srcs = [...html.matchAll(/<script\s+src=["']([^"']+)["']/g)].map((x) => x[1]);
  let code;
  if (srcs.length) {
    code = srcs.map((src) => {
      const p = path.resolve(baseDir, src);
      return `\n// ===== ${src} =====\n` + fs.readFileSync(p, 'utf8');
    }).join('\n');
  } else {
    const m = html.match(/<script>([\s\S]*)<\/script>/);
    if (!m) throw new Error(`no <script src> tags or inline <script> in ${file}`);
    code = m[1];
  }

  const stub = mkStub();
  const ctx = {
    Math, JSON, Object, Array, Set, Map, WeakMap, WeakSet, String, Number, Boolean, RegExp,
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

  // 防御式捕获:逐个 try 取,vm 作用域里未声明的名字(尚未实现的函数)跳过而非抛 ReferenceError。
  const capture = `;globalThis.__app={};` + EXPORTS.map((n) => `try{globalThis.__app[${JSON.stringify(n)}]=${n};}catch(e){}`).join('');
  vm.runInContext(code + capture, ctx, { filename: 'gto-trainer.bundle.js' });
  return ctx.__app;
}

module.exports = { loadApp, mkStub, EXPORTS };
