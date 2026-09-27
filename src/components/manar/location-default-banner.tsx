/* منار — تنبيه لطيف حين لم يُحدَّد الموقع بعد، فالمواقيت والقبلة محسوبة
 * للموقع الافتراضي. يختفي بمجرد اختيار مدينة أو تحديد الموقع. */

import { Icon, icons } from "@/components/manar/shell";
import { useLocation } from "@/lib/prayer";

export function LocationDefaultBanner({ what = "المواقيت" }: { what?: string }) {
  const { location, requestGps, status } = useLocation();
  if (location.source !== "default") return null;
  const busy = status === "requesting";
  return (
    <div className="px-4 pb-3 pt-3">
      <div
        role="status"
        className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-card px-4 py-3 shadow-soft"
      >
        <span className="text-gold">
          <Icon d={icons.location} size={16} />
        </span>
        <span className="min-w-0 flex-1 text-[11px] leading-relaxed">
          الموقع غير محدد، و{what} الآن حسب موقع {location.city}.
        </span>
        <button
          type="button"
          onClick={requestGps}
          disabled={busy}
          className="gradient-primary shrink-0 rounded-xl px-3 py-2 text-[11px] font-medium text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {busy ? "جارٍ التحديد…" : "حدّد موقعي"}
        </button>
      </div>
    </div>
  );
}
