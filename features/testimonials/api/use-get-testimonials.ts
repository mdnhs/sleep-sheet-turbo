import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface TestimonialQueryParams {
  page?: string;
  search?: string;
  limit?: string;
}

export type Testimonial = NonNullable<
  Awaited<ReturnType<typeof useGetTestimonials>>["data"]
>["data"][number];

export const useGetTestimonials = (params?: TestimonialQueryParams) => {
  return useQuery({
    queryKey: ["testimonials", params],
    queryFn: async () => {
      const response = await client.api.testimonials.$get({
        query: params,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch testimonials");
      }

      return response.json();
    },
    placeholderData: keepPreviousData,
  });
};
