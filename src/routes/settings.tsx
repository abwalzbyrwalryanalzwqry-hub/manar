import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — منار" }] }),
  component: Settings,
});

function Settings() {
  return (
    <Screen>
      <ScreenHeader title="الإعدادات" backTo="/more" />

      <SectionLabel>المظهر</SectionLabel>
      <div className="space-y-2 px-5">
        <Toggle icon={icons.moon} l="الوضع الداكن" sub="مريح للعين ليلاً" on />
        <Row icon={icons.globe} l="اللغة" v="العربية" />
        <Row icon={icons.quran} l="حجم الخط" v="متوسط" />
      </div>

      <SectionLabel>الإشعارات</SectionLabel>
      <div className="space-y-2 px-5">
        <Toggle icon={icons.bell} l="أذان الصلاة" sub="إشعار صوتي مع رفع الأذان" on />
        <Toggle icon={icons.prayer} l="تذكير قبل الصلاة" sub="قبل ١٠ دقائق" on />
        <Toggle icon={icons.azkar} l="أذكار الصباح والمساء" sub="٦:٠٠ ص و ٥:٠٠ م" />
        <Toggle icon={icons.quran} l="ورد القرآن اليومي" sub="بعد صلاة الفجر" />
      </div>

      <SectionLabel>الصلاة</SectionLabel>
      <div className="space-y-2 px-5">
        <Row icon={icons.prayer} l="طريقة الحساب" v="أم القرى" />
        <Row icon={icons.qibla} l="المذهب" v="الجمهور" />
        <Row icon={icons.globe} l="الموقع" v="الرياض · KSA" />
      </div>

      <SectionLabel>الحساب والخصوصية</SectionLabel>
      <div className="space-y-2 px-5">
        <Row icon={icons.lock} l="تغيير كلمة المرور" v="" />
        <Row icon={icons.info} l="سياسة الخصوصية" v="" />
        <Row icon={icons.share} l="مشاركة التطبيق" v="" />
      </div>

      <div className="mt-6 px-5 pb-2">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 text-sm font-medium text-destructive">
          تسجيل الخروج
        </button>
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
      <span className="flex-1 text-right text-sm font-medium">{l}</span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {v}
        <span className="rotate-180">
          <Icon d={icons.chevron} size={14} />
        </span>
      </span>
    </button>
  );
}

function Toggle({ icon, l, sub, on }: { icon: string; l: string; sub: string; on?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium">{l}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
      <span
        className={`relative h-6 w-11 rounded-full transition ${on ? "gradient-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${
            on ? "right-0.5" : "right-[22px]"
          }`}
        />
      </span>
    </div>
  );
}
