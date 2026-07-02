'use strict';
/*
 * 手牌族(handFamily)回归:诊断/漏洞分析的手型维度地基。
 *  1) 守恒:全 169 手都落进 FAMILIES 里存在的族,各族计数与设计定稿一致(小金快照);
 *  2) 粗族:每个细族的 coarse 都在 FAM_COARSE,7 粗族计数 13/12/12/12/16/44/60;
 *  3) 点检:代表手 → 预期族;
 *  4) smartOrder:weak 恒在最前;famSet 命中的手排非命中前;无 famSet 时等价旧行为(weak→rest)。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app.js');

const app = loadApp();
const { handFamily, FAMILIES, FAM_COARSE, famCoarse, smartOrder, RANKS, handLabel } = app;

// 全 169 canonical 手
function all169() {
  const out = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) out.push(handLabel(i, j));
  return [...new Set(out)];
}

test('handFamily:169 手守恒 + 各族计数与设计一致', () => {
  const hands = all169();
  assert.strictEqual(hands.length, 169);
  const count = {};
  hands.forEach((h) => {
    const f = handFamily(h);
    assert.ok(FAMILIES[f], `${h} → ${f} 不在 FAMILIES`);
    count[f] = (count[f] || 0) + 1;
  });
  // 设计定稿的族计数(改分桶规则须同步改这里 + 设计文档)
  assert.deepStrictEqual(count, {
    pp_big: 5, pp_mid: 4, pp_small: 4,
    axs_bw: 4, axs_mid: 4, axs_wheel: 4,
    axo_bw: 4, axo_lo: 8,
    bw_s: 6, bw_o: 6,
    sc: 8, sg: 8,
    kqx_s: 16, sx_lo: 28,
    kqx_o: 16, off_conn: 8, off_lo: 36,
  });
});

test('粗族:coarse 映射齐全,7 粗族计数正确', () => {
  Object.values(FAMILIES).forEach((f) => assert.ok(FAM_COARSE[f.coarse], `coarse ${f.coarse} 不在 FAM_COARSE`));
  const cc = {};
  all169().forEach((h) => { const c = famCoarse(h); cc[c] = (cc[c] || 0) + 1; });
  assert.deepStrictEqual(cc, { pp: 13, ax_s: 12, ax_o: 12, bw: 12, sc: 16, sx_lo: 44, off: 60 });
});

test('handFamily:代表手点检', () => {
  const expect = {
    AA: 'pp_big', TT: 'pp_big', 99: 'pp_mid', 55: 'pp_small', 22: 'pp_small',
    AKs: 'axs_bw', ATs: 'axs_bw', A9s: 'axs_mid', A5s: 'axs_wheel', A2s: 'axs_wheel',
    AKo: 'axo_bw', AJo: 'axo_bw', A9o: 'axo_lo', A2o: 'axo_lo',
    KQs: 'bw_s', JTs: 'bw_s', KQo: 'bw_o', JTo: 'bw_o',
    T9s: 'sc', '32s': 'sc', J9s: 'sg', '42s': 'sg',
    K9s: 'kqx_s', Q2s: 'kqx_s', '98s': 'sc', J8s: 'sx_lo', '52s': 'sx_lo',
    K9o: 'kqx_o', Q5o: 'kqx_o', T9o: 'off_conn', '72o': 'off_lo',
  };
  Object.keys(expect).forEach((h) => assert.strictEqual(handFamily(h), expect[h], `${h} 应为 ${expect[h]},实际 ${handFamily(h)}`));
});

test('smartOrder:weak > 目标族 > 其余;无 famSet 等价旧行为', () => {
  const mk = (hand, weak) => ({ hand, weak: !!weak });
  const cands = [mk('72o'), mk('A5s'), mk('T9s', true), mk('KQo'), mk('A2s'), mk('88', true)];
  // famSet 指向同花A(ax_s):A5s/A2s 属于目标族
  const ordered = smartOrder(cands.slice(), new Set(['ax_s']));
  assert.strictEqual(ordered.length, cands.length);
  const pri = (x) => x.weak ? 0 : (famCoarse(x.hand) === 'ax_s' ? 1 : 2);
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(pri(ordered[i - 1]) <= pri(ordered[i]),
      `优先级乱序:${ordered[i - 1].hand}(${pri(ordered[i - 1])}) 在 ${ordered[i].hand}(${pri(ordered[i])}) 前`);
  }
  // weak 恒在最前两位(2 个 weak)
  assert.ok(ordered[0].weak && ordered[1].weak);
  // 无 famSet:weak 全在非 weak 前(旧行为)
  const plain = smartOrder(cands.slice(), null);
  const firstNonWeak = plain.findIndex((x) => !x.weak);
  assert.ok(plain.slice(0, firstNonWeak).every((x) => x.weak));
  assert.ok(plain.slice(firstNonWeak).every((x) => !x.weak));
});
