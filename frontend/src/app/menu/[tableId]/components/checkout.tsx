"use client"

import React, { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useCart } from "../cart-context"
import { MonoLabel } from "./primitives"
import { PayCard } from "./pay-card"
import { EASE_PUSH } from "../motion-tokens"

interface CheckoutProps {
  onBack: () => void
  onConfirm: (method: string) => void
}

export function Checkout({ onBack, onConfirm }: CheckoutProps) {
  const { lineItems, totalPrice } = useCart()
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "upi" | null>(null)
  const shouldReduceMotion = useReducedMotion()

  const slideTransition = {
    duration: shouldReduceMotion ? 0 : 0.6,
    ease: EASE_PUSH,
  }

  return (
    <motion.div
      key="checkout"
      initial={shouldReduceMotion ? { opacity: 1 } : { x: "100%" }}
      animate={{ x: 0, opacity: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
      transition={slideTransition}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#FAF8F5",
        overflowY: "auto",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          paddingLeft: "23px",
          paddingRight: "23px",
          paddingTop: "16px",
          paddingBottom: "140px",
        }}
      >
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            marginLeft: "-10px",
            marginBottom: "12px",
            outline: "none",
            color: "#17140F",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="#17140F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Title */}
        <h1
          style={{
            fontSize: "31px",
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            color: "#17140F",
            margin: "0 0 6px 0",
          }}
        >
          Your order
        </h1>
        <p style={{ fontSize: "13.5px", fontWeight: 400, color: "#857E74", margin: "0 0 24px 0" }}>
          Table 6 · Café Monsoon
        </p>

        {/* Line items */}
        <div>
          {lineItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "12px",
                paddingBottom: "12px",
              }}
            >
              <span style={{ fontSize: "17px", fontWeight: 500, color: "#17140F" }}>
                {item.qty}× {item.name}
              </span>
              <span style={{ fontSize: "17px", fontWeight: 500, color: "#17140F" }}>
                ₹{(item.price * item.qty).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "#E6E0D7", marginBottom: "16px" }} />

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "21px", fontWeight: 600, letterSpacing: "-0.02em", color: "#17140F" }}>
            Total
          </span>
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
            style={{ fontSize: "21px", fontWeight: 600, letterSpacing: "-0.02em", color: "#17140F" }}
          >
            ₹{totalPrice.toLocaleString("en-IN")}
          </motion.span>
        </div>

        {/* Pay with */}
        <MonoLabel style={{ marginTop: "32px", marginBottom: "12px" }}>Pay with</MonoLabel>

        {/* Payment cards */}
        <div style={{ display: "flex", gap: "12px" }}>
          <PayCard
            method="cash"
            selected={selectedMethod === "cash"}
            onSelect={() => setSelectedMethod("cash")}
          />
          <PayCard
            method="upi"
            selected={selectedMethod === "upi"}
            onSelect={() => setSelectedMethod("upi")}
          />
        </div>
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          paddingLeft: "23px",
          paddingRight: "23px",
          paddingBottom: "calc(34px + env(safe-area-inset-bottom))",
          paddingTop: "12px",
          backgroundColor: "#FAF8F5",
          zIndex: 10,
        }}
      >
        <motion.button
          type="button"
          onClick={() => selectedMethod && onConfirm(selectedMethod)}
          disabled={!selectedMethod}
          whileTap={shouldReduceMotion || !selectedMethod ? undefined : { scale: 0.97 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
          style={{
            width: "100%",
            height: "71px",
            borderRadius: "19px",
            backgroundColor: "#FF6B2C",
            border: "none",
            cursor: selectedMethod ? "pointer" : "not-allowed",
            opacity: selectedMethod ? 1 : 0.4,
            pointerEvents: selectedMethod ? "auto" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            outline: "none",
            transition: "opacity 200ms",
          }}
          aria-label={`Place order for ₹${totalPrice.toLocaleString("en-IN")}`}
        >
          <span
            style={{
              fontSize: "19px",
              fontWeight: 600,
              color: "#160B04",
            }}
          >
            Place order · ₹{totalPrice.toLocaleString("en-IN")}
          </span>
        </motion.button>
      </div>
    </motion.div>
  )
}
