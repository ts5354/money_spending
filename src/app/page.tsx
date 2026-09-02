import { redirect } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";
import { getAccessState } from "@/lib/auth/authorization";

export default async function DashboardPage() {
  const access = await getAccessState();
  if (access.status === "unauthenticated") redirect("/sign-in");
  if (access.status === "forbidden") return <AccessDenied />;
  return <DashboardPageContent />;
}
