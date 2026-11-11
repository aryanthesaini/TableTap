"use client"

import React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { MonoLabel } from "./primitives"
import { SPRING_POP, EASE_OUT_QUINT } from "../motion-tokens"

interface SuccessCheckProps {
  method: string
  total: number
}

export function SuccessCheck({ method, total }: SuccessCheckProps) {
  const shouldReduceMotion = useReducedMotion()

  const springConfig = shouldReduceMotion
    ? { duration: 0 }
    : { ...SPRING_POP }

  const fadeTransition = {
    duration: shouldReduceMotion ? 0 : 0.5,
    ease: EASE_OUT_QUINT,
  }

  return (
    <motion.div
      key="success"
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={fadeTransition}
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FAF8F5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingLeft: "23px",
        paddingRight: "23px",
        paddingTop: "80px",
        paddingBottom: "40px",
      }}
    >
      {/* Ink circle with animated check */}
      <motion.div
        initial={shouldReduceMotion ? { scale: 1 } : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { ...SPRING_POP, delay: 0.1 }
        }
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          backgroundColor: "#17140F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
        }}
      >
        <svg
          width="52"
          height="40"
          viewBox="0 0 52 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <motion.path
            d="M4 20L18 34L48 4"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.45, ease: "easeInOut", delay: 0.4 }
            }
          />
        </svg>
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: EASE_OUT_QUINT, delay: shouldReduceMotion ? 0 : 0.3 }}
        style={{
          fontSize: "35px",
          fontWeight: 600,
          letterSpacing: "-0.04em",
          color: "#17140F",
          lineHeight: 1,
          margin: "0 0 10px 0",
          textAlign: "center",
        }}
      >
        Order placed
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: EASE_OUT_QUINT, delay: shouldReduceMotion ? 0 : 0.45 }}
        style={{
          fontSize: "15px",
          fontWeight: 400,
          color: "#857E74",
          margin: 0,
          textAlign: "center",
        }}
      >
        Sent to the kitchen · #1042
      </motion.p>

      {/* Receipt card */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: EASE_OUT_QUINT, delay: shouldReduceMotion ? 0 : 0.6 }}
        style={{
          width: "100%",
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E6E0D7",
          padding: "20px",
          marginTop: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left: paid via + amount */}
        <div>
          <MonoLabel style={{ marginBottom: "6px" }}>
            Paid via {method.toUpperCase()}
          </MonoLabel>
          <span
            style={{
              fontSize: "21px",
              fontWeight: 600,
              color: "#17140F",
              letterSpacing: "-0.02em",
              display: "block",
            }}
          >
            ₹{total.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Right: ready in */}
        <div style={{ textAlign: "right" }}>
          <MonoLabel style={{ marginBottom: "6px" }}>Ready in</MonoLabel>
          <span
            style={{
              fontSize: "17px",
              fontWeight: 600,
              color: "#B4480F",
              display: "block",
            }}
          >
            ~12 MIN
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}
