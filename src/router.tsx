import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ManarNotFound, ManarRouteError } from "./components/manar/error-screens";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // افتراضي لكل مستوى: بدون هذا يعرض TanStack نصوصه الإنجليزية في أي مسار
    // فرعي يفشل ("Not Found" / "This page didn't load")، وهو النص الذي ظهر على
    // الجهاز فأوهمنا بأنه صفحة خطأ من الويب فيو.
    defaultNotFoundComponent: ManarNotFound,
    defaultErrorComponent: ManarRouteError,
  });

  return router;
};
