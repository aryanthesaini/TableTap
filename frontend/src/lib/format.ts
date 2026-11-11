const inrFormatters = new Map<string, Intl.NumberFormat>();

/** Compact Indian notation for chart axes: ₹950, ₹2.8k, ₹1.2L, ₹3.4Cr. */
export function moneyCompact(value: number) {
  const n = Math.abs(value);
  const fmt = (v: number, suffix: string) => `₹${(Math.round(v * 10) / 10).toString()}${suffix}`;
  if (n >= 1e7) return fmt(value / 1e7, "Cr");
  if (n >= 1e5) return fmt(value / 1e5, "L");
  if (n >= 1e3) return fmt(value / 1e3, "k");
  return `₹${Math.round(value)}`;
}

export function money(value: number | string | null | undefined, currency = "INR", opts?: { compact?: boolean; decimals?: boolean }) {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  const key = `${currency}-${opts?.compact}-${opts?.decimals}`;
  let f = inrFormatters.get(key);
  if (!f) {
    const fractional = opts?.decimals ?? !Number.isInteger(n);
    f = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      notation: opts?.compact ? "compact" : "standard",
      minimumFractionDigits: opts?.compact ? 0 : fractional ? 2 : 0,
      maximumFractionDigits: opts?.compact ? 1 : 2,
    });
    inrFormatters.set(key, f);
  }
  return f.format(n);
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  const days = Math.round(diff / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function minutesSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function clock(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (yesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function shortId(id: string | null | undefined, len = 8) {
  return id ? id.slice(0, len) : "—";
}
