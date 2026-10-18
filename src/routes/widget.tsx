import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { toast } from "@/lib/toast";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { useLocation, useNow, useSettings, type PrayerKey } from "@/lib/prayer";
import { useHijriAdjust } from "@/lib/hijri";
import { localDayNumber } from "@/lib/daily-content";
import { toArabicDigits } from "@/lib/format";
import { buildWidgetSnapshot, type WidgetSnapshot, type WidgetVerse } from "@/lib/widget-snapshot";
import { getAdhanSettings } from "@/lib/adhan-settings";
import { iqamahTimeFor } from "@/lib/prayer-schedule";
import {
  COUNTDOWN_LABELS,
  effectiveWidgetOptions,
  pruneInstanceConfigs,
  requestWidgetRefresh,
  useInstanceConfig,
  useWidgetOptions,
  WIDGET_THEME_LABELS,
  type CountdownMode,
  type WidgetOptions,
  type WidgetOverrides,
  type WidgetTheme,
} from "@/lib/widget-settings";
import {
  getHomeWidgetStatus,
  isNativeShell,
  requestPinHomeWidget,
  type HomeWidgetStatus,
} from "@/lib/native-notifications";
import { kindInfo, WIDGET_KINDS, type WidgetKind } from "@/lib/widgets/kinds";
import { widgetMetaLine, widgetProgress, widgetState } from "@/lib/widgets/state";
import { afterPhrase } from "@/lib/widgets/words";
import { widgetVerseFor } from "@/lib/widgets/verse";

interface Search {
  id?: number;
}

export const Route = createFileRoute("/widget")({
  /* المحتوى كله أوقات وتواريخ بتوقيت الجهاز، والخادم لا يعرف منطقة المستخدم
   * الزمنية، فرسمه على الخادم يعطي نصاً مختلفاً ويكسر الـHydration. */
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => {
    const n = Number(s.id);
    return Number.isInteger(n) && n > 0 ? { id: n } : {};
  },
  head: () => ({ meta: [{ title: "ويدجتات الشاشة الرئيسية — منار" }] }),
  component: WidgetScreen,
});

const STEPS = [
  "اضغط مطوّلاً على مساحة فارغة في الشاشة الرئيسية لجوالك.",
  "اختر «الأدوات» أو «Widgets» من القائمة التي تظهر.",
  "ابحث عن «منار» واختر الويدجت الذي تريده.",
  "اسحبه وضعه في مكانه، ثم اسحب حوافه لتكبيره أو تصغيره — يتكيّف تخطيطه مع المقاس.",
  "لتخصيص نسخة بعينها: اضغط عليها مطوّلاً ← «إعدادات الأداة» (أندرويد ١٢+)، أو اخترها من القائمة هنا.",
];

type ToggleKey = "hijri" | "city" | "season" | "verse" | "times" | "shortcuts";

const TOGGLES: { key: ToggleKey; label: string; sub: string; icon: string }[] = [
  {
    key: "hijri",
    label: "التاريخ الهجري",
    sub: "أعلى الويدجت، بحسب إزاحة التقويم في الإعدادات",
    icon: icons.calendar,
  },
  { key: "city", label: "اسم المدينة", sub: "بجانب التاريخ", icon: icons.location },
  {
    key: "season",
    label: "الموسم",
    sub: "«اليوم ١٢ من رمضان · الإفطار» بدل التاريخ في أيام المواسم",
    icon: icons.sparkle,
  },
  {
    key: "verse",
    label: "آية اليوم",
    sub: "بخط المصحف، كاملة بلا قصّ، وتتجدّد كل يوم بلا إنترنت",
    icon: icons.quran,
  },
  {
    key: "times",
    label: "مواقيت اليوم",
    sub: "صف الصلوات الخمس حين تتسع المساحة",
    icon: icons.clock,
  },
  {
    key: "shortcuts",
    label: "الاختصارات",
    sub: "المصحف والأذكار والقبلة والتسبيح في المقاس الكبير",
    icon: icons.widget,
  },
];

const THEMES = Object.keys(WIDGET_THEME_LABELS) as WidgetTheme[];
const COUNTDOWNS = Object.keys(COUNTDOWN_LABELS) as CountdownMode[];

/* ───────────── ألوان مطابقة لـ WidgetTheme.java ───────────── */

interface Palette {
  bg: string;
  fg: string;
  fg2: string;
  accent: string;
  track: string;
  soft: string;
  border?: string;
}

const NIGHT: Palette = {
  bg: "linear-gradient(135deg,#1C2C47,#0B1A24)",
  fg: "#FFFFFF",
  fg2: "rgba(255,255,255,.7)",
  accent: "#E3C35A",
  track: "rgba(255,255,255,.2)",
  soft: "rgba(255,255,255,.1)",
};
const SAND: Palette = {
  bg: "linear-gradient(135deg,#FDF9F1,#EFE3CC)",
  fg: "#1C2A3B",
  fg2: "rgba(28,42,59,.65)",
  accent: "#94661A",
  track: "rgba(28,42,59,.15)",
  soft: "rgba(28,42,59,.08)",
  border: "rgba(148,102,26,.12)",
};
const PALETTES: Record<Exclude<WidgetTheme, "auto">, Palette> = {
  night: NIGHT,
  emerald: { ...NIGHT, bg: "linear-gradient(135deg,#11866A,#0A2E26)" },
  sand: SAND,
  /* ألوان النظام لا تُعرف من الويب: تقريب محايد. */
  dynamic: { ...NIGHT, bg: "linear-gradient(135deg,#2B3440,#1A2028)", accent: "#A8C7FA" },
  clear: {
    ...NIGHT,
    bg: "transparent",
    fg2: "rgba(255,255,255,.85)",
    track: "rgba(255,255,255,.25)",
  },
  clearDark: { ...SAND, bg: "transparent", fg2: "rgba(28,42,59,.8)", border: undefined },
};

function paletteFor(theme: WidgetTheme, dark: boolean): Palette {
  return PALETTES[theme === "auto" ? (dark ? "night" : "sand") : theme];
}

function isDarkApp(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/* ───────────── الصفحة ───────────── */

function WidgetScreen() {
  const native = isNativeShell();
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/widget" });
  const general = useWidgetOptions();
  const instance = useInstanceConfig(id ?? null);
  const [status, setStatus] = useState<HomeWidgetStatus | null>(null);
  const [checking, setChecking] = useState(native);

  const refreshStatus = useCallback(async () => {
    if (!native) return;
    const s = await getHomeWidgetStatus();
    setStatus(s);
    setChecking(false);
    if (s?.instances) pruneInstanceConfigs(s.instances.map((i) => i.id));
  }, [native]);

  // بعد إضافة الويدجت من المُشغّل يعود المستخدم إلى التطبيق: نعيد الفحص.
  useEffect(() => {
    void refreshStatus();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    const t = window.setInterval(() => void refreshStatus(), 5000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(t);
    };
  }, [refreshStatus]);

  const instances = status?.instances ?? [];
  const placed = (status?.placed ?? 0) > 0;
  const selected = id != null ? instances.find((i) => i.id === id) : undefined;
  const editingInstance = id != null && (selected != null || checking || !native);
  const effective = editingInstance
    ? effectiveWidgetOptions(general.options, instance.overrides)
    : general.options;

  const update = (patch: WidgetOverrides) =>
    editingInstance ? instance.update(patch) : general.update(patch);

  const addToHome = async (kind: WidgetKind) => {
    const ok = await requestPinHomeWidget(kind);
    if (ok) toast.success("اختر «إضافة» في النافذة التي ظهرت لتثبيت الويدجت");
    else toast.message("المُشغّل لا يدعم الإضافة المباشرة — اتبع الخطوات أدناه");
  };

  const refreshNow = () => {
    requestWidgetRefresh();
    toast.success("ستتحدّث الويدجتات خلال ثوانٍ");
  };

  const ordinal = (wid: number) => {
    const same = instances.filter((i) => i.kind === selected?.kind || i.id === wid);
    const n = same.findIndex((i) => i.id === wid) + 1;
    return n > 0 ? toArabicDigits(n) : "";
  };

  return (
    <Screen>
      <ScreenHeader
        title={editingInstance ? "إعدادات هذه النسخة" : "ويدجتات الشاشة الرئيسية"}
        subtitle={
          editingInstance
            ? `${kindInfo(selected?.kind ?? "hub")?.label ?? "الشامل"} — نسخة ${ordinal(id!)}. ما تغيّره هنا يخصّها وحدها.`
            : "الصلاة القادمة وآية اليوم على شاشة جوالك، بخط منار"
        }
        backTo="/more"
      />

      <PreviewPanel options={effective} />

      {editingInstance ? (
        <div className="mt-3 flex gap-2 px-5">
          <button
            onClick={() => void navigate({ search: {} })}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 text-xs font-medium"
          >
            <Icon d={icons.back} size={14} />
            كل الويدجتات
          </button>
          {Object.keys(instance.overrides).length > 0 && (
            <button
              onClick={() => {
                instance.reset();
                toast.success("صارت هذه النسخة تتبع الإعدادات العامة");
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 text-xs font-medium"
            >
              <Icon d={icons.undo} size={14} />
              اتّباع الإعدادات العامة
            </button>
          )}
        </div>
      ) : (
        <>
          <SectionLabel>الحالة</SectionLabel>
          <div className="px-5">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              {!native ? (
                <StatusLine
                  tone="muted"
                  title="متاح في تطبيق أندرويد"
                  sub="الويدجتات تعمل على الشاشة الرئيسية لجوالات أندرويد. ثبّت تطبيق منار ثم عد إلى هذه الصفحة."
                />
              ) : checking ? (
                <StatusLine tone="muted" title="جارٍ التحقّق…" sub="" />
              ) : placed ? (
                <StatusLine
                  tone="ok"
                  title={
                    status!.placed === 1
                      ? "ويدجت واحد على الشاشة الرئيسية"
                      : `${toArabicDigits(status!.placed)} ويدجتات على الشاشة الرئيسية`
                  }
                  sub="تتحدّث وحدها عند كل أذان ومنتصف الليل، وتبقى صحيحة ثلاثين يوماً والتطبيق مغلق."
                />
              ) : (
                <StatusLine
                  tone="warn"
                  title="لا ويدجت على الشاشة الرئيسية بعد"
                  sub="أضفه بلمسة واحدة من المعرض أدناه، أو اتبع الخطوات اليدوية."
                />
              )}
              {native && placed && (
                <button
                  onClick={refreshNow}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 text-xs font-medium"
                >
                  <Icon d={icons.refresh} size={14} />
                  تحديث الويدجتات الآن
                </button>
              )}
            </div>
          </div>

          {instances.length > 0 && (
            <>
              <SectionLabel hint="لكل نسخة إعداداتها">ويدجتاتك</SectionLabel>
              <div className="space-y-2 px-5">
                {instances.map((w, i) => (
                  <InstanceRow
                    key={w.id}
                    id={w.id}
                    label={`${kindInfo(w.kind)?.label ?? w.kind} — نسخة ${toArabicDigits(
                      instances.filter((x, j) => x.kind === w.kind && j <= i).length,
                    )}`}
                    onOpen={() => void navigate({ search: { id: w.id } })}
                  />
                ))}
              </div>
            </>
          )}

          <SectionLabel>المعرض</SectionLabel>
          <div className="space-y-2 px-5">
            {WIDGET_KINDS.map((k) => (
              <div
                key={k.kind}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon d={icons.widget} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {k.label}
                    <span className="ms-2 text-[10px] text-muted-foreground">
                      {toArabicDigits(k.cells[0])}×{toArabicDigits(k.cells[1])}
                    </span>
                  </span>
                  <span className="block text-[11px] leading-relaxed text-muted-foreground">
                    {k.sub}
                  </span>
                </span>
                {native && status?.pinSupported && (
                  <button
                    onClick={() => void addToHome(k.kind)}
                    aria-label={`إضافة ويدجت ${k.label}`}
                    className="gradient-primary flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-medium text-primary-foreground"
                  >
                    <Icon d={icons.plus} size={14} />
                    إضافة
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <SectionLabel hint={editingInstance ? undefined : "تنطبق على كل النسخ ما لم تُخصَّص"}>
        {editingInstance ? "ما يظهر في هذه النسخة" : "ما يظهر في الويدجت"}
      </SectionLabel>
      <div className="space-y-2 px-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Icon d={icons.timer} size={16} />
            العدّ للصلاة القادمة
          </div>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="العدّ للصلاة القادمة"
          >
            {COUNTDOWNS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={effective.countdown === c}
                onClick={() => update({ countdown: c })}
                className={`min-h-11 rounded-xl border px-2 text-[11px] font-medium transition ${
                  effective.countdown === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/30"
                }`}
              >
                {COUNTDOWN_LABELS[c]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {effective.countdown === "seconds"
              ? "عدّاد حيّ يتحرّك كل ثانية؛ أرقامه بخط النظام لأن أندرويد يرسمها بنفسه."
              : effective.countdown === "minutes"
                ? "«بعد ساعة و٢٠ دقيقة» بخط منار، يتحدّث كل دقيقة والشاشة مضاءة."
                : "يظهر الوقت فقط بلا عدّ."}
          </p>
        </div>
        {TOGGLES.map((t) => (
          <SwitchRow
            key={t.key}
            icon={t.icon}
            label={t.label}
            sub={t.sub}
            on={effective[t.key]}
            onChange={(v) => update({ [t.key]: v } as WidgetOverrides)}
          />
        ))}
      </div>

      <SectionLabel>المظهر</SectionLabel>
      <div className="grid grid-cols-2 gap-2 px-5" role="radiogroup" aria-label="لون الويدجت">
        {THEMES.map((t) => {
          const on = effective.theme === t;
          const pal = paletteFor(t, isDarkApp());
          return (
            <button
              key={t}
              role="radio"
              aria-checked={on}
              onClick={() => update({ theme: t })}
              className={`flex min-h-12 items-center gap-3 rounded-2xl border bg-card px-3 py-3 text-right shadow-soft transition ${
                on ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              <span
                className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl ring-1 ring-border"
                style={{
                  background:
                    pal.bg === "transparent"
                      ? "repeating-conic-gradient(#8885 0% 25%, transparent 0% 50%) 50%/10px 10px"
                      : pal.bg,
                }}
                aria-hidden
              >
                <span
                  className="absolute bottom-1 left-1 h-1.5 w-4 rounded-full"
                  style={{ background: pal.accent }}
                />
              </span>
              <span className="flex-1 text-sm font-medium">{WIDGET_THEME_LABELS[t]}</span>
              {on && (
                <span className="text-primary">
                  <Icon d={icons.check} size={16} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {effective.theme !== "clear" && effective.theme !== "clearDark" && (
        <div className="mt-2 px-5">
          <label className="block rounded-2xl border border-border bg-card p-4 shadow-soft">
            <span className="flex items-center justify-between text-sm font-medium">
              شفافية الخلفية
              <span className="text-xs text-muted-foreground">
                {toArabicDigits(100 - effective.opacity)}٪
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={100 - effective.opacity}
              onChange={(e) => update({ opacity: 100 - Number(e.target.value) })}
              className="mt-3 w-full accent-[var(--primary)]"
              aria-label="شفافية الخلفية"
            />
          </label>
        </div>
      )}

      {!editingInstance && (
        <>
          <SectionLabel>الإضافة يدوياً</SectionLabel>
          <div className="px-5">
            <ol className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              {STEPS.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-primary">
                    {toArabicDigits(i + 1)}
                  </span>
                  <span className="text-xs leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <SectionLabel>إن لم يتحدّث الويدجت</SectionLabel>
          <div className="px-5">
            <ul className="space-y-2 rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-soft">
              <li>
                • افتح منار مرة بعد تغيير الموقع أو طريقة الحساب ليستلم الويدجت المواقيت الجديدة.
              </li>
              <li>
                • اسمح لمنار بالعمل في الخلفية من إعدادات البطارية، خصوصاً على أجهزة شاومي وهواوي
                وأوبو.
              </li>
              <li>
                • إذا ظهر «افتح منار لتجديد المواقيت»، افتح التطبيق أو اضغط «تحديث الويدجتات الآن».
              </li>
              <li>
                • الويدجت لا يحتاج إنترنت: المواقيت وآية اليوم محسوبة على جوالك، وخطّه خطّ منار.
              </li>
            </ul>
            <button
              onClick={general.reset}
              className="mt-3 min-h-11 w-full rounded-xl border border-border bg-secondary/40 text-xs"
            >
              استعادة الإعدادات الافتراضية للويدجت
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}

function InstanceRow({ id, label, onOpen }: { id: number; label: string; onOpen: () => void }) {
  const { overrides } = useInstanceConfig(id);
  const custom = Object.keys(overrides).length > 0;
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-right shadow-soft"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icons.widget} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[10px] text-muted-foreground">
          {custom ? "إعدادات خاصة" : "تتبع الإعدادات العامة"}
        </span>
      </span>
      <span className="text-muted-foreground rtl:rotate-180">
        <Icon d={icons.chevron} size={16} />
      </span>
    </button>
  );
}

/* ───────────── المعاينة (مطابقة لـ WidgetRender.hub) ───────────── */

type PreviewSize = "small" | "medium" | "large";
const SIZES: Record<PreviewSize, { label: string; w: number; h: number }> = {
  small: { label: "٤×١", w: 320, h: 70 },
  medium: { label: "٤×٢", w: 320, h: 170 },
  large: { label: "٤×٤", w: 320, h: 380 },
};

function usePreviewSnapshot(options: WidgetOptions): WidgetSnapshot | null {
  const { location } = useLocation();
  const { settings } = useSettings();
  const { adjust, atMaghrib } = useHijriAdjust();
  const day = localDayNumber(new Date());
  const [verse, setVerse] = useState<WidgetVerse | null>(null);
  useEffect(() => {
    let alive = true;
    void widgetVerseFor(new Date()).then((v) => alive && setVerse(v));
    return () => {
      alive = false;
    };
  }, [day]);
  return useMemo(() => {
    try {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const adhan = getAdhanSettings();
      const key = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return buildWidgetSnapshot({
        location,
        settings,
        from,
        days: 3,
        hijriAdjust: adjust,
        hijriAtMaghrib: atMaghrib,
        verses: verse ? { [key(new Date())]: verse } : {},
        options,
        iqama: (p: PrayerKey, at: Date) => {
          const per = adhan.perPrayer[p] ?? { adhan: true, reminder: true, iqama: true };
          return per.iqama ? iqamahTimeFor(adhan, p, at) : null;
        },
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, settings, adjust, atMaghrib, verse, options, day]);
}

function PreviewPanel({ options }: { options: WidgetOptions }) {
  const [size, setSize] = useState<PreviewSize>("medium");
  const snap = usePreviewSnapshot(options);
  return (
    <div className="px-5">
      <div
        className="rounded-3xl p-4"
        style={{
          background: "linear-gradient(160deg,#5E7A93,#3B5168 60%,#2A3A4C)",
        }}
      >
        {snap ? (
          <HubPreview snap={snap} options={options} {...SIZES[size]} />
        ) : (
          <div className="h-[170px]" />
        )}
      </div>
      <div className="mt-2 flex justify-center gap-2" role="tablist" aria-label="مقاس المعاينة">
        {(Object.keys(SIZES) as PreviewSize[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={size === s}
            onClick={() => setSize(s)}
            className={`min-h-9 rounded-full border px-4 text-[11px] font-medium ${
              size === s ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            {SIZES[s].label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        معاينة حيّة بنفس منطق الويدجت — تتغيّر فوراً مع اختياراتك
      </p>
    </div>
  );
}

const SHORTCUTS = [
  { label: "المصحف", icon: icons.quran },
  { label: "الأذكار", icon: icons.moon },
  { label: "القبلة", icon: icons.qibla },
  { label: "التسبيح", icon: icons.sparkle },
];

function HubPreview({
  snap,
  options,
  w,
  h,
}: {
  snap: WidgetSnapshot;
  options: WidgetOptions;
  w: number;
  h: number;
}) {
  const now = useNow(options.countdown === "seconds" ? 1000 : 15_000).getTime();
  const st = widgetState(snap, now);
  const pal = paletteFor(options.theme, isDarkApp());
  const fw = Math.max(60, w - 28);
  const fh = Math.max(30, h - 24);
  const box: CSSProperties = {
    width: "100%",
    maxWidth: w,
    height: h,
    padding: "12px 14px",
    borderRadius: 22,
    color: pal.fg,
    position: "relative",
    overflow: "hidden",
    marginInline: "auto",
    border: pal.border ? `1px solid ${pal.border}` : undefined,
  };
  const bg: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: pal.bg,
    opacity: pal.bg === "transparent" ? 1 : options.opacity / 100,
  };
  if (!st) {
    return (
      <div
        style={box}
        className="flex items-center justify-center font-sans"
        aria-label="معاينة الويدجت"
      >
        <div style={bg} />
        <span className="relative text-sm" style={{ color: pal.fg2 }}>
          افتح منار لتحديث المواقيت
        </span>
      </div>
    );
  }
  const p = st.prayer;
  const remaining = st.target - now;
  const countdown =
    options.countdown === "off"
      ? null
      : st.phase === "iqama"
        ? `الإقامة بعد ${afterPhrase(remaining).slice(4)}`
        : st.phase === "now"
          ? null
          : options.countdown === "seconds"
            ? clock(remaining)
            : afterPhrase(remaining);
  const label = st.phase === "next" ? "الصلاة القادمة" : "حان الآن";

  if (fh < 76) {
    return (
      <div style={box} className="font-sans" aria-label="معاينة الويدجت">
        <div style={bg} />
        <div className="relative flex h-full items-center">
          <div className="flex-1">
            <div className="font-bold leading-tight" style={{ fontSize: 19 }}>
              {p.name}
            </div>
            <div style={{ fontSize: 13, color: pal.fg2 }} className="font-medium">
              {p.time}
            </div>
          </div>
          <div className="text-left" style={{ fontSize: 12, color: pal.accent }}>
            {st.phase !== "next" && <div className="font-medium">حان الآن</div>}
            {countdown}
          </div>
        </div>
      </div>
    );
  }

  const meta = widgetMetaLine(st, options, snap.city);
  const used = (meta ? 22 : 0) + 56 + 9;
  const shortcuts = options.shortcuts && fh - used >= 150;
  const room = fh - used - (shortcuts ? 66 : 0);
  const wantTimes = options.times && fw >= 200;
  const verse = st.today.verse;
  const showVerse = options.verse && !!verse && room >= (wantTimes ? 70 : 40);
  const showTimes = wantTimes && room >= 48 && (!showVerse || room >= 120);
  const wide = fw >= 230;

  return (
    <div style={box} className="font-sans" aria-label="معاينة الويدجت">
      <div style={bg} />
      <div className="relative flex h-full flex-col">
        {meta && (
          <div className="truncate" style={{ fontSize: 11.5, color: pal.accent, height: 20 }}>
            {meta}
          </div>
        )}
        <div className="flex items-end">
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 10.5, color: pal.fg2 }}>{label}</div>
            <div className="truncate font-bold leading-tight" style={{ fontSize: wide ? 25 : 22 }}>
              {p.name}
            </div>
          </div>
          <div className="shrink-0 text-left">
            <div className="font-medium" style={{ fontSize: wide ? 17 : 15 }}>
              {p.time}
            </div>
            {countdown && (
              <div
                style={{ fontSize: 11.5, color: pal.accent }}
                className={
                  options.countdown === "seconds" && st.phase === "next" ? "tabular-nums" : ""
                }
                dir={options.countdown === "seconds" && st.phase === "next" ? "ltr" : undefined}
              >
                {countdown}
              </div>
            )}
          </div>
        </div>
        <div
          className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: pal.track }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${widgetProgress(st, now) * 100}%`,
              background: pal.accent,
              marginInlineStart: 0,
            }}
          />
        </div>
        {showVerse ? (
          <div className="mt-2 flex flex-1 flex-col items-center justify-center overflow-hidden text-center">
            <p
              className="font-quran"
              style={{ fontSize: 15, lineHeight: 1.95, fontFamily: "var(--font-quran)" }}
            >
              {verse!.text}
            </p>
            <div style={{ fontSize: 10, color: pal.fg2 }}>{verse!.ref}</div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {showTimes && (
          <div className="mt-1 flex gap-1">
            {st.today.prayers
              .filter((q) => q.key !== "sunrise")
              .map((q) => {
                const on = q.at === p.at;
                return (
                  <div
                    key={q.key}
                    className="flex-1 rounded-xl py-1 text-center"
                    style={{ background: on ? pal.soft : undefined }}
                  >
                    <div style={{ fontSize: 10, color: on ? pal.accent : pal.fg2 }}>{q.name}</div>
                    <div className="font-medium" style={{ fontSize: 11.5 }}>
                      {q.time}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {shortcuts && (
          <div className="mt-2 flex gap-1">
            {SHORTCUTS.map((s) => (
              <div
                key={s.label}
                className="flex flex-1 flex-col items-center rounded-xl py-1.5"
                style={{ background: pal.soft }}
              >
                <span style={{ color: pal.accent }}>
                  <Icon d={s.icon} size={16} />
                </span>
                <span className="font-medium" style={{ fontSize: 10.5 }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function clock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/* ───────────── عناصر ───────────── */

function StatusLine({
  tone,
  title,
  sub,
}: {
  tone: "ok" | "warn" | "muted";
  title: string;
  sub: string;
}) {
  const dot = tone === "ok" ? "bg-primary" : tone === "warn" ? "bg-gold" : "bg-muted-foreground";
  return (
    <div className="flex items-start gap-3" role="status">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {sub && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{sub}</div>
        )}
      </div>
    </div>
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
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[10px] text-muted-foreground">{sub}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "gradient-primary" : "bg-muted"}`}
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
