/* app.js — persistence, audio, confetti, hand helpers, game engine, charts UI
   and boot. Loads last; depends on ranges.js, modes.js, packs.js. */
/* ============ local persistence (graceful: works locally, no-ops in restricted previews) ============ */
const STORE_KEY='gtoTrainer_v1';
function loadStore(){try{const s=localStorage.getItem(STORE_KEY);return s?JSON.parse(s):{};}catch(e){return {};}}
let STORE=loadStore();
function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(STORE));}catch(e){}}
function persistPrefs(){STORE.prefs={format:selFormat,variant:selVariant,deal:selDeal};persist();}
function clearStore(){STORE={};try{localStorage.removeItem(STORE_KEY);}catch(e){}}

/* ============ Pro 功能门控 + 付费墙 ============
   现在「解锁」只翻本地开关（占位）；上架时把 isPro()/解锁按钮换成 RevenueCat 授权校验即可。
   红线：核心训练永久免费，Pro 只锁进阶能力（自算推弃训练 / 算胜率 / 画像·漏洞·计划）。*/
function isPro(){return true;}   // 全部解锁：付费墙关闭，所有进阶内容直接可用（上架前若要恢复门控改回 !!STORE.pro）
function setPro(v){STORE.pro=!!v;persist();
 try{buildVariants('selVariant','selVarLabel',selFormat,selVariant,k=>selVariant=k);}catch(e){} // 刷新锁标
}
// Pro 变体 = 自算 Nash 的推弃/HU/6人/面对全下（开局/防守等参考范围免费）
const PRO_VARIANTS=new Set(['d8p','d10','d12p','d15p','d20p','hu5','hu8','hu10','hu12','hu15','hu20','hu25','p6_10','p6_15','p6_20','co10','co15','co20']);
function proVariant(fmt,variant){return fmt==='mtt'&&PRO_VARIANTS.has(variant);}
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
   <button id="pwBuy" style="appearance:none;border:0;cursor:pointer;font-family:inherit;font-weight:700;font-size:17px;color:#16110a;background:linear-gradient(180deg,var(--gold,#e8c66a),var(--gold2,#b8902f));width:100%;padding:14px;border-radius:13px;margin-top:16px">${tr('pwBuy')}</button>
   <button id="pwClose" style="appearance:none;border:0;cursor:pointer;font-family:inherit;font-size:14px;color:var(--muted,#8fa79a);background:transparent;width:100%;padding:10px;margin-top:4px">${tr('pwClose')}</button>
   <div style="text-align:center;color:var(--foldink,#54655a);font-size:11px;margin-top:6px">${tr('pwFoot')}</div>
  </div>`;
  document.body.appendChild(el);
  el.querySelector('#pwList').innerHTML=tRaw('pitch').map(s=>`<div>· ${s}</div>`).join('');
  el.querySelector('#pwClose').onclick=()=>{try{SFX.click();}catch(e){}el.remove();};
  el.querySelector('#pwBuy').onclick=()=>{ // TODO: 接 RevenueCat purchase；现为本地解锁占位
   try{SFX.level();}catch(e){}setPro(true);el.remove();try{toast(tr('proUnlocked'),'🐿',true);}catch(e){}};
 }
 el.querySelector('#pwWhy').textContent=why||tr('pwWhyDefault');
 return false;
}

/* ============ audio (synth) ============ */
let AC=null;
function aInit(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}}
function tone(f,d,t='sine',g=.18,delay=0){if(!AC)return;const o=AC.createOscillator(),v=AC.createGain();
 o.type=t;o.frequency.value=f;o.connect(v);v.connect(AC.destination);
 const s=AC.currentTime+delay;v.gain.setValueAtTime(.0001,s);v.gain.exponentialRampToValueAtTime(g,s+.012);
 v.gain.exponentialRampToValueAtTime(.0001,s+d);o.start(s);o.stop(s+d+.02);}
const SFX={
 deal(){tone(520,.05,'square',.05);tone(380,.06,'square',.04,.04);},
 click(){tone(300,.04,'square',.06);},
 correct(){tone(660,.1,'triangle',.16);tone(880,.16,'triangle',.14,.07);},
 great(){[523,659,784,1046].forEach((f,i)=>tone(f,.14,'triangle',.13,i*.06));},
 wrong(){tone(180,.22,'sawtooth',.13);tone(120,.28,'sawtooth',.1,.05);},
 level(){[523,659,784,1046,1318].forEach((f,i)=>tone(f,.2,'sine',.14,i*.07));},
 over(){[440,392,330,262].forEach((f,i)=>tone(f,.3,'sine',.14,i*.13));},
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
function unlocked(){const u=G.pack.filter(t=>t.tier<=G.level);return u.length?u:G.pack.filter(t=>t.tier===1);}

/* ---- mistake review pile (session memory) ---- */
let reviewPile=[];
const MASTER_STREAK=2; // consecutive corrects in review needed before a spot leaves the pile
const SESSION_HANDS=50; // a normal game = 50 hands (then 🎉 complete); HP=0 still ends it early
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

function newGame(){
 G.reviewMode=false;
 G.pack=PACKS[G.format][G.variant];
 G.score=0;G.level=1;G.hp=5;G.maxhp=5;G.combo=0;G.best=0;
 G.hands=0;G.correct=0;G.handNo=0;G.q={best:0,good:0,inacc:0,mistake:0,blunder:0};
 G.fastCorrect=0;G.levelMistakes=0;G.ach=new Set();G.busy=false;G.over=false;
 G.queue=null;G.queueLevel=0;
 renderHUD();nextHand();
}

function startReview(filterLabel){
 const pool = filterLabel ? reviewPile.filter(r=>r.label===filterLabel) : reviewPile.slice();
 if(!pool.length)return;
 G.reviewMode=true;G.over=false;G.busy=false;
 G.score=0;G.combo=0;G.best=0;G.hands=0;G.correct=0;
 G.q={best:0,good:0,inacc:0,mistake:0,blunder:0};G.fastCorrect=0;G.ach=new Set();
 G.hp=5;G.maxhp=5;
 G.reviewStart=pool.length;G.reviewCleared=0;
 G.reviewQueue=shuffle(pool.slice());
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('overScreen').classList.add('hide');
 document.getElementById('reviewScreen').classList.add('hide');
 renderHUD();nextHand();
}
function reviewComplete(){
 G.over=true;G.reviewMode=false;stopTimer();SFX.level();
 const acc=G.hands?Math.round(G.correct/G.hands*100):0;
 document.getElementById('overTitle').innerHTML=tr('reviewDone');
 document.getElementById('overStats').innerHTML=`
  <div class="stat"><div class="v" style="color:var(--best)">${G.reviewCleared}</div><div class="k">${L('本轮清掉')}</div></div>
  <div class="stat"><div class="v">${reviewPile.length}</div><div class="k">${L('仍待练')}</div></div>
  <div class="stat"><div class="v">${G.hands}</div><div class="k">${L('复习手数')}</div></div>
  <div class="stat"><div class="v">${acc}%</div><div class="k">${L('本轮准确率')}</div></div>`;
 document.getElementById('overAch').innerHTML='';
 updateReviewBtns();
 document.getElementById('overScreen').classList.remove('hide');
}

function renderHUD(){
 const hp=document.getElementById('hp');hp.innerHTML='';
 for(let i=0;i<G.maxhp;i++){const e=document.createElement('i');e.textContent='❤';if(i>=G.hp)e.className='dead';hp.appendChild(e);}
 document.getElementById('score').textContent=G.score.toLocaleString();
 // 3 lines: score (above) / 场景 / 等级·局数
 document.getElementById('hudScene').textContent = G.reviewMode
  ? L('复习模式')
  : spotLabel(G.format,G.variant);
 document.getElementById('lvl').textContent = G.reviewMode
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
 precise:{mark:'',txt:'精准',cls:'conf-precise',desc:'本工具 equity+Nash 求解器计算所得（非手搓）；属简化模型（无前注 / no-overcall / 类级 equity）的近似解，非真实牌桌精确——可剥削度见来源'},
 curated:{mark:'≈',txt:'手搓参考',cls:'conf-curated',desc:'参考公开图表手工整理，核对过量级/形状；混合频率为占位，非 solver 精确'},
};
function confOf(t){return CONF[(t&&t.confidence)]||CONF.curated;}
function confChip(t){const c=confOf(t);
 if(c===CONF.curated)return ''; // 手搓档不显示标签（仅「精准」自算档显示）
 const title=(t&&t.src)?L(c.desc)+' · '+t.src:L(c.desc);
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

// 智能出题：把已解锁局面的「范围内手牌（系统覆盖）」+约 50% 弃牌组成一副牌，
// 你错过的手（错题堆）排到最前、且 2× 权重；无放回抽到一轮抽完再重建。
function buildSmartQueue(){
 const pool=unlocked();
 const weakKeys=new Set(reviewPile
  .filter(r=>r.fmt===G.format&&r.variant===G.variant)
  .map(r=>r.t.name+'|'+r.hand));
 const weak=[],rest=[];
 pool.forEach(t=>{
  const inrange=[...t.union];                 // 决策相关手：系统覆盖
  const uni=new Set(t.union);
  const folds=ALL169.filter(h=>!uni.has(h));
  const nf=Math.max(2,Math.round(inrange.length*0.5));   // 掺约一半弃牌，保留弃牌纪律
  const foldSample=shuffle(folds.slice()).slice(0,nf);
  [...inrange,...foldSample].forEach(hand=>{
   const item={t,hand};
   if(weakKeys.has(t.name+'|'+hand))weak.push(item); else rest.push(item);
  });
 });
 const weakBoost=[];weak.forEach(it=>{weakBoost.push(it,it);}); // 弱项 2× 权重
 G.queue=shuffle(weakBoost).concat(shuffle(rest));            // 弱项排前，组内洗牌
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
 if(fmt==='cash')return +variant||6;
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
 if(fmt==='coldcall'){                                   // 冷跟：英雄 BTN/CO 面对开局加注（spot 用 defense 模式）
  hero=posKey(nm.split(/冷跟|vs/)[0])||'BTN';
  vil.push({pos:posKey(nm.split('vs')[1]||'')||'CO',bet:RAISE});
 } else if(t.mode==='defense'){                          // 大盲防守：英雄 BB 面对开局加注
  hero='BB'; vil.push({pos:posKey(nm.replace(/BB|大盲/g,'').replace(/vs/,''))||'BTN',bet:RAISE});
 } else if(mtt&&/^hu/.test(variant)){                    // 单挑推弃
  hero=t.huSide==='call'?'BB':'SB';
  if(t.huSide==='call')vil.push({pos:'SB',bet:+(/(\d+)/.exec(variant)||[])[1]||10});
 } else if(t.mode==='callshove'&&t.calloff){             // 9人 面对全下·BB 跟注
  hero='BB'; vil.push({pos:'BTN',bet:+(t.coStack||10)});
 } else if(t.mode==='face3b'){                           // 你开局 → 被 3-bet：解析开局位 + 反加位
  hero=posKey((nm.match(/开\s*([^\s，,]+)/)||[])[1])||'BTN';
  let v3=posKey((nm.match(/([^\s，,]+)\s*反加/)||[])[1]); if(!v3)v3=hero==='CO'?'BTN':'BB';
  heroBet=RAISE; vil.push({pos:v3,bet:THREEB});
 } else if(t.mode==='face4b'){                           // 你 3-bet → 被 4-bet
  hero=/盲/.test(nm)?'SB':'BTN'; heroBet=THREEB;
  vil.push({pos:hero==='SB'?'BTN':'CO',bet:FOURB});
 } else if(t.mode==='squeeze'){                          // 挤压：开局者 + 跟注者 都已在池
  hero=/大盲|盲/.test(nm)?'BB':'BTN';
  vil.push({pos:'UTG',bet:RAISE});                        // 开局者
  vil.push({pos:hero==='BTN'?'CO':'HJ',bet:RAISE});       // 跟注者
 } else { hero=posKey(nm)||ring[0]; }                     // open / push：首入，折到英雄
 if(!ring.includes(hero)) hero = N===2?'SB':'BB';
 const hi=ring.indexOf(hero);
 const betAt={}; vil.forEach(v=>{const i=ring.indexOf(v.pos); if(i>=0)betAt[i]=Math.max(betAt[i]||0,v.bet);});
 const facing=Object.keys(betAt).length>0;               // 有对手已下注 = 非首入
 const seats=ring.map((pos,i)=>{
  let bet=0,blind=false,folded=false;
  if(pos==='SB'){bet=0.5;blind=true;} if(pos==='BB'){bet=1;blind=true;}
  if(betAt[i]!=null)bet=Math.max(bet,betAt[i]);          // 对手加注/全下
  if(i===hi&&heroBet)bet=Math.max(bet,heroBet);           // 英雄已投入(face3b/4b)
  if(!facing){ if(i<hi && pos!=='SB' && pos!=='BB') folded=true; }           // 首入：折到英雄
  else if(i!==hi && betAt[i]==null && pos!=='SB' && pos!=='BB') folded=true; // 面对下注：留英雄+下注者+盲注
  const ang=Math.PI/2 + ((i-hi)/N)*2*Math.PI;            // 英雄固定底部中央，其余环绕
  const x=50+44*Math.cos(ang), y=52+40*Math.sin(ang);
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
 if(G.reviewMode){
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

function resolve(choice,btn,timedOut){
 const t=G.table,correct=G.correct_set,hand=G.hand;
 // a timeout means the player never decided in time → never counts as correct,
 // regardless of whether 'fold' happened to be the right play (consistent grading).
 const ok = !timedOut && correct.includes(choice);
 // frequency-aware grading: a precise spot carries real solved frequencies, so a
 // mix point HAS a majority line — reward matching it as 最佳, a secondary line as
 // 好棋. Curated mixes are placeholder ~50/50, so we cannot rank them (§6).
 const fmap=handFreq(t,hand);
 const topAct=Object.keys(fmap).sort((a,b)=>fmap[b]-fmap[a])[0];
 const freqGraded = t.confidence==='precise' && G.isMix;
 // "played the majority line" — only a real, non-timed-out choice earns 最佳 (a
 // timeout auto-folds and must never be celebrated as the best play).
 const hitTop = freqGraded && choice===topAct && !timedOut;
 G.hands++;
 // per-spot lifetime accuracy (normal play only)
 if(!G.reviewMode){
  const sk=FORMATS[G.format].tag+'·'+VARIANTS[G.format][G.variant].short;
  STORE.statsBySpot=STORE.statsBySpot||{};
  const e=STORE.statsBySpot[sk]||{h:0,c:0};
  e.h++; if(ok)e.c++; STORE.statsBySpot[sk]=e; persist();
 }

 // grade
 let grade,gcolor,hpHit=0,pts=0,big=false;
 if(ok){
  G.correct++;G.combo++;G.best=Math.max(G.best,G.combo);
  const mult=Math.min(3,1+G.combo*0.1);
  const spd=1; // 倒计时已移除 → 无速度加成，得分只看正确性与连击
  if(G.isMix && !hitTop){grade='好棋';gcolor='var(--good)';G.q.good++;pts=Math.round(85*mult*spd);}
  else{grade='最佳';gcolor='var(--best)';G.q.best++;pts=Math.round(100*mult*spd);big=true;}
  G.score+=pts;
  SFX[G.combo>=5?'great':'correct']();buzz(G.combo>=5?[20,40,20]:30);
 } else {
  G.combo=0;G.levelMistakes++;
  const shouldPlay=correct.includes('raise')||correct.includes('call')||correct.includes('shove');
  if(timedOut){grade='超时';gcolor='var(--mistake)';G.q.mistake++;hpHit=1;} // didn't act in time — uniform miss, no 漏着 award
  else if(G.isMix){grade='不准';gcolor='var(--inacc)';G.q.inacc++;hpHit=1;}
  else if((shouldPlay&&choice==='fold'&&PREMIUM.has(hand)) || (correct[0]==='fold'&&PREMIUM.has(hand)===false&&choice!=='fold'&&isTrash(hand))){
   grade='漏着';gcolor='var(--blunder)';G.q.blunder++;hpHit=2;
   if(shouldPlay&&choice==='fold'&&PREMIUM.has(hand))award('巨牌漏着','😱');
  } else {grade='失误';gcolor='var(--mistake)';G.q.mistake++;hpHit=1;}
  if(!G.reviewMode)G.hp-=hpHit;
  SFX.wrong();buzz([60,30,60]);
 }

 // mistake pile bookkeeping
 if(G.reviewMode){
  const rec=G.reviewRec;
  if(ok){
   rec.streak=(rec.streak||0)+1;
   if(rec.streak>=MASTER_STREAK){removeFromPile(rec);G.reviewCleared++;} // 连续答对 → 掌握，移出错题堆
   else {persistReview();G.reviewQueue.push(rec);}                       // 答对但未掌握 → 留堆，本轮再练一遍
  } else {rec.streak=0;persistReview();G.reviewQueue.push(rec);}          // 答错 → 清零重练
  updateReviewBtns();
 } else if(!ok){ addMistake(choice); updateReviewBtns(); }

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
 if(ok&&big&&G.combo>=3)burst(innerWidth/2,innerHeight*0.42,['#e8c66a','#34b074','#fff','#7fc6ff'],G.combo>=8?40:24);

 renderHUD();checkAch();

 // level up (deferred to advance) — skip in review mode
 G.pendingLevel=false;
 if(!G.reviewMode){
  const need=G.level*1000;
  if(G.score>=need && G.level<6){
   G.level++;G.pendingLevel=true;
   if(G.levelMistakes===0)award('完美关卡','🏆');
   G.levelMistakes=0;G.hp=Math.min(G.maxhp,G.hp+1);renderHUD();
  }
 }

 const dead = !G.reviewMode && G.hp<=0;
 const done = !G.reviewMode && !dead && G.hands>=SESSION_HANDS;   // finished the 50-hand session
 const ending = dead || done;
 const quick = ok && !G.isMix && !ending; // pure best → auto advance

 if(quick){ setTimeout(()=>{ if(!G.over) advance(); }, 1000); return; }

 // build detailed feedback panel
 const r=reasonFor(t,hand,correct,choice,ok,grade);
 document.getElementById('fbGrade').textContent=L(grade);
 document.getElementById('fbGrade').style.color=gcolor;
 document.getElementById('fbAns').innerHTML=tr('answerLine',{ans:corrStr,freq:freq,chip:confChip(t)});
 const youLine = ok ? '' : (timedOut ? tr('youTimeout') : tr('youChose',{c:L(nameMap[choice]||'弃牌')}));
 document.getElementById('fbReason').innerHTML=youLine+r;
 const nextBtn=document.getElementById('fbNext');
 nextBtn.textContent = ending ? L('查看结果 →') : L('下一步 →');
 nextBtn.onclick = ()=>{ SFX.click(); if(ending){gameOver(done);} else advance(); };
 document.getElementById('actions').style.display='none';
 document.getElementById('feedback').classList.remove('hide');
}

function advance(){
 if(G.over)return;
 if(G.pendingLevel){
  G.pendingLevel=false;
  SFX.level();showBanner(G.level);burst(innerWidth/2,innerHeight*0.4,['#e8c66a','#b8902f','#fff'],50,9);renderHUD();
  setTimeout(()=>{ if(!G.over) nextHand(); },1500);
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
 '首杀':'😺','连击大师':'🔥','火力全开':'💥','钢铁神经':'🧊','五十手通关':'🏁','GTO 机器':'🤖','完美关卡':'🏆','巨牌漏着':'😱'
};
function award(name,emoji){if(G.ach.has(name))return;G.ach.add(name);toast(name,emoji||ACH_DEFS[name]||'⭐');}
function checkAch(){
 if(G.correct===1)award('首杀');
 if(G.best>=10)award('连击大师');
 if(G.best>=20)award('火力全开');
 if(G.hands>=SESSION_HANDS)award('五十手通关');
 if(G.hands>=40 && G.correct/G.hands>=0.9)award('GTO 机器');
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
 document.getElementById('overScreen').classList.remove('hide');
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
  const _lk=varBoxId==='selVariant'&&proVariant(format,k)&&!isPro();   // 训练选择器里给 Pro 档加锁标（图表免费看）
  b.innerHTML=`${_lk?'🔒 ':''}${L(v.label)}${v.sub?`<small>${L(v.sub)}</small>`:''}`;
  b.setAttribute('aria-selected',k===String(current));
  b.onclick=()=>{aInit();SFX.click();pick(k);
   [...box.children].forEach(x=>{if(x.classList.contains('opt'))x.setAttribute('aria-selected',x===b);});};
  box.appendChild(b);
 });
}

let selFormat='cash', selVariant='6', selDeal='smart', selGame='cash';
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
 buildVariants('selVariant','selVarLabel',f,selVariant,k=>selVariant=k);
}
function applyGame(g,keepFmt,wantVar){
 selGame=g;
 [...document.getElementById('selGame').children].forEach(x=>x.setAttribute('aria-selected',x.dataset.g===g));
 const fmts=GAMETYPES[g].formats;
 [...document.getElementById('selFormat').children].forEach(b=>{b.style.display=fmts.includes(b.dataset.v)?'':'none';});
 document.getElementById('fmtGroup').style.display=fmts.length>1?'':'none'; // 只有一个场景时（如 MTT）隐藏整栏，省去无意义的单选
 if(!keepFmt || !fmts.includes(selFormat)) selFormat=fmts[0];
 startFmtPick(selFormat,wantVar);
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
 if(proVariant(selFormat,selVariant)&&!isPro()){showPaywall(tr('pwWhyPush'));return;}
 G.format=selFormat;G.variant=selVariant;G.handFilter=selDeal;
 persistPrefs();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('overScreen').classList.add('hide');
 newGame();
}
document.getElementById('startBtn').onclick=launch;
document.getElementById('againBtn').onclick=()=>{document.getElementById('startScreen').classList.remove('hide');document.getElementById('overScreen').classList.add('hide');updateReviewBtns();SFX.click();};

// exit mid-game back to the start menu — no resume, so confirm only when a live
// run would be abandoned (matches game-over → 再来一局 behaviour).
function exitToMenu(){
 SFX.click();stopTimer();G.busy=true;G.over=true;
 document.getElementById('feedback').classList.add('hide');
 document.getElementById('verdict').className='verdict';
 document.getElementById('startScreen').classList.remove('hide');
 updateReviewBtns();
}
document.getElementById('exitBtn').onclick=exitToMenu;

// 结束训练（右上角）：结束本局并显示战绩（区别于左上角 ← 直接退回菜单）
function endTraining(){
 if(G.over)return;
 document.getElementById('feedback').classList.add('hide');
 document.getElementById('verdict').className='verdict';
 G.busy=true;
 if(G.reviewMode) reviewComplete(); else gameOver('end');
}
document.getElementById('endBtn').onclick=endTraining;

/* ---- review detail page ---- */
function openReviewDetail(){aInit();SFX.click();
 renderReviewDetail();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('overScreen').classList.add('hide');
 document.getElementById('reviewScreen').classList.remove('hide');
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
document.getElementById('reviewBack').onclick=()=>{SFX.click();
 document.getElementById('reviewScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};

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
function leakDrill(label){SFX.click();document.getElementById('statsScreen').classList.add('hide');startReview(label);}
function renderLeak(){
 const body=document.getElementById('leakBody');
 if(!reviewPile.length){body.innerHTML=`<p class="cnote" style="margin:0">${tr('leakEmpty')}</p>`;return;}
 const types={};Object.keys(LEAK_TYPES).forEach(k=>types[k]=0);let total=0; // 含 passive/aggro 等全部桶
 reviewPile.forEach(r=>{types[classifyMiss(r)]+=r.wrong;total+=r.wrong;});
 const order=Object.keys(types).filter(k=>types[k]>0).sort((a,b)=>types[b]-types[a]);
 const max=Math.max(...order.map(k=>types[k]),1);
 const top=LEAK_TYPES[order[0]];
 let html=`<p class="cnote" style="margin:0 0 9px">${tr('leakTop',{c:top.color,name:L(top.name),n:total})}</p>`;
 html+=order.map(k=>{const T=LEAK_TYPES[k];
  return `<div class="leak-row"><span class="leak-lab">${L(T.name)} · ${L(T.desc)}</span><span class="leak-trk"><i style="width:${Math.round(types[k]/max*100)}%;background:${T.color}"></i></span><span class="leak-n">${types[k]}</span></div>`;}).join('');
 html+=`<div class="leak-sub">${tr('leakWorst')}</div>`;
 [...reviewPile].sort((a,b)=>b.wrong-a.wrong).slice(0,5).forEach(r=>{
  html+=`<div class="leak-hand"><span class="h">${r.hand}</span><span class="sp">${Lparts(r.label)}</span><span class="x">×${r.wrong}</span><button class="leak-drill" data-label="${r.label.replace(/"/g,'&quot;')}">${tr('drill')}</button></div>`;});
 body.innerHTML=html;
 [...body.querySelectorAll('.leak-drill')].forEach(b=>b.onclick=()=>leakDrill(b.dataset.label));
}
/* ---- Phase 6: 个人画像 — 倾向(松/紧) + 准确率 + 强弱位置（全部 vs 参考范围）---- */
function renderProfile(){
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
 let html=`<div class="prof-row"><span class="prof-k">${L('风格倾向')}</span><b style="color:${tcolor}">${tend}</b><span class="prof-d">${tdesc}</span></div>`;
 if(pv+ag>=5){let pt,pd,pc;
  if(pv>=ag*1.6){pt=L('偏被动');pd=tr('profPassive');pc='#7f9cff';}
  else if(ag>=pv*1.6){pt=L('偏激进');pd=tr('profAggro');pc='var(--raise)';}
  else {pt=L('打法均衡');pd=tr('profAggBal');pc='var(--gold)';}
  html+=`<div class="prof-row"><span class="prof-k">${L('打法倾向')}</span><b style="color:${pc}">${pt}</b><span class="prof-d">${pd}</span></div>`;}
 html+=`<div class="prof-row"><span class="prof-k">${L('准确率')}</span><b>${acc}%</b><span class="prof-d">${tr('profCum',{n:th})}</span></div>`;
 const keys=Object.keys(bySpot).filter(k=>bySpot[k].h>=8);
 if(keys.length){const pa=k=>Math.round(bySpot[k].c/bySpot[k].h*100);
  const sorted=keys.slice().sort((a,b)=>pa(b)-pa(a));const best=sorted[0],worst=sorted[sorted.length-1];
  html+=`<div class="prof-row"><span class="prof-k">${L('最强')}</span><b style="color:var(--best)">${Lparts(best)}</b><span class="prof-d">${pa(best)}%</span></div>`;
  if(worst!==best)html+=`<div class="prof-row"><span class="prof-k">${L('最弱')}</span><b style="color:var(--mistake)">${Lparts(worst)}</b><span class="prof-d">${pa(worst)}%</span></div>`;
 }
 html+=`<p class="cnote" style="margin:8px 0 0">${tr('profNote')}</p>`;
 body.innerHTML=html;
}
/* ---- Phase 6: 训练计划 — 按 spot 分组排「最该练」(错得多 + 准确率低)，可一键去练 ---- */
function renderPlan(){
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
 body.innerHTML=html;
 [...body.querySelectorAll('.leak-drill')].forEach(b=>b.onclick=()=>leakDrill(b.dataset.label));
}
function openStats(){aInit();SFX.click();
 renderStats();
 if(isPro()){renderProfile();renderPlan();renderLeak();}
 else proLockStats();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('statsScreen').classList.remove('hide');
}
// 未解锁时，画像/计划/漏洞三块显示「解锁 Pro」占位（基础统计仍免费可见）
function proLockStats(){
 const lock=(id,nameKey)=>{const name=tr(nameKey);const b=document.getElementById(id);if(b)b.innerHTML=
  `<p class="cnote" style="margin:0 0 8px">${tr('pwLockNote',{name})}</p>`
  +`<button class="leak-drill" id="pw_${id}">${tr('unlockPro')}</button>`;
  const btn=document.getElementById('pw_'+id);if(btn)btn.onclick=()=>showPaywall(tr('pwWhyFeature',{name}));};
 lock('profileBody','feat.profile');lock('planBody','feat.plan');lock('leakBody','feat.leak');
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
document.getElementById('statsBack').onclick=()=>{SFX.click();
 document.getElementById('statsScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};
document.getElementById('statsBtn').onclick=openStats;
updateReviewBtns();

/* ============ charts page ============ */
let cFormat='cash', cVariant='6', cIdx=0, cSel=null, cGame='cash';
function renderCChips(){
 const box=document.getElementById('cChips');box.innerHTML='';
 const pack=PACKS[cFormat][cVariant];
 if(cIdx>=pack.length)cIdx=0;
 pack.forEach((t,i)=>{
  const b=document.createElement('button');b.className='cchip';
  b.textContent=L(t.name);b.setAttribute('aria-selected',i===cIdx);
  b.onclick=()=>{cIdx=i;cSel=null;SFX.click();renderCChips();renderMatrix();};
  box.appendChild(b);
 });
}
function renderMatrix(){
 const t=PACKS[cFormat][cVariant][cIdx];
 document.getElementById('cName').textContent=L(t.name);
 document.getElementById('cWho').innerHTML=Lwho(t.who||'')+' '+confChip(t);
 const m=document.getElementById('cMatrix');m.innerHTML='';
 let inC=0;
 for(let r=0;r<13;r++)for(let c=0;c<13;c++){
  const hand=handLabel(r,c),cat=cellCat(t,hand);
  const cell=document.createElement('div');cell.className='ccell '+cat+(r===c?' pair':'');
  cell.innerHTML=`<span>${hand}</span>`;
  if(cat!=='fold')inC+= cat.startsWith('edge') ? combosOf(hand)/2 : combosOf(hand);
  cell.onclick=()=>{cSel=hand;
    document.querySelectorAll('.ccell.sel').forEach(x=>x.classList.remove('sel'));cell.classList.add('sel');
    // precise spots carry real solved frequencies → show them; others stay qualitative (§6 honesty)
    const fq = (t.confidence==='precise' && cat!=='fold') ? ` · <span class="cfreq">${freqText(t,hand)}</span>` : '';
    document.getElementById('cInfo').innerHTML=tr('cCellInfo',{hand,cat:L(catName(cat,t.mode)),fq});};
  m.appendChild(cell);
 }
 document.getElementById('cStat').innerHTML=tr('cPotPct',{p:(inC/1326*100).toFixed(0)});
 // legend
 const leg=document.getElementById('cLegend');leg.innerHTML='';
 const solid={raise:'var(--raise)',shove:'var(--raise)',threebet:'var(--threebet)',call:'var(--call)',fold:'var(--fold)'};
 const edgeBg={'edge-raise':'var(--raise)','edge-shove':'var(--raise)','edge-call':'var(--call)'};
 MODES[t.mode].legend.forEach(([cls,lab])=>{
  const it=document.createElement('div');it.className='it';
  let bg;
  if(cls==='mix') bg='linear-gradient(118deg,var(--threebet) 0 50%,var(--call) 50% 100%)';
  else if(cls.startsWith('edge')) bg=`linear-gradient(118deg,${edgeBg[cls]} 0 50%,var(--fold) 50% 100%)`;
  else bg=solid[cls];
  it.innerHTML=`<span class="sw" style="background:${bg};${cls==='fold'?'box-shadow:inset 0 0 0 1px var(--line)':''}"></span>${L(lab)}`;
  leg.appendChild(it);
 });
 document.getElementById('cInfo').innerHTML=cSel?document.getElementById('cInfo').innerHTML:tr('cChartHint');
}
function chartFmtPick(f){
 cFormat=f; cVariant=defVariant(f); cIdx=0; cSel=null;
 [...document.getElementById('cSelFormat').children].forEach(x=>x.setAttribute('aria-selected',x.dataset.v===f));
 buildVariants('cSelVariant','cSelVarLabel',f,cVariant,k=>{cVariant=k;cIdx=0;cSel=null;renderCChips();renderMatrix();});
 renderCChips();renderMatrix();
}
function applyCGame(g){
 cGame=g;
 [...document.getElementById('cSelGame').children].forEach(x=>x.setAttribute('aria-selected',x.dataset.g===g));
 const fmts=GAMETYPES[g].formats;
 [...document.getElementById('cSelFormat').children].forEach(b=>{b.style.display=fmts.includes(b.dataset.v)?'':'none';});
 document.getElementById('cFmtGroup').style.display=fmts.length>1?'':'none'; // 单场景（MTT）时隐藏场景栏，与首页一致
 if(!fmts.includes(cFormat))cFormat=fmts[0];
 chartFmtPick(cFormat);
}
[...document.getElementById('cSelFormat').children].forEach(b=>b.onclick=()=>{aInit();SFX.click();chartFmtPick(b.dataset.v);});
[...document.getElementById('cSelGame').children].forEach(b=>b.onclick=()=>{aInit();SFX.click();applyCGame(b.dataset.g);});

document.getElementById('chartsBtn').onclick=()=>{aInit();SFX.click();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('chartScreen').classList.remove('hide');
 applyCGame(gameOf(cFormat));};
document.getElementById('chartBack').onclick=()=>{SFX.click();
 document.getElementById('chartScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};
// 导览 / 关于 入口已从首页移除（用户要求精简）。屏幕标记仍保留在 HTML 中（含数据假设说明），
// 只是暂无入口；下面只保留各自的「返回」按钮接线，避免引用已删除的入口按钮导致 null.onclick 崩溃。
document.getElementById('aboutBack').onclick=()=>{SFX.click();
 document.getElementById('aboutScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};
document.getElementById('guideBack').onclick=()=>{SFX.click();
 document.getElementById('guideScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};

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
 },20);
}
function openCalc(){aInit();SFX.click();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('calcScreen').classList.remove('hide');
 updateCalcCounts();
 document.getElementById('calcOut').innerHTML='';
}
document.getElementById('calcBtn').onclick=()=>{ if(!isPro()){showPaywall(tr('pwWhyCalc'));return;} openCalc(); };
document.getElementById('calcBack').onclick=()=>{SFX.click();
 document.getElementById('calcScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};
document.getElementById('calcRun').onclick=runCalc;
document.getElementById('calcBoard').addEventListener('input',updateCalcCounts);
document.getElementById('calcHero').addEventListener('input',updateCalcCounts);
document.getElementById('calcVill').addEventListener('input',updateCalcCounts);
function guideLaunch(fmt,variant){
 selFormat=fmt;
 applyGame(gameOf(fmt),true,variant);
 document.getElementById('guideScreen').classList.add('hide');
 launch();
}
document.querySelectorAll('#guideScreen .gd-node').forEach(node=>{
 node.querySelector('.gd-go').onclick=()=>guideLaunch(node.dataset.fmt,node.dataset.var);
});
document.getElementById('clearDataBtn').onclick=()=>{SFX.click();
 clearStore();reviewPile=[];updateReviewBtns();
 toast(tr('saveCleared'),'🗑',true);
};

/* ---- i18n: re-render dynamic UI after a language switch (called by setLang) ---- */
function rerenderUI(){
 try{
  buildVariants('selVariant','selVarLabel',selFormat,selVariant,k=>selVariant=k);
  buildOpts('selDeal',HANDFILTERS,selDeal,k=>selDeal=k);
  updateReviewBtns();
  const cs=document.getElementById('chartScreen');
  if(cs && !cs.classList.contains('hide')){
   buildVariants('cSelVariant','cSelVarLabel',cFormat,cVariant,k=>{cVariant=k;cIdx=0;cSel=null;renderCChips();renderMatrix();});
   renderCChips(); renderMatrix();
  }
  if(G && G.table && !G.over){
   renderHUD();
   document.getElementById('sceneName').textContent=L(G.table.name);
   document.getElementById('sceneWho').innerHTML=Lwho(G.table.who)+(G.reviewMode?tr('reviewTag'):'')+' '+confChip(G.table);
   buildActions(G.table.mode);
  }
  const ss=document.getElementById('statsScreen');
  if(ss && !ss.classList.contains('hide')){ renderStats(); if(isPro()){renderProfile();renderPlan();renderLeak();}else proLockStats(); }
  const rs=document.getElementById('reviewScreen');
  if(rs && !rs.classList.contains('hide')) renderReviewDetail();
 }catch(e){}
}
// app.js loaded last → DOM + all builders ready; translate static HTML and dynamic UI now.
try{ applyI18n(); }catch(e){}
