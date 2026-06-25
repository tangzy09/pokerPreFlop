/* notify.js — 本地训练提醒（Capacitor Local Notifications）适配层。
   zero-build：原生壳里插件挂在 window.Capacitor.Plugins.LocalNotifications，直接用全局 bridge。
   - 原生 (Android/iOS)：开启后每天定时本地通知召回（纯本地，不联网、不破坏离线约束）。
   - 浏览器          ：没有 bridge → 全部空跑（网页不需要本地通知）。
   状态存 STORE.notify = { on:bool, h, m }；启动时 reschedule() 确保更新/重装后提醒仍在。
   文案走 tr()（i18n.js 先加载，双语）。 */
(function(){
 const NID = 1001;                                   // 固定通知 id（每日提醒只此一条，重排前先 cancel）
 const native=CAP.native;                         // 共享桥接 helper（见 js/cap.js）
 function plugin(){ return CAP.plugin('LocalNotifications'); }
 function T(k,d){ try{ return (typeof tr==='function') ? tr(k) : d; }catch(e){ return d; } }

 async function ensurePerm(){
  const P=plugin(); if(!P) return false;
  try{
   let s=await P.checkPermissions();
   if(s && s.display!=='granted'){ s=await P.requestPermissions(); }
   return !!(s && s.display==='granted');
  }catch(e){ console.warn('notify perm', e); return false; }
 }

 async function doSchedule(h,m){
  const P=plugin(); if(!P) return false;
  try{
   await P.cancel({ notifications:[{ id:NID }] });                 // 先清旧的，避免堆叠
   await P.schedule({ notifications:[{
    id:NID,
    title: T('notifyTitle','松鼠喊你练牌 🐿'),
    body:  T('notifyBody','花 2 分钟练几手翻前，保持手感'),
    schedule:{ on:{ hour:h, minute:m }, allowWhileIdle:true },     // 每天该时刻重复
    smallIcon:'ic_stat_notify', largeIcon:'ic_stat_notify'
   }]});
   return true;
  }catch(e){ console.warn('notify schedule', e); return false; }
 }

 const Notify = {
  get native(){ return native(); },
  isOn(){ try{ return !!(STORE.notify && STORE.notify.on); }catch(e){ return false; } },
  time(){ const n=(typeof STORE!=='undefined'&&STORE.notify)||{}; return { h: n.h==null?20:n.h, m: n.m==null?0:n.m }; },

  /* 开启每日提醒（默认 20:00）：请求权限 → 调度 → 存状态。返回是否成功 */
  async enable(h, m){
   if(!native()) return false;
   const t=this.time(); h=(h==null?t.h:h); m=(m==null?t.m:m);
   if(!await ensurePerm()) return false;
   const ok=await doSchedule(h,m);
   if(ok){ try{ STORE.notify={on:true,h,m}; persist(); }catch(e){} }
   return ok;
  },

  /* 关闭：取消调度 + 存状态 */
  async disable(){
   const P=plugin();
   try{ if(P) await P.cancel({ notifications:[{ id:NID }] }); }catch(e){}
   try{ STORE.notify={on:false}; persist(); }catch(e){}
   return true;
  },

  /* 启动时调用：若之前开过，重新调度（更新/重装后系统不保留旧排程） */
  async reschedule(){
   if(!native() || !this.isOn()) return;
   const t=this.time();
   if(await ensurePerm()) doSchedule(t.h, t.m);
  },
 };

 if(typeof window!=='undefined') window.Notify = Notify;
})();
