import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/manar/coming-soon";
import { icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/tafsir")({
  head: () => ({ meta: [{ title: "التفسير — منار" }] }),
  component: () => (
    <ComingSoon
      title="التفسير"
      subtitle="معاني كلام الله"
      iconPath={icons.info}
      description="تفاسير معتمدة لأشهر العلماء، مربوطة بالآيات لفهم أعمق وتدبّر أوسع."
    />
  ),
});
