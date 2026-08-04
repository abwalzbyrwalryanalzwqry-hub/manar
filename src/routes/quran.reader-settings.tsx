import { createFileRoute } from "@tanstack/react-router";
import { Arabesque, Icon, icons, Screen, ScreenHeader } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/quran";
import {
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  QURAN_FONT_OPTIONS,
  WIDTH_OPTIONS,
  useReadingPrefs,
} from "@/lib/quran/reading-prefs";

const SAMPLE = "وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ";

function ReaderSettingsScreen() {
  const { prefs, update, reset, style } = useReadingPrefs();

  return (
    <Screen>
      <ScreenHeader
        title="إعدادات القراءة"
        subtitle="الخط · الحجم · التنسيق"
        backTo="/quran/mushaf"
      />

      <div className="space-y-5 px-5 pb-6 stagger">
        {/* Live preview */}
        <section className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card/60 shadow-elegant backdrop-blur-2xl">
          <Arabesque className="pointer-events-none absolute -top-14 -left-14 h-52 w-52 text-primary/10" />
          <div className="relative px-5 py-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold">
                معاينة
              </span>
              <span className="text-[11px] text-muted-foreground">
                {toArabicDigits(style.fontSizePx)} نقطة
              </span>
            </div>
            <div className="mx-auto" style={{ maxWidth: style.maxWidth }}>
              <p
                className="text-justify text-foreground"
                lang="ar"
                style={{
                  fontFamily: style.fontFamily,
                  fontSize: `${style.fontSizePx}px`,
                  lineHeight: style.lineHeight,
                  textAlignLast: "center",
                }}
              >
                {SAMPLE}
                <span className="mx-1.5 inline-flex h-8 min-w-8 select-none items-center justify-center rounded-full border border-gold/50 bg-gold/15 px-1 align-middle text-[13px] font-medium leading-none tabular-nums text-gold">
                  {toArabicDigits(17)}
                </span>
              </p>
            </div>
          </div>
        </section>

        <OptionGroup
          title="حجم خط القرآن"
          icon={icons.sparkle}
          options={FONT_SIZE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          value={prefs.fontSize}
          onSelect={(k) => update({ fontSize: k as typeof prefs.fontSize })}
        />

        <OptionGroup
          title="تباعد الأسطر"
          icon={icons.info}
          options={LINE_HEIGHT_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          value={prefs.lineHeight}
          onSelect={(k) => update({ lineHeight: k as typeof prefs.lineHeight })}
        />

        <OptionGroup
          title="عرض منطقة القراءة"
          icon={icons.settings}
          options={WIDTH_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          value={prefs.width}
          onSelect={(k) => update({ width: k as typeof prefs.width })}
        />

        <OptionGroup
          title="نوع خط القرآن"
          icon={icons.book ?? icons.sparkle}
          options={QURAN_FONT_OPTIONS.map((o) => ({
            key: o.key,
            label: o.label,
            fontFamily: o.stack,
          }))}
          value={prefs.font}
          onSelect={(k) => update({ font: k as typeof prefs.font })}
        />

        <button
          onClick={reset}
          className="w-full rounded-2xl border border-border/60 bg-card/50 py-3.5 text-[13px] font-medium text-muted-foreground backdrop-blur-xl transition hover:text-foreground active:scale-[0.99]"
        >
          استعادة الإعدادات الافتراضية
        </button>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          تُحفظ إعداداتك تلقائيًا على هذا الجهاز وتُطبَّق فورًا على المصحف.
        </p>
      </div>
    </Screen>
  );
}

function OptionGroup({
  title,
  icon,
  options,
  value,
  onSelect,
}: {
  title: string;
  icon: string;
  options: { key: string; label: string; fontFamily?: string }[];
  value: string;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="rounded-[26px] border border-border/60 bg-card/60 p-5 shadow-soft backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon d={icon} size={16} />
        </span>
        <h2 className="font-display text-[15px] font-medium">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              onClick={() => onSelect(o.key)}
              aria-pressed={active}
              style={o.fontFamily ? { fontFamily: o.fontFamily } : undefined}
              className={`rounded-2xl border py-3 text-[13px] transition active:scale-[0.97] ${
                active
                  ? "border-primary/50 bg-primary/12 font-medium text-primary shadow-glow"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/quran/reader-settings")({
  head: () => ({
    meta: [
      { title: "إعدادات القراءة — منار" },
      {
        name: "description",
        content:
          "خصّص تجربة قراءة القرآن في منار: حجم الخط، تباعد الأسطر، عرض الصفحة، ونوع خط المصحف.",
      },
      { property: "og:title", content: "إعدادات القراءة — منار" },
      {
        property: "og:description",
        content: "تخصيص خط القرآن وتباعد الأسطر وعرض القراءة في تطبيق منار.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReaderSettingsScreen,
});
