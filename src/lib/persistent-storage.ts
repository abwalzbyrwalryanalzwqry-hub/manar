/* منار — طبقة التخزين الدائم (Persistence Core)
 *
 * المشكلة: كل حالة التطبيق (الموقع، الإعدادات، إعدادات الأذان، تقدّم القرآن
 * والأذكار والورد، وجلسة الدخول) كانت محفوظة في `localStorage` داخل الـ WebView
 * فقط. تخزين الـ WebView عُرضة للمسح من النظام (تنظيف التخزين، Doze العدواني على
 * بعض أجهزة OEM، أو مسح بيانات التطبيق)، فيفقد المستخدم إعداداته وجلسته.
 *
 * الحل: مرآة مزدوجة.
 *
 *   - `localStorage` يبقى المصدر السريع والمتزامن الذي يقرأ منه كل الكود الحالي.
 *   - `@capacitor/preferences` (SharedPreferences الأصلية على أندرويد) هو المصدر
 *     الدائم. كل كتابة على مفتاح يخصّنا تُطابَق إليه فوراً.
 *   - عند الإقلاع نستعيد من الطبقة الأصلية إلى `localStorage` **قبل** أول رسم،
 *     فيجد المستخدم كل شيء من حيث توقف حتى بعد إعادة تشغيل الهاتف.
 *
 * المطابقة تُثبَّت على `Storage.prototype`، لذلك تعمل مع كل الوحدات الموجودة
 * (بما فيها عميل Supabase) دون تعديل أي منها.
 *
 * الجلسة منفصلة عن الحالة: رمز دخول Supabase يُحفظ في مجموعة Preferences خاصة
 * (`ManarSession` ← `ManarSession.xml`) مستثناة من النسخ الاحتياطي لأندرويد، بينما
 * تبقى الإعدادات والتقدّم في المجموعة الافتراضية (`CapacitorStorage`) وتُنسخ. هكذا
 * ينتقل تقدّم المستخدم إلى هاتفه الجديد، ولا ينتقل معه رمز الدخول — فلا تُفتح
 * الجلسة على جهاز آخر بمجرّد استعادة نسخة احتياطية. تخزين الـ WebView نفسه مستثنى
 * من النسخ أيضاً (راجع `android/app/src/main/res/xml/backup_rules.xml`).
 */

/** المفاتيح التي نطابقها: حالة منار + رمز جلسة Supabase. */
const MANAR_PREFIX = /^manar[.\-_]?/i;
const SUPABASE_AUTH = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/i;

export function isMirroredKey(key: string): boolean {
  return MANAR_PREFIX.test(key) || SUPABASE_AUTH.test(key);
}

/** مجموعة الحالة: تُنسخ احتياطياً (الاسم الافتراضي لإضافة Preferences). */
export const STATE_GROUP = "CapacitorStorage";
/** مجموعة الجلسة: مستثناة من النسخ الاحتياطي في قواعد أندرويد. */
export const SESSION_GROUP = "ManarSession";

export function isSessionKey(key: string): boolean {
  return SUPABASE_AUTH.test(key);
}

export function groupFor(key: string): string {
  return isSessionKey(key) ? SESSION_GROUP : STATE_GROUP;
}

/* ------------------------------------------------------------------ */
/*  الوصول إلى الطبقة الأصلية                                          */
/* ------------------------------------------------------------------ */

type PreferencesApi = {
  configure(o: { group: string }): Promise<void>;
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
};

let prefsPromise: Promise<PreferencesApi | null> | null = null;

function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
}

/** تحميل الإضافة عند الحاجة فقط — على الويب لا نحمّلها إطلاقاً. */
function nativePreferences(): Promise<PreferencesApi | null> {
  if (!isNativePlatform()) return Promise.resolve(null);
  if (!prefsPromise) {
    prefsPromise = import("@capacitor/preferences")
      .then((m) => {
        const p = m.Preferences;
        /* لا يجوز إعادة كائن الإضافة نفسه من سلسلة Promise: وكيل Capacitor
         * يعترض قراءة أي خاصية — بما فيها `then` — فيعتبره المحرّك "thenable"
         * وينادي `Preferences.then()`، وهي غير موجودة أصلاً، فيفشل التحميل
         * بصمت ويسقط التخزين إلى localStorage بدل SharedPreferences.
         * الحل: تغليف الدوال في كائن عادي. */
        return {
          configure: (o: { group: string }) => p.configure(o),
          get: (o: { key: string }) => p.get(o),
          set: (o: { key: string; value: string }) => p.set(o),
          remove: (o: { key: string }) => p.remove(o),
          keys: () => p.keys(),
        } satisfies PreferencesApi;
      })
      .catch((error: unknown) => {
        console.warn("[منار] تعذّر تحميل إضافة Preferences الأصلية", error);
        return null;
      });
  }
  return prefsPromise;
}

/**
 * إضافة Preferences تحمل مجموعة واحدة نشطة (إعداد عام). كل عملية أصلية تمرّ
 * من هنا عبر الطابور المتسلسل، فتضبط المجموعة ثم تعمل دون أن تتداخل مع غيرها.
 */
async function inGroup<T>(
  prefs: PreferencesApi,
  group: string,
  op: (p: PreferencesApi) => Promise<T>,
): Promise<T> {
  await prefs.configure({ group });
  try {
    return await op(prefs);
  } finally {
    // نعيد المجموعة الافتراضية كما يتوقّعها أي كود آخر يستخدم الإضافة.
    if (group !== STATE_GROUP) await prefs.configure({ group: STATE_GROUP });
  }
}

/* ------------------------------------------------------------------ */
/*  طابور كتابة متسلسل                                                 */
/* ------------------------------------------------------------------ */

/* الكتابة إلى SharedPreferences غير متزامنة. نمرّرها عبر طابور واحد حتى لا
 * تتسابق عمليتان على المفتاح نفسه وتُحفظ القيمة الأقدم. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue(job: () => Promise<unknown>) {
  queue = queue.then(job).catch(() => undefined);
  return queue;
}

/** تُنتظر في الاختبارات أو قبل إغلاق التطبيق لضمان نزول كل الكتابات. */
export function flushPersistentWrites(): Promise<unknown> {
  return queue;
}

function mirrorSet(key: string, value: string) {
  void enqueue(async () => {
    const prefs = await nativePreferences();
    if (prefs) await inGroup(prefs, groupFor(key), (p) => p.set({ key, value }));
  });
}

function mirrorRemove(key: string) {
  void enqueue(async () => {
    const prefs = await nativePreferences();
    if (prefs) await inGroup(prefs, groupFor(key), (p) => p.remove({ key }));
  });
}

/* ------------------------------------------------------------------ */
/*  تثبيت المرآة على Storage.prototype                                 */
/* ------------------------------------------------------------------ */

let mirrorInstalled = false;
/** دالة الكتابة الأصلية قبل المطابقة: للاستعادة، فلا يُعاد ما جاء من الطبقة الأصلية إليها. */
let rawSetItem: ((this: Storage, key: string, value: string) => void) | null = null;

/**
 * يلتقط كل `localStorage.setItem/removeItem/clear` على مفاتيح منار ويطابقها
 * في الطبقة الأصلية. لا يغيّر أي سلوك متزامن، فالقراءة تبقى فورية.
 */
export function installStorageMirror() {
  if (mirrorInstalled || typeof window === "undefined") return;
  if (!isNativePlatform()) {
    // على الويب لا شيء نطابقه — `localStorage` هو المخزن الدائم أصلاً.
    mirrorInstalled = true;
    return;
  }

  const proto = window.Storage.prototype;
  const origSet = proto.setItem;
  rawSetItem = origSet;
  const origRemove = proto.removeItem;
  const origClear = proto.clear;

  proto.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
    origSet.call(this, key, value);
    if (this === window.localStorage && isMirroredKey(key)) mirrorSet(key, String(value));
  };

  proto.removeItem = function patchedRemoveItem(this: Storage, key: string) {
    origRemove.call(this, key);
    if (this === window.localStorage && isMirroredKey(key)) mirrorRemove(key);
  };

  proto.clear = function patchedClear(this: Storage) {
    if (this === window.localStorage) {
      const keys: string[] = [];
      for (let i = 0; i < this.length; i += 1) {
        const k = this.key(i);
        if (k && isMirroredKey(k)) keys.push(k);
      }
      origClear.call(this);
      for (const k of keys) mirrorRemove(k);
      return;
    }
    origClear.call(this);
  };

  mirrorInstalled = true;
}

/* ------------------------------------------------------------------ */
/*  استعادة الإقلاع                                                    */
/* ------------------------------------------------------------------ */

let hydration: Promise<void> | null = null;

/** يقرأ كل مفاتيحنا من مجموعة واحدة. */
async function readGroup(prefs: PreferencesApi, group: string) {
  return inGroup(prefs, group, async (p) => {
    const { keys } = await p.keys();
    const out = new Map<string, string>();
    for (const key of keys.filter(isMirroredKey)) {
      const { value } = await p.get({ key });
      if (value != null) out.set(key, value);
    }
    return out;
  });
}

async function restoreFromNative(prefs: PreferencesApi): Promise<void> {
  try {
    const state = await readGroup(prefs, STATE_GROUP);
    const session = await readGroup(prefs, SESSION_GROUP);

    // ٠. ترقية: النسخ السابقة حفظت رمز الجلسة في مجموعة الحالة (فكان يُنسخ
    //    احتياطياً). ننقله إلى مجموعة الجلسة ونحذفه من مجموعة الحالة.
    const legacy = [...state.keys()].filter(isSessionKey);
    if (legacy.length) {
      await inGroup(prefs, SESSION_GROUP, async (p) => {
        for (const key of legacy) {
          if (!session.has(key)) {
            const value = state.get(key)!;
            await p.set({ key, value });
            session.set(key, value);
          }
        }
      });
      await inGroup(prefs, STATE_GROUP, async (p) => {
        for (const key of legacy) await p.remove({ key });
      });
      for (const key of legacy) state.delete(key);
    }

    const native = new Map<string, string>([...state, ...session]);

    // ١. الطبقة الأصلية → localStorage
    for (const [key, value] of native) {
      if (window.localStorage.getItem(key) !== value) {
        // بالدالة الأصلية: لا داعي لإعادة المطابقة لما جاء منها.
        (rawSetItem ?? window.localStorage.setItem).call(window.localStorage, key, value);
      }
    }

    // ٢. المفاتيح المحلية غير الموجودة أصلياً → ترفع للطبقة الأصلية (ترقية).
    const pending: Array<[string, string]> = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || native.has(key) || !isMirroredKey(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value != null) pending.push([key, value]);
    }
    for (const [key, value] of pending) {
      await inGroup(prefs, groupFor(key), (p) => p.set({ key, value }));
    }
  } catch {
    /* الاستعادة أفضل-جهد: أي فشل يترك التطبيق يعمل على localStorage وحده. */
  }
}

/**
 * يستعيد حالة منار من الطبقة الأصلية إلى `localStorage`.
 *
 * قاعدة الحلّ عند التعارض: **الطبقة الأصلية تفوز**. فهي التي تصمد أمام مسح
 * تخزين الـ WebView، فأي قيمة موجودة فيها هي آخر ما حفظه المستخدم فعلاً.
 * أما المفاتيح الموجودة محلياً فقط (مثلاً بعد ترقية من نسخة قديمة) فتُرفَع إليها.
 */
export function hydratePersistentStorage(): Promise<void> {
  if (hydration) return hydration;

  hydration = (async () => {
    if (typeof window === "undefined") return;
    installStorageMirror();

    const prefs = await nativePreferences();
    if (!prefs) return;

    // الاستعادة كلها داخل الطابور: لا تتبدّل المجموعة النشطة تحت كتابة جارية.
    await enqueue(() => restoreFromNative(prefs));
  })();

  return hydration;
}

/* ------------------------------------------------------------------ */
/*  مساعدات مقروءة للاستخدام المباشر                                   */
/* ------------------------------------------------------------------ */

/** قراءة متزامنة مع تحليل JSON وقيمة احتياطية آمنة. */
export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** كتابة متزامنة (تُطابَق تلقائياً في الطبقة الأصلية). */
export function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ممتلئ أو محجوب — نتجاهل بهدوء */
  }
}

export function removeKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
