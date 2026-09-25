#!/usr/bin/env python3
"""منار — بناء أيقونة التطبيق من لوحة الهوية التي اعتمدها صاحب التطبيق.

المصدر `assets/brand/manar-icon-source.png` هو اللوحة الزجاجية نفسها التي
أرسلها صاحب التطبيق، مقتطعةً على حدود إطارها الذهبي. لا نُولّد رسماً شبيهاً
بها: هي الأيقونة، وكل ما هنا اقتطاعٌ وتحجيمٌ يخدم قيود كل مقاس.

القيد الحاكم هو أيقونة أندرويد التكيّفية: المُشغّل يُطبّق قناعاً من اختياره
(دائرة، مربّع مستدير، حصاة) على لوحة ١٠٨dp، ولا يضمن ظهور أكثر من دائرة
٦٦dp في الوسط. فلو وضعنا اللوحة كاملةً في الطبقة الأمامية لقُصّ إطارها
الذهبي وزواياها على معظم الهواتف. فنُفكّكها إلى طبقتيها الطبيعيتين:

  • الخلفية: داخل اللوحة (التدرّج الأخضر والنقش العربي) ممدوداً إلى حدّ
    اللوحة، فأي قناعٍ يقصّه لا يحذف مضموناً — القصّ يقع على النقش.
  • الأمامية: المعلم الذهبي والهالة، مستخلصين بمفتاح لونيّ لأن الذهب يفوق
    فيه الأحمر الأزرق بفرق واسع بخلاف الخضرة المائلة للزرقة. يُقاس داخل
    الدائرة الآمنة فلا يُقصّ طرفه على أي شكل.

واسم «منار» اللاتيني والعربي يبقى في المقاسات التي تُقرأ فيها — أيقونة
المتجر والويب والمقاس القديم المربّع — ويُحذف من أيقونة المُشغّل: عند ٤٨dp
يصير النصّ لطخةً تُشوّش المعلم بدل أن تُعرّف به. وهذا هو «القصّ المناسب»
الذي أذن به صاحب التطبيق.

التشغيل: python3 scripts/build-brand-icons.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "brand" / "manar-icon-source.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
PUB = ROOT / "public"

# لوحة ٤٣٢ بكسل = ١٠٨dp × ٤ (كثافة xxxhdpi).
C = 432
# أندرويد يضمن دائرة ٦٦dp فقط. نبقى تحتها بهامش أمان.
SAFE = int(C * 66 / 108)

# حدود المضمون داخل اللوحة المصدرية (٧٩٦×٧٩٦)، مقيسةً لا مُقدَّرة.
PANEL = 796
FRAME = 46  # سُمك الإطار الذهبي وما حوله من زجاج
MARK_BOX = (243, 60, 548, 560)  # المعلم الذهبي مع هالته
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def panel() -> Image.Image:
    """اللوحة كاملةً كما أرسلها صاحب التطبيق."""
    return Image.open(SRC).convert("RGB")


def interior() -> Image.Image:
    """داخل اللوحة بلا إطار — يصلح خلفيةً تُقصّ بلا خسارة."""
    p = panel()
    return p.crop((FRAME, FRAME, PANEL - FRAME, PANEL - FRAME))


def gold_mark() -> Image.Image:
    """المعلم الذهبي وهالته على خلفية شفّافة.

    المفتاح اللوني: في الذهب يفوق الأحمر الأزرق بفرق واسع، وفي خضرة اللوحة
    المائلة للزرقة يكون الأزرق مساوياً للأخضر أو أعلى من الأحمر. فالفرق
    `r - b` يفصل الاثنين نظيفاً، ويُدرّج الشفافية تدريجاً ناعماً عند الحواف
    بدل حدٍّ مسنّن.
    """
    crop = panel().crop(MARK_BOX)
    a = np.asarray(crop).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (r + g + b) / 3.0 / 255.0
    alpha = np.clip((r - b) / 62.0, 0.0, 1.0) * np.clip(lum * 1.9, 0.0, 1.0)
    alpha[alpha < 0.14] = 0.0
    out = Image.fromarray(
        np.dstack([a, np.clip(alpha * 255, 0, 255)]).astype(np.uint8), "RGBA"
    )
    # تنعيم طفيف للحواف يُخفي تسنّن المفتاح اللوني دون إذابة التفاصيل
    r_, g_, b_, al = out.split()
    return Image.merge("RGBA", (r_, g_, b_, al.filter(ImageFilter.GaussianBlur(0.6))))


def fit(img: Image.Image, box: int) -> Image.Image:
    """يُحجّم `img` ليدخل مربّعاً ضلعه `box` محافظاً على نسبته."""
    w, h = img.size
    k = box / max(w, h)
    return img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def rounded(img: Image.Image, radius_ratio: float) -> Image.Image:
    """يُدوّر زوايا الصورة — للمقاس القديم الذي يرسمه المُشغّل كما هو."""
    img = img.convert("RGBA")
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, w - 1, h - 1), radius=int(min(w, h) * radius_ratio), fill=255
    )
    img.putalpha(mask)
    return img


def circled(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, w - 1, h - 1), fill=255)
    img.putalpha(mask)
    return img


def _sample(p: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    """وسيط لون رقعة — أمتن من المتوسّط أمام النقش الداكن."""
    a = np.asarray(p.crop(box)).reshape(-1, 3)
    return tuple(int(v) for v in np.median(a, axis=0))


def adaptive_background(size: int) -> Image.Image:
    """تدرّج شعاعي من ألوان اللوحة نفسها — بلا نقش وبلا خطوط وصل.

    جرّبتُ قبلها نقش اللوحة معكوساً ليملأ المربّع، فأنتج العكسُ عموداً
    متناظراً في الوسط يُشبه شكلاً قائماً بذاته ويُزاحم المعلم. والتدرّج
    الصافي يؤدّي وظيفة الخلفية — أن تُحيط ولا تُنافس.

    اللونان مأخوذان من اللوحة لا مُختارين: وسيط رقعة مضيئة من أعلى اليمين
    ووسيط رقعة داكنة من أسفل اليسار.
    """
    p = panel()
    inner, outer = _sample(p, (520, 90, 700, 220)), _sample(p, (90, 560, 260, 720))
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2.0
    t = np.clip(np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (c * 1.25), 0.0, 1.0)[..., None]
    arr = np.array(inner, np.float32) * (1 - t) + np.array(outer, np.float32) * t
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def _feathered_art(box: int) -> Image.Image:
    """داخل اللوحة، مربّعاً بزوايا مستديرة وحافّة متلاشية.

    التلاشي يمنع ظهور حدٍّ مستقيم حادّ بين اللوحة وخلفيّتها، فتبدو الاثنتان
    سطحاً واحداً لا صورةً مُلصقة على أخرى.
    """
    art = interior().resize((box, box), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (box, box), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (2, 2, box - 3, box - 3), radius=int(box * 0.19), fill=255
    )
    art.putalpha(mask.filter(ImageFilter.GaussianBlur(box * 0.012)))
    return art


def adaptive_foreground(size: int) -> Image.Image:
    """اللوحة كاملةً بمعلمها واسمها، داخل الدائرة المضمونة.

    لا استخلاص هنا. جرّبتُ فصل المعلم الذهبي بمفتاح لونيّ، فأسقط انعكاسات
    الزجاج الزرقاء على الذهب وترك الجسم مثقوباً شبه شفّاف، والتقط من الهالة
    أقواساً مبتورة. واللوحة متدرّجة الخضرة من الداكن إلى الفاتح، فلا يفصلها
    حدٌّ لونيّ واحد أصلاً.

    فنُبقيها كما رسمها صاحبها. والقياس محسوب لا مُقدَّر: أبعد نقطة مرئية عن
    المركز هي طرف كلمة «MANAR» اللاتينيّ السفليّ، على بُعد ٠٫٤٩٥ من ضلع
    اللوحة. مع ضلع ٠٫٦٧ يصير بُعده ٣٥٫٨dp عن المركز، والدائرة المضمونة نصف
    قطرها ٣٣dp فقط — فكان الاسم يُقصّ على كل مُشغّل يُقنّع دائرةً. وقد
    تحقّقتُ منه بتركيب الطبقتين وتقنيعهما قبل هذا التعديل.

    والحساب على المحور الرأسي وحده لا يكفي: حروف «MANAR» تمتدّ عرضاً، فأبعد
    حرفٍ فيها يقع على بُعد √(٠٫٢² + ٠٫٤٩٥²) = ٠٫٥٣٤ من الضلع. ومع ضلع ٠٫٦٠
    يصير ٣٤٫٦dp — أيضاً خارج الدائرة. فالضلع ٠٫٥٥: أبعد حرف على ٣١٫٧dp،
    داخل الـ٣٣ بهامشٍ يُرى. وزوايا
    المربّع المتلاشي تبقى خارجها، وهي تدرّج ونقش لا مضمون، فقصُّها لا يحذف
    شيئاً. وما يُقصّ من اللوحة لا يُعوّضه فراغ: خلفية الأيقونة تدرّجٌ من
    ألوان اللوحة نفسها، فتبدو الطبقتان سطحاً واحداً.
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    box = round(size * 0.55)
    art = _feathered_art(box)
    off = (size - box) // 2
    canvas.alpha_composite(art, (off, off))
    return canvas


# ملاحظة: الطبقة الأحادية (أيقونات أندرويد ١٣ الملوّنة بسمة النظام) وأيقونة
# شريط الإشعارات تبقيان متّجهتين، يُولّدهما `scripts/build-icon.py`.
# حاولتُ اشتقاق ظلّهما من اللوحة، فكان أكبرُ شكلٍ يلتقطه القناع هو الهالة
# لا المنارة — لأن الهالة أعرض وأشدّ إضاءة. وهاتان الأيقونتان ظلٌّ مسطّح
# بلا تدرّج أصلاً، فالمتّجه أنسب لهما من صورةٍ مُستخلصة.


def launcher_legacy(size: int) -> Image.Image:
    """المقاس القديم لأندرويد ٧ وأقدم: يُرسم كما هو بلا قناع.

    هنا تظهر اللوحة كاملةً بإطارها واسمها — وهو ما أراده صاحب التطبيق —
    لأن لا قناع يقصّها.
    """
    return rounded(panel().resize((size, size), Image.LANCZOS), 0.22)


def launcher_round(size: int) -> Image.Image:
    return circled(interior().resize((size, size), Image.LANCZOS))



def save_mipmap(img, path):
    """WebP بلا فقد (بكسل مطابق للأصل، أصغر بنحو الثلث من PNG). يحذف PNG
    القديم بالاسم نفسه، فلأندرويد مورد واحد لكل اسم."""
    img.save(path.with_suffix(".webp"), "WEBP", lossless=True, quality=100, method=6, exact=True)
    path.with_suffix(".png").unlink(missing_ok=True)


def main() -> int:
    if not SRC.exists():
        print(f"المصدر غير موجود: {SRC}")
        return 1

    for name, k in DENSITIES.items():
        d = RES / f"mipmap-{name}"
        d.mkdir(parents=True, exist_ok=True)
        legacy_px = round(48 * k)
        fg_px = round(108 * k)
        save_mipmap(launcher_legacy(legacy_px), d / "ic_launcher.png")
        save_mipmap(launcher_round(legacy_px), d / "ic_launcher_round.png")
        save_mipmap(adaptive_foreground(fg_px), d / "ic_launcher_foreground.png")
        save_mipmap(adaptive_background(fg_px), d / "ic_launcher_bg.png")

    # الخلفية صارت صورة لا لوناً مسطّحاً، والأحادية صارت صورة لا متّجهاً.
    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_bg"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>\n'
        "</adaptive-icon>\n"
    )
    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    (anydpi / "ic_launcher.xml").write_text(adaptive, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(adaptive, encoding="utf-8")

    # معلم شاشة البداية الأصلية: المعلم الذهبي وحده على شفّاف، فوق manar_dark.

    # الويب والمتجر: اللوحة كاملةً، فالاسم يُقرأ في هذه المقاسات.
    PUB.mkdir(parents=True, exist_ok=True)
    for px, fname in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        rounded(panel().resize((px, px), Image.LANCZOS), 0.22).save(
            PUB / fname, optimize=True
        )
    launcher_round(64).save(PUB / "favicon.png", optimize=True)

    prev = ROOT / ".icon-preview"
    prev.mkdir(exist_ok=True)
    launcher_legacy(512).save(prev / "legacy.png")
    launcher_round(512).save(prev / "round.png")
    adaptive_foreground(512).save(prev / "foreground.png")
    adaptive_background(512).save(prev / "background.png")
    # معاينة ما يراه المستخدم فعلاً: الطبقتان مركّبتان ومقنّعتان دائرةً
    comp = adaptive_background(512)
    comp.alpha_composite(adaptive_foreground(512))
    circled(comp).save(prev / "composed-circle.png")
    rounded(comp, 0.22).save(prev / "composed-squircle.png")

    print("[منار] بُنيت الأيقونة من لوحة الهوية.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
