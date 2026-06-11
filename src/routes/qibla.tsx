import { createFileRoute } from "@tanstack/react-router";
import { Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/qibla")({
  head: () => ({ meta: [{ title: "القِبلة — منار" }] }),
  component: Qibla,
});

function Qibla() {
  return (
    <Screen>
      <ScreenHeader title="القِبلة" subtitle="اتجه نحو الكعبة المشرفة" backTo="/more" />

      <div className="px-5">
        <div className="gradient-night relative overflow-hidden rounded-[32px] p-8 text-white shadow-elegant">
          <div className="pattern-arabesque absolute inset-0 opacity-25" />
          <div className="relative flex flex-col items-center">
            {/* Compass */}
            <div className="relative h-64 w-64">
              <div className="absolute inset-0 rounded-full border border-white/20" />
              <div className="absolute inset-4 rounded-full border border-white/10" />
              <div className="absolute inset-8 rounded-full border border-dashed border-gold/40" />
              {["N", "E", "S", "W"].map((d, i) => (
                <span
                  key={d}
                  className="absolute text-[10px] tracking-widest text-white/60"
                  style={{
                    top: i === 0 ? 8 : i === 2 ? "calc(100% - 18px)" : "50%",
                    left: i === 3 ? 8 : i === 1 ? "calc(100% - 14px)" : "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {d}
                </span>
              ))}
              {/* Needle */}
              <div className="absolute left-1/2 top-1/2 h-32 w-1 -translate-x-1/2 -translate-y-full origin-bottom" style={{ rotate: "24deg" }}>
                <div className="gradient-gold mx-auto h-full w-1 rounded-full shadow-gold" />
              </div>
              {/* Center kaaba */}
              <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-navy text-gold">
                ﷽
              </div>
            </div>
            <div className="mt-8 text-center">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">اتجاه القِبلة</div>
              <div className="mt-1 font-display text-4xl font-black tabular-nums">٢٤٥°</div>
              <div className="mt-1 text-xs font-light text-white/70">الرياض → مكة المكرمة</div>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>الموقع</SectionLabel>
      <div className="space-y-2 px-5">
        <Row l="المدينة" v="الرياض، KSA" />
        <Row l="المسافة إلى الكعبة" v="٨٧٢ كم" />
        <Row l="دقة الموقع" v="عالية · GPS" />
      </div>
    </Screen>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
      <span className="text-sm">{l}</span>
      <span className="text-xs text-muted-foreground">{v}</span>
    </div>
  );
}
