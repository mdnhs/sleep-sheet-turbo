"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      phone?: string;
      address?: string;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      const res = await client.api.auth.profile.$patch({ json: data });
      const json = await res.json();
      if (!res.ok) {
        const err = (json as { error?: string }).error;
        throw new Error(err || "Failed to update profile");
      }
      return json;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["current"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update profile");
    },
  });
}
