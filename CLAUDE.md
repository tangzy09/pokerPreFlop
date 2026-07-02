# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ⛔ **提交规则（最高优先）：只有用户明确说「提交 / commit」时才 `git commit`。** 平时改完代码、跑过测试，把改动留在工作区等待验收，**不要自动提交**。（用户要求：我让你提交才提交。）

> Product scope, feature roadmap, and the **honesty constraints** (no fabricated EV/frequencies, offline/zero-build, what's explicitly excluded) live in [PRODUCT.md](PRODUCT.md). Read it before adding features.

## What this is

A zero-build, dependency-free web app: a **pre-flop poker GTO decision trainer** (Chinese UI). [gto-trainer.html](gto-trainer.html) holds the markup + CSS and loads plain classic scripts (no ES modules, no bundler — still double-click-to-run from `file://`):

```
gto-trainer.html         markup + ~650 lines CSS + INLINED fonts (Space Grotesk/Mono as base64 — fully
                         offline, NO Google Fonts CDN; regen via tools/embed-fonts.js), then 10 <script src>
                         tags + 2 data files (12 total, order matters)
js/i18n.js               LOADS FIRST. Bilingual display layer (English default + 中文 toggle).
                         The DATA files stay Chinese = canonical source; translation is display-only:
                         L("中文")→en/zh by source lookup; tr(key,vars)→keyed bilingual templates;
                         applyI18n() walks static HTML; body-level fixed 中|EN segmented selector on
                         EVERY screen + the in-hand view (drops below the HUD score during a hand)
js/equity.js             dual-loaded equity engine (evaluate7, equityExact, classEquity,
                         rangeEquity, rangeEquityBoard = equity on a given 3/4/5-card board);
                         also require()d by tools/ — module.exports is guarded
js/ranges.js             range-string DSL (expand) + scenario taxonomy (FORMATS/GAMETYPES/VARIANTS).
                         Interval syntax supports THREE standard forms: same-high kicker runs (A2s-A9s),
                         same-kicker high-card runs (K9s-Q9s), and same-gap diagonal connector runs
                         (T9s-65s → T9s,98s,87s,76s,65s). Uninterpretable intervals are IGNORED rather
                         than mis-expanded (previously the 2nd token's high card was silently dropped,
                         so T9s-65s would wrongly expand to T9s..T5s); pair-token guards skip AAs-style typos
js/modes.js              MODES — single source of mode behaviour (+ FREQ/handFreq, cellCat/catName)
js/data/pushfold.js      AUTO-GENERATED Nash (global PUSHFOLD): 9-max 8/10/12/15/20bb jam, 6-max 10/15/20bb
                         (ring6), 9-max BB call-off vs BTN jam (calloff); loads before packs. ~180KB —
                         the 2.4MB PUSHFOLD.nash chart data was SPLIT OUT to pushfold-nash.js
js/data/pushfold-nash.js AUTO-GENERATED, NOT <script>-loaded: PUSHFOLD.nash (Nash-chart per-hand EV,
                         ante×stack×pos, ~2.4MB=93% of the old file). Lazily injected by openNash()
                         on first open (dynamic <script>, works from file://) — keeps boot ~2.4MB lighter
js/data/hu-pushfold.js   AUTO-GENERATED HU SB-vs-BB push/fold, jam + call, 5/8/10/12/15/20/25bb (global HU_PUSHFOLD)
js/packs.js              PACKS range database (+ PREMIUM); overrides push/call spots with the computed data
js/cap.js                Capacitor 桥接共享 helper (var/window.CAP = {cap,native,plugin(name)}); purchases + notify 复用
js/purchases.js          RevenueCat (Capacitor) IAP adapter via window.Capacitor.Plugins.Purchases (zero-build,
                         no import). window.Pay = {init,buy,restore,refresh}; native only, browser no-ops.
js/notify.js             local-notifications adapter via window.Capacitor.Plugins.LocalNotifications.
                         window.Notify = {enable,disable,reschedule}; daily training reminder; native only.
js/app.js                persistence, audio (synth SFX w/ master lowpass+compressor), confetti, hand helpers,
                         game engine, charts + start-screen live chart preview (renderStartChart) +
                         wrong-answer range table in feedback (renderFbMatrix, with adjacent-hand
                         boundary highlight via neighborsOf) + 反馈学习闭环 (fbCompareHtml 动作对比条 +
                         classifyMiss 错误归因 + precise 真频率条) + 胜率计算器 +
                         漏洞分析(Leak Analyzer) UI + Pro 门控(isPro: web 恒 true=全解锁 / native 读 RevenueCat
                         entitlements.active['pro']) + spotLocked(场景前半免费/后半锁) + wireNotify, boot.
                         All user-facing strings go through L()/tr(); the in-app 翻后GTO screen + the
                         bottom 图表 nav entry are removed (postflop-spots.js no longer <script>-loaded).
                         Nav: homeScreen (主页卡片) is the single entry — cards goStart() then proxy the
                         startScreen buttons; mistakes/nash/stats/equity/guide/push back-buttons return to
                         homeScreen. Newer: renderTrend (per-day accuracy SVG, data = STORE.trend collected
                         in resolve), pushScreen (推弃特训 quick picker → guideLaunch('mtt',variant)),
                         renderGuideAcc (学习路径 real per-format accuracy chips on guideScreen),
                         maybeIntro (first-launch 3-step onboarding, STORE.seenIntro), and the solver-EV
                         feedback line (t.evTable/t.evAct wired in packs.js from shipped seatsEV/jamEV/
                         callEV/btnEV — the ONLY place EV numbers are shown, per PRODUCT.md §6)
js/coach.js              LOADS LAST. 翻前诊断 + 20 天训练计划 (主页顶部横幅卡 homePlan → coachOpen).
                         问卷 coachScenes(onboard) → 诊断测试 (简化18/详细45, coachBuildDiagQueue) 走
                         G.diagMode 复用练习的真实牌桌/发牌/逐题反馈/范围矩阵 (app.js 的 nextHand/resolve
                         里用 !G.diagMode 守卫跳过 HP/统计/错题堆/升级/结算; _coachDiagQueue/_coachDiagPos
                         为模块级状态) → coachFinishDiagnosis 聚合 (coachAggregate/coachVerdict) 出报告 →
                         coachBuildPlan 20 天每日计划 (coachMarkDayDone 打卡 + streak). 诊断+报告免费,
                         Start Day 1 计划执行 Pro. 诚实红线: 全部 vs 参考范围、标 not solver-exact、不编 EV/频率
tools/                   offline data computation — NOT shipped to the browser:
  pushfold.js            (Node) HU + multiway push/fold Nash solvers (buildEqMatrix, solveHU, solveRing); require()s ../js/equity
  monotonic.js           (Node) enforceMonotonic(table) — kills threshold-noise non-monotonicity in a
                         push/call range by hand domination (req'd by both gen-pushfold + gen-hu-pushfold)
  gen-pushfold.js        (Node) runs the solver + monotonic pass, writes js/data/pushfold.js (9-max + 6-max + calloff)
  gen-hu-pushfold.js     (Node) writes js/data/hu-pushfold.js (HU SB jam + BB call-off, 5–25bb)
  build-www.js           (Node) assembles www/ for Capacitor (gto-trainer.html→index.html + js/ tree)
  embed-fonts.js         (Node) inlines Space Grotesk/Mono latin woff2 as base64 into gto-trainer.html
                         (removes the Google Fonts CDN — fully offline). Rerun if the font set changes.
  gen-notify-icon.js     (Python/PIL) white ♠ status-bar icon ic_stat_notify (5 densities) for notifications
  gen-store-assets.py    (Python/PIL) Google Play graphics → store-assets/ (icon, feature graphic, screenshots)
  gen-store-shots.js     (Node) headless Chrome/Edge 截真实页面 → store-assets/ 商店截图(new-1..6-*.png
                         1080×2280:主页中/英·训练·反馈·Nash·诊断报告)+ feature-1024x500.png(截
                         store-assets/_feature.html);复用 ui-smoke 注入机制;无浏览器则 SKIP。npm run shots
  gen-postflop-spots.py  (Python) solves canonical HU postflop spots with tools/solver (vectorized CFR+)
                         and writes js/data/postflop-spots.js (validated by test/solver-spots.test.js) —
                         kept as an offline artifact; no longer <script>-loaded (the 翻后GTO screen was removed)
  solver/                (Python) the experimental HU postflop CFR/CFR+ solver chain; see solver/README.md
```

The scripts share one global scope (browser behaviour for classic scripts); load order is `i18n → equity → ranges → modes → packs → cap → purchases → notify → app → coach` and is enforced by the `<script src>` order (`i18n.js` must be first so `L`/`tr` exist for everyone; `coach.js` loads last so it can call into `app.js`'s game loop — `nextHand`/`resolve`/`renderHUD`/`G` — by shared global scope). `js/equity.js` is the one file used both in the browser (plain globals) and by Node tools (`require`, via the guarded `module.exports`). An earlier single-file copy is archived at `C:\Users\tangz\Downloads\gto-trainer_1.html`.

## Running & verifying (no build step)

- **Run:** open `gto-trainer.html` in any browser. State persists to `localStorage` (`STORE_KEY = 'gtoTrainer_v1'`); it silently no-ops in sandboxed previews.
- **Test:** `npm test` (app JS, = `node --test "test/*.test.js"`). Run a single test with `node --test --test-name-pattern="snapshot" "test/*.test.js"`.
- **UI smoke (headless Chrome):** `npm run test:ui` (= `node test/ui-smoke.js`). Drives the **real** page in headless Chrome (real clicks + real `classList`) to catch the UI regressions the pure-logic tests can't see — navigation (the four feature pages' back buttons must return to `homeScreen`), the language selector appearing on every screen, and `setLang` actually switching. Optional/environment-gated like the solver suite: auto-detects Chrome (or `CHROME_BIN`) and **SKIPs** (exit 0) if none found; it is NOT part of `npm test` (which stays pure `node --test`, zero-dependency). Writes a throwaway `_uismoke_*.html` in the repo root (gitignored) so the page's relative `<script src="js/…">` resolve.
- **Solver tests (Python):** `npm run test:solver` (= `python tools/solver/run_all.py`, runs the 4 CFR/equity suites in `tools/solver/`). `npm run test:all` runs JS + UI smoke + solver together.
- **After an INTENTIONAL change to `MODES` or the ranges**, the snapshot test will fail by design — regenerate the golden with `npm run test:update`, then review the diff in `test/__snapshots__/regression.snap.json` before committing.
- **Recompute the push/fold Nash data** with `node tools/gen-pushfold.js` (9-max + 6-max + BB call-off, ~3-4min) and `node tools/gen-hu-pushfold.js` (HU 5–25bb). Both are deterministic (fixed seed) and apply `tools/monotonic.js` (`enforceMonotonic`) so threshold-noise non-monotonicity is removed (e.g. KJo can't fold while the weaker KTo jams). Then regenerate the snapshot. These ranges are computed, not hand-curated — edit `STACKS` / the model in `tools/`, not the data file.
- **The offline 翻后GTO solver** lives in `tools/solver/` (+ `gen-postflop-spots.py`, `npm run test:solver`). It still produces/validates `js/data/postflop-spots.js`, but the **in-app 翻后GTO screen was removed** (product decision) — the data file is no longer `<script>`-loaded by `gto-trainer.html`. The solver chain is kept for the offline pipeline + its tests; honest scope if revived: HU, single bet size, no raises (MDF / polarization / indifference demos).
- **Accuracy is measured, not assumed:** `ringRegret()` computes the solution's exploitability (max bb/hand a best-responder could gain; 0 = exact Nash within the model). gen-pushfold records it per stack in `PUSHFOLD.meta.exploitability` and packs.js surfaces it in each spot's `src` / confidence tooltip. The data is a *computed approximation of a simplified model* (chip-EV, no antes, no-overcall, class-level equity, Monte-Carlo) — not real-table truth.
- Node v24 is installed at `C:\Program Files\nodejs\`. Freshly-spawned tool shells may not have it on PATH until a terminal restart — use the full path (`& "C:\Program Files\nodejs\node.exe"` / `npm.cmd`).

### How the tests work (no DOM, no dependencies)
`test/load-app.js` reads the `<script src="js/...">` list from the HTML (in order), concatenates those files, and runs them in one `vm` context where every browser global is a **bulletproof Proxy stub** (each trap returns another callable/iterable Proxy), so the top-level boot code that touches `document`/`window`/`localStorage` can't throw. Concatenating reproduces the browser's shared global scope across classic scripts — so a load-order/reference error in `app.js` also throws here. It appends `;globalThis.__app={MODES,PACKS,cellCat,…}` to capture the internals. `test/regression.test.js` then runs **contract invariants** (every PACKS mode has a MODES entry; `correct`/`cell` outputs are well-formed; range-DSL + `handLabel`/`combosOf` sanity) plus a **golden snapshot** (`test/snapshot.js` builds the full decision matrix + every spot's chart categories across all 169 hands). This is the regression net for the MODES-centralized design. Two more suites cover the postflop additions: `test/solver-spots.test.js` (the shipped `js/data/postflop-spots.js` is well-formed, near-Nash, and matches the textbook closed forms — MDF 50%/67%, nuts-vs-air +0.5, etc.) and `test/equity-board.test.js` (`rangeEquityBoard` — river boards are deterministic so those equities are exact). `test/i18n.test.js` is the **English-no-Chinese guard**: in `LANG='en'` it statically scans every `L('中文字面量')` call site (e.g. `L('查看报告 →')`) plus all data-derived visible strings (MODES names/legend/catName, ACT_LABEL, CAT_NAME, FORMATS/VARIANTS/GAMETYPES, grade names) and fails if any still contains CJK — catches missing-translation regressions like the diagnostic's `查看报告 →` leak. Note: the tests cover pure logic/data only — DOM rendering and the game loop still need a manual browser click-through.

## Architecture (the parts that span multiple files)

Read these relationships before editing:

### Range data pipeline
- `RANKS` / `RIDX` + `expand(str)` parse a **range-string DSL** (e.g. `"22+, A2s+, KTs+, AJo+, KQo"`) into a `Set` of canonical hand labels (`"AKs"`, `"TT"`, `"A2o"`). `handLabel(r,c)` is the canonical form (suited = upper-right, offsuit = lower-left).
- `PACKS` is the range database, nested `format → variant → array of "tables"`. Each table (a "spot") has `{mode, name, who, tier, raise/call/mix}` strings. A post-load pass expands these into `t.R` (raise), `t.C` (call), `t.M` (mix/edge) Sets plus `t.union`. Shared range strings (`r_co`, `r_btn`, `m_btn`, …) are reused across packs.

### MODES — single source of truth for decision behavior
`MODES` (in [js/modes.js](js/modes.js)) is the **central config keyed by mode** (`open`, `push`, `callshove`, `defense`, `face3b`, `squeeze`, `face4b`). Each entry defines everything mode-specific:
- `actions` — button list `[key, ACT_LABEL.x]` (grid columns derived from count)
- `names` — action→Chinese display name (for the answer string)
- `correct(isR,isC,isM)` — the GTO-correct action set (array; length > 1 ⇒ a mix point)
- `cell(isR,isC,isM)` — the chart matrix CSS category
- `legend`, optional `catName` overrides
- Reusable closures `CORRECT.*` / `CELL.*` back these so several modes share identical logic.

**This is deliberate: to add or change a mode, edit `MODES` only.** All consumers read from it — `nextHand()` (`MODES[mode].correct`), `buildActions()` (`.actions`), `resolve()` (`.names`), and the charts page `cellCat`/`catName`/`renderMatrix` (`.cell`/`.catName`/`.legend`). The edge/mix "which action to play" is baked into `correct`/`cell` (there is no separate `EDGE_PLAY` table). The one exception that is intentionally NOT in `MODES`: `reasonFor()` (prose feedback) keeps its own per-mode branches because it's content, not config.

### Selection taxonomy
`GAMETYPES` (cash vs mtt) → `FORMATS` → `VARIANTS`. `gameOf(fmt)` maps a format back to its game. The start screen, charts screen, and guide all build option chips from these.

### i18n (bilingual, English default)
[js/i18n.js](js/i18n.js) loads first and is a **pure display layer** — the data files (`ranges`/`modes`/`packs`) and all `name`/`who`/label strings stay **Chinese = the canonical source**. Translation happens only at render:
- `L("中文")` → English when `LANG==='en'`, the original Chinese when `'zh'` (lookup by the Chinese source string; unknown strings fall back to Chinese). Used for short labels, action names, spot `name`/`who` (the latter via `Lwho`/`Lparts` which split on ` · ` / tokens).
- `tr(key, vars)` → keyed bilingual templates with `{var}` interpolation, for the interpolated prose (`reasonFor`, feedback, paywall) and inline-`<b>` HTML blocks. **Named `tr`, not `t`, because app.js uses `t` for the spot object.**
- `applyI18n()` walks static HTML (`data-i18n-html` keyed blocks + simple text nodes) and is re-run on language switch; `setLang()` persists `gtoLang` to localStorage and calls `rerenderUI()` (defined in app.js) to rebuild dynamic UI.
- Default is **English**; the `中 | EN` selector is a **body-level `position:fixed` segmented toggle shown on every screen** (and the in-hand training view) — it highlights the active language and, during an active hand, drops to the HUD's second row (below the score/level lines) so it never overlaps the score. `_mountLangToggle()` builds it once on `<body>`; a `MutationObserver` on every screen's `class` drives `_langBtnVis()` to reposition it (menu = top-right; in-hand = below the HUD). Earlier it was inlined per-screen in `#startScreen`/`#homeScreen`, which left most screens with no selector — keep it body-level.
- **Tests are pinned to `zh`** (`app.setLang('zh')` in `regression.test.js`) so the golden snapshot + prose assertions read the canonical language. `load-app.js` exports `L`/`tr`/`setLang`/`curLang`. Because data stays Chinese, adding i18n did **not** change the snapshot.

### Game loop & state
`G` is the mutable game-state object. Flow: `newGame()` → `nextHand()` (deals via `pickHand(t, filter)` using `HANDFILTERS`, computes `G.correct_set` from `MODES`) → `choose()`/`timeOut()` → `resolve()` (grades, scores, HP, feedback via `reasonFor()`) → `advance()`. A session is `SESSION_HANDS` (=20) hands. `PREMIUM` marks hands whose misplay is graded a "blunder". `unlocked()` falls back to the **whole pack** when no spot is `tier<=level` (some variants' lowest tier is >1, e.g. `co*` has a single tier-2 spot — falling back to `tier===1` only would deal an empty pool and crash).

The default **`smart`** filter builds a balanced **question bank** in `buildSmartQueue()`: each unlocked spot's in-range hands are bucketed by answer type (`isM?'edge':corr.length>1?'mix':corr[0]`) and joined with `adjacentFolds(t)` — "hard folds" = same-suitedness ±1-rank neighbours of range hands that aren't themselves in range (e.g. A5s→A4s/K5s, 88→77). Each type is capped at `SMART_PER_TYPE` (weak/review hands first) and shuffled, so a session sees roughly equal counts of each action type and only borderline folds (never obvious trash). On wrong answers the feedback panel pops the spot's range chart (`renderFbMatrix`) with the played hand ringed; the in-game table collapses (`.table.fb-hide`) so the scrollable feedback doesn't overlap the cards.

**频率评级（Phase 2/3，中文说明）**：`resolve()` 的评分会读 `handFreq(t,hand)`。判定支持集（`G.correct_set`）仍来自 `MODES`，但**混合点的「最佳 vs 好棋」按真实频率细分**：
- 仅当 `t.confidence==='precise'`（有真 `freqTable`，如自算推弃 Nash）时，混合点才有「主频线」——选**频率最高**的动作记 **最佳**（触发庆祝），选次频但仍在支持集内的动作记 **好棋**；支持集外仍是失误。
- `curated` 局面的混合频率是 `MIX=0.5` 占位，**不分高下**：**边缘带**（`G.isEdge`）答对记 **两可**（绿色，等同正确，明确「两种都对」），其余两路混合点记 **好棋**；任一支持动作都算对（§6 诚实红线：不从占位频率编造「最佳」）。
- 这套逻辑只在运行期的 `resolve()`，**不动 `MODES` 也不影响金快照**；反馈面板与图表 `cInfo` 仅对 `precise` 局面显示真实百分比，其余维持定性。

### Persistence & review
`localStorage` holds prefs, lifetime stats (`statsBySpot`), and the **mistake review pile** (`reviewPile`) — a lightweight spaced-repetition queue. Each record tracks a `streak` of consecutive correct answers in review; a spot leaves the pile only after `MASTER_STREAK` (=2) consecutive corrects (a miss resets it to 0), or via the manual 🗑 in the review-detail page — so errors stay drillable across sessions. Review mode replays the pile without affecting HP/stats.

**Leak Analyzer + 画像/计划 (Phase 5–6)** live on the 统计 (stats) screen. `addMistake(choice)` records the player's actual action on each miss. `classifyMiss(rec)` buckets a miss: ICM spot → `icm`, mix point (`correct.length>1`) → `mix`; otherwise by the real choice vs the single correct action — folded a play-hand → `tight` (太紧), played a fold-hand → `loose` (太松), called-not-raised → `passive` (被动), raised-not-called → `aggro` (过激); old records lacking `choice` fall back to a hand-type heuristic. `renderLeak()` ranks the buckets (init from `LEAK_TYPES` so all buckets count) + most-missed hands (→ `startReview(label)`); `renderProfile()` derives 风格倾向(松/紧) + 打法倾向(被动/激进) + 强弱档位; `renderPlan()` ranks spots by 需练度(错得多+准确率低). Honest framing: all **vs 参考范围**, not solver-exact, no fabricated TAG/LAG.

## Domain caveat (do not misrepresent)

Most ranges are **hand-curated GTO approximations, not solver-exact output** (mix/edge frequencies are "~50%" placeholders; MTT/ICM/6-max are the roughest). The **exception** is the push/fold + jam-call spots, which are this tool's **own computed Nash** (`confidence:'precise'`, tagged「Nash 博弈论最优」/「Nash GTO」) — still a simplified-model approximation (chip-EV, no antes, no-overcall, class equity, Monte-Carlo), not table truth. The in-app "关于/About" screen documents every assumption. Keep new copy/features honest — never present output as solver-precise. UI is **bilingual (English default + 中文 toggle)** and written in a "松鼠/squirrel" persona in both. Pro gating is **live** (`isPro`): the **web is always unlocked** (free — no `window.Capacitor`), the **Android app reads the real RevenueCat `pro` entitlement** (`STORE.proEntitled`). `spotLocked()` locks the **second half** of each game-type's scenarios behind Pro (first half free); core training stays free (PRODUCT.md red line).

## Android app (Capacitor) — packaging, IAP, notifications

The same web app is also wrapped as a **Capacitor 8** Android app (`android/`, `appId = com.pokerpreflop.trainer`, `webDir = www`). The web source is unchanged (`gto-trainer.html` still runs from `file://`); `www/` is a generated staging dir (gitignored). Real-money Play billing is **verified end-to-end** (2026-06-20: real charge → `pro` entitlement → unlock).

- **Build an AAB:** `node tools/build-www.js` (assembles `www/`) → `npx cap copy android` (or **`cap sync`** after adding a native plugin — it also updates the gradle deps + `capacitor.plugins.json`) → `cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew bundleRelease`. Output: `android/app/build/outputs/bundle/release/app-release.aab`. SDK at `$LOCALAPPDATA/Android/Sdk`. **No cmdline-tools** → create AVDs in the Android Studio GUI.
- **Versioning:** bump `versionCode`/`versionName` in `android/app/build.gradle` for **every** AAB uploaded to Play (duplicate versionCode is rejected). Currently **versionCode 10 / 1.9**（2026-06-30 打包,AAB 追平网页,待上传 Play）.
- **Signing (do not leak):** release is signed with `android/upload-keystore.jks` (creds in `android/keystore.properties`). **Both are gitignored and MUST NEVER be committed — the repo is public.** Back up the .jks + passwords offline; losing them blocks future app updates.
- **In-app purchases (RevenueCat):** `js/purchases.js` → `window.Pay`. **Two subscriptions** (the one-time `pro_lifetime` buyout was **removed 2026-06-23**): `pro_yearly` ($12.99/yr — paywall primary, `Pay.buy('year')`, `#pwYear`) + `pro_monthly` ($4.99/mo, base plan `monthly` → `pro_monthly:monthly`, `Pay.buy('sub')`, `#pwSub`). Both attached to the `pro` entitlement and in the `default` offering **set as Current** (code reads `offerings.current`; `MATCH.year` hits packageType `ANNUAL`, `MATCH.sub` hits `MONTHLY`). `USE_TEST_STORE` (purchases.js top): `false` = real Play (`goog_` key, current), `true` = RevenueCat Test Store sandbox. **Test purchases with a Play License-testing account, else you are charged for real.** Gotcha: a product not attached to the entitlement → purchase succeeds + card charged but `entitlements.active['pro']` stays empty + no unlock (fix the attach, then 恢复购买/restart re-activates — no re-buy).
- **Local notifications:** `js/notify.js` → `window.Notify` via `@capacitor/local-notifications`. Daily training reminder (user-settable time via `#notifyTime` → `Notify.enable(h,m)`, default 20:00; inexact alarm → no SCHEDULE_EXACT_ALARM); toggle + time picker in startScreen 进阶设置 (native only, browser hides it); `reschedule()` on boot re-arms it after update/reinstall. White-♠ status-bar icon `ic_stat_notify` (`tools/gen-notify-icon.js`) wired via `capacitor.config.json` `plugins.LocalNotifications.smallIcon`.
- **Store assets:** `store-assets/` — screenshots + feature graphic via `tools/gen-store-shots.js` (`npm run shots`, headless Chrome/Edge of the live UI); trilingual listing copy (title/short/full × en·zh·ja + ASO keywords) in `store-assets/listing.md`; `icon-512.png`; `_feature.html` is the editable feature-graphic source. (Older `tools/gen-store-assets.py` PIL pipeline is superseded.) Also `privacy.html` (live at /privacy.html), `ANDROID_SETUP.md` (launch manual).

## Deployment (live site)

The app is a static site; hosting is just nginx serving the repo. **GitHub Pages is disabled** (we moved to EC2). The repo is public at `github.com/tangzy09/pokerPreFlop`.

- **Live:** **https://pre-flop.ai-speeds.com/** (Let's Encrypt cert via certbot, HTTP→HTTPS redirect).
- **Where:** a shared EC2 (`3.26.95.240`, Amazon Linux 2023, multi-site nginx — also hosts fishid/4096/ina/dive `*.ai-speeds.com`, each under `/var/www/<name>`). poker lives at **`/var/www/poker`** (a `git clone` of this repo). nginx vhost: `/etc/nginx/conf.d/pre-flop.conf`. Also reachable via `/poker_pre_flop/` subpath + the underscore `pre_flop.ai-speeds.com` (HTTP only — underscore hostnames can't get a LE cert).
- **Deploy:** local `deploy.sh` (**gitignored** — holds the EC2 host + key path; not in the public repo). `bash deploy.sh "msg"` = commit-all + test + `git push` + SSH `sudo git -C /var/www/poker pull`. Manual equivalent: `ssh -i <key> ec2-user@3.26.95.240 'sudo git -C /var/www/poker pull'`.
- Root `index.html` is a redirect to `gto-trainer.html` (so the site root opens the app); `.nojekyll` is present.
