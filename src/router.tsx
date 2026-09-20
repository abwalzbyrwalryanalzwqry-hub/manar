import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ManarNotFound, ManarRouteError } from "./components/manar/error-screens";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // افتراضي لكل مستوى: بدون هذا يعرض TanStack نصوصه الإنجليزية في أي مسار
    // فرعي يفشل، وهو ما ظهر على الجهاز كشاشة بيضاء بنص إنجليزي.
    defaultNotFoundComponent: ManarNotFound,
    defaultErrorComponent: ManarRouteError,
  });

  return router;
};
