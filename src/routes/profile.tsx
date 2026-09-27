import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Arabesque,
  Icon,
  icons,
  Mark,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { ConfirmSheet } from "@/components/manar/confirm-sheet";
import { SignOutSheet } from "@/components/manar/sign-out-sheet";
import { useAuth } from "@/lib/auth-context";
import { pushAll, pullAll, readMeta } from "@/lib/cloud-sync";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "الملف الشخصي — منار" }] }),
  component: Profile,
});

function Profile() {
  const nav = useNavigate();
  const { user, profile, loading, updateProfile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("ar");
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const syncStatus = useSyncStatus();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCountry(profile.country ?? "");
      setCity(profile.city ?? "");
      setLanguage(profile.preferred_language ?? "ar");
    }
  }, [profile]);

  /* قبل انتهاء فحص الجلسة لا نعرض شيئاً: عرضُ «زائر» ثم الملف (أو العكس) كان
   * يُومض، ويختلف عن رسم الخادم فيفشل الترطيب. وبلا حساب لا يوجد ملف شخصي
   * أصلاً — سواء كان المستخدم زائراً أو خرج للتوّ. */
  if (loading) return <ProfileLoading />;
  if (!user) return <GuestProfile onSignIn={() => nav({ to: "/login" })} />;

  const save = async () => {
    setBusy(true);
    const { error } = await updateProfile({
      full_name: fullName,
      country,
      city,
      preferred_language: language,
    });
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success("تم حفظ التغييرات");
      setEditing(false);
    }
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "—";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("ar", { year: "numeric", month: "long" })
    : "—";

  const handleBackup = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const result = await pushAll(user.id);
      /* `null` = لم تتم مزامنة (سحابة غير مهيأة، أو بيانات حساب آخر تنتظر قرارك). */
      if (result) toast.success("تمت المزامنة مع السحابة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشلت المزامنة");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setConfirmRestore(false);
    setBusy(true);
    try {
      const result = await pullAll(user.id);
      if (result) toast.success("تم استرجاع الإعدادات");
      await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاسترجاع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="الملف الشخصي"
        backTo="/more"
        action={
          <button
            onClick={() => (editing ? save() : setEditing(true))}
            disabled={busy}
            className="rounded-full border border-border bg-card px-4 py-2 text-xs"
          >
            {editing ? (busy ? "حفظ…" : "حفظ") : "تعديل"}
          </button>
        }
      />

      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-12 -bottom-12 h-72 w-72 text-white/15 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute inset-0 -m-2 rounded-[28px] bg-gold/30 blur-xl animate-breath" />
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[24px] bg-white/15 backdrop-blur ring-1 ring-white/25">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Mark size={48} tone="light" />
                )}
              </div>
            </div>
            <h2 className="mt-5 font-display text-2xl font-medium">{displayName}</h2>
            <p className="text-[11px] text-white/70">{user?.email ?? "—"}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[11px] font-medium text-navy shadow-gold">
              <Icon d={icons.star} size={11} />{" "}
              {profile?.plan === "premium" ? "عضو منار +" : "عضو منار"}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>المعلومات الشخصية</SectionLabel>
      <div className="space-y-2 px-4">
        {editing ? (
          <>
            <EditField label="الاسم الكامل" value={fullName} onChange={setFullName} />
            <EditField label="الدولة" value={country} onChange={setCountry} />
            <EditField label="المدينة" value={city} onChange={setCity} />
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                اللغة المفضلة
              </div>
              <div className="flex gap-2">
                {[
                  ["ar", "العربية"],
                  ["en", "English"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setLanguage(v)}
                    className={`flex-1 rounded-xl border py-2 text-sm ${language === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <Row icon={icons.profile} l="الاسم" v={displayName} />
            <Row icon={icons.mail} l="البريد الإلكتروني" v={user?.email ?? "—"} />
            <Row
              icon={icons.location}
              l="المدينة"
              v={[city, country].filter(Boolean).join("، ") || "—"}
            />
            <Row icon={icons.calendar} l="تاريخ الانضمام" v={memberSince} />
          </>
        )}
      </div>

      <SectionLabel>المزامنة السحابية</SectionLabel>
      <div className="space-y-2 px-4">
        <button
          onClick={handleBackup}
          disabled={busy || !user}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft disabled:opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.refresh} size={16} />
          </span>
          <div className="flex-1 text-right">
            <div className="text-sm font-medium">مزامنة الآن</div>
            <div className="text-[11px] text-muted-foreground">
              دمج ما على جهازك مع السحابة دون فقد أيّ تعديل
            </div>
          </div>
        </button>
        <button
          onClick={() => setConfirmRestore(true)}
          disabled={busy || !user}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft disabled:opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.download} size={16} />
          </span>
          <div className="flex-1 text-right">
            <div className="text-sm font-medium">استرجاع من السحابة</div>
            <div className="text-[11px] text-muted-foreground">
              نسخة السحابة تحلّ محلّ إعدادات هذا الجهاز
            </div>
          </div>
        </button>
        {user && (
          <p
            className={`px-1 text-[11px] ${syncStatus.error ? "text-destructive" : "text-muted-foreground"}`}
          >
            {syncStatus.error
              ? `تعذّرت آخر مزامنة: ${syncStatus.error}`
              : syncStatus.lastSyncAt
                ? `آخر مزامنة: ${new Date(syncStatus.lastSyncAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}`
                : "لم تتم أي مزامنة بعد"}
          </p>
        )}
      </div>

      <SectionLabel>الحساب</SectionLabel>
      <div className="px-4 pb-4">
        <button
          onClick={() => setSigningOut(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 text-sm font-medium text-destructive"
        >
          تسجيل الخروج
        </button>
        <button
          onClick={() => nav({ to: "/delete-account" })}
          disabled={!user}
          className="mt-3 w-full py-2 text-center text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          حذف الحساب وبياناته نهائياً
        </button>
      </div>

      <ConfirmSheet
        open={confirmRestore}
        icon={icons.download}
        title="استرجاع من السحابة؟"
        body="ستحلّ نسخة السحابة محلّ الإعدادات والتقدّم على هذا الجهاز حيث وُجدت، ولا يمكن التراجع. إن أردت الإبقاء على تعديلات هذا الجهاز فاختر «مزامنة الآن» بدلاً من ذلك."
        actions={[
          {
            label: "استرجاع نسخة السحابة",
            tone: "danger",
            onSelect: () => void handleRestore(),
          },
        ]}
        onCancel={() => setConfirmRestore(false)}
      />
      <SignOutSheet open={signingOut} onClose={() => setSigningOut(false)} />
    </Screen>
  );
}

function ProfileLoading() {
  return (
    <Screen>
      <ScreenHeader title="الملف الشخصي" backTo="/more" />
      <div className="px-5" aria-busy="true">
        <div className="h-48 animate-pulse rounded-[32px] bg-secondary/60" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary/40" />
          ))}
        </div>
      </div>
    </Screen>
  );
}

function GuestProfile({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Screen>
      <ScreenHeader title="الملف الشخصي" backTo="/more" />
      <div className="px-5">
        <div className="rounded-[28px] border border-border bg-card p-6 text-center shadow-soft">
          <div className="gradient-gold mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-navy">
            <Icon d={icons.profile} size={28} />
          </div>
          <div className="font-display text-xl font-medium">أنت تستخدم وضع الزائر</div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            سجّل دخولك لمزامنة إعداداتك وحفظ تقدمك عبر أجهزتك.
          </p>
          <button
            onClick={onSignIn}
            className="gradient-primary mt-5 block w-full rounded-2xl py-3.5 text-sm font-medium text-primary-foreground shadow-glow"
          >
            إنشاء حساب أو تسجيل الدخول
          </button>
        </div>
      </div>
    </Screen>
  );
}

function Row({ icon, l, v }: { icon: string; l: string; v: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="flex-1 text-right">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
        <div className="text-sm font-medium">{v}</div>
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-medium outline-none"
      />
    </label>
  );
}

/** حالة آخر مزامنة، تتحدّث مع كل مزامنة. */
function useSyncStatus() {
  const [status, setStatus] = useState<{ lastSyncAt: number | null; error: string | null }>({
    lastSyncAt: null,
    error: null,
  });
  useEffect(() => {
    const read = () => {
      const m = readMeta(window.localStorage);
      setStatus({ lastSyncAt: m.lastSyncAt, error: m.lastError });
    };
    read();
    window.addEventListener("manar:sync-status", read);
    return () => window.removeEventListener("manar:sync-status", read);
  }, []);
  return status;
}
