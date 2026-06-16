/* packs.js — the range DATABASE (PACKS) + expansion into R/C/M sets, and PREMIUM.
   Range edits live here. Depends on expand() from ranges.js (load it first). */
/* modes: open(弃/加) · defense(弃/跟/3bet) · push(弃/全下) · callshove(弃/跟注全下) */
const PACKS={
 cash:{
  6:[
   {mode:'open',name:'UTG · 枪口位',who:'6人桌 · 你先开局',tier:1,raise:"22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, AJo+, KQo",mix:"65s, 54s, K9s, Q9s, J9s, ATo, A9o, KJo, QJo"},
   {mode:'open',name:'BTN · 按钮位',who:'6人桌 · 你先开局',tier:1,raise:r_btn,mix:m_btn},
   {mode:'open',name:'CO · 关煞位',who:'6人桌 · 你先开局',tier:2,raise:r_co,mix:m_co},
   {mode:'open',name:'HJ · 中位',who:'6人桌 · 你先开局',tier:3,raise:"22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s, A9o+, KJo+, QJo",mix:"54s, K8s, Q8s, J8s, T7s, A8o, A5o, KTo, QTo, JTo"},
   {mode:'open',name:'SB · 小盲位',who:'6人桌 · 仅剩大盲',tier:3,raise:r_sb,mix:m_sb},
   {mode:'defense',name:'BB vs BTN',who:'按钮位开局 · 大盲防守',tier:4,
    raise:"99+, ATs+, A5s-A2s, KJs+, AJo+, KQo",
    call:"22-88, A2s-A9s, K2s-KTs, Q2s-QJs, J6s-JTs, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o-ATo, K7o-KQo, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o, 54o"},
   {mode:'defense',name:'BB vs CO',who:'关煞位开局 · 大盲防守',tier:5,
    raise:"TT+, AQs+, A5s, A4s, AQo+, KQs",
    call:"22-99, A2s-AJs, K7s-KQs, Q8s-QJs, J8s-JTs, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo+, A5o, KTo+, QTo+, JTo"},
   {mode:'defense',name:'BB vs UTG',who:'枪口位开局 · 大盲防守',tier:6,
    raise:"QQ+, AKo, AKs, A5s, A4s",
    call:"22-JJ, ATs-AQs, A2s-A5s, KTs-KQs, QTs-QJs, JTs, J9s, T9s, 98s, 87s, 76s, 65s, AJo, AQo, KQo"},
  ],
  9:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 最早位开局',tier:1,raise:"55+, A9s+, A5s, KTs+, QJs, JTs, T9s, AJo+, KQo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 你先开局',tier:1,raise:"44+, A8s+, A5s-A4s, KTs+, QTs+, J9s+, T9s, 98s, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 你先开局',tier:2,raise:r_co,mix:m_co},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 你先开局',tier:2,raise:r_btn,mix:m_btn},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 仅剩大盲',tier:3,raise:r_sb,mix:m_sb},
   {mode:'defense',name:'BB vs BTN',who:'按钮位开局 · 大盲防守',tier:4,
    raise:"99+, ATs+, A5s-A2s, KJs+, AJo+, KQo",
    call:"22-88, A2s-A9s, K2s-KTs, Q2s-QJs, J6s-JTs, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o-ATo, K7o-KQo, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o, 54o"},
  ],
  2:[
   {mode:'open',name:'SB/BTN 开局',who:'单挑 · 你在按钮先行动',tier:1,
    raise:"22+, A2s+, K2s+, Q2s+, J3s+, T5s+, 95s+, 84s+, 74s+, 63s+, 53s+, 43s, A2o+, K2o+, Q5o+, J7o+, T7o+, 97o+, 86o+, 76o, 65o"},
   {mode:'defense',name:'BB vs SB 开局',who:'单挑 · 大盲防守',tier:1,
    raise:"77+, A9s+, A5s-A4s, KTs+, K9s, QJs, Q9s, ATo+, KQo",
    call:"22-66, A2s-A8s, K2s-K8s, Q2s-QTs, J2s-JTs, T5s-T9s, 95s+, 85s+, 74s+, 64s+, 53s+, A2o-A9o, K2o-KJo, Q5o+, J7o+, T7o+, 97o+, 87o, 76o, 65o"},
  ],
 },
 mtt:{
  d40:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 40bb 前注 · 你先开局',tier:1,raise:"44+, A9s+, A5s, KTs+, QJs, JTs, T9s, ATo+, KQo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 40bb 前注 · 你先开局',tier:1,raise:"33+, A8s+, A5s-A4s, KTs+, QTs+, J9s+, T9s, 98s, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 40bb 前注 · 你先开局',tier:2,raise:r_co,mix:m_co},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 40bb 前注 · 你先开局',tier:2,raise:r_btn,mix:m_btn},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 40bb 前注 · 仅剩大盲',tier:3,raise:r_sb,mix:m_sb},
  ],
  d25:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 25bb 中码 · 你先开局',tier:1,raise:"66+, ATs+, A5s, KJs+, QJs, AJo+, KQo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 25bb 中码 · 你先开局',tier:1,raise:"55+, A9s+, A5s, KTs+, QTs+, JTs, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 25bb 中码 · 你先开局',tier:2,raise:"33+, A7s+, A5s-A2s, K9s+, QTs+, J9s+, T9s, 98s, A9o+, KTo+, QJo"},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 25bb 中码 · 你先开局',tier:2,raise:"22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, 54s, A7o+, A5o, K9o+, QTo+, JTo"},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 25bb 中码 · 仅剩大盲',tier:3,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T9s, 98s, A8o+, A5o, KTo+, QJo"},
  ],
  d15:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 15bb 浅码 · 你先开局',tier:1,raise:"77+, AJs+, A5s, KQs, AQo+"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 15bb 浅码 · 你先开局',tier:1,raise:"66+, A9s+, KTs+, QJs, AJo+, KQo"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 15bb 浅码 · 你先开局',tier:2,raise:"44+, A7s+, A5s, K9s+, QTs+, JTs, T9s, ATo+, KJo+"},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 15bb 浅码 · 你先开局',tier:2,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T9s, A8o+, A5o, KTo+, QJo"},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 15bb 浅码 · 仅剩大盲',tier:3,raise:"33+, A5s+, A2s, K9s+, QTs+, JTs, A9o+, KTo+, QJo"},
  ],
  d10:[
   {mode:'push',name:'UTG 推/弃',who:'9人桌 · ~10bb · 全下或弃',tier:1,raise:"44+, A8s+, A5s, KJs+, QJs, JTs, AJo+, KQo"},
   {mode:'push',name:'MP 推/弃',who:'9人桌 · ~10bb · 全下或弃',tier:1,raise:"22+, A7s+, A5s-A4s, K9s+, QTs+, JTs, T9s, ATo+, KQo"},
   {mode:'push',name:'CO 推/弃',who:'9人桌 · ~10bb · 全下或弃',tier:2,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 98s, A8o+, A5o, KTo+, QJo"},
   {mode:'push',name:'BTN 推/弃',who:'9人桌 · ~10bb · 全下或弃',tier:2,raise:"22+, A2s+, K3s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, A2o+, K7o+, Q9o+, J9o+, T9o, 98o"},
   {mode:'push',name:'SB 推/弃',who:'9人桌 · ~10bb · 仅剩大盲',tier:3,raise:"22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 64s+, 54s, A2o+, K5o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o"},
  ],
  icm:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',tier:1,raise:"88+, AJs+, AKo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',tier:1,raise:"77+, ATs+, KQs, AJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',tier:2,raise:"55+, A9s+, KTs+, QJs, ATo+, KQo"},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 泡沫期 ~20bb · 可施压',tier:2,raise:"33+, A7s+, A5s, K9s+, QTs+, JTs, A9o+, KTo+, QJo"},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',tier:3,raise:"44+, A8s+, KTs+, QJs, ATo+, KQo"},
  ],
  d40_6:[
   {mode:'open',name:'UTG · 枪口位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',tier:1,raise:"22+, A8s+, A5s, KTs+, QJs, JTs, T9s, AJo+, KQo"},
   {mode:'open',name:'HJ · 劫机位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',tier:1,raise:"22+, A5s+, A2s, K9s+, QTs+, J9s+, T9s, 98s, ATo+, KJo+, QJo"},
   {mode:'open',name:'CO · 关煞位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',tier:2,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, A8o+, A5o, KTo+, QTo+, JTo"},
   {mode:'open',name:'BTN · 按钮位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',tier:2,raise:"22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o"},
   {mode:'open',name:'SB · 小盲位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 仅剩大盲',tier:3,raise:"22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, A2o+, K9o+, Q9o+, J9o+, T9o"},
  ],
  d20_6:[
   {mode:'open',name:'UTG · 枪口位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',tier:1,raise:"55+, A9s+, A5s, KTs+, QJs, JTs, AJo+, KQo"},
   {mode:'open',name:'HJ · 劫机位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',tier:1,raise:"44+, A7s+, A5s, K9s+, QTs+, JTs, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',tier:2,raise:"22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, A8o+, KTo+, QJo"},
   {mode:'open',name:'BTN · 按钮位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',tier:2,raise:"22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 87s, A5o+, K9o+, Q9o+, JTo"},
   {mode:'open',name:'SB · 小盲位',who:'6人桌 · ~20bb · 终桌浅码 · 仅剩大盲',tier:3,raise:"22+, A4s+, K8s+, Q9s+, J9s+, T9s, A8o+, K9o+, QTo+"},
  ],
 },
 face3b:{
  btn:[
   {mode:'face3b',name:'开 BTN，BB 反加',who:'你 BTN 开局 → 大盲 3-bet · 100bb · 你有位置',tier:1,
    raise:"QQ+, AKs, AKo, A5s, A4s",call:"22-JJ, ATs-AQs, A2s-A5s, KTs-KQs, QTs-QJs, JTs, T9s, 98s, 87s, AJo, AQo, KQo"},
   {mode:'face3b',name:'开 BTN，SB 反加',who:'你 BTN 开局 → 小盲 3-bet · 100bb · 你有位置',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"22-JJ, ATs-AQs, A2s-A5s, KTs-KQs, QTs-QJs, JTs, T9s, 98s, AJo, AQo, KQo"},
  ],
  co:[
   {mode:'face3b',name:'开 CO，BTN 反加',who:'你 CO 开局 → 按钮位 3-bet · 100bb · 你无位置',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, ATs-AQs, KJs+, QJs, JTs, AQo"},
   {mode:'face3b',name:'开 CO，BB 反加',who:'你 CO 开局 → 大盲 3-bet · 100bb · 你有位置',tier:2,
    raise:"QQ+, AKs, AKo, A5s, A4s",call:"22-JJ, ATs-AQs, KTs-KQs, QTs-QJs, JTs, T9s, AJo, AQo, KQo"},
  ],
  ep:[
   {mode:'face3b',name:'开 前位，被反加',who:'你 UTG/HJ 开局 → 被 3-bet · 100bb · 范围已很强',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, AQs, AJs, KQs"},
  ],
 },
 face4b:{
  ip:[
   {mode:'face4b',name:'你 BTN 3bet 被 4bet',who:'你按钮位 3-bet → 对手 4-bet · 100bb · 你有位置',tier:1,
    raise:"KK+, AKs, A5s",call:"QQ, JJ, AKo, AQs"},
  ],
  oop:[
   {mode:'face4b',name:'你盲位 3bet 被 4bet',who:'你盲位 3-bet → 对手 4-bet · 100bb · 你无位置',tier:1,
    raise:"KK+, AKs, AKo, A5s",call:"QQ"},
  ],
 },
 squeeze:{
  bb:[
   {mode:'squeeze',name:'大盲挤压',who:'前位开局 + 有人跟注 → 你在大盲 · 100bb · 无位置',tier:1,
    raise:"QQ+, AKs, AKo, AJs, A5s",call:"22-JJ, ATs-AQs, KQs, KJs, QJs, JTs, T9s, 98s"},
  ],
  btn:[
   {mode:'squeeze',name:'按钮挤压',who:'前位开局 + 有人跟注 → 你在按钮 · 100bb · 有位置',tier:1,
    raise:"TT+, AQs+, AKo, AJs, KQs, A5s, A4s",call:"22-99, ATs, KJs, QJs, JTs, T9s, 98s, 87s, AJo"},
  ],
 },
 coldcall:{
  btn:[
   {mode:'defense',name:'BTN 冷跟 vs CO',who:'CO 开局 → 你在按钮 · 100bb · 有位置',tier:1,
    raise:"QQ+, AKs, AKo, AJs, A5s, A4s",call:"22-JJ, ATs, KTs-KQs, QTs-QJs, JTs, T9s, 98s, 87s, AQs, AQo, KQo, KJo"},
   {mode:'defense',name:'BTN 冷跟 vs UTG',who:'UTG 开局 → 你在按钮 · 100bb · 对手范围强',tier:2,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, ATs-AQs, KQs, KJs, QJs, JTs, AQo"},
  ],
  co:[
   {mode:'defense',name:'CO 冷跟 vs UTG',who:'UTG 开局 → 你在 CO · 100bb · 身后还有人（挤压风险）',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, AJs-AQs, KQs, JTs, AQo"},
  ],
 },
};
Object.values(PACKS).forEach(f=>Object.values(f).forEach(arr=>arr.forEach(t=>{
 t.R=expand(t.raise);t.C=expand(t.call);t.M=expand(t.mix);
 t.union=[...new Set([...t.R,...t.C,...t.M])];
 // per-spot provenance / confidence (lets the app be honest spot-by-spot):
 //  precise  = backed by a real freqTable import / solved Nash
 //  curated  = hand-checked for magnitude+shape, mix freqs are ~placeholders
 //  approx   = roughest (e.g. ICM / 6-max estimates)
 t.confidence = t.confidence || (t.freqTable ? 'precise' : 'curated');
 t.src = t.src || '';
})));

const PREMIUM=new Set(['AA','KK','QQ','JJ','AKs','AKo','AQs']);
