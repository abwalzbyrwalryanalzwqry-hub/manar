import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Arabesque,
  Icon,
  icons,
  RingProgress,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { SeasonContentList, Switch } from "@/components/manar/season-parts";
import { useAdhanSettings } from "@/lib/adhan-settings";
import { dayKey } from "@/lib/activity-log";
import { ampmAr, formatCountdown, formatHHMM, toArabicDigits } from "@/lib/format";
import { formatHijriAr } from "@/lib/format";
import { useHijriAdjust } from "@/lib/hijri";
import {
  EARLY_OPTIONS,
  JUMUAH_DEEDS,
  jumuahStats,
  jumuahTimeline,
  markableFridayKey,
  minutesWord,
  nextFridayKey,
  useJumuah,
  type JumuahDeedId,
} from "@/lib/jumuah";
import { usePrayerSchedule } from "@/lib/prayer";
import { SEASONS } from "@/lib/seasons/definitions";

export const Route = createFileRoute("/jumuah")({
  /* مواعيد وأيام بتوقيت الجهاز: لا رسم على الخادم (انظر ssr-time-routes). */
  ssr: false,
  head: () => ({ meta: [{ title: "صلاة الجمعة — منار" }] }),
  component: JumuahScreen,
});

const FRIDAY_CONTENT =
  SEASONS.find((s) => s.id === "friday")?.phases.find((p) => p.id === "day")?.content ?? [];

const time = (d: Date | null) => (d ? `${formatHHMM(d)} ${ampmAr(d)}` : "—");

function JumuahScreen() {
  const { now, today, location, settings: calc } = usePrayerSchedule();
  const { settings: adhan } = useAdhanSettings();
  const { adjust } = useHijriAdjust();
  const { store, toggle, patchPrefs } = useJumuah();
  const { prefs, days } = store;

  /* يوم الصلاة من الفجر إلى الفجر: ليلة السبت قبل الفجر ما زالت للجمعة. */
  const markKey = markableFridayKey(now, today.fajr);
  const isFridayNow = markKey !== null;
  const key = markKey ?? nextFridayKey(now);

  const t = useMemo(
    () => jumuahTimeline(key, location, calc, adhan, prefs),
    [key, location, calc, adhan, prefs],
  );
  const stats = useMemo(() => jumuahStats(days, dayKey(now)), [days, now]);
  const record = days[key] ?? {};
  const done = JUMUAH_DEEDS.filter((d) => record[d.id]).length;

  const untilAdhan = t.adhanAt.getTime() - now.getTime();
  const daysLeft = Math.round(
    (new Date(key).getTime() - new Date(dayKey(now)).getTime()) / 86_400_000,
  );
  const cd = formatCountdown(Math.max(0, untilAdhan));

  let heroLine: string;
  if (isFridayNow && untilAdhan > 0) heroLine = `الأذان بعد ${cd.h}:${cd.m}`;
  else if (isFridayNow) heroLine = "جمعة مباركة";
  else if (daysLeft === 1) heroLine = "غداً الجمعة";
  else heroLine = `بعد ${toArabicDigits(daysLeft)} ${daysLeft <= 10 ? "أيام" : "يوماً"}`;

  return (
    <Screen>
      <ScreenHeader title="صلاة الجمعة" subtitle="موعدها وسننها وسجلّ حضورك" backTo="/more" />

      {/* البطاقة الرئيسية */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-10 -top-10 h-60 w-60 text-white/15" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex items-center justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                {isFridayNow ? "اليوم" : "الجمعة القادمة"}
              </div>
              <div className="mt-2 font-display text-3xl font-medium leading-tight">{heroLine}</div>
              <div className="mt-1 text-[11px] text-white/70">
                {formatHijriAr(t.date, adjust)} · {location.city}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-2xl bg-white/10 px-3 py-2 backdrop-blur">
                  <div className="text-white/60">الأذان والخطبة</div>
                  <div className="font-display text-base tabular-nums">{time(t.adhanAt)}</div>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 backdrop-blur">
                  <div className="text-white/60">الإقامة</div>
                  <div className="font-display text-base tabular-nums">
                    {t.iqamaAt ? time(t.iqamaAt) : "مطفأة"}
                  </div>
                </div>
              </div>
            </div>
            <RingProgress value={done / JUMUAH_DEEDS.length} size={96} stroke={4}>
              <div className="text-center">
                <div className="font-display text-2xl font-black tabular-nums">
                  {toArabicDigits(done)}/{toArabicDigits(JUMUAH_DEEDS.length)}
                </div>
                <div className="text-[9px] text-white/60">سنن اليوم</div>
              </div>
            </RingProgress>
          </div>
        </div>
      </div>

      {/* الجدول الزمني */}
      <SectionLabel hint="يُحسب لمدينتك">مواعيد الجمعة</SectionLabel>
      <div className="space-y-2 px-4">
        <TimeRow
          icon={icons.moon}
          label="سورة الكهف"
          sub="من مغرب الخميس إلى مغرب الجمعة"
          value={`${time(t.kahfFrom)} ← ${time(t.kahfTo)}`}
        />
        <TimeRow
          icon={icons.trend}
          label="التبكير"
          sub={`قبل الأذان بـ${minutesWord(prefs.earlyMinutes)}`}
          value={time(t.earlyAt)}
        />
        <TimeRow
          icon={icons.dhuhr}
          label="الأذان ودخول الخطبة"
          sub="وقت الظهر يوم الجمعة"
          value={time(t.adhanAt)}
          strong
        />
        <TimeRow
          icon={icons.prayer}
          label="إقامة الجمعة"
          sub={
            t.iqamaAt
              ? `بعد الأذان بـ${toArabicDigits(adhan.jumuahIqamaOffset)} دقيقة`
              : "مطفأة من إعدادات الإقامة"
          }
          value={time(t.iqamaAt)}
        />
        <TimeRow
          icon={icons.heart}
          label="ساعة الإجابة"
          sub="آخر ساعة قبل المغرب"
          value={`${time(t.hourFrom)} ← ${time(t.hourTo)}`}
        />
      </div>

      {/* سنن الجمعة */}
      <SectionLabel hint={isFridayNow ? "تُحتسب اليوم فقط" : "تُفتح يوم الجمعة"}>
        سنن الجمعة
      </SectionLabel>
      <div className="space-y-2 px-4">
        {!isFridayNow && (
          <p className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            التسجيل متاح يوم الجمعة وحده، من فجرها إلى فجر السبت. لا يُحتسب شيء في بقية الأيام.
          </p>
        )}
        {JUMUAH_DEEDS.map((d) => (
          <DeedRow
            key={d.id}
            id={d.id}
            title={d.title}
            hint={d.hint}
            on={!!record[d.id]}
            disabled={!isFridayNow}
            onToggle={() => markKey && toggle(markKey, d.id)}
          />
        ))}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            to="/quran/mushaf"
            search={{ surah: 18, mode: "surah" } as never}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-xs font-medium text-primary shadow-soft"
          >
            <Icon d={icons.book} size={14} /> اقرأ الكهف
          </Link>
          <Link
            to="/azkar/$chapter"
            params={{ chapter: "107" }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-xs font-medium text-primary shadow-soft"
          >
            <Icon d={icons.sparkle} size={14} /> الصلاة على النبي ﷺ
          </Link>
        </div>
      </div>

      {/* السجل */}
      <SectionLabel hint={`${toArabicDigits(stats.total)} جمعة مسجّلة`}>سجلّ الجمعة</SectionLabel>
      <div className="px-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="grid grid-cols-2 gap-3">
            <Stat value={toArabicDigits(stats.streak)} label="جُمَع متتالية" />
            <Stat value={`${toArabicDigits(stats.last12)}/١٢`} label="آخر ١٢ جمعة" />
          </div>
          <div className="mt-5 flex items-end justify-between gap-1.5" aria-label="آخر ثماني جُمَع">
            {stats.recent.map((r) => (
              <div key={r.key} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] ${
                    r.attended
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "border border-border bg-muted/40 text-muted-foreground"
                  }`}
                  title={r.key}
                >
                  {r.attended ? <Icon d={icons.check} size={12} /> : toArabicDigits(r.deeds)}
                </span>
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {toArabicDigits(Number(r.key.slice(8)))}/
                  {toArabicDigits(Number(r.key.slice(5, 7)))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* الإعدادات */}
      <SectionLabel>الإعدادات</SectionLabel>
      <div className="space-y-2 px-4">
        <SwitchRow
          label="الجمعة في جدول الصلوات"
          sub="يوم الجمعة تظهر «الجمعة» بدل «الظهر»، وتسجيلها يسجّل الحضور هنا"
          on={prefs.showInList}
          onToggle={() => patchPrefs({ showInList: !prefs.showInList })}
        />
        <SwitchRow
          label="تذكير سورة الكهف"
          sub="صباح الجمعة، إن لم تسجّل قراءتها"
          on={prefs.remindKahf}
          onToggle={() => patchPrefs({ remindKahf: !prefs.remindKahf })}
        />
        <SwitchRow
          label="تذكير التبكير"
          sub={`قبل الأذان بـ${minutesWord(prefs.earlyMinutes)}`}
          on={prefs.remindEarly}
          onToggle={() => patchPrefs({ remindEarly: !prefs.remindEarly })}
        />
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-xs font-medium">وقت التبكير قبل الأذان</div>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {EARLY_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchPrefs({ earlyMinutes: m })}
                aria-pressed={prefs.earlyMinutes === m}
                className={`rounded-xl border py-2 text-[11px] font-medium transition ${
                  prefs.earlyMinutes === m
                    ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {toArabicDigits(m)} د
              </button>
            ))}
          </div>
        </div>
        <SwitchRow
          label="تذكير ساعة الإجابة"
          sub="عند بداية آخر ساعة قبل المغرب"
          on={prefs.remindHour}
          onToggle={() => patchPrefs({ remindHour: !prefs.remindHour })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/iqama"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-xs font-medium shadow-soft"
          >
            <Icon d={icons.prayer} size={14} /> فاصل إقامة الجمعة
          </Link>
          <Link
            to="/sakinah"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-xs font-medium shadow-soft"
          >
            <Icon d={icons.bellOff} size={14} /> سكينة الجمعة
          </Link>
        </div>
      </div>

      {FRIDAY_CONTENT.length > 0 && (
        <>
          <SectionLabel>من فضل الجمعة</SectionLabel>
          <div className="px-4 pb-4">
            <SeasonContentList blocks={FRIDAY_CONTENT} />
          </div>
        </>
      )}
    </Screen>
  );
}

function TimeRow({
  icon,
  label,
  sub,
  value,
  strong,
}: {
  icon: string;
  label: string;
  sub: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 shadow-soft ${
        strong
          ? "border-transparent gradient-primary text-primary-foreground"
          : "border-border bg-card"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          strong ? "bg-white/15" : "bg-secondary text-primary"
        }`}
      >
        <Icon d={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className={`text-[10px] ${strong ? "text-white/70" : "text-muted-foreground"}`}>
          {sub}
        </div>
      </div>
      <div className="shrink-0 text-left font-display text-sm tabular-nums">{value}</div>
    </div>
  );
}

function DeedRow({
  id,
  title,
  hint,
  on,
  disabled,
  onToggle,
}: {
  id: JumuahDeedId;
  title: string;
  hint: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-right shadow-soft transition active:scale-[0.99] disabled:opacity-60 ${
        on ? "border-primary/30 bg-secondary/60" : "border-border bg-card"
      } ${id === "attended" ? "ring-1 ring-primary/20" : ""}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
          on
            ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
            : "border-border bg-card text-muted-foreground"
        }`}
      >
        <Icon d={icons.check} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[10px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function SwitchRow({
  label,
  sub,
  on,
  onToggle,
}: {
  label: string;
  sub: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right shadow-soft"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[10px] leading-relaxed text-muted-foreground">{sub}</span>
      </span>
      <Switch on={on} />
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-3 text-center">
      <div className="font-display text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
