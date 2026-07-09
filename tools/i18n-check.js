'use strict';
/*
 * i18n-check.js — locale 文件 vs 英文源(source of truth)的校验器。
 *
 * 由 test/i18n-locales.test.js 调用(进 `npm test`),也可单跑:`node tools/i18n-check.js`
 *
 * 为什么在 vm 里真实执行而不是正则解析:i18n.js 的字符串里有 `·`、转义引号、一行多对,
 * 正则解析已经在开发中被证明会静默给出错误结果(一次报「124 条全缺」实为 0 缺)。执行 = 地面真值。
 *
 * 规则:
 *   ❌ locale 文件语法错 / 没调 I18N_REGISTER
 *   ❌ I18N_SUPPORTED 里的非内联语言缺 locale 文件(setLang 会静默失败)
 *   ❌ locale 里有源里不存在的键(typo → 永远命不中的死字符串)
 *   ❌ {占位符} 与英文不一致(被误译/丢失 → 运行时露出 {n})
 *   ❌ 非 zh 的 locale 里出现 CJK(多半是把中文源串复制进了译文)
 *   ⚠  缺键 → 不阻塞(运行时按设计回落英文),但报出覆盖率
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const I18N_FILE = path.join(ROOT, 'js', 'i18n.js');
const LOCALES_DIR = path.join(ROOT, 'js', 'locales');
const INLINE = { en: 1, zh: 1 };                       // 内联在 i18n.js,不需要 locale 文件

const CJK = /[㐀-䶿一-鿿豈-﫿]/;
const phOf = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');

/* 静态 HTML 里**有意不翻译**的语言中立字面量(迁移前就已是英文,已逐条核对 git HEAD)。
   往这里加 = 有意识的决定,不是静默放过。徽章 / 筹码档 / 单字母 / 被 JS 覆写的占位符。 */
const HTML_SKIP = new Set([
  'PRO', 'LEVEL UP', 'LV.1 · 0/20',
  '5bb', '8bb', '10bb', '12bb', '15bb', '20bb', '25bb',
  'S', 'C', 'T',
]);

/* 与 test/load-app.js 同款「防弹 Proxy」:任何 trap 都返回另一个可调用 Proxy,
   让 i18n.js 顶层的 localStorage/navigator/document 触碰不抛错。 */
function mkProxy() {
  const f = function () { return mkProxy(); };
  return new Proxy(f, {
    get(_t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'length') return 0;                    // navigator.languages.length=0 → 走 navigator.language
      if (k === 'nodeType') return 0;                  // _hasDOM() → false,不挂 DOM
      return mkProxy();
    },
    apply() { return mkProxy(); },
    has() { return true; },
    set() { return true; },
  });
}

/* ⚠ vm 里顶层 `const`/`let` 是词法绑定,**不会**成为 context 的属性 —— 直接读 ctx.I18N_EN 恒为
   undefined,校验器会「空转通过」(比没有更危险)。照抄 test/load-app.js:在源码尾部追加捕获片段,
   同一脚本作用域才看得见这些 const。捕获的是**对象引用**,后续 I18N_REGISTER 的写入照样可见。 */
const CAPTURE = ';globalThis.__i18n={I18N_EN,I18N_TPL,I18N_SUPPORTED,I18N_NATIVE,LOCALES,I18N_HTML};';

function loadSource() {
  const ctx = vm.createContext({
    localStorage: mkProxy(), navigator: mkProxy(), document: mkProxy(),
    window: undefined, console,
  });
  vm.runInContext(fs.readFileSync(I18N_FILE, 'utf8') + CAPTURE, ctx, { filename: 'js/i18n.js' });
  if (!ctx.__i18n) throw new Error('捕获失败:i18n.js 未导出 I18N_EN/I18N_TPL(结构变了?)');
  return ctx;
}

function run() {
  const errors = [];
  const rows = [];
  const ctx = loadSource();
  const S = ctx.__i18n;

  const srcL = S.I18N_EN || {};
  const srcT = (S.I18N_TPL && S.I18N_TPL.en) || {};
  const supported = S.I18N_SUPPORTED || [];
  const native = S.I18N_NATIVE || {};
  const lKeys = Object.keys(srcL);
  const tKeys = Object.keys(srcT);
  const total = lKeys.length + tKeys.length;

  // 自检:源语料不该为空。空 = 解析/捕获坏了,而不是「没问题」
  if (lKeys.length < 100 || tKeys.length < 100) {
    errors.push(`源语料异常少(L=${lKeys.length}, T=${tKeys.length}) —— 捕获或 i18n.js 结构出问题了,不是「全绿」`);
  }

  // SUPPORTED 里每种语言都要有 native 名(下拉菜单靠它)
  for (const code of supported) {
    if (!native[code]) errors.push(`I18N_NATIVE 缺 '${code}' 的 native 名`);
  }

  const files = fs.existsSync(LOCALES_DIR)
    ? fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.js')).sort()
    : [];
  const have = new Set(files.map((f) => path.basename(f, '.js')));

  // SUPPORTED 里的非内联语言必须有文件,否则 setLang 静默失败
  for (const code of supported) {
    if (!INLINE[code] && !have.has(code)) errors.push(`I18N_SUPPORTED 含 '${code}' 但缺 js/locales/${code}.js`);
  }
  // 有文件却没进 SUPPORTED = 用户永远切不到(死文件)
  for (const code of have) {
    if (supported.indexOf(code) < 0) errors.push(`js/locales/${code}.js 存在但不在 I18N_SUPPORTED(用户切不到)`);
  }

  for (const f of files) {
    const code = path.basename(f, '.js');
    try {
      vm.runInContext(fs.readFileSync(path.join(LOCALES_DIR, f), 'utf8'), ctx, { filename: 'js/locales/' + f });
    } catch (e) {
      errors.push(`${f}: 执行失败 ${e.message}`);
      continue;
    }
    const L = (S.LOCALES && S.LOCALES[code]) || null;   // I18N_REGISTER 写进被捕获的同一对象
    const T = (S.I18N_TPL && S.I18N_TPL[code]) || null;
    if (!L && !T) { errors.push(`${f}: 没有调用 I18N_REGISTER('${code}', …)`); continue; }

    const lHave = Object.keys(L || {});
    const tHave = Object.keys(T || {});

    // 多余键(源里没有)= typo,永远命不中
    lHave.filter((k) => !(k in srcL)).forEach((k) => errors.push(`${code}: L 多余键(源里没有) ${JSON.stringify(k)}`));
    tHave.filter((k) => !(k in srcT)).forEach((k) => errors.push(`${code}: T 多余键(源里没有) ${JSON.stringify(k)}`));

    // 占位符必须与英文一致(译丢了 {n} 运行时就露原文)
    tHave.filter((k) => k in srcT && phOf(srcT[k]) !== phOf(T[k]))
      .forEach((k) => errors.push(`${code}: T 占位符不一致 '${k}' 期望[${phOf(srcT[k])}] 实为[${phOf(T[k])}]`));

    // 非 zh 的译文里不该有 CJK(多半是把中文源串直接复制进来了)
    if (code !== 'zh') {
      const leak = [...lHave.filter((k) => CJK.test(String(L[k]))).map((k) => 'L:' + k),
                    ...tHave.filter((k) => CJK.test(String(T[k]))).map((k) => 'T:' + k)];
      leak.slice(0, 5).forEach((k) => errors.push(`${code}: 译文含中文(疑似复制源串) ${k}`));
      if (leak.length > 5) errors.push(`${code}: …另有 ${leak.length - 5} 处译文含中文`);
    }

    const done = lHave.filter((k) => k in srcL).length + tHave.filter((k) => k in srcT).length;
    rows.push({ code, done, total, pct: total ? Math.round((done / total) * 100) : 0 });
  }

  return { errors, rows, total, supported, files, lCount: lKeys.length, tCount: tKeys.length };
}

function report(r) {
  console.log(`i18n 源语料: L=${r.lCount} + T=${r.tCount} → 共 ${r.total} 条/语言`);
  console.log(`I18N_SUPPORTED: ${r.supported.join(', ')}`);
  if (!r.files.length) {
    console.log('(尚无 js/locales/*.js —— en/zh 内联在 i18n.js,无需 locale 文件)');
  } else {
    console.log('\n覆盖率:');
    for (const x of r.rows) console.log(`  ${x.code.padEnd(6)} ${String(x.done).padStart(4)}/${x.total}  ${String(x.pct).padStart(3)}%  ${x.pct === 100 ? '✅' : '⚠ 缺的部分运行时回落英文'}`);
  }
  if (r.errors.length) {
    console.log('\n❌ 错误:');
    r.errors.forEach((e) => console.log('  - ' + e));
  } else {
    console.log('\n✅ 无错误');
  }
}

/* ---- 静态 HTML 的 SEO / 可翻译性锁 ----
   HTML 的作者语言必须是英文(爬虫不跑 JS,首字节就是它看到的全部),且每个会被 _walkText 翻译的
   英文文本都必须能反查回中文源串(I18N_HTML 里有,或元素上有 data-i18n 钉子),否则该处在
   中文/其它语言下会静默保持英文。 */
function checkHtml() {
  const errors = [];
  const html = fs.readFileSync(path.join(ROOT, 'gto-trainer.html'), 'utf8');
  const ctx = loadSource();
  const HTMLMAP = ctx.__i18n.I18N_HTML || {};
  const TPL_EN = (ctx.__i18n.I18N_TPL && ctx.__i18n.I18N_TPL.en) || {};

  if (!/<html lang="en">/.test(html)) errors.push('<html lang> 必须是 "en"(作者语言=默认语言)');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  if (CJK.test(title)) errors.push('<title> 含中文(爬虫首字节必须英文)');
  const head = html.slice(0, html.indexOf('</head>'));
  [...head.matchAll(/<meta[^>]*content="([^"]*)"/g)].forEach((m) => {
    if (CJK.test(m[1])) errors.push(`head meta 含中文: ${m[1].slice(0, 40)}…`);
  });
  const ld = (html.match(/ld\+json">([\s\S]*?)<\/script>/) || [])[1] || '';
  if (CJK.test(ld)) errors.push('JSON-LD 含中文');
  if (Object.keys(HTMLMAP).length < 50) errors.push(`I18N_HTML 只有 ${Object.keys(HTMLMAP).length} 条,多半没生成(跑 tools/migrate-html-en.js)`);

  // data-i18n-html 块的键必须有英文模板
  [...new Set([...html.matchAll(/data-i18n-html="([^"]+)"/g)].map((m) => m[1]))]
    .filter((k) => TPL_EN[k] == null)
    .forEach((k) => errors.push(`data-i18n-html 块 '${k}' 缺英文模板`));

  // 会被 _walkText 走到的文本:去掉 script/style/注释/已整块化的 data-i18n-html 元素
  let body = html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<([a-z0-9]+)([^>]*\bdata-i18n-html="[^"]*"[^>]*)>[\s\S]*?<\/\1>/gi, '')
    // 有 data-i18n 钉子的元素:其文本由钉子决定,跳过
    .replace(/<([a-z0-9]+)([^>]*\bdata-i18n="[^"]*"[^>]*)>[\s\S]*?<\/\1>/gi, '');
  if (CJK.test(body)) {
    const zh = [...new Set([...body.matchAll(/([^\s<>"]*[㐀-䶿一-鿿][^\s<>"]*)/g)].map((m) => m[1]))];
    errors.push(`body 仍有中文(应为英文作者语言): ${JSON.stringify(zh.slice(0, 4))}`);
  }
  // 每个英文文本节点都要能反查
  const texts = [...new Set([...body.matchAll(/>([^<>]*)</g)].map((m) => m[1].trim()))]
    .filter((t) => t && /[A-Za-z]/.test(t) && !/^[\d\s.,:%+\-/()]*$/.test(t));
  const unmapped = texts.filter((t) => !(t in HTMLMAP) && !HTML_SKIP.has(t));
  if (unmapped.length) {
    errors.push(`${unmapped.length} 处英文文案无法反查回中文源串(zh 下会保持英文): ${JSON.stringify(unmapped.slice(0, 5))}`);
  }
  return { errors, mapped: Object.keys(HTMLMAP).length, texts: texts.length };
}

module.exports = { run, checkHtml };

if (require.main === module) {
  const r = run();
  report(r);
  process.exit(r.errors.length ? 1 : 0);
}
