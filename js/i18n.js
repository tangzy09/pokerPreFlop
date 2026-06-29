/* i18n.js — bilingual layer (English default + 中文), zero-build, loads FIRST.
   Design: the DATA files (ranges/modes/packs) stay Chinese = the canonical source.
   We translate only at DISPLAY:
     L("中文")        → English when LANG==='en', the original Chinese when 'zh'
                         (lookup by Chinese source; unknown strings fall back to zh)
     t(key, vars)     → keyed bilingual template (for inline-<b> prose / HTML blocks),
                         {var} interpolation; reproduces the original Chinese in zh mode
     applyI18n(root)  → walks static HTML: data-i18n-html keyed blocks + simple text nodes
   A floating 🌐 toggle flips the language and persists it. */

const I18N_DEFAULT = 'en';
function _i18nRead(){ try{ const s=localStorage.getItem('gtoLang'); return (s==='zh'||s==='en')?s:I18N_DEFAULT; }catch(e){ return I18N_DEFAULT; } }
let LANG = _i18nRead();
function curLang(){ return LANG; }

/* ---- flat map: Chinese source → English (zh mode = identity) ---- */
const I18N_EN = {
 // —— HUD / controls ——
 '退出训练':'Exit training','结束训练 · 查看战绩':'End training · view results','结束':'End',
 '复习模式':'Review mode','下一步 →':'Next →','查看结果 →':'See result →',
 // —— nav ——
 '错题':'Mistakes','图表':'Charts','算胜率':'Equity','统计':'Stats',
 // —— start screen ——
 'GTO 翻前对战 · 训练营':'GTO Preflop · Trainer','GTO 翻前':'GTO Preflop ','训练':'Training',
 '游戏类型':'Game type','场景':'Scenario','开始训练':'Start Training','位置':'Position','筹码深度 (bb)':'Stack depth (bb)','前注':'Ante',
 '现金局':'Cash','100bb 深码':'100bb deep','锦标赛 MTT':'Tournament MTT','浅码 + ICM':'Short stacks + ICM',
 '锦标赛':'Tournament','推弃 + ICM':'Push/fold + ICM','错题复习':'Mistakes','复习答错的牌':'Review your misses','Nash 推弃图':'Nash Charts','每手 EV':'Per-hand EV','实时算牌':'Live equity','画像 + 漏洞':'Profile + leaks',
 '训练计划':'Training Plan','诊断 + 20 天':'Diagnosis + 20 days','实力诊断':'Strength Test',
 '开局 + 防守':'Open + Defense','开局加注 · 大盲防守':'RFI · BB defense',
 '开局范围':'Open ranges','按深度 / 人数':'By depth / players',
 '面对 3-bet':'Vs 3-bet','你开局被反加':'You open, get 3-bet',
 '面对 4-bet':'Vs 4-bet','你 3bet 被 4bet':'You 3-bet, get 4-bet',
 '挤压':'Squeeze','有人开+跟 · 你反加':'Open + call · you re-raise',
 '冷跟':'Cold-call','非盲位平跟入池':'Flat from non-blind',
 '⚙ 进阶设置 · 发牌偏好':'⚙ Advanced · deal preference','发牌偏好':'Deal preference','· 练哪类牌':'· which hands',
 // —— deal filters (HANDFILTERS) ——
 '智能':'Smart','弱项优先·系统覆盖':'Weak spots first · full coverage',
 '全部':'All','真实随机':'True random','好牌':'Good','价值/标准':'Value / standard',
 '边缘':'Edge','难点·混合':'Tough · mixed','坏牌':'Trash','练弃牌纪律':'Fold discipline',
 // —— over / common ——
 'OUT · 出局':'OUT · busted','本局结束':'Game over','再来一局':'Play again','← 返回':'← Back','← 主页':'← Home',
 '范围图表':'Range charts','关于数据与假设':'About data & assumptions','胜率计算器':'Equity calculator',
 '翻前主线 · 怎么练':'Preflop main line · how to train','错题复习堆':'Mistake review pile','生涯统计':'Career stats',
 '场景 / 位置':'Scenario / position','点格子查看每手牌的建议':'Tap a cell to see the suggestion',
 '🎯 个人画像':'🎯 Profile','🗓 训练计划':'🗓 Training plan','🔍 你的漏洞':'🔍 Your leaks','📊 各档位准确率':'📊 Accuracy by spot',
 // —— calc ——
 '牌面':'Board','你的范围':'Your range','对手范围':'Opp range','对战':'vs','计算胜率':'Run equity','· 留空=翻前':'· empty = preflop',
 '翻牌':'Flop','转牌':'Turn','河牌':'River','你':'You','对手':'Opp','翻后胜率':'Postflop equity','范围优势':'Range advantage',
 '两边几乎五五开':'roughly a coin flip','· ⚠ 写法待修正':'· ⚠ check format',
 // —— about h3 (leaf) ——
 '✅ 这是什么':'✅ What this is','⚠️ 这不是什么':"⚠️ What this isn't",'📐 假设条件':'📐 Assumptions',
 '🔍 范围怎么来的':'🔍 Where the ranges come from','🎯 真要精确？':'🎯 Need real precision?',
 // —— guide h3 (leaf) ——
 '🧭 翻前是一棵决策树':'🧭 Preflop is a decision tree','🌿 其他常见局面':'🌿 Other common spots',
 '📚 建议顺序':'📚 Suggested order','💾 本地存档':'💾 Local save','练 →':'Train →','🗑 清除本地存档':'🗑 Clear local save',
 // —— grades / verdict ——
 '最佳':'Best','好棋':'Good','两可':'Either OK','不准':'Inaccurate','失误':'Mistake','漏着':'Blunder','超时':'Timeout',
 '边缘混合点':'edge / mix point','打得漂亮！':'Nicely played!',
 // —— action display names (MODES.names / ACT_LABEL) ——
 '弃牌':'Fold','加注':'Raise','全下':'All-in','跟注':'Call','跟注全下':'Call all-in','入池':'Enter','3-bet':'3-bet','4-bet':'4-bet',
 '挤压 3-bet':'Squeeze','5-bet 全下':'5-bet all-in','反加 3-bet':'3-bet','加注开局':'Open raise','再加 4-bet':'4-bet',
 // —— chart category names (CAT_NAME / catName overrides) ——
 '混合':'Mixed','3-bet / 跟注（混合）':'3-bet / call (mixed)','加注 / 弃牌（边缘混合）':'Raise / fold (edge)',
 '全下 / 弃牌（边缘混合）':'All-in / fold (edge)','跟注 / 弃牌（边缘混合）':'Call / fold (edge)',
 '4-bet / 跟注（混合）':'4-bet / call (mixed)','挤压 / 跟注（混合）':'Squeeze / call (mixed)','5-bet全下 / 跟注（混合）':'5-bet / call (mixed)',
 // —— confidence chip ——
 '精准':'Exact','Nash 博弈论最优':'Nash GTO','手搓参考':'Curated',
 '本工具 equity+Nash 求解器计算所得（非手搓）；属简化模型（无前注 / no-overcall / 类级 equity）的近似解，非真实牌桌精确——可剥削度见来源':
  'Computed by this app’s own equity + Nash solver (not hand-picked); a simplified-model approximation (no ante / no-overcall / class-level equity), not table-exact — see exploitability in the source',
 '参考公开图表手工整理，核对过量级/形状；混合频率为占位，非 solver 精确':
  'Hand-curated from public charts, magnitude/shape checked; mix frequencies are placeholders, not solver-exact',
 // —— stats / over labels ——
 'GTO 准确率':'GTO accuracy','最高连击':'Best combo','总手数':'Total hands','到达关卡':'Level reached','最佳+好棋':'Best + good',
 '历史最高':'All-time best','历史最高分':'All-time high','累计手数':'Hands played','总体准确率':'Overall accuracy','总局数':'Games',
 '本轮清掉':'Cleared this round','仍待练':'Still to drill','复习手数':'Review hands','本轮准确率':'Round accuracy',
 '风格倾向':'Style','打法倾向':'Aggression','准确率':'Accuracy','最强':'Best','最弱':'Worst',
 '待定':'TBD','偏松':'Loose','偏紧':'Tight','较均衡':'Balanced','偏被动':'Passive','偏激进':'Aggressive','打法均衡':'Balanced',
 // —— leak types ——
 '太松':'Too loose','该弃却入池':'play hands you should fold','太紧':'Too tight','该入却弃·漏价值':'fold hands you should play · missed value',
 '被动':'Passive','该加注却只跟注':'just call when you should raise','过激':'Over-aggressive','该跟注却加注/全下':'raise/jam when you should call',
 '边缘混合':'Edge / mix','难点·没把握':'tough · unsure','ICM 保命':'ICM survival','泡沫期收紧':'tighten on the bubble',
 // —— misc dynamic ——
 '其他':'Other','前注底池':'Ante pot',
 // —— FORMATS.tag ——
 '现金':'Cash','MTT':'MTT','面3bet':'Vs3B','面4bet':'Vs4B','挤压':'Squeeze','冷跟':'Cold',
 // —— VARIANTS.short ——
 '单挑':'HU','6人':'6max','9人':'9max',
 '9人40bb':'9max 40bb','9人25bb':'9max 25bb','9人15bb':'9max 15bb',
 '9人8bb推':'9max 8bb jam','9人推弃':'9max jam','9人12bb推':'9max 12bb jam','9人15bb推':'9max 15bb jam','9人20bb推':'9max 20bb jam',
 '9人跟10':'9max call10','9人跟15':'9max call15','9人跟20':'9max call20',
 '6人推10':'6max jam10','6人推15':'6max jam15','6人推20':'6max jam20',
 'HU5bb':'HU 5bb','HU8bb':'HU 8bb','HU10bb':'HU 10bb','HU12bb':'HU 12bb','HU15bb':'HU 15bb','HU20bb':'HU 20bb','HU25bb':'HU 25bb',
 '9人ICM':'9max ICM','6人40bb':'6max 40bb','6人20bb':'6max 20bb',
 '开BTN':'Open BTN','开CO':'Open CO','开前位':'Open EP','IP':'IP','OOP':'OOP','BB挤':'BB sqz','BTN挤':'BTN sqz','BTN跟':'BTN call','CO跟':'CO call',
 // —— VARIANT_LABEL ——
 '牌桌人数':'Players','盲数 / 阶段':'Stack / stage','你的开局位置':'Your open position','你 3-bet 的位置':'Your 3-bet position',
 '你挤压的位置':'Your squeeze position','你的位置':'Your position',
 // —— VARIANTS.label ——
 '单挑 2人':'Heads-up (2)','6人桌':'6-max','9人桌':'9-max',
 '40bb':'40bb','25bb':'25bb','15bb':'15bb','8bb':'8bb','10bb':'10bb','12bb':'12bb','20bb':'20bb','5bb':'5bb',
 '泡沫 ICM':'Bubble ICM','40bb · 6人':'40bb · 6max','20bb · 6人':'20bb · 6max',
 '你开 BTN':'You open BTN','你开 CO':'You open CO','你开 前位':'You open EP',
 '你有位置 3bet':'IP 3-bet','你无位置 3bet':'OOP 3-bet','你在大盲挤压':'Squeeze from BB','你在按钮挤压':'Squeeze from BTN',
 '你在 BTN':'You on BTN','你在 CO':'You on CO',
 // —— VARIANTS.sub ——
 '2 人':'2 players','常规':'standard','满员':'full ring',
 '深码·前注':'deep · ante','中码·缩尺度':'mid · smaller sizing','浅码·转推弃前':'short · pre jam/fold',
 '极浅':'very short','很浅':'short','偏浅':'shortish','中等':'medium','较深':'deeper','保命收紧':'survival tight','终桌短手':'final table','终桌浅码':'final table short',
 '有位置·防守宽':'IP · defend wide','有/无位置混合':'IP/OOP mix','很紧·4bet或弃':'tight · 4-bet or fold',
 '被4bet·可跟可弃':'vs 4-bet · call or fold','被4bet·全下或弃':'vs 4-bet · jam or fold',
 '无位置·偏价值':'OOP · value-heavy','有位置·更宽':'IP · wider','有位置·可宽跟':'IP · call wide','身后有人·偏紧':'players behind · tight',
 // —— VARIANTS.group ——
 'RFI 开局 · 9人（40/25/15bb）':'RFI open · 9-max (40/25/15bb)','推弃 · 9人':'Jam/fold · 9-max','面对全下 · 9人BB 跟 BTN':'Vs jam · 9-max BB calls BTN',
 '推弃 · 6人终桌':'Jam/fold · 6-max FT','单挑 HU · SB全下+BB跟':'Heads-up · SB jam + BB call','特殊场景':'Special spots',
 // —— spot names (t.name) ——
 'UTG · 枪口位':'UTG · early','MP · 中位':'MP · middle','CO · 关煞位':'CO · cutoff','BTN · 按钮位':'BTN · button','SB · 小盲位':'SB · small blind','HJ · 劫机位':'HJ · hijack',
 'UTG 全下/弃':'UTG jam/fold','MP 全下/弃':'MP jam/fold','CO 全下/弃':'CO jam/fold','BTN 全下/弃':'BTN jam/fold','SB 全下/弃':'SB jam/fold','HJ 全下/弃':'HJ jam/fold',
 'BB 跟注/弃':'BB call/fold','BB 跟注/弃 vs BTN':'BB call/fold vs BTN',
 '开 BTN，BB 反加':'Open BTN, BB 3-bets','开 BTN，SB 反加':'Open BTN, SB 3-bets','开 CO，BTN 反加':'Open CO, BTN 3-bets','开 CO，BB 反加':'Open CO, BB 3-bets','开 前位，被反加':'Open EP, get 3-bet',
 '你 BTN 3bet 被 4bet':'Your BTN 3-bet gets 4-bet','你盲位 3bet 被 4bet':'Your blind 3-bet gets 4-bet',
 '大盲挤压':'BB squeeze','按钮挤压':'BTN squeeze',
 'BTN 冷跟 vs CO':'BTN cold-call vs CO','BTN 冷跟 vs UTG':'BTN cold-call vs UTG','CO 冷跟 vs UTG':'CO cold-call vs UTG',
 // —— who-string segments (split on " · ") ——
 '你先开局':'you open first','最早位开局':'earliest position opens','仅剩大盲':'only BB left','大盲防守':'BB defense',
 '按钮位开局':'BTN opens','关煞位开局':'CO opens','枪口位开局':'UTG opens','你在按钮先行动':'you act first on the button',
 '40bb 前注':'40bb · ante','25bb 中码':'25bb · mid','15bb 浅码':'15bb · short',
 '全下或弃':'jam or fold','SB 全下或弃':'SB jam or fold','面对 SB 全下':'vs SB jam','面对 BTN 全下':'vs BTN jam',
 '泡沫期 ~20bb':'bubble ~20bb','保命收紧':'survival tight','可施压':'can pressure',
 '终桌/短手':'final table / short','终桌浅码':'final table short',
 '你有位置':'in position','你无位置':'out of position','有位置':'in position','无位置':'out of position','范围已很强':'range already strong','对手范围强':'opponent range strong','身后还有人（挤压风险）':'players behind (squeeze risk)',
 '你 BTN 开局 → 大盲 3-bet':'you open BTN → BB 3-bets','你 BTN 开局 → 小盲 3-bet':'you open BTN → SB 3-bets',
 '你 CO 开局 → 按钮位 3-bet':'you open CO → BTN 3-bets','你 CO 开局 → 大盲 3-bet':'you open CO → BB 3-bets','你 UTG/HJ 开局 → 被 3-bet':'you open UTG/HJ → 3-bet',
 '你按钮位 3-bet → 对手 4-bet':'your BTN 3-bet → 4-bet','你盲位 3-bet → 对手 4-bet':'your blind 3-bet → 4-bet',
 '前位开局 + 有人跟注 → 你在大盲':'EP opens + caller → you in BB','前位开局 + 有人跟注 → 你在按钮':'EP opens + caller → you on BTN',
 'CO 开局 → 你在按钮':'CO opens → you on BTN','UTG 开局 → 你在按钮':'UTG opens → you on BTN','UTG 开局 → 你在 CO':'UTG opens → you in CO',
};

/* ---- keyed bilingual templates (interpolated / inline-HTML prose) ---- */
const I18N_TPL = { zh:{}, en:{} };
function _tpl(key, zh, en){ I18N_TPL.zh[key]=zh; I18N_TPL.en[key]=en; }

// review / pile
_tpl('reviewBtnN', '错题({n})', 'Mistakes ({n})');
_tpl('overReview', '📕 错题复习堆 ({n})', '📕 Review pile ({n})');
_tpl('pendClear', '待清 {n}', '{n} to clear');
_tpl('lvlLine', 'LV.{lv} · {hand}/{total}', 'LV.{lv} · {hand}/{total}');
_tpl('combo', '🔥 {n} 连击', '🔥 {n} combo');
_tpl('reviewDone', '复习完成 🎉', 'Review complete 🎉');
_tpl('reviewAll', '▶ 开始复习全部 ({n})', '▶ Review all ({n})');
_tpl('drillGroup', '练这组 ({n}) ▶', 'Drill this group ({n}) ▶');
_tpl('pileEmpty', '错题堆是空的——去训练答错的牌会自动收进来喵 🐿', 'Your pile is empty — hands you miss in training land here automatically, nya 🐿');
_tpl('pileEmptyToast', '错题堆是空的', 'Pile is empty');
_tpl('chipMaster', '✓{s}/{m}', '✓{s}/{m}');
// scene
_tpl('reviewTag', ' · 📕复习', ' · 📕 review');
// verdict / feedback
_tpl('mixTop', '主频线 {act} {pct}%', 'Top line: {act} {pct}%');
_tpl('shouldBe', '应 <b>{ans}</b>', 'Should be <b>{ans}</b>');
_tpl('answerLine', '正确打法：<b>{ans}</b> {freq} {chip}', 'Correct play: <b>{ans}</b> {freq} {chip}');
_tpl('youTimeout', '<span class="you">超时未操作 —— 本手作废喵～</span>', '<span class="you">No action in time — this hand is void, nya~</span>');
_tpl('youChose', '<span class="you">你选了「{c}」。</span>', '<span class="you">You chose “{c}”.</span>');
_tpl('fbmxHead', '高亮：你这手 <b>{hand}</b> · 正确 <b>{correct}</b> · 你选 {you}', 'Highlight: your hand <b>{hand}</b> · correct <b>{correct}</b> · you chose {you}');
// freqNote
_tpl('fnPrecise', '（计算频率：{f}）', '(solved freq: {f})');
_tpl('fnEdge', '（边缘 · 占位频率）', '(edge · placeholder freq)');
_tpl('fnMix', '（混合 · 占位 ~50/50）', '(mixed · placeholder ~50/50)');
_tpl('fnPure', '（100%）', '(100%)');
// over screen
_tpl('overKickWin', '🎉 通关', '🎉 Cleared'); _tpl('overKickEnd', '训练结束', 'Session ended');
_tpl('overTitleWin', '🎉 完成 {n} 手 · ', '🎉 Finished {n} hands · ');
_tpl('overScore', '得分 <b style="color:var(--gold)">{s}</b>', 'Score <b style="color:var(--gold)">{s}</b>');
_tpl('overRecord', ' <span style="font-size:13px;color:var(--best)">🏅新纪录!</span>', ' <span style="font-size:13px;color:var(--best)">🏅 record!</span>');
// achievements (display only; internal keys stay Chinese)
_tpl('ach.首杀','首杀','First blood'); _tpl('ach.连击大师','连击大师','Combo master');
_tpl('ach.火力全开','火力全开','On fire'); _tpl('ach.钢铁神经','钢铁神经','Nerves of steel');
_tpl('ach.二十手通关','二十手通关','20-hand clear'); _tpl('ach.GTO 机器','GTO 机器','GTO machine');
_tpl('ach.完美关卡','完美关卡','Perfect level'); _tpl('ach.巨牌漏着','巨牌漏着','Monster misfold');
_tpl('achGet', '成就达成 · {n}', 'Achievement · {n}');
// toasts
_tpl('proUnlocked', '已解锁 Pro，尽情练', 'Pro unlocked — drill away');
_tpl('saveCleared', '本地存档已清除', 'Local save cleared');
// leak / profile / plan
_tpl('leakEmpty', '还没有漏洞数据——训练里答错的牌会自动收进来分析喵 🐿', 'No leak data yet — misses in training are collected here automatically, nya 🐿');
_tpl('leakTop', '最大漏洞：<b style="color:{c}">{name}</b>（共 {n} 次失误 · vs 参考范围）', 'Biggest leak: <b style="color:{c}">{name}</b> ({n} misses · vs reference ranges)');
_tpl('leakWorst', '最常踩的坑', 'Most-missed hands');
_tpl('drill', '去练', 'Drill');
_tpl('profEmpty', '练够 10 手后这里生成你的画像喵 🐿', 'Play 10+ hands and your profile shows up here, nya 🐿');
_tpl('profNeedMore', '松紧样本不足，多练些边界手', 'Not enough loose/tight data — drill more border hands');
_tpl('profLoose', '失误 {p}% 是「该弃却入池」', '{p}% of misses are “play hands you should fold”');
_tpl('profTight', '失误 {p}% 是「该入却弃·漏价值」', '{p}% of misses are “fold hands you should play”');
_tpl('profBal', '松紧失误大致对半', 'loose/tight misses roughly even');
_tpl('profPassive', '常该加注却只跟注', 'often just call when you should raise');
_tpl('profAggro', '常该跟注却加注/全下', 'often raise/jam when you should call');
_tpl('profAggBal', '被动/激进失误对半', 'passive/aggressive misses even');
_tpl('profCum', '累计 {n} 手', '{n} hands total');
_tpl('profNote', '基于你 vs 参考范围的练习记录，非真实牌局风格。', 'Based on your practice vs reference ranges, not real-table style.');
_tpl('planEmpty', '暂无可练项——训练里答错的局面会自动进计划喵', 'Nothing to drill yet — spots you miss are added automatically, nya');
_tpl('planHead', '按「最该练」排序——错得多 + 准确率低优先：', 'Sorted by “most needed” — more misses + lower accuracy first:');
_tpl('planAcc', '准确率 {p}% · ', '{p}% accuracy · ');
_tpl('planErrs', '{n} 个错题', '{n} mistakes');
// stats
_tpl('statsNoData', '还没有数据——先去训练几手喵', 'No data yet — play a few hands first, nya');
_tpl('sbarPct', '{p}% · {h}手', '{p}% · {h} hands');
// charts
_tpl('cChartHint', '点格子查看每手牌的建议', 'Tap a cell to see the suggestion');
_tpl('cPotPct', '入池 <b>{p}%</b>', 'In range <b>{p}%</b>');
_tpl('cCellInfo', '<b>{hand}</b> · {cat}{fq}', '<b>{hand}</b> · {cat}{fq}');
// calc
_tpl('calcComputing', '计算中…（{n} 万次模拟）', 'Computing… ({n}0k sims)');
_tpl('calcEmptyRange', '范围为空或写法无法识别——试试 <code>22+, AJs+, KQo</code> 这类写法喵～', 'Range empty or unrecognized — try <code>22+, AJs+, KQo</code>, nya~');
_tpl('calcConflict', '范围和牌面牌张冲突太多，无法对局喵～', 'Too many card conflicts between ranges and board, nya~');
_tpl('calcLead', '{who}领先 <b>{p}%</b>', '{who} ahead by <b>{p}%</b>');
_tpl('calcCountH', '· {n} 手 / {c} 组合', '· {n} hands / {c} combos');
_tpl('calcCountNone', '· —', '· —');
_tpl('calcBoardN', '· {n} 张 · {street}', '· {n} cards · {street}');
_tpl('calcNoteBoard', '· 牌面 {b}（{street}）· {n} 万次跑完剩余街', '· board {b} ({street}) · {n}0k sims to the river');
_tpl('calcNotePre', '· {n} 万次全下到河模拟', '· {n}0k all-in-to-river sims');
_tpl('calcResLine', '{kind}：{lead}　<span style="color:var(--foldink,#7c8c82)">{note}</span>', '{kind}: {lead}　<span style="color:var(--foldink,#7c8c82)">{note}</span>');
// calc board parse errors
_tpl('boardErrLen', '牌面字数不对——每张牌两个字符，如 Ah Kd 7c', 'Bad board length — two chars per card, e.g. Ah Kd 7c');
_tpl('boardErrCard', '看不懂这张牌「{tok}」——点数用 23456789TJQKA，花色用 shdc', 'Can’t read card “{tok}” — ranks 23456789TJQKA, suits shdc');
_tpl('boardErrDup', '牌面里有重复的牌「{tok}」', 'Duplicate card in board “{tok}”');
_tpl('boardErrCount', '牌面要 3（翻牌）/4（转牌）/5（河牌）张，或留空=翻前全下', 'Board needs 3 (flop) / 4 (turn) / 5 (river) cards, or empty = preflop all-in');
_tpl('calcErrSuffix', '{e}喵～', '{e}, nya~');
// paywall
_tpl('pwTitle', '解锁 Pro 🐿', 'Unlock Pro 🐿');
_tpl('pwBuy', '解锁 Pro', 'Unlock Pro');
_tpl('pwYear', '年订阅 · $12.99 / 年', 'Yearly · $12.99/yr');
_tpl('pwYearNote', '最划算 · 合约 $1.08 / 月', 'Best value · ~$1.08/mo');
_tpl('pwSub', '月订阅 · $4.99 / 月', 'Monthly · $4.99/mo');
_tpl('pwSubNote', '随时取消', 'Cancel anytime');
_tpl('pwRestore', '恢复已购买', 'Restore purchases');
_tpl('pwNoPurchase', '没找到可恢复的购买', 'No purchase to restore');
_tpl('pwClose', '以后再说', 'Maybe later');
_tpl('pwFoot', '核心训练永久免费 · Pro 只解锁进阶能力', 'Core training is free forever · Pro unlocks advanced features only');
_tpl('pwWhyDefault', '这是 Pro 进阶功能', 'This is a Pro feature');
_tpl('pwWhyPush', '这个进阶场景属于 Pro（每类场景前一半免费）', 'This advanced scenario is Pro (the first half of each category is free)');
// local notifications (app-only)
_tpl('notifyTitle', '松鼠喊你练牌 🐿', 'Time to drill 🐿');
_tpl('notifyBody', '花 2 分钟练几手翻前，保持手感', 'Spend 2 minutes on a few preflop hands');
_tpl('notifyLabel', '每日训练提醒', 'Daily training reminder');
_tpl('notifyHint', '本地提醒 · 不联网', 'Local reminder · offline');
_tpl('notifyOnToast', '已开启每日提醒', 'Daily reminder on');
_tpl('notifyOffToast', '已关闭每日提醒', 'Daily reminder off');
_tpl('notifyDenied', '通知权限被关闭，请到系统设置开启', 'Notifications are off — enable them in system settings');
_tpl('notifyStateOn', '🔔 开 · 每天提醒', '🔔 On · daily');
_tpl('notifyStateOff', '🔕 关 · 点击开启', '🔕 Off · tap to enable');
// Nash 推弃图查询器
_tpl('nashBtn', 'Nash图', 'Nash');
_tpl('nmR9', '9人·开局推', '9-max · open jam');
_tpl('nmR6', '6人·开局推', '6-max · open jam');
_tpl('nmHU', '单挑·SB推', 'HU · SB jam');
_tpl('nmC9', '9人·BB跟全下', '9-max · BB call');
_tpl('nmHUC', '单挑·BB跟', 'HU · BB call');
_tpl('nwOpen', '轮到你 · 全下 vs 后位玩家', 'folds to you · jam vs players behind');
_tpl('nwHUjam', 'SB 全下 vs BB', 'SB jam vs BB');
_tpl('nwC9', 'BB 跟 BTN 全下', 'BB call-off vs BTN jam');
_tpl('nwHUcall', 'BB 跟 SB 全下', 'BB call-off vs SB jam');
_tpl('nashPct', '{n}/1326 手 +EV ({p}%)', '{n}/1326 hands +EV ({p}%)');
_tpl('nashNoData', '该组合暂无数据', 'No data for this combo');
_tpl('nashNoAnte', '无前注', 'No ante');
_tpl('nashBBAnte', '大盲前注', 'BB ante');
_tpl('anteWord', '前注', 'ante');
_tpl('pwWhyNash', '自算 Nash 推弃图查询器是 Pro 功能', 'The computed Nash push/fold charts are a Pro feature');
_tpl('nashInfo', '绿=该动作 +EV（自算 Nash）· 数字=每手 chip-EV（bb，相对弃牌）', 'Green = +EV action (computed Nash) · number = per-hand chip-EV (bb, vs fold)');
_tpl('pwWhyCalc', '算胜率计算器属于 Pro', 'The equity calculator is Pro');
_tpl('pwLockNote', '{name}是 Pro 进阶分析——解锁后按你的真实错题给出。', '{name} is a Pro feature — unlocks based on your real mistakes.');
_tpl('pwWhyFeature', '{name}属于 Pro', '{name} is Pro');
_tpl('unlockPro', '解锁 Pro', 'Unlock Pro');
_tpl('gateProfile', '🔓 解锁完整画像', '🔓 Unlock full profile');
_tpl('gateLeak', '🔓 解锁全部漏洞 + 训练计划', '🔓 Unlock all leaks + plan');
_tpl('gatePlan', '🔓 解锁训练计划', '🔓 Unlock training plan');
_tpl('feat.profile', '个人画像', 'Profile'); _tpl('feat.plan', '训练计划', 'Training plan'); _tpl('feat.leak', '漏洞分析', 'Leak analysis');
I18N_TPL.zh['pitch'] = [
 '🔍 个人画像 + 漏洞分析（最大漏洞 · 太松/太紧/被动/过激）',
 '🗓 训练计划（按需练度排序 · 一键去练）',
 '♠ 全部自算 Nash 推弃训练（8–25bb · 6人 · 单挑HU · 面对全下）',
 '🧮 算胜率计算器（翻前 / 翻后 equity）'];
I18N_TPL.en['pitch'] = [
 '🔍 Profile + leak analysis (biggest leak · too loose / tight / passive / aggressive)',
 '🗓 Training plan (sorted by need · one-tap drill)',
 '♠ All solved-Nash jam/fold drills (8–25bb · 6-max · heads-up · vs jam)',
 '🧮 Equity calculator (pre- / post-flop equity)'];

// reasonFor — verb / hand-kind whys
_tpl('verb.全下','全下','jam'); _tpl('verb.加注','加注','raise'); _tpl('verb.跟注','跟注','call'); _tpl('verb.入池','入池','enter');
_tpl('reason.edge', '<b>{hand}</b> 是 {p} 的<b>边缘混合牌</b>：GTO 把它在「{an}」与「弃牌」之间按频率分配（大致一半一半），两种长期 EV 很接近，所以怎么打都算合理，难以被对手剥削。',
 '<b>{hand}</b> is an <b>edge mix</b> in {p}: GTO splits it between “{an}” and “fold” by frequency (roughly half/half) — both have near-equal long-run EV, so either play is fine and hard to exploit.');
_tpl('reason.mix', '<b>{hand}</b> 是 {p} 的<b>混合点</b>：既可作价值/半诈唬反加，也可平跟控池。GTO 按频率混合两者来保持范围平衡，两种打法都对。',
 '<b>{hand}</b> is a <b>mix point</b> in {p}: it can re-raise for value/semi-bluff or flat to control the pot. GTO mixes both by frequency to stay balanced — both plays are correct.');
// face3b
_tpl('reason.f3.raise', '<b>{hand}</b> 面对 3-bet 应<b>再加 4-bet</b>：{why}。只平跟会让最强牌少赚、也缺了诈唬平衡。',
 '<b>{hand}</b> facing a 3-bet should <b>4-bet</b>: {why}. Just calling makes your strongest hands earn less and leaves your bluffs unbalanced.');
_tpl('reason.f3.why.block', '用手里的 A 阻断对手的 AA/AKs 等强牌，做带阻断的 4-bet 诈唬', 'the A blocks their AA/AKs etc., making it a blocker 4-bet bluff');
_tpl('reason.f3.why.value', '牌力够强，4-bet 拿价值——让对手用更差的牌跟注或弃掉权益', 'strong enough to 4-bet for value — opponents call worse or fold equity');
_tpl('reason.f3.call', '<b>{hand}</b> 面对 3-bet 适合<b>跟注</b>防守：{clause}；不到 4-bet 的强度，弃掉又太亏。',
 '<b>{hand}</b> facing a 3-bet is a <b>call</b>: {clause}; not strong enough to 4-bet, too good to fold.');
_tpl('reason.f3.clause.ip', '你有位置、翻后能最后行动，平跟续战很舒服', 'in position you act last postflop, so flatting is comfortable');
_tpl('reason.f3.clause.oop', '虽无位置，但这手仍强到值得跟注', 'out of position, but still strong enough to continue');
_tpl('reason.f3.fold', '<b>{hand}</b> 面对 3-bet 应<b>弃牌</b>：不足以 4-bet，跟注后翻前已投入不少、翻后又难打，长期为负。{tail}',
 '<b>{hand}</b> facing a 3-bet should <b>fold</b>: not enough to 4-bet, and calling commits chips into a tough postflop — net negative. {tail}');
_tpl('reason.f3.tail.oop', '无位置时更要收紧。', 'Tighten up even more out of position.'); _tpl('reason.f3.tail.ip','','');
// face4b
_tpl('reason.f4.shove', '<b>{hand}</b> 面对 4-bet 应<b>5-bet 全下</b>：{why}。这么深的投入后，平跟反而难打、还暴露牌力。',
 '<b>{hand}</b> facing a 4-bet should <b>5-bet jam</b>: {why}. This deep, flatting plays badly and reveals your hand.');
_tpl('reason.f4.why.block', '用 A 阻断对手的 AA/AKs，做带阻断的诈唬全下', 'the A blocks their AA/AKs, a blocker jam-bluff');
_tpl('reason.f4.why.value', '顶级牌力，100bb 下 5-bet 直接全下拿最大价值', 'premium strength — at 100bb, 5-bet jam for max value');
_tpl('reason.f4.call', '<b>{hand}</b> 面对 4-bet 可<b>跟注</b>续战：牌力够强、又有位置控池，但不到全下的强度，跟注保留对手的诈唬 4bet。',
 '<b>{hand}</b> facing a 4-bet can <b>call</b>: strong enough with position to control the pot, but not a jam — calling keeps their 4-bet bluffs in.');
_tpl('reason.f4.fold', '<b>{hand}</b> 面对 4-bet 应<b>弃牌</b>：你的 3-bet 多半是诈唬/施压，对手 4-bet 表达了强范围，这手没有继续的价值，干净放掉。',
 '<b>{hand}</b> facing a 4-bet should <b>fold</b>: your 3-bet was mostly a bluff/pressure, their 4-bet shows strength, and this hand has no reason to continue — let it go cleanly.');
// squeeze
_tpl('reason.sq.raise', '<b>{hand}</b> 适合<b>挤压 3-bet</b>：{why}。有跟注者在，底池死钱多、挤压回报更高；平跟会让多人底池失控。',
 '<b>{hand}</b> is a <b>squeeze</b>: {why}. With a caller in, there’s dead money and squeezing pays more; flatting loses control of a multiway pot.');
_tpl('reason.sq.why.block', '用阻断牌做诈唬挤压，吞掉底池里的死钱', 'a blocker bluff-squeeze to scoop the dead money');
_tpl('reason.sq.why.value', '价值够强，挤压把开局者和跟注者一起施压、收割他们投入的筹码', 'strong value — squeezing pressures both the opener and caller and collects their chips');
_tpl('reason.sq.call', '<b>{hand}</b> 适合<b>跟注</b>（跟进多人池）：{clause}；不够强到挤压，但弃了可惜。',
 '<b>{hand}</b> is an <b>overcall</b>: {clause}; not strong enough to squeeze, too good to fold.');
_tpl('reason.sq.clause.ip', '有位置、可低成本搏多人底池的中花/顺子/暗三', 'in position, cheaply chasing flushes/straights/sets in a multiway pot');
_tpl('reason.sq.clause.oop', '适合凑set/同花的投机牌，多人底池摊牌价值高', 'a speculative set/flush hand with good multiway showdown value');
_tpl('reason.sq.fold', '<b>{hand}</b> 应当<b>弃牌</b>：多人底池里这手既不够价值挤压，也缺乏多人摊牌的潜力，放掉最稳。',
 '<b>{hand}</b> should <b>fold</b>: in a multiway pot it’s neither strong enough to squeeze nor has the potential to play multiway — folding is safest.');
// pure raise/shove
_tpl('reason.play', '<b>{hand}</b> 在 {p} 应当{verb}：{why}', '<b>{hand}</b> in {p} should {verb}: {why}');
_tpl('reason.why.pair', '口袋对子本身有摊牌价值，{verb}能建立底池主动权。', 'a pocket pair has showdown value; {verb} takes the initiative.');
_tpl('reason.why.axs', '同花 A 有坚果同花潜力，且手握 A 阻断对手的强 A 组合，{verb}价值很高。', 'a suited ace has nut-flush potential and blocks strong aces; {verb} is high value.');
_tpl('reason.why.axo', 'A 高牌 + 偷盲价值，在 {p} {verb}长期有利可图。', 'ace-high plus steal value — {verb} in {p} is profitable long-term.');
_tpl('reason.why.bws', '两张高张且同花，牌力强又好打后续，标准{verb}。', 'two suited broadways — strong and easy to play; a standard {verb}.');
_tpl('reason.why.bwo', '两张高张牌力够强，{verb}建立价值。', 'two broadways, strong enough — {verb} for value.');
_tpl('reason.why.sc', '同花连子有顺子+同花潜力，{verb}兼顾价值与可玩性。', 'a suited connector with straight + flush potential — {verb} blends value and playability.');
_tpl('reason.why.sg', '同花有一定潜力，{p} 位置靠后可以{verb}施压。', 'a suited hand with some potential — late in {p} you can {verb} to pressure.');
_tpl('reason.why.off', '在 {p} 这手有足够的偷盲/价值，{verb}为正期望。', 'in {p} this has enough steal/value — {verb} is +EV.');
_tpl('reason.is3', '<b>{hand}</b> 适合<b>反加 3-bet</b>：要么价值够强压制开局者，要么用阻断牌做诈唬。平跟会让强牌少赚、也让范围失衡。',
 '<b>{hand}</b> is a <b>3-bet</b>: either strong enough to pressure the opener, or a blocker bluff. Flatting earns less with strong hands and unbalances your range.');
_tpl('reason.call', '<b>{hand}</b> 适合<b>跟注</b>防守：牌力/潜力够入池，但不强到反加。平跟能保留对手的诈唬范围、压低方差，又能看翻牌。',
 '<b>{hand}</b> is a <b>call</b>: enough strength/potential to continue, but not to re-raise. Flatting keeps their bluffs in, lowers variance, and sees a flop.');
_tpl('reason.fold', '<b>{hand}</b> 应当<b>弃牌</b>：{why}干净放掉、等更好的位置或牌。', '<b>{hand}</b> should <b>fold</b>: {why} Let it go and wait for a better spot or hand.');
_tpl('reason.fold.off', '不同花、缺乏顺花潜力，容易被同名更强的牌支配。', 'offsuit with no straight/flush potential, easily dominated.');
_tpl('reason.fold.axo', '不同花的弱 A 在 {p} 易被压制，入池价值不足。', 'a weak offsuit ace in {p} is easily dominated — not worth entering.');
_tpl('reason.fold.sg', '同花但太散，在 {p} 实现率不够。', 'suited but too disconnected — poor equity realization in {p}.');
_tpl('reason.fold.sc', '潜力虽有，但 {p} 身后人数多，长期入池仍为负。', 'has potential, but with players behind in {p} entering is net negative.');
_tpl('reason.fold.generic', '在 {p} 这手牌力/潜力不足，身后还有人能反打，长期入池为负期望。', 'in {p} it lacks strength/potential and players behind can punish you — entering is -EV.');

// —— About screen prose (inline <b>) ——
_tpl('about_what_p',
 '一个翻前决策的<b>入门训练工具</b>，帮你建立「什么位置该开什么牌」的 GTO 范围直觉。适合练习、记忆、找漏洞。',
 'A <b>beginner training tool</b> for preflop decisions — it builds your intuition for “what to open from where.” Great for practice, memorization, and finding leaks.');
_tpl('about_not_p',
 '<b>大部分范围不是 solver 精确解</b>：开局、大盲防守、面对 3bet/4bet、挤压、冷跟等，是参考公开 GTO 图表 + 扑克理论<b>手工整理的简化范围</b>（界面上不带标签），与 PioSOLVER / GTO Wizard 会有出入——尤其边缘牌取舍和混合频率。<b>例外</b>：各档<b>推弃 / 全下跟注</b>由本工具<b>自算 Nash</b>（界面标<b>「Nash 博弈论最优」</b>，详见下方「假设条件」），但仍是简化模型、非真实牌桌精确。要做精确研究，请用真正的 solver。',
 '<b>Most ranges are not solver-exact.</b> Opens, BB defense, vs 3-bet/4-bet, squeeze, cold-call are <b>hand-curated simplified ranges</b> from public GTO charts + poker theory (shown without a tag) and will differ from PioSOLVER / GTO Wizard — especially on edge hands and mix frequencies. <b>Exception:</b> the <b>jam/fold & jam-call</b> spots are <b>solved by this app’s own Nash solver</b> (tagged <b>“Nash GTO”</b>, see Assumptions below), but still a simplified model, not table-exact. For real precision, use a real solver.');
_tpl('about_li1', '<b>现金局</b>：100bb 深度、约 2.5x 开局、常规抽水', '<b>Cash:</b> 100bb deep, ~2.5x opens, standard rake');
_tpl('about_li2', '<b>MTT 40/25/15bb</b>：带前注的近似开局范围。<b>注意</b>：真实前注会让范围更宽，本工具偏<b>保守（略紧）</b>，宁紧勿松，可按实战略放宽',
 '<b>MTT 40/25/15bb:</b> approximate ante-adjusted open ranges. <b>Note:</b> real antes widen ranges; this tool is <b>conservative (a touch tight)</b> — widen a bit in practice.');
_tpl('about_li3', '<b>MTT 6人（终桌/短手）</b>：40bb / 20bb 近似开局。人少→范围更宽；按「取后位＋适度放宽」估计，<b>非精确解</b>',
 '<b>MTT 6-max (final table / short):</b> 40bb / 20bb approximate opens. Fewer players → wider; estimated as “later seats + modest widening,” <b>not exact</b>.');
_tpl('about_li4',
 '<b>推弃 / 全下跟注（标「Nash 博弈论最优」）</b>：用本工具自带 equity + Nash 求解器<b>自算</b>，覆盖 9 人 8/10/12/15/20bb 全下弃、6 人 10/15/20bb、单挑 HU 5–25bb（SB 全下＋BB 跟）、9 人 BB 面对 BTN 全下的跟注。<b>无前注</b>的简化模型（no-overcall / 类级 equity / 蒙特卡洛），<b>非真实牌桌精确</b>；每档可利用度已测量、写在「Nash 博弈论最优」标签的提示里（越接近 0 越准）',
 '<b>Jam/fold & jam-call (tagged “Nash GTO”):</b> <b>solved</b> with this app’s own equity + Nash solver — 9-max 8/10/12/15/20bb jam-or-fold, 6-max 10/15/20bb, heads-up 5–25bb (SB jam + BB call), and 9-max BB calling a BTN jam. A <b>no-ante</b> simplified model (no-overcall / class-level equity / Monte-Carlo), <b>not table-exact</b>; each stack’s exploitability is measured and shown in the “Nash GTO” tag tooltip (closer to 0 = more accurate).');
_tpl('about_li5',
 '<b>泡沫 ICM</b>：<b>本工具最粗的一块</b>。这里简化成「一律收紧开局＝保命」，但真实 ICM 的核心其实是<b>跟注/全下跟注更紧</b>（别出局）；筹码舒服的大牌量反而能<b>开得更宽去施压</b>风险厌恶的对手。请把 ICM 档当「保命直觉」看，别照搬到具体泡沫局',
 '<b>Bubble ICM:</b> <b>the roughest part.</b> Simplified to “tighten all opens = survive,” but real ICM is mostly about <b>calling/jam-calling tighter</b> (don’t bust); a big stack can actually <b>open wider to pressure</b> risk-averse opponents. Treat ICM here as “survival intuition,” not a literal bubble guide.');
_tpl('about_li6', '<b>面对 3-bet（4bet/跟/弃）</b>：100bb 近似范围，4-bet ~3%。有位置(IP)防守更宽、无位置(OOP)更紧——形状对，但 4bet/跟注的精确分配随下注尺度变化',
 '<b>Vs 3-bet (4-bet/call/fold):</b> 100bb approximation, 4-bet ~3%. In position defends wider, out of position tighter — shape is right, but exact 4-bet/call split varies with sizing.');
_tpl('about_li7', '<b>面对 4-bet（5bet全下/跟/弃）</b>：100bb 近似。基本「全下或弃」、跟注极窄；5-bet 视作直接全下',
 '<b>Vs 4-bet (5-bet jam/call/fold):</b> 100bb approximation. Mostly “jam or fold,” calls very narrow; 5-bet treated as a direct jam.');
_tpl('about_li8', '<b>挤压 Squeeze（开+跟后反加）</b>：100bb 近似。挤压偏两极化（价值+阻断诈唬）、overcall 为多人底池投机牌；尺度/人数会影响精确范围',
 '<b>Squeeze (re-raise after open + call):</b> 100bb approximation. Squeezes are polarized (value + blocker bluffs), overcalls are speculative multiway hands; sizing/players shift the exact range.');
_tpl('about_li9', '<b>冷跟 Cold-call（非盲位防守）</b>：100bb 近似。<b>平跟范围≠开局范围</b>——开局会加的牌很多面对加注要改 3bet 或弃；位置越靠前/对手越强，跟注越窄',
 '<b>Cold-call (non-blind defense):</b> 100bb approximation. <b>Flatting range ≠ opening range</b> — many hands you’d open must become a 3-bet or fold vs a raise; earlier position / stronger opener = narrower calls.');
_tpl('about_li10', '<b>SB 用「加注或弃」模型</b>：真实浅码 SB 常用 limp / limp-jam，本工具未建模', '<b>SB uses a “raise or fold” model:</b> real short-stack SB often limps / limp-jams, not modeled here.');
_tpl('about_li11', '<b>边缘混合带</b>：频率按约一半估计，<b>非真实 solver 频率</b>', '<b>Edge mixes:</b> frequencies estimated at ~half, <b>not real solver frequencies</b>.');
_tpl('about_src_p',
 '作者参考多个公开 GTO 图表整理而成，并已对照权威来源核对过<b>入池比例与整体形状</b>（量级正确），但<b>未逐手核对</b>。所有数据为原创整理，<b>不含任何第三方版权内容</b>。',
 'Curated from several public GTO charts, with <b>VPIP and overall shape</b> checked against authoritative sources (right magnitude), but <b>not verified hand-by-hand</b>. All data is original; <b>no third-party copyrighted content</b>.');
_tpl('about_exact_p',
 '建议使用 PioSOLVER、GTO Wizard、MonkerSolver 等专业 solver 获取针对你的下注尺度、抽水、筹码深度的精确范围。本工具用于建立直觉，不替代它们。',
 'Use a pro solver — PioSOLVER, GTO Wizard, MonkerSolver — for ranges exact to your sizing, rake, and stack depth. This tool builds intuition; it doesn’t replace them.');
_tpl('about_note', '真 GTO 随下注尺度、抽水、前注、筹码深度变化。本工具固定了上述假设。松鼠出品 🐿',
 'True GTO shifts with sizing, rake, antes, and stack depth. This tool fixes the assumptions above. Made by a squirrel 🐿');
// —— Guide screen prose ——
_tpl('guide_intro_p', '一手牌从「谁先加注」开始，随着反加层层升级。把每个环节单独练熟，整棵树就通了。建议新手<b>从上往下按顺序</b>练。',
 'A hand starts with “who raises first” and escalates with each re-raise. Master each step on its own and the whole tree clicks. Beginners: <b>train top to bottom in order</b>.');
_tpl('guide_node1', '<b>开局 RFI ＋ 大盲防守</b><small>你第一个进池该开哪些牌；别人开了你在大盲怎么弃/跟/3-bet。一切的基础。</small>',
 '<b>Opening RFI + BB defense</b><small>What to open when you’re first in; how to fold/call/3-bet in the BB when someone opens. The foundation.</small>');
_tpl('guide_arrow1', '↓ 你开局后，被身后的人反加…', '↓ You open, someone behind re-raises…');
_tpl('guide_node2', '<b>面对 3-bet</b><small>开局被反加：4-bet / 跟注 / 弃牌。最高频、最该补。重点学有位置 vs 无位置。</small>',
 '<b>Vs 3-bet</b><small>Your open gets re-raised: 4-bet / call / fold. The most common, most worth fixing. Focus on in vs out of position.</small>');
_tpl('guide_arrow2', '↓ 你（或对手）再加一手，战火升级…', '↓ Another raise goes in, the war escalates…');
_tpl('guide_node3', '<b>面对 4-bet</b><small>你 3-bet 后被再加：5-bet 全下 / 跟 / 弃。100bb 基本「全下或弃」。</small>',
 '<b>Vs 4-bet</b><small>Your 3-bet gets re-raised: 5-bet jam / call / fold. At 100bb it’s mostly “jam or fold.”</small>');
_tpl('guide_other_p', '主线之外，这两种也很常见：', 'Beyond the main line, these two are common too:');
_tpl('guide_nodeS', '<b>挤压 Squeeze</b><small>有人开 + 有人跟，轮到你反加。多人底池死钱多，挤压回报高。</small>',
 '<b>Squeeze</b><small>Someone opens + someone calls, then it’s on you to re-raise. Multiway pots have dead money — squeezing pays.</small>');
_tpl('guide_nodeC', '<b>冷跟 Cold-call</b><small>非盲位面对开局：3bet / 平跟 / 弃。注意平跟范围≠开局范围。</small>',
 '<b>Cold-call</b><small>Non-blind facing an open: 3-bet / flat / fold. Remember: flatting range ≠ opening range.</small>');
_tpl('guide_nodeT', '<b>锦标赛 MTT 专线</b><small>按筹码深度变化：40→25→15bb 收紧 → 推弃（8–20bb / 6人 / 单挑 HU）→ 泡沫 ICM。独立一条线。</small>',
 '<b>Tournament MTT track</b><small>Shifts by stack depth: 40→25→15bb tighten → jam/fold (8–20bb / 6-max / heads-up) → bubble ICM. Its own track.</small>');
_tpl('guide_order_p', '① 先把 <b>开局 RFI</b> 练到每个位置张口就来 → ② 再练 <b>大盲防守</b>（同在现金局里）→ ③ <b>面对 3-bet</b>（收益最大）→ ④ <b>面对 4-bet</b> → ⑤ 想打多人池补 <b>挤压</b>，想打比赛走 <b>MTT 专线</b>。用<b>发牌偏好「边缘」</b>专攻每个 spot 的难点。',
 '① Drill <b>opening RFI</b> until every seat is instant → ② then <b>BB defense</b> (same Cash menu) → ③ <b>vs 3-bet</b> (biggest gain) → ④ <b>vs 4-bet</b> → ⑤ for multiway add <b>squeeze</b>, for MTTs take the <b>MTT track</b>. Use deal preference <b>“Edge”</b> to attack each spot’s tough hands.');
_tpl('guide_save_p', '本地运行时，app 会自动记住你的<b>错题堆、历史最高分、上次设置</b>（存在浏览器本地，不上传）。换浏览器或清缓存会丢失。',
 'Running locally, the app remembers your <b>mistake pile, all-time high, and last settings</b> (stored in your browser, never uploaded). Switching browsers or clearing the cache loses them.');
// —— Calc note ——
_tpl('calc_note', '<b>蒙特卡洛实算 · 真实数字</b>。范围用逗号分隔，如 <code>22+, AJs+, KQo</code>；单手 <code>AKs</code> 也行。<br>填了<b>牌面</b>就是<b>翻后胜率</b>（给定公共牌），留空则是<b>翻前全下</b>。',
 '<b>Real Monte-Carlo · actual numbers.</b> Comma-separate ranges, e.g. <code>22+, AJs+, KQo</code>; a single combo <code>AKs</code> works too.<br>Fill in a <b>board</b> for <b>postflop equity</b> (given community cards); leave it empty for a <b>preflop all-in</b>.');

// —— coach 诊断+计划文案 ——
_tpl('coachTitle','训练计划','Training Plan');
_tpl('coachOnboardTitle','开始之前','Before we start');
_tpl('coachOnboardSub','回答 4 个问题，生成你的专属诊断','Answer 4 questions to tailor your diagnosis');
_tpl('coachChooseVariant','选择诊断版本','Choose diagnosis version');
_tpl('coachSimple','⚡ 简化版','⚡ Quick');
_tpl('coachSimpleSub','18 手 · 快速估算方向','18 hands · quick directional estimate');
_tpl('coachFull','🔍 详细版','🔍 Detailed');
_tpl('coachFullSub','45 手 · 更精确的场景分析','45 hands · more precise scene analysis');
// 问卷题目
_tpl('coachQ1','主战场','Main game');
_tpl('coachQ2','自评水平','Self-rated level');
_tpl('coachQ3','每天能练多久','Daily practice time');
_tpl('coachQ4','主要目标','Main goal');
// 问卷选项
_tpl('coachLvNew','入门','Beginner');
_tpl('coachLvMid','进阶','Intermediate');
_tpl('coachLvAdv','高阶','Advanced');
_tpl('coachMin5','5 分钟','5 min');
_tpl('coachMin10','10 分钟','10 min');
_tpl('coachMin20','20 分钟+','20 min+');
_tpl('coachGoalLeak','攻克漏洞','Fix leaks');
_tpl('coachGoalSystem','系统过一遍','Systematic review');
// 诊断进度
_tpl('coachDiagProgress','{cur} / {tot}','{cur} / {tot}');
// 报告
_tpl('coachTendLoose','偏松 · 入池过多','Loose-leaning · too many calls');
_tpl('coachTendTight','偏紧 · 弃牌过多','Tight-leaning · folding too much');
_tpl('coachTendBalanced','较均衡 · 方向正确','Balanced · on the right track');
_tpl('coachScenePerf','各场景表现 · vs 参考范围','Scene accuracy · vs reference ranges');
_tpl('coachTopLeaks','最该补的漏洞','Top leaks to fix');
_tpl('coachStrengths','你的强项','Your strengths');
_tpl('coachNoLeaks','暂无明显漏洞 🎉','No obvious leaks 🎉');
_tpl('coachNoStrengths','继续练习，强项就来了','Keep drilling — strengths will show');
_tpl('coachPlanPreview','为你定制的 20 天计划','Your personalised 20-day plan');
_tpl('coachPlanFocus','主攻','Focus');
_tpl('coachPlanMixed','全场景混合巩固','Mixed review — all scenes');
_tpl('coachQuickEst','快速估计 · 仅供参考（简化版 18 手）','Quick estimate · directional only (quick 18-hand version)');
_tpl('coachVsRef','基于 {n} 手诊断 · 全部 vs 参考范围，非 solver 精确解','Based on {n} hands · all vs reference ranges, not solver-exact');
_tpl('coachStartDay1','开始 Day 1','Start Day 1');
_tpl('coachStartDay1Sub','20 天个性化训练 · Pro 解锁','20-day personalised plan · Pro');
_tpl('coachRedoDiag','重新诊断','Re-diagnose');
// 漏洞类型名
_tpl('leakType_loose','太松','Too loose');
_tpl('leakType_tight','太紧','Too tight');
_tpl('leakType_passive','被动','Passive');
_tpl('leakType_aggro','过激','Over-aggressive');
_tpl('leakType_mix','边缘混合','Marginal / mixed');
_tpl('leakType_icm','ICM 保命','ICM survival');
// 漏洞类型说明（报告详情）
_tpl('leakTypeDesc_loose','该弃却入池，丢掉长期 EV','Playing hands that should be folded, leaking EV');
_tpl('leakTypeDesc_tight','该入却弃，漏掉价值','Folding hands that should be played, missing value');
_tpl('leakTypeDesc_passive','该加注却只跟注，放弃主动权','Just calling when you should raise, giving up initiative');
_tpl('leakTypeDesc_aggro','该跟注却加注/全下，承担不必要的风险','Raising / jamming when you should call, taking excess risk');
_tpl('leakTypeDesc_mix','边缘难点把握不准，这是正常的','Struggling with marginal spots — that\'s normal');
_tpl('leakTypeDesc_icm','泡沫期手牌把握不准，需练 ICM 意识','Bubble hands off — ICM awareness needs work');
// 付费墙文案
_tpl('pwWhyPlan','20 天个性化训练计划是 Pro 功能','The 20-day personalised plan is a Pro feature');
// 每日卡片
_tpl('coachDayN','Day {d} / 20','Day {d} / 20');
_tpl('coachStreak','🔥 {n} 天','🔥 {n} days');
_tpl('coachDaySubtitle','vs 开局 · 你今天的主题','vs opens · your theme today');
_tpl('coachTodayTask','今日任务','Today\'s tasks');
_tpl('coachMainTraining','主题训练 · {n} 手','Theme drill · {n} hands');
_tpl('coachSmartDeal','智能出题','Smart dealing');
_tpl('coachReviewHands','复习错题 · {n} 手','Review mistakes · {n} hands');
_tpl('coachReviewSub','前几天答错的牌，巩固记忆','Hands you missed, to reinforce memory');
_tpl('coachDayProgress','今日完成 {done} / {total} 手','Today {done} / {total} hands done');
_tpl('coachStartToday','开始今天','Start today');
_tpl('coachHands','手','hands');
_tpl('coachMarkDone','✓ 标记今日完成','✓ Mark today done');
_tpl('coachWeekProg','本周进度','This week');
_tpl('coachResetPlan','重置计划','Reset plan');
_tpl('coachResetConfirm','确定要重置整个训练计划吗？所有进度将清除。','Reset the entire training plan? All progress will be lost.');
_tpl('coachMixedTheme','全场景混合','Mixed scenes');
// 完成页
_tpl('coachComplete','🎉 20 天计划完成！','🎉 20-day plan complete!');
_tpl('coachCompleteSub','厉害了！你把完整的诊断+训练走完了一遍。继续保持！','You finished the full diagnosis + training cycle. Keep it up!');
_tpl('coachRestartPlan','重新开始','Start over');

/* ---- core lookups ---- */
function _interp(s, v){ return v ? String(s).replace(/\{(\w+)\}/g, (m,k)=> v[k]!=null ? v[k] : m) : s; }
function L(zh){ if(LANG==='zh') return zh; const e=I18N_EN[zh]; return e!=null ? e : zh; }
// keyed template lookup. Named `tr` (not `t`) because app.js uses `t` for the spot object.
function tr(key, vars){ const d=I18N_TPL[LANG]||I18N_TPL.en; let s=d[key]; if(s==null) s=I18N_TPL.en[key]; if(s==null) return key; return _interp(s, vars); }
function tRaw(key){ const d=I18N_TPL[LANG]||I18N_TPL.en; return d[key]!=null ? d[key] : I18N_TPL.en[key]; }

/* ---- static-HTML translation ---- */
const _i18nOrig = new WeakMap(); // text/attr node → original Chinese
function _walkText(root){
 const SKIP=new Set(['SCRIPT','STYLE']);
 const it=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
  acceptNode(n){
   const p=n.parentElement; if(!p) return NodeFilter.FILTER_REJECT;
   if(SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
   if(p.closest('[data-i18n-html]')) return NodeFilter.FILTER_REJECT; // handled as a block
   if(!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
   return NodeFilter.FILTER_ACCEPT;
  }
 });
 const nodes=[]; let cur; while((cur=it.nextNode()) && nodes.length<8000) nodes.push(cur);
 nodes.forEach(n=>{
  let orig=_i18nOrig.get(n);
  if(orig==null){ orig=n.nodeValue; _i18nOrig.set(n, orig); }
  const trimmed=orig.trim();
  if(LANG==='zh'){ n.nodeValue=orig; return; }
  const en=I18N_EN[trimmed];
  n.nodeValue = en!=null ? orig.replace(trimmed, en) : orig;
 });
}
function _walkAttr(root, attr){
 root.querySelectorAll('['+attr+']').forEach(el=>{
  let store=_i18nOrig.get(el); if(!store){ store={}; _i18nOrig.set(el, store); }
  if(store[attr]==null) store[attr]=el.getAttribute(attr);
  const orig=store[attr], en=I18N_EN[(orig||'').trim()];
  el.setAttribute(attr, LANG==='zh' ? orig : (en!=null?en:orig));
 });
}
function _hasDOM(){ try{ return !!(document && document.body && document.body.nodeType===1); }catch(e){ return false; } }
function applyI18n(root){
 if(!_hasDOM()) return;          // no-op in the Node test VM (stubbed DOM)
 root=root||document;
 try{
  root.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML = tr(el.getAttribute('data-i18n-html')); });
  _walkText(root);
  _walkAttr(root,'placeholder'); _walkAttr(root,'title'); _walkAttr(root,'aria-label');
 }catch(e){}
 _updateLangBtn();
 if(typeof rerenderUI==='function'){ try{ rerenderUI(); }catch(e){} }
}
// highlight the active segment in the 中|EN selector
function _updateLangBtn(){
 ['langToggle','langToggle2'].forEach(tid=>{
  const w=document.getElementById(tid); if(!w) return;
  w.querySelectorAll('button[data-lang]').forEach(seg=>{
   const on=seg.dataset.lang===LANG;
   seg.style.background = on ? 'linear-gradient(180deg,var(--gold,#e8c66a),var(--gold2,#b8902f))' : 'transparent';
   seg.style.color = on ? '#16110a' : 'var(--muted,#8fa79a)';
  });
 });
}
function setLang(l){ if(l!=='en'&&l!=='zh') return; LANG=l; try{localStorage.setItem('gtoLang',l);}catch(e){} applyI18n(); }
function _mountLangToggle(){
 if(!_hasDOM()) return;
 try{
  // 主页(homeScreen) + 训练设置页(startScreen) 各挂一个，右上角，跟随内容滚动
  const mk=(code,label)=>{
   const seg=document.createElement('button'); seg.type='button'; seg.dataset.lang=code; seg.textContent=label;
   seg.style.cssText='appearance:none;border:0;background:transparent;font:700 12px/1 system-ui;padding:5px 9px;border-radius:7px;cursor:pointer;transition:.15s';
   seg.onclick=()=>{ if(LANG===code) return; try{ if(typeof SFX!=='undefined') SFX.click(); }catch(e){} setLang(code); };
   return seg;
  };
  [['homeScreen','langToggle2'],['startScreen','langToggle']].forEach(([hostId,tid])=>{
   if(document.getElementById(tid)) return;
   const host=document.getElementById(hostId); if(!host) return;
   const wrap=document.createElement('div'); wrap.id=tid; wrap.title='Language / 语言';
   wrap.style.cssText='position:absolute;top:calc(10px + env(safe-area-inset-top));right:14px;z-index:5;display:flex;gap:2px;padding:2px;border:1px solid var(--line,#2a352d);background:rgba(22,29,24,.85);backdrop-filter:blur(4px);border-radius:9px';
   wrap.appendChild(mk('zh','中')); wrap.appendChild(mk('en','EN'));
   host.appendChild(wrap);
  });
  _updateLangBtn();
 }catch(e){}
}

/* boot: scripts sit at end of <body>, so the DOM is ready here. app.js (loaded
   after) will define rerenderUI; we run a second applyI18n at the end of app.js. */
try{ _mountLangToggle(); applyI18n(); }catch(e){}
