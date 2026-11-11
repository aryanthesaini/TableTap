import type { Easing, Transition } from "framer-motion"

export const EASE_OUT_QUINT: Easing = [0.22, 1, 0.36, 1]
export const EASE_PUSH: Easing = [0.65, 0, 0.35, 1]
export const SPRING_POP: Transition = { type: "spring", stiffness: 260, damping: 26 }
export const DUR_SCREEN = 0.6
export const DUR_ELEMENT = 0.5
export const DUR_MICRO = 0.2
export const STAGGER_ITEM = 0.07
