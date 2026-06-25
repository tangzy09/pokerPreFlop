#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tools/ 共享图像 helper —— gen-store-assets.py 与 gen-notify-icon.py 复用。
   font(size, bold, symbol)：按需选 Windows 字体候选，找不到则回退 PIL 默认字体。
     symbol=True → Segoe UI Symbol（含 ♠♥♦♣ 等字形，通知图标用）
     bold=True   → Arial Bold（标题/素材用，默认）
     否则        → Arial Regular
"""
import os
from PIL import ImageFont

def font(size, bold=True, symbol=False):
    if symbol:
        cands = ["C:/Windows/Fonts/seguisym.ttf", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/Arial.ttf"]
    elif bold:
        cands = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/Arialbd.ttf"]
    else:
        cands = ["C:/Windows/Fonts/arial.ttf"]
    for p in cands:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()
