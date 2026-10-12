// ============================================================
// منار — المسبحة الإلكترونية: نموذج الجلسات (دوال نقية)
// ------------------------------------------------------------
// • نوع العدّاد صريح: `mode: "target"` بعدد هدف، أو `mode: "open"` بلا هدف —
//   لا يُمثَّل «غير المحدود» برقم كبير.
// • بلوغ الهدف لا يوقف العدّ ولا يبدأ دورة جديدة تلقائيًا؛ يُسجَّل وقته فقط.
// • التراجع لا ينزل تحت الصفر. بدء جلسة جديدة لا يمسح الجارية: تُوقَف مؤقتًا
//   وتبقى قابلة للمتابعة (إلا إن كانت فارغة بلا أي عدّة).
// ============================================================

import { parseCount } from "@/lib/personal-azkar/model";

export const TASBIH_TARGET_MAX = 100_000;
/** حدّ سجل الجلسات المنتهية المحفوظة (الأقدم يُحذف). */
export const HISTORY_MAX = 30;
/** حدّ الجلسات الموقوفة مؤقتًا. */
export const PAUSED_MAX = 10;

export type TasbihRef = { kind: "library" | "personal"; id: string };
export type TasbihMode = "target" | "open";
export type TasbihStatus = "active" | "paused" | "ended";

export interface TasbihSession {
  id: string;
  ref: TasbihRef;
  /** نسخة من الاسم والنص وقت البدء (تبقى في السجل ولو حُذف الذكر الشخصي). */
  name: string;
  text: string;
  mode: TasbihMode;
  /** `null` حين `mode === "open"`. */
  target: number | null;
  count: number;
  startedAt: number;
  updatedAt: number;
  status: TasbihStatus;
  /** أول وقت بلغ فيه العدّ الهدف (null = لم يبلغه). */
  reachedAt: number | null;
  endedAt: number | null;
}

export interface TasbihStore {
  v: 1;
  activeId: string | null;
  sessions: TasbihSession[];
}

export const emptyTasbihStore = (): TasbihStore => ({ v: 1, activeId: null, sessions: [] });

let seq = 0;
export function newSessionId(now = Date.now()): string {
  seq = (seq + 1) % 1_000_000;
  return `t-${now.toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------ التطبيع ------------------------------ */

const isStr = (v: unknown): v is string => typeof v === "string";
const isTime = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

function normalizeSession(raw: unknown): TasbihSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ref = r.ref as Record<string, unknown> | undefined;
  if (!isStr(r.id) || !ref || (ref.kind !== "library" && ref.kind !== "personal") || !isStr(ref.id))
    return null;
  const t = parseCount(r.target as number | null, TASBIH_TARGET_MAX);
  const target = r.mode === "open" ? null : t.ok ? t.value : null;
  const mode: TasbihMode = target == null ? "open" : "target";
  const count = Number.isSafeInteger(r.count) && (r.count as number) > 0 ? (r.count as number) : 0;
  const status: TasbihStatus =
    r.status === "active" || r.status === "paused" || r.status === "ended" ? r.status : "paused";
  const startedAt = isTime(r.startedAt) ? r.startedAt : 0;
  return {
    id: r.id,
    ref: { kind: ref.kind, id: ref.id },
    name: isStr(r.name) ? r.name : "",
    text: isStr(r.text) ? r.text : "",
    mode,
    target,
    count,
    startedAt,
    updatedAt: isTime(r.updatedAt) ? r.updatedAt : startedAt,
    status,
    reachedAt: target != null && count >= target && isTime(r.reachedAt) ? r.reachedAt : null,
    endedAt: status === "ended" && isTime(r.endedAt) ? r.endedAt : null,
  };
}

export function normalizeTasbihStore(raw: unknown): TasbihStore {
  if (!raw || typeof raw !== "object") return emptyTasbihStore();
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const sessions: TasbihSession[] = [];
  for (const s of Array.isArray(r.sessions) ? r.sessions : []) {
    const n = normalizeSession(s);
    if (n && !seen.has(n.id)) {
      seen.add(n.id);
      sessions.push(n);
    }
  }
  /* جلسة نشطة واحدة على الأكثر، ويطابقها `activeId`. */
  const wanted = isStr(r.activeId) ? r.activeId : null;
  let activeId: string | null = null;
  for (const s of sessions) {
    if (s.status !== "active") continue;
    if (activeId == null && (wanted == null || s.id === wanted)) activeId = s.id;
    else s.status = "paused";
  }
  if (activeId == null) {
    const first = sessions.find((s) => s.status === "active");
    if (first) activeId = first.id;
  }
  return prune({ v: 1, activeId, sessions });
}

/** يُبقي حدودًا معقولة للسجل والموقوف (الأحدث أولًا). */
function prune(store: TasbihStore): TasbihStore {
  const byRecent = (a: TasbihSession, b: TasbihSession) => b.updatedAt - a.updatedAt;
  const active = store.sessions.filter((s) => s.status === "active");
  const paused = store.sessions
    .filter((s) => s.status === "paused")
    .sort(byRecent)
    .slice(0, PAUSED_MAX);
  const ended = store.sessions
    .filter((s) => s.status === "ended")
    .sort(byRecent)
    .slice(0, HISTORY_MAX);
  return { ...store, sessions: [...active, ...paused, ...ended] };
}

/* ------------------------------ الاستعلام ------------------------------ */

export function activeSession(store: TasbihStore): TasbihSession | null {
  return store.sessions.find((s) => s.id === store.activeId && s.status === "active") ?? null;
}

export const pausedSessions = (store: TasbihStore) =>
  store.sessions.filter((s) => s.status === "paused").sort((a, b) => b.updatedAt - a.updatedAt);

export const endedSessions = (store: TasbihStore) =>
  store.sessions
    .filter((s) => s.status === "ended")
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));

export function hasProgress(s: TasbihSession | null): boolean {
  return Boolean(s && s.count > 0);
}

/** نسبة التقدّم (٠..١)، أو `null` للعدّاد المفتوح. */
export function progressRatio(s: Pick<TasbihSession, "count" | "target">): number | null {
  if (s.target == null) return null;
  return Math.min(1, s.count / s.target);
}

/* ------------------------------ العمليات ------------------------------ */

function patchActive(store: TasbihStore, fn: (s: TasbihSession) => TasbihSession): TasbihStore {
  const a = activeSession(store);
  if (!a) return store;
  const next = fn(a);
  if (next === a) return store;
  return { ...store, sessions: store.sessions.map((s) => (s.id === a.id ? next : s)) };
}

/** يُخرج الجلسة النشطة الحالية من النشاط: تُوقف إن كان فيها عدّ، وتُحذف إن كانت فارغة. */
function releaseActive(store: TasbihStore, now: number): TasbihStore {
  const a = activeSession(store);
  if (!a) return { ...store, activeId: null };
  const sessions =
    a.count > 0
      ? store.sessions.map((s) =>
          s.id === a.id ? { ...s, status: "paused" as const, updatedAt: now } : s,
        )
      : store.sessions.filter((s) => s.id !== a.id);
  return { ...store, activeId: null, sessions };
}

export interface StartInput {
  ref: TasbihRef;
  name: string;
  text: string;
  /** `null` = عدّاد مفتوح. */
  target: number | null;
}

export function startSession(
  store: TasbihStore,
  input: StartInput,
  now = Date.now(),
  id = newSessionId(now),
): TasbihStore {
  const t = parseCount(input.target, TASBIH_TARGET_MAX);
  const target = t.ok ? t.value : null;
  const session: TasbihSession = {
    id,
    ref: input.ref,
    name: input.name,
    text: input.text,
    mode: target == null ? "open" : "target",
    target,
    count: 0,
    startedAt: now,
    updatedAt: now,
    status: "active",
    reachedAt: null,
    endedAt: null,
  };
  const released = releaseActive(store, now);
  return prune({ ...released, activeId: id, sessions: [session, ...released.sessions] });
}

export interface TapResult {
  store: TasbihStore;
  /** صار العدّ مساويًا للهدف بهذه النقرة (لأول مرة). */
  reachedNow: boolean;
}

export function tap(store: TasbihStore, now = Date.now()): TapResult {
  let reachedNow = false;
  const next = patchActive(store, (s) => {
    if (s.count >= Number.MAX_SAFE_INTEGER) return s;
    const count = s.count + 1;
    const hit = s.target != null && count === s.target && s.reachedAt == null;
    if (hit) reachedNow = true;
    return { ...s, count, updatedAt: now, reachedAt: hit ? now : s.reachedAt };
  });
  return { store: next, reachedNow };
}

export function undo(store: TasbihStore, now = Date.now()): TasbihStore {
  return patchActive(store, (s) => {
    if (s.count <= 0) return s;
    const count = s.count - 1;
    return {
      ...s,
      count,
      updatedAt: now,
      reachedAt: s.target != null && count < s.target ? null : s.reachedAt,
    };
  });
}

export function resetCount(store: TasbihStore, now = Date.now()): TasbihStore {
  return patchActive(store, (s) =>
    s.count === 0 ? s : { ...s, count: 0, reachedAt: null, updatedAt: now },
  );
}

/** تغيير هدف الجلسة الجارية دون المساس بعدّها. */
export function setTarget(
  store: TasbihStore,
  target: number | null,
  now = Date.now(),
): TasbihStore {
  const t = parseCount(target, TASBIH_TARGET_MAX);
  if (!t.ok) return store;
  const value = t.value;
  return patchActive(store, (s) => ({
    ...s,
    target: value,
    mode: value == null ? "open" : "target",
    reachedAt: value != null && s.count >= value ? (s.reachedAt ?? now) : null,
    updatedAt: now,
  }));
}

/** إنهاء الجلسة: تدخل السجل إن كان فيها عدّ، وتُحذف إن كانت فارغة. */
export function endSession(store: TasbihStore, now = Date.now()): TasbihStore {
  const a = activeSession(store);
  if (!a) return store;
  const sessions =
    a.count > 0
      ? store.sessions.map((s) =>
          s.id === a.id ? { ...s, status: "ended" as const, endedAt: now, updatedAt: now } : s,
        )
      : store.sessions.filter((s) => s.id !== a.id);
  return prune({ ...store, activeId: null, sessions });
}

/** متابعة جلسة موقوفة؛ الجارية (إن وُجدت) تُوقف بدورها ولا تُمسح. */
export function resumeSession(store: TasbihStore, id: string, now = Date.now()): TasbihStore {
  const target = store.sessions.find((s) => s.id === id && s.status === "paused");
  if (!target) return store;
  const released = releaseActive(store, now);
  return {
    ...released,
    activeId: id,
    sessions: released.sessions.map((s) =>
      s.id === id ? { ...s, status: "active" as const, updatedAt: now } : s,
    ),
  };
}

/** حذف جلسة من السجل أو من الموقوفة. */
export function deleteSession(store: TasbihStore, id: string): TasbihStore {
  return {
    ...store,
    activeId: store.activeId === id ? null : store.activeId,
    sessions: store.sessions.filter((s) => s.id !== id),
  };
}

export function clearHistory(store: TasbihStore): TasbihStore {
  return { ...store, sessions: store.sessions.filter((s) => s.status !== "ended") };
}

/** دمج نسختين (للاستعادة الاحتياطية): اتحاد بالمعرّف، والأحدث تعديلًا يغلب. */
export function mergeTasbihStores(local: unknown, incoming: unknown): TasbihStore {
  const a = normalizeTasbihStore(local);
  const b = normalizeTasbihStore(incoming);
  const map = new Map<string, TasbihSession>();
  for (const s of [...a.sessions, ...b.sessions]) {
    const prev = map.get(s.id);
    if (!prev || s.updatedAt > prev.updatedAt) map.set(s.id, s);
  }
  /* الجلسة النشطة محلية؛ الواردة النشطة تصير موقوفة. */
  const sessions = [...map.values()].map((s) =>
    s.status === "active" && s.id !== a.activeId ? { ...s, status: "paused" as const } : s,
  );
  return normalizeTasbihStore({ v: 1, activeId: a.activeId, sessions });
}
