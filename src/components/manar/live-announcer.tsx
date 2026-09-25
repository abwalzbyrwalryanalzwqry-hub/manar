import { useCallback, useState } from "react";

/**
 * منطقة aria-live مخفية بصريًا. تعيد عنصرًا يُضاف مرة واحدة في الشاشة، ودالة announce.
 * تكرار الرسالة نفسها يُعلَن أيضًا، لأن محرفًا غير مرئي يتبدّل في آخرها كل مرة.
 */
export function useAnnouncer() {
  const [state, setState] = useState({ text: "", tick: 0 });
  const announce = useCallback((text: string) => setState((s) => ({ text, tick: s.tick + 1 })), []);
  const node = (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {state.text ? state.text + (state.tick % 2 ? "\u200b" : "") : ""}
    </div>
  );
  return { announce, node };
}
