import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منار · Manar — Design System" },
      { name: "description", content: "نور يهديك في كل وقت — نظام تصميم تطبيق منار الإسلامي الفاخر." },
      { property: "og:title", content: "منار · Manar Design System" },
      { property: "og:description", content: "Luxury Islamic mobile design system." },
    ],
  }),
  component: ManarDesignSystem,
});

function ManarDesignSystem() {
  const [dark, setDark] = useState(false);
  return (
    <div className={dark ? "dark" : ""}>
      <div dir="rtl" className="min-h-screen bg-background text-foreground transition-colors">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <ManarMark />
              <div className="leading-tight">
                <div className="text-lg font-medium tracking-tight">منار</div>
                <div className="text-[11px] text-muted-foreground">Design System · v1.0</div>
              </div>
            </div>
            <button
              onClick={() => setDark((v) => !v)}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium shadow-soft transition hover:shadow-elegant"
            >
              {dark ? "الوضع الفاتح ☀︎" : "الوضع الداكن ☾"}
            </button>
          </div>
        </header>

        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="gradient-hero absolute inset-0" />
          <div className="pattern-arabesque absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-6xl px-5 py-24 text-center text-white">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-xl ring-1 ring-white/20 animate-float">
              <ManarMark size={44} tone="light" />
            </div>
            <div className="mb-3 text-[11px] tracking-[0.4em] text-white/70">MANAR · منار</div>
            <h1 className="font-display text-7xl font-light leading-none tracking-tight">منار</h1>
            <p className="mt-5 text-base font-light text-white/80">نور يهديك في كل وقت</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button className="gradient-gold rounded-full px-7 py-3 text-sm font-medium text-navy shadow-gold transition hover:scale-[1.02]">
                ابدأ الرحلة
              </button>
              <button className="rounded-full border border-white/30 bg-white/5 px-7 py-3 text-sm font-light text-white backdrop-blur-md transition hover:bg-white/10">
                استكشف النظام
              </button>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-6xl space-y-24 px-5 py-20">
          {/* Typography */}
          <Section index="01" title="الطباعة · Typography" sub="Thmanyah Serif Text — الخط الرسمي للتطبيق">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <Label>Display · العرض</Label>
                <p className="font-display text-6xl font-light leading-tight">منار</p>
                <p className="mt-2 text-xs text-muted-foreground">64px / Light 300</p>
              </Card>
              <Card>
                <Label>Heading 1</Label>
                <p className="text-4xl font-medium leading-tight">السلام عليكم</p>
                <p className="mt-2 text-xs text-muted-foreground">36px / Medium 500</p>
              </Card>
              <Card>
                <Label>Heading 2</Label>
                <p className="text-2xl font-medium">الصلوات الخمس</p>
                <p className="mt-2 text-xs text-muted-foreground">24px / Medium 500</p>
              </Card>
              <Card>
                <Label>Body</Label>
                <p className="text-base font-normal leading-relaxed">
                  بسم الله الرحمن الرحيم. الحمد لله رب العالمين، الرحمن الرحيم، مالك يوم الدين.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">16px / Regular 400</p>
              </Card>
              <Card>
                <Label>Caption</Label>
                <p className="text-sm font-light text-muted-foreground">٠٤:٣٢ ص · صلاة الفجر</p>
                <p className="mt-2 text-xs text-muted-foreground">14px / Light 300</p>
              </Card>
              <Card>
                <Label>Numbers · أرقام</Label>
                <p className="font-display text-5xl font-black tabular-nums tracking-tight">٠٥:١٧</p>
                <p className="mt-2 text-xs text-muted-foreground">48px / Black 900 · Tabular</p>
              </Card>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Light", 300],
                ["Regular", 400],
                ["Medium", 500],
                ["Black", 900],
              ].map(([n, w]) => (
                <div key={n as string} className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
                  <div className="text-3xl" style={{ fontWeight: w as number }}>أبجد</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">{n} · {w}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Colors */}
          <Section index="02" title="الألوان · Color Palette" sub="هوية بصرية فاخرة مستوحاة من الزمرد والذهب">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Swatch name="Emerald" arabic="زمرد" hex="#0E7A5F" className="bg-primary text-primary-foreground" role="Primary" />
              <Swatch name="Royal Gold" arabic="ذهبي ملكي" hex="#C9A227" className="gradient-gold text-navy" role="Accent" />
              <Swatch name="Deep Navy" arabic="كحلي عميق" hex="#152238" className="bg-navy text-navy-foreground" role="Surface" />
              <Swatch name="Pearl" arabic="لؤلؤي" hex="#F8F9FA" className="bg-[#F8F9FA] text-navy ring-1 ring-border" role="Background" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <TokenRow token="background" />
              <TokenRow token="foreground" />
              <TokenRow token="primary" />
              <TokenRow token="gold" />
              <TokenRow token="navy" />
              <TokenRow token="muted" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="gradient-primary h-28 rounded-3xl shadow-glow" />
              <div className="gradient-gold h-28 rounded-3xl shadow-gold" />
              <div className="gradient-night h-28 rounded-3xl shadow-elegant" />
            </div>
          </Section>

          {/* Spacing */}
          <Section index="03" title="نظام المسافات · Spacing" sub="مقياس 4px — انسجام بصري عبر الواجهات">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              {[
                ["xs", 4],
                ["sm", 8],
                ["md", 16],
                ["lg", 24],
                ["xl", 32],
                ["2xl", 48],
                ["3xl", 64],
              ].map(([name, px]) => (
                <div key={name as string} className="flex items-center gap-4 py-2">
                  <div className="w-16 text-xs font-medium text-muted-foreground">{name}</div>
                  <div className="h-3 rounded-full bg-primary" style={{ width: `${px}px` }} />
                  <div className="text-xs text-muted-foreground">{px}px</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Buttons */}
          <Section index="04" title="الأزرار · Buttons" sub="حركات ناعمة، ظلال فاخرة، حواف منحنية">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <Label>Primary</Label>
                <button className="gradient-primary w-full rounded-2xl py-4 text-sm font-medium text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-[0.98]">
                  متابعة
                </button>
              </Card>
              <Card>
                <Label>Gold · Premium</Label>
                <button className="gradient-gold w-full rounded-2xl py-4 text-sm font-medium text-navy shadow-gold transition hover:scale-[1.02] active:scale-[0.98]">
                  ترقية إلى منار+
                </button>
              </Card>
              <Card>
                <Label>Secondary</Label>
                <button className="w-full rounded-2xl bg-secondary py-4 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80">
                  لاحقاً
                </button>
              </Card>
              <Card>
                <Label>Ghost / Glass</Label>
                <button className="glass w-full rounded-2xl py-4 text-sm font-medium transition hover:shadow-elegant">
                  استكشف
                </button>
              </Card>
              <Card>
                <Label>Outline</Label>
                <button className="w-full rounded-2xl border border-primary py-4 text-sm font-medium text-primary transition hover:bg-primary/5">
                  مشاركة
                </button>
              </Card>
              <Card>
                <Label>Icon Pill</Label>
                <div className="flex flex-wrap gap-2">
                  {["﷽", "☾", "✦", "❀", "✧"].map((g) => (
                    <button key={g} className="h-12 w-12 rounded-2xl border border-border bg-card text-lg shadow-soft transition hover:shadow-elegant">
                      {g}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </Section>

          {/* Cards */}
          <Section index="05" title="البطاقات · Cards" sub="زجاجية، فاخرة، متعددة الطبقات">
            <div className="grid gap-5 md:grid-cols-2">
              {/* Prayer card */}
              <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
                <div className="pattern-arabesque absolute inset-0 opacity-25" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] tracking-widest backdrop-blur">NEXT · القادمة</span>
                    <span className="text-gradient-gold font-display text-sm font-medium">منار</span>
                  </div>
                  <div className="mt-8">
                    <div className="text-xs uppercase tracking-[0.3em] text-white/60">صلاة العصر</div>
                    <div className="font-display text-6xl font-black tabular-nums tracking-tight">١٥:٤٢</div>
                    <div className="mt-2 text-xs font-light text-white/70">بعد ساعتين و ١٢ دقيقة</div>
                  </div>
                  <div className="mt-8 flex items-center justify-between border-t border-white/15 pt-4 text-[11px] text-white/70">
                    <span>الرياض · KSA</span>
                    <span>القِبلة ٢٤٥°</span>
                  </div>
                </div>
              </div>

              {/* Glass card */}
              <div className="glass relative overflow-hidden rounded-[28px] p-6 shadow-elegant">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Daily · الورد اليومي</div>
                    <div className="mt-1 text-lg font-medium">سورة الكهف</div>
                  </div>
                  <div className="gradient-gold flex h-12 w-12 items-center justify-center rounded-2xl text-navy shadow-gold">
                    <span className="text-lg font-black">١٨</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-right font-display text-lg leading-loose">
                    ﴿ الْحَمْدُ لِلَّهِ الَّذِي أَنْزَلَ عَلَىٰ عَبْدِهِ الْكِتَابَ ﴾
                  </p>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-[10px] text-muted-foreground">التقدم · ٦٢٪</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="gradient-primary h-full w-[62%] rounded-full" />
                    </div>
                  </div>
                  <button className="mr-4 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">متابعة</button>
                </div>
              </div>
            </div>
          </Section>

          {/* Icons */}
          <Section index="06" title="الأيقونات · Icons" sub="خطوط رفيعة، حواف ناعمة، إيقاع هندسي">
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {ICONS.map((i) => (
                <div key={i.label} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:shadow-elegant">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                    {i.svg}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{i.label}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Mobile preview */}
          <Section index="07" title="الوضعان · Light & Dark" sub="معاينة على شاشة الجوال">
            <div className="grid gap-8 md:grid-cols-2">
              <PhoneFrame mode="light" />
              <PhoneFrame mode="dark" />
            </div>
          </Section>

          {/* Shadows */}
          <Section index="08" title="الظلال · Elevation" sub="طبقات هادئة لإحساس بالعمق">
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ["Soft", "shadow-soft"],
                ["Elegant", "shadow-elegant"],
                ["Glow", "shadow-glow"],
                ["Gold", "shadow-gold"],
              ].map(([n, c]) => (
                <div key={n} className={`flex h-32 items-center justify-center rounded-3xl bg-card ${c}`}>
                  <span className="text-xs font-medium text-muted-foreground">{n}</span>
                </div>
              ))}
            </div>
          </Section>

          <footer className="border-t border-border pt-10 pb-4 text-center">
            <div className="font-display text-2xl font-light">منار</div>
            <p className="mt-2 text-xs text-muted-foreground">نور يهديك في كل وقت · © Manar 2026</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function ManarMark({ size = 28, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const stroke = tone === "light" ? "#C9A227" : "#0E7A5F";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 4 L34 12 V28 L20 36 L6 28 V12 Z" stroke={stroke} strokeWidth="1.4" />
      <path d="M20 12 L28 16 V24 L20 28 L12 24 V16 Z" stroke={stroke} strokeWidth="1.2" />
      <circle cx="20" cy="20" r="2.2" fill={stroke} />
    </svg>
  );
}

function Section({ index, title, sub, children }: { index: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="text-[10px] tracking-[0.4em] text-gold">{index}</div>
          <h2 className="mt-2 font-display text-3xl font-medium">{title}</h2>
          <p className="mt-1 text-sm font-light text-muted-foreground">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:shadow-elegant">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{children}</div>;
}

function Swatch({ name, arabic, hex, className, role }: { name: string; arabic: string; hex: string; className: string; role: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border shadow-soft">
      <div className={`flex h-32 items-end p-4 ${className}`}>
        <span className="font-display text-2xl">{arabic}</span>
      </div>
      <div className="bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-[10px] uppercase tracking-widest text-gold">{role}</div>
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{hex}</div>
      </div>
    </div>
  );
}

function TokenRow({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <div className={`h-8 w-8 rounded-xl bg-${token} ring-1 ring-border`} />
      <div className="flex-1">
        <div className="text-xs font-medium">--{token}</div>
        <div className="text-[10px] text-muted-foreground">semantic token</div>
      </div>
    </div>
  );
}

const ICONS = [
  { label: "صلاة", svg: <Ico d="M12 3v18M5 10c0-3 3-5 7-5s7 2 7 5M5 14c0 3 3 5 7 5s7-2 7-5" /> },
  { label: "قرآن", svg: <Ico d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z M4 4v12a4 4 0 004 4" /> },
  { label: "قِبلة", svg: <Ico d="M12 3l4 9-4 9-4-9 4-9z M12 12h.01" /> },
  { label: "ذكر", svg: <Ico d="M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2" /> },
  { label: "مسجد", svg: <Ico d="M3 21V11l9-6 9 6v10 M9 21v-6h6v6 M12 8v3" /> },
  { label: "هلال", svg: <Ico d="M20 14A8 8 0 119.5 4a7 7 0 1010.5 10z" /> },
];
function Ico({ d }: { d: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function PhoneFrame({ mode }: { mode: "light" | "dark" }) {
  return (
    <div className={mode === "dark" ? "dark" : ""}>
      <div className="relative mx-auto w-full max-w-[300px]">
        <div className="rounded-[44px] border border-border bg-background p-3 shadow-elegant">
          <div className="overflow-hidden rounded-[34px] bg-background">
            {/* status */}
            <div className="flex items-center justify-between px-5 pt-4 text-[10px] text-foreground/70">
              <span>٩:٤١</span>
              <span>●●●●</span>
            </div>
            {/* hero card */}
            <div className="px-4 pt-4">
              <div className="gradient-hero relative overflow-hidden rounded-3xl p-5 text-white shadow-glow">
                <div className="pattern-arabesque absolute inset-0 opacity-30" />
                <div className="relative">
                  <div className="text-[10px] tracking-[0.3em] text-white/60">القادمة</div>
                  <div className="font-display text-5xl font-black tabular-nums">٠٥:١٧</div>
                  <div className="mt-1 text-xs font-light text-white/80">صلاة الفجر</div>
                </div>
              </div>
            </div>
            {/* grid */}
            <div className="grid grid-cols-3 gap-2 p-4">
              {ICONS.slice(0, 6).map((i) => (
                <div key={i.label} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-3">
                  <div className="text-primary">{i.svg}</div>
                  <div className="text-[9px] text-muted-foreground">{i.label}</div>
                </div>
              ))}
            </div>
            {/* tab bar */}
            <div className="m-3 flex items-center justify-around rounded-full border border-border bg-card py-2 shadow-soft">
              {["☾", "﷽", "✦", "❀"].map((g, idx) => (
                <button
                  key={g}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    idx === 1 ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {mode === "dark" ? "Dark · داكن" : "Light · فاتح"}
        </div>
      </div>
    </div>
  );
}
