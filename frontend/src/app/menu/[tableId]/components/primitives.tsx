"use client"

import React from "react"

// FSSAI veg/non-veg mark
export function VegMark({ veg }: { veg: boolean }) {
  if (veg) {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Vegetarian"
        style={{ flexShrink: 0 }}
      >
        <rect x="1" y="1" width="13" height="13" rx="1" stroke="#2E8B3E" strokeWidth="1.5" />
        <circle cx="7.5" cy="7.5" r="3.5" fill="#2E8B3E" />
      </svg>
    )
  }
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Non-vegetarian"
      style={{ flexShrink: 0 }}
    >
      <rect x="1" y="1" width="13" height="13" rx="1" stroke="#A3361F" strokeWidth="1.5" />
      <polygon points="7.5,3.5 11.5,11 3.5,11" fill="#A3361F" />
    </svg>
  )
}

// TABLE pill
export function Pill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.17em",
        textTransform: "uppercase",
        color: "#B4480F",
        backgroundColor: "rgba(255,107,44,0.12)",
        borderRadius: "999px",
        padding: "5px 12px",
      }}
    >
      {label}
    </span>
  )
}

// Category chip
export function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: "32px",
        borderRadius: "999px",
        padding: "0 14px",
        fontSize: "13px",
        fontWeight: 500,
        whiteSpace: "nowrap",
        flexShrink: 0,
        cursor: "pointer",
        border: active ? "none" : "1px solid #E6E0D7",
        backgroundColor: active ? "#17140F" : "#FFFFFF",
        color: active ? "#FAF8F5" : "#5A544B",
        transition: "background-color 150ms, color 150ms, border-color 150ms",
        outline: "none",
      }}
    >
      {label}
    </button>
  )
}

// Mono label (PAY WITH, etc.)
export function MonoLabel({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <p
      style={{
        fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
        fontSize: "11px",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.17em",
        color: "#857E74",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  )
}
