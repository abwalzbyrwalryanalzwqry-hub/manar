/* مواسم منار — بطاقات المرحلة الرابعة في صفحة الموسم:
 * تأكيد دخول الشهر (٤.١)، ملخص الموسم وسجلّه (٤.٢، ٤.٣)، وتقدّم الختمة (٤.٦). */

import { Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Icon, icons, SectionLabel } from "@/components/manar/shell";
import { useActivityLog } from "@/lib/activity-log";
import { formatGregorianAr, formatWeekdayAr, toArabicDigits } from "@/lib/format";
import {
  checkHijriMonthStart,
  clearHijriMonthStart,
  confirmHijriMonthStart,
  hijriMonthConfirmed,
  hijriMonthName,
  useHijriAdjust,
} from "@/lib/hijri";
import { useKhatmah } from "@/lib/quran/khatmah-plan";
import { shareCardText } from "@/lib/quran/share-card";
import { addDays, daysBetween, noon } from "@/lib/seasons/engine";
import { dayUnit } from "@/lib/seasons/labels";
import { planFor, useSeasonsStore } from "@/lib/seasons/store";
import {
  previousSummary,
  recordSeasonSummary,
  seasonSummary,
  summaryHasContent,
  summaryShareText,
  useSeasonHistory,
} from "@/lib/seasons/summary";
import { khatmahLine } from "@/lib/seasons/extras";
import type { SeasonState } from "@/lib/seasons/types";
import { toast } from "@/lib/toast";

/* ------------------------------ ٤.١ تأكيد دخول الشهر ------------------------------ */

/**
 * «أُعلن دخول رمضان اليوم / أمس / غدًا». الإزاحة العامة تنقل كل الأشهر، وهذا
 * لشهر واحد: يتقدّم عليها في هذا الشهر وتتبعه الأشهر التالية.
 */
export function MonthConfirmCard({ st, now }: { st: SeasonState; now: Date }) {
  const { adjust, rev } = useHijriAdjust();
  const { year, month } = st.instance.hijriStart;
  const name = hijriMonthName(month);
  const today = noon(now);

  const { confirmed, options } = useMemo(() => {
    void rev;
    /* الخيارات حول بداية الحساب (قبلها بيوم، هي، بعدها بيوم) — الصالح منها فقط. */
    const computed = st.instance.startDate;
    const opts = [-1, 0, 1].map((k) => {
      const date = addDays(computed, k);
      const d = daysBetween(today, date);
      return {
        d,
        date,
        ok: checkHijriMonthStart(year, month, date, adjust).ok,
        label: startLabel(d, date),
      };
    });
    return { confirmed: hijriMonthConfirmed(year, month), options: opts.filter((o) => o.ok) };
  }, [rev, year, month, adjust, today, st.instance.startDate]);

  const startOffset = daysBetween(today, st.instance.startDate);

  const confirm = (date: Date) => {
    const r = confirmHijriMonthStart(year, month, date, adjust);
    if (r.ok)
      toast.success(`حُفظ: أول ${name} ${formatWeekdayAr(date)} ${formatGregorianAr(date)}`);
    else toast.error(r.reason);
  };

  return (
    <>
      <SectionLabel hint="بحسب إعلان بلدك">دخول شهر {name}</SectionLabel>
      <div className="space-y-2 px-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {confirmed
              ? `مؤكَّد: أول ${name} ${formatWeekdayAr(confirmed)} ${formatGregorianAr(confirmed)}.`
              : `بحسب الحساب: أول ${name} ${formatWeekdayAr(st.instance.startDate)} ${formatGregorianAr(st.instance.startDate)}. إن أُعلن غير ذلك فاختر ما أُعلن.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((o) => {
              const selected = o.d === startOffset;
              return (
                <button
                  key={o.d}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => confirm(o.date)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                    selected ? "gradient-primary text-white" : "bg-secondary text-primary"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
            {confirmed && (
              <button
                type="button"
                onClick={() => clearHijriMonthStart(year, month)}
                className="ms-auto rounded-full px-3 py-1.5 text-[11px] text-muted-foreground"
              >
                العودة للحساب
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            يُطبَّق على هذا الشهر وحده، ويتبعه ما بعده. الإزاحة العامة من التقويم تبقى لبقية الأشهر.
          </p>
        </div>
      </div>
    </>
  );
}

/** «دخل أمس» / «دخل اليوم» / «يبدأ غدًا» / «يبدأ بعد غد» / أو التاريخ. */
function startLabel(d: number, date: Date): string {
  if (d === -1) return "دخل أمس";
  if (d === 0) return "دخل اليوم";
  if (d === 1) return "يبدأ غدًا";
  if (d === 2) return "يبدأ بعد غد";
  return `${formatWeekdayAr(date)} ${formatGregorianAr(date)}`;
}

/* ------------------------------ ٤.٢ ملخص الموسم ------------------------------ */

export function SeasonSummaryCard({ st, now }: { st: SeasonState; now: Date }) {
  const { store } = useSeasonsStore();
  const { log } = useActivityLog();
  const { adjust } = useHijriAdjust();
  const history = useSeasonHistory();
  const annual = st.instance.season.cycle.kind === "annual";

  const summary = useMemo(
    () => seasonSummary(st.instance, planFor(store, st.instance.key), log, now, adjust),
    [st.instance, store, log, now, adjust],
  );
  const prev = annual ? previousSummary(history, summary) : null;

  /* السجل (٤.٣): ملخص كل نسخة سنوية يُحفظ مستقلاً عن الخطط. */
  useEffect(() => {
    if (annual) recordSeasonSummary(summary);
  }, [annual, summary]);

  if (!summaryHasContent(summary)) return null;

  const share = async () => {
    const r = await shareCardText(summaryShareText(summary));
    if (r === "copied") toast.success("نُسخ الملخص");
  };

  const prevGoal = (id: string) => prev?.goals.find((g) => g.id === id);

  return (
    <>
      <SectionLabel hint={st.status === "ended" ? "انتهى الموسم" : "حتى اليوم"}>
        حصيلتي في {summary.title}
      </SectionLabel>
      <div className="space-y-2 px-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          {summary.goals.length > 0 && (
            <ul className="space-y-2">
              {summary.goals.map((g) => {
                const p = prevGoal(g.id);
                return (
                  <li key={g.id} className="flex items-center gap-2 text-[12px]">
                    <span className={g.complete ? "text-primary" : "text-muted-foreground"}>
                      <Icon d={g.complete ? icons.check : icons.target} size={14} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{g.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {g.once
                        ? g.complete
                          ? "تمّ"
                          : "لم يتمّ"
                        : `${toArabicDigits(g.done)} / ${toArabicDigits(g.target)} ${dayUnit(g.target)}`}
                    </span>
                    {p && prev && !g.once && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        ({toArabicDigits(prev.hijriYear)}: {toArabicDigits(p.done)})
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="صلوات مسجّلة" value={summary.totals.prayers} prev={prev?.totals.prayers} />
            <Stat label="آيات مقروءة" value={summary.totals.ayahs} prev={prev?.totals.ayahs} />
            <Stat
              label="أيام نشطة"
              value={summary.totals.activeDays}
              prev={prev?.totals.activeDays}
            />
          </div>
          {prev && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              بين القوسين: {summary.title} {toArabicDigits(prev.hijriYear)}هـ.
            </p>
          )}
          <button
            type="button"
            onClick={() => void share()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2 text-[12px] font-medium text-primary"
          >
            <Icon d={icons.share} size={14} />
            مشاركة الحصيلة
          </button>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, prev }: { label: string; value: number; prev?: number }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-2">
      <div className="font-display text-lg tabular-nums">{toArabicDigits(value)}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {prev !== undefined && (
        <div className="text-[10px] text-muted-foreground">({toArabicDigits(prev)})</div>
      )}
    </div>
  );
}

/* ------------------------------ ٤.٦ الختمة ------------------------------ */

/** تقدّم الختمة داخل الموسم الذي فيه عمل «رتّب ختمتك». */
export function KhatmahCard() {
  const k = useKhatmah();
  const st = k.status;
  return (
    <>
      <SectionLabel>ختمتك</SectionLabel>
      <div className="px-4">
        <Link
          to="/quran/khatmah"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.quran} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            {st ? (
              <>
                <div className="text-sm font-medium">
                  {st.phase === "finished"
                    ? "أتممت الختمة"
                    : `${toArabicDigits(Math.round(st.progress * 100))}٪ · اليوم ${toArabicDigits(st.day)} من ${toArabicDigits(k.plan?.days ?? 0)}`}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {khatmahLine(st.behind, st.ahead, st.todayDone, st.phase)}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium">لا ختمة جارية</div>
                <div className="text-[11px] text-muted-foreground">ابدأ ختمة بوِرد يومي يناسبك</div>
              </>
            )}
          </div>
          <span className="text-muted-foreground">
            <Icon d={icons.chevron} size={16} />
          </span>
        </Link>
      </div>
    </>
  );
}
