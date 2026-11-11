"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Storefront } from "@/lib/types";

export function useStorefront(slug: string, token: string) {
  return useQuery({
    queryKey: ["storefront", slug, token],
    queryFn: () => api<Storefront>(`/public/storefront/${slug}/tables/${token}`, { auth: false }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Orders placed from this table on this device, newest first (for "track your order"). */
export const placedOrders = {
  key: (token: string) => `tabletap.orders.${token}`,
  list(token: string): { id: string; number: number; at: string }[] {
    try { return JSON.parse(localStorage.getItem(this.key(token)) ?? "[]"); } catch { return []; }
  },
  add(token: string, id: string, number: number) {
    const list = this.list(token).filter((o) => o.id !== id);
    try { localStorage.setItem(this.key(token), JSON.stringify([{ id, number, at: new Date().toISOString() }, ...list].slice(0, 10))); } catch { /* ignore */ }
  },
};
