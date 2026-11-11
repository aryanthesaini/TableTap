import type { Metadata, Viewport } from "next"
import { CartProvider } from "./cart-context"

export const metadata: Metadata = {
  title: "Order · TableTap",
  description: "Scan. Order. Enjoy.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FAF8F5",
}

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#FAF8F5", minHeight: "100dvh" }}>
      <CartProvider>{children}</CartProvider>
    </div>
  )
}
