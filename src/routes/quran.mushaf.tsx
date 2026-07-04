import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/mushaf")({
  head: () => ({ meta: [{ title: "المصحف — منار" }] }),
  component: () => (
    <ComingSoon
      title="المصحف الشريف"
      subtitle="القرآن الكريم كاملًا"
      iconPath={icons.quran}
      description="تصفح كامل للمصحف الشريف بتصميم أصيل، مع خط عثماني واضح وتجربة قراءة فاخرة."
    />
  ),
});
