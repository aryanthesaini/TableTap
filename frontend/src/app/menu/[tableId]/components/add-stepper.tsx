"use client"

import React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

interface AddStepperProps {
  qty: number
  onAdd: () => void
  onRemove: () => void
}

export function AddStepper({ qty, onAdd, onRemove }: AddStepperProps) {
  const shouldReduceMotion = useReducedMotion()

  const addTransition = { duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" as const }
  const qtyTransition = { duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" as const }

  if (qty === 0) {
    return (
      <motion.button
        type="button"
        onClick={onAdd}
        whileTap={shouldReduceMotion ? undefined : { scale: 1.06 }}
        transition={addTransition}
        style={{
          width: "83px",
          height: "38px",
          borderRadius: "11px",
          border: "1.5px solid #E0D9CF",
          backgroundColor: "#FFFFFF",
          color: "#17140F",
          fontSize: "13.5px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          outline: "none",
          userSelect: "none",
        }}
        aria-label="Add item"
      >
        ADD
      </motion.button>
    )
  }

  return (
    <div
      style={{
        width: "83px",
        height: "38px",
        borderRadius: "11px",
        backgroundColor: "#17140F",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Minus button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove one"
        style={{
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          border: "none",
          color: "#FFFFFF",
          fontSize: "18px",
          fontWeight: 400,
          cursor: "pointer",
          outline: "none",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        −
      </button>

      {/* Animated qty */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          minWidth: "16px",
          height: "24px",
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={qty}
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: -8 }}
            transition={qtyTransition}
            style={{
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 600,
              lineHeight: 1,
              display: "block",
              position: "absolute",
            }}
          >
            {qty}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Plus button */}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add one more"
        style={{
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          border: "none",
          color: "#FFFFFF",
          fontSize: "18px",
          fontWeight: 400,
          cursor: "pointer",
          outline: "none",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        +
      </button>
    </div>
  )
}
