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
 */

/** المفاتيح التي نطابقها: حالة منار + رمز جلسة Supabase. */
const MANAR_PREFIX = /^manar[.\-_]?/i;
const SUPABASE_AUTH = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/i;

export function isMirroredKey(key: string): boolean {
  return MANAR_PREFIX.test(key) || SUPABASE_AUTH.test(key);
}

/* ------------------------------------------------------------------ */
/*  الوصول إلى الطبقة الأصلية                                          */
/* ------------------------------------------------------------------ */

type PreferencesApi = {
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
    await prefs?.set({ key, value });
  });
}

function mirrorRemove(key: string) {
  void enqueue(async () => {
    const prefs = await nativePreferences();
    await prefs?.remove({ key });
  });
}

/* ------------------------------------------------------------------ */
/*  تثبيت المرآة على Storage.prototype                                 */
/* ------------------------------------------------------------------ */

let mirrorInstalled = false;

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

    try {
      const { keys } = await prefs.keys();
      const nativeKeys = keys.filter(isMirroredKey);

      // ١. الطبقة الأصلية → localStorage
      for (const key of nativeKeys) {
        const { value } = await prefs.get({ key });
        if (value == null) continue;
        if (window.localStorage.getItem(key) !== value) {
          // نكتب عبر الدالة الأصلية: لا داعي لإعادة المطابقة لما جاء منها.
          window.localStorage.setItem(key, value);
        }
      }

      // ٢. المفاتيح المحلية غير الموجودة أصلياً → ترفع للطبقة الأصلية (ترقية).
      const known = new Set(nativeKeys);
      const pending: Array<[string, string]> = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key || known.has(key) || !isMirroredKey(key)) continue;
        const value = window.localStorage.getItem(key);
        if (value != null) pending.push([key, value]);
      }
      for (const [key, value] of pending) await prefs.set({ key, value });
    } catch {
      /* الاستعادة أفضل-جهد: أي فشل يترك التطبيق يعمل على localStorage وحده. */
    }
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
