/* منار — شريط التلاوة المختصر.
 *
 * نسختان من المكوّن نفسه:
 * - داخل القارئ (`variant="reader"`): فوق شريط الأدوات، مع زر تكرار المقطع.
 * - عائم في بقية الشاشات (`GlobalRecitationBar`): تستمر التلاوة بعد مغادرة القارئ
 *   فيبقى للمستخدم ما يوقفها به، ويعود منه إلى موضع الآية.
 */

import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "@/lib/toast";

import { Icon, icons } from "@/components/manar/shell";
import { useRecitationPlayer } from "@/hooks/use-recitation-player";
import { toArabicDigits } from "@/lib/quran/format";
import { SURAH_META } from "@/lib/quran/metadata";
import { setDownloadManagerEvents, useActiveDownloads } from "@/lib/quran/recitation-offline";

function SmallButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon d={icon} size={16} />
    </button>
  );
}

export function RecitationBar({
  variant,
  onRange,
}: {
  variant: "reader" | "floating";
  /** يفتح نافذة تكرار المقطع (في القارئ فقط). */
  onRange?: () => void;
}) {
  const player = useRecitationPlayer();
  const { track, status, range } = player;
  if (!track) return null;

  const meta = SURAH_META[track.surah - 1];
  const playing = status === "playing";
  const progress =
    player.position.duration > 0
      ? Math.min(100, (player.position.current / player.position.duration) * 100)
      : 0;

  const label = (
    <>
      <span className="block truncate text-[13px] font-medium">
        سورة {meta.nameAr} · الآية {toArabicDigits(track.ayah)}
      </span>
      <span className="block truncate text-[10px] text-muted-foreground">
        {status === "error"
          ? (player.error ?? "تعذّر التشغيل")
          : range
            ? `تكرار ${toArabicDigits(range.from)}–${toArabicDigits(range.to)}${
                range.times ? ` · ${toArabicDigits(range.times)} مرات` : " · بلا حدّ"
              }`
            : `${player.reciter.nameAr}${player.offline ? " · بدون إنترنت" : ""}`}
      </span>
    </>
  );

  return (
    <div
      dir="rtl"
      role="region"
      aria-label="مشغّل التلاوة"
      className="relative overflow-hidden rounded-[22px] border border-gold/25 bg-card/95 shadow-elegant backdrop-blur-xl"
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={player.toggle}
          aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow transition active:scale-90"
        >
          {status === "loading" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <Icon d={playing ? icons.pause : icons.play} size={18} />
          )}
        </button>

        {variant === "floating" ? (
          <Link
            to="/quran/mushaf"
            search={{ surah: track.surah, ayah: track.ayah }}
            className="min-w-0 flex-1 px-1 text-right"
            aria-label="العودة إلى الآية في المصحف"
          >
            {label}
          </Link>
        ) : (
          <div className="min-w-0 flex-1 px-1" aria-live="polite">
            {label}
          </div>
        )}

        <SmallButton icon={icons.skipPrev} label="الآية السابقة" onClick={player.prev} />
        <SmallButton icon={icons.skipNext} label="الآية التالية" onClick={player.next} />
        {variant === "reader" && onRange && (
          <SmallButton
            icon={icons.repeat}
            label="تكرار مقطع"
            onClick={onRange}
            active={Boolean(range)}
          />
        )}
        <SmallButton icon={icons.close} label="إيقاف التلاوة" onClick={player.stop} />
      </div>
      <div className="h-0.5 bg-muted" aria-hidden>
        <div className="h-full bg-gold transition-[width]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/** المسارات التي لها مشغّلها الخاص فلا يظهر فيها الشريط العائم. */
const OWN_PLAYER = ["/quran/mushaf", "/quran/recitations"];

/** الشريط العائم في جذر التطبيق: فوق شريط التبويب ما دامت هناك تلاوة. */
export function GlobalRecitationBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const player = useRecitationPlayer();
  if (!player.track || OWN_PLAYER.some((p) => pathname.startsWith(p))) return null;
  return (
    <div className="fixed inset-x-0 bottom-[6.75rem] z-40 mx-auto max-w-md px-4">
      <RecitationBar variant="floating" />
    </div>
  );
}

/** إشعار بانتهاء تحميل سورة أو تعثّره، أينما كان المستخدم في التطبيق. */
export function RecitationDownloadNotifier() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const jobs = useActiveDownloads();
  const running = jobs.filter((j) => j.status === "active").length;

  useEffect(() => {
    setDownloadManagerEvents({
      onDone: (e) => toast.success(`اكتمل تحميل سورة ${SURAH_META[e.surah - 1].nameAr}`),
      onError: (surah, message) =>
        toast.error(`تعذّر تحميل سورة ${SURAH_META[surah - 1].nameAr}`, { description: message }),
    });
    return () => setDownloadManagerEvents({});
  }, []);

  // عند مغادرة شاشة التلاوات والتحميل جارٍ: تنبيه بأنه مستمر.
  const onRecitations = pathname.startsWith("/quran/recitations");
  useEffect(() => {
    if (onRecitations || running === 0) return;
    toast.info(
      running === 1
        ? "يستمر تحميل السورة في الخلفية"
        : `يستمر تحميل ${toArabicDigits(running)} سور في الخلفية`,
      { id: "downloads-bg" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRecitations]);

  return null;
}
