/* منار — دمج نسختين من بيانات المستخدم (نقي، بلا window).
 *
 * يُستعمل في «بياناتي» عند استيراد ملف نسخة احتياطية بخيار «دمج»: بيانات الجهاز
 * تفوز في القيم المفردة، والسجلات التراكمية (السجل اليومي، سجلّ القراءة،
 * محفوظات الأذكار) تُدمج دمجاً بنيوياً فلا يضيع يوم سُجّل في نسخة واحدة فقط.
 *
 * (كان هذا منطق المزامنة السحابية قبل حذفها في #56؛ بقي منه الدمج وحده.)
 *
 * القيم تُحفظ نصّاً خاماً كما هي في localStorage — لا تحويل ولا فقد.
 */

import { mergeAzkarProgress } from "./azkar/merge";

/** قيمة مفتاح واحد: النص الخام أو `null` إن حُذف، مع ختم آخر تعديل. */
export type SyncEntry = { v: string | null; at: number };

const ACTIVITY_KEY = "manar.activity.v1";
const HISTORY_KEY = "manar.quran.history.v1";
const AZKAR_KEY = "manar.azkar.progress.v1";
const MAX_ACTIVITY_DAYS = 730;

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/* ------------------------------------------------------------------ */
/*  الدمج البنيوي                                                     */
/* ------------------------------------------------------------------ */

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** السجل اليومي: اتحاد الأيام، واليوم المشترك تأخذه النسخة الأحدث. */
function mergeActivity(newer: string, older: string): string {
  const n = parse(newer);
  const o = parse(older);
  if (!isObject(n) || !isObject(n.days)) return newer;
  if (!isObject(o) || !isObject(o.days)) return newer;

  const days: Record<string, unknown> = { ...o.days, ...n.days };
  const keep = Object.keys(days).sort().slice(-MAX_ACTIVITY_DAYS);
  const trimmed: Record<string, unknown> = {};
  for (const k of keep) trimmed[k] = days[k];

  const bestStreak = Math.max(Number(n.bestStreak) || 0, Number(o.bestStreak) || 0);
  return JSON.stringify({ ...o, ...n, days: trimmed, bestStreak });
}

/** سجل القراءة: قائمة المواضع من الأحدث (يحترم الحذف)، والأيام والأبعد تراكمياً.
 *  إن كانت النسخة الأحدث فارغة تماماً فهي «مسح السجل» — تُحترم كما هي. */
function mergeHistory(newer: string, older: string): string {
  const n = parse(newer);
  const o = parse(older);
  if (!isObject(n) || !isObject(o)) return newer;

  const nDays = isObject(n.days) ? n.days : {};
  const nEntries = Array.isArray(n.entries) ? n.entries : [];
  const nPages = Array.isArray(n.pages) ? n.pages : [];
  const cleared =
    nEntries.length === 0 &&
    Object.keys(nDays).length === 0 &&
    !Number(n.furthest) &&
    nPages.length === 0;
  if (cleared) return newer;

  const days: Record<string, number> = {};
  const oDays = isObject(o.days) ? o.days : {};
  for (const src of [oDays, nDays]) {
    for (const [k, v] of Object.entries(src)) {
      const c = Number(v) || 0;
      days[k] = Math.max(days[k] ?? 0, c);
    }
  }
  const furthest = Math.max(Number(n.furthest) || 0, Number(o.furthest) || 0);
  // الصفحات المقروءة تراكمية: اتحاد النسختين.
  const oPages = Array.isArray(o.pages) ? o.pages : [];
  const pages = [...new Set([...oPages, ...nPages].map(Number).filter((x) => x >= 1 && x <= 604))]
    .map(Math.trunc)
    .sort((a, b) => a - b);
  return JSON.stringify({ ...o, ...n, entries: nEntries, days, furthest, pages });
}

const MERGERS: Record<string, (newer: string, older: string) => string> = {
  [ACTIVITY_KEY]: mergeActivity,
  [HISTORY_KEY]: mergeHistory,
  /* المحفوظات دائمة والعدّادات يومية في المفتاح نفسه — انظر azkar/merge. */
  [AZKAR_KEY]: mergeAzkarProgress,
};

export function hasStructuralMerge(key: string): boolean {
  return key in MERGERS;
}

/**
 * يدمج نسختي مفتاح واحد.
 * - مفتاح في جهة واحدة فقط ← يؤخذ كما هو.
 * - الأحدث يفوز؛ التعادل للجهاز (هو ما بين يدي المستخدم).
 * - المفاتيح التراكمية تُدمج بنيوياً إن كانت القيمتان موجودتين.
 */
export function mergeEntry(
  key: string,
  local: SyncEntry | undefined,
  other: SyncEntry | undefined,
): SyncEntry | undefined {
  if (!local) return other;
  if (!other) return local;

  const localWins = local.at >= other.at;
  const newer = localWins ? local : other;
  const older = localWins ? other : local;
  const at = Math.max(local.at, other.at);

  const merger = MERGERS[key];
  if (merger && newer.v != null && older.v != null) {
    return { v: merger(newer.v, older.v), at };
  }
  return { v: newer.v, at: newer.at };
}
