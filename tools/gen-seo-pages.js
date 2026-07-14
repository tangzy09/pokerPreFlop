'use strict';
/*
 * gen-seo-pages.js — 从真实范围/Nash 数据生成落地页(24 张 spoke × en/zh)+ pillar + sitemap + robots。
 *
 * 每页 = 直接答案段(首屏,AI Overviews 取材)+ **完整 13×13 静态图**(HTML 表格,爬虫可读)
 *      + 范围文本 + 组合数/百分比 + 边缘混合带 + **每手 EV 表**(推弃页,自算 Nash,独家)
 *      + 人工策略正文 + 可见 FAQ(<details>)+ 相关图内链 + CTA 回 app
 *      + Course/BreadcrumbList/FAQPage JSON-LD(不放编造评分 —— 诚实红线)。
 *
 * 数据源:js/packs.js(RFI/防守范围)、js/data/pushfold.js + hu-pushfold.js(推弃 Nash + EV)。
 * 改题库/文案后重跑:node tools/gen-seo-pages.js
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PAGES = require('./seo-slugs.js');
const C = require('./seo-content.js');

const root = path.join(__dirname, '..');
const SITE = 'https://pre-flop.ai-speeds.com';
const OUT = path.join(root, 'charts');

/* ——— 载入真实数据(纯全局脚本,用 vm 跑) ——— */
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/ranges.js', 'js/data/pushfold.js', 'js/data/hu-pushfold.js', 'js/packs.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
vm.runInContext('globalThis.__o={PACKS,PUSHFOLD,HU_PUSHFOLD,RANKS};', ctx);
const { PACKS, PUSHFOLD, HU_PUSHFOLD, RANKS } = ctx.__o;

/* ——— 工具 ——— */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* 文案里用 **粗体** 标重点(markdown 写法)。页面上要变成 <b>,进 meta/JSON-LD 时要脱掉标记 ——
   ⚠ 忘了处理会让星号原样印在页面上(实测中文 lead 里出现过 `**以 bb 为单位的期望值**`)。 */
const mdBold = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const stripMd = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '$1');

/* ——— 文案里的 {占位符} 由生成器从真实数据填 ———
   ⚠ 别在文案里手打百分比:推弃数据一重算(2026-07 提样本修 20bb 那次),手打的数字立刻和图对不上,
   而页面上图与文互相矛盾比数字略旧糟得多。所有会随数据变的数字一律走占位符。
   fill() 找不到的占位符**直接抛错**(而不是留个 {jam} 印在页面上)。 */
function fill(s, vars) {
  return String(s).replace(/\{([\w@]+)\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`文案占位符 {${k}} 无对应数据(可用:${Object.keys(vars).join(',')})`);
    return vars[k];
  });
}
/* SEO 长度按**显示宽度**算,CJK 一个字顶两个(title 30–60 / desc 70–155) */
const CJK = /[⺀-鿿　-ヿ가-힯＀-￯]/;
const effLen = (s) => [...String(s)].reduce((a, c) => a + (CJK.test(c) ? 2 : 1), 0);
function clampEff(s, max) {
  s = String(s).trim();
  if (effLen(s) <= max) return s;
  let out = '', w = 0;
  for (const ch of s) {
    const cw = CJK.test(ch) ? 2 : 1;
    if (w + cw > max - 1) break;
    out += ch; w += cw;
  }
  const sp = out.lastIndexOf(' ');
  if (sp > max * 0.6) out = out.slice(0, sp);
  return out.replace(/[\s,;:—-]+$/, '') + '…';
}
/* 标题:超 60 先丢中缀、再截名字;同时保 30 下限(短名字必须留品牌后缀) */
function buildTitle(name, mid, brand, max = 60) {
  const full = mid ? `${name} — ${mid} | ${brand}` : `${name} | ${brand}`;
  if (effLen(full) <= max) return full;
  const noMid = `${name} | ${brand}`;
  if (effLen(noMid) <= max) return noMid;
  return `${clampEff(name, max - effLen(` | ${brand}`))} | ${brand}`;
}
const combosOf = (h) => (h.length === 2 ? 6 : h.endsWith('s') ? 4 : 12);
const TOTAL_COMBOS = 1326;
/* 加权组合占比(频率 0–1 的混合手按频率计) */
function weightPct(freqMap) {
  let c = 0;
  for (const h in freqMap) c += combosOf(h) * freqMap[h];
  return { combos: Math.round(c), pct: (c / TOTAL_COMBOS * 100).toFixed(1) };
}
function setPct(set) {
  let c = 0;
  for (const h of set) c += combosOf(h);
  return { combos: c, pct: (c / TOTAL_COMBOS * 100).toFixed(1) };
}

/* ——— 13×13 图:cat(hand) → 分类;ev(hand) → 每手 EV(可选,进 title 属性) ——— */
function grid(catOf, evOf) {
  let html = '<div class="gridwrap"><table class="grid"><tbody>';
  for (let i = 0; i < 13; i++) {
    html += '<tr>';
    for (let j = 0; j < 13; j++) {
      const hand = i === j ? RANKS[i] + RANKS[i] : i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o';
      const cat = catOf(hand) || 'fold';
      const ev = evOf ? evOf(hand) : null;
      const tip = ev === null || ev === undefined ? hand : `${hand} · EV ${ev > 0 ? '+' : ''}${ev}bb`;
      html += `<td class="g-${cat}" title="${esc(tip)}">${hand}</td>`;
    }
    html += '</tr>';
  }
  return html + '</tbody></table></div>';
}
const legend = (items) =>
  '<p class="legend">' + items.map(([c, t]) => `<span class="lg"><i class="g-${c}"></i>${esc(t)}</span>`).join('') + '</p>';

/* ——— 每手 EV 表:按 EV 排序,给出「最赚的 8 手」+「刚过零线的 8 手」+「最贵的错误 6 手」——— */
function evTable(evMap, freqMap, lang) {
  const rows = Object.entries(evMap).filter(([h]) => /^[2-9TJQKA]{2}[so]?$/.test(h));
  const top = rows.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const edge = rows.filter(([, v]) => v > 0 && v < 0.06).sort((a, b) => a[1] - b[1]).slice(0, 8);
  /* 「看着该推、其实亏钱」:EV 为负但很接近零(-0.10 ~ 0) */
  const trap = rows.filter(([, v]) => v < 0 && v > -0.1).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const L = lang === 'zh'
    ? { h: '每手期望值（bb）', a: '最赚的牌', b: '刚过零线（推弃几乎无差异）', c: '看着该推、其实亏钱', none: '（无）' }
    : { h: 'Expected value per hand (bb)', a: 'Highest EV', b: 'Barely +EV (near-indifferent)', c: 'Looks playable, quietly loses', none: '(none)' };
  const fmt = (l) => (l.length ? l.map(([h, v]) => `<code>${h} ${v > 0 ? '+' : ''}${v}</code>`).join(' ') : L.none);
  return `<h2>${L.h}</h2><div class="panel evp">
<p><b>${L.a}:</b> ${fmt(top)}</p>
<p><b>${L.b}:</b> ${fmt(edge)}</p>
<p><b>${L.c}:</b> ${fmt(trap)}</p></div>`;
}

/* ——— 语言层文案 ——— */
const L = {
  en: {
    locale: 'en', dir: '', brand: 'PreFlop Camp', brandLong: 'PreFlop Camp — free GTO preflop poker trainer',
    titleMid: 'Preflop Chart', pillarTitle: 'Preflop Charts & Push/Fold Nash Tables',
    pillarIntro: 'Every preflop range this trainer drills, published as a full 13×13 chart you can read without signing up: opening ranges for every seat in 6-max and 9-max cash games, big-blind defence, and self-computed push/fold Nash tables with the expected value of every single hand in big blinds. The push/fold numbers are solved in-house (chip-EV Nash, Monte-Carlo hand-class equity) — the exploitability of each stack is printed on the page, because a chart that hides its error bars is not worth trusting.',
    pillarSecs: { rfi: 'Opening ranges (RFI)', defense: 'Big blind defence', jam9: 'Push/fold Nash — 9-max', hu: 'Heads-up push/fold', calloff: 'Calling an all-in' },
    range: 'The range', chart: 'Chart', edge: 'The mixed band (open part of the time)', related: 'Related charts',
    cta: 'Train these spots free →', home: 'All preflop charts', faqH: 'FAQ',
    pos: 'Position', jamPct: 'Jam %', of: 'of hands',
    sbJam: 'Small blind — jamming range', bbCall: 'Big blind — calling range',
    method: 'Push/fold tables are a self-computed chip-EV Nash equilibrium (Monte-Carlo hand-class equity, 25,000 samples, seed 1234). Known limits, stated plainly: they ignore ICM, and the model does not apply card removal to the callers\' range — so offsuit aces, which block a caller\'s AA/AK/AQ/AJ, are slightly undervalued. Exploitability for this stack:',
    methodPacks: 'Cash-game ranges are a curated GTO reference, drilled question-by-question in the trainer. The mixed band lists hands solvers play only part of the time.',
    sister: 'Also train postflop: Postflop Coach (same maker)',
    breadcrumbHome: 'PreFlop Camp', bc: 'Preflop charts',
    combosLine: (p, c) => `${p}% of hands (${c} combos)`,
  },
  zh: {
    locale: 'zh-CN', dir: 'zh/', brand: '翻前训练营', brandLong: '翻前训练营 — 免费 GTO 德州扑克翻前训练器',
    titleMid: '德州扑克翻前范围图', pillarTitle: '翻前范围图 · 推弃 Nash 表',
    pillarIntro: '这个训练器练的每一个翻前范围，都在这里以完整 13×13 图公开，无需注册即可查看：6 人桌 / 9 人桌现金局每个位置的开局范围、大盲防守范围，以及**自算的推弃 Nash 表——每一手牌都标了以 bb 为单位的期望值**。推弃数字是自己解的（chip-EV Nash，蒙特卡洛手牌类赢率），每一档的可利用度都印在页面上——一张藏起误差的图不值得信。',
    pillarSecs: { rfi: '开局范围（RFI）', defense: '大盲防守', jam9: '推弃 Nash · 9 人桌', hu: '单挑推弃', calloff: '面对全下的跟注' },
    range: '范围', chart: '范围图', edge: '混合边缘带（只有部分频率会打）', related: '相关图表',
    cta: '免费练这些局面 →', home: '全部翻前范围图', faqH: '常见问题',
    pos: '位置', jamPct: '全下比例', of: '的牌',
    sbJam: '小盲 — 全下范围', bbCall: '大盲 — 跟注范围',
    method: '推弃表是**自算的** chip-EV Nash 均衡（蒙特卡洛手牌类赢率，25000 样本，seed 1234）。已知局限，如实说明：不考虑 ICM；模型在算被跟概率时不做去牌——所以杂色 A（它其实阻断了对手的 AA/AK/AQ/AJ）被略微低估。本档可利用度：',
    methodPacks: '现金局范围是经整理的 GTO 参考范围，在训练器里逐题演练。混合带列出的是 solver 只以部分频率打的牌。',
    sister: '翻后也要练？同一作者的「翻后训练营」',
    breadcrumbHome: '翻前训练营', bc: '翻前范围图',
    combosLine: (p, c) => `${p}% 的牌（${c} 个组合）`,
  },
};

const CSS = `
*{box-sizing:border-box}body{margin:0;font-family:"Space Grotesk","Noto Sans SC",system-ui,sans-serif;background:radial-gradient(120% 80% at 50% -10%,#14463a 0%,#0c2a22 45%,#0a201a 100%);color:#f1f5ee;line-height:1.65}
.wrap{max-width:760px;margin:0 auto;padding:28px 20px 60px}
a{color:#e8c66a}h1{font-size:1.5rem;line-height:1.35;margin:.2em 0 .4em}h2{font-size:1.12rem;margin:1.7em 0 .5em;color:#e8c66a}h3{font-size:1rem;margin:1.2em 0 .4em;color:#f1f5ee}
.eyebrow{color:#8fa79a;font-size:.85rem;margin:0}
.lead{font-size:1.1rem;margin:.6em 0 1.2em}
.panel{background:#161d18;border:1px solid #28332a;border-radius:14px;padding:14px 16px;margin:12px 0}
.panel code{background:#0f1512;border:1px solid #28332a;border-radius:5px;padding:1px 6px;font-size:.85rem;display:inline-block;margin:2px 1px}
.evp p{margin:.5em 0}
.gridwrap{overflow-x:auto;margin:10px 0}
table.grid{border-collapse:collapse;font-size:11px;font-weight:700;table-layout:fixed;width:100%;min-width:420px}
table.grid td{border:1px solid #0a201a;text-align:center;padding:5px 0;color:#0d1410;white-space:nowrap}
.g-raise,.g-shove{background:#d9564c;color:#fff}
.g-threebet{background:#8b6ad8;color:#fff}
.g-call{background:#34b074;color:#08150f}
.g-mix,.g-mixjam{background:#c98b3f;color:#1a1206}
.g-edge-raise,.g-edge-shove,.g-edge-call,.g-part{background:#6f5a3a;color:#f1f5ee}
.g-fold{background:#1b2320;color:#6b7d72}
.legend{font-size:.85rem;color:#8fa79a;margin:.4em 0 1.4em}
.lg{display:inline-block;margin-right:14px}.lg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:5px}
table.pos{border-collapse:collapse;width:100%;margin:8px 0;font-size:.95rem}
table.pos th,table.pos td{border-bottom:1px solid #28332a;padding:6px 8px;text-align:left}
table.pos th{color:#8fa79a;font-weight:600;font-size:.85rem}
.cta{display:block;text-align:center;background:linear-gradient(180deg,#e8c66a,#b8902f);color:#16110a;font-weight:800;padding:14px;border-radius:12px;text-decoration:none;margin:24px 0}
details.faq{background:#161d18;border:1px solid #28332a;border-radius:10px;padding:10px 14px;margin:8px 0}
details.faq summary{cursor:pointer;font-weight:700}
details.faq p{margin:.6em 0 .2em;color:#cdd8cf}
.rel{font-size:.95rem}.rel a{display:inline-block;margin:0 12px 6px 0}
.foot{color:#8fa79a;font-size:.8rem;border-top:1px solid #28332a;margin-top:30px;padding-top:14px}
.langsw{float:right;font-size:.85rem}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9rem;color:#cdd8cf;word-break:break-word}`;

/* ——— 页面骨架 ——— */
function shell(lang, o) {
  const l = L[lang];
  const urlEn = `${SITE}/charts/${o.slug}.html`;
  const urlZh = `${SITE}/charts/zh/${o.slug}.html`;
  const url = lang === 'zh' ? urlZh : urlEn;
  const up = lang === 'zh' ? '../../' : '../';
  return `<!DOCTYPE html>
<html lang="${l.locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(buildTitle(o.title, l.titleMid, l.brand))}</title>
<meta name="description" content="${esc(clampEff(stripMd(o.desc), 152))}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${urlEn}">
<link rel="alternate" hreflang="zh" href="${urlZh}">
<link rel="alternate" hreflang="x-default" href="${urlEn}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(o.title)} — ${l.brand}">
<meta property="og:description" content="${esc(clampEff(stripMd(o.desc), 152))}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${o.jsonld}</script>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<p class="eyebrow"><a href="${up}">${l.brandLong}</a><span class="langsw"><a href="${lang === 'zh' ? urlEn : urlZh}">${lang === 'zh' ? 'EN' : '中文'}</a></span></p>
<h1>${esc(o.title)}</h1>
<p class="lead">${mdBold(esc(o.lead))}</p>
${o.main}
${o.faqHtml}
<a class="cta" href="${up}">${l.cta}</a>
<h2>${l.related}</h2>
<p class="rel">${o.related}</p>
<p class="eyebrow" style="margin-top:14px"><a href="${lang === 'zh' ? './' : './'}">${l.home}</a></p>
<div class="foot">
<p>${mdBold(esc(o.method))}</p>
<p><a href="https://post-flop-coach.ai-speeds.com/" rel="noopener">${l.sister}</a></p>
</div>
</div>
</body>
</html>
`;
}

function faqBlock(lang, faq, l) {
  if (!faq || !faq.length) return '';
  return `<h2>${l.faqH}</h2>` + faq.map((f) => `<details class="faq"><summary>${mdBold(esc(f.q))}</summary><p>${mdBold(esc(f.a))}</p></details>`).join('');
}

function ld(lang, page, url, faq, l) {
  return JSON.stringify([
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: page.title, description: clampEff(stripMd(page.lead), 200),
      inLanguage: l.locale, isAccessibleForFree: true,
      author: { '@type': 'Organization', name: l.brand, url: SITE + '/' },
      publisher: { '@type': 'Organization', name: l.brand, url: SITE + '/' },
      mainEntityOfPage: url,
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: l.breadcrumbHome, item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: l.bc, item: `${SITE}/charts/${l.dir}` },
        { '@type': 'ListItem', position: 3, name: page.title, item: url },
      ],
    },
    ...(faq && faq.length ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: stripMd(f.q), acceptedAnswer: { '@type': 'Answer', text: stripMd(f.a) } })),
    }] : []),
  ]);
}

/* ——— 取数:每种页型 → {main, method} ——— */
const findSpot = (players, pred) => PACKS.cash[players].find(pred);

/* 文案占位符的取值(全部现算,四舍五入到整数百分比,读起来才像话)。
   `{BTN}` = 本页这一档的按钮位;`{BTN@8}` = 8bb 那一档的按钮位(跨档叙述用)。 */
const roundPct = (t) => Math.round(+weightPct(t).pct);
function varsFor(p) {
  const v = { bb: p.sel.bb };
  if (p.type === 'jam9') {
    for (const st of Object.keys(PUSHFOLD.stacks))
      for (const pos of Object.keys(PUSHFOLD.stacks[st].seats)) v[`${pos}@${st}`] = roundPct(PUSHFOLD.stacks[st].seats[pos]);
    for (const pos of Object.keys(PUSHFOLD.stacks[p.sel.bb].seats)) v[pos] = v[`${pos}@${p.sel.bb}`];
  } else if (p.type === 'hu') {
    for (const st of HU_PUSHFOLD.meta.stacks) {
      v[`jam@${st}`] = roundPct(HU_PUSHFOLD.stacks[st].jam);
      v[`call@${st}`] = roundPct(HU_PUSHFOLD.stacks[st].call);
    }
    v.jam = v[`jam@${p.sel.bb}`];
    v.call = v[`call@${p.sel.bb}`];
  } else if (p.type === 'calloff') {
    for (const st of Object.keys(PUSHFOLD.calloff)) {
      v[`call@${st}`] = roundPct(PUSHFOLD.calloff[st].btn);
      v[`btnjam@${st}`] = roundPct(PUSHFOLD.stacks[st].seats.BTN);
    }
    v.call = v[`call@${p.sel.bb}`];
    v.btnjam = v[`btnjam@${p.sel.bb}`];
    v.hands = Object.keys(PUSHFOLD.calloff[p.sel.bb].btn).length;
  }
  return v;
}

function buildMain(p, lang) {
  const l = L[lang];
  const s = p.sel;
  const V = varsFor(p);
  const bodyHtml = C[p.slug][lang].body.map((x) => `<p>${mdBold(esc(fill(x, V)))}</p>`).join('\n');

  if (p.type === 'rfi') {
    const spot = findSpot(s.players, (x) => x.mode === 'open' && x.heroPos === s.pos);
    const core = setPct(spot.R), wide = setPct(new Set([...spot.R, ...spot.M]));
    const catOf = (h) => (spot.R.has(h) ? 'raise' : spot.M.has(h) ? 'edge-raise' : 'fold');
    const mixList = [...spot.M];
    return {
      main:
        `<h2>${l.chart}</h2>${grid(catOf)}` +
        legend(lang === 'zh'
          ? [['raise', '加注（核心）'], ['edge-raise', '混合带'], ['fold', '弃牌']]
          : [['raise', 'Raise (core)'], ['edge-raise', 'Mixed'], ['fold', 'Fold']]) +
        `<div class="panel"><p><b>${l.range}:</b> <span class="mono">${esc(spot.raise)}</span></p>` +
        `<p class="eyebrow">${l.combosLine(core.pct, core.combos)}` +
        (mixList.length ? ` · +${l.combosLine((wide.pct - core.pct).toFixed(1), wide.combos - core.combos)}` : '') + `</p></div>` +
        (mixList.length ? `<h2>${l.edge}</h2><div class="panel"><p class="mono">${mixList.map((h) => `<code>${h}</code>`).join(' ')}</p></div>` : '') +
        bodyHtml,
      method: l.methodPacks,
    };
  }

  if (p.type === 'defense') {
    const spot = findSpot(s.players, (x) => x.mode === 'defense' && x.vilPos === s.vil);
    const r = setPct(spot.R), c = setPct(spot.C);
    const catOf = (h) => (spot.R.has(h) && spot.C.has(h) ? 'mix' : spot.R.has(h) ? 'threebet' : spot.C.has(h) ? 'call' : spot.M && spot.M.has(h) ? 'edge-call' : 'fold');
    return {
      main:
        `<h2>${l.chart}</h2>${grid(catOf)}` +
        legend(lang === 'zh'
          ? [['threebet', '3-bet'], ['call', '跟注'], ['mix', '混合'], ['fold', '弃牌']]
          : [['threebet', '3-bet'], ['call', 'Call'], ['mix', 'Mixed'], ['fold', 'Fold']]) +
        `<div class="panel"><p><b>3-bet:</b> <span class="mono">${esc(spot.raise)}</span><br><span class="eyebrow">${l.combosLine(r.pct, r.combos)}</span></p>` +
        `<p><b>${lang === 'zh' ? '跟注' : 'Call'}:</b> <span class="mono">${esc(spot.call)}</span><br><span class="eyebrow">${l.combosLine(c.pct, c.combos)}</span></p></div>` +
        bodyHtml,
      method: l.methodPacks,
    };
  }

  if (p.type === 'jam9') {
    const S = PUSHFOLD.stacks[s.bb];
    const positions = Object.keys(S.seats);
    const rows = positions.map((pos) => {
      const w = weightPct(S.seats[pos]);
      return `<tr><td><b>${pos}</b></td><td>${w.pct}%</td><td class="eyebrow">${lang === 'zh' ? w.combos + ' 个组合' : w.combos + ' combos'}</td></tr>`;
    }).join('');
    const charts = positions.map((pos) => {
      const f = S.seats[pos], ev = S.seatsEV[pos] || {};
      const catOf = (h) => (!f[h] ? 'fold' : f[h] >= 1 ? 'shove' : 'part');
      return `<h3>${pos} — ${weightPct(f).pct}% ${l.of}</h3>${grid(catOf, (h) => ev[h])}`;
    }).join('\n');
    return {
      main:
        `<div class="panel"><table class="pos"><thead><tr><th>${l.pos}</th><th>${l.jamPct}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` +
        `<h2>${l.chart}</h2>` + charts +
        legend(lang === 'zh'
          ? [['shove', '全下'], ['part', '部分频率全下'], ['fold', '弃牌']]
          : [['shove', 'Jam'], ['part', 'Mixed jam'], ['fold', 'Fold']]) +
        evTable(S.seatsEV.BTN || {}, S.seats.BTN, lang) +
        bodyHtml,
      method: `${l.method} ${PUSHFOLD.meta.exploitability[s.bb]} bb/hand.`,
    };
  }

  if (p.type === 'calloff') {
    const f = PUSHFOLD.calloff[s.bb].btn;
    const w = weightPct(f);
    const catOf = (h) => (!f[h] ? 'fold' : f[h] >= 1 ? 'call' : 'edge-call');
    return {
      main:
        `<h2>${l.chart}</h2>${grid(catOf)}` +
        legend(lang === 'zh'
          ? [['call', '跟注全下'], ['edge-call', '部分频率跟'], ['fold', '弃牌']]
          : [['call', 'Call the jam'], ['edge-call', 'Mixed call'], ['fold', 'Fold']]) +
        `<div class="panel"><p class="eyebrow">${l.combosLine(w.pct, w.combos)} · ${Object.keys(f).length} ${lang === 'zh' ? '个手牌类' : 'hand classes'}</p></div>` +
        bodyHtml,
      method: `${l.method} ${PUSHFOLD.meta.exploitability[s.bb]} bb/hand.`,
    };
  }

  if (p.type === 'hu') {
    const S = HU_PUSHFOLD.stacks[s.bb];
    const wj = weightPct(S.jam), wc = weightPct(S.call);
    const jamCat = (h) => (!S.jam[h] ? 'fold' : S.jam[h] >= 1 ? 'shove' : 'part');
    const callCat = (h) => (!S.call[h] ? 'fold' : S.call[h] >= 1 ? 'call' : 'edge-call');
    return {
      main:
        `<h2>${l.sbJam} — ${wj.pct}%</h2>${grid(jamCat, (h) => S.jamEV[h])}` +
        legend(lang === 'zh' ? [['shove', '全下'], ['part', '部分频率'], ['fold', '弃牌']] : [['shove', 'Jam'], ['part', 'Mixed'], ['fold', 'Fold']]) +
        `<h2>${l.bbCall} — ${wc.pct}%</h2>${grid(callCat, (h) => S.callEV[h])}` +
        legend(lang === 'zh' ? [['call', '跟注全下'], ['edge-call', '部分频率'], ['fold', '弃牌']] : [['call', 'Call'], ['edge-call', 'Mixed'], ['fold', 'Fold']]) +
        evTable(S.jamEV, S.jam, lang) +
        bodyHtml,
      method: `${l.method} ${HU_PUSHFOLD.meta.exploitability[s.bb]} bb/hand.`,
    };
  }
  throw new Error('unknown page type: ' + p.type);
}

/* ——— 相关图内链(同类 + 同族相邻档),给每张 spoke ≥2 条入链 ——— */
function relatedFor(p, lang) {
  const same = PAGES.filter((x) => x.type === p.type && x.slug !== p.slug);
  const others = PAGES.filter((x) => x.type !== p.type);
  const pick = same.slice(0, 4).concat(others.filter((_, i) => i % 7 === 0).slice(0, 2));
  return pick.map((x) => `<a href="${x.slug}.html">${esc(fill(C[x.slug][lang].title, varsFor(x)))}</a>`).join('');
}

/* ——— 生成 ——— */
fs.mkdirSync(path.join(OUT, 'zh'), { recursive: true });
const urls = [`${SITE}/`, `${SITE}/charts/`, `${SITE}/charts/zh/`];

for (const p of PAGES) {
  if (!C[p.slug]) throw new Error(`seo-content 缺 ${p.slug} 的文案`);
  for (const lang of ['en', 'zh']) {
    const l = L[lang];
    const V = varsFor(p);
    const raw = C[p.slug][lang];
    // 文案里的 {占位符} 在这里一次性填成真实数字(body 在 buildMain 里填)
    const page = {
      title: fill(raw.title, V),
      lead: fill(raw.lead, V),
      faq: raw.faq.map((f) => ({ q: fill(f.q, V), a: fill(f.a, V) })),
    };
    const { main, method } = buildMain(p, lang);
    const url = `${SITE}/charts/${l.dir}${p.slug}.html`;
    const html = shell(lang, {
      slug: p.slug, title: page.title, lead: page.lead, desc: page.lead,
      main, method, faqHtml: faqBlock(lang, page.faq, l),
      related: relatedFor(p, lang), jsonld: ld(lang, page, url, page.faq, l),
    });
    fs.writeFileSync(path.join(OUT, l.dir, p.slug + '.html'), html);
    urls.push(url);
  }
}

/* ——— pillar:/charts/ 与 /charts/zh/ ——— */
const SEC_ORDER = ['rfi', 'defense', 'jam9', 'hu', 'calloff'];
for (const lang of ['en', 'zh']) {
  const l = L[lang];
  const url = `${SITE}/charts/${l.dir}`;
  const altUrl = lang === 'zh' ? `${SITE}/charts/` : `${SITE}/charts/zh/`;
  const secs = SEC_ORDER.map((t) => {
    const list = PAGES.filter((x) => x.type === t);
    if (!list.length) return '';
    return `<h2>${l.pillarSecs[t]}</h2><ul>` +
      list.map((x) => `<li><a href="${x.slug}.html">${esc(fill(C[x.slug][lang].title, varsFor(x)))}</a></li>`).join('') + '</ul>';
  }).join('\n');
  const items = PAGES.map((x, i) => ({
    '@type': 'ListItem', position: i + 1, name: fill(C[x.slug][lang].title, varsFor(x)), url: `${SITE}/charts/${l.dir}${x.slug}.html`,
  }));
  const jsonld = JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: l.pillarTitle, description: clampEff(stripMd(l.pillarIntro), 200), inLanguage: l.locale, url },
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: l.breadcrumbHome, item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: l.bc, item: url },
      ],
    },
  ]);
  const desc = lang === 'zh'
    ? '德州扑克翻前范围图全集：6/9 人桌每个位置的开局范围、大盲防守、自算推弃 Nash 表（每手 EV）。免费查看，无需注册。'
    : 'Every preflop range chart in one place: opening ranges for all seats (6-max & 9-max), big-blind defence, and self-computed push/fold Nash tables with per-hand EV. Free, no signup.';
  const html = `<!DOCTYPE html>
<html lang="${l.locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(buildTitle(l.pillarTitle, '', l.brand))}</title>
<meta name="description" content="${esc(clampEff(desc, 152))}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${SITE}/charts/">
<link rel="alternate" hreflang="zh" href="${SITE}/charts/zh/">
<link rel="alternate" hreflang="x-default" href="${SITE}/charts/">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(l.pillarTitle)} — ${l.brand}">
<meta property="og:description" content="${esc(clampEff(desc, 152))}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonld}</script>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<p class="eyebrow"><a href="${lang === 'zh' ? '../../' : '../'}">${l.brandLong}</a><span class="langsw"><a href="${altUrl}">${lang === 'zh' ? 'EN' : '中文'}</a></span></p>
<h1>${esc(l.pillarTitle)}</h1>
<p class="lead">${mdBold(esc(l.pillarIntro))}</p>
${secs}
<a class="cta" href="${lang === 'zh' ? '../../' : '../'}">${l.cta}</a>
<div class="foot"><p><a href="https://post-flop-coach.ai-speeds.com/" rel="noopener">${l.sister}</a></p></div>
</div>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, l.dir, 'index.html'), html);
}

/* ——— sitemap + robots ——— */
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod>${u === SITE + '/' ? '<priority>1.0</priority>' : ''}</url>`).join('\n') +
  `\n</urlset>\n`
);
fs.writeFileSync(
  path.join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
);

/* ——— 网站根 = app 本体 ———
   原先 index.html 是一张 meta-refresh 跳转壳(→ gto-trainer.html),而 gto-trainer.html 的
   canonical 又指回 `/` —— 根域(所有品牌外链落点、最该被索引的 URL)是一张空页,还和目标页
   互相指。修法:index.html 直接由 gto-trainer.html 生成(内容一致,canonical 自指根域);
   /gto-trainer.html 仍可访问,其 canonical 指向根域,归一到同一个 URL。
   ⚠ index.html 是**生成物**,别手改 —— 改 gto-trainer.html 后重跑本脚本。 */
const appHtml = fs.readFileSync(path.join(root, 'gto-trainer.html'), 'utf8');
fs.writeFileSync(
  path.join(root, 'index.html'),
  appHtml.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- 由 tools/gen-seo-pages.js 从 gto-trainer.html 生成 —— 请勿手改 -->')
);

console.log(`gen-seo-pages: ${PAGES.length} spokes × en/zh + 2 pillars = ${PAGES.length * 2 + 2} 页;sitemap ${urls.length} URL;index.html ← gto-trainer.html`);
