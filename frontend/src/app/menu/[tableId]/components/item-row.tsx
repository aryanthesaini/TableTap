"use client"

import React from "react"
import { MenuItem } from "../data"
import { VegMark } from "./primitives"
import { AddStepper } from "./add-stepper"

interface ItemRowProps {
  item: MenuItem
  qty: number
  onAdd: () => void
  onRemove: () => void
  isLast?: boolean
}

export function ItemRow({ item, qty, onAdd, onRemove, isLast = false }: ItemRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "105px",
        paddingLeft: "23px",
        paddingRight: "23px",
        paddingTop: "16px",
        paddingBottom: "16px",
        gap: "16px",
        borderBottom: isLast ? "none" : "1px solid #EFEAE2",
      }}
    >
      {/* Left content */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flex: 1, minWidth: 0 }}>
        {/* Veg mark */}
        <div style={{ marginTop: "3px", flexShrink: 0 }}>
          <VegMark veg={item.veg} />
        </div>

        {/* Text column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name row + optional tag */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginBottom: "4px" }}>
            <span
              style={{
                fontSize: "19px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#17140F",
                lineHeight: 1.2,
              }}
            >
              {item.name}
            </span>
            {item.tag && (
              <span
                style={{
                  fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
                  fontSize: "8px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#B4480F",
                  backgroundColor: "rgba(255,107,44,0.12)",
                  borderRadius: "999px",
                  padding: "2px 6px",
                  flexShrink: 0,
                }}
              >
                {item.tag}
              </span>
            )}
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: "13.5px",
              fontWeight: 400,
              color: "#857E74",
              margin: "0 0 6px 0",
              lineHeight: 1.4,
            }}
          >
            {item.description}
          </p>

          {/* Price */}
          <span
            style={{
              fontSize: "15.5px",
              fontWeight: 600,
              color: "#17140F",
            }}
          >
            ₹{item.price.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Right: stepper */}
      <div style={{ flexShrink: 0 }}>
        <AddStepper qty={qty} onAdd={onAdd} onRemove={onRemove} />
      </div>
    </div>
  )
}
