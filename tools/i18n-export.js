'use strict';
/*
 * i18n-export.js — 把英文源语料导出成 JSON 供翻译(agent 或人),再把译文组装回 js/locales/<code>.js
 *
 *   导出:  node tools/i18n-export.js export <outDir>
 *            → <outDir>/src-L.json   {中文源串: "English"}      —— 短标签,键是 canonical key
 *            → <outDir>/src-T.json   {key: "English template"}  —— 模板/散文,含 {占位符} 与 <b> 标签
 *
 *   组装:  node tools/i18n-export.js build <code> <trL.json> <trT.json>
 *            → js/locales/<code>.js  (I18N_REGISTER(code,{L,T}))
 *          组装时严格校验:键必须与源完全一致(多/少都报错)、占位符集合一致、值里不得有 CJK。
 *          译文文件的键 = 源的键(L 用中文源串,T 用 key)。少的键=未翻译,允许(运行时回落英文),
 *          但会打印覆盖率。
 *
 * 之所以让译者写「与源同键」的 JSON 而不是数组:键错/漏能被 i18n-check 抓死,数组错位是静默灾难。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CJK = /[㐀-䶿一-鿿]/;
/* 汉字合法的语言(日语汉字/繁简中文)。其余语言出现 CJK = 把中文源串复制进了译文。 */
const CJK_LANGS = new Set(['zh', 'zh-TW', 'ja']);
const phOf = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');

function mkProxy() {
  const f = function () { return mkProxy(); };
  return new Proxy(f, {
    get(_t, k) { if (k === Symbol.toPrimitive) return () => ''; if (k === 'length') return 0; if (k === 'nodeType') return 0; return mkProxy(); },
    apply() { return mkProxy(); }, has() { return true; }, set() { return true; },
  });
}
function source() {
  const ctx = vm.createContext({ localStorage: mkProxy(), navigator: mkProxy(), document: mkProxy(), window: undefined, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'i18n.js'), 'utf8') + ';globalThis.__i={I18N_EN,I18N_TPL};', ctx);
  const S = ctx.__i;
  if (!S || !S.I18N_EN) throw new Error('捕获 i18n.js 失败');
  return { L: S.I18N_EN, T: S.I18N_TPL.en };
}

const [, , cmd, ...rest] = process.argv;

if (cmd === 'export') {
  const out = rest[0];
  if (!out) { console.error('用法: node tools/i18n-export.js export <outDir>'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const { L, T } = source();
  fs.writeFileSync(path.join(out, 'src-L.json'), JSON.stringify(L, null, 1));
  fs.writeFileSync(path.join(out, 'src-T.json'), JSON.stringify(T, null, 1));
  console.log(`已导出 → ${out}`);
  console.log(`  src-L.json: ${Object.keys(L).length} 条(短标签;键=中文源串)`);
  console.log(`  src-T.json: ${Object.keys(T).length} 条(模板/散文;键=稳定 key)`);
  const ph = Object.entries(T).filter(([, v]) => /\{\w+\}/.test(v)).length;
  const tags = Object.entries(T).filter(([, v]) => /<[a-z]/i.test(v)).length;
  console.log(`  其中含 {占位符}: ${ph} 条 | 含 HTML 标签: ${tags} 条`);
  process.exit(0);
}

if (cmd === 'build') {
  const [code, fL, fT] = rest;
  if (!code || !fL || !fT) { console.error('用法: node tools/i18n-export.js build <code> <trL.json> <trT.json>'); process.exit(2); }
  const { L: srcL, T: srcT } = source();
  const trL = JSON.parse(fs.readFileSync(fL, 'utf8'));
  const trT = JSON.parse(fs.readFileSync(fT, 'utf8'));
  const errs = [];

  // ⚠ _tpl 的值可以是**数组**(如 pitch 的 5 条卖点),也可以是**合法的空字符串**(reason.f3.tail.ip)。
  //   逐元素校验数组;源为空则译文也必须为空(不是「漏译」)。
  const tagsOf = (s) => (String(s).match(/<\/?[a-z][^>]*>/gi) || []).map((t) => t.toLowerCase()).sort().join('');
  // ⚠ 日语汉字也是 CJK,禁 CJK 会误杀 ja。真正要防的是「把中文源串复制进译文」——
  //   对 CJK 语言改用「译文 == 中文源键」来抓(见下面 clean() 里的 L 检查)。
  const cjkOk = CJK_LANGS.has(code);
  const one = (s, v, k, label, at) => {
    const where = `${label}: ${JSON.stringify(k)}${at != null ? `[${at}]` : ''}`;
    if (typeof v !== 'string') { errs.push(`${where} 译文不是字符串`); return false; }
    const srcEmpty = !String(s).trim();
    if (srcEmpty) { if (v.trim()) errs.push(`${where} 源为空但译文非空`); return !v.trim(); }
    if (!v.trim()) { errs.push(`${where} 空译文`); return false; }
    if (!cjkOk && CJK.test(v)) { errs.push(`${where} 译文含中文`); return false; }
    if (phOf(s) !== phOf(v)) { errs.push(`${where} 占位符不一致 期望[${phOf(s)}] 实为[${phOf(v)}]`); return false; }
    if (tagsOf(s) !== tagsOf(v)) { errs.push(`${where} HTML 标签不一致`); return false; }
    return true;
  };
  const clean = (src, tr, label) => {
    const out = {};
    for (const [k, v] of Object.entries(tr)) {
      if (!(k in src)) { errs.push(`${label}: 多余键 ${JSON.stringify(k)}`); continue; }
      // L 的键多为中文源串:译文若等于键 = 把键复制过去了(ja/zh-TW 下 CJK 检查抓不到)。
      // ⚠ 只在**键含 CJK** 时判——有些键本身就是英文术语(3-bet / MTT / IP / OOP),译文本就该相同。
      if (label === 'L' && typeof v === 'string' && CJK.test(k) && v.trim() === k.trim()) {
        errs.push(`L: ${JSON.stringify(k)} 译文等于中文源键(疑似复制键)`); continue;
      }
      const s = src[k];
      if (Array.isArray(s)) {
        if (!Array.isArray(v) || v.length !== s.length) { errs.push(`${label}: ${JSON.stringify(k)} 数组长度不一致(期望 ${s.length})`); continue; }
        if (s.every((si, i) => one(si, v[i], k, label, i))) out[k] = v;
        continue;
      }
      if (one(s, v, k, label)) out[k] = v;
    }
    return out;
  };
  const L = clean(srcL, trL, 'L');
  const T = clean(srcT, trT, 'T');

  const nL = Object.keys(srcL).length, nT = Object.keys(srcT).length;
  const dL = Object.keys(L).length, dT = Object.keys(T).length;
  console.log(`${code}: L ${dL}/${nL} (${Math.round(dL / nL * 100)}%) | T ${dT}/${nT} (${Math.round(dT / nT * 100)}%)`);
  if (errs.length) {
    console.error(`\n❌ ${errs.length} 处问题,未写文件:`);
    errs.slice(0, 25).forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }
  const dir = path.join(ROOT, 'js', 'locales');
  fs.mkdirSync(dir, { recursive: true });
  const body =
    `/* ${code} — generated by tools/i18n-export.js build. 键与 js/i18n.js 的英文源一一对应。\n` +
    `   缺键 = 未翻译,运行时回落英文(见 tools/i18n-check.js 的覆盖率)。 */\n` +
    `I18N_REGISTER(${JSON.stringify(code)}, {\n` +
    ` L: ${JSON.stringify(L, null, 1).split('\n').join('\n ')},\n` +
    ` T: ${JSON.stringify(T, null, 1).split('\n').join('\n ')}\n});\n`;
  fs.writeFileSync(path.join(dir, code + '.js'), body);
  console.log(`✅ 已写 js/locales/${code}.js`);
  process.exit(0);
}

console.error('用法:\n  node tools/i18n-export.js export <outDir>\n  node tools/i18n-export.js build <code> <trL.json> <trT.json>');
process.exit(2);
