import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";

type ResponseType = InferResponseType<typeof client.api.testimonials[":id"]["$patch"]>;
type RequestType = InferRequestType<typeof client.api.testimonials[":id"]["$patch"]>["json"];

export const useUpdateTestimonial = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, { id: string; json: RequestType }>({
    mutationFn: async ({ id, json }) => {
      const response = await client.api.testimonials[":id"]["$patch"]({
        param: { id },
        json,
      });

      if (!response.ok) {
        throw new Error("Failed to update testimonial");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Testimonial updated");
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update testimonial");
    },
  });

  return mutation;
};
