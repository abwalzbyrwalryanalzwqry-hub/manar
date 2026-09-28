import { useEffect, useMemo, useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import {
  arabCountryNames,
  loadWorldCities,
  regionsOf,
  searchPlaces,
  toLocation,
  worldCitiesLoaded,
  type Place,
} from "@/lib/places";
import { toArabicDigits } from "@/lib/format";
import type { LocationState } from "@/lib/prayer";

type View =
  | { level: "countries" }
  | { level: "regions"; country: string }
  | {
      level: "cities";
      country: string;
      region: string;
    };

export function LocationSheet({
  open,
  onClose,
  onPick,
  onUseGps,
  status,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (loc: LocationState) => void;
  onUseGps: () => void;
  status: "idle" | "requesting" | "granted" | "denied" | "unsupported" | "failed";
  error: string | null;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>({ level: "countries" });

  useEffect(() => {
    if (!open) {
      setQ("");
      setView({ level: "countries" });
    }
  }, [open]);

  /* المدن العالمية تُحمَّل عند فتح اللوحة لا مع التطبيق؛ وحين تصل يُعاد البحث. */
  const [worldReady, setWorldReady] = useState(worldCitiesLoaded);
  useEffect(() => {
    if (!open || worldReady) return;
    let alive = true;
    void loadWorldCities().then(() => {
      if (alive) setWorldReady(worldCitiesLoaded());
    });
    return () => {
      alive = false;
    };
  }, [open, worldReady]);

  const results = useMemo(
    () => (q.trim() ? searchPlaces(q) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldReady يغيّر محتوى الفهرس
    [q, worldReady],
  );
  const countries = useMemo(() => arabCountryNames(), []);
  const regions = useMemo(
    () => (view.level === "countries" ? [] : regionsOf(view.country)),
    [view],
  );

  if (!open) return null;

  const choose = (loc: LocationState) => {
    onPick(loc);
    onClose();
  };

  /* ----------------------------- العنوان ----------------------------- */

  const searching = q.trim().length > 0;
  let title = "اختر موقعك";
  let back: (() => void) | null = null;
  if (!searching && view.level === "regions") {
    title = view.country;
    back = () => setView({ level: "countries" });
  } else if (!searching && view.level === "cities") {
    title = view.region;
    back = () => setView({ level: "regions", country: view.country });
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
      />
      <div className="relative mx-auto flex max-h-[92vh] w-full max-w-md flex-col rounded-t-[32px] border-x border-t border-border bg-card shadow-elegant animate-fade-up">
        <div className="flex justify-center py-3">
          <span className="h-1 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center gap-2 px-5 pb-3">
          {back && (
            <button
              onClick={back}
              aria-label="رجوع"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border"
            >
              <Icon d={icons.chevron} size={14} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-medium">{title}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {searching
                ? results.length
                  ? `${toArabicDigits(results.length)} نتيجة`
                  : "لا نتائج"
                : view.level === "cities"
                  ? `${toArabicDigits(regions.find((r) => r.n === view.region)?.c.length ?? 0)} مدينة ومديرية`
                  : view.level === "regions"
                    ? `${toArabicDigits(regions.length)} محافظة`
                    : "نحتاج الموقع لحساب أوقات الصلاة بدقة لمنطقتك."}
            </p>
          </div>
        </div>

        <div className="px-5">
          <button
            onClick={onUseGps}
            disabled={status === "requesting"}
            className="gradient-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-70"
          >
            <Icon d={icons.location} size={16} />
            {status === "requesting" ? "جاري تحديد الموقع…" : "استخدم موقعي الحالي"}
          </button>
          {error && (status === "denied" || status === "unsupported" || status === "failed") && (
            <p className="mt-2 text-center text-[11px] text-destructive">
              {error} — يمكنك اختيار منطقتك يدوياً.
            </p>
          )}
        </div>

        <div className="mt-4 px-5">
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-2.5">
            <Icon d={icons.search} size={14} />
            <input
              dir="rtl"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن محافظة أو مدينة…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="مسح البحث" className="shrink-0">
                <Icon d={icons.close} size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          {searching ? (
            results.length ? (
              results.map((p, i) => (
                <PlaceRow
                  key={`${p.key}-${p.countryKey}-${i}`}
                  title={p.city}
                  sub={[p.region, p.country].filter(Boolean).join(" · ")}
                  badge={p.kind === "region" ? "محافظة" : undefined}
                  onClick={() => choose(toLocation(p))}
                />
              ))
            ) : (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                لا توجد نتائج مطابقة.
              </p>
            )
          ) : view.level === "countries" ? (
            countries.map((c) => (
              <PlaceRow
                key={c}
                title={c}
                sub={`${toArabicDigits(regionsOf(c).length)} محافظة`}
                chevron
                onClick={() => setView({ level: "regions", country: c })}
              />
            ))
          ) : view.level === "regions" ? (
            regions.map((r) => (
              <div key={r.n} className="flex items-center gap-1">
                <button
                  onClick={() =>
                    choose({
                      city: r.n,
                      country: view.country,
                      lat: r.lat,
                      lng: r.lng,
                      source: "manual",
                    })
                  }
                  className="flex flex-1 items-center gap-3 rounded-2xl px-3 py-3 text-right transition hover:bg-secondary/60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <Icon d={icons.location} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.n}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {r.c.length ? `${toArabicDigits(r.c.length)} مدينة ومديرية` : "اختر المحافظة"}
                    </span>
                  </span>
                </button>
                {r.c.length > 0 && (
                  <button
                    onClick={() => setView({ level: "cities", country: view.country, region: r.n })}
                    aria-label={`عرض مدن ${r.n}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
                  >
                    <Icon d={icons.chevron} size={14} />
                  </button>
                )}
              </div>
            ))
          ) : (
            (regions.find((r) => r.n === view.region)?.c ?? []).map(([name, lat, lng]) => (
              <PlaceRow
                key={name}
                title={name}
                sub={`${view.region} · ${view.country}`}
                onClick={() =>
                  choose({ city: name, country: view.country, lat, lng, source: "manual" })
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceRow({
  title,
  sub,
  badge,
  chevron,
  onClick,
}: {
  title: string;
  sub?: string;
  badge?: string;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition hover:bg-secondary/60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon d={icons.location} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary">
              {badge}
            </span>
          )}
        </span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      {chevron && (
        <span className="shrink-0 rotate-180 text-muted-foreground">
          <Icon d={icons.chevron} size={14} />
        </span>
      )}
    </button>
  );
}

export type { Place };
