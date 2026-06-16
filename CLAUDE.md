# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Product scope, feature roadmap, and the **honesty constraints** (no fabricated EV/frequencies, offline/zero-build, what's explicitly excluded) live in [PRODUCT.md](PRODUCT.md). Read it before adding features.

## What this is

A zero-build, dependency-free web app: a **pre-flop poker GTO decision trainer** (Chinese UI). [gto-trainer.html](gto-trainer.html) holds the markup + CSS and loads four plain classic scripts (no ES modules, no bundler — still double-click-to-run from `file://`):

```
gto-trainer.html         markup + ~600 lines CSS, then 5 <script src> tags (order matters)
js/ranges.js             range-string DSL (expand) + scenario taxonomy (FORMATS/GAMETYPES/VARIANTS)
js/modes.js              MODES — single source of mode behaviour (+ FREQ/handFreq, cellCat/catName)
js/data/pushfold.js      AUTO-GENERATED computed 10/15/20bb Nash (global PUSHFOLD); loads before packs
js/packs.js              PACKS range database (+ PREMIUM); overrides d10 spots with the computed data
js/app.js                persistence, audio, confetti, hand helpers, game engine, charts UI, boot
tools/                   offline (Node) data computation — NOT shipped to the browser:
  equity.js              exact + Monte-Carlo all-in equity engine (evaluate7, equityExact, classEquity)
  pushfold.js            HU + multiway push/fold Nash solvers (buildEqMatrix, solveHU, solveRing)
  gen-pushfold.js        runs the solver and writes js/data/pushfold.js (10/15/20bb)
```

The four scripts share one global scope (browser behaviour for classic scripts); load order is `ranges → modes → packs → app` and is enforced by the `<script src>` order. An earlier single-file copy is archived at `C:\Users\tangz\Downloads\gto-trainer_1.html`.

## Running & verifying (no build step)

- **Run:** open `gto-trainer.html` in any browser. State persists to `localStorage` (`STORE_KEY = 'gtoTrainer_v1'`); it silently no-ops in sandboxed previews.
- **Test:** `npm test` (= `node --test "test/*.test.js"`). Run a single test with `node --test --test-name-pattern="snapshot" "test/*.test.js"`.
- **After an INTENTIONAL change to `MODES` or the ranges**, the snapshot test will fail by design — regenerate the golden with `npm run test:update`, then review the diff in `test/__snapshots__/regression.snap.json` before committing.
- **Recompute the push/fold Nash data** with `node tools/gen-pushfold.js` (~2min; writes `js/data/pushfold.js` for 10/15/20bb). Then regenerate the snapshot. The d10/d15p/d20p ranges are computed, not hand-curated — edit the model in `tools/`, not the data file.
- **Accuracy is measured, not assumed:** `ringRegret()` computes the solution's exploitability (max bb/hand a best-responder could gain; 0 = exact Nash within the model). gen-pushfold records it per stack in `PUSHFOLD.meta.exploitability` and packs.js surfaces it in each spot's `src` / confidence tooltip. The data is a *computed approximation of a simplified model* (chip-EV, no antes, no-overcall, class-level equity, Monte-Carlo) — not real-table truth.
- Node v24 is installed at `C:\Program Files\nodejs\`. Freshly-spawned tool shells may not have it on PATH until a terminal restart — use the full path (`& "C:\Program Files\nodejs\node.exe"` / `npm.cmd`).

### How the tests work (no DOM, no dependencies)
`test/load-app.js` reads the `<script src="js/...">` list from the HTML (in order), concatenates those files, and runs them in one `vm` context where every browser global is a **bulletproof Proxy stub** (each trap returns another callable/iterable Proxy), so the top-level boot code that touches `document`/`window`/`localStorage` can't throw. Concatenating reproduces the browser's shared global scope across classic scripts — so a load-order/reference error in `app.js` also throws here. It appends `;globalThis.__app={MODES,PACKS,cellCat,…}` to capture the internals. `test/regression.test.js` then runs **contract invariants** (every PACKS mode has a MODES entry; `correct`/`cell` outputs are well-formed; range-DSL + `handLabel`/`combosOf` sanity) plus a **golden snapshot** (`test/snapshot.js` builds the full decision matrix + every spot's chart categories across all 169 hands). This is the regression net for the MODES-centralized design. Note: the tests cover pure logic/data only — DOM rendering and the game loop still need a manual browser click-through.

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

### Game loop & state
`G` is the mutable game-state object. Flow: `newGame()` → `nextHand()` (deals via `pickHand(t, filter)` using `HANDFILTERS`, computes `G.correct_set` from `MODES`) → `choose()`/`timeOut()` → `resolve()` (grades, scores, HP, feedback via `reasonFor()`) → `advance()`. `PREMIUM` marks hands whose misplay is graded a "blunder".

**频率评级（Phase 2/3，中文说明）**：`resolve()` 的评分会读 `handFreq(t,hand)`。判定支持集（`G.correct_set`）仍来自 `MODES`，但**混合点的「最佳 vs 好棋」按真实频率细分**：
- 仅当 `t.confidence==='precise'`（有真 `freqTable`，如自算推弃 Nash）时，混合点才有「主频线」——选**频率最高**的动作记 **最佳**（触发庆祝），选次频但仍在支持集内的动作记 **好棋**；支持集外仍是失误。
- `curated`/`approx` 局面的混合频率是 `MIX=0.5` 占位，**不分高下**，任一支持动作都记 **好棋**（§6 诚实红线：不从占位频率编造「最佳」）。
- 这套逻辑只在运行期的 `resolve()`，**不动 `MODES` 也不影响金快照**；反馈面板与图表 `cInfo` 仅对 `precise` 局面显示真实百分比，其余维持定性。

### Persistence & review
`localStorage` holds prefs, lifetime stats (`statsBySpot`), and the **mistake review pile** (`reviewPile`) — a lightweight spaced-repetition queue (a spot leaves the pile once answered correctly). Review mode replays the pile without affecting HP/stats.

## Domain caveat (do not misrepresent)

Ranges are **hand-curated GTO approximations, not solver-exact output**. Mix/edge frequencies are "~50%" placeholders, not true solver frequencies; MTT/ICM/6-max are the roughest. The in-app "关于" (About) screen documents every assumption. Keep new copy/features honest about this — never present output as solver-precise. UI text is Chinese and written in a "松鼠" (squirrel) persona.
