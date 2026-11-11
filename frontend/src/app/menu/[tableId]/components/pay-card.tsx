"use client"

import React from "react"
import { motion, useReducedMotion } from "framer-motion"

function CashIcon() {
  return (
    <svg
      width="28"
      height="22"
      viewBox="0 0 28 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Wallet body */}
      <rect x="1" y="4" width="26" height="17" rx="3" stroke="#17140F" strokeWidth="1.5" />
      {/* Wallet flap */}
      <path d="M1 8h26" stroke="#17140F" strokeWidth="1.5" />
      {/* Card detail */}
      <rect x="18" y="11" width="6" height="4" rx="1" stroke="#17140F" strokeWidth="1.25" />
      {/* Top edge */}
      <path d="M5 4V3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1" stroke="#17140F" strokeWidth="1.5" />
    </svg>
  )
}

function UpiIcon() {
  return (
    <svg
      width="22"
      height="28"
      viewBox="0 0 22 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Phone outline */}
      <rect x="2" y="1" width="18" height="26" rx="4" stroke="#17140F" strokeWidth="1.5" />
      {/* Home button */}
      <circle cx="11" cy="23.5" r="1.5" stroke="#17140F" strokeWidth="1.25" />
      {/* Arrow up = pay */}
      <path d="M11 7v7M8 10l3-3 3 3" stroke="#17140F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface PayCardProps {
  method: "cash" | "upi"
  selected: boolean
  onSelect: () => void
}

export function PayCard({ method, selected, onSelect }: PayCardProps) {
  const shouldReduceMotion = useReducedMotion()

  const label = method === "cash" ? "Cash" : "UPI"
  const sublabel = method === "cash" ? "Pay at table" : "Scan & pay"

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
      style={{
        position: "relative",
        width: "calc(50% - 6px)",
        height: "128px",
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        border: selected ? "1.5px solid #17140F" : "1.5px solid #E6E0D7",
        boxShadow: selected ? "0 0 0 1.5px #17140F" : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: "16px",
        cursor: "pointer",
        outline: "none",
        textAlign: "left",
        transition: "border-color 150ms, box-shadow 150ms",
        userSelect: "none",
      }}
      aria-pressed={selected}
      aria-label={`Pay with ${label}`}
    >
      {/* Selected badge */}
      {selected && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            backgroundColor: "#17140F",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true">
            <path
              d="M1 4.5L4.5 8L11 1"
              stroke="#FFFFFF"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      )}

      {/* Icon */}
      <div style={{ marginBottom: "10px" }}>
        {method === "cash" ? <CashIcon /> : <UpiIcon />}
      </div>

      {/* Title */}
      <span style={{ fontSize: "20px", fontWeight: 600, color: "#17140F", lineHeight: 1.1, display: "block" }}>
        {label}
      </span>

      {/* Sublabel */}
      <span style={{ fontSize: "13px", fontWeight: 400, color: "#857E74", display: "block", marginTop: "2px" }}>
        {sublabel}
      </span>
    </motion.button>
  )
}
