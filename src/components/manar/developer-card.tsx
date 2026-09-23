/* منار — بطاقة «عن المطور» داخل صفحة «عن التطبيق».
 *
 * بيانات ثابتة محلية (`src/lib/developer.ts`) — تعمل بلا إنترنت. كل وسيلة تواصل
 * تفتح تطبيقها في النظام، ولكل صفٍّ زرّ نسخ بديل إن لم يوجد التطبيق.
 */

import { toast } from "sonner";
import { Icon, icons } from "@/components/manar/shell";
import { copyText, DEVELOPER, openContact, type ContactKind } from "@/lib/developer";

type Row = {
  label: string;
  value: string;
  icon: string;
  /** ما يُفتح عند اللمس؛ بلا قيمة = صفّ معلومات فقط. */
  kind?: ContactKind;
  /** قيمة يمرّرها للرابط (البريد البديل). */
  arg?: string;
  /** اسم التطبيق في رسالة «غير متاح». */
  app?: string;
  /** أرقام ومعرّفات لاتينية تُعرض من اليسار لليمين. */
  ltr?: boolean;
  hint?: string;
};

const ROWS: Row[] = [
  { label: "المطور", value: DEVELOPER.name, icon: icons.user },
  {
    label: "الجوال",
    value: DEVELOPER.phone,
    icon: icons.phone,
    kind: "phone",
    app: "تطبيق الاتصال",
    ltr: true,
    hint: "اتصال",
  },
  { label: "العنوان", value: DEVELOPER.address, icon: icons.location },
  {
    label: "البريد الإلكتروني",
    value: DEVELOPER.email,
    icon: icons.mail,
    kind: "email",
    arg: DEVELOPER.email,
    app: "تطبيق البريد",
    ltr: true,
    hint: "مراسلة",
  },
  {
    label: "البريد الإلكتروني",
    value: DEVELOPER.emailAlt,
    icon: icons.mail,
    kind: "email",
    arg: DEVELOPER.emailAlt,
    app: "تطبيق البريد",
    ltr: true,
    hint: "مراسلة",
  },
  {
    label: "واتساب",
    value: DEVELOPER.whatsapp,
    icon: icons.whatsapp,
    kind: "whatsapp",
    app: "واتساب",
    ltr: true,
    hint: "محادثة",
  },
  {
    label: "تلجرام",
    value: `@${DEVELOPER.telegram}`,
    icon: icons.telegram,
    kind: "telegram",
    app: "تلجرام",
    ltr: true,
    hint: "محادثة",
  },
  {
    label: "فيسبوك",
    value: DEVELOPER.facebookName,
    icon: icons.facebook,
    kind: "facebook",
    app: "فيسبوك",
    hint: "بحث",
  },
];

export function DeveloperCard() {
  return (
    <section
      id="developer"
      aria-labelledby="developer-title"
      className="overflow-hidden rounded-[24px] border border-border bg-card shadow-soft"
    >
      <div className="gradient-primary relative px-5 py-5 text-white">
        <div className="pattern-arabesque absolute inset-0 opacity-20" aria-hidden />
        <div className="relative flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-2xl ring-1 ring-white/25 backdrop-blur"
            aria-hidden
          >
            إ
          </span>
          <div className="min-w-0">
            <h3 id="developer-title" className="text-[11px] tracking-wide text-white/75">
              عن المطور
            </h3>
            <p className="mt-0.5 font-display text-xl font-medium leading-snug">{DEVELOPER.name}</p>
            <p className="text-[11px] text-white/75">مطوّر تطبيق منار</p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {ROWS.map((r, i) => (
          <li key={`${r.label}-${i}`}>
            <ContactRow row={r} />
          </li>
        ))}
      </ul>

      <p className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
        هذه البيانات محفوظة داخل التطبيق وتظهر بلا إنترنت. تُفتح وسائل التواصل في تطبيقاتها على
        جوالك، ولا يرسل منار أي بيانات عنك.
      </p>
    </section>
  );
}

function ContactRow({ row }: { row: Row }) {
  const copy = async () => {
    const ok = await copyText(row.value);
    if (ok) toast.success(`نُسخ ${row.label}`);
    else toast.error("تعذّر النسخ");
  };

  const open = async () => {
    if (!row.kind) return;
    const ok = await openContact(row.kind, row.arg);
    if (!ok) {
      const copied = await copyText(row.value);
      toast.error(
        copied
          ? `لا يوجد ${row.app ?? "تطبيق مناسب"} على جهازك — نُسخ ${row.label} لتستخدمه يدوياً`
          : `لا يوجد ${row.app ?? "تطبيق مناسب"} على جهازك`,
      );
    }
  };

  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={row.icon} size={17} />
      </span>
      <span className="min-w-0 flex-1 text-right">
        <span className="block text-[11px] text-muted-foreground">{row.label}</span>
        <span
          className={`block break-all font-medium leading-snug ${row.ltr ? "text-[13px]" : "text-sm"}`}
          dir={row.ltr ? "ltr" : "rtl"}
          style={row.ltr ? { textAlign: "right" } : undefined}
        >
          {row.value}
        </span>
      </span>
      {row.kind && row.hint && (
        <span className="hidden shrink-0 text-[11px] text-primary min-[360px]:inline">
          {row.hint}
        </span>
      )}
    </>
  );

  return (
    <div className="flex items-center gap-1 px-2">
      {row.kind ? (
        <button
          onClick={() => void open()}
          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-right transition hover:bg-secondary/40 focus-visible:bg-secondary/40"
          aria-label={`${row.label}: ${row.value} — ${row.hint ?? "فتح"}`}
        >
          {body}
        </button>
      ) : (
        <div className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-2 py-2.5">
          {body}
        </div>
      )}
      <button
        onClick={() => void copy()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary/40 hover:text-primary"
        aria-label={`نسخ ${row.label}`}
      >
        <Icon d={icons.copy} size={15} />
      </button>
    </div>
  );
}
