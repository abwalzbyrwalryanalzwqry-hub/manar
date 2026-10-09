/* منار — قائمة «المزيد».
 *
 * أربع مجموعات بدل قائمة واحدة طويلة، لكل عنصر أيقونة لا تتكرر. ومعها صف
 * «الأكثر استخداماً»: عدّاد فتح محلي على هذا الجهاز فقط، لا يغادره.
 */

import type { icons } from "@/components/manar/shell";

export type MoreRoute =
  | "/wird"
  | "/tasbih"
  | "/jumuah"
  | "/seasons"
  | "/qibla"
  | "/statistics"
  | "/notifications"
  | "/adhan"
  | "/iqama"
  | "/sakinah"
  | "/reminders"
  | "/calendar"
  | "/widget"
  | "/my-data"
  | "/settings"
  | "/about";

export type MoreItem = {
  to: MoreRoute;
  label: string;
  desc: string;
  icon: keyof typeof icons;
};

export type MoreGroup = { title: string; items: MoreItem[] };

export const MORE_GROUPS: MoreGroup[] = [
  {
    title: "العبادة اليومية",
    items: [
      { to: "/wird", label: "الوِرد", desc: "ورد الصباح والمساء", icon: "book" },
      { to: "/tasbih", label: "المسبحة", desc: "عدّاد الذكر وأذكارك الخاصة", icon: "azkar" },
      { to: "/jumuah", label: "صلاة الجمعة", desc: "موعدها وسننها وسجلّ حضورك", icon: "mosque" },
      {
        to: "/seasons",
        label: "مواسم منار",
        desc: "رمضان وذو الحجة والأيام الفاضلة",
        icon: "star",
      },
      { to: "/qibla", label: "القِبلة", desc: "البوصلة واتجاه الكعبة", icon: "qibla" },
      { to: "/statistics", label: "الإحصائيات", desc: "صلواتك وأذكارك يوماً بيوم", icon: "stats" },
    ],
  },
  {
    title: "التنبيهات والأصوات",
    items: [
      {
        to: "/notifications",
        label: "مركز التنبيهات",
        desc: "كل التنبيهات في مكان واحد",
        icon: "bell",
      },
      { to: "/adhan", label: "مكتبة الأذان", desc: "صوت الأذان لكل صلاة", icon: "minaret" },
      { to: "/iqama", label: "الإقامة", desc: "صوت الإقامة وموعدها بعد الأذان", icon: "prayer" },
      { to: "/sakinah", label: "سكينة", desc: "يُسكت الجوال وقت الصلاة", icon: "bellOff" },
      {
        to: "/reminders",
        label: "تذكيرات الأذكار والوِرد",
        desc: "أوقات وأصوات تختارها بنفسك",
        icon: "clock",
      },
    ],
  },
  {
    title: "الأدوات",
    items: [
      { to: "/calendar", label: "التقويم", desc: "هجري وميلادي ومناسبات", icon: "calendar" },
      {
        to: "/widget",
        label: "ويدجت الشاشة الرئيسية",
        desc: "الصلاة القادمة وآية اليوم على شاشة جوالك",
        icon: "widget",
      },
    ],
  },
  {
    title: "التطبيق",
    items: [
      {
        to: "/my-data",
        label: "بياناتي",
        desc: "النسخ الاحتياطي، التصدير والاستيراد، اسمك",
        icon: "profile",
      },
      { to: "/settings", label: "الإعدادات", desc: "المظهر، المواقيت، الأذكار", icon: "settings" },
      { to: "/about", label: "عن التطبيق", desc: "النسخة، المطور، الخصوصية والشروط", icon: "info" },
    ],
  },
];

export const MORE_ITEMS: MoreItem[] = MORE_GROUPS.flatMap((g) => g.items);

/* ------------------------------------------------------------------ */
/*  الأكثر استخداماً                                                   */
/* ------------------------------------------------------------------ */

export const MORE_USAGE_KEY = "manar.more.usage.v1";

export type MoreUsage = Partial<Record<MoreRoute, number>>;

const ROUTES = new Set<string>(MORE_ITEMS.map((i) => i.to));

export function normalizeUsage(raw: unknown): MoreUsage {
  const out: MoreUsage = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (ROUTES.has(k) && Number.isFinite(n) && n > 0) out[k as MoreRoute] = Math.floor(n);
  }
  return out;
}

/** أكثر العناصر فتحاً (مرتان على الأقل)، والتعادل بترتيب القائمة. */
export function topUsed(usage: MoreUsage, n = 3, min = 2): MoreItem[] {
  return MORE_ITEMS.map((item, i) => ({ item, i, c: usage[item.to] ?? 0 }))
    .filter((x) => x.c >= min)
    .sort((a, b) => b.c - a.c || a.i - b.i)
    .slice(0, n)
    .map((x) => x.item);
}

export function readUsage(): MoreUsage {
  if (typeof window === "undefined") return {};
  try {
    return normalizeUsage(JSON.parse(window.localStorage.getItem(MORE_USAGE_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

export function recordUsage(to: MoreRoute) {
  if (typeof window === "undefined") return;
  const cur = readUsage();
  cur[to] = (cur[to] ?? 0) + 1;
  try {
    window.localStorage.setItem(MORE_USAGE_KEY, JSON.stringify(cur));
  } catch {
    /* ignore */
  }
}
