import { client } from "@/lib/rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface useUpdateCategoryProps {
  currentValue: string;
  value?: string;
  label?: string;
  parentId?: string | null;
  image?: string | null;
  order?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoContent?: string | null;
}

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ currentValue, value, label, parentId, image, order, seoTitle, seoDescription, seoContent }: useUpdateCategoryProps) => {
      const response = await client.api.categories[":value"]["$patch"]({
        param: { value: currentValue },
        json: {
          value,
          label,
          parentId: parentId ?? undefined,
          image: image ?? undefined,
          order,
          seoTitle: seoTitle ?? undefined,
          seoDescription: seoDescription ?? undefined,
          seoContent: seoContent ?? undefined,
        }
      });
      if (!response.ok) {
        const error = await response.json();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        throw new Error(error.error || 'Failed to update category');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Category updated successfully');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });
};
