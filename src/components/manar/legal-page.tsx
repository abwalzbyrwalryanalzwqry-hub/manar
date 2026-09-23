/* منار — عرض موحّد لصفحتي الخصوصية والشروط. */

import { Link } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader } from "@/components/manar/shell";
import { DEVELOPER } from "@/lib/developer";
import { LEGAL_UPDATED, type LegalSection } from "@/lib/legal";

export function LegalPage({
  title,
  sections,
  other,
}: {
  title: string;
  sections: LegalSection[];
  other: { to: "/privacy" | "/terms"; label: string };
}) {
  return (
    <Screen>
      <ScreenHeader title={title} subtitle={`آخر تحديث: ${LEGAL_UPDATED}`} backTo="/about" />

      <article className="space-y-3 px-5">
        {sections.map((s, i) => (
          <section
            key={s.title}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            aria-labelledby={`legal-${i}`}
          >
            <h2 id={`legal-${i}`} className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-[11px] text-primary">
                {(i + 1).toLocaleString("ar-EG")}
              </span>
              {s.title}
            </h2>
            {s.body && (
              <p className="mt-2 text-[13px] font-light leading-loose text-foreground">{s.body}</p>
            )}
            {s.points && (
              <ul className="mt-2 space-y-1.5">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2 text-[13px] font-light leading-loose">
                    <span
                      className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                      aria-hidden
                    />
                    <span className="min-w-0 break-words">{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="rounded-2xl border border-border bg-secondary/30 p-4">
          <h2 className="text-sm font-medium">التواصل</h2>
          <p className="mt-1 text-[13px] font-light leading-loose">
            لأي سؤال عن هذه الصفحة: {DEVELOPER.name} —{" "}
            <a href={`mailto:${DEVELOPER.email}`} className="break-all text-primary" dir="ltr">
              {DEVELOPER.email}
            </a>
          </p>
        </section>

        <Link
          to={other.to}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={other.to === "/privacy" ? icons.lock : icons.info} size={16} />
          </span>
          <span className="flex-1 text-right text-sm font-medium">{other.label}</span>
          <span className="rotate-180 text-muted-foreground">
            <Icon d={icons.chevron} size={14} />
          </span>
        </Link>
      </article>
    </Screen>
  );
}
