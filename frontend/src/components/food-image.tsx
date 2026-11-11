import { cn } from "@/lib/utils";

const TINTS = ["#F5E6D3", "#E8EFE3", "#F3E1DF", "#E4ECF2", "#EFE7D6", "#ECE4F1"];

/** Food photo, or a calm typographic placeholder when the item has no photo. */
export function FoodImage({ src, name, className, rounded = "rounded-md" }: { src: string | null | undefined; name: string; className?: string; rounded?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} loading="lazy" className={cn("object-cover", rounded, className)} />;
  }
  const tint = TINTS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length];
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("");
  return (
    <div aria-hidden className={cn("flex items-center justify-center font-semibold tracking-tight text-black/35", rounded, className)} style={{ background: tint }}>
      <span className="text-[0.95em]">{initials}</span>
    </div>
  );
}
