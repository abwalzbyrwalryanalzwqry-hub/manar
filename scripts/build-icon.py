#!/usr/bin/env python3
"""منار — توليد أيقونة التطبيق بكل مقاساتها.

الفكرة: «منار» هي المنارة التي تبعث النور — فالأيقونة مِنارة ذات مصباح متوهّج
تنبعث منه أشعّة، لا شكلاً هندسياً عاماً لا يقول شيئاً عن التطبيق.

قيود أيقونة أندرويد التكيّفية التي يحترمها هذا السكربت:
  • لوحة الطبقة الأمامية ١٠٨dp، لكن المضمون المرئي هو دائرة ٦٦dp في الوسط
    فقط — ما خرج عنها يقصّه المُشغّل بحسب شكل الأيقونة في كل هاتف. فكل
    عناصر الرسم محصورة داخل تلك الدائرة.
  • `res/mipmap-*` تحتاج المقاس القديم المربّع أيضاً لهواتف أندرويد ٧ وأقدم.
  • الطبقة الأحادية (monochrome) لأيقونات أندرويد ١٣ الملوّنة بالسمة.

التشغيل: python3 scripts/build-icon.py
"""

from __future__ import annotations

import io
import subprocess
import sys
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"

# هوية منار من src/styles.css
EMERALD = "#0E7A5F"
EMERALD_DEEP = "#062E24"
GOLD = "#C9A227"
GOLD_LIGHT = "#F0D160"
GOLD_PALE = "#FFF3C4"
BG_DEEP = "#0B1F1A"

# لوحة ٤٣٢ = ١٠٨dp × ٤ (xxxhdpi). الدائرة الآمنة نصف قطرها ١٣٢ من المركز.
C = 432
CX = CY = C / 2

# أندرويد يضمن ظهور دائرة ٦٦dp من الطبقة الأمامية، ويُظهر ٧٢dp في عامّة أشكال
# المُشغّلات. أقصى بُعد في المعلم عن مركزه ١٨٤ وحدة (طرف الهلال)، فنقيسه إلى
# نصف قطر ٧٢dp (=١٤٤ وحدة) حتى لا يُقصّ طرفُه على هاتفٍ يستعمل قناعاً دائرياً.
MARK_REACH = 184.0
FG_SCALE = round(144.0 / MARK_REACH, 3)


import math


def _ray(angle_deg: float, inner: float, outer: float, width: float) -> str:
    """شعاع مُدبَّب يبدأ من خارج غرفة المصباح لا من مركزها.

    البدء من المركز يدفن الشعاع كلّه تحت الغرفة المرسومة فوقه، فلا يظهر منه
    إلا طرفه — وهو ما جعل النسخة الأولى تبدو كتلةً شائكة.
    """
    lx, ly = LAMP
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    bx, by = lx + ca * inner, ly - sa * inner
    ex, ey = lx + ca * outer, ly - sa * outer
    px, py = -sa * width, -ca * width
    return f"M {bx + px:.1f} {by + py:.1f} L {ex:.1f} {ey:.1f} L {bx - px:.1f} {by - py:.1f} Z"


LAMP = (0.0, -88.0)  # مركز المصباح — منه تنبعث الأشعّة

# أربعة أشعّة سميكة لا ستّة رفيعة: عند ٤٨ بكسل يصير الشعاع الرفيع بكسلاً واحداً
# باهتاً، فتتحوّل الأشعّة مجتمعةً إلى ضجيج حول المصباح بدل إشعاع. ولا شعاع
# عمودي: موضعه هو موضع القبّة والسارية والهلال بالضبط، فيبتلعها ذهبٌ فوق ذهب
# ويضيع أظهر ما يدلّ على أن هذا مِئذنة.
RAYS = [(52, 100, 11, 0.95), (128, 100, 11, 0.95), (12, 86, 9, 0.7), (168, 86, 9, 0.7)]

# هندسة المعلم كاملةً في مصدر واحد: (مسار، الدور، الشفافية، قاعدة الملء، دوران).
# الدور يُترجَم إلى لون عند الإخراج، فتخرج نسخة SVG ونسخة متّجه أندرويد من
# الأرقام نفسها ولا تتباعد النسختان مع كل تعديل.
#
# ملاحظتان في الهندسة:
#   • الباب ثقبٌ بقاعدة الملء الزوجي-الفردي لا شكلٌ ملوّن، فيُظهر ما خلفه —
#     التدرّج في الأيقونة المربّعة والطبقة الخلفية في التكيّفية — فيصحّ في
#     الحالتين معاً بلا لون مُقحَم.
#   • الهلال دائرتان بالقاعدة نفسها لا قوسان بينهما وتر: القوسان يبطلان متى
#     كان نصف قطر الداخلي أصغر من نصف الوتر، فيُصحّحه العارض إلى نصف دائرة
#     فيُلغي الخارجي ويختفي الشكل كلّه.
MARK: list[tuple[str, str, float, str, float]] = (
    [(_ray(a, 26, o, w), "ray", op, "nonzero", 0.0) for a, o, w, op in RAYS]
    + [
        # القاعدة
        ("M -74 128 L 74 128 L 62 104 L -62 104 Z", "body", 1.0, "nonzero", 0.0),
        ("M -84 128 L 74 128 A 10 10 0 0 1 74 148 L -74 148 A 10 10 0 0 1 -74 128 Z",
         "body", 1.0, "nonzero", 0.0),
        # الجسم المستدقّ وبابه المقتطع
        ("M -40 104 L -28 -20 L 28 -20 L 40 104 Z M -11 4 L 11 4 L 11 58 Q 0 70 -11 58 Z",
         "body", 1.0, "evenOdd", 0.0),
        # الشُّرفة
        ("M -47 -20 L 47 -20 L 39 -38 L -39 -38 Z", "body", 1.0, "nonzero", 0.0),
        ("M -47.5 -46 L 47.5 -46 A 4.5 4.5 0 0 1 47.5 -37 L -47.5 -37 A 4.5 4.5 0 0 1 -47.5 -46 Z",
         "body", 1.0, "nonzero", 0.0),
        # غرفة المصباح
        ("M -16 -101 L 16 -101 A 7 7 0 0 1 23 -94 L 23 -53 A 7 7 0 0 1 16 -46 L -16 -46 "
         "A 7 7 0 0 1 -23 -53 L -23 -94 A 7 7 0 0 1 -16 -101 Z", "body", 1.0, "nonzero", 0.0),
        # زجاج المصباح
        ("M -7 -92 L 7 -92 A 6 6 0 0 1 13 -86 L 13 -61 A 6 6 0 0 1 7 -55 L -7 -55 "
         "A 6 6 0 0 1 -13 -61 L -13 -86 A 6 6 0 0 1 -7 -92 Z", "lamp", 1.0, "nonzero", 0.0),
        # القبّة
        ("M -28 -101 Q 0 -134 28 -101 Z", "body", 1.0, "nonzero", 0.0),
        # السارية
        ("M -3.5 -146 L 3.5 -146 L 3.5 -130 L -3.5 -130 Z", "body", 1.0, "nonzero", 0.0),
        # الهلال
        ("M 0 -184 A 22 22 0 1 0 0 -140 A 22 22 0 1 0 0 -184 Z "
         "M 15 -180 A 19 19 0 1 0 15 -142 A 19 19 0 1 0 15 -180 Z",
         "body", 1.0, "evenOdd", -25.0),
    ]
)


def minaret(scale: float = 1.0, mono: bool = False) -> str:
    """المعلم كمجموعة SVG. `mono=True` يُخرجه أبيض صُلباً بلا تدرّج ولا شفافية.

    الأحادية بلا تدرّجات عمداً: أندرويد ١٣ يُلوّن تلك الطبقة بسمة النظام
    ويستخدم قناة الشفافية قناعاً، فأي تدرّج يظهر فيها بقعاً وسخة.
    """
    colors = {"body": GOLD, "lamp": GOLD_PALE, "ray": GOLD_LIGHT}
    parts = []
    for d, role, op, rule, rot in MARK:
        fill = "#FFFFFF" if mono else colors[role]
        o = 1.0 if mono else op
        t = f' transform="rotate({rot} 0 -162)"' if rot else ""
        r = ' fill-rule="evenodd"' if rule == "evenOdd" else ""
        parts.append(f'<path d="{d}" fill="{fill}" opacity="{o}"{r}{t}/>')

    lx, ly = LAMP
    halo = "" if mono else f'<circle cx="{lx}" cy="{ly}" r="46" fill="url(#halo)"/>'
    # الهالة بعد الأشعّة وقبل جسم المنارة، فلا تُغبّش حوافّ المعلم الصلبة
    rays_n = len(RAYS)
    return (
        f'\n  <g transform="translate({CX} {CY}) scale({scale})">\n    '
        + "".join(parts[:rays_n])
        + halo
        + "".join(parts[rays_n:])
        + "\n  </g>"
    )


def android_vector(viewport: float, reach: float, mono: bool) -> str:
    """المعلم نفسه كمتّجه أندرويد (`res/drawable/*.xml`).

    نُخرجه متّجهاً لا PNG لأن أيقونة شريط الإشعارات والقناع الأحادي يُعاد
    قياسهما على كثافات لا نعرفها سلفاً، والمتّجه لا يتحبّب. `reach` نصف
    القطر المتاح للمعلم داخل `viewport`.
    """
    colors = {"body": GOLD, "lamp": GOLD_PALE, "ray": GOLD_LIGHT}
    k = reach / MARK_REACH
    c = viewport / 2
    out = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<!-- مُولَّد بـ scripts/build-icon.py — لا يُحرَّر يدوياً -->",
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        f'    android:width="{viewport:g}dp" android:height="{viewport:g}dp"',
        f'    android:viewportWidth="{viewport:g}" android:viewportHeight="{viewport:g}">',
        f'  <group android:translateX="{c:g}" android:translateY="{c:g}" '
        f'android:scaleX="{k:.5f}" android:scaleY="{k:.5f}">',
    ]
    for d, role, op, rule, rot in MARK:
        fill = "#FFFFFF" if mono else colors[role]
        o = 1.0 if mono else op
        path = (
            f'      <path android:pathData="{" ".join(d.split())}" '
            f'android:fillColor="{fill}" android:fillAlpha="{o:g}" '
            # أندرويد يكتبها `nonZero` بحرف كبير، وSVG يكتبها `nonzero`. القيمة
            # المخالفة ليست تجاهلاً صامتاً بل خطأ بناء يُفشل AAPT كلّه.
            f'android:fillType="{"evenOdd" if rule == "evenOdd" else "nonZero"}"/>'
        )
        if rot:
            out.append(
                f'    <group android:rotation="{rot:g}" '
                f'android:pivotX="0" android:pivotY="-162">'
            )
            out.append("  " + path)
            out.append("    </group>")
        else:
            out.append(path)
    out += ["  </group>", "</vector>", ""]
    return "\n".join(out)


def svg_foreground(mono: bool = False) -> str:
    """الطبقة الأمامية للأيقونة التكيّفية — بلا خلفية."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <radialGradient id="halo">
      <stop offset="0%" stop-color="{GOLD_PALE}" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="{GOLD_LIGHT}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="{GOLD_LIGHT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  {minaret(FG_SCALE, mono=mono)}
</svg>"""


def svg_legacy() -> str:
    """الأيقونة المربّعة القديمة — خلفية وزوايا مستديرة بنفسها.

    أندرويد ٧ وأقدم لا يقصّ شكلاً، فنرسم الحدود المستديرة هنا. والمعلم أصغر
    قليلاً لأن هذه اللوحة لا تُقتطع، بخلاف التكيّفية.
    """
    r = C * 0.235  # نسبة استدارة قريبة من squircle أندرويد
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{EMERALD}"/>
      <stop offset="55%" stop-color="{EMERALD_DEEP}"/>
      <stop offset="100%" stop-color="{BG_DEEP}"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0%" stop-color="{GOLD_PALE}" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="{GOLD_LIGHT}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="{GOLD_LIGHT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="{EMERALD}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="{EMERALD}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="sq"><rect width="{C}" height="{C}" rx="{r}" ry="{r}"/></clipPath>
  </defs>
  <g clip-path="url(#sq)">
    <rect width="{C}" height="{C}" fill="url(#bg)"/>
    <!-- توهّج خلفي متلاشي الحافّة؛ القرص الصلب يترك خطّاً مرئياً يُقرأ كعيب طباعة -->
    <circle cx="{CX}" cy="{CY * 0.72}" r="{C * 0.5}" fill="url(#glow)"/>
    {minaret(0.92)}
  </g>
</svg>"""


def svg_round() -> str:
    """الأيقونة الدائرية لمُشغّلات أندرويد ٧ التي تطلبها."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{EMERALD}"/>
      <stop offset="55%" stop-color="{EMERALD_DEEP}"/>
      <stop offset="100%" stop-color="{BG_DEEP}"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0%" stop-color="{GOLD_PALE}" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="{GOLD_LIGHT}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="{GOLD_LIGHT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="{EMERALD}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="{EMERALD}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="ci"><circle cx="{CX}" cy="{CY}" r="{CX}"/></clipPath>
  </defs>
  <g clip-path="url(#ci)">
    <rect width="{C}" height="{C}" fill="url(#bg)"/>
    <circle cx="{CX}" cy="{CY * 0.72}" r="{C * 0.5}" fill="url(#glow)"/>
    {minaret(0.80)}
  </g>
</svg>"""


def render(svg: str, size: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


# (المجلد، مقاس الأيقونة القديمة، مقاس الطبقة الأمامية ١٠٨dp)
DENSITIES = [
    ("mdpi", 48, 108),
    ("hdpi", 72, 162),
    ("xhdpi", 96, 216),
    ("xxhdpi", 144, 324),
    ("xxxhdpi", 192, 432),
]



def save_mipmap(img, path):
    """WebP بلا فقد (بكسل مطابق للأصل، أصغر بنحو الثلث من PNG). يحذف PNG
    القديم بالاسم نفسه، فلأندرويد مورد واحد لكل اسم."""
    img.save(path.with_suffix(".webp"), "WEBP", lossless=True, quality=100, method=6, exact=True)
    path.with_suffix(".png").unlink(missing_ok=True)


def main() -> int:
    fg, legacy, rnd = svg_foreground(), svg_legacy(), svg_round()

    for name, legacy_px, fg_px in DENSITIES:
        d = RES / f"mipmap-{name}"
        d.mkdir(parents=True, exist_ok=True)
        save_mipmap(render(legacy, legacy_px), d / "ic_launcher.png")
        save_mipmap(render(rnd, legacy_px), d / "ic_launcher_round.png")
        save_mipmap(render(fg, fg_px), d / "ic_launcher_foreground.png")
        print(f"  ✓ mipmap-{name:<9} مربّعة ودائرية {legacy_px}px · أمامية {fg_px}px")

    # المتجهات: أيقونة شريط الإشعارات، والقناع الأحادي لأندرويد ١٣، ومعلم
    # شاشة البدء. متّجهة لا نقطية لأنها تُقاس على كثافات لا نعرفها سلفاً.
    dr = RES / "drawable"
    dr.mkdir(parents=True, exist_ok=True)
    # ٢٤dp هو مقاس أيقونة الحالة، ومضمونها المرئي ١٠dp نصف قطر
    (dr / "ic_stat_manar.xml").write_text(android_vector(24, 10.5, mono=True), encoding="utf-8")
    (dr / "ic_launcher_foreground.xml").write_text(
        android_vector(108, 36, mono=True), encoding="utf-8"
    )
    (dr / "manar_splash_mark.xml").write_text(android_vector(160, 68, mono=False), encoding="utf-8")
    print("  ✓ drawable/       ic_stat_manar · ic_launcher_foreground · manar_splash_mark (متّجهة)")

    # أصول الويب
    pub = ROOT / "public"
    for px, fname in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
        render(legacy, px).save(pub / fname, optimize=True)
    render(rnd, 64).save(pub / "favicon.png", optimize=True)
    (pub / "icon.svg").write_text(legacy, encoding="utf-8")
    print("  ✓ public/         icon-512 · icon-192 · apple-touch-icon · favicon · icon.svg")

    # معاينة كبيرة للمراجعة البصرية، لا تُشحن مع التطبيق
    prev = ROOT / ".icon-preview"
    prev.mkdir(exist_ok=True)
    render(legacy, 512).save(prev / "square.png")
    render(rnd, 512).save(prev / "round.png")
    render(fg, 512).save(prev / "foreground.png")
    render(svg_foreground(mono=True), 512).save(prev / "mono.png")
    print(f"  ✓ معاينة في {prev.name}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
