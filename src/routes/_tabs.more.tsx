import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel, Mark } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/more")({
  head: () => ({ meta: [{ title: "المزيد — منار" }] }),
  component: More,
});

const ITEMS = [
  { to: "/qibla", l: "القِبلة", d: "البوصلة واتجاه الكعبة", i: icons.qibla },
  { to: "/calendar", l: "التقويم", d: "هجري وميلادي ومناسبات", i: icons.calendar },
  { to: "/statistics", l: "الإحصائيات", d: "تقدمك ورحلتك", i: icons.stats },
  { to: "/profile", l: "الملف الشخصي", d: "بياناتك وحسابك", i: icons.profile },
  { to: "/settings", l: "الإعدادات", d: "اللغة، الإشعارات، المظهر", i: icons.settings },
  { to: "/about", l: "عن التطبيق", d: "النسخة والفريق", i: icons.info },
] as const;

function More() {
  return (
    <Screen>
      <ScreenHeader title="المزيد" subtitle="إعدادات وأدوات إضافية" />

      <div className="px-5">
        <div className="glass flex items-center gap-4 rounded-[24px] p-4 shadow-soft">
          <div className="gradient-primary flex h-14 w-14 items-center justify-center rounded-2xl shadow-glow">
            <Mark size={26} tone="light" />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-medium">عبدالله محمد</div>
            <div className="text-xs text-muted-foreground">عضو منذ يونيو ٢٠٢٦</div>
          </div>
          <Link to="/profile" className="rounded-full border border-border px-3 py-1.5 text-[11px]">عرض</Link>
        </div>
      </div>

      <SectionLabel>أدوات</SectionLabel>
      <div className="space-y-2 px-5">
        {ITEMS.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Icon d={it.i} size={20} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">{it.l}</div>
              <div className="text-[11px] text-muted-foreground">{it.d}</div>
            </div>
            <span className="rotate-180 text-muted-foreground"><Icon d={icons.chevron} size={16} /></span>
          </Link>
        ))}
      </div>

      <SectionLabel>الحساب</SectionLabel>
      <div className="px-5">
        <Link to="/login" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 text-sm font-medium text-destructive">
          تسجيل الخروج
        </Link>
      </div>
    </Screen>
  );
}
