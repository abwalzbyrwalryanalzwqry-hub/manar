import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/reader-settings")({
  head: () => ({ meta: [{ title: "إعدادات القراءة — منار" }] }),
  component: () => (
    <ComingSoon
      title="إعدادات القراءة"
      subtitle="الخط · الحجم · السطوع"
      description="ستتوفر قريبًا خيارات متقدمة لتخصيص تجربة القراءة بما يناسبك: نوع الخط، حجم الآيات، وضع الليل، والسطوع."
      iconPath={icons.settings}
      backTo="/quran/mushaf"
    />
  ),
});
