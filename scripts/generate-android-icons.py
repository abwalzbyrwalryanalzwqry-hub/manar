#!/usr/bin/env python3
"""منار — توليد أيقونات أندرويد من الأيقونة الرسمية.

المصدر: design/manar-icon-source.png (تصميم البطاقة الرسمي: منارة ذهبية + كلمة
«منار» على خلفية خضراء بنقش نجمي).

يُنتج:
  mipmap-*/ic_launcher.png             أيقونة قديمة (API 24-25) بزوايا دائرية
  mipmap-*/ic_launcher_round.png       نسخة دائرية
  mipmap-*/ic_launcher_background.png  طبقة الخلفية للأيقونة التكيّفية
  mipmap-*/ic_launcher_foreground.png  طبقة الرمز داخل المنطقة الآمنة (66%)
  mipmap-*/ic_launcher_monochrome.png  طبقة أحادية لأيقونات أندرويد ١٣+ المُنسّقة

التشغيل:  python3 scripts/generate-android-icons.py
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "manar-icon-source.png"
RES = ROOT / "android/app/src/main/res"

# كثافات أندرويد: اسم المجلد -> حجم الأيقونة القديمة (بكسل)
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# الطبقات التكيّفية ١٠٨dp
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

GREEN_TOP = (18, 96, 80)
GREEN_BOTTOM = (8, 47, 40)
GOLD = (201, 162, 39)


def card() -> Image.Image:
    """البطاقة وحدها، مقصوصة من الصورة المصدر بدون الخلفية الضبابية."""
    im = Image.open(SOURCE).convert("RGB")
    if im.size == (1024, 1024):
        im = im.crop((122, 126, 908, 912))
    return im.resize((768, 768), Image.LANCZOS)


def art_rgba() -> Image.Image:
    """الرمز الذهبي + الهالة + كلمة «منار» على خلفية شفافة.

    الشفافية تُحسب من «ذهبية» البكسل: الأخضر في البطاقة أزرقه ≥ أحمره فيصبح
    شفافًا، والذهب والهالة الدافئة تبقى. ثم يُفَكّ خلط اللون مع الخضرة
    (unpremultiply) حتى لا تخرج الحواف نصف الشفافة داكنة ومطفأة.
    """
    c = card()
    a = np.asarray(c).astype(np.float64)
    # كتلة الرمز وحدها، بلا نقش الخلفية ولا حواف البطاقة
    # نحذف كلمة MANAR اللاتينية: غير مقروءة بحجم الأيقونة
    a = a[56:678, 206:562]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    # ذهبية صريحة -> عتامة كاملة، والهالة الدافئة -> عتامة متدرّجة
    alpha = ((r - b - 18) / 52.0).clip(0, 1) * ((r + g + b) / 3.0 - 68).clip(0, 40) / 40.0
    alpha = np.where(alpha < 0.05, 0.0, alpha)

    # سدّ الفجوات داخل أوجه المنارة الداكنة (إغلاق مورفولوجي) حتى لا تظهر
    # الخلفية من خلال الشكل الصلب، مع ترك فراغ حلقة الهالة كما هو
    core = Image.fromarray(((alpha > 0.82) * 255).astype(np.uint8), "L")
    core = core.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    core = core.filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.maximum(alpha, np.asarray(core).astype(np.float64) / 255.0)

    # فَكّ الخلط مع خضرة البطاقة لاستعادة الذهب الصريح
    bg = np.array([22.0, 74.0, 66.0])
    safe = np.maximum(alpha, 0.20)[..., None]
    rgb = ((a - (1 - safe) * bg) / safe).clip(0, 255)

    img = Image.fromarray(
        np.dstack([rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)]), "RGBA"
    )
    img.putalpha(img.getchannel("A").filter(ImageFilter.MedianFilter(3)))
    box = img.getchannel("A").getbbox()
    return img.crop(box) if box else img


def background(size: int) -> Image.Image:
    """تدرّج أخضر + نقش نجمي خفيف، يملأ الإطار كاملًا (full-bleed)."""
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        d.line(
            [(0, y), (size, y)],
            fill=tuple(int(GREEN_TOP[i] + (GREEN_BOTTOM[i] - GREEN_TOP[i]) * t) for i in range(3)),
        )

    # النقش: مربّعات بزوايا دائرية داخلها نجمة رباعية، بتباين منخفض جدًا
    scale = 4
    big = img.resize((size * scale, size * scale), Image.LANCZOS)
    pd = ImageDraw.Draw(big, "RGBA")
    step = size * scale / 3.35
    pad = step * 0.17
    line = max(1, int(size * scale / 260))
    for row in range(-1, 5):
        for col in range(-1, 5):
            x0 = col * step + (step / 2 if row % 2 else 0)
            y0 = row * step
            pd.rounded_rectangle(
                [x0 + pad, y0 + pad, x0 + step - pad, y0 + step - pad],
                radius=step * 0.1,
                outline=(255, 255, 255, 16),
                width=line,
            )
            cx, cy, rr = x0 + step / 2, y0 + step / 2, (step - 2 * pad) * 0.34
            pts = []
            for k in range(8):
                ang = math.pi / 2 * (k / 2) - math.pi / 2
                rad = rr if k % 2 == 0 else rr * 0.34
                pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
            pd.polygon(pts, outline=(255, 255, 255, 18))
    img = big.resize((size, size), Image.LANCZOS)

    # إضاءة ناعمة أعلى اليسار توحي بالعمق نفسه الموجود في التصميم المصدر
    glow = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glow).ellipse(
        [-size * 0.35, -size * 0.45, size * 0.85, size * 0.75], fill=44
    )
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.14))
    img = Image.composite(Image.new("RGB", (size, size), (34, 122, 102)), img, glow)
    return img


def fit(art: Image.Image, canvas: int, box_ratio: float, center_y: float) -> Image.Image:
    """يضع الرمز داخل مربّع نسبته box_ratio من الإطار، مع مركز رأسي محدد."""
    box = canvas * box_ratio
    k = min(box / art.width, box / art.height)
    w, h = max(1, int(art.width * k)), max(1, int(art.height * k))
    layer = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    layer.paste(
        art.resize((w, h), Image.LANCZOS),
        (int((canvas - w) / 2), int(canvas * center_y - h / 2)),
        art.resize((w, h), Image.LANCZOS),
    )
    return layer


def rounded(img: Image.Image, radius_ratio: float) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, img.size[0] - 1, img.size[1] - 1],
        radius=int(img.size[0] * radius_ratio),
        fill=255,
    )
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def circle(img: Image.Image) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, img.size[0] - 1, img.size[1] - 1], fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def main() -> None:
    art = art_rgba()
    print(f"[manar] art extracted: {art.size}")

    # الأيقونة الكاملة (خلفية + رمز) تُستخدم للنسخ القديمة والدائرية
    for name, size in LEGACY.items():
        base = background(size * 4)
        full = base.convert("RGBA")
        full.alpha_composite(fit(art, size * 4, 0.78, 0.5))
        full = full.resize((size, size), Image.LANCZOS)
        out = RES / f"mipmap-{name}"
        out.mkdir(parents=True, exist_ok=True)
        rounded(full, 0.22).save(out / "ic_launcher.png")
        circle(full).save(out / "ic_launcher_round.png")

    for name, size in ADAPTIVE.items():
        out = RES / f"mipmap-{name}"
        out.mkdir(parents=True, exist_ok=True)
        background(size).save(out / "ic_launcher_background.png")
        # المنطقة الآمنة للأيقونة التكيّفية ٦٦٪ من الإطار
        fg = fit(art, size, 0.64, 0.475)
        fg.save(out / "ic_launcher_foreground.png")
        mono = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        mono.putalpha(fg.getchannel("A"))
        white = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        white.putalpha(fg.getchannel("A"))
        white.save(out / "ic_launcher_monochrome.png")

    # علامة شاشة البداية: نفس الرمز الذهبي على شفافية، بمقاس ثابت
    splash_dir = RES / "drawable-nodpi"
    splash_dir.mkdir(parents=True, exist_ok=True)
    splash = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    k = min(512 * 0.86 / art.width, 512 * 0.86 / art.height)
    scaled = art.resize((int(art.width * k), int(art.height * k)), Image.LANCZOS)
    splash.paste(scaled, ((512 - scaled.width) // 2, (512 - scaled.height) // 2), scaled)
    splash.save(splash_dir / "manar_splash_mark.png")

    print("[manar] launcher icons written for 5 densities")
    print("[manar] splash mark written to drawable-nodpi/manar_splash_mark.png")


if __name__ == "__main__":
    main()
