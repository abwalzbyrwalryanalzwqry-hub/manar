/* منار — المزامنة السحابية (Supabase).
 *
 * كل جدول سحابي يحمل عمود `data` بصيغة `{ __sync: 2, entries }`، ولكل مفتاح
 * ختم آخر تعديل. المزامنة عملية واحدة ثنائية الاتجاه (`syncNow`): تقرأ السحابة،
 * تدمج مع الجهاز مفتاحاً مفتاحاً (`sync-merge.ts`)، ثم تكتب النتيجة في الجهتين.
 * لا يوجد بعد اليوم «سحب يكتب فوق كل شيء» ولا «رفع يكتب فوق كل شيء».
 *
 * أخطاء Supabase لم تعد تُبتلع: تُرمى لتظهر للمستخدم وتُسجَّل في حالة المزامنة.
 */

import { getCloud } from "@/integrations/supabase/optional-client";
import {
  decodePayload,
  encodePayload,
  fingerprint,
  isLegacyPayload,
  mergeEntry,
  type SyncEntries,
  type SyncEntry,
} from "./sync-merge";

/** الجدول السحابي ← مفاتيح localStorage التي يحملها. */
export const SYNC_MAP: Record<string, string[]> = {
  user_settings: [
    "manar.appearance.v1",
    "manar.hijri.adjust.v1",
    "manar.widget.v1",
    "manar.azkar.prefs.v1",
  ],
  prayer_preferences: ["manar.settings.v1", "manar.location.v1"],
  notification_preferences: ["manar.adhan-settings.v2"],
  reading_progress: [
    "manar.quran.history.v1",
    "manar.quran.bookmarks.v1",
    "manar.quran.reading-prefs.v1",
    "manar.azkar.progress.v1",
    "manar.wird.progress.v1",
    "manar.khatmah.v1",
  ],
  achievement_progress: ["manar.activity.v1"],
};

export const SYNCED_KEYS: string[] = Object.values(SYNC_MAP).flat();

/** الحدث الذي تستمع إليه كل وحدة لتعيد قراءة مفتاحها بعد الاستعادة. */
export const KEY_EVENTS: Record<string, string> = {
  "manar.appearance.v1": "manar:appearance",
  "manar.hijri.adjust.v1": "manar:hijri-adjust",
  "manar.settings.v1": "manar:settings",
  "manar.location.v1": "manar:location",
  "manar.adhan-settings.v2": "manar:adhan-settings",
  "manar.quran.history.v1": "manar:quran-history",
  "manar.quran.bookmarks.v1": "manar:quran-bookmarks",
  "manar.quran.reading-prefs.v1": "manar:reading-prefs",
  "manar.azkar.progress.v1": "manar:azkar-progress",
  "manar.wird.progress.v1": "manar:wird-progress",
  "manar.khatmah.v1": "manar:khatmah",
  "manar.activity.v1": "manar:activity",
  "manar.widget.v1": "manar:widget-settings",
  "manar.azkar.prefs.v1": "manar:azkar-prefs",
};

/* ------------------------------------------------------------------ */
/*  بيانات المزامنة المحلية (تُطابَق أصلياً لأنها تبدأ بـ manar.)       */
/* ------------------------------------------------------------------ */

export const META_KEY = "manar.sync.meta.v1";

export type SyncMeta = {
  /** آخر حساب تمت مزامنته على هذا الجهاز. */
  user: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
  /** بصمة كل مفتاح وختم آخر تعديل رُصد له. */
  keys: Record<string, { h: string; at: number }>;
};

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const EMPTY_META: SyncMeta = { user: null, lastSyncAt: null, lastError: null, keys: {} };

export function readMeta(store: KV): SyncMeta {
  try {
    const raw = store.getItem(META_KEY);
    if (!raw) return { ...EMPTY_META, keys: {} };
    const p = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      user: typeof p.user === "string" ? p.user : null,
      lastSyncAt: typeof p.lastSyncAt === "number" ? p.lastSyncAt : null,
      lastError: typeof p.lastError === "string" ? p.lastError : null,
      keys: p.keys && typeof p.keys === "object" ? p.keys : {},
    };
  } catch {
    return { ...EMPTY_META, keys: {} };
  }
}

function writeMeta(store: KV, meta: SyncMeta) {
  try {
    store.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota */
  }
}

/**
 * يرصد المفاتيح التي تغيّر محتواها منذ آخر رصد ويختمها بالوقت الحالي.
 * أول رصد لمفتاح موجود مسبقاً يأخذ ختم ٠ (عمره مجهول) حتى لا تتغلّب قيم قديمة
 * على نسخة سحابية أحدث. يعيد `true` إن تغيّر شيء.
 */
export function stampLocalChanges(
  store: KV,
  now = Date.now(),
  /** مفاتيح بعينها فقط (من أحداثها) بدل بصمة كل المفاتيح في كل مرة. */
  only?: Iterable<string>,
): boolean {
  const meta = readMeta(store);
  let changed = false;
  const keys = only ? [...only].filter((k) => SYNCED_KEYS.includes(k)) : SYNCED_KEYS;
  if (only && keys.length === 0) return false;
  for (const key of keys) {
    const h = fingerprint(store.getItem(key));
    const m = meta.keys[key];
    if (!m) {
      meta.keys[key] = { h, at: 0 };
      changed = changed || h !== "-";
    } else if (m.h !== h) {
      meta.keys[key] = { h, at: now };
      changed = true;
    }
  }
  writeMeta(store, meta);
  return changed;
}

/** هل على الجهاز تعديلات لم تُرفع بعد؟ */
export function hasPendingChanges(store: KV): boolean {
  const meta = readMeta(store);
  const since = meta.lastSyncAt ?? 0;
  return SYNCED_KEYS.some((k) => (meta.keys[k]?.at ?? 0) > since);
}

/* ------------------------------------------------------------------ */
/*  محرّك المزامنة (قابل للاختبار: التخزين والسحابة يُحقنان)            */
/* ------------------------------------------------------------------ */

export type SyncBackend = {
  fetch(table: string): Promise<unknown>;
  save(table: string, data: unknown): Promise<void>;
};

export type SyncMode =
  /** الأحدث يفوز لكل مفتاح (الافتراضي). */
  | "merge"
  /** استرجاع صريح طلبه المستخدم: نسخة السحابة تفوز حيث وُجدت. */
  | "prefer-cloud";

export type SyncResult = {
  /** المفاتيح التي تغيّرت على الجهاز. */
  updatedLocal: string[];
  /** الجداول التي كُتبت في السحابة. */
  updatedTables: string[];
};

export async function runSync(
  store: KV,
  backend: SyncBackend,
  userId: string,
  mode: SyncMode = "merge",
  now = Date.now(),
): Promise<SyncResult> {
  stampLocalChanges(store, now);
  const meta = readMeta(store);
  /* أول مزامنة لهذا الحساب على هذا الجهاز: نعامل قيم الجهاز كمجهولة العمر،
   * فتفوز أي نسخة سحابية مختومة (استعادة على جهاز جديد)، بينما تفوز قيم الجهاز
   * على النسخ السحابية القديمة غير المختومة. */
  const firstSync = meta.user !== userId;

  const tables = Object.keys(SYNC_MAP);
  const rows = await Promise.all(tables.map((t) => backend.fetch(t)));

  const updatedLocal: string[] = [];
  const updatedTables: string[] = [];

  for (let i = 0; i < tables.length; i += 1) {
    const table = tables[i];
    const raw = rows[i];
    const cloudEntries = decodePayload(raw);
    const next: SyncEntries = { ...cloudEntries };
    let cloudDirty = isLegacyPayload(raw);

    for (const key of SYNC_MAP[table]) {
      const value = store.getItem(key);
      const m = meta.keys[key];
      let localAt = m?.at ?? 0;
      if (firstSync) localAt = 0;
      if (mode === "prefer-cloud") localAt = -1;

      let local: SyncEntry | undefined;
      if (value != null) local = { v: value, at: localAt };
      else if (m && m.at > 0 && !firstSync) local = { v: null, at: localAt }; // حُذف محلياً

      const cloud = cloudEntries[key];
      const merged = mergeEntry(key, local, cloud);
      if (!merged) continue;

      if (merged.v !== value) {
        if (merged.v == null) store.removeItem(key);
        else store.setItem(key, merged.v);
        updatedLocal.push(key);
      }
      const stamp = Math.max(0, merged.at);
      meta.keys[key] = { h: fingerprint(merged.v), at: stamp };

      if (!cloud || cloud.v !== merged.v || cloud.at !== stamp) {
        next[key] = { v: merged.v, at: stamp };
        cloudDirty = true;
      }
    }

    if (cloudDirty) {
      await backend.save(table, encodePayload(next));
      updatedTables.push(table);
    }
  }

  meta.user = userId;
  meta.lastSyncAt = now;
  meta.lastError = null;
  writeMeta(store, meta);
  return { updatedLocal, updatedTables };
}

/* ------------------------------------------------------------------ */
/*  الواجهة العامة للتطبيق                                              */
/* ------------------------------------------------------------------ */

function supabaseBackend(userId: string): SyncBackend | null {
  const cloud = getCloud();
  if (!cloud) return null;
  return {
    async fetch(table) {
      const { data, error } = await cloud
        .from(table as "user_settings")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`تعذّر قراءة ${table}: ${error.message}`);
      return data?.data ?? null;
    },
    async save(table, data) {
      const { error } = await cloud
        .from(table as "user_settings")
        .upsert({ user_id: userId, data: data as never });
      if (error) throw new Error(`تعذّر حفظ ${table}: ${error.message}`);
    },
  };
}

let chain: Promise<unknown> = Promise.resolve();

/** مزامنة ثنائية الاتجاه. العمليات متسلسلة فلا تتسابق مزامنتان. */
export function syncNow(userId: string, mode: SyncMode = "merge"): Promise<SyncResult | null> {
  const job = chain.then(async () => {
    const backend = supabaseBackend(userId);
    if (!backend || typeof window === "undefined") return null;
    const store = window.localStorage;
    try {
      const result = await runSync(store, backend, userId, mode);
      for (const key of result.updatedLocal) {
        const evt = KEY_EVENTS[key];
        if (evt) window.dispatchEvent(new Event(evt));
      }
      if (result.updatedLocal.length > 0) {
        window.dispatchEvent(new CustomEvent("manar:cloud-restored"));
      }
      window.dispatchEvent(new CustomEvent("manar:sync-status"));
      return result;
    } catch (e) {
      const meta = readMeta(store);
      meta.lastError = e instanceof Error ? e.message : String(e);
      writeMeta(store, meta);
      window.dispatchEvent(new CustomEvent("manar:sync-status"));
      throw e;
    }
  });
  chain = job.catch(() => undefined);
  return job;
}

/** رفع ودمج (زرّ «نسخة احتياطية»). */
export function pushAll(userId: string) {
  return syncNow(userId, "merge");
}

/** استرجاع صريح: نسخة السحابة تفوز. */
export function pullAll(userId: string) {
  return syncNow(userId, "prefer-cloud");
}

/** عند الدخول: دمج آمن بالاتجاهين. */
export function syncOnLogin(userId: string) {
  return syncNow(userId, "merge");
}
