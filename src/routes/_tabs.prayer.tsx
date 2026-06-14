import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Arabesque, Icon, icons, prayerIcon, RingProgress, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { LocationSheet } from "@/components/manar/location-sheet";
import { PRAYER_LABELS, PRAYER_ORDER, usePrayerSchedule, type PrayerKey } from "@/lib/prayer";
import { useAdhanSettings } from "@/lib/adhan-settings";
import { formatCountdown, formatHHMM, formatHijriAr, toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/_tabs/prayer")({
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
  const [sheet, setSheet] = useState(false);
  const { settings, updateDeep } = useAdhanSettings();

  const {
    now, today, current, next, remainingMs, progress,
    location, setLocation, requestGps, locStatus, locError, settings: calc,
  } = usePrayerSchedule();

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
        subtitle={`${location.city} · ${formatHijriAr(now)}`}
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
                <div className="font-display text-base tabular-nums">{toArabicDigits(formatHHMM(next.at))}</div>
              </div>
              <div className="text-right">
                <div className="text-white/50">الحالية</div>
                <div className="font-display text-base">{PRAYER_LABELS[current.key].ar}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel hint="اليوم">جدول الصلوات</SectionLabel>
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
              <div className="relative flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-white/20" : "bg-secondary text-primary"}`}>
                    <Icon d={icons.prayer} size={18} />
                  </span>
                  <div>
                    <div className={`text-sm font-medium ${passed && !active ? "opacity-60" : ""}`}>
                      {PRAYER_LABELS[k].ar}
                    </div>
                    <div className={`text-[10px] uppercase tracking-widest ${active ? "text-white/70" : "text-muted-foreground"}`}>
                      {PRAYER_LABELS[k].en}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`font-display text-xl font-medium tabular-nums ${passed && !active ? "opacity-60" : ""}`}>
                      {toArabicDigits(formatHHMM(at))}
                    </div>
                    <div className={`text-[10px] ${active ? "text-white/70" : "text-muted-foreground"}`}>
                      {active ? "القادمة" : passed ? "منتهية" : "قادمة"}
                    </div>
                  </div>
                  <button
                    onClick={() => setBells((b) => ({ ...b, [k]: !b[k] }))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      active
                        ? "border-white/30 bg-white/15 text-white"
                        : bells[k]
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                    aria-label="notification"
                  >
                    <Icon d={bells[k] ? icons.bell : icons.bellOff} size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SectionLabel>الإعدادات</SectionLabel>
      <div className="space-y-2 px-4">
        {[
          { l: "الموقع", v: location.city, onClick: () => setSheet(true) },
          { l: "طريقة الحساب", v: METHOD_LABELS[settings.method] ?? settings.method },
          { l: "المذهب", v: settings.madhab === "hanafi" ? "الحنفي" : "الجمهور" },
        ].map((r) => (
          <button
            key={r.l}
            onClick={r.onClick}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft"
          >
            <span className="text-sm">{r.l}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.v}
              <span className="rotate-180"><Icon d={icons.chevron} size={14} /></span>
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
