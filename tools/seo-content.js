'use strict';
/*
 * seo-content.js — 每张落地页的**人工撰写**双语内容(标题 / 直接答案 / 策略正文 / 2 条 FAQ)。
 *
 * 分工:图表、组合数、百分比、边缘手、每手 EV —— 全部由 gen-seo-pages.js 从真实数据算出,
 *      这里只写「机器算不出来的那部分」:为什么这样打、怎么用这张图、常见误区。
 *
 * 诚实红线:所有数字必须来自 packs.js / pushfold 数据(可用 tools/ 下脚本复算),不得编造;
 *          自算 Nash 有可利用度(见 meta.exploitability),文案不许把它说成「GTO 精确解」。
 */
module.exports = {
  /* ═══════════ 现金局 RFI 开局范围 ═══════════ */
  'utg-opening-range-6max': {
    en: {
      title: 'UTG Opening Range (6-Max)',
      lead: 'From under the gun in a 6-max cash game you open about 16% of hands (214 combos) — pairs 22+, all suited aces, KTs+, QTs+, the suited connectors down to 76s, plus AJo+ and KQo. Five players still act behind you, so every hand you play has to survive four chances to be 3-bet.',
      body: [
        'UTG is the only seat where you are guaranteed to be out of position against the whole table post-flop. That single fact is what shrinks the range: hands like KJo or ATo make top pair with a bad kicker, get 3-bet by better, and then have to play the flop first for the rest of the hand. They belong in the mixed band, not the core opening range.',
        'What survives is hands with either raw equity (pairs, big broadways) or the ability to flop a strong draw and keep the pot manageable (suited aces, suited connectors). Notice that the range is suit-heavy: A5s is in, A5o is out. That is not a style choice — suitedness adds roughly 2–3 points of equity and, more importantly, gives you flushes and backdoor flushes to continue with when the board runs out badly for one pair.',
        'A common leak is opening this range to too large a size. UTG opens are usually 2.5bb in cash; the players behind fold often enough that you do not need a bigger raise to win the blinds, and a 3bb open just prices you into worse spots when the button flats.',
      ],
      faq: [
        { q: 'How wide should I open from UTG in 6-max?', a: 'About 16% of hands as your core raising range (roughly 214 of the 1,326 possible starting combos), stretching to ~21% if you include the marginal hands solvers mix in — 65s, 54s, K9s, Q9s, J9s, ATo, A9o, KJo and QJo. Against very passive tables you can lean toward the wider end; against a table that 3-bets a lot, stay at 16% or tighter.' },
        { q: 'Why is KJo not a standard UTG open?', a: 'It is dominated by exactly the hands that continue against you. When KJo gets called or 3-bet, the hands still in the pot are AK, AQ, KQ and pairs — all of which beat it. It also cannot flop a flush draw, so when it misses it has nothing. It sits in the mixed band: fine to open occasionally, wrong to open every time.' },
      ],
    },
    zh: {
      title: 'UTG 枪口位开局范围（6人桌）',
      lead: '6 人桌现金局枪口位（UTG）开局约 16%（214 个组合）：全部口袋对 22+、全部同花 A、KTs+、QTs+、同花连子到 76s，加上 AJo+ 与 KQo。身后还有 5 个人，你打出的每一手都要熬过 4 次被 3-bet 的机会。',
      body: [
        'UTG 是唯一一个「翻后必然对全桌都没位置」的座位——范围之所以要收紧，根子就在这。KJo、ATo 这类牌中顶对却带弱踢脚，被更好的牌 3-bet，之后每条街还要先说话。它们属于混合边缘带，不属于核心开局范围。',
        '能留下的牌只有两种：本身赢率够硬（对子、大同花张），或能击中强听牌、把底池控制住（同花 A、同花连子）。注意范围里同花牌明显更多：A5s 在里面，A5o 不在。这不是风格问题——同花大约多 2–3 个点的赢率，更关键的是牌面走坏时你还有花和后门花可以继续。',
        '常见漏洞是把这个范围开得太大。现金局 UTG 通常开 2.5bb 就够：身后弃牌足够频繁，你不需要更大的加注来拿盲注；开到 3bb 反而是在按钮平跟时把自己价格越推越差。',
      ],
      faq: [
        { q: '6 人桌 UTG 该开多宽？', a: '核心加注范围约 16%（1326 个起手组合里的约 214 个）；把 solver 会混打的边缘手也算上大约 21%——65s、54s、K9s、Q9s、J9s、ATo、A9o、KJo、QJo。桌子很被动时可以往宽的一端靠；桌上 3-bet 很多时就守住 16% 甚至更紧。' },
        { q: '为什么 KJo 不是标准的 UTG 开局牌？', a: '因为它被「愿意跟你打下去的那些牌」压制。KJo 被跟或被 3-bet 之后，池里还留着的是 AK、AQ、KQ 和对子——全都打得过它。它又做不出同花听牌，miss 了就什么都没有。所以它落在混合带：偶尔开可以，每次都开就错了。' },
      ],
    },
  },

  'hj-opening-range-6max': {
    en: {
      title: 'Hijack Opening Range (6-Max)',
      lead: 'From the hijack in 6-max you open about 21% of hands (282 combos) — one seat closer to the button than UTG, one fewer player to get through, and roughly a third more hands. The additions are the weaker suited aces and kings, more suited gappers, and A9o+/KJo+.',
      body: [
        'The hijack is where opening ranges start to widen for a concrete reason: only four players act behind you instead of five, and the two most dangerous of them (CO and BTN) still have position, but the blinds will be defending against a raise that folds out fewer hands. Each seat you move toward the button removes one chance of running into a premium, and the equilibrium range expands accordingly.',
        'The right hands to add are not "slightly worse offsuit broadways" — those still get dominated. Add suited hands: K9s, Q9s, J9s, T8s all become clear opens, because they flop draws, they can barrel on flush-completing runouts, and they do not need to win at showdown to be profitable. The offsuit additions (A9o, KJo, QJo) are much thinner and belong in the mixed band.',
        'Against a strong button who 3-bets 12%+, the correct adjustment is not to open tighter across the board — it is to drop the worst offsuit hands (KJo, QJo) first, since those are the hands that have to fold to a 3-bet and therefore realise the least equity.',
      ],
      faq: [
        { q: 'What is the difference between the HJ and UTG opening range?', a: 'About five percentage points: 21% from the hijack versus 16% from UTG in 6-max. The extra hands are mostly suited — K8s–K9s, Q8s–Q9s, J8s–J9s, T7s–T8s — plus a thin band of offsuit broadways (A8o, KTo, QTo, JTo) that solvers open only part of the time.' },
        { q: 'Is the hijack the same as MP in a 9-handed game?', a: 'Not quite. In 9-max, MP still has four players plus the blinds behind it and opens tighter (about 15.5%). The hijack in 6-max has only the CO, BTN and two blinds behind — fewer opponents means a wider range, which is why they are separate charts.' },
      ],
    },
    zh: {
      title: 'HJ 劫机位开局范围（6人桌）',
      lead: '6 人桌劫机位（HJ）开局约 21%（282 个组合）——比 UTG 靠近按钮一位、身后少一个人，牌就多了约三分之一。多出来的主要是较弱的同花 A / 同花 K、更多同花缺张连子，以及 A9o+ 和 KJo+。',
      body: [
        'HJ 是开局范围开始变宽的第一站，理由很具体：身后只剩 4 个人而不是 5 个，其中最危险的 CO 与 BTN 仍然有位置，但盲位面对你的加注要防守的牌更多。每往按钮挪一位，就少一次撞上超强牌的机会，均衡范围也随之变宽。',
        '该加进来的**不是**「稍差一点的杂色大牌」——那些照样被压制。要加的是同花牌：K9s、Q9s、J9s、T8s 都变成明确开局，因为它们能击中听牌、能在花完成的转/河继续开火，不必靠摊牌获胜也能盈利。杂色的那几手（A9o、KJo、QJo）薄得多，属于混合带。',
        '面对一个 3-bet 频率 12%+ 的强按钮，正确的调整不是全线收紧，而是**先砍掉最差的杂色牌**（KJo、QJo）——因为它们正是面对 3-bet 必须弃牌、赢率兑现最差的那批。',
      ],
      faq: [
        { q: 'HJ 和 UTG 的开局范围差多少？', a: '约 5 个百分点：6 人桌 HJ 约 21%，UTG 约 16%。多出来的以同花为主——K8s–K9s、Q8s–Q9s、J8s–J9s、T7s–T8s，再加上一小撮 solver 只部分频率开的杂色大牌（A8o、KTo、QTo、JTo）。' },
        { q: 'HJ 等于 9 人桌的 MP 吗？', a: '不完全等于。9 人桌的 MP 身后还有 4 个位置加两个盲注，开得更紧（约 15.5%）；6 人桌 HJ 身后只剩 CO、BTN 和两个盲注。对手更少 → 范围更宽，所以是两张不同的图。' },
      ],
    },
  },

  'co-opening-range-6max': {
    en: {
      title: 'Cutoff Opening Range (6-Max & 9-Max)',
      lead: 'The cutoff opens about 29% of hands (390 combos), widening to ~38% once the mixed band is included. Only the button and the blinds act behind you, so this is the first seat where suited gappers, weak suited kings and offsuit broadways all become standard raises.',
      body: [
        'The cutoff range is the same in 6-max and 9-max, and that is not laziness — it is a consequence of what actually matters preflop. What determines your opening range is not how many players are at the table, it is how many are still to act. From the CO there are exactly three: the button and the two blinds. Everyone in front has already folded, so a 9-handed CO and a 6-handed CO face an identical decision.',
        'The practical change from the hijack is that you now steal profitably with hands that have no showdown value at all. 96s, 85s and 64s go in because when the button and blinds fold — which happens often enough — you win the pot uncontested, and when they call you have a hand that flops draws and can barrel. The offsuit additions (A7o, A6o, K9o, Q9o, J9o, T9o) sit in the mixed band and should be dropped first against a 3-betting button.',
        'The most common mistake in the cutoff is opening the full 38% into a button who 3-bets aggressively. Against that player, the honest fix is to cut to about 29% (the core band) rather than to open wide and then fold to every 3-bet.',
      ],
      faq: [
        { q: 'Is the cutoff opening range different in 6-max and 9-max?', a: 'No. From the cutoff, exactly three players act behind you (BTN, SB, BB) regardless of table size — everyone earlier has already folded. That is why this chart serves both formats. The seats that genuinely differ between 6-max and 9-max are the early ones: UTG and MP.' },
        { q: 'Should I open 96s from the cutoff?', a: 'Yes, in the core range. It is not a hand that wins at showdown often, but it flops a pair, a straight draw or a flush draw a large share of the time, and it wins the blinds outright whenever the button and blinds fold. Against a button who almost never folds, tighten toward the 29% core and drop the offsuit gappers first.' },
      ],
    },
    zh: {
      title: 'CO 关煞位开局范围（6人桌 / 9人桌通用）',
      lead: 'CO（关煞位）开局约 29%（390 个组合），算上混合边缘带约 38%。身后只剩按钮和两个盲注，所以这是同花缺张连子、弱同花 K、杂色大牌第一次全都变成标准加注的位置。',
      body: [
        'CO 的范围在 6 人桌和 9 人桌是同一份，这不是偷懒——翻前真正决定范围的**不是牌桌有几个人，而是还有几个人没行动**。坐在 CO，身后永远正好三个：按钮和两个盲注；前面的人已经弃牌了。所以 9 人桌的 CO 和 6 人桌的 CO 面对的是同一个决策。',
        '相比 HJ，实际变化是：你现在可以用**完全没有摊牌价值的牌**去偷盲并且是盈利的。96s、85s、64s 进入范围，因为按钮和盲注弃牌的频率足够高——他们弃了你就白拿底池；他们跟了，你手上是一手能击中听牌、能连续开火的牌。杂色的那批（A7o、A6o、K9o、Q9o、J9o、T9o）落在混合带，面对爱 3-bet 的按钮应该最先砍掉。',
        'CO 最常见的错误是：面对一个 3-bet 很凶的按钮，还照开满 38%。对这种人，诚实的修法是把范围收回 29% 的核心带，而不是开得很宽、然后见 3-bet 就弃。',
      ],
      faq: [
        { q: 'CO 的开局范围在 6 人桌和 9 人桌不一样吗？', a: '一样。坐 CO 时身后恰好三个人（BTN、SB、BB），和牌桌总人数无关——前面的人已经弃牌了。所以这张图两种桌型通用。真正有差别的是前位：UTG 和 MP。' },
        { q: 'CO 该开 96s 吗？', a: '该开，它在核心范围里。它靠摊牌赢的次数不多，但击中一对、顺听或花听的比例很高，而且按钮和盲注一弃你就直接拿下底池。如果按钮几乎从不弃牌，就收回 29% 核心带，并优先砍掉杂色缺张连子。' },
      ],
    },
  },

  'btn-opening-range-6max': {
    en: {
      title: 'Button Opening Range (6-Max & 9-Max)',
      lead: 'The button opens about 51% of hands (682 combos) as its core range, stretching to roughly 70% with the mixed band. Only the two blinds act behind you and you have position for the whole hand — which is why more than half of all starting hands are a profitable raise here.',
      body: [
        'The button is the most profitable seat in poker for one reason: it is the only seat that is guaranteed to act last on every post-flop street. Position is worth so much that hands which are clear folds anywhere else — 53s, 74s, K3o, 64o — become profitable opens, because you can see what your opponent does before you decide, and you can take the pot away on any street.',
        'Two blinds means two hands to get through, and both of them are folding a big chunk of the time. That fold equity alone pays for a large part of the range. What makes the button different from the cutoff is not just that you steal more often; it is that when you get called, you get to realise far more of your equity, so hands that would be losers out of position turn into winners.',
        'The button range is also where the mixed band matters most: the gap between the 51% core and the 70% wide version is 252 combos of genuinely marginal hands (Q2s–Q3s, J3s–J5s, T3s–T5s, K2o–K6o, 54o, 64o, 75o). Against blinds who defend and 3-bet correctly, open the core. Against blinds who overfold, the wide version is free money.',
      ],
      faq: [
        { q: 'How wide should I open on the button in 6-max?', a: 'Around 51% as the core range — about 682 of the 1,326 starting combos. Against blinds who fold too much you can push toward 70% by adding the mixed band (weak suited queens/jacks/tens, K2o–K6o, offsuit connectors). Against blinds who 3-bet a lot, stay at the core; the marginal hands are exactly the ones that have to fold to a 3-bet.' },
        { q: 'Is the button opening range the same in 6-max and 9-max?', a: 'Yes. On the button only the small blind and big blind act behind you, no matter how many seats the table has — everyone else has already folded. The same is true for the cutoff and the small blind. The early positions (UTG, MP) are where 6-max and 9-max ranges genuinely differ.' },
      ],
    },
    zh: {
      title: 'BTN 按钮位开局范围（6人桌 / 9人桌通用）',
      lead: '按钮位核心开局范围约 51%（682 个组合），算上混合带可到约 70%。身后只剩两个盲注，而且翻后整手牌你都有位置——这就是为什么超过一半的起手牌在这里加注都是盈利的。',
      body: [
        '按钮是扑克里最赚钱的座位，原因只有一个：它是唯一保证翻后每条街都最后行动的位置。位置值钱到什么程度？值钱到 53s、74s、K3o、64o 这些在别处必弃的牌，在这里开局也盈利——因为你可以先看对手怎么打再决定，而且任何一条街你都可以把底池抢走。',
        '身后只有两个盲注，意味着只需要闯过两只手，而这两只手都有很大比例会弃牌。光是这份弃牌赢率就付掉了范围里的一大部分。按钮和 CO 的真正差别不只是偷得更多，而是**被跟之后你能兑现的赢率高得多**——同一手牌在无位置时是亏的，在按钮上就变成赚的。',
        '按钮也是混合带最要紧的地方：51% 核心和 70% 宽版之间差着 252 个组合的真·边缘牌（Q2s–Q3s、J3s–J5s、T3s–T5s、K2o–K6o、54o、64o、75o）。盲注防守和 3-bet 都正确时，只开核心；盲注弃太多时，宽版是白送的钱。',
      ],
      faq: [
        { q: '6 人桌按钮该开多宽？', a: '核心范围约 51%——1326 个起手组合里的约 682 个。盲注弃牌过多时，可以把混合带加进来推到约 70%（弱同花 Q/J/T、K2o–K6o、杂色连子）。盲注 3-bet 很多时守住核心：那些边缘牌恰恰是面对 3-bet 必须弃掉的。' },
        { q: '按钮的开局范围在 6 人桌和 9 人桌一样吗？', a: '一样。坐按钮时身后只有小盲和大盲，与牌桌人数无关——其他人已经弃牌了。CO 和 SB 同理。真正有差别的是前位（UTG、MP）。' },
      ],
    },
  },

  'sb-opening-range-6max': {
    en: {
      title: 'Small Blind Opening Range (6-Max & 9-Max)',
      lead: 'When it folds to the small blind you raise about 42% of hands (554 combos), up to ~56% with the mixed band. You already have half a blind in and only one player left to beat — but you will be out of position for the entire hand if the big blind calls.',
      body: [
        'The small blind is a strange seat: the widest single-opponent spot in the game and the worst position at the same time. You are getting a good price to attack one player, and the big blind folds often enough that a raise shows an immediate profit with almost any two cards. But if the big blind calls or 3-bets — and a good big blind defends more than half the time — you play every post-flop street first.',
        'That is why the range is wide but shaped differently from the button: it leans much harder on suited hands and on hands that hold their value out of position. Suited aces (all of them), suited kings down to K3s and suited connectors are core opens; the offsuit filler (Q7o, J7o, T8o, 97o, 76o) sits in the mixed band and is the first thing to cut against a big blind who defends aggressively.',
        'The alternative strategy — limping part of the range — is genuinely viable and used by solvers at deeper stacks, but it is much harder to play well, and against most opponents a raise-or-fold strategy at this width captures nearly all of the available EV with far less complexity.',
      ],
      faq: [
        { q: 'How wide should the small blind open when it folds to them?', a: 'About 42% as the core raising range (554 combos), stretching to ~56% including the marginal offsuit hands solvers mix. That is much wider than any other non-button seat because only one player is left to act — but it is tighter than the button because you have no position post-flop.' },
        { q: 'Should I limp or raise from the small blind?', a: 'A raise-or-fold strategy at around 42% is simpler and captures most of the EV. Solvers do use a limping range in deep-stacked cash games, but it requires a well-constructed follow-up strategy for every board — get raise-or-fold right first, and only add limps once the rest of your preflop game is solid.' },
      ],
    },
    zh: {
      title: 'SB 小盲位开局范围（6人桌 / 9人桌通用）',
      lead: '轮到小盲、前面全弃时，加注约 42%（554 个组合），算上混合带约 56%。你已经投了半个盲注、只剩一个人要打败——但大盲一跟，整手牌你都没位置。',
      body: [
        '小盲是个矛盾的座位：全场对手最少（只有一个）、位置却最差。你用很好的价格去打一个人，而大盲弃牌的频率高到——几乎任何两张牌加注都能立刻见利。但如果大盲跟或 3-bet（好的大盲防守超过一半），那么翻后每条街你都要先说话。',
        '所以这个范围虽宽，形状却和按钮完全不同：它更依赖同花牌、更依赖那些「无位置也保值」的牌。全部同花 A、同花 K 到 K3s、同花连子是核心；杂色的填充牌（Q7o、J7o、T8o、97o、76o）在混合带，面对防守很凶的大盲要最先砍掉。',
        '另一条路——把一部分范围拿来跛入——在深筹码下确实是 solver 会用的策略，但它难打得多。对绝大多数对手，「加注或弃牌」在这个宽度上已经能吃掉几乎全部 EV，而复杂度低得多。',
      ],
      faq: [
        { q: '前面全弃到小盲，该开多宽？', a: '核心加注范围约 42%（554 个组合），把 solver 混打的杂色边缘手算上约 56%。这比任何非按钮位置都宽得多——因为只剩一个人要过；但又比按钮紧——因为翻后你没位置。' },
        { q: '小盲该跛入还是加注？', a: '「加注或弃牌」在约 42% 的宽度上更简单，也能吃掉绝大部分 EV。深筹码现金局里 solver 确实有跛入范围，但它要求你对每种牌面都有配套的后续策略。先把加注/弃牌打对，等翻前其他部分都稳了再考虑加跛入。' },
      ],
    },
  },

  'utg-opening-range-9max': {
    en: {
      title: 'UTG Opening Range (9-Max / Full Ring)',
      lead: 'Under the gun at a full 9-handed table you open only about 12% of hands (156 combos): 55+, A9s+ plus A5s, KTs+, QJs, JTs, T9s, AJo+ and KQo. Eight players act behind you — the tightest opening range in the game.',
      body: [
        'Full ring UTG is the one spot where the old-school advice — "only play premium hands" — is actually correct, and the maths is simple. Every player behind you is another chance that someone wakes up with a hand better than yours. With eight of them, even a hand as strong as AJo is only marginally profitable, and small pairs below 55 lose money because they rarely flop a set and cannot continue when they miss.',
        'Notice what is missing compared to the 6-max UTG range: the small pairs (22–44), the weak suited aces (A2s–A8s), and the middle suited connectors (76s, 87s). They are all hands that need either a lot of players to pay them off when they hit, or a lot of fold equity — and from full-ring UTG you have neither. A5s stays in as the one exception because it blocks AA and AK and makes the nut flush and the wheel.',
        'If your table is passive and rarely 3-bets, you can add A8s, KJs and 44 — but do not add offsuit hands. From this seat, offsuit hands outside AJo+/KQo lose money no matter how bad the table is.',
      ],
      faq: [
        { q: 'How tight should I play UTG in a 9-handed game?', a: 'About 12% of hands — roughly 156 of the 1,326 starting combos. That is 55+, A9s+ and A5s, KTs+, QJs, JTs, T9s, AJo and better, plus KQo. It is tighter than the 6-max UTG range (16%) for one reason: three more players behind you.' },
        { q: 'Can I open 22 from UTG at a full ring table?', a: 'No — it loses money. Small pairs need to hit a set (about 12% of flops) and then get paid, and from UTG you have neither the implied odds nor the position to make that work. The cutoff for pairs from full-ring UTG is 55.' },
      ],
    },
    zh: {
      title: 'UTG 枪口位开局范围（9人桌 / 满员桌）',
      lead: '9 人满员桌的枪口位只开约 12%（156 个组合）：55+、A9s+ 加 A5s、KTs+、QJs、JTs、T9s、AJo+ 和 KQo。身后 8 个人——这是全牌桌最紧的开局范围。',
      body: [
        '满员桌 UTG 是老派建议「只打大牌」唯一真正正确的地方，算术也很简单：身后每多一个人，就多一次有人拿到比你更好的牌的机会。有 8 个人的时候，连 AJo 这么强的牌都只是勉强盈利；55 以下的小对子是亏钱的——很少中三条，miss 了又没法继续。',
        '和 6 人桌 UTG 范围比，少掉的是：小对（22–44）、弱同花 A（A2s–A8s）、中同花连子（76s、87s）。这些牌要么需要很多人在你击中时付钱，要么需要很大的弃牌赢率——而满员桌 UTG 两样都没有。A5s 是唯一例外：它阻断 AA/AK，还能做出坚果同花和轮子顺。',
        '如果你的桌子很被动、几乎不 3-bet，可以加 A8s、KJs、44——但**不要加杂色牌**。这个位置上，AJo+/KQo 以外的杂色牌，桌子再烂也是亏的。',
      ],
      faq: [
        { q: '9 人桌 UTG 该打多紧？', a: '约 12%——1326 个起手组合里的约 156 个：55+、A9s+ 与 A5s、KTs+、QJs、JTs、T9s、AJo 及以上、KQo。比 6 人桌 UTG（16%）更紧，理由只有一个：身后多了三个人。' },
        { q: '满员桌 UTG 能开 22 吗？', a: '不能，它是亏钱的。小对要靠中三条（约 12% 的翻牌）再被付钱，而 UTG 既没有足够的隐含赔率、也没有位置去实现它。满员桌 UTG 的对子分界线是 55。' },
      ],
    },
  },

  'mp-opening-range-9max': {
    en: {
      title: 'MP Opening Range (9-Max / Full Ring)',
      lead: 'From middle position at a 9-handed table you open about 15.5% of hands (206 combos): 44+, A8s+ with A5s–A4s, KTs+, QTs+, J9s+, T9s, 98s, ATo+ and KJo+. Six players still act behind you.',
      body: [
        'Middle position in full ring is UTG with a little breathing room. The two extra folds in front of you remove the two tightest ranges from the pot, which is worth about three and a half percentage points of opening width — small pairs down to 44, weak suited aces down to A8s, and the suited one-gappers (J9s, T9s, 98s) all become profitable.',
        'The hands that get added are almost all suited, and that is the pattern to internalise for every early seat: what makes a hand playable from up front is not raw high-card strength, it is the ability to make a hand that can stand a lot of pressure. 98s makes straights and flushes; K9o makes second-best top pair. Only one of them belongs in an early-position range.',
        'The single biggest full-ring leak is opening the 6-max middle-position range (the 6-max hijack is ~21%) from 9-max MP. Those extra three players behind are worth real money, and the hands you would add — K9s, Q9s, offsuit broadways — are precisely the hands that get dominated when someone behind wakes up.',
      ],
      faq: [
        { q: 'How wide should I open from MP in a 9-handed game?', a: 'About 15.5% — roughly 206 of the 1,326 starting combos: 44+, A8s and better plus A5s–A4s, KTs+, QTs+, J9s+, T9s, 98s, ATo+ and KJo+. That is a little under four points wider than the 9-max UTG range and clearly tighter than any 6-max seat except UTG.' },
        { q: 'Why is 98s an open from MP but 76s is not?', a: 'Both make straights and flushes, but 98s does it with better high-card back-up: when it flops top pair it is a nine, not a seven, and its straight draws are more often to the high end. With six players still behind you, that difference is enough to move 98s over the profitability line and leave 76s below it.' },
      ],
    },
    zh: {
      title: 'MP 中位开局范围（9人桌 / 满员桌）',
      lead: '9 人桌中位（MP）开局约 15.5%（206 个组合）：44+、A8s+ 加 A5s–A4s、KTs+、QTs+、J9s+、T9s、98s、ATo+ 与 KJo+。身后还有 6 个人。',
      body: [
        '满员桌的 MP 就是「稍微能喘口气的 UTG」。前面多弃掉的两个人，把两份最紧的范围从池子里移走了——这值大约 3.5 个百分点的宽度：对子放宽到 44、同花 A 放宽到 A8s、同花单缺连子（J9s、T9s、98s）也都变成盈利。',
        '加进来的几乎全是同花牌。这是所有前位都该内化的规律：让一手牌在前位可打的，**不是高牌强度，而是能不能做出经得起压力的牌**。98s 能做顺能做花；K9o 只能做「第二好的顶对」。只有一个该进前位范围。',
        '满员桌最大的单一漏洞，就是拿 6 人桌的中位范围（6 人桌 HJ 约 21%）去打 9 人桌的 MP。身后那多出来的三个人是真金白银，而你想加的那些牌——K9s、Q9s、杂色大牌——恰恰是身后有人醒过来时被压制得最惨的。',
      ],
      faq: [
        { q: '9 人桌 MP 该开多宽？', a: '约 15.5%——1326 个组合里的约 206 个：44+、A8s 及以上加 A5s–A4s、KTs+、QTs+、J9s+、T9s、98s、ATo+ 与 KJo+。比 9 人桌 UTG 宽不到 4 个点，比除 UTG 外的任何 6 人桌位置都明显更紧。' },
        { q: '为什么 MP 开 98s 却不开 76s？', a: '两者都能做顺做花，但 98s 的高牌后盾更好：击中顶对时是 9 而不是 7，做的顺也更常是大头顺。身后还有 6 个人时，这点差别刚好把 98s 推过盈利线，而 76s 还在线下。' },
      ],
    },
  },

  /* ═══════════ 大盲防守 ═══════════ */
  'bb-defense-vs-btn-6max': {
    en: {
      title: 'BB Defence vs Button Open (6-Max)',
      lead: 'Facing a 2.5bb button open in the big blind you defend about 55% of hands: 3-bet roughly 9% (99+, ATs+, A5s–A2s, KJs+, AJo+, KQo) and call the remaining ~46%. You are getting 3.5-to-1 on a call, which is why folding most hands here is a leak.',
      body: [
        'The pot odds are what drive this. With 1bb already posted, calling a 2.5bb raise costs you 1.5bb to win a pot of about 5bb — you need roughly 22% equity to break even on the call alone, and almost any two cards have that much against a 51% opening range. That is why the big blind defends more than half of all hands against the button, wider than any other spot in poker.',
        'The 3-betting range is deliberately polarised: premiums that want a big pot (99+, AK, AQ) and suited wheel aces (A5s–A2s) that block AA/AK and make the nut flush. The suited wheel aces are the part most players get wrong — they call with them instead. Calling wastes their blocker value; 3-betting turns them into the hands that let you bluff credibly on ace-high and low boards.',
        'The one thing that ruins big-blind defence is calling wide and then giving up on every flop you miss. A 55% defending range only pays if you actually continue on flops with backdoor equity and float the button in position-reversed spots. If you fold 80% of flops, you should be defending far tighter.',
      ],
      faq: [
        { q: 'How often should the big blind defend against a button open?', a: 'About 55% of hands in 6-max against a standard 2.5bb open — roughly 9% as a 3-bet and 46% as a call. The reason is the price: you only need about 22% equity to call profitably because you already have 1bb in the pot.' },
        { q: 'Which hands should the big blind 3-bet against a button open?', a: 'A polarised range: value hands that want a big pot (99+, ATs+, KJs+, AJo+, KQo) plus the suited wheel aces A5s–A2s as bluffs. The wheel aces block AA, AK and AQ, make the nut flush, and give you a credible bluffing range on ace-high boards.' },
      ],
    },
    zh: {
      title: '大盲防守按钮开局（6人桌）',
      lead: '在大盲面对按钮 2.5bb 开局，防守约 55%：3-bet 约 9%（99+、ATs+、A5s–A2s、KJs+、AJo+、KQo），其余约 46% 跟注。跟注拿到的是 3.5 比 1 的赔率——所以在这里大量弃牌是个漏洞。',
      body: [
        '驱动一切的是底池赔率。你已经投了 1bb，跟一个 2.5bb 的加注只需再付 1.5bb 去争约 5bb 的底池——单看跟注这一步，只需要约 22% 的赢率就打平；而面对一个 51% 的开局范围，几乎任何两张牌都有这个数。这就是为什么大盲对按钮的防守超过一半，比扑克里任何位置都宽。',
        '3-bet 范围是刻意做成两极的：想打大池的大牌（99+、AK、AQ）+ 同花轮子 A（A5s–A2s）——后者阻断 AA/AK，还能做坚果同花。同花轮子 A 是大多数人打错的地方：他们拿来跟注了。跟注等于浪费了阻断牌价值；3-bet 才把它们变成「在 A 高牌面和小牌面上能可信诈唬」的那批牌。',
        '毁掉大盲防守的唯一一件事，是跟得很宽、然后每个 miss 的翻牌都放弃。55% 的防守范围只有在你真的会用后门赢率继续、会在有位置的局面 float 按钮时才划算。如果你 80% 的翻牌都弃，那你本来就该防守得紧得多。',
      ],
      faq: [
        { q: '大盲面对按钮开局该防守多少？', a: '6 人桌面对标准 2.5bb 开局约防守 55%——约 9% 3-bet、约 46% 跟注。理由是价格：你已经有 1bb 在池里，只需约 22% 赢率跟注就盈利。' },
        { q: '大盲面对按钮开局该用哪些牌 3-bet？', a: '两极范围：要价值、想打大池的（99+、ATs+、KJs+、AJo+、KQo），加上同花轮子 A（A5s–A2s）当诈唬。轮子 A 阻断 AA/AK/AQ，能做坚果同花，还让你在 A 高牌面上有可信的诈唬范围。' },
      ],
    },
  },

  'bb-defense-vs-co-6max': {
    en: {
      title: 'BB Defence vs Cutoff Open (6-Max)',
      lead: 'Against a cutoff open you defend about 29% of hands from the big blind — 3-bet roughly 6% (TT+, AQs+, A5s–A4s, AQo+, KQs) and call about 24%. Much tighter than against the button, because the cutoff opens 29% instead of 51%.',
      body: [
        'The rule that generates every big-blind defending range is simple: defend against strength, not against position. The cutoff opens 29% of hands versus the button\'s 51%, so the average hand you face is materially stronger. Your pot odds have not changed — you still need about 22% equity — but the equity your junk hands have against a 29% range is much lower, so the defending range shrinks by about half.',
        'The other reason to tighten: there is still a player behind you (the button) who can squeeze. When you call wide from the big blind against the cutoff, you are not just facing the cutoff — you are inviting the button into a pot where you are out of position to both of them.',
        'The 3-betting range narrows accordingly. A5s and A4s stay in as the bluffs (same blocker logic as against the button), but the value portion tightens to TT+ and AQ. KJs and AJo, which are 3-bets against the button, become calls here — they are dominated too often by the cutoff\'s tighter opening range.',
      ],
      faq: [
        { q: 'How much should I defend from the big blind against a cutoff open?', a: 'About 29% in 6-max — roughly 6% as a 3-bet (TT+, AQs+, A5s–A4s, AQo+, KQs) and 24% as a call. That is roughly half as wide as your defence against a button open, because the cutoff\'s opening range is about half as wide.' },
        { q: 'Why do I defend less against the CO than against the BTN?', a: 'Because the cutoff opens a stronger range (29% versus the button\'s 51%), so your marginal hands have less equity against it — and because the button is still to act behind you and can squeeze. Both effects push the same way: tighten up.' },
      ],
    },
    zh: {
      title: '大盲防守 CO 开局（6人桌）',
      lead: '在大盲面对 CO 开局，防守约 29%——3-bet 约 6%（TT+、AQs+、A5s–A4s、AQo+、KQs），跟注约 24%。比对按钮紧得多，因为 CO 只开 29%，而按钮开 51%。',
      body: [
        '所有大盲防守范围背后只有一条规律：**按对手范围的强度防守，不是按他的位置防守**。CO 开 29%，按钮开 51%——你面对的平均牌力明显更硬。你的底池赔率没变（仍是约 22% 赢率打平），但你那些垃圾牌对一个 29% 范围的赢率低得多，所以防守范围缩掉大约一半。',
        '还有一条收紧的理由：**身后还有一个按钮可以挤压**。你在大盲宽跟 CO 的时候，其实不只是在跟 CO——你是在邀请按钮进一个「你对两个人都没位置」的底池。',
        '3-bet 范围也随之收窄。A5s、A4s 留下当诈唬（阻断逻辑与对按钮时相同），但价值部分收紧到 TT+ 与 AQ。对按钮时可以 3-bet 的 KJs、AJo，在这里变成跟注——面对 CO 更紧的开局范围，它们被压制得太频繁。',
      ],
      faq: [
        { q: '大盲面对 CO 开局该防守多少？', a: '6 人桌约 29%——约 6% 3-bet（TT+、AQs+、A5s–A4s、AQo+、KQs），约 24% 跟注。差不多是对按钮防守宽度的一半，因为 CO 的开局范围也差不多只有按钮的一半宽。' },
        { q: '为什么对 CO 的防守比对 BTN 少？', a: '因为 CO 开的范围更强（29% vs 按钮的 51%），你的边缘牌对它赢率更低；同时身后还有按钮可以挤压。两个因素方向一致：收紧。' },
      ],
    },
  },

  'bb-defense-vs-utg-6max': {
    en: {
      title: 'BB Defence vs UTG Open (6-Max)',
      lead: 'Against an under-the-gun open you defend only about 16% of hands from the big blind — 3-bet roughly 3% (QQ+, AK, A5s–A4s) and call about 13%. UTG opens the tightest range at the table, so this is the tightest big-blind defence.',
      body: [
        'UTG opens 16% of hands. That range is stuffed with pairs, big aces and suited broadways — hands that dominate almost everything you would like to defend with. Your price is still good (about 22% equity needed), but hands like K9o and Q8s simply do not have 22% against QQ+ / AK-heavy ranges, and they have no way to make a strong hand when they do connect.',
        'What you keep is what plays well against a strong, narrow range: pairs that can flop a set (22–JJ), suited aces and suited broadways that make the nuts, and suited connectors down to 65s that can stack an overpair. Offsuit hands almost entirely disappear — only AJo, AQo and KQo survive.',
        'The 3-bet is nearly pure value (QQ+, AK) plus the same suited-wheel-ace bluffs. Do not add more bluffs here: against a range that continues with AA–JJ and AK, a bluff-heavy 3-bet just donates money. If you would like to play more hands against UTG, call more — do not 3-bet more.',
      ],
      faq: [
        { q: 'How wide should the big blind defend against an UTG open?', a: 'About 16% in 6-max — roughly 3% as a 3-bet (QQ+, AK, and A5s–A4s as bluffs) and 13% as a call. It is the tightest defence at the table because UTG has the tightest opening range at the table.' },
        { q: 'Can I call an UTG open with K9o in the big blind?', a: 'No. It is dominated by the entire top of UTG\'s range (AK, KQ, KJ), it cannot make a flush, and it makes a top pair that is behind whenever it is called. Against a 16% opening range it does not clear the ~22% equity you need — the offsuit hands that do are only AJo, AQo and KQo.' },
      ],
    },
    zh: {
      title: '大盲防守 UTG 开局（6人桌）',
      lead: '在大盲面对 UTG 开局，只防守约 16%——3-bet 约 3%（QQ+、AK、A5s–A4s），跟注约 13%。UTG 是全桌最紧的开局范围，所以这也是最紧的大盲防守。',
      body: [
        'UTG 只开 16%，里面塞满了对子、大 A 和同花大牌——正是能压制你想防守的几乎一切的牌。你的价格依然不错（约需 22% 赢率），但 K9o、Q8s 这类牌对一个 QQ+/AK 权重很高的范围根本没有 22%，就算连上了也做不出强牌。',
        '该留下的是「对强而窄的范围也好打」的牌：能中三条的对子（22–JJ）、能做坚果的同花 A 与同花大牌、能把超对榨光的同花连子（到 65s）。杂色牌几乎全部消失——只剩 AJo、AQo、KQo。',
        '3-bet 几乎是纯价值（QQ+、AK）加同一批同花轮子 A 诈唬。**别在这里加更多诈唬**：面对一个用 AA–JJ 和 AK 继续的范围，诈唬过多的 3-bet 就是送钱。想对 UTG 多打几手，就多跟——不要多 3-bet。',
      ],
      faq: [
        { q: '大盲面对 UTG 开局该防守多宽？', a: '6 人桌约 16%——约 3% 3-bet（QQ+、AK，A5s–A4s 当诈唬），约 13% 跟注。这是全桌最紧的防守，因为 UTG 是全桌最紧的开局范围。' },
        { q: '大盲能用 K9o 跟 UTG 的开局吗？', a: '不能。它被 UTG 范围的整个顶部压制（AK、KQ、KJ），做不出同花，中了顶对也往往落后。面对一个 16% 的开局范围，它够不到需要的约 22% 赢率——杂色牌里够得到的只有 AJo、AQo、KQo。' },
      ],
    },
  },
};

/* 推弃 / 单挑 / 跟全下 三类页的文案在另一个文件(篇幅),合并导出 */
Object.assign(module.exports, require('./seo-content-jam.js'));
