import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/bookmarks")({
  head: () => ({ meta: [{ title: "العلامات — منار" }] }),
  component: () => (
    <ComingSoon
      title="العلامات"
      subtitle="آياتك وسورك المحفوظة"
      iconPath={icons.bookmark}
      description="احفظ آياتك المفضلة وسورك للرجوع إليها في أي وقت، مع مزامنة كاملة عبر أجهزتك."
    />
  ),
});
