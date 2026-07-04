import { Arabesque, Icon, icons, Screen, ScreenHeader } from "@/components/manar/shell";

export function ComingSoon({
  title,
  subtitle,
  description,
  iconPath,
  backTo = "/quran",
}: {
  title: string;
  subtitle?: string;
  description: string;
  iconPath: string;
  backTo?: string;
}) {
  return (
    <Screen>
      <ScreenHeader title={title} subtitle={subtitle} backTo={backTo} />

      <div className="px-5 animate-fade-up">
        <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/60 p-8 shadow-elegant backdrop-blur-2xl">
          {/* Decorative arabesque backdrop */}
          <Arabesque className="pointer-events-none absolute -top-16 -left-16 h-72 w-72 text-primary/15" />
          <Arabesque className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 text-gold/20" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/5" />

          <div className="relative flex flex-col items-center text-center">
            {/* Illustration */}
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg viewBox="0 0 120 120" className="absolute inset-0 text-primary/25" aria-hidden>
                <path
                  d="M60 8 L100 30 V80 L60 112 L20 80 V30 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M60 22 L88 38 V74 L60 96 L32 74 V38 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.6"
                />
              </svg>
              <div className="gradient-primary relative flex h-20 w-20 items-center justify-center rounded-3xl text-primary-foreground shadow-glow">
                <Icon d={iconPath} size={34} />
              </div>
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-gold shadow-gold animate-pulse" />
            </div>

            <div className="mt-7 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-gold">
                قريبًا
              </span>
            </div>

            <h2 className="mt-5 font-display text-2xl font-medium leading-tight">
              {title}
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>

            <div className="mt-6 flex items-center gap-2">
              <span className="h-px w-8 bg-gold/50" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                منار
              </span>
              <span className="h-px w-8 bg-gold/50" />
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          نعمل على تجهيز هذه الميزة بأعلى معايير الجودة لتناسب تجربتك في منار.
        </p>
      </div>
    </Screen>
  );
}
