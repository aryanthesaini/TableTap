"use client";
import { useRequireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { Spinner } from "@/components/ui/misc";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["OWNER", "STAFF"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireRole(ROLES);
  if (!ready) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  return <DashboardShell>{children}</DashboardShell>;
}
