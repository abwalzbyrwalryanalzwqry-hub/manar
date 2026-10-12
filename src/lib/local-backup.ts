/* منار — بياناتي: نسخ احتياطي محلي بلا حساب ولا خادم.
 *
 * حلّ هذا محلّ الحساب والمزامنة السحابية. كل ما يخصّ المستخدم يعيش على جهازه،
 * ويسافر معه بطريقين:
 *   · نسخ Google الاحتياطي لأندرويد (تلقائي): المفاتيح تُطابَق في
 *     Capacitor Preferences (`persistent-storage.ts`) وهذا الملف مشمول في
 *     `backup_rules.xml`، فيعود كل شيء عند نقل الحساب إلى هاتف جديد.
 *   · ملف نسخة احتياطية (يدوي): `buildBackup` يكتب المفاتيح في ملف JSON واحد
 *     يرسله المستخدم لنفسه، و`applyBackup` يستعيده دمجاً أو استبدالاً.
 *
 * الدوال هنا نقيّة على مخزن `KV` لتُختبر دون متصفح.
 */

import { hasStructuralMerge, mergeEntry } from "./sync-merge";
import { mergePersonalStores } from "./personal-azkar/model";
import { mergeTasbihStores } from "./tasbih/session";

/** كل مفتاح يخصّ المستخدم ويُحمل في النسخة الاحتياطية. */
export const BACKUP_KEYS: string[] = [
  /* المظهر والعرض */
  "manar.appearance.v1",
  "manar.display.v1",
  "manar.hijri.adjust.v1",
  "manar.hijri.at-maghrib.v1",
  "manar.hijri.month-starts.v1",
  "manar.widget.v1",
  "manar.user.name.v1",
  /* الصلاة والموقع */
  "manar.settings.v1",
  "manar.location.v1",
  /* التنبيهات */
  "manar.adhan-settings.v2",
  "manar.daily-reminders.v1",
  "manar.sakinah.v1",
  /* الأذكار */
  "manar.azkar.prefs.v1",
  "manar.azkar.progress.v1",
  /* القرآن */
  "manar.quran.recitation.prefs.v1",
  "manar.quran.tafsir.edition.v1",
  "manar.quran.tafsir.font.v1",
  "manar.quran.history.v1",
  "manar.quran.bookmarks.v1",
  "manar.quran.reading-prefs.v1",
  "manar.quran.reader.v1",
  "manar.wird.progress.v1",
  /* الأذكار الشخصية والمسبحة */
  "manar.azkar.custom.v1",
  "manar.tasbih.v1",
  "manar.tasbih.prefs.v1",
  "manar.khatmah.v1",
  /* المواسم والإحصائيات */
  "manar.seasons.v1",
  "manar.seasons.history.v1",
  "manar.activity.v1",
  "manar.jumuah.v1",
  "manar.qada.v1",
];

/** مفاتيح تخصّ هذا الجهاز فقط ولا تدخل النسخة (ذاكرات مؤقتة، ملفات محمّلة…). */
export const DEVICE_ONLY_KEYS = new Set([
  "manar.bootguard.v1", // تشخيص إقلاع هذا الجهاز
  "manar.onboarded.v1", // الترحيب يظهر مرة على كل جهاز
  "manar.prayer-cache.v1", // ذاكرة مؤقتة تُعاد حسابها
  "manar.quran.recitation.downloads.v1", // ملفات صوتية محمَّلة على هذا الجهاز فقط
  "manar.quran.search.recent.v1", // سجل بحث محلي
  "manar.backup.last-export.v1", // تاريخ آخر تصدير من هذا الجهاز
  "manar.more.usage.v1", // «الأكثر استخداماً» في المزيد: عادة هذا الجهاز
  "manar.zone-banner.dismissed.v1", // شارة المنطقة الزمنية التي أخفاها المستخدم على هذا الجهاز
  "manar.method-suggest.v1", // اقتراحات طريقة الحساب التي رفضها المستخدم على هذا الجهاز
]);

/** تاريخ آخر تصدير لملف النسخة من هذا الجهاز (مللي ثانية). */
export const LAST_EXPORT_KEY = "manar.backup.last-export.v1";

/** مفاتيح من عهد الحساب والمزامنة تُمسح عند إعادة الضبط. */
export const LEGACY_KEYS = ["manar.sync.meta.v1", "manar-guest-mode"];

/** الحدث الذي تستمع إليه كل وحدة لتعيد قراءة مفتاحها. */
export const KEY_EVENTS: Record<string, string> = {
  "manar.appearance.v1": "manar:appearance",
  "manar.hijri.adjust.v1": "manar:hijri-adjust",
  "manar.hijri.at-maghrib.v1": "manar:hijri-adjust",
  "manar.hijri.month-starts.v1": "manar:hijri-adjust",
  "manar.widget.v1": "manar:widget-settings",
  "manar.user.name.v1": "manar:user-name",
  "manar.settings.v1": "manar:settings",
  "manar.location.v1": "manar:location",
  "manar.adhan-settings.v2": "manar:adhan-settings",
  "manar.daily-reminders.v1": "manar:daily-reminders",
  "manar.sakinah.v1": "manar:sakinah",
  "manar.azkar.prefs.v1": "manar:azkar-prefs",
  "manar.azkar.progress.v1": "manar:azkar-progress",
  "manar.quran.recitation.prefs.v1": "manar:recitation-prefs",
  "manar.quran.tafsir.edition.v1": "manar:tafsir-edition",
  "manar.quran.tafsir.font.v1": "manar:tafsir-font",
  "manar.quran.history.v1": "manar:quran-history",
  "manar.quran.bookmarks.v1": "manar:quran-bookmarks",
  "manar.quran.reading-prefs.v1": "manar:reading-prefs",
  "manar.quran.reader.v1": "manar:reader-state",
  "manar.wird.progress.v1": "manar:wird-progress",
  "manar.azkar.custom.v1": "manar:custom-azkar",
  "manar.tasbih.v1": "manar:tasbih",
  "manar.tasbih.prefs.v1": "manar:tasbih-prefs",
  "manar.khatmah.v1": "manar:khatmah",
  "manar.seasons.v1": "manar:seasons",
  "manar.seasons.history.v1": "manar:seasons-history",
  "manar.activity.v1": "manar:activity",
  "manar.display.v1": "manar:display",
  "manar.jumuah.v1": "manar:jumuah",
  "manar.qada.v1": "manar:qada",
};

export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const BACKUP_APP = "manar";
export const BACKUP_FORMAT = 1;
/** سقف حجم الملف المقبول — النسخ الحقيقية بضع مئات من الكيلوبايت. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export type ManarBackup = {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  /** وقت التصدير بالمللي ثانية. */
  exportedAt: number;
  /** رقم إصدار التطبيق الذي صدّر النسخة (للتشخيص فقط). */
  appVersion: string;
  /** مفتاح ← القيمة الخام كما في التخزين (نص JSON). */
  data: Record<string, string>;
};

/* ------------------------------------------------------------------ */
/*  التصدير                                                            */
/* ------------------------------------------------------------------ */

export function buildBackup(store: KV, now: number, appVersion: string): ManarBackup {
  const data: Record<string, string> = {};
  for (const k of BACKUP_KEYS) {
    const v = store.getItem(k);
    if (v != null) data[k] = v;
  }
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now, appVersion, data };
}

/** اسم ملف النسخة: `manar-backup-2026-09-27.json` (أرقام لاتينية لأسماء الملفات). */
export function backupFileName(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `manar-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

/* ------------------------------------------------------------------ */
/*  قراءة ملف النسخة والتحقق منه                                        */
/* ------------------------------------------------------------------ */

export type ParseResult = { ok: true; backup: ManarBackup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: "الملف أكبر من أن يكون نسخة احتياطية لمنار." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "الملف تالف أو ليس ملف JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "هذا ليس ملف نسخة احتياطية لمنار." };
  }
  const o = raw as Record<string, unknown>;
  if (o.app !== BACKUP_APP) return { ok: false, error: "هذا ليس ملف نسخة احتياطية لمنار." };
  if (typeof o.format !== "number" || o.format > BACKUP_FORMAT) {
    return { ok: false, error: "النسخة من إصدار أحدث من منار — حدّث التطبيق ثم أعد المحاولة." };
  }
  if (!o.data || typeof o.data !== "object" || Array.isArray(o.data)) {
    return { ok: false, error: "النسخة لا تحوي بيانات." };
  }
  /* لا نقبل إلا مفاتيح منار المعروفة وقيماً JSON صالحة: الملف قد يأتي من أي
   * مكان، ولا يجوز أن يكتب مفاتيح أخرى في التخزين أو قيماً تكسر الوحدات. */
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.data as Record<string, unknown>)) {
    if (!BACKUP_KEYS.includes(k) || typeof v !== "string") continue;
    try {
      JSON.parse(v);
    } catch {
      continue;
    }
    data[k] = v;
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, error: "النسخة فارغة — لا إعدادات ولا تقدّم فيها." };
  }
  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      exportedAt: typeof o.exportedAt === "number" ? o.exportedAt : 0,
      appVersion: typeof o.appVersion === "string" ? o.appVersion.slice(0, 32) : "",
      data,
    },
  };
}

/** ملخّص ما في النسخة ليُعرض قبل الاستيراد. */
export function summarizeBackup(b: ManarBackup) {
  const count = (k: string) => {
    try {
      const v = JSON.parse(b.data[k] ?? "null");
      return Array.isArray(v) ? v.length : 0;
    } catch {
      return 0;
    }
  };
  return {
    keys: Object.keys(b.data).length,
    bookmarks: count("manar.quran.bookmarks.v1"),
    hasSettings: "manar.settings.v1" in b.data || "manar.adhan-settings.v2" in b.data,
    hasActivity: "manar.activity.v1" in b.data,
    exportedAt: b.exportedAt,
  };
}

/* ------------------------------------------------------------------ */
/*  الاستيراد                                                          */
/* ------------------------------------------------------------------ */

export type ImportMode = "merge" | "replace";

const BOOKMARKS_KEY = "manar.quran.bookmarks.v1";
const PERSONAL_KEY = "manar.azkar.custom.v1";
const TASBIH_KEY = "manar.tasbih.v1";

/** دمج بنيوي لمخزن JSON؛ إن تعذّرت قراءة أحدهما يبقى ما على الجهاز. */
function mergeJson(local: string, file: string, fn: (a: unknown, b: unknown) => unknown): string {
  try {
    return JSON.stringify(fn(JSON.parse(local), JSON.parse(file)));
  } catch {
    return local;
  }
}

/** اتحاد العلامات بالمعرّف؛ علامة الجهاز تفوز إن وُجدت في الجهتين. */
function mergeBookmarks(local: string, file: string): string {
  try {
    const a = JSON.parse(local);
    const b = JSON.parse(file);
    if (!Array.isArray(a) || !Array.isArray(b)) return local;
    const seen = new Set(a.map((x: { id?: unknown }) => x?.id));
    return JSON.stringify([...a, ...b.filter((x: { id?: unknown }) => !seen.has(x?.id))]);
  } catch {
    return local;
  }
}

/**
 * يطبّق النسخة على المخزن ويعيد المفاتيح التي تغيّرت.
 * - `replace`: تُمسح بيانات الجهاز كلها وتحلّ النسخة محلّها.
 * - `merge`: يبقى ما على الجهاز، ويُضاف ما ينقصه من النسخة، وتُضمّ البيانات
 *   التراكمية (العلامات، سجلّ القراءة، الإحصائيات، محفوظات الأذكار).
 */
export function applyBackup(store: KV, b: ManarBackup, mode: ImportMode): string[] {
  const changed: string[] = [];
  if (mode === "replace") {
    for (const k of BACKUP_KEYS) {
      const next = b.data[k] ?? null;
      if (store.getItem(k) === next) continue;
      if (next == null) store.removeItem(k);
      else store.setItem(k, next);
      changed.push(k);
    }
    return changed;
  }
  for (const [k, fileV] of Object.entries(b.data)) {
    const localV = store.getItem(k);
    let next: string;
    if (localV == null) next = fileV;
    else if (k === BOOKMARKS_KEY) next = mergeBookmarks(localV, fileV);
    else if (k === PERSONAL_KEY) next = mergeJson(localV, fileV, mergePersonalStores);
    else if (k === TASBIH_KEY) next = mergeJson(localV, fileV, mergeTasbihStores);
    else if (hasStructuralMerge(k)) {
      /* الجهاز «الأحدث» فيفوز في القيم المفردة، والدمج البنيوي يضمّ الباقي. */
      next = mergeEntry(k, { v: localV, at: 1 }, { v: fileV, at: 0 })?.v ?? localV;
    } else next = localV;
    if (next !== localV) {
      store.setItem(k, next);
      changed.push(k);
    }
  }
  return changed;
}

/** يمسح كل بيانات المستخدم من الجهاز (إعادة ضبط). يبقى أن التعريف قد تمّ. */
export function clearUserData(store: KV): string[] {
  const removed = BACKUP_KEYS.filter((k) => store.getItem(k) != null);
  for (const k of [...BACKUP_KEYS, ...LEGACY_KEYS]) store.removeItem(k);
  return removed;
}

/** هل على الجهاز أيّ بيانات للمستخدم؟ */
export function hasUserData(store: KV): boolean {
  return BACKUP_KEYS.some((k) => store.getItem(k) != null);
}
