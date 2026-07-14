'use strict';
/*
 * monotonic.js — enforce hand-domination monotonicity on a computed push/fold
 * (or call-off) frequency table.
 *
 * Why: the Nash ranges are solved with Monte-Carlo class equity. Hands sitting
 * right at the jam/fold (or call/fold) indifference threshold are near-EV-equal,
 * so sampling noise can flip a hand to fold even though a strictly STRONGER hand
 * of the same type still acts (e.g. KQo jams, KTo jams 25%, but KJo dropped to 0).
 * That non-monotonicity is a display artifact, not real strategy.
 *
 * Fix: within the same suitedness class, if hand A dominates hand B (A's high AND
 * low rank are both >= B's), then freq(A) >= freq(B). We pull every hand up to the
 * max frequency of anything it dominates. Domination is transitive, so a single
 * pass over the full 169-hand space against the RAW table is exact. EV cost is
 * negligible (these hands are near-indifferent), and the chart becomes monotonic.
 */
const RANK = 'AKQJT98765432';                 // index 0 = A (strongest) … 12 = 2

// all 169 canonical hand labels (pairs, suited i<j, offsuit i>j -> hi+lo+o)
const ALL_HANDS = (() => {
  const out = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
    if (i === j) out.push(RANK[i] + RANK[i]);
    else if (i < j) out.push(RANK[i] + RANK[j] + 's');
    else out.push(RANK[j] + RANK[i] + 'o');
  }
  return [...new Set(out)];
})();

function parse(h) {
  if (h.length === 2) return { t: 'p', hi: RANK.indexOf(h[0]), lo: RANK.indexOf(h[1]) };
  return { t: h[2], hi: RANK.indexOf(h[0]), lo: RANK.indexOf(h[1]) };
}
// A is at least as strong as B (same class, both ranks no weaker)
function dominates(A, B) { return A.t === B.t && A.hi <= B.hi && A.lo <= B.lo; }

/* enforceMonotonic(table) -> new table where freq(A) = max raw freq over every
 * hand A dominates (incl. itself). Missing hands count as 0; zeros are dropped. */
function enforceMonotonic(table) {
  const raw = {}, P = {};
  for (const h of ALL_HANDS) { raw[h] = table[h] || 0; P[h] = parse(h); }
  const out = {};
  for (const A of ALL_HANDS) {
    let v = raw[A];
    for (const B of ALL_HANDS) if (A !== B && raw[B] > v && dominates(P[A], P[B])) v = raw[B];
    if (v > 0) out[A] = v;
  }
  return out;
}

/* enforceStackMonotonic(bySt) — **跨筹码档**单调性(2026-07 加,修 20bb CO 的公开 bug)。
 *
 * Why: enforceMonotonic 只在**同一档之内**按牌力支配关系拉平,从不跨档比较。于是 20bb 的
 * CO 行可以推得比 15bb 还宽(KJo/QJo/KTo/QTo/JTo 在 15bb 推 0.26、在 20bb 推 1.00)——
 * 筹码越深推得越宽,方向是反的,而这个错在 app 里公开展示了几个月没人发现。
 * 根因是一手 EV≈0 的边缘牌被求解噪声打成纯策略(freq=1),再被同档的支配链一路上推。
 *
 * 不变量:推弃博弈里筹码越深、被跟时输得越多、拿到的还是同样的盲注 → **同一座位、同一手牌
 * 的全下频率必须随筹码深度非递增**。据此把每手牌的频率压成沿 stack 非递增(取「不超过更浅档
 * 的频率」),噪声造成的反向凸起被抹平,真实的收紧不受影响。
 *
 * 入参 bySt = { <stack>: { <pos>: {hand:freq} } },原地返回新表(不改入参)。
 */
function enforceStackMonotonic(bySt) {
  const stacks = Object.keys(bySt).map(Number).sort((a, b) => a - b); // 浅 → 深
  const out = {};
  for (const S of stacks) out[S] = {};
  for (const S of stacks) for (const pos of Object.keys(bySt[S])) out[S][pos] = { ...bySt[S][pos] };
  for (let i = 1; i < stacks.length; i++) {
    const S = stacks[i], prev = stacks[i - 1];
    for (const pos of Object.keys(out[S])) {
      const cur = out[S][pos], up = out[prev][pos];
      if (!up) continue;
      for (const h of Object.keys(cur)) {
        const cap = up[h] || 0;               // 更浅一档没推的牌,更深档也不该推
        if (cur[h] > cap) { if (cap > 0) cur[h] = cap; else delete cur[h]; }
      }
    }
  }
  return out;
}

module.exports = { enforceMonotonic, enforceStackMonotonic, ALL_HANDS, dominates, parse };
