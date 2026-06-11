import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel, Mark } from "@/components/manar/shell";

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

      <div className="px-5">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-center text-white shadow-elegant">
          <div className="pattern-arabesque absolute inset-0 opacity-25" />
          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 backdrop-blur ring-1 ring-white/20">
              <Mark size={44} tone="light" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-medium">عبدالله محمد</h2>
            <p className="text-xs text-white/70">abdullah@manar.app</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/90 px-3 py-1 text-[11px] font-medium text-navy">
              <Icon d={icons.star} size={12} /> عضو منار+
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 px-5">
        {[
          ["٤٢", "يوم"],
          ["٣٥", "صلاة"],
          ["١٤٢", "ذكر"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-3 text-center shadow-soft">
            <div className="font-display text-2xl font-black tabular-nums">{v}</div>
            <div className="text-[10px] text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      <SectionLabel>المعلومات</SectionLabel>
      <div className="space-y-2 px-5">
        <Row icon={icons.profile} l="الاسم" v="عبدالله محمد" />
        <Row icon={icons.mail} l="البريد الإلكتروني" v="abdullah@manar.app" />
        <Row icon={icons.globe} l="المدينة" v="الرياض، KSA" />
        <Row icon={icons.calendar} l="تاريخ الانضمام" v="١ يونيو ٢٠٢٦" />
      </div>

      <SectionLabel>التفضيلات</SectionLabel>
      <div className="space-y-2 px-5">
        <Row icon={icons.quran} l="القارئ المفضل" v="مشاري العفاسي" />
        <Row icon={icons.prayer} l="طريقة الحساب" v="أم القرى" />
      </div>
    </Screen>
  );
}

function Row({ icon, l, v }: { icon: string; l: string; v: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
        <div className="text-sm font-medium">{v}</div>
      </div>
    </div>
  );
}
