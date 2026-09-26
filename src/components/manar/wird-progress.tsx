// ============================================================
// Manar — Wird: شريط تقدّم متحرك بأسلوب Liquid Glass 3D
// يعرض الذكر الحالي والعدد المتبقي — خاص بقسم الوِرد فقط
// ============================================================

import { useEffect, useState } from "react";
import { toArabicDigits } from "@/lib/format";

interface Props {
  /** نسبة إنجاز الوِرد كاملًا (٠..١) */
  ratio: number;
  /** اسم الذكر الحالي */
  currentName?: string;
  /** ترتيب الذكر الحالي */
  currentOrder: number;
  /** عدد الأذكار في الوِرد */
  total: number;
  /** المتبقي من تكرارات الذكر الحالي */
  remaining: number;
  /** عدد الأذكار المكتملة */
  completedItems: number;
  /** حالة الحفظ */
  saved?: boolean;
}

export function WirdProgressBar({
  ratio,
  currentName,
  currentOrder,
  total,
  remaining,
  completedItems,
  saved,
}: Props) {
  // حركة دخول ناعمة عند فتح الوِرد: يمتد الشريط من الصفر إلى النسبة الحالية
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setWidth(ratio), 60);
    return () => window.clearTimeout(id);
  }, [ratio]);

  return (
    <div className="glass-flat relative overflow-hidden rounded-[24px] border border-white/15 p-4 shadow-elegant animate-fade-up">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-gold/15 via-transparent to-primary/15" />

      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            الذكر الحالي
          </div>
          <div className="mt-0.5 truncate font-display text-sm font-medium">
            {currentName ?? "—"}
          </div>
        </div>
        <div className="shrink-0 text-left">
          <div className="font-display text-2xl font-medium tabular-nums leading-none">
            {toArabicDigits(Math.round(ratio * 100))}٪
          </div>
          <div className="text-[10px] text-muted-foreground">
            الذكر {toArabicDigits(currentOrder)} من {toArabicDigits(total)}
          </div>
        </div>
      </div>

      {/* الشريط ثلاثي الأبعاد */}
      <div className="relative mt-3 h-3 overflow-hidden rounded-full border border-border/70 bg-secondary shadow-inner">
        <div
          className="gradient-gold relative h-full rounded-full shadow-glow"
          style={{
            width: `${Math.max(width * 100, width > 0 ? 4 : 0)}%`,
            transition: "width 700ms cubic-bezier(.22,.9,.24,1)",
          }}
        >
          <span className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/35" />
        </div>
      </div>

      <div className="relative mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="tabular-nums">
          متبقي في هذا الذكر {toArabicDigits(remaining)} · مكتمل {toArabicDigits(completedItems)}/
          {toArabicDigits(total)}
        </span>
        <span className={saved ? "text-primary" : undefined}>
          {saved ? "تم حفظ التقدّم" : "سيُحفظ تقدّمك تلقائيًا"}
        </span>
      </div>
    </div>
  );
}
