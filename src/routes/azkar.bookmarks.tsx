import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { DataError } from "@/components/manar/data-error";
import { EmptyState, Icon, icons, Screen, ScreenHeader, Skeleton } from "@/components/manar/shell";
import { useAzkarBook } from "@/hooks/use-azkar";
import { bookmarkEntries } from "@/lib/azkar/hub";
import { useAzkarProgress } from "@/lib/azkar/progress";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/azkar/bookmarks")({
  head: () => ({
    meta: [
      { title: "الأذكار المحفوظة — منار" },
      { name: "description", content: "الأذكار التي حفظتها من حصن المسلم للرجوع إليها سريعًا." },
    ],
  }),
  component: AzkarBookmarks,
});

/** أول سطر من الذكر للمعاينة. */
function preview(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

function AzkarBookmarks() {
  const { book, loading, error, retry } = useAzkarBook();
  const { progress, toggleBookmark } = useAzkarProgress();
  const entries = useMemo(
    () => (book ? bookmarkEntries(book, progress.bookmarks) : []),
    [book, progress.bookmarks],
  );

  return (
    <Screen>
      <ScreenHeader
        title="المحفوظات"
        subtitle={
          entries.length ? `${toArabicDigits(entries.length)} ذكرًا محفوظًا` : "الأذكار التي حفظتها"
        }
        backTo="/azkar"
      />

      {loading && (
        <div className="space-y-3 px-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      )}
      {error && <DataError message={error} onRetry={retry} title="تعذّر تحميل الأذكار" />}

      {book && !entries.length && (
        <EmptyState
          icon={icons.bookmark}
          title="لا توجد أذكار محفوظة بعد"
          hint="اضغط على علامة الحفظ في بطاقة أي ذكر ليظهر هنا."
        />
      )}

      <ul className="space-y-3 px-5 stagger">
        {entries.map(({ zikr, chapter }) => (
          <li
            key={zikr.id}
            className="relative rounded-3xl border border-border/60 bg-card/70 shadow-soft backdrop-blur-xl"
          >
            <Link
              to="/azkar/$chapter"
              params={{ chapter: String(chapter.id) }}
              search={{ zikr: zikr.id, ...(zikr.time ? { time: zikr.time } : {}) }}
              className="block p-4 pl-14 text-right"
            >
              <div className="text-[11px] text-muted-foreground">
                الباب {toArabicDigits(chapter.id)} · {chapter.title}
                {zikr.title ? ` · ${zikr.title}` : ""}
              </div>
              <p
                className={`mt-2 leading-loose ${zikr.quran ? "font-quran text-[17px]" : "font-display text-[16px]"}`}
              >
                {preview(zikr.text)}
              </p>
              <div className="mt-2 text-[10px] text-muted-foreground">
                التكرار {toArabicDigits(zikr.repeat)}
                {zikr.time ? ` · ${zikr.time === "morning" ? "صباحًا" : "مساءً"}` : ""}
              </div>
            </Link>
            <button
              onClick={() => toggleBookmark(zikr.id)}
              aria-label="إزالة من المحفوظات"
              className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-gold"
            >
              <Icon d={icons.bookmark} size={15} />
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
