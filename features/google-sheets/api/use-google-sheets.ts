"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export function useBookToSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { orderId: string }) => {
      const response = await client.api["google-sheets"].book.$post({ json: data });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to book to Google Sheet");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useBulkBookToSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { orderIds: string[] }) => {
      const response = await client.api["google-sheets"]["bulk-book"].$post({ json: data });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to book to Google Sheet");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useSyncProductsToSheet() {
  return useMutation({
    mutationFn: async (data: {
      categories?: string[];
      products?: Array<{
        name: string;
        category: string;
        price: number;
        isAvailable: boolean;
        imageUrl: string;
      }>;
      clear?: boolean;
    }) => {
      const response = await client.api["google-sheets"]["sync-products"].$post({ json: data });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to sync products to n8n");
      }
      return response.json() as Promise<{ success: boolean; count: number }>;
    },
  });
}
