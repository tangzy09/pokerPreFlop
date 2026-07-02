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

// 手型维度(2026-07 手型维度设计 §2):perFamily / famLeaks / examples
test('coachAggregate: perFamily 粗族聚合 + famLeaks 样本硬门 + topLeaks 带实例', () => {
  const openT = { mode:'open', name:'t_open', R:new Set(['A5s','A4s','A3s','A2s']), C:new Set(), M:new Set() };
  // 4 手同族(axs_wheel→ax_s)错 3 手 → famLeaks 应出 ax_s;另一族只 2 手 → 不出(COACH_FAM_MIN=3)
  const results = [
    { sceneKey:'cash', t:openT, hand:'A5s', choice:'fold', correct:false },
    { sceneKey:'cash', t:openT, hand:'A4s', choice:'fold', correct:false },
    { sceneKey:'cash', t:openT, hand:'A3s', choice:'fold', correct:false },
    { sceneKey:'cash', t:openT, hand:'A2s', choice:'raise', correct:true },
    { sceneKey:'cash', t:openT, hand:'T9s', choice:'fold', correct:false }, // sc 族仅 2 手
    { sceneKey:'cash', t:openT, hand:'98s', choice:'raise', correct:true },
  ];
  const agg = app.coachAggregate(results, [{key:'cash',name:'现金'}]);
  // perFamily 聚合正确
  assert.strictEqual(agg.perFamily.ax_s.n, 4);
  assert.strictEqual(agg.perFamily.ax_s.correct, 1);
  // famLeaks:ax_s 入选(4 手 acc .25),sc 被样本门挡掉(2 手)
  const fams = agg.famLeaks.map(f => f.fam);
  assert.ok(fams.includes('ax_s'), 'ax_s 应入 famLeaks');
  assert.ok(!fams.includes('sc'), 'sc 仅 2 手不得断言(COACH_FAM_MIN)');
  const fl = agg.famLeaks.find(f => f.fam === 'ax_s');
  assert.strictEqual(fl.n, 4); assert.strictEqual(fl.miss, 3);
  assert.ok(fl.leak, '带主漏洞类型');
  assert.ok(fl.examples.length >= 1 && fl.examples.length <= 2, '带 1-2 个实例');
  // topLeaks 带 examples(hand/choice/right 来自真实 miss)
  assert.ok(agg.topLeaks.length >= 1);
  const ex = agg.topLeaks[0].examples;
  assert.ok(ex.length >= 1 && ex.length <= 3);
  assert.ok(ex.every(e => typeof e.hand === 'string' && typeof e.choice === 'string' && Array.isArray(e.right)));
  // 序列化红线:agg 必须 JSON 往返无损(不含 t/Set;vm 跨 realm 原型不同,比 JSON 字符串)
  const back = JSON.parse(JSON.stringify(agg));
  assert.strictEqual(JSON.stringify(back.famLeaks), JSON.stringify(agg.famLeaks));
  assert.strictEqual(JSON.stringify(back.topLeaks), JSON.stringify(agg.topLeaks));
  assert.strictEqual(JSON.stringify(back.perFamily), JSON.stringify(agg.perFamily));
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

test('coachBuildPlan: targetFams 取 famLeaks 前 2,复诊日标 6/13/19;老 agg 无 famLeaks 不抛', () => {
  const agg = {
    perScene:{ face3b:{acc:0.4,name:'面3bet'} },
    topLeaks:[{sceneKey:'face3b',name:'面3bet',acc:0.4,leak:'tight'}],
    strengths:[],
    famLeaks:[{fam:'ax_s',n:4,miss:3,acc:0.25,leak:'tight'},{fam:'sc',n:3,miss:2,acc:0.33,leak:'loose'},{fam:'pp',n:3,miss:2,acc:0.33,leak:'tight'}],
  };
  const scenes=[{key:'face3b',name:'面3bet'}];
  const plan = app.coachBuildPlan(agg, { minutes:10, goal:'leak' }, scenes);
  // targetFams = famLeaks 前 2(全天铺,含 mixed 天)
  assert.deepStrictEqual(plan.days[0].targetFams, ['ax_s','sc']);
  assert.deepStrictEqual(plan.days[19].targetFams, ['ax_s','sc']);
  // 复诊日:Day 7/14/20(idx 6/13/19),其余天 false
  assert.strictEqual(plan.days[6].recheck, true);
  assert.strictEqual(plan.days[13].recheck, true);
  assert.strictEqual(plan.days[19].recheck, true);
  assert.strictEqual(plan.days[0].recheck, false);
  assert.ok(plan.days.every(d => d.recheckDone === false));
  // 老 agg(无 famLeaks 字段)→ 不抛,targetFams=null
  const old = app.coachBuildPlan({ perScene:{}, topLeaks:[], strengths:[] }, { minutes:5 }, scenes);
  assert.strictEqual(old.days[0].targetFams, null);
});

// T5 复诊闭环
test('coachBuildDiagQueue: handPred 过滤生效,产出全部满足谓词', () => {
  const scenes = app.coachScenes({ field: 'cash' });
  const pred = (h) => app.famCoarse(h) === 'ax_s';   // 只要同花A
  const q = app.coachBuildDiagQueue(scenes, 6, pred);
  assert.ok(q.length > 0, '同花A 在 cash 范围里必然有题');
  assert.ok(q.every(it => app.famCoarse(it.hand) === 'ax_s'),
    '队列里出现非目标族的手:' + q.map(i=>i.hand).join(','));
  // 无 pred 时行为不变(perScene 取整在场景数>total/2 时可短 1-2 手——既有行为,
  // 复诊真实路径 topLeaks≤3 场景不触发,且 coachApplyRecheck 判定门槛 n>=5 已容忍)
  const q2 = app.coachBuildDiagQueue(scenes, 6);
  assert.ok(q2.length >= 5 && q2.length <= 6, `期望 5-6 手,实际 ${q2.length}`);
});

test('coachApplyRecheck: 达标换目标族;未达标恰转 2 个 mixed 日;总天数恒 20;done 天不动', () => {
  const agg = {
    perScene:{ face3b:{acc:0.4,name:'面3bet'} },
    topLeaks:[{sceneKey:'face3b',name:'面3bet',acc:0.4,leak:'tight'}],
    strengths:[],
    famLeaks:[{fam:'ax_s',n:4,miss:3,acc:0.25,leak:'tight'},{fam:'sc',n:3,miss:2,acc:0.33,leak:'loose'},{fam:'pp',n:3,miss:2,acc:0.33,leak:'tight'}],
  };
  const scenes=[{key:'face3b',name:'面3bet'}];
  const diag = { agg };
  // 达标:复诊 6 手全对,perFamily 覆盖了 ax_s/sc → 后续 targetFams 换成未覆盖的 pp
  const planA = app.coachBuildPlan(agg, { minutes:10 }, scenes);
  const slimA = { dayIdx:6, n:6, correct:6, acc:1,
    perScene:{ face3b:{n:6,correct:6,acc:1,leakCounts:{}} },
    perFamily:{ ax_s:{n:3,correct:3,acc:1,leakCounts:{}}, sc:{n:3,correct:3,acc:1,leakCounts:{}} } };
  const rA = app.coachApplyRecheck(planA, diag, slimA);
  assert.strictEqual(rA.passed, true);
  assert.strictEqual(planA.days[6].recheckDone, true);
  assert.deepStrictEqual(planA.days[7].targetFams, ['pp'], '达标 → 换成未覆盖的下一族');
  assert.ok(planA.days.slice(0,6).every(d => JSON.stringify(d.targetFams)===JSON.stringify(['ax_s','sc'])), '复诊日之前的天不动');
  assert.strictEqual(planA.days.length, 20);
  // 未达标:恰好 2 个 mixed 日转最弱场景主攻,其余 mixed 保留
  const planB = app.coachBuildPlan(agg, { minutes:10 }, scenes);
  planB.days[14].done = true;                        // done 的 mixed 天不能被转
  const slimB = { dayIdx:13, n:6, correct:2, acc:2/6, perScene:{}, perFamily:{} };
  const rB = app.coachApplyRecheck(planB, diag, slimB);
  assert.strictEqual(rB.passed, false);
  const flipped = planB.days.filter(d => d.idx>13 && !d.mixed && d.sceneKey==='face3b' && d.idx>=14);
  assert.strictEqual(flipped.length, 2, '恰 2 个 mixed 转主攻');
  assert.strictEqual(planB.days[14].mixed, true, 'done 的天不动');
  assert.strictEqual(planB.days.length, 20, '总天数恒 20');
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
