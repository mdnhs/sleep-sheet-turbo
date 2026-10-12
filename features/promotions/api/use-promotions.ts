"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";
import type { Promotion } from "../types";

/** Create / update body (PATCH takes the full body too). */
export type PromotionPayload = InferRequestType<typeof client.api.promotions.$post>["json"];

// Admin list. Mutations invalidate ["promotions"], which also refreshes the
// public live list (["promotions", "live"]) used by checkout and /offer.
const PROMOTIONS_KEY = ["promotions"] as const;

/** The API's `{ error }` message when it is a string, else the fallback. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // Non-JSON body: use the fallback.
  }
  return fallback;
}

export const usePromotions = () =>
  useQuery({
    queryKey: PROMOTIONS_KEY,
    queryFn: async () => {
      const res = await client.api.promotions.$get();
      if (!res.ok) throw new Error(await errorMessage(res, "Failed to load promotions"));
      return ((await res.json()) as { promotions: Promotion[] }).promotions;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useCreatePromotion = () => {
  const queryClient = useQueryClient();
  return useMutation<Promotion, Error, PromotionPayload>({
    mutationFn: async (json) => {
      const res = await client.api.promotions.$post({ json });
      if (!res.ok) throw new Error(await errorMessage(res, "Failed to create promotion"));
      return ((await res.json()) as { promotion: Promotion }).promotion;
    },
    onSuccess: () => {
      toast.success("Promotion created");
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
    onError: (error) => toast.error(error.message || "Failed to create promotion"),
  });
};

export const useUpdatePromotion = () => {
  const queryClient = useQueryClient();
  return useMutation<Promotion, Error, { id: string; json: PromotionPayload; successMessage?: string }>({
    mutationFn: async ({ id, json }) => {
      const res = await client.api.promotions[":id"].$patch({ param: { id }, json });
      if (!res.ok) throw new Error(await errorMessage(res, "Failed to update promotion"));
      return ((await res.json()) as { promotion: Promotion }).promotion;
    },
    onSuccess: (_promotion, { successMessage }) => {
      toast.success(successMessage ?? "Promotion updated");
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
    onError: (error) => toast.error(error.message || "Failed to update promotion"),
  });
};

export const useDeletePromotion = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await client.api.promotions[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error(await errorMessage(res, "Failed to delete promotion"));
    },
    onSuccess: () => {
      toast.success("Promotion deleted");
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
    onError: (error) => toast.error(error.message || "Failed to delete promotion"),
  });
};
