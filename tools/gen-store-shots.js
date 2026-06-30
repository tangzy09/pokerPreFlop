'use strict';
/*
 * gen-store-shots.js — 生成 Google Play 商店素材(截图 + feature graphic)。
 *
 * 用系统 Chrome/Edge 的 headless 模式加载真实页面 gto-trainer.html,在 </body> 前
 * 注入一段导航脚本切到目标屏,再截图 —— 复用了 test/ui-smoke.js 同一套机制
 * (临时 HTML 必须落在项目根,页面用相对 <script src="js/..."> 才能解析)。
 *
 * 环境可选(同 ui-smoke / solver 套件):找不到浏览器则 SKIP(exit 0)。
 *   运行:  node tools/gen-store-shots.js      (或  npm run shots)
 *   输出:  store-assets/new-1..6-*.png(1080×2280) + feature-1024x500.png
 *
 * 注意:诊断报告(new-6)用 mock 结果跑真实聚合渲染;coachBuildDiagQueue 内部用
 * Math.random 洗牌,所以每次重生成报告的具体漏洞/计划文案会略有不同(都是合法报告)。
 * feature graphic 截 store-assets/_feature.html(可改那里的文案/排版重生成)。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ---- 定位浏览器(CHROME_BIN 可覆盖;Edge 与 Chrome 都是 Chromium,行为一致) ----
const CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!BROWSER) {
  console.log('SKIP gen-store-shots: 未找到 Chrome/Edge(设置 CHROME_BIN 后重试)。');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'store-assets');
const APP = fs.readFileSync(path.join(ROOT, 'gto-trainer.html'), 'utf8');
const PHONE_W = 540, PHONE_H = 1140; // ×2 → 1080×2280(Play 手机截图)

// 诊断报告:跑 coachStartDiagnosis + 填 mock 结果 + coachFinishDiagnosis(走真实聚合渲染),最后收起训练 chrome
const REPORT_JS = [
  "var ob={field:'cash'};",
  "coachStartDiagnosis(ob,'simple',function(diag){try{coachRenderReport(diag);}catch(e){}});",
  "if(typeof _coachDiagQueue!=='undefined'&&_coachDiagQueue&&_coachDiagQueue.length){",
  " G.diagResults=_coachDiagQueue.map(function(it,i){return {sceneKey:it.sceneKey,t:it.t,hand:it.hand,choice:'fold',correct:(i%4!==0),variant:it.variant};});",
  " G.hands=G.diagResults.length; coachFinishDiagnosis();",
  "}",
  "['.hud','.hud2','.table','#actions','#feedback'].forEach(function(s){var n=document.querySelectorAll(s);for(var i=0;i<n.length;i++)n[i].style.display='none';});",
].join('');

const SHOTS = [
  { name: 'new-1-home-en', js: '' },
  { name: 'new-2-home-zh', js: "setLang('zh');" },
  { name: 'new-3-train',   js: "document.getElementById('homeCash').click();setTimeout(function(){document.getElementById('startBtn').click();},150);" },
  { name: 'new-4-feedback',js: "document.getElementById('homeCash').click();setTimeout(function(){document.getElementById('startBtn').click();setTimeout(function(){try{choose('fold');}catch(e){}},250);},150);" },
  { name: 'new-5-nash',    js: "document.getElementById('homeNash').click();" },
  { name: 'new-6-report',  js: REPORT_JS },
];

// 把 html 写进 baseDir 的临时文件 → headless 截图 → 删临时文件。返回是否成功。
function shoot(html, outPath, W, H, scale, baseDir) {
  const tmp = path.join(baseDir, '_genshot_' + path.basename(outPath, '.png') + '.html');
  fs.writeFileSync(tmp, html);
  try { fs.rmSync(outPath, { force: true }); } catch (e) {}
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars'];
  if (scale > 1) args.push('--force-device-scale-factor=' + scale);
  args.push('--screenshot=' + outPath, '--window-size=' + W + ',' + H, '--virtual-time-budget=6000',
    'file:///' + tmp.replace(/\\/g, '/'));
  try { execFileSync(BROWSER, args, { stdio: 'ignore' }); }
  catch (e) { /* headless 偶发非零退出但图已写,下面以文件存在为准 */ }
  finally { try { fs.rmSync(tmp, { force: true }); } catch (e) {} }
  return fs.existsSync(outPath);
}

let ok = 0, fail = 0;
function report(name, good, outPath) {
  console.log((good ? '  ✓ ' : '  ✗ ') + name + (good ? '  ' + Math.round(fs.statSync(outPath).size / 1024) + 'KB' : ''));
  good ? ok++ : fail++;
}

// 1) 手机截图:临时 HTML 落在 ROOT(相对 js/ 才解析得到)
for (const s of SHOTS) {
  const html = APP.replace('</body>', '<script>setTimeout(function(){try{' + s.js + '}catch(e){}},150);</script></body>');
  const out = path.join(OUT, s.name + '.png');
  report(s.name, shoot(html, out, PHONE_W, PHONE_H, 2, ROOT), out);
}

// 2) feature graphic 1024×500:截 store-assets/_feature.html(临时落在 OUT,相对引用 new-1-home-en.png 才对)
const featSrc = path.join(OUT, '_feature.html');
if (fs.existsSync(featSrc)) {
  const out = path.join(OUT, 'feature-1024x500.png');
  report('feature-1024x500', shoot(fs.readFileSync(featSrc, 'utf8'), out, 1024, 500, 1, OUT), out);
} else {
  console.log('  - feature 跳过(缺 store-assets/_feature.html)');
}

console.log('\ngen-store-shots: ' + ok + ' 张生成' + (fail ? ' / ' + fail + ' 失败' : '') + ' → store-assets/');
process.exit(fail ? 1 : 0);
