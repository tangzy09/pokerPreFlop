'use strict';
/*
 * gen-ios-shots.js — 生成 App Store 截图(复用 gen-store-shots.js 的 headless Chrome 机制)。
 *
 *   iPhone 6.7"  : viewport 430×932 @3x → 1290×2796(APP_IPHONE_67)
 *   iPad 12.9"   : viewport 1024×1366 @2x → 2048×2732(APP_IPAD_PRO_3GEN_129;Capacitor 默认
 *                  TARGETED_DEVICE_FAMILY=1,2 → iPad 截图必传)
 *   付费墙审核图 : showPaywall() 真实渲染(浏览器无 RC → 回落 $29.99/$4.99 文案 = 真实美区价),
 *                  给 subscriptionAppStoreReviewScreenshots 用
 *
 *   运行: node tools/gen-ios-shots.js   输出: store-assets/ios/*.png
 *   en/zh 两套(zh 供 zh-Hans 商店页;ja 商店页复用 en 图——app UI 只有 en/zh)。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!BROWSER) { console.log('SKIP gen-ios-shots: 未找到 Chrome/Edge。'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'store-assets', 'ios');
fs.mkdirSync(OUT, { recursive: true });
const APP = fs.readFileSync(path.join(ROOT, 'gto-trainer.html'), 'utf8');

const REPORT_JS = [
  "var ob={field:'cash'};",
  "coachStartDiagnosis(ob,'simple',function(diag){try{coachRenderReport(diag);}catch(e){}});",
  "if(typeof _coachDiagQueue!=='undefined'&&_coachDiagQueue&&_coachDiagQueue.length){",
  " G.diagResults=_coachDiagQueue.map(function(it,i){return {sceneKey:it.sceneKey,t:it.t,hand:it.hand,choice:'fold',correct:(i%4!==0),variant:it.variant};});",
  " G.hands=G.diagResults.length; coachFinishDiagnosis();",
  "}",
  "['.hud','.hud2','.table','#actions','#feedback'].forEach(function(s){var n=document.querySelectorAll(s);for(var i=0;i<n.length;i++)n[i].style.display='none';});",
].join('');

const SCENES = [
  { key: 'home',     js: '' },
  { key: 'train',    js: "document.getElementById('homeCash').click();setTimeout(function(){document.getElementById('startBtn').click();},150);" },
  { key: 'feedback', js: "document.getElementById('homeCash').click();setTimeout(function(){document.getElementById('startBtn').click();setTimeout(function(){try{choose('fold');}catch(e){}},250);},150);" },
  { key: 'nash',     js: "document.getElementById('homeNash').click();" },
  { key: 'report',   js: REPORT_JS },
];

function shoot(html, outPath, W, H, scale) {
  const tmp = path.join(ROOT, '_genshot_' + path.basename(outPath, '.png') + '.html');
  fs.writeFileSync(tmp, html);
  try { fs.rmSync(outPath, { force: true }); } catch (e) {}
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars'];
  if (scale > 1) args.push('--force-device-scale-factor=' + scale);
  args.push('--screenshot=' + outPath, '--window-size=' + W + ',' + H, '--virtual-time-budget=6000',
    'file:///' + tmp.replace(/\\/g, '/'));
  try { execFileSync(BROWSER, args, { stdio: 'ignore' }); }
  catch (e) { /* headless 偶发非零退出但图已写 */ }
  finally { try { fs.rmSync(tmp, { force: true }); } catch (e) {} }
  return fs.existsSync(outPath);
}

let ok = 0, fail = 0;
function gen(name, js, W, H, scale) {
  const html = APP.replace('</body>', '<script>setTimeout(function(){try{' + js + '}catch(e){}},150);</script></body>');
  const out = path.join(OUT, name + '.png');
  const good = shoot(html, out, W, H, scale);
  console.log((good ? '  ✓ ' : '  ✗ ') + name + (good ? ' ' + Math.round(fs.statSync(out).size / 1024) + 'KB' : ''));
  good ? ok++ : fail++;
}

// iPhone 6.7" en + zh
for (const s of SCENES) gen('iphone67-en-' + s.key, s.js, 430, 932, 3);
for (const s of SCENES) gen('iphone67-zh-' + s.key, "setLang('zh');" + s.js, 430, 932, 3);
// iPad 12.9" en + zh(app 列宽 430,iPad 上居中呈现)
for (const s of SCENES) gen('ipad129-en-' + s.key, s.js, 1024, 1366, 2);
for (const s of SCENES) gen('ipad129-zh-' + s.key, "setLang('zh');" + s.js, 1024, 1366, 2);
// 订阅审核截图:付费墙(en)
gen('iap-paywall-en', "showPaywall();", 430, 932, 3);

console.log('\ngen-ios-shots: ' + ok + ' 张' + (fail ? ' / ' + fail + ' 失败' : '') + ' → store-assets/ios/');
process.exit(fail ? 1 : 0);
