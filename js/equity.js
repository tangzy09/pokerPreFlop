'use strict';
/*
 * equity.js — exact all-in hold'em equity engine (dependency-free, pure JS).
 *
 * Dual-loaded: required by the offline tools (Node) to COMPUTE push/fold data,
 * AND loaded as a plain <script> in the browser for the Range-vs-Range tool —
 * so it must stay free of Node APIs and ES-module syntax (PRODUCT.md §2).
 * Cards are integers 0..51 with
 *   card = rank*4 + suit,  rank 0='2' .. 12='A',  suit 0..3.
 */

const RV = { '2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'T':8,'J':9,'Q':10,'K':11,'A':12 };
const SV = { 's':0,'h':1,'d':2,'c':3 };          // spade/heart/diamond/club
const RC = '23456789TJQKA';
const SC = 'shdc';

const card = (rank, suit) => rank * 4 + suit;
const cardRank = (c) => (c / 4) | 0;
const cardSuit = (c) => c % 4;
const cardStr = (c) => RC[cardRank(c)] + SC[cardSuit(c)];
function parseCard(s) {                            // "Ah" -> int
  const r = RV[s[0]], su = SV[s[1].toLowerCase()];
  if (r === undefined || su === undefined) throw new Error('bad card ' + s);
  return card(r, su);
}

// ---- 7-card evaluator: returns an integer; higher is a better hand ----
function ranksFromMask(m) { const a = []; for (let r = 12; r >= 0; r--) if (m & (1 << r)) a.push(r); return a; }
function straightHigh(mask) {
  for (let top = 12; top >= 4; top--) {
    let ok = true;
    for (let k = 0; k < 5; k++) if (!(mask & (1 << (top - k)))) { ok = false; break; }
    if (ok) return top;
  }
  // wheel A-2-3-4-5: needs the ace (bit 12) AND all of 2,3,4,5 (bits 0..3)
  if ((mask & (1 << 12)) && (mask & 0b1111) === 0b1111) return 3;
  return -1;
}
function score(cat, tb) {                          // cat 0..8, tb up to 5 rank values
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 16 + (tb[i] || 0);
  return v;
}
function evaluate7(cs) {
  const rc = new Array(13).fill(0), sc = new Array(4).fill(0), srm = [0, 0, 0, 0];
  let rm = 0;
  for (let i = 0; i < 7; i++) { const c = cs[i], r = (c / 4) | 0, s = c % 4; rc[r]++; sc[s]++; srm[s] |= (1 << r); rm |= (1 << r); }
  let flushSuit = -1; for (let s = 0; s < 4; s++) if (sc[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) { const sf = straightHigh(srm[flushSuit]); if (sf >= 0) return score(8, [sf]); }

  let quad = -1; const trips = [], pairs = [];
  for (let r = 12; r >= 0; r--) { if (rc[r] === 4) quad = r; else if (rc[r] === 3) trips.push(r); else if (rc[r] === 2) pairs.push(r); }

  if (quad >= 0) { let k = -1; for (let r = 12; r >= 0; r--) if (r !== quad && rc[r] > 0) { k = r; break; } return score(7, [quad, k]); }
  if (trips.length && (pairs.length || trips.length >= 2)) {
    const t = trips[0]; let p = pairs.length ? pairs[0] : -1; if (trips.length >= 2) p = Math.max(p, trips[1]);
    return score(6, [t, p]);
  }
  if (flushSuit >= 0) return score(5, ranksFromMask(srm[flushSuit]).slice(0, 5));
  const st = straightHigh(rm); if (st >= 0) return score(4, [st]);
  if (trips.length) { const t = trips[0]; const ks = []; for (let r = 12; r >= 0 && ks.length < 2; r--) if (r !== t && rc[r] > 0) ks.push(r); return score(3, [t, ...ks]); }
  if (pairs.length >= 2) { const [p1, p2] = pairs; let k = -1; for (let r = 12; r >= 0; r--) if (r !== p1 && r !== p2 && rc[r] > 0) { k = r; break; } return score(2, [p1, p2, k]); }
  if (pairs.length === 1) { const p = pairs[0]; const ks = []; for (let r = 12; r >= 0 && ks.length < 3; r--) if (r !== p && rc[r] > 0) ks.push(r); return score(1, [p, ...ks]); }
  return score(0, ranksFromMask(rm).slice(0, 5));
}

// ---- combos for a hand label ("AA" / "AKs" / "AKo") -> array of [cardA,cardB] ----
function comboCards(label) {
  const r1 = RV[label[0]], r2 = RV[label[1]], out = [];
  if (label.length === 2) { for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([card(r1, a), card(r1, b)]); return out; }
  const suited = label[2] === 's';
  if (suited) { for (let s = 0; s < 4; s++) out.push([card(r1, s), card(r2, s)]); }
  else { for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([card(r1, a), card(r2, b)]); }
  return out;
}

// ---- exact equity of hero[2] vs villain[2] over all C(48,5) boards ----
function equityExact(hero, villain) {
  const dead = new Set([...hero, ...villain]);
  if (dead.size !== 4) throw new Error('card conflict between hands');
  const deck = []; for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  const n = deck.length;             // 48
  const h7 = [hero[0], hero[1], 0, 0, 0, 0, 0];
  const v7 = [villain[0], villain[1], 0, 0, 0, 0, 0];
  let win = 0, lose = 0, tie = 0, total = 0;
  for (let a = 0; a < n - 4; a++) { h7[2] = v7[2] = deck[a];
    for (let b = a + 1; b < n - 3; b++) { h7[3] = v7[3] = deck[b];
      for (let c = b + 1; c < n - 2; c++) { h7[4] = v7[4] = deck[c];
        for (let d = c + 1; d < n - 1; d++) { h7[5] = v7[5] = deck[d];
          for (let e = d + 1; e < n; e++) { h7[6] = v7[6] = deck[e];
            const hs = evaluate7(h7), vs = evaluate7(v7);
            if (hs > vs) win++; else if (hs < vs) lose++; else tie++;
            total++;
          }}}}}
  return (win + tie / 2) / total;
}

// ---- seeded RNG (deterministic, reproducible Monte-Carlo) ----
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Monte-Carlo equity of hero[2] vs villain[2] over n random boards ----
function equityMC(hero, villain, n, rng) {
  const dead = new Set([...hero, ...villain]);
  const deck = []; for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  const m = deck.length;
  const h7 = [hero[0], hero[1], 0, 0, 0, 0, 0];
  const v7 = [villain[0], villain[1], 0, 0, 0, 0, 0];
  let win = 0, tie = 0;
  for (let it = 0; it < n; it++) {
    for (let k = 0; k < 5; k++) {                  // partial Fisher-Yates: first 5 = board
      const j = k + ((rng() * (m - k)) | 0);
      const tmp = deck[k]; deck[k] = deck[j]; deck[j] = tmp;
      h7[2 + k] = v7[2 + k] = deck[k];
    }
    const hs = evaluate7(h7), vs = evaluate7(v7);
    if (hs > vs) win++; else if (hs === vs) tie++;
  }
  return (win + tie / 2) / n;
}

// ---- equity of hand-class label1 vs label2, averaged over combos + boards ----
// (naturally includes cross-blockers between the two specific hands)
function classEquity(label1, label2, n, rng) {
  const c1 = comboCards(label1), c2 = comboCards(label2);
  const h7 = [0, 0, 0, 0, 0, 0, 0], v7 = [0, 0, 0, 0, 0, 0, 0];
  let win = 0, tie = 0, done = 0;
  while (done < n) {
    const a = c1[(rng() * c1.length) | 0];
    const b = c2[(rng() * c2.length) | 0];
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue; // conflict
    const dead = new Set([a[0], a[1], b[0], b[1]]);
    const deck = []; for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
    const m = deck.length;
    h7[0] = a[0]; h7[1] = a[1]; v7[0] = b[0]; v7[1] = b[1];
    for (let k = 0; k < 5; k++) {
      const j = k + ((rng() * (m - k)) | 0);
      const tmp = deck[k]; deck[k] = deck[j]; deck[j] = tmp;
      h7[2 + k] = v7[2 + k] = deck[k];
    }
    const hs = evaluate7(h7), vs = evaluate7(v7);
    if (hs > vs) win++; else if (hs === vs) tie++;
    done++;
  }
  return (win + tie / 2) / n;
}

// ---- all combos for a list of hand labels (combo-weighted: AKo→12, AKs→4, AA→6) ----
function rangeCombos(labels) { const out = []; for (const L of labels) for (const c of comboCards(L)) out.push(c); return out; }

// ---- equity of range1 vs range2 (arrays of hand labels) all-in preflop ----
// Monte-Carlo: each iter samples one combo from each range (uniform over combos
// ⇒ naturally combo-weighted) and a random 5-card board, skipping card conflicts.
// Returns range1's equity in [0,1], or null if the ranges can never be dealt apart.
function rangeEquity(labels1, labels2, n, rng) {
  const A = rangeCombos(labels1), B = rangeCombos(labels2);
  if (!A.length || !B.length) return null;
  const h7 = [0, 0, 0, 0, 0, 0, 0], v7 = [0, 0, 0, 0, 0, 0, 0];
  let win = 0, tie = 0, done = 0, tries = 0;
  const maxTries = n * 50 + 1000;                  // guard heavily-blocked pairs (e.g. AA vs AA)
  while (done < n && tries < maxTries) {
    tries++;
    const a = A[(rng() * A.length) | 0], b = B[(rng() * B.length) | 0];
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
    const dead = new Set([a[0], a[1], b[0], b[1]]);
    const deck = []; for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
    const m = deck.length;
    h7[0] = a[0]; h7[1] = a[1]; v7[0] = b[0]; v7[1] = b[1];
    for (let k = 0; k < 5; k++) { const j = k + ((rng() * (m - k)) | 0); const t = deck[k]; deck[k] = deck[j]; deck[j] = t; h7[2 + k] = v7[2 + k] = deck[k]; }
    const hs = evaluate7(h7), vs = evaluate7(v7);
    if (hs > vs) win++; else if (hs === vs) tie++;
    done++;
  }
  return done ? (win + tie / 2) / done : null;
}

// ---- equity of range1 vs range2 on a GIVEN partial board (3/4/5 cards already out) ----
// Like rangeEquity but the board cards are fixed; deals the remaining (5 - board.length)
// cards each iter. Skips combos that conflict with the board or each other. board is an
// array of card ints. Returns range1's equity in [0,1], or null if undealable.
function rangeEquityBoard(labels1, labels2, board, n, rng) {
  const A = rangeCombos(labels1), B = rangeCombos(labels2);
  if (!A.length || !B.length) return null;
  const bset = new Set(board);
  if (bset.size !== board.length || board.length > 5) return null;
  const need = 5 - board.length;
  const h7 = [0, 0, 0, 0, 0, 0, 0], v7 = [0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < board.length; k++) { h7[2 + k] = v7[2 + k] = board[k]; }
  let win = 0, tie = 0, done = 0, tries = 0;
  const maxTries = n * 50 + 1000;
  while (done < n && tries < maxTries) {
    tries++;
    const a = A[(rng() * A.length) | 0], b = B[(rng() * B.length) | 0];
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
    if (bset.has(a[0]) || bset.has(a[1]) || bset.has(b[0]) || bset.has(b[1])) continue;
    h7[0] = a[0]; h7[1] = a[1]; v7[0] = b[0]; v7[1] = b[1];
    if (need > 0) {
      const dead = new Set([a[0], a[1], b[0], b[1]]); for (const c of board) dead.add(c);
      const deck = []; for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
      const m = deck.length;
      for (let k = 0; k < need; k++) { const j = k + ((rng() * (m - k)) | 0); const t = deck[k]; deck[k] = deck[j]; deck[j] = t; h7[2 + board.length + k] = v7[2 + board.length + k] = deck[k]; }
    }
    const hs = evaluate7(h7), vs = evaluate7(v7);
    if (hs > vs) win++; else if (hs === vs) tie++;
    done++;
  }
  return done ? (win + tie / 2) / done : null;
}

const EQUITY_API = { card, cardRank, cardSuit, cardStr, parseCard, evaluate7, comboCards,
  equityExact, equityMC, classEquity, rangeCombos, rangeEquity, rangeEquityBoard, mulberry32, RV, SV, RC, SC };
if (typeof module !== 'undefined' && module.exports) module.exports = EQUITY_API; // Node (tools); in the browser the names above are plain globals
