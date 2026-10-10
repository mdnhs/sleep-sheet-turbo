"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

// One cache entry per phone, shared by the Fraud Checker page and the
// per-order badge. Off until `enabled` — BD Courier bills per call, so a
// lookup only ever fires when the admin asks for one, and the hour-long
// staleTime keeps a re-render or a second visit from billing again.
export function useFraudCheckLookup(phone: string, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["fraud-check", phone],
    queryFn: async () => {
      const res = await client.api["fraud-check"][":phone"]["$get"]({
        param: { phone },
      });
      const data = await res.json();
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Fraud check failed");
      }
      queryClient.invalidateQueries({ queryKey: ["fraud-check-plan"] });
      return data;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
    // Matches staleTime: the dialog unmounts its query when it closes, and the
    // default 5-minute gcTime would drop the cached answer — so reopening the
    // same customer half an hour later would bill a second call.
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useFraudCheckPlan() {
  return useQuery({
    queryKey: ["fraud-check-plan"],
    queryFn: async () => {
      const res = await client.api["fraud-check"].plan["$get"]();
      const data = await res.json();
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not load plan");
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
