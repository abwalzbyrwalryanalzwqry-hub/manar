import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/manar/legal-page";
import { TERMS } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "شروط الاستخدام — منار" }] }),
  component: () => (
    <LegalPage
      title="شروط الاستخدام"
      sections={TERMS}
      other={{ to: "/privacy", label: "سياسة الخصوصية" }}
    />
  ),
});
