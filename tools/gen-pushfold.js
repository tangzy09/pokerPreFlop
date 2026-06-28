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
const { enforceMonotonic } = require('./monotonic');

const SAMPLES = 4000, SEED = 1234;
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

const data = {
  meta: {
    model: 'no-overcall chip-EV Nash equilibrium', equity: 'Monte-Carlo class equity (combo+board averaged)',
    samples: SAMPLES, seed: SEED, stacks: STACKS_LEGACY, stacks6: STACKS6_LEGACY, seatMap: SEAT_LEGACY, seatMap6: SEAT6,
    exploitability: exploit, exploitability6: exploit6,
    nashAntes: [...ANTES, 'bb'], nashStacks: STACKS_FULL, nashStacksHU: STACKS_HU, nashSeat9: SEAT9, nashSeat6: SEAT6,
  },
  stacks, ring6, calloff, nash,
};
const out = path.join(__dirname, '..', 'js', 'data', 'pushfold.js');
fs.writeFileSync(out,
  `/* AUTO-GENERATED by tools/gen-pushfold.js — do not edit by hand.
   Computed push/fold Nash (${data.meta.model}).
   PUSHFOLD.stacks[d].seats[pos] = 9-max jam freq; ring6[d].seats[pos] = 6-max; calloff[d].btn = BB call vs BTN.
   *.seatsEV[pos] = per-hand EV(bb, vs fold). 段階2: PUSHFOLD.nash[jam9|jam6|calloff|hu][ante][stack][pos]
   = per-hand EV across ante(${ANTES.join('/')}) × stack(${STACKS_FULL[0]}-${STACKS_FULL[STACKS_FULL.length - 1]}) × all positions.
   Regenerate: node tools/gen-pushfold.js */
const PUSHFOLD = ${JSON.stringify(data, null, 1)};
if (typeof module !== 'undefined') module.exports = PUSHFOLD;
`, 'utf8');
console.log('wrote ' + out + '  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
