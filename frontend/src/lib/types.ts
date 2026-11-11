// Mirrors backend DTOs (com.platform.*.dto). Keep in sync with /v3/api-docs.

export type Role = "OWNER" | "STAFF" | "PLATFORM_ADMIN";
export type Dietary = "VEG" | "NON_VEG" | "EGG";
export type OrderStatus = "PENDING" | "SERVED";
export type PaymentStatus = "CREATED" | "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
export type CheckoutStatus = "OPEN" | "COMPLETED" | "FAILED" | "EXPIRED";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  restaurantId: string | null;
  restaurantName: string | null;
  restaurantSlug: string | null;
  lastLoginAt: string | null;
}

export interface LoginResponse { accessToken: string; tokenType: string; expiresAt: string; user: User }

export interface DemoAccount {
  email: string; password: string; fullName: string; role: Role;
  restaurantName: string | null; restaurantSlug: string | null;
}

export interface Restaurant {
  id: string; slug: string; name: string; description: string | null; cuisine: string | null;
  logoUrl: string | null; coverImageUrl: string | null; brandColor: string;
  addressLine: string | null; city: string | null; state: string | null; postalCode: string | null;
  phone: string | null; email: string | null;
  status: "ACTIVE" | "SUSPENDED"; acceptingOrders: boolean;
  currency: string; taxLabel: string; taxRatePercent: number; createdAt: string;
}

export interface MenuItem {
  id: string; categoryId: string; name: string; description: string | null; price: number;
  imageUrl: string | null; available: boolean; dietary: Dietary | null; featured: boolean;
  sortOrder: number; updatedAt: string;
}
export interface Category { id: string; name: string; description: string | null; sortOrder: number; items: MenuItem[] }
export interface Menu { categories: Category[]; totalItems: number; unavailableItems: number }

export interface Table {
  id: string; name: string; seats: number | null; active: boolean; qrToken: string;
  orderingUrl: string; qrGeneratedAt: string; sortOrder: number; createdAt: string;
}
export interface TableActivity {
  tableId: string; pendingOrders: number; ordersToday: number; revenueToday: number; lastOrderAt: string | null;
}

export interface OrderItem { menuItemId: string | null; name: string; unitPrice: number; quantity: number; lineTotal: number; dietary: Dietary | null }
export interface Order {
  id: string; orderNumber: number; tableId: string; tableName: string; status: OrderStatus;
  paymentStatus: PaymentStatus; currency: string; subtotal: number; taxAmount: number; totalAmount: number;
  customerNote: string | null; itemCount: number; items: OrderItem[]; createdAt: string; servedAt: string | null;
}
export interface OrderCounts { pending: number; servedToday: number; ordersToday: number }

export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }

export interface Payment {
  id: string; checkoutSessionId: string; orderId: string | null; orderNumber: number | null; provider: string;
  providerOrderId: string; providerPaymentId: string | null; amount: number; currency: string;
  status: PaymentStatus; method: string | null; failureReason: string | null; createdAt: string; capturedAt: string | null;
}
export interface PaymentSummary { days: number; capturedCount: number; capturedAmount: number; failedCount: number; pendingCount: number; successRate: number }
export interface PaymentConfiguration {
  provider: string; mode: "TEST" | "LIVE"; status: "NOT_CONNECTED" | "ACTIVE" | "DISABLED"; keyId: string | null;
  keySecretSet: boolean; webhookSecretSet: boolean; webhookUrl: string; connectedAt: string | null;
}

export interface Overview {
  currency: string;
  today: {
    orders: number; revenue: number; pendingOrders: number; servedOrders: number; averageOrderValue: number;
    ordersYesterdaySameTime: number; revenueYesterdaySameTime: number;
  };
  hourly: { hour: number; orders: number; revenue: number }[];
  last7Days: { date: string; orders: number; revenue: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
}

export type UploadStatus = "PROCESSING" | "READY_FOR_REVIEW" | "PUBLISHED" | "DISCARDED" | "FAILED";
export interface DraftItem {
  id: string; categoryName: string; name: string; description: string | null; price: number | null;
  dietary: Dietary | null; confidence: number; uncertainFields: string[]; included: boolean; sortOrder: number;
}
export interface MenuUpload {
  id: string; originalFilename: string; contentType: string; fileSize: number; fileUrl: string; status: UploadStatus;
  extractionProvider: string | null; errorMessage: string | null; itemCount: number; uncertainCount: number;
  publishedItemCount: number | null; publishedAt: string | null; createdAt: string; items?: DraftItem[] | null;
}

// ---- public storefront
export interface StorefrontItem { id: string; name: string; description: string | null; price: number; imageUrl: string | null; available: boolean; dietary: Dietary | null; featured: boolean }
export interface Storefront {
  restaurant: {
    slug: string; name: string; description: string | null; cuisine: string | null; logoUrl: string | null;
    coverImageUrl: string | null; brandColor: string; addressLine: string | null; city: string | null;
    currency: string; taxLabel: string; taxRatePercent: number;
  };
  table: { name: string; token: string };
  orderingEnabled: boolean;
  orderingDisabledReason: string | null;
  categories: { id: string; name: string; description: string | null; items: StorefrontItem[] }[];
}
export interface PaymentInitiation { paymentId: string; provider: string; keyId: string; providerOrderId: string; amount: number; amountMinor: number; currency: string }
export interface CheckoutLine { menuItemId: string; name: string; unitPrice: number; quantity: number; lineTotal: number; dietary: Dietary | null }
export interface Checkout {
  checkoutId: string; status: CheckoutStatus; restaurantName: string; tableName: string; currency: string;
  items: CheckoutLine[]; subtotal: number; taxLabel: string; taxRatePercent: number; taxAmount: number; totalAmount: number;
  payment: PaymentInitiation;
}
export interface CheckoutStatusResponse { checkoutId: string; status: CheckoutStatus; paymentStatus: PaymentStatus | null; failureReason: string | null; orderId: string | null; orderNumber: number | null }
export interface CustomerOrder {
  id: string; orderNumber: number; status: OrderStatus; paymentStatus: PaymentStatus; restaurantName: string;
  restaurantSlug: string; brandColor: string; tableName: string; currency: string; items: OrderItem[];
  subtotal: number; taxLabel: string; taxAmount: number; totalAmount: number; createdAt: string; servedAt: string | null;
}

// ---- admin
export interface PlatformOverview {
  restaurants: number; activeRestaurants: number; suspendedRestaurants: number; ordersToday: number; gmvToday: number;
  orders7d: number; gmv7d: number; last7Days: { date: string; orders: number; gmv: number }[];
}
export interface AdminRestaurant {
  restaurant: Restaurant;
  stats: {
    ordersToday: number; revenueToday: number; orders7d: number; revenue7d: number; ordersAllTime: number;
    revenueAllTime: number; pendingOrders: number; activeTables: number; menuItems: number; lastOrderAt: string | null;
  };
  paymentStatus: string; paymentMode: string | null;
  members: { email: string; fullName: string; role: Role; lastLoginAt: string | null }[] | null;
}
