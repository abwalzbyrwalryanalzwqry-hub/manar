import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel, Mark } from "@/components/manar/shell";
import { useUserName } from "@/lib/user-name";

export const Route = createFileRoute("/_tabs/more")({
  head: () => ({ meta: [{ title: "المزيد — منار" }] }),
  component: More,
});

const ITEMS = [
  { to: "/wird", l: "الوِرد", d: "ورد الصباح والمساء", i: icons.sparkle },
  { to: "/adhan", l: "مكتبة الأذان", d: "اختر صوت الأذان لكل صلاة", i: icons.bell },

  { to: "/iqama", l: "الإقامة", d: "صوت الإقامة وموعدها بعد الأذان", i: icons.prayer },
  { to: "/notifications", l: "مركز التنبيهات", d: "الأذان، الإقامة، التذكيرات", i: icons.bell },
  { to: "/sakinah", l: "🕌 سكينة", d: "الوضع الهادئ للصلاة", i: icons.moon },
  {
    to: "/reminders",
    l: "تذكيرات الأذكار والوِرد",
    d: "أوقات وأصوات تختارها بنفسك",
    i: icons.sparkle,
  },
  {
    to: "/widget",
    l: "ويدجت الشاشة الرئيسية",
    d: "أضف الصلاة القادمة وآية اليوم إلى شاشة جوالك",
    i: icons.widget,
  },
  { to: "/qibla", l: "القِبلة", d: "البوصلة واتجاه الكعبة", i: icons.qibla },
  { to: "/calendar", l: "التقويم", d: "هجري وميلادي ومناسبات", i: icons.calendar },
  { to: "/seasons", l: "مواسم منار", d: "رمضان وذو الحجة والجمعة وغيرها", i: icons.star },
  { to: "/statistics", l: "الإحصائيات", d: "تقدمك ورحلتك", i: icons.stats },
  {
    to: "/my-data",
    l: "بياناتي",
    d: "النسخ الاحتياطي، التصدير والاستيراد، اسمك",
    i: icons.profile,
  },
  { to: "/settings", l: "الإعدادات", d: "اللغة، الإشعارات، المظهر", i: icons.settings },
  { to: "/about", l: "عن التطبيق", d: "النسخة، المطور، الخصوصية والشروط", i: icons.info },
] as const;

function More() {
  const name = useUserName();

  return (
    <Screen>
      <ScreenHeader title="المزيد" subtitle="إعدادات وأدوات إضافية" />

      <div className="px-5">
        <Link
          to="/my-data"
          aria-label={name ? `${name} — بياناتي` : "بياناتي — أضف اسمك"}
          className="glass flex items-center gap-4 rounded-[24px] p-4 shadow-soft"
        >
          <div className="gradient-primary flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-glow">
            <Mark size={26} tone="light" />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-medium">
              {name ? `أهلاً، ${name}` : "أهلاً بك في منار"}
            </div>
            <div className="text-xs text-muted-foreground">بياناتك على جهازك فقط — بلا حساب</div>
          </div>
          <span className="rounded-full border border-border px-3 py-1.5 text-[11px]">
            {name ? "بياناتي" : "أضف اسمك"}
          </span>
        </Link>
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
            <span className="rotate-180 text-muted-foreground">
              <Icon d={icons.chevron} size={16} />
            </span>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
