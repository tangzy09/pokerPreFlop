'use strict';
/*
 * embed-fonts.js — 把 Space Grotesk + Space Mono 的 latin 子集 woff2 以 base64
 * 内嵌进 gto-trainer.html，替换原来的 3 行 Google Fonts CDN <link>，实现完全离线。
 * 中文字体 Noto Sans SC 不内嵌（体积过大；Android WebView 自带等价系统 CJK 字体），
 * 仍保留在 font-family 栈里走系统回退。
 *   node tools/embed-fonts.js
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'gto-trainer.html');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getCss(query) {
  const r = await fetch('https://fonts.googleapis.com/css2?' + query, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('CSS fetch failed: ' + r.status);
  return r.text();
}

// 从 css2 输出里取「/* latin */」块的 woff2 URL（只要纯 latin 子集，够覆盖 ASCII + Latin-1）
function latinUrl(css) {
  const m = css.match(/\/\*\s*latin\s*\*\/\s*@font-face\s*\{[^}]*?src:\s*url\((https:\/\/[^)]+\.woff2)\)/);
  if (!m) throw new Error('latin woff2 url not found');
  return m[1];
}

async function fetchB64(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('woff2 fetch failed: ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  return { b64: buf.toString('base64'), bytes: buf.length };
}

(async () => {
  const grotCss = await getCss('family=Space+Grotesk:wght@500;600;700&display=swap');
  const monoCss = await getCss('family=Space+Mono:wght@700&display=swap');
  const grotUrl = latinUrl(grotCss);
  const monoUrl = latinUrl(monoCss);

  const grot = await fetchB64(grotUrl);
  const mono = await fetchB64(monoUrl);
  console.log('Space Grotesk latin:', grot.bytes, 'B  ->', grotUrl);
  console.log('Space Mono 700 latin:', mono.bytes, 'B  ->', monoUrl);

  // Space Grotesk 是可变字体：一个文件覆盖 500–700，用 font-weight 范围声明
  const style =
`<!-- 内嵌字体（离线）：Space Grotesk + Space Mono 的 latin 子集；中文(Noto Sans SC)走系统回退 -->
<style>
@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:500 700;font-display:swap;src:url(data:font/woff2;base64,${grot.b64}) format('woff2')}
@font-face{font-family:'Space Mono';font-style:normal;font-weight:700;font-display:swap;src:url(data:font/woff2;base64,${mono.b64}) format('woff2')}
</style>`;

  let html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">');
  const cssLink = html.indexOf('<link href="https://fonts.googleapis.com/css2');
  if (start < 0 || cssLink < 0) throw new Error('找不到要替换的 <link> 行');
  const end = html.indexOf('>', cssLink) + 1;
  html = html.slice(0, start) + style + html.slice(end);

  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html)) throw new Error('替换后仍残留 CDN 引用');
  fs.writeFileSync(htmlPath, html);
  console.log('done — gto-trainer.html 已内嵌字体，CDN 引用已移除');
})().catch(e => { console.error(e); process.exit(1); });
