import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel, Mark } from "@/components/manar/shell";
import { useEffect, useState } from "react";
import { useUserName } from "@/lib/user-name";
import { MORE_GROUPS, readUsage, recordUsage, topUsed, type MoreItem } from "@/lib/more-menu";

export const Route = createFileRoute("/_tabs/more")({
  head: () => ({ meta: [{ title: "المزيد — منار" }] }),
  component: More,
});

function More() {
  const name = useUserName();
  /* يُقرأ بعد التركيب: العدّاد محلي، ولا يُرسم على الخادم. */
  const [top, setTop] = useState<MoreItem[]>([]);
  useEffect(() => setTop(topUsed(readUsage())), []);

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

      {top.length > 0 && (
        <div className="px-5 pt-4">
          <div className="mb-2 text-[11px] text-muted-foreground">الأكثر استخداماً</div>
          <div className="flex flex-wrap gap-2">
            {top.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => recordUsage(it.to)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-soft"
              >
                <span className="text-primary">
                  <Icon d={icons[it.icon]} size={14} />
                </span>
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {MORE_GROUPS.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <SectionLabel>{g.title}</SectionLabel>
          <div className="space-y-2 px-5">
            {g.items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => recordUsage(it.to)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon d={icons[it.icon]} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-[11px] text-muted-foreground">{it.desc}</div>
                </div>
                <span className="rotate-180 text-muted-foreground">
                  <Icon d={icons.chevron} size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
