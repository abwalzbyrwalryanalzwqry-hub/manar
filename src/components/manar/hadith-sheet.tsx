import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Icon, icons } from "@/components/manar/shell";
import type { DailyHadith } from "@/lib/daily-content";

function shareText(h: DailyHadith): string {
  return `«${h.text}»\nعن ${h.narrator} ${h.suffix}\n${h.source}\n\n— حديث اليوم · تطبيق منار`;
}

async function shareHadith(h: DailyHadith): Promise<"shared" | "copied" | "cancelled"> {
  const text = shareText(h);
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import("@capacitor/share");
    try {
      await Share.share({ title: "منار", text, dialogTitle: "مشاركة الحديث" });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const nav = navigator as Navigator & { share?: (data: { text: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ text });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}

async function copyHadith(h: DailyHadith): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareText(h));
    return true;
  } catch {
    return false;
  }
}

/** Bottom sheet for «اقرأ المزيد» on the home «حديث اليوم» card. */
export function HadithSheet({
  hadith,
  open,
  onClose,
}: {
  hadith: DailyHadith | null;
  open: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setNote(null);
  }, [open]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2200);
    return () => clearTimeout(t);
  }, [note]);

  if (!open || !hadith) return null;

  const agreed = hadith.source === "متفق عليه";

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="حديث اليوم"
        className="relative mx-auto flex max-h-[92vh] w-full max-w-md flex-col rounded-t-[32px] border-x border-t border-border bg-card shadow-elegant animate-fade-up"
      >
        <div className="flex justify-center py-3">
          <span className="h-1 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center gap-2 px-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-medium">حديث اليوم</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {hadith.source} · {hadith.topic}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <Icon d={icons.close} size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div className="gradient-night relative overflow-hidden rounded-3xl p-5 text-white shadow-elegant">
            <p className="font-display text-lg leading-loose">«{hadith.text}»</p>
            <p className="mt-3 text-[11px] text-white/70">
              رواه {hadith.narrator} {hadith.suffix}
            </p>
          </div>

          <p className="mt-5 text-[11px] font-medium text-muted-foreground">الرواية كاملة بسندها</p>
          <p className="mt-2 rounded-2xl border border-border bg-background/60 p-4 text-right font-display text-[15px] leading-loose">
            {hadith.full}
          </p>

          <div className="mt-4 rounded-2xl border border-border p-4 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">المصدر: </span>
              {hadith.book}
            </p>
            {agreed && <p className="mt-1">متفق عليه: ورد بهذا اللفظ في صحيحي البخاري ومسلم.</p>}
            <p className="mt-1">النص منقول حرفياً من الرواية، ويتغيّر الحديث كل يوم تلقائياً.</p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          <button
            onClick={async () => {
              const r = await shareHadith(hadith);
              if (r === "copied") setNote("تم نسخ الحديث");
            }}
            className="gradient-primary flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-xs font-medium text-primary-foreground shadow-glow"
          >
            <Icon d={icons.share} size={12} /> مشاركة
          </button>
          <button
            onClick={async () =>
              setNote((await copyHadith(hadith)) ? "تم نسخ الحديث" : "تعذّر النسخ")
            }
            aria-label="نسخ"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border"
          >
            <Icon d={icons.copy} size={14} />
          </button>
        </div>

        {note && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit rounded-full bg-navy px-4 py-2 text-[11px] text-white shadow-elegant"
          >
            {note}
          </div>
        )}
      </div>
    </div>
  );
}
