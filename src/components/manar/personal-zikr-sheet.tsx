/* منار — نموذج إضافة ذكر شخصي أو تعديله (ورقة واحدة، خطوة واحدة).
 *
 * المسار الأقصر: «إضافة ذكر» ← كتابة النص ← «حفظ الذكر». كل ما سوى النص اختياري:
 * الاسم، وعدد التكرار (الفارغ = عدد مفتوح)، والوِرد (محدَّد مسبقًا بالوِرد الذي
 * فُتح منه النموذج)، والموضع، وإعدادات المسبحة. الحفظ لا يُغلق النموذج إلا إذا
 * نجح فعلًا، وإن فشل يبقى النص كما كتبه المستخدم مع رسالة توضح السبب.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/manar/bottom-sheet";
import { Icon, icons } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/format";
import { WIRD_SESSIONS, type WirdSessionKey } from "@/lib/wird/data";
import {
  NAME_MAX,
  NOTE_MAX,
  TEXT_MAX,
  WIRD_KEYS,
  checkName,
  checkNote,
  checkText,
  parseCount,
  type PersonalInput,
  type PersonalZikr,
} from "@/lib/personal-azkar/model";
import { personalAzkar } from "@/lib/personal-azkar/store";

export type PersonalSheetMode =
  | { kind: "create"; context: "wird"; session: WirdSessionKey }
  | { kind: "create"; context: "tasbih" }
  | {
      kind: "edit";
      zikr: PersonalZikr;
      context: "wird" | "tasbih";
      /** الحقل الذي يأخذ التركيز (من إجراءات «تغيير الاسم»/«تغيير العدد»/«تغيير الوِرد»). */
      focus?: "text" | "name" | "repeat" | "wirds" | "target";
    };

const SESSION_LABEL: Record<WirdSessionKey, string> = {
  morning: "ورد الصباح",
  evening: "ورد المساء",
};

const QUICK_COUNTS = [1, 3, 7, 10, 33, 100];
const QUICK_TARGETS = [33, 100, 1000];

type Fields = {
  text: string;
  name: string;
  repeat: string;
  sessions: WirdSessionKey[];
  after: Partial<Record<WirdSessionKey, string>>;
  note: string;
  target: string;
  targetTouched: boolean;
  pinned: boolean;
};

function initialFields(mode: PersonalSheetMode): Fields {
  if (mode.kind === "edit") {
    const z = mode.zikr;
    const after: Fields["after"] = {};
    for (const k of WIRD_KEYS) {
      const a = z.wird.after[k];
      after[k] = a == null ? "end" : String(a);
    }
    return {
      text: z.text,
      name: z.name,
      repeat: z.wird.repeat == null ? "" : String(z.wird.repeat),
      sessions: [...z.wird.sessions],
      after,
      note: z.note,
      target: z.tasbih.target == null ? "" : String(z.tasbih.target),
      targetTouched: true,
      pinned: z.pinned,
    };
  }
  return {
    text: "",
    name: "",
    repeat: "",
    sessions: mode.context === "wird" ? [mode.session] : [],
    after: {},
    note: "",
    target: "",
    targetTouched: false,
    pinned: false,
  };
}

export function PersonalZikrSheet({
  mode,
  onClose,
  onSaved,
}: {
  /** `null` = مغلق. */
  mode: PersonalSheetMode | null;
  onClose: () => void;
  onSaved: (zikr: PersonalZikr, kind: "create" | "edit") => void;
}) {
  if (!mode) return null;
  /* مفتاح يعيد تهيئة الحقول عند فتح النموذج لذكر آخر. */
  const key = mode.kind === "edit" ? `e:${mode.zikr.id}:${mode.focus ?? ""}` : `c:${mode.context}`;
  return <SheetBody key={key} mode={mode} onClose={onClose} onSaved={onSaved} />;
}

function SheetBody({
  mode,
  onClose,
  onSaved,
}: {
  mode: PersonalSheetMode;
  onClose: () => void;
  onSaved: (zikr: PersonalZikr, kind: "create" | "edit") => void;
}) {
  const [f, setF] = useState<Fields>(() => initialFields(mode));
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<
    Partial<Record<"text" | "repeat" | "target" | "sessions" | "name" | "note", string>>
  >({});
  const focus = mode.kind === "edit" ? mode.focus : undefined;
  const wirdFirst = mode.context === "wird";
  /* الخيارات الإضافية مطويّة، وتُفتح إن جاء التعديل لأجل حقل فيها. */
  const [moreOpen, setMoreOpen] = useState(
    wirdFirst ? focus === "target" : focus === "wirds" || focus === "repeat",
  );
  const textRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const wirdsRef = useRef<HTMLButtonElement>(null);
  const ids = { text: useId(), name: useId(), repeat: useId(), note: useId(), target: useId() };
  const initialFocus =
    focus === "name"
      ? nameRef
      : focus === "repeat"
        ? repeatRef
        : focus === "target"
          ? targetRef
          : focus === "wirds"
            ? wirdsRef
            : textRef;

  const dirty = useMemo(() => {
    const base = initialFields(mode);
    return JSON.stringify(base) !== JSON.stringify(f);
  }, [f, mode]);

  useEffect(() => {
    if (focus === "name") nameRef.current?.select();
  }, [focus]);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      /* عند الإنشاء: العدد الافتراضي في المسبحة يتبع عدد الوِرد حتى يغيّره المستخدم. */
      if (k === "repeat" && mode.kind === "create" && !prev.targetTouched) {
        next.target = String(v);
      }
      if (k === "target") next.targetTouched = true;
      return next;
    });
    setError(null);
    setFieldErr((e) => ({ ...e, [k === "sessions" ? "sessions" : k]: undefined }));
  };

  const toggleSession = (k: WirdSessionKey) =>
    set(
      "sessions",
      f.sessions.includes(k)
        ? f.sessions.filter((s) => s !== k)
        : WIRD_KEYS.filter((s) => s === k || f.sessions.includes(s)),
    );

  const validate = (): PersonalInput | null => {
    const errs: typeof fieldErr = {};
    const t = checkText(f.text);
    if (!t.ok) errs.text = t.error;
    const n = checkName(f.name);
    if (!n.ok) errs.name = n.error;
    const no = checkNote(f.note);
    if (!no.ok) errs.note = no.error;
    const r = parseCount(f.repeat);
    if (!r.ok) errs.repeat = r.error;
    const g = parseCount(f.target);
    if (!g.ok) errs.target = g.error;
    if (wirdFirst && f.sessions.length === 0) {
      errs.sessions = "اختر ورد الصباح أو ورد المساء أو كليهما.";
    }
    setFieldErr(errs);
    if (Object.keys(errs).length) {
      if (errs.repeat || errs.target || errs.sessions) {
        if (!wirdFirst && (errs.repeat || errs.sessions)) setMoreOpen(true);
        if (wirdFirst && errs.target) setMoreOpen(true);
      }
      return null;
    }
    const after: PersonalInput["after"] = {};
    for (const k of f.sessions) {
      const a = f.after[k];
      after[k] = a == null || a === "end" ? null : Number(a);
    }
    return {
      text: f.text,
      name: f.name,
      note: f.note,
      wirdRepeat: f.repeat,
      sessions: f.sessions,
      after,
      tasbihTarget: f.target,
      pinned: f.pinned,
    };
  };

  const save = () => {
    const input = validate();
    if (!input) return;
    const res =
      mode.kind === "edit" ? personalAzkar.update(mode.zikr.id, input) : personalAzkar.add(input);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved(res.zikr, mode.kind);
  };

  const title = mode.kind === "edit" ? "تعديل الذكر" : "إضافة ذكر";
  const repeatOpen = !f.repeat.trim();
  const targetOpen = !f.target.trim();

  const wirdSection = (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-[12px] font-medium">مكان الذكر</legend>
        <div className="grid grid-cols-2 gap-2">
          {WIRD_KEYS.map((k, i) => {
            const on = f.sessions.includes(k);
            return (
              <button
                key={k}
                ref={i === 0 ? wirdsRef : undefined}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleSession(k)}
                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border px-3 text-sm transition ${
                  on
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {on && <Icon d={icons.check} size={12} strokeWidth={2.4} />}
                </span>
                {SESSION_LABEL[k]}
              </button>
            );
          })}
        </div>
        {f.sessions.length === 2 && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            ذكر واحد في الوِردين: أي تعديل عليه يظهر في كليهما.
          </p>
        )}
        {fieldErr.sessions && (
          <p role="alert" className="mt-2 text-[11px] text-destructive">
            {fieldErr.sessions}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={ids.repeat} className="mb-1.5 block text-[12px] font-medium">
          عدد التكرارات في الوِرد <span className="text-muted-foreground">(اختياري)</span>
        </label>
        <input
          ref={repeatRef}
          id={ids.repeat}
          inputMode="numeric"
          dir="ltr"
          value={f.repeat}
          onChange={(e) => set("repeat", e.target.value)}
          placeholder="مفتوح"
          aria-invalid={Boolean(fieldErr.repeat)}
          aria-describedby={`${ids.repeat}-hint`}
          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-center text-base tabular-nums outline-none focus:border-primary"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set("repeat", String(n))}
              className={`min-h-[36px] rounded-full border px-3 text-[12px] tabular-nums ${
                f.repeat === String(n)
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card"
              }`}
            >
              {toArabicDigits(n)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set("repeat", "")}
            className={`min-h-[36px] rounded-full border px-3 text-[12px] ${
              repeatOpen ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card"
            }`}
          >
            مفتوح
          </button>
        </div>
        <p
          id={`${ids.repeat}-hint`}
          className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground"
        >
          {repeatOpen
            ? "عدد مفتوح: يزيد العدّاد ما شئت بلا هدف، ولا يمنع إتمام الوِرد."
            : `يكتمل الذكر بعد ${toArabicDigits(f.repeat)} مرة.`}
        </p>
        {fieldErr.repeat && (
          <p role="alert" className="mt-1 text-[11px] text-destructive">
            {fieldErr.repeat}
          </p>
        )}
      </div>

      {f.sessions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] font-medium">
            الموضع في الوِرد <span className="text-muted-foreground">(اختياري)</span>
          </div>
          {f.sessions.map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">
                {SESSION_LABEL[k]}
              </span>
              <select
                value={f.after[k] ?? "end"}
                onChange={(e) => set("after", { ...f.after, [k]: e.target.value })}
                className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="end">في آخر الوِرد</option>
                <option value="0">في أول الوِرد</option>
                {WIRD_SESSIONS[k].items.map((it) => (
                  <option key={it.order} value={String(it.order)}>
                    بعد: {it.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const tasbihSection = (
    <div className="space-y-4">
      <div>
        <label htmlFor={ids.target} className="mb-1.5 block text-[12px] font-medium">
          العدد الافتراضي في المسبحة <span className="text-muted-foreground">(اختياري)</span>
        </label>
        <input
          ref={targetRef}
          id={ids.target}
          inputMode="numeric"
          dir="ltr"
          value={f.target}
          onChange={(e) => set("target", e.target.value)}
          placeholder="عدّاد مفتوح"
          aria-invalid={Boolean(fieldErr.target)}
          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-center text-base tabular-nums outline-none focus:border-primary"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_TARGETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set("target", String(n))}
              className={`min-h-[36px] rounded-full border px-3 text-[12px] tabular-nums ${
                f.target === String(n)
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card"
              }`}
            >
              {toArabicDigits(n)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set("target", "")}
            className={`min-h-[36px] rounded-full border px-3 text-[12px] ${
              targetOpen ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card"
            }`}
          >
            عدّاد مفتوح
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          إعداد شخصي لجلسة المسبحة، مستقل عن عدد الوِرد، ويمكن تغييره عند بدء كل جلسة.
        </p>
        {fieldErr.target && (
          <p role="alert" className="mt-1 text-[11px] text-destructive">
            {fieldErr.target}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.note} className="mb-1.5 block text-[12px] font-medium">
          ملاحظة شخصية <span className="text-muted-foreground">(اختياري)</span>
        </label>
        <textarea
          id={ids.note}
          dir="auto"
          rows={2}
          maxLength={NOTE_MAX}
          value={f.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="مثل: من درس الشيخ… أو سبب اختيارك لهذا الذكر"
          className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          تُعرض بوصفها ملاحظتك أنت، لا مصدرًا موثقًا.
        </p>
        {fieldErr.note && (
          <p role="alert" className="mt-1 text-[11px] text-destructive">
            {fieldErr.note}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={f.pinned}
        onClick={() => set("pinned", !f.pinned)}
        className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-border bg-card px-4 text-sm"
      >
        <span className="flex items-center gap-2">
          <Icon d={icons.star} size={16} />
          تمييز الذكر للوصول السريع
        </span>
        <span
          aria-hidden
          className={`relative h-6 w-11 rounded-full transition ${f.pinned ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              f.pinned ? "right-0.5" : "right-[1.375rem]"
            }`}
          />
        </span>
      </button>
    </div>
  );

  return (
    <BottomSheet
      open
      title={title}
      subtitle={
        mode.kind === "create"
          ? wirdFirst
            ? "اكتب الذكر واحفظه — بقية الحقول اختيارية."
            : "ذكر خاص بك للمسبحة — بقية الحقول اختيارية."
          : "التعديل يظهر في كل مكان يُستعمل فيه هذا الذكر."
      }
      onClose={onClose}
      dismissible={!dirty}
      initialFocus={initialFocus}
      footer={
        <div className="space-y-2">
          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="gradient-primary min-h-[48px] flex-1 rounded-2xl text-sm font-medium text-primary-foreground shadow-glow"
            >
              حفظ الذكر
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-2xl border border-border bg-card text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={ids.text} className="mb-1.5 block text-[12px] font-medium">
            نص الذكر
          </label>
          <textarea
            ref={textRef}
            id={ids.text}
            dir="auto"
            rows={4}
            maxLength={TEXT_MAX}
            value={f.text}
            onChange={(e) => set("text", e.target.value)}
            placeholder="اكتب الذكر أو الصقه هنا"
            aria-invalid={Boolean(fieldErr.text)}
            aria-required
            className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-right font-display text-lg leading-loose outline-none focus:border-primary"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            {fieldErr.text ? (
              <span role="alert" className="text-destructive">
                {fieldErr.text}
              </span>
            ) : (
              <span>يُحفظ كما كتبته، بتشكيله.</span>
            )}
            <span className="tabular-nums">
              {toArabicDigits(f.text.length)}/{toArabicDigits(TEXT_MAX)}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor={ids.name} className="mb-1.5 block text-[12px] font-medium">
            اسم الذكر <span className="text-muted-foreground">(اختياري)</span>
          </label>
          <input
            ref={nameRef}
            id={ids.name}
            dir="auto"
            maxLength={NAME_MAX}
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="مثل: استغفار، دعاء خاص، ذكر يومي"
            className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
          />
          {fieldErr.name && (
            <p role="alert" className="mt-1 text-[11px] text-destructive">
              {fieldErr.name}
            </p>
          )}
        </div>

        {wirdFirst ? wirdSection : tasbihSection}

        <div className="rounded-2xl border border-border/70">
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className="flex min-h-[48px] w-full items-center justify-between px-4 text-[12px] font-medium"
          >
            {wirdFirst ? "خيارات المسبحة والتمييز" : "الإضافة إلى ورد الصباح أو المساء"}
            <span className={`transition ${moreOpen ? "-rotate-90" : "rotate-90"}`}>
              <Icon d={icons.chevron} size={14} />
            </span>
          </button>
          {moreOpen && <div className="px-4 pb-4">{wirdFirst ? tasbihSection : wirdSection}</div>}
        </div>
      </div>
    </BottomSheet>
  );
}
