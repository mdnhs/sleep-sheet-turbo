import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";

type ResponseType = InferResponseType<typeof client.api.testimonials.$post>;
type RequestType = InferRequestType<typeof client.api.testimonials.$post>["json"];

export const useCreateTestimonial = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.testimonials.$post({ json });

      if (!response.ok) {
        throw new Error("Failed to create testimonial");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Testimonial created");
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create testimonial");
    },
  });

  return mutation;
};
