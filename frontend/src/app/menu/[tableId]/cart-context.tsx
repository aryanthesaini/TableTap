"use client"

import React, { createContext, useContext, useState, useCallback, useMemo } from "react"
import { MENU_ITEMS, MenuItem } from "./data"

type CartItems = Record<string, number>

type LineItem = MenuItem & { qty: number }

interface CartContextValue {
  items: CartItems
  add: (id: string) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  clear: () => void
  totalItems: number
  totalPrice: number
  lineItems: LineItem[]
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItems>({})

  const add = useCallback((id: string) => {
    setItems((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const current = prev[id] ?? 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: current - 1 }
    })
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: qty }
    })
  }, [])

  const clear = useCallback(() => {
    setItems({})
  }, [])

  const totalItems = useMemo(
    () => Object.values(items).reduce((sum, qty) => sum + qty, 0),
    [items]
  )

  const totalPrice = useMemo(() => {
    return MENU_ITEMS.reduce((sum, item) => {
      const qty = items[item.id] ?? 0
      return sum + item.price * qty
    }, 0)
  }, [items])

  const lineItems = useMemo<LineItem[]>(() => {
    return MENU_ITEMS.filter((item) => (items[item.id] ?? 0) > 0).map((item) => ({
      ...item,
      qty: items[item.id],
    }))
  }, [items])

  const value = useMemo<CartContextValue>(
    () => ({ items, add, remove, setQty, clear, totalItems, totalPrice, lineItems }),
    [items, add, remove, setQty, clear, totalItems, totalPrice, lineItems]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
