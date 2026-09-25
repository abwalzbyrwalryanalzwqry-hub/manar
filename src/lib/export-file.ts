// ============================================================
// منار — تصدير ملف نصي (JSON) يعمل داخل تطبيق أندرويد أيضاً
// ------------------------------------------------------------
// تنزيل Blob عبر رابط <a download> لا يعمل غالباً داخل WebView
// في Capacitor. في التطبيق: يُكتب الملف في ذاكرة التطبيق المؤقتة
// ثم يُفتح مربع المشاركة ليحفظه المستخدم (الملفات، Drive…) أو يرسله.
// في المتصفح: مشاركة الملف إن أمكن، وإلا التنزيل المعتاد.
// ============================================================

import { Capacitor } from "@capacitor/core";

export type ExportOutcome = "shared" | "downloaded" | "cancelled";

export async function exportTextFile(
  fileName: string,
  content: string,
  opts: { mime?: string; title?: string } = {},
): Promise<ExportOutcome> {
  const mime = opts.mime ?? "application/json";
  const title = opts.title ?? "منار";

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const path = `manar-export/${fileName}`;
    await Filesystem.writeFile({
      path,
      directory: Directory.Cache,
      data: content,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    try {
      await Share.share({ title, files: [uri], dialogTitle: title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }

  const blob = new Blob([content], { type: mime });
  const file = typeof File === "function" ? new File([blob], fileName, { type: mime }) : null;
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  // المشاركة أولاً على الجوال فقط؛ على الحاسوب التنزيل أوضح.
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile && file && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
