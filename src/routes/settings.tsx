import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { LocationSheet } from "@/components/manar/location-sheet";
import {
  FONT_SCALE_LABELS,
  THEME_LABELS,
  useAppearance,
  type FontScale,
  type ThemeMode,
} from "@/lib/app-settings";
import {
  OFFSET_LIMIT,
  PRAYER_LABELS,
  PRAYER_ORDER,
  computePrayerTimes,
  METHOD_LABELS,
  useLocation,
  useSettings,
  type CalcMethodKey,
  type PrayerKey,
} from "@/lib/prayer";
import { useAdhanSettings } from "@/lib/adhan-settings";
import { useSakinah } from "@/lib/sakinah";
import { HIJRI_ADJUST_RANGE, useHijriAdjust } from "@/lib/hijri";
import {
  CLOCK_LABELS,
  DIGIT_LABELS,
  DISPLAY_EVENT,
  readDisplay,
  writeDisplay,
  DEFAULT_DISPLAY,
  type ClockFormat,
  type DigitStyle,
  type DisplayPrefs,
} from "@/lib/display-prefs";
import { MethodSuggestCard } from "@/components/manar/method-suggest-card";
import { formatHijriAr } from "@/lib/format";
import { haptic, useAzkarPrefs } from "@/lib/azkar/prefs";
import { ampmAr, formatHHMM, toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  /* معاينة التاريخ الهجري وتنسيق العرض بتوقيت الجهاز (انظر ssr-time-routes). */
  ssr: false,
  head: () => ({ meta: [{ title: "الإعدادات — منار" }] }),
  component: Settings,
});

const DST_LABELS: Record<number, string> = {
  [-1]: "ساعة أقل",
  0: "بلا تعديل",
  1: "ساعة إضافية",
};

type Sheet = null | "theme" | "font" | "method" | "madhab" | "offsets" | "location";

function Settings() {
  const { appearance, setTheme, setFontScale } = useAppearance();
  const { location, setLocation, requestGps, status: locStatus, error: locError } = useLocation();
  const { settings, patchSettings, setOffset, resetOffsets } = useSettings();
  const { settings: adhan } = useAdhanSettings();
  const { settings: sakinah } = useSakinah();
  const { adjust, setAdjust } = useHijriAdjust();
  const display = useDisplayPrefs();
  const { prefs: azkarPrefs, update: updateAzkarPrefs } = useAzkarPrefs();

  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const offsetCount = PRAYER_ORDER.filter((p) => settings.offsets[p] !== 0).length;
  const offsetSummary =
    offsetCount === 0 && settings.dstOffset === 0
      ? "بلا تعديل"
      : [
          offsetCount > 0 ? `${toArabicDigits(offsetCount)} صلاة معدّلة` : null,
          settings.dstOffset !== 0 ? DST_LABELS[settings.dstOffset] : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Screen>
      <ScreenHeader title="الإعدادات" subtitle="كل ما تغيّره يُحفظ فوراً" backTo="/more" />

      <SectionLabel>العرض</SectionLabel>
      <div className="space-y-2 px-5">
        <Row
          icon={appearance.theme === "dark" ? icons.moon : icons.sun}
          label="المظهر"
          value={THEME_LABELS[appearance.theme]}
          onClick={() => setSheet("theme")}
        />
        <Row
          icon={icons.quran}
          label="حجم الخط"
          value={FONT_SCALE_LABELS[appearance.fontScale]}
          onClick={() => setSheet("font")}
        />
        <Segmented
          icon={icons.clock}
          label="تنسيق الوقت"
          value={display.clock}
          options={(["12", "24"] as ClockFormat[]).map((v) => ({ v, l: CLOCK_LABELS[v] }))}
          onChange={(clock) => writeDisplay({ clock })}
        />
        <Segmented
          icon={icons.tag}
          label="الأرقام"
          value={display.digits}
          options={(["arab", "latn"] as DigitStyle[]).map((v) => ({ v, l: DIGIT_LABELS[v] }))}
          onChange={(digits) => writeDisplay({ digits })}
        />
        {/* لغة واحدة الآن: نص للعلم، لا زرّ يوحي بخيارات غير موجودة. */}
        <div className="flex items-center gap-3 px-4 py-2 text-[11px] text-muted-foreground">
          <Icon d={icons.globe} size={14} />
          لغة التطبيق: العربية
        </div>
      </div>

      <SectionLabel>الصلاة والمواقيت</SectionLabel>
      <div className="space-y-2 px-5">
        <Row
          icon={icons.location}
          label="الموقع"
          value={location.city}
          onClick={() => setSheet("location")}
        />
        <Row
          icon={icons.prayer}
          label="طريقة الحساب"
          value={METHOD_LABELS[settings.method]}
          onClick={() => setSheet("method")}
        />
        <MethodSuggestCard />
        <Row
          icon={icons.qibla}
          label="المذهب في العصر"
          value={settings.madhab === "hanafi" ? "الحنفي" : "الجمهور"}
          onClick={() => setSheet("madhab")}
        />
        <Row
          icon={icons.speed}
          label="تعديل أوقات الصلاة"
          value={offsetSummary}
          onClick={() => setSheet("offsets")}
        />
      </div>

      <SectionLabel>الأذكار والوِرد</SectionLabel>
      <div className="space-y-2 px-5">
        <SwitchRow
          icon={icons.azkar}
          label="اهتزاز خفيف مع كل نقرة"
          sub="عند كل عدّة في الأذكار والوِرد"
          on={azkarPrefs.hapticTap}
          onChange={(next) => {
            updateAzkarPrefs({ hapticTap: next });
            if (next) haptic({ hapticTap: true, hapticDone: false }, "tap");
          }}
        />
        <SwitchRow
          icon={icons.check}
          label="اهتزاز أقوى عند إتمام الذكر"
          sub="أقوى قليلًا عند إتمام كل ذكر والانتقال لما بعده"
          on={azkarPrefs.hapticDone}
          onChange={(next) => {
            updateAzkarPrefs({ hapticDone: next });
            if (next) haptic({ hapticTap: false, hapticDone: true }, "done");
          }}
        />
        <SwitchRow
          icon={icons.sparkle}
          label="العدّ بالضغط على النص"
          sub="الضغط على نص الذكر يعدّ كزر العدّاد"
          on={azkarPrefs.tapAnywhere}
          onChange={(next) => updateAzkarPrefs({ tapAnywhere: next })}
        />
      </div>

      <SectionLabel hint="تُدار كلها من مركز التنبيهات">التنبيهات والأصوات</SectionLabel>
      <div className="space-y-2 px-5">
        <Row
          icon={icons.bell}
          label="التنبيهات والأصوات"
          hint={notifySummary(adhan, sakinah.enabled)}
          value=""
          to="/notifications"
        />
      </div>

      <SectionLabel hint="تسري على التقويم والمواسم والويدجت">التقويم الهجري</SectionLabel>
      <div className="px-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">إزاحة التاريخ الهجري</div>
              <div className="text-[10px] text-muted-foreground">
                إن سبق الهلالُ الحسابَ في بلدك أو تأخّر عنه
              </div>
            </div>
            <div className="shrink-0 text-left text-xs font-medium text-primary">
              {formatHijriAr(new Date(), adjust)}
            </div>
          </div>
          <div
            className="mt-3 grid grid-cols-5 gap-1.5"
            role="radiogroup"
            aria-label="إزاحة الهجري"
          >
            {HIJRI_ADJUST_RANGE.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={adjust === v}
                onClick={() => setAdjust(v)}
                className={`rounded-xl border py-2 text-xs font-medium tabular-nums transition ${
                  adjust === v
                    ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {v === 0 ? "بلا" : `${v > 0 ? "+" : "−"}${toArabicDigits(Math.abs(v))}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionLabel>بياناتي</SectionLabel>
      <div className="space-y-2 px-5">
        <Row
          icon={icons.download}
          label="بياناتي"
          value="النسخ الاحتياطي والتصدير والاستيراد"
          to="/my-data"
        />
        <Row icon={icons.info} label="عن التطبيق" value="" to="/about" />
      </div>

      {/* ---------------- الأوراق ---------------- */}

      <LocationSheet
        open={sheet === "location"}
        onClose={close}
        onPick={setLocation}
        onUseGps={requestGps}
        status={locStatus}
        error={locError}
      />

      {sheet === "theme" && (
        <Sheet title="المظهر" onClose={close}>
          {(["system", "light", "dark"] as ThemeMode[]).map((t) => (
            <Choice
              key={t}
              label={THEME_LABELS[t]}
              hint={t === "system" ? "يتبع إعداد نظام الهاتف" : undefined}
              selected={appearance.theme === t}
              onClick={() => setTheme(t)}
            />
          ))}
        </Sheet>
      )}

      {sheet === "font" && (
        <Sheet title="حجم الخط" onClose={close}>
          {(["small", "medium", "large", "xlarge"] as FontScale[]).map((f) => (
            <Choice
              key={f}
              label={FONT_SCALE_LABELS[f]}
              selected={appearance.fontScale === f}
              onClick={() => setFontScale(f)}
            />
          ))}
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            التغيير يسري على التطبيق كله فوراً.
          </p>
        </Sheet>
      )}

      {sheet === "method" && (
        <Sheet title="طريقة الحساب" onClose={close}>
          {(Object.keys(METHOD_LABELS) as CalcMethodKey[]).map((m) => (
            <Choice
              key={m}
              label={METHOD_LABELS[m]}
              selected={settings.method === m}
              onClick={() => patchSettings({ method: m })}
            />
          ))}
        </Sheet>
      )}

      {sheet === "madhab" && (
        <Sheet title="المذهب في وقت العصر" onClose={close}>
          <Choice
            label="الجمهور"
            hint="العصر عند مثل الظل — المالكية والشافعية والحنابلة"
            selected={settings.madhab === "shafi"}
            onClick={() => patchSettings({ madhab: "shafi" })}
          />
          <Choice
            label="الحنفي"
            hint="العصر عند مثلي الظل — يتأخّر عن الجمهور"
            selected={settings.madhab === "hanafi"}
            onClick={() => patchSettings({ madhab: "hanafi" })}
          />
        </Sheet>
      )}

      {sheet === "offsets" && (
        <Sheet title="تعديل أوقات الصلاة" onClose={close}>
          <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
            الحساب الفلكي دقيق، لكن مسجد منطقتك قد يختلف عنه بدقائق. اضبط كل صلاة حتى تطابق الأذان
            عندك — الوقت المعروض بجانب كل صلاة هو الناتج النهائي بعد التعديل.
          </p>

          <div className="space-y-2">
            {PRAYER_ORDER.map((p) => (
              <OffsetRow key={p} prayer={p} />
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4">
            <div className="text-xs font-medium">التوقيت الصيفي</div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              إن ظهر الجدول كله متقدّماً أو متأخراً ساعة كاملة، فالمشكلة في المنطقة الزمنية لا في
              الحساب — عدّلها من هنا.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[-1, 0, 1].map((v) => (
                <button
                  key={v}
                  onClick={() => patchSettings({ dstOffset: v })}
                  className={`rounded-xl border py-2.5 text-[11px] font-medium transition ${
                    settings.dstOffset === v
                      ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {DST_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {(offsetCount > 0 || settings.dstOffset !== 0) && (
            <button
              onClick={resetOffsets}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-xs font-medium text-muted-foreground"
            >
              <Icon d={icons.refresh} size={14} /> إرجاع كل التعديلات
            </button>
          )}
        </Sheet>
      )}
    </Screen>
  );

  /** صف تعديل صلاة واحدة — يعرض الوقت النهائي بعد الإزاحة مباشرة. */
  function OffsetRow({ prayer }: { prayer: PrayerKey }) {
    const value = settings.offsets[prayer] ?? 0;
    const at = computePrayerTimes(location, settings, new Date())[prayer];
    const step = (delta: number) => setOffset(prayer, value + delta);

    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">{PRAYER_LABELS[prayer].ar}</div>
          <div className="mt-0.5 font-display text-sm tabular-nums">
            {formatHHMM(at)}{" "}
            <span className="text-[9px] font-normal text-muted-foreground">{ampmAr(at)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <StepButton
            icon={icons.minus}
            disabled={value <= -OFFSET_LIMIT}
            onClick={() => step(-1)}
            label={`تقديم ${PRAYER_LABELS[prayer].ar} دقيقة`}
          />
          <button
            onClick={() => setOffset(prayer, 0)}
            dir="ltr"
            className={`w-16 rounded-xl border py-2 text-center font-display text-xs tabular-nums transition ${
              value === 0
                ? "border-border bg-secondary/40 text-muted-foreground"
                : "border-transparent gradient-primary text-primary-foreground shadow-glow"
            }`}
            aria-label={`إزاحة ${PRAYER_LABELS[prayer].ar} بالدقائق`}
          >
            {value === 0 ? "٠" : `${value > 0 ? "+" : "−"}${toArabicDigits(Math.abs(value))}`}
          </button>
          <StepButton
            icon={icons.plus}
            disabled={value >= OFFSET_LIMIT}
            onClick={() => step(1)}
            label={`تأخير ${PRAYER_LABELS[prayer].ar} دقيقة`}
          />
        </div>
      </div>
    );
  }
}

function StepButton({
  icon,
  onClick,
  disabled,
  label,
}: {
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground transition disabled:opacity-35"
    >
      <Icon d={icon} size={14} />
    </button>
  );
}

function Row({
  icon,
  label,
  value,
  hint,
  onClick,
  to,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  to?: string;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 text-right">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="truncate">{value}</span>
        {(onClick || to) && (
          <span className="rotate-180">
            <Icon d={icons.chevron} size={14} />
          </span>
        )}
      </span>
    </>
  );

  const cls =
    "flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-right shadow-soft transition hover:shadow-elegant";

  if (to)
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls} disabled={!onClick}>
      {body}
    </button>
  );
}

function SwitchRow({
  icon,
  label,
  sub,
  on,
  onChange,
}: {
  icon: string;
  label: string;
  sub: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-right shadow-soft"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[10px] text-muted-foreground">{sub}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "gradient-primary" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${
            on ? "right-0.5" : "right-[22px]"
          }`}
        />
      </span>
    </button>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[32px] border-t border-border bg-card p-6 shadow-elegant animate-fade-up"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
        <h2 className="mb-4 font-display text-lg font-medium">{title}</h2>
        <div className="space-y-2">{children}</div>
        <button
          onClick={onClose}
          className="gradient-primary mt-5 w-full rounded-2xl py-3.5 text-sm font-medium text-primary-foreground shadow-glow"
        >
          تم
        </button>
      </div>
    </div>
  );
}

function Choice({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-right transition ${
        selected ? "border-primary/50 bg-primary/10" : "border-border bg-card"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-transparent gradient-primary text-primary-foreground" : "border-border"
        }`}
      >
        {selected && <Icon d={icons.check} size={12} />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[10px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

/** ملخّص سطر واحد لما في مركز التنبيهات. */
function notifySummary(
  s: ReturnType<typeof useAdhanSettings>["settings"],
  sakinahOn: boolean,
): string {
  const fard = PRAYER_ORDER.filter((p) => p !== "sunrise");
  const adhanCount = s.adhanEnabled ? fard.filter((p) => s.perPrayer[p]?.adhan).length : 0;
  const adhanText =
    adhanCount === 0
      ? "الأذان متوقف"
      : adhanCount === fard.length
        ? "الأذان مفعّل"
        : `الأذان لـ${toArabicDigits(adhanCount)} صلوات`;
  const iqama = s.iqamaEnabled ? "الإقامة مفعّلة" : "الإقامة متوقفة";
  const sak = sakinahOn ? "سكينة مفعّلة" : "سكينة متوقفة";
  return `${adhanText} · ${iqama} · ${sak}`;
}

function useDisplayPrefs(): DisplayPrefs {
  const [p, setP] = useState<DisplayPrefs>(DEFAULT_DISPLAY);
  useEffect(() => {
    const sync = () => setP(readDisplay());
    sync();
    window.addEventListener(DISPLAY_EVENT, sync);
    return () => window.removeEventListener(DISPLAY_EVENT, sync);
  }, []);
  return p;
}

function Segmented<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: string;
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <div className="flex shrink-0 rounded-xl bg-muted p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
              value === o.v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
