'use strict';
/*
 * seo-len-check.js — 生成物的 title/desc 有效宽度体检(CJK×2),给 SEO 生成器上锁。
 *   node tools/seo-len-check.js   → 超标返回非 0
 *
 * SEO 阈值(title 30–60 / desc 70–155)按**显示宽度**算,中文一个字顶两个;
 * 生成器若按 .length 截断,中文页必然溢出。⚠ 量之前必须先**解码 HTML 实体**
 * (`&amp;` 在 SERP 里显示为 1 个 `&`,按 5 个字符算会假超标)。
 * 手写页(index.html)也一起量 —— 它是全站最重要的一页,最容易漏。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['charts'];
const SINGLE = ['index.html'];
const CJK = /[⺀-鿿　-ヿ가-힯＀-￯]/;
const effLen = (s) => [...String(s)].reduce((a, c) => a + (CJK.test(c) ? 2 : 1), 0);
const decode = (s) =>
  String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
const LIM = { tMin: 30, tMax: 60, dMin: 70, dMax: 155 };

let pages = 0;
const bad = [];
function check(file, rel) {
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta name="robots"[^>]*noindex/i.test(html)) return; // noindex 页不进索引,不体检
  pages++;
  const t = effLen(decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''));
  const d = effLen(decode((html.match(/name="description" content="([^"]*)"/) || [])[1] || ''));
  const errs = [];
  if (t > LIM.tMax) errs.push(`title ${t} > ${LIM.tMax}`);
  if (t < LIM.tMin) errs.push(`title ${t} < ${LIM.tMin}`);
  if (d > LIM.dMax) errs.push(`desc ${d} > ${LIM.dMax}`);
  if (d < LIM.dMin) errs.push(`desc ${d} < ${LIM.dMin}`);
  if (errs.length) bad.push(`${rel}  —  ${errs.join(', ')}`);
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (f.name.endsWith('.html')) check(p, path.relative(ROOT, p).replace(/\\/g, '/'));
  }
}
DIRS.forEach((d) => walk(path.join(ROOT, d)));
SINGLE.forEach((f) => { const p = path.join(ROOT, f); if (fs.existsSync(p)) check(p, f); });

console.log(`seo-len-check: ${pages} 页(HTML 实体已解码,CJK 按 2 计)`);
if (bad.length) {
  console.log(`✖ ${bad.length} 页超出 SEO 区间:`);
  bad.slice(0, 20).forEach((b) => console.log('   ' + b));
  process.exit(1);
}
console.log('✔ 全部 title(30–60) / desc(70–155) 达标');
