/* pushfold-invariants.test.js — 推弃数据的领域不变量锁。
 *
 * 由来:20bb 的 CO 行曾经推得比 15bb 还宽(KJo/QJo/KTo/QTo/JTo 在 15bb 推 0.26、20bb 推 1.00),
 * 也就是「筹码越深、推得越宽」——方向是反的。这个错在 app 里公开展示了几个月没人发现,
 * 因为 monotonic.js 只查**同一档之内**的牌力支配,从不跨档比较。
 * 程序化落地页会把这类数据错误放大成公开的「权威图表」,所以把不变量钉成测试。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/data/pushfold.js', 'js/data/hu-pushfold.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
vm.runInContext('globalThis.__o={PUSHFOLD,HU_PUSHFOLD};', ctx);
const { PUSHFOLD, HU_PUSHFOLD } = ctx.__o;

const combos = (h) => (h.length === 2 ? 6 : h.endsWith('s') ? 4 : 12);
const pct = (t) => {
  let c = 0;
  for (const h in t) c += combos(h) * t[h];
  return (c / 1326) * 100;
};

/* 不变量:筹码越深,被跟时输得越多,赢到的还是那些盲注 → 全下范围只会更紧,不会更宽。 */
function assertNonIncreasing(label, bySt) {
  const stacks = Object.keys(bySt).map(Number).sort((a, b) => a - b);
  for (let i = 1; i < stacks.length; i++) {
    const S = stacks[i], prev = stacks[i - 1];
    // ① 整体宽度非递增(留 0.5 个点的容差给求解噪声)
    assert.ok(
      pct(bySt[S]) <= pct(bySt[prev]) + 0.5,
      `${label}: ${S}bb 推 ${pct(bySt[S]).toFixed(1)}% > ${prev}bb 的 ${pct(bySt[prev]).toFixed(1)}% —— 筹码越深推得越宽,方向反了`
    );
    // ② 逐手非递增:更浅档没推的牌,更深档不该推
    for (const h of Object.keys(bySt[S])) {
      const up = bySt[prev][h] || 0;
      assert.ok(
        bySt[S][h] <= up + 1e-9,
        `${label}: ${h} 在 ${S}bb 推 ${bySt[S][h]},在更浅的 ${prev}bb 却只推 ${up}`
      );
    }
  }
}

test('9 人桌推弃:每个位置的全下范围随筹码变深单调收紧', () => {
  const stacks = Object.keys(PUSHFOLD.stacks);
  for (const pos of Object.keys(PUSHFOLD.stacks[stacks[0]].seats)) {
    assertNonIncreasing(`9max ${pos}`, Object.fromEntries(stacks.map((S) => [S, PUSHFOLD.stacks[S].seats[pos]])));
  }
});

test('6 人桌推弃:每个位置的全下范围随筹码变深单调收紧', () => {
  const stacks = Object.keys(PUSHFOLD.ring6);
  for (const pos of Object.keys(PUSHFOLD.ring6[stacks[0]].seats)) {
    assertNonIncreasing(`6max ${pos}`, Object.fromEntries(stacks.map((S) => [S, PUSHFOLD.ring6[S].seats[pos]])));
  }
});

test('大盲跟注全下:范围随筹码变深单调收紧(价格越来越差)', () => {
  const stacks = Object.keys(PUSHFOLD.calloff);
  assertNonIncreasing('calloff BTN', Object.fromEntries(stacks.map((S) => [S, PUSHFOLD.calloff[S].btn])));
});

test('单挑推弃:SB 全下范围与 BB 跟注范围都随筹码变深单调收紧', () => {
  const stacks = HU_PUSHFOLD.meta.stacks;
  assertNonIncreasing('HU SB jam', Object.fromEntries(stacks.map((S) => [S, HU_PUSHFOLD.stacks[S].jam])));
  assertNonIncreasing('HU BB call', Object.fromEntries(stacks.map((S) => [S, HU_PUSHFOLD.stacks[S].call])));
});

/* 同档之内的牌力支配单调性(enforceMonotonic 的职责),防它哪天被绕过 */
test('同一档内:被支配的牌不得比支配它的牌推得更频繁', () => {
  const RANK = 'AKQJT98765432';
  const parse = (h) => (h.length === 2
    ? { t: 'p', hi: RANK.indexOf(h[0]), lo: RANK.indexOf(h[1]) }
    : { t: h[2], hi: RANK.indexOf(h[0]), lo: RANK.indexOf(h[1]) });
  const dominates = (A, B) => A.t === B.t && A.hi <= B.hi && A.lo <= B.lo;
  const check = (label, t) => {
    const hands = Object.keys(t);
    for (const a of hands) for (const b of hands) {
      if (a === b) continue;
      if (dominates(parse(a), parse(b))) {
        assert.ok(t[a] >= t[b] - 1e-9, `${label}: ${a}(${t[a]}) 支配 ${b}(${t[b]}) 却推得更少`);
      }
    }
  };
  for (const S of Object.keys(PUSHFOLD.stacks))
    for (const pos of Object.keys(PUSHFOLD.stacks[S].seats)) check(`9max ${S}bb ${pos}`, PUSHFOLD.stacks[S].seats[pos]);
  for (const S of HU_PUSHFOLD.meta.stacks) check(`HU ${S}bb jam`, HU_PUSHFOLD.stacks[S].jam);
});
