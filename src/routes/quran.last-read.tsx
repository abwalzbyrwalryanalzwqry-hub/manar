import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/last-read")({
  head: () => ({ meta: [{ title: "آخر قراءة — منار" }] }),
  component: () => (
    <ComingSoon
      title="آخر قراءة"
      subtitle="تابع من حيث توقفت"
      iconPath={icons.bookmark}
      description="نحفظ لك موضع آخر قراءة تلقائيًا لتعود إليه بلمسة واحدة، مع مزامنة بين أجهزتك."
    />
  ),
});
