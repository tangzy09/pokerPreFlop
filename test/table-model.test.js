'use strict';
/*
 * 训练牌桌可视化(tableModel)的座位契约:
 *  1. 完备性——非推弃/HU/calloff 的 spot 必须带结构化 heroPos(需要对手的模式还要 vilPos);
 *     推弃必须带 pf/pf6,HU 带 huStack,calloff 带 calloff。牌桌显示不允许再依赖
 *     从中文文案正则猜位置(posKey 只是缺字段旧数据的兜底)。新加 spot 忘写字段 → 这里红。
 *  2. 合法性——heroPos/vilPos 必须属于该 variant 人数的 POS_RING,hero 不能与 vil 重叠。
 *     6 人桌标 MP、9 人桌标 HJ 写错等在这里被抓住,而不是渲染成错位的牌桌。
 *  3. 输出一致——tableModel 的 hero 座位 == heroPos 字段;有 vilPos 时,每个 vil 都真实
 *     出现在桌面且下了注(字段没有被解析兜底悄悄覆盖)。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app');

const app = loadApp();
if (app.setLang) app.setLang('zh');
const { PACKS, tableModel, tablePlayers, POS_RING } = app;

// 需要 vilPos 的模式(桌上有对手已下注):defense/face3b/face4b/squeeze + coldcall(整个 format)
const NEEDS_VIL = new Set(['defense', 'face3b', 'face4b', 'squeeze']);

test('每个 spot 都有结构化座位来源(heroPos 或 pf/pf6/huStack/calloff)', () => {
  for (const fmt of Object.keys(PACKS))
    for (const v of Object.keys(PACKS[fmt]))
      for (const t of PACKS[fmt][v]) {
        const where = `${fmt}/${v}/${t.name}`;
        const structured = t.heroPos || t.pf || t.pf6 || t.huStack != null || t.calloff;
        assert.ok(structured, `${where}: 缺结构化座位字段(heroPos / pf / pf6 / huStack / calloff)`);
        if (t.heroPos && (NEEDS_VIL.has(t.mode) || fmt === 'coldcall'))
          assert.ok(t.vilPos != null, `${where}: ${t.mode} 模式需要 vilPos(对手座位)`);
        if (t.mode === 'squeeze')
          assert.ok(Array.isArray(t.vilPos) && t.vilPos.length === 2,
            `${where}: 挤压需要 vilPos=[开局者,跟注者] 两人`);
      }
});

test('heroPos/vilPos 合法:属于该人数的座位环,且互不重叠', () => {
  for (const fmt of Object.keys(PACKS))
    for (const v of Object.keys(PACKS[fmt]))
      for (const t of PACKS[fmt][v]) {
        if (!t.heroPos) continue;
        const where = `${fmt}/${v}/${t.name}`;
        const ring = POS_RING[tablePlayers(fmt, v)];
        assert.ok(ring.includes(t.heroPos), `${where}: heroPos "${t.heroPos}" 不在 ${ring.length} 人座位环`);
        const vils = t.vilPos == null ? [] : [].concat(t.vilPos);
        for (const p of vils) {
          assert.ok(ring.includes(p), `${where}: vilPos "${p}" 不在座位环`);
          assert.notEqual(p, t.heroPos, `${where}: 对手座位与英雄重叠`);
        }
      }
});

test('tableModel 输出忠实于字段:hero 座位一致,vil 都在桌上且已下注', () => {
  for (const fmt of Object.keys(PACKS))
    for (const v of Object.keys(PACKS[fmt]))
      for (const t of PACKS[fmt][v]) {
        const where = `${fmt}/${v}/${t.name}`;
        const m = tableModel(t, fmt, v);
        const hero = m.seats.find(s => s.hero);
        assert.ok(hero, `${where}: 没有英雄座位`);
        if (t.heroPos) assert.equal(hero.pos, t.heroPos, `${where}: hero 渲染为 ${hero.pos}`);
        const vils = t.vilPos == null ? [] : [].concat(t.vilPos);
        for (const p of vils) {
          const seat = m.seats.find(s => s.pos === p);
          assert.ok(seat && !seat.hero, `${where}: vil ${p} 不在桌上`);
          const blindBase = p === 'SB' ? 0.5 : p === 'BB' ? 1 : 0;
          assert.ok(seat.bet > blindBase, `${where}: vil ${p} 没有下注(bet=${seat.bet})`);
          assert.ok(!seat.folded, `${where}: vil ${p} 被画成弃牌`);
        }
      }
});
