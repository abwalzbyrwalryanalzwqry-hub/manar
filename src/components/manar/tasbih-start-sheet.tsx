/* منار — ورقة بدء جلسة المسبحة: اختيار الهدف (أو عدّاد مفتوح).
 *
 * تُفرّق صراحةً بين ثلاثة: عدد ورد في المصدر («ورد في المصدر»)، وإعداد
 * المستخدم (الافتراضي أو المحفوظ للذكر الشخصي)، وأعداد شائعة يختارها بنفسه.
 * إن كانت هناك جلسة جارية فيها عدّ، لا تُستبدل بصمت: تُعرض متابعتها،
 * وإن بدأ المستخدم جديدة حُفظت القديمة موقوفة.
 */

import { useId, useMemo, useState } from "react";
import { BottomSheet } from "@/components/manar/bottom-sheet";
import { toArabicDigits } from "@/lib/format";
import { parseCount } from "@/lib/personal-azkar/model";
import { TASBIH_TARGET_MAX, type TasbihSession } from "@/lib/tasbih/session";

export interface StartCandidate {
  kind: "library" | "personal";
  id: string;
  name: string;
  text: string;
  documented?: { count: number; context: string }[];
  /** للذكر الشخصي: عدده المحفوظ (`null` = مفتوح). */
  savedTarget?: number | null;
}

type Choice = { value: number | null; label: string; hint?: string };

export function TasbihStartSheet({
  candidate,
  defaultTarget,
  active,
  onClose,
  onStart,
  onContinue,
}: {
  candidate: StartCandidate | null;
  defaultTarget: number | null;
  active: TasbihSession | null;
  onClose: () => void;
  onStart: (target: number | null) => void;
  onContinue: () => void;
}) {
  if (!candidate) return null;
  return (
    <Body
      key={`${candidate.kind}:${candidate.id}`}
      candidate={candidate}
      defaultTarget={defaultTarget}
      active={active}
      onClose={onClose}
      onStart={onStart}
      onContinue={onContinue}
    />
  );
}

function Body({
  candidate,
  defaultTarget,
  active,
  onClose,
  onStart,
  onContinue,
}: {
  candidate: StartCandidate;
  defaultTarget: number | null;
  active: TasbihSession | null;
  onClose: () => void;
  onStart: (target: number | null) => void;
  onContinue: () => void;
}) {
  const customId = useId();
  const initial =
    candidate.kind === "personal" && candidate.savedTarget !== undefined
      ? candidate.savedTarget
      : defaultTarget;
  const [selected, setSelected] = useState<number | null | "custom">(initial);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const documented = useMemo(() => candidate.documented ?? [], [candidate.documented]);
  const common = useMemo(() => {
    const seen = new Set<number | null>(documented.map((d) => d.count));
    const out: Choice[] = [];
    const push = (c: Choice) => {
      if (seen.has(c.value)) return;
      seen.add(c.value);
      out.push(c);
    };
    if (candidate.kind === "personal" && candidate.savedTarget != null)
      push({
        value: candidate.savedTarget,
        label: toArabicDigits(candidate.savedTarget),
        hint: "عددك المحفوظ",
      });
    if (defaultTarget != null)
      push({
        value: defaultTarget,
        label: toArabicDigits(defaultTarget),
        hint: "إعدادك الافتراضي",
      });
    for (const n of [33, 100, 1000]) push({ value: n, label: toArabicDigits(n) });
    return out;
  }, [documented, candidate, defaultTarget]);

  const sameAsActive =
    active && active.ref.kind === candidate.kind && active.ref.id === candidate.id;
  const busy = active && active.count > 0;

  const start = () => {
    if (selected === "custom") {
      const r = parseCount(custom, TASBIH_TARGET_MAX);
      if (!r.ok) return setErr(r.error);
      return onStart(r.value);
    }
    onStart(selected);
  };

  const chip = (c: Choice, key: string) => {
    const on = selected === c.value;
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => {
          setSelected(c.value);
          setErr(null);
        }}
        className={`flex min-h-[48px] min-w-[72px] flex-col items-center justify-center rounded-2xl border px-3 py-1.5 text-sm tabular-nums transition ${
          on ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card"
        }`}
      >
        <span>{c.label}</span>
        {c.hint && <span className="text-[10px] text-muted-foreground">{c.hint}</span>}
      </button>
    );
  };

  return (
    <BottomSheet
      open
      title={candidate.name}
      subtitle="اختر هدفًا للجلسة، أو عدّادًا مفتوحًا بلا هدف."
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {busy && (
            <p className="rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-[12px] leading-relaxed">
              لديك جلسة جارية: «{active.name}» ({toArabicDigits(active.count)}
              {active.target != null ? ` من ${toArabicDigits(active.target)}` : ""}).{" "}
              {sameAsActive
                ? "يمكنك متابعتها، أو بدء جلسة جديدة لهذا الذكر وتُحفظ الحالية موقوفة."
                : "إن بدأت جلسة جديدة تُحفظ الحالية موقوفة ويمكنك متابعتها لاحقًا."}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={start}
              className="gradient-primary min-h-[48px] flex-1 rounded-2xl text-sm font-medium text-primary-foreground shadow-glow"
            >
              {busy ? "ابدأ جلسة جديدة" : "ابدأ الجلسة"}
            </button>
            {busy ? (
              <button
                type="button"
                onClick={onContinue}
                className="min-h-[48px] flex-1 rounded-2xl border border-border bg-card text-sm"
              >
                متابعة الجارية
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] flex-1 rounded-2xl border border-border bg-card text-sm"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>
      }
    >
      <p
        dir="auto"
        className="max-h-32 overflow-y-auto whitespace-pre-line break-words rounded-2xl bg-secondary/60 p-3 text-right font-display text-base leading-loose"
      >
        {candidate.text}
      </p>

      {documented.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[12px] font-medium">ورد في المصدر</div>
          <div role="radiogroup" aria-label="أعداد وردت في المصدر" className="flex flex-wrap gap-2">
            {documented.map((d, i) =>
              chip({ value: d.count, label: toArabicDigits(d.count), hint: d.context }, `d${i}`),
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-[12px] font-medium">
          {documented.length ? "أو اختر هدفك" : "اختر هدفك"}
        </div>
        <div role="radiogroup" aria-label="هدف الجلسة" className="flex flex-wrap gap-2">
          {common.map((c, i) => chip(c, `c${i}`))}
          {chip({ value: null, label: "مفتوح", hint: "بلا هدف" }, "open")}
          <button
            type="button"
            role="radio"
            aria-checked={selected === "custom"}
            onClick={() => setSelected("custom")}
            className={`min-h-[48px] rounded-2xl border px-3 text-sm ${
              selected === "custom"
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border bg-card"
            }`}
          >
            عدد آخر
          </button>
        </div>
        {selected === "custom" && (
          <div className="mt-3">
            <label htmlFor={customId} className="mb-1.5 block text-[12px]">
              الهدف
            </label>
            <input
              id={customId}
              autoFocus
              inputMode="numeric"
              dir="ltr"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setErr(null);
              }}
              placeholder="مثل ٥٠"
              aria-invalid={Boolean(err)}
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-center text-base tabular-nums outline-none focus:border-primary"
            />
          </div>
        )}
        {err && (
          <p role="alert" className="mt-2 text-[11px] text-destructive">
            {err}
          </p>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {documented.length
            ? "الأعداد تحت «ورد في المصدر» مذكورة في الحديث نفسه بسياقها. غيرها إعداد شخصي للتطبيق لا عدد مسنون."
            : "الهدف إعداد شخصي للتطبيق، لا عدد مسنون."}
        </p>
      </div>
    </BottomSheet>
  );
}
