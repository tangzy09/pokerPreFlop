#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 Google Play 商店图形素材：App 图标 512x512 + 功能图 1024x500。
   主题沿用 app：深绿底 + 金色 + 扑克牌。输出到 store-assets/。
   运行：python tools/gen-store-assets.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from _imgutil import font

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "store-assets")
os.makedirs(OUT, exist_ok=True)

# 颜色（取自 app 的 CSS 变量）
INK_BG   = (15, 21, 17)     # #0f1511 深绿黑
BG2      = (22, 35, 26)     # 稍亮的绿
GOLD     = (232, 198, 106)  # #e8c66a
GOLD2    = (184, 144, 47)
GREEN    = (90, 200, 140)
RED      = (224, 96, 96)
INK      = (240, 245, 238)

# font() 已移到 tools/_imgutil.py（与 gen-notify-icon 共用）

def vgrad(w, h, top, bot):
    """竖直渐变背景"""
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img

def rounded(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

SUIT = {"spade":"♠", "heart":"♥", "club":"♣", "diam":"♦"}

def card(w, h, rank, suit, suit_color):
    """画一张扑克牌（白底圆角，左上角 rank+花色），返回 RGBA"""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded(d, [0, 0, w - 1, h - 1], int(w * 0.13), fill=(252, 250, 245, 255),
            outline=(210, 205, 195, 255), width=max(2, w // 90))
    rf = font(int(h * 0.30))
    sf = font(int(h * 0.30))
    pad = int(w * 0.12)
    d.text((pad, pad - int(h*0.04)), rank, font=rf, fill=suit_color)
    # 花色用文字符号；Arial 含基本花色字形
    d.text((pad, pad + int(h * 0.26)), SUIT[suit], font=sf, fill=suit_color)
    # 中心大花色
    cf = font(int(h * 0.46))
    bb = d.textbbox((0, 0), SUIT[suit], font=cf)
    cw, ch = bb[2]-bb[0], bb[3]-bb[1]
    d.text(((w - cw) / 2 - bb[0], (h - ch) / 2 - bb[1]), SUIT[suit], font=cf, fill=suit_color)
    return img

# ---------------- App 图标 512x512（4x 超采样抗锯齿）----------------
def make_icon():
    SS = 4                     # 超采样倍数
    S = 512 * SS
    img = vgrad(S, S, BG2, INK_BG).convert("RGBA")
    d = ImageDraw.Draw(img)
    # 圆角金色细边框
    rounded(d, [8*SS, 8*SS, S-9*SS, S-9*SS], 96*SS, fill=None, outline=(*GOLD, 110), width=4*SS)
    # 两张牌扇形展开：K♠（后、右倾）+ A♥（前、左倾），都露出来、整体居中偏下
    cw, ch = 196*SS, 274*SS
    k = card(cw, ch, "K", "spade", (28, 28, 32, 255)).rotate(16, expand=True, resample=Image.BICUBIC)
    a = card(cw, ch, "A", "heart", RED + (255,)).rotate(-14, expand=True, resample=Image.BICUBIC)
    cy = S//2 + 24*SS
    img.alpha_composite(k, (S//2 - k.width//2 + 92*SS, cy - k.height//2))
    img.alpha_composite(a, (S//2 - a.width//2 - 92*SS, cy - a.height//2))
    # 顶部 GTO 金标
    gf = font(104*SS)
    bb = d.textbbox((0,0), "GTO", font=gf)
    d.text(((S-(bb[2]-bb[0]))/2 - bb[0], 44*SS), "GTO", font=gf, fill=GOLD)
    img.resize((512, 512), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, "icon-512.png"))
    print("icon-512.png")
    # iOS AppIcon(1024,Capacitor 命名 512@2x):直接从超采样原图缩,质量最优
    ios_icon = os.path.join(os.path.dirname(OUT), "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png")
    if os.path.isdir(os.path.dirname(ios_icon)):
        img.resize((1024, 1024), Image.LANCZOS).convert("RGB").save(ios_icon)
        print("ios AppIcon-512@2x.png (1024)")

# ---------------- 功能图 1024x500 ----------------
def make_feature():
    W, H = 1024, 500
    img = vgrad(W, H, BG2, INK_BG).convert("RGBA")
    d = ImageDraw.Draw(img)
    # 右侧装饰：淡化的 13x13 范围矩阵
    gx, gy, cell = past = past_x = 640, 70, 26
    cats = [GOLD, GREEN, (90,110,95), (40,55,45)]
    import random
    random.seed(7)
    for r in range(13):
        for c in range(13):
            col = cats[min(3, abs(r - c)) if r+c>4 else random.randint(0,1)]
            x = 612 + c * 30; y = 60 + r * 30
            rounded(d, [x, y, x+26, y+26], 5, fill=(*col, 70))
    # 两张牌叠在右侧
    cw, ch = 150, 210
    k = card(cw, ch, "A", "spade", (28,28,32,255)).rotate(11, expand=True)
    a = card(cw, ch, "K", "spade", (28,28,32,255)).rotate(-7, expand=True)
    img.alpha_composite(k, (W-260, H-ch-30))
    img.alpha_composite(a, (W-360, H-ch-6))
    # 左侧文字
    t1 = font(74); t2 = font(40, bold=False); t3 = font(30, bold=False)
    d.text((54, 120), "Poker GTO", font=t1, fill=GOLD)
    d.text((54, 200), "Trainer", font=t1, fill=INK)
    d.text((56, 300), "Master preflop decisions", font=t2, fill=INK)
    d.text((56, 352), "Open · 3-bet · Squeeze · Push/Fold", font=t3, fill=(150,170,158))
    img.convert("RGB").save(os.path.join(OUT, "feature-1024x500.png"))
    print("feature-1024x500.png")

# ---------------- 手机截图加框（解决 2:1 比例 + 营销标题）----------------
def frame(src, title, sub, out):
    if not os.path.exists(os.path.join(OUT, src)):
        print("跳过（缺截图）:", src); return
    W, H = 1080, 1920                       # 9:16，符合 Play 比例上限
    bg = vgrad(W, H, BG2, INK_BG).convert("RGBA")
    d = ImageDraw.Draw(bg)
    tf = font(60); sf = font(34, bold=False)
    bb = d.textbbox((0, 0), title, font=tf); d.text(((W-(bb[2]-bb[0]))/2, 72), title, font=tf, fill=GOLD)
    bb = d.textbbox((0, 0), sub, font=sf);   d.text(((W-(bb[2]-bb[0]))/2, 156), sub, font=sf, fill=(170, 190, 178))
    s = Image.open(os.path.join(OUT, src)).convert("RGBA")
    th = 1470; sw = int(s.width * th / s.height)
    s = s.resize((sw, th), Image.LANCZOS)
    x = (W - sw)//2; y = 300
    bg.alpha_composite(s, (x, y))
    d.rounded_rectangle([x-3, y-3, x+sw+2, y+th+2], radius=30, outline=(*GOLD, 130), width=3)
    bg.convert("RGB").save(os.path.join(OUT, out)); print(out)

make_icon()
# make_feature()  # 已被 tools/gen-store-shots.js 的 HTML 版取代(npm run shots),勿再覆盖 shots 产物
# frame("shot1-start.png",    "Full GTO Ranges",      "All 169 starting hands, every spot",   "play-1.png")
# frame("shot2-train.png",    "Drill Real Decisions", "Fold / Call / Raise - instant grading", "play-2.png")
# frame("shot3-feedback.png", "Learn From Mistakes",  "Range chart + coaching on every hand",  "play-3.png")
# frame("shot-nash.png",      "Computed Nash Charts",  "Per-hand push/fold EV - any ante, stack, position", "play-4.png")
print("done ->", OUT)
