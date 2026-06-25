/* cap.js — Capacitor 原生桥接共享 helper（zero-build，最先于 purchases/notify 加载）。
   purchases.js 和 notify.js 都用 `CAP`，避免各自重复 cap()/native()/plugin()。
   浏览器 / file:// 无 `window.Capacitor` → 三个函数都返回 falsy，适配层自动走「演示 / 空跑」分支。
   用顶层 `var CAP`（非仅 window.CAP）：浏览器里是全局；测试 vm 把所有 classic script 拼成一个
   作用域，顶层 var 才能被后续 purchases/notify 当共享变量读到。 */
var CAP = (function(){
 function cap(){ return (typeof window!=='undefined') && window.Capacitor; }
 function native(){ const c=cap(); return !!(c && c.isNativePlatform && c.isNativePlatform()); }
 function plugin(name){ const c=cap(); return c && c.Plugins && c.Plugins[name]; }
 return { cap, native, plugin };
})();
if(typeof window!=='undefined') window.CAP = CAP;
