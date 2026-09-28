import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { SOURCES } from "@/lib/sources";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "المصادر والتراخيص — منار" },
      {
        name: "description",
        content: "مصادر نص القرآن والتفسير والتلاوات والمواقع في منار وتراخيصها.",
      },
    ],
  }),
  component: SourcesScreen,
});

function SourcesScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="المصادر والتراخيص"
        subtitle="القرآن والتفسير والتلاوات والمواقع"
        backTo="/about"
      />

      <p className="px-5 text-[12px] leading-relaxed text-muted-foreground">
        كل بيانات القرآن في منار من مصادر موثوقة مفتوحة، تُعرض كما هي دون تعديل. جزى الله القائمين
        عليها خيراً.
      </p>

      {SOURCES.map((g) => (
        <section key={g.titleAr}>
          <SectionLabel>{g.titleAr}</SectionLabel>
          <div className="space-y-2.5 px-5">
            {g.items.map((s) => (
              <article
                key={s.titleAr}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon d={icons.book} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{s.titleAr}</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{s.byAr}</p>
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-foreground/85">{s.usedForAr}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  الترخيص: {s.licenseAr}
                </p>
                {s.notice && (
                  <p
                    dir="ltr"
                    lang="en"
                    className="mt-2 whitespace-pre-line rounded-xl border border-border/60 bg-background/60 p-2.5 text-left text-[10px] leading-relaxed text-muted-foreground"
                  >
                    {s.notice}
                  </p>
                )}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                  className="mt-2 inline-block break-all text-[11px] text-primary underline"
                >
                  {s.url.replace(/^https?:\/\//, "")}
                </a>
              </article>
            ))}
          </div>
        </section>
      ))}
      <div className="h-8" />
    </Screen>
  );
}
