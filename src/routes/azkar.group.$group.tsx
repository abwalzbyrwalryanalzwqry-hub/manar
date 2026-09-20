import { createFileRoute, Link } from "@tanstack/react-router";
import { DataError } from "@/components/manar/data-error";
import { useMemo } from "react";
import { useAzkarBook } from "@/hooks/use-azkar";
import { useAzkarProgress } from "@/lib/azkar/progress";
import { Icon, icons, Screen, ScreenHeader, Skeleton } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/azkar/group/$group")({
  head: () => ({
    meta: [
      { title: "أبواب الأذكار — منار" },
      {
        name: "description",
        content: "أبواب حصن المسلم داخل القسم مع عدد الأذكار وتقدّمك في كل باب.",
      },
      { property: "og:title", content: "أبواب الأذكار — منار" },
      { property: "og:description", content: "استعرض أبواب القسم من حصن المسلم وتابع تقدّمك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupChapters,
});

function GroupChapters() {
  const { group } = Route.useParams();
  const { book, loading, error, retry } = useAzkarBook();
  const { progress } = useAzkarProgress();

  const info = useMemo(() => book?.groups.find((g) => g.id === group), [book, group]);
  const chapters = useMemo(
    () => book?.chapters.filter((c) => c.group === group) ?? [],
    [book, group],
  );

  return (
    <Screen>
      <ScreenHeader
        title={info?.title ?? "أبواب الأذكار"}
        subtitle={
          chapters.length
            ? `${toArabicDigits(chapters.length)} باب · ${toArabicDigits(chapters.reduce((n, c) => n + c.azkar.length, 0))} ذكر`
            : "حصن المسلم"
        }
        backTo="/azkar"
      />

      {loading && (
        <div className="space-y-3 px-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-3xl" />
          ))}
        </div>
      )}
      {error && <DataError message={error} onRetry={retry} title="تعذّر تحميل الأذكار" />}

      <div className="space-y-3 px-5 stagger">
        {chapters.map((c) => {
          const done = c.azkar.filter((z) => progress.completed.includes(z.id)).length;
          return (
            <Link
              key={c.id}
              to="/azkar/$chapter"
              params={{ chapter: String(c.id) }}
              search={{ zikr: undefined }}
              className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card/70 p-4 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary font-display text-sm text-primary tabular-nums">
                {toArabicDigits(c.id)}
              </span>
              <div className="flex-1">
                <div className="font-display text-sm font-medium leading-snug">{c.title}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {toArabicDigits(c.azkar.length)} ذكر
                  {done > 0 ? ` · أتممت ${toArabicDigits(done)}` : ""}
                </div>
              </div>
              <Icon d={icons.back} size={16} />
            </Link>
          );
        })}
      </div>
    </Screen>
  );
}
