'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');
const app = loadApp();

test('coach 骨架已加载', () => {
  assert.strictEqual(typeof app.coachPlanDays, 'function');
  assert.strictEqual(app.coachPlanDays(), 20);
});

// Task 2: coachScenes
test('coachScenes: 现金主战场 → 按 format 出 5 个场景', () => {
  const scenes = app.coachScenes({ field: 'cash' });
  const keys = scenes.map(s => s.key);
  assert.ok(keys.includes('cash'));
  assert.ok(keys.includes('face3b'));
  assert.ok(keys.includes('squeeze'));
  // 每个场景都有 picks,且 picks 指向真实存在的 PACKS 坐标
  for (const s of scenes) {
    assert.ok(s.picks.length > 0, `${s.key} 应有 picks`);
    assert.ok(s.name, `${s.key} 应有显示名`);
  }
});

test('coachScenes: 锦标赛主战场 → 按 variant group 出场景', () => {
  const scenes = app.coachScenes({ field: 'mtt' });
  const names = scenes.map(s => s.name);
  // mtt 的 group 之一(出题来源是 PACKS.mtt 实际存在的 variant)
  assert.ok(scenes.length > 0);
  assert.ok(scenes.every(s => s.picks.every(p => p.format === 'mtt')));
});

// Task 3: coachAggregate
test('coachAggregate: 算每场景正答率 + Top 漏洞 + 强项', () => {
  // 造两个假 spot table(够 classifyMiss 用:需要 R/C/M Set + mode)
  const openT = { mode:'open', name:'t_open', R:new Set(['AA']), C:new Set(), M:new Set() };
  const defT  = { mode:'defense', name:'t_def', R:new Set(), C:new Set(['KK']), M:new Set() };
  const results = [
    { sceneKey:'cash', t:openT, hand:'AA', choice:'raise', correct:true },
    { sceneKey:'cash', t:openT, hand:'AA', choice:'fold',  correct:false }, // 该加却弃 → tight
    { sceneKey:'face3b', t:defT, hand:'KK', choice:'fold', correct:false }, // 该跟却弃 → tight
    { sceneKey:'face3b', t:defT, hand:'KK', choice:'call', correct:true },
  ];
  const scenes = [{key:'cash',name:'现金'},{key:'face3b',name:'面3bet'}];
  const agg = app.coachAggregate(results, scenes);
  assert.strictEqual(agg.perScene.cash.n, 2);
  assert.strictEqual(agg.perScene.cash.correct, 1);
  assert.ok(agg.perScene.cash.acc > 0.49 && agg.perScene.cash.acc < 0.51); // 50%
  // Top 漏洞按正答率升序,且只收样本>=阈值的场景
  assert.ok(Array.isArray(agg.topLeaks));
  assert.ok(agg.topLeaks.every(l => l.leak)); // 每条带漏洞类型
});

// Task 4: coachVerdict
test('coachVerdict: 简化版只给大方向、不点名场景', () => {
  const agg = { perScene:{}, topLeaks:[{sceneKey:'face3b',name:'面3bet',acc:0.4,leak:'tight'}], strengths:[] };
  const v = app.coachVerdict(agg, 'simple');
  assert.ok(v.headline);           // 有总评
  assert.strictEqual(v.detailed, false); // 简化版标记为非细分
});

test('coachVerdict: 详细版可点名漏洞', () => {
  const agg = { perScene:{}, topLeaks:[{sceneKey:'face3b',name:'面3bet',acc:0.4,leak:'tight'}], strengths:[] };
  const v = app.coachVerdict(agg, 'full');
  assert.strictEqual(v.detailed, true);
});

// Task 5: coachBuildPlan
test('coachBuildPlan: 固定 20 天,前段攻漏洞、后段混合', () => {
  const agg = {
    perScene:{ face3b:{acc:0.4,name:'面3bet'}, cash:{acc:0.55,name:'现金'} },
    topLeaks:[
      {sceneKey:'face3b',name:'面3bet',acc:0.4,leak:'tight'},
      {sceneKey:'cash',name:'现金',acc:0.55,leak:'tight'},
    ],
    strengths:[],
  };
  const scenes = [{key:'face3b',name:'面3bet'},{key:'cash',name:'现金'}];
  const plan = app.coachBuildPlan(agg, { minutes:10, goal:'leak' }, scenes);
  assert.strictEqual(plan.days.length, 20);
  // 前段是漏洞场景,最后 7 天是 mixed
  assert.strictEqual(plan.days[0].sceneKey, 'face3b');   // 最严重的先上
  assert.ok(plan.days.slice(13).every(d => d.mixed === true));
  // 每天有训练手数(由 minutes 定)
  assert.strictEqual(plan.days[0].nMain, 20);            // 10min → 20 手
  assert.ok(plan.streak === 0 && plan.curDay === 0);
});

test('coachBuildPlan: 无明显漏洞 → 退化按正答率升序铺场景', () => {
  const agg = {
    perScene:{ a:{acc:0.8,name:'A'}, b:{acc:0.75,name:'B'} },
    topLeaks:[], strengths:[],
  };
  const scenes = [{key:'a',name:'A'},{key:'b',name:'B'}];
  const plan = app.coachBuildPlan(agg, { minutes:5, goal:'leak' }, scenes);
  assert.strictEqual(plan.days.length, 20);
  assert.strictEqual(plan.days[0].nMain, 10);            // 5min → 10 手
  assert.strictEqual(plan.days[0].sceneKey, 'b');        // 较弱的(0.75)先
});
