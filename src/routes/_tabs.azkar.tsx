import { createFileRoute, Link } from "@tanstack/react-router";
import { useAzkarBook } from "@/hooks/use-azkar";
import { useAzkarProgress } from "@/lib/azkar/progress";
import {
  Arabesque,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
  Skeleton,
} from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/_tabs/azkar")({
  head: () => ({
    meta: [
      { title: "الأذكار — منار" },
      {
        name: "description",
        content: "أذكار حصن المسلم كاملة بأقسامها مع عدّاد لكل ذكر وبحث ذكي.",
      },
      { property: "og:title", content: "الأذكار — منار" },
      {
        property: "og:description",
        content: "حصن المسلم كاملًا: ١٣٢ بابًا و٢٦٧ ذكرًا مع عدّاد وبحث ذكي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AzkarHub,
});

const GROUP_ICON: Record<string, keyof typeof icons> = {
  wake: "sunrise",
  home: "home",
  prayer: "prayer",
  daily: "sun",
  sleep: "bed",
  distress: "heart",
  family: "profile",
  funeral: "moon",
  nature: "globe",
  food: "flame",
  manners: "sparkle",
  travel: "plane",
  greeting: "mail",
  hajj: "qibla",
  misc: "star",
};

const ACCENTS = ["primary", "gold", "night"] as const;

function AzkarHub() {
  const { book, loading } = useAzkarBook();
  const { progress } = useAzkarProgress();
  const total = book ? book.chapters.reduce((n, c) => n + c.azkar.length, 0) : 0;

  return (
    <Screen>
      <ScreenHeader
        title="الأذكار"
        subtitle={
          book
            ? `${toArabicDigits(book.chapters.length)} بابًا · ${toArabicDigits(total)} ذكرًا`
            : "حصن المسلم"
        }
      />

      {/* Hero */}
      <div className="px-5 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="pointer-events-none absolute -left-14 -bottom-14 h-64 w-64 text-gold/25" />
          <Arabesque className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 text-white/10" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex items-center justify-between">
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] backdrop-blur">
              حصن المسلم
            </div>
            <span className="text-[10px] text-white/60">د. سعيد بن وهف القحطاني</span>
          </div>
          <div className="relative mt-6">
            <div className="font-display text-3xl font-medium leading-snug">اذكر الله… يذكرك.</div>
            <p className="mt-2 max-w-[16rem] text-xs font-light leading-relaxed text-white/70">
              أذكار وأدعية من الكتاب والسنة، مع عدّاد لكل ذكر وحفظ تلقائي لتقدّمك.
            </p>
          </div>
          <div className="relative mt-6 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="gradient-gold h-full"
                style={{
                  width: `${Math.min(100, (progress.completed.length / (total || 1)) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-white/70">
              {toArabicDigits(progress.completed.length)} ذكر اليوم
            </span>
          </div>
        </div>
      </div>

      {/* قسم الوِرد — مستقل عن الأذكار */}
      <div className="mt-5 px-5">
        <Link
          to="/wird"
          className="glass flex items-center gap-3 rounded-2xl border border-border/60 p-4 text-right transition hover:-translate-y-0.5 hover:shadow-elegant"
        >
          <span className="gradient-primary flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
            <Icon d={icons.sparkle} size={20} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">الوِرد</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              ورد الصباح والمساء — قسم مستقل بعدّاد وتقدّم خاص.
            </p>
          </div>
          <Icon d={icons.back} size={16} />
        </Link>
      </div>

      {/* Smart search entry */}

      <div className="mt-5 px-5">
        <Link
          to="/azkar/search"
          className="glass flex items-center gap-3 rounded-2xl border border-border/60 p-4 text-right transition hover:-translate-y-0.5 hover:shadow-elegant"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon d={icons.search} size={18} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">البحث الذكي في الأذكار</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              ابحث بدون تشكيل أو همزات — يفهم صيغ الكلمة تلقائيًا.
            </p>
          </div>
          <Icon d={icons.back} size={16} />
        </Link>
      </div>

      <SectionLabel hint={book ? `${toArabicDigits(book.groups.length)} أقسام` : undefined}>
        أقسام الأذكار
      </SectionLabel>

      <div className="grid grid-cols-2 gap-3 px-5 stagger">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        {book?.groups.map((g, idx) => {
          const chapters = book.chapters.filter((c) => c.group === g.id);
          const count = chapters.reduce((n, c) => n + c.azkar.length, 0);
          return (
            <AzkarCard
              key={g.id}
              to="/azkar/group/$group"
              params={{ group: g.id }}
              title={g.title}
              hint={`${toArabicDigits(chapters.length)} باب · ${toArabicDigits(count)} ذكر`}
              iconKey={GROUP_ICON[g.id] ?? "azkar"}
              accent={ACCENTS[idx % 3]}
            />
          );
        })}
      </div>

      <SectionLabel>ذكر اليوم</SectionLabel>
      <div className="px-5">
        <div className="glass relative overflow-hidden rounded-3xl p-5">
          <Arabesque className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 text-primary/10" />
          <p className="relative text-right font-display text-lg leading-loose">
            «سبحان الله وبحمده، سبحان الله العظيم»
          </p>
          <p className="relative mt-3 text-[11px] text-muted-foreground">
            كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن.
          </p>
          <div className="relative mt-4 text-[10px] text-muted-foreground">
            <span>صحيح البخاري · ٦٤٠٦</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function AzkarCard({
  to,
  params,
  title,
  hint,
  iconKey,
  accent,
}: {
  to: string;
  params: Record<string, string>;
  title: string;
  hint: string;
  iconKey: keyof typeof icons;
  accent: (typeof ACCENTS)[number];
}) {
  const accentClasses: Record<(typeof ACCENTS)[number], string> = {
    primary: "from-primary/15 to-primary/0",
    gold: "from-gold/20 to-gold/0",
    night: "from-foreground/10 to-foreground/0",
  };
  return (
    <Link
      to={to}
      params={params}
      className="group relative flex h-40 flex-col justify-between overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-4 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <Arabesque className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 text-primary/10 opacity-70" />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentClasses[accent]}`}
      />
      <div className="relative flex items-start justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/70 shadow-soft ${
            accent === "gold"
              ? "text-gold"
              : accent === "primary"
                ? "text-primary"
                : "text-foreground"
          }`}
        >
          <Icon d={icons[iconKey]} size={20} />
        </span>
        <Icon d={icons.back} size={16} />
      </div>
      <div className="relative">
        <div className="font-display text-base font-medium leading-tight">{title}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </Link>
  );
}
