"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth, useRequireRole } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

const ROLES: Role[] = ["PLATFORM_ADMIN"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireRole(ROLES);
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!ready) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link href="/admin" className="focus-ring rounded"><Logo /></Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-border">
            <ShieldCheck className="size-3.5" /> Platform admin
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[13px] text-muted sm:inline">{user?.email}</span>
            <Button size="sm" variant="ghost" onClick={() => { logout(); router.replace("/login"); }}><LogOut /> Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
