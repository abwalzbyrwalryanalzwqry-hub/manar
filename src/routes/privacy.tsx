import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/manar/legal-page";
import { PRIVACY } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "سياسة الخصوصية — منار" }] }),
  component: () => (
    <LegalPage
      title="سياسة الخصوصية"
      sections={PRIVACY}
      other={{ to: "/terms", label: "شروط الاستخدام" }}
    />
  ),
});
