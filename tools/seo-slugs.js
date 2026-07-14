'use strict';
/*
 * seo-slugs.js — 落地页的**冻结** slug 表(唯一事实源)。
 *
 * ⛔ 铁律:**slug 一经发布永不可改**——外链与搜索收录都挂在 URL 上,改名 = 全断。
 *    页面改标题/改文案随便改,slug 不动。新增页型往后追加即可。
 *
 * 每条 = 一张 spoke 落地页,`sel` 描述它从哪份真实数据取内容(生成器据此取图与 EV):
 *   rfi      → PACKS.cash[players] 里 mode=open & heroPos 的 spot(13×13 开局范围图)
 *   defense  → PACKS.cash[players] 里 mode=defense & vilPos 的 spot(3bet/跟注/弃 三色图)
 *   jam9     → PUSHFOLD.stacks[bb]  (9 人桌推弃:每手频率 seats + 每手 EV seatsEV)
 *   jam6     → PUSHFOLD.ring6[bb]   (6 人终桌推弃,同结构)
 *   calloff  → PUSHFOLD.calloff[bb].btn (大盲跟 BTN 全下)
 *   hu       → HU_PUSHFOLD.stacks[bb](单挑 SB 全下 + BB 跟注,双频率双 EV)
 */
module.exports = [
  /* ——— 现金局 100bb · RFI 开局范围(6 人桌)——— */
  { slug: 'utg-opening-range-6max', type: 'rfi', sel: { players: 6, pos: 'UTG' } },
  { slug: 'hj-opening-range-6max',  type: 'rfi', sel: { players: 6, pos: 'HJ' } },
  { slug: 'co-opening-range-6max',  type: 'rfi', sel: { players: 6, pos: 'CO' } },
  { slug: 'btn-opening-range-6max', type: 'rfi', sel: { players: 6, pos: 'BTN' } },
  { slug: 'sb-opening-range-6max',  type: 'rfi', sel: { players: 6, pos: 'SB' } },

  /* ——— 现金局 100bb · RFI 开局范围(9 人桌)———
     ⚠ 只有 UTG/MP 是 9 人桌独有的更紧范围。9 人桌的 CO/BTN/SB 与 6 人桌**共用同一份范围**
     (packs.js 的 r_co/r_btn/r_sb),身后人数相同,逐格一致 —— 若也各出一页,就是三张逐字
     重复的页(Google scaled-content 判据)。故不生成,由 6max 那三页承接。 */
  { slug: 'utg-opening-range-9max', type: 'rfi', sel: { players: 9, pos: 'UTG' } },
  { slug: 'mp-opening-range-9max',  type: 'rfi', sel: { players: 9, pos: 'MP' } },

  /* ——— 大盲防守 ——— */
  { slug: 'bb-defense-vs-btn-6max', type: 'defense', sel: { players: 6, vil: 'BTN' } },
  { slug: 'bb-defense-vs-co-6max',  type: 'defense', sel: { players: 6, vil: 'CO' } },
  { slug: 'bb-defense-vs-utg-6max', type: 'defense', sel: { players: 6, vil: 'UTG' } },

  /* ——— 推弃 Nash · 9 人桌(每手频率 + 每手 EV,自算)——— */
  { slug: 'push-fold-chart-8bb',  type: 'jam9', sel: { bb: 8 } },
  { slug: 'push-fold-chart-10bb', type: 'jam9', sel: { bb: 10 } },
  { slug: 'push-fold-chart-12bb', type: 'jam9', sel: { bb: 12 } },
  { slug: 'push-fold-chart-15bb', type: 'jam9', sel: { bb: 15 } },
  /* 20bb:曾因该档 CO 行未收敛(15bb 推 0.26 的杂色大牌到 20bb 变成 1.0,方向反了)扣住不发。
     2026-07 已修 —— 提样本(4000→25000)消掉纯策略爆炸 + monotonic.js 加跨档单调性,
     现在 CO 20bb=15%(< 15bb 的 20%),test/pushfold-invariants.test.js 钉住不变量。 */
  { slug: 'push-fold-chart-20bb', type: 'jam9', sel: { bb: 20 } },

  /* ⚠ 6 人终桌推弃(PUSHFOLD.ring6)同理:CO/BTN/SB 三档与 9 人桌逐格相同(身后人数相同),
     只有 UTG/HJ 不同 —— 单独出页 = 60% 重复内容,phase 1 不做,并入 9 人桌页的 6-max 备注。 */

  /* ——— 单挑推弃 Nash(SB 全下 + BB 跟注)——— */
  { slug: 'heads-up-push-fold-5bb',  type: 'hu', sel: { bb: 5 } },
  { slug: 'heads-up-push-fold-8bb',  type: 'hu', sel: { bb: 8 } },
  { slug: 'heads-up-push-fold-10bb', type: 'hu', sel: { bb: 10 } },
  { slug: 'heads-up-push-fold-12bb', type: 'hu', sel: { bb: 12 } },
  { slug: 'heads-up-push-fold-15bb', type: 'hu', sel: { bb: 15 } },
  { slug: 'heads-up-push-fold-20bb', type: 'hu', sel: { bb: 20 } },
  { slug: 'heads-up-push-fold-25bb', type: 'hu', sel: { bb: 25 } },

  /* ——— 大盲跟注全下(vs BTN)——— */
  { slug: 'bb-call-vs-jam-10bb', type: 'calloff', sel: { bb: 10 } },
  { slug: 'bb-call-vs-jam-15bb', type: 'calloff', sel: { bb: 15 } },
  { slug: 'bb-call-vs-jam-20bb', type: 'calloff', sel: { bb: 20 } },
];
