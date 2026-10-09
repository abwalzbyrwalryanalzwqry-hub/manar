// ============================================================
// منار — قائمة الوِرد المدمجة: الأذكار الأصلية + أذكار المستخدم الشخصية
// ------------------------------------------------------------
// الأذكار الأصلية تبقى بترتيبها الثابت ولا تُنسخ ولا تُعدَّل؛ الذكر الشخصي
// يُدرج بعد الذكر الأصلي الذي اختاره المستخدم، أو في آخر الوِرد.
// النوع صريح في كل عنصر (`kind`) — لا يُستنتج من الشكل ولا من النص.
// ============================================================

import type { WirdItem, WirdSessionKey } from "./data";
import { displayName, personalForWird, type PersonalZikr } from "@/lib/personal-azkar/model";

export type WirdEntry =
  | {
      kind: "original";
      /** مفتاح ثابت للعرض (`o:<order>`). */
      key: string;
      item: WirdItem;
    }
  | {
      kind: "personal";
      key: string;
      zikr: PersonalZikr;
      name: string;
      /** `null` = عدد مفتوح. */
      repeat: number | null;
    };

function personalEntry(z: PersonalZikr): WirdEntry {
  return {
    kind: "personal",
    key: `p:${z.id}`,
    zikr: z,
    name: displayName(z),
    repeat: z.wird.repeat,
  };
}

const byCreation = (a: PersonalZikr, b: PersonalZikr) =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

/** يدمج أذكار المستخدم في وِرد واحد دون المساس بترتيب الأذكار الأصلية. */
export function buildWirdEntries(
  session: WirdSessionKey,
  items: readonly WirdItem[],
  personal: readonly PersonalZikr[],
): WirdEntry[] {
  const mine = personalForWird(personal, session).slice().sort(byCreation);
  const orders = new Set(items.map((it) => it.order));
  const anchored = new Map<number, PersonalZikr[]>();
  const atEnd: PersonalZikr[] = [];
  for (const z of mine) {
    const after = z.wird.after[session];
    if (after == null || (after !== 0 && !orders.has(after))) atEnd.push(z);
    else anchored.set(after, [...(anchored.get(after) ?? []), z]);
  }
  const out: WirdEntry[] = (anchored.get(0) ?? []).map(personalEntry);
  for (const it of items) {
    out.push({ kind: "original", key: `o:${it.order}`, item: it });
    for (const z of anchored.get(it.order) ?? []) out.push(personalEntry(z));
  }
  for (const z of atEnd) out.push(personalEntry(z));
  return out;
}

/** مرجع ذكر شخصي لحساب الإتمام (عدده فقط). */
export type PersonalRef = { id: string; repeat: number | null };

export function personalRefs(entries: readonly WirdEntry[]): PersonalRef[] {
  return entries.flatMap((e) =>
    e.kind === "personal" ? [{ id: e.zikr.id, repeat: e.repeat }] : [],
  );
}

export function entryName(e: WirdEntry): string {
  return e.kind === "original" ? e.item.name : e.name;
}
