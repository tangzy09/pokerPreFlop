'use strict';
/*
 * seo-content-jam.js — 推弃 / 单挑 / 跟全下 三类落地页的人工双语文案(seo-content.js 合并导出)。
 *
 * ⚠ **文案里绝不手打百分比** —— 一律用 {占位符},由 gen-seo-pages.js 的 fill() 从真实数据填:
 *     jam9    {UTG} {MP} {CO} {BTN} {SB}   跨档写 {BTN@8}(8bb 那一档的按钮位)
 *     hu      {jam} {call}                 跨档写 {jam@5} / {call@20}
 *     calloff {call} {btnjam} {hands}      跨档写 {call@15} / {btnjam@10}
 *   理由:2026-07 提样本修 20bb bug 那次,推弃数据整体重算,手打的数字当场和图对不上 ——
 *   页面上「图与文互相矛盾」比「数字略旧」糟得多。占位符找不到数据会**直接抛错**,不会静默印出 {jam}。
 *
 * 诚实红线:这些页发布的是**自算的** chip-EV Nash(蒙特卡洛类赢率,25000 样本/seed 1234),
 *   每档都有可利用度(meta.exploitability,单位 bb/手),文案与页脚如实标注,不许写成「GTO 精确解」。
 *   模型已知局限:算被跟概率时不做去牌,杂色 A 拿不到阻断牌的功劳、被系统性低估(见 gen-pushfold.js)。
 */
module.exports = {
  /* ═══════════ 9 人桌推弃(Nash,含每手 EV)═══════════ */
  'push-fold-chart-8bb': {
    en: {
      title: '8bb Push/Fold Chart (9-Max Nash)',
      lead: 'At 8 big blinds there is no raise-fold: you either move all in or you fold. This chart gives the Nash jam range for every seat at a 9-handed table — UTG jams {UTG}%, the cutoff {CO}%, the button {BTN}%, and the small blind {SB}% — with the expected value of every individual hand in big blinds.',
      body: [
        'Eight big blinds is deep in shove territory. A standard 2.2bb open commits over a quarter of your stack, and you have no fold equity left on the flop, so raising small only turns a clean all-in into a mess. Jamming instead means every fold you get wins you the blinds outright, and every call gives you two live cards and no further decisions to get wrong.',
        'The shape of the range is driven almost entirely by how many players are left to act. UTG has eight of them and jams {UTG}%. The small blind has one and jams {SB}% — far wider than the button — because the only hand that can call is the big blind\'s, and the big blind must fold a lot to a shove for one blind of dead money.',
        'The EV column is the part worth studying. Hands hovering between +0.00 and +0.05bb are the ones that decide almost nothing: shove them or fold them, the long-run difference is a rounding error. The hands worth memorising are the ones just below zero, because those are the jams that feel right and quietly lose money.',
      ],
      faq: [
        { q: 'Should I ever open-raise instead of shoving at 8bb?', a: 'Almost never at a 9-handed table. A 2.2bb open leaves you about 5.8bb behind — you are committed on any flop you continue on, but you have given a caller a cheap look and given yourself decisions you cannot afford to get wrong. Shoving captures the same fold equity with none of the downside.' },
        { q: 'Why does the small blind jam so much wider than the button?', a: 'Because only one player can call. From the button, both blinds can still wake up behind you; from the small blind, only the big blind can. With 1.5bb of dead money in the middle and one opponent who must fold most of the time, a shove shows a profit with about {SB}% of hands.' },
      ],
    },
    zh: {
      title: '8bb 推弃图（9人桌 Nash）',
      lead: '筹码 8 个大盲时已经没有「加注—弃牌」这条路：要么全下，要么弃。这张图给出 9 人桌每个位置的 Nash 全下范围——UTG 推 {UTG}%、CO 推 {CO}%、按钮推 {BTN}%、小盲推 {SB}%——并附上**每一手牌的期望值（bb）**。',
      body: [
        '8bb 已经深在全下区。开到 2.2bb 就投掉了四分之一以上的筹码，翻牌之后你又没有弃牌赢率——小加注只是把一个干净的全下搞成一团乱。直接推：对手弃了你白拿盲注，对手跟了你有两张活牌、后面也没有会打错的决策。',
        '范围的形状几乎完全由「身后还剩几个人」决定。UTG 身后 8 个人，推 {UTG}%；小盲身后只剩 1 个人，推 {SB}%——远比按钮宽——因为能跟的只有大盲一家，而大盲面对一个全下、池里只有一个死盲注时，必须弃掉很多牌。',
        '真正值得研究的是 EV 那一列。EV 在 +0.00 到 +0.05bb 之间的牌其实什么都不决定：推或弃，长期差别是舍入误差。**要背下来的是那些刚刚跌破零的牌**——它们看着就该推，却在悄悄亏钱。',
      ],
      faq: [
        { q: '8bb 时还该开小加注而不是全下吗？', a: '9 人桌几乎永远不该。开 2.2bb 之后你只剩约 5.8bb——任何你想继续的翻牌你都已经被绑住了，却还白送对手一个便宜的看牌机会，也给了自己一堆输不起的决策。全下能拿到同样的弃牌赢率，且没有这些坏处。' },
        { q: '为什么小盲推得比按钮宽这么多？', a: '因为能跟的只有一个人。在按钮位，身后还有小盲和大盲两家可以醒过来；在小盲位，只有大盲能跟。池里有 1.5bb 死钱、对手又必须大量弃牌——于是约 {SB}% 的牌全下都是盈利的。' },
      ],
    },
  },

  'push-fold-chart-10bb': {
    en: {
      title: '10bb Push/Fold Chart (9-Max Nash)',
      lead: 'Ten big blinds is the classic push/fold stack. At a 9-handed table the Nash jam ranges are {UTG}% from UTG, {MP}% from MP, {CO}% from the cutoff, {BTN}% from the button and {SB}% from the small blind — with per-hand EV in big blinds for every one of them.',
      body: [
        'Ten blinds is the stack most tournament players face most often, and it is where the jam-or-fold simplification is at its strongest: you have just enough chips that folding still has option value, and just few enough that any raise smaller than all-in is a mistake. Every hand on this chart is either a shove or a fold — there is no third option to agonise over.',
        'Compared with 8bb, every range tightens. That is the whole logic of push/fold in one sentence: the deeper you get, the more you have to lose by being called, so the more equity you need to justify the shove. The button drops from {BTN@8}% to {BTN}%, the small blind from {SB@8}% to {SB}%. Track the same hand across the 8bb, 10bb, 12bb and 15bb charts and you can watch it fall out of the range.',
        'Use the EV column to build intuition rather than memorise cells. The hands that make real money are the ones showing +0.3bb and up; the hands that quietly cost you are the ones you were sure about that show a negative number.',
      ],
      faq: [
        { q: 'What is the correct 10bb shoving range from the button?', a: 'About {BTN}% of hands at a 9-handed table — all pairs, most suited aces and kings, suited broadways and connectors, plus a band of offsuit broadways. The chart gives the exact hands and the EV of each one; hands sitting between +0.00 and +0.05bb are close to indifferent.' },
        { q: 'Are these Nash charts exact?', a: 'They are a self-computed chip-EV Nash equilibrium (Monte-Carlo hand-class equity, 25,000 samples per matchup) with the exploitability of each stack printed at the bottom of the page. They are accurate enough to play, but they are an approximation, not a solved oracle: they ignore ICM, and the model does not apply card removal to the callers\' range, so offsuit aces are slightly undervalued.' },
      ],
    },
    zh: {
      title: '10bb 推弃图（9人桌 Nash）',
      lead: '10 个大盲是最经典的推弃筹码。9 人桌的 Nash 全下范围是：UTG {UTG}%、MP {MP}%、CO {CO}%、按钮 {BTN}%、小盲 {SB}%——每一手牌都附**以 bb 为单位的期望值**。',
      body: [
        '10bb 是锦标赛玩家遇到最多的筹码量，也是「推或弃」这个简化最站得住的地方：筹码刚好还多到弃牌有保留价值，又刚好少到任何小于全下的加注都是错。这张图上的每一手不是推就是弃，没有第三个选项让你纠结。',
        '和 8bb 相比，每个位置的范围都收紧了。推弃的全部逻辑就在这一句里：**筹码越深，被跟时输得越多，所以需要更多赢率才值得推**。按钮从 {BTN@8}% 掉到 {BTN}%，小盲从 {SB@8}% 掉到 {SB}%。把同一手牌在 8bb / 10bb / 12bb / 15bb 四张图里追一遍，你能亲眼看着它掉出范围。',
        '用 EV 那一列建立直觉，而不是背格子。真正赚钱的是 +0.3bb 以上那些；真正在悄悄亏钱的，是你原本很确定、结果 EV 是负数的那些。',
      ],
      faq: [
        { q: '10bb 按钮位的正确全下范围是多少？', a: '9 人桌约 {BTN}%——全部对子、绝大多数同花 A 与同花 K、同花大牌与连子，再加一片杂色大牌。图里给出每一手的具体牌与 EV；EV 落在 +0.00 到 +0.05bb 之间的牌接近无差异。' },
        { q: '这些 Nash 图精确吗？', a: '它们是**自算的** chip-EV Nash 均衡（蒙特卡洛手牌类赢率，每次对局 25000 样本），每一档的可利用度都印在页脚。足够用来实战，但它是近似解、不是绝对真理：不考虑 ICM，且模型在算被跟概率时不做去牌，所以杂色 A 被略微低估。' },
      ],
    },
  },

  'push-fold-chart-12bb': {
    en: {
      title: '12bb Push/Fold Chart (9-Max Nash)',
      lead: 'At 12 big blinds the Nash jam ranges at a 9-handed table are {UTG}% from UTG, {MP}% from MP, {CO}% from the cutoff, {BTN}% from the button and {SB}% from the small blind. This is the stack where pure push/fold starts to give way to a raise-fold strategy — and the chart shows exactly which hands drop out first.',
      body: [
        'Twelve blinds sits on the boundary. It is still deep enough that a min-raise leaves you room to fold to a shove, and shallow enough that most of your value hands would rather just be all in. The honest way to use this chart is as the floor: any hand shown as a profitable jam is a hand you can always shove without thinking, whatever else you might do with it.',
        'The positions do not tighten evenly. Compare 10bb to 12bb: UTG barely moves ({UTG@10}% → {UTG}%), while the small blind drops from {SB@10}% to {SB}%. Early-position jam ranges are already so tight that another two blinds of depth changes almost nothing; the wide, steal-driven ranges are the ones that get pruned, because they were only ever profitable on fold equity.',
        'The EV numbers matter more here than at 8bb, because the stack is big enough that being called actually hurts. A jam that runs at +0.02bb is not a strategy — it is noise. Build your range from the hands that show a clear positive number and leave the near-zero band for the spots where you have a read.',
      ],
      faq: [
        { q: 'Is 12bb still a push/fold stack?', a: 'Mostly. A min-raise is playable at 12bb, but push/fold gives up very little EV and eliminates every post-flop mistake. If you are not confident in your raise-fold game, jamming this chart is the higher-EV choice in practice even if it is theoretically slightly worse.' },
        { q: 'Why does the UTG range barely change between 10bb and 12bb?', a: 'Because it is already close to its floor ({UTG@10}% → {UTG}%). UTG jams only hands that are profitable against eight players who can wake up with anything — pairs and big aces — and those hands stay profitable at almost any short stack. The ranges that shrink with depth are the wide ones (BTN, SB) that depend on fold equity.' },
      ],
    },
    zh: {
      title: '12bb 推弃图（9人桌 Nash）',
      lead: '12 个大盲时，9 人桌的 Nash 全下范围是：UTG {UTG}%、MP {MP}%、CO {CO}%、按钮 {BTN}%、小盲 {SB}%。这是纯推弃开始让位给「加注—弃牌」的筹码档——图里能看清哪些牌最先掉出去。',
      body: [
        '12bb 正好在边界上：还深到可以最小加注、面对全下再弃；又浅到大多数价值牌宁可直接全下。**诚实的用法是把这张图当作下限**——图上显示为盈利全下的牌，你随时可以闭眼推，不管你还打算拿它做什么。',
        '各个位置收紧得并不均匀。对比 10bb 和 12bb：UTG 几乎没动（{UTG@10}% → {UTG}%），小盲却从 {SB@10}% 掉到 {SB}%。前位的推弃范围本来就紧到不能再紧，多两个盲注的深度几乎不改变什么；被砍掉的是那些宽的、靠偷盲支撑的范围——因为它们本来就只靠弃牌赢率盈利。',
        'EV 数字在这里比 8bb 时更要紧，因为筹码已经大到「被跟真的疼」。一个 +0.02bb 的全下不是策略，是噪声。用那些明确为正的牌搭建你的范围，把接近零的那一带留给你有 read 的局面。',
      ],
      faq: [
        { q: '12bb 还算推弃筹码吗？', a: '基本还算。12bb 最小加注是可行的，但纯推弃只损失极少 EV，同时消灭了全部翻后错误。如果你对自己的「加注—弃牌」没把握，照这张图推——实战 EV 反而更高，哪怕理论上略差一点。' },
        { q: '为什么 UTG 的范围在 10bb 到 12bb 之间几乎不变？', a: '因为它已经接近下限了（{UTG@10}% → {UTG}%）。UTG 只推那些「面对 8 个随时可能醒过来的人也盈利」的牌——对子和大 A——而这些牌在几乎任何短码下都盈利。随深度缩水的是那些靠弃牌赢率吃饭的宽范围（BTN、SB）。' },
      ],
    },
  },

  'push-fold-chart-15bb': {
    en: {
      title: '15bb Push/Fold Chart (9-Max Nash)',
      lead: 'At 15 big blinds the Nash jam ranges are {UTG}% from UTG, {MP}% from MP, {CO}% from the cutoff, {BTN}% from the button and {SB}% from the small blind at a 9-handed table. At this depth a jam is no longer your only option — but knowing which hands are still a profitable shove is what keeps a raise-fold strategy honest.',
      body: [
        'Fifteen blinds is where most good players stop shoving and start raising. That does not make this chart obsolete — it makes it a benchmark. Any hand that is a clearly profitable jam at 15bb is a hand strong enough to get all the money in preflop; anything below that line should be raised with a plan, not shoved out of laziness.',
        'The ranges have compressed hard from 8bb: the button is down from {BTN@8}% to {BTN}%, the small blind from {SB@8}% to {SB}%, and UTG has almost bottomed out at {UTG}%. Notice which hands survive at every stack — pairs and big suited aces — and which vanish first: the offsuit gappers and weak suited kings that only ever worked because someone had to fold.',
        'A word on ICM: all of these numbers are pure chip EV. On a final-table bubble, a 15bb shove that is +0.05bb in chips can be clearly losing in real money, because busting costs you more than the chips are worth. Use these ranges as the chip-EV baseline and tighten from there whenever pay jumps are close.',
      ],
      faq: [
        { q: 'Should I still push/fold at 15bb?', a: 'You have real options at 15bb — a raise leaves you room to fold. But the shoving ranges here are still the correct benchmark: any hand that is a clear +EV jam is strong enough to get all in preflop. Below that line, raise with a plan rather than shoving by default.' },
        { q: 'Do these charts account for ICM?', a: 'No. They are chip-EV Nash equilibria. Near a pay jump, busting costs more than the chips you win are worth, so the correct ranges are tighter than these — especially for the medium stacks who can afford to wait. Treat these as the chip-EV baseline and tighten on the bubble.' },
      ],
    },
    zh: {
      title: '15bb 推弃图（9人桌 Nash）',
      lead: '15 个大盲时 9 人桌的 Nash 全下范围：UTG {UTG}%、MP {MP}%、CO {CO}%、按钮 {BTN}%、小盲 {SB}%。这个深度全下已经不是唯一选项——但知道「哪些牌仍然是盈利的全下」，正是让「加注—弃牌」策略不跑偏的标尺。',
      body: [
        '15bb 是大多数好手停止全下、改为加注的分界。这不代表这张图作废了——它变成了一把**标尺**：在 15bb 明确盈利的全下牌，就是强到可以翻前把钱全推进去的牌；线以下的牌，该带着计划加注，而不是图省事全下。',
        '相比 8bb，范围压缩得很厉害：按钮从 {BTN@8}% 掉到 {BTN}%，小盲从 {SB@8}% 掉到 {SB}%，UTG 基本触底在 {UTG}%。注意哪些牌在每一档都活着——对子和大同花 A；哪些牌最先消失——那些靠「总得有人弃牌」才成立的杂色缺张连子和弱同花 K。',
        '关于 ICM 一句话：这些数字全是**纯筹码 EV**。在终桌泡沫上，一个筹码 EV +0.05bb 的 15bb 全下，换算成真钱可能是明确亏损——因为出局的代价大于赢到的筹码。把这些范围当作筹码 EV 的基准线，奖金跳跃临近时在此基础上收紧。',
      ],
      faq: [
        { q: '15bb 还该推弃吗？', a: '15bb 你已经有真正的选项了——加注之后还有空间弃牌。但这里的全下范围仍是正确的标尺：任何明确 +EV 的全下牌，都强到足以翻前把钱推光。线以下的牌，带计划加注，别默认全下。' },
        { q: '这些图考虑 ICM 吗？', a: '不考虑，它们是筹码 EV 的 Nash 均衡。临近奖金跳跃时，出局的代价大于你赢到的筹码，所以正确范围比这更紧——尤其是那些等得起的中等筹码。把这些当筹码 EV 基准，泡沫上再收紧。' },
      ],
    },
  },

  'push-fold-chart-20bb': {
    en: {
      title: '20bb Push/Fold Chart (9-Max Nash)',
      lead: 'At 20 big blinds the Nash jam ranges are {UTG}% from UTG, {MP}% from MP, {CO}% from the cutoff, {BTN}% from the button and {SB}% from the small blind. Twenty blinds is past the point where jamming is the best strategy — which is exactly why the chart is worth knowing.',
      body: [
        'At 20bb you have room to raise, see a flop and still fold, so a jam-or-fold strategy leaves EV on the table. Read this chart as a boundary rather than a plan: it tells you the exact point at which a hand stops being worth 20 big blinds preflop. Everything on it is a hand you can always get all in with; everything below it is a hand you should not.',
        'The compression from the short stacks is severe. The button has fallen from {BTN@8}% at 8bb to {BTN}%, the cutoff from {CO@8}% to {CO}%, and UTG is down to {UTG}% — barely more than pairs and big aces. What disappears first is exactly what you would expect: the hands that were only ever profitable because someone had to fold.',
        'The other use for this page is defensive. When an opponent shoves 20bb at you, the range below is what a correct shove looks like. If they are jamming much wider than this, your calling range should widen with it — but only on evidence, not on a feeling that "nobody has a hand at 20bb".',
      ],
      faq: [
        { q: 'Should you push/fold at 20bb?', a: 'Not as a default. At 20bb a raise leaves you room to fold to a 3-bet and to play a flop, and jamming throws all of that away. Use these ranges as a floor — a hand that is a clear +EV jam at 20bb is strong enough to get all in preflop — and raise the rest with a plan.' },
        { q: 'What is the 20bb shoving range from the button?', a: 'About {BTN}% of hands at a 9-handed table, down from {BTN@10}% at 10bb. The full chart with per-hand EV is on this page. Remember these are chip-EV numbers with no ICM: near a pay jump the correct range is tighter.' },
      ],
    },
    zh: {
      title: '20bb 推弃图（9人桌 Nash）',
      lead: '20 个大盲时的 Nash 全下范围：UTG {UTG}%、MP {MP}%、CO {CO}%、按钮 {BTN}%、小盲 {SB}%。20bb 已经过了「全下是最优策略」的那个点——而这恰恰是这张图值得看的理由。',
      body: [
        '20bb 你还有空间加注、看翻牌、必要时弃牌，所以纯推弃是在白扔 EV。**把这张图当边界看，而不是当计划**：它告诉你一手牌在什么位置就不再值得翻前投 20 个大盲。图上有的，你随时可以把钱全推进去；图下面的，就不该推。',
        '相比短码，压缩得非常厉害：按钮从 8bb 的 {BTN@8}% 掉到 {BTN}%，CO 从 {CO@8}% 掉到 {CO}%，UTG 只剩 {UTG}%——基本只剩对子和大 A。最先消失的正是你能想到的那些牌：本来就只靠「总得有人弃牌」才盈利的牌。',
        '这一页的另一个用途是**防守**。对手朝你推 20bb 时，下面这个范围就是「正确的全下」长什么样。如果他推得明显比这宽，你的跟注范围也该跟着放宽——但要凭证据，而不是凭「20bb 谁会有牌啊」这种感觉。',
      ],
      faq: [
        { q: '20bb 该推弃吗？', a: '不该作为默认打法。20bb 加注之后你还有空间面对 3-bet 弃牌、还能打翻牌，全下把这些全扔了。把这些范围当**下限**用——在 20bb 明确 +EV 的全下牌，就强到足以翻前把钱推光——其余的牌带着计划加注。' },
        { q: '20bb 按钮位的全下范围是多少？', a: '9 人桌约 {BTN}%，比 10bb 的 {BTN@10}% 紧了不少。完整的图与每手 EV 都在本页。记住这些是筹码 EV、不含 ICM：临近奖金跳跃时正确范围更紧。' },
      ],
    },
  },

  /* ═══════════ 大盲跟注全下(vs BTN)═══════════ */
  'bb-call-vs-jam-10bb': {
    en: {
      title: 'BB Calling Range vs a 10bb Button Shove',
      lead: 'When the button moves all in for 10 big blinds and you are in the big blind, you call with about {call}% of hands ({hands} hand classes). You are getting a good price — 1bb is already yours and you are calling 9bb to win a pot of about 21bb — but the button is jamming {btnjam}%, so most hands still fold.',
      body: [
        'This is the mirror image of the jamming chart, and it is the half most players never learn. The price you are getting means you need roughly 42% equity to call — that sounds like a lot, but against a {btnjam}% shoving range, hands as weak as K9s and A7o clear it. Folding a hand that has 45% equity for the right price is the most expensive mistake in short-stack poker, and it is invisible.',
        'The calling range is dominated by two families: any pair (even 22 is a call — it is a coin flip against two overcards and ahead of every unpaired hand that is not two overcards), and ace-x. Suited connectors that would happily play a flop from a raise are folds here: with no implied odds and no fold equity, 76s is simply behind.',
        'Watch how the calling range shrinks as stacks get deeper: {call@10}% at 10bb, {call@15}% at 15bb, {call@20}% at 20bb. The price gets worse every blind you add, because the amount you must call grows while the dead money in the middle stays the same.',
      ],
      faq: [
        { q: 'What hands should I call a 10bb button shove with from the big blind?', a: 'About {call}% of hands — all pairs, most aces, strong kings and the better suited broadways. You need roughly 42% equity because you are calling 9bb to win about 21bb, and against a {btnjam}% jamming range plenty of hands clear that bar. The chart lists all {hands} hand classes with their EV.' },
        { q: 'Should I call an all-in with 22 in the big blind?', a: 'Against a 10bb button jam, yes. A small pair is at worst a slight underdog to two overcards (about 48%) and a big favourite against everything else in a {btnjam}% range. At the price you are getting, that is a comfortable call — folding it is a real, if invisible, loss.' },
      ],
    },
    zh: {
      title: '大盲跟注按钮 10bb 全下的范围',
      lead: '按钮 10bb 全下、你在大盲时，跟注约 {call}% 的牌（{hands} 个手牌类）。价格很好——1bb 本来就是你的，你再付 9bb 去争约 21bb 的底池——但按钮推的是 {btnjam}%，所以大多数牌仍然要弃。',
      body: [
        '这是全下图的镜像，也是绝大多数人从来没学过的那一半。这个价格意味着你需要约 42% 的赢率才能跟——听着很高，但面对一个 {btnjam}% 的全下范围，弱到 K9s、A7o 的牌都够得着。**在正确价格下弃掉一手有 45% 赢率的牌，是短码扑克里最贵的错误——而且它是隐形的。**',
        '跟注范围由两大家族主导：任何对子（连 22 都跟——它对两张高牌是抛硬币，对一切「不是两张高牌」的无对牌都领先），以及 A-x。那些在被加注时乐意打翻牌的同花连子，在这里是弃牌：既没有隐含赔率、又没有弃牌赢率，76s 就是单纯落后。',
        '注意跟注范围随筹码变深而缩小：10bb 跟 {call@10}%、15bb 跟 {call@15}%、20bb 跟 {call@20}%。每加一个盲注价格都更差——因为你要付的钱在涨，中间的死钱却没变。',
      ],
      faq: [
        { q: '大盲面对按钮 10bb 全下该用哪些牌跟？', a: '约 {call}%——全部对子、绝大多数 A、强 K 和较好的同花大牌。你需要约 42% 赢率（付 9bb 争约 21bb），面对 {btnjam}% 的全下范围有不少牌都够。图里列了全部 {hands} 个手牌类及其 EV。' },
        { q: '大盲拿 22 该跟全下吗？', a: '面对按钮 10bb 全下——该跟。小对最差也就是对两张高牌略微落后（约 48%），对一个 {btnjam}% 范围里其余的一切都是大热门。在这个价格下这是一个舒服的跟注；弃掉它是实打实的损失，只是你看不见。' },
      ],
    },
  },

  'bb-call-vs-jam-15bb': {
    en: {
      title: 'BB Calling Range vs a 15bb Button Shove',
      lead: 'Against a 15bb button all-in you call about {call}% of hands from the big blind ({hands} hand classes) — much tighter than at 10bb. You are risking 14bb to win about 31bb, so you need roughly 45% equity, and the button is jamming a tighter {btnjam}%.',
      body: [
        'Two things move against you at once when the stack grows from 10bb to 15bb: the price gets worse (you must call 14bb instead of 9bb for a pot that grew by less), and the button\'s jamming range tightens from {btnjam@10}% to {btnjam}%. Both effects push in the same direction, which is why the calling range falls from {call@10}% to {call}%.',
        'The hands that survive are the ones with raw showdown strength against a real range: medium pairs and up, ace-ten and better, KQ. The speculative calls that worked at 10bb — the smallest pairs, weak aces, suited kings — fall away because they were only ever calling on price, and the price is gone.',
        'A subtle point most players miss: at this depth the button is also jamming fewer bluffs, so your marginal calls are running into more genuine hands. Do not extrapolate a "he shoves a lot" read from the 10bb chart to a 15bb spot — the same player shoving correctly is shoving a different, stronger range.',
      ],
      faq: [
        { q: 'How wide should I call a 15bb shove in the big blind?', a: 'About {call}% — roughly {hands} hand classes: medium pairs and up, ace-ten and better, KQ and the strongest suited broadways. That is far tighter than your calling range against a 10bb jam ({call@10}%), because the price is worse and the button\'s jamming range is tighter.' },
        { q: 'Why do I call less at 15bb than at 10bb?', a: 'Two reasons stack up. You must call 14bb instead of 9bb for a pot that has not grown proportionally, so you need more equity (~45% instead of ~42%); and the button jams {btnjam}% instead of {btnjam@10}%, so the range you are up against is stronger. Both say: fold more.' },
      ],
    },
    zh: {
      title: '大盲跟注按钮 15bb 全下的范围',
      lead: '面对按钮 15bb 全下，大盲跟注约 {call}%（{hands} 个手牌类）——比 10bb 时紧得多。你要冒 14bb 去争约 31bb，需要约 45% 赢率，而按钮推的范围也收紧到了 {btnjam}%。',
      body: [
        '筹码从 10bb 涨到 15bb，有两件事同时对你不利：**价格变差**（要付 14bb 而不是 9bb，底池却没按比例长大），以及**按钮的全下范围从 {btnjam@10}% 收紧到 {btnjam}%**。两个效应同向叠加——所以跟注范围从 {call@10}% 掉到 {call}%。',
        '活下来的是那些「对一个真实范围也有硬摊牌价值」的牌：中对及以上、AT 及以上、KQ。10bb 时靠价格成立的那些投机跟注——最小的对子、弱 A、同花 K——全部退场，因为它们本来就只是在跟价格，而价格没有了。',
        '一个大多数人忽略的细节：这个深度上按钮的诈唬全下也变少了，所以你那些边缘跟注撞上的真牌更多。**别把 10bb 得来的「他推很宽」的 read 直接套到 15bb**——同一个打得正确的人，在这里推的是另一份、更强的范围。',
      ],
      faq: [
        { q: '大盲面对 15bb 全下该跟多宽？', a: '约 {call}%——约 {hands} 个手牌类：中对及以上、AT 及以上、KQ 和最强的那几手同花大牌。比面对 10bb 全下时（{call@10}%）紧得多，因为价格更差、按钮的推牌范围也更紧。' },
        { q: '为什么 15bb 比 10bb 跟得更少？', a: '两个原因叠加：你要付 14bb 而不是 9bb，底池却没成比例变大，所以需要更多赢率（约 45% 而非约 42%）；同时按钮推的是 {btnjam}% 而不是 {btnjam@10}%，你面对的范围更强。两条都指向同一个结论——多弃。' },
      ],
    },
  },

  'bb-call-vs-jam-20bb': {
    en: {
      title: 'BB Calling Range vs a 20bb Button Shove',
      lead: 'Against a 20bb button all-in you call only about {call}% of hands ({hands} hand classes) from the big blind. You are risking 19bb to win about 41bb, which needs roughly 46% equity — and at this depth a shove usually means a genuinely strong hand.',
      body: [
        'Twenty blinds is deep enough that shoving is no longer standard, and that changes everything about how you should call. A player who jams 20bb is either following a jam-or-fold chart correctly — in which case they have a strong range — or they are making a mistake by removing all their own post-flop equity. Against the first player you need the range below; against the second, you can call a little wider, but only if you are sure.',
        'The calling range has narrowed to the hands that beat a real range in a raw showdown: medium and big pairs, AJ+, and KQ. The small pairs are gone. They were never good against strong hands — they were good against the wide, bluff-heavy shoves you get at 10bb, and those shoves do not exist here.',
        'The counterintuitive part is that you fold more as your equity in the pot grows. That is correct: the dead money (your 1bb blind) is a constant, but the amount you must risk to claim it has doubled. Price, not hand strength, is what moved.',
      ],
      faq: [
        { q: 'How wide should the big blind call a 20bb all-in?', a: 'About {call}% — roughly {hands} hand classes: medium-to-big pairs, AJ and better, KQ. You are calling 19bb to win about 41bb, so you need around 46% equity, and a correct 20bb shoving range ({btnjam}% from the button) is strong enough that only genuinely good hands clear that bar.' },
        { q: 'Is a 20bb shove from the button a mistake?', a: 'Usually, yes — at 20bb the button has room to raise, see a flop and still fold, and shoving throws all of that away. But be careful: a player who jams 20bb because a chart told them to has a strong range ({btnjam}%), and calling wide against them is the mistake. Only widen when you have a specific reason to think they are shoving badly.' },
      ],
    },
    zh: {
      title: '大盲跟注按钮 20bb 全下的范围',
      lead: '面对按钮 20bb 全下，大盲只跟约 {call}%（{hands} 个手牌类）。你要冒 19bb 去争约 41bb，需要约 46% 赢率——而这个深度上敢推全下的，通常是真有牌。',
      body: [
        '20bb 已经深到全下不再标准，这彻底改变了你该怎么跟。一个 20bb 敢推的人，要么是在正确执行推弃表——那他的范围很强；要么是在犯错——他自己把翻后赢率全扔了。对前者你只能用下面这个范围；对后者可以稍微放宽，但前提是你**确定**。',
        '跟注范围已经窄到只剩「在硬摊牌里打得过真实范围」的牌：中大对子、AJ+、KQ。小对全部消失——它们从来不是在打强牌，而是在打 10bb 那种宽而多诈唬的全下，而那种全下在这里不存在。',
        '反直觉的地方是：**你在底池里的份额变大了，你反而弃得更多**。这是对的——死钱（你那 1bb 盲注）是常数，而你为了争它要冒的钱翻了一倍。变的是价格，不是牌力。',
      ],
      faq: [
        { q: '大盲面对 20bb 全下该跟多宽？', a: '约 {call}%——约 {hands} 个手牌类：中大对子、AJ 及以上、KQ。你付 19bb 争约 41bb，需要约 46% 赢率；而一个正确的 20bb 全下范围（按钮 {btnjam}%）强到只有真正的好牌才够得着。' },
        { q: '按钮 20bb 全下是错的吗？', a: '通常是错的——20bb 他还有空间加注、看翻牌、必要时弃牌，全下把这些全扔了。但要小心：一个照着推弃表在 20bb 全下的人，范围是强的（{btnjam}%），对他跟得宽才是错。只有当你有具体理由相信他推得很烂时才放宽。' },
      ],
    },
  },
};

/* ——— 单挑推弃(SB 全下 + BB 跟注),7 档各写一段「这一档的特征」———
   百分比全部走占位符({jam}/{call},跨档写 {jam@5}),由生成器从 HU_PUSHFOLD 现算填入。 */
const HU = {
  5: {
    en: [
      'At five big blinds heads-up, the small blind is shoving {jam}% of all hands and the big blind is calling {call}%. This is nearly a coin-flip contest between two very wide ranges — the hand you are dealt matters far less than getting the frequencies right.',
      'The pot is 1.5bb before the shove and the small blind risks 4.5bb to win it, so almost any two cards show a profit. The big blind, calling 4bb into a pot of 9.5bb, needs only about 42% equity — which is why hands well outside any normal calling range are still calls here.',
      'At this depth there is essentially no folding equity left for either player and no post-flop game to speak of. Play the chart, and do not let a bad run of showdowns talk you into folding hands that the maths says are profitable.',
    ],
    zh: [
      '单挑 5 个大盲时，小盲全下 {jam}% 的牌，大盲跟注 {call}%。这几乎是两个极宽范围之间的抛硬币比赛——你拿到什么牌，远不如把频率打对来得重要。',
      '全下之前底池 1.5bb，小盲冒 4.5bb 去争它，所以几乎任何两张牌都盈利。大盲付 4bb 去争 9.5bb 的底池，只需要约 42% 的赢率——所以一大批平时根本进不了跟注范围的牌，在这里也是跟。',
      '这个深度上双方基本都没有弃牌赢率、也谈不上什么翻后。照表打，别让一串难看的摊牌把你劝退到去弃那些数学上明明盈利的牌。',
    ],
  },
  8: {
    en: [
      'At eight blinds the small blind still jams {jam}% but the big blind\'s calling range has collapsed to {call}%. That gap is where the small blind\'s profit comes from: every hand the big blind folds is 1.5bb won without a showdown.',
      'The big blind tightening from {call@5}% to {call}% while the small blind barely moves ({jam@5}% → {jam}%) is the single most important pattern in heads-up push/fold. The caller\'s price gets worse much faster than the shover\'s risk does, because the dead money in the middle stays fixed at 1.5bb no matter how deep the stacks are.',
      'Practical consequence: against an opponent who calls 8bb shoves like it is 5bb, you should shove nearly everything and let them pay for it. Against one who calls correctly, the marginal hands at the bottom of the chart are close to indifferent and can be folded without cost.',
    ],
    zh: [
      '8 个大盲时，小盲仍推 {jam}%，但大盲的跟注范围已经塌到 {call}%。这个缺口正是小盲的利润来源：**每一手大盲弃掉的牌，都是不用摊牌就赢到的 1.5bb**。',
      '大盲从 {call@5}% 紧到 {call}%、小盲却几乎没动（{jam@5}% → {jam}%）——这是单挑推弃里最重要的一条规律。跟注方的价格恶化得比全下方的风险快得多，因为中间的死钱不管筹码多深都固定是 1.5bb。',
      '实战推论：碰上一个把 8bb 全下当 5bb 来跟的对手，你几乎该推所有牌、让他付账。碰上一个跟得正确的对手，图底部那些边缘牌接近无差异，弃掉也不损失什么。',
    ],
  },
  10: {
    en: [
      'Ten blinds heads-up: the small blind jams {jam}%, the big blind calls {call}%. The small blind is still shoving the majority of hands and the big blind is now folding nearly two thirds of them — the fold equity gap is at its widest here.',
      'This is the classic heads-up push/fold stack and the one worth memorising if you memorise only one. Note that the small blind\'s range has barely tightened from 5bb ({jam@5}% → {jam}%) while the big blind\'s has collapsed ({call@5}% → {call}%).',
      'The bottom of the small blind\'s range — the hands showing +0.01 to +0.02bb in the EV table below — is where the fold equity is doing all the work. Those hands lose at showdown; they win because the big blind folds.',
    ],
    zh: [
      '单挑 10bb：小盲推 {jam}%，大盲跟 {call}%。小盲仍在推大多数牌，而大盲现在要弃掉将近三分之二——**弃牌赢率的缺口在这里最大**。',
      '这是最经典的单挑推弃筹码；如果你只背一档，就背这一档。注意小盲的范围从 5bb 到这里几乎没怎么紧（{jam@5}% → {jam}%），大盲却塌了下来（{call@5}% → {call}%）。',
      '小盲范围的底部——下面 EV 表里那些只有 +0.01 到 +0.02bb 的牌——正是弃牌赢率在独自撑着。这些牌摊牌是输的；它们赢，是因为大盲弃了。',
    ],
  },
  12: {
    en: [
      'At twelve blinds the small blind jams {jam}% and the big blind calls {call}%. The shoving range has finally started to shrink meaningfully — down from {jam@10}% at 10bb — because being called now costs 12bb instead of 10bb for the same 1.5bb prize.',
      'This is roughly where a raise-fold strategy becomes genuinely better than pure jamming heads-up. The chart still tells you something essential: the hands below the jamming line are the ones you should never get all in with preflop, whatever line you take.',
      'The big blind\'s calling range at {call}% is now clearly value-weighted. Bluff-catching a 12bb shove with a hand like J9o is a losing proposition; hands that call profitably are pairs, aces, and the better kings.',
    ],
    zh: [
      '12 个大盲时小盲推 {jam}%、大盲跟 {call}%。全下范围终于开始明显缩水——比 10bb 的 {jam@10}% 少了一截——因为被跟的代价变成了 12bb，而奖品还是那 1.5bb。',
      '这大约就是「加注—弃牌」在单挑里真正开始优于纯全下的地方。但这张图仍然告诉你一件要紧的事：**推牌线以下的那些牌，不管你走哪条线，翻前都不该把钱全推进去**。',
      '大盲 {call}% 的跟注范围已经明显偏价值。拿 J9o 去抓一个 12bb 的全下是亏的；能盈利跟注的是对子、A，以及较好的 K。',
    ],
  },
  15: {
    en: [
      'Fifteen blinds heads-up: small blind jams {jam}%, big blind calls {call}%. Both ranges are now clearly shaped by showdown value rather than fold equity, and pure push/fold is giving up real EV against a competent opponent.',
      'Use this chart as a floor, not a strategy. Anything shown as a comfortably profitable jam is a hand you can always get in preflop; the borderline hands at +0.01 to +0.03bb are the ones a raise-fold strategy plays much better.',
      'The big blind calling only {call}% here is the number to remember. Against most opponents, that is tighter than they actually call — which means shoving your strong hands still prints, and shoving your weak ones is now getting punished.',
    ],
    zh: [
      '单挑 15bb：小盲推 {jam}%、大盲跟 {call}%。两边的范围现在都由摊牌价值主导、而不是弃牌赢率了；面对一个像样的对手，纯推弃已经在真金白银地损失 EV。',
      '**把这张图当下限，不当策略**：显示为「舒服盈利」的全下，随时可以翻前把钱推光；那些 +0.01 到 +0.03bb 的边界牌，用「加注—弃牌」打会好得多。',
      '大盲只跟 {call}%——这是要记住的数字。比大多数对手实际的跟注频率都紧，这意味着：推强牌依然印钱，推弱牌开始挨罚。',
    ],
  },
  20: {
    en: [
      'At twenty blinds the small blind jams {jam}% and the big blind calls {call}%. This is past the point where jamming is the best strategy — but it is exactly the point where knowing the jamming range protects you from getting it in badly.',
      'The two ranges are now far apart: the small blind risks 20bb to win 1.5bb, and the big blind needs a genuinely good hand to pay it off. That asymmetry means a lot of the small blind\'s jams are still profitable purely on folds — but the downside when called has grown four-fold since 5bb.',
      'If your opponent shoves 20bb, they are usually either following a chart or making a mistake. The chart tells you which hands beat a correct {jam}% range; anything looser than that from them, and you can widen. Do not widen on a hunch.',
    ],
    zh: [
      '20 个大盲时小盲推 {jam}%、大盲跟 {call}%。全下已经**不是**最优策略了——但这恰恰是「知道全下范围」能保护你不把钱推烂的地方。',
      '两边范围现在拉得很开：小盲冒 20bb 去赢 1.5bb，大盲得有一手真正的好牌才愿意付账。这个不对称意味着小盲的很多全下仍然纯靠弃牌盈利——但被跟时的下行，比 5bb 时大了四倍。',
      '对手在 20bb 全下，通常要么是在照表打、要么是在犯错。这张图告诉你哪些牌打得过一个正确的 {jam}% 范围；只有当他明显比这更松时你才能放宽——**别凭感觉放宽**。',
    ],
  },
  25: {
    en: [
      'At twenty-five blinds the small blind jams {jam}% and the big blind calls {call}%. This is the deepest stack on the chart and the one where a jam-or-fold strategy is furthest from optimal — a raise-fold game beats it clearly here.',
      'So why publish it? Because it is the boundary. It tells you the exact point where a hand stops being worth 25bb preflop, and it tells you what a correct shove looks like when an opponent hands you one. The hands sitting at +0.01bb in the EV table are the whole lesson: they are barely a shove, and calling them wide is a mistake.',
      'The exploitability of this stack is among the highest on the chart, which is the honest way of saying the approximation is loosest here. Treat these numbers as a guide to the shape of the ranges, not as gospel on individual borderline hands.',
    ],
    zh: [
      '25 个大盲时小盲推 {jam}%、大盲跟 {call}%。这是图上最深的一档，也是「推或弃」离最优最远的一档——在这里「加注—弃牌」明显更强。',
      '那为什么还要发它？因为它是**边界**。它告诉你一手牌在什么位置就不再值得翻前投 25bb，也告诉你当对手把一个全下递给你时，正确的全下长什么样。EV 表里那些只有 +0.01bb 的牌就是全部的教训：它们勉强算全下，而跟得太宽是错。',
      '这一档的可利用度是全图最高的几档之一——这是「近似在这里最松」的诚实说法。请把这些数字当作范围形状的指引，而不是边界牌上的圣旨。',
    ],
  },
};

for (const bb of [5, 8, 10, 12, 15, 20, 25]) {
  module.exports[`heads-up-push-fold-${bb}bb`] = {
    en: {
      title: `Heads-Up Push/Fold Chart ${bb}bb (Nash)`,
      lead: `Heads-up at ${bb} big blinds: the Nash push/fold solution for both sides. The small blind jams {jam}% and the big blind calls {call}% — both shown as full 13×13 charts with the expected value of every hand in big blinds, including the hands that are close to a coin flip.`,
      body: HU[bb].en,
      faq: [
        { q: `What is the correct heads-up shoving range at ${bb}bb?`, a: `The small blind jams about {jam}% at ${bb}bb; the full Nash range is on this page with the EV of every hand. Hands showing between +0.00 and +0.03bb are close to indifferent — shoving or folding them costs almost nothing in the long run.` },
        { q: 'Do these heads-up charts assume the big blind plays correctly?', a: 'Yes — both ranges are the equilibrium against each other (the big blind calls {call}% here). If your opponent calls too wide, tighten your jams to value; if they fold too much, widen toward any two cards. The equilibrium is the baseline you deviate from, not a target to hit against a bad player.' },
      ],
    },
    zh: {
      title: `单挑推弃图 ${bb}bb（Nash）`,
      lead: `单挑 ${bb} 个大盲：双方的 Nash 推弃解。小盲全下 {jam}%、大盲跟注 {call}%——两边都以完整 13×13 图给出，**每一手牌都标了以 bb 为单位的期望值**，包括那些接近抛硬币的牌。`,
      body: HU[bb].zh,
      faq: [
        { q: `单挑 ${bb}bb 的正确全下范围是什么？`, a: `${bb}bb 时小盲推约 {jam}%；本页给出完整的 Nash 范围与每一手的 EV。EV 在 +0.00 到 +0.03bb 之间的牌接近无差异——推或弃，长期几乎没有差别。` },
        { q: '这些单挑图假设大盲打得正确吗？', a: '是的——两边范围互为均衡（这一档大盲跟 {call}%）。对手跟得太宽，你就把全下收紧到价值牌；对手弃得太多，你就往「任意两张」放宽。**均衡是你偏离的基线，不是面对烂对手时的目标。**' },
      ],
    },
  };
}
