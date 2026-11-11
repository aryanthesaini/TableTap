"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeFor, useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/misc";

export default function Home() {
  const { user, status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && user) router.replace(homeFor(user.role));
  }, [status, user, router]);
  return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
}
