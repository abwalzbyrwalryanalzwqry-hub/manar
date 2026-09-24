/* مواسم منار — نقطة الوصول في الرئيسية.
 * بنفس أسلوب بطاقة «الصلاة القادمة»، وتظهر فقط عند وجود موسم جارٍ/في التمهيد
 * أو موسم سنوي قريب (≤ ١٠ أيام) — وإلا لا تُعرض شيئاً. */

import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { phaseLabel, remainingLine, statusLine } from "@/lib/seasons/labels";
import { useHijriAdjust } from "@/lib/hijri";
import { seasonsOverview } from "@/lib/seasons/engine";
import { useSeasonToday } from "@/lib/seasons/store";

const NEAR_DAYS = 10;

export function SeasonCard() {
  const { adjust } = useHijriAdjust();
  const today = useSeasonToday();
  const st = useMemo(() => {
    if (!today) return null;
    const ov = seasonsOverview(today, adjust);
    if (ov.featured) return ov.featured;
    if (ov.nearest && ov.nearest.daysUntil <= NEAR_DAYS) return ov.nearest;
    return null;
  }, [today, adjust]);

  if (!st) return null;
  const s = st.instance.season;
  const extra = phaseLabel(st) ?? remainingLine(st);

  return (
    <Link
      to="/seasons/$season"
      params={{ season: s.id }}
      className="glass flex items-center gap-4 rounded-[24px] p-4"
      aria-label={`مواسم منار: ${s.title}`}
    >
      <div className="gradient-gold flex h-12 w-12 items-center justify-center rounded-2xl text-navy shadow-gold">
        <Icon d={icons[s.icon]} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          مواسم منار
        </div>
        <div className="truncate text-sm font-medium">{statusLine(st)}</div>
        {extra && <div className="truncate text-[11px] text-muted-foreground">{extra}</div>}
      </div>
      <span className="rotate-180 text-muted-foreground">
        <Icon d={icons.chevron} size={16} />
      </span>
    </Link>
  );
}
