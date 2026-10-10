import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import { InferResponseType } from "hono";

type ResponseType = InferResponseType<(typeof client.api.testimonials)[":id"]["$delete"]>;

export const useDeleteTestimonial = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, string>({
    mutationFn: async (id) => {
      const response = await client.api.testimonials[":id"].$delete({
        param: { id },
      });

      if (!response.ok) {
        throw new Error("Failed to delete testimonial");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Testimonial deleted");
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete testimonial");
    },
  });

  return mutation;
};
