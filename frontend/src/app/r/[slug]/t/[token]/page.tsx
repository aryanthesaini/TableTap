"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Info, MapPin, ReceiptText, Search, ShoppingBag, Star, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import type { Storefront, StorefrontItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DietaryMark } from "@/components/dashboard/status";
import { FoodImage } from "@/components/food-image";
import { BottomSheet } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { AddButton, BrandScope, InvalidQr, Stepper, StorefrontMessage } from "@/components/storefront/parts";
import { placedOrders, useStorefront } from "@/components/storefront/use-storefront";

export default function StorefrontPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const storefront = useStorefront(slug, token);

  if (storefront.isLoading) return <StorefrontSkeleton />;
  if (storefront.isError) {
    const e = storefront.error;
    if (e instanceof ApiError && e.status === 404) return <InvalidQr />;
    if (e instanceof ApiError && e.status === 410) return <StorefrontMessage title="Restaurant unavailable" description={e.message} />;
    return <StorefrontMessage title="Couldn't load the menu" description="Check your internet connection and try again."
      action={<button onClick={() => storefront.refetch()} className="h-10 rounded-lg bg-fg px-5 text-sm font-semibold text-white">Try again</button>} />;
  }
  return <Menu data={storefront.data!} slug={slug} token={token} />;
}

function Menu({ data, slug, token }: { data: Storefront; slug: string; token: string }) {
  const router = useRouter();
  const cart = useCart(token);
  const { restaurant, table } = data;
  const [vegOnly, setVegOnly] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeCat, setActiveCat] = React.useState(data.categories[0]?.id);
  const [detail, setDetail] = React.useState<StorefrontItem | null>(null);
  const [lastOrder, setLastOrder] = React.useState<{ id: string; number: number } | null>(null);
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const scrollingTo = React.useRef(false);

  React.useEffect(() => { setLastOrder(placedOrders.list(token)[0] ?? null); }, [token]);

  const q = query.trim().toLowerCase();
  const categories = data.categories
    .map((c) => ({
      ...c,
      items: c.items.filter((i) => (!vegOnly || i.dietary === "VEG") && (!q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))),
    }))
    .filter((c) => c.items.length > 0);

  // Scroll-spy: highlight the category currently in view.
  React.useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (scrollingTo.current) return;
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveCat(visible.target.id.replace("cat-", ""));
    }, { rootMargin: "-120px 0px -65% 0px" });
    document.querySelectorAll("[data-category]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories.length, vegOnly, q]);

  React.useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${activeCat}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeCat]);

  function jumpTo(id: string) {
    setActiveCat(id);
    scrollingTo.current = true;
    const el = document.getElementById(`cat-${id}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 108, behavior: "smooth" });
    setTimeout(() => { scrollingTo.current = false; }, 700);
  }

  const canOrder = data.orderingEnabled;
  const add = (i: StorefrontItem, qty: number) =>
    cart.setQuantity({ id: i.id, name: i.name, price: Number(i.price), dietary: i.dietary, imageUrl: i.imageUrl }, qty);

  return (
    <BrandScope color={restaurant.brandColor} className="min-h-dvh bg-[#f6f5f3]">
      <div className="mx-auto min-h-dvh max-w-lg bg-white pb-28 sm:shadow-[0_0_0_1px_rgb(0_0_0/0.04)]">
        {/* Header */}
        <header className="px-5 pb-4 pt-6">
          <div className="flex items-start gap-3.5">
            {restaurant.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logoUrl} alt="" className="size-14 shrink-0 rounded-xl" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-bold leading-tight tracking-tight">{restaurant.name}</h1>
              {restaurant.cuisine && <p className="mt-0.5 text-sm text-muted">{restaurant.cuisine}</p>}
              {restaurant.city && <p className="mt-0.5 flex items-center gap-1 text-xs text-faint"><MapPin className="size-3" />{[restaurant.addressLine, restaurant.city].filter(Boolean).join(", ")}</p>}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-sm font-semibold text-white">
              <span className="size-1.5 rounded-full bg-white/80" />You&apos;re at {table.name}
            </span>
            {lastOrder && (
              <Link href={`/r/${slug}/t/${token}/orders/${lastOrder.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-medium">
                <ReceiptText className="size-3.5" /> Order #{lastOrder.number}
              </Link>
            )}
          </div>
          {restaurant.description && <p className="mt-3 text-[13px] leading-relaxed text-muted">{restaurant.description}</p>}
          {!canOrder && (
            <div role="status" className="mt-4 flex gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
              <Info className="mt-px size-4 shrink-0" />
              <p>{data.orderingDisabledReason} You can still browse the menu.</p>
            </div>
          )}
        </header>

        {/* Sticky category bar */}
        <div className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/95 backdrop-blur">
          {searching ? (
            <div className="flex items-center gap-2 px-4 py-2.5">
              <Search className="size-4 text-faint" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${restaurant.name}`}
                className="h-9 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" aria-label="Search the menu" />
              <button onClick={() => { setSearching(false); setQuery(""); }} className="rounded-full p-1.5 text-muted active:bg-subtle" aria-label="Close search"><X className="size-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2.5 pl-4 pr-2">
              <button onClick={() => setVegOnly((v) => !v)} aria-pressed={vegOnly}
                className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                  vegOnly ? "border-green-700 bg-green-50 text-green-800" : "border-border text-fg")}>
                <DietaryMark dietary="VEG" /> Veg only
              </button>
              <div ref={tabsRef} className="no-scrollbar flex flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Menu categories">
                {categories.map((c) => (
                  <button key={c.id} data-tab={c.id} role="tab" aria-selected={activeCat === c.id} onClick={() => jumpTo(c.id)}
                    className={cn("h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition-colors",
                      activeCat === c.id ? "bg-fg text-white" : "text-muted active:bg-subtle")}>
                    {c.name}
                  </button>
                ))}
              </div>
              <button onClick={() => setSearching(true)} className="shrink-0 rounded-full p-2 text-muted active:bg-subtle" aria-label="Search the menu"><Search className="size-[18px]" /></button>
            </div>
          )}
        </div>

        {/* Menu sections */}
        <main>
          {categories.length === 0 && (
            <div className="px-8 py-16 text-center">
              <p className="font-medium">No dishes found</p>
              <p className="mt-1 text-sm text-muted">{q ? `Nothing matches “${query}”.` : "No vegetarian dishes in this menu."}</p>
              <button onClick={() => { setQuery(""); setVegOnly(false); }} className="mt-4 text-sm font-semibold text-[var(--brand)]">Show full menu</button>
            </div>
          )}
          {categories.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} data-category className="scroll-mt-28 border-b-8 border-[#f6f5f3] last:border-b-0">
              <div className="px-5 pb-1 pt-6">
                <h2 className="text-[17px] font-bold tracking-tight">{c.name}</h2>
                {c.description && <p className="mt-0.5 text-[13px] text-muted">{c.description}</p>}
              </div>
              <ul className="divide-y divide-dashed divide-black/[0.08] px-5">
                {c.items.map((i) => (
                  <MenuRow key={i.id} item={i} currency={restaurant.currency} quantity={cart.quantityOf(i.id)} canOrder={canOrder}
                    onOpen={() => setDetail(i)} onChange={(qty) => add(i, qty)} />
                ))}
              </ul>
            </section>
          ))}
          <p className="px-5 pb-6 pt-8 text-center text-xs text-faint">
            Prices exclude {restaurant.taxLabel} ({Number(restaurant.taxRatePercent)}%). Ordering by TableTap.
          </p>
        </main>
      </div>

      {/* Cart bar */}
      {cart.count > 0 && canOrder && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button onClick={() => router.push(`/r/${slug}/t/${token}/checkout`)}
            className="flex h-14 w-full items-center gap-3 rounded-2xl bg-[var(--brand)] px-4 text-white shadow-[0_10px_30px_-8px_rgb(0_0_0/0.45)] active:scale-[0.99]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/20"><ShoppingBag className="size-[18px]" /></span>
            <span className="flex-1 text-left leading-tight">
              <span className="block text-[13px] font-medium opacity-90">{cart.count} {cart.count === 1 ? "item" : "items"}</span>
              <span className="tabular block text-[15px] font-bold">{money(cart.subtotal, restaurant.currency)} <span className="text-xs font-medium opacity-80">+ taxes</span></span>
            </span>
            <span className="flex items-center gap-0.5 text-[15px] font-semibold">View cart <ChevronRight className="size-5" /></span>
          </button>
        </div>
      )}

      <ItemSheet item={detail} currency={restaurant.currency} canOrder={canOrder} quantity={detail ? cart.quantityOf(detail.id) : 0}
        onClose={() => setDetail(null)} onChange={(qty) => detail && add(detail, qty)} />
    </BrandScope>
  );
}

function MenuRow({ item, currency, quantity, canOrder, onOpen, onChange }: {
  item: StorefrontItem; currency: string; quantity: number; canOrder: boolean; onOpen: () => void; onChange: (q: number) => void;
}) {
  const soldOut = !item.available;
  const control = !canOrder ? null : soldOut ? (
    <span className="inline-flex h-9 w-[84px] items-center justify-center rounded-lg bg-subtle text-xs font-semibold uppercase text-faint">Sold out</span>
  ) : quantity > 0 ? <Stepper quantity={quantity} onChange={onChange} /> : <AddButton onClick={() => onChange(1)} />;

  return (
    <li className="flex gap-4 py-5">
      <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="flex items-center gap-1.5">
          <DietaryMark dietary={item.dietary} />
          {item.featured && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700">
              <Star className="size-3 fill-amber-500 text-amber-500" /> Bestseller
            </span>
          )}
        </div>
        <h3 className={cn("mt-1 text-[15px] font-semibold leading-snug", soldOut && "text-muted")}>{item.name}</h3>
        <p className="tabular mt-0.5 text-[15px] font-medium">{money(item.price, currency)}</p>
        {item.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{item.description}</p>}
      </button>
      {item.imageUrl ? (
        <div className="relative w-[118px] shrink-0 pb-4">
          <button onClick={onOpen} className="block w-full" aria-label={`View ${item.name}`}>
            <FoodImage src={item.imageUrl} name={item.name} rounded="rounded-xl" className={cn("aspect-square w-full", soldOut && "opacity-50 grayscale")} />
          </button>
          {control && <div className="absolute inset-x-0 bottom-0 flex justify-center">{control}</div>}
        </div>
      ) : (
        control && <div className="flex shrink-0 items-center">{control}</div>
      )}
    </li>
  );
}

function ItemSheet({ item, currency, quantity, canOrder, onClose, onChange }: {
  item: StorefrontItem | null; currency: string; quantity: number; canOrder: boolean; onClose: () => void; onChange: (q: number) => void;
}) {
  return (
    <BottomSheet open={!!item} onOpenChange={(o) => !o && onClose()} title={item?.name ?? "Item"}>
      {item && (
        <div className="overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]">
          {item.imageUrl && (
            <div className="px-4 pt-3">
              <FoodImage src={item.imageUrl} name={item.name} rounded="rounded-xl" className="aspect-[4/3] w-full" />
            </div>
          )}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-1.5"><DietaryMark dietary={item.dietary} />
              {item.featured && <span className="text-[11px] font-semibold text-amber-700">★ Bestseller</span>}
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight">{item.name}</h2>
            <p className="tabular mt-0.5 text-base font-medium">{money(item.price, currency)}</p>
            {item.description && <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>}
          </div>
          {canOrder && (
            <div className="mt-5 flex items-center gap-3 border-t border-border px-5 pt-4">
              {!item.available ? (
                <p className="w-full rounded-lg bg-subtle py-3 text-center text-sm font-medium text-muted">Sold out for now</p>
              ) : quantity > 0 ? (
                <>
                  <Stepper quantity={quantity} onChange={onChange} />
                  <button onClick={onClose} className="h-11 flex-1 rounded-xl bg-[var(--brand)] text-[15px] font-semibold text-white">
                    Done · <span className="tabular">{money(item.price * quantity, currency)}</span>
                  </button>
                </>
              ) : (
                <button onClick={() => { onChange(1); onClose(); }} className="h-12 w-full rounded-xl bg-[var(--brand)] text-[15px] font-semibold text-white">
                  Add to cart · <span className="tabular">{money(item.price, currency)}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function StorefrontSkeleton() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white px-5 pt-6">
      <div className="flex gap-3.5"><Skeleton className="size-14 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/3" /></div></div>
      <Skeleton className="mt-4 h-8 w-40 rounded-full" />
      <Skeleton className="mt-6 h-9 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 py-5"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/4" /><Skeleton className="h-3 w-full" /></div><Skeleton className="size-[118px] rounded-xl" /></div>
      ))}
    </div>
  );
}
