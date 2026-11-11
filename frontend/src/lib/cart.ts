"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Dietary } from "./types";

/**
 * The customer's cart lives in the browser (per table) until checkout. It only holds ids,
 * quantities and display info — the server re-prices everything when checkout starts.
 */
export interface CartLine { id: string; name: string; price: number; quantity: number; dietary: Dietary | null; imageUrl: string | null }
interface CartState { lines: CartLine[]; note: string }

const EMPTY: CartState = { lines: [], note: "" };
const listeners = new Set<() => void>();
const cache = new Map<string, CartState>();

function key(token: string) { return `tabletap.cart.${token}`; }

function read(token: string): CartState {
  if (cache.has(token)) return cache.get(token)!;
  let state = EMPTY;
  try {
    const raw = localStorage.getItem(key(token));
    if (raw) state = JSON.parse(raw);
  } catch { /* ignore */ }
  cache.set(token, state);
  return state;
}

function write(token: string, state: CartState) {
  cache.set(token, state);
  try { localStorage.setItem(key(token), JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useCart(token: string) {
  const state = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => read(token),
    () => EMPTY,
  );

  const setQuantity = useCallback((item: Omit<CartLine, "quantity">, quantity: number) => {
    const current = read(token);
    const q = Math.max(0, Math.min(20, quantity));
    const exists = current.lines.some((l) => l.id === item.id);
    const lines = q === 0
      ? current.lines.filter((l) => l.id !== item.id)
      : exists
        ? current.lines.map((l) => (l.id === item.id ? { ...l, ...item, quantity: q } : l))
        : [...current.lines, { ...item, quantity: q }];
    write(token, { ...current, lines });
  }, [token]);

  const setNote = useCallback((note: string) => write(token, { ...read(token), note }), [token]);
  const removeItems = useCallback((ids: string[]) => {
    const current = read(token);
    write(token, { ...current, lines: current.lines.filter((l) => !ids.includes(l.id)) });
  }, [token]);
  const clear = useCallback(() => write(token, EMPTY), [token]);

  const totals = useMemo(() => ({
    count: state.lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: state.lines.reduce((s, l) => s + l.price * l.quantity, 0),
  }), [state.lines]);

  const quantityOf = useCallback((id: string) => state.lines.find((l) => l.id === id)?.quantity ?? 0, [state.lines]);

  return { ...state, ...totals, setQuantity, setNote, removeItems, clear, quantityOf };
}
