/*
 * i18n-locales.test.js — 把 tools/i18n-check.js 接进 `npm test`。
 *
 * 契约(见 tools/i18n-check.js 顶部):
 *   - 缺键 **不阻塞**(运行时按设计回落英文),只反映在覆盖率上;
 *   - 多余键 / 占位符不一致 / 非 zh 译文含中文 / SUPPORTED 与 locale 文件不匹配 → 红。
 *
 * 这条测试还兼作**空转守卫**:校验器若因为 vm 词法绑定捕获失败而读到空语料,
 * 它会自己报错(源语料异常少),而不是「全绿」——那种静默通过比没有校验更危险。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { run, checkHtml } = require('../tools/i18n-check.js');

test('i18n: locale 文件与英文源一致(无多余键/占位符错/中文泄漏)', () => {
  const r = run();
  assert.deepEqual(r.errors, [], '\n' + r.errors.join('\n'));
});

test('i18n: 源语料非空(防校验器空转)', () => {
  const r = run();
  assert.ok(r.lCount > 100, `I18N_EN 只有 ${r.lCount} 条,捕获多半坏了`);
  assert.ok(r.tCount > 100, `I18N_TPL.en 只有 ${r.tCount} 条,捕获多半坏了`);
});

test('i18n: I18N_SUPPORTED 里每种语言都有 native 名', () => {
  const r = run();
  assert.ok(r.supported.length >= 2, 'SUPPORTED 至少要有 en/zh');
  assert.ok(!r.errors.some((e) => /native 名/.test(e)), 'native 名缺失');
});

/* 静态 HTML 的 SEO 锁:爬虫不跑 JS,首字节必须是英文(默认语言);
   且每处英文文案都要能反查回中文源串,否则 zh/其它语言下静默保持英文。 */
test('SEO: 静态 HTML 作者语言=英文,且每处文案都可反查翻译', () => {
  const r = checkHtml();
  assert.deepEqual(r.errors, [], '\n' + r.errors.join('\n'));
  assert.ok(r.mapped >= 50, `I18N_HTML 只有 ${r.mapped} 条`);
});
