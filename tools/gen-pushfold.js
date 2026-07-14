'use strict';
/*
 * gen-pushfold.js — compute push/fold Nash and emit it as a plain <script> global.
 *
 * 段階1+2 后的两层数据：
 *   既有(packs 兼容，不要动)：stacks/ring6/calloff = ante=0、原档位/位置的 jam 频率(+seatsEV)
 *   新增 PUSHFOLD.nash = Nash 查询器用，ante × 全 stack × 全 position 的每手 EV(只存 EV)
 *     nash.jam9[ante][stack][pos]   9-max 开局推每手 EV
 *     nash.jam6[ante][stack][pos]   6-max 开局推
 *     nash.calloff[ante][stack]     9-max BB 跟 BTN 全下
 *     nash.hu[ante][stack]={jamEV,callEV}  单挑 SB 推 / BB 跟
 * Run: node tools/gen-pushfold.js   (重算约 1 小时；固定种子，确定性)
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildEqMatrix, solveRing, ringRegret, CLASSES } = require('./pushfold');
const { enforceMonotonic, enforceStackMonotonic } = require('./monotonic');

/* ⚠ SAMPLES 4000 → 25000(2026-07):4000 样本下,一整条 EV≈0 的边缘牌(杂色大牌)会被求解噪声
   打成**纯策略**(20bb CO 的 JTo 直接 freq=1.00),同档的 enforceMonotonic 再沿支配链把 5 手更强
   的牌一起拽到 100% —— 公开的 20bb 推弃图因此是错的。25000 样本下同一手降到 0.35(混合,符合它
   near-indifferent 的身份)。⚠ EV 的排序**不随样本改变**(ATo 恒 -0.14 / JTo 恒 +0.01),那不是噪声,
   是模型本身的局限:solveRing 算被跟概率时不做去牌(`pCall = m/totW`,与全下者手牌无关),所以杂色 A
   拿不到「手握一张 A 砍掉对手 AA/AK/AQ/AJ 组合」的阻断牌功劳,被系统性低估。要根治得把 pCall 改成
   按全下者手牌条件化(真去牌)——那是另一件事,别在这里假装已经解决。 */
const SAMPLES = 25000, SEED = 1234;
const SOLVE = { iters: 8000, damp: 0.02 };            // legacy 用（保 snapshot 不变）
const SOLVE_NASH = { iters: 4000, damp: 0.03 };       // nash 查询用（精度足够，提速）
const ANTES = [0, 0.125];                                   // 段階2: ante 档（竞品 12.5%）
const STACKS_FULL = []; for (let s = 5; s <= 20; s++) STACKS_FULL.push(s);   // 5..20
const STACKS_HU = [5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25];
const SEAT9 = { UTG: 0, UTG1: 1, MP1: 2, MP2: 3, MP3: 4, CO: 5, BTN: 6, SB: 7 }; // 9-max (BB=8)
const SEAT6 = { UTG: 0, HJ: 1, CO: 2, BTN: 3, SB: 4 };                          // 6-max (BB=5)
// 既有(packs 兼容)的档位/位置
const STACKS_LEGACY = [8, 10, 12, 15, 20], STACKS6_LEGACY = [10, 15, 20], STACKS_CO_LEGACY = [10, 15, 20];
const SEAT_LEGACY = { UTG: 0, MP: 3, CO: 5, BTN: 6, SB: 7 };

const round = (x) => Math.round(x * 1000) / 1000;
const trim = (raw) => { const m = enforceMonotonic(raw); const o = {}; for (const h of CLASSES) if (m[h] > 0) o[h] = round(m[h]); return o; };

console.log(`building ${CLASSES.length}x${CLASSES.length} equity matrix (samples=${SAMPLES})…`);
let t0 = Date.now();
const EQ = buildEqMatrix(SAMPLES, SEED);
console.log(`  matrix done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---- 新增 nash: ante × 全 stack × 全 position 的每手 EV ----
const nash = { jam9: {}, jam6: {}, calloff: {}, hu: {} };
for (const ante of ANTES) {
  const a = String(ante);
  nash.jam9[a] = {}; nash.calloff[a] = {}; nash.jam6[a] = {}; nash.hu[a] = {};
  const ts = Date.now();
  for (const S of STACKS_FULL) {
    const r9 = solveRing(S, EQ, { nSeats: 9, ante, ...SOLVE_NASH });
    const o9 = {}; for (const [n, idx] of Object.entries(SEAT9)) o9[n] = r9.seats[idx].jamEV;
    nash.jam9[a][S] = o9;
    nash.calloff[a][S] = r9.seats[SEAT9.BTN].callerEV[8];     // BB(8) call vs BTN jam
    const r6 = solveRing(S, EQ, { nSeats: 6, ante, ...SOLVE_NASH });
    const o6 = {}; for (const [n, idx] of Object.entries(SEAT6)) o6[n] = r6.seats[idx].jamEV;
    nash.jam6[a][S] = o6;
    process.stdout.write('.');
  }
  for (const S of STACKS_HU) {
    const hu = solveRing(S, EQ, { nSeats: 2, ante, ...SOLVE_NASH });
    nash.hu[a][S] = { jamEV: hu.seats[0].jamEV, callEV: hu.seats[0].callerEV[1] };
  }
  console.log(` ante=${ante} done (${((Date.now() - ts) / 1000).toFixed(0)}s)`);
}

// ---- bb ante（大盲前注）：底池总前注固定 = 1bb，按桌上人数均摊到每人 = 1/nSeats ----
{
  const a = 'bb';
  nash.jam9[a] = {}; nash.calloff[a] = {}; nash.jam6[a] = {}; nash.hu[a] = {};
  const ts = Date.now();
  for (const S of STACKS_FULL) {
    const r9 = solveRing(S, EQ, { nSeats: 9, ante: 1 / 9, ...SOLVE_NASH });
    const o9 = {}; for (const [n, idx] of Object.entries(SEAT9)) o9[n] = r9.seats[idx].jamEV;
    nash.jam9[a][S] = o9;
    nash.calloff[a][S] = r9.seats[SEAT9.BTN].callerEV[8];
    const r6 = solveRing(S, EQ, { nSeats: 6, ante: 1 / 6, ...SOLVE_NASH });
    const o6 = {}; for (const [n, idx] of Object.entries(SEAT6)) o6[n] = r6.seats[idx].jamEV;
    nash.jam6[a][S] = o6;
    process.stdout.write('.');
  }
  for (const S of STACKS_HU) {
    const hu = solveRing(S, EQ, { nSeats: 2, ante: 1 / 2, ...SOLVE_NASH });
    nash.hu[a][S] = { jamEV: hu.seats[0].jamEV, callEV: hu.seats[0].callerEV[1] };
  }
  console.log(` ante=bb done (${((Date.now() - ts) / 1000).toFixed(0)}s)`);
}

// ---- 既有 stacks/ring6/calloff (frequencies, packs 兼容, ante=0, 原档) ----
const stacks = {}, exploit = {}, calloff = {};
for (const S of STACKS_LEGACY) {
  const ring = solveRing(S, EQ, { nSeats: 9, ante: 0, ...SOLVE });
  exploit[S] = round(ringRegret(S, EQ, ring, 0).maxRegret);
  const seats = {}, seatsEV = {};
  for (const [n, idx] of Object.entries(SEAT_LEGACY)) { seats[n] = trim(ring.seats[idx].jam); seatsEV[n] = ring.seats[idx].jamEV; }
  stacks[S] = { seats, seatsEV };
  if (STACKS_CO_LEGACY.includes(S)) calloff[S] = { btn: trim(ring.seats[SEAT_LEGACY.BTN].callers[8]), btnEV: ring.seats[SEAT_LEGACY.BTN].callerEV[8] };
}
const ring6 = {}, exploit6 = {};
for (const S of STACKS6_LEGACY) {
  const ring = solveRing(S, EQ, { nSeats: 6, ante: 0, ...SOLVE });
  exploit6[S] = round(ringRegret(S, EQ, ring, 0).maxRegret);
  const seats = {}, seatsEV = {};
  for (const [n, idx] of Object.entries(SEAT6)) { seats[n] = trim(ring.seats[idx].jam); seatsEV[n] = ring.seats[idx].jamEV; }
  ring6[S] = { seats, seatsEV };
}

/* 跨档单调性:同一座位、同一手牌的全下频率必须随筹码变深而非递增(筹码越深,被跟时输得越多,
   奖品还是那些盲注)。enforceMonotonic 只管同档内的牌力支配,管不到这一层 —— 20bb CO 的
   反向凸起就是从这个缝里漏出去的。 */
{
  const j9 = enforceStackMonotonic(Object.fromEntries(STACKS_LEGACY.map((S) => [S, stacks[S].seats])));
  for (const S of STACKS_LEGACY) stacks[S].seats = j9[S];
  const j6 = enforceStackMonotonic(Object.fromEntries(STACKS6_LEGACY.map((S) => [S, ring6[S].seats])));
  for (const S of STACKS6_LEGACY) ring6[S].seats = j6[S];
  // 跟注全下的范围同理随深度收紧(价格变差)
  const co = enforceStackMonotonic(Object.fromEntries(STACKS_CO_LEGACY.map((S) => [S, { btn: calloff[S].btn }])));
  for (const S of STACKS_CO_LEGACY) calloff[S].btn = co[S].btn;
}

const data = {
  meta: {
    model: 'no-overcall chip-EV Nash equilibrium', equity: 'Monte-Carlo class equity (combo+board averaged)',
    samples: SAMPLES, seed: SEED, stacks: STACKS_LEGACY, stacks6: STACKS6_LEGACY, seatMap: SEAT_LEGACY, seatMap6: SEAT6,
    exploitability: exploit, exploitability6: exploit6,
    nashAntes: [...ANTES, 'bb'], nashStacks: STACKS_FULL, nashStacksHU: STACKS_HU, nashSeat9: SEAT9, nashSeat6: SEAT6,
  },
  stacks, ring6, calloff,          // nash 段单独写 pushfold-nash.js:2.4MB 只有 Nash 图表页用,
};                                 // 不随首屏 <script> 解析,openNash() 首次打开时懒加载
const out = path.join(__dirname, '..', 'js', 'data', 'pushfold.js');
fs.writeFileSync(out,
  `/* AUTO-GENERATED by tools/gen-pushfold.js — do not edit by hand.
   Computed push/fold Nash (${data.meta.model}).
   PUSHFOLD.stacks[d].seats[pos] = 9-max jam freq; ring6[d].seats[pos] = 6-max; calloff[d].btn = BB call vs BTN.
   *.seatsEV[pos] = per-hand EV(bb, vs fold). PUSHFOLD.nash(Nash 查询器用,~2.4MB)拆在
   pushfold-nash.js,由 openNash() 首次打开 Nash 图表时懒加载,不随首屏解析。
   Regenerate: node tools/gen-pushfold.js */
const PUSHFOLD = ${JSON.stringify(data, null, 1)};
if (typeof module !== 'undefined') module.exports = PUSHFOLD;
`, 'utf8');
console.log('wrote ' + out + '  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
const outNash = path.join(__dirname, '..', 'js', 'data', 'pushfold-nash.js');
fs.writeFileSync(outNash,
  `/* AUTO-GENERATED by tools/gen-pushfold.js — do not edit by hand.
   PUSHFOLD.nash = Nash 查询器数据(ante(${ANTES.join('/')}/bb) × stack(${STACKS_FULL[0]}-${STACKS_FULL[STACKS_FULL.length - 1]}) × position 每手 EV,~2.4MB)。
   不随首屏加载:openNash() 首次打开 Nash 图表时动态 <script> 注入(file:// 亦可)。
   Regenerate: node tools/gen-pushfold.js */
PUSHFOLD.nash = ${JSON.stringify(nash, null, 1)};
`, 'utf8');
console.log('wrote ' + outNash + '  (' + (fs.statSync(outNash).size / 1024).toFixed(0) + ' KB)');
