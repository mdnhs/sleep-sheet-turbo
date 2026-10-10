import { create } from "zustand";
import { toast } from "sonner";
import { client } from "@/lib/rpc";
import { afterNextPaint } from "@/lib/after-next-paint";
import { CartItem, CartResponse } from "../type";

type CartState = {
  items: CartItem[];
  guestItems: CartItem[];
  shipping: number;
  status: "idle" | "loading" | "succeeded" | "failed";
  
  // Actions
  fetchCart: () => Promise<void>;
  addToCart: (payload: {
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
    guestProduct?: CartItem;
    isAuthenticated: boolean;
  }) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (payload: { id: string; quantity: number }) => Promise<void>;
  
  clearCart: () => void;
  clearGuestCart: () => void;
  setShipping: (shipping: number) => void;
  addGuestItem: (item: CartItem) => void;
  setGuestItems: (items: CartItem[]) => void;
  removeGuestItem: (id: string) => void;
  updateGuestItemQuantity: (payload: { id: string; quantity: number }) => void;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  guestItems: [],
  shipping: 0,
  status: "idle",

  fetchCart: async () => {
    set({ status: "loading" });
    try {
      const res = await client.api.cart.$get();
      if (!res.ok) throw new Error("Failed to fetch cart");
      const data: CartResponse = await res.json();
      
      const mappedItems = data.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        ...item.product,
        addOns: item.product.addOns,
        id: item.id
      }));
      set({ items: mappedItems, status: "succeeded" });
    } catch (error) {
      set({ status: "failed" });
      toast.error("Failed to fetch cart");
    }
  },

  addToCart: async (payload) => {
    try {
      if (!payload.isAuthenticated) {
        if (payload.guestProduct) {
          get().addGuestItem(payload.guestProduct);
          // After the tap's paint: this runs inside the Add to cart / Order
          // now click, and sonner mounts a toast with flushSync and two
          // forced layouts — work that otherwise lands in that tap's INP.
          afterNextPaint(() => toast.success("Item added to cart"));
          return;
        }
        toast.error("You must be logged in to add items to cart");
        return;
      }

      const postRes = await client.api.cart.$post({
        json: {
          productId: payload.productId,
          quantity: payload.quantity,
          size: payload.size,
          color: payload.color,
        },
      });
      if (!postRes.ok) {
        toast.error("Failed to add to cart");
        return;
      }

      await get().fetchCart();
      toast.success("Item added to cart");
    } catch (error) {
      toast.error("Something went wrong while adding to cart");
    }
  },

  removeFromCart: async (cartItemId) => {
    try {
      const isGuestItem = get().guestItems.some(i => i.id === cartItemId);
      if (isGuestItem) {
        get().removeGuestItem(cartItemId);
        toast.success("Item removed from cart");
        return;
      }

      const res = await client.api.cart.$delete({ json: { cartItemId } });
      if (!res.ok) {
        toast.error("Failed to remove from cart");
        return;
      }

      await get().fetchCart();
      toast.success("Item removed from cart");
    } catch (error) {
      toast.error("Failed to remove from cart");
    }
  },

  updateQuantity: async (payload) => {
    try {
      const isGuestItem = get().guestItems.some(i => i.id === payload.id);
      if (isGuestItem) {
        get().updateGuestItemQuantity(payload);
        toast.success("Quantity updated");
        return;
      }

      const res = await client.api.cart.$put({
        json: { cartItemId: payload.id, quantity: payload.quantity }
      });
      if (!res.ok) {
        toast.error("Failed to update quantity");
        return;
      }

      await get().fetchCart();
      toast.success("Quantity updated");
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  },

  clearCart: () => set({ items: [] }),
  
  clearGuestCart: () => set({ guestItems: [] }),
  
  setShipping: (shipping) => set({ shipping }),
  
  addGuestItem: (item) => set((state) => {
    const existing = state.guestItems.find(
      i => i.productId === item.productId &&
        i.size === item.size &&
        i.color === item.color
    );
    if (existing) {
      return {
        guestItems: state.guestItems.map(i => 
          i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i
        )
      };
    } else {
      return { guestItems: [...state.guestItems, item] };
    }
  }),

  setGuestItems: (items) => set({ guestItems: items }),

  removeGuestItem: (id) => set((state) => ({
    guestItems: state.guestItems.filter(i => i.id !== id)
  })),

  updateGuestItemQuantity: (payload) => set((state) => ({
    guestItems: state.guestItems.map(i => 
      i.id === payload.id ? { ...i, quantity: payload.quantity } : i
    )
  })),
}));

export const selectTotalItems = (state: CartState) =>
  state.items.reduce((total, item) => total + item.quantity, 0) +
  state.guestItems.reduce((total, item) => total + item.quantity, 0);
