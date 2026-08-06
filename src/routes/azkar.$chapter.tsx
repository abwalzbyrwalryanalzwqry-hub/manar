import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Icon, icons, Screen, ScreenHeader, Skeleton } from "@/components/manar/shell";
import { useAzkarBook } from "@/hooks/use-azkar";
import { useAzkarProgress } from "@/lib/azkar/progress";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/azkar/$chapter")({
  head: () => ({
    meta: [
      { title: "حصن المسلم — منار" },
      { name: "description", content: "أذكار وأدعية من كتاب حصن المسلم بنصوص موثّقة وعدّاد تكرار." },
      { property: "og:title", content: "حصن المسلم — منار" },
      { property: "og:description", content: "أذكار وأدعية موثّقة مع عدّاد تكرار وحفظ للتقدّم." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChapterReader,
});

function ChapterReader() {
  const { chapter: chapterParam } = Route.useParams();
  const id = Number(chapterParam);
  const { book, loading, error } = useAzkarBook();
  const { progress, tap, resetZikr, toggleBookmark, setLast } = useAzkarProgress();
  const [i, setI] = useState(0);

  const chapter = useMemo(() => book?.chapters.find((c) => c.id === id), [book, id]);
  const zikr = chapter?.azkar[i];

  useEffect(() => {
    if (chapter && zikr) setLast(chapter.id, zikr.id);
  }, [chapter, zikr, setLast]);

  const count = zikr ? (progress.counters[zikr.id] ?? 0) : 0;
  const done = zikr ? progress.completed.includes(zikr.id) : false;
  const marked = zikr ? progress.bookmarks.includes(zikr.id) : false;

  const share = async () => {
    if (!zikr || !chapter) return;
    const text = `${chapter.title}\n\n${zikr.text}\n\n— حصن المسلم · تطبيق منار`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* ignore cancel */
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={chapter?.title ?? "حصن المسلم"}
        subtitle={chapter ? `الباب ${toArabicDigits(chapter.id)} · ${toArabicDigits(chapter.azkar.length)} ذكر` : "من أذكار الكتاب والسنة"}
        backTo="/azkar"
      />

      {loading && (
        <div className="space-y-3 px-4">
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
        </div>
      )}
      {error && <p className="px-5 text-sm text-muted-foreground">{error}</p>}

      {chapter && zikr && (
        <div className="px-4">
          <div className="glass relative overflow-hidden rounded-[28px] p-5">
            <p className="text-right font-display text-[22px] leading-[2.1]">{zikr.text}</p>
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => tap(zikr.id, zikr.repeat)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition active:scale-95 ${
                  done ? "bg-secondary text-primary" : "gradient-primary text-primary-foreground shadow-glow"
                }`}
              >
                <Icon d={done ? icons.check : icons.azkar} size={16} />
                {toArabicDigits(count)} / {toArabicDigits(zikr.repeat)}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => resetZikr(zikr.id)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  <Icon d={icons.back} size={16} />
                </button>
                <button onClick={() => toggleBookmark(zikr.id)} className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card ${marked ? "text-gold" : "text-muted-foreground"}`}>
                  <Icon d={icons.bookmark} size={16} />
                </button>
                <button onClick={share} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  <Icon d={icons.share} size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Zikr pagination */}
          <div className="mt-4 flex items-center justify-between">
            <button
              disabled={i === 0}
              onClick={() => setI((v) => Math.max(0, v - 1))}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground disabled:opacity-40"
            >
              السابق
            </button>
            <span className="text-[11px] text-muted-foreground">
              {toArabicDigits(i + 1)} من {toArabicDigits(chapter.azkar.length)}
            </span>
            <button
              disabled={i >= chapter.azkar.length - 1}
              onClick={() => setI((v) => Math.min(chapter.azkar.length - 1, v + 1))}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground disabled:opacity-40"
            >
              التالي
            </button>
          </div>

          {chapter.references.length > 0 && (
            <div className="mt-5 rounded-3xl border border-border bg-card p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">التخريج</div>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                {chapter.references.slice(0, 6).map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-between text-[11px] text-muted-foreground">
            {id > 1 ? (
              <Link to="/azkar/$chapter" params={{ chapter: String(id - 1) }} onClick={() => setI(0)}>
                الباب السابق
              </Link>
            ) : (
              <span />
            )}
            {book && id < book.chapters.length ? (
              <Link to="/azkar/$chapter" params={{ chapter: String(id + 1) }} onClick={() => setI(0)}>
                الباب التالي
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}
