
export type Step = "initial" | "confirmation" | "placedSuccessfully";

export interface ShippingInfo {
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  shippingZone: "inside_dhaka" | "outside_dhaka";
  notes?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  duration: string;
  cost: number;
}

export interface PaymentInfo {
  cardNumber?: string;
  expiry?: string;
  cvc?: string;
  nameOnCard?: string;
}

export interface PlacedOrderItem {
  name: string;
  price: number;
  quantity: number;
  size?: string | null;
  color?: string | null;
  image?: string | null;
}

export interface PlacedOrder {
  orderNumber: string;
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  createdAt: string;
  paymentMethod: string;
  items: PlacedOrderItem[];
  trackingNumber?: string | null;
  consignmentId?: number | null;
}

export interface CheckoutState {
  currentStep: Step;
  shippingInfo: ShippingInfo | null;
  paymentInfo: PaymentInfo | null;
  shippingMethod: ShippingMethod | null;
  paymentMethod: 'card' | 'cod' | 'bkash' | null;
  placedOrder: PlacedOrder | null;
}
