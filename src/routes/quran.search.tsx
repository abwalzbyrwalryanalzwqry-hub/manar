import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/search")({
  head: () => ({ meta: [{ title: "البحث في القرآن — منار" }] }),
  component: () => (
    <ComingSoon
      title="البحث في القرآن"
      subtitle="ابحث بين الآيات"
      iconPath={icons.search}
      description="ابحث في آيات القرآن الكريم بكل يسر، مع نتائج دقيقة ومباشرة تربطك بموضع الآية."
    />
  ),
});
