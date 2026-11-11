"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { OrderCounts, Restaurant } from "./types";

export const qk = {
  restaurant: ["restaurant"] as const,
  orderCounts: ["orders", "counts"] as const,
  orders: (params: object) => ["orders", "list", params] as const,
  tableActivity: ["orders", "table-activity"] as const,
  overview: ["overview"] as const,
  menu: ["menu"] as const,
  tables: ["tables"] as const,
  payments: (params: object) => ["payments", params] as const,
  paymentSummary: ["payments", "summary"] as const,
  paymentConfig: ["payments", "config"] as const,
  uploads: ["menu-imports"] as const,
  upload: (id: string) => ["menu-imports", id] as const,
};

export function useRestaurant() {
  return useQuery({ queryKey: qk.restaurant, queryFn: () => api<Restaurant>("/restaurant/profile") });
}

export function useOrderCounts() {
  return useQuery({
    queryKey: qk.orderCounts,
    queryFn: () => api<OrderCounts>("/restaurant/orders/counts"),
    refetchInterval: 10_000,
  });
}
