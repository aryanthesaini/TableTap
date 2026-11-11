"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Restaurant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function RestaurantStatusButton({ restaurant, size = "sm" }: { restaurant: Restaurant; size?: "sm" | "md" }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const suspend = restaurant.status === "ACTIVE";
  const mutation = useMutation({
    mutationFn: () => api<Restaurant>(`/admin/restaurants/${restaurant.id}/status`, { method: "PATCH", body: { status: suspend ? "SUSPENDED" : "ACTIVE" } }),
    onSuccess: (r) => {
      toast.success(`${r.name} ${r.status === "ACTIVE" ? "activated" : "suspended"}`);
      qc.invalidateQueries({ queryKey: ["admin"] });
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <Button size={size} variant={suspend ? "danger-ghost" : "secondary"} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {suspend ? "Suspend" : "Activate"}
      </Button>
      <ConfirmDialog open={open} onOpenChange={setOpen}
        title={suspend ? `Suspend ${restaurant.name}?` : `Activate ${restaurant.name}?`}
        description={suspend
          ? "Guests won't be able to order, and the restaurant's team will be unable to sign in. Data is kept and can be restored at any time."
          : "The restaurant's team can sign in again and guests can place orders."}
        confirmLabel={suspend ? "Suspend restaurant" : "Activate"} destructive={suspend} loading={mutation.isPending}
        onConfirm={() => mutation.mutate()} />
    </>
  );
}
