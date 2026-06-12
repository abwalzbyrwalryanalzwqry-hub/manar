import { useEffect, useMemo, useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { CITIES } from "@/lib/cities";
import type { LocationState } from "@/lib/prayer";

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
  status: "idle" | "requesting" | "granted" | "denied" | "unsupported";
  error: string | null;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => (q ? CITIES.filter((c) => c.city.includes(q) || (c.country ?? "").includes(q)) : CITIES),
    [q],
  );

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
      />
      <div className="relative mx-auto w-full max-w-md rounded-t-[32px] border-x border-t border-border bg-card shadow-elegant animate-fade-up">
        <div className="flex justify-center py-3">
          <span className="h-1 w-12 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-5 pb-3">
          <h2 className="font-display text-lg font-medium">اختر موقعك</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            نحتاج الموقع لحساب أوقات الصلاة بدقة لمدينتك.
          </p>
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
          {error && status === "denied" && (
            <p className="mt-2 text-center text-[11px] text-destructive">{error} — يمكنك اختيار مدينتك يدوياً.</p>
          )}
        </div>

        <div className="mt-4 px-5">
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-2.5">
            <Icon d={icons.search} size={14} />
            <input
              dir="rtl"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن مدينة…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        <div className="mt-3 max-h-[55vh] overflow-y-auto px-3 pb-6">
          {filtered.map((c) => (
            <button
              key={`${c.city}-${c.country}`}
              onClick={() => {
                onPick({ ...c, source: "manual" });
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-right transition hover:bg-secondary/60"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                  <Icon d={icons.location} size={14} />
                </span>
                <span>
                  <span className="block text-sm font-medium">{c.city}</span>
                  <span className="block text-[11px] text-muted-foreground">{c.country}</span>
                </span>
              </span>
              <span className="rotate-180 text-muted-foreground">
                <Icon d={icons.chevron} size={14} />
              </span>
            </button>
          ))}
          {!filtered.length && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">لا توجد نتائج مطابقة.</p>
          )}
        </div>
      </div>
    </div>
  );
}
