import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AdhanProvider } from "@/components/manar/adhan-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { CloudSyncBridge } from "@/components/manar/cloud-sync-bridge";
import { NativeBridge } from "@/components/manar/native-bridge";
import { SafeBoundary } from "@/components/manar/safe-boundary";
import { ManarNotFound, ManarRouteError } from "@/components/manar/error-screens";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no",
      },
      { title: "منار — نور يهديك في كل وقت" },
      {
        name: "description",
        content:
          "منار: مواقيت الصلاة والأذان والقرآن الكريم والأذكار والوِرد — يعمل بالكامل دون اتصال بالإنترنت.",
      },
      { name: "author", content: "منار" },
      { name: "theme-color", content: "#0B1F1A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "منار — نور يهديك في كل وقت" },
      {
        property: "og:description",
        content: "مواقيت الصلاة، الأذان، القرآن الكريم، الأذكار والوِرد في تطبيق واحد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Self-hosted Quran fonts — bundled locally so the Mushaf renders offline.
      { rel: "stylesheet", href: "/fonts/quran-fonts.css" },
      // Self-hosted interface font — bundled locally for the same reason.
      { rel: "stylesheet", href: "/fonts/ui-fonts.css" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: ManarNotFound,
  errorComponent: ManarRouteError,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body data-manar-root="">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* كل مكوّن خدمي في عازله: عطل في الإشعارات أو الصوت أو المزامنة
            يوقف ميزته وحدها ولا يُبيّض الشاشة كما حدث على أندرويد ١٤. */}
        <SafeBoundary name="CloudSyncBridge">
          <CloudSyncBridge />
        </SafeBoundary>
        <SafeBoundary name="AdhanProvider">
          <AdhanProvider />
        </SafeBoundary>
        <SafeBoundary name="NativeBridge">
          <NativeBridge />
        </SafeBoundary>
        <Toaster position="top-center" dir="rtl" richColors closeButton />
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  );
}
