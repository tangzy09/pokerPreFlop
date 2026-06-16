/* app.js — persistence, audio, confetti, hand helpers, game engine, charts UI
   and boot. Loads last; depends on ranges.js, modes.js, packs.js. */
/* ============ local persistence (graceful: works locally, no-ops in restricted previews) ============ */
const STORE_KEY='gtoTrainer_v1';
function loadStore(){try{const s=localStorage.getItem(STORE_KEY);return s?JSON.parse(s):{};}catch(e){return {};}}
let STORE=loadStore();
function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(STORE));}catch(e){}}
function persistPrefs(){STORE.prefs={format:selFormat,variant:selVariant,deal:selDeal};persist();}
function clearStore(){STORE={};try{localStorage.removeItem(STORE_KEY);}catch(e){}}

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
 all:{label:'全部',sub:'真实随机',short:'全部'},
 good:{label:'好牌',sub:'价值/标准',short:'好牌'},
 edge:{label:'边缘',sub:'难点·混合',short:'边缘'},
 bad:{label:'坏牌',sub:'练弃牌纪律',short:'坏牌'},
};
const ALL169=(()=>{const a=[];for(let r=0;r<13;r++)for(let c=0;c<13;c++)a.push(handLabel(r,c));return a;})();
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
function pileKey(fmt,v,tname,hand){return fmt+'|'+v+'|'+tname+'|'+hand;}
function addMistake(){
 const key=pileKey(G.format,G.variant,G.table.name,G.hand);
 const ex=reviewPile.find(r=>r.key===key);
 if(ex){ex.wrong++;}
 else reviewPile.push({key,t:G.table,hand:G.hand,fmt:G.format,variant:G.variant,
  label:FORMATS[G.format].tag+' '+VARIANTS[G.format][G.variant].short,wrong:1});
 persistReview();
}
function removeFromPile(rec){const i=reviewPile.indexOf(rec);if(i>=0)reviewPile.splice(i,1);persistReview();}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function serializeReview(){return reviewPile.map(r=>({tn:r.t.name,hand:r.hand,fmt:r.fmt,variant:r.variant,label:r.label,wrong:r.wrong}));}
function persistReview(){STORE.review=serializeReview();persist();}
function reviveReview(arr){
 if(!Array.isArray(arr))return;
 reviewPile=arr.map(r=>{
  const pack=PACKS[r.fmt]&&PACKS[r.fmt][r.variant];
  const t=pack&&pack.find(x=>x.name===r.tn);
  if(!t)return null;
  return {key:pileKey(r.fmt,r.variant,r.tn,r.hand),t,hand:r.hand,fmt:r.fmt,variant:r.variant,label:r.label||'',wrong:r.wrong||1};
 }).filter(Boolean);
}
function updateReviewBtns(){
 const n=reviewPile.length;
 const nav=document.getElementById('reviewBtn');
 if(nav){const lab=nav.querySelector('.lbl');if(lab)lab.textContent=n?`错题(${n})`:'错题';nav.style.opacity=n?'1':'.6';}
 const over=document.getElementById('overReviewBtn');
 if(over){over.textContent=`📕 错题复习堆 (${n})`;over.style.opacity=n?'1':'.45';}
}

function newGame(){
 G.reviewMode=false;
 G.pack=PACKS[G.format][G.variant];
 G.score=0;G.level=1;G.hp=5;G.maxhp=5;G.combo=0;G.best=0;
 G.hands=0;G.correct=0;G.q={best:0,good:0,inacc:0,mistake:0,blunder:0};
 G.fastCorrect=0;G.levelMistakes=0;G.ach=new Set();G.busy=false;G.over=false;
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
 document.getElementById('overTitle').innerHTML=`复习完成 🎉`;
 document.getElementById('overStats').innerHTML=`
  <div class="stat"><div class="v" style="color:var(--best)">${G.reviewCleared}</div><div class="k">本轮清掉</div></div>
  <div class="stat"><div class="v">${reviewPile.length}</div><div class="k">仍待练</div></div>
  <div class="stat"><div class="v">${G.hands}</div><div class="k">复习手数</div></div>
  <div class="stat"><div class="v">${acc}%</div><div class="k">本轮准确率</div></div>`;
 document.getElementById('overAch').innerHTML='';
 updateReviewBtns();
 document.getElementById('overScreen').classList.remove('hide');
}

function renderHUD(){
 const hp=document.getElementById('hp');hp.innerHTML='';
 for(let i=0;i<G.maxhp;i++){const e=document.createElement('i');e.textContent='❤';if(i>=G.hp)e.className='dead';hp.appendChild(e);}
 document.getElementById('score').textContent=G.score.toLocaleString();
 document.getElementById('lvl').textContent = G.reviewMode
  ? '复习模式 · 待清 '+reviewPile.length
  : FORMATS[G.format].tag+' '+VARIANTS[G.format][G.variant].short+' · LV.'+G.level;
 const c=document.getElementById('combo');
 if(G.combo>=2){c.textContent='🔥 '+G.combo+' 连击';c.className='combo show'+(G.combo>=8?' big':'');}
 else c.className='combo';
}

let timerRAF=null,handStart=0,handDur=0;
function startTimer(){
 handDur=Math.max(3500, 9000-(G.level-1)*700);
 handStart=performance.now();
 const bar=document.getElementById('timerBar'),wrap=document.getElementById('timer');
 wrap.classList.remove('warn');
 function tick(now){const el=now-handStart,frac=Math.max(0,1-el/handDur);
  bar.style.width=(frac*100)+'%';
  wrap.classList.toggle('warn',frac<.33);
  if(frac<=0){timeOut();return;}
  timerRAF=requestAnimationFrame(tick);}
 timerRAF=requestAnimationFrame(tick);
}
function stopTimer(){if(timerRAF)cancelAnimationFrame(timerRAF);timerRAF=null;}

function nextHand(){
 if(G.over)return;
 G.busy=false;
 let t,hand;
 if(G.reviewMode){
  if(!G.reviewQueue.length){reviewComplete();return;}
  const rec=G.reviewQueue.shift();G.reviewRec=rec;
  t=rec.t;hand=rec.hand;G.format=rec.fmt;G.variant=rec.variant;
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
 document.getElementById('sceneName').textContent=t.name;
 document.getElementById('sceneWho').textContent=t.who + (G.reviewMode?' · 📕复习':'');
 // cards
 const cardsEl=document.getElementById('cards');cardsEl.innerHTML='';
 const cd=dealCards(hand);
 cd.forEach((card,i)=>{
  const el=document.createElement('div');el.className='card';
  el.innerHTML=`<div class="back"></div>
   <div class="face">
     <span class="rk ${card.c}">${rankFace(card.r)}<br>${card.sym}</span>
     <span class="pip-c ${card.c}">${card.sym}</span>
     <span class="rk br ${card.c}">${rankFace(card.r)}<br>${card.sym}</span>
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
 // timer
 setTimeout(startTimer,260);
}

function buildActions(mode){
 const wrap=document.getElementById('actions');wrap.innerHTML='';
 const opts=MODES[mode].actions;
 wrap.className='actions n'+opts.length;
 opts.forEach(([key,[lab,sub,cls]])=>{
  const b=document.createElement('button');b.className='act '+cls;
  b.innerHTML=`${lab}<small>${sub}</small>`;
  b.onclick=(e)=>choose(key,b,e);
  wrap.appendChild(b);
 });
}

function timeOut(){ if(G.busy)return; stopTimer(); resolve('fold',null,true); }

function choose(choice,btn,e){
 if(G.busy)return;G.busy=true;stopTimer();SFX.click();
 resolve(choice,btn,false);
}

function resolve(choice,btn,timedOut){
 const t=G.table,correct=G.correct_set,hand=G.hand;
 const ok=correct.includes(choice);
 const elapsed=performance.now()-handStart;
 const speedFrac=Math.max(0,1-elapsed/handDur);
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
  if(G.combo>=2 && elapsed<1500 && !timedOut)G.fastCorrect++;
  const mult=Math.min(3,1+G.combo*0.1);
  const spd=timedOut?1:1+speedFrac*0.6;
  if(G.isMix){grade='好棋';gcolor='var(--good)';G.q.good++;pts=Math.round(85*mult*spd);}
  else{grade='最佳';gcolor='var(--best)';G.q.best++;pts=Math.round(100*mult*spd);big=true;}
  G.score+=pts;
  SFX[G.combo>=5?'great':'correct']();buzz(G.combo>=5?[20,40,20]:30);
 } else {
  G.combo=0;G.levelMistakes++;
  const shouldPlay=correct.includes('raise')||correct.includes('call')||correct.includes('shove');
  if(G.isMix){grade='不准';gcolor='var(--inacc)';G.q.inacc++;hpHit=1;}
  else if((shouldPlay&&choice==='fold'&&PREMIUM.has(hand)) || (correct[0]==='fold'&&PREMIUM.has(hand)===false&&choice!=='fold'&&isTrash(hand))){
   grade='漏着';gcolor='var(--blunder)';G.q.blunder++;hpHit=2;
   if(shouldPlay&&choice==='fold'&&PREMIUM.has(hand))award('巨牌漏着','😱');
  } else {grade='失误';gcolor='var(--mistake)';G.q.mistake++;hpHit=1;}
  if(!G.reviewMode)G.hp-=hpHit;
  SFX.wrong();buzz([60,30,60]);
 }

 // mistake pile bookkeeping
 if(G.reviewMode){
  if(ok){removeFromPile(G.reviewRec);G.reviewCleared++;}
  else {G.reviewQueue.push(G.reviewRec);} // drill again this session
  updateReviewBtns();
 } else if(!ok){ addMistake(); updateReviewBtns(); }

 // GTO answer string
 const nameMap=MODES[t.mode].names;
 const corrStr=correct.map(a=>nameMap[a]).join(' / ');
 const freq = G.isEdge ? '（边缘 · 部分频率）' : (G.isMix?'（混合 ~50/50）':'（100%）');

 // center verdict flash
 const v=document.getElementById('verdict');
 document.getElementById('grade').textContent=(timedOut?'超时 · ':'')+grade;
 document.getElementById('grade').style.color=gcolor;
 document.getElementById('tip').innerHTML= ok ? (G.isMix?'边缘混合点':'打得漂亮！') : `应 <b>${corrStr}</b>`;
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
 const quick = ok && !G.isMix && !dead; // pure best → auto advance

 if(quick){ setTimeout(()=>{ if(!G.over) advance(); }, 1000); return; }

 // build detailed feedback panel
 const r=reasonFor(t,hand,correct,choice,ok,grade);
 document.getElementById('fbGrade').textContent=(timedOut?'超时 · ':'')+grade;
 document.getElementById('fbGrade').style.color=gcolor;
 document.getElementById('fbAns').innerHTML=`正确打法：<b>${corrStr}</b> ${freq}`;
 const youLine = ok ? '' : `<span class="you">你选了「${nameMap[choice]||'弃牌'}」 —— 不是最优。</span>`;
 document.getElementById('fbReason').innerHTML=youLine+r;
 const nextBtn=document.getElementById('fbNext');
 nextBtn.textContent = dead ? '查看结果 →' : '下一步 →';
 nextBtn.onclick = ()=>{ SFX.click(); if(dead){gameOver();} else advance(); };
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
 const k=handKind(hand), p=posName(t);
 // edge / mix explanations first
 if(G.isEdge){
  const act = correct.find(a=>a!=='fold');
  const an = {raise:'加注',shove:'全下',call:'跟注'}[act]||'入池';
  return `<b>${hand}</b> 是 ${p} 的<b>边缘混合牌</b>：GTO 把它在「${an}」与「弃牌」之间按频率分配（大致一半一半），两种长期 EV 很接近，所以怎么打都算合理，难以被对手剥削。`;
 }
 if(G.isMix && !G.isEdge){
  return `<b>${hand}</b> 是 ${p} 的<b>混合点</b>：既可作价值/半诈唬反加，也可平跟控池。GTO 按频率混合两者来保持范围平衡，两种打法都对。`;
 }
 // facing a 3-bet: fold / call / 4-bet
 if(t.mode==='face3b'){
  const ip = t.who.includes('有位置');
  if(correct[0]==='raise'){
   const why = (k==='axs'&&!PREMIUM.has(hand))
    ? '用手里的 A 阻断对手的 AA/AKs 等强牌，做带阻断的 4-bet 诈唬'
    : '牌力够强，4-bet 拿价值——让对手用更差的牌跟注或弃掉权益';
   return `<b>${hand}</b> 面对 3-bet 应<b>再加 4-bet</b>：${why}。只平跟会让最强牌少赚、也缺了诈唬平衡。`;
  }
  if(correct[0]==='call'){
   return `<b>${hand}</b> 面对 3-bet 适合<b>跟注</b>防守：${ip?'你有位置、翻后能最后行动，平跟续战很舒服':'虽无位置，但这手仍强到值得跟注'}；不到 4-bet 的强度，弃掉又太亏。`;
  }
  return `<b>${hand}</b> 面对 3-bet 应<b>弃牌</b>：不足以 4-bet，跟注后翻前已投入不少、翻后又难打，长期为负。${ip?'':'无位置时更要收紧。'}`;
 }
 // facing a 4-bet: fold / call / 5-bet jam
 if(t.mode==='face4b'){
  if(correct.includes('shove')){
   const why = (k==='axs'&&!PREMIUM.has(hand)) ? '用 A 阻断对手的 AA/AKs，做带阻断的诈唬全下' : '顶级牌力，100bb 下 5-bet 直接全下拿最大价值';
   return `<b>${hand}</b> 面对 4-bet 应<b>5-bet 全下</b>：${why}。这么深的投入后，平跟反而难打、还暴露牌力。`;
  }
  if(correct[0]==='call'){
   return `<b>${hand}</b> 面对 4-bet 可<b>跟注</b>续战：牌力够强、又有位置控池，但不到全下的强度，跟注保留对手的诈唬 4bet。`;
  }
  return `<b>${hand}</b> 面对 4-bet 应<b>弃牌</b>：你的 3-bet 多半是诈唬/施压，对手 4-bet 表达了强范围，这手没有继续的价值，干净放掉。`;
 }
 // squeeze: fold / call / squeeze(3-bet over an open + caller)
 if(t.mode==='squeeze'){
  const ip = t.who.includes('有位置');
  if(correct[0]==='raise'){
   const why = (k==='axs'&&!PREMIUM.has(hand)) ? '用阻断牌做诈唬挤压，吞掉底池里的死钱' : '价值够强，挤压把开局者和跟注者一起施压、收割他们投入的筹码';
   return `<b>${hand}</b> 适合<b>挤压 3-bet</b>：${why}。有跟注者在，底池死钱多、挤压回报更高；平跟会让多人底池失控。`;
  }
  if(correct[0]==='call'){
   return `<b>${hand}</b> 适合<b>跟注</b>（overcall）：${ip?'有位置、可低成本搏多人底池的中花/顺子/暗三':'适合凑set/同花的投机牌，多人底池摊牌价值高'}；不够强到挤压，但弃了可惜。`;
  }
  return `<b>${hand}</b> 应当<b>弃牌</b>：多人底池里这手既不够价值挤压，也缺乏多人摊牌的潜力，放掉最稳。`;
 }
 // pure spots
 const isShove=correct[0]==='shove', is3=correct[0]==='raise'&&t.mode==='defense';
 if(correct[0]==='raise'||isShove){
  const verb=isShove?'全下':'加注';
  const why={
   pair:`口袋对子本身有摊牌价值，${verb}能建立底池主动权。`,
   axs:`同花 A 有坚果同花潜力，且手握 A 阻断对手的强 A 组合，${verb}价值很高。`,
   axo:`A 高牌 + 偷盲价值，在 ${p} ${verb}长期有利可图。`,
   bws:`两张高张且同花，牌力强又好打后续，标准${verb}。`,
   bwo:`两张高张牌力够强，${verb}建立价值。`,
   sc:`同花连子有顺子+同花潜力，${verb}兼顾价值与可玩性。`,
   sg:`同花有一定潜力，${p} 位置靠后可以${verb}施压。`,
   off:`在 ${p} 这手有足够的偷盲/价值，${verb}为正期望。`
  }[k];
  return `<b>${hand}</b> 在 ${p} 应当${verb}：${why}`;
 }
 if(is3){
  return `<b>${hand}</b> 适合<b>反加 3-bet</b>：要么价值够强压制开局者，要么用阻断牌做诈唬。平跟会让强牌少赚、也让范围失衡。`;
 }
 if(correct[0]==='call'){
  return `<b>${hand}</b> 适合<b>跟注</b>防守：牌力/潜力够入池，但不强到反加。平跟能保留对手的诈唬范围、压低方差，又能看翻牌。`;
 }
 // fold
 const whyFold={
  off:`不同花、缺乏顺花潜力，容易被同名更强的牌支配。`,
  axo:`不同花的弱 A 在 ${p} 易被压制，入池价值不足。`,
  sg:`同花但太散，在 ${p} 实现率不够。`,
  sc:`潜力虽有，但 ${p} 身后人数多，长期入池仍为负。`,
 }[k] || `在 ${p} 这手牌力/潜力不足，身后还有人能反打，长期入池为负期望。`;
 return `<b>${hand}</b> 应当<b>弃牌</b>：${whyFold}干净放掉、等更好的位置或牌。`;
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
 '首杀':'😺','连击大师':'🔥','火力全开':'💥','钢铁神经':'🧊','百手老手':'🎯','GTO 机器':'🤖','完美关卡':'🏆','巨牌漏着':'😱'
};
function award(name,emoji){if(G.ach.has(name))return;G.ach.add(name);toast(name,emoji||ACH_DEFS[name]||'⭐');}
function checkAch(){
 if(G.correct===1)award('首杀');
 if(G.best>=10)award('连击大师');
 if(G.best>=20)award('火力全开');
 if(G.fastCorrect>=5)award('钢铁神经');
 if(G.hands>=100)award('百手老手');
 if(G.hands>=40 && G.correct/G.hands>=0.9)award('GTO 机器');
}
let toastT=null;
function toast(name,emoji,plain){const e=document.getElementById('toastEl')||(()=>{const d=document.createElement('div');d.className='toast';d.id='toastEl';document.body.appendChild(d);return d;})();
 e.innerHTML=`<span class="em">${emoji}</span> ${plain?'':'成就达成 · '}${name}`;e.classList.add('show');
 clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),2200);}

/* ============ game over ============ */
function gameOver(){
 G.over=true;stopTimer();SFX.over();
 const acc=G.hands?Math.round(G.correct/G.hands*100):0;
 // lifetime stats
 const st=STORE.stats||{best:0,hands:0,correct:0,games:0};
 const isRecord=G.score>(st.best||0);
 st.best=Math.max(st.best||0,G.score);
 st.hands=(st.hands||0)+G.hands; st.correct=(st.correct||0)+G.correct; st.games=(st.games||0)+1;
 STORE.stats=st; persist();
 document.getElementById('overTitle').innerHTML=`得分 <b style="color:var(--gold)">${G.score.toLocaleString()}</b>`+(isRecord&&G.score>0?` <span style="font-size:13px;color:var(--best)">🏅新纪录!</span>`:'');
 const s=document.getElementById('overStats');
 s.innerHTML=`
  <div class="stat"><div class="v">${acc}%</div><div class="k">GTO 准确率</div></div>
  <div class="stat"><div class="v">${G.best}</div><div class="k">最高连击</div></div>
  <div class="stat"><div class="v">${G.hands}</div><div class="k">总手数</div></div>
  <div class="stat"><div class="v">LV.${G.level}</div><div class="k">到达关卡</div></div>
  <div class="stat"><div class="v" style="color:var(--best)">${G.q.best+G.q.good}</div><div class="k">最佳+好棋</div></div>
  <div class="stat"><div class="v" style="color:var(--gold)">${(st.best||0).toLocaleString()}</div><div class="k">历史最高</div></div>`;
 const a=document.getElementById('overAch');a.innerHTML='';
 [...G.ach].forEach(n=>{const e=document.createElement('span');e.className='ach';e.textContent=(ACH_DEFS[n]||'⭐')+' '+n;a.appendChild(e);});
 updateReviewBtns();
 document.getElementById('overScreen').classList.remove('hide');
}

/* ============ boot ============ */
function defVariant(f){return f==='cash'?'6':f==='mtt'?'d40':f==='face3b'?'btn':f==='face4b'?'ip':f==='squeeze'?'bb':f==='coldcall'?'btn':'btn';}
function buildVariants(varBoxId,varLabelId,format,current,pick){
 document.getElementById(varLabelId).textContent=VARIANT_LABEL[format];
 const box=document.getElementById(varBoxId);box.innerHTML='';
 Object.entries(VARIANTS[format]).forEach(([k,v])=>{
  const b=document.createElement('button');b.className='opt';b.dataset.v=k;
  b.innerHTML=`${v.label}<small>${v.sub}</small>`;
  b.setAttribute('aria-selected',k===String(current));
  b.onclick=()=>{aInit();SFX.click();pick(k);
   [...box.children].forEach(x=>x.setAttribute('aria-selected',x===b));};
  box.appendChild(b);
 });
}

let selFormat='cash', selVariant='6', selDeal='all', selGame='cash';
function buildOpts(boxId,cfg,current,pick){
 const box=document.getElementById(boxId);box.innerHTML='';
 Object.entries(cfg).forEach(([k,v])=>{
  const b=document.createElement('button');b.className='opt';b.dataset.v=k;
  b.innerHTML=`${v.label}<small>${v.sub}</small>`;
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
 if(!keepFmt || !fmts.includes(selFormat)) selFormat=fmts[0];
 startFmtPick(selFormat,wantVar);
}
[...document.getElementById('selFormat').children].forEach(b=>b.onclick=()=>{aInit();SFX.click();startFmtPick(b.dataset.v);});
[...document.getElementById('selGame').children].forEach(b=>b.onclick=()=>{aInit();SFX.click();applyGame(b.dataset.g,false);});

// restore saved preferences + mistake pile
const _p=STORE.prefs||{};
selDeal = (_p.deal && HANDFILTERS[_p.deal]) ? _p.deal : 'all';
const _savedFmt = (_p.format && VARIANTS[_p.format]) ? _p.format : 'cash';
const _savedVar = (_p.variant && VARIANTS[_savedFmt][_p.variant]) ? _p.variant : null;
selFormat=_savedFmt;
applyGame(gameOf(_savedFmt),true,_savedVar);
buildOpts('selDeal',HANDFILTERS,selDeal,k=>selDeal=k);
reviveReview(STORE.review);
updateReviewBtns();

function launch(){
 aInit();SFX.click();
 G.format=selFormat;G.variant=selVariant;G.handFilter=selDeal;
 persistPrefs();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('overScreen').classList.add('hide');
 newGame();
}
document.getElementById('startBtn').onclick=launch;
document.getElementById('againBtn').onclick=()=>{document.getElementById('startScreen').classList.remove('hide');document.getElementById('overScreen').classList.add('hide');updateReviewBtns();SFX.click();};

/* ---- review detail page ---- */
function openReviewDetail(){aInit();SFX.click();
 renderReviewDetail();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('overScreen').classList.add('hide');
 document.getElementById('reviewScreen').classList.remove('hide');
}
function renderReviewDetail(){
 const allBtn=document.getElementById('reviewAllBtn');
 allBtn.textContent=`▶ 开始复习全部 (${reviewPile.length})`;
 allBtn.style.opacity=reviewPile.length?'1':'.45';
 const box=document.getElementById('reviewList');box.innerHTML='';
 if(!reviewPile.length){box.innerHTML='<p class="cnote" style="margin-top:20px">错题堆是空的——去训练答错的牌会自动收进来喵 🐿</p>';return;}
 // group by label (spot)
 const groups={};
 reviewPile.forEach(r=>{(groups[r.label]=groups[r.label]||[]).push(r);});
 Object.keys(groups).forEach(label=>{
  const arr=groups[label];
  const g=document.createElement('div');g.className='rv-group';
  const head=document.createElement('div');head.className='rv-head';
  head.innerHTML=`<b>${label||'其他'}</b>`;
  const mini=document.createElement('button');mini.className='rv-mini';mini.textContent=`练这组 (${arr.length}) ▶`;
  mini.onclick=()=>startReview(label);
  head.appendChild(mini);g.appendChild(head);
  const chips=document.createElement('div');chips.className='rv-chips';
  arr.forEach(r=>{
   const c=document.createElement('span');c.className='rv-chip';
   c.innerHTML=`${r.hand}${r.wrong>1?` <span class="wn">×${r.wrong}</span>`:''} <span class="del">✕</span>`;
   c.querySelector('.del').onclick=()=>{removeFromPile(r);renderReviewDetail();updateReviewBtns();SFX.click();};
   chips.appendChild(c);
  });
  g.appendChild(chips);box.appendChild(g);
 });
}
document.getElementById('reviewBtn').onclick=openReviewDetail;
document.getElementById('overReviewBtn').onclick=openReviewDetail;
document.getElementById('reviewAllBtn').onclick=()=>{ if(!reviewPile.length){toast('错题堆是空的','📕',true);return;} startReview(); };
document.getElementById('reviewBack').onclick=()=>{SFX.click();
 document.getElementById('reviewScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};

/* ---- career stats page ---- */
function openStats(){aInit();SFX.click();
 renderStats();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('statsScreen').classList.remove('hide');
}
function renderStats(){
 const st=STORE.stats||{};const bySpot=STORE.statsBySpot||{};
 let th=0,tc=0;Object.values(bySpot).forEach(e=>{th+=e.h;tc+=e.c;});
 const acc=th?Math.round(tc/th*100):0;
 document.getElementById('statsTiles').innerHTML=`
  <div class="stat"><div class="v" style="color:var(--gold)">${(st.best||0).toLocaleString()}</div><div class="k">历史最高分</div></div>
  <div class="stat"><div class="v">${th}</div><div class="k">累计手数</div></div>
  <div class="stat"><div class="v">${acc}%</div><div class="k">总体准确率</div></div>
  <div class="stat"><div class="v">${st.games||0}</div><div class="k">总局数</div></div>`;
 const bars=document.getElementById('statsBars');bars.innerHTML='';
 const keys=Object.keys(bySpot).sort((a,b)=>(bySpot[b].c/bySpot[b].h)-(bySpot[a].c/bySpot[a].h));
 if(!keys.length){bars.innerHTML='<p class="cnote">还没有数据——先去训练几手喵</p>';return;}
 keys.forEach(k=>{const e=bySpot[k];const p=e.h?Math.round(e.c/e.h*100):0;
  const row=document.createElement('div');row.className='sbar';
  row.innerHTML=`<span class="nm" title="${k}">${k}</span><span class="trk"><span class="fil" style="width:${p}%"></span></span><span class="pct">${p}% · ${e.h}手</span>`;
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
  b.textContent=t.name;b.setAttribute('aria-selected',i===cIdx);
  b.onclick=()=>{cIdx=i;cSel=null;SFX.click();renderCChips();renderMatrix();};
  box.appendChild(b);
 });
}
function renderMatrix(){
 const t=PACKS[cFormat][cVariant][cIdx];
 document.getElementById('cName').textContent=t.name;
 document.getElementById('cWho').textContent=t.who||'';
 const m=document.getElementById('cMatrix');m.innerHTML='';
 let inC=0;
 for(let r=0;r<13;r++)for(let c=0;c<13;c++){
  const hand=handLabel(r,c),cat=cellCat(t,hand);
  const cell=document.createElement('div');cell.className='ccell '+cat+(r===c?' pair':'');
  cell.innerHTML=`<span>${hand}</span>`;
  if(cat!=='fold')inC+= cat.startsWith('edge') ? combosOf(hand)/2 : combosOf(hand);
  cell.onclick=()=>{cSel=hand;
    document.querySelectorAll('.ccell.sel').forEach(x=>x.classList.remove('sel'));cell.classList.add('sel');
    document.getElementById('cInfo').innerHTML=`<b>${hand}</b> · ${catName(cat,t.mode)}`;};
  m.appendChild(cell);
 }
 document.getElementById('cStat').innerHTML=`入池 <b>${(inC/1326*100).toFixed(0)}%</b>`;
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
  it.innerHTML=`<span class="sw" style="background:${bg};${cls==='fold'?'box-shadow:inset 0 0 0 1px var(--line)':''}"></span>${lab}`;
  leg.appendChild(it);
 });
 document.getElementById('cInfo').innerHTML=cSel?document.getElementById('cInfo').innerHTML:'点格子查看每手牌的建议';
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
document.getElementById('aboutBtn').onclick=()=>{aInit();SFX.click();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('aboutScreen').classList.remove('hide');};
document.getElementById('aboutBack').onclick=()=>{SFX.click();
 document.getElementById('aboutScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};
document.getElementById('guideBtn').onclick=()=>{aInit();SFX.click();
 document.getElementById('startScreen').classList.add('hide');
 document.getElementById('guideScreen').classList.remove('hide');};
document.getElementById('guideBack').onclick=()=>{SFX.click();
 document.getElementById('guideScreen').classList.add('hide');
 document.getElementById('startScreen').classList.remove('hide');};
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
 toast('本地存档已清除','🗑',true);
};
