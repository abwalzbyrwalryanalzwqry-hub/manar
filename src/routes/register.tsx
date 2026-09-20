import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Icon, icons, Mark } from "@/components/manar/shell";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "إنشاء حساب — منار" }] }),
  component: Register,
});

function Register() {
  const nav = useNavigate();
  const { signUpEmail } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return toast.error("يجب الموافقة على الشروط");
    if (password.length < 6) return toast.error("كلمة المرور قصيرة جداً (٦ أحرف على الأقل)");
    if (password !== confirm) return toast.error("كلمتا المرور غير متطابقتين");
    setBusy(true);
    const { error } = await signUpEmail(email.trim(), password, name.trim());
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success("تم إنشاء الحساب! تحقق من بريدك للتأكيد");
      nav({ to: "/home" });
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-8 pb-14">
        <Link
          to="/login"
          className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft"
        >
          <span className="rotate-180">
            <Icon d={icons.back} size={18} />
          </span>
        </Link>

        <div className="text-center">
          <Mark size={40} />
          <h1 className="mt-4 font-display text-3xl font-medium">إنشاء حساب</h1>
          <p className="mt-2 text-sm text-muted-foreground">انضم إلى منار وابدأ رحلتك</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field
            icon={icons.profile}
            label="الاسم الكامل"
            placeholder="محمد عبدالله"
            value={name}
            onChange={setName}
          />
          <Field
            icon={icons.mail}
            label="البريد الإلكتروني"
            placeholder="name@example.com"
            type="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            icon={icons.lock}
            label="كلمة المرور"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={setPassword}
          />
          <Field
            icon={icons.lock}
            label="تأكيد كلمة المرور"
            placeholder="••••••••"
            type="password"
            value={confirm}
            onChange={setConfirm}
          />
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            أوافق على <span className="text-primary">الشروط والأحكام</span> و{" "}
            <span className="text-primary">سياسة الخصوصية</span>
          </label>
          <button
            disabled={busy}
            type="submit"
            className="gradient-primary mt-2 block w-full rounded-2xl py-4 text-center text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {busy ? "جاري الإنشاء…" : "إنشاء الحساب"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          لديك حساب؟{" "}
          <Link to="/login" className="font-medium text-primary">
            سجّل دخولك
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  icon: string;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
        <span className="text-muted-foreground">
          <Icon d={icon} size={18} />
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </label>
  );
}
