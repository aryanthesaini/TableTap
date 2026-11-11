"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, Upload, UtensilsCrossed } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import type { Category, Dietary, Menu, MenuItem } from "@/lib/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { DietaryMark } from "@/components/dashboard/status";
import { FoodImage } from "@/components/food-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";

const LIBRARY = ["baingan-bharta", "brownie", "butter-chicken", "cheesecake", "chicken-biryani", "chicken-fried-rice", "chicken-handi",
  "chilli-chicken", "chilli-prawns", "dal-fry", "egg-rolls", "fish-fry", "flatbread", "hakka-noodles", "hot-sour-soup", "lamb-biryani",
  "lamb-chops", "mango-custard", "mango-lassi", "masala-fish", "matar-paneer", "modak", "momos", "paneer-chilli", "prawn-curry",
  "prawn-fried-rice", "rajma", "rogan-josh", "seekh-kebab", "steamed-rice", "sweet-corn-soup", "tandoori-chicken"].map((n) => `/images/menu/${n}.jpg`);

type ItemDialogState = { item: MenuItem | null; categoryId: string } | null;
type Pending = { kind: "category"; category: Category } | { kind: "item"; item: MenuItem } | null;

export default function MenuPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: qk.menu, queryFn: () => api<Menu>("/restaurant/menu") });
  const [selectedCat, setSelectedCat] = React.useState<string | "all">("all");
  const [search, setSearch] = React.useState("");
  const [catDialog, setCatDialog] = React.useState<Category | "new" | null>(null);
  const [itemDialog, setItemDialog] = React.useState<ItemDialogState>(null);
  const [toDelete, setToDelete] = React.useState<Pending>(null);

  const categories = React.useMemo(() => menu.data?.categories ?? [], [menu.data]);
  React.useEffect(() => {
    if (selectedCat !== "all" && menu.data && !categories.some((c) => c.id === selectedCat)) setSelectedCat("all");
  }, [menu.data, categories, selectedCat]);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.menu });

  const availability = useMutation({
    mutationFn: ({ item, available }: { item: MenuItem; available: boolean }) =>
      api<MenuItem>(`/restaurant/menu/items/${item.id}/availability`, { method: "PATCH", body: { available } }),
    onMutate: async ({ item, available }) => {
      await qc.cancelQueries({ queryKey: qk.menu });
      qc.setQueryData<Menu>(qk.menu, (m) => m && {
        ...m, categories: m.categories.map((c) => ({ ...c, items: c.items.map((i) => i.id === item.id ? { ...i, available } : i) })),
      });
    },
    onSuccess: (i) => toast.success(i.available ? `${i.name} is back on the menu` : `${i.name} marked sold out`),
    onError: (e) => { toast.error(errorMessage(e)); refresh(); },
    onSettled: refresh,
  });
  const reorderCats = useMutation({
    mutationFn: (ids: string[]) => api<void>("/restaurant/menu/categories/order", { method: "PUT", body: { orderedIds: ids } }),
    onError: (e) => toast.error(errorMessage(e)), onSettled: refresh,
  });
  const reorderItems = useMutation({
    mutationFn: ({ categoryId, ids }: { categoryId: string; ids: string[] }) =>
      api<void>(`/restaurant/menu/categories/${categoryId}/items/order`, { method: "PUT", body: { orderedIds: ids } }),
    onError: (e) => toast.error(errorMessage(e)), onSettled: refresh,
  });
  const deletion = useMutation({
    mutationFn: (p: NonNullable<Pending>) => p.kind === "category"
      ? api<void>(`/restaurant/menu/categories/${p.category.id}`, { method: "DELETE" })
      : api<void>(`/restaurant/menu/items/${p.item.id}`, { method: "DELETE" }),
    onSuccess: (_, p) => { toast.success(p.kind === "category" ? `Deleted ${p.category.name}` : `Deleted ${p.item.name}`); setToDelete(null); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function moveCategory(index: number, dir: -1 | 1) {
    const ids = categories.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    qc.setQueryData<Menu>(qk.menu, (m) => m && { ...m, categories: ids.map((id) => m.categories.find((c) => c.id === id)!) });
    reorderCats.mutate(ids);
  }
  function moveItem(category: Category, index: number, dir: -1 | 1) {
    const ids = category.items.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    qc.setQueryData<Menu>(qk.menu, (m) => m && {
      ...m, categories: m.categories.map((c) => c.id === category.id ? { ...c, items: ids.map((id) => c.items.find((i) => i.id === id)!) } : c),
    });
    reorderItems.mutate({ categoryId: category.id, ids });
  }

  const q = search.trim().toLowerCase();
  const visible = categories
    .filter((c) => selectedCat === "all" || c.id === selectedCat)
    .map((c) => ({ ...c, items: q ? c.items.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)) : c.items }))
    .filter((c) => !q || c.items.length > 0);

  return (
    <>
      <PageHeader
        title="Menu"
        description={menu.data ? `${menu.data.totalItems} items in ${categories.length} categories${menu.data.unavailableItems ? ` · ${menu.data.unavailableItems} sold out` : ""}` : "Categories, items and prices"}
        actions={isOwner && (
          <>
            <Button onClick={() => setCatDialog("new")}><Plus /> Category</Button>
            <Button variant="primary" disabled={!categories.length}
              onClick={() => setItemDialog({ item: null, categoryId: selectedCat !== "all" ? selectedCat : categories[0]?.id })}><Plus /> Add item</Button>
          </>
        )}
      />
      {!isOwner && <p className="-mt-3 mb-5 text-[13px] text-muted">As staff you can mark items sold out or available. Ask an owner to change prices or items.</p>}

      {menu.isError ? <Card><ErrorState onRetry={() => menu.refetch()} /></Card> : menu.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]"><Skeleton className="h-80" /><Skeleton className="h-[480px]" /></div>
      ) : categories.length === 0 ? (
        <Card><EmptyState icon={UtensilsCrossed} title="Your menu is empty" description="Start by creating a category like Starters or Main Course — or upload your existing menu on the AI menu upload page."
          action={isOwner && <Button variant="primary" onClick={() => setCatDialog("new")}><Plus /> Create category</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr] [&>*]:min-w-0">
          {/* Categories */}
          <nav aria-label="Categories" className="lg:sticky lg:top-6 lg:self-start">
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0">
              <CategoryButton active={selectedCat === "all"} onClick={() => setSelectedCat("all")} label="All items" count={menu.data!.totalItems} />
              {categories.map((c, idx) => (
                <div key={c.id} className="group relative flex shrink-0 items-center lg:shrink">
                  <CategoryButton active={selectedCat === c.id} onClick={() => setSelectedCat(c.id)} label={c.name} count={c.items.length} />
                  {isOwner && (
                    <div className="absolute right-1 hidden items-center gap-0.5 bg-inherit lg:group-hover:flex lg:group-focus-within:flex">
                      <IconBtn label={`Move ${c.name} up`} disabled={idx === 0} onClick={() => moveCategory(idx, -1)}><ArrowUp /></IconBtn>
                      <IconBtn label={`Move ${c.name} down`} disabled={idx === categories.length - 1} onClick={() => moveCategory(idx, 1)}><ArrowDown /></IconBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>

          {/* Items */}
          <div className="min-w-0 space-y-6">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" className="pl-8" aria-label="Search items" />
            </div>
            {visible.length === 0 && <Card><EmptyState icon={Search} title="No items match your search" /></Card>}
            {visible.map((c) => {
              const full = categories.find((x) => x.id === c.id)!;
              return (
                <Card key={c.id}>
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold">{c.name} <span className="ml-1 font-normal text-faint">{full.items.length}</span></h2>
                      {c.description && <p className="truncate text-xs text-muted">{c.description}</p>}
                    </div>
                    {isOwner && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setItemDialog({ item: null, categoryId: c.id })}><Plus /> Item</Button>
                        <Dropdown>
                          <DropdownTrigger asChild><Button size="icon" variant="ghost" aria-label={`${c.name} actions`}><MoreHorizontal /></Button></DropdownTrigger>
                          <DropdownContent>
                            <DropdownItem onSelect={() => setCatDialog(full)}><Pencil /> Rename category</DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem destructive onSelect={() => setToDelete({ kind: "category", category: full })}><Trash2 /> Delete category</DropdownItem>
                          </DropdownContent>
                        </Dropdown>
                      </div>
                    )}
                  </div>
                  {c.items.length === 0 ? (
                    <EmptyState title="No items in this category" className="py-8"
                      action={isOwner && <Button size="sm" onClick={() => setItemDialog({ item: null, categoryId: c.id })}><Plus /> Add item</Button>} />
                  ) : (
                    <ul className="divide-y divide-border">
                      {c.items.map((item) => {
                        const index = full.items.findIndex((i) => i.id === item.id);
                        return (
                          <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3", !item.available && "bg-subtle/40")}>
                            <FoodImage src={item.imageUrl} name={item.name} className={cn("size-12 shrink-0 text-sm", !item.available && "opacity-50 grayscale")} />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-[13px] font-medium">
                                <DietaryMark dietary={item.dietary} />
                                <span className={cn("truncate", !item.available && "text-muted")}>{item.name}</span>
                                {item.featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Bestseller" />}
                                {!item.available && <Badge tone="danger" className="ml-1">Sold out</Badge>}
                              </p>
                              {item.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{item.description}</p>}
                            </div>
                            <span className="tabular w-20 text-right text-[13px] font-medium">{money(item.price)}</span>
                            <Switch checked={item.available} aria-label={`${item.name} available`}
                              onCheckedChange={(v) => availability.mutate({ item, available: v })} />
                            {isOwner && (
                              <Dropdown>
                                <DropdownTrigger asChild><Button size="icon" variant="ghost" aria-label={`${item.name} actions`}><MoreHorizontal /></Button></DropdownTrigger>
                                <DropdownContent>
                                  <DropdownItem onSelect={() => setItemDialog({ item, categoryId: item.categoryId })}><Pencil /> Edit item</DropdownItem>
                                  <DropdownItem disabled={index <= 0 || !!q} onSelect={() => moveItem(full, index, -1)}><ArrowUp /> Move up</DropdownItem>
                                  <DropdownItem disabled={index >= full.items.length - 1 || !!q} onSelect={() => moveItem(full, index, 1)}><ArrowDown /> Move down</DropdownItem>
                                  <DropdownSeparator />
                                  <DropdownItem destructive onSelect={() => setToDelete({ kind: "item", item })}><Trash2 /> Delete item</DropdownItem>
                                </DropdownContent>
                              </Dropdown>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <CategoryDialog state={catDialog} onClose={() => setCatDialog(null)} onSaved={(c) => { refresh(); setCatDialog(null); setSelectedCat(c.id); }} />
      <ItemDialog state={itemDialog} categories={categories} onClose={() => setItemDialog(null)} onSaved={() => { refresh(); setItemDialog(null); }} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete?.kind === "category" ? `Delete "${toDelete.category.name}"?` : `Delete "${toDelete?.kind === "item" ? toDelete.item.name : ""}"?`}
        description={toDelete?.kind === "category"
          ? `This removes the category and its ${toDelete.category.items.length} item(s) from your menu. Past orders are not affected.`
          : "This removes the item from your menu. Past orders are not affected."}
        confirmLabel="Delete"
        destructive
        loading={deletion.isPending}
        onConfirm={() => toDelete && deletion.mutate(toDelete)}
      />
    </>
  );
}

function CategoryButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} aria-current={active}
      className={cn("flex h-8 shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors focus-ring lg:w-full lg:pr-14",
        active ? "bg-fg text-white lg:bg-subtle lg:text-fg lg:font-medium" : "bg-subtle text-muted hover:text-fg lg:bg-transparent lg:hover:bg-subtle/70")}>
      <span className="truncate">{label}</span>
      <span className={cn("tabular text-xs", active ? "opacity-70" : "text-faint")}>{count}</span>
    </button>
  );
}

function IconBtn({ children, label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} className="rounded p-1 text-faint hover:bg-surface hover:text-fg disabled:opacity-30 focus-ring [&_svg]:size-3.5" {...props}>
      {children}
    </button>
  );
}

function CategoryDialog({ state, onClose, onSaved }: { state: Category | "new" | null; onClose: () => void; onSaved: (c: Category) => void }) {
  const isNew = state === "new";
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setName(state && state !== "new" ? state.name : "");
    setDescription(state && state !== "new" ? state.description ?? "" : "");
    setError(null);
  }, [state]);
  const save = useMutation({
    mutationFn: () => isNew
      ? api<Category>("/restaurant/menu/categories", { method: "POST", body: { name, description } })
      : api<Category>(`/restaurant/menu/categories/${(state as Category).id}`, { method: "PUT", body: { name, description } }),
    onSuccess: (c) => { toast.success(isNew ? `Created ${c.name}` : "Category updated"); onSaved(c); },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={isNew ? "New category" : "Edit category"}>
        <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setError("Name is required"); return; } save.mutate(); }}>
          <DialogBody>
            <Field label="Name" htmlFor="cat-name" error={error}>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="e.g. Starters" aria-invalid={!!error} />
            </Field>
            <Field label="Description" htmlFor="cat-desc" hint="Optional — shown under the category name on the customer menu">
              <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={save.isPending}>{isNew ? "Create" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ItemForm { categoryId: string; name: string; description: string; price: string; imageUrl: string; dietary: Dietary | ""; available: boolean; featured: boolean }

function ItemDialog({ state, categories, onClose, onSaved }: { state: ItemDialogState; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !state?.item;
  const [form, setForm] = React.useState<ItemForm>(empty(""));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [showLibrary, setShowLibrary] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!state) return;
    const i = state.item;
    setForm(i ? {
      categoryId: i.categoryId, name: i.name, description: i.description ?? "", price: String(i.price),
      imageUrl: i.imageUrl ?? "", dietary: i.dietary ?? "", available: i.available, featured: i.featured,
    } : empty(state.categoryId));
    setErrors({}); setShowLibrary(false);
  }, [state]);

  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        categoryId: form.categoryId, name: form.name.trim(), description: form.description.trim() || null,
        price: Number(form.price), imageUrl: form.imageUrl || null, dietary: form.dietary || null,
        available: form.available, featured: form.featured,
      };
      return isNew ? api<MenuItem>("/restaurant/menu/items", { method: "POST", body })
        : api<MenuItem>(`/restaurant/menu/items/${state!.item!.id}`, { method: "PUT", body });
    },
    onSuccess: (i) => { toast.success(isNew ? `${i.name} added to the menu` : `${i.name} updated`); onSaved(); },
    onError: (e) => setErrors({ form: errorMessage(e) }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    const p = Number(form.price);
    if (form.price === "" || Number.isNaN(p) || p < 0) errs.price = "Enter a valid price";
    else if (!/^\d+(\.\d{1,2})?$/.test(form.price)) errs.price = "Use at most 2 decimal places";
    if (!form.categoryId) errs.categoryId = "Choose a category";
    setErrors(errs);
    if (!Object.keys(errs).length) save.mutate();
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ url: string }>("/restaurant/menu/images", { method: "POST", body: fd });
      set("imageUrl", res.url);
      toast.success("Image uploaded");
    } catch (e) { toast.error(errorMessage(e, "Upload failed")); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={isNew ? "Add menu item" : "Edit menu item"} wide>
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <div className="space-y-4">
                <Field label="Name" htmlFor="item-name" error={errors.name}>
                  <Input id="item-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} aria-invalid={!!errors.name} autoFocus />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price (₹)" htmlFor="item-price" error={errors.price}>
                    <Input id="item-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={!!errors.price} placeholder="0" />
                  </Field>
                  <Field label="Category" htmlFor="item-cat" error={errors.categoryId}>
                    <Select id="item-cat" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[13px] font-medium">Photo</span>
                <div className="relative">
                  <FoodImage src={form.imageUrl} name={form.name || "?"} className="aspect-square w-full text-2xl" />
                  {form.imageUrl && (
                    <button type="button" onClick={() => set("imageUrl", "")} className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white hover:bg-black/75">Remove</button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" className="flex-1" loading={uploading} onClick={() => fileRef.current?.click()}><Upload /> Upload</Button>
                  <Button type="button" size="sm" variant={showLibrary ? "primary" : "secondary"} onClick={() => setShowLibrary((v) => !v)} aria-label="Choose from library"><ImagePlus /></Button>
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </div>
            </div>

            {showLibrary && (
              <div className="rounded-md border border-border p-2">
                <p className="mb-2 px-1 text-xs text-muted">Choose a photo from the library</p>
                <div className="grid max-h-44 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
                  {LIBRARY.map((src) => (
                    <button type="button" key={src} onClick={() => { set("imageUrl", src); setShowLibrary(false); }}
                      className={cn("overflow-hidden rounded focus-ring", form.imageUrl === src && "ring-2 ring-accent")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label="Description" htmlFor="item-desc" hint="One line that makes people want it.">
              <Textarea id="item-desc" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={2} />
            </Field>

            <div className="space-y-1.5">
              <span className="text-[13px] font-medium">Dietary</span>
              <div className="flex flex-wrap gap-1.5">
                {([["VEG", "Veg"], ["NON_VEG", "Non-veg"], ["EGG", "Egg"], ["", "Not specified"]] as const).map(([v, l]) => (
                  <button type="button" key={v} onClick={() => set("dietary", v)} aria-pressed={form.dietary === v}
                    className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] focus-ring",
                      form.dietary === v ? "border-fg bg-fg text-white" : "border-border hover:bg-subtle")}>
                    {v && <DietaryMark dietary={v} />}{l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:gap-6">
              <label className="flex flex-1 items-center justify-between gap-3 text-[13px]">
                <span><span className="font-medium">Available</span><span className="block text-xs text-muted">Turn off when sold out</span></span>
                <Switch checked={form.available} onCheckedChange={(v) => set("available", v)} />
              </label>
              <label className="flex flex-1 items-center justify-between gap-3 text-[13px]">
                <span><span className="font-medium">Bestseller</span><span className="block text-xs text-muted">Highlighted for guests</span></span>
                <Switch checked={form.featured} onCheckedChange={(v) => set("featured", v)} />
              </label>
            </div>
            {errors.form && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">{errors.form}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={save.isPending}>{isNew ? "Add item" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function empty(categoryId: string): ItemForm {
  return { categoryId, name: "", description: "", price: "", imageUrl: "", dietary: "VEG", available: true, featured: false };
}
