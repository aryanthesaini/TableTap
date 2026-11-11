"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, Store, UserRound } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import type { DemoAccount } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, status } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status === "authenticated" && user) router.replace(homeFor(user.role));
  }, [status, user, router]);

  const demo = useQuery({
    queryKey: ["demo-accounts"],
    queryFn: () => api<DemoAccount[]>("/auth/demo-accounts", { auth: false }),
    staleTime: Infinity,
  });

  async function signIn(e: string, p: string, key: string) {
    setError(null);
    setPending(key);
    try {
      const u = await login(e, p);
      router.replace(homeFor(u.role));
    } catch (err) {
      setError(errorMessage(err, "Sign in failed"));
      setPending(null);
    }
  }

  const groups = React.useMemo(() => {
    const map = new Map<string, DemoAccount[]>();
    for (const a of demo.data ?? []) {
      const k = a.restaurantName ?? "Platform";
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return [...map.entries()];
  }, [demo.data]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to your restaurant</h1>
          <p className="mt-1 text-[13px] text-muted">Manage orders, tables and your menu.</p>
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => { e.preventDefault(); signIn(email, password, "form"); }}
          >
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.in" />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={pending === "form"}>Sign in</Button>
          </form>
          <p className="mt-6 text-xs text-faint">Customers never need an account — they order by scanning the QR code on their table.</p>
        </div>
      </div>

      <div className="border-t border-border bg-subtle/60 px-6 py-8 sm:px-12 lg:border-l lg:border-t-0">
        <div className="mx-auto flex h-full max-w-lg flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Demo</span>
            <p className="text-[13px] text-muted">Every account uses the password <code className="rounded bg-surface px-1.5 py-0.5 text-fg ring-1 ring-border">demo1234</code></p>
          </div>
          <h2 className="mt-3 text-base font-semibold">Jump into a demo account</h2>
          <p className="mt-1 text-[13px] text-muted">Three independent restaurants share the platform. Each only sees its own data.</p>

          <div className="mt-6 space-y-3">
            {demo.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[92px]" />)}
            {demo.isError && <p className="text-[13px] text-danger">Couldn&apos;t load demo accounts — is the backend running on port 8080?</p>}
            {groups.map(([name, accounts]) => (
              <div key={name} className="rounded-lg border border-border bg-surface shadow-xs">
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  {name === "Platform" ? <ShieldCheck className="size-4 text-faint" /> : <Store className="size-4 text-faint" />}
                  <span className="text-[13px] font-semibold">{name === "Platform" ? "TableTap platform" : name}</span>
                </div>
                <div className="divide-y divide-border">
                  {accounts.map((a) => (
                    <button
                      key={a.email}
                      onClick={() => signIn(a.email, a.password, a.email)}
                      disabled={!!pending}
                      className={cn("group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-subtle/70 focus-ring disabled:opacity-60")}
                    >
                      <UserRound className="size-4 shrink-0 text-faint" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{a.fullName} <span className="font-normal text-faint">· {roleLabel(a.role)}</span></p>
                        <p className="truncate text-xs text-muted">{a.email}</p>
                      </div>
                      {pending === a.email ? (
                        <span className="text-xs text-muted">Signing in…</span>
                      ) : (
                        <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: DemoAccount["role"]) {
  return role === "OWNER" ? "Owner" : role === "STAFF" ? "Staff" : "Platform admin";
}
