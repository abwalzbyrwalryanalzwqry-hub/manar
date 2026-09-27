import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Arabesque,
  Icon,
  icons,
  Mark,
  prayerIcon,
  RingProgress,
  Screen,
  SectionLabel,
  StatusBar,
} from "@/components/manar/shell";
import { LocationSheet } from "@/components/manar/location-sheet";
import { SakinahCard } from "@/components/manar/sakinah-card";
import { SeasonCard } from "@/components/manar/season-card";
import { HadithSheet } from "@/components/manar/hadith-sheet";
import { formatSecondsAr, useDailyHadith, useDailyVerse, useLocalDay } from "@/lib/daily-content";
import { toggleBookmark, useBookmarks } from "@/lib/quran/bookmarks";
import { formatRangeAr } from "@/lib/quran/format";
import { PRAYER_LABELS, usePrayerSchedule } from "@/lib/prayer";
import { useHijriAdjust } from "@/lib/hijri";
import {
  ampmAr,
  formatCountdown,
  formatGregorianAr,
  formatHHMM,
  formatHijriAr,
  formatWeekdayAr,
} from "@/lib/format";

export const Route = createFileRoute("/_tabs/home")({
  /* الأوقات والأيام تُنسَّق بتوقيت الجهاز، والخادم لا يعرف منطقة المستخدم
   * الزمنية، فرسمها على الخادم يعطي نصاً مختلفاً ويكسر الـHydration. */
  ssr: false,
  head: () => ({ meta: [{ title: "الرئيسية — منار" }] }),
  component: Home,
});

function Home() {
  const { adjust: hijriAdjust } = useHijriAdjust();
  const [sheet, setSheet] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);
  const [hadithOpen, setHadithOpen] = useState(false);
  const navigate = useNavigate();
  const day = useLocalDay();
  const verse = useDailyVerse(day);
  const hadith = useDailyHadith(day);
  const { has: hasBookmark } = useBookmarks();
  const verseSaved = verse ? hasBookmark(verse.surah, verse.from) : false;
  const {
    now,
    location,
    setLocation,
    requestGps,
    locStatus,
    locError,
    next,
    remainingMs,
    progress,
  } = usePrayerSchedule();

  // Auto-prompt for location once on first launch
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem("manar.askedLocation");
    if (!flag && location.source === "default" && !askedOnce) {
      setAskedOnce(true);
      window.localStorage.setItem("manar.askedLocation", "1");
      setSheet(true);
    }
  }, [location.source, askedOnce]);

  const countdown = formatCountdown(remainingMs);
  const nextLabel = PRAYER_LABELS[next.key].ar;

  return (
    <Screen>
      <StatusBar />

      {/* HERO */}
      <div className="px-4 pt-3 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[36px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-10 -top-10 h-72 w-72 text-white/15 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />

          {/* Top row */}
          <div className="relative flex items-start justify-between">
            <button
              onClick={() => setSheet(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] text-white/90 backdrop-blur-md"
            >
              <Icon d={icons.location} size={12} />
              {location.city}
              {location.country && <span className="text-white/60">· {location.country}</span>}
            </button>
            <div className="flex gap-2">
              <IconBtn icon={icons.search} />
              <IconBtn icon={icons.bell} dot />
            </div>
          </div>

          {/* Greeting */}
          <div className="relative mt-5">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
              {formatWeekdayAr(now)}
            </div>
            <div className="font-display text-xl font-medium text-white/90">السلام عليكم</div>
          </div>

          {/* Time + ring */}
          <div className="relative mt-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                التوقيت الآن
              </div>
              <div
                className="font-display text-6xl font-black tabular-nums leading-none tracking-tight"
                suppressHydrationWarning
              >
                {formatHHMM(now)}
              </div>
              <div className="mt-1 text-xs font-light text-white/70" suppressHydrationWarning>
                {ampmAr(now)}
              </div>
            </div>

            <RingProgress value={progress} size={132} stroke={5}>
              <div className="text-center">
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/60">
                  {nextLabel}
                </div>
                <div className="font-display text-xl font-bold tabular-nums leading-tight">
                  {countdown.h}:{countdown.m}
                </div>
                <div className="text-[9px] text-white/60">المتبقي</div>
              </div>
            </RingProgress>
          </div>

          {/* Date strip */}
          <div className="relative mt-6 flex justify-between border-t border-white/15 pt-4">
            <div>
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/50">هجري</div>
              <div className="mt-0.5 text-sm font-medium">{formatHijriAr(now, hijriAdjust)}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/50">ميلادي</div>
              <div className="mt-0.5 text-sm font-medium">{formatGregorianAr(now)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* NEXT PRAYER CARD — live, deep-links to notifications */}
      <div className="px-4 pt-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <Link to="/notifications" className="glass flex items-center gap-4 rounded-[24px] p-4">
          <div className="gradient-gold flex h-12 w-12 items-center justify-center rounded-2xl text-navy shadow-gold">
            <Icon d={prayerIcon(next.key)} size={20} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              الصلاة القادمة
            </div>
            <div className="text-sm font-medium">
              {nextLabel} · {formatHHMM(next.at)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-black tabular-nums">
              {countdown.h}:{countdown.m}:{countdown.s}
            </div>
            <div className="text-[10px] text-muted-foreground">س : د : ث</div>
          </div>
        </Link>
      </div>

      {/* سكينة — اختصار الوضع الهادئ للصلاة */}
      <div className="px-4 pt-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <SakinahCard nextPrayerLabel={nextLabel} />
      </div>

      {/* مواسم منار — تظهر فقط عند وجود موسم جارٍ أو قريب */}
      <div className="px-4 pt-3 empty:hidden animate-fade-up" style={{ animationDelay: "160ms" }}>
        <SeasonCard />
      </div>

      {/* QUICK ACTIONS */}
      <SectionLabel hint="اختصارات">الوصول السريع</SectionLabel>
      <div className="grid grid-cols-4 gap-3 px-4 stagger">
        {[
          { l: "القرآن", i: icons.quran, to: "/quran" as const },
          { l: "الأذكار", i: icons.azkar, to: "/azkar" as const },
          { l: "القِبلة", i: icons.qibla, to: "/qibla" as const },
          { l: "التقويم", i: icons.calendar, to: "/calendar" as const },
        ].map((q) => (
          <Link
            key={q.l}
            to={q.to}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-secondary text-primary">
              <span className="absolute inset-0 opacity-0 transition group-hover:opacity-100 gradient-primary" />
              <span className="relative transition group-hover:text-white">
                <Icon d={q.i} size={20} />
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground">{q.l}</span>
          </Link>
        ))}
      </div>

      {/* DAILY VERSE */}
      <SectionLabel hint="آية اليوم">القرآن الكريم</SectionLabel>
      <div className="px-4 animate-fade-up">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <span className="gradient-gold inline-flex h-7 items-center rounded-full px-3 text-[10px] font-medium text-navy">
              {verse
                ? `سورة ${verse.surahName} · ${formatRangeAr(verse.from, verse.to)}`
                : "آية اليوم"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {verse ? formatSecondsAr(verse.seconds) : ""}
            </span>
          </div>
          <Link
            to="/quran/mushaf"
            search={verse ? { surah: verse.surah, ayah: verse.from } : {}}
            disabled={!verse}
            className="relative mt-5 block text-right font-display text-xl leading-loose"
          >
            {verse ? `﴿ ${verse.text} ﴾` : "…"}
          </Link>
          {verse?.meaning && (
            <p className="relative mt-3 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
              {verse.meaning}
            </p>
          )}
          <div className="relative mt-5 flex gap-2">
            <button
              disabled={!verse}
              onClick={() =>
                verse &&
                navigate({
                  to: "/quran/recitations",
                  search: { surah: verse.surah, ayah: verse.from },
                })
              }
              className="gradient-primary flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-xs font-medium text-primary-foreground shadow-glow"
            >
              <Icon d={icons.play} size={12} /> استمع
            </button>
            <button
              disabled={!verse}
              aria-label={verseSaved ? "إزالة من المحفوظات" : "حفظ الآية"}
              aria-pressed={verseSaved}
              onClick={() =>
                verse &&
                toggleBookmark({
                  surah: verse.surah,
                  ayah: verse.from,
                  page: verse.page,
                  juz: verse.juz,
                  text: verse.firstText,
                  tag: "tadabbur",
                })
              }
              className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                verseSaved ? "border-primary/40 bg-primary/10 text-primary" : "border-border"
              }`}
            >
              <Icon d={icons.bookmark} size={14} />
            </button>
            <button
              disabled={!verse}
              aria-label="مشاركة الآية"
              onClick={() =>
                verse &&
                navigate({ to: "/quran/share", search: { surah: verse.surah, ayah: verse.from } })
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border"
            >
              <Icon d={icons.share} size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* DAILY HADITH */}
      <SectionLabel hint="حديث اليوم">السنة النبوية</SectionLabel>
      <div className="px-4 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-3xl p-5 text-white shadow-elegant">
          <Arabesque className="absolute -bottom-10 -right-10 h-44 w-44 text-gold/30" />
          <div className="relative flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gold">
            <span className="h-1 w-6 bg-gold" />{" "}
            {hadith ? `${hadith.source} · ${hadith.topic}` : "حديث اليوم"}
          </div>
          <p className="relative mt-4 font-display text-lg leading-loose">
            {hadith ? `«${hadith.text}»` : "…"}
          </p>
          <p className="relative mt-3 text-[11px] text-white/70">
            {hadith ? `رواه ${hadith.narrator} ${hadith.suffix}` : ""}
          </p>
          <div className="relative mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-[10px] text-white/60">
              <Mark size={16} tone="light" /> منار · يومياً
            </div>
            <button
              disabled={!hadith}
              onClick={() => setHadithOpen(true)}
              className="flex items-center gap-1 text-[11px] text-gold"
            >
              اقرأ المزيد{" "}
              <span className="rotate-180">
                <Icon d={icons.chevron} size={12} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <HadithSheet hadith={hadith} open={hadithOpen} onClose={() => setHadithOpen(false)} />

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

function IconBtn({ icon, dot }: { icon: string; dot?: boolean }) {
  return (
    <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md">
      <Icon d={icon} size={16} />
      {dot && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold" />}
    </button>
  );
}
