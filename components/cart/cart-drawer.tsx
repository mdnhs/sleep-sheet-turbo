"use client";

import React from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CartItem from "./cart-item";
import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { trackGtmBeginCheckout, trackGtmRemoveFromCart } from "@/lib/gtm";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  const items = useCartStore((state) => state.items);
  const guestItems = useCartStore((state) => state.guestItems);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  
  const { t } = useLanguage();

  const cartItems = [...items, ...guestItems];
  const { formatAmount } = useCurrency();

  const handleUpdateQuantity = (id: string, quantity: number) => {
    updateQuantity({ id, quantity });
  };

  const handleRemoveItem = (id: string) => {
    const itemToRemove = cartItems.find((item) => item.id === id);
    if (itemToRemove) {
      trackGtmRemoveFromCart({
        currency: "BDT",
        value: itemToRemove.price * itemToRemove.quantity,
        items: [
          {
            item_id: itemToRemove.productId || itemToRemove.id,
            item_name: itemToRemove.name,
            price: itemToRemove.price,
            quantity: itemToRemove.quantity,
            item_variant: [itemToRemove.size, itemToRemove.color].filter(Boolean).join(" / ") || undefined,
          },
        ],
      });
    }
    removeFromCart(id);
  };

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const total = subtotal;

  const handleProceedToCheckout = () => {
    trackGtmBeginCheckout({
      currency: "BDT",
      value: total,
      items: cartItems.map((item, idx) => ({
        item_id: item.productId || item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
        item_variant: [item.size, item.color].filter(Boolean).join(" / ") || undefined,
        index: idx + 1,
      })),
    });
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {t("yourCart")} ({cartItems.length})
            </SheetTitle>
          </div>
        </SheetHeader>

        {cartItems.length > 0 ? (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {cartItems.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>

            <div className="border-t pt-4 space-y-4 p-4 pb-24 sm:pb-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span>{formatAmount(subtotal)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2">
                  <span>{t("total")}</span>
                  <span>{formatAmount(total)}</span>
                </div>
              </div>

              <Button
                className="w-full py-6"
                nativeButton={false}
                render={<Link href="/checkout" onClick={handleProceedToCheckout} />}
              >
                {t("proceedToCheckout")}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-12 pb-24 sm:pb-12">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("cartEmptyTitle")}</h3>
            <p className="text-muted-foreground mb-6 text-center pl-2 pr-2">
              {t("cartEmptyDesc")}
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/shop" onClick={onClose} />}
            >
              {t("startShopping")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
