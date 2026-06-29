'use strict';
/*
 * i18n 完整性回归:确保「英文模式下 UI 不露中文」。
 *
 * 数据文件(ranges/modes/packs/coach…)以中文为唯一来源,翻译只在渲染层:
 *   L('中文源串') → 英文(LANG==='en' 时按源串查 I18N_EN 字典;查不到则原样返回中文)。
 * 所以「英文模式露中文」= 某个会被 L() 的中文串在字典里没有对应翻译。
 *
 * 两道关卡:
 *   1) 静态扫所有 L('中文字面量') 调用(如 L('查看报告 →')),en 下不得仍含中文。
 *      —— 这正是 d8eb118 引入、e289003 修复的「查看报告 →」漏译那一类。
 *   2) 数据派生的用户可见串(MODES 动作名/图例/分类名、ACT_LABEL、CAT_NAME、
 *      FORMATS/VARIANTS/GAMETYPES 文案、评级名),en 下不得含中文。
 *
 * CJK = 中日韩统一表意文字(含扩展 A 与兼容区);英文 UI 不应出现。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./load-app.js');

const ROOT = path.join(__dirname, '..');
const CJK = /[㐀-鿿豈-﫿]/;

// 有意保留的中文(非漏译),不计入失败:
//  - '中文' 出现在 i18n.js 文件头注释的用法示例 L("中文"),并非真实调用;
//    同时也是语言切换 中|EN 里中文按钮天然显示的字。
const ALLOW = new Set(['中文']);

const app = loadApp();
app.setLang('en');
const { L } = app;

function scriptSources() {
  const html = fs.readFileSync(path.join(ROOT, 'gto-trainer.html'), 'utf8');
  return [...html.matchAll(/<script\s+src=["']([^"']+)["']/g)].map((x) => x[1]);
}

test('英文模式:所有 L(中文字面量) 调用都有英文翻译,不露中文', () => {
  const miss = [];
  for (const src of scriptSources()) {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    const re = /\bL\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1\s*\)/g;
    let m;
    while ((m = re.exec(code))) {
      const s = m[2];
      if (!CJK.test(s) || ALLOW.has(s)) continue;
      if (CJK.test(L(s))) miss.push(`${JSON.stringify(s)} @ ${src}`);
    }
  }
  assert.deepStrictEqual(
    miss, [],
    `这些 L() 调用在英文模式下仍露中文,需在 js/i18n.js 的 I18N_EN 字典补翻译:\n  ${miss.join('\n  ')}`
  );
});

test('英文模式:data 派生的用户可见串都有英文翻译', () => {
  const { MODES, ACT_LABEL, CAT_NAME, FORMATS, VARIANTS, GAMETYPES } = app;
  const strs = new Set();
  const add = (v) => { if (typeof v === 'string' && CJK.test(v) && !ALLOW.has(v)) strs.add(v); };

  Object.values(MODES || {}).forEach((md) => {
    Object.values(md.names || {}).forEach(add);
    (md.legend || []).forEach((x) => (Array.isArray(x) ? x.forEach(add) : add(x)));
    Object.values(md.catName || {}).forEach(add);
  });
  Object.values(ACT_LABEL || {}).forEach(add);
  Object.values(CAT_NAME || {}).forEach(add);
  Object.values(FORMATS || {}).forEach((f) => { add(f.tag); add(f.label); add(f.name); add(f.short); });
  Object.values(VARIANTS || {}).forEach((grp) =>
    Object.values(grp || {}).forEach((v) => { add(v.short); add(v.name); add(v.label); add(v.tag); }));
  Object.values(GAMETYPES || {}).forEach((g) => { add(g.name); add(g.label); add(g.tag); });
  // resolve() 的评级名(grade)经 L() 显示
  ['最佳', '好棋', '两可', '不准', '失误', '漏着', '超时'].forEach((s) => strs.add(s));

  const miss = [...strs].filter((s) => CJK.test(L(s)));
  assert.deepStrictEqual(
    miss, [],
    `这些 data 串在英文模式下露中文,需在 js/i18n.js 补翻译:\n  ${miss.join('\n  ')}`
  );
});
