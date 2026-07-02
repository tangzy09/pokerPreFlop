/* ranges.js — range DSL (expand) + scenario taxonomy (FORMATS/GAMETYPES/VARIANTS).
   Plain classic script: shares the global scope with the other js/ files; the
   <script src> order in gto-trainer.html matters. */
/* ============ ranges (approx GTO reference) ============ */
const RANKS=['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const RIDX={};RANKS.forEach((r,i)=>RIDX[r]=i);
const RX="[2-9TJQKA]";
function expand(str){const out=new Set();if(!str)return out;
 str.split(',').map(s=>s.trim()).filter(Boolean).forEach(tok=>{let m;
  if(m=tok.match(new RegExp(`^(${RX})\\1\\+$`))){for(let i=RIDX[m[1]];i>=0;i--)out.add(RANKS[i]+RANKS[i]);}
  else if(m=tok.match(new RegExp(`^(${RX})\\1-(${RX})\\2$`))){let a=RIDX[m[1]],b=RIDX[m[2]],lo=Math.min(a,b),hi=Math.max(a,b);for(let i=lo;i<=hi;i++)out.add(RANKS[i]+RANKS[i]);}
  else if(m=tok.match(new RegExp(`^(${RX})\\1$`))){out.add(m[1]+m[1]);}
  else if(m=tok.match(new RegExp(`^(${RX})(${RX})([so])\\+$`))){let f=RIDX[m[1]],s=RIDX[m[2]],suf=m[3];if(f!==s)for(let i=s;i>f;i--)out.add(RANKS[f]+RANKS[i]+suf);}
  else if(m=tok.match(new RegExp(`^(${RX})(${RX})([so])-(${RX})(${RX})\\3$`))){
   // 三种标准区间写法(此前第二 token 的高张 m[4] 被忽略,连子区间 T9s-65s 会静默展开成错误范围):
   //  同高张 kicker 区间 A2s-A9s · 同 kicker 高张区间 K9s-Q9s · 同 gap 对角连子区间 T9s-65s
   const h1=RIDX[m[1]],k1=RIDX[m[2]],h2=RIDX[m[4]],k2=RIDX[m[5]],suf=m[3];
   const put=(h,k)=>{if(h!==k&&h>=0&&h<=12&&k>=0&&k<=12)out.add(RANKS[Math.min(h,k)]+RANKS[Math.max(h,k)]+suf);};
   if(h1===h2){const lo=Math.min(k1,k2),hi=Math.max(k1,k2);for(let i=lo;i<=hi;i++)put(h1,i);}
   else if(k1===k2){const lo=Math.min(h1,h2),hi=Math.max(h1,h2);for(let i=lo;i<=hi;i++)put(i,k1);}
   else if(k1-h1===k2-h2){const g=k1-h1,lo=Math.min(h1,h2),hi=Math.max(h1,h2);for(let i=lo;i<=hi;i++)put(i,i+g);}
   /* 两端既不同高张、不同 kicker、gap 也不同 → 无法解释的区间,忽略(不硬猜错误范围) */}
  else if(m=tok.match(new RegExp(`^(${RX})(${RX})([so])$`))){let a=RIDX[m[1]],b=RIDX[m[2]];if(a!==b){let hi=Math.min(a,b),lo=Math.max(a,b);out.add(RANKS[hi]+RANKS[lo]+m[3]);}}
 });return out;}

/* shared range strings (reused across packs) */
const r_co="22+, A2s+, K4s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, A5o, KTo+, QTo+, JTo";
const r_btn="22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o";
const r_sb="22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o";
/* marginal/edge bands — hands solvers genuinely mix (play-or-fold ~part frequency) */
const m_co="K2s, K3s, Q5s, Q6s, J7s, T7s, 96s, 85s, 64s, A7o, A6o, K9o, Q9o, J9o, T9o";
const m_btn="Q2s, Q3s, J3s, J4s, J5s, T3s, T4s, T5s, 94s, 84s, 73s, 63s, K2o, K3o, K4o, K5o, K6o, Q4o, Q5o, Q6o, Q7o, J6o, J7o, T7o, 96o, 86o, 75o, 64o, 54o";
const m_sb="K2s, Q2s-Q4s, J5s, J6s, T5s, T6s, 95s, 84s, 74s, 63s, 53s, 43s, K5o-K7o, Q7o, Q8o, J7o, J8o, T8o, 97o, 87o, 76o";

const FORMATS={cash:{label:'现金局 · 深码',tag:'现金'},mtt:{label:'锦标赛 · MTT',tag:'MTT'},face3b:{label:'面对反加 · 3-bet',tag:'面3bet'},face4b:{label:'面对 4-bet',tag:'面4bet'},limp:{label:'面对跛入 · Limp',tag:'跛入'},squeeze:{label:'挤压 Squeeze',tag:'挤压'},coldcall:{label:'冷跟 · 非盲位',tag:'冷跟'}};
/* game type groups which scenarios (formats) belong to which game.
   顺序敏感:spotLocked 锁 formats 列表的后一半——limp 插在 squeeze 前 → slice(3) 锁
   limp/squeeze/coldcall(现有付费面不变、limp 进 Pro);append 到尾会让 squeeze 意外免费。 */
const GAMETYPES={
 cash:{label:'现金局',formats:['cash','face3b','face4b','limp','squeeze','coldcall']},
 mtt:{label:'锦标赛 MTT',formats:['mtt']},
};
function gameOf(fmt){for(const g in GAMETYPES)if(GAMETYPES[g].formats.includes(fmt))return g;return 'cash';}
const VARIANTS={
 cash:{
  /* 现有 key(2/6/9)绝不改名——reviewPile/statsBySpot 存档按 key 回连。
     group 用于选择页分组头 + spotLocked 的现金深度半分门控(标准组免费/深度组 Pro)。 */
  2:{group:'标准 100bb',label:'单挑 2人',short:'单挑'},
  6:{group:'标准 100bb',label:'6人桌',short:'6人'},
  9:{group:'标准 100bb',label:'9人桌',short:'9人'},
  c6_50:{group:'筹码深度 · 6人桌',label:'50bb',sub:'浅码·3bet或弃',short:'6人50bb',players:6},
  c6_200:{group:'筹码深度 · 6人桌',label:'200bb',sub:'超深·隐含赔率',short:'6人200bb',players:6},
  c6_str:{group:'Straddle 抓头 · 6人',label:'UTG 抓头 2bb',sub:'≈等效50bb·近似',short:'6人抓头',players:6},
 },
 mtt:{
  d40:{group:'RFI 开局 · 9人（40/25/15bb）',label:'40bb',sub:'深码·前注',short:'9人40bb'},
  d25:{group:'RFI 开局 · 9人（40/25/15bb）',label:'25bb',sub:'中码·缩尺度',short:'9人25bb'},
  d15:{group:'RFI 开局 · 9人（40/25/15bb）',label:'15bb',sub:'浅码·转推弃前',short:'9人15bb'},
  d8p:{group:'推弃 · 9人',label:'8bb',short:'9人8bb推'},
  d10:{group:'推弃 · 9人',label:'10bb',short:'9人推弃'},
  d12p:{group:'推弃 · 9人',label:'12bb',short:'9人12bb推'},
  d15p:{group:'推弃 · 9人',label:'15bb',short:'9人15bb推'},
  d20p:{group:'推弃 · 9人',label:'20bb',short:'9人20bb推'},
  co10:{group:'面对全下 · 9人BB 跟 BTN',label:'10bb',short:'9人跟10'},
  co15:{group:'面对全下 · 9人BB 跟 BTN',label:'15bb',short:'9人跟15'},
  co20:{group:'面对全下 · 9人BB 跟 BTN',label:'20bb',short:'9人跟20'},
  p6_10:{group:'推弃 · 6人终桌',label:'10bb',short:'6人推10'},
  p6_15:{group:'推弃 · 6人终桌',label:'15bb',short:'6人推15'},
  p6_20:{group:'推弃 · 6人终桌',label:'20bb',short:'6人推20'},
  hu5:{group:'单挑 HU · SB全下+BB跟',label:'5bb',short:'HU5bb'},
  hu8:{group:'单挑 HU · SB全下+BB跟',label:'8bb',short:'HU8bb'},
  hu10:{group:'单挑 HU · SB全下+BB跟',label:'10bb',short:'HU10bb'},
  hu12:{group:'单挑 HU · SB全下+BB跟',label:'12bb',short:'HU12bb'},
  hu15:{group:'单挑 HU · SB全下+BB跟',label:'15bb',short:'HU15bb'},
  hu20:{group:'单挑 HU · SB全下+BB跟',label:'20bb',short:'HU20bb'},
  hu25:{group:'单挑 HU · SB全下+BB跟',label:'25bb',short:'HU25bb'},
  icm:{group:'特殊场景',label:'泡沫 ICM',sub:'保命收紧',short:'9人ICM'},
  d40_6:{group:'特殊场景',label:'40bb · 6人',sub:'终桌短手',short:'6人40bb'},
  d20_6:{group:'特殊场景',label:'20bb · 6人',sub:'终桌浅码',short:'6人20bb'},
 },
 face3b:{
  btn:{label:'你开 BTN',sub:'有位置·防守宽',short:'开BTN'},
  co:{label:'你开 CO',sub:'有/无位置混合',short:'开CO'},
  ep:{label:'你开 前位',sub:'很紧·4bet或弃',short:'开前位'},
 },
 face4b:{
  ip:{label:'你有位置 3bet',sub:'被4bet·可跟可弃',short:'IP'},
  oop:{label:'你无位置 3bet',sub:'被4bet·全下或弃',short:'OOP'},
 },
 squeeze:{
  bb:{label:'你在大盲挤压',sub:'无位置·偏价值',short:'BB挤'},
  btn:{label:'你在按钮挤压',sub:'有位置·更宽',short:'BTN挤'},
 },
 limp:{
  btn:{label:'你在 BTN',sub:'有位置·隔离为主',short:'BTN隔离'},
  co:{label:'你在 CO',sub:'身后有人·偏紧',short:'CO隔离'},
  bb:{label:'你在大盲',sub:'免费看牌或加注',short:'BB过牌'},
 },
 coldcall:{
  btn:{label:'你在 BTN',sub:'有位置·可宽跟',short:'BTN跟'},
  co:{label:'你在 CO',sub:'身后有人·偏紧',short:'CO跟'},
 },
};
const VARIANT_LABEL={cash:'牌桌人数',mtt:'盲数 / 阶段',face3b:'你的开局位置',face4b:'你 3-bet 的位置',limp:'你的位置',squeeze:'你挤压的位置',coldcall:'你的位置'};
