// hooks/useOrderMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { OrderStatus, PaymentStatus } from "../types";

export const useOrderMutations = () => {
  const queryClient = useQueryClient();

  const updateOrder = useMutation({
    mutationFn: async (data: {
      id: string;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      guestName?: string;
      guestPhone?: string;
      shippingAddress?: string;
      reference?: string | null;
      shippingCost?: number;
      totalAmount?: number;
      items?: {
        id?: string;
        productId: string;
        quantity: number;
        price: number;
        costPrice?: number | null;
        size?: string | null;
        color?: string | null;
      }[];
    }) => {
      const response = await client.api.orders[":id"].$patch({
        param: { id: data.id },
        json: {
          status: data.status,
          paymentStatus: data.paymentStatus,
          guestName: data.guestName,
          guestPhone: data.guestPhone,
          shippingAddress: data.shippingAddress,
          reference: data.reference,
          shippingCost: data.shippingCost,
          totalAmount: data.totalAmount,
          items: data.items,
        },
      });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const cancelOrder = useMutation({
    mutationFn: async (data: {
      id: string;
      reason?: string;
      restock?: boolean;
    }) => {
      const response = await client.api.orders[":id"].cancel.$post({
        param: { id: data.id },
        json: { reason: data.reason, restock: data.restock },
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to cancel order");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const refundOrder = useMutation({
    mutationFn: async (data: {
      id: string;
      amount: number;
      reason?: string;
      restock?: boolean;
    }) => {
      const response = await client.api.orders[":id"].refund.$post({
        param: { id: data.id },
        json: { amount: data.amount, reason: data.reason, restock: data.restock },
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to refund order");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const response = await client.api.orders[":id"].$delete({ param: { id } });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to delete order");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const bulkDeleteOrders = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await client.api.orders["bulk-delete"].$post({ json: { ids } });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Bulk delete failed");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  return { updateOrder, cancelOrder, refundOrder, deleteOrder, bulkDeleteOrders };
};