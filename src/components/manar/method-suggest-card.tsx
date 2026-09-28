/* منار — بطاقة «الطريقة الشائعة في بلدك». تظهر بعد تحديد الموقع بـGPS فقط،
 * ولا تغيّر شيئاً إلا بضغطة «اعتمدها». «لا، شكراً» يخفيها لهذا البلد. */

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Icon, icons } from "@/components/manar/shell";
import { dismissSuggestion, methodSuggestion, readDismissed } from "@/lib/method-suggest";
import { METHOD_LABELS, useLocation, useSettings } from "@/lib/prayer";

export function MethodSuggestCard({ className = "" }: { className?: string }) {
  const { location } = useLocation();
  const { settings, patchSettings } = useSettings();
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  useEffect(() => setDismissed(readDismissed()), []);

  const s = dismissed ? methodSuggestion(location, settings.method, dismissed) : null;
  if (!s) return null;

  return (
    <div
      className={`rounded-2xl border border-gold/30 bg-card p-4 shadow-soft ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="gradient-gold flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-navy">
          <Icon d={icons.location} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">الطريقة الشائعة في {s.country}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {METHOD_LABELS[s.method]}. المختارة الآن: {METHOD_LABELS[settings.method]}.
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            patchSettings({ method: s.method });
            toast.success("اعتُمدت الطريقة، وأُعيد حساب المواقيت");
          }}
          className="gradient-primary rounded-xl py-2.5 text-xs font-medium text-primary-foreground shadow-glow"
        >
          اعتمدها
        </button>
        <button
          type="button"
          onClick={() => {
            dismissSuggestion(s.country, s.method);
            setDismissed(readDismissed());
          }}
          className="rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-muted-foreground"
        >
          لا، شكراً
        </button>
      </div>
    </div>
  );
}
