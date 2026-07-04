import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/recitations")({
  head: () => ({ meta: [{ title: "التلاوات — منار" }] }),
  component: () => (
    <ComingSoon
      title="التلاوات"
      subtitle="مكتبة القرّاء"
      iconPath={icons.play}
      description="استمع لأشهر قرّاء العالم الإسلامي بجودة صوتية عالية وتحكم كامل بالتشغيل."
    />
  ),
});
