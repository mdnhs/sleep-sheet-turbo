"use client";

import { Button } from "@/components/ui/button";
import { printReceipt } from "@/lib/print-receipt";
import { useCurrency } from "@/hooks/use-currency";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

interface OrderActionButtonsProps {
  order: {
    orderNumber: string;
    createdAt: string;
    userName?: string | null;
    guestName?: string | null;
    shippingAddress: string;
    items: {
      product?: { name: string } | null;
      quantity: number;
      price: number;
    }[];
    subtotal: number;
    shippingCost: number;
    totalAmount: number;
    status: string;
  };
}

export function OrderActionButtons({ order }: OrderActionButtonsProps) {
  const { symbol: currencySymbol } = useCurrency();
  const { footerPhone } = useWebsiteSettings();

  const handlePrintReceipt = () => {
    printReceipt({
      orderNumber: order.orderNumber,
      createdAt: formatDate(order.createdAt),
      userName: order.userName ?? order.guestName ?? "Guest",
      shippingAddress: order.shippingAddress,
      items: order.items.map((item) => ({
        name: item.product?.name ?? "Deleted product",
        quantity: item.quantity,
        price: item.price,
      })),
      currencySymbol,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      totalAmount: order.totalAmount,
    });

    toast("Receipt sent to printer", {
      description: "Your receipt is now printing.",
    });
  };

  const handleRequestReturn = () => {
    toast("Return requested", {
      description: "Your return request has been submitted. We'll contact you shortly.",
    });
  };

  return (
    <div className="flex flex-wrap gap-4 justify-end">
      <Button variant="outline" onClick={handlePrintReceipt}>
        Print Receipt
      </Button>
      {order.status !== "DELIVERED" ? (
        <Button variant="outline" disabled>
          Request Return
        </Button>
      ) : (
        <Button variant="outline" onClick={handleRequestReturn}>
          Request Return
        </Button>
      )}
      <a
        href={`https://wa.me/${(footerPhone || "+8801570241052").replace(/\D/g, "")}?text=${encodeURIComponent(`Hello Sleep Sheet, I need help with Order #${order.orderNumber}`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button className="bg-[#25D366] text-white hover:bg-[#20bd5a] font-semibold">
          <MessageCircle className="h-4 w-4 mr-1.5" />
          Need Help?
        </Button>
      </a>
    </div>
  );
}
