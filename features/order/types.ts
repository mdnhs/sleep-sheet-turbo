// types/order.ts
export type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type PaymentMethod = string;
export type SaleType = "POS" | "WEBSITE";

export interface OrderUser {
  id: string;
  name: string;
  email: string;
}

// types/order.ts
export interface OrderItem {
    id: string;
    orderId: string;
    productId?: string;
    quantity: number;
    price: number;
    costPrice?: number | null;
    size?: string | null;
    color?: string | null;
    images?: string[];
    product: OrderProduct;
    createdAt: string;
  }
  
  export interface OrderProduct {
    id: string;
    name: string;
    sku?: string;
    description: string;
    price: number;
    stock: number;
    variants: Array<{ name: string; price: number | null }> | string[];
    addOns?: { name: string; price: number; costPrice?: number }[];
    tags: string[];
    sizes: string[];
    features: string[];
    careInstruction: string | null;
    images: string[];
    isFeatured: boolean;
    createdAt: string;
    updatedAt: string;
    categoryId: string;
  }
  
  export interface Order {
    id: string;
    orderNumber: string;
    userId?: string | null;
    guestName?: string | null;
    guestPhone?: string | null;
    guestEmail?: string | null;
    totalAmount: number;
    subtotal: number;
    shippingCost: number;
    deliveryCharge: number;
    tax: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    status: OrderStatus;
    createdAt: string;
    updatedAt: string;
    confirmedAt?: string | null;
    shippingAddress: string;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPostalCode?: string | null;
    shippingCountry?: string | null;
    trackingNumber?: string | null;
    // The courier's own delivery_status as of the last sync, verbatim.
    // Null until an order has been synced at least once.
    courierStatus?: string | null;
    // Where this order's visitor came from — see lib/traffic-source.ts.
    // landingSource is the one label the dashboard renders; the rest are the
    // raw signals it was computed from. Redacted (null) on the customer-
    // facing order fetch, same as ipAddress/userAgent/fbc below.
    landingSource?: string | null;
    fbc?: string | null;
    gclid?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    landingReferrer?: string | null;
    sheetBookedAt?: string | null;
    metaPurchaseEventSentAt?: string | null;
    cancellationReason?: string | null;
    refundedAmount?: number | null;
    refundReason?: string | null;
    refundedAt?: string | null;
    saleType?: SaleType | null;
    reference?: string | null;
    note?: string | null;
    user?: {
      id: string;
      name: string;
      email: string;
      phone?: string | null;
    } | null;
    items: OrderItem[];
    payment?: {
      transactionId?: string | null;
      last4Digits?: string | null;
    } | null;
    paymentLogs?: PaymentLog[];
    ipAddress?: string | null;
    deviceOs?: string | null;
    browserName?: string | null;
    userAgent?: string | null;
  }

export interface PaymentLog {
  id: string;
  orderId?: string | null;
  orderNumber?: string | null;
  provider: string;
  endpoint: string;
  paymentId?: string | null;
  trxId?: string | null;
  amount?: string | number | null;
  request?: unknown;
  response?: unknown;
  statusCode?: string | null;
  statusMessage?: string | null;
  isSuccess: boolean;
  clientIp?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
}
export interface PaginatedOrders {
  data: Order[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}