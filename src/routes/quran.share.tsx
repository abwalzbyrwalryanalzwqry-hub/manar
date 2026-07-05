import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/share")({
  head: () => ({ meta: [{ title: "مشاركة — منار" }] }),
  component: () => (
    <ComingSoon
      title="مشاركة الصفحة"
      subtitle="آية · صورة · رابط"
      description="نعمل على تجهيز أدوات مشاركة أنيقة لتتمكن من مشاركة الآيات والصفحات مع أحبّائك بتصميم فاخر."
      iconPath={icons.share}
      backTo="/quran/mushaf"
    />
  ),
});
