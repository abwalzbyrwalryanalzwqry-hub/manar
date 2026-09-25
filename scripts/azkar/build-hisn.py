#!/usr/bin/env python3
"""
Manar — تصحيح بيانات «حصن المسلم» (public/data/azkar/hisn-al-muslim.json)

يطبّق على الملف تصحيحات موثّقة من scripts/azkar/patches.json ثم تنظيفات عامة:
  1. نصوص القرآن تُولَّد من المصحف العثماني داخل التطبيق (public/data/quran/uthmani)
     بدل النسخ اليدوي، فلا تسقط كلمة ولا تتكرر.
  2. تصحيح النصوص المبتورة أو المختلطة بالتخريج، وإضافة صيغ المساء.
  3. إزالة أرقام الحواشي «(٢)» والأقواس الفارغة «()».
  4. فصل الإرشادات («ثلاث مرات»، «إذا أصبح»…) عن المتن إلى الحقل note.
  5. تنظيف مراجع الأبواب: حذف أرقام الصفحات اليتيمة ووصل الأسطر المقطوعة.

السكربت متساوي الأثر (idempotent): تشغيله مرة ثانية لا يغيّر شيئاً.

  python3 scripts/azkar/build-hisn.py          # يكتب الملف
  python3 scripts/azkar/build-hisn.py --check  # يفشل إن كان الملف غير محدَّث
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public/data/azkar/hisn-al-muslim.json"
PATCHES = Path(__file__).with_name("patches.json")
WIRD_TEXTS = ROOT / "src/lib/wird/hisn-texts.ts"
# باب أذكار الصباح والمساء — مصدر نصوص «الوِرد».
WIRD_CHAPTER = 27
QURAN = ROOT / "public/data/quran/uthmani"

SCHEMA = 2
BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")

MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\uFEFF\u0640]")


def bare(w: str) -> str:
    return MARKS.sub("", w).replace("ٱ", "ا")


def strip_basmala(surah: int, n: int, text: str) -> str:
    """مطابق لـ stripBasmala في src/lib/quran/basmala.ts."""
    text = text.replace("\uFEFF", "")
    if n != 1 or surah in (1, 9):
        return text
    words = text.strip().split()
    if len(words) >= 4 and [bare(w) for w in words[:4]] == ["بسم", "الله", "الرحمن", "الرحيم"]:
        return " ".join(words[4:])
    return text


_surahs: dict[int, dict] = {}


def ayahs(surah: int, a: int, b: int) -> list[tuple[int, str]]:
    if surah not in _surahs:
        _surahs[surah] = json.loads((QURAN / f"{surah}.json").read_text(encoding="utf-8"))
    out = []
    for ay in _surahs[surah]["ayahs"]:
        if a <= ay["n"] <= b:
            out.append((ay["n"], strip_basmala(surah, ay["n"], ay["t"]).strip()))
    if len(out) != b - a + 1:
        raise SystemExit(f"ayah range {surah}:{a}-{b} incomplete")
    return out


def quran_text(spec: dict) -> str:
    parts: list[str] = []
    if spec.get("prefix"):
        parts.append(spec["prefix"])
    for p in spec["passages"]:
        if p.get("basmala"):
            parts.append(BASMALA)
        body = " ".join(f"{t} ﴿{str(n).translate(AR_DIGITS)}﴾" for n, t in ayahs(p["surah"], p["from"], p["to"]))
        parts.append(body)
    return " ".join(parts)


# ---------- تنظيف النص ----------

FOOTNOTE = re.compile(r"\s*\([٠-٩0-9]{1,2}\)")
EMPTY_PARENS = re.compile(r"\s*\(\s*\)")
# إرشاد في آخر النص بين قوسين، مثل «(ثَلَاثَ مَرَّاتٍ)» أو «(عشر مرات) أو (مرة…)»
TRAILING_NOTE = re.compile(r"\s*(\((?:[^()«»])*\)(?:\s*،?\s*أَوْ\s*\([^()«»]*\))?)\s*$")


def clean(text: str) -> str:
    t = FOOTNOTE.sub("", text)
    t = EMPTY_PARENS.sub("", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s+([،؛:.»])", r"\1", t)
    t = re.sub(r"([«])\s+", r"\1", t)
    # علامة إغلاق ناقصة في آخر النص (خطأ متكرر في المصدر المنسوخ).
    if t.count("«") == t.count("»") + 1 and not t.endswith("»"):
        t += "»"
    return t


def split_note(text: str) -> tuple[str, str | None]:
    m = TRAILING_NOTE.search(text)
    if not m:
        return text, None
    head = text[: m.start()].rstrip()
    # لا نفصل إن كان القوس هو كامل النص (مثل #114).
    if not head or head.count("«") != head.count("»"):
        return text, None
    return head, m.group(1).strip()


# ---------- المراجع ----------

PAGE_ONLY = re.compile(r"^[\s٠-٩0-9]+$")
ENDS_OPEN = re.compile(r"[\u0621-\u064A\u064B-\u0652\u0670،=\-]$")


def clean_refs(lines: list[str]) -> list[str]:
    out: list[str] = []
    joining = False
    for raw in lines:
        line = re.sub(r"\s+", " ", raw).strip()
        if not line or PAGE_ONLY.match(line):
            continue
        if joining and out:
            out[-1] = f"{out[-1]} {line}"
        else:
            out.append(line)
        joining = bool(ENDS_OPEN.search(out[-1]))
        if out[-1].endswith("="):
            out[-1] = out[-1][:-1].rstrip()
            joining = True
    return out


# ---------- البناء ----------


def build(book: dict, patches: dict) -> dict:
    qp = {int(k): v for k, v in patches["quran"].items()}
    zp = {int(k): v for k, v in patches["azkar"].items()}
    seen = set()
    for ch in book["chapters"]:
        ch["references"] = clean_refs(ch.get("references", []))
        for z in ch["azkar"]:
            zid = z["id"]
            seen.add(zid)
            note = z.get("note")
            if zid in qp:
                spec = qp[zid]
                z["text"] = quran_text(spec)
                z["quran"] = [{"surah": p["surah"], "from": p["from"], "to": p["to"]} for p in spec["passages"]]
                if "lead" in spec:
                    z["lead"] = spec["lead"]
                if "note" in spec:
                    note = spec["note"]
            else:
                p = zp.get(zid, {})
                if "text" in p:
                    z["text"] = p["text"]
                z["text"], trailing = split_note(clean(z["text"]))
                if trailing:
                    note = trailing
                for key in ("lead", "evening", "time", "segments"):
                    if key in p:
                        z[key] = p[key]
                if "evening" in z:
                    z["evening"] = clean(z["evening"])
                if "note" in p:
                    note = p["note"]
            if note:
                z["note"] = note
            else:
                z.pop("note", None)
            if z.get("segments"):
                z["repeat"] = sum(s["repeat"] for s in z["segments"])
            # ترتيب ثابت للمفاتيح
            order = ["id", "lead", "text", "evening", "note", "repeat", "segments", "time", "quran"]
            items = {k: z[k] for k in order if k in z}
            z.clear()
            z.update(items)
    missing = (set(qp) | set(zp)) - seen
    if missing:
        raise SystemExit(f"patch ids not found: {sorted(missing)}")
    book["book"]["schema"] = SCHEMA
    return book


def wird_texts(book: dict) -> str:
    """نصوص باب ٢٧ لـ«الوِرد» — تُولَّد من الحصن حتى لا يختلف النصّان أبدًا."""
    ch = next(c for c in book["chapters"] if c["id"] == WIRD_CHAPTER)
    lines = [
        "// ============================================================",
        "// Manar — Wird Module",
        "// مُولَّد آليًا من public/data/azkar/hisn-al-muslim.json (الباب ٢٧)",
        "// عبر scripts/azkar/build-hisn.py — لا يُعدَّل يدويًا.",
        "// المفتاح: «رقم الذكر:m» للصباح و«رقم الذكر:e» للمساء.",
        "// ============================================================",
        "",
        "export const HISN_WIRD_TEXTS: Readonly<Record<string, string>> = {",
    ]
    for z in ch["azkar"]:
        if z.get("time") != "evening":
            key = json.dumps(f"{z['id']}:m")
            lines.append(f"  {key}: {json.dumps(z['text'], ensure_ascii=False)},")
        if z.get("time") != "morning":
            text = z.get("evening", z["text"])
            key = json.dumps(f"{z['id']}:e")
            lines.append(f"  {key}: {json.dumps(text, ensure_ascii=False)},")
    lines.append("};")
    return "\n".join(lines) + "\n"


def main() -> None:
    src = DATA.read_text(encoding="utf-8")
    patches = json.loads(PATCHES.read_text(encoding="utf-8"))
    book = build(json.loads(src), patches)
    out = json.dumps(book, ensure_ascii=False, indent=2) + "\n"
    wird = wird_texts(book)
    if "--check" in sys.argv:
        stale = [
            p
            for p, body in ((DATA, out), (WIRD_TEXTS, wird))
            if not p.exists() or p.read_text(encoding="utf-8") != body
        ]
        if stale:
            raise SystemExit(f"stale: {[str(p.relative_to(ROOT)) for p in stale]} — run scripts/azkar/build-hisn.py")
        print("ok")
        return
    DATA.write_text(out, encoding="utf-8")
    WIRD_TEXTS.write_text(wird, encoding="utf-8")
    print(f"wrote {DATA.relative_to(ROOT)}, {WIRD_TEXTS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
