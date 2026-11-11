"use client"

import React, { useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useCart } from "../cart-context"
import { SPRING_POP } from "../motion-tokens"

interface CartBarProps {
  onViewCart: () => void
}

export function CartBar({ onViewCart }: CartBarProps) {
  const { totalItems, totalPrice } = useCart()
  const shouldReduceMotion = useReducedMotion()
  const prevTotalRef = useRef(totalPrice)

  const springConfig = shouldReduceMotion
    ? { duration: 0 }
    : { ...SPRING_POP }

  // Track whether total changed for subtle pulse
  const totalChanged = prevTotalRef.current !== totalPrice
  if (totalChanged) prevTotalRef.current = totalPrice

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.div
          key="cart-bar"
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { y: 140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: 140, opacity: 0 }}
          transition={springConfig}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            paddingBottom: "calc(13px + env(safe-area-inset-bottom))",
            paddingLeft: "13px",
            paddingRight: "13px",
            pointerEvents: "none",
          }}
        >
          <motion.div
            animate={
              shouldReduceMotion
                ? {}
                : totalChanged
                ? { scale: [1, 1.03, 1] }
                : { scale: 1 }
            }
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
            style={{
              height: "67px",
              borderRadius: "19px",
              backgroundColor: "#17140F",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingLeft: "20px",
              paddingRight: "20px",
              pointerEvents: "auto",
            }}
          >
            {/* Left: item count + price */}
            <motion.div layout style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontSize: "13px", color: "#A39B90" }}>
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
              <span style={{ fontSize: "20px", fontWeight: 600, color: "#FFFFFF", lineHeight: 1.1 }}>
                ₹{totalPrice.toLocaleString("en-IN")}
              </span>
            </motion.div>

            {/* Right: View cart */}
            <button
              type="button"
              onClick={onViewCart}
              style={{
                backgroundColor: "transparent",
                border: "none",
                fontSize: "15px",
                fontWeight: 600,
                color: "#FF6B2C",
                cursor: "pointer",
                outline: "none",
                padding: "11px 0 11px 16px",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
              }}
            >
              View cart →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
