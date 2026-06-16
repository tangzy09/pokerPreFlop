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
  else if(m=tok.match(new RegExp(`^(${RX})(${RX})([so])\\+$`))){let f=RIDX[m[1]],s=RIDX[m[2]],suf=m[3];for(let i=s;i>f;i--)out.add(RANKS[f]+RANKS[i]+suf);}
  else if(m=tok.match(new RegExp(`^(${RX})(${RX})([so])-(${RX})(${RX})\\3$`))){let f=RIDX[m[1]],s1=RIDX[m[2]],s2=RIDX[m[5]],suf=m[3],lo=Math.min(s1,s2),hi=Math.max(s1,s2);for(let i=lo;i<=hi;i++)if(i>f)out.add(RANKS[f]+RANKS[i]+suf);}
  else if(m=tok.match(new RegExp(`^(${RX})(${RX})([so])$`))){let a=RIDX[m[1]],b=RIDX[m[2]],hi=Math.min(a,b),lo=Math.max(a,b);out.add(RANKS[hi]+RANKS[lo]+m[3]);}
 });return out;}

/* shared range strings (reused across packs) */
const r_co="22+, A2s+, K4s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, A5o, KTo+, QTo+, JTo";
const r_btn="22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o";
const r_sb="22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o";
/* marginal/edge bands — hands solvers genuinely mix (play-or-fold ~part frequency) */
const m_co="K2s, K3s, Q5s, Q6s, J7s, T7s, 96s, 85s, 64s, A7o, A6o, K9o, Q9o, J9o, T9o";
const m_btn="Q2s, Q3s, J3s, J4s, J5s, T3s, T4s, T5s, 94s, 84s, 73s, 63s, K2o, K3o, K4o, K5o, K6o, Q4o, Q5o, Q6o, Q7o, J6o, J7o, T7o, 96o, 86o, 75o, 64o, 54o";
const m_sb="K2s, Q2s-Q4s, J5s, J6s, T5s, T6s, 95s, 84s, 74s, 63s, 53s, 43s, K5o-K7o, Q7o, Q8o, J7o, J8o, T8o, 97o, 87o, 76o";

const FORMATS={cash:{label:'现金局 · 深码',tag:'现金'},mtt:{label:'锦标赛 · MTT',tag:'MTT'},face3b:{label:'面对反加 · 3-bet',tag:'面3bet'},face4b:{label:'面对 4-bet',tag:'面4bet'},squeeze:{label:'挤压 Squeeze',tag:'挤压'},coldcall:{label:'冷跟 · 非盲位',tag:'冷跟'}};
/* game type groups which scenarios (formats) belong to which game */
const GAMETYPES={
 cash:{label:'现金局',formats:['cash','face3b','face4b','squeeze','coldcall']},
 mtt:{label:'锦标赛 MTT',formats:['mtt']},
};
function gameOf(fmt){for(const g in GAMETYPES)if(GAMETYPES[g].formats.includes(fmt))return g;return 'cash';}
const VARIANTS={
 cash:{
  2:{label:'单挑 2人',sub:'2 人',short:'单挑'},
  6:{label:'6人桌',sub:'常规',short:'6人'},
  9:{label:'9人桌',sub:'满员',short:'9人'},
 },
 mtt:{
  d40:{label:'40bb 深码',sub:'9人·前注',short:'9人40bb'},
  d25:{label:'25bb 中码',sub:'9人·缩尺度',short:'9人25bb'},
  d15:{label:'15bb 浅码',sub:'9人·转推弃前',short:'9人15bb'},
  d10:{label:'10bb 推弃',sub:'9人·全下/弃',short:'9人推弃'},
  d15p:{label:'15bb 推弃',sub:'9人·全下/弃·计算',short:'9人15bb推'},
  d20p:{label:'20bb 推弃',sub:'9人·全下/弃·计算',short:'9人20bb推'},
  icm:{label:'泡沫 ICM',sub:'9人·保命',short:'9人ICM'},
  d40_6:{label:'40bb · 6人',sub:'终桌/短手',short:'6人40bb'},
  d20_6:{label:'20bb · 6人',sub:'终桌浅码',short:'6人20bb'},
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
 coldcall:{
  btn:{label:'你在 BTN',sub:'有位置·可宽跟',short:'BTN跟'},
  co:{label:'你在 CO',sub:'身后有人·偏紧',short:'CO跟'},
 },
};
const VARIANT_LABEL={cash:'牌桌人数',mtt:'深度 / 人数 / 阶段',face3b:'你的开局位置',face4b:'你 3-bet 的位置',squeeze:'你挤压的位置',coldcall:'你的位置'};
