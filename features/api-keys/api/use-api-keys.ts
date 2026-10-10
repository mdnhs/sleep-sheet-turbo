import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

export const useGetApiKeys = () =>
  useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await client.api["api-keys"].$get();
      if (!res.ok) throw new Error("Failed to fetch API keys");
      return res.json();
    },
  });

export const useCreateApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await client.api["api-keys"].$post({ json: { name } });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to create API key");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useRevokeApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api["api-keys"][":id"].$delete({ param: { id } });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to revoke API key");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Key revoked");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
