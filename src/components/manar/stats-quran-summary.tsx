/* منار — ملخص القرآن في الإحصائيات: الصفحات المقروءة من المصحف، والختمة
 * الحالية، من بيانات القارئ الموجودة دون حساب جديد. */

import { Link } from "@tanstack/react-router";
import { Icon, icons, SectionLabel } from "@/components/manar/shell";
import { formatPercent, toArabicDigits } from "@/lib/format";
import { MUSHAF_PAGES, useKhatmah } from "@/lib/quran/khatmah-plan";
import { useReadingHistory } from "@/lib/quran/reading-history";

export function QuranSummary() {
  const { pagesRead, streak } = useReadingHistory();
  const { status, completed } = useKhatmah();

  return (
    <>
      <SectionLabel hint={`${toArabicDigits(completed.length)} ختمة مكتملة`}>القرآن</SectionLabel>
      <div className="grid grid-cols-2 gap-3 px-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Icon d={icons.book} size={12} /> صفحات المصحف
          </div>
          <div className="mt-2 font-display text-2xl font-black tabular-nums">
            {toArabicDigits(pagesRead)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            من {toArabicDigits(MUSHAF_PAGES)} · {formatPercent((pagesRead / MUSHAF_PAGES) * 100)}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="gradient-primary h-full rounded-full"
              style={{ width: `${Math.min(100, (pagesRead / MUSHAF_PAGES) * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            {streak > 0 ? `${toArabicDigits(streak)} أيام قراءة متتالية` : "لا قراءة اليوم بعد"}
          </div>
        </div>

        <Link
          to="/quran/khatmah"
          className="rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant"
        >
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Icon d={icons.target} size={12} /> الختمة الحالية
          </div>
          {status ? (
            <>
              <div className="mt-2 font-display text-2xl font-black tabular-nums">
                {formatPercent(status.progress * 100)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                اليوم {toArabicDigits(status.day)} · بقي {toArabicDigits(status.daysLeft)} يوماً
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="gradient-gold h-full rounded-full"
                  style={{ width: `${Math.min(100, status.progress * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                {status.todayDone
                  ? "أتممت ورد اليوم"
                  : status.portion
                    ? `ورد اليوم ${toArabicDigits(status.portion.pages)} صفحات`
                    : ""}
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-sm font-medium">لا ختمة جارية</div>
              <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                ابدأ خطة ختمة بعدد الأيام الذي تختاره
              </div>
            </>
          )}
        </Link>
      </div>
    </>
  );
}
