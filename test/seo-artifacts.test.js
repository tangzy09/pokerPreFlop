/* seo-artifacts.test.js — 落地页生成物的同步锁:
   slug 表 ↔ charts/ 静态页 ↔ sitemap.xml ↔ 首页入链 四方必须对应。
   改了范围数据/文案却忘跑 gen-seo-pages 时,这里直接红,而不是线上 404 / 收录断层。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const PAGES = require(path.join(root, 'tools', 'seo-slugs.js'));
const C = require(path.join(root, 'tools', 'seo-content.js'));
const SITE = 'https://pre-flop.ai-speeds.com';

test('每张 spoke 有冻结 slug、双语文案、en/zh 两个文件落盘', () => {
  const seen = new Set();
  for (const p of PAGES) {
    assert.ok(p.slug && !seen.has(p.slug), `slug 缺失或重复: ${p.slug}`);
    seen.add(p.slug);
    assert.ok(C[p.slug] && C[p.slug].en && C[p.slug].zh, `${p.slug} 缺双语文案(tools/seo-content.js)`);
    for (const rel of [`charts/${p.slug}.html`, `charts/zh/${p.slug}.html`]) {
      assert.ok(fs.existsSync(path.join(root, rel)), `缺 ${rel} — 跑 node tools/gen-seo-pages.js`);
    }
  }
  // 反向:文案表里没有指向不存在页面的孤儿
  const slugs = new Set(PAGES.map((p) => p.slug));
  for (const k of Object.keys(C)) assert.ok(slugs.has(k), `seo-content 含孤儿 slug: ${k}`);
});

test('每页:canonical 自指 + hreflang 互指 + 可见 FAQ + FAQPage JSON-LD', () => {
  for (const p of PAGES) {
    for (const [rel, lang] of [[`charts/${p.slug}.html`, 'en'], [`charts/zh/${p.slug}.html`, 'zh']]) {
      const html = fs.readFileSync(path.join(root, rel), 'utf8');
      const canon = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1];
      assert.equal(canon, `${SITE}/${rel}`, `${rel} canonical 应自指`);
      assert.match(html, /hreflang="en"/, rel + ' 缺 hreflang en');
      assert.match(html, /hreflang="zh"/, rel + ' 缺 hreflang zh');
      assert.match(html, /hreflang="x-default"/, rel + ' 缺 x-default');
      assert.match(html, /<details class="faq"/, rel + ' 缺可见 FAQ(只写 JSON-LD 违规)');
      assert.match(html, /"@type":"FAQPage"/, rel + ' 缺 FAQPage JSON-LD');
      assert.match(html, /<table class="grid">/, rel + ' 缺 13×13 静态范围图');
      // 诚实红线:JSON-LD 绝不放编造评分/评论
      const ldm = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      assert.ok(ldm, rel + ' 缺 JSON-LD');
      assert.doesNotMatch(ldm[1], /aggregateRating|"review"/i, rel + ' JSON-LD 出现评分/评论(诚实红线)');
      JSON.parse(ldm[1]); // 必须可解析
    }
  }
});

test('sitemap:根 + 2 pillar + 2/spoke,每个 URL 都能落到真实文件', () => {
  const sm = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, 1 + 2 + PAGES.length * 2, 'sitemap URL 数不符 — 跑 gen-seo-pages');
  for (const loc of locs) {
    assert.ok(loc.startsWith(SITE), 'sitemap 混入异站 URL: ' + loc);
    let rel = loc.slice(SITE.length).replace(/^\//, '');
    if (!rel) rel = 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    assert.ok(fs.existsSync(path.join(root, rel)), `sitemap 指向不存在的文件: ${rel}`);
  }
});

/* 内链断层是收录的头号杀手:落地页体系若只有 sitemap 可达(从根走不到),抓取优先级垫底。
   首页里那个真实 <a href="charts/"> 是唯一的根入口 —— 删了它整棵树从根断开。 */
test('首页(index.html)必须有真实 <a> 指向 charts/ pillar,且 index.html = app 本体(非跳转壳)', () => {
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(idx, /href="charts\/"/, 'index.html 缺 charts/ 入链 — 50 张落地页会从根断开');
  assert.doesNotMatch(idx, /http-equiv="refresh"/i, 'index.html 不该是 meta-refresh 跳转壳(根域必须自己就是内容)');
  assert.match(idx, /<div id="app">/, 'index.html 应由 gto-trainer.html 生成 — 跑 node tools/gen-seo-pages.js');
  const canon = (idx.match(/rel="canonical" href="([^"]+)"/) || [])[1];
  assert.equal(canon, SITE + '/', 'index.html canonical 应指根域');
});

/* 文案里用 **粗体** 标重点,生成器负责转 <b>。忘了转就会把星号原样印在页面上
   (实测中文 lead 里出现过 `**以 bb 为单位的期望值**`),meta/JSON-LD 里也要脱掉。 */
test('生成页里不得残留 markdown 星号', () => {
  const bad = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!f.name.endsWith('.html')) continue;
      if (/\*\*/.test(fs.readFileSync(p, 'utf8'))) bad.push(path.relative(root, p).replace(/\\/g, '/'));
    }
  };
  walk(path.join(root, 'charts'));
  assert.deepEqual(bad, [], '这些页残留了 ** 星号(mdBold/stripMd 漏用)');
});

/* title/desc 阈值按显示宽度算(CJK×2)。生成器若按 .length 截断,中文页必然溢出。 */
test('全部生成页 title(30–60) / desc(70–155) 落在 SEO 区间(CJK 按 2 计)', () => {
  const CJK = /[⺀-鿿　-ヿ가-힯＀-￯]/;
  const eff = (s) => [...String(s)].reduce((a, c) => a + (CJK.test(c) ? 2 : 1), 0);
  const dec = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
  const bad = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!f.name.endsWith('.html')) continue;
      const h = fs.readFileSync(p, 'utf8');
      const t = eff(dec((h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''));
      const d = eff(dec((h.match(/name="description" content="([^"]*)"/) || [])[1] || ''));
      if (t > 60 || t < 30 || d > 155 || d < 70) {
        bad.push(`${path.relative(root, p).replace(/\\/g, '/')} (title=${t} desc=${d})`);
      }
    }
  };
  walk(path.join(root, 'charts'));
  assert.deepEqual(bad, [], '超出 SEO 区间的页');
});
