import { icons } from "@/components/manar/shell";

/** ثوابت شاشة القارئ. */

/** مهلة استقرار التمرير قبل حفظ الموضع. */
export const SETTLE_MS = 1200;

export const MORE_ACTIONS: { label: string; icon: string; to: string }[] = [
  { label: "مشاركة", icon: icons.share, to: "/quran/share" },
  { label: "العلامات", icon: icons.bookmark, to: "/quran/bookmarks" },
  { label: "إعدادات", icon: icons.settings, to: "/quran/reader-settings" },
  { label: "المصادر", icon: icons.info, to: "/sources" },
];
