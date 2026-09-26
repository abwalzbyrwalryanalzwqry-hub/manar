import { useMemo } from "react";
import { useAnnouncer } from "@/components/manar/live-announcer";
import { counterAnnouncement } from "@/lib/azkar/a11y";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Icon, icons, Screen, ScreenHeader } from "@/components/manar/shell";
import { WirdProgressBar } from "@/components/manar/wird-progress";
import { toArabicDigits } from "@/lib/format";
import { getWirdSession } from "@/lib/wird/data";
import { haptic, hapticFor, textSizePx, useAzkarPrefs } from "@/lib/azkar/prefs";
import { useWirdSessionProgress, wirdCompletion } from "@/lib/wird/progress";

export const Route = createFileRoute("/wird/list/$session")({
  head: () => ({
    meta: [
      { title: "أذكار الوِرد بالتفصيل — منار" },
      {
        name: "description",
        content:
          "قائمة مفصّلة بأذكار الوِرد: ترتيب كل ذكر وعدد تكراره مع عدّاد نقر مباشر وتنبيه عند الإكمال.",
      },
      { property: "og:title", content: "أذكار الوِرد بالتفصيل — منار" },
      {
        property: "og:description",
        content: "كل أذكار الوِرد بترتيبها وتكرارها مع عدّاد نقر وتنبيه عند اكتمال الذكر.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WirdListPage,
});

function WirdListPage() {
  const { session } = Route.useParams();
  const wird = getWirdSession(session);
  const key = wird?.key ?? "morning";
  const items = useMemo(() => wird?.items ?? [], [wird]);
  const { prefs } = useAzkarPrefs();
  const { announce, node: liveRegion } = useAnnouncer();
  const { progress, hydrated, increment, setCurrent, resetItem } = useWirdSessionProgress(
    key,
    items,
  );
  const overall = useMemo(() => wirdCompletion(progress, items), [progress, items]);
  const current = items.find((i) => i.order === progress.current) ?? items[0];
  const currentCount = current ? Math.min(current.repeat, progress.counts[current.order] ?? 0) : 0;

  if (!wird) {
    return (
      <Screen>
        <div className="px-5 pt-24 text-center text-sm text-muted-foreground">وِرد غير معروف.</div>
        <div className="mt-4 px-5">
          <Link
            to="/wird"
            className="gradient-primary block rounded-2xl py-3 text-center text-sm text-primary-foreground"
          >
            رجوع إلى الوِرد
          </Link>
        </div>
      </Screen>
    );
  }

  const onTap = (order: number, repeat: number, name: string) => {
    const now = Math.min(repeat, progress.counts[order] ?? 0);
    if (now >= repeat) return;
    haptic(prefs, hapticFor(now, repeat));
    announce(`${name}: ${counterAnnouncement(now, repeat)}`);
    increment(order, repeat);
    setCurrent(order);
    if (now + 1 >= repeat)
      toast.success(`تم إكمال: ${name}`, { description: `${toArabicDigits(repeat)} مرة` });
  };

  return (
    <Screen>
      {liveRegion}
      <ScreenHeader
        title={`${wird.title} — بالتفصيل`}
        subtitle="كل ذكر بترتيبه وعدد تكراره"
        backTo="/wird"
      />

      <div className="px-5">
        <WirdProgressBar
          ratio={overall.ratio}
          currentName={current?.name}
          currentOrder={current?.order ?? 1}
          total={items.length}
          remaining={current ? current.repeat - currentCount : 0}
          completedItems={overall.completedItems}
          saved={Boolean(progress.updatedAt)}
        />
      </div>

      <div className="mt-4 px-5">
        <Link
          to="/wird/$session"
          params={{ session: key }}
          className="gradient-primary flex items-center justify-center rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow"
        >
          الجلسة المتسلسلة
        </Link>
      </div>

      <div className="mt-4 space-y-3 px-5">
        {items.map((it) => {
          const count = Math.min(it.repeat, progress.counts[it.order] ?? 0);
          const done = count >= it.repeat;
          const ratio = it.repeat ? count / it.repeat : 0;
          return (
            <div
              key={it.order}
              className={`glass relative overflow-hidden rounded-[24px] p-4 shadow-soft ${done ? "border border-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-[11px] tabular-nums">
                    {toArabicDigits(it.order)}
                  </span>
                  <span className="text-[12px] font-medium">{it.name}</span>
                </div>
                <span className="rounded-full border border-border bg-card/70 px-2.5 py-1 text-[10px] tabular-nums text-muted-foreground">
                  {toArabicDigits(it.repeat)} مرة
                </span>
              </div>

              <p
                className={`mt-3 text-right text-foreground ${
                  it.quran ? "font-quran leading-[2.2]" : "font-display leading-[2]"
                }`}
                style={{ fontSize: textSizePx(prefs) * 0.85 }}
              >
                {it.text}
              </p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="gradient-gold h-full transition-all duration-300"
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => onTap(it.order, it.repeat, it.name)}
                  disabled={!hydrated || done}
                  className={`counter-tap flex-1 rounded-2xl py-3 text-sm font-medium transition active:scale-95 ${
                    done
                      ? "border border-primary/30 bg-primary/10 text-primary"
                      : "gradient-primary text-primary-foreground shadow-glow"
                  }`}
                >
                  {done ? "مكتمل" : `${toArabicDigits(count)} / ${toArabicDigits(it.repeat)}`}
                </button>
                <button
                  onClick={() => resetItem(it.order)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"
                  aria-label={`إعادة عدّاد ${it.name}`}
                >
                  <Icon d={icons.trend} size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
