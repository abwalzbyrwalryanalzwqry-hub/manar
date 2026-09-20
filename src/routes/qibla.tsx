import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Arabesque,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { LocationSheet } from "@/components/manar/location-sheet";
import { distanceKm, qiblaBearing, useLocation } from "@/lib/prayer";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/qibla")({
  head: () => ({ meta: [{ title: "القِبلة — منار" }] }),
  component: Qibla,
});

const KAABA = { lat: 21.4225, lng: 39.8262 };

function Qibla() {
  const { location, setLocation, requestGps, status: locStatus, error: locError } = useLocation();
  const [sheet, setSheet] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);

  // Live device compass — best effort.
  useEffect(() => {
    if (typeof window === "undefined") return;
    type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
    const handler = (e: DeviceOrientationEvent) => {
      const ev = e as CompassEvent;
      if (typeof ev.webkitCompassHeading === "number") {
        setHeading(ev.webkitCompassHeading);
      } else if (typeof e.alpha === "number") {
        setHeading(360 - e.alpha);
      }
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, []);

  const bearing = qiblaBearing(location);
  const dist = Math.round(distanceKm(location, KAABA));
  // Needle rotates relative to North; if we know device heading we can offset.
  const needleRotation = heading == null ? bearing : (bearing - heading + 360) % 360;

  return (
    <Screen>
      <ScreenHeader
        title="القِبلة"
        subtitle="اتجه نحو الكعبة المشرفة"
        backTo="/more"
        action={
          <button
            onClick={() => setSheet(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft"
            aria-label="تغيير الموقع"
          >
            <Icon d={icons.location} size={18} />
          </button>
        }
      />

      <div className="px-4 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-[36px] p-8 text-white shadow-elegant">
          <Arabesque className="absolute -right-12 -bottom-12 h-80 w-80 text-gold/20 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />

          <div className="relative flex flex-col items-center">
            <div className="relative h-72 w-72">
              <div className="absolute inset-0 rounded-full border border-white/15" />
              <div className="absolute inset-3 rounded-full border border-white/10" />
              <div className="absolute inset-7 rounded-full border border-dashed border-gold/40" />
              <svg viewBox="0 0 200 200" className="absolute inset-0">
                {Array.from({ length: 72 }).map((_, i) => {
                  const major = i % 9 === 0;
                  const a = (i * 5 * Math.PI) / 180;
                  const r1 = 92;
                  const r2 = major ? 82 : 87;
                  const x1 = 100 + r1 * Math.sin(a);
                  const y1 = 100 - r1 * Math.cos(a);
                  const x2 = 100 + r2 * Math.sin(a);
                  const y2 = 100 - r2 * Math.cos(a);
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="white"
                      strokeOpacity={major ? 0.5 : 0.2}
                      strokeWidth={major ? 1 : 0.5}
                    />
                  );
                })}
              </svg>
              {[
                { l: "N", pos: { top: 10, left: "50%", x: "-50%", y: "0" }, gold: true },
                { l: "E", pos: { top: "50%", right: 10, x: "0", y: "-50%" } },
                { l: "S", pos: { bottom: 10, left: "50%", x: "-50%", y: "0" } },
                { l: "W", pos: { top: "50%", left: 10, x: "0", y: "-50%" } },
              ].map((p, i) => (
                <span
                  key={i}
                  className={`absolute text-[11px] tracking-widest ${p.gold ? "text-gold" : "text-white/60"}`}
                  style={{
                    top: p.pos.top,
                    bottom: p.pos.bottom,
                    right: p.pos.right,
                    left: p.pos.left,
                    transform: `translate(${p.pos.x}, ${p.pos.y})`,
                  }}
                >
                  {p.l}
                </span>
              ))}

              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-700"
                style={{ transform: `translate(-50%, -50%) rotate(${needleRotation}deg)` }}
              >
                <div className="relative -mt-32 h-32 w-1">
                  <div className="gradient-gold absolute inset-0 mx-auto w-1 rounded-full shadow-gold" />
                  <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-gold" />
                </div>
              </div>

              <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-navy text-gold ring-2 ring-gold/40 shadow-gold">
                <span className="text-base">﷽</span>
                <span className="text-[8px] tracking-widest text-gold/80">KAABA</span>
              </div>
            </div>

            <div className="relative mt-8 text-center">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                اتجاه القِبلة
              </div>
              <div className="mt-1 font-display text-5xl font-black tabular-nums leading-none">
                {toArabicDigits(Math.round(bearing))}°
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] text-emerald-300 ring-1 ring-emerald-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-breath" />
                {heading == null
                  ? location.source === "gps"
                    ? "محسوب من موقعك"
                    : "محسوب من المدينة المختارة"
                  : "حسّاس الاتجاه نشط"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>الموقع</SectionLabel>
      <div className="grid grid-cols-2 gap-3 px-4">
        <InfoCard
          icon={icons.location}
          l="المدينة"
          v={`${location.city}${location.country ? "، " + location.country : ""}`}
        />
        <InfoCard
          icon={icons.trend}
          l="المسافة"
          v={`${toArabicDigits(dist.toLocaleString("en-US"))} كم`}
        />
        <InfoCard
          icon={icons.globe}
          l="خط الطول"
          v={`${toArabicDigits(location.lng.toFixed(2))}° E`}
        />
        <InfoCard
          icon={icons.globe}
          l="خط العرض"
          v={`${toArabicDigits(location.lat.toFixed(2))}° N`}
        />
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-[11px] leading-relaxed text-foreground">
          <span className="font-medium">نصيحة:</span> ضع الجهاز على سطح مستوٍ بعيداً عن المعادن
          للحصول على أعلى دقة، وفعّل أذونات الاتجاه في متصفحك.
        </div>
      </div>

      <LocationSheet
        open={sheet}
        onClose={() => setSheet(false)}
        onPick={setLocation}
        onUseGps={requestGps}
        status={locStatus}
        error={locError}
      />
    </Screen>
  );
}

function InfoCard({ icon, l, v }: { icon: string; l: string; v: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
      <div className="mt-1 font-display text-base font-medium">{v}</div>
    </div>
  );
}
