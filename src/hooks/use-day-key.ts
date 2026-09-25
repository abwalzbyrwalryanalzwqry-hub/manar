/* منار — تتبّع اليوم الحالي والتطبيق مفتوح.
 *
 * وحدات التقدّم اليومي (الأذكار، الوِرد) تتحقق من التاريخ عند القراءة فقط، فمن
 * يبدأ قبل منتصف الليل ويكمل بعده كانت تُحمل عدّادات الأمس إلى اليوم الجديد.
 * هذا الخطاف يعيد مفتاح اليوم ويتغيّر عند منتصف الليل، وعند العودة للتطبيق.
 */

import { useEffect, useState } from "react";
import { dayKey } from "@/lib/activity-log";
import { onResume } from "@/lib/native-shell";

/** كل كم يُفحص التاريخ والتطبيق في المقدمة. */
const TICK_MS = 30_000;

export function useDayKey(): string {
  const [day, setDay] = useState(() => dayKey());
  useEffect(() => {
    const check = () => setDay((prev) => (prev === dayKey() ? prev : dayKey()));
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const id = window.setInterval(check, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const offResume = onResume(check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      offResume();
    };
  }, []);
  return day;
}

/**
 * يستدعي `cb` حين يوشك التطبيق أن يُغادَر: إخفاء الصفحة (ومنه إرسال تطبيق
 * أندرويد للخلفية، فالـWebView يطلق `visibilitychange`) أو إغلاقها.
 */
export function useOnLeave(cb: () => void) {
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") cb();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", cb);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", cb);
    };
  }, [cb]);
}
