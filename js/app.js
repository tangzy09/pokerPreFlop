/* app.js — persistence, audio, confetti, hand helpers, game engine, charts UI
   and boot. Loads last; depends on ranges.js, modes.js, packs.js. */
/* ============ local persistence (graceful: works locally, no-ops in restricted previews) ============ */
const STORE_KEY='gtoTrainer_v1';
function loadStore(){try{const s=localStorage.getItem(STORE_KEY);return s?JSON.parse(s):{};}catch(e){return {};}}
let STORE=loadStore();
let _persistQ=false;
function persist(){                               // 同一 tick 多次调用合并为一次真实写(答错一手曾 stats+错题堆双写全量 STORE)
 if(_persistQ)return;
 const w=()=>{_persistQ=false;try{localStorage.setItem(STORE_KEY,JSON.stringify(STORE));}catch(e){}};
 if(typeof queueMicrotask==='function'){_persistQ=true;queueMicrotask(w);} else w();
}
function persistPrefs(){STORE.prefs={format:selFormat,variant:selVariant,deal:selDeal};persist();}
function clearStore(){STORE={};try{localStorage.removeItem(STORE_KEY);}catch(e){}}

/* ============ Pro 功能门控 + 付费墙 ============
   现在「解锁」只翻本地开关（占位）；上架时把 isPro()/解锁按钮换成 RevenueCat 授权校验即可。
   红线：核心训练永久免费，Pro 只锁进阶能力（自算推弃训练 / 算胜率 / 画像·漏洞·计划）。*/
// 原生 app(Android/iOS)：读 RevenueCat 'pro' entitlement 缓存；浏览器：永远解锁（网页不收费，仅演示）
function isPro(){ if(typeof Pay!=='undefined' && Pay.native) return !!STORE.proEntitled; return true; }
function setPro(v){STORE.pro=!!v;persist();
 try{buildVariants('selVariant','selVarLabel',selFormat,selVariant,k=>selVariant=k);markFormatLocks();renderStartChart();}catch(e){} // 刷新锁标/图表模糊
}
// 免费/付费划分：每个游戏类型的「场景」前一半免费、后一半锁（未付费时）。
//  现金：场景 = selFormat 列表(开局+防守/面对3bet/面对4bet/挤压/冷跟)；MTT：场景 = 变体分组(group)。
//  锁住的：选择器加🔒、图表预览模糊、开始训练弹付费墙。
function _lockedSlice(list){return list.slice(Math.ceil(list.length/2));}                       // 后一半=锁
function _cashLockedFmts(){return new Set(_lockedSlice(GAMETYPES.cash.formats));}
function _mttLockedGroups(){return new Set(_lockedSlice([...new Set(Object.values(VARIANTS.mtt).map(v=>v.group))]));}
// 现金 cash format 内部再按 variant group 半分(标准 100bb 免费 / 筹码深度等新组 Pro)——与 MTT group 门控同款
function _cashLockedGroups(){return new Set(_lockedSlice([...new Set(Object.values(VARIANTS.cash).map(v=>v.group))]));}
function spotLocked(fmt,variant){
 if(isPro())return false;
 if(gameOf(fmt)==='cash'){
  if(_cashLockedFmts().has(fmt))return true;
  if(fmt==='cash'){const v=VARIANTS.cash[variant];return v?_cashLockedGroups().has(v.group):false;}
  return false;
 }
 const v=VARIANTS.mtt&&VARIANTS.mtt[variant]; return v?_mttLockedGroups().has(v.group):false;
}
const PRO_PITCH=[
 '🔍 个人画像 + 漏洞分析（最大漏洞 · 太松/太紧/被动/过激）',
 '🗓 训练计划（按需练度排序 · 一键去练）',
 '♠ 全部自算 Nash 推弃训练（8–25bb · 6人 · 单挑HU · 面对全下）',
 '🧮 算胜率计算器（翻前 / 翻后 equity）',
];
function showPaywall(why){
 try{aInit();}catch(e){}
 let el=document.getElementById('paywall');
 if(!el){
  el=document.createElement('div');el.id='paywall';
  el.style.cssText='position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.66);padding:24px';
  el.innerHTML=`<div style="max-width:360px;width:100%;background:var(--panel,#161d18);border:1px solid var(--gold,#e8c66a);border-radius:18px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
   <div style="font-family:'Space Grotesk';font-weight:700;font-size:21px;color:var(--gold,#e8c66a);text-align:center">${tr('pwTitle')}</div>
   <div id="pwWhy" style="text-align:center;color:var(--muted,#8fa79a);font-size:13px;margin:4px 0 14px"></div>
   <div id="pwList" style="display:flex;flex-direction:column;gap:9px;font-size:13.5px;color:var(--ink,#f1f5ee)"></div>
   <button id="pwYear" style="appearance:none;border:0;cursor:pointer;font-family:inherit;font-weight:700;font-size:16px;color:#16110a;background:linear-gradient(180deg,var(--gold,#e8c66a),var(--gold2,#b8902f));width:100%;padding:13px;border-radius:13px;margin-top:16px;display:flex;flex-direction:column;gap:1px;align-items:center">
     <span>${tr('pwYear')}</span><small style="font-weight:500;font-size:11px;opacity:.72">${tr('pwYearNote')}</small></button>
   <button id="pwSub" style="appearance:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:16px;color:var(--gold,#e8c66a);background:transparent;border:1px solid var(--gold,#e8c66a);width:100%;padding:13px;border-radius:13px;margin-top:9px;display:flex;flex-direction:column;gap:1px;align-items:center">
     <span>${tr('pwSub')}</span><small style="font-weight:500;font-size:11px;opacity:.72">${tr('pwSubNote')}</small></button>
   <button id="pwRestore" style="appearance:none;border:0;cursor:pointer;font-family:inherit;font-size:13px;color:var(--muted,#8fa79a);background:transparent;width:100%;padding:8px;margin-top:8px;text-decoration:underline">${tr('pwRestore')}</button>
   <button id="pwClose" style="appearance:none;border:0;cursor:pointer;font-family:inherit;font-size:14px;color:var(--muted,#8fa79a);background:transparent;width:100%;padding:10px;margin-top:2px">${tr('pwClose')}</button>
   <div style="text-align:center;color:var(--foldink,#54655a);font-size:11px;margin-top:6px">${tr('pwFoot')}</div>
  </div>`;
  document.body.appendChild(el);
  el.querySelector('#pwList').innerHTML=tRaw('pitch').map(s=>`<div>· ${s}</div>`).join('');
  el.querySelector('#pwClose').onclick=()=>{try{SFX.click();}catch(e){}el.remove();};
  const _close=()=>{el.remove();try{toast(tr('proUnlocked'),'🐿',true);}catch(e){}};
  const _buy=async(kind)=>{ // 原生走 RevenueCat IAP；浏览器走本地占位（见 Pay.buy）
   try{SFX.level();}catch(e){}
   let ok=false; try{ ok = (typeof Pay!=='undefined') ? await Pay.buy(kind) : true; if(typeof Pay==='undefined') setPro(true); }catch(e){}
   if(ok) _close();
  };
  el.querySelector('#pwYear').onclick=()=>_buy('year');
  el.querySelector('#pwSub').onclick=()=>_buy('sub');
  const rb=el.querySelector('#pwRestore');
  if(typeof Pay!=='undefined' && Pay.native){ rb.onclick=async()=>{try{SFX.click();}catch(e){} let ok=false; try{ok=await Pay.restore();}catch(e){} if(ok)_close(); else try{toast(tr('pwNoPurchase'),'🐿');}catch(e){}}; }
  else rb.style.display='none';   // 浏览器演示不显示「恢复购买」
 }
 el.querySelector('#pwWhy').textContent=why||tr('pwWhyDefault');
 return false;
}

/* ============ audio (synth) — smoothed envelopes + master lowpass/compressor
   for a softer, click-free feel; noise ticks for tactile UI/deal sounds ============ */
let AC=null, MASTER=null, _noiseBuf=null;
function aInit(){
 if(AC) return;
 try{
  AC=new (window.AudioContext||window.webkitAudioContext)();
  MASTER=AC.createGain(); MASTER.gain.value=0.85;
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7000; lp.Q.value=0.4;   // tame harshness
  const comp=AC.createDynamicsCompressor();                                                        // even out peaks
  comp.threshold.value=-16; comp.knee.value=22; comp.ratio.value=3.2; comp.attack.value=0.003; comp.release.value=0.16;
  MASTER.connect(lp); lp.connect(comp); comp.connect(AC.destination);
  const n=Math.floor(AC.sampleRate*0.3)||1; _noiseBuf=AC.createBuffer(1,n,AC.sampleRate);          // reusable white noise
  const d=_noiseBuf.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
 }catch(e){}
}
function _resume(){ try{ if(AC&&AC.state==='suspended') AC.resume(); }catch(e){} }
// smooth voice: exp attack + exp decay + tiny linear kill (no clicks), routed through MASTER
function tone(freq,dur,o={}){
 if(!AC) return; _resume();
 const type=o.type||'sine', gain=o.gain!=null?o.gain:0.14, delay=o.delay||0, attack=o.attack||0.01;
 const t0=AC.currentTime+delay, osc=AC.createOscillator(), v=AC.createGain();
 osc.type=type; osc.frequency.setValueAtTime(freq,t0);
 if(o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1,o.glideTo),t0+dur);
 v.gain.setValueAtTime(0.0001,t0);
 v.gain.exponentialRampToValueAtTime(gain,t0+attack);
 v.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
 v.gain.linearRampToValueAtTime(0,t0+dur+0.02);
 osc.connect(v); v.connect(MASTER||AC.destination);
 osc.start(t0); osc.stop(t0+dur+0.04);
}
// short band-passed noise tick (UI click / card flick) — tactile, not beepy
function ntick(dur,o={}){
 if(!AC||!_noiseBuf) return; _resume();
 const gain=o.gain!=null?o.gain:0.05, delay=o.delay||0, freq=o.freq||1800, Q=o.Q||0.7;
 const t0=AC.currentTime+delay, src=AC.createBufferSource(), f=AC.createBiquadFilter(), v=AC.createGain();
 src.buffer=_noiseBuf; f.type='bandpass'; f.frequency.value=freq; f.Q.value=Q;
 v.gain.setValueAtTime(gain,t0); v.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
 src.connect(f); f.connect(v); v.connect(MASTER||AC.destination);
 src.start(t0); src.stop(t0+dur+0.02);
}
const SFX={
 click(){ ntick(0.03,{gain:0.04,freq:2200,Q:0.6}); },                                              // soft tick
 deal(){ ntick(0.05,{gain:0.06,freq:1500,Q:0.5}); tone(420,0.05,{type:'triangle',gain:0.05,glideTo:300}); }, // card flick
 correct(){ tone(659.25,0.10,{type:'triangle',gain:0.12}); tone(987.77,0.16,{type:'triangle',gain:0.10,delay:0.07}); }, // rising 5th
 great(){ [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,0.30,{type:'triangle',gain:0.11,delay:i*0.07})); tone(1568,0.5,{type:'sine',gain:0.05,delay:0.28}); }, // Cmaj arpeggio + sparkle
 wrong(){ tone(233.08,0.22,{type:'sine',gain:0.12,glideTo:146.83}); tone(174.61,0.18,{type:'triangle',gain:0.06,delay:0.03}); ntick(0.04,{gain:0.03,freq:520,Q:0.4}); }, // soft descending thud
 level(){ [523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>tone(f,0.22,{type:'triangle',gain:0.12,delay:i*0.075})); tone(2093,0.45,{type:'sine',gain:0.05,delay:0.40}); }, // triumphant climb
 over(){ [440,392,329.63,261.63].forEach((f,i)=>tone(f,0.34,{type:'sine',gain:0.12,delay:i*0.14})); }, // gentle fall
};
function buzz(p){if(navigator.vibrate)navigator.vibrate(p);}

/* ============ confetti ============ */
const fx=document.getElementById('fx');const fxc=fx.getContext('2d');let parts=[],raf=null;
function resize(){fx.width=innerWidth;fx.height=innerHeight;}addEventListener('resize',resize);resize();
function burst(x,y,colors,n=26,power=7){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,sp=power*(.4+Math.random());
 parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,g:.22,life:1,c:colors[i%colors.length],s:4+Math.random()*4,r:Math.random()*6});}
 if(!raf)loopFx();}
function loopFx(){fxc.clearRect(0,0,fx.width,fx.height);parts=parts.filter(p=>p.life>0);
 parts.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.life-=.018;p.r+=.2;
  fxc.globalAlpha=Math.max(p.life,0);fxc.fillStyle=p.c;fxc.save();fxc.translate(p.x,p.y);fxc.rotate(p.r);
  fxc.fillRect(-p.s/2,-p.s/2,p.s,p.s*1.6);fxc.restore();});
 fxc.globalAlpha=1;if(parts.length)raf=requestAnimationFrame(loopFx);else raf=null;}

/* ============ helpers ============ */
const SUITS=[['♠','blk'],['♥','red'],['♦','red'],['♣','blk']];
function rankFace(r){return r==='T'?'10':r;}
function dealCards(hand){ // hand like AKs / TT / A2o → [{r,suit,col},...]
 let r1,r2,type;
 if(hand.length===2){r1=hand[0];r2=hand[1];type='p';}
 else{r1=hand[0];r2=hand[1];type=hand[2];}
 let s=[...SUITS],i1=Math.floor(Math.random()*4);let suit1=s[i1];
 let suit2;
 if(type==='s'){suit2=suit1;}
 else{let rest=s.filter((_,i)=>i!==i1);suit2=rest[Math.floor(Math.random()*rest.length)];}
 return [{r:r1,sym:suit1[0],c:suit1[1]},{r:r2,sym:suit2[0],c:suit2[1]}];
}
function handLabel(r,c){if(r===c)return RANKS[r]+RANKS[r];return r<c?RANKS[r]+RANKS[c]+'s':RANKS[c]+RANKS[r]+'o';}
function combosOf(h){return h.length===2?6:h.endsWith('s')?4:12;}

/* deal-filter: which class of hands to drill */
const HANDFILTERS={
 smart:{label:'智能',sub:'弱项优先·系统覆盖',short:'智能'},
 all:{label:'全部',sub:'真实随机',short:'全部'},
 good:{label:'好牌',sub:'价值/标准',short:'好牌'},
 edge:{label:'边缘',sub:'难点·混合',short:'边缘'},
 bad:{label:'坏牌',sub:'练弃牌纪律',short:'坏牌'},
};
const ALL169=(()=>{const a=[];for(let r=0;r<13;r++)for(let c=0;c<13;c++)a.push(handLabel(r,c));return a;})();
// localize a composite spot label/key ("现金 6人" / "现金·6人") token-by-token, keeping separators
function Lparts(s){return String(s==null?'':s).split(/([ ·]+)/).map(x=>/[ ·]/.test(x)?x:L(x)).join('');}
function spotLabel(fmt,v){return L(FORMATS[fmt].tag)+' '+L(VARIANTS[fmt][v].short);}
// a spot's "who" line is built from " · "-separated segments; translate each segment
function Lwho(s){return String(s==null?'':s).split(' · ').map(seg=>L(seg)).join(' · ');}
function pickHand(t,filter){
 const rnd=arr=>arr[Math.floor(Math.random()*arr.length)];
 if(filter==='good'){const g=[...new Set([...t.R,...t.C])];if(g.length)return rnd(g);}
 else if(filter==='edge'){const e=[...t.M];if(e.length)return rnd(e);
   // fallback: hands just outside pure range still count as "近边缘" → use union
   if(t.union.length)return rnd(t.union);}
 else if(filter==='bad'){const uni=new Set(t.union);const folds=ALL169.filter(h=>!uni.has(h));if(folds.length)return rnd(folds);}
 // all (default): 58% in-range, 42% any (keeps folds in the mix)
 if(Math.random()<.58 && t.union.length)return rnd(t.union);
 return rnd(ALL169);
}

/* ============ game state ============ */
const G={};
function unlocked(){const u=G.pack.filter(t=>t.tier<=G.level);return u.length?u:G.pack;} // 兜底取整个 pack：有的变体最低 tier>1（如 co* 只有 tier2 一个 spot），不能只回退 tier===1（否则空→崩溃）

/* ---- mistake review pile (session memory) ---- */
let reviewPile=[];
const MASTER_STREAK=2; // consecutive corrects in review needed before a spot leaves the pile
const SESSION_HANDS=20; // a normal game = 20 hands (then 🎉 complete); HP=0 still ends it early
function pileKey(fmt,v,tname,hand){return fmt+'|'+v+'|'+tname+'|'+hand;}
function addMistake(choice){
 const key=pileKey(G.format,G.variant,G.table.name,G.hand);
 const ex=reviewPile.find(r=>r.key===key);
 if(ex){ex.wrong++;ex.streak=0;ex.choice=choice;} // a fresh miss resets mastery progress; record latest actual choice
 else reviewPile.push({key,t:G.table,hand:G.hand,fmt:G.format,variant:G.variant,
  label:FORMATS[G.format].tag+' '+VARIANTS[G.format][G.variant].short,wrong:1,streak:0,choice:choice});
 persistReview();
}
function removeFromPile(rec){const i=reviewPile.indexOf(rec);if(i>=0)reviewPile.splice(i,1);persistReview();}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function serializeReview(){return reviewPile.map(r=>({tn:r.t.name,hand:r.hand,fmt:r.fmt,variant:r.variant,label:r.label,wrong:r.wrong,streak:r.streak,choice:r.choice}));}
function persistReview(){STORE.review=serializeReview();persist();}
function reviveReview(arr){
 if(!Array.isArray(arr))return;
 reviewPile=arr.map(r=>{
  const pack=PACKS[r.fmt]&&PACKS[r.fmt][r.variant];
  const t=pack&&pack.find(x=>x.name===r.tn);
  if(!t)return null;
  return {key:pileKey(r.fmt,r.variant,r.tn,r.hand),t,hand:r.hand,fmt:r.fmt,variant:r.variant,label:r.label||'',wrong:r.wrong||1,streak:r.streak||0,choice:r.choice};
 }).filter(Boolean);
}
function updateReviewBtns(){
 const n=reviewPile.length;
 const nav=document.getElementById('reviewBtn');
 if(nav){const lab=nav.querySelector('.lbl');if(lab)lab.textContent=n?tr('reviewBtnN',{n}):L('错题');nav.style.opacity=n?'1':'.6';}
 const over=document.getElementById('overReviewBtn');
 if(over){over.textContent=tr('overReview',{n});over.style.opacity=n?'1':'.45';}
}

// opts(可选,教练日训练的单缝入口——禁止在外部散装赋值 G.coachFams,防泄漏进普通训练):
//  {fams:['ax_s',..]|null 目标手型族(buildSmartQueue 加权), filter:'smart' 发牌偏好覆盖}
function newGame(opts){
 clearTimeout(G._advT);                            // 掐掉上一局残留的快进/升级定时器(1s/1.5s 窗口内重开会双重发牌)
 setMode('normal');                                // 模式单缝:布尔+sink 原子绑定
 G.coachFams=(opts&&opts.fams&&opts.fams.length)?opts.fams.slice():null;  // 裸调用自动清 → 普通训练零影响
 if(opts&&opts.filter)G.handFilter=opts.filter;
 G.diagResults=[]; G.diagSceneKey=null;
 G.pack=PACKS[G.format][G.variant];
 G.score=0;G.level=1;G.hp=5;G.maxhp=5;G.combo=0;G.best=0;
 G.hands=0;G.correct=0;G.handNo=0;G.q={best:0,good:0,inacc:0,mistake:0,blunder:0};
 G.fastCorrect=0;G.levelMistakes=0;G.ach=new Set();G.busy=false;G.over=false;G.pendingLevel=false;
 G.queue=null;G.queueLevel=0;
 renderHUD();nextHand();
}

// filter: 无=全部 · 字符串=按 spot label · 函数=任意谓词(如按 classifyMiss 错误类型)
function startReview(filter){
 const pool = !filter ? reviewPile.slice()
  : typeof filter==='function' ? reviewPile.filter(filter)
  : reviewPile.filter(r=>r.label===filter);
 if(!pool.length)return;
 setMode('review');G.over=false;G.busy=false;
 G.score=0;G.combo=0;G.best=0;G.hands=0;G.correct=0;
 G.q={best:0,good:0,inacc:0,mistake:0,blunder:0};G.fastCorrect=0;G.ach=new Set();
 G.hp=5;G.maxhp=5;
 G.reviewStart=pool.length;G.reviewCleared=0;
 G.reviewQueue=shuffle(pool.slice());
 showScreen(null);                             // 进对局 = 全部覆盖屏隐藏(SCREENS 注册表)
 renderHUD();nextHand();
}
function reviewComplete(){
 G.over=true;setMode('normal');stopTimer();SFX.level();
 const acc=G.hands?Math.round(G.correct/G.hands*100):0;
 document.getElementById('overTitle').innerHTML=tr('reviewDone');
 document.getElementById('overStats').innerHTML=`
  <div class="stat"><div class="v" style="color:var(--best)">${G.reviewCleared}</div><div class="k">${L('本轮清掉')}</div></div>
  <div class="stat"><div class="v">${reviewPile.length}</div><div class="k">${L('仍待练')}</div></div>
  <div class="stat"><div class="v">${G.hands}</div><div class="k">${L('复习手数')}</div></div>
  <div class="stat"><div class="v">${acc}%</div><div class="k">${L('本轮准确率')}</div></div>`;
 document.getElementById('overAch').innerHTML='';
 updateReviewBtns();
 showScreen('overScreen');
}

function renderHUD(){
 const hp=document.getElementById('hp');hp.innerHTML='';
 for(let i=0;i<G.maxhp;i++){const e=document.createElement('i');e.textContent='❤';if(i>=G.hp)e.className='dead';hp.appendChild(e);}
 document.getElementById('score').textContent=G.score.toLocaleString();
 // 3 lines: score (above) / 场景 / 等级·局数
 document.getElementById('hudScene').textContent = G.diagMode
  ? spotLabel(G.format,G.variant)
  : G.reviewMode
  ? L('复习模式')
  : spotLabel(G.format,G.variant);
 document.getElementById('lvl').textContent = G.diagMode
  ? L('实力诊断')+' · '+tr('coachDiagProgress',{cur:(G.handNo||0),tot:G.diagTotal||0})
  : G.reviewMode
  ? tr('pendClear',{n:reviewPile.length})
  : tr('lvlLine',{lv:G.level,hand:(G.handNo||0),total:SESSION_HANDS});
 const c=document.getElementById('combo');
 if(G.combo>=2){c.textContent=tr('combo',{n:G.combo});c.className='combo show'+(G.combo>=8?' big':'');}
 else c.className='combo';
}

// 倒计时已移除：无时间压力、无超时自动弃牌。stopTimer 保留为空操作，
// 因为 reviewComplete/gameOver/choose/exitToMenu 仍会调用它。
let timerRAF=null;
function stopTimer(){if(timerRAF)cancelAnimationFrame(timerRAF);timerRAF=null;}

/* ---- data-confidence labelling (honest per-spot provenance in the UI) ---- */
const CONF={
 precise:{mark:'',txt:'Nash 博弈论最优',cls:'conf-precise',desc:'本工具 equity+Nash 求解器计算所得（非手搓）；属简化模型（无前注 / no-overcall / 类级 equity）的近似解，非真实牌桌精确——可剥削度见来源'},
 curated:{mark:'≈',txt:'手搓参考',cls:'conf-curated',desc:'参考公开图表手工整理，核对过量级/形状；混合频率为占位，非 solver 精确'},
};
function confOf(t){return CONF[(t&&t.confidence)]||CONF.curated;}
function confChip(t){const c=confOf(t);
 if(c===CONF.curated)return ''; // 手搓档不显示标签（仅「精准」自算档显示）
 const src=(t&&t.src)?(typeof Lsrc==='function'?Lsrc(t.src):t.src):''; // src 含插值数字,走 Lsrc 片段翻译(英文界面否则露中文)
 const title=src?L(c.desc)+' · '+src:L(c.desc);
 return `<span class="conf ${c.cls}" title="${title.replace(/"/g,'&quot;')}">${c.mark?c.mark+' ':''}${L(c.txt)}</span>`;}
/* frequency string: precise spots show the REAL computed %; others stay qualitative (占位) */
function freqText(t,hand){
 const f=handFreq(t,hand), names=MODES[t.mode].names;
 return Object.keys(f).filter(k=>f[k]>0).sort((a,b)=>f[b]-f[a])
  .map(k=>`${L(names[k]||k)} ${Math.round(f[k]*100)}%`).join(' / ');
}
function freqNote(t,hand,isMix,isEdge){
 if(t&&t.confidence==='precise') return tr('fnPrecise',{f:freqText(t,hand)});
 if(isEdge) return tr('fnEdge');
 if(isMix)  return tr('fnMix');
 return tr('fnPure');
}

// 紧贴范围/边缘、同型差一档的「难弃牌」候选：union 各手的同型 ±1 邻居中、本身不在 union 的牌
// （如 A5s 打 → A4s/K5s；KJo 边缘 → KTo/QJo；88+ → 77）。这些是"看着能玩、其实该弃"的临界牌。
function adjacentFolds(t){
 // 复用 neighborsOf 的 ±1 rank 同型邻牌几何(此前是逐字拷贝,改一处漏一处)
 const uni=new Set(t.union), out=new Set();
 uni.forEach(h=>neighborsOf(h).forEach(lab=>{ if(!uni.has(lab)) out.add(lab); }));
 return [...out];
}
// 单手的 ±1 rank 同型邻牌（反馈矩阵里高亮，展示范围切在哪个边界）
function neighborsOf(hand){
 const out=[];
 const push=(i,j,suf)=>{ if(i<0||i>12||j<0||j>12)return;
  if(suf==='p'){ out.push(RANKS[i]+RANKS[i]); }
  else { if(i===j)return; const hi=Math.min(i,j),lo=Math.max(i,j); out.push(RANKS[hi]+RANKS[lo]+suf); } };
 if(hand.length===2){ const r=RIDX[hand[0]]; push(r-1,r-1,'p'); push(r+1,r+1,'p'); }
 else { const a=RIDX[hand[0]],b=RIDX[hand[1]],suf=hand[2]; push(a-1,b,suf); push(a+1,b,suf); push(a,b-1,suf); push(a,b+1,suf); }
 return out;
}
/* ---- 手牌族(hand family):诊断/漏洞分析的手型维度 ----
   细族 18 个(长期漏洞分析用,样本多才可操作)+ 粗族 7 个(诊断只有 18/45 手,粗族才凑得够样本)。
   规则只依赖 RIDX/gap/suited,全 169 手完全划分(test/family.test.js 守恒锁死计数)。
   独立于 handKind(那是 reasonFor 文案的 8 桶,勿混用)。 */
function handFamily(h){
 if(h.length===2){const i=RIDX[h[0]]; return i<=4?'pp_big' : i<=8?'pp_mid' : 'pp_small';} // TT+/99-66/55-22
 const a=RIDX[h[0]], b=RIDX[h[1]], s=h[2]==='s', gap=b-a;
 if(a===0){                                                     // Ax
  if(s) return b<=4?'axs_bw' : b<=8?'axs_mid' : 'axs_wheel';    // ATs+ / A6s-A9s / A2s-A5s
  return b<=4?'axo_bw':'axo_lo';                                // ATo+ / A2o-A9o
 }
 if(a<=4 && b<=4) return s?'bw_s':'bw_o';                       // 双高张 KQ..JT
 if(s){
  if(gap<=1) return 'sc';                                       // 同花连张 T9s..32s
  if(gap===2) return 'sg';                                      // 同花隔张 J9s..42s
  if(a<=2)  return 'kqx_s';                                     // K/Q 高弱踢同花
  return 'sx_lo';                                               // 低同花杂
 }
 if(a<=2 && b>4) return 'kqx_o';                                // K/Q 高弱踢 offsuit
 if(gap<=1) return 'off_conn';                                  // offsuit 连张
 return 'off_lo';                                               // 杂牌
}
// 中文=canonical(英文进 i18n 的 I18N_EN);coarse 是诊断用的 7 粗族
const FAMILIES={
 pp_big:  {name:'大对子 TT+',      coarse:'pp'},
 pp_mid:  {name:'中对子 66-99',    coarse:'pp'},
 pp_small:{name:'小对子 22-55',    coarse:'pp'},
 axs_bw:  {name:'同花大A ATs+',    coarse:'ax_s'},
 axs_mid: {name:'同花中A A6s-A9s', coarse:'ax_s'},
 axs_wheel:{name:'同花轮A A2s-A5s',coarse:'ax_s'},
 axo_bw:  {name:'高踢A ATo+',      coarse:'ax_o'},
 axo_lo:  {name:'弱A A2o-A9o',     coarse:'ax_o'},
 bw_s:    {name:'同花高张 KQs-JTs',coarse:'bw'},
 bw_o:    {name:'高张 KQo-JTo',    coarse:'bw'},
 sc:      {name:'同花连张',        coarse:'sc'},
 sg:      {name:'同花隔张',        coarse:'sc'},
 kqx_s:   {name:'同花K/Q弱踢',     coarse:'sx_lo'},
 sx_lo:   {name:'低同花',          coarse:'sx_lo'},
 kqx_o:   {name:'K/Q弱踢 offsuit', coarse:'off'},
 off_conn:{name:'offsuit连张',     coarse:'off'},
 off_lo:  {name:'杂牌',            coarse:'off'},
};
const FAM_COARSE={pp:'口袋对子',ax_s:'同花A',ax_o:'offsuit A',bw:'高张牌',sc:'同花连张/隔张',sx_lo:'弱同花',off:'offsuit杂牌'};
function famCoarse(h){return FAMILIES[handFamily(h)].coarse;}
// smart 队列内排序:weak(错题) > 目标手型族(教练计划的 targetFams) > 其余。famSet 为空 = 旧行为。
function smartOrder(cands, famSet){
 const pri=x=> x.weak?0 : (famSet && famSet.has(famCoarse(x.hand)))?1 : 2;
 return [0,1,2].map(p=>shuffle(cands.filter(x=>pri(x)===p))).reduce((a,b)=>a.concat(b),[]);
}
// 智能出题（题库 + 答案类型均衡 + 难弃牌）：
//  · 题库 = 已解锁各 spot 的范围内手牌（按正确动作/边缘/混合归类）+ 难弃牌(adjacentFolds)
//  · 整局把所有位置混在一起，各动作类型(弃/加/跟/全下/边缘/混合)题数尽量相近（每类上限 PER）
//  · 错题(弱项)在各自类型内优先纳入；抽完一轮再重建
const SMART_PER_TYPE=12;
function buildSmartQueue(){
 const pool=unlocked();
 const weakKeys=new Set(reviewPile
  .filter(r=>r.fmt===G.format&&r.variant===G.variant)
  .map(r=>r.t.name+'|'+r.hand));
 const byType={};                                  // 动作类型 -> [{t,hand,weak}]
 const add=(type,t,hand)=>{(byType[type]=byType[type]||[]).push({t,hand,weak:weakKeys.has(t.name+'|'+hand)});};
 pool.forEach(t=>{
  const M=MODES[t.mode];
  [...t.union].forEach(hand=>{                      // 范围内手牌：按正确动作归类
   const isR=t.R.has(hand),isC=t.C.has(hand),isM=t.M.has(hand);
   const corr=M.correct(isR,isC,isM);
   const type = isM ? 'edge' : (corr.length>1 ? 'mix' : corr[0]);   // corr[0]: raise/call/shove
   add(type,t,hand);
  });
  adjacentFolds(t).forEach(hand=> add('fold',t,hand));               // 难弃牌
 });
 let items=[];
 const famSet=(G.coachFams&&G.coachFams.length)?new Set(G.coachFams):null;  // 教练计划的目标手型族(T4 接线)
 Object.keys(byType).forEach(type=>{                // 各类型等量：weak > 目标族 > 其余 + 上限 PER
  items=items.concat(smartOrder(byType[type],famSet).slice(0,SMART_PER_TYPE));
 });
 G.queue=shuffle(items.map(x=>({t:x.t,hand:x.hand})));
 if(!G.queue.length && pool.length){const t=pool[0];G.queue=[{t,hand:pickHand(t,'all')}];} // 兜底
 G.queueLevel=G.level;
}

/* ============ 训练牌桌可视化：按人数画座位、标位置、显示已下的注码（示意）============
   开局/推弃=折到英雄；防守/面对全下/面对3bet·4bet/挤压/冷跟=显示对手已下的注。
   注码是「示意」（盲注/前注真实，加注尺度为常见近似），不冒充精确底池。 */
const POS_RING={ // 行动顺序 = 落座顺序；末两位固定是 SB、BB
 2:['SB','BB'],
 6:['UTG','HJ','CO','BTN','SB','BB'],
 9:['UTG','UTG+1','MP','LJ','HJ','CO','BTN','SB','BB'],
};
function tablePlayers(fmt,variant){
 if(fmt==='cash'){const v=VARIANTS.cash[variant];return (v&&v.players)||+variant||6;} // 深度 variant(c6_50 等)带 players 字段;老 key(2/6/9)仍走数值
 if(fmt==='mtt'){ if(/^hu/.test(variant))return 2; if(variant==='d40_6'||variant==='d20_6'||/^p6_/.test(variant))return 6; return 9; }
 return 6; // face3b/face4b/squeeze/coldcall：100bb 6 人语境
}
// 位置归一化：中/英 token → 标准位置键（按钮/小盲/大盲/关煞/劫机/中位/枪口/前位 + EN）
function posKey(s){ s=s||'';
 const map=[['按钮','BTN'],['BTN','BTN'],['小盲','SB'],['大盲','BB'],['关煞','CO'],['劫机','HJ'],
  ['中位','MP'],['枪口','UTG'],['前位','UTG'],['SB','SB'],['BB','BB'],['CO','CO'],['HJ','HJ'],['LJ','LJ'],['MP','MP'],['UTG','UTG']];
 for(const [k,v] of map) if(s.includes(k)) return v;
 return null;
}
// 推断英雄位置 + 已下注的对手(vil:[{pos,bet}]) + 英雄已投入(heroBet)
function tableModel(t,fmt,variant){
 const N=tablePlayers(fmt,variant), ring=POS_RING[N], mtt=fmt==='mtt';
 const nm=t.name||''; let hero=null,heroBet=0; const vil=[];
 const RAISE=2.3, THREEB=8, FOURB=21;
 // 座位一律「结构化字段优先、文案解析兜底」:t.heroPos / t.vilPos(单个或数组,挤压=[开局者,跟注者]);
 // 推弃复用既有 t.pf/t.pf6。posKey 正则只服务缺字段的旧数据——新 spot 请直接写字段(测试守完备性)。
 const hp=t.heroPos||null, vp=t.vilPos!=null?[].concat(t.vilPos):null;
 if(fmt==='coldcall'){                                   // 冷跟：英雄 BTN/CO 面对开局加注（spot 用 defense 模式）
  hero=hp||posKey(nm.split(/冷跟|vs/)[0])||'BTN';
  vil.push({pos:(vp&&vp[0])||posKey(nm.split('vs')[1]||'')||'CO',bet:RAISE});
 } else if(t.mode==='iso'||t.mode==='bbvslimp'){         // 面对跛入：跛入者已投 1bb(limp)
  hero=hp||(t.mode==='bbvslimp'?'BB':'BTN');
  vil.push({pos:(vp&&vp[0])||(t.mode==='bbvslimp'?'SB':'MP'),bet:1});
 } else if(t.mode==='defense'){                          // 大盲防守：英雄 BB 面对开局加注
  hero=hp||'BB'; vil.push({pos:(vp&&vp[0])||posKey(nm.replace(/BB|大盲/g,'').replace(/vs/,''))||'BTN',bet:RAISE});
 } else if(mtt&&/^hu/.test(variant)){                    // 单挑推弃
  hero=t.huSide==='call'?'BB':'SB';
  if(t.huSide==='call')vil.push({pos:'SB',bet:+(/(\d+)/.exec(variant)||[])[1]||10});
 } else if(t.mode==='callshove'&&t.calloff){             // 9人 面对全下·BB 跟注
  hero='BB'; vil.push({pos:'BTN',bet:+(t.coStack||10)});
 } else if(t.mode==='face3b'){                           // 你开局 → 被 3-bet：解析开局位 + 反加位
  hero=hp||posKey((nm.match(/开\s*([^\s，,]+)/)||[])[1])||'BTN';
  let v3=(vp&&vp[0])||posKey((nm.match(/([^\s，,]+)\s*反加/)||[])[1]); if(!v3)v3=hero==='CO'?'BTN':'BB';
  heroBet=RAISE; vil.push({pos:v3,bet:THREEB});
 } else if(t.mode==='face4b'){                           // 你 3-bet → 被 4-bet
  hero=hp||(/盲/.test(nm)?'SB':'BTN'); heroBet=THREEB;
  vil.push({pos:(vp&&vp[0])||(hero==='SB'?'BTN':'CO'),bet:FOURB});
 } else if(t.mode==='squeeze'){                          // 挤压：开局者 + 跟注者 都已在池
  hero=hp||(/大盲|盲/.test(nm)?'BB':'BTN');
  vil.push({pos:(vp&&vp[0])||'UTG',bet:RAISE});                        // 开局者
  vil.push({pos:(vp&&vp[1])||(hero==='BTN'?'CO':'HJ'),bet:RAISE});       // 跟注者
 } else { hero=hp||t.pf||t.pf6||posKey(nm)||ring[0]; }                     // open / push：首入，折到英雄
 if(!ring.includes(hero)) hero = N===2?'SB':'BB';
 const hi=ring.indexOf(hero);
 const betAt={}; vil.forEach(v=>{const i=ring.indexOf(v.pos); if(i>=0)betAt[i]=Math.max(betAt[i]||0,v.bet);});
 if(t.straddle){const si=ring.indexOf(t.straddle); if(si>=0)betAt[si]=Math.max(betAt[si]||0,2);} // 抓头 2bb 前置注(像盲注一样已在池)
 const facing=Object.keys(betAt).length>0;               // 有对手已下注 = 非首入
 const seats=ring.map((pos,i)=>{
  let bet=0,blind=false,folded=false;
  if(pos==='SB'){bet=0.5;blind=true;} if(pos==='BB'){bet=1;blind=true;}
  if(betAt[i]!=null)bet=Math.max(bet,betAt[i]);          // 对手加注/全下
  if(i===hi&&heroBet)bet=Math.max(bet,heroBet);           // 英雄已投入(face3b/4b)
  if(!facing){ if(i<hi && pos!=='SB' && pos!=='BB') folded=true; }           // 首入：折到英雄
  else if(i!==hi && betAt[i]==null && pos!=='SB' && pos!=='BB') folded=true; // 面对下注：留英雄+下注者+盲注
  const ang=Math.PI/2 + ((i-hi)/N)*2*Math.PI;            // 英雄固定底部中央，其余环绕
  const x=50+39*Math.cos(ang), y=52+39*Math.sin(ang);    // 半径留余量，避免边座位被裁
  return {pos,bet:+bet.toFixed(2),blind,folded,hero:i===hi,btn:pos==='BTN'||(N===2&&pos==='SB'),x,y};
 });
 return {N,seats,mtt,facing};
}
function renderTable(t){
 const el=document.getElementById('felt'); if(!el)return;
 const m=tableModel(t,G.format,G.variant);
 const chip=(b)=>b>0?`<span class="bet">${b%1===0?b:b}</span>`:'';
 el.dataset.n=m.N;
 el.innerHTML=`<span class="felt-pot">${m.mtt?L('前注底池'):''}</span>`+m.seats.map(s=>
  `<div class="seat${s.hero?' hero':''}${s.folded?' folded':''}" style="left:${s.x}%;top:${s.y}%">
    <span class="seat-pos">${s.pos}${s.btn?' <b class="dlr">D</b>':''}</span>
    ${s.bet>0?`<span class="bet">${s.bet}<small>bb</small></span>`:''}
   </div>`).join('');
}
function nextHand(){
 if(G.over)return;
 G.busy=false;
 if(!G.reviewMode){G.handNo=(G.hands||0)+1;renderHUD();}   // advance the X/50 counter
 let t,hand;
 if(G.diagMode){
  // 实力诊断:从 coach 的诊断队列取题(场景已均衡)。牌桌/发牌/反馈全走练习同一套 UI。
  // typeof 守卫:这些符号定义在更晚加载的 coach.js(diagMode 理论上只由它置真,守卫防加载失败/重构)
  if(typeof _coachDiagQueue==='undefined' || !_coachDiagQueue || _coachDiagPos>=_coachDiagQueue.length){
   if(typeof coachFinishDiagnosis==='function') coachFinishDiagnosis(); return; }
  const it=_coachDiagQueue[_coachDiagPos];
  t=it.t;hand=it.hand;G.format=it.format;G.variant=it.variant;G.diagSceneKey=it.sceneKey;
 } else if(G.reviewMode){
  if(!G.reviewQueue.length){reviewComplete();return;}
  const rec=G.reviewQueue.shift();G.reviewRec=rec;
  t=rec.t;hand=rec.hand;G.format=rec.fmt;G.variant=rec.variant;
 } else if(G.handFilter==='smart'){
  if(!G.queue||!G.queue.length||G.queueLevel!==G.level)buildSmartQueue();
  const it=G.queue.shift();
  t=it.t;hand=it.hand;
 } else {
  const pool=unlocked();
  t=pool[Math.floor(Math.random()*pool.length)];
  hand=pickHand(t,G.handFilter);
 }
 G.table=t;G.hand=hand;
 // correct set — driven by the central MODES table (see top of script)
 const isR=t.R.has(hand),isC=t.C.has(hand),isM=t.M.has(hand);
 const correct=MODES[t.mode].correct(isR,isC,isM);
 G.correct_set=correct;G.isMix=correct.length>1;
 G.isEdge=isM;

 // render scene
 document.getElementById('sceneName').textContent=L(t.name);
 document.getElementById('sceneWho').innerHTML=Lwho(t.who) + (G.reviewMode?tr('reviewTag'):'') + ' ' + confChip(t);
 renderTable(t);
 // cards
 const cardsEl=document.getElementById('cards');cardsEl.innerHTML='';
 const cd=dealCards(hand);
 cd.forEach((card,i)=>{
  const el=document.createElement('div');el.className='card';
  el.innerHTML=`<div class="back"></div>
   <div class="face">
     <span class="rk ${card.c}">${rankFace(card.r)}</span>
     <span class="pip-c ${card.c}">${card.sym}</span>
     <span class="rk br ${card.c}">${rankFace(card.r)}</span>
   </div>`;
  cardsEl.appendChild(el);
  setTimeout(()=>{el.classList.add('flip');SFX.deal();},120+i*130);
 });
 // actions
 buildActions(t.mode);
 document.getElementById('actions').style.display='';
 document.getElementById('feedback').classList.add('hide');
 document.querySelector('.table').classList.remove('fb-hide');   // 新一手：恢复牌桌区
 // verdict reset
 document.getElementById('verdict').className='verdict';
}

function buildActions(mode){
 const wrap=document.getElementById('actions');wrap.innerHTML='';
 const opts=MODES[mode].actions;
 wrap.className='actions n'+opts.length;
 opts.forEach(([key,[lab,sub,cls]])=>{
  const b=document.createElement('button');b.className='act '+cls;
  b.innerHTML=`${L(lab)}<small>${sub}</small>`;
  b.onclick=(e)=>choose(key,b,e);
  wrap.appendChild(b);
 });
}

function choose(choice,btn,e){
 if(G.busy)return;G.busy=true;stopTimer();SFX.click();
 resolve(choice,btn,false);
}

// an action key → the matrix colour it maps to in this mode (raise is purple in 3bet-family modes)
const ACT_COLORS={raise:'var(--raise)',shove:'var(--raise)',threebet:'var(--threebet)',call:'var(--call)',fold:'var(--fold)'};
function actionColor(mode,a){
 // raise 的渲染色由 MODES[mode].reCol 决定(3bet 家族=紫/开局=红)——模式知识只住 MODES(CLAUDE.md 契约)
 const cat = a==='fold'?'fold' : a==='call'?'call' : a==='shove'?'shove'
  : (MODES[mode]&&MODES[mode].reCol)||'raise';
 return ACT_COLORS[cat];
}
// 答错时把该局面的范围表弹进反馈面板：红框标出你这手牌，表头用色块标注「你选的动作」
function renderFbMatrix(t,hand,corrStr,choice,choiceName,wrong){
 const box=document.getElementById('fbMatrix'); if(!box)return;
 const edgeBg={'edge-raise':'var(--raise)','edge-shove':'var(--raise)','edge-call':'var(--call)'};
 const nbrs = hand ? new Set(neighborsOf(hand)) : new Set();   // 邻牌：展示范围边界
 let cells='';
 for(let r=0;r<13;r++)for(let c=0;c<13;c++){
  const h=handLabel(r,c),cat=cellCat(t,h),now=h===hand?(' now'+(wrong?'':' ok')):''; // 答错=红框，答对/两可=金框
  const adj=(!now && nbrs.has(h))?' adj':'';                   // 邻牌微高亮
  cells+=`<div class="ccell ${cat}${r===c?' pair':''}${now}${adj}">${now?`<span>${h}</span>`:''}</div>`;
 }
 let leg='';
 MODES[t.mode].legend.forEach(([cls,lab])=>{
  let bg;
  if(cls==='mix')bg='linear-gradient(118deg,var(--threebet) 0 50%,var(--call) 50% 100%)';
  else if(cls.startsWith('edge'))bg=`linear-gradient(118deg,${edgeBg[cls]} 0 50%,var(--fold) 50% 100%)`;
  else bg=ACT_COLORS[cls]||'var(--fold)';
  leg+=`<div class="it"><span class="sw" style="background:${bg};${cls==='fold'?'box-shadow:inset 0 0 0 1px var(--line)':''}"></span>${L(lab)}</div>`;
 });
 const youSw=`<span class="fbmx-sw" style="background:${actionColor(t.mode,choice)}"></span>`;
 box.innerHTML=`<div class="fbmx-h">${tr('fbmxHead',{hand,correct:corrStr,you:youSw+choiceName})}</div>`
  +`<div class="fbmx-grid">${cells}</div><div class="fbmx-leg">${leg}</div>`;
 box.classList.remove('hide');
}

// 反馈面板的「参考 vs 你」视觉动作对比条。诚实：curated 只给定性色块+动作名；
// precise 局面(推弃 Nash)额外附真频率条——只有 precise 才显示 %，绝不给手搓占位频率编数字。
function fbCompareHtml(t,hand,correct,choice,ok,timedOut){
 const nm=MODES[t.mode].names;
 const chip=(act)=>`<span class="fbmx-sw" style="background:${actionColor(t.mode,act)}"></span>${L(nm[act]||act)}`;
 const ref=correct.map(chip).join(' / ');
 const you=timedOut?L('超时'):chip(choice);
 const okMark=ok?' <span class="fb-cmp-ok">✓</span>':'';
 let html=`<span class="fb-cmp-side"><i>${tr('fbCmpRef')}</i>${ref}</span>`
  +`<span class="fb-cmp-vs">↔</span>`
  +`<span class="fb-cmp-side"><i>${tr('fbCmpYou')}</i>${you}${okMark}</span>`;
 if(t.confidence==='precise'){                    // 真频率条(仅 precise)
  const f=handFreq(t,hand), segs=Object.keys(f).filter(k=>f[k]>0).sort((a,b)=>f[b]-f[a]);
  if(segs.length>1){
   const bar=segs.map(k=>`<i style="width:${Math.round(f[k]*100)}%;background:${actionColor(t.mode,k)}"></i>`).join('');
   const lab=segs.map(k=>`${L(nm[k]||k)} ${Math.round(f[k]*100)}%`).join('　');
   html+=`<span class="fb-cmp-freq"><span class="fb-cmp-bar">${bar}</span></span><span class="fb-cmp-freq">${lab}</span>`;
  }
 }
 // 求解器真 EV(推弃档船运的每手 chip-EV,相对弃牌;§6:唯一允许显示 EV 的场景)
 if(t.evTable && t.evTable[hand]!=null){
  const ev=t.evTable[hand], actL=L(nm[t.evAct]||t.evAct);
  const col=ev>0.049?'var(--best)':(ev<-0.049?'var(--raise)':'var(--gold)');
  html+=`<span class="fb-cmp-freq" style="justify-content:center">${tr('fbEvLine',{act:actL,ev:(ev>0?'+':'')+ev.toFixed(2),c:col})}</span>`;
 }
 return html;
}

/* ---- 评级纯函数:只算判定与数值,不碰任何状态(test/resolve-sink 可单测) ----
   超时永不算对;PREMIUM 该打却弃 / 垃圾牌该弃却打 = 漏着(扣2);其余失误扣1。 */
const Q_OF={'最佳':'best','两可':'good','好棋':'good','不准':'inacc','失误':'mistake','超时':'mistake','漏着':'blunder'};
function gradeHand(i){
 const ok=!i.timedOut && i.correct.includes(i.choice);
 let grade,gcolor,hpHit=0,pts=0,big=false,combo=i.combo,monsterFold=false;
 if(ok){
  combo++;
  const mult=Math.min(3,1+combo*0.1);          // 连击加成(倒计时已移除,无速度加成)
  if(i.isEdge && !i.freqGraded){grade='两可';gcolor='var(--best)';pts=Math.round(85*mult);}  // 边缘占位混合:两种都对,不评高下
  else if(i.isMix && !i.hitTop){grade='好棋';gcolor='var(--good)';pts=Math.round(85*mult);}
  else{grade='最佳';gcolor='var(--best)';pts=Math.round(100*mult);big=true;}
 } else {
  combo=0;
  const shouldPlay=i.correct.includes('raise')||i.correct.includes('call')||i.correct.includes('shove');
  monsterFold=shouldPlay&&i.choice==='fold'&&PREMIUM.has(i.hand);
  if(i.timedOut){grade='超时';gcolor='var(--mistake)';hpHit=1;}            // 超时统一按失误,不评漏着
  else if(i.isMix){grade='不准';gcolor='var(--inacc)';hpHit=1;}
  else if(monsterFold || (i.correct[0]==='fold'&&!PREMIUM.has(i.hand)&&i.choice!=='fold'&&isTrash(i.hand))){grade='漏着';gcolor='var(--blunder)';hpHit=2;}
  else{grade='失误';gcolor='var(--mistake)';hpHit=1;}
 }
 return {ok,grade,gcolor,hpHit,pts,big,combo,monsterFold,choice:i.choice};
}

/* ---- 结算沉淀器(sink):resolve 只算结果,数据写到哪由 G.sink.settle(r) 这一条缝决定 ----
   新的持久化/进度副作用只能加进 SINKS.normal.settle;诊断/复习的隔离由此成为结构性的
   (test/resolve-sink.test.js 用全景 STORE 快照断言守着),不再靠在 resolve 里逐处贴
   !G.diagMode 守卫。settle 返回 {dead,done} 供流程段决定结算。 */
const SINKS={
 normal:{settle(r){
  // 生涯统计 + 按天趋势(只记正常训练)
  const sk=FORMATS[G.format].tag+'·'+VARIANTS[G.format][G.variant].short;
  STORE.statsBySpot=STORE.statsBySpot||{};
  const e=STORE.statsBySpot[sk]||{h:0,c:0};
  e.h++; if(r.ok)e.c++; STORE.statsBySpot[sk]=e;
  const day=new Date(), dk=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
  STORE.trend=STORE.trend||[];
  let te=STORE.trend[STORE.trend.length-1];
  if(!te||te.d!==dk){ te={d:dk,h:0,c:0}; STORE.trend.push(te); if(STORE.trend.length>180)STORE.trend.shift(); } // 保留最近 180 天
  te.h++; if(r.ok)te.c++;
  persist();
  if(!r.ok){ G.hp-=r.hpHit; addMistake(r.choice); updateReviewBtns(); }    // HP + 错题堆
  checkAch(); if(r.monsterFold)award('巨牌漏着','😱');                      // 成就
  G.pendingLevel=false;                                                     // 升级(横幅由 advance 播)
  if(G.score>=G.level*1000 && G.level<6){
   G.level++;G.pendingLevel=true;
   if(G.levelMistakes===0)award('完美关卡','🏆');
   G.levelMistakes=0;G.hp=Math.min(G.maxhp,G.hp+1);
  }
  const dead=G.hp<=0, done=!dead&&G.hands>=SESSION_HANDS;
  return {dead,done};
 }},
 review:{settle(r){
  const rec=G.reviewRec;
  if(r.ok){
   rec.streak=(rec.streak||0)+1;
   if(rec.streak>=MASTER_STREAK){removeFromPile(rec);G.reviewCleared++;}   // 连续答对 → 掌握,移出错题堆
   else {persistReview();G.reviewQueue.push(rec);}                          // 答对但未掌握 → 留堆再练
  } else {rec.streak=0;if(r.choice)rec.choice=r.choice;persistReview();G.reviewQueue.push(rec);} // 答错 → 清零重练,更新最新错误选择
  updateReviewBtns();
  checkAch(); if(r.monsterFold)award('巨牌漏着','😱');                      // 现行为:复习也计成就
  G.pendingLevel=false;
  return {dead:false,done:false};                                           // 复习不扣血不结算
 }},
 diag:{settle(r){
  // 诊断只记 diagResults 供报告聚合——绝不碰 STORE/错题堆/HP/成就
  G.diagResults.push({ sceneKey:G.diagSceneKey, t:G.table, hand:G.hand, choice:r.choice, correct:r.ok, variant:G.variant });
  G.pendingLevel=false;
  return {dead:false,done:false};
 }},
};
/* ---- 模式切换单缝:布尔与 sink 原子绑定 ----
   全代码库禁止再散装赋值 G.reviewMode/G.diagMode/G.sink(上次「复习态泄漏进诊断
   篡改错题堆」的根源就是模式布尔散装设置)。读布尔的地方不受影响。 */
function setMode(m){
 G.mode=m; G.reviewMode=(m==='review'); G.diagMode=(m==='diag');
 G.sink=SINKS[m]||SINKS.normal;
}

function resolve(choice,btn,timedOut){
 const t=G.table,correct=G.correct_set,hand=G.hand;
 // 频率评级上下文:precise 混合点才有主频线(超时永不算最佳,§6:占位频率不评高下)
 const fmap=handFreq(t,hand);
 const topAct=Object.keys(fmap).sort((a,b)=>fmap[b]-fmap[a])[0];
 const freqGraded = t.confidence==='precise' && G.isMix;
 const hitTop = freqGraded && choice===topAct && !timedOut;
 // ① 评级(纯函数,零副作用)
 const r=gradeHand({correct,choice,timedOut,isMix:G.isMix,isEdge:G.isEdge,freqGraded,hitTop,hand,combo:G.combo});
 const {ok,grade,gcolor,pts}=r;
 // ② 会话计分(三模式共同的界面进度:手数/连击/得分/评级桶/关卡失误 + 音效)
 G.hands++; G.combo=r.combo;
 if(ok){ G.correct++; G.best=Math.max(G.best,G.combo); G.score+=pts;
  SFX[G.combo>=5?'great':'correct']();buzz(G.combo>=5?[20,40,20]:30);
 } else { G.levelMistakes++; SFX.wrong();buzz([60,30,60]); }
 G.q[Q_OF[grade]]++;
 // ③ 数据沉淀:唯一写入口——生涯统计/HP/错题堆/成就/升级/结算判定按模式路由(见 SINKS)
 const end=(G.sink||SINKS.normal).settle(r);

 // GTO answer string
 const nameMap=MODES[t.mode].names;
 const corrStr=correct.map(a=>L(nameMap[a])).join(' / ');
 const freq = freqNote(t,hand,G.isMix,G.isEdge);

 // center verdict flash
 const v=document.getElementById('verdict');
 document.getElementById('grade').textContent=L(grade);
 document.getElementById('grade').style.color=gcolor;
 const mixTip = hitTop ? tr('mixTop',{act:L(MODES[t.mode].names[topAct]||topAct),pct:Math.round(fmap[topAct]*100)}) : L('边缘混合点');
 document.getElementById('tip').innerHTML= ok ? (G.isMix?mixTip:L('打得漂亮！')) : tr('shouldBe',{ans:corrStr});
 v.className='verdict show';

 // button feedback
 if(btn)btn.classList.add(ok?'correct':'wrong');
 [...document.getElementById('actions').children].forEach(b=>b.disabled=true);

 // float score / burst
 if(pts>0){const r=(btn||document.getElementById('cards')).getBoundingClientRect();
  floatScore('+'+pts,r.left+r.width/2,r.top);}
 if(ok&&r.big&&G.combo>=3)burst(innerWidth/2,innerHeight*0.42,['#e8c66a','#34b074','#fff','#7fc6ff'],G.combo>=8?40:24);

 renderHUD();

 const dead=end.dead===true, done=end.done===true;   // 结算判定来自 sink(normal 才会真)
 const ending = dead || done;
 // 诊断:每手都要展示答案+解释(用户要求),绝不快进
 const quick = ok && !G.isMix && !ending && !G.diagMode; // pure best → auto advance

 if(quick){ G._advT=setTimeout(()=>{ if(!G.over) advance(); }, 1000); return; } // 句柄存 G._advT:退出/重开时掐掉,防止旧局定时器打进新局(双重发牌/补放升级横幅)

 // build detailed feedback panel
 const reason=reasonFor(t,hand,correct,choice,ok,grade);
 document.getElementById('fbGrade').textContent=L(grade);
 document.getElementById('fbGrade').style.color=gcolor;
 document.getElementById('fbAns').innerHTML=tr('answerLine',{ans:corrStr,freq:freq,chip:confChip(t)});
 const youLine = ok ? '' : (timedOut ? tr('youTimeout') : tr('youChose',{c:L(nameMap[choice]||'弃牌')}));
 document.getElementById('fbReason').innerHTML=youLine+reason;
 // 视觉动作对比条（参考 vs 你），precise 附真频率条
 const cmpEl=document.getElementById('fbCompare');
 cmpEl.innerHTML=fbCompareHtml(t,hand,correct,choice,ok,timedOut); cmpEl.classList.remove('hide');
 // 你的毛病：错误类型归因 + 累计次数 + 一键专练这类（串到漏洞分析）
 const leakEl=document.getElementById('fbLeak');
 if(!ok && !G.diagMode){
  const type=classifyMiss({t,hand,choice,variant:G.variant}), T=LEAK_TYPES[type];
  let n=0; reviewPile.forEach(x=>{ if(classifyMiss(x)===type) n+=(x.wrong||1); }); if(!n)n=1;
  leakEl.innerHTML=tr('fbLeakLine',{c:T.color,name:L(T.name),desc:L(T.desc),n})
   +`<button class="fb-leak-go" type="button">${tr('fbLeakDrill')}</button>`;
  leakEl.querySelector('.fb-leak-go').onclick=()=>{ SFX.click();
   // 先确认池里真有这类错题再动界面:谓词可能匹配 0 条(池中记录按「存下的旧选择」分类,
   // 与本手的当前分类可以不同)——若先隐藏反馈再让 startReview 空池早退,就只剩全禁用的死手牌
   const pool=reviewPile.filter(x=>classifyMiss(x)===type);
   if(!pool.length){ toast(tr('fbLeakNone'),'📕',true); return; }
   document.getElementById('feedback').classList.add('hide');
   document.getElementById('actions').style.display='';
   document.querySelector('.table').classList.remove('fb-hide');
   startReview(x=>classifyMiss(x)===type);
  };
  leakEl.classList.remove('hide');
 } else leakEl.classList.add('hide');
 // wrong answer → pop the range table with this hand ringed; otherwise keep it hidden
 if(!ok || G.isMix) renderFbMatrix(t,hand,corrStr,choice,L(nameMap[choice]||'弃牌'),!ok); // 答错 + 混合/两可点都显示范围表
 else document.getElementById('fbMatrix').classList.add('hide');
 const nextBtn=document.getElementById('fbNext');
 if(G.diagMode){
  const last = typeof _coachDiagQueue==='undefined' || !_coachDiagQueue || _coachDiagPos>=_coachDiagQueue.length-1;
  nextBtn.textContent = last ? L('查看报告 →') : L('下一步 →');
  nextBtn.onclick = ()=>{ SFX.click(); if(typeof coachDiagAdvance==='function')coachDiagAdvance(); };
 } else {
  nextBtn.textContent = ending ? L('查看结果 →') : L('下一步 →');
  nextBtn.onclick = ()=>{ SFX.click(); if(ending){gameOver(done);} else advance(); };
 }
 document.getElementById('actions').style.display='none';
 document.querySelector('.table').classList.add('fb-hide');     // 收起牌桌区，反馈面板独占下方（可滚动）
 const fbEl=document.getElementById('feedback'); fbEl.classList.remove('hide'); fbEl.scrollTop=0;
}

function advance(){
 if(G.over)return;
 if(G.pendingLevel){
  G.pendingLevel=false;
  SFX.level();showBanner(G.level);burst(innerWidth/2,innerHeight*0.4,['#e8c66a','#b8902f','#fff'],50,9);renderHUD();
  G._advT=setTimeout(()=>{ if(!G.over) nextHand(); },1500);
 } else nextHand();
}

/* ---- reason generator ---- */
function handKind(h){
 if(h.length===2)return 'pair';
 const a=h[0],b=h[1],suited=h.endsWith('s');
 const hi='AKQJT', bw=hi.includes(a)&&hi.includes(b);
 const gap=Math.abs(RIDX[a]-RIDX[b]);
 if(a==='A')return suited?'axs':'axo';
 if(bw)return suited?'bws':'bwo';
 if(suited)return gap<=2?'sc':'sg';
 return 'off';
}
function posName(t){return t.name.split(' · ')[0];}
function reasonFor(t,hand,correct,choice,ok,grade){
 const k=handKind(hand), p=L(posName(t));
 const isBlock = (k==='axs'&&!PREMIUM.has(hand));
 // edge / mix explanations first
 if(G.isEdge){
  const act = correct.find(a=>a!=='fold');
  const an = L({raise:'加注',shove:'全下',call:'跟注'}[act]||'入池');
  return tr('reason.edge',{hand,p,an});
 }
 if(G.isMix && !G.isEdge) return tr('reason.mix',{hand,p});
 // facing a 3-bet: fold / call / 4-bet
 if(t.mode==='face3b'){
  const ip = t.who.includes('有位置');
  if(correct[0]==='raise') return tr('reason.f3.raise',{hand,why:tr(isBlock?'reason.f3.why.block':'reason.f3.why.value')});
  if(correct[0]==='call')  return tr('reason.f3.call',{hand,clause:tr(ip?'reason.f3.clause.ip':'reason.f3.clause.oop')});
  return tr('reason.f3.fold',{hand,tail:tr(ip?'reason.f3.tail.ip':'reason.f3.tail.oop')});
 }
 // facing a 4-bet: fold / call / 5-bet jam
 if(t.mode==='face4b'){
  if(correct.includes('shove')) return tr('reason.f4.shove',{hand,why:tr(isBlock?'reason.f4.why.block':'reason.f4.why.value')});
  if(correct[0]==='call')       return tr('reason.f4.call',{hand});
  return tr('reason.f4.fold',{hand});
 }
 // facing a limp: fold / over-limp / isolate(以及 BB vs SB 跛入的 过牌/加注)
 if(t.mode==='iso'){
  if(correct[0]==='raise') return tr('reason.iso.raise',{hand});
  if(correct[0]==='call')  return tr('reason.iso.call',{hand});
  return tr('reason.iso.fold',{hand});
 }
 if(t.mode==='bbvslimp'){
  if(correct[0]==='raise') return tr('reason.bvl.raise',{hand});
  return tr('reason.bvl.check',{hand});
 }
 // squeeze: fold / call / squeeze
 if(t.mode==='squeeze'){
  const ip = t.who.includes('有位置');
  if(correct[0]==='raise') return tr('reason.sq.raise',{hand,why:tr(isBlock?'reason.sq.why.block':'reason.sq.why.value')});
  if(correct[0]==='call')  return tr('reason.sq.call',{hand,clause:tr(ip?'reason.sq.clause.ip':'reason.sq.clause.oop')});
  return tr('reason.sq.fold',{hand});
 }
 // pure spots
 const isShove=correct[0]==='shove', is3=correct[0]==='raise'&&t.mode==='defense';
 if(correct[0]==='raise'||isShove){
  const verb=L(isShove?'全下':'加注');
  return tr('reason.play',{hand,p,verb,why:tr('reason.why.'+k,{verb,p})});
 }
 if(is3) return tr('reason.is3',{hand});
 if(correct[0]==='call') return tr('reason.call',{hand});
 // fold
 const fk = ({off:1,axo:1,sg:1,sc:1})[k] ? ('reason.fold.'+k) : 'reason.fold.generic';
 return tr('reason.fold',{hand,why:tr(fk,{p})});
}

function isTrash(hand){ // crude: offsuit, unpaired, both ranks ≤ 8, gap≥2
 if(hand.length===2)return false; if(hand.endsWith('s'))return false;
 const a=RIDX[hand[0]],b=RIDX[hand[1]];return a>=6&&b>=6&&Math.abs(a-b)>=2;
}

function floatScore(txt,x,y){const e=document.createElement('div');e.className='float';e.textContent=txt;
 e.style.left=x+'px';e.style.top=y+'px';e.style.transform='translateX(-50%)';document.body.appendChild(e);
 setTimeout(()=>e.remove(),900);}

function showBanner(lv){const b=document.getElementById('banner');document.getElementById('bannerLv').textContent=lv;
 b.className='banner';void b.offsetWidth;b.className='banner show';}

/* ============ achievements ============ */
const ACH_DEFS={
 '首杀':'😺','连击大师':'🔥','火力全开':'💥','钢铁神经':'🧊','二十手通关':'🏁','GTO 机器':'🤖','完美关卡':'🏆','巨牌漏着':'😱'
};
function award(name,emoji){if(G.ach.has(name))return;G.ach.add(name);toast(name,emoji||ACH_DEFS[name]||'⭐');}
function checkAch(){
 if(G.correct===1)award('首杀');
 if(G.best>=10)award('连击大师');
 if(G.best>=20)award('火力全开');
 if(G.hands>=SESSION_HANDS)award('二十手通关');
 if(G.hands>=Math.round(SESSION_HANDS*0.8) && G.correct/G.hands>=0.9)award('GTO 机器');
}
let toastT=null;
function toast(name,emoji,plain){const e=document.getElementById('toastEl')||(()=>{const d=document.createElement('div');d.className='toast';d.id='toastEl';document.body.appendChild(d);return d;})();
 e.innerHTML=`<span class="em">${emoji}</span> ${plain?name:tr('achGet',{n:tr('ach.'+name)})}`;e.classList.add('show');
 clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),2200);}

/* ============ game over ============ */
// mode: true = 完成 SESSION_HANDS 手（通关）, 'end' = 手动结束训练, 其它(false) = 出局(HP=0)
function gameOver(win){
 const manual = win==='end';
 G.over=true;stopTimer();
 if(win===true){SFX.level();burst(innerWidth/2,innerHeight*0.4,['#e8c66a','#34b074','#fff','#7fc6ff'],50,9);}
 else if(manual){SFX.click();} else SFX.over();
 document.getElementById('overKicker').textContent = win===true?tr('overKickWin'):manual?tr('overKickEnd'):L('OUT · 出局');
 const acc=G.hands?Math.round(G.correct/G.hands*100):0;
 // lifetime stats
 const st=STORE.stats||{best:0,hands:0,correct:0,games:0};
 const isRecord=G.score>(st.best||0);
 st.best=Math.max(st.best||0,G.score);
 st.hands=(st.hands||0)+G.hands; st.correct=(st.correct||0)+G.correct; st.games=(st.games||0)+1;
 STORE.stats=st; persist();
 const head = win===true ? tr('overTitleWin',{n:SESSION_HANDS}) : '';
 document.getElementById('overTitle').innerHTML=head+tr('overScore',{s:G.score.toLocaleString()})+(isRecord&&G.score>0?tr('overRecord'):'');
 const s=document.getElementById('overStats');
 s.innerHTML=`
  <div class="stat"><div class="v">${acc}%</div><div class="k">${L('GTO 准确率')}</div></div>
  <div class="stat"><div class="v">${G.best}</div><div class="k">${L('最高连击')}</div></div>
  <div class="stat"><div class="v">${G.hands}</div><div class="k">${L('总手数')}</div></div>
  <div class="stat"><div class="v">LV.${G.level}</div><div class="k">${L('到达关卡')}</div></div>
  <div class="stat"><div class="v" style="color:var(--best)">${G.q.best+G.q.good}</div><div class="k">${L('最佳+好棋')}</div></div>
  <div class="stat"><div class="v" style="color:var(--gold)">${(st.best||0).toLocaleString()}</div><div class="k">${L('历史最高')}</div></div>`;
 const a=document.getElementById('overAch');a.innerHTML='';
 [...G.ach].forEach(n=>{const e=document.createElement('span');e.className='ach';e.textContent=(ACH_DEFS[n]||'⭐')+' '+tr('ach.'+n);a.appendChild(e);});
 updateReviewBtns();
 showScreen('overScreen');
}

/* ============ boot ============ */
function defVariant(f){return f==='cash'?'6':f==='mtt'?'d40':f==='face3b'?'btn':f==='face4b'?'ip':f==='squeeze'?'bb':f==='coldcall'?'btn':'btn';}
function buildVariants(varBoxId,varLabelId,format,current,pick){
 document.getElementById(varLabelId).textContent=L(VARIANT_LABEL[format]);
 const box=document.getElementById(varBoxId);box.innerHTML='';
 let lastGroup=null;
 Object.entries(VARIANTS[format]).forEach(([k,v])=>{
  if(v.group && v.group!==lastGroup){                 // full-width sub-header before each group
   const h=document.createElement('div');h.className='opt-group';h.textContent=L(v.group);
   box.appendChild(h);lastGroup=v.group;
  }
  const b=document.createElement('button');b.className='opt';b.dataset.v=k;
  const _lk=varBoxId==='selVariant'&&spotLocked(format,k);   // MTT 锁定分组的档位加🔒（现金锁在场景按钮上）
  b.innerHTML=`${_lk?'🔒 ':''}${L(v.label)}${v.sub?`<small>${L(v.sub)}</small>`:''}`;
  b.setAttribute('aria-selected',k===String(current));
  b.onclick=()=>{aInit();SFX.click();pick(k);
   [...box.children].forEach(x=>{if(x.classList.contains('opt'))x.setAttribute('aria-selected',x===b);});};
  box.appendChild(b);
 });
}

let selFormat='cash', selVariant='6', selDeal='smart', selGame='cash';
// ---- start-screen live range preview (mirrors the in-app charts page) ----
let sChartIdx=0, sChartSel=null;
function renderStartChart(){
 const pack=PACKS[selFormat]&&PACKS[selFormat][selVariant];
 const mEl=document.getElementById('sMatrix'); if(!pack||!mEl)return;
 if(sChartIdx>=pack.length)sChartIdx=0;
 // position chips injected INLINE inside #selVariant, right under the selected stack's group
 const old=document.getElementById('sChips'); if(old)old.remove();
 if(pack.length>1){
  const chips=document.createElement('div');chips.className='cchips';chips.id='sChips';
  chips.style.cssText='flex-basis:100%;width:100%;max-width:none;justify-content:flex-start;margin:3px 0 8px';
  pack.forEach((tt,i)=>{const b=document.createElement('button');b.className='cchip';
   b.textContent=L(tt.name);b.setAttribute('aria-selected',i===sChartIdx);
   b.onclick=()=>{sChartIdx=i;sChartSel=null;try{SFX.click();}catch(e){}renderStartChart();};
   chips.appendChild(b);});
  const sv=document.getElementById('selVariant');
  const sel=sv&&sv.querySelector('[data-v="'+selVariant+'"]');
  if(sv&&sel){ let a=sel.nextElementSibling; while(a&&!a.classList.contains('opt-group'))a=a.nextElementSibling; sv.insertBefore(chips,a); }
  else if(sv){ sv.appendChild(chips); }
 }
 const t=pack[sChartIdx];
 document.getElementById('sName').textContent=L(t.name);
 document.getElementById('sWho').innerHTML=Lwho(t.who||'')+' '+confChip(t);
 const solid={raise:'var(--raise)',shove:'var(--raise)',threebet:'var(--threebet)',call:'var(--call)',fold:'var(--fold)'};
 const edgeBg={'edge-raise':'var(--raise)','edge-shove':'var(--raise)','edge-call':'var(--call)'};
 mEl.innerHTML='';let inC=0;
 for(let r=0;r<13;r++)for(let c=0;c<13;c++){
  const hand=handLabel(r,c),cat=cellCat(t,hand);
  const cell=document.createElement('div');cell.className='ccell '+cat+(r===c?' pair':'')+(hand===sChartSel?' sel':'');
  cell.innerHTML=`<span>${hand}</span>`;
  if(cat!=='fold')inC+= cat.startsWith('edge')?combosOf(hand)/2:combosOf(hand);
  cell.onclick=()=>{sChartSel=hand;
   document.querySelectorAll('#sMatrix .ccell.sel').forEach(x=>x.classList.remove('sel'));cell.classList.add('sel');
   const fq=(t.confidence==='precise'&&cat!=='fold')?` · <span class="cfreq">${freqText(t,hand)}</span>`:'';
   document.getElementById('sInfo').innerHTML=tr('cCellInfo',{hand,cat:L(catName(cat,t.mode)),fq});};
  mEl.appendChild(cell);
 }
 document.getElementById('sStat').innerHTML=tr('cPotPct',{p:(inC/1326*100).toFixed(0)});
 const leg=document.getElementById('sLegend');leg.innerHTML='';
 MODES[t.mode].legend.forEach(([cls,lab])=>{let bg;
  if(cls==='mix')bg='linear-gradient(118deg,var(--threebet) 0 50%,var(--call) 50% 100%)';
  else if(cls.startsWith('edge'))bg=`linear-gradient(118deg,${edgeBg[cls]} 0 50%,var(--fold) 50% 100%)`;
  else bg=solid[cls];
  const it=document.createElement('div');it.className='it';
  it.innerHTML=`<span class="sw" style="background:${bg};${cls==='fold'?'box-shadow:inset 0 0 0 1px var(--line)':''}"></span>${L(lab)}`;
  leg.appendChild(it);});
 if(!sChartSel)document.getElementById('sInfo').innerHTML=tr('cChartHint');
 // Pro 锁定：图表预览整块模糊 + 浮层解锁按钮（点开 → 付费墙）
 const grp=document.getElementById('startChartGroup'),wrap=grp&&grp.querySelector('.cmatrix-wrap'),locked=spotLocked(selFormat,selVariant);
 if(wrap){
  wrap.classList.toggle('pro-locked',locked);
  let gate=document.getElementById('sChartGate');
  if(locked){
   if(!gate){gate=document.createElement('button');gate.id='sChartGate';gate.className='pro-gate';gate.onclick=()=>{try{SFX.click();}catch(e){}showPaywall(tr('pwWhyPush'));};grp.appendChild(gate);}
   gate.textContent=tr('unlockPro');gate.style.display='';
  } else if(gate){gate.style.display='none';}
 }
}
function buildOpts(boxId,cfg,current,pick){
 const box=document.getElementById(boxId);box.innerHTML='';
 Object.entries(cfg).forEach(([k,v])=>{
  const b=document.createElement('button');b.className='opt';b.dataset.v=k;
  b.innerHTML=`${L(v.label)}${v.sub?`<small>${L(v.sub)}</small>`:''}`;
  b.setAttribute('aria-selected',k===current);
  b.onclick=()=>{aInit();SFX.click();pick(k);
   [...box.children].forEach(x=>x.setAttribute('aria-selected',x===b));};
  box.appendChild(b);
 });
}
function startFmtPick(f,wantVar){
 selFormat=f; selVariant=(wantVar && VARIANTS[f][wantVar])?wantVar:defVariant(f);
 [...document.getElementById('selFormat').children].forEach(x=>x.setAttribute('aria-selected',x.dataset.v===f));
 buildVariants('selVariant','selVarLabel',f,selVariant,k=>{selVariant=k;sChartIdx=0;sChartSel=null;renderStartChart();});
 sChartIdx=0;sChartSel=null;renderStartChart();
}
function applyGame(g,keepFmt,wantVar){
 selGame=g;
 [...document.getElementById('selGame').children].forEach(x=>x.setAttribute('aria-selected',x.dataset.g===g));
 const fmts=GAMETYPES[g].formats;
 [...document.getElementById('selFormat').children].forEach(b=>{b.style.display=fmts.includes(b.dataset.v)?'':'none';});
 document.getElementById('fmtGroup').style.display=fmts.length>1?'':'none'; // 只有一个场景时（如 MTT）隐藏整栏，省去无意义的单选
 if(!keepFmt || !fmts.includes(selFormat)) selFormat=fmts[0];
 markFormatLocks();
 startFmtPick(selFormat,wantVar);
}
// 现金的「场景」锁在 selFormat 按钮上（MTT 锁在 selVariant 档位上，由 buildVariants 处理）
function markFormatLocks(){
 [...document.getElementById('selFormat').children].forEach(b=>{
  const f=b.dataset.v, locked=spotLocked(f,defVariant(f));
  let lk=b.querySelector('.lk');
  if(locked && !lk){lk=document.createElement('span');lk.className='lk';lk.textContent='🔒 ';b.insertBefore(lk,b.firstChild);}
  else if(!locked && lk){lk.remove();}
 });
}
[...document.getElementById('selFormat').children].forEach(b=>b.onclick=()=>{aInit();SFX.click();startFmtPick(b.dataset.v);});
[...document.getElementById('selGame').children].forEach(b=>b.onclick=()=>{aInit();SFX.click();applyGame(b.dataset.g,false);});

// restore saved preferences + mistake pile
const _p=STORE.prefs||{};
selDeal = (_p.deal && HANDFILTERS[_p.deal]) ? _p.deal : 'smart';
const _savedFmt = (_p.format && VARIANTS[_p.format]) ? _p.format : 'cash';
const _savedVar = (_p.variant && VARIANTS[_savedFmt][_p.variant]) ? _p.variant : null;
selFormat=_savedFmt;
applyGame(gameOf(_savedFmt),true,_savedVar);
buildOpts('selDeal',HANDFILTERS,selDeal,k=>selDeal=k);
reviveReview(STORE.review);
updateReviewBtns();

function launch(){
 aInit();SFX.click();
 if(spotLocked(selFormat,selVariant)){
  // 锁定:入口方可能已把自己隐藏——先落回主页,否则关掉付费墙后没有任何屏可见(死屏)
  showScreen('homeScreen');
  showPaywall(tr('pwWhyPush'));return;
 }
 G.format=selFormat;G.variant=selVariant;G.handFilter=selDeal;
 persistPrefs();
 showScreen(null);   // 开局 = 全部覆盖屏隐藏(含主页:引导「开始第一课」路径上它仍可见)
 newGame();
}
document.getElementById('startBtn').onclick=launch;
document.getElementById('againBtn').onclick=()=>{showScreen('startScreen');updateReviewBtns();SFX.click();};

// exit mid-game back to the start menu — no resume, so confirm only when a live
// run would be abandoned (matches game-over → 再来一局 behaviour).
// 从牌桌反馈态复位 UI(反馈面板/牌桌/评判闪烁/动作行)——exitToMenu/endTraining/coach 共用一份
function exitTableUI(){
 try{ document.getElementById('feedback').classList.add('hide'); }catch(e){}
 try{ document.querySelector('.table').classList.remove('fb-hide'); }catch(e){}
 try{ document.getElementById('verdict').className='verdict'; }catch(e){}
 try{ document.getElementById('actions').style.display=''; }catch(e){}
}
function exitToMenu(){
 if(G.diagMode){ SFX.click(); if(typeof coachAbortDiagnosis==='function')coachAbortDiagnosis(); return; }  // 诊断中途退出 → 放弃本次诊断,回 coach
 SFX.click();stopTimer();G.busy=true;G.over=true;
 setMode('normal');                               // 中途退出回 normal(模式单缝;曾因散装清布尔漏掉 reviewMode 引发错题堆污染)
 clearTimeout(G._advT);                           // 掐掉快进/升级定时器,防其在下一局里补一发 advance()
 exitTableUI();
 showScreen('startScreen');
 updateReviewBtns();
}
document.getElementById('exitBtn').onclick=exitToMenu;

// 结束训练（右上角）：结束本局并显示战绩（区别于左上角 ← 直接退回菜单）
function endTraining(){
 if(G.over)return;
 if(G.diagMode){ if(typeof coachAbortDiagnosis==='function')coachAbortDiagnosis(); return; }  // 诊断中途结束 → 放弃本次诊断,回 coach
 clearTimeout(G._advT);
 exitTableUI();
 G.busy=true;
 if(G.reviewMode) reviewComplete(); else gameOver('end');
}
document.getElementById('endBtn').onclick=endTraining;

/* ---- review detail page ---- */
let _reviewFrom='homeScreen'; // 错题覆盖屏关闭后回到的来源屏:从结算页进→回结算页,否则→主页
function openReviewDetail(){aInit();SFX.click();
 // 记住来源(在 hide overScreen 之前):结算页可见说明是从「📕 错题复习堆」进的
 _reviewFrom = document.getElementById('overScreen').classList.contains('hide') ? 'homeScreen' : 'overScreen';
 renderReviewDetail();
 showScreen('reviewScreen');
}
function renderReviewDetail(){
 const allBtn=document.getElementById('reviewAllBtn');
 allBtn.textContent=tr('reviewAll',{n:reviewPile.length});
 allBtn.style.opacity=reviewPile.length?'1':'.45';
 const box=document.getElementById('reviewList');box.innerHTML='';
 if(!reviewPile.length){box.innerHTML=`<p class="cnote" style="margin-top:20px">${tr('pileEmpty')}</p>`;return;}
 // group by label (spot)
 const groups={};
 reviewPile.forEach(r=>{(groups[r.label]=groups[r.label]||[]).push(r);});
 Object.keys(groups).forEach(label=>{
  const arr=groups[label];
  const g=document.createElement('div');g.className='rv-group';
  const head=document.createElement('div');head.className='rv-head';
  head.innerHTML=`<b>${label?Lparts(label):L('其他')}</b>`;
  const mini=document.createElement('button');mini.className='rv-mini';mini.textContent=tr('drillGroup',{n:arr.length});
  mini.onclick=()=>startReview(label);
  head.appendChild(mini);g.appendChild(head);
  const chips=document.createElement('div');chips.className='rv-chips';
  arr.forEach(r=>{
   const c=document.createElement('span');c.className='rv-chip';
   c.innerHTML=`${r.hand}${r.wrong>1?` <span class="wn">×${r.wrong}</span>`:''}${r.streak>0?` <span class="st">${tr('chipMaster',{s:r.streak,m:MASTER_STREAK})}</span>`:''} <span class="del">✕</span>`;
   c.querySelector('.del').onclick=()=>{removeFromPile(r);renderReviewDetail();updateReviewBtns();SFX.click();};
   chips.appendChild(c);
  });
  g.appendChild(chips);box.appendChild(g);
 });
}
document.getElementById('reviewBtn').onclick=openReviewDetail;
document.getElementById('overReviewBtn').onclick=openReviewDetail;
document.getElementById('reviewAllBtn').onclick=()=>{ if(!reviewPile.length){toast(tr('pileEmptyToast'),'📕',true);return;} startReview(); };
document.getElementById('reviewBack').onclick=()=>{SFX.click();showScreen(_reviewFrom);}; // 回来源屏(结算页/主页)

/* ---- career stats page ---- */
/* ---- Phase 5: Leak Analyzer — classify the review-pile misses (all vs 参考范围) ---- */
const LEAK_TYPES={
 loose:  {name:'太松',  desc:'该弃却入池',      color:'var(--mistake)'},
 tight:  {name:'太紧',  desc:'该入却弃·漏价值', color:'var(--good)'},
 passive:{name:'被动',  desc:'该加注却只跟注',  color:'#7f9cff'},
 aggro:  {name:'过激',  desc:'该跟注却加注/全下',color:'var(--raise)'},
 mix:    {name:'边缘混合',desc:'难点·没把握',    color:'var(--inacc)'},
 icm:    {name:'ICM 保命',desc:'泡沫期收紧',     color:'var(--threebet)'},
};
// classify a single miss. 优先用真实选择 rec.choice（精确）；旧数据无 choice 时退回手型启发。
//  ICM→icm · 混合点→mix · 纯弃打错=太松 · 纯入弃掉=太紧 · 同为入池但线路偏弱=被动 / 偏猛=过激
function classifyMiss(rec){
 const t=rec.t; if(!t||!MODES[t.mode])return 'mix';
 if(rec.variant==='icm')return 'icm';
 const isR=t.R.has(rec.hand),isC=t.C.has(rec.hand),isM=t.M.has(rec.hand);
 const correct=MODES[t.mode].correct(isR,isC,isM);
 if(correct.length>1)return 'mix';
 const right=correct[0], choice=rec.choice;
 if(!choice)return right==='fold'?'loose':'tight';          // 旧数据：退回手型启发
 if(right==='fold')return 'loose';                           // 该弃却入池
 if(choice==='fold')return 'tight';                          // 该入却弃
 const A={fold:0,call:1,raise:2,shove:3};                    // 同为入池、线路不同
 return (A[choice]||0)<(A[right]||0)?'passive':'aggro';
}
function leakDrill(label){SFX.click();startReview(label);} // startReview 内 showScreen(null) 统一收屏
// Pro 尝鲜：把锁住的内容模糊 + 浮一个解锁按钮（点了进付费墙）；免费露出的首行在 gate 之外
function _proGate(lockedHtml,featKey,labelKey){
 return `<div class="pro-prev"><div class="pro-locked">${lockedHtml}</div>`
  +`<button class="pro-gate" data-feat="${featKey}">${tr(labelKey)}</button></div>`;
}
function _wireGates(body){[...body.querySelectorAll('.pro-gate')].forEach(b=>b.onclick=()=>{try{SFX.click();}catch(e){}showPaywall(tr('pwWhyFeature',{name:tr(b.dataset.feat)}));});}
function renderLeak(preview){
 const body=document.getElementById('leakBody');
 if(!reviewPile.length){body.innerHTML=`<p class="cnote" style="margin:0">${tr('leakEmpty')}</p>`;return;}
 const types={};Object.keys(LEAK_TYPES).forEach(k=>types[k]=0);let total=0; // 含 passive/aggro 等全部桶
 reviewPile.forEach(r=>{types[classifyMiss(r)]+=r.wrong;total+=r.wrong;});
 const order=Object.keys(types).filter(k=>types[k]>0).sort((a,b)=>types[b]-types[a]);
 const max=Math.max(...order.map(k=>types[k]),1);
 const top=LEAK_TYPES[order[0]];
 const head=`<p class="cnote" style="margin:0 0 9px">${tr('leakTop',{c:top.color,name:L(top.name),n:total})}</p>`; // 免费露出：最大漏洞那一条
 let rest=order.map(k=>{const T=LEAK_TYPES[k];
  return `<div class="leak-row"><span class="leak-lab">${L(T.name)} · ${L(T.desc)}</span><span class="leak-trk"><i style="width:${Math.round(types[k]/max*100)}%;background:${T.color}"></i></span><span class="leak-n">${types[k]}</span></div>`;}).join('');
 rest+=`<div class="leak-sub">${tr('leakWorst')}</div>`;
 [...reviewPile].sort((a,b)=>b.wrong-a.wrong).slice(0,5).forEach(r=>{
  rest+=`<div class="leak-hand"><span class="h">${r.hand}</span><span class="sp">${Lparts(r.label)}</span><span class="x">×${r.wrong}</span><button class="leak-drill" data-label="${r.label.replace(/"/g,'&quot;')}">${tr('drill')}</button></div>`;});
 if(preview){ body.innerHTML=head+_proGate(rest,'feat.leak','gateLeak'); _wireGates(body); return; } // 锁：露最大漏洞，其余模糊
 body.innerHTML=head+rest;
 [...body.querySelectorAll('.leak-drill')].forEach(b=>b.onclick=()=>leakDrill(b.dataset.label));
}
/* ---- Phase 6: 个人画像 — 倾向(松/紧) + 准确率 + 强弱位置（全部 vs 参考范围）---- */
function renderProfile(preview){
 const body=document.getElementById('profileBody'); if(!body)return;
 const bySpot=STORE.statsBySpot||{};
 let th=0,tc=0;Object.values(bySpot).forEach(e=>{th+=e.h;tc+=e.c;});
 if(th<10){body.innerHTML=`<p class="cnote" style="margin:0">${tr('profEmpty')}</p>`;return;}
 const acc=Math.round(tc/th*100);
 // 两条倾向：松/紧（loose vs tight）+ 打法（被动 passive vs 过激 aggro）——都来自错题堆分类
 let lo=0,ti=0,pv=0,ag=0;reviewPile.forEach(r=>{const c=classifyMiss(r);
  if(c==='loose')lo+=r.wrong;else if(c==='tight')ti+=r.wrong;else if(c==='passive')pv+=r.wrong;else if(c==='aggro')ag+=r.wrong;});
 let tend,tdesc,tcolor;
 if(lo+ti<5){tend=L('待定');tdesc=tr('profNeedMore');tcolor='var(--muted)';}
 else if(lo>=ti*1.6){tend=L('偏松');tdesc=tr('profLoose',{p:Math.round(lo/(lo+ti)*100)});tcolor='var(--mistake)';}
 else if(ti>=lo*1.6){tend=L('偏紧');tdesc=tr('profTight',{p:Math.round(ti/(lo+ti)*100)});tcolor='var(--good)';}
 else {tend=L('较均衡');tdesc=tr('profBal');tcolor='var(--gold)';}
 const head=`<div class="prof-row"><span class="prof-k">${L('风格倾向')}</span><b style="color:${tcolor}">${tend}</b><span class="prof-d">${tdesc}</span></div>`; // 免费露出：风格倾向一行
 let rest='';
 if(pv+ag>=5){let pt,pd,pc;
  if(pv>=ag*1.6){pt=L('偏被动');pd=tr('profPassive');pc='#7f9cff';}
  else if(ag>=pv*1.6){pt=L('偏激进');pd=tr('profAggro');pc='var(--raise)';}
  else {pt=L('打法均衡');pd=tr('profAggBal');pc='var(--gold)';}
  rest+=`<div class="prof-row"><span class="prof-k">${L('打法倾向')}</span><b style="color:${pc}">${pt}</b><span class="prof-d">${pd}</span></div>`;}
 rest+=`<div class="prof-row"><span class="prof-k">${L('准确率')}</span><b>${acc}%</b><span class="prof-d">${tr('profCum',{n:th})}</span></div>`;
 const keys=Object.keys(bySpot).filter(k=>bySpot[k].h>=8);
 if(keys.length){const pa=k=>Math.round(bySpot[k].c/bySpot[k].h*100);
  const sorted=keys.slice().sort((a,b)=>pa(b)-pa(a));const best=sorted[0],worst=sorted[sorted.length-1];
  rest+=`<div class="prof-row"><span class="prof-k">${L('最强')}</span><b style="color:var(--best)">${Lparts(best)}</b><span class="prof-d">${pa(best)}%</span></div>`;
  if(worst!==best)rest+=`<div class="prof-row"><span class="prof-k">${L('最弱')}</span><b style="color:var(--mistake)">${Lparts(worst)}</b><span class="prof-d">${pa(worst)}%</span></div>`;
 }
 rest+=`<p class="cnote" style="margin:8px 0 0">${tr('profNote')}</p>`;
 if(preview){ body.innerHTML=head+_proGate(rest,'feat.profile','gateProfile'); _wireGates(body); return; } // 锁：露风格一行，其余模糊
 body.innerHTML=head+rest;
}
/* ---- Phase 6: 训练计划 — 按 spot 分组排「最该练」(错得多 + 准确率低)，可一键去练 ---- */
function renderPlan(preview){
 const body=document.getElementById('planBody'); if(!body)return;
 if(!reviewPile.length){body.innerHTML=`<p class="cnote" style="margin:0">${tr('planEmpty')}</p>`;return;}
 const bySpot=STORE.statsBySpot||{};
 const accOf=(fmt,v)=>{const F=FORMATS[fmt],V=VARIANTS[fmt]&&VARIANTS[fmt][v];if(!F||!V)return null;const s=bySpot[F.tag+'·'+V.short];return s&&s.h?s.c/s.h:null;};
 const g={};
 reviewPile.forEach(r=>{const e=g[r.label]||(g[r.label]={label:r.label,fmt:r.fmt,variant:r.variant,n:0,misses:0});e.n++;e.misses+=r.wrong;});
 const arr=Object.values(g).map(e=>{const a=accOf(e.fmt,e.variant);return {...e,acc:a,score:e.misses+(a!=null?(1-a)*8:0)};});
 arr.sort((x,y)=>y.score-x.score);
 let html=`<p class="cnote" style="margin:0 0 8px">${tr('planHead')}</p>`;
 arr.slice(0,5).forEach((e,i)=>{const accTxt=e.acc!=null?tr('planAcc',{p:Math.round(e.acc*100)}):'';
  html+=`<div class="leak-hand"><span class="h">${i+1}</span><span class="sp">${Lparts(e.label)}<br><span style="color:var(--muted);font-size:11px">${accTxt}${tr('planErrs',{n:e.n})}</span></span><button class="leak-drill" data-label="${e.label.replace(/"/g,'&quot;')}">${tr('drill')}</button></div>`;});
 if(preview){ body.innerHTML=_proGate(html,'feat.plan','gatePlan'); _wireGates(body); return; } // 计划整卡模糊
 body.innerHTML=html;
 [...body.querySelectorAll('.leak-drill')].forEach(b=>b.onclick=()=>leakDrill(b.dataset.label));
}
// 未付费时三块走「尝鲜」：免费露首行（画像风格 / 最大漏洞），其余模糊 + 浮层解锁；计划整卡模糊。基础统计仍全免费。
function openStats(){aInit();SFX.click();
 renderStats();renderTrend();
 const pv=!isPro();
 renderProfile(pv);renderLeak(pv);renderPlan(pv);
 showScreen('statsScreen');
}
/* ---- 准确率趋势（按天,采集自 resolve;免费=留存钩子）---- */
function renderTrend(){
 const body=document.getElementById('trendBody'); if(!body)return;
 const tr_=(STORE.trend||[]).filter(e=>e.h>0);
 if(tr_.length<2){ body.innerHTML=`<p class="cnote" style="margin:0">${tr('trendEmpty')}</p>`; return; }
 const days=tr_.slice(-30);                                   // 图上最多 30 天
 const W=400,H=120,PL=30,PR=6,PT=10,PB=22, iw=W-PL-PR, ih=H-PT-PB;
 const n=days.length, maxH=Math.max(...days.map(e=>e.h),1);
 const x=i=>PL+(n===1?iw/2:i*iw/(n-1));
 const y=p=>PT+ih-(p/100)*ih;
 // 手数柱(背景,淡) + 准确率折线(前景)
 const bw=Math.min(16,iw/n*0.55);
 const bars=days.map((e,i)=>`<rect x="${(x(i)-bw/2).toFixed(1)}" y="${(PT+ih-(e.h/maxH)*ih).toFixed(1)}" width="${bw.toFixed(1)}" height="${((e.h/maxH)*ih).toFixed(1)}" rx="2" fill="rgba(232,198,106,.14)"/>`).join('');
 const pts=days.map((e,i)=>`${x(i).toFixed(1)},${y(Math.round(e.c/e.h*100)).toFixed(1)}`);
 const dots=days.map((e,i)=>{const p=Math.round(e.c/e.h*100);
  return `<circle cx="${x(i).toFixed(1)}" cy="${y(p).toFixed(1)}" r="3" fill="var(--best)"/>`;}).join('');
 const grid=[0,50,100].map(p=>`<line x1="${PL}" y1="${y(p).toFixed(1)}" x2="${W-PR}" y2="${y(p).toFixed(1)}" stroke="rgba(255,255,255,.08)"/>`
  +`<text x="${PL-5}" y="${(y(p)+3).toFixed(1)}" text-anchor="end" font-size="8.5" fill="var(--muted)">${p}</text>`).join('');
 const lbl=(i)=>days[i].d.slice(5).replace('-','/');
 const xl=[0,n-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${lbl(i)}</text>`).join('');
 const last=days[n-1], lastAcc=Math.round(last.c/last.h*100);
 body.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${grid}${bars}`
  +`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--best)" stroke-width="2" stroke-linejoin="round"/>${dots}${xl}</svg>`
  +`<p class="cnote" style="margin:6px 0 0">${tr('trendNote',{n:tr_.length,acc:lastAcc,h:last.h})}</p>`;
}
function renderStats(){
 const st=STORE.stats||{};const bySpot=STORE.statsBySpot||{};
 let th=0,tc=0;Object.values(bySpot).forEach(e=>{th+=e.h;tc+=e.c;});
 const acc=th?Math.round(tc/th*100):0;
 document.getElementById('statsTiles').innerHTML=`
  <div class="stat"><div class="v" style="color:var(--gold)">${(st.best||0).toLocaleString()}</div><div class="k">${L('历史最高分')}</div></div>
  <div class="stat"><div class="v">${th}</div><div class="k">${L('累计手数')}</div></div>
  <div class="stat"><div class="v">${acc}%</div><div class="k">${L('总体准确率')}</div></div>
  <div class="stat"><div class="v">${st.games||0}</div><div class="k">${L('总局数')}</div></div>`;
 const bars=document.getElementById('statsBars');bars.innerHTML='';
 const keys=Object.keys(bySpot).sort((a,b)=>(bySpot[b].c/bySpot[b].h)-(bySpot[a].c/bySpot[a].h));
 if(!keys.length){bars.innerHTML=`<p class="cnote">${tr('statsNoData')}</p>`;return;}
 keys.forEach(k=>{const e=bySpot[k];const p=e.h?Math.round(e.c/e.h*100):0;
  const row=document.createElement('div');row.className='sbar';
  row.innerHTML=`<span class="nm" title="${Lparts(k)}">${Lparts(k)}</span><span class="trk"><span class="fil" style="width:${p}%"></span></span><span class="pct">${tr('sbarPct',{p:p,h:e.h})}</span>`;
  bars.appendChild(row);});
}
document.getElementById('statsBack').onclick=()=>{SFX.click();showScreen('homeScreen');};
document.getElementById('statsBtn').onclick=openStats;
updateReviewBtns();

/* charts page 已整体移除:无入口的死代码(开始页顶部已有实时图表预览 renderStartChart,
   Nash 图表页是独立的 nashScreen)。历史见 git。 */


// 导览 / 关于 入口已从首页移除（用户要求精简）。屏幕标记仍保留在 HTML 中（含数据假设说明），
// 只是暂无入口；下面只保留各自的「返回」按钮接线，避免引用已删除的入口按钮导致 null.onclick 崩溃。
document.getElementById('aboutBack').onclick=()=>{SFX.click();showScreen('startScreen');};
document.getElementById('guideBack').onclick=()=>{SFX.click();showScreen('homeScreen');};

/* ---- Range vs Range 胜率计算器 (Phase 4) — real Monte-Carlo equity, zero data risk ---- */
const CALC_SAMPLES=60000;
function calcCombos(set){return rangeCombos([...set]).length;}
// parse a board string ("Ah Kd 7c" / "AhKd7c") -> {cards:[ints]} (0=翻前) or {err}
function parseBoardStr(s){
 const t=(s||'').replace(/[\s,]+/g,'');
 if(!t)return {cards:[]};
 if(t.length%2!==0)return {err:tr('boardErrLen')};
 const out=[],seen=new Set();
 for(let i=0;i<t.length;i+=2){
  const tok=t[i].toUpperCase()+t[i+1].toLowerCase();
  let c;try{c=parseCard(tok);}catch(e){return {err:tr('boardErrCard',{tok})};}
  if(seen.has(c))return {err:tr('boardErrDup',{tok})};
  seen.add(c);out.push(c);
 }
 if(out.length<3||out.length>5)return {err:tr('boardErrCount')};
 return {cards:out};
}
const STREET_NAME={3:'翻牌',4:'转牌',5:'河牌'};
function streetName(n){return L(STREET_NAME[n]);}
function updateCalcCounts(){
 const h=expand(document.getElementById('calcHero').value), v=expand(document.getElementById('calcVill').value);
 document.getElementById('calcHN').textContent=h.size?tr('calcCountH',{n:h.size,c:calcCombos(h)}):tr('calcCountNone');
 document.getElementById('calcVN').textContent=v.size?tr('calcCountH',{n:v.size,c:calcCombos(v)}):tr('calcCountNone');
 const bp=parseBoardStr(document.getElementById('calcBoard').value);
 const bn=document.getElementById('calcBN');
 if(bn)bn.textContent=bp.err?L('· ⚠ 写法待修正'):(bp.cards.length?tr('calcBoardN',{n:bp.cards.length,street:streetName(bp.cards.length)}):L('· 留空=翻前'));
}
function runCalc(){
 const out=document.getElementById('calcOut');
 // 收起软键盘：否则移动端键盘会盖住「计算胜率」按钮与结果（胜率条）显示不全
 try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e){}
 const hero=[...expand(document.getElementById('calcHero').value)];
 const vill=[...expand(document.getElementById('calcVill').value)];
 if(!hero.length||!vill.length){out.innerHTML=`<div class="calc-err">${tr('calcEmptyRange')}</div>`;return;}
 const bp=parseBoardStr(document.getElementById('calcBoard').value);
 if(bp.err){out.innerHTML=`<div class="calc-err">${tr('calcErrSuffix',{e:bp.err})}</div>`;return;}
 const board=bp.cards;
 SFX.click();
 out.innerHTML=`<div class="calc-edge">${tr('calcComputing',{n:CALC_SAMPLES/10000})}</div>`;
 setTimeout(()=>{                                   // let the "计算中" frame paint before the blocking compute
  const rng=mulberry32(0x5eed);                     // fixed seed → reproducible numbers
  const e=board.length?rangeEquityBoard(hero,vill,board,CALC_SAMPLES,rng):rangeEquity(hero,vill,CALC_SAMPLES,rng);
  if(e==null){out.innerHTML=`<div class="calc-err">${tr('calcConflict')}</div>`;return;}
  const hp=e*100, vp=100-hp, edge=hp-vp;
  const bar=(name,pct,color)=>`<div class="calc-bar"><div class="bl"><span>${name}</span><span class="pct">${pct.toFixed(1)}%</span></div>`
   +`<div class="calc-track"><i style="width:${pct.toFixed(1)}%;background:${color}"></i></div></div>`;
  const lead = Math.abs(edge)<0.6 ? L('两边几乎五五开') : tr('calcLead',{who:L(edge>0?'你':'对手'),p:Math.abs(edge).toFixed(1)});
  const note = board.length
   ? tr('calcNoteBoard',{b:board.map(cardStr).join(' '),street:streetName(board.length),n:CALC_SAMPLES/10000})
   : tr('calcNotePre',{n:CALC_SAMPLES/10000});
  out.innerHTML=`<div class="calc-bars">${bar(L('你'),hp,'var(--best)')}${bar(L('对手'),vp,'var(--raise)')}</div>`
   +`<div class="calc-edge">${tr('calcResLine',{kind:L(board.length?'翻后胜率':'范围优势'),lead,note})}</div>`;
  // 键盘收起后，把结果滚入视野（确保胜率条完整可见）
  try{ out.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
 },20);
}
function openCalc(){aInit();SFX.click();
 showScreen('calcScreen');
 updateCalcCounts();
 document.getElementById('calcOut').innerHTML='';
}
document.getElementById('calcBtn').onclick=()=>{ if(!isPro()){showPaywall(tr('pwWhyCalc'));return;} openCalc(); };

/* ======== Nash 推弃图查询器：自算 Nash 每手 chip-EV，复用 PUSHFOLD/HU_PUSHFOLD（免费，展示差异化） ======== */
const NASH_STACKS=[]; for(let s=5;s<=20;s++) NASH_STACKS.push(s);
const NASH_STACKS_HU=[5,6,7,8,9,10,12,15,18,20,25];
const NASH_MODES=[
 {key:'r9', tk:'nmR9', wk:'nwOpen',   src:'jam9',    stacks:NASH_STACKS,    pos:['UTG','UTG1','MP1','MP2','MP3','CO','BTN','SB']},
 {key:'r6', tk:'nmR6', wk:'nwOpen',   src:'jam6',    stacks:NASH_STACKS,    pos:['UTG','HJ','CO','BTN','SB']},
 {key:'hu', tk:'nmHU', wk:'nwHUjam',  src:'huJam',   stacks:NASH_STACKS_HU, pos:null},
 {key:'c9', tk:'nmC9', wk:'nwC9',     src:'calloff', stacks:NASH_STACKS,    pos:null},
 {key:'huc',tk:'nmHUC',wk:'nwHUcall', src:'huCall',  stacks:NASH_STACKS_HU, pos:null},
];
const NASH={mode:'r9',ante:0,stack:20,pos:'BTN'};
function nashMode(){ return NASH_MODES.find(x=>x.key===NASH.mode)||NASH_MODES[0]; }
function nashData(){ const m=nashMode(), a=String(NASH.ante); try{
  const n=(typeof PUSHFOLD!=='undefined')&&PUSHFOLD.nash; if(!n) return null;
  if(m.src==='jam9')    return n.jam9[a][NASH.stack][NASH.pos];
  if(m.src==='jam6')    return n.jam6[a][NASH.stack][NASH.pos];
  if(m.src==='calloff') return n.calloff[a][NASH.stack];
  if(m.src==='huJam')   return n.hu[a][NASH.stack].jamEV;
  if(m.src==='huCall')  return n.hu[a][NASH.stack].callEV;
  return null;
 }catch(e){ return null; } }
// 发散色阶：白(0) → 浓绿(强正 EV) / 浅红→浓红(负 EV)，gamma 让弱档也带色；字色按背景明度自适应
function nashCellStyle(t){ const W=[247,249,245], C=t>=0?[33,151,66]:[214,80,80], k=Math.pow(Math.min(1,Math.abs(t)),0.72);
 const rgb=W.map((v,i)=>Math.round(v+(C[i]-v)*k)), lum=(0.299*rgb[0]+0.587*rgb[1]+0.114*rgb[2])/255;
 return { bg:'rgb('+rgb.join(',')+')', ink: lum>0.62?'#0f2417':'#f5f8f4' }; }
function nashChips(boxId,items,cur,pick){ const box=document.getElementById(boxId); if(!box)return; box.innerHTML='';
 items.forEach(it=>{ const b=document.createElement('button'); b.className='opt'; b.style.flex='none'; b.textContent=it.label;
  b.setAttribute('aria-selected',it.val===cur); b.onclick=()=>{try{SFX.click();}catch(e){} pick(it.val);}; box.appendChild(b); }); }
function renderNash(){
 const m=nashMode();
 nashChips('nMode', NASH_MODES.map(x=>({label:tr(x.tk),val:x.key})), NASH.mode, k=>{
  NASH.mode=k; const nm=NASH_MODES.find(x=>x.key===k);
  if(!nm.stacks.includes(NASH.stack)) NASH.stack=nm.stacks[Math.floor(nm.stacks.length/2)];
  if(nm.pos && !nm.pos.includes(NASH.pos)) NASH.pos=nm.pos[nm.pos.length-1];
  renderNash(); });
 nashChips('nAnte', [{label:tr('nashNoAnte'),val:0},{label:'12.5% '+tr('anteWord'),val:0.125},{label:tr('nashBBAnte'),val:'bb'}], NASH.ante, k=>{NASH.ante=k;renderNash();});
 (()=>{ const sb=document.getElementById('nStack'); if(!sb)return; sb.innerHTML='';
  const sel=document.createElement('select'); sel.className='calc-in'; sel.style.cssText='width:auto;min-width:140px;font-weight:700;cursor:pointer';
  m.stacks.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s+'bb'; if(s===NASH.stack)o.selected=true; sel.appendChild(o); });
  sel.onchange=()=>{ NASH.stack=+sel.value; renderNash(); }; sb.appendChild(sel); })();
 const pg=document.getElementById('nPosGroup');
 if(m.pos){ pg.style.display=''; nashChips('nPos', m.pos.map(p=>({label:p,val:p})), NASH.pos, k=>{NASH.pos=k;renderNash();}); }
 else pg.style.display='none';
 const ev=nashData(), mtx=document.getElementById('nMatrix'); mtx.innerHTML='';
 const anteTxt=NASH.ante==='bb'?' · '+tr('nashBBAnte'):(NASH.ante?' · '+(NASH.ante*100)+'% '+tr('anteWord'):'');
 document.getElementById('nName').textContent=tr(m.tk)+' · '+NASH.stack+'bb'+anteTxt+(m.pos?' · '+NASH.pos:'');
 document.getElementById('nWho').textContent=tr(m.wk);
 if(!ev){ document.getElementById('nStat').textContent=''; document.getElementById('nInfo').textContent=tr(_nashLoading?'nashLoading':'nashNoData'); return; } // 懒加载中显示「加载中」而非「无数据」
 let maxP=0.01,maxN=0.01; for(let r=0;r<13;r++)for(let c=0;c<13;c++){ const e=ev[handLabel(r,c)]; if(e==null)continue; if(e>0)maxP=Math.max(maxP,e); else if(e<0)maxN=Math.max(maxN,-e); }
 let inC=0;
 for(let r=0;r<13;r++)for(let c=0;c<13;c++){ const h=handLabel(r,c), e=ev[h];
  const cell=document.createElement('div'); cell.className='ncell';
  if(e==null){ cell.style.background='var(--fold)'; cell.style.color='rgba(255,255,255,.45)'; }
  else { const t=e>=0?Math.min(1,e/maxP):Math.max(-1,e/maxN), st=nashCellStyle(t);
   cell.style.background=st.bg; cell.style.color=st.ink; if(e>0)inC+=combosOf(h);
   cell.innerHTML=`<span class="h">${h}</span><span class="e">${e>0?'+':''}${e.toFixed(1)}</span>`; }
  mtx.appendChild(cell); }
 document.getElementById('nStat').textContent=tr('nashPct',{n:Math.round(inC),p:(inC/1326*100).toFixed(0)});
 document.getElementById('nInfo').textContent=tr('nashInfo');
}
// Nash 查询器数据(PUSHFOLD.nash,2.4MB=原文件 93%)不随首屏加载——首次打开时动态注入,
// 省掉每次冷启动 ~2.4MB 的同步解析(低端 WebView 上 100-400ms + 数 MB 常驻堆)
let _nashLoading=false;
function _loadNashData(cb){
 if(typeof PUSHFOLD!=='undefined' && PUSHFOLD.nash){ cb(); return; }
 if(_nashLoading) return;                       // 已在加载:onload 会统一重渲染
 _nashLoading=true;
 const s=document.createElement('script'); s.src='js/data/pushfold-nash.js';
 s.onload=()=>{ _nashLoading=false; try{cb();}catch(e){} };
 s.onerror=()=>{ _nashLoading=false; try{toast(tr('nashLoadErr'),'⚠',true);}catch(e){} };
 document.body.appendChild(s);
}
function openNash(){ try{aInit();SFX.click();}catch(e){}
 showScreen('nashScreen'); renderNash();
 _loadNashData(()=>{ const ns=document.getElementById('nashScreen'); if(ns && !ns.classList.contains('hide')) renderNash(); });
}
try{ document.getElementById('nashBtnLbl').textContent=tr('nashBtn'); }catch(e){}
document.getElementById('nashBtn').onclick=()=>{ if(!isPro()){showPaywall(tr('pwWhyNash'));return;} openNash(); };
document.getElementById('nashBack').onclick=()=>{ try{SFX.click();}catch(e){} showScreen('homeScreen'); };
document.getElementById('calcBack').onclick=()=>{SFX.click();showScreen('homeScreen');};
document.getElementById('calcRun').onclick=runCalc;
document.getElementById('calcBoard').addEventListener('input',updateCalcCounts);
document.getElementById('calcHero').addEventListener('input',updateCalcCounts);
document.getElementById('calcVill').addEventListener('input',updateCalcCounts);
function guideLaunch(fmt,variant){
 selFormat=fmt;
 applyGame(gameOf(fmt),true,variant);
 launch();                                        // launch 内 showScreen(null) 统一收屏
}
document.querySelectorAll('#guideScreen .gd-node').forEach(node=>{
 node.querySelector('.gd-go').onclick=()=>guideLaunch(node.dataset.fmt,node.dataset.var);
});
document.getElementById('clearDataBtn').onclick=()=>{SFX.click();
 const pro=STORE.proEntitled;                     // RevenueCat 授权缓存不属于「本地存档」——
 clearStore();reviewPile=[];                      // 抹掉它会让付费用户立刻被当成未购买,直到重启/手动恢复购买
 if(pro){STORE.proEntitled=pro;persist();}
 updateReviewBtns();
 try{ if(typeof rerenderUI==='function') rerenderUI(); }catch(e){} // 锁徽章/图表等依赖 STORE 的 UI 立即刷新
 toast(tr('saveCleared'),'🗑',true);
};

/* ---- i18n: re-render dynamic UI after a language switch (called by setLang) ---- */
function rerenderUI(){
 try{
  buildVariants('selVariant','selVarLabel',selFormat,selVariant,k=>{selVariant=k;sChartIdx=0;sChartSel=null;renderStartChart();});
  buildOpts('selDeal',HANDFILTERS,selDeal,k=>selDeal=k);
  markFormatLocks();
  renderStartChart();
  updateReviewBtns();
  try{ if(typeof wireNotify==='function') wireNotify(); }catch(e){}
  try{ document.getElementById('nashBtnLbl').textContent=tr('nashBtn'); const ns=document.getElementById('nashScreen'); if(ns && !ns.classList.contains('hide') && typeof renderNash==='function') renderNash(); }catch(e){}
  if(G && G.table && !G.over){
   renderHUD();
   document.getElementById('sceneName').textContent=L(G.table.name);
   document.getElementById('sceneWho').innerHTML=Lwho(G.table.who)+(G.reviewMode?tr('reviewTag'):'')+' '+confChip(G.table);
   buildActions(G.table.mode);
  }
  const ss=document.getElementById('statsScreen');
  if(ss && !ss.classList.contains('hide')){ renderStats(); const pv=!isPro(); renderProfile(pv);renderLeak(pv);renderPlan(pv); }
  const rs=document.getElementById('reviewScreen');
  if(rs && !rs.classList.contains('hide')) renderReviewDetail();
 }catch(e){}
}
// app.js loaded last → DOM + all builders ready; translate static HTML and dynamic UI now.
try{ applyI18n(); }catch(e){}
// 原生 app：配置 RevenueCat 并拉取购买状态（浏览器里 Pay.init 自动空跑）
try{ if(typeof Pay!=='undefined') Pay.init(); }catch(e){}
// 原生 app：每日训练提醒开关（浏览器隐藏；启动时重排已开启的提醒，更新/重装后仍有效）
function wireNotify(){
 const box=document.getElementById('notifySetting'); if(!box) return;
 if(typeof Notify==='undefined' || !Notify.native){ box.style.display='none'; return; }
 box.style.display='';
 const lab=document.getElementById('notifyLabel'), btn=document.getElementById('notifyToggle'), timeInp=document.getElementById('notifyTime');
 const t=Notify.time(); if(timeInp) timeInp.value=String(t.h).padStart(2,'0')+':'+String(t.m).padStart(2,'0');
 const parse=()=>{ const v=(timeInp&&timeInp.value)||'20:00'; const p=v.split(':'); return {h:(+p[0])||0,m:(+p[1])||0}; };
 const paint=()=>{ lab.textContent=tr('notifyLabel'); btn.textContent=tr(Notify.isOn()?'notifyStateOn':'notifyStateOff'); if(timeInp) timeInp.style.display=Notify.isOn()?'':'none'; };
 btn.onclick=async()=>{ try{SFX.click();}catch(e){}
  if(Notify.isOn()){ await Notify.disable(); try{toast(tr('notifyOffToast'),'🐿');}catch(e){} }
  else { const {h,m}=parse(); const ok=await Notify.enable(h,m); try{ ok?toast(tr('notifyOnToast'),'🔔',true):toast(tr('notifyDenied'),'🐿'); }catch(e){} }
  paint();
 };
 if(timeInp) timeInp.onchange=async()=>{ if(Notify.isOn()){ const {h,m}=parse(); await Notify.enable(h,m); try{toast(tr('notifyOnToast'),'🔔',true);}catch(e){} } };
 paint();
}
try{ wireNotify(); }catch(e){}
try{ if(typeof Notify!=='undefined') Notify.reschedule(); }catch(e){}

/* ======== 推弃特训:快速选档直达(全 precise 档,反馈带求解器真 EV) ======== */
document.getElementById('pushBack').onclick=()=>{SFX.click();showScreen('homeScreen');};
document.querySelectorAll('#pushScreen .opt[data-pv]').forEach(b=>{
 b.onclick=()=>{ SFX.click();
  guideLaunch('mtt', b.dataset.pv);           // launch 内统一收屏                          // 复用导览的直达逻辑
 };
});

/* ======== 学习路径:导览页(决策树)注入按 format 聚合的真实准确率 ======== */
function renderGuideAcc(){
 const bySpot=STORE.statsBySpot||{};
 document.querySelectorAll('#guideScreen .gd-node').forEach(node=>{
  const fmt=node.dataset.fmt; if(!fmt||!FORMATS[fmt])return;
  const pre=FORMATS[fmt].tag+'·';
  let h=0,c=0; Object.keys(bySpot).forEach(k=>{ if(k.startsWith(pre)){h+=bySpot[k].h;c+=bySpot[k].c;} });
  let chip=node.querySelector('.gd-acc');
  if(!chip){ chip=document.createElement('span'); chip.className='gd-acc';
   const b=node.querySelector('.gd-txt b'); if(b)b.appendChild(chip); else node.querySelector('.gd-txt').appendChild(chip); }
  if(!h){ chip.textContent=tr('pathNew'); chip.style.color='var(--muted)'; }
  else { const acc=Math.round(c/h*100);
   chip.textContent=`${acc}% · ${h}`;
   chip.style.color = acc>=80?'var(--best)':acc>=60?'var(--gold)':'var(--mistake)'; }
 });
}

/* ======== 新手引导(首启一次,3 步;任何关闭都不再弹) ======== */
function maybeIntro(){
 try{
  if(STORE.seenIntro) return;
  let th=0; Object.values(STORE.statsBySpot||{}).forEach(e=>{th+=e.h;});
  if(th>0){ STORE.seenIntro=1; persist(); return; }           // 老用户不打扰
  const seen=()=>{ STORE.seenIntro=1; persist(); };
  const ov=document.createElement('div'); ov.className='intro-ov'; ov.id='introOv';
  const card=document.createElement('div'); card.className='intro-card'; ov.appendChild(card);
  document.body.appendChild(ov);
  let step=0;
  const close=()=>{ seen(); ov.remove(); };
  const render=()=>{
   const dots=[0,1,2].map(i=>`<i class="${i===step?'on':''}"></i>`).join('');
   const body=tr('intro'+step);
   const btns = step<2
    ? `<button class="ib" id="inSkip">${tr('introSkip')}</button><button class="ib pri" id="inNext">${tr('introNext')}</button>`
    : `<button class="ib" id="inLook">${tr('introLook')}</button><button class="ib pri" id="inGo">${tr('introGo')}</button>`;
   card.innerHTML=body+`<div class="intro-dots">${dots}</div><div class="intro-btns">${btns}</div>`;
   const on=(id,fn)=>{ const el=card.querySelector('#'+id); if(el)el.onclick=()=>{ try{SFX.click();}catch(e){} fn(); }; };
   on('inSkip',close); on('inLook',close);
   on('inNext',()=>{ step++; render(); });
   on('inGo',()=>{ close(); guideLaunch('cash','6'); });      // 第一课:现金 6 人 RFI+防守
  };
  render();
 }catch(e){}
}

/* ======== 主页菜单：入口复用现有功能，不改任何现有逻辑 ======== */
(function(){
 const home=document.getElementById('homeScreen'), start=document.getElementById('startScreen');
 if(!home||!start) return;
 const goStart=()=>{ showScreen('startScreen'); };
 const click=id=>{ const el=document.getElementById(id); if(el) el.click(); };
 const chip=g=>{ const el=document.querySelector('#selGame [data-g="'+g+'"]'); if(el) el.click(); };
 const bind=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=()=>{ try{SFX.click();}catch(e){} fn(); }; };
 bind('homeCash',  ()=>{ goStart(); chip('cash'); });
 bind('homeMtt',   ()=>{ goStart(); chip('mtt'); });
 bind('homeReview',()=>{ goStart(); click('reviewBtn'); });
 bind('homeNash',  ()=>{ goStart(); click('nashBtn'); });
 bind('homeEquity',()=>{ goStart(); click('calcBtn'); });
 bind('homeStats', ()=>{ goStart(); click('statsBtn'); });
 bind('homePlan',  ()=>{ if(typeof coachOpen==='function') coachOpen(); });
 bind('homePush',  ()=>{ showScreen('pushScreen'); });
 bind('homePath',  ()=>{ renderGuideAcc(); showScreen('guideScreen'); });
 bind('homeBack',  ()=>{ showScreen('homeScreen'); });
 // 已解锁（网页恒解锁 / 已购 Pro）就去掉主页的 PRO 徽章——只在真正锁定时才显示
 try{ if(typeof isPro==='function' && isPro()) home.querySelectorAll('.hc-pro').forEach(b=>b.remove()); }catch(e){}
 // 启动时显示主页（startScreen 退居训练设置页）
 showScreen('homeScreen');
 maybeIntro();                                                // 新手引导(首启一次)
})();
