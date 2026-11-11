"use client"

import React, { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { RESTAURANT, MENU_ITEMS, CATEGORIES } from "./data"
import { useCart } from "./cart-context"
import { Pill, Chip } from "./components/primitives"
import { ItemRow } from "./components/item-row"
import { CartBar } from "./components/cart-bar"
import { Checkout } from "./components/checkout"
import { SuccessCheck } from "./components/success-check"
import { EASE_OUT_QUINT, STAGGER_ITEM } from "./motion-tokens"

type Screen = "menu" | "checkout" | "success"

function MenuScreen({ onViewCart }: { onViewCart: () => void }) {
  const { items, add, remove } = useCart()
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])
  const shouldReduceMotion = useReducedMotion()

  const filteredItems = MENU_ITEMS.filter((item) => item.category === activeCategory)

  const enterTransition = {
    duration: shouldReduceMotion ? 0 : 0.7,
    ease: EASE_OUT_QUINT,
  }

  return (
    <motion.div
      key="menu"
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={
        shouldReduceMotion
          ? { opacity: 0 }
          : { x: "-25%", opacity: 0.6 }
      }
      transition={enterTransition}
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FAF8F5",
        paddingBottom: "120px",
      }}
    >
      {/* Header area */}
      <div style={{ paddingLeft: "23px", paddingRight: "23px", paddingTop: "24px" }}>
        <Pill label={RESTAURANT.tableLabel} />

        <h1
          style={{
            fontSize: "31px",
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            color: "#17140F",
            marginTop: "12px",
            marginBottom: "0",
          }}
        >
          {RESTAURANT.name}
        </h1>

        <p
          style={{
            fontSize: "13.5px",
            fontWeight: 400,
            color: "#857E74",
            marginTop: "4px",
            marginBottom: "0",
          }}
        >
          Kitchen open · orders go straight in
        </p>

        {/* Category chips — horizontal scroll */}
        <div
          className="no-scrollbar"
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "20px",
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingBottom: "4px",
          }}
        >
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Item list */}
      <div style={{ marginTop: "12px" }}>
        {filteredItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.5,
              ease: EASE_OUT_QUINT,
              delay: shouldReduceMotion ? 0 : index * STAGGER_ITEM,
            }}
          >
            <ItemRow
              item={item}
              qty={items[item.id] ?? 0}
              onAdd={() => add(item.id)}
              onRemove={() => remove(item.id)}
              isLast={index === filteredItems.length - 1}
            />
          </motion.div>
        ))}
      </div>

      {/* Cart bar */}
      <CartBar onViewCart={onViewCart} />
    </motion.div>
  )
}

export default function MenuPage() {
  const [screen, setScreen] = useState<Screen>("menu")
  const [orderMethod, setOrderMethod] = useState<string>("")
  const { totalPrice, clear } = useCart()
  const [finalTotal, setFinalTotal] = useState(0)

  function handleViewCart() {
    setScreen("checkout")
  }

  function handleBack() {
    setScreen("menu")
  }

  function handleConfirm(method: string) {
    setOrderMethod(method)
    setFinalTotal(totalPrice)
    clear()
    setScreen("success")
  }

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <AnimatePresence mode="popLayout">
        {screen === "menu" && (
          <MenuScreen key="menu" onViewCart={handleViewCart} />
        )}

        {screen === "checkout" && (
          <Checkout key="checkout" onBack={handleBack} onConfirm={handleConfirm} />
        )}

        {screen === "success" && (
          <SuccessCheck key="success" method={orderMethod} total={finalTotal} />
        )}
      </AnimatePresence>
    </div>
  )
}
