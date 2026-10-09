import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Arabesque,
  Icon,
  icons,
  RingProgress,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { toArabicDigits, formatPercent } from "@/lib/format";
import { WIRD_SESSIONS, WIRD_SESSION_KEYS, type WirdSessionKey } from "@/lib/wird/data";
import {
  isWirdComplete,
  resetWirdSession,
  useWirdOverview,
  wirdCompletion,
} from "@/lib/wird/progress";
import { buildWirdEntries, personalRefs } from "@/lib/wird/entries";
import { personalForWird } from "@/lib/personal-azkar/model";
import { usePersonalAzkar } from "@/lib/personal-azkar/store";
import { usePersonalControls } from "@/components/manar/personal-wird-controls";
import { AddZikrButton } from "@/components/manar/personal-zikr-actions";

export const Route = createFileRoute("/wird/")({
  head: () => ({
    meta: [
      { title: "الوِرد — منار" },
      {
        name: "description",
        content: "ورد الصباح وورد المساء من حصن المسلم مع عدّاد مستقل وتقدّم يُحفظ تلقائيًا.",
      },
      { property: "og:title", content: "الوِرد — منار" },
      {
        property: "og:description",
        content: "قسم مستقل للوِرد: ورد الصباح وورد المساء بعدّاد وتقدّم منفصل لكل وِرد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WirdHub,
});

const META: Record<WirdSessionKey, { icon: string; tint: string }> = {
  morning: { icon: icons.sunrise, tint: "from-gold/25 to-primary/10" },
  evening: { icon: icons.moon, tint: "from-primary/20 to-night/10" },
};

function WirdHub() {
  const store = useWirdOverview();
  const nav = useNavigate();
  const personal = usePersonalAzkar();
  const morning = usePersonalControls({ context: "wird", session: "morning" });
  const evening = usePersonalControls({ context: "wird", session: "evening" });
  const controls = { morning, evening };

  return (
    <Screen>
      <ScreenHeader
        title="الوِرد"
        subtitle="ورد الصباح والمساء — قسم مستقل عن الأذكار"
        backTo="/azkar"
      />

      <div className="px-5 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="pointer-events-none absolute -left-12 -bottom-12 h-56 w-56 text-gold/25" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] w-fit uppercase tracking-[0.3em] backdrop-blur">
            الوِرد
          </div>
          <div className="relative mt-5 font-display text-3xl font-medium leading-snug">
            وِردك اليومي… بسكينة.
          </div>
          <p className="relative mt-2 max-w-[17rem] text-xs font-light leading-relaxed text-white/70">
            وِردان مستقلان بعدّاد وتقدّم خاص لكل منهما، يعملان دون إنترنت. وما تُتمّه منهما يُحتسب
            في أذكار الصباح والمساء.
          </p>
        </div>
      </div>

      <SectionLabel hint="من حصن المسلم">اختر الوِرد</SectionLabel>

      <div className="space-y-4 px-5">
        {WIRD_SESSION_KEYS.map((key) => {
          const s = WIRD_SESSIONS[key];
          const p = store[key];
          const refs = personalRefs(buildWirdEntries(key, s.items, personal.items));
          const { ratio, completedItems } = wirdCompletion(p, s.items, refs);
          const started =
            completedItems > 0 ||
            (p.counts[p.current] ?? 0) > 0 ||
            Object.keys(p.personal ?? {}).length > 0;
          const currentItem = s.items.find((i) => i.order === p.current) ?? s.items[0];
          const complete = isWirdComplete(p, s.items, refs);
          const mine = personalForWird(personal.items, key).length;
          const countable = s.items.length + refs.filter((r) => r.repeat != null).length;
          return (
            <div
              key={key}
              className="glass relative overflow-hidden rounded-[28px] p-5 shadow-soft animate-fade-up"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-bl ${META[key].tint}`}
              />
              <div className="relative flex items-start gap-4">
                <div className="gradient-primary flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                  <Icon d={META[key].icon} size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-display text-xl font-medium">{s.title}</div>
                  <div className="text-[11px] text-muted-foreground">{s.description}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {complete ? (
                      "أتممته اليوم · يتجدّد تلقائيًا غدًا"
                    ) : started ? (
                      <>
                        آخر ما بدأت به: {currentItem?.name} · الذكر {toArabicDigits(p.current)} من{" "}
                        {toArabicDigits(s.items.length)}
                      </>
                    ) : (
                      "لم تبدأ بعد"
                    )}
                  </div>
                  {p.updatedAt && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      حُفِظ آخر تقدّم:{" "}
                      {new Date(p.updatedAt).toLocaleTimeString("ar", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
                <RingProgress value={ratio} size={62} stroke={5} trackColor="var(--border)">
                  <span className="text-[11px] font-medium tabular-nums">
                    {formatPercent(ratio * 100)}
                  </span>
                </RingProgress>
              </div>

              <div className="relative mt-4 flex items-center gap-2">
                {complete ? (
                  <button
                    onClick={() => {
                      resetWirdSession(key);
                      nav({ to: "/wird/$session", params: { session: key } });
                    }}
                    className="gradient-primary flex flex-1 items-center justify-center rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow"
                  >
                    قراءة جديدة
                  </button>
                ) : (
                  <Link
                    to="/wird/$session"
                    params={{ session: key }}
                    className="gradient-primary flex flex-1 items-center justify-center rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow"
                  >
                    {started ? "متابعة الورد" : "ابدأ الورد"}
                  </Link>
                )}
                <Link
                  to="/wird/list/$session"
                  params={{ session: key }}
                  className="rounded-2xl border border-border bg-card px-3 py-3 text-[11px] tabular-nums text-muted-foreground"
                >
                  التفصيل {toArabicDigits(completedItems)}/{toArabicDigits(countable)}
                </Link>
              </div>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {mine > 0
                    ? `فيه ${toArabicDigits(mine)} من أذكارك الخاصة`
                    : "يمكنك إضافة أذكارك الخاصة إليه"}
                </span>
                <AddZikrButton
                  onClick={controls[key].openAdd}
                  className="min-h-[40px] text-[12px]"
                />
              </div>
            </div>
          );
        })}
      </div>
      {morning.nodes}
      {evening.nodes}
    </Screen>
  );
}
