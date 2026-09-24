/* مواسم منار — أجزاء واجهة مشتركة بين صفحة المواسم وصفحة الموسم.
 * كلها مبنية على مكوّنات منار ورموز التصميم الموجودة (glass، gradient-*، bg-card…)
 * دون ألوان أو خطوط جديدة. */

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataError } from "@/components/manar/data-error";
import { Icon, icons, Skeleton } from "@/components/manar/shell";
import { loadDailyHadithList } from "@/lib/daily-content";
import { toArabicDigits } from "@/lib/format";
import { formatRangeAr } from "@/lib/quran/format";
import { quranTextService } from "@/lib/quran/text-service";
import type { SeasonContent, SeasonLink } from "@/lib/seasons/types";

/* ------------------------------ مفتاح التبديل ------------------------------ */

/** نفس مفتاح التبديل المستخدم في صفحة التذكيرات. */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative block h-6 w-11 rounded-full transition ${on ? "gradient-primary" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${
          on ? "right-0.5" : "right-[22px]"
        }`}
      />
    </span>
  );
}

/* ------------------------------ الروابط ------------------------------ */

/** رابط إلى قسم موجود في التطبيق — الأنواع مقيّدة في `SeasonLink`. */
export function SeasonLinkTo({
  link,
  className,
  children,
  ariaLabel,
}: {
  link: SeasonLink;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  // الاتحاد المقيّد يضمن أن كل وجهة مسار حقيقي؛ التحويل لتبسيط تمرير الخصائص.
  const props = link as unknown as React.ComponentProps<typeof Link>;
  return (
    <Link {...props} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

/* ------------------------------ المحتوى ------------------------------ */

type Resolved =
  | { kind: "ayah"; text: string; ref: string }
  | { kind: "hadith"; text: string; narrator: string; source: string; grade?: string }
  | { kind: "note"; text: string; source?: string };

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

/* بعض السور في بيانات Tanzil تبدأ بـ «بِّسْمِ» (بشدّة زائدة)، فالمقارنة بعد
 * حذف الشدّة من الكلمات الأربع الأولى. */
const noShadda = (t: string) => t.replace(/\u0651/g, "");

function cleanAyah(surah: number, n: number, t: string): string {
  let s = t;
  if (n === 1 && surah !== 1) {
    const words = s.split(" ");
    if (noShadda(words.slice(0, 4).join(" ")) === noShadda(BASMALA)) s = words.slice(4).join(" ");
  }
  return s.replace(/۞/g, "").replace(/\s+/g, " ").trim();
}

async function resolve(blocks: SeasonContent[]): Promise<Resolved[]> {
  const needsHadith = blocks.some((b) => b.kind === "hadith-ref");
  const hadiths = needsHadith ? await loadDailyHadithList() : [];
  const out: Resolved[] = [];
  for (const b of blocks) {
    if (b.kind === "ayah") {
      const text = await quranTextService.loadSurah(b.surah);
      const to = b.to ?? b.from;
      const ayahs = text.ayahs.filter((a) => a.n >= b.from && a.n <= to);
      if (!ayahs.length) continue;
      const joined = ayahs
        .map((a) => `${cleanAyah(b.surah, a.n, a.t)} (${toArabicDigits(a.n)})`)
        .join(" ");
      out.push({ kind: "ayah", text: joined, ref: `${text.nameAr}: ${formatRangeAr(b.from, to)}` });
    } else if (b.kind === "hadith-ref") {
      const h = hadiths.find((x) => x.id === b.id);
      if (h) {
        out.push({
          kind: "hadith",
          text: h.text,
          narrator: `${h.narrator} ${h.suffix}`.trim(),
          source: h.source,
        });
      }
    } else if (b.kind === "hadith") {
      out.push({ ...b });
    } else {
      out.push({ ...b });
    }
  }
  return out;
}

/** يعرض كتل المحتوى بعد قراءتها من الملفات المحلية (مصحف منار، حديث اليوم). */
export function SeasonContentList({ blocks }: { blocks: SeasonContent[] }) {
  const [items, setItems] = useState<Resolved[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sig = JSON.stringify(blocks);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(null);
    resolve(JSON.parse(sig) as SeasonContent[])
      .then((r) => alive && setItems(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [sig, attempt]);

  if (!blocks.length) return null;
  if (error) return <DataError message={error} onRetry={() => setAttempt((a) => a + 1)} />;
  if (!items) {
    return (
      <div className="space-y-3 px-4">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 stagger">
      {items.map((it, i) =>
        it.kind === "ayah" ? (
          <figure key={i} className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <blockquote className="font-quran text-lg leading-loose text-foreground">
              ﴿{it.text}﴾
            </blockquote>
            <figcaption className="mt-2 text-[11px] text-muted-foreground">{it.ref}</figcaption>
          </figure>
        ) : it.kind === "hadith" ? (
          <figure key={i} className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <blockquote className="text-[15px] leading-loose text-foreground">
              «{it.text}»
            </blockquote>
            <figcaption className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              عن {it.narrator} — {it.source}
              {it.grade ? ` · ${it.grade}` : ""}
            </figcaption>
          </figure>
        ) : (
          <div
            key={i}
            className="flex gap-3 rounded-3xl border border-border bg-secondary/60 p-4 text-[12px] leading-relaxed text-muted-foreground"
          >
            <span className="mt-0.5 text-primary">
              <Icon d={icons.info} size={16} />
            </span>
            <p>
              {it.text}
              {it.source ? ` (${it.source})` : ""}
            </p>
          </div>
        ),
      )}
    </div>
  );
}
