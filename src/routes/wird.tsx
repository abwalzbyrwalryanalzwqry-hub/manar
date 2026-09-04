import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/wird")({
  component: () => <Outlet />,
});
