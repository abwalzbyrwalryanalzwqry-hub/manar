import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel, Mark } from "@/components/manar/shell";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "عن التطبيق — منار" }] }),
  component: About,
});

function About() {
  return (
    <Screen>
      <ScreenHeader title="عن التطبيق" backTo="/more" />

      <div className="px-5">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-8 text-center text-white shadow-elegant">
          <div className="pattern-arabesque absolute inset-0 opacity-30" />
          <div className="relative flex flex-col items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 backdrop-blur ring-1 ring-white/20 animate-float">
              <Mark size={44} tone="light" />
            </div>
            <h2 className="mt-5 font-display text-4xl font-light">منار</h2>
            <p className="mt-1 text-xs text-white/70">نور يهديك في كل وقت</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] backdrop-blur">
              الإصدار 1.0.0
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>عن منار</SectionLabel>
      <div className="px-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="text-sm font-light leading-loose text-foreground">
            منار تطبيق إسلامي فاخر يجمع لك مواقيت الصلاة، والقرآن الكريم، والأذكار اليومية، واتجاه القِبلة في مكان واحد.
            صُمم بعناية ليكون رفيقك في رحلتك الإيمانية اليومية.
          </p>
        </div>
      </div>

      <SectionLabel>روابط</SectionLabel>
      <div className="space-y-2 px-5">
        <LinkRow icon={icons.globe} l="موقعنا" v="manar.app" />
        <LinkRow icon={icons.mail} l="تواصل معنا" v="hello@manar.app" />
        <LinkRow icon={icons.star} l="قيّم التطبيق" v="App Store · Google Play" />
        <LinkRow icon={icons.share} l="شارك التطبيق" v="" />
      </div>

      <SectionLabel>قانوني</SectionLabel>
      <div className="space-y-2 px-5">
        <LinkRow icon={icons.lock} l="سياسة الخصوصية" v="" />
        <LinkRow icon={icons.info} l="شروط الاستخدام" v="" />
        <LinkRow icon={icons.heart} l="المصادر والاعتمادات" v="" />
      </div>

      <div className="mt-8 px-5 pb-4 text-center">
        <div className="font-display text-lg text-gold">﷽</div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          صُنع بحب في الرياض · © Manar 2026
        </p>
      </div>
    </Screen>
  );
}

function LinkRow({ icon, l, v }: { icon: string; l: string; v: string }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <span className="flex-1 text-right text-sm font-medium">{l}</span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {v}
        <span className="rotate-180"><Icon d={icons.chevron} size={14} /></span>
      </span>
    </button>
  );
}
