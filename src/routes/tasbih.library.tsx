import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PersonalBadge, PersonalMenuButton } from "@/components/manar/personal-zikr-actions";
import { usePersonalControls } from "@/components/manar/personal-wird-controls";
import { AddZikrButton } from "@/components/manar/personal-zikr-actions";
import { personalCardId } from "@/lib/personal-azkar/model";
import { EmptyState, icons, Screen, ScreenHeader } from "@/components/manar/shell";
import { TasbihStartSheet, type StartCandidate } from "@/components/manar/tasbih-start-sheet";
import { toArabicDigits } from "@/lib/format";
import { displayName, sortPersonal } from "@/lib/personal-azkar/model";
import { usePersonalAzkar } from "@/lib/personal-azkar/store";
import {
  TASBIH_CATEGORIES,
  TASBIH_LIBRARY,
  libraryZikr,
  type TasbihCategory,
} from "@/lib/tasbih/library";
import { useTasbihPrefs } from "@/lib/tasbih/prefs";
import { activeSession } from "@/lib/tasbih/session";
import { useTasbih } from "@/lib/tasbih/store";

type Search = { pick?: string };

export const Route = createFileRoute("/tasbih/library")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s.pick === "string" && /^[lp]:[\w-]{1,80}$/.test(s.pick) ? { pick: s.pick } : {},
  head: () => ({ meta: [{ title: "اختر ذكرًا — المسبحة — منار" }] }),
  component: TasbihLibrary,
});

type Filter = "all" | TasbihCategory | "mine";

function TasbihLibrary() {
  const { pick } = Route.useSearch();
  const nav = useNavigate();
  const t = useTasbih();
  const { prefs } = useTasbihPrefs();
  const personal = usePersonalAzkar();
  const controls = usePersonalControls({ context: "tasbih" });
  const [filter, setFilter] = useState<Filter>(pick?.startsWith("p:") ? "mine" : "all");
  const [candidate, setCandidate] = useState<StartCandidate | null>(null);
  const active = activeSession(t.store);
  const mine = useMemo(() => sortPersonal(personal.items), [personal.items]);

  /* فتح ذكر محدد مباشرة (من الوِرد «الذكر به في المسبحة» أو من المميّزة). */
  useEffect(() => {
    if (!pick || !personal.hydrated) return;
    const [kind, id] = [pick.slice(0, 1), pick.slice(2)];
    if (kind === "l") {
      const z = libraryZikr(id);
      if (z)
        setCandidate({
          kind: "library",
          id: z.id,
          name: z.name,
          text: z.text,
          documented: z.documented,
        });
    } else {
      const z = personal.items.find((p) => p.id === id);
      if (z)
        setCandidate({
          kind: "personal",
          id: z.id,
          name: displayName(z),
          text: z.text,
          savedTarget: z.tasbih.target,
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- مرة واحدة بعد قراءة الأذكار
  }, [pick, personal.hydrated]);

  const start = (target: number | null) => {
    if (!candidate) return;
    t.start({
      ref: { kind: candidate.kind, id: candidate.id },
      name: candidate.name,
      text: candidate.text,
      target,
    });
    setCandidate(null);
    nav({ to: "/tasbih" });
  };

  const items =
    filter === "all" ? TASBIH_LIBRARY : TASBIH_LIBRARY.filter((z) => z.category === filter);
  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "الكل" },
    ...TASBIH_CATEGORIES,
    { key: "mine", label: "أذكاري الخاصة" },
  ];

  return (
    <Screen>
      <ScreenHeader
        title="اختر ذكرًا"
        subtitle="أذكار موثّقة المصدر وأذكارك الخاصة"
        backTo="/tasbih"
      />

      <div
        role="tablist"
        aria-label="تصنيفات الأذكار"
        className="flex gap-2 [scrollbar-width:none] overflow-x-auto px-5 pb-1"
      >
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={filter === c.key}
            onClick={() => setFilter(c.key)}
            className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[12px] ${
              filter === c.key
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border bg-card"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filter === "mine" ? (
        <div className="mt-4 px-5">
          <AddZikrButton onClick={controls.openAdd} className="w-full" />
          {personal.hydrated && mine.length === 0 ? (
            <EmptyState
              icon={icons.azkar}
              title="لا أذكار خاصة بعد"
              hint="أضف ذكرًا تكتبه بنفسك، واختر إن شئت إضافته إلى ورد الصباح أو المساء."
            />
          ) : (
            <div className="mt-3 space-y-3">
              {mine.map((z) => (
                <article
                  key={z.id}
                  id={personalCardId(z.id)}
                  className="glass rounded-[24px] p-4 shadow-soft"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 break-words text-[12px] font-medium">
                      {displayName(z)}
                    </span>
                    <PersonalBadge pinned={z.pinned} />
                    <PersonalMenuButton zikr={z} onClick={() => controls.openMenu(z)} />
                  </div>
                  <p
                    dir="auto"
                    className="mt-2 whitespace-pre-line break-words text-right font-display text-lg leading-loose"
                  >
                    {z.text}
                  </p>
                  {z.note && (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      ملاحظتك الشخصية (غير موثّقة من منار): {z.note}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {z.tasbih.target == null
                        ? "عدّاد مفتوح"
                        : `عددك: ${toArabicDigits(z.tasbih.target)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCandidate({
                          kind: "personal",
                          id: z.id,
                          name: displayName(z),
                          text: z.text,
                          savedTarget: z.tasbih.target,
                        })
                      }
                      className="gradient-primary min-h-[44px] rounded-2xl px-5 text-sm font-medium text-primary-foreground"
                    >
                      ابدأ
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3 px-5">
          {items.map((z) => (
            <article key={z.id} className="glass rounded-[24px] p-4 shadow-soft">
              <div className="text-[12px] font-medium text-foreground/80">{z.name}</div>
              <p
                className={`mt-2 text-right leading-loose ${z.quran ? "font-quran text-xl" : "font-display text-lg"}`}
              >
                {z.text}
              </p>
              {z.quran && (
                <p className="text-[11px] text-muted-foreground">
                  من سورة {z.quran.surahName}، الآية {toArabicDigits(z.quran.ayah)}
                </p>
              )}
              {z.about && (
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{z.about}</p>
              )}
              {z.documented && (
                <ul className="mt-2 space-y-1">
                  {z.documented.map((d) => (
                    <li
                      key={`${d.count}-${d.context}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      ورد في المصدر: {toArabicDigits(d.count)} — {d.context}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                {z.sources.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {s.label}
                    {s.grade ? ` — ${s.grade}` : ""}
                  </a>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setCandidate({
                      kind: "library",
                      id: z.id,
                      name: z.name,
                      text: z.text,
                      documented: z.documented,
                    })
                  }
                  className="gradient-primary min-h-[44px] rounded-2xl px-5 text-sm font-medium text-primary-foreground"
                >
                  ابدأ
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <TasbihStartSheet
        candidate={candidate}
        defaultTarget={prefs.defaultTarget}
        active={active}
        onClose={() => setCandidate(null)}
        onStart={start}
        onContinue={() => {
          setCandidate(null);
          nav({ to: "/tasbih" });
        }}
      />
      {controls.nodes}
    </Screen>
  );
}
