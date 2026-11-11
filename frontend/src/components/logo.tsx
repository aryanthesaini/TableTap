import { cn } from "@/lib/utils";

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect width="32" height="32" rx="8" fill="hsl(var(--fg))" />
        <rect x="8" y="8" width="7" height="7" rx="1.5" fill="#fff" />
        <rect x="17" y="8" width="7" height="7" rx="1.5" fill="hsl(var(--accent))" />
        <rect x="8" y="17" width="7" height="7" rx="1.5" fill="#fff" />
        <rect x="17" y="17" width="7" height="7" rx="1.5" fill="#fff" />
      </svg>
      {withWordmark && <span className="text-[15px] font-semibold tracking-tight">TableTap</span>}
    </span>
  );
}

export function RestaurantAvatar({ name, logoUrl, color, className }: { name: string; logoUrl?: string | null; color?: string; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={cn("size-7 shrink-0 rounded-md object-cover", className)} />;
  }
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white", className)}
      style={{ background: color ?? "hsl(var(--fg))" }}>
      {name.slice(0, 1)}
    </span>
  );
}
