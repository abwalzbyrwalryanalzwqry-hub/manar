/* منار — شارة «منطقة الجهاز الزمنية لا تطابق الموقع» (المرحلة ٣٣).
 *
 * تحسب بعد الترطيب فقط (الخادم لا يعرف منطقة الجهاز)، وتُعاد عند العودة إلى
 * التطبيق لأن المستخدم قد يصحّح المنطقة من الإعدادات ثم يرجع. */

import { useEffect, useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { useLocation } from "@/lib/prayer";
import { mismatchMessage, zoneMismatch, type ZoneMismatch } from "@/lib/place-timezone";
import { isNativeShell, openNativeDateSettings } from "@/lib/native-notifications";
import { toArabicDigits } from "@/lib/format";

const LS_DISMISSED = "manar.zone-banner.dismissed.v1";

/** مفتاح الإخفاء: المدينة والفرق معاً — فرقٌ جديد (صيفي مثلاً) يُظهرها من جديد. */
function dismissKey(city: string, m: ZoneMismatch): string {
  return `${city}|${m.tz}|${m.diffMinutes}`;
}

export function ZoneMismatchBanner() {
  const { location } = useLocation();
  const [m, setM] = useState<ZoneMismatch | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "hidden") return;
      setM(location.source === "default" ? null : zoneMismatch(location));
    };
    check();
    setNative(isNativeShell());
    try {
      setDismissed(window.localStorage.getItem(LS_DISMISSED));
    } catch {
      /* ignore */
    }
    document.addEventListener("visibilitychange", check);
    document.addEventListener("resume", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener("resume", check);
    };
  }, [location]);

  if (!m) return null;
  const msg = mismatchMessage(location, m);
  const key = dismissKey(location.city, m);
  if (!msg.severe && dismissed === key) return null;

  const dismiss = () => {
    setDismissed(key);
    try {
      window.localStorage.setItem(LS_DISMISSED, key);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="px-4 pb-3 pt-3">
      <div
        role={msg.severe ? "alert" : "status"}
        className={`rounded-2xl border bg-card px-4 py-3 shadow-soft ${
          msg.severe ? "border-destructive/40" : "border-gold/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={msg.severe ? "text-destructive" : "text-gold"}>
            <Icon d={icons.clock} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">{msg.title}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {toArabicDigits(msg.body)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          {!msg.severe && (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-border px-3 py-1.5 text-[11px]"
            >
              فهمت
            </button>
          )}
          {native && (
            <button
              type="button"
              onClick={() => void openNativeDateSettings()}
              className="gradient-primary rounded-xl px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-glow"
            >
              إعدادات الوقت
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
