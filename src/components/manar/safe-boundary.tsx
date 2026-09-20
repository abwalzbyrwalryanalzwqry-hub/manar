// منار — عازل أخطاء للمكوّنات الخدمية (غير المرئية).
//
// سبب وجوده: مكوّنات مثل NativeBridge و AdhanProvider و CloudSyncBridge لا
// تَرسم شيئًا على الشاشة، لكنها تلمس واجهات الجهاز (الإشعارات، الموقع، الصوت،
// التخزين، Capacitor). أي استثناء داخلها كان يصعد إلى حاجز أخطاء الجذر فيمحو
// التطبيق بالكامل ويترك شاشة بيضاء — وهو بالضبط ما حدث على أندرويد ١٤ بينما
// يعمل كل شيء في المتصفح، لأن هذه المسارات لا تعمل إلا على الجهاز.
//
// بعد هذا العازل: تتعطّل الميزة وحدها، ويبقى التطبيق يعمل، ويُسجَّل الخطأ في
// السجل وفي `window.__MANAR_BOOT__` ليظهر في لوحة التشخيص.
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { name: string; children: ReactNode; fallback?: ReactNode };
type State = { failed: boolean };

declare global {
  interface Window {
    __MANAR_BOOT__?: {
      errors?: string[];
      note?: (message: string) => void;
    };
  }
}

export class SafeBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const line = `[${this.props.name}] ${error?.name ?? "Error"}: ${error?.message ?? String(error)}`;
    // يظهر في logcat عبر chrome://inspect وفي لوحة حارس الإقلاع.
    console.error("MANAR_SAFE_BOUNDARY", line, info?.componentStack);
    try {
      const boot = typeof window !== "undefined" ? window.__MANAR_BOOT__ : undefined;
      if (boot?.note) boot.note(line);
      else if (boot) (boot.errors ||= []).push(line);
    } catch {
      /* لا شيء: العازل نفسه لا يجوز أن يرمي */
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
