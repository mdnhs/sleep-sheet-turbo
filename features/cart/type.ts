// types/cart.ts
export interface CartProduct {
    id: string;
    slug?: string | null;
    name: string;
    price: number;
    image: string;
    description: string;
    addOns?: { name: string; price: number }[] | null;
  }
  
  export interface CartItemResponse {
    id: string;
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
    product: CartProduct;
  }
  
  export interface CartResponse {
    items: CartItemResponse[];
  }
  
  export type CartItem = Omit<CartItemResponse, 'product'> & CartProduct;