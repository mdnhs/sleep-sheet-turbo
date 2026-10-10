import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

export const useCreateRole = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (json: { name: string; permissions: string[]; landingUrl?: string | null }) => {
      const res = await client.api.roles.$post({ json });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to create role");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Role created successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return mutation;
};
