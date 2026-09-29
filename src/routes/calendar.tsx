import { createFileRoute } from "@tanstack/react-router";
import { LocationDefaultBanner } from "@/components/manar/location-default-banner";
import { useMemo, useState } from "react";
import {
  Arabesque,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import {
  GREGORIAN_MONTHS,
  OCCASION_TONE,
  WEEKDAY_LABELS,
  addHijriMonths,
  formatHijri,
  gregorianMonthGrid,
  gregorianSpanLabel,
  hijriMonthGrid,
  hijriMonthName,
  isSameDay,
  toHijri,
  upcomingOccasions,
  useHijriAdjust,
  hijriDisplayDate,
  type CalendarCell,
} from "@/lib/hijri";
import { computePrayerTimes, useLocation, useSettings } from "@/lib/prayer";
import { ampmAr, formatHHMM, toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/calendar")({
  /* المحتوى كله أوقات وتواريخ بتوقيت الجهاز، والخادم لا يعرف منطقة المستخدم
   * الزمنية، فرسمه على الخادم يعطي نصاً مختلفاً ويكسر الـHydration. */
  ssr: false,
  head: () => ({ meta: [{ title: "التقويم — منار" }] }),
  component: CalendarScreen,
});

type Mode = "hijri" | "gregorian";

/** وصف مختصر لكل درجة إزاحة، بمنطق المستخدم لا بمنطق الرقم. */
const ADJUST_LABELS: Record<number, string> = {
  [-2]: "قبل يومين",
  [-1]: "قبل يوم",
  0: "افتراضي",
  1: "بعد يوم",
  2: "بعد يومين",
};

const FASTING_TONE = {
  obligatory: { label: "صيام فرض", className: "bg-primary/90 text-primary-foreground" },
  recommended: { label: "صيام مسنون", className: "bg-gold/90 text-navy" },
  forbidden: { label: "لا صيام", className: "bg-rose-400/90 text-white" },
  none: { label: "", className: "" },
} as const;

function CalendarScreen() {
  const { adjust, rev, setAdjust, atMaghrib, setAtMaghrib } = useHijriAdjust();
  const { location } = useLocation();
  const { settings: calc } = useSettings();

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12);
  }, []);

  const [mode, setMode] = useState<Mode>("hijri");
  const [selected, setSelected] = useState<Date>(today);
  const [showAdjust, setShowAdjust] = useState(false);

  const todayHijri = toHijri(today, adjust);
  const selectedHijri = toHijri(selected, adjust);

  /* الشهر المعروض: هجري أو ميلادي حسب النمط، مُشتق من اليوم المحدَّد. */
  const [hijriCursor, setHijriCursor] = useState({
    year: todayHijri.year,
    month: todayHijri.month,
  });
  const [gregCursor, setGregCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const cells = useMemo(() => {
    void rev; // تأكيد دخول شهر يغيّر الشبكة (مواسم منار ٤.١)
    return mode === "hijri"
      ? hijriMonthGrid(hijriCursor.year, hijriCursor.month, adjust)
      : gregorianMonthGrid(gregCursor.year, gregCursor.month, adjust);
  }, [mode, hijriCursor, gregCursor, adjust, rev]);

  const step = (delta: number) => {
    if (mode === "hijri")
      setHijriCursor(addHijriMonths(hijriCursor.year, hijriCursor.month, delta));
    else {
      const total = gregCursor.year * 12 + gregCursor.month + delta;
      setGregCursor({ year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 });
    }
  };

  const goToday = () => {
    setSelected(today);
    setHijriCursor({ year: todayHijri.year, month: todayHijri.month });
    setGregCursor({ year: today.getFullYear(), month: today.getMonth() });
  };

  const primaryTitle =
    mode === "hijri"
      ? `${hijriMonthName(hijriCursor.month)} ${toArabicDigits(hijriCursor.year)}`
      : `${GREGORIAN_MONTHS[gregCursor.month]} ${toArabicDigits(gregCursor.year)}`;

  const secondaryTitle =
    mode === "hijri"
      ? gregorianSpanLabel(cells)
      : (() => {
          const inMonth = cells.filter((c) => c.inMonth);
          if (!inMonth.length) return "";
          const a = inMonth[0].hijri;
          const b = inMonth[inMonth.length - 1].hijri;
          return a.month === b.month
            ? formatHijri(a, false)
            : `${hijriMonthName(a.month)} – ${hijriMonthName(b.month)} ${toArabicDigits(b.year)}`;
        })();

  const selectedCell = cells.find((c) => isSameDay(c.date, selected));
  const upcoming = useMemo(() => {
    void rev;
    return upcomingOccasions(today, adjust, 6);
  }, [today, adjust, rev]);

  const selectedTimes = useMemo(
    () => computePrayerTimes(location, calc, selected),
    [location, calc, selected],
  );

  const todayTimes = useMemo(
    () => computePrayerTimes(location, calc, today),
    [location, calc, today],
  );
  /* معاينة الإزاحة تتبع «اليوم الهجري عند المغرب» كما تعرضه الرئيسية الآن. */
  const nowHijri = toHijri(hijriDisplayDate(new Date(), todayTimes.maghrib, atMaghrib), adjust);

  return (
    <Screen>
      <ScreenHeader
        title="التقويم"
        subtitle="هجري · ميلادي · مناسبات"
        backTo="/more"
        action={
          <button
            onClick={() => setShowAdjust(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft"
            aria-label="تعديل التاريخ الهجري"
          >
            <Icon d={icons.settings} size={18} />
          </button>
        }
      />
      <LocationDefaultBanner what="مواقيت اليوم" />

      {/* بطاقة اليوم */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-12 -top-10 h-56 w-56 text-white/15" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">اليوم</div>
              <div className="mt-1 font-display text-5xl font-black tabular-nums leading-none">
                {toArabicDigits(todayHijri.day)}
              </div>
              <div className="mt-1 font-display text-base font-light text-white/90">
                {hijriMonthName(todayHijri.month)} {toArabicDigits(todayHijri.year)}
              </div>
              <div className="text-[11px] text-white/60">
                {new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(today)} ·{" "}
                {toArabicDigits(today.getDate())} {GREGORIAN_MONTHS[today.getMonth()]}{" "}
                {toArabicDigits(today.getFullYear())}
              </div>
            </div>
            <div className="shrink-0 text-right text-[11px] text-white/70">
              <div>
                الفجر · {formatHHMM(todayTimes.fajr)} {ampmAr(todayTimes.fajr)}
              </div>
              <div>
                المغرب · {formatHHMM(todayTimes.maghrib)} {ampmAr(todayTimes.maghrib)}
              </div>
              <TodayFastingChip adjust={adjust} today={today} />
            </div>
          </div>
        </div>
      </div>

      {/* مبدّل النمط */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1 shadow-soft">
          {(
            [
              { k: "hijri" as Mode, l: "شهر هجري" },
              { k: "gregorian" as Mode, l: "شهر ميلادي" },
            ] satisfies { k: Mode; l: string }[]
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setMode(t.k)}
              className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
                mode === t.k
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* شبكة التقويم */}
      <div className="px-4 pt-3">
        <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <button
              onClick={() => step(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-secondary"
              aria-label="الشهر السابق"
            >
              <Icon d={icons.chevron} size={14} />
            </button>
            <button onClick={goToday} className="text-center">
              <div className="font-display text-base font-medium">{primaryTitle}</div>
              <div className="text-[10px] text-muted-foreground">{secondaryTitle}</div>
            </button>
            <button
              onClick={() => step(1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-secondary"
              aria-label="الشهر التالي"
            >
              <span className="rotate-180">
                <Icon d={icons.chevron} size={14} />
              </span>
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell) => (
              <DayCell
                key={cell.date.toISOString()}
                cell={cell}
                mode={mode}
                isToday={isSameDay(cell.date, today)}
                isSelected={isSameDay(cell.date, selected)}
                onSelect={() => setSelected(cell.date)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-border pt-4 text-[10px] text-muted-foreground">
            <Legend dot={OCCASION_TONE.event.dot} label="مناسبة" />
            <Legend dot={OCCASION_TONE.blessed.dot} label="وقت فاضل" />
            <Legend dot={OCCASION_TONE.eid.dot} label="عيد" />
            <Legend dot={OCCASION_TONE.fast.dot} label="صيام مسنون" />
          </div>
        </div>
      </div>

      {/* تفاصيل اليوم المحدَّد */}
      <SectionLabel>تفاصيل اليوم المحدَّد</SectionLabel>
      <div className="px-4">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg font-medium">
                {toArabicDigits(selectedHijri.day)} {hijriMonthName(selectedHijri.month)}{" "}
                {toArabicDigits(selectedHijri.year)}هـ
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(selected)} ·{" "}
                {toArabicDigits(selected.getDate())} {GREGORIAN_MONTHS[selected.getMonth()]}{" "}
                {toArabicDigits(selected.getFullYear())}م
              </div>
            </div>
            {selectedCell && selectedCell.fasting.status !== "none" && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                  FASTING_TONE[selectedCell.fasting.status].className
                }`}
              >
                {selectedCell.fasting.reason ?? FASTING_TONE[selectedCell.fasting.status].label}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniTime label="الفجر" date={selectedTimes.fajr} />
            <MiniTime label="الشروق" date={selectedTimes.sunrise} />
            <MiniTime label="المغرب" date={selectedTimes.maghrib} />
            <MiniTime label="العشاء" date={selectedTimes.isha} />
          </div>

          {!!selectedCell?.occasions.length && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {selectedCell.occasions.map((o) => (
                <div key={o.id} className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${OCCASION_TONE[o.kind].dot}`} />
                  <div className="flex-1">
                    <div className="text-xs font-medium">{o.title}</div>
                    {o.note && <div className="text-[10px] text-muted-foreground">{o.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* المناسبات القادمة */}
      <SectionLabel hint={`${toArabicDigits(upcoming.length)} قادمة`}>
        المناسبات القادمة
      </SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {upcoming.map((e) => (
          <button
            key={`${e.id}-${e.hijri.year}`}
            onClick={() => {
              setSelected(e.date);
              const h = e.hijri;
              setHijriCursor({ year: h.year, month: h.month });
              setGregCursor({ year: e.date.getFullYear(), month: e.date.getMonth() });
            }}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-right shadow-soft transition hover:shadow-elegant"
          >
            <div
              className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${OCCASION_TONE[e.kind].chip} text-white shadow-soft`}
            >
              <span className="font-display text-xl font-black leading-none">
                {toArabicDigits(e.day)}
              </span>
              <span className="mt-1 text-[9px] opacity-80">{hijriMonthName(e.month)}</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{e.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Icon d={icons.calendar} size={11} /> {toArabicDigits(e.date.getDate())}{" "}
                  {GREGORIAN_MONTHS[e.date.getMonth()]} {toArabicDigits(e.date.getFullYear())}
                </span>
                <span>·</span>
                <span>
                  {e.daysAway === 0
                    ? "اليوم"
                    : e.daysAway === 1
                      ? "غداً"
                      : `بعد ${toArabicDigits(e.daysAway)} يوماً`}
                </span>
              </div>
            </div>
            <span className="rotate-180 text-muted-foreground">
              <Icon d={icons.chevron} size={14} />
            </span>
          </button>
        ))}
      </div>

      {/* ورقة تعديل التاريخ الهجري */}
      {showAdjust && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 backdrop-blur-sm"
          onClick={() => setShowAdjust(false)}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-md rounded-t-[32px] border-t border-border bg-card p-6 shadow-elegant animate-fade-up"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
            <h2 className="font-display text-lg font-medium">تعديل التاريخ الهجري</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              بداية الشهر الهجري تُبنى على رؤية الهلال، فتختلف الدول يوماً أو يومين. اضبط الإزاحة
              لتطابق التقويم المعتمد في بلدك.
            </p>

            <div className="mt-5 grid grid-cols-5 gap-2">
              {[-2, -1, 0, 1, 2].map((v) => (
                <button
                  key={v}
                  onClick={() => setAdjust(v)}
                  className={`rounded-2xl border py-3 text-center shadow-soft transition ${
                    adjust === v
                      ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                      : "border-border bg-card"
                  }`}
                >
                  <div dir="ltr" className="font-display text-lg tabular-nums">
                    {v === 0 ? "٠" : `${v > 0 ? "+" : "−"}${toArabicDigits(Math.abs(v))}`}
                  </div>
                  <div className="text-[9px] leading-tight opacity-80">{ADJUST_LABELS[v]}</div>
                </button>
              ))}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={atMaghrib}
              onClick={() => setAtMaghrib(!atMaghrib)}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-soft"
            >
              <div className="flex-1">
                <div className="text-sm font-medium">اليوم الهجري يبدأ عند المغرب</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  بعد غروب الشمس تعرض الرئيسية والمواقيت والويدجت تاريخ الغد الهجري. التقويم الشهري
                  يبقى بالأيام المدنية.
                </div>
              </div>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  atMaghrib ? "gradient-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    atMaghrib ? "right-0.5" : "right-[22px]"
                  }`}
                />
              </span>
            </button>

            <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4 text-center">
              <div className="text-[10px] text-muted-foreground">
                التاريخ الهجري لليوم بعد التعديل
              </div>
              <div className="mt-1 font-display text-xl font-medium">
                {toArabicDigits(nowHijri.day)} {hijriMonthName(nowHijri.month)}{" "}
                {toArabicDigits(nowHijri.year)}هـ
              </div>
            </div>

            <button
              onClick={() => setShowAdjust(false)}
              className="gradient-primary mt-5 w-full rounded-2xl py-3.5 text-sm font-medium text-primary-foreground shadow-glow"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}

function TodayFastingChip({ adjust, today }: { adjust: number; today: Date }) {
  const hijri = toHijri(today, adjust);
  const cells = hijriMonthGrid(hijri.year, hijri.month, adjust);
  const cell = cells.find((c) => isSameDay(c.date, today));
  if (!cell || cell.fasting.status === "none") return null;
  return (
    <div className="mt-2 inline-flex rounded-full bg-gold/90 px-2.5 py-0.5 text-[10px] text-navy">
      {cell.fasting.reason ?? FASTING_TONE[cell.fasting.status].label}
    </div>
  );
}

function DayCell({
  cell,
  mode,
  isToday,
  isSelected,
  onSelect,
}: {
  cell: CalendarCell;
  mode: Mode;
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const primary = mode === "hijri" ? cell.hijri.day : cell.date.getDate();
  const secondary = mode === "hijri" ? cell.date.getDate() : cell.hijri.day;
  const marker = cell.occasions[0];

  const base = "aspect-square rounded-xl transition relative";
  const tone = isSelected
    ? "gradient-primary text-primary-foreground shadow-glow"
    : isToday
      ? "border border-primary/60 bg-primary/10 text-foreground"
      : cell.inMonth
        ? "hover:bg-secondary text-foreground"
        : "text-muted-foreground/40";

  return (
    <button onClick={onSelect} className={`${base} ${tone}`}>
      <div className="flex h-full flex-col items-center justify-center leading-none">
        <span className="text-xs font-medium tabular-nums">{toArabicDigits(primary)}</span>
        <span className="mt-0.5 text-[8px] tabular-nums opacity-60">
          {toArabicDigits(secondary)}
        </span>
        {marker && (
          <span
            className={`absolute bottom-1 h-1 w-1 rounded-full ${
              isSelected ? "bg-white" : OCCASION_TONE[marker.kind].dot
            }`}
          />
        )}
      </div>
    </button>
  );
}

function MiniTime({ label, date }: { label: string; date: Date }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-display text-sm font-medium tabular-nums">
        {formatHHMM(date)}{" "}
        <span className="text-[9px] font-normal text-muted-foreground">{ampmAr(date)}</span>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}
