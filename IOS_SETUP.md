# iOS 上线手册(无 Mac 路线)

> 代码侧已就绪:`ios/` Capacitor 工程(appId `com.pokerpreflop.trainer`、显示名 Preflop Camp、
> 1024 图标、ITSAppUsesNonExemptEncryption=false)。打 iOS 包必须 macOS——用云端 Mac 代替本地。

## ⚡ 路线选择(2026-07 更新):首选 Codemagic,GitHub Actions 降为备用

**首选:Codemagic 云构建(`codemagic.yaml`,workflow `preflop-testflight`)** —— 该流程已在
japansese-study 项目(Mando)完整跑通上过 TestFlight,且账号级资产全部现成复用:

| 复用项 | 状态 |
|---|---|
| Codemagic 账号 + GitHub 授权 + `ASC API Key` 集成 | japanese-study 时已配好 |
| App Store Connect API Key(.p8,账号级) | 同一条,不用再生成 |
| 签名私钥 CERTIFICATE_PRIVATE_KEY(`ios_signing` 组) | 同一把,自动签名复用 |

Codemagic「自动代码签名」用 API Key 自动创建/拉取发布证书 + 描述文件 ——
**下文第 5 步(openssl 手搓 CSR/p12 + 6 个 GitHub secrets)整个跳过**。
Codemagic 路线的完整步骤 = 第 1、2 步(App ID + app 记录)→ Codemagic「Add application」
选本仓库并给 app 挂上 `ios_signing` 环境组 → 数字 App ID 回填 `codemagic.yaml` → Start build。
收费相关的第 3、4 步(订阅商品 + RevenueCat)与第 6-7 步(TestFlight 验证 + 提审)两条路线通用。
姐妹站 poker-post-flop 已同法配好(`poker-post-flop/codemagic.yaml` + `docs/IOS-CODEMAGIC.md`)。

**备用:GitHub Actions**(`.github/workflows/ios-build.yml`,即下文原方案)——保留应急,
但需手工证书链(第 5 步),仅在 Codemagic 免费额度不够/服务不可用时启用。

## 已完成(代码侧)

- `npx cap add ios` 工程 + `cap copy ios`(www 同步)
- Info.plist:显示名 **Preflop Camp**、出口合规豁免(免每次 TestFlight 问询)
- AppIcon 1024(`tools/gen-store-assets.py` 从矢量源重生成,勿手改 png)
- RevenueCat 适配层跨端(`js/purchases.js` 的 `apiKey()` 按平台取 key;iOS key 现为占位 `appl_REPLACE_ME`)
- CI:`.github/workflows/ios-build.yml`
  - 默认(无 secrets):无签名编译——验证工程健康
  - `upload=true` + secrets 齐:签名 archive → 上传 TestFlight

## 你要做的(账号/后台,按顺序)

### 1. Apple Developer Program($99/年)
https://developer.apple.com/programs/enroll/ ——个人账号即可,审核 1-2 天。

### 2. App Store Connect 建 App
- Identifiers:注册 Bundle ID `com.pokerpreflop.trainer`(App IDs → App,capability 默认即可;
  用到 In-App Purchase 会自动带上)
- My Apps → ➕ New App:平台 iOS、名称(建议 `Preflop Camp — GTO Poker`,listing 文案见
  store-assets/listing.md)、语言 en、Bundle ID 选上面的、SKU 随意(如 preflopcamp)

### 3. 订阅产品(App Store Connect → 该 App → Subscriptions)
- 建 Subscription Group(如 `pro`)
- `pro_yearly` $29.99/年 → **加 7 天免费试用**(Introductory Offer → Free trial → 1 week)
- `pro_monthly` $4.99/月
- 产品 id 与 Android 同名(purchases.js 的 MATCH 两端通用)

### 4. RevenueCat 加 iOS app
- RevenueCat → Project → Apps → ➕ App Store app,填 Bundle ID
- App Store Connect → Users and Access → Integrations → **In-App Purchase Key**(p8)传给 RevenueCat
- 把两个订阅产品 attach 到 `pro` entitlement(⚠ 忘了 attach = 扣钱不解锁,Android 踩过)
- Offering `default` 里 packages(annual/monthly)是跨平台的,把 iOS 产品挂进同一 offering
- 拿 **Public API key(`appl_` 开头)** → 填进 `js/purchases.js` 的 `RC_API_KEY.ios`

### 5. 证书 + GitHub secrets(CI 签名用)
无 Mac 生成分发证书:App Store Connect → Certificates 页可直接创建 **Apple Distribution**
证书(需先在任一台机器上生成 CSR——Windows 可用 openssl:
`openssl req -new -newkey rsa:2048 -nodes -keyout ios_dist.key -out ios_dist.csr`)。
下载 cer 后合成 p12:`openssl pkcs12 -export -inkey ios_dist.key -in ios_dist.cer -out dist.p12`。
再建 **App Store provisioning profile**(Profiles → Distribution → App Store,选 Bundle ID+证书)。

仓库 Settings → Secrets and variables → Actions,填 6 个:
| secret | 内容 |
|---|---|
| APPSTORE_ISSUER_ID | ASC → Users and Access → Integrations → Issuer ID |
| APPSTORE_KEY_ID | 同页建 API Key(App Manager 权限)后的 Key ID |
| APPSTORE_P8 | 该 Key 的 .p8 文件全文 |
| BUILD_CERT_P12_BASE64 | `openssl base64 -in dist.p12` 输出 |
| BUILD_CERT_PASSWORD | p12 导出密码 |
| PROVISION_B64 | `openssl base64 -in profile.mobileprovision` 输出 |

### 6. 构建 + TestFlight
GitHub → Actions → **iOS build** → Run workflow:
- 先不勾 upload 跑一次(验证编译)
- 勾 `upload=true` 再跑 → 成功后 TestFlight 里出现构建,加自己为内测员真机装
- **验证 IAP 沙盒购买**(Settings → App Store → Sandbox Account 用 ASC 建的沙盒测试员)

### 7. 提审
App Store listing(截图可复用 store-assets/new-*.png,iOS 需 6.7"/6.5" 尺寸——可用
`tools/gen-store-shots.js` 调 window-size 重出)、隐私标签(不收集数据)、审核备注写明
「训练工具,非真钱赌博」。苹果对扑克类会人工多看一眼,诚实定位是加分项。

## 注意

- `ios/` 工程无敏感信息可入公开库(签名材料全在 secrets);`.p8/.p12/.key/.mobileprovision`
  **绝不入库**(.gitignore 已有 *.pem,补 *.p8/*.p12/*.mobileprovision)
- versionCode/versionName 由 Xcode 工程 MARKETING_VERSION/CURRENT_PROJECT_VERSION 管,
  CI 里每次上传 TestFlight 前需要 bump CURRENT_PROJECT_VERSION(重复 build 号会被 ASC 拒)
