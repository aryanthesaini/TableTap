"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, FileImage, FileText, Loader2, Plus, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import type { Dietary, DraftItem, MenuUpload, UploadStatus } from "@/lib/types";
import { bytes, dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { DietaryMark } from "@/components/dashboard/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";

const STATUS: Record<UploadStatus, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  PROCESSING: { label: "Processing", tone: "info" },
  READY_FOR_REVIEW: { label: "Needs review", tone: "warning" },
  PUBLISHED: { label: "Published", tone: "success" },
  DISCARDED: { label: "Discarded", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};

export default function MenuImportPage() {
  const { user } = useAuth();
  const [selected, setSelected] = React.useState<string | null>(null);
  if (user?.role !== "OWNER") {
    return <Card><EmptyState title="Owners only" description="Ask the restaurant owner to upload and publish menus." /></Card>;
  }
  return selected ? <Review uploadId={selected} onBack={() => setSelected(null)} /> : <UploadHome onOpen={setSelected} />;
}

function UploadHome({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const uploads = useQuery({
    queryKey: qk.uploads,
    queryFn: () => api<MenuUpload[]>("/restaurant/menu-imports"),
    refetchInterval: (q) => (q.state.data?.some((u) => u.status === "PROCESSING") ? 1500 : false),
  });
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api<MenuUpload>("/restaurant/menu-imports", { method: "POST", body: fd });
    },
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: qk.uploads }); onOpen(u.id); },
    onError: (e) => toast.error(errorMessage(e, "Upload failed")),
  });

  function accept(file: File | undefined) {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Upload a PDF, JPG, PNG or WebP file");
    if (file.size > 10 * 1024 * 1024) return toast.error("File must be 10 MB or smaller");
    upload.mutate(file);
  }

  async function useSample() {
    const blob = await fetch("/samples/sample-menu.jpg").then((r) => r.blob());
    accept(new File([blob], "annapoorna-menu.jpg", { type: "image/jpeg" }));
  }

  return (
    <>
      <PageHeader title="AI menu upload" description="Upload a photo or PDF of a printed menu. We'll extract categories, dishes and prices for you to review before anything goes live." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); }}
            className={cn("flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-surface px-6 py-14 text-center transition-colors",
              dragging ? "border-accent bg-accent-soft" : "border-border")}
          >
            {upload.isPending ? <Loader2 className="size-8 animate-spin text-faint" /> : <UploadCloud className="size-8 text-faint" />}
            <p className="mt-3 text-sm font-medium">{upload.isPending ? "Uploading…" : "Drop your menu here"}</p>
            <p className="mt-1 text-[13px] text-muted">PDF, JPG, PNG or WebP · up to 10 MB</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="primary" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>Choose file</Button>
              <Button disabled={upload.isPending} onClick={useSample}><Sparkles /> Try a sample menu</Button>
            </div>
            <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {[["Upload", "A clear photo or PDF of each page."], ["Review", "Fix anything highlighted in amber."], ["Publish", "Approved items are added to your menu."]].map(([t, d], i) => (
              <li key={t} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-xs font-medium text-faint">Step {i + 1}</p>
                <p className="mt-0.5 text-[13px] font-semibold">{t}</p>
                <p className="mt-0.5 text-xs text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>

        <Card>
          <CardHeader title="Recent uploads" />
          {uploads.isError ? <ErrorState onRetry={() => uploads.refetch()} /> : uploads.isLoading ? <div className="space-y-2 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            : !uploads.data?.length ? <EmptyState icon={FileText} title="No uploads yet" description="Your uploaded menus will appear here." />
            : (
              <ul className="divide-y divide-border">
                {uploads.data.map((u) => (
                  <li key={u.id}>
                    <button onClick={() => onOpen(u.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle/60 focus-ring">
                      {u.contentType === "application/pdf" ? <FileText className="size-5 text-faint" /> : <FileImage className="size-5 text-faint" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{u.originalFilename}</p>
                        <p className="text-xs text-muted">{dateTime(u.createdAt)} · {bytes(u.fileSize)}{u.itemCount ? ` · ${u.itemCount} items` : ""}</p>
                      </div>
                      <Badge tone={STATUS[u.status].tone}>{u.status === "PROCESSING" && <Loader2 className="size-3 animate-spin" />}{STATUS[u.status].label}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>
    </>
  );
}

function Review({ uploadId, onBack }: { uploadId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const upload = useQuery({
    queryKey: qk.upload(uploadId),
    queryFn: () => api<MenuUpload>(`/restaurant/menu-imports/${uploadId}`),
    refetchInterval: (q) => (q.state.data?.status === "PROCESSING" ? 1200 : false),
  });
  const [confirm, setConfirm] = React.useState<"publish" | "discard" | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: qk.upload(uploadId) }); qc.invalidateQueries({ queryKey: qk.uploads }); };

  const publish = useMutation({
    mutationFn: () => api<{ itemsCreated: number; categoriesCreated: number }>(`/restaurant/menu-imports/${uploadId}/publish`, { method: "POST" }),
    onSuccess: (r) => {
      toast.success(`Published ${r.itemsCreated} items`, { description: r.categoriesCreated ? `${r.categoriesCreated} new categories created. They're live on your menu now.` : "They're live on your menu now." });
      setConfirm(null); refresh(); qc.invalidateQueries({ queryKey: qk.menu });
    },
    onError: (e) => { toast.error(errorMessage(e)); setConfirm(null); },
  });
  const discard = useMutation({
    mutationFn: () => api<void>(`/restaurant/menu-imports/${uploadId}/discard`, { method: "POST" }),
    onSuccess: () => { toast.success("Upload discarded"); refresh(); onBack(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addItem = useMutation({
    mutationFn: () => api<DraftItem>(`/restaurant/menu-imports/${uploadId}/items`, { method: "POST", body: { categoryName: "Uncategorised", name: "New item", price: null, dietary: "VEG", included: true } }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const u = upload.data;
  const items = u?.items ?? [];
  const included = items.filter((i) => i.included);
  const flagged = items.filter((i) => i.uncertainFields.length > 0);
  const missingPrice = included.filter((i) => i.price === null);
  const reviewable = u?.status === "READY_FOR_REVIEW";
  const groups = new Map<string, DraftItem[]>();
  items.forEach((i) => groups.set(i.categoryName, [...(groups.get(i.categoryName) ?? []), i]));

  return (
    <>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"><ArrowLeft className="size-4" /> All uploads</button>
      <PageHeader
        title={u?.originalFilename ?? "Menu upload"}
        description={u ? <>Uploaded {dateTime(u.createdAt)} · <a className="underline underline-offset-2" href={u.fileUrl} target="_blank" rel="noreferrer">view original</a>{u.extractionProvider && ` · ${u.extractionProvider}`}</> : undefined}
        actions={u && <Badge tone={STATUS[u.status].tone}>{STATUS[u.status].label}</Badge>}
      />

      {upload.isError ? <Card><ErrorState onRetry={() => upload.refetch()} /></Card>
        : !u ? <Skeleton className="h-96" />
        : u.status === "PROCESSING" ? <Processing />
        : u.status === "FAILED" ? <Card><ErrorState message={u.errorMessage ?? "Extraction failed"} /></Card>
        : (
          <>
            {reviewable ? (
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs sm:flex-row sm:items-center">
                <div className="flex-1 text-[13px]">
                  <p className="font-medium">We found {items.length} items in {groups.size} categories.</p>
                  <p className="mt-0.5 text-muted">
                    {flagged.length ? <><span className="font-medium text-warning">{flagged.length} need a quick check</span> — highlighted below. </> : "Everything looks confident. "}
                    Nothing is visible to guests until you publish.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="danger-ghost" onClick={() => setConfirm("discard")}>Discard</Button>
                  <Button variant="primary" disabled={!included.length} onClick={() => setConfirm("publish")}><Check /> Publish {included.length} items</Button>
                </div>
              </div>
            ) : u.status === "PUBLISHED" ? (
              <p className="mb-4 rounded-lg bg-success-soft px-4 py-3 text-[13px] text-success">Published {u.publishedItemCount} items to your menu {dateTime(u.publishedAt)}.</p>
            ) : (
              <p className="mb-4 rounded-lg bg-subtle px-4 py-3 text-[13px] text-muted">This upload was discarded.</p>
            )}
            {reviewable && missingPrice.length > 0 && (
              <p className="mb-4 flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-2.5 text-[13px] text-warning">
                <AlertTriangle className="size-4" /> {missingPrice.length} included {missingPrice.length === 1 ? "item has" : "items have"} no price. Add a price or exclude {missingPrice.length === 1 ? "it" : "them"} before publishing.
              </p>
            )}

            <Card>
              <div className="hidden grid-cols-[32px_1fr_170px_110px_130px_36px] gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted md:grid">
                <span /><span>Item</span><span>Category</span><span>Price (₹)</span><span>Dietary</span><span />
              </div>
              {[...groups.entries()].map(([cat, list]) => (
                <div key={cat}>
                  <div className="border-b border-border bg-subtle/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</div>
                  <ul className="divide-y divide-border">
                    {list.map((item) => <DraftRow key={item.id} uploadId={uploadId} item={item} editable={reviewable} onChanged={refresh} />)}
                  </ul>
                </div>
              ))}
              {reviewable && (
                <div className="border-t border-border px-4 py-2.5">
                  <Button size="sm" variant="ghost" loading={addItem.isPending} onClick={() => addItem.mutate()}><Plus /> Add a missing item</Button>
                </div>
              )}
            </Card>
          </>
        )}

      <ConfirmDialog open={confirm === "publish"} onOpenChange={(o) => !o && setConfirm(null)}
        title={`Publish ${included.length} items?`}
        description={<>They&apos;ll be added to your live menu straight away. Categories that don&apos;t exist yet will be created. {items.length - included.length > 0 && `${items.length - included.length} excluded item(s) will be skipped.`}</>}
        confirmLabel="Publish to menu" loading={publish.isPending} onConfirm={() => publish.mutate()} />
      <ConfirmDialog open={confirm === "discard"} onOpenChange={(o) => !o && setConfirm(null)}
        title="Discard this upload?" description="The extracted items will be thrown away. Your live menu is not affected."
        confirmLabel="Discard" destructive loading={discard.isPending} onConfirm={() => discard.mutate()} />
    </>
  );
}

function Processing() {
  const steps = ["Reading the document", "Finding categories", "Extracting dishes and prices", "Checking confidence"];
  const [step, setStep] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 800); return () => clearInterval(t); }, [steps.length]);
  return (
    <Card className="mx-auto max-w-md px-6 py-10">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"><Sparkles className="size-6" /></div>
      <p className="mt-4 text-center text-sm font-semibold">Reading your menu…</p>
      <ol className="mx-auto mt-5 w-fit space-y-2 text-[13px]">
        {steps.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2", i > step ? "text-faint" : i === step ? "text-fg" : "text-muted")}>
            {i < step ? <Check className="size-4 text-success" /> : i === step ? <Loader2 className="size-4 animate-spin" /> : <span className="size-4" />}
            {s}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function DraftRow({ uploadId, item, editable, onChanged }: { uploadId: string; item: DraftItem; editable: boolean; onChanged: () => void }) {
  const [draft, setDraft] = React.useState({
    name: item.name, categoryName: item.categoryName, price: item.price?.toString() ?? "", dietary: item.dietary ?? "", included: item.included,
  });
  React.useEffect(() => {
    setDraft({ name: item.name, categoryName: item.categoryName, price: item.price?.toString() ?? "", dietary: item.dietary ?? "", included: item.included });
  }, [item]);
  const flagged = new Set(item.uncertainFields);

  const save = useMutation({
    mutationFn: (next: typeof draft) => api<DraftItem>(`/restaurant/menu-imports/${uploadId}/items/${item.id}`, {
      method: "PUT",
      body: {
        name: next.name.trim() || item.name, categoryName: next.categoryName.trim() || item.categoryName, description: item.description,
        price: next.price === "" ? null : Number(next.price), dietary: next.dietary || null, included: next.included,
      },
    }),
    onSuccess: onChanged,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api<void>(`/restaurant/menu-imports/${uploadId}/items/${item.id}`, { method: "DELETE" }),
    onSuccess: onChanged,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const commit = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (next.price !== "" && !/^\d+(\.\d{1,2})?$/.test(next.price)) { toast.error("Price must be a number"); return; }
    save.mutate(next);
  };
  const warn = (field: string) => flagged.has(field) ? "border-warning bg-warning-soft/60 focus:ring-warning/20" : "";
  const isDirty = (f: keyof typeof draft) => draft[f] !== ({ name: item.name, categoryName: item.categoryName, price: item.price?.toString() ?? "", dietary: item.dietary ?? "", included: item.included })[f];

  return (
    <li className={cn("grid grid-cols-[32px_1fr_36px] items-center gap-x-3 gap-y-2 px-4 py-2.5 md:grid-cols-[32px_1fr_170px_110px_130px_36px]", !draft.included && "opacity-55")}>
      <input type="checkbox" className="size-4 accent-[hsl(var(--fg))]" checked={draft.included} disabled={!editable}
        aria-label={`Include ${item.name}`} onChange={(e) => commit({ included: e.target.checked })} />
      <div className="min-w-0">
        <Input value={draft.name} disabled={!editable} aria-label="Item name" className={cn("h-8", warn("name"))}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => isDirty("name") && commit({})} />
        <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
          <Confidence value={Number(item.confidence)} />
          {item.uncertainFields.length > 0 && <span className="text-warning">Check {item.uncertainFields.join(", ")}</span>}
          {save.isPending && <Loader2 className="size-3 animate-spin" />}
        </div>
      </div>
      <Input value={draft.categoryName} disabled={!editable} aria-label="Category" className={cn("col-start-2 h-8 md:col-start-auto", warn("category"))}
        onChange={(e) => setDraft({ ...draft, categoryName: e.target.value })} onBlur={() => isDirty("categoryName") && commit({})} />
      <Input value={draft.price} disabled={!editable} inputMode="decimal" placeholder="Add price" aria-label="Price"
        className={cn("col-start-2 h-8 md:col-start-auto tabular", warn("price"), draft.included && draft.price === "" && "border-warning")}
        onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, "") })} onBlur={() => isDirty("price") && commit({})} />
      <div className="col-start-2 flex items-center gap-2 md:col-start-auto">
        <DietaryMark dietary={(draft.dietary || null) as Dietary | null} />
        <Select value={draft.dietary} disabled={!editable} aria-label="Dietary" className={cn("h-8", warn("dietary"))}
          onChange={(e) => commit({ dietary: e.target.value })}>
          <option value="">Not set</option><option value="VEG">Veg</option><option value="NON_VEG">Non-veg</option><option value="EGG">Egg</option>
        </Select>
      </div>
      {editable ? (
        <Button size="icon" variant="ghost" className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto" aria-label={`Remove ${item.name}`} loading={remove.isPending} onClick={() => remove.mutate()}><Trash2 /></Button>
      ) : <span />}
    </li>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1" title={`Extraction confidence ${pct}%`}>
      <span className="h-1 w-8 overflow-hidden rounded-full bg-subtle">
        <span className={cn("block h-full", pct >= 85 ? "bg-success" : pct >= 65 ? "bg-warning" : "bg-danger")} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular">{pct}%</span>
    </span>
  );
}
