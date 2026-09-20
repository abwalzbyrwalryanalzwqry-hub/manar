import { createFileRoute, Link } from "@tanstack/react-router";
import { DataError } from "@/components/manar/data-error";
import { useMemo, useState } from "react";
import { useAzkarBook } from "@/hooks/use-azkar";
import { azkarRepository } from "@/lib/azkar/repository";
import { Icon, icons, Screen, ScreenHeader, EmptyState, Skeleton } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/azkar/search")({
  head: () => ({
    meta: [
      { title: "البحث الذكي في الأذكار — منار" },
      {
        name: "description",
        content: "بحث ذكي في أذكار حصن المسلم يتجاوز التشكيل والهمزات وصيغ الحروف.",
      },
      { property: "og:title", content: "البحث الذكي في الأذكار — منار" },
      { property: "og:description", content: "ابحث في ٢٦٧ ذكرًا و١٣٢ بابًا بدون تشكيل أو همزات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AzkarSearch,
});

const SUGGESTIONS = [
  "الاستيقاظ",
  "الصباح",
  "النوم",
  "السفر",
  "الهم",
  "الاستغفار",
  "المطر",
  "الطعام",
];

function AzkarSearch() {
  const { book, loading, error, retry } = useAzkarBook();
  const [q, setQ] = useState("");

  const results = useMemo(
    () => (book && q.trim().length > 1 ? azkarRepository.search(q) : []),
    [book, q],
  );
  const chapterHits = useMemo(
    () => (book && q.trim().length > 1 ? azkarRepository.searchChapters(q, 8) : []),
    [book, q],
  );

  return (
    <Screen>
      <ScreenHeader title="البحث الذكي" subtitle="في أذكار حصن المسلم كاملة" backTo="/azkar" />

      <div className="px-5">
        <div className="glass flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
          <Icon d={icons.search} size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اكتب كلمة… مثل: الاستيقاظ، الهم، السفر"
            className="flex-1 bg-transparent text-right text-sm outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-[11px] text-muted-foreground">
              مسح
            </button>
          )}
        </div>

        {!q && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[11px] text-muted-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-5 space-y-3 px-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      )}
      {error && <DataError message={error} onRetry={retry} title="تعذّر تحميل الأذكار" />}

      {q.trim().length > 1 && chapterHits.length > 0 && (
        <div className="mt-6 px-5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            أبواب مطابقة
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {chapterHits.map((c) => (
              <Link
                key={c.id}
                to="/azkar/$chapter"
                params={{ chapter: String(c.id) }}
                search={{ zikr: undefined }}
                className="rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[11px]"
              >
                {c.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {q.trim().length > 1 && (
        <div className="mt-6 space-y-3 px-5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {toArabicDigits(results.length)} نتيجة
          </div>
          {results.map((hit) => (
            <Link
              key={`${hit.chapter.id}-${hit.zikr.id}`}
              to="/azkar/$chapter"
              params={{ chapter: String(hit.chapter.id) }}
              search={{ zikr: hit.zikr.id }}
              className="block rounded-3xl border border-border/60 bg-card/70 p-4 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{hit.chapter.title}</span>
                <span className="tabular-nums">ذكر {toArabicDigits(hit.zikr.id)}</span>
              </div>
              <p className="mt-2 font-display text-[15px] leading-loose">{hit.excerpt}</p>
            </Link>
          ))}
          {!results.length && !loading && (
            <EmptyState
              icon={icons.search}
              title="لا نتائج"
              hint="جرّب كلمة أخرى أو اختر من الاقتراحات."
            />
          )}
        </div>
      )}
    </Screen>
  );
}
