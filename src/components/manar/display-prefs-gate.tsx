/* منار — تفعيل تنسيق العرض (١٢/٢٤ ساعة ونوع الأرقام) بعد الترطيب.
 *
 * الخادم يرسم بالافتراضي. بعد التركيب (وبعد استعادة التخزين من الطبقة
 * الأصلية، لأن المكوّن داخل `StorageGate`) يُفعَّل اختيار المستخدم. إن اختلف عن
 * الافتراضي أُعيد رسم الصفحات مرة واحدة. ويُعاد الرسم كذلك عند تغييره من
 * الإعدادات، وتُحدَّث الإشعارات المجدولة والويدجت لتقول الوقت بالتنسيق الجديد.
 */

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { activateDisplayPrefs, DISPLAY_EVENT } from "@/lib/display-prefs";
import { WIDGET_REFRESH_EVENT } from "@/lib/widget-settings";

export function DisplayPrefsGate({ children }: { children: ReactNode }) {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const apply = (e?: Event) => {
      if (!activateDisplayPrefs()) return;
      setRev((r) => r + 1);
      if (e) window.dispatchEvent(new CustomEvent(WIDGET_REFRESH_EVENT));
    };
    apply();
    window.addEventListener(DISPLAY_EVENT, apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener(DISPLAY_EVENT, apply);
      window.removeEventListener("storage", apply);
    };
  }, []);
  return <Fragment key={rev}>{children}</Fragment>;
}
