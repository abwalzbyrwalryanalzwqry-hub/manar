import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Icon, icons, Screen, ScreenHeader, Skeleton } from "@/components/manar/shell";
import { useAzkarBook } from "@/hooks/use-azkar";
import { useAzkarProgress } from "@/lib/azkar/progress";
import type { AzkarChapter, Zikr } from "@/lib/azkar/types";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/azkar/$chapter")({
  head: () => ({
    meta: [
      { title: "حصن المسلم — منار" },
      { name: "description", content: "أذكار وأدعية من كتاب حصن المسلم بنصوص موثّقة وعدّاد تكرار لكل ذكر." },
      { property: "og:title", content: "حصن المسلم — منار" },
      { property: "og:description", content: "أذكار وأدعية موثّقة مع عدّاد تكرار لكل ذكر وحفظ للتقدّم." },
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

  const chapter = useMemo(() => book?.chapters.find((c) => c.id === id), [book, id]);
  const firstZikr = chapter?.azkar[0];

  useEffect(() => {
    if (chapter && firstZikr) setLast(chapter.id, firstZikr.id);
  }, [chapter, firstZikr, setLast]);

  const backTo = chapter ? "/azkar/group/$group" : "/azkar";

  return (
    <Screen>
      <ScreenHeader
        title={chapter?.title ?? "حصن المسلم"}
        subtitle={
          chapter
            ? `الباب ${toArabicDigits(chapter.id)} · ${toArabicDigits(chapter.azkar.length)} ذكر`
            : "من أذكار الكتاب والسنة"
        }
        backTo={chapter ? backTo.replace("$group", chapter.group) : "/azkar"}
      />

      {loading && (
        <div className="space-y-3 px-4">
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-52 rounded-3xl" />
        </div>
      )}
      {error && <p className="px-5 text-sm text-muted-foreground">{error}</p>}

      {chapter && (
        <div className="space-y-4 px-4">
          {chapter.azkar.map((zikr, idx) => (
            <ZikrCard
              key={zikr.id}
              zikr={zikr}
              index={idx + 1}
              total={chapter.azkar.length}
              chapter={chapter}
              count={progress.counters[zikr.id] ?? 0}
              done={progress.completed.includes(zikr.id)}
              marked={progress.bookmarks.includes(zikr.id)}
              onTap={() => tap(zikr.id, zikr.repeat)}
              onReset={() => resetZikr(zikr.id)}
              onBookmark={() => toggleBookmark(zikr.id)}
            />
          ))}

          {chapter.references.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">التخريج</div>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                {chapter.references.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between pt-2 text-[11px] text-muted-foreground">
            {id > 1 ? (
              <Link to="/azkar/$chapter" params={{ chapter: String(id - 1) }}>
                الباب السابق
              </Link>
            ) : (
              <span />
            )}
            {book && id < book.chapters.length ? (
              <Link to="/azkar/$chapter" params={{ chapter: String(id + 1) }}>
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

function ZikrCard({
  zikr,
  index,
  total,
  chapter,
  count,
  done,
  marked,
  onTap,
  onReset,
  onBookmark,
}: {
  zikr: Zikr;
  index: number;
  total: number;
  chapter: AzkarChapter;
  count: number;
  done: boolean;
  marked: boolean;
  onTap: () => void;
  onReset: () => void;
  onBookmark: () => void;
}) {
  const share = async () => {
    const text = `${chapter.title}\n\n${zikr.text}\n\n— حصن المسلم · تطبيق منار`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* ignore cancel */
    }
  };

  const pct = Math.min(100, (count / Math.max(1, zikr.repeat)) * 100);

  return (
    <div className="glass relative overflow-hidden rounded-[28px] p-5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="tabular-nums">
          {toArabicDigits(index)} من {toArabicDigits(total)}
        </span>
        <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 tabular-nums">
          التكرار {toArabicDigits(zikr.repeat)}
        </span>
      </div>

      <p className="mt-3 text-right font-display text-[21px] leading-[2.1]">{zikr.text}</p>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-border/60">
        <div className={`h-full ${done ? "gradient-gold" : "gradient-primary"}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={onTap}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition active:scale-95 ${
            done ? "bg-secondary text-primary" : "gradient-primary text-primary-foreground shadow-glow"
          }`}
        >
          <Icon d={done ? icons.check : icons.azkar} size={16} />
          <span className="tabular-nums">
            {toArabicDigits(count)} / {toArabicDigits(zikr.repeat)}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            aria-label="إعادة العدّاد"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <Icon d={icons.back} size={16} />
          </button>
          <button
            onClick={onBookmark}
            aria-label="حفظ الذكر"
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card ${
              marked ? "text-gold" : "text-muted-foreground"
            }`}
          >
            <Icon d={icons.bookmark} size={16} />
          </button>
          <button
            onClick={share}
            aria-label="مشاركة الذكر"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <Icon d={icons.share} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
