// ============================================================
// منار — الأذكار الشخصية: التخزين الدائم والخطاف
// ------------------------------------------------------------
// المفتاح `manar.azkar.custom.v1` في localStorage، ويُطابَق تلقائيًا إلى
// SharedPreferences على أندرويد (persistent-storage.ts) ويدخل النسخة الاحتياطية.
// الكتابة فورية (عمليات قليلة: إضافة/تعديل/حذف)، وتعيد خطأً واضحًا إن فشلت
// حتى يُبقي النموذج ما كتبه المستخدم.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import type { WirdSessionKey } from "@/lib/wird/data";
import {
  createPersonal,
  emptyPersonalStore,
  normalizePersonalStore,
  removePersonal,
  togglePinned,
  unlinkFromWird,
  updatePersonal,
  type OpResult,
  type PersonalAzkarStore,
  type PersonalInput,
  type PersonalZikr,
} from "./model";

export const PERSONAL_AZKAR_KEY = "manar.azkar.custom.v1";
export const PERSONAL_AZKAR_EVENT = "manar:custom-azkar";

export const SAVE_FAILED = "تعذّر الحفظ على الجهاز. لم يُفقد ما كتبته — حاول مرة أخرى.";

export function readPersonalStore(): PersonalAzkarStore {
  if (typeof window === "undefined") return emptyPersonalStore();
  try {
    const raw = window.localStorage.getItem(PERSONAL_AZKAR_KEY);
    return raw ? normalizePersonalStore(JSON.parse(raw)) : emptyPersonalStore();
  } catch {
    return emptyPersonalStore();
  }
}

function persist(store: PersonalAzkarStore): boolean {
  try {
    window.localStorage.setItem(PERSONAL_AZKAR_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(PERSONAL_AZKAR_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** يطبّق عملية على أحدث نسخة في التخزين ثم يحفظها. */
function run(op: (s: PersonalAzkarStore) => OpResult): OpResult {
  if (typeof window === "undefined") return { ok: false, error: SAVE_FAILED };
  const res = op(readPersonalStore());
  if (!res.ok) return res;
  return persist(res.store) ? res : { ok: false, error: SAVE_FAILED };
}

export const personalAzkar = {
  add: (input: PersonalInput) => run((s) => createPersonal(s, input)),
  update: (id: string, patch: Partial<PersonalInput>) => run((s) => updatePersonal(s, id, patch)),
  remove: (id: string) => run((s) => removePersonal(s, id)),
  unlink: (id: string, session: WirdSessionKey) => run((s) => unlinkFromWird(s, id, session)),
  togglePin: (id: string) => run((s) => togglePinned(s, id)),
};

/** قائمة الأذكار الشخصية الحيّة (تتحدّث بعد كل عملية في أي شاشة). */
export function usePersonalAzkar(): { items: PersonalZikr[]; hydrated: boolean } {
  /* يبدأ فارغًا ثم يُقرأ بعد التركيب، حتى يطابق ما رُسم على الخادم. */
  const [state, setState] = useState<{ items: PersonalZikr[]; hydrated: boolean }>({
    items: [],
    hydrated: false,
  });
  const sync = useCallback(
    () => setState({ items: readPersonalStore().items, hydrated: true }),
    [],
  );
  useEffect(() => {
    sync();
    window.addEventListener(PERSONAL_AZKAR_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PERSONAL_AZKAR_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);
  return state;
}
