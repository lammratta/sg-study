#!/usr/bin/env python3
"""アプリアイコン（PNG）を生成する。 .venv/bin/python -I scripts/make_icons.py"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
BG = (47, 111, 237)
FG = (255, 255, 255)


def font(size):
    for p in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/HelveticaNeue.ttc", "/Library/Fonts/Arial.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), BG if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not maskable:
        r = int(size * 0.22)
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=BG)
    # 盾
    cx, top, w = size / 2, size * 0.2, size * 0.5
    pts = [(cx - w / 2, top), (cx + w / 2, top), (cx + w / 2, top + w * 0.7), (cx, top + w * 1.15), (cx - w / 2, top + w * 0.7)]
    d.polygon(pts, outline=FG, width=max(2, size // 40))
    f = font(int(size * 0.26))
    tw, th = d.textbbox((0, 0), "SG", font=f)[2:]
    d.text((cx - tw / 2, top + w * 0.5 - th / 2 - size * 0.02), "SG", font=f, fill=FG)
    return img


icon(192).save(OUT / "icon-192.png")
icon(512).save(OUT / "icon-512.png")
icon(512, maskable=True).save(OUT / "icon-512-maskable.png")
icon(180).convert("RGB").save(OUT / "apple-touch-icon-180.png")
print("icons ->", OUT)
