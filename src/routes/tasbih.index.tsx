import { useCallback, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomSheet } from "@/components/manar/bottom-sheet";
import { ConfirmSheet } from "@/components/manar/confirm-sheet";
import { useAnnouncer } from "@/components/manar/live-announcer";
import { PersonalBadge } from "@/components/manar/personal-zikr-actions";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from "@/hooks/use-keep-awake";
import { toArabicDigits } from "@/lib/format";
import { pulse } from "@/lib/haptics";
import { parseCount } from "@/lib/personal-azkar/model";
import { usePersonalAzkar } from "@/lib/personal-azkar/store";
import { playGoalChime } from "@/lib/tasbih/chime";
import { libraryZikr } from "@/lib/tasbih/library";
import { useTasbihPrefs, type TasbihPrefs, type TasbihProgressStyle } from "@/lib/tasbih/prefs";
import {
  TASBIH_TARGET_MAX,
  activeSession,
  endedSessions,
  pausedSessions,
  progressRatio,
  type TasbihSession,
} from "@/lib/tasbih/session";
import { useTasbih } from "@/lib/tasbih/store";

export const Route = createFileRoute("/tasbih/")({
  /* السجل يعرض أوقاتًا بتوقيت الجهاز: لا رسم على الخادم. */
  ssr: false,
  head: () => ({
    meta: [
      { title: "المسبحة الإلكترونية — منار" },
      {
        name: "description",
        content: "مسبحة إلكترونية هادئة بأذكار موثقة المصدر وأذكارك الخاصة، تعمل دون إنترنت.",
      },
    ],
  }),
  component: TasbihScreen,
});

const fmtTime = (t: number) =>
  new Date(t).toLocaleString("ar", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function countLabel(s: Pick<TasbihSession, "count" | "target">) {
  return s.target == null
    ? `${toArabicDigits(s.count)} · مفتوح`
    : `${toArabicDigits(s.count)} من ${toArabicDigits(s.target)}`;
}

function TasbihScreen() {
  const t = useTasbih();
  const { prefs, update, reset: resetPrefs } = useTasbihPrefs();
  const personal = usePersonalAzkar();
  const { announce, node: liveRegion } = useAnnouncer();
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);

  const active = activeSession(t.store);
  const paused = pausedSessions(t.store);
  const history = endedSessions(t.store);
  useKeepAwake(Boolean(active), { idleMs: KEEP_AWAKE_IDLE_MS });

  const lib = active?.ref.kind === "library" ? libraryZikr(active.ref.id) : undefined;
  const mine =
    active?.ref.kind === "personal"
      ? personal.items.find((z) => z.id === active.ref.id)
      : undefined;
  const pinned = useMemo(() => personal.items.filter((z) => z.pinned), [personal.items]);

  const onTap = useCallback(() => {
    if (!active) return;
    const reached = t.increment();
    if (reached) {
      if (prefs.hapticGoal) pulse("medium");
      if (prefs.soundGoal) playGoalChime();
      announce(`بلغت هدفك: ${toArabicDigits(active.target ?? 0)}`);
    } else if (prefs.hapticTap) pulse("light");
  }, [active, t, prefs, announce]);

  const onUndo = () => {
    if (!active || active.count <= 0) return;
    t.undo();
    announce(`تراجع، ${toArabicDigits(active.count - 1)}`);
  };

  const ratio = active ? progressRatio(active) : null;
  const reached = Boolean(active?.target != null && active.count >= active.target);
  const over = active && active.target != null ? active.count - active.target : 0;

  return (
    <Screen>
      {liveRegion}
      <ScreenHeader
        title="المسبحة الإلكترونية"
        subtitle="عدّاد هادئ بلا إنترنت"
        backTo="/azkar"
        action={
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="إعدادات المسبحة"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <Icon d={icons.settings} size={18} />
          </button>
        }
      />

      {t.saveFailed && (
        <p
          role="alert"
          className="mx-5 mb-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive"
        >
          تعذّر حفظ العدّ على الجهاز. العدّ مستمر في هذه الجلسة، لكن قد لا يُحفظ إن أُغلق التطبيق.
        </p>
      )}

      {!t.hydrated ? (
        <div className="mx-5 h-80 animate-pulse rounded-[32px] bg-secondary" />
      ) : active ? (
        <div className="px-5 animate-fade-up">
          <div className="glass-flat rounded-[28px] p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="h-px w-4 bg-gold" />
              <span className="min-w-0 flex-1 break-words text-[12px] font-medium text-foreground/80">
                {active.name}
              </span>
              {active.ref.kind === "personal" && <PersonalBadge pinned={mine?.pinned} />}
            </div>
            <p
              dir="auto"
              className="mt-3 max-h-[24vh] overflow-y-auto whitespace-pre-line break-words text-right font-display text-xl leading-[2] text-foreground"
            >
              {active.text}
            </p>
            {lib && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>المصدر:</span>
                {lib.sources.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {s.label}
                    {s.grade ? ` — ${s.grade}` : ""}
                  </a>
                ))}
              </div>
            )}
            {mine?.note && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                ملاحظتك الشخصية (غير موثّقة من منار): {mine.note}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center">
            <CounterButton
              session={active}
              ratio={ratio}
              style={prefs.progressStyle}
              onTap={onTap}
            />
            {prefs.progressStyle === "bar" && ratio != null && (
              <div
                className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={active.target ?? 0}
                aria-valuenow={Math.min(active.count, active.target ?? 0)}
                aria-label="التقدّم نحو الهدف"
              >
                <div
                  className="gradient-gold h-full transition-all"
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
            )}
          </div>

          {reached && (
            <div
              role="status"
              className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center"
            >
              <div className="text-sm font-medium text-primary">
                بلغت هدفك {toArabicDigits(active.target ?? 0)}
                {over > 0 ? ` · وزدت ${toArabicDigits(over)}` : ""}
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                يمكنك المتابعة في العدّ، أو إنهاء الجلسة وحفظها في السجل.
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-4 gap-2">
            <ToolButton
              label="تراجع"
              icon={icons.undo}
              onClick={onUndo}
              disabled={active.count <= 0}
            />
            <ToolButton
              label="تصفير"
              icon={icons.refresh}
              onClick={() => setConfirm("reset")}
              disabled={active.count <= 0}
            />
            <ToolButton label="الهدف" icon={icons.target} onClick={() => setTargetOpen(true)} />
            <ToolButton
              label="إنهاء"
              icon={icons.check}
              onClick={() => {
                t.end();
                announce("انتهت الجلسة");
              }}
            />
          </div>

          <Link
            to="/tasbih/library"
            search={{}}
            className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm"
          >
            <Icon d={icons.azkar} size={16} />
            اختيار ذكر آخر
          </Link>
        </div>
      ) : (
        <div className="px-5 animate-fade-up">
          <div className="gradient-night relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
            <div className="font-display text-2xl font-medium leading-snug">اذكر الله بسكينة.</div>
            <p className="mt-2 max-w-[18rem] text-xs leading-relaxed text-white/70">
              اختر ذكرًا من المكتبة الموثّقة أو من أذكارك الخاصة، وحدّد هدفًا أو اترك العدّاد
              مفتوحًا.
            </p>
            <Link
              to="/tasbih/library"
              search={{}}
              className="gradient-gold mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl px-6 text-sm font-medium text-navy"
            >
              اختر ذكرًا وابدأ
            </Link>
          </div>
          {pinned.length > 0 && (
            <>
              <SectionLabel>أذكارك المميّزة</SectionLabel>
              <div className="space-y-2">
                {pinned.map((z) => (
                  <Link
                    key={z.id}
                    to="/tasbih/library"
                    search={{ pick: `p:${z.id}` }}
                    className="glass flex min-h-[52px] items-center justify-between gap-2 rounded-2xl px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-sm" dir="auto">
                      {z.name || z.text}
                    </span>
                    <PersonalBadge pinned />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {paused.length > 0 && (
        <>
          <SectionLabel hint="محفوظة ويمكن متابعتها">جلسات موقوفة</SectionLabel>
          <div className="space-y-2 px-5">
            {paused.map((s) => (
              <div key={s.id} className="glass flex items-center gap-2 rounded-2xl p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{s.name}</div>
                  <div className="text-[11px] tabular-nums text-muted-foreground">
                    {countLabel(s)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => t.resume(s.id)}
                  className="min-h-[44px] rounded-xl border border-primary/30 bg-primary/5 px-3 text-[12px] text-primary"
                >
                  متابعة
                </button>
                <button
                  type="button"
                  onClick={() => t.remove(s.id)}
                  aria-label={`حذف جلسة ${s.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"
                >
                  <Icon d={icons.trash} size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <SectionLabel
            hint={
              <button
                type="button"
                onClick={() => setConfirm("clear")}
                className="text-[11px] text-muted-foreground underline"
              >
                مسح السجل
              </button>
            }
          >
            السجل
          </SectionLabel>
          <ul className="space-y-2 px-5">
            {history.slice(0, 10).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px]">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtTime(s.endedAt ?? s.updatedAt)}
                  </div>
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  {countLabel(s)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmSheet
        open={confirm === "reset"}
        title="تصفير العدّاد؟"
        body={
          active ? `سيعود عدّ «${active.name}» من ${toArabicDigits(active.count)} إلى صفر.` : ""
        }
        icon={icons.refresh}
        actions={[
          {
            label: "تصفير",
            tone: "danger",
            onSelect: () => {
              t.reset();
              setConfirm(null);
              announce("صُفّر العدّاد");
            },
          },
        ]}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === "clear"}
        title="مسح سجل الجلسات؟"
        body="تُحذف الجلسات المنتهية من السجل. الجلسة الجارية والموقوفة لا تتأثر."
        icon={icons.trash}
        actions={[
          {
            label: "مسح السجل",
            tone: "danger",
            onSelect: () => {
              t.clearHistory();
              setConfirm(null);
            },
          },
        ]}
        onCancel={() => setConfirm(null)}
      />
      {active && targetOpen && (
        <TargetSheet
          open
          current={active.target}
          onClose={() => setTargetOpen(false)}
          onSave={(v) => {
            t.setTarget(v);
            setTargetOpen(false);
          }}
        />
      )}
      <SettingsSheet
        open={settingsOpen}
        prefs={prefs}
        update={update}
        reset={resetPrefs}
        onClose={() => setSettingsOpen(false)}
      />
    </Screen>
  );
}

function CounterButton({
  session,
  ratio,
  style,
  onTap,
}: {
  session: TasbihSession;
  ratio: number | null;
  style: TasbihProgressStyle;
  onTap: () => void;
}) {
  const size = 236;
  const r = 110;
  const c = 2 * Math.PI * r;
  const showRing = style === "ring" && ratio != null;
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={
        session.target == null
          ? `سبّح، العدد ${toArabicDigits(session.count)}، عدّاد مفتوح`
          : `سبّح، ${toArabicDigits(session.count)} من ${toArabicDigits(session.target)}`
      }
      className="counter-tap relative flex select-none items-center justify-center rounded-full transition active:scale-[0.97]"
      style={{ width: size, height: size, touchAction: "manipulation" }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id="tasbih-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#C9A227" />
            <stop offset="100%" stopColor="#F0D78C" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        {showRing && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#tasbih-grad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (ratio ?? 0))}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        )}
      </svg>
      <span
        className="gradient-primary absolute inset-[18px] rounded-full shadow-glow"
        aria-hidden
      />
      <span className="relative flex flex-col items-center text-primary-foreground">
        <span className="font-display text-6xl font-medium tabular-nums leading-none">
          {toArabicDigits(session.count)}
        </span>
        <span className="mt-2 text-[12px] opacity-80">
          {session.target == null ? "عدّاد مفتوح" : `من ${toArabicDigits(session.target)}`}
        </span>
      </span>
    </button>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-[11px] disabled:opacity-40"
    >
      <Icon d={icon} size={18} />
      {label}
    </button>
  );
}

function TargetSheet({
  open,
  current,
  onClose,
  onSave,
}: {
  open: boolean;
  current: number | null;
  onClose: () => void;
  onSave: (v: number | null) => void;
}) {
  const [value, setValue] = useState(current == null ? "" : String(current));
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const r = parseCount(value, TASBIH_TARGET_MAX);
    if (!r.ok) return setErr(r.error);
    onSave(r.value);
  };
  return (
    <BottomSheet
      open={open}
      title="هدف الجلسة"
      subtitle="تغيير الهدف لا يمسّ ما عددته."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            className="gradient-primary min-h-[48px] flex-1 rounded-2xl text-sm font-medium text-primary-foreground"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-2xl border border-border bg-card text-sm"
          >
            إلغاء
          </button>
        </div>
      }
    >
      <label className="mb-1.5 block text-[12px]" htmlFor="tasbih-target">
        الهدف (اتركه فارغًا لعدّاد مفتوح)
      </label>
      <input
        id="tasbih-target"
        inputMode="numeric"
        dir="ltr"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setErr(null);
        }}
        placeholder="مفتوح"
        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-center tabular-nums outline-none focus:border-primary"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[33, 100, 1000].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(String(n))}
            className="min-h-[36px] rounded-full border border-border bg-card px-3 text-[12px]"
          >
            {toArabicDigits(n)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setValue("")}
          className="min-h-[36px] rounded-full border border-border bg-card px-3 text-[12px]"
        >
          مفتوح
        </button>
      </div>
      {err && (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {err}
        </p>
      )}
    </BottomSheet>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-2 text-right"
    >
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "right-[1.375rem]"}`}
        />
      </span>
    </button>
  );
}

function SettingsSheet({
  open,
  prefs,
  update,
  reset,
  onClose,
}: {
  open: boolean;
  prefs: TasbihPrefs;
  update: (p: Partial<TasbihPrefs>) => void;
  reset: () => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const targets: (number | null)[] = [33, 100, 1000, null];
  const styles: { key: TasbihProgressStyle; label: string }[] = [
    { key: "ring", label: "حلقة" },
    { key: "bar", label: "شريط" },
    { key: "number", label: "الرقم فقط" },
  ];
  return (
    <BottomSheet
      open={open}
      title="إعدادات المسبحة"
      subtitle="لا تحتاج المسبحة أي إذن من الجهاز."
      onClose={onClose}
    >
      <div className="space-y-2">
        <Toggle
          label="اهتزاز مع كل نقرة"
          hint="خفيف"
          on={prefs.hapticTap}
          onChange={(v) => update({ hapticTap: v })}
        />
        <Toggle
          label="اهتزاز عند بلوغ الهدف"
          on={prefs.hapticGoal}
          onChange={(v) => update({ hapticGoal: v })}
        />
        <Toggle
          label="نغمة هادئة عند بلوغ الهدف"
          hint="مطفأة افتراضيًا · تتبع صوت الوسائط"
          on={prefs.soundGoal}
          onChange={(v) => {
            update({ soundGoal: v });
            if (v) playGoalChime();
          }}
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[12px] font-medium">الهدف المقترح عند البدء</div>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {targets.map((n) => {
            const on = prefs.defaultTarget === n;
            return (
              <button
                key={String(n)}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ defaultTarget: n })}
                className={`min-h-[44px] rounded-2xl border px-4 text-sm tabular-nums ${on ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card"}`}
              >
                {n == null ? "مفتوح" : toArabicDigits(n)}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            aria-label="هدف آخر"
            inputMode="numeric"
            dir="ltr"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setErr(null);
            }}
            placeholder="عدد آخر"
            className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 text-center text-sm tabular-nums outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => {
              const r = parseCount(custom, TASBIH_TARGET_MAX);
              if (!r.ok || r.value == null)
                return setErr(r.ok ? "اكتب عددًا، أو اختر «مفتوح»." : r.error);
              update({ defaultTarget: r.value });
              setCustom("");
            }}
            className="min-h-[44px] rounded-2xl border border-border bg-card px-4 text-sm"
          >
            اعتماد
          </button>
        </div>
        {err && (
          <p role="alert" className="mt-1 text-[11px] text-destructive">
            {err}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {prefs.defaultTarget == null
            ? "الحالي: عدّاد مفتوح."
            : `الحالي: ${toArabicDigits(prefs.defaultTarget)}.`}{" "}
          هذا إعداد للتطبيق وليس عددًا مسنونًا؛ الأعداد الواردة في المصادر تظهر منفصلة عند البدء.
        </p>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[12px] font-medium">شكل التقدّم</div>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {styles.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={prefs.progressStyle === s.key}
              onClick={() => update({ progressStyle: s.key })}
              className={`min-h-[44px] rounded-2xl border text-sm ${prefs.progressStyle === s.key ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={reset}
        className="mt-5 min-h-[44px] w-full rounded-2xl border border-border text-[12px] text-muted-foreground"
      >
        إعادة إعدادات المسبحة إلى الافتراضي
      </button>
    </BottomSheet>
  );
}
