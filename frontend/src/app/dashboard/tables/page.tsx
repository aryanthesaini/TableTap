"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, MoreHorizontal, Pencil, Plus, Power, QrCode, RefreshCw, Trash2, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk, useRestaurant } from "@/lib/queries";
import type { Table, TableActivity } from "@/lib/types";
import { dateTime, money, timeAgo } from "@/lib/format";
import { downloadDataUrl, qrDataUrl, tableCardPng } from "@/lib/qr";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Field, Input } from "@/components/ui/input";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";

type Confirm = { kind: "regenerate" | "delete" | "deactivate"; table: Table } | null;

export default function TablesPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const qc = useQueryClient();
  const tables = useQuery({ queryKey: qk.tables, queryFn: () => api<Table[]>("/restaurant/tables") });
  const activity = useQuery({ queryKey: qk.tableActivity, queryFn: () => api<TableActivity[]>("/restaurant/orders/table-activity"), refetchInterval: 15_000 });
  const byTable = new Map((activity.data ?? []).map((a) => [a.tableId, a]));

  const [editing, setEditing] = React.useState<Table | "new" | null>(null);
  const [preview, setPreview] = React.useState<Table | null>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.tables });
  const statusMutation = useMutation({
    mutationFn: ({ table, active }: { table: Table; active: boolean }) =>
      api<Table>(`/restaurant/tables/${table.id}/status`, { method: "PATCH", body: { active } }),
    onSuccess: (t) => { toast.success(`${t.name} ${t.active ? "activated" : "deactivated"}`); refresh(); setConfirm(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const regenerate = useMutation({
    mutationFn: (table: Table) => api<Table>(`/restaurant/tables/${table.id}/qr/regenerate`, { method: "POST" }),
    onSuccess: (t) => { toast.success(`New QR code generated for ${t.name}`, { description: "Print and replace the old code on the table." }); refresh(); setConfirm(null); setPreview(t); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (table: Table) => api<void>(`/restaurant/tables/${table.id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Table removed"); refresh(); setConfirm(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const list = tables.data ?? [];
  const activeCount = list.filter((t) => t.active).length;

  return (
    <>
      <PageHeader
        title="Tables & QR codes"
        description={tables.data ? `${activeCount} active of ${list.length} tables. Each table has its own QR code that opens your menu.` : "Each table has its own QR code."}
        actions={isOwner && <Button variant="primary" onClick={() => setEditing("new")}><Plus /> Add table</Button>}
      />

      {tables.isError ? <Card><ErrorState onRetry={() => tables.refetch()} /></Card>
        : tables.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[148px]" />)}</div>
        : list.length === 0 ? (
          <Card><EmptyState icon={QrCode} title="No tables yet" description="Add your first table to generate its QR code."
            action={isOwner && <Button variant="primary" onClick={() => setEditing("new")}><Plus /> Add table</Button>} /></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((t) => {
              const a = byTable.get(t.id);
              return (
                <Card key={t.id} className={cn("flex flex-col", !t.active && "bg-subtle/50")}>
                  <div className="flex items-start gap-3 p-4">
                    <button onClick={() => setPreview(t)} aria-label={`Show QR code for ${t.name}`}
                      className="shrink-0 rounded-md border border-border bg-white p-1 transition-shadow hover:shadow-pop focus-ring">
                      <QrThumb url={t.orderingUrl} dim={!t.active} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold">{t.name}</h3>
                        <TableMenu table={t} isOwner={isOwner}
                          onPreview={() => setPreview(t)} onEdit={() => setEditing(t)}
                          onToggle={() => t.active ? setConfirm({ kind: "deactivate", table: t }) : statusMutation.mutate({ table: t, active: true })}
                          onRegenerate={() => setConfirm({ kind: "regenerate", table: t })}
                          onDelete={() => setConfirm({ kind: "delete", table: t })} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {t.active ? <Badge tone="success" dot>Active</Badge> : <Badge>Inactive</Badge>}
                        {t.seats && <span className="inline-flex items-center gap-1 text-xs text-muted"><Users className="size-3" />{t.seats}</span>}
                      </div>
                      <p className="mt-2 text-xs text-faint">QR generated {timeAgo(t.qrGeneratedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border px-4 py-2 text-xs">
                    {a?.pendingOrders ? (
                      <span className="font-medium text-warning">{a.pendingOrders} pending {a.pendingOrders === 1 ? "order" : "orders"}</span>
                    ) : (
                      <span className="text-muted">{a?.ordersToday ? `${a.ordersToday} ${a.ordersToday === 1 ? "order" : "orders"} today` : "No orders today"}</span>
                    )}
                    <span className="tabular text-muted">{a?.ordersToday ? money(a.revenueToday) : ""}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <TableFormDialog table={editing} onClose={() => setEditing(null)} onSaved={(t, created) => { refresh(); setEditing(null); if (created) setPreview(t); }} />
      <QrPreviewDialog table={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={confirm?.kind === "regenerate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Regenerate QR for ${confirm?.table.name}?`}
        description="The current printed QR code will stop working immediately. You'll need to print and place the new one."
        confirmLabel="Regenerate"
        destructive
        loading={regenerate.isPending}
        onConfirm={() => confirm && regenerate.mutate(confirm.table)}
      />
      <ConfirmDialog
        open={confirm?.kind === "deactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Deactivate ${confirm?.table.name}?`}
        description="Guests scanning this table's QR code will still see the menu but won't be able to place orders."
        confirmLabel="Deactivate"
        loading={statusMutation.isPending}
        onConfirm={() => confirm && statusMutation.mutate({ table: confirm.table, active: false })}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Remove ${confirm?.table.name}?`}
        description="The table and its QR code will be removed. Past orders from this table are kept in your history."
        confirmLabel="Remove table"
        destructive
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm.table)}
      />
    </>
  );
}

function QrThumb({ url, dim }: { url: string; dim?: boolean }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => { qrDataUrl(url, 160).then(setSrc); }, [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className={cn("size-16", dim && "opacity-30")} /> : <div className="size-16" />;
}

function TableMenu({ table, isOwner, onPreview, onEdit, onToggle, onRegenerate, onDelete }: {
  table: Table; isOwner: boolean; onPreview: () => void; onEdit: () => void; onToggle: () => void; onRegenerate: () => void; onDelete: () => void;
}) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-7" aria-label={`Actions for ${table.name}`}><MoreHorizontal /></Button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={onPreview}><QrCode /> View & download QR</DropdownItem>
        <DropdownItem onSelect={() => window.open(table.orderingUrl, "_blank")}><ExternalLink /> Open ordering page</DropdownItem>
        {isOwner && (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={onEdit}><Pencil /> Rename</DropdownItem>
            <DropdownItem onSelect={onToggle}><Power /> {table.active ? "Deactivate" : "Activate"}</DropdownItem>
            <DropdownItem onSelect={onRegenerate}><RefreshCw /> Regenerate QR</DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onSelect={onDelete}><Trash2 /> Remove table</DropdownItem>
          </>
        )}
      </DropdownContent>
    </Dropdown>
  );
}

function TableFormDialog({ table, onClose, onSaved }: { table: Table | "new" | null; onClose: () => void; onSaved: (t: Table, created: boolean) => void }) {
  const isNew = table === "new";
  const [name, setName] = React.useState("");
  const [seats, setSeats] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (table && table !== "new") { setName(table.name); setSeats(table.seats?.toString() ?? ""); }
    else { setName(""); setSeats("4"); }
    setError(null);
  }, [table]);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), seats: seats ? Number(seats) : null };
      return isNew
        ? api<Table>("/restaurant/tables", { method: "POST", body })
        : api<Table>(`/restaurant/tables/${(table as Table).id}`, { method: "PUT", body });
    },
    onSuccess: (t) => { toast.success(isNew ? `${t.name} created — QR code ready` : "Table updated"); onSaved(t, isNew); },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={isNew ? "Add table" : "Edit table"} description={isNew ? "A unique QR code is generated automatically." : undefined}>
        <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setError("Give the table a name"); return; } save.mutate(); }}>
          <DialogBody>
            <Field label="Table name" htmlFor="table-name" hint='For example "Table 12" or "Patio 3"' error={error}>
              <Input id="table-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus aria-invalid={!!error} />
            </Field>
            <Field label="Seats" htmlFor="table-seats" hint="Optional">
              <Input id="table-seats" type="number" min={1} max={50} value={seats} onChange={(e) => setSeats(e.target.value)} className="w-28" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={save.isPending}>{isNew ? "Create table" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QrPreviewDialog({ table, onClose }: { table: Table | null; onClose: () => void }) {
  const restaurant = useRestaurant();
  const [src, setSrc] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  React.useEffect(() => { setSrc(null); if (table) qrDataUrl(table.orderingUrl, 640).then(setSrc); }, [table]);

  async function download(kind: "card" | "qr") {
    if (!table) return;
    setDownloading(true);
    try {
      const slug = table.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const data = kind === "qr" ? await qrDataUrl(table.orderingUrl, 1024) : await tableCardPng({
        url: table.orderingUrl, tableName: table.name,
        restaurantName: restaurant.data?.name ?? "", brandColor: restaurant.data?.brandColor ?? "#1c1917",
      });
      downloadDataUrl(data, `${slug}-${kind === "qr" ? "qr" : "table-card"}.png`);
    } finally { setDownloading(false); }
  }

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={table ? `${table.name} QR code` : "QR code"} description={table ? `Generated ${dateTime(table.qrGeneratedAt)}` : undefined}>
        {table && (
          <>
            <DialogBody>
              {!table.active && <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">This table is inactive — guests can view the menu but can&apos;t order.</p>}
              <div className="mx-auto w-fit rounded-lg border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src ? <img src={src} alt={`QR code for ${table.name}`} className="size-56" /> : <Skeleton className="size-56" />}
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-subtle px-2.5 py-1.5">
                <code className="min-w-0 flex-1 truncate text-xs text-muted">{table.orderingUrl}</code>
                <Button size="icon" variant="ghost" className="size-7" aria-label="Copy link"
                  onClick={() => navigator.clipboard.writeText(table.orderingUrl).then(() => toast.success("Link copied"))}><Copy /></Button>
                <Button size="icon" variant="ghost" className="size-7" aria-label="Open ordering page" asChild>
                  <a href={table.orderingUrl} target="_blank" rel="noreferrer"><ExternalLink /></a>
                </Button>
              </div>
            </DialogBody>
            <DialogFooter className="justify-between">
              <Button variant="ghost" onClick={() => download("qr")} disabled={downloading}><Download /> QR only</Button>
              <Button variant="primary" onClick={() => download("card")} loading={downloading}><Download /> Download table card</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
