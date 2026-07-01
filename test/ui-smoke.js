'use strict';
/*
 * UI 冒烟测试 —— 真实 DOM 下验证「导航 + 语言切换」这类纯逻辑测试覆盖不到的回归。
 *
 * 背景:test/*.test.js 在 vm + Proxy-stub 的假 DOM 里跑,测的是 MODES/范围/i18n 字典等
 * 纯逻辑,无法触发 onclick、无法判断「哪个屏可见」。本会话里语言选择器被改成只剩两页、
 * 四个返回键被改成回错页面——都是 UI 回归,49 个纯逻辑测试全绿却没拦住。本套件用系统
 * Chrome(headless)加载真实页面、真实点击、真实读 classList,堵住这个盲区。
 *
 * 这是「环境具备才跑」的可选套件(同 test:solver 之于 python):找不到 Chrome 直接 SKIP,
 * 不引入任何 npm 依赖,也不混进 `npm test`(只跑 test/*.test.js)。
 *   运行:  npm run test:ui        (或  CHROME_BIN=/path/to/chrome node test/ui-smoke.js)
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ---- 定位 Chrome(可用 CHROME_BIN 覆盖) ----
const CANDIDATES = [
  process.env.CHROME_BIN,
  '/c/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const CHROME = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CHROME) {
  console.log('SKIP ui-smoke: 未找到 Chrome(设置 CHROME_BIN 后重试)。');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'gto-trainer.html');
// 临时页面必须落在项目根目录:页面用相对 <script src="js/..."> 加载,放别处 js/ 找不到。
const tmpHtml = path.join(ROOT, `_uismoke_${process.pid}.html`);

// 注入脚本:页面加载后执行一连串操作,把 [名称, 是否通过] 结果写进 #smokeout 文本节点。
// curLang/setLang/LANG 都是 i18n.js 的 window 全局(classic script 共享作用域)。
const INJECT = `
<script>setTimeout(function(){
  var R=[];
  function vis(id){var e=document.getElementById(id);return !!(e&&!e.classList.contains('hide'));}
  function add(name, ok){ R.push([name, !!ok]); }
  try{
    add('boot: 主页可见', vis('homeScreen'));
    add('boot: 默认英文', typeof LANG!=='undefined' && LANG==='en');
    // 新手引导:全新档案首启应弹出,跳过后消失且不再弹
    var iv=document.getElementById('introOv');
    add('新手引导首启弹出', !!iv);
    if(iv){ var sk=iv.querySelector('#inSkip'); if(sk)sk.click(); }
    add('引导跳过后消失', !document.getElementById('introOv'));
    add('语言选择器存在', !!document.getElementById('langToggle'));
    var lt=document.getElementById('langToggle');
    add('语言选择器有 中/EN 两段', lt && lt.querySelectorAll('button[data-lang]').length===2);
    // 四个功能页:从主页打开 → 点返回 → 应回主页(目标屏与训练设置页都隐藏)
    [['homeStats','statsBack','statsScreen'],
     ['homeEquity','calcBack','calcScreen'],
     ['homeNash','nashBack','nashScreen'],
     ['homeReview','reviewBack','reviewScreen']].forEach(function(t){
      var open=t[0], back=t[1], scr=t[2];
      document.getElementById(open).click();
      var opened=vis(scr);
      document.getElementById(back).click();
      add(open+' 返回回主页', opened && vis('homeScreen') && !vis(scr) && !vis('startScreen'));
    });
    // 推弃特训:主页卡 → 选档屏 → 返回回主页
    document.getElementById('homePush').click();
    var pushOpened=vis('pushScreen');
    document.getElementById('pushBack').click();
    add('推弃特训 打开+返回回主页', pushOpened && vis('homeScreen') && !vis('pushScreen'));
    // 学习路径:主页卡 → 导览屏(带准确率 chip) → 返回回主页
    document.getElementById('homePath').click();
    var pathOpened=vis('guideScreen'), hasAcc=document.querySelectorAll('#guideScreen .gd-acc').length>0;
    document.getElementById('guideBack').click();
    add('学习路径 打开+有进度chip+返回回主页', pathOpened && hasAcc && vis('homeScreen') && !vis('guideScreen'));
    // 统计页:趋势卡存在
    document.getElementById('homeStats').click();
    add('统计页有趋势卡', vis('statsScreen') && !!document.getElementById('trendBody'));
    document.getElementById('statsBack').click();
    // 训练对局界面(所有覆盖屏隐藏)语言选择器仍在
    ['homeScreen','startScreen','overScreen','chartScreen','nashScreen','aboutScreen','calcScreen','guideScreen','reviewScreen','statsScreen','coachScreen'].forEach(function(id){var e=document.getElementById(id);if(e)e.classList.add('hide');});
    if(typeof _langBtnVis==='function')_langBtnVis();
    add('训练对局界面语言选择器仍显示', lt && lt.style.display!=='none');
    // 语言切换真的生效
    setLang('zh'); var zhOk = (typeof LANG!=='undefined' && LANG==='zh');
    setLang('en'); var enOk = (typeof LANG!=='undefined' && LANG==='en');
    add('语言切换 zh/en 生效', zhOk && enOk);
  }catch(e){ add('注入执行异常: '+e.message, false); }
  var out=document.createElement('div'); out.id='smokeout'; out.textContent=JSON.stringify(R);
  document.body.appendChild(out);
}, 250);<\/script>`;

fs.writeFileSync(tmpHtml, fs.readFileSync(HTML, 'utf8').replace('</body>', INJECT + '</body>'));

let dom;
try {
  dom = execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--dump-dom',
    '--virtual-time-budget=3000', 'file:///' + tmpHtml.replace(/\\/g, '/'),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  console.error('ui-smoke: Chrome 运行失败:', e.message);
  process.exit(1);
} finally {
  try { fs.rmSync(tmpHtml, { force: true }); } catch (e) {}
}

const m = dom.match(/<div id="smokeout">([\s\S]*?)<\/div>/);
if (!m) {
  console.error('ui-smoke: 页面没有产出结果(注入脚本可能没跑完或页面崩了)。');
  process.exit(1);
}
let results;
try { results = JSON.parse(m[1]); } catch (e) {
  console.error('ui-smoke: 结果无法解析:', m[1].slice(0, 200));
  process.exit(1);
}

let failed = 0;
for (const [name, ok] of results) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name);
  if (!ok) failed++;
}
console.log(`\nui-smoke: ${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
