/* منار — حذف الحساب.
 *
 * صفحة واحدة تخدم غرضين يطلبهما Google Play:
 *   ١. حذف الحساب من داخل التطبيق: الملف الشخصي ← «حذف الحساب» يفتح هذه الصفحة.
 *   ٢. رابط ويب عام لطلب الحذف (يُكتب في Play Console): من لم يعد التطبيق على
 *      جهازه يجد هنا الخطوات والبريد، ويستطيع الحذف مباشرةً إن سجّل دخوله.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { useAuth } from "@/lib/auth-context";
import { DEVELOPER } from "@/lib/developer";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "حذف الحساب — منار" },
      {
        name: "description",
        content: "طريقة حذف حسابك في تطبيق منار وكل بياناته المحفوظة في الخادم.",
      },
    ],
  }),
  component: DeleteAccount,
});

const CONFIRM_WORD = "حذف";

const DELETED = [
  "الحساب نفسه: البريد الإلكتروني وكلمة المرور أو ربط Google.",
  "الملف الشخصي: الاسم والصورة والدولة والمدينة واللغة.",
  "كل ما رُفع للمزامنة: الإعدادات، وتفضيلات الصلاة والأذان والتنبيهات، والموقع المحفوظ.",
  "تقدّم القرآن والأذكار والوِرد والختمة والعلامات المرجعية والإحصائيات المحفوظة في السحابة.",
];

const KEPT = [
  "بيانات هذا الجهاز تبقى عليه ويستمرّ التطبيق في العمل كزائر؛ تُمسح بحذف التطبيق أو مسح بياناته.",
  "لا يحتفظ منار بأي نسخة من بيانات حسابك بعد الحذف، ولا يمكن استرجاعها.",
];

function DeleteAccount() {
  const nav = useNavigate();
  const { user, deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = confirm.trim() === CONFIRM_WORD && !busy;

  const run = async () => {
    if (!ready) return;
    setBusy(true);
    const { error } = await deleteAccount();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("تم حذف حسابك وكل بياناته من الخادم");
    nav({ to: "/login" });
  };

  const mail = `mailto:${DEVELOPER.email}?subject=${encodeURIComponent(
    "طلب حذف حساب منار",
  )}&body=${encodeURIComponent("أرجو حذف حسابي في تطبيق منار المسجّل بهذا البريد.")}`;

  return (
    <Screen>
      <ScreenHeader
        title="حذف الحساب"
        subtitle="حذف نهائي لا يمكن التراجع عنه"
        backTo={user ? "/profile" : "/about"}
      />

      <div className="space-y-3 px-5">
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <h2 className="text-sm font-medium text-destructive">ما الذي يُحذف</h2>
          <List items={DELETED} dot="bg-destructive/70" />
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="text-sm font-medium">ما الذي يبقى</h2>
          <List items={KEPT} dot="bg-primary/60" />
        </section>
      </div>

      {user ? (
        <>
          <SectionLabel>تأكيد الحذف</SectionLabel>
          <div className="space-y-3 px-5 pb-6">
            <p className="text-[13px] font-light leading-loose">
              سيُحذف الحساب <bdi className="font-medium">{user.email ?? ""}</bdi>. للتأكيد اكتب كلمة
              «{CONFIRM_WORD}» في الحقل:
            </p>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_WORD}
              aria-label="اكتب كلمة حذف للتأكيد"
              autoComplete="off"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-destructive"
            />
            <button
              onClick={run}
              disabled={!ready}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-3.5 text-sm font-medium text-destructive-foreground shadow-soft transition disabled:opacity-40"
            >
              {busy ? "جارٍ الحذف…" : "حذف حسابي نهائياً"}
            </button>
            <Link
              to="/profile"
              className="block w-full rounded-2xl border border-border bg-card py-3.5 text-center text-sm"
            >
              تراجع
            </Link>
          </div>
        </>
      ) : (
        <>
          <SectionLabel>طريقة الحذف</SectionLabel>
          <div className="space-y-3 px-5 pb-6">
            <ol className="space-y-2 rounded-2xl border border-border bg-card p-4 text-[13px] font-light leading-loose shadow-soft">
              <li>١. افتح تطبيق منار وسجّل الدخول بالحساب المراد حذفه.</li>
              <li>٢. من «المزيد» افتح «الملف الشخصي».</li>
              <li>٣. اضغط «حذف الحساب»، واكتب كلمة «{CONFIRM_WORD}» للتأكيد.</li>
            </ol>
            <Link
              to="/login"
              className="gradient-primary block w-full rounded-2xl py-3.5 text-center text-sm font-medium text-primary-foreground shadow-glow"
            >
              تسجيل الدخول للحذف الآن
            </Link>
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-[13px] font-light leading-loose">
              لم يعد التطبيق على جهازك؟ راسل المطوّر من البريد المسجّل به الحساب، ويُحذف الحساب وكل
              بياناته خلال ٧ أيام على الأكثر:
              <a
                href={mail}
                className="mt-2 flex items-center gap-2 break-all font-medium text-primary"
                dir="ltr"
              >
                <Icon d={icons.mail} size={14} />
                {DEVELOPER.email}
              </a>
            </div>
          </div>
        </>
      )}
    </Screen>
  );
}

function List({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((p) => (
        <li key={p} className="flex gap-2 text-[13px] font-light leading-loose">
          <span className={`mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
          <span className="min-w-0 break-words">{p}</span>
        </li>
      ))}
    </ul>
  );
}
