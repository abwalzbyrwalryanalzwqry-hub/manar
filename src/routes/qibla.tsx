import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Arabesque,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { LocationSheet } from "@/components/manar/location-sheet";
import { useCompass } from "@/hooks/use-compass";
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from "@/hooks/use-keep-awake";
import { pulse } from "@/lib/haptics";
import { distanceKm, qiblaBearing, useLocation } from "@/lib/prayer";
import { toArabicDigits } from "@/lib/format";
import {
  cardinalAr,
  continuousRotation,
  formatLatitude,
  formatLongitude,
  guidance,
} from "@/lib/qibla/compass";
import { magneticDeclination } from "@/lib/qibla/declination";

export const Route = createFileRoute("/qibla")({
  head: () => ({ meta: [{ title: "القِبلة — منار" }] }),
  component: Qibla,
});

const KAABA = { lat: 21.4225, lng: 39.8262 };

/** اليوم بتوقيت UTC: الانحراف يتغيّر ببطء شديد، ويبقى رسم الخادم مطابقاً للجهاز. */
function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

const CARDINAL_MARKS = [
  { l: "ش", deg: 0, gold: true },
  { l: "ق", deg: 90 },
  { l: "ج", deg: 180 },
  { l: "غ", deg: 270 },
];

function Qibla() {
  const { location, setLocation, requestGps, status: locStatus, error: locError } = useLocation();
  const [sheet, setSheet] = useState(false);

  const bearing = qiblaBearing(location);
  const dist = Math.round(distanceKm(location, KAABA));
  const declination = useMemo(
    () => magneticDeclination(location.lat, location.lng, todayUtc()),
    [location.lat, location.lng],
  );
  const compass = useCompass(declination);
  const live = compass.status === "active" && compass.heading != null;
  const guide = live ? guidance(compass.heading!, bearing) : null;
  const aligned = guide?.kind === "aligned" && !compass.tilted;

  useKeepAwake(live, { idleMs: KEEP_AWAKE_IDLE_MS });

  /* القرص يدور عكس اتجاه الجوال فيبقى «ش» على الشمال الحقيقي، والإبرة ثابتة
   * على زاوية القبلة فوق القرص. الدوران مستمر (بلا لفّة كاملة عند ٣٦٠°). */
  const rotRef = useRef(0);
  const dialRotation = live ? continuousRotation(rotRef.current, -compass.heading!) : 0;
  rotRef.current = dialRotation;

  /* اهتزاز خفيف مرة واحدة عند الوصول إلى اتجاه القبلة. */
  const wasAligned = useRef(false);
  useEffect(() => {
    if (aligned && !wasAligned.current) pulse("medium");
    wasAligned.current = aligned;
  }, [aligned]);

  const declText = `${toArabicDigits(Math.abs(declination).toFixed(1))}° ${declination >= 0 ? "شرقاً" : "غرباً"}`;

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
            {/* مؤشّر اتجاه الجوال: ثابت أعلى القرص. */}
            <div
              aria-hidden="true"
              className={`mb-2 h-0 w-0 border-x-[9px] border-t-[12px] border-x-transparent transition-colors ${
                aligned ? "border-t-emerald-300" : live ? "border-t-white/80" : "border-t-white/20"
              }`}
            />
            <div
              className={`relative h-72 w-72 rounded-full transition-shadow duration-500 ${
                aligned ? "shadow-[0_0_48px_rgba(52,211,153,0.45)]" : ""
              }`}
              role="img"
              aria-label={`اتجاه القبلة ${toArabicDigits(Math.round(bearing))} درجة من الشمال، نحو ${cardinalAr(bearing)}`}
            >
              <div
                className={`absolute inset-0 rounded-full border transition-colors ${
                  aligned ? "border-emerald-300/70" : "border-white/15"
                }`}
              />
              <div
                className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-150 ease-out"
                style={{ transform: `rotate(${dialRotation}deg)` }}
              >
                <div className="absolute inset-3 rounded-full border border-white/10" />
                <div className="absolute inset-7 rounded-full border border-dashed border-gold/40" />
                <svg viewBox="0 0 200 200" className="absolute inset-0">
                  {Array.from({ length: 72 }).map((_, i) => {
                    const major = i % 9 === 0;
                    const a = (i * 5 * Math.PI) / 180;
                    const r1 = 92;
                    const r2 = major ? 82 : 87;
                    /* نقرّب إلى ٣ منازل: `Math.sin`/`Math.cos` غير مضمونتين بتّاً بين
                     * محرّك العرض على الخادم ومحرّك المتصفّح، فيختلف آخر رقم عشري
                     * ويفشل ترطيب سمات الـ SVG. ٣ منازل أدقّ من البكسل بكثير. */
                    const round = (v: number) => Math.round(v * 1000) / 1000;
                    const x1 = round(100 + r1 * Math.sin(a));
                    const y1 = round(100 - r1 * Math.cos(a));
                    const x2 = round(100 + r2 * Math.sin(a));
                    const y2 = round(100 - r2 * Math.cos(a));
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

                {/* الجهات الأربع: تدور مع القرص وتبقى قائمة للقراءة. */}
                {CARDINAL_MARKS.map((c) => (
                  <div
                    key={c.l}
                    className="absolute inset-0"
                    style={{ transform: `rotate(${c.deg}deg)` }}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute left-1/2 top-2.5 -translate-x-1/2 text-xs font-medium ${
                        c.gold ? "text-gold" : "text-white/60"
                      }`}
                      style={{ transform: `translateX(-50%) rotate(${-c.deg - dialRotation}deg)` }}
                    >
                      {c.l}
                    </span>
                  </div>
                ))}

                {/* الإبرة وعلامة الكعبة على زاوية القبلة. */}
                <div className="absolute inset-0" style={{ transform: `rotate(${bearing}deg)` }}>
                  <div className="absolute left-1/2 top-[18px] h-[calc(50%-18px)] w-1 -translate-x-1/2">
                    <div
                      className={`absolute inset-x-0 bottom-7 top-5 mx-auto w-1 rounded-full ${
                        aligned ? "bg-emerald-300" : "gradient-gold shadow-gold"
                      }`}
                    />
                    <div
                      className={`absolute left-1/2 top-0 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-md ring-1 ${
                        aligned ? "bg-emerald-300 ring-emerald-200" : "bg-navy ring-gold/60"
                      }`}
                    >
                      <span
                        className={`block h-2.5 w-2.5 rounded-[2px] ${aligned ? "bg-navy" : "bg-gold"}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-navy text-gold ring-2 ring-gold/40 shadow-gold">
                <span className="text-base">﷽</span>
                <span className="text-[8px] text-gold/80">الكعبة</span>
              </div>
            </div>

            <div className="relative mt-8 text-center" aria-live="polite">
              <div className="text-[10px] tracking-[0.2em] text-white/60">اتجاه القِبلة</div>
              <div className="mt-1 font-display text-5xl font-black tabular-nums leading-none">
                {toArabicDigits(Math.round(bearing))}°
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                من الشمال الحقيقي — نحو {cardinalAr(bearing)}
              </div>
              <StatusPill
                status={compass.status}
                tilted={compass.tilted}
                relativeOnly={compass.relativeOnly}
                guide={guide}
                onEnable={() => void compass.requestPermission()}
              />
            </div>
          </div>
        </div>
      </div>

      {live && compass.needsCalibration && (
        <div className="px-4 pt-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/20 text-amber-600 dark:text-amber-300">
              <Icon d={icons.repeat} size={16} />
            </span>
            <p className="text-[11px] leading-relaxed">
              <span className="font-medium">القراءة مضطربة.</span> حرّك الجوال في الهواء على شكل
              الرقم ٨ عدة مرات لمعايرة البوصلة، وابتعد عن المعادن والمغناطيس والأجهزة الكهربائية.
            </p>
          </div>
        </div>
      )}

      {location.source !== "gps" && (
        <div className="px-4 pt-4">
          <button
            onClick={() => void requestGps()}
            disabled={locStatus === "requesting"}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right shadow-soft disabled:opacity-60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <Icon d={icons.location} size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {locStatus === "requesting" ? "جارٍ تحديد موقعك…" : "استخدم موقعي الحالي"}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {locError ?? "الاتجاه محسوب من مركز المدينة المختارة — موقعك الدقيق أفضل"}
              </span>
            </span>
          </button>
        </div>
      )}

      <SectionLabel>التفاصيل</SectionLabel>
      <div className="grid grid-cols-2 gap-3 px-4">
        <InfoCard
          icon={icons.location}
          l="المدينة"
          v={`${location.city}${location.country ? "، " + location.country : ""}`}
        />
        <InfoCard
          icon={icons.trend}
          l="المسافة إلى الكعبة"
          v={`${toArabicDigits(dist.toLocaleString("en-US"))} كم`}
        />
        <InfoCard icon={icons.qibla} l="الجهة" v={cardinalAr(bearing)} />
        <InfoCard icon={icons.target} l="الانحراف المغناطيسي" v={declText} />
        <InfoCard
          icon={icons.globe}
          l="خط العرض"
          v={toArabicDigits(formatLatitude(location.lat))}
        />
        <InfoCard
          icon={icons.globe}
          l="خط الطول"
          v={toArabicDigits(formatLongitude(location.lng))}
        />
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-[11px] leading-relaxed text-foreground">
          <span className="font-medium">لأدقّ اتجاه:</span> أمسك الجوال مستوياً، وأبعده عن المعادن
          والمغناطيس وأغطية الجوال المغناطيسية. البوصلة تُصحَّح تلقائياً بالانحراف المغناطيسي لموقعك
          ({declText}) وفق النموذج المغناطيسي العالمي WMM2025.
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

function StatusPill({
  status,
  tilted,
  relativeOnly,
  guide,
  onEnable,
}: {
  status: ReturnType<typeof useCompass>["status"];
  tilted: boolean;
  relativeOnly: boolean;
  guide: ReturnType<typeof guidance> | null;
  onEnable: () => void;
}) {
  if (status === "needs-permission") {
    return (
      <button
        onClick={onEnable}
        className="gradient-gold mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-navy shadow-gold"
      >
        <Icon d={icons.qibla} size={14} />
        تفعيل البوصلة
      </button>
    );
  }

  let tone = "bg-white/10 text-white/80 ring-white/20";
  let text = "جارٍ تشغيل البوصلة…";
  if (status === "unavailable") {
    tone = "bg-amber-300/15 text-amber-200 ring-amber-300/30";
    text = relativeOnly
      ? "حسّاس جوالك لا يعرف الشمال — اعتمد الزاوية أعلاه"
      : "لا بوصلة في هذا الجهاز — اعتمد الزاوية أعلاه";
  } else if (status === "active" && tilted) {
    tone = "bg-amber-300/15 text-amber-200 ring-amber-300/30";
    text = "ضع الجوال مستوياً";
  } else if (guide?.kind === "aligned") {
    tone = "bg-emerald-400/25 text-emerald-200 ring-emerald-300/50";
    text = "أنت متّجه إلى القبلة";
  } else if (guide?.kind === "turn") {
    tone = "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30";
    text = `استدر ${guide.dir === "right" ? "يميناً" : "يساراً"} ${toArabicDigits(guide.by)}°`;
  }
  return (
    <div
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] ring-1 ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-breath" />
      {text}
    </div>
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
