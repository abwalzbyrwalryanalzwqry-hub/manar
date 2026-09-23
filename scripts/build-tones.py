#!/usr/bin/env python3
"""منار — توليد نغمات التنبيه محلياً.

لماذا نولّدها بدل تنزيلها: أي نغمة جاهزة من الإنترنت تحمل حقوقاً لا يمكن
التحقّق منها، ولا يجوز شحنها في تطبيق يُنشر. هذه النغمات مُركَّبة رياضياً هنا،
فهي خالية من أي قيد حقوقي بالكامل.

التصميم مقصود: نغمات جرسية دافئة قصيرة، لا رنيناً حاداً. التنبيه قبل الصلاة
وللأذكار والوِرد يتكرّر يومياً عدّة مرات، فالنغمة المزعجة تُطفَأ بعد يومين
فتفقد التذكير كلّه قيمته.

التشغيل:  python3 scripts/build-tones.py
المخرجات: public/audio/reminders/*.mp3
(أصوات الإقامة تسجيلات حقيقية في public/audio/iqamah — لا تُولَّد هنا.)
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parent.parent

# سُلّم خماسي — تتناغم كل درجاته مع بعضها، فأي تتابع منه يخرج متناسقاً
# ولا يقع في نصف-مسافة نشاز. الترددات بالهرتز.
NOTE = {
    "C4": 261.63, "D4": 293.66, "E4": 329.63, "G4": 392.00, "A4": 440.00,
    "C5": 523.25, "D5": 587.33, "E5": 659.25, "G5": 783.99, "A5": 880.00,
    "F4": 349.23, "Bb4": 466.16, "F5": 698.46, "G3": 196.00, "C3": 130.81,
    "A3": 220.00, "E3": 164.81, "D3": 146.83, "F3": 174.61,
}


def bell(freq: float, dur: float, amp: float = 1.0, bright: float = 1.0) -> np.ndarray:
    """نغمة جرسية بتركيب جمعي.

    الجرس الحقيقي ليس توافقياً: شركاؤه ليسوا مضاعفات صحيحة للأساس، وكل شريك
    أعلى يخمد أسرع — ولهذا يبدأ الجرس معدنياً لامعاً ثم يستقرّ على نغمة دافئة.
    محاكاة ذلك هي الفرق بين صوت جرس وصوت صفّارة.
    """
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    # (نسبة التردد، الوزن، معامل سرعة الخمود)
    partials = [
        (0.5, 0.28, 0.6), (1.0, 1.00, 1.0), (1.19, 0.32, 1.7),
        (2.00, 0.42, 1.9), (2.76, 0.18, 2.8), (3.02, 0.12, 3.2),
        (4.07, 0.09, 4.2), (5.43, 0.05, 5.6),
    ]
    out = np.zeros_like(t)
    for ratio, weight, decay_mul in partials:
        f = freq * ratio
        if f > SR / 2.2:
            continue
        w = weight * (bright if ratio > 1.5 else 1.0)
        decay = np.exp(-t * (2.2 / dur) * decay_mul)
        # طور عشوائي لكل شريك: الأطوار المتطابقة تُنتج قمّة ابتدائية حادّة
        out += w * decay * np.sin(2 * np.pi * f * t + np.random.uniform(0, 2 * np.pi))

    # هجوم قصير جداً يمنع الطقطقة عند بدء الموجة من الصفر فجأة
    attack = np.minimum(1.0, t / 0.004)
    return amp * out * attack


def soft_tone(freq: float, dur: float, amp: float = 1.0) -> np.ndarray:
    """نغمة ناعمة شبه-نايية: أساس قوي وشركاء توافقيون خافتون، بهجوم بطيء."""
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    out = (
        1.00 * np.sin(2 * np.pi * freq * t)
        + 0.22 * np.sin(2 * np.pi * freq * 2 * t)
        + 0.08 * np.sin(2 * np.pi * freq * 3 * t)
        + 0.03 * np.sin(2 * np.pi * freq * 4 * t)
    )
    # غلاف ناعم الطرفين — يدخل ويخرج بلا حافّة مسموعة
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.4
    vibrato = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)  # حياة خفيفة
    return amp * out * env * vibrato


def place(canvas: np.ndarray, sound: np.ndarray, at: float) -> None:
    """يضع `sound` على `canvas` بدءاً من الثانية `at` (يجمع لا يستبدل)."""
    i = int(at * SR)
    n = min(len(sound), len(canvas) - i)
    if n > 0:
        canvas[i : i + n] += sound[:n]


def reverb(x: np.ndarray, amount: float = 0.28, decay: float = 1.6) -> np.ndarray:
    """صدى بسيط بمصفوفة تأخيرات أوّلية.

    التأخيرات أعداد أوّلية (بالملي ثانية) حتى لا تتزامن انعكاساتها فتُسمع
    كصدى منفصل متكرّر بدل ذيل مكاني متّصل.
    """
    out = x.copy()
    for ms, g in [(23, 0.5), (41, 0.42), (67, 0.33), (97, 0.25), (131, 0.18)]:
        d = int(SR * ms / 1000)
        tail = np.zeros_like(x)
        tail[d:] = x[:-d] * g * decay
        out += amount * tail
    return out


# جهارة الهدف (RMS) الموحّدة لكل النغمات.
TARGET_RMS = 0.13


def finish(x: np.ndarray, peak: float = 0.95, fade_out: float = 0.25) -> np.ndarray:
    """تلاشٍ في النهاية، ثم توحيد الجهارة المُدرَكة، ثم حارس ذروة.

    التطبيع على الذروة وحدها لا يكفي: نغمة جرسية ذات قمّة حادّة وذيل خافت
    تُسمع أخفت بكثير من نغمة ناعمة لها الذروة نفسها. فنُوحّد على RMS — وهو
    أقرب لما تسمعه الأذن — ثم نخفض فقط إن تجاوزت الذروة الحدّ الآمن، حتى لا
    يكون أحد التنبيهات أعلى من الآخر بفارق محسوس.
    """
    n = int(fade_out * SR)
    if n and n < len(x):
        x = x.copy()
        x[-n:] *= np.linspace(1, 0, n) ** 1.5

    rms = float(np.sqrt(np.mean(x**2)))
    if rms > 0:
        x = x * (TARGET_RMS / rms)

    m = float(np.max(np.abs(x)))
    if m > peak:
        x = x * (peak / m)
    return np.clip(x, -1, 1)


def stereo(x: np.ndarray, width: float = 0.06) -> np.ndarray:
    """اتّساع ستيريو خفيف جداً بإزاحة زمنية بين القناتين (تأثير هاس).

    الاتّساع مُقيَّد بشدّة عن قصد: سمّاعة الهاتف الواحدة تدمج القناتين، وكل
    إزاحة بينهما تُلغي جزءاً من الموجة فتخرج النغمة أخفض بمقدار محسوس. ٦٪
    تُعطي عمقاً بالسمّاعات دون أن تُفقد التنبيه صوته على الهاتف.
    """
    d = int(SR * 0.008 * width)
    left = x
    right = np.concatenate([np.zeros(d), x[:-d]]) if d else x
    return np.stack([left, right], axis=1)


def soft_clip(x: np.ndarray, ceiling: float = 0.96) -> np.ndarray:
    """تحديد ناعم للذروة بدل القصّ الصلب.

    النغمة الجرسية القصيرة ذات قمّة هجوم حادّة جداً مقابل ذيل خافت. لو حَرَسنا
    الذروة بخفض الملف كلّه، خرجت تلك النغمة أخفت بثلث من النغمات الأطول — وهو
    فارق مسموع بين تنبيه وآخر في التطبيق نفسه. التحديد بدالة `tanh` يُقوّس
    القمّة وحدها ويترك بقية الموجة كما هي، فتتساوى الجهارة المُدرَكة بلا
    تشويه مسموع.
    """
    return np.tanh(x / ceiling) * ceiling


def write_mp3(path: Path, audio: np.ndarray, bitrate: str = "128k") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    st = stereo(audio)
    # نعوّض ما تُلغيه إزاحة هاس عند دمج القناتين في سمّاعة الهاتف الواحدة،
    # فتخرج الجهارة الفعلية مطابقة للهدف على الهاتف كما على السمّاعات.
    mono_rms = float(np.sqrt(np.mean(st.mean(axis=1) ** 2)))
    if mono_rms > 0:
        st = st * (TARGET_RMS / mono_rms)
    pcm = (soft_clip(st) * 32767).astype("<i2").tobytes()
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "pipe:0",
        "-codec:a", "libmp3lame", "-b:a", bitrate, str(path),
    ]
    subprocess.run(cmd, input=pcm, check=True)


# ----------------------------- النغمات ----------------------------- #


def tone_reminder_soft() -> np.ndarray:
    """تذكير قبل الصلاة — ثلاث درجات صاعدة هادئة."""
    c = np.zeros(int(SR * 4.2))
    for i, n in enumerate(["G4", "C5", "E5"]):
        place(c, bell(NOTE[n], 2.6, amp=0.7 - i * 0.05, bright=0.85), 0.45 * i)
    place(c, soft_tone(NOTE["C4"], 3.0, amp=0.16), 0.9)
    return finish(reverb(c, 0.3))


def tone_reminder_bell() -> np.ndarray:
    """تذكير قبل الصلاة — جرس دافئ مزدوج."""
    c = np.zeros(int(SR * 4.6))
    place(c, bell(NOTE["A4"], 3.2, amp=0.85), 0.0)
    place(c, bell(NOTE["E5"], 2.4, amp=0.42, bright=0.7), 1.15)
    place(c, soft_tone(NOTE["A3"], 3.4, amp=0.18), 0.1)
    return finish(reverb(c, 0.32))


def tone_azkar_morning() -> np.ndarray:
    """أذكار الصباح — صاعد مشرق، بإيقاع منتشٍ خفيف."""
    c = np.zeros(int(SR * 5.0))
    for i, n in enumerate(["C5", "D5", "G5", "A5"]):
        place(c, bell(NOTE[n], 2.4, amp=0.62 - i * 0.04, bright=1.15), 0.34 * i)
    place(c, soft_tone(NOTE["C4"], 3.6, amp=0.14), 0.6)
    return finish(reverb(c, 0.34))


def tone_azkar_evening() -> np.ndarray:
    """أذكار المساء — هابط دافئ، أقلّ سطوعاً من الصباح."""
    c = np.zeros(int(SR * 5.4))
    for i, n in enumerate(["A4", "G4", "E4", "C4"]):
        place(c, bell(NOTE[n], 3.0, amp=0.68 - i * 0.05, bright=0.65), 0.42 * i)
    place(c, soft_tone(NOTE["C3"], 4.2, amp=0.2), 0.3)
    return finish(reverb(c, 0.36, decay=1.8))


def tone_wird() -> np.ndarray:
    """الوِرد اليومي — متأمّل ساكن، أطول نفَساً."""
    c = np.zeros(int(SR * 6.0))
    place(c, soft_tone(NOTE["F4"], 3.2, amp=0.5), 0.0)
    place(c, soft_tone(NOTE["A4"], 3.0, amp=0.34), 0.7)
    place(c, soft_tone(NOTE["C5"], 3.4, amp=0.3), 1.4)
    place(c, bell(NOTE["F5"], 3.0, amp=0.35, bright=0.6), 2.1)
    place(c, soft_tone(NOTE["F3"], 5.0, amp=0.2), 0.0)
    return finish(reverb(c, 0.4))


def tone_chime() -> np.ndarray:
    """نغمة تجربة الصوت في الإعدادات — قصيرة محايدة."""
    c = np.zeros(int(SR * 2.2))
    place(c, bell(NOTE["E5"], 1.8, amp=0.85), 0.0)
    place(c, bell(NOTE["A5"], 1.4, amp=0.4, bright=0.8), 0.26)
    return finish(reverb(c, 0.22), fade_out=0.2)


TONES = [
    ("reminders/reminder-default.mp3", tone_reminder_soft, "تنبيه قبل الصلاة"),
    ("reminders/reminder-bell.mp3", tone_reminder_bell, "جرس دافئ"),
    ("reminders/reminder-chime.mp3", tone_chime, "نغمة تجربة"),
    ("reminders/azkar-morning.mp3", tone_azkar_morning, "أذكار الصباح"),
    ("reminders/azkar-evening.mp3", tone_azkar_evening, "أذكار المساء"),
    ("reminders/wird.mp3", tone_wird, "الوِرد اليومي"),
]


def main() -> int:
    np.random.seed(1446)  # ثبات: كل بناء يُنتج الملفات نفسها بالبتّ
    base = ROOT / "public" / "audio"
    for rel, fn, label in TONES:
        out = base / rel
        audio = fn()
        write_mp3(out, audio)
        kb = out.stat().st_size // 1024
        print(f"  ✓ {label:<22} {rel:<34} {len(audio)/SR:4.1f}ث  {kb:3d}ك")
    print(f"\nتمّ توليد {len(TONES)} نغمة — كلها مُركَّبة محلياً وخالية من أي قيد حقوقي.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
