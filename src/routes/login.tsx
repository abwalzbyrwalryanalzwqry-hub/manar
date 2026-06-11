import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon, icons, Mark } from "@/components/manar/shell";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — منار" }] }),
  component: Login,
});

function Login() {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10 pb-14">
        <div className="flex flex-col items-center text-center">
          <Mark size={48} />
          <h1 className="mt-5 font-display text-3xl font-medium">أهلاً بعودتك</h1>
          <p className="mt-2 text-sm text-muted-foreground">سجّل دخولك لمتابعة رحلتك الإيمانية</p>
        </div>

        <div className="mt-10 space-y-4">
          <Field icon={icons.mail} label="البريد الإلكتروني" placeholder="name@example.com" type="email" />
          <Field icon={icons.lock} label="كلمة المرور" placeholder="••••••••" type="password" />
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground">
              <span className="h-4 w-4 rounded border border-border" /> تذكرني
            </label>
            <Link to="/forgot-password" className="text-primary">نسيت كلمة المرور؟</Link>
          </div>
        </div>

        <Link to="/home" className="gradient-primary mt-8 block rounded-2xl py-4 text-center text-sm font-medium text-primary-foreground shadow-glow">
          تسجيل الدخول
        </Link>

        <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> أو <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SocialBtn label="Google" />
          <SocialBtn label="Apple" />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          ليس لديك حساب؟{" "}
          <Link to="/register" className="font-medium text-primary">إنشاء حساب</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ icon, label, placeholder, type = "text" }: { icon: string; label: string; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft transition focus-within:ring-2 focus-within:ring-primary/30">
        <span className="text-muted-foreground"><Icon d={icon} size={18} /></span>
        <input type={type} placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
      </div>
    </label>
  );
}

function SocialBtn({ label }: { label: string }) {
  return (
    <button className="rounded-2xl border border-border bg-card py-3.5 text-sm font-medium shadow-soft transition hover:shadow-elegant">
      {label}
    </button>
  );
}
