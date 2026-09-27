import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Arabesque,
  Icon,
  icons,
  prayerIcon,
  RingProgress,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { LocationSheet } from "@/components/manar/location-sheet";
import { PRAYER_LABELS, PRAYER_ORDER, usePrayerSchedule, type PrayerKey } from "@/lib/prayer";
import { useAdhanSettings } from "@/lib/adhan-settings";
import { formatCountdown, formatHHMM, formatHijriAr, toArabicDigits } from "@/lib/format";
import { useHijriAdjust } from "@/lib/hijri";
import { FARD_PRAYERS, dayKey, prayerDayKey, useActivityLog } from "@/lib/activity-log";

export const Route = createFileRoute("/_tabs/prayer")({
  /* الأوقات والأيام تُنسَّق بتوقيت الجهاز، والخادم لا يعرف منطقة المستخدم
   * الزمنية، فرسمها على الخادم يعطي نصاً مختلفاً ويكسر الـHydration. */
  ssr: false,
  head: () => ({ meta: [{ title: "أوقات الصلاة — منار" }] }),
  component: Prayer,
});

const METHOD_LABELS: Record<string, string> = {
  UmmAlQura: "أم القرى",
  MuslimWorldLeague: "رابطة العالم الإسلامي",
  Egyptian: "الهيئة المصرية",
  Karachi: "كراتشي",
  Dubai: "دبي",
  Qatar: "قطر",
  Kuwait: "الكويت",
  MoonsightingCommittee: "لجنة رؤية الهلال",
  Singapore: "سنغافورة",
  Turkey: "ديانت تركيا",
  Tehran: "طهران",
  NorthAmerica: "أمريكا الشمالية (ISNA)",
};

function Prayer() {
  const { adjust: hijriAdjust } = useHijriAdjust();
  const { dayRecord, streak, togglePrayer } = useActivityLog();
  const [sheet, setSheet] = useState(false);
  const { settings, updateDeep } = useAdhanSettings();

  const {
    now,
    today,
    current,
    next,
    remainingMs,
    progress,
    location,
    setLocation,
    requestGps,
    locStatus,
    locError,
    settings: calc,
  } = usePrayerSchedule();

  /* يوم الصلاة من الفجر إلى الفجر: عشاء ما بعد منتصف الليل يُسجَّل للأمس. */
  const logDay = prayerDayKey(now, today.fajr);
  const beforeFajr = logDay !== dayKey(now);
  const todayLog = dayRecord(logDay);

  const cd = formatCountdown(remainingMs);
  const toggleBell = (k: PrayerKey) =>
    updateDeep((s) => ({
      ...s,
      perPrayer: { ...s.perPrayer, [k]: { ...s.perPrayer[k], adhan: !s.perPrayer[k].adhan } },
    }));

  return (
    <Screen>
      <ScreenHeader
        title="أوقات الصلاة"
        subtitle={`${location.city} · ${formatHijriAr(now, hijriAdjust)}`}
        action={
          <button
            onClick={() => setSheet(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft"
            aria-label="تغيير الموقع"
          >
            <Icon d={icons.location} size={18} />
          </button>
        }
      />

      {/* Luxury countdown widget */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[32px] p-7 text-white shadow-elegant">
          <Arabesque className="absolute -right-12 -top-12 h-72 w-72 text-white/15 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex flex-col items-center">
            <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70 backdrop-blur">
              الصلاة القادمة
            </div>
            <div className="mt-5">
              <RingProgress value={progress} size={220} stroke={6}>
                <div className="text-center">
                  <div className="font-display text-2xl font-light text-white/90">
                    صلاة {PRAYER_LABELS[next.key].ar}
                  </div>
                  <div className="mt-2 font-display text-5xl font-black tabular-nums leading-none">
                    {cd.h}:{cd.m}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                    {cd.s} ثانية
                  </div>
                </div>
              </RingProgress>
            </div>
            <div className="mt-6 flex w-full justify-between border-t border-white/15 pt-4 text-[11px]">
              <div>
                <div className="text-white/50">آذان {PRAYER_LABELS[next.key].ar}</div>
                <div className="font-display text-base tabular-nums">
                  {toArabicDigits(formatHHMM(next.at))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-white/50">الحالية</div>
                <div className="font-display text-base">{PRAYER_LABELS[current.key].ar}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* تقدّم اليوم — يُغذّي شاشة الإحصائيات مباشرة */}
      <div className="px-4 pt-5">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.flame} size={18} />
          </span>
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium">
                {beforeFajr ? "صلوات الأمس · حتى الفجر" : "صلوات اليوم"}
              </span>
              <span className="font-display text-sm tabular-nums">
                {toArabicDigits(todayLog.prayers.length)} / {toArabicDigits(FARD_PRAYERS.length)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="gradient-primary h-full transition-all duration-500"
                style={{ width: `${(todayLog.prayers.length / FARD_PRAYERS.length) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              {streak > 0
                ? `سلسلة ${toArabicDigits(streak)} ${streak === 1 ? "يوم" : streak === 2 ? "يومين" : "يوماً"} متتالية`
                : "سجّل صلاتك لتبدأ سلسلتك"}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel hint={beforeFajr ? "✓ يُسجَّل للأمس حتى الفجر" : "اضغط ✓ لتسجيل الأداء"}>
        جدول الصلوات
      </SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {PRAYER_ORDER.map((k) => {
          const at: Date = today[k];
          const active = k === next.key;
          const passed = at.getTime() < now.getTime();
          return (
            <div
              key={k}
              className={`relative overflow-hidden rounded-2xl border transition ${
                active
                  ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card shadow-soft"
              }`}
            >
              {active && <Arabesque className="absolute -right-6 -top-6 h-32 w-32 text-white/15" />}
              <Link
                to="/notifications"
                className="relative flex items-center justify-between px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-white/20" : "bg-secondary text-primary"}`}
                  >
                    <Icon d={prayerIcon(k)} size={20} />
                  </span>
                  <div>
                    <div className={`text-sm font-medium ${passed && !active ? "opacity-60" : ""}`}>
                      {PRAYER_LABELS[k].ar}
                    </div>
                    <div
                      className={`text-[10px] uppercase tracking-widest ${active ? "text-white/70" : "text-muted-foreground"}`}
                    >
                      {PRAYER_LABELS[k].en}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`font-display text-xl font-medium tabular-nums ${passed && !active ? "opacity-60" : ""}`}
                    >
                      {toArabicDigits(formatHHMM(at))}
                    </div>
                    <div
                      className={`text-[10px] ${active ? "text-white/70" : "text-muted-foreground"}`}
                    >
                      {active ? "القادمة" : passed ? "منتهية" : "قادمة"}
                    </div>
                  </div>
                  {FARD_PRAYERS.includes(k) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePrayer(k, logDay);
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                        todayLog.prayers.includes(k)
                          ? active
                            ? "border-white/40 bg-white text-primary"
                            : "border-transparent gradient-primary text-primary-foreground shadow-glow"
                          : active
                            ? "border-white/30 bg-white/15 text-white/70"
                            : "border-border bg-card text-muted-foreground"
                      }`}
                      aria-label={
                        todayLog.prayers.includes(k)
                          ? `إلغاء تسجيل ${PRAYER_LABELS[k].ar}`
                          : `تسجيل أداء ${PRAYER_LABELS[k].ar}`
                      }
                    >
                      <Icon d={icons.check} size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleBell(k);
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      active
                        ? "border-white/30 bg-white/15 text-white"
                        : settings.perPrayer[k].adhan
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                    aria-label="notification"
                  >
                    <Icon d={settings.perPrayer[k].adhan ? icons.bell : icons.bellOff} size={14} />
                  </button>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <SectionLabel>الإعدادات</SectionLabel>
      <div className="space-y-2 px-4">
        {[
          { l: "الموقع", v: location.city, onClick: () => setSheet(true) },
          { l: "طريقة الحساب", v: METHOD_LABELS[calc.method] ?? calc.method },
          { l: "المذهب", v: calc.madhab === "hanafi" ? "الحنفي" : "الجمهور" },
        ].map((r) => (
          <button
            key={r.l}
            onClick={r.onClick}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft"
          >
            <span className="text-sm">{r.l}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.v}
              <span className="rotate-180">
                <Icon d={icons.chevron} size={14} />
              </span>
            </span>
          </button>
        ))}
      </div>

      <LocationSheet
        open={sheet}
        onClose={() => setSheet(false)}
        onPick={setLocation}
        onUseGps={requestGps}
        status={locStatus}
        error={locError}
      />
    </Screen>
  );
}
