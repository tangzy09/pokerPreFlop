#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 Android 通知状态栏小图标 ic_stat_notify（纯白透明的 ♠ 剪影）。
   Android 只用图标的 alpha 通道、把不透明部分涂成单色，所以必须白色透明，否则显示白方块。
   多密度输出到 android/app/src/main/res/drawable-*/。运行：python tools/gen-notify-icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96}

def font(sz):
    for p in ["C:/Windows/Fonts/seguisym.ttf", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/Arial.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

for dens, S in SIZES.items():
    SS = 4  # 超采样抗锯齿
    img = Image.new("RGBA", (S*SS, S*SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(int(S*SS*0.86))
    bb = d.textbbox((0, 0), "♠", font=f)
    w, h = bb[2]-bb[0], bb[3]-bb[1]
    d.text(((S*SS-w)/2 - bb[0], (S*SS-h)/2 - bb[1]), "♠", font=f, fill=(255, 255, 255, 255))
    img = img.resize((S, S), Image.LANCZOS)
    out = os.path.join(ROOT, "android", "app", "src", "main", "res", "drawable-" + dens)
    os.makedirs(out, exist_ok=True)
    img.save(os.path.join(out, "ic_stat_notify.png"))
    print("drawable-%s/ic_stat_notify.png (%dx%d)" % (dens, S, S))
print("done")
