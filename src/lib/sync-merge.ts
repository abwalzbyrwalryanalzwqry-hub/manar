/* منار — منطق دمج المزامنة السحابية (نقي، بلا window ولا Supabase).
 *
 * المشكلة التي يحلّها: النسخة السابقة كانت تسحب السحابة وتكتبها فوق الجهاز
 * بالكامل («السحابة تفوز») عند كل إقلاع، بلا أي مقارنة زمنية. فكل ما سجّله
 * المستخدم دون اتصال — صلوات، آيات، علامات، تقدّم الورد — يُستبدل بنسخة أقدم.
 *
 * الحل:
 *   - كل مفتاح يحمل ختماً زمنياً `at` لآخر تعديل فعلي (بالمللي ثانية).
 *   - القاعدة العامة: الأحدث يفوز، وعند التعادل يفوز الجهاز.
 *   - السجلات التراكمية (السجل اليومي، أيام القراءة) تُدمج دمجاً بنيوياً فلا
 *     يضيع يوم سُجّل على جهاز واحد فقط.
 *
 * القيم تُحفظ نصّاً خاماً كما هي في localStorage — لا تحويل ولا فقد.
 */

export const SYNC_FORMAT = 2;

/** قيمة مفتاح واحد: النص الخام أو `null` إن حُذف، مع ختم آخر تعديل. */
export type SyncEntry = { v: string | null; at: number };
export type SyncEntries = Record<string, SyncEntry>;
export type SyncPayload = { __sync: typeof SYNC_FORMAT; entries: SyncEntries };

const ACTIVITY_KEY = "manar.activity.v1";
const HISTORY_KEY = "manar.quran.history.v1";
const MAX_ACTIVITY_DAYS = 730;

/* ------------------------------------------------------------------ */
/*  الترميز                                                           */
/* ------------------------------------------------------------------ */

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function toStamp(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/**
 * يقرأ عمود `data` من السحابة بأي من الصيغتين:
 *   - الصيغة ٢: `{ __sync: 2, entries: { key: { v, at } } }`
 *   - الصيغة القديمة: `{ key: parsedJson }` — تُعامل بختم ٠ (عمر مجهول).
 */
export function decodePayload(raw: unknown): SyncEntries {
  const out: SyncEntries = {};
  if (!isObject(raw)) return out;

  if (raw.__sync === SYNC_FORMAT && isObject(raw.entries)) {
    for (const [key, e] of Object.entries(raw.entries)) {
      if (!isObject(e)) continue;
      const v = typeof e.v === "string" ? e.v : null;
      out[key] = { v, at: toStamp(e.at) };
    }
    return out;
  }

  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    out[key] = { v: typeof value === "string" ? value : JSON.stringify(value), at: 0 };
  }
  return out;
}

export function encodePayload(entries: SyncEntries): SyncPayload {
  return { __sync: SYNC_FORMAT, entries };
}

export function isLegacyPayload(raw: unknown): boolean {
  return isObject(raw) && raw.__sync !== SYNC_FORMAT && Object.keys(raw).length > 0;
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
  const cleared = nEntries.length === 0 && Object.keys(nDays).length === 0 && !Number(n.furthest);
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
  return JSON.stringify({ ...o, ...n, entries: nEntries, days, furthest });
}

const MERGERS: Record<string, (newer: string, older: string) => string> = {
  [ACTIVITY_KEY]: mergeActivity,
  [HISTORY_KEY]: mergeHistory,
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
  cloud: SyncEntry | undefined,
): SyncEntry | undefined {
  if (!local) return cloud;
  if (!cloud) return local;

  const localWins = local.at >= cloud.at;
  const newer = localWins ? local : cloud;
  const older = localWins ? cloud : local;
  const at = Math.max(local.at, cloud.at);

  const merger = MERGERS[key];
  if (merger && newer.v != null && older.v != null) {
    return { v: merger(newer.v, older.v), at };
  }
  return { v: newer.v, at: newer.at };
}

/* ------------------------------------------------------------------ */
/*  بصمة المحتوى                                                      */
/* ------------------------------------------------------------------ */

/** بصمة FNV-1a سريعة لاكتشاف تغيّر قيمة دون تخزين نسخة منها. */
export function fingerprint(raw: string | null): string {
  if (raw == null) return "-";
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}:${raw.length}`;
}
