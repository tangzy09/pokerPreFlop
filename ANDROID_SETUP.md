# Android + RevenueCat 上线手册

把这个 zero-build 网页用 **Capacitor** 包成 Android app，用 **RevenueCat** 接 Google Play 内购（IAP）。
代码侧已接好（见下「已完成」）；剩下是**只能你本人做**的账号 / 后台 / 构建步骤。

> 网页版不受影响：`gto-trainer.html` 仍可 `file://` 双击运行、永不收费（浏览器里 `isPro()` 恒为 true、`Pay.buy` 走本地占位）。收费只在原生 app 里生效。

---

## 已完成（代码侧）

- `js/purchases.js` —— RevenueCat 适配层（用 `window.Capacitor.Plugins.Purchases` 全局 bridge，无需打包）。
- `isPro()` —— 原生读 RevenueCat `pro` entitlement 缓存（`STORE.proEntitled`），浏览器恒 true。
- 付费墙两按钮接 `Pay.buy('year')`（年订阅·主推）/ `Pay.buy('sub')`（月订阅）+ 「恢复购买」`Pay.restore()`（仅原生显示）。
- `@revenuecat/purchases-capacitor@13` 已安装并 `cap sync` 进 `android/`。

---

## 你要做的（账号 / 后台）

### 1. Google Play 开发者账号
注册 Play Console（一次性 $25）：https://play.google.com/console — 建应用，包名 **`com.pokerpreflop.trainer`**（见 `capacitor.config.json`，要一致）。

### 2. Play Console 建内购产品
应用内 → 创建**两个订阅**，**id 必须与 `js/purchases.js` 的 `MATCH` 兼容**：
- **月订阅** id `pro_monthly`（base plan `monthly`），$4.99/月
- **年订阅** id `pro_yearly`（base plan `annual`），$12.99/年（付费墙主推）

（要先上传一个签名 APK/AAB 到内部测试轨道，Play 才允许配置内购。）

### 3. RevenueCat 控制台
https://app.revenuecat.com — 建 Project：
1. 连接 **Google Play**（上传 Play 的 service account JSON 授权）。
2. 建 **Entitlement**，标识填 **`pro`**。
3. 建 **Offering**（如 `default`，设为 **Current**），把 `pro_monthly`、`pro_yearly` 两个订阅各加成一个 package（Monthly / Annual），都挂到 `pro` entitlement。
4. 复制 **Android 公开 API key**（`goog_...`）。

### 4. 填 key
编辑 `js/purchases.js` 顶部：
```js
const RC_API_KEY = { android:'goog_你的KEY', ios:'appl_REPLACE_ME' };
```
（如果你的 RC 产品 id / entitlement 用了别的名字，同步改 `MATCH` / `ENTITLEMENT`。）

---

## 构建 / 调试（你的 Windows 上）

需要先装 **Android Studio**（含 JDK + Android SDK）：https://developer.android.com/studio

```bash
npm run build:www          # 把 gto-trainer.html + js/ 拷进 www/
npx cap sync android       # 同步 web 资源 + 插件到 android/（改了 js/purchases.js 后必跑）
npx cap open android       # 用 Android Studio 打开，连真机/模拟器 Run
```
（`npm run app:android` = build:www + cap copy + open，一步到位。）

> ⚠️ **内购只能在真机 + Play 内部测试轨道里测**，模拟器测不了支付。流程：Android Studio 生成签名 AAB → 上传 Play 内部测试 → 加测试账号 → 真机装测试版购买（RevenueCat 沙盒不真实扣款）。

---

## iOS（以后再做）

代码层已兼容（`apiKey()` 自动按平台选 `appl_` key）。届时：`npx cap add ios` → 需要 Mac + Xcode + Apple Developer（$99/年）→ App Store Connect 建同名内购产品 → RevenueCat 连 App Store → 填 `RC_API_KEY.ios`。
