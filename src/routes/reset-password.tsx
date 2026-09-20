import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Icon, icons } from "@/components/manar/shell";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "إعادة تعيين كلمة المرور — منار" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const { updatePassword, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase processes the recovery hash on mount and creates a session.
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("كلمة المرور قصيرة جداً");
    if (password !== confirm) return toast.error("كلمتا المرور غير متطابقتين");
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success("تم تحديث كلمة المرور");
      nav({ to: "/home" });
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-12 pb-14">
        <div className="gradient-gold mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] text-navy shadow-gold">
          <Icon d={icons.lock} size={36} />
        </div>
        <h1 className="text-center font-display text-3xl font-medium">كلمة مرور جديدة</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          اختر كلمة مرور آمنة لحسابك.
        </p>

        {ready && !user && (
          <p className="mt-6 text-center text-xs text-destructive">
            انتهت صلاحية الرابط. اطلب رابطاً جديداً.
          </p>
        )}

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="كلمة المرور الجديدة" value={password} onChange={setPassword} />
          <Field label="تأكيد كلمة المرور" value={confirm} onChange={setConfirm} />
          <button
            disabled={busy}
            type="submit"
            className="gradient-primary mt-2 block w-full rounded-2xl py-4 text-center text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {busy ? "جاري الحفظ…" : "حفظ كلمة المرور"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
        <span className="text-muted-foreground">
          <Icon d={icons.lock} size={18} />
        </span>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </label>
  );
}
