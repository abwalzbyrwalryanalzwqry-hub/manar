/* منار — أذونات التنبيه الثلاثة بأزرار إصلاحها.
 *
 * مكوّن واحد يُستعمل في ثلاثة مواضع: شريحة التعريف، ونافذة «لضمان وصول الأذان»،
 * ورأس مركز التنبيهات. الحالة تُقرأ من النظام نفسه (لا من واجهة المتصفح التي لا
 * توجد داخل التطبيق)، وتُحدَّث كلما عاد المستخدم من شاشة الإعدادات.
 */

import type { AlertPermissions } from "@/lib/alert-permissions";
import { fixPermission, permissionRows } from "@/lib/use-alert-permissions";

/** قائمة الأذونات بأزرارها. `onlyMissing` يُخفي الممنوح. */
export function AlertPermissionRows({
  perms,
  onChanged,
  onlyMissing = false,
  tone = "card",
}: {
  perms: AlertPermissions;
  onChanged?: () => void;
  onlyMissing?: boolean;
  tone?: "card" | "hero";
}) {
  const rows = permissionRows(perms).filter((r) => !onlyMissing || !r.ok);
  const hero = tone === "hero";
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          disabled={r.ok}
          onClick={async () => {
            await fixPermission(r.key);
            onChanged?.();
          }}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-start ${
            hero ? "border-white/20 bg-white/10" : "border-border bg-card"
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium">{r.label}</span>
            <span
              className={`block text-[10px] leading-relaxed ${hero ? "text-white/70" : "text-muted-foreground"}`}
            >
              {r.why}
            </span>
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
              r.ok
                ? hero
                  ? "bg-white/20"
                  : "bg-primary/10 text-primary"
                : hero
                  ? "bg-white text-primary"
                  : "bg-gold/15 text-foreground"
            }`}
          >
            {r.ok ? "ممنوح" : r.need === "مطلوب" ? "اسمح" : "اضبط"}
          </span>
        </button>
      ))}
    </div>
  );
}
