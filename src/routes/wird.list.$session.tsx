import { useMemo } from "react";
import { useAnnouncer } from "@/components/manar/live-announcer";
import { counterAnnouncement } from "@/lib/azkar/a11y";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import { Icon, icons, Screen, ScreenHeader } from "@/components/manar/shell";
import { WirdProgressBar } from "@/components/manar/wird-progress";
import { toArabicDigits } from "@/lib/format";
import { getWirdSession } from "@/lib/wird/data";
import { haptic, hapticFor, textSizePx, useAzkarPrefs } from "@/lib/azkar/prefs";
import { personalCount, useWirdSessionProgress, wirdCompletion } from "@/lib/wird/progress";
import { buildWirdEntries, personalRefs } from "@/lib/wird/entries";
import { usePersonalAzkar } from "@/lib/personal-azkar/store";
import { PersonalBadge, PersonalMenuButton } from "@/components/manar/personal-zikr-actions";
import { usePersonalControls } from "@/components/manar/personal-wird-controls";
import { AddZikrButton } from "@/components/manar/personal-zikr-actions";
import { personalCardId } from "@/lib/personal-azkar/model";

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
  const { progress, hydrated, increment, setCurrent, resetItem, incrementPersonal, resetPersonal } =
    useWirdSessionProgress(key, items);
  const personal = usePersonalAzkar();
  /* القائمة المدمجة تُحسب عند تغيّر الأذكار فقط، لا مع كل نقرة عدّ. */
  const entries = useMemo(
    () => buildWirdEntries(key, items, personal.items),
    [key, items, personal.items],
  );
  const refs = useMemo(() => personalRefs(entries), [entries]);
  const overall = useMemo(() => wirdCompletion(progress, items, refs), [progress, items, refs]);
  const current = items.find((i) => i.order === progress.current) ?? items[0];
  const currentCount = current ? Math.min(current.repeat, progress.counts[current.order] ?? 0) : 0;
  const currentPos = current
    ? entries.findIndex((e) => e.kind === "original" && e.item.order === current.order) + 1
    : 1;
  const controls = usePersonalControls({ context: "wird", session: key });

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

  const onTapPersonal = (id: string, repeat: number | null, name: string) => {
    const now = personalCount(progress, id);
    if (repeat != null && now >= repeat) return;
    haptic(prefs, repeat == null ? "tap" : hapticFor(now, repeat));
    announce(
      repeat == null
        ? `${name}: ${toArabicDigits(now + 1)}`
        : `${name}: ${counterAnnouncement(now, repeat)}`,
    );
    incrementPersonal(id, repeat);
    if (repeat != null && now + 1 >= repeat)
      toast.success(`تم إكمال: ${name}`, { description: `${toArabicDigits(repeat)} مرة` });
  };

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
          currentOrder={currentPos}
          total={entries.length}
          countable={items.length + refs.filter((r) => r.repeat != null).length}
          remaining={current ? current.repeat - currentCount : 0}
          completedItems={overall.completedItems}
          saved={Boolean(progress.updatedAt)}
        />
      </div>

      <div className="mt-4 flex gap-2 px-5">
        <Link
          to="/wird/$session"
          params={{ session: key }}
          className="gradient-primary flex flex-1 items-center justify-center rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow"
        >
          الجلسة المتسلسلة
        </Link>
        <AddZikrButton onClick={controls.openAdd} />
      </div>

      <div className="mt-4 space-y-3 px-5">
        {entries.map((entry, idx) => {
          if (entry.kind === "personal") {
            const z = entry.zikr;
            const repeat = entry.repeat;
            const raw = personalCount(progress, z.id);
            const count = repeat == null ? raw : Math.min(repeat, raw);
            const done = repeat != null && count >= repeat;
            return (
              <div
                key={entry.key}
                id={personalCardId(z.id)}
                className={`glass relative overflow-hidden rounded-[24px] p-4 shadow-soft ${done ? "border border-primary/30" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[11px] tabular-nums">
                      {toArabicDigits(idx + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="break-words pt-1 text-[12px] font-medium">{entry.name}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <PersonalBadge pinned={z.pinned} />
                        <span className="rounded-full border border-border bg-card/70 px-2.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                          {repeat == null ? "عدد مفتوح" : `${toArabicDigits(repeat)} مرة`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <PersonalMenuButton zikr={z} onClick={() => controls.openMenu(z)} />
                </div>

                <p
                  dir="auto"
                  className="mt-3 whitespace-pre-line break-words text-right font-display leading-[2] text-foreground"
                  style={{ fontSize: textSizePx(prefs) * 0.85 }}
                >
                  {z.text}
                </p>

                {repeat != null ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="gradient-gold h-full transition-all duration-300"
                      style={{ width: `${(count / repeat) * 100}%` }}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    عدد مفتوح بلا هدف — لا يمنع إتمام الوِرد.
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => onTapPersonal(z.id, repeat, entry.name)}
                    disabled={!hydrated || done}
                    aria-label={
                      repeat == null
                        ? `زيادة عدّاد ${entry.name}، ${toArabicDigits(count)}`
                        : `زيادة عدّاد ${entry.name}، ${toArabicDigits(count)} من ${toArabicDigits(repeat)}`
                    }
                    className={`counter-tap flex-1 rounded-2xl py-3 text-sm font-medium transition active:scale-95 ${
                      done
                        ? "border border-primary/30 bg-primary/10 text-primary"
                        : "gradient-primary text-primary-foreground shadow-glow"
                    }`}
                  >
                    {done
                      ? "مكتمل"
                      : repeat == null
                        ? toArabicDigits(count)
                        : `${toArabicDigits(count)} / ${toArabicDigits(repeat)}`}
                  </button>
                  <button
                    onClick={() => resetPersonal(z.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"
                    aria-label={`إعادة عدّاد ${entry.name}`}
                  >
                    <Icon d={icons.trend} size={16} />
                  </button>
                </div>
              </div>
            );
          }
          const it = entry.item;
          const count = Math.min(it.repeat, progress.counts[it.order] ?? 0);
          const done = count >= it.repeat;
          const ratio = it.repeat ? count / it.repeat : 0;
          return (
            <div
              key={entry.key}
              className={`glass relative overflow-hidden rounded-[24px] p-4 shadow-soft ${done ? "border border-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-[11px] tabular-nums">
                    {toArabicDigits(idx + 1)}
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
                {it.opening && <span className="block text-center text-primary">{it.opening}</span>}
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
      {controls.nodes}
    </Screen>
  );
}
