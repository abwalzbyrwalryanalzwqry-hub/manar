import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TabBar } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}
