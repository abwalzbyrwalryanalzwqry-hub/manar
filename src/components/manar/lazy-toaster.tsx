/* يركّب `<Toaster>` (sonner) عند أول إشعار عابر لا عند الإقلاع — انظر `@/lib/toast`. */
import { lazy, Suspense, useEffect, useState } from "react";
import { markToasterMounted, onToasterRequested, toasterRequested } from "@/lib/toast";

const Toaster = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({
    default: function MountedToaster(props: React.ComponentProps<typeof m.Toaster>) {
      useEffect(() => {
        markToasterMounted();
      }, []);
      return <m.Toaster {...props} />;
    },
  })),
);

export function LazyToaster() {
  const [want, setWant] = useState(toasterRequested);
  useEffect(() => (want ? undefined : onToasterRequested(() => setWant(true))), [want]);
  if (!want) return null;
  return (
    <Suspense fallback={null}>
      <Toaster position="top-center" dir="rtl" richColors closeButton />
    </Suspense>
  );
}
