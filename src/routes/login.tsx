import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Icon, icons, Mark } from "@/components/manar/shell";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — منار" }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { signInEmail, signInGoogle, enableGuest } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signInEmail(email.trim(), password);
    setBusy(false);
    if (error) toast.error(error);
    else { toast.success("أهلاً بعودتك"); nav({ to: "/home" }); }
  };

  const google = async () => {
    setBusy(true);
    const { error } = await signInGoogle();
    setBusy(false);
    if (error) toast.error(error);
    else { toast.success("تم تسجيل الدخول عبر Google"); nav({ to: "/home" }); }
  };

  const guest = () => { enableGuest(); nav({ to: "/home" }); };

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10 pb-14">
        <div className="flex flex-col items-center text-center">
          <Mark size={48} />
          <h1 className="mt-5 font-display text-3xl font-medium">أهلاً بعودتك</h1>
          <p className="mt-2 text-sm text-muted-foreground">سجّل دخولك لمتابعة رحلتك الإيمانية</p>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-4">
          <Field icon={icons.mail} label="البريد الإلكتروني" placeholder="name@example.com" type="email" value={email} onChange={setEmail} />
          <Field icon={icons.lock} label="كلمة المرور" placeholder="••••••••" type="password" value={password} onChange={setPassword} />
          <div className="flex items-center justify-end text-xs">
            <Link to="/forgot-password" className="text-primary">نسيت كلمة المرور؟</Link>
          </div>
          <button disabled={busy} type="submit" className="gradient-primary block w-full rounded-2xl py-4 text-center text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
            {busy ? "جاري الدخول…" : "تسجيل الدخول"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> أو <span className="h-px flex-1 bg-border" />
        </div>

        <button onClick={google} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-3.5 text-sm font-medium shadow-soft transition hover:shadow-elegant disabled:opacity-60">
          <GoogleG /> المتابعة بحساب Google
        </button>

        <button onClick={guest} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3.5 text-sm text-muted-foreground">
          <Icon d={icons.profile} size={16} /> الدخول كزائر
        </button>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          ليس لديك حساب؟ <Link to="/register" className="font-medium text-primary">إنشاء حساب</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ icon, label, placeholder, type = "text", value, onChange }: { icon: string; label: string; placeholder: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft transition focus-within:ring-2 focus-within:ring-primary/30">
        <span className="text-muted-foreground"><Icon d={icon} size={18} /></span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
      </div>
    </label>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.8-2 13.3-5.2l-6.1-5c-2 1.4-4.5 2.2-7.2 2.2-5.3 0-9.7-3.1-11.3-7.4l-6.6 5.1C9.6 39 16.3 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.1 5c-.4.4 6.7-4.9 6.7-14.4 0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
