import { useQuery } from "@tanstack/react-query";
import { Product } from "@/lib/types";

interface UseGetProductProps {
  id: string;
}

// Admin-authenticated fetch (features/dashboard/server/route.ts GET /:id) —
// not the public /api/products/:id — because this is the one that includes
// add-on costPrice, needed by the create/update product forms. See that
// route for why the public one can't just conditionally include it. Plain
// fetch, not the typed RPC client — this feature module's routes (upload,
// update) never went through the client either.
export const useGetProduct = ({ id }: UseGetProductProps) => {
  return useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const response = await fetch(`/api/product/${id}`);

      if (!response.ok) {
        throw new Error("Product not found");
      }

      return (await response.json()) as Product;
    },
    enabled: !!id,
  });
};
