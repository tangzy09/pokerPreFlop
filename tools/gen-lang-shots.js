'use strict';
/*
 * gen-lang-shots.js — 逐语言逐屏截图,给 UI i18n 做 HARD GATE(溢出/压字/露键/占位符残留)。
 *
 *   node tools/gen-lang-shots.js de            → _langshots/de-*.png
 *   node tools/gen-lang-shots.js de ja es      → 多语言一起
 *
 * ⚠ 「首页每种语言都正常」≠ 没问题:溢出往往藏在二级界面(动作按钮/反馈/漏洞分析/付费墙),
 *   那里文案最长。所以每屏都要截,**每张都要人肉 Read 看**。德/俄比英文长 30–40%。
 *
 * 复用 gen-store-shots.js 的两处必不可少的注入(否则出残图):
 *   ① PRESEED —— <head> 预置 localStorage(seenIntro=1 压掉首启引导 + gtoLang=<code> 直接以该语言启动)
 *   ② pinApp(W) —— Chromium headless 有 ~480 CSS px 最小窗口宽度,窄窗布局会被钳在 480、
 *      截图画布按 window-size×scale 裁 → 右侧被切。窄于 480 时把 #app 强制成目标宽度并左对齐。
 * 产物 _langshots/ 已 gitignore(是验收用的临时图,不入库)。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!BROWSER) { console.log('SKIP gen-lang-shots: 未找到 Chrome/Edge。'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_langshots');
const APP = fs.readFileSync(path.join(ROOT, 'gto-trainer.html'), 'utf8');
const W = 430, H = 932, SCALE = 2;

const pinApp = (w) => (w < 480
  ? `<style>#app{left:0!important;right:auto!important;margin:0!important;width:${w}px!important;max-width:${w}px!important}</style>`
  : '');
const preseed = (code) =>
  `<script>try{localStorage.setItem("gtoTrainer_v1",JSON.stringify({seenIntro:1}));` +
  `localStorage.setItem("gtoLang",${JSON.stringify(code)});}catch(e){}</script>`;
const KILL_INTRO = 'var _iv=document.getElementById("introOv");if(_iv)_iv.remove();';

const REPORT_JS = [
  "var ob={field:'cash'};",
  "coachStartDiagnosis(ob,'simple',function(diag){try{coachRenderReport(diag);}catch(e){}});",
  "if(typeof _coachDiagQueue!=='undefined'&&_coachDiagQueue&&_coachDiagQueue.length){",
  " G.diagResults=_coachDiagQueue.map(function(it,i){return {sceneKey:it.sceneKey,t:it.t,hand:it.hand,choice:'fold',correct:(i%4!==0),variant:it.variant};});",
  ' G.hands=G.diagResults.length; coachFinishDiagnosis();',
  '}',
  "['.hud','.hud2','.table','#actions','#feedback'].forEach(function(s){var n=document.querySelectorAll(s);for(var i=0;i<n.length;i++)n[i].style.display='none';});",
].join('');

const SCENES = [
  { key: 'home', js: '' },
  // 动作按钮是最容易被长文案撑爆的地方
  { key: 'train', js: "document.getElementById('homeCash').click();setTimeout(function(){document.getElementById('startBtn').click();},150);" },
  { key: 'feedback', js: "document.getElementById('homeCash').click();setTimeout(function(){document.getElementById('startBtn').click();setTimeout(function(){try{choose('fold');}catch(e){}},250);},150);" },
  { key: 'nash', js: "document.getElementById('homeNash').click();" },
  { key: 'stats', js: "document.getElementById('homeStats').click();" },   // 漏洞分析/画像:长标签
  { key: 'paywall', js: 'try{showPaywall();}catch(e){}' },                  // pitch 数组 5 条卖点
  { key: 'report', js: REPORT_JS },
];

function shoot(html, outPath) {
  const tmp = path.join(ROOT, '_langshot_tmp.html');
  fs.writeFileSync(tmp, html);
  try { fs.rmSync(outPath, { force: true }); } catch (e) {}
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=' + SCALE,
    '--screenshot=' + outPath, '--window-size=' + W + ',' + H, '--virtual-time-budget=7000',
    'file:///' + tmp.replace(/\\/g, '/')];
  try { execFileSync(BROWSER, args, { stdio: 'ignore' }); } catch (e) { /* headless 偶发非零退出但图已写 */ }
  finally { try { fs.rmSync(tmp, { force: true }); } catch (e) {} }
  return fs.existsSync(outPath);
}

const codes = process.argv.slice(2);
if (!codes.length) { console.error('用法: node tools/gen-lang-shots.js <lang…>  例: node tools/gen-lang-shots.js de ja es'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

let ok = 0, fail = 0;
for (const code of codes) {
  for (const s of SCENES) {
    const html = APP
      .replace('<meta charset="UTF-8">', '<meta charset="UTF-8">' + preseed(code))
      .replace('</head>', pinApp(W) + '</head>')
      .replace('</body>', `<script>setTimeout(function(){try{${KILL_INTRO}${s.js}}catch(e){}},220);</script></body>`);
    const out = path.join(OUT, `${code}-${s.key}.png`);
    const good = shoot(html, out);
    console.log((good ? '  ✓ ' : '  ✗ ') + `${code}-${s.key}` + (good ? ` ${Math.round(fs.statSync(out).size / 1024)}KB` : ''));
    good ? ok++ : fail++;
  }
}
console.log(`\ngen-lang-shots: ${ok} 张${fail ? ` / ${fail} 失败` : ''} → _langshots/`);
console.log('⚠ 现在**逐张 Read 看**:溢出 / 压字 / 露键 / {占位符} 残留 / 语言不对。文件存在 ≠ 图对。');
process.exit(fail ? 1 : 0);
