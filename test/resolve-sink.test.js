'use strict';
/*
 * 模式隔离契约(resolve 的数据沉淀):
 *   诊断/复习答题绝不允许污染真实生涯数据。断言是「全景」的——比对整个 STORE 的
 *   序列化(而非逐字段),所以将来任何新增的持久化副作用,只要在诊断里碰了 STORE
 *   就会在这里红,无需记得来补断言。这正是 review 里「复习态泄漏进诊断篡改错题堆」
 *   那类 CONFIRMED bug 的结构性测试网。
 *
 * resolve() 在 load-app 的 vm stub 环境里可完整执行(DOM 全是 Proxy stub),
 * 我们手工装配 G 的一手局面,真实调用 resolve,断言数据面。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { mkStub } = require('./load-app');

// 与 loadApp 相同的方式加载,但额外捕获 resolve/G/STORE 等运行期内部
function loadEngine() {
  const file = path.join(__dirname, '..', 'gto-trainer.html');
  const html = fs.readFileSync(file, 'utf8');
  const srcs = [...html.matchAll(/<script\s+src=["']([^"']+)["']/g)].map((x) => x[1]);
  const code = srcs.map((src) => fs.readFileSync(path.resolve(path.dirname(file), src), 'utf8')).join('\n');
  const stub = mkStub();
  const ctx = {
    Math, JSON, Object, Array, Set, Map, WeakMap, WeakSet, String, Number, Boolean, RegExp,
    Symbol, parseInt, parseFloat, isNaN, console, Date,
    document: stub, window: stub, localStorage: stub, navigator: stub,
    performance: stub, location: stub,
    AudioContext: function () { return stub; }, webkitAudioContext: function () { return stub; },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    addEventListener: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    innerWidth: 390, innerHeight: 780,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code + `;globalThis.__eng={G,STORE,PACKS,MODES,resolve,setLang,setMode,
    _pile:()=>reviewPile, _setPile:(p)=>{reviewPile=p;}};`, ctx, { filename: 'engine.bundle.js' });
  ctx.__eng.setLang('zh');
  return ctx.__eng;
}

// 装配一手可 resolve 的局面(默认 现金6人 UTG open,AA 正解=raise)
function dealHand(E, over = {}) {
  const t = over.t || E.PACKS.cash[6][0];
  Object.assign(E.G, {
    format: over.format || 'cash', variant: over.variant || '6',
    table: t, hand: over.hand || 'AA',
    correct_set: over.correct_set || ['raise'], isMix: !!over.isMix, isEdge: !!over.isEdge,
    over: false, busy: false,
  });
}

// 每个模式测试都从干净会话开始
function freshSession(E) {
  E.setMode('normal');                                 // 模式装配必须走 setMode 单缝(散装布尔=数据路由不生效)
  Object.assign(E.G, {
    diagResults: [], diagSceneKey: 'x',
    hands: 0, correct: 0, combo: 0, best: 0, score: 0, hp: 5, maxhp: 5,
    level: 1, levelMistakes: 0, q: { best: 0, good: 0, inacc: 0, mistake: 0, blunder: 0 },
    ach: new Set(), pendingLevel: false, handNo: 0,
  });
}

// STORE 全景快照(review 模式豁免 STORE.review——错题堆本身就是它要写的)
const snap = (E, omitReview) => {
  const c = JSON.parse(JSON.stringify(E.STORE));
  if (omitReview) delete c.review;
  return JSON.stringify(c);
};

test('diag 模式:resolve 只写 diagResults,STORE 与错题堆逐字节不变', () => {
  const E = loadEngine();
  freshSession(E);
  // 先在 normal 模式产生一点真实数据(有东西可被"污染"才是有效测试)
  dealHand(E); E.resolve('raise', null, false);
  dealHand(E); E.resolve('fold', null, false);          // 一条错题进堆
  const pileBefore = JSON.stringify(E._pile());
  const storeBefore = snap(E, false);
  assert.ok(E._pile().length >= 1, '前置:错题堆应有记录');

  // 切诊断,连答 6 手(对/错/超时混合)
  freshSession(E);
  E.setMode('diag');
  const plays = [['raise', false], ['fold', false], ['raise', false], ['fold', true], ['raise', false], ['fold', false]];
  for (const [c, to] of plays) { dealHand(E); E.resolve(c, null, to); }

  assert.equal(snap(E, false), storeBefore, '诊断答题污染了 STORE(生涯统计/趋势/错题堆持久化…)');
  assert.equal(JSON.stringify(E._pile()), pileBefore, '诊断答题动了内存中的错题堆');
  assert.equal(E.G.diagResults.length, plays.length, 'diagResults 应逐手累积');
  assert.equal(E.G.hp, 5, '诊断不应扣血');
});

test('review 模式:除错题堆自身外 STORE 不变,streak 逻辑生效', () => {
  const E = loadEngine();
  freshSession(E);
  dealHand(E); E.resolve('fold', null, false);          // normal 错一手 → 进堆
  const rec = E._pile()[0];
  assert.ok(rec, '前置:需要一条错题');
  const storeBefore = snap(E, true);                     // 豁免 STORE.review

  freshSession(E);
  E.setMode('review'); E.G.reviewRec = rec; E.G.reviewQueue = []; E.G.reviewCleared = 0;
  dealHand(E); E.resolve('fold', null, false);           // 复习中又答错(该 raise 却 fold)
  assert.equal(snap(E, true), storeBefore, '复习答题污染了错题堆之外的 STORE');
  assert.equal(rec.streak, 0, '复习答错应清零 streak');
  assert.equal(rec.choice, 'fold', '复习答错应更新最新选择');
  assert.equal(E.G.hp, 5, '复习不应扣血');

  dealHand(E); E.resolve('raise', null, false);          // 答对一次
  assert.equal(rec.streak, 1, '复习答对 streak+1');
  assert.equal(snap(E, true), storeBefore, '复习答对也不得碰错题堆之外的 STORE');
});

test('gradeHand 评级纯函数:核心判分规则', () => {
  const { loadApp } = require('./load-app');
  const app = loadApp(); if (app.setLang) app.setLang('zh');
  const g = app.gradeHand;
  const base = { correct: ['raise'], timedOut: false, isMix: false, isEdge: false, freqGraded: false, hitTop: false, hand: 'AA', combo: 0 };
  // 超时:即使弃牌恰好"正确"也永不算对(一致性评分)
  let r = g({ ...base, correct: ['fold'], choice: 'fold', timedOut: true });
  assert.equal(r.ok, false); assert.equal(r.grade, '超时'); assert.equal(r.hpHit, 1); assert.equal(r.combo, 0);
  // PREMIUM 该打却弃 = 漏着扣 2 + monsterFold(成就触发标记)
  r = g({ ...base, choice: 'fold' });
  assert.equal(r.grade, '漏着'); assert.equal(r.hpHit, 2); assert.equal(r.monsterFold, true);
  // 纯正确 = 最佳,连击数学:combo 4→5,mult=1.5,pts=150
  r = g({ ...base, choice: 'raise', combo: 4 });
  assert.equal(r.grade, '最佳'); assert.equal(r.combo, 5); assert.equal(r.pts, 150); assert.equal(r.big, true);
  // 边缘占位混合答对 = 两可(不评高下),85 分档
  r = g({ ...base, choice: 'raise', isMix: true, isEdge: true });
  assert.equal(r.grade, '两可'); assert.equal(r.pts, Math.round(85 * 1.1));
  // precise 混合:选中主频线 = 最佳,次频线 = 好棋
  r = g({ ...base, choice: 'raise', isMix: true, freqGraded: true, hitTop: true });
  assert.equal(r.grade, '最佳');
  r = g({ ...base, correct: ['raise', 'fold'], choice: 'fold', isMix: true, freqGraded: true, hitTop: false });
  assert.equal(r.grade, '好棋');
  // 混合点答错 = 不准
  r = g({ ...base, correct: ['raise', 'call'], choice: 'fold', isMix: true });
  assert.equal(r.grade, '不准'); assert.equal(r.hpHit, 1);
  // 评级桶映射完备:每个可能的 grade 都有 q 桶
  for (const gr of ['最佳', '两可', '好棋', '不准', '失误', '超时', '漏着'])
    assert.ok(app.Q_OF[gr], `Q_OF 缺 ${gr}`);
});

test('normal 模式:生涯统计与趋势逐手累积(阳性对照)', () => {
  const E = loadEngine();
  freshSession(E);
  dealHand(E); E.resolve('raise', null, false);
  dealHand(E); E.resolve('fold', null, false);
  const sk = '现金·6人';
  // vm 内对象跨 realm 原型不同,deepEqual 会误报——用 JSON 值断言
  assert.equal(JSON.stringify(E.STORE.statsBySpot[sk]), '{"h":2,"c":1}');
  assert.equal(E.STORE.trend.length, 1);
  assert.equal(E.STORE.trend[0].h, 2); assert.equal(E.STORE.trend[0].c, 1);
  assert.equal(E._pile().length, 1, '答错应进错题堆');
  assert.equal(E.G.hp, 3, 'AA 该加注却弃 = 漏着,扣 2 血');
  assert.equal(E.G.q.blunder, 1, '漏着计数');
});
