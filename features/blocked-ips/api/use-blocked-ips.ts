import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

/** Every blocked IP, keyed for the orders dashboard to look up by address. */
export const useBlockedIps = (enabled = true) => {
  return useQuery({
    queryKey: ["blocked-ips"],
    enabled,
    queryFn: async () => {
      const response = await client.api["blocked-ips"].$get();
      if (!response.ok) throw new Error("Failed to fetch blocked IPs");
      const data = await response.json();
      return data.blockedIps;
    },
  });
};

export const useBlockIpMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["blocked-ips"] });

  const blockIp = useMutation({
    mutationFn: async (data: { ipAddress: string; reason?: string; orderId?: string }) => {
      const response = await client.api["blocked-ips"].$post({ json: data });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to block IP");
      }
      return response.json();
    },
    onSuccess: invalidate,
  });

  const unblockIp = useMutation({
    mutationFn: async (ipAddress: string) => {
      const response = await client.api["blocked-ips"][":ip"].$delete({
        param: { ip: ipAddress },
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to unblock IP");
      }
      return response.json();
    },
    onSuccess: invalidate,
  });

  return { blockIp, unblockIp };
};
