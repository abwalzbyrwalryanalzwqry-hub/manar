import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon, icons } from "@/components/manar/shell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "استعادة كلمة المرور — منار" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-8 pb-14">
        <Link to="/login" className="mb-8 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft">
          <span className="rotate-180"><Icon d={icons.back} size={18} /></span>
        </Link>

        <div className="gradient-gold mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] text-navy shadow-gold">
          <Icon d={icons.lock} size={36} />
        </div>

        <h1 className="text-center font-display text-3xl font-medium">نسيت كلمة المرور؟</h1>
        <p className="mt-3 text-center text-sm font-light leading-relaxed text-muted-foreground">
          أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
        </p>

        <label className="mt-10 block">
          <span className="mb-2 block text-xs font-medium">البريد الإلكتروني</span>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
            <span className="text-muted-foreground"><Icon d={icons.mail} size={18} /></span>
            <input type="email" placeholder="name@example.com" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
          </div>
        </label>

        <button className="gradient-primary mt-8 block w-full rounded-2xl py-4 text-center text-sm font-medium text-primary-foreground shadow-glow">
          إرسال الرابط
        </button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          تذكرت كلمة المرور؟{" "}
          <Link to="/login" className="font-medium text-primary">العودة لتسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
