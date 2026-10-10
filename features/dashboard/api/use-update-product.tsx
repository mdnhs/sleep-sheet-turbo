import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/product/update", {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to update product";
        try {
          const errorBody = await response.text();
          const jsonError = JSON.parse(errorBody);
          errorMessage = jsonError.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Product updated successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
