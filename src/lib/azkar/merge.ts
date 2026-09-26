// ============================================================
// Manar — دمج تقدّم الأذكار بين الأجهزة (نقي، بلا React ولا window)
// ------------------------------------------------------------
// المفتاح `manar.azkar.progress.v1` يجمع شيئين مختلفين:
//   - المحفوظات: دائمة، تُضاف وتُحذف في أي وقت.
//   - العدّادات والمكتمل: ليوم واحد فقط.
// قاعدة «الأحدث يفوز» على المفتاح كله كانت تمسح محفوظًا أُضيف على جهاز إذا
// عُدّ ذكرٌ لاحقًا على جهاز آخر. هنا يُدمج كل جزء بما يناسبه:
//   - المحفوظات: سجل لكل ذكر {on, at}؛ آخر فعل (حفظ/حذف) يفوز لكل ذكر وحده.
//   - العدّادات: اليوم الأحدث يفوز؛ وفي اليوم نفسه الأكبر لكل ذكر، واتحاد المكتمل.
//   - آخر موضع: الأحدث بوقته.
// ============================================================

export type BookmarkEvent = { on: boolean; at: number };
export type BookmarkLog = Record<string, BookmarkEvent>;

/** سقف سجل المحفوظات (الحذف القديم يُنسى بعده، والمحفوظ لا يُحذف أبدًا). */
export const MAX_BOOKMARK_LOG = 400;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);

function parse(raw: string): Obj | null {
  try {
    const v = JSON.parse(raw);
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}

function ids(x: unknown): number[] {
  return Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : [];
}

export function normalizeBookmarkLog(x: unknown): BookmarkLog {
  const out: BookmarkLog = {};
  if (!isObj(x)) return out;
  for (const [k, v] of Object.entries(x)) {
    if (!/^\d+$/.test(k) || !isObj(v) || typeof v.on !== "boolean") continue;
    const at = Number(v.at);
    out[k] = { on: v.on, at: Number.isFinite(at) && at > 0 ? at : 0 };
  }
  return out;
}

/** سجل فعلي لكل ذكر: ما في السجل، وما في القائمة بلا سجل (نسخة قديمة) = محفوظ بختم ٠. */
function effectiveLog(p: Obj): BookmarkLog {
  const log = normalizeBookmarkLog(p.bookmarkLog);
  for (const id of ids(p.bookmarks)) {
    const k = String(id);
    if (!log[k]) log[k] = { on: true, at: 0 };
  }
  return log;
}

/** يقلّم السجل: المحفوظ يبقى كله، والمحذوف الأحدث فقط حتى السقف. */
export function pruneBookmarkLog(log: BookmarkLog): BookmarkLog {
  const entries = Object.entries(log);
  if (entries.length <= MAX_BOOKMARK_LOG) return log;
  const on = entries.filter(([, e]) => e.on);
  const off = entries
    .filter(([, e]) => !e.on)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, Math.max(0, MAX_BOOKMARK_LOG - on.length));
  return Object.fromEntries([...on, ...off]);
}

export function mergeBookmarks(
  newer: Obj,
  older: Obj,
): { bookmarks: number[]; bookmarkLog: BookmarkLog } {
  const n = effectiveLog(newer);
  const o = effectiveLog(older);
  const log: BookmarkLog = { ...o };
  for (const [k, e] of Object.entries(n)) {
    const prev = log[k];
    /* التعادل للنسخة الأحدث. */
    if (!prev || e.at >= prev.at) log[k] = e;
  }
  /* الترتيب: ترتيب النسخة الأحدث، ثم ما أُضيف على الجهاز الآخر. */
  const order = [...ids(newer.bookmarks), ...ids(older.bookmarks)];
  const seen = new Set<number>();
  const bookmarks: number[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (log[String(id)]?.on) bookmarks.push(id);
  }
  /* محفوظ في السجل ولم يرد في أي قائمة (نادر): يُلحق آخرًا. */
  for (const [k, e] of Object.entries(log)) {
    if (e.on && !seen.has(Number(k))) bookmarks.push(Number(k));
  }
  return { bookmarks, bookmarkLog: pruneBookmarkLog(log) };
}

function counters(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(x)) return out;
  for (const [k, v] of Object.entries(x)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.trunc(n);
  }
  return out;
}

const strings = (x: unknown) => (Array.isArray(x) ? x.map(String) : []);
const lastAt = (x: unknown) => (isObj(x) && Number.isFinite(Number(x.at)) ? Number(x.at) : -1);

/** يدمج نسختين خامّتين (`newer` صاحبة الختم الأحدث). */
export function mergeAzkarProgress(newerRaw: string, olderRaw: string): string {
  const n = parse(newerRaw);
  const o = parse(olderRaw);
  if (!n) return newerRaw;
  if (!o) return newerRaw;

  const nDay = typeof n.day === "string" ? n.day : "";
  const oDay = typeof o.day === "string" ? o.day : "";
  let day = nDay;
  let c = counters(n.counters);
  let completed = strings(n.completed);
  if (oDay > nDay) {
    day = oDay;
    c = counters(o.counters);
    completed = strings(o.completed);
  } else if (oDay === nDay) {
    for (const [k, v] of Object.entries(counters(o.counters))) c[k] = Math.max(c[k] ?? 0, v);
    completed = [...new Set([...completed, ...strings(o.completed)])];
  }

  const last = lastAt(o.last) > lastAt(n.last) ? o.last : n.last;
  const updatedAt = Math.max(Number(n.updatedAt) || 0, Number(o.updatedAt) || 0) || null;

  return JSON.stringify({
    ...o,
    ...n,
    ...mergeBookmarks(n, o),
    counters: c,
    completed,
    day,
    last: last ?? null,
    updatedAt,
  });
}
