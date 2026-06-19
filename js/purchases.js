/* purchases.js — RevenueCat (Capacitor) 适配层。
   zero-build 友好：原生壳里 RevenueCat 插件会把自己挂到 window.Capacitor.Plugins.Purchases，
   这里直接用这个全局 bridge 调用，不需要 import / 打包（保持经典脚本 + file:// 可跑）。
   - 原生 (Android/iOS) ：走真实 IAP，购买状态写进 STORE.proEntitled，isPro() 据此判断。
   - 浏览器          ：没有 bridge → 退化为「网页演示」，买断按钮只做本地占位解锁（不收费）。

   接入前你需要在 RevenueCat 控制台 + Google Play 后台配好，再把下面填上：
     RC_API_KEY.android = 'goog_xxx'   ← RevenueCat → Project → API keys 里的 Android 公开 key
     ENTITLEMENT        = 'pro'        ← RevenueCat 里建的 Entitlement 标识
   产品匹配 MATCH 已做鲁棒：优先按 RevenueCat 的 package 类型(MONTHLY/LIFETIME)，
   再按 product / package 标识兜底 —— 所以 Test Store 的 monthly/lifetime 与 Play 的自定义 id 都能命中。
*/
(function(){
 // RevenueCat 公开 key。USE_TEST_STORE=true 时用 Test Store（模拟器/沙盒跑通购买，不需真实商店）；
 // 上线 Google Play 收钱时：把真实产品注册到 RC 的 Play Store app + 加进 offering，再把开关改 false。
 const USE_TEST_STORE = false;
 const RC_API_KEY = {
  test:    'test_ScghqMYHRgjSpJgXDpNePkMHJII',  // ← RevenueCat Test Store（当前用它）
  android: 'goog_IHsbgwhdCaAzrZoZLrDbTpSyXQv',  // ← Google Play（上线用）
  ios:     'appl_REPLACE_ME',                   // ← App Store（以后做 iOS）
 };
 const ENTITLEMENT = 'pro';                                   // ← RevenueCat Entitlement 标识
 // 按钮 → 想买哪种 package：types=RevenueCat 预定义包类型；ids=可能的 product/package 标识（大小写不敏感）
 const MATCH = {
  sub:      { types:['MONTHLY','ANNUAL','WEEKLY','TWO_MONTH','THREE_MONTH','SIX_MONTH'], ids:['pro_monthly','monthly'] },
  lifetime: { types:['LIFETIME'], ids:['pro_lifetime','lifetime'] },
 };

 function cap(){ return (typeof window!=='undefined') && window.Capacitor; }
 function native(){ const c=cap(); return !!(c && c.isNativePlatform && c.isNativePlatform()); }
 function plugin(){ const c=cap(); return c && c.Plugins && c.Plugins.Purchases; }
 function apiKey(){ if(USE_TEST_STORE) return RC_API_KEY.test; const c=cap(); const p=c&&c.getPlatform&&c.getPlatform(); return p==='ios'?RC_API_KEY.ios:RC_API_KEY.android; }

 const Pay = {
  get native(){ return native(); },

  /* 启动时调一次：配置 SDK + 拉当前购买状态刷新解锁缓存 */
  async init(){
   if(!native()) return;                       // 浏览器：演示态，什么都不做
   const P=plugin(); if(!P) return;
   try{ await P.configure({ apiKey: apiKey() }); await Pay.refresh(); }
   catch(e){ console.warn('RC init', e); }
  },

  /* 读取 customerInfo → 把 'pro' entitlement 是否激活写进本地缓存 */
  async refresh(){
   const P=plugin(); if(!P) return false;
   try{ const r=await P.getCustomerInfo(); return Pay._apply(r&&r.customerInfo); }
   catch(e){ console.warn('RC refresh', e); return false; }
  },
  _apply(info){
   const on = !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[ENTITLEMENT]);
   try{ STORE.proEntitled = on; persist(); }catch(e){}
   try{ if(typeof rerenderUI==='function') rerenderUI(); }catch(e){}
   return on;
  },

  /* 购买：kind = 'sub' | 'lifetime'，返回是否解锁成功 */
  async buy(kind){
   if(!native()){ try{ setPro(true); }catch(e){} return true; }   // 浏览器演示：本地占位解锁
   const P=plugin(); if(!P) return false;
   try{
    const offs=await P.getOfferings();
    const pkgs=(offs && offs.current && offs.current.availablePackages) || [];
    const m=MATCH[kind]||MATCH.sub;
    const lc=s=>(''+(s||'')).toLowerCase();
    const ids=m.ids.map(lc);
    const pkg=pkgs.find(p=>{
     const pt=p.packageType, pid=lc(p.product&&p.product.identifier), kid=lc(p.identifier);
     return (pt && m.types.indexOf(pt)>=0) || ids.indexOf(pid)>=0 || ids.indexOf(kid)>=0;
    });
    if(!pkg){ console.warn('RC: 当前 Offering 找不到匹配 package', kind, pkgs); return false; }
    const r=await P.purchasePackage({ aPackage: pkg });
    return Pay._apply(r&&r.customerInfo);
   }catch(e){
    if(e && (e.userCancelled || /cancel/i.test(''+(e.message||e.code)))) return false; // 用户取消，不报错
    console.warn('RC buy', e); return false;
   }
  },

  /* 恢复购买（商店审核要求提供入口；换设备/重装后凭账号恢复） */
  async restore(){
   if(!native()){ try{ setPro(true); }catch(e){} return true; }
   const P=plugin(); if(!P) return false;
   try{ const r=await P.restorePurchases(); return Pay._apply(r&&r.customerInfo); }
   catch(e){ console.warn('RC restore', e); return false; }
  },
 };

 if(typeof window!=='undefined') window.Pay = Pay;
})();
