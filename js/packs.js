/* packs.js — the range DATABASE (PACKS) + expansion into R/C/M sets, and PREMIUM.
   Range edits live here. Depends on expand() from ranges.js (load it first). */
/* modes: open(弃/加) · defense(弃/跟/3bet) · push(弃/全下) · callshove(弃/跟注全下) */
const PACKS={
 cash:{
  6:[
   {mode:'open',name:'UTG · 枪口位',who:'6人桌 · 你先开局',heroPos:'UTG',tier:1,raise:"22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, AJo+, KQo",mix:"65s, 54s, K9s, Q9s, J9s, ATo, A9o, KJo, QJo"},
   {mode:'open',name:'HJ · 劫机位',who:'6人桌 · 你先开局',heroPos:'HJ',tier:3,raise:"22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s, A9o+, KJo+, QJo",mix:"54s, K8s, Q8s, J8s, T7s, A8o, A5o, KTo, QTo, JTo"},
   {mode:'open',name:'CO · 关煞位',who:'6人桌 · 你先开局',heroPos:'CO',tier:2,raise:r_co,mix:m_co},
   {mode:'open',name:'BTN · 按钮位',who:'6人桌 · 你先开局',heroPos:'BTN',tier:1,raise:r_btn,mix:m_btn},
   {mode:'open',name:'SB · 小盲位',who:'6人桌 · 仅剩大盲',heroPos:'SB',tier:3,raise:r_sb,mix:m_sb},
   {mode:'defense',name:'BB vs BTN',who:'按钮位开局 · 大盲防守',heroPos:'BB',vilPos:'BTN',tier:4,
    raise:"99+, ATs+, A5s-A2s, KJs+, AJo+, KQo",
    call:"22-88, A2s-A9s, K2s-KTs, Q2s-QJs, J6s-JTs, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o-ATo, K7o-KQo, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o, 54o"},
   {mode:'defense',name:'BB vs CO',who:'关煞位开局 · 大盲防守',heroPos:'BB',vilPos:'CO',tier:5,
    raise:"TT+, AQs+, A5s, A4s, AQo+, KQs",
    call:"22-99, A2s-AJs, K7s-KQs, Q8s-QJs, J8s-JTs, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo+, A5o, KTo+, QTo+, JTo"},
   {mode:'defense',name:'BB vs UTG',who:'枪口位开局 · 大盲防守',heroPos:'BB',vilPos:'UTG',tier:6,
    raise:"QQ+, AKo, AKs, A5s, A4s",
    call:"22-JJ, ATs-AQs, A2s-A5s, KTs-KQs, QTs-QJs, JTs, J9s, T9s, 98s, 87s, 76s, 65s, AJo, AQo, KQo"},
  ],
  9:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 最早位开局',heroPos:'UTG',tier:1,raise:"55+, A9s+, A5s, KTs+, QJs, JTs, T9s, AJo+, KQo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 你先开局',heroPos:'MP',tier:1,raise:"44+, A8s+, A5s-A4s, KTs+, QTs+, J9s+, T9s, 98s, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 你先开局',heroPos:'CO',tier:2,raise:r_co,mix:m_co},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 你先开局',heroPos:'BTN',tier:2,raise:r_btn,mix:m_btn},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 仅剩大盲',heroPos:'SB',tier:3,raise:r_sb,mix:m_sb},
   {mode:'defense',name:'BB vs BTN',who:'按钮位开局 · 大盲防守',heroPos:'BB',vilPos:'BTN',tier:4,
    raise:"99+, ATs+, A5s-A2s, KJs+, AJo+, KQo",
    call:"22-88, A2s-A9s, K2s-KTs, Q2s-QJs, J6s-JTs, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o-ATo, K7o-KQo, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o, 54o"},
   /* 9max BB 防守扩充(2026-07,场景覆盖设计 §B):CO 开局范围与 6max 同源(r_co),
      folds-to-CO 后局面等价 → 防守范围沿用 6max 版;vs UTG 对 9max 最紧开局再紧一档;
      vs SB 是全库唯一 BB 有位置的多人桌防守(防得宽 + 3bet 更多)。全部 curated。 */
   {mode:'defense',name:'BB vs CO',who:'关煞位开局 · 大盲防守',heroPos:'BB',vilPos:'CO',tier:5,
    raise:"TT+, AQs+, A5s, A4s, AQo+, KQs",
    call:"22-99, A2s-AJs, K7s-KQs, Q8s-QJs, J8s-JTs, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo+, A5o, KTo+, QTo+, JTo"},
   {mode:'defense',name:'BB vs UTG',who:'枪口位开局 · 大盲防守',heroPos:'BB',vilPos:'UTG',tier:6,
    raise:"QQ+, AKs, AKo, A5s",
    call:"22-JJ, ATs-AQs, A4s-A2s, KTs-KQs, QTs+, JTs, T9s, 98s, 87s, 76s, AQo"},
   {mode:'defense',name:'BB vs SB',who:'小盲位开局 · 大盲防守',heroPos:'BB',vilPos:'SB',tier:5,
    raise:"88+, A9s+, A5s-A2s, KTs+, QTs+, JTs, ATo+, KJo+",
    call:"22-77, A2s-A8s, K2s-K9s, Q2s-Q9s, J5s-J9s, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o-A9o, K7o-KTo, Q8o+, J8o+, T8o+, 97o+, 87o, 76o, 65o"},
  ],
  2:[
   {mode:'open',name:'SB/BTN 开局',who:'单挑 · 你在按钮先行动',heroPos:'SB',tier:1,
    raise:"22+, A2s+, K2s+, Q2s+, J3s+, T5s+, 95s+, 84s+, 74s+, 63s+, 53s+, 43s, A2o+, K2o+, Q5o+, J7o+, T7o+, 97o+, 86o+, 76o, 65o"},
   {mode:'defense',name:'BB vs SB 开局',who:'单挑 · 大盲防守',heroPos:'BB',vilPos:'SB',tier:1,
    raise:"77+, A9s+, A5s-A4s, KTs+, K9s, QJs, Q9s, ATo+, KQo",
    call:"22-66, A2s-A8s, K2s-K8s, Q2s-QTs, J2s-JTs, T5s-T9s, 95s+, 85s+, 74s+, 64s+, 53s+, A2o-A9o, K2o-KJo, Q5o+, J7o+, T7o+, 97o+, 87o, 76o, 65o"},
  ],
 },
 mtt:{
  d40:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 40bb 前注 · 你先开局',heroPos:'UTG',tier:1,raise:"44+, A9s+, A5s, KTs+, QJs, JTs, T9s, ATo+, KQo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 40bb 前注 · 你先开局',heroPos:'MP',tier:1,raise:"33+, A8s+, A5s-A4s, KTs+, QTs+, J9s+, T9s, 98s, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 40bb 前注 · 你先开局',heroPos:'CO',tier:2,raise:r_co,mix:m_co},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 40bb 前注 · 你先开局',heroPos:'BTN',tier:2,raise:r_btn,mix:m_btn},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 40bb 前注 · 仅剩大盲',heroPos:'SB',tier:3,raise:r_sb,mix:m_sb},
  ],
  d25:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 25bb 中码 · 你先开局',heroPos:'UTG',tier:1,raise:"66+, ATs+, A5s, KJs+, QJs, AJo+, KQo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 25bb 中码 · 你先开局',heroPos:'MP',tier:1,raise:"55+, A9s+, A5s, KTs+, QTs+, JTs, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 25bb 中码 · 你先开局',heroPos:'CO',tier:2,raise:"33+, A7s+, A5s-A2s, K9s+, QTs+, J9s+, T9s, 98s, A9o+, KTo+, QJo"},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 25bb 中码 · 你先开局',heroPos:'BTN',tier:2,raise:"22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, 54s, A7o+, A5o, K9o+, QTo+, JTo"},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 25bb 中码 · 仅剩大盲',heroPos:'SB',tier:3,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T9s, 98s, A8o+, A5o, KTo+, QJo"},
  ],
  d15:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 15bb 浅码 · 你先开局',heroPos:'UTG',tier:1,raise:"77+, AJs+, A5s, KQs, AQo+"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 15bb 浅码 · 你先开局',heroPos:'MP',tier:1,raise:"66+, A9s+, KTs+, QJs, AJo+, KQo"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 15bb 浅码 · 你先开局',heroPos:'CO',tier:2,raise:"44+, A7s+, A5s, K9s+, QTs+, JTs, T9s, ATo+, KJo+"},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 15bb 浅码 · 你先开局',heroPos:'BTN',tier:2,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T9s, A8o+, A5o, KTo+, QJo"},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 15bb 浅码 · 仅剩大盲',heroPos:'SB',tier:3,raise:"33+, A5s+, A2s, K9s+, QTs+, JTs, A9o+, KTo+, QJo"},
  ],
  // d8p/d10/d12p/d15p/d20p push ranges are COMPUTED (Nash, see js/data/pushfold.js); the
  // raise strings (only on d10) are a fallback if that data file fails to load.
  // pf = seat key, pfStack = stack depth to look up in PUSHFOLD.stacks.
  d8p:[
   {mode:'push',name:'UTG 全下/弃',who:'9人桌 · ~8bb · 全下或弃',tier:1,pf:'UTG',pfStack:8},
   {mode:'push',name:'MP 全下/弃',who:'9人桌 · ~8bb · 全下或弃',tier:1,pf:'MP',pfStack:8},
   {mode:'push',name:'CO 全下/弃',who:'9人桌 · ~8bb · 全下或弃',tier:2,pf:'CO',pfStack:8},
   {mode:'push',name:'BTN 全下/弃',who:'9人桌 · ~8bb · 全下或弃',tier:2,pf:'BTN',pfStack:8},
   {mode:'push',name:'SB 全下/弃',who:'9人桌 · ~8bb · 仅剩大盲',tier:3,pf:'SB',pfStack:8},
  ],
  d10:[
   {mode:'push',name:'UTG 全下/弃',who:'9人桌 · ~10bb · 全下或弃',tier:1,pf:'UTG',pfStack:10,raise:"44+, A8s+, A5s, KJs+, QJs, JTs, AJo+, KQo"},
   {mode:'push',name:'MP 全下/弃',who:'9人桌 · ~10bb · 全下或弃',tier:1,pf:'MP',pfStack:10,raise:"22+, A7s+, A5s-A4s, K9s+, QTs+, JTs, T9s, ATo+, KQo"},
   {mode:'push',name:'CO 全下/弃',who:'9人桌 · ~10bb · 全下或弃',tier:2,pf:'CO',pfStack:10,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 98s, A8o+, A5o, KTo+, QJo"},
   {mode:'push',name:'BTN 全下/弃',who:'9人桌 · ~10bb · 全下或弃',tier:2,pf:'BTN',pfStack:10,raise:"22+, A2s+, K3s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, A2o+, K7o+, Q9o+, J9o+, T9o, 98o"},
   {mode:'push',name:'SB 全下/弃',who:'9人桌 · ~10bb · 仅剩大盲',tier:3,pf:'SB',pfStack:10,raise:"22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 64s+, 54s, A2o+, K5o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o"},
  ],
  d12p:[
   {mode:'push',name:'UTG 全下/弃',who:'9人桌 · ~12bb · 全下或弃',tier:1,pf:'UTG',pfStack:12},
   {mode:'push',name:'MP 全下/弃',who:'9人桌 · ~12bb · 全下或弃',tier:1,pf:'MP',pfStack:12},
   {mode:'push',name:'CO 全下/弃',who:'9人桌 · ~12bb · 全下或弃',tier:2,pf:'CO',pfStack:12},
   {mode:'push',name:'BTN 全下/弃',who:'9人桌 · ~12bb · 全下或弃',tier:2,pf:'BTN',pfStack:12},
   {mode:'push',name:'SB 全下/弃',who:'9人桌 · ~12bb · 仅剩大盲',tier:3,pf:'SB',pfStack:12},
  ],
  d15p:[
   {mode:'push',name:'UTG 全下/弃',who:'9人桌 · ~15bb · 全下或弃',tier:1,pf:'UTG',pfStack:15},
   {mode:'push',name:'MP 全下/弃',who:'9人桌 · ~15bb · 全下或弃',tier:1,pf:'MP',pfStack:15},
   {mode:'push',name:'CO 全下/弃',who:'9人桌 · ~15bb · 全下或弃',tier:2,pf:'CO',pfStack:15},
   {mode:'push',name:'BTN 全下/弃',who:'9人桌 · ~15bb · 全下或弃',tier:2,pf:'BTN',pfStack:15},
   {mode:'push',name:'SB 全下/弃',who:'9人桌 · ~15bb · 仅剩大盲',tier:3,pf:'SB',pfStack:15},
  ],
  d20p:[
   {mode:'push',name:'UTG 全下/弃',who:'9人桌 · ~20bb · 全下或弃',tier:1,pf:'UTG',pfStack:20},
   {mode:'push',name:'MP 全下/弃',who:'9人桌 · ~20bb · 全下或弃',tier:1,pf:'MP',pfStack:20},
   {mode:'push',name:'CO 全下/弃',who:'9人桌 · ~20bb · 全下或弃',tier:2,pf:'CO',pfStack:20},
   {mode:'push',name:'BTN 全下/弃',who:'9人桌 · ~20bb · 全下或弃',tier:2,pf:'BTN',pfStack:20},
   {mode:'push',name:'SB 全下/弃',who:'9人桌 · ~20bb · 仅剩大盲',tier:3,pf:'SB',pfStack:20},
  ],
  // hu* = heads-up SB-vs-BB push/fold, COMPUTED (js/data/hu-pushfold.js). Two spots:
  // SB jam (push mode) + BB call-off facing a jam (callshove mode). huSide picks side.
  hu10:[
   {mode:'push',name:'SB 全下/弃',who:'单挑 · ~10bb · SB 全下或弃',tier:1,huStack:10,huSide:'jam'},
   {mode:'callshove',name:'BB 跟注/弃',who:'单挑 · ~10bb · 面对 SB 全下',tier:1,huStack:10,huSide:'call'},
  ],
  hu15:[
   {mode:'push',name:'SB 全下/弃',who:'单挑 · ~15bb · SB 全下或弃',tier:1,huStack:15,huSide:'jam'},
   {mode:'callshove',name:'BB 跟注/弃',who:'单挑 · ~15bb · 面对 SB 全下',tier:1,huStack:15,huSide:'call'},
  ],
  hu20:[
   {mode:'push',name:'SB 全下/弃',who:'单挑 · ~20bb · SB 全下或弃',tier:1,huStack:20,huSide:'jam'},
   {mode:'callshove',name:'BB 跟注/弃',who:'单挑 · ~20bb · 面对 SB 全下',tier:1,huStack:20,huSide:'call'},
  ],
  hu5:[
   {mode:'push',name:'SB 全下/弃',who:'单挑 · ~5bb · SB 全下或弃',tier:1,huStack:5,huSide:'jam'},
   {mode:'callshove',name:'BB 跟注/弃',who:'单挑 · ~5bb · 面对 SB 全下',tier:1,huStack:5,huSide:'call'},
  ],
  hu8:[
   {mode:'push',name:'SB 全下/弃',who:'单挑 · ~8bb · SB 全下或弃',tier:1,huStack:8,huSide:'jam'},
   {mode:'callshove',name:'BB 跟注/弃',who:'单挑 · ~8bb · 面对 SB 全下',tier:1,huStack:8,huSide:'call'},
  ],
  hu12:[
   {mode:'push',name:'SB 全下/弃',who:'单挑 · ~12bb · SB 全下或弃',tier:1,huStack:12,huSide:'jam'},
   {mode:'callshove',name:'BB 跟注/弃',who:'单挑 · ~12bb · 面对 SB 全下',tier:1,huStack:12,huSide:'call'},
  ],
  hu25:[
   {mode:'push',name:'SB 全下/弃',who:'单挑 · ~25bb · SB 全下或弃',tier:1,huStack:25,huSide:'jam'},
   {mode:'callshove',name:'BB 跟注/弃',who:'单挑 · ~25bb · 面对 SB 全下',tier:1,huStack:25,huSide:'call'},
  ],
  // 6 人桌推弃 (COMPUTED 6-max Nash, PUSHFOLD.ring6); pf6 = 6-max seat key.
  p6_10:[
   {mode:'push',name:'UTG 全下/弃',who:'6人桌 · ~10bb · 全下或弃',tier:1,pf6:'UTG',pfStack:10},
   {mode:'push',name:'HJ 全下/弃',who:'6人桌 · ~10bb · 全下或弃',tier:1,pf6:'HJ',pfStack:10},
   {mode:'push',name:'CO 全下/弃',who:'6人桌 · ~10bb · 全下或弃',tier:2,pf6:'CO',pfStack:10},
   {mode:'push',name:'BTN 全下/弃',who:'6人桌 · ~10bb · 全下或弃',tier:2,pf6:'BTN',pfStack:10},
   {mode:'push',name:'SB 全下/弃',who:'6人桌 · ~10bb · 仅剩大盲',tier:3,pf6:'SB',pfStack:10},
  ],
  p6_15:[
   {mode:'push',name:'UTG 全下/弃',who:'6人桌 · ~15bb · 全下或弃',tier:1,pf6:'UTG',pfStack:15},
   {mode:'push',name:'HJ 全下/弃',who:'6人桌 · ~15bb · 全下或弃',tier:1,pf6:'HJ',pfStack:15},
   {mode:'push',name:'CO 全下/弃',who:'6人桌 · ~15bb · 全下或弃',tier:2,pf6:'CO',pfStack:15},
   {mode:'push',name:'BTN 全下/弃',who:'6人桌 · ~15bb · 全下或弃',tier:2,pf6:'BTN',pfStack:15},
   {mode:'push',name:'SB 全下/弃',who:'6人桌 · ~15bb · 仅剩大盲',tier:3,pf6:'SB',pfStack:15},
  ],
  p6_20:[
   {mode:'push',name:'UTG 全下/弃',who:'6人桌 · ~20bb · 全下或弃',tier:1,pf6:'UTG',pfStack:20},
   {mode:'push',name:'HJ 全下/弃',who:'6人桌 · ~20bb · 全下或弃',tier:1,pf6:'HJ',pfStack:20},
   {mode:'push',name:'CO 全下/弃',who:'6人桌 · ~20bb · 全下或弃',tier:2,pf6:'CO',pfStack:20},
   {mode:'push',name:'BTN 全下/弃',who:'6人桌 · ~20bb · 全下或弃',tier:2,pf6:'BTN',pfStack:20},
   {mode:'push',name:'SB 全下/弃',who:'6人桌 · ~20bb · 仅剩大盲',tier:3,pf6:'SB',pfStack:20},
  ],
  // 9 人 面对全下·BB 跟注 (COMPUTED, PUSHFOLD.calloff): BB 面对 BTN 全下跟不跟。
  co10:[
   {mode:'callshove',name:'BB 跟注/弃 vs BTN',who:'9人桌 · ~10bb · 面对 BTN 全下',tier:2,calloff:'btn',coStack:10},
  ],
  co15:[
   {mode:'callshove',name:'BB 跟注/弃 vs BTN',who:'9人桌 · ~15bb · 面对 BTN 全下',tier:2,calloff:'btn',coStack:15},
  ],
  co20:[
   {mode:'callshove',name:'BB 跟注/弃 vs BTN',who:'9人桌 · ~20bb · 面对 BTN 全下',tier:2,calloff:'btn',coStack:20},
  ],
  icm:[
   {mode:'open',name:'UTG · 枪口位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',heroPos:'UTG',tier:1,raise:"88+, AJs+, AKo"},
   {mode:'open',name:'MP · 中位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',heroPos:'MP',tier:1,raise:"77+, ATs+, KQs, AJo+"},
   {mode:'open',name:'CO · 关煞位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',heroPos:'CO',tier:2,raise:"55+, A9s+, KTs+, QJs, ATo+, KQo"},
   {mode:'open',name:'BTN · 按钮位',who:'9人桌 · 泡沫期 ~20bb · 可施压',heroPos:'BTN',tier:2,raise:"33+, A7s+, A5s, K9s+, QTs+, JTs, A9o+, KTo+, QJo"},
   {mode:'open',name:'SB · 小盲位',who:'9人桌 · 泡沫期 ~20bb · 保命收紧',heroPos:'SB',tier:3,raise:"44+, A8s+, KTs+, QJs, ATo+, KQo"},
  ],
  d40_6:[
   {mode:'open',name:'UTG · 枪口位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',heroPos:'UTG',tier:1,raise:"22+, A8s+, A5s, KTs+, QJs, JTs, T9s, AJo+, KQo"},
   {mode:'open',name:'HJ · 劫机位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',heroPos:'HJ',tier:1,raise:"22+, A5s+, A2s, K9s+, QTs+, J9s+, T9s, 98s, ATo+, KJo+, QJo"},
   {mode:'open',name:'CO · 关煞位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',heroPos:'CO',tier:2,raise:"22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, A8o+, A5o, KTo+, QTo+, JTo"},
   {mode:'open',name:'BTN · 按钮位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 你先开局',heroPos:'BTN',tier:2,raise:"22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o"},
   {mode:'open',name:'SB · 小盲位',who:'6人桌 · 40bb 前注 · 终桌/短手 · 仅剩大盲',heroPos:'SB',tier:3,raise:"22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, A2o+, K9o+, Q9o+, J9o+, T9o"},
  ],
  d20_6:[
   {mode:'open',name:'UTG · 枪口位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',heroPos:'UTG',tier:1,raise:"55+, A9s+, A5s, KTs+, QJs, JTs, AJo+, KQo"},
   {mode:'open',name:'HJ · 劫机位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',heroPos:'HJ',tier:1,raise:"44+, A7s+, A5s, K9s+, QTs+, JTs, ATo+, KJo+"},
   {mode:'open',name:'CO · 关煞位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',heroPos:'CO',tier:2,raise:"22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, A8o+, KTo+, QJo"},
   {mode:'open',name:'BTN · 按钮位',who:'6人桌 · ~20bb · 终桌浅码 · 你先开局',heroPos:'BTN',tier:2,raise:"22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 87s, A5o+, K9o+, Q9o+, JTo"},
   {mode:'open',name:'SB · 小盲位',who:'6人桌 · ~20bb · 终桌浅码 · 仅剩大盲',heroPos:'SB',tier:3,raise:"22+, A4s+, K8s+, Q9s+, J9s+, T9s, A8o+, K9o+, QTo+"},
  ],
 },
 face3b:{
  btn:[
   {mode:'face3b',name:'开 BTN，BB 反加',who:'你 BTN 开局 → 大盲 3-bet · 100bb · 你有位置',heroPos:'BTN',vilPos:'BB',tier:1,
    raise:"QQ+, AKs, AKo, A5s, A4s",call:"22-JJ, ATs-AQs, A2s-A5s, KTs-KQs, QTs-QJs, JTs, T9s, 98s, 87s, AJo, AQo, KQo"},
   {mode:'face3b',name:'开 BTN，SB 反加',who:'你 BTN 开局 → 小盲 3-bet · 100bb · 你有位置',heroPos:'BTN',vilPos:'SB',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"22-JJ, ATs-AQs, A2s-A5s, KTs-KQs, QTs-QJs, JTs, T9s, 98s, AJo, AQo, KQo"},
  ],
  co:[
   {mode:'face3b',name:'开 CO，BTN 反加',who:'你 CO 开局 → 按钮位 3-bet · 100bb · 你无位置',heroPos:'CO',vilPos:'BTN',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, ATs-AQs, KJs+, QJs, JTs, AQo"},
   {mode:'face3b',name:'开 CO，BB 反加',who:'你 CO 开局 → 大盲 3-bet · 100bb · 你有位置',heroPos:'CO',vilPos:'BB',tier:2,
    raise:"QQ+, AKs, AKo, A5s, A4s",call:"22-JJ, ATs-AQs, KTs-KQs, QTs-QJs, JTs, T9s, AJo, AQo, KQo"},
  ],
  ep:[
   {mode:'face3b',name:'开 前位，被反加',who:'你 UTG/HJ 开局 → 被 3-bet · 100bb · 范围已很强',heroPos:'UTG',vilPos:'BB',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, AQs, AJs, KQs"},
  ],
 },
 face4b:{
  ip:[
   {mode:'face4b',name:'你 BTN 3bet 被 4bet',who:'你按钮位 3-bet → 对手 4-bet · 100bb · 你有位置',heroPos:'BTN',vilPos:'CO',tier:1,
    raise:"KK+, AKs, A5s",call:"QQ, JJ, AKo, AQs"},
  ],
  oop:[
   {mode:'face4b',name:'你盲位 3bet 被 4bet',who:'你盲位 3-bet → 对手 4-bet · 100bb · 你无位置',heroPos:'SB',vilPos:'BTN',tier:1,
    raise:"KK+, AKs, AKo, A5s",call:"QQ"},
  ],
 },
 squeeze:{
  bb:[
   {mode:'squeeze',name:'大盲挤压',who:'前位开局 + 有人跟注 → 你在大盲 · 100bb · 无位置',heroPos:'BB',vilPos:['UTG','HJ'],tier:1,
    raise:"QQ+, AKs, AKo, AJs, A5s",call:"22-JJ, ATs-AQs, KQs, KJs, QJs, JTs, T9s, 98s"},
  ],
  btn:[
   {mode:'squeeze',name:'按钮挤压',who:'前位开局 + 有人跟注 → 你在按钮 · 100bb · 有位置',heroPos:'BTN',vilPos:['UTG','CO'],tier:1,
    raise:"TT+, AQs+, AKo, AJs, KQs, A5s, A4s",call:"22-99, ATs, KJs, QJs, JTs, T9s, 98s, 87s, AJo"},
  ],
 },
 coldcall:{
  btn:[
   {mode:'defense',name:'BTN 冷跟 vs CO',who:'CO 开局 → 你在按钮 · 100bb · 有位置',heroPos:'BTN',vilPos:'CO',tier:1,
    raise:"QQ+, AKs, AKo, AJs, A5s, A4s",call:"22-JJ, ATs, KTs-KQs, QTs-QJs, JTs, T9s, 98s, 87s, AQs, AQo, KQo, KJo"},
   {mode:'defense',name:'BTN 冷跟 vs UTG',who:'UTG 开局 → 你在按钮 · 100bb · 对手范围强',heroPos:'BTN',vilPos:'UTG',tier:2,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, ATs-AQs, KQs, KJs, QJs, JTs, AQo"},
  ],
  co:[
   {mode:'defense',name:'CO 冷跟 vs UTG',who:'UTG 开局 → 你在 CO · 100bb · 身后还有人（挤压风险）',heroPos:'CO',vilPos:'UTG',tier:1,
    raise:"QQ+, AKs, AKo, A5s",call:"99-JJ, AJs-AQs, KQs, JTs, AQo"},
  ],
 },
};
Object.values(PACKS).forEach(f=>Object.values(f).forEach(arr=>arr.forEach(t=>{
 t.R=expand(t.raise);t.C=expand(t.call);t.M=expand(t.mix);
 t.union=[...new Set([...t.R,...t.C,...t.M])];
 // per-spot provenance / confidence (lets the app be honest spot-by-spot):
 //  precise  = backed by a real freqTable import / solved Nash (shows the 「精准」chip)
 //  curated  = hand-checked for magnitude+shape, mix freqs are ~placeholders (no chip)
 t.confidence = t.confidence || (t.freqTable ? 'precise' : 'curated');
 t.src = t.src || '';
})));

/* Override every push spot tagged with {pf, pfStack} using the COMPUTED Nash
   data when present (js/data/pushfold.js loads before this file). shove freq ->
   R (pure, >=0.995), M (mixed) + a precise freqTable; the rest fold. */
// 共享:把 hand->freq 表灌进 spot(纯推 0.995+/混合 0.005+ 阈值、freqTable、precise 标记)。
// 此前 applyComputedPushfold 与 applyComputedHU 各持一份逐字拷贝,调阈值改一处漏一处。
const _pfRnd=x=>Math.round(x*1000)/1000;
function _pfFill(t,tbl,act,src){
 const R=new Set(),C=new Set(),M=new Set(),freqTable={};
 for(const hand in tbl){ const fr=tbl[hand];
  if(fr>=0.995){ (act==='call'?C:R).add(hand); freqTable[hand]={[act]:1}; }
  else if(fr>0.005){ M.add(hand); freqTable[hand]={[act]:_pfRnd(fr),fold:_pfRnd(1-fr)}; }
 }
 t.R=R; t.C=C; t.M=M; t.union=[...new Set([...R,...C,...M])];
 t.freqTable=freqTable; t.confidence='precise'; t.src=src;
}
(function applyComputedPushfold(){
 // 数据文件缺失≠可以静默:大多数推弃/跟注档没有手搓兜底范围,静默跳过会让这些档
 // 变成「空范围=每手都该弃」,训练器教出完全错误的答案却无任何提示
 if(typeof PUSHFOLD==='undefined'){ try{console.warn('packs: js/data/pushfold.js 未加载——推弃/跟注档将退化为空范围(全弃),请检查部署');}catch(e){} return; }

 const model=PUSHFOLD.meta.model, exp=PUSHFOLD.meta.exploitability||{}, exp6=PUSHFOLD.meta.exploitability6||{};
 const dis=(e,s)=>e[s]!=null?` · 可剥削度~${e[s]}bb/手`:'';
 Object.values(PACKS).forEach(f=>Object.values(f).forEach(arr=>arr.forEach(t=>{
  if(t.pf && t.pfStack!=null){                               // 9-max jam (push)
   const s=PUSHFOLD.stacks[t.pfStack], tbl=s&&s.seats[t.pf]; if(!tbl){try{console.warn("packs: 推弃数据缺 "+t.pfStack+"bb/"+t.pf+",该档保持空范围");}catch(e){} return;}
   _pfFill(t,tbl,'shove',`computed ${t.pfStack}bb Nash (${model}${dis(exp,t.pfStack)})`);
   if(s.seatsEV&&s.seatsEV[t.pf]){t.evTable=s.seatsEV[t.pf];t.evAct='shove';} // 求解器每手 EV(bb,相对弃牌)
  } else if(t.pf6 && t.pfStack!=null){                        // 6-max jam (push)
   const s=PUSHFOLD.ring6&&PUSHFOLD.ring6[t.pfStack], tbl=s&&s.seats[t.pf6]; if(!tbl){try{console.warn("packs: 6人推弃数据缺 "+t.pfStack+"bb/"+t.pf6+",该档保持空范围");}catch(e){} return;}
   _pfFill(t,tbl,'shove',`computed ${t.pfStack}bb 6人 Nash${dis(exp6,t.pfStack)}`);
   if(s.seatsEV&&s.seatsEV[t.pf6]){t.evTable=s.seatsEV[t.pf6];t.evAct='shove';}
  } else if(t.calloff && t.coStack!=null){                    // 9-max BB call-off vs a jam (callshove)
   const s=PUSHFOLD.calloff&&PUSHFOLD.calloff[t.coStack], tbl=s&&s[t.calloff]; if(!tbl){try{console.warn("packs: 跟注数据缺 "+t.coStack+"bb/"+t.calloff+",该档保持空范围");}catch(e){} return;}
   _pfFill(t,tbl,'call',`computed ${t.coStack}bb 跟注 Nash${dis(exp,t.coStack)}`);
   if(s[t.calloff+'EV']){t.evTable=s[t.calloff+'EV'];t.evAct='call';}
  }
 })));
})();

/* Override the heads-up spots tagged with {huStack, huSide} from the computed
   HU Nash (js/data/hu-pushfold.js). jam side -> push mode (R=shove), call side
   -> callshove mode (C=call); both get a precise freqTable. */
(function applyComputedHU(){
 if(typeof HU_PUSHFOLD==='undefined'){ try{console.warn('packs: js/data/hu-pushfold.js 未加载——HU 推弃档将退化为空范围(全弃),请检查部署');}catch(e){} return; }
 Object.values(PACKS).forEach(f=>Object.values(f).forEach(arr=>arr.forEach(t=>{
  if(t.huStack==null)return;
  const st=HU_PUSHFOLD.stacks[t.huStack]; if(!st){try{console.warn("packs: HU 数据缺 "+t.huStack+"bb,该档保持空范围");}catch(e){} return;}
  const jam=t.huSide==='jam';
  const tbl=jam?st.jam:st.call, act=jam?'shove':'call';
  const reg=HU_PUSHFOLD.meta.exploitability && HU_PUSHFOLD.meta.exploitability[t.huStack];
  _pfFill(t,tbl,act,`computed ${t.huStack}bb HU Nash`+(reg!=null?` · 可剥削度~${reg}bb/手`:''));
  const ev=jam?st.jamEV:st.callEV;                            // 求解器每手 EV(bb,相对弃牌)
  if(ev){t.evTable=ev;t.evAct=act;}
 })));
})();

const PREMIUM=new Set(['AA','KK','QQ','JJ','AKs','AKo','AQs']);
