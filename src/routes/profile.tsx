import { createFileRoute } from "@tanstack/react-router";
import { Arabesque, Icon, icons, Mark, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "الملف الشخصي — منار" }] }),
  component: Profile,
});

function Profile() {
  return (
    <Screen>
      <ScreenHeader
        title="الملف الشخصي"
        backTo="/more"
        action={
          <button className="rounded-full border border-border bg-card px-4 py-2 text-xs">تعديل</button>
        }
      />

      {/* Premium identity card */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-12 -bottom-12 h-72 w-72 text-white/15 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute inset-0 -m-2 rounded-[28px] bg-gold/30 blur-xl animate-breath" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[24px] bg-white/15 backdrop-blur ring-1 ring-white/25">
                <Mark size={48} tone="light" />
              </div>
            </div>
            <h2 className="mt-5 font-display text-2xl font-medium">عبدالله محمد</h2>
            <p className="text-[11px] text-white/70">abdullah@manar.app</p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[11px] font-medium text-navy shadow-gold">
              <Icon d={icons.star} size={11} /> عضو منار +
            </div>
            <div className="mt-5 grid w-full grid-cols-3 gap-3 border-t border-white/15 pt-5">
              {[
                ["٤٢", "سلسلة"],
                ["٣٥", "صلوات/أسبوع"],
                ["١٤٢", "ذكر"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="font-display text-xl font-black tabular-nums">{v}</div>
                  <div className="text-[9px] uppercase tracking-widest text-white/60">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>الإنجاز الحالي</SectionLabel>
      <div className="px-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="gradient-gold flex h-12 w-12 items-center justify-center rounded-2xl text-navy shadow-gold">
                <Icon d={icons.flame} size={20} />
              </span>
              <div>
                <div className="text-sm font-medium">مواظب الفجر</div>
                <div className="text-[11px] text-muted-foreground">٤٢ يوماً متتالياً</div>
              </div>
            </div>
            <div className="font-display text-lg font-black tabular-nums text-primary">٨٧٪</div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="gradient-gold h-full" style={{ width: "87%" }} />
          </div>
        </div>
      </div>

      <SectionLabel>المعلومات الشخصية</SectionLabel>
      <div className="space-y-2 px-4">
        <Row icon={icons.profile} l="الاسم" v="عبدالله محمد" />
        <Row icon={icons.mail} l="البريد الإلكتروني" v="abdullah@manar.app" />
        <Row icon={icons.location} l="المدينة" v="الرياض، KSA" />
        <Row icon={icons.calendar} l="تاريخ الانضمام" v="١ يونيو ٢٠٢٦" />
      </div>

      <SectionLabel>تفضيلاتي</SectionLabel>
      <div className="space-y-2 px-4">
        <Row icon={icons.quran} l="القارئ المفضل" v="مشاري العفاسي" />
        <Row icon={icons.prayer} l="طريقة الحساب" v="أم القرى" />
        <Row icon={icons.azkar} l="الورد اليومي" v="٣ صفحات" />
      </div>
    </Screen>
  );
}

function Row({ icon, l, v }: { icon: string; l: string; v: string }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft transition hover:shadow-elegant">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="flex-1 text-right">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
        <div className="text-sm font-medium">{v}</div>
      </div>
      <span className="rotate-180 text-muted-foreground"><Icon d={icons.chevron} size={14} /></span>
    </button>
  );
}
