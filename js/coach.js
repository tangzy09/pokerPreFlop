'use strict';
/* coach.js — 翻前诊断 + 20 天训练计划。加载在 app.js 之后,共享全局作用域。
   纯逻辑(coachScenes/coachAggregate/coachVerdict/coachBuildPlan)无 DOM 依赖、可单测;
   渲染函数沿用 app.js 的字符串拼接风格。诚实:全 vs 参考范围,不编 EV/频率。 */

// 计划固定天数(设计已定 20)
const COACH_PLAN_DAYS = 20;

// 占位纯函数,Task 3 替换实现;先让测试管道跑通
function coachPlanDays(){ return COACH_PLAN_DAYS; }

// 主战场 → 诊断/计划覆盖的场景列表。每个场景 {key, name, picks:[{format,variant}]}。
// 现金:场景=format(用 FORMATS.tag);锦标赛:场景=mtt variant 的 group。
// picks 只收 PACKS 里真实存在的坐标(空场景跳过)。
function coachScenes(onboard){
  const field = (onboard && onboard.field) || 'cash';
  const out = [];
  if (field === 'mtt') {
    const vs = (PACKS.mtt) ? Object.keys(PACKS.mtt) : [];
    const groups = {};                         // group 名 -> [variant...]
    vs.forEach(v => {
      const meta = VARIANTS.mtt && VARIANTS.mtt[v];
      if (!meta) return;
      const g = meta.group || meta.short || v;
      (groups[g] = groups[g] || []).push(v);
    });
    Object.keys(groups).forEach(g => {
      const picks = groups[g].map(v => ({ format: 'mtt', variant: v }))
        .filter(p => PACKS.mtt[p.variant] && PACKS.mtt[p.variant].length);
      if (picks.length) out.push({ key: 'mtt:' + g, name: g, picks });
    });
  } else {
    const formats = (GAMETYPES.cash && GAMETYPES.cash.formats) || ['cash'];
    formats.forEach(f => {
      if (!PACKS[f]) return;
      const picks = Object.keys(PACKS[f])
        .filter(v => PACKS[f][v] && PACKS[f][v].length)
        .map(v => ({ format: f, variant: v }));
      if (picks.length) out.push({ key: f, name: (FORMATS[f] && FORMATS[f].tag) || f, picks });
    });
  }
  return out;
}

const COACH_MIN_SAMPLE = 4;   // 一个场景样本 < 此数 → 不参与漏洞/强项断言(诚实)
const COACH_FAM_MIN = 3;      // 手型族比率断言的最小样本(诊断粗族;每条断言都随句带 n)

// 一手的参考动作键数组(不本地化,渲染时再 L());与判定/classifyMiss 同一套 MODES.correct
function coachRightOf(t, hand){
  const isR = t.R.has(hand), isC = t.C.has(hand), isM = t.M.has(hand);
  return MODES[t.mode].correct(isR, isC, isM);
}

// results: [{sceneKey, t, hand, choice, correct, variant}]。复用 app.js 的 classifyMiss/famCoarse。
// 输出必须可 JSON 序列化(存 STORE.coachDiagnosis)——misses/examples 只存字符串,绝不存 t/Set。
// 手型维度取舍:不做 scene×family 交叉(18 手样本太稀会编数据);两条独立轴:
//   场景轴 topLeaks 靠 examples(实打实答错的手,事实陈述 n=1 也诚实)具体到手,
//   手型轴 famLeaks 用全场景聚合的粗族比率(COACH_FAM_MIN 硬门)。
// minSample(可选):场景断言门槛。简化版 18 手 ÷ 6 场景 = 每场景 3 手,固定门槛 4 会让
// topLeaks/strengths 结构性永空(场景数从 4 涨到 6 时静默破坏)——诊断按实际每场景手数下调,
// 诚实性由报告的 quick-estimate 免责 + 行内样本量兜底。
function coachAggregate(results, scenes, minSample){
  const MIN = Math.max(2, minSample || COACH_MIN_SAMPLE);
  return _coachAggregate(results, scenes, MIN);
}
function _coachAggregate(results, scenes, MIN){
  const perScene = {}, perFamily = {};
  const nameOf = {}; (scenes||[]).forEach(s => nameOf[s.key] = s.name);
  results.forEach(r => {
    const e = perScene[r.sceneKey] || (perScene[r.sceneKey] = { n:0, correct:0, leakCounts:{}, misses:[], name:nameOf[r.sceneKey]||r.sceneKey });
    e.n++;
    const fam = famCoarse(r.hand);
    const fe = perFamily[fam] || (perFamily[fam] = { n:0, correct:0, leakCounts:{}, misses:[] });
    fe.n++;
    if (r.correct) { e.correct++; fe.correct++; }
    else {
      const leak = classifyMiss({ t:r.t, hand:r.hand, choice:r.choice, variant:r.variant });
      e.leakCounts[leak] = (e.leakCounts[leak] || 0) + 1;
      fe.leakCounts[leak] = (fe.leakCounts[leak] || 0) + 1;
      if (e.misses.length < 4) e.misses.push({ hand:r.hand, tName:r.t.name, mode:r.t.mode, choice:r.choice, right:coachRightOf(r.t, r.hand) });
      if (fe.misses.length < 4) fe.misses.push({ hand:r.hand, tName:r.t.name, choice:r.choice });
    }
  });
  Object.values(perScene).forEach(e => { e.acc = e.n ? e.correct / e.n : 0; });
  Object.values(perFamily).forEach(e => { e.acc = e.n ? e.correct / e.n : 0; });
  // Top 漏洞:样本足够的场景按正答率升序,取最弱的前 3;主漏洞类型=该场景错得最多的桶
  const eligible = Object.keys(perScene).filter(k => perScene[k].n >= MIN);
  const topLeaks = eligible
    .filter(k => perScene[k].acc < 0.7)
    .sort((a,b) => perScene[a].acc - perScene[b].acc)
    .slice(0, 3)
    .map(k => {
      const lc = perScene[k].leakCounts;
      const leak = Object.keys(lc).sort((a,b) => lc[b]-lc[a])[0] || 'mix';
      return { sceneKey:k, name:perScene[k].name, acc:perScene[k].acc, leak,
               examples:perScene[k].misses.slice(0,3) };
    });
  // 手型漏洞:粗族里样本 >= COACH_FAM_MIN 且 acc<0.7,按 acc 升序前 3
  const famLeaks = Object.keys(perFamily)
    .filter(f => perFamily[f].n >= COACH_FAM_MIN && perFamily[f].acc < 0.7)
    .sort((a,b) => perFamily[a].acc - perFamily[b].acc)
    .slice(0, 3)
    .map(f => {
      const fe = perFamily[f], lc = fe.leakCounts;
      return { fam:f, n:fe.n, miss:fe.n - fe.correct, acc:fe.acc,
               leak:Object.keys(lc).sort((a,b) => lc[b]-lc[a])[0] || 'mix',
               examples:fe.misses.slice(0,2) };
    });
  // 强项:样本足够且正答率最高的前 2(>=0.7)
  const strengths = eligible
    .filter(k => perScene[k].acc >= 0.7)
    .sort((a,b) => perScene[b].acc - perScene[a].acc)
    .slice(0, 2)
    .map(k => ({ sceneKey:k, name:perScene[k].name, acc:perScene[k].acc }));
  return { perScene, perFamily, topLeaks, strengths, famLeaks };
}

// 由漏洞类型分布合成"偏松/偏紧/较均衡"倾向。返回 {tendKey, headline(i18n key), detailed}。
// detailed: 详细版(full)才允许 UI 点名具体场景;简化版只给大方向。
function coachVerdict(agg, variant){
  let lo=0, ti=0;
  Object.values(agg.perScene || {}).forEach(e => {
    Object.keys(e.leakCounts||{}).forEach(k => {
      if (k==='loose') lo += e.leakCounts[k];
      else if (k==='tight') ti += e.leakCounts[k];
    });
  });
  let tendKey;
  if (lo + ti < 3) tendKey = 'coachTendBalanced';
  else if (lo >= ti*1.6) tendKey = 'coachTendLoose';
  else if (ti >= lo*1.6) tendKey = 'coachTendTight';
  else tendKey = 'coachTendBalanced';
  return { tendKey, headline: tendKey, detailed: variant === 'full' };
}

const COACH_FOCUS_DAYS = 13;                       // 前段攻克天数(后 7 天混合)
const COACH_MIN_PER_SCENE = 5;                     // 复习手数上限(每日)
const COACH_RECHECK_DAYS = [6, 13, 19];            // 复诊日:Day 7 / 14 / 20
function coachHandsForMinutes(m){ return m>=20?40 : m>=10?20 : 10; }

// agg: coachAggregate 输出;onboard: 问卷;scenes: coachScenes 输出。
// 返回 {createdTs:0, days:[{idx, sceneKey, name, nMain, nReview, mixed, done:false}], streak:0, curDay:0, lastDoneDate:null}
function coachBuildPlan(agg, onboard, scenes){
  const nMain = coachHandsForMinutes((onboard && onboard.minutes) || 10);
  const sceneName = {}; (scenes||[]).forEach(s => sceneName[s.key] = s.name);

  // 1. 前段场景队列
  let focusQueue;
  const goal = onboard && onboard.goal;
  if (goal === 'system') {
    // 系统过一遍:均匀覆盖所有场景
    focusQueue = (scenes||[]).map(s => s.key);
  } else if (agg.topLeaks && agg.topLeaks.length) {
    // 漏洞优先:按严重度(正答率升序)
    focusQueue = agg.topLeaks.map(l => l.sceneKey);
  } else {
    // 退化:无明显漏洞,按正答率升序铺所有场景
    focusQueue = Object.keys(agg.perScene||{})
      .sort((a,b) => (agg.perScene[a].acc||0) - (agg.perScene[b].acc||0));
    if (!focusQueue.length) focusQueue = (scenes||[]).map(s => s.key);
  }
  if (!focusQueue.length) focusQueue = ['mixed'];

  // 1b. 目标手型族:诊断出的最弱 2 个粗族,铺给每天(smart 出题加权;全局取而非按场景配——样本稀)
  const fams = (agg.famLeaks||[]).map(f => f.fam).slice(0, 2);
  const targetFams = fams.length ? fams : null;

  // 2. 前 13 天按队列循环铺(漏洞越靠前,占的天越多——靠循环顺序自然加权:第1个出现在 day0、day_q、day_2q…)
  const days = [];
  for (let i = 0; i < COACH_FOCUS_DAYS; i++) {
    const key = focusQueue[i % focusQueue.length];
    days.push({ idx:i, sceneKey:key, name:sceneName[key]||key, nMain, nReview:COACH_MIN_PER_SCENE, mixed:false, done:false,
                targetFams, recheck:false, recheckDone:false });
  }
  // 3. 后 7 天混合巩固(同样带手型加权)
  for (let i = COACH_FOCUS_DAYS; i < COACH_PLAN_DAYS; i++) {
    days.push({ idx:i, sceneKey:'mixed', name:'mixed', nMain, nReview:COACH_MIN_PER_SCENE, mixed:true, done:false,
                targetFams, recheck:false, recheckDone:false });
  }
  // 4. 复诊日:Day 7/14/20(训练前 6 手迷你测,只测当前重点漏洞;T5 复诊闭环消费)
  COACH_RECHECK_DAYS.forEach(i => { if (days[i]) days[i].recheck = true; });
  return { createdTs:0, days, streak:0, curDay:0, lastDoneDate:null };
}

// 全部挂在现有 STORE 对象下,复用 app.js 的 persist()
function coachLoadOnboard(){ return (typeof STORE!=='undefined' && STORE.coachOnboard) || null; }
function coachSaveOnboard(o){ STORE.coachOnboard = o; persist(); }
function coachLoadDiagnosis(){ return (typeof STORE!=='undefined' && STORE.coachDiagnosis) || null; }
function coachSaveDiagnosis(d){ STORE.coachDiagnosis = d; persist(); }
function coachLoadPlan(){ return (typeof STORE!=='undefined' && STORE.coachPlan) || null; }
function coachSavePlan(p){ STORE.coachPlan = p; persist(); }
function coachResetAll(){ delete STORE.coachOnboard; delete STORE.coachDiagnosis; delete STORE.coachPlan; persist(); }

// ============ UI 渲染 (Task 8/9/10) ============

/* --- 工具函数 --- */
// 显示/隐藏 coachScreen 的四个 section
function _coachSection(id){
  ['coachOnboard','coachDiag','coachReport','coachDay'].forEach(s=>{
    const el=document.getElementById(s);
    if(el) el.classList.toggle('hide', s!==id);
  });
}

// 颜色分档：acc >= .7 绿 / .55-.69 黄 / .4-.54 橙 / <.4 红
function _accColor(acc){
  if(acc>=.7) return 'var(--green)';
  if(acc>=.55) return '#c9b24a';
  if(acc>=.4) return '#d98a3a';
  return 'var(--red)';
}

/* --- 入口路由 --- */
function coachOpen(){
  // 进入时重置任何残留诊断状态
  if(typeof setMode==='function') setMode('normal');
  const scr=document.getElementById('coachScreen');
  if(!scr) return;
  // 隐藏其他覆盖层，显示 coach 屏(SCREENS 注册表统一收屏,不再手工维护子集列表)
  if(typeof showScreen==='function') showScreen('coachScreen');
  else scr.classList.remove('hide');

  const plan=coachLoadPlan();
  const onboard=coachLoadOnboard();
  if(plan){
    // 已有计划
    if(plan.curDay >= plan.days.length){
      coachRenderComplete();
    } else {
      _coachSection('coachDay');
      coachRenderDay();
    }
    return;
  }
  // 有诊断没计划(看过报告没买 Pro 就退出了):回到报告——它是用户花 10 分钟挣来的,
  // 也是付费墙的最高转化点;踢回问卷等于把报告丢了逼人重测(全局 review 修)。
  const diag=coachLoadDiagnosis();
  if(diag && diag.agg){
    coachRenderReport(diag);
    return;
  }
  _coachSection('coachOnboard');
  coachRenderOnboard();
}

/* --- 问卷 --- */
function coachRenderOnboard(){
  const el=document.getElementById('coachOnboard'); if(!el) return;
  // 问卷状态:回填已存答案(否则重开问卷时显示默认值,用户直接点开始会把 mtt 覆写回 cash)
  const state=Object.assign({ field:'cash', level:'mid', minutes:10, goal:'leak' }, coachLoadOnboard()||{});
  const QUESTIONS=[
    { key:'field', title:tr('coachQ1'), opts:[
      {v:'cash',  l:L('现金局')}, {v:'mtt', l:L('锦标赛')}
    ]},
    { key:'level', title:tr('coachQ2'), opts:[
      {v:'new',  l:tr('coachLvNew')}, {v:'mid', l:tr('coachLvMid')}, {v:'adv', l:tr('coachLvAdv')}
    ]},
    { key:'minutes', title:tr('coachQ3'), opts:[
      {v:5,  l:tr('coachMin5')}, {v:10, l:tr('coachMin10')}, {v:20, l:tr('coachMin20')}
    ]},
    { key:'goal', title:tr('coachQ4'), opts:[
      {v:'leak', l:tr('coachGoalLeak')}, {v:'system', l:tr('coachGoalSystem')}
    ]},
  ];

  function render(){
    let html=`<div style="text-align:center;margin-bottom:16px">
      <div style="font-size:12px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">${tr('coachOnboardTitle')}</div>
      <div style="font-size:16px;font-weight:700;font-family:'Space Grotesk'">${tr('coachOnboardSub')}</div>
    </div>`;
    QUESTIONS.forEach(q=>{
      html+=`<div class="coach-q"><div class="coach-q-title">${q.title}</div><div class="coach-chips">`;
      q.opts.forEach(o=>{
        const sel = state[q.key]==o.v ? ' sel' : '';
        html+=`<button class="coach-opt${sel}" data-qkey="${q.key}" data-val="${o.v}">${o.l}</button>`;
      });
      html+='</div></div>';
    });
    html+=`<div style="margin-top:16px">
      <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px">${tr('coachChooseVariant')}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="coach-big-btn" id="coachStartSimple">${tr('coachSimple')}<small>${tr('coachSimpleSub')}</small></button>
        <button class="coach-big-btn ghost" id="coachStartFull">${tr('coachFull')}<small>${tr('coachFullSub')}</small></button>
      </div>
    </div>`;
    el.innerHTML=html;

    // 绑定选择事件
    el.querySelectorAll('.coach-opt').forEach(btn=>{
      btn.onclick=()=>{
        const qkey=btn.dataset.qkey, val=btn.dataset.val;
        state[qkey] = isNaN(val) ? val : +val;
        render();
      };
    });
    const startDiag=(variant)=>{
      coachSaveOnboard(state);
      coachStartDiagnosis(state, variant, coachRenderReport); // 诊断在真实牌桌上跑(coachScreen 会被隐藏)
    };
    const s=document.getElementById('coachStartSimple'); if(s) s.onclick=()=>startDiag('simple');
    const f=document.getElementById('coachStartFull');   if(f) f.onclick=()=>startDiag('full');
  }
  render();
}

/* 诊断答题屏已移除:诊断改为复用练习的真实牌桌(app.js nextHand/resolve),
   coachDiag section 不再使用,牌面/反馈与练习完全一致。 */

/* --- 报告 --- */
function coachRenderReport(diagnosis){
  const el=document.getElementById('coachReport'); if(!el) return;
  _coachSection('coachReport');
  const {agg, verdict} = diagnosis;
  const nHands=typeof G!=='undefined'?G.hands:0;

  // 总评
  const tendText=tr(verdict.headline);

  // 场景条形（仅详细版显示，简化版只显示总体）
  let sceneBars='';
  if(verdict.detailed){
    Object.keys(agg.perScene).forEach(k=>{
      const e=agg.perScene[k];
      const pct=Math.round(e.acc*100);
      const col=_accColor(e.acc);
      sceneBars+=`<div class="coach-bar-row">
        <span class="coach-bar-name">${L(e.name)||e.name}</span>
        <span class="coach-bar-track"><i class="coach-bar-fill" style="display:block;width:${pct}%;background:${col}"></i></span>
        <span class="coach-bar-pct">${pct}%</span>
      </div>`;
    });
  }

  // Top 漏洞(带实打实答错的实例句——事实陈述,n=1 也诚实;simple 版只省略场景名)
  const _exLine=(ex)=>{
    const nm=(MODES[ex.mode]&&MODES[ex.mode].names)||{};
    const spot=verdict.detailed&&ex.tName?(' · '+(L(ex.tName)||ex.tName)):'';
    return `<div class="coach-leak-ex">${tr('coachExLine',{
      hand:ex.hand, spot:spot,
      you:L(nm[ex.choice]||ex.choice||'弃牌'),
      ref:(ex.right||[]).map(a=>L(nm[a]||a)).join(' / ')})}</div>`;
  };
  let leaksHtml='';
  if(agg.topLeaks && agg.topLeaks.length){
    agg.topLeaks.forEach((leak,i)=>{
      const leakName=tr('leakType_'+leak.leak);
      const sceneName=verdict.detailed?(L(leak.name)||leak.name):'';
      leaksHtml+=`<div class="coach-leak-item">
        <div class="coach-leak-n">${i+1}</div>
        <div>
          <div class="coach-leak-t">${sceneName?sceneName+' ':''}<span class="coach-tag">${leakName}</span></div>
          <div class="coach-leak-d">${tr('leakTypeDesc_'+leak.leak)}</div>
          ${(leak.examples||[]).map(_exLine).join('')}
        </div>
      </div>`;
    });
  } else {
    leaksHtml=`<div style="color:var(--muted);font-size:13px;padding:8px 0">${tr('coachNoLeaks')}</div>`;
  }

  // 手型弱点卡(famLeaks:粗族比率断言,COACH_FAM_MIN 硬门,行内带 n 手错 m 手)
  // 两行布局:上行 名称+计数(长文本不挤压),下行 满宽条形
  let famHtml='';
  if(agg.famLeaks && agg.famLeaks.length){
    agg.famLeaks.forEach(f=>{
      const famName=L(FAM_COARSE[f.fam]||f.fam);
      const pct=Math.round(f.acc*100);
      famHtml+=`<div style="margin:9px 0">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12.5px;margin-bottom:4px">
          <b>${famName}</b>
          <span style="color:var(--muted);font-size:11.5px;text-align:right">${tr('coachFamLine',{n:f.n,m:f.miss})} · ${tr('leakType_'+f.leak)}</span>
        </div>
        <span class="coach-bar-track" style="display:block"><i class="coach-bar-fill" style="display:block;width:${pct}%;background:${_accColor(f.acc)}"></i></span>
      </div>`;
    });
    famHtml+=`<div class="coach-note">${tr('coachFamNote',{min:COACH_FAM_MIN})}</div>`;
  }

  // 强项
  let strengthHtml='';
  if(agg.strengths && agg.strengths.length){
    strengthHtml='<div class="coach-strong">'+
      agg.strengths.map(s=>`<span class="coach-chip">✓ ${L(s.name)||s.name}</span>`).join('')+
    '</div>';
  } else {
    strengthHtml=`<div style="color:var(--muted);font-size:13px">${tr('coachNoStrengths')}</div>`;
  }

  // 计划预览
  const onboard=coachLoadOnboard()||{};
  const scenes=coachScenes(onboard);
  const previewPlan=coachBuildPlan(agg, onboard, scenes);
  let planRows='';
  // 简化：只显示前几段分组
  const focusDays=previewPlan.days.slice(0,COACH_FOCUS_DAYS);
  const mixedDays=previewPlan.days.slice(COACH_FOCUS_DAYS);
  // 找连续同场景的段
  const segments=[];
  focusDays.forEach(d=>{
    if(!segments.length||segments[segments.length-1].key!==d.sceneKey){
      segments.push({key:d.sceneKey,name:d.name,start:d.idx+1,end:d.idx+1});
    } else {
      segments[segments.length-1].end=d.idx+1;
    }
  });
  segments.forEach(seg=>{
    const d=seg.start+(seg.end>seg.start?'-'+seg.end:'');   // "3" 或区间 "3-5"
    planRows+=`<div class="coach-plan-row"><span class="coach-plan-day">${tr('coachPlanDayLbl',{d})}</span><span>${tr('coachPlanFocus')} · ${L(seg.name)||seg.name}</span></div>`;
  });
  if(mixedDays.length){
    const d=(mixedDays[0].idx+1)+'-'+(mixedDays[mixedDays.length-1].idx+1);
    planRows+=`<div class="coach-plan-row"><span class="coach-plan-day">${tr('coachPlanDayLbl',{d})}</span><span>${tr('coachPlanMixed')}</span></div>`;
  }

  const simpleNote=!verdict.detailed?`<div class="coach-note">${tr('coachQuickEst')}</div>`:'';

  el.innerHTML=`
    <div class="coach-card" style="text-align:center">
      <div class="coach-verdict">${tendText}</div>
      ${simpleNote}
    </div>

    ${verdict.detailed && sceneBars ? `<div class="coach-card">
      <div class="coach-lbl">${tr('coachScenePerf')}</div>
      ${sceneBars}
    </div>` : ''}

    <div class="coach-card">
      <div class="coach-lbl">${tr('coachTopLeaks')}</div>
      ${leaksHtml}
    </div>

    ${famHtml ? `<div class="coach-card">
      <div class="coach-lbl">${tr('coachFamPerf')}</div>
      ${famHtml}
    </div>` : ''}

    ${agg.strengths && agg.strengths.length ? `<div class="coach-card">
      <div class="coach-lbl">${tr('coachStrengths')}</div>
      ${strengthHtml}
    </div>` : ''}

    <div class="coach-card">
      <div class="coach-lbl">${tr('coachPlanPreview')}</div>
      ${planRows}
      <div class="coach-note">${tr('coachVsRef',{n:nHands})}</div>
    </div>

    <button class="coach-big-btn" id="coachStartDay1">${tr('coachStartDay1')}<small>${tr('coachStartDay1Sub')}</small></button>
    <button class="coach-reset-link" id="coachRedoDiag">${tr('coachRedoDiag')}</button>
  `;

  const d1=document.getElementById('coachStartDay1');
  if(d1) d1.onclick=()=>{
    if(typeof isPro==='function' && !isPro()){
      if(typeof showPaywall==='function') showPaywall(_coachPwWhy(diagnosis)); // 带用户自己的漏洞,不是通用文案
      return;
    }
    coachStartPlan(diagnosis);
  };
  const redo=document.getElementById('coachRedoDiag');
  if(redo) redo.onclick=()=>{
    coachResetAll();
    _coachSection('coachOnboard');
    coachRenderOnboard();
  };
}

/* --- 复诊对比页(渲染进 coachReport 容器):基线 vs 本次,双端样本足够才出箭头行 --- */
function coachRenderRecheckReport(diag, slim){
  const el=document.getElementById('coachReport'); if(!el) return;
  _coachSection('coachReport');
  const base=diag.agg||{};
  // 三态与 coachApplyRecheck 同口径:样本不足 → null(中性文案,不宣布达标/未达标)
  const passed = slim.n < COACH_RECHECK_HANDS-1 ? null : (slim.acc >= COACH_RECHECK_PASS);
  // 场景/手型对比行:基线与本次都 n>=COACH_FAM_MIN 才出 a%→b% 箭头(凑不齐只列计数,不下结论)
  const rows=(baseMap, curMap, nameOf)=>{
    let html='';
    Object.keys(curMap||{}).forEach(k=>{
      const b=(baseMap||{})[k], c=curMap[k];
      const nm=nameOf(k);
      if(b && b.n>=COACH_FAM_MIN && c.n>=COACH_FAM_MIN){
        const a0=Math.round((b.acc||0)*100), a1=Math.round((c.acc||0)*100);
        const arrow=a1>a0?'↑':a1<a0?'↓':'→';
        html+=`<div class="coach-bar-row"><span class="coach-bar-name">${nm}</span>
          <span style="flex:1;font-size:12px">${tr('coachRecheckDelta',{a:a0,b:a1,n0:b.n,n1:c.n})} ${arrow}</span></div>`;
      } else {
        html+=`<div class="coach-bar-row"><span class="coach-bar-name">${nm}</span>
          <span style="flex:1;font-size:12px;color:var(--muted)">${tr('coachFamLine',{n:c.n,m:c.n-c.correct})}</span></div>`;
      }
    });
    return html;
  };
  const sceneRows=rows(base.perScene, slim.perScene, k=>L(((base.perScene||{})[k]||{}).name||k)||k);
  const famRows=rows(base.perFamily, slim.perFamily, k=>L(FAM_COARSE[k]||k));
  el.innerHTML=`
    <div class="coach-card" style="text-align:center">
      <div class="coach-verdict">${tr('coachRecheckTitle',{d:slim.dayIdx+1})}</div>
      <div style="font-size:14px;margin-top:6px">${tr('coachRecheckHead',{n:slim.n,c:slim.correct,acc:Math.round(slim.acc*100)})}</div>
      <div class="coach-note" style="margin-top:8px">${passed===null?tr('coachRecheckShort'):passed?tr('coachRecheckPass'):tr('coachRecheckFail')}</div>
    </div>
    ${sceneRows?`<div class="coach-card"><div class="coach-lbl">${tr('coachScenePerf')}</div>${sceneRows}</div>`:''}
    ${famRows?`<div class="coach-card"><div class="coach-lbl">${tr('coachFamPerf')}</div>${famRows}</div>`:''}
    <div class="coach-card"><div class="coach-note">${tr('coachVsRef',{n:slim.n})}</div></div>
    <button class="coach-big-btn" id="coachRecheckBack">${tr('coachRecheckBack')}</button>
  `;
  const back=document.getElementById('coachRecheckBack');
  if(back) back.onclick=()=>{ _coachSection('coachDay'); coachRenderDay(); };
}

/* --- 付费墙缘由:带用户自己的诊断漏洞(购买意愿最高点 = 刚看完自己错哪) --- */
function _coachPwWhy(diagnosis){
  const diag = diagnosis || coachLoadDiagnosis();
  const agg = diag && diag.agg;
  if(agg){
    const parts = [];
    const tl = (agg.topLeaks||[])[0];
    if(tl) parts.push((L(tl.name)||tl.name)+' '+tr('leakType_'+tl.leak));
    const fl = (agg.famLeaks||[])[0];
    if(fl) parts.push(L(FAM_COARSE[fl.fam]||fl.fam));
    if(parts.length) return tr('pwWhyPlanYou',{focus:parts.join('、')});
  }
  return tr('pwWhyPlan');
}

/* --- 计划启动 --- */
function coachStartPlan(diagnosis){
  const onboard=coachLoadOnboard()||{};
  const scenes=coachScenes(onboard);
  const plan=coachBuildPlan(diagnosis.agg, onboard, scenes);
  plan.createdTs=Date.now();
  coachSavePlan(plan);
  _coachSection('coachDay');
  coachRenderDay();
}

/* --- 每日卡片 --- */
function coachRenderDay(){
  const el=document.getElementById('coachDay'); if(!el) return;
  const plan=coachLoadPlan();
  if(!plan){ coachRenderComplete(); return; }

  // 计划已全部完成
  if(plan.curDay>=plan.days.length){ coachRenderComplete(); return; }

  const day=plan.days[plan.curDay];
  const totalHands=day.nMain+(day.nReview||0);
  const dayLabel=tr('coachDayN',{d:plan.curDay+1});
  const streakLabel=plan.streak>0?tr('coachStreak',{n:plan.streak}):'';
  const themeName=day.mixed?tr('coachMixedTheme'):(L(day.name)||day.name);

  // 本周进度（当前 ±3 天）
  const weekStart=Math.max(0,plan.curDay-2);
  const weekEnd=Math.min(plan.days.length-1,plan.curDay+4);
  let weekRows='';
  for(let i=weekStart;i<=weekEnd;i++){
    const d=plan.days[i];
    const dName=d.mixed?tr('coachMixedTheme'):(L(d.name)||d.name);
    let style,marker;
    if(d.done){ style='color:var(--green)'; marker='✓'; }
    else if(i===plan.curDay){ style='color:var(--gold)'; marker='●'; }
    else { style='color:var(--muted)'; marker='○'; }
    weekRows+=`<div class="coach-plan-row">
      <span class="coach-plan-day">${tr('coachPlanDayLbl',{d:i+1})}</span>
      <span style="${style}">${marker} ${i===plan.curDay?'<b>'+dName+'</b>':dName}</span>
    </div>`;
  }

  el.innerHTML=`
    <div class="coach-card">
      <div class="coach-day-hd">
        <div>
          <div style="font-size:12px;color:var(--muted);letter-spacing:1px">${dayLabel}</div>
          <div class="coach-theme">${themeName}</div>
          <div style="font-size:11.5px;color:var(--muted)">${tr('coachDaySubtitle')}</div>
        </div>
        <div class="coach-streak">${streakLabel}</div>
      </div>
    </div>

    <div class="coach-card">
      <div class="coach-lbl">${tr('coachTodayTask')}</div>
      <div class="coach-seg">
        <div class="coach-seg-ic">🎯</div>
        <div style="flex:1">
          <div class="coach-seg-t">${tr('coachMainTraining',{n:day.nMain})}</div>
          <div class="coach-seg-s">${themeName} · ${tr('coachSmartDeal')}${(day.targetFams&&day.targetFams.length)?' · '+day.targetFams.map(f=>L(FAM_COARSE[f]||f)).join('/'):''}</div>
        </div>
      </div>
      <div class="coach-seg">
        <div class="coach-seg-ic">📕</div>
        <div style="flex:1">
          <div class="coach-seg-t">${tr('coachReviewHands',{n:day.nReview||5})}</div>
          <div class="coach-seg-s">${tr('coachReviewSub')}</div>
        </div>
      </div>
      <div class="coach-prog"><i class="coach-prog-bar" style="width:0%"></i></div>
      <div class="coach-prog-txt">${tr('coachDayProgress',{done:0,total:totalHands})}</div>
    </div>

    ${day.recheck && !day.recheckDone ? `<div class="coach-card" style="border-color:rgba(232,198,106,.4)">
      <div class="coach-seg">
        <div class="coach-seg-ic">🩺</div>
        <div style="flex:1">
          <div class="coach-seg-t">${tr('coachRecheckSeg',{n:COACH_RECHECK_HANDS})}</div>
          <div class="coach-seg-s">${tr('coachRecheckSub')}</div>
        </div>
      </div>
      <button class="coach-big-btn ghost" id="coachGoRecheck" style="margin-top:8px">${tr('coachGoRecheck')}</button>
    </div>` : ''}
    ${day.recheck && day.recheckDone ? `<div class="coach-note">🩺 ${tr('coachRecheckDone',{acc:Math.round((day.recheckAcc||0)*100)})}</div>` : ''}
    <button class="coach-big-btn" id="coachGoToday">${tr('coachStartToday')} · ${totalHands} ${tr('coachHands')}</button>
    <button class="coach-big-btn ghost" id="coachMarkDone">${tr('coachMarkDone')}</button>

    <div class="coach-card">
      <div class="coach-lbl">${tr('coachWeekProg')}</div>
      ${weekRows}
    </div>
    <button class="coach-reset-link" id="coachResetAll">${tr('coachResetPlan')}</button>
  `;

  const goBtn=document.getElementById('coachGoToday');
  if(goBtn) goBtn.onclick=()=>coachStartDayTraining(day);

  const rcBtn=document.getElementById('coachGoRecheck');
  if(rcBtn) rcBtn.onclick=()=>coachStartRecheck(day);

  const markBtn=document.getElementById('coachMarkDone');
  if(markBtn) markBtn.onclick=()=>coachMarkDayDone();

  const resetBtn=document.getElementById('coachResetAll');
  if(resetBtn) resetBtn.onclick=()=>{
    if(!confirm(tr('coachResetConfirm'))) return;
    coachResetAll();
    _coachSection('coachOnboard');
    coachRenderOnboard();
  };
}

/* --- 计划完成页 --- */
function coachRenderComplete(){
  const el=document.getElementById('coachDay'); if(!el) return;
  _coachSection('coachDay');
  el.innerHTML=`<div class="coach-card" style="text-align:center;padding:32px 16px">
    <div style="font-size:40px;margin-bottom:12px">🏆</div>
    <div class="coach-verdict" style="font-size:22px">${tr('coachComplete')}</div>
    <div style="color:var(--muted);font-size:13px;margin-top:8px;line-height:1.6">${tr('coachCompleteSub')}</div>
  </div>
  <button class="coach-big-btn" id="coachRestartPlan" style="margin-top:12px">${tr('coachRestartPlan')}</button>`;
  const btn=document.getElementById('coachRestartPlan');
  if(btn) btn.onclick=()=>{ coachResetAll(); _coachSection('coachOnboard'); coachRenderOnboard(); };
}

/* --- 每日训练启动 --- */
function coachStartDayTraining(day){
  // 找该场景的一个 pick，设 G.format/variant，走普通 newGame()
  // 不强制锁定手数——用户练完手动点「标记今日完成」
  // Pro 门槛在每次启动时校验(而不是只在 Start Day 1):否则退订/换设备后,
  // 已存在 localStorage 的计划可以永久绕过付费墙直接 newGame()
  if(typeof isPro==='function' && !isPro()){
    if(typeof showPaywall==='function') showPaywall(_coachPwWhy());
    return;                                        // 留在 coachScreen,不动任何屏
  }
  if(typeof showScreen==='function') showScreen(null); // 进真实牌桌 = 全部覆盖屏隐藏

  // G.format/G.variant 兜底:重启 app 后 G 是全新对象(format 只由 launch/复习/诊断赋值),
  // mixed 天直接 newGame() 会在 PACKS[undefined] 上抛 TypeError → 全屏隐藏后的空白死屏
  const ensureCoords=()=>{
    if(typeof G==='undefined') return false;
    if(!G.format || !PACKS[G.format] || !PACKS[G.format][G.variant]){
      G.format='cash'; G.variant='6';              // 安全默认:现金 6 人(永远存在且免费)
    }
    return true;
  };
  try{
    // 混合天：用当前已有的 G.format/variant(无效则兜底现金6人),不强制切换
    if(day.mixed){
      if(ensureCoords() && typeof newGame==='function') newGame({fams:day.targetFams||null, filter:'smart'});
      return;
    }
    // 单场景天：找 picks 里第一个有效坐标
    const onboard=coachLoadOnboard()||{};
    const scenes=coachScenes(onboard);
    const scene=scenes.find(s=>s.key===day.sceneKey);
    if(scene && scene.picks && scene.picks.length){
      const pick=scene.picks[0];
      if(typeof G!=='undefined'){
        G.format=pick.format;
        G.variant=pick.variant;
      }
    }
    if(ensureCoords() && typeof newGame==='function') newGame({fams:day.targetFams||null, filter:'smart'});
  } catch(e){
    // 兜底:回主页——绝不盲目重试 newGame()(同样的坐标会同样抛错,留下空白死屏)
    try{
      if(typeof showScreen==='function') showScreen('coachScreen');
      if(typeof toast==='function') toast(tr('coachDayErr'),'⚠',true);
    }catch(_){}
  }
}

/* --- 打卡 --- */
function coachMarkDayDone(){
  const plan=coachLoadPlan(); if(!plan) return;
  const d=plan.days[plan.curDay]; if(!d) return;
  // 复诊日没做复诊就直接打卡:把复诊顺延到下一个未完成的普通天,别让 Day 7/14/20 三个锚点被静默跳空
  if(d.recheck && !d.recheckDone){
    const nx=plan.days.find(x=>x.idx>d.idx && !x.done && !x.recheck);
    if(nx) nx.recheck=true;
    d.recheck=false;
  }
  d.done=true;
  // streak 连续逻辑：同一天重复打卡不重复计数；昨天打过→续；断更→重置为 1
  const today=new Date().toDateString();
  if(plan.lastDoneDate===today){
    plan.streak=plan.streak||1; // 当天已计过，保持不变(避免一天多卡虚高连胜)
  } else if(plan.lastDoneDate){
    const diff=Math.round((new Date(today)-new Date(plan.lastDoneDate))/(1000*60*60*24));
    plan.streak = (diff<=1) ? (plan.streak||0)+1 : 1;
  } else {
    plan.streak=1;
  }
  plan.lastDoneDate=today;
  plan.curDay=Math.min(plan.curDay+1, plan.days.length);
  coachSavePlan(plan);
  _coachSection('coachDay');
  coachRenderDay();
}

/* --- Back 按钮 --- */
try{
  document.getElementById('coachBack').onclick=()=>{
    try{if(typeof SFX!=='undefined')SFX.click();}catch(e){}
    if(typeof setMode==='function') setMode('normal');
    const scr=document.getElementById('coachScreen');
    if(scr) scr.classList.add('hide');
    // 必须显式回主页(诊断流程隐藏过 homeScreen):showScreen 统一恢复
    if(typeof showScreen==='function') showScreen('homeScreen');
  };
}catch(e){}

// 诊断出题:从 scenes 的 picks 里,按场景均衡抽够 total 手。
// 每手 {sceneKey, format, variant, t, hand}。handPred(hand)→bool 可选:复诊按手型族收窄题库。
function coachBuildDiagQueue(scenes, total, handPred){
  if(!scenes || !scenes.length) return []; // 防 total/0=Infinity:无可用场景→空队列(调用方据此提前结束)
  const perScene = Math.max(1, Math.round(total / scenes.length));
  const queue = [];
  scenes.forEach(s => {
    const cands = [];
    s.picks.forEach(p => {
      const pack = PACKS[p.format] && PACKS[p.format][p.variant];
      if (!pack) return;
      pack.forEach(t => {
        // 取范围内手牌(R∪C∪M)+ 少量难弃牌
        [...(t.union||new Set())].forEach(h => { if(handPred && !handPred(h)) return;
          cands.push({ sceneKey:s.key, format:p.format, variant:p.variant, t, hand:h }); });
        (typeof adjacentFolds==='function' ? adjacentFolds(t) : []).slice(0,3)
          .forEach(h => { if(handPred && !handPred(h)) return;
            cands.push({ sceneKey:s.key, format:p.format, variant:p.variant, t, hand:h }); });
      });
    });
    shuffle(cands);
    queue.push(...cands.slice(0, perScene));
  });
  // perScene 取整后总数可能略多于 total → 裁到正好 total,使「18/45 手」标签与实际一致
  return shuffle(queue).slice(0, total);
}

// 模块级诊断状态。kind:'diag'(基线诊断)|'recheck'(计划内迷你复诊,绝不覆盖基线)
let _coachDiagQueue = null, _coachDiagPos = 0, _coachDiagOnReport = null;
let _coachDiagKind = 'diag', _coachDiagDayIdx = -1;

// 公共启动器:把队列装进 G.diagMode 管道(牌桌/发牌/反馈全复用练习,SINKS.diag 收结果)。
function _coachStartDiagRun(queue, kind, dayIdx){
  _coachDiagQueue = queue; _coachDiagPos = 0;
  _coachDiagKind = kind || 'diag'; _coachDiagDayIdx = (dayIdx==null? -1 : dayIdx);
  if(typeof setMode==="function") setMode("diag");   // 模式单缝:布尔+sink 原子绑定(诊断数据只进 diagResults)
  G.diagResults = []; G.over=false; G.busy=false; G.reviewRec=null;
  G.hands=0; G.correct=0; G.handNo=0; G.score=0; G.combo=0; G.best=0;
  G.level=1; G.hp=5; G.maxhp=5; G.q={best:0,good:0,inacc:0,mistake:0,blunder:0};
  G.diagTotal = queue.length;
  // 先把 G.format/variant 指向首题,否则 renderHUD 的 spotLabel(G.format,...) 在全新状态下会抛错
  if(queue.length){ G.format=queue[0].format; G.variant=queue[0].variant; }
  if(typeof showScreen==='function') showScreen(null); // 进真实牌桌 = 全部覆盖屏隐藏
  if(typeof renderHUD==='function') renderHUD();
  if(typeof nextHand==='function') nextHand();   // nextHand 的 diagMode 分支会发第一手
}

// 启动诊断:variant='simple'(18 手)|'full'(45 手)。
// 诊断完全复用练习的牌桌+发牌+反馈(nextHand/resolve),只是题库换成诊断队列、
// 跳过 HP/统计/错题堆/升级(见 app.js resolve 的 !G.diagMode 守卫),结束时进报告。
function coachStartDiagnosis(onboard, variant, onReport){
  const scenes = coachScenes(onboard);
  const total = variant === 'full' ? 45 : 18;
  const q = coachBuildDiagQueue(scenes, total);
  if(!q.length){   // 空队列(该主战场无任何可出题场景):留在 coach 屏,不进牌桌——否则全屏隐藏后死屏
    try{ if(typeof toast==='function') toast(tr('coachDayErr'),'⚠',true); }catch(e){}
    return;
  }
  _coachDiagOnReport = onReport;
  G.diagVariant = variant; G.diagScenes = scenes;
  _coachStartDiagRun(q, 'diag', -1);
}

const COACH_RECHECK_HANDS = 6;    // 复诊手数(迷你测,只测当前重点漏洞)
const COACH_RECHECK_PASS = 0.8;   // 达标线

// 计划内迷你复诊:按基线诊断的 topLeaks 场景收窄 + famLeaks 手型族过滤;抽不满则逐级放开。
function coachStartRecheck(day){
  if(typeof isPro==='function' && !isPro()){        // 复诊在计划内,与每日训练同款 Pro 校验
    if(typeof showPaywall==='function') showPaywall(_coachPwWhy());
    return;
  }
  const diag = coachLoadDiagnosis(); if(!diag || !diag.agg) return;
  const onboard = coachLoadOnboard() || {};
  const all = coachScenes(onboard);
  const focusKeys = new Set((diag.agg.topLeaks||[]).map(l => l.sceneKey));
  const scenes = all.filter(s => focusKeys.has(s.key));
  const famSet = new Set((diag.agg.famLeaks||[]).map(f => f.fam));
  const pred = famSet.size ? (h => famSet.has(famCoarse(h))) : null;   // 老诊断无 famLeaks → 只按场景收窄
  let q = coachBuildDiagQueue(scenes.length?scenes:all, COACH_RECHECK_HANDS, pred);
  if(q.length < COACH_RECHECK_HANDS) q = coachBuildDiagQueue(scenes.length?scenes:all, COACH_RECHECK_HANDS, null); // 族过滤抽不满 → 放开
  if(!q.length) return;
  G.diagVariant = 'recheck'; G.diagScenes = scenes.length?scenes:all;
  _coachStartDiagRun(q, 'recheck', day.idx);
}

// resolve() 的反馈「下一步/查看报告」按钮调用此函数推进:下一手或结束。
function coachDiagAdvance(){
  if(G.over) return;   // 最后一手反馈双击守卫:第一次已 finish(置 G.over),第二次会以基线身份覆写复诊 agg
  _coachDiagPos++;
  if(!_coachDiagQueue || _coachDiagPos>=_coachDiagQueue.length){ coachFinishDiagnosis(); return; }
  if(typeof nextHand==='function') nextHand();
}

// 诊断完成:收起牌桌,回 coach 覆盖层。基线诊断→存储+报告;复诊→只入 history,绝不覆盖基线。
function coachFinishDiagnosis(){
  if(typeof setMode==="function") setMode("normal"); G.over=true; G.busy=true;
  _coachExitTable();
  if(typeof showScreen==='function') showScreen('coachScreen');
  // 场景断言门槛按实际每场景手数下调(简化 18 手 ÷ 6 场景 = 3),不让固定门槛把报告清空
  const nScenes=(G.diagScenes||[]).length||1;
  const per=Math.floor((G.diagResults||[]).length/nScenes);
  const agg = coachAggregate(G.diagResults||[], G.diagScenes||[], Math.min(COACH_MIN_SAMPLE, Math.max(2, per)));
  if(_coachDiagKind==='recheck'){ coachFinishRecheck(agg); return; }
  const verdict = coachVerdict(agg, G.diagVariant);
  const diagnosis = { variant:G.diagVariant, agg, verdict, ts:0, history:[] };
  coachSaveDiagnosis(diagnosis);
  if (_coachDiagOnReport) _coachDiagOnReport(diagnosis);
}

// 复诊完成:摘 slim 快照入 diag.history、按达标/未达标调整后续计划、渲染对比页。
function coachFinishRecheck(agg){
  _coachDiagKind='diag';
  const diag = coachLoadDiagnosis(); if(!diag){ _coachSection('coachDay'); coachRenderDay(); return; }
  // 只存 {n,correct,acc,leakCounts}(丢 misses 细节,保持 STORE 苗条 + 可序列化)
  const slimOf = (src) => { const out={}; Object.keys(src||{}).forEach(k=>{
    const e=src[k]; out[k]={n:e.n,correct:e.correct,acc:e.acc,leakCounts:e.leakCounts||{}}; }); return out; };
  let n=0, correct=0;
  Object.values(agg.perScene||{}).forEach(e=>{ n+=e.n; correct+=e.correct; });
  const slim = { dayIdx:_coachDiagDayIdx, n, correct, acc:(n?correct/n:0),
                 perScene:slimOf(agg.perScene), perFamily:slimOf(agg.perFamily) };
  (diag.history = diag.history || []).push(slim);
  if(diag.history.length>12) diag.history=diag.history.slice(-12);  // 跨多轮计划的复诊快照裁到最近 12 条,防 STORE 无限增长
  coachSaveDiagnosis(diag);
  const plan = coachLoadPlan();
  if(plan){ coachApplyRecheck(plan, diag, slim); coachSavePlan(plan); }
  coachRenderRecheckReport(diag, slim);
}

// 达标/加练规则(纯函数,可单测):≥(手数-1) 且 acc>=PASS 判达标。
// 达标 → 后续未完成天的 targetFams 换 famLeaks 里"本次未覆盖"的下一批(练会了换目标);
// 未达标 → 把最近 2 个 mixed 日转成最弱场景主攻(总天数恒 20,不延长——streak/UX 依赖 20)。
function coachApplyRecheck(plan, diag, slim){
  const day = plan.days[slim.dayIdx];
  if(day){ day.recheckDone = true; day.recheckAcc = slim.acc; }
  // 样本不足(题库收窄后抽不满 5 手):不判定、不动计划——满分 4/4 被判「未达标」还强扭混合日,
  // 直接违背诚实红线的观感(全局 review 修)。passed:null = 中性。
  if(slim.n < COACH_RECHECK_HANDS-1) return { passed:null };
  const passed = slim.acc >= COACH_RECHECK_PASS;
  const future = plan.days.filter(d => d.idx > slim.dayIdx && !d.done);
  if(passed){
    const covered = new Set(Object.keys(slim.perFamily||{}));
    const rest = (diag.agg.famLeaks||[]).map(f=>f.fam).filter(f=>!covered.has(f)).slice(0,2);
    future.forEach(d => { if(d.targetFams) d.targetFams = rest.length ? rest : null; });
  } else {
    const worst = ((diag.agg.topLeaks||[])[0]||{}).sceneKey;
    let flipped = 0;
    future.forEach(d => { if(flipped<2 && d.mixed && worst){
      d.mixed=false; d.sceneKey=worst;
      d.name=((diag.agg.perScene||{})[worst]||{}).name||worst; flipped++; } });
  }
  return { passed };
}

// 诊断中途放弃(左上 ← / 右上结束):基线诊断回问卷;复诊回每日卡(计划还在,别踢回 onboarding)。
function coachAbortDiagnosis(){
  if(typeof setMode==='function') setMode('normal'); if(typeof G!=='undefined'){ G.over=true; G.busy=true; }
  const wasRecheck = _coachDiagKind==='recheck';
  _coachDiagKind='diag';
  _coachExitTable();
  if(typeof showScreen==='function') showScreen('coachScreen');
  if(wasRecheck && coachLoadPlan()){ _coachSection('coachDay'); coachRenderDay(); return; }
  _coachSection('coachOnboard'); coachRenderOnboard();
}

// 公共:从牌桌反馈态退回(隐藏反馈面板、恢复牌桌、清评判闪烁、复原动作区)。
function _coachExitTable(){
  if(typeof exitTableUI==='function'){ exitTableUI(); return; } // 复用 app.js 的同一份复位逻辑
  try{ const fb=document.getElementById('feedback'); if(fb) fb.classList.add('hide'); }catch(e){}}

// Node 测试用导出(浏览器忽略)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { coachPlanDays, COACH_PLAN_DAYS, coachScenes, coachAggregate, COACH_MIN_SAMPLE, COACH_FAM_MIN, coachRightOf, coachVerdict, coachBuildPlan, coachHandsForMinutes,
    coachBuildDiagQueue, coachApplyRecheck, COACH_RECHECK_HANDS, COACH_RECHECK_PASS, COACH_RECHECK_DAYS };
}
