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

module.exports = { enforceMonotonic, ALL_HANDS, dominates, parse };
