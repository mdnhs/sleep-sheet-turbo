import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/lib/rpc';
import { toast } from 'sonner';
import { InferResponseType } from 'hono';
import type { BlogPost } from '@/app/(client)/blog/blog-client';

type ResponseType = InferResponseType<(typeof client.api.blog)[':id']['publish']['$patch']>;
type PostsCacheData = { data: BlogPost[]; total: number; hasNextPage: boolean; totalPages: number };

interface TogglePublishVariables {
  id: string;
  isPublished: boolean;
}

interface TogglePublishContext {
  previous: [readonly unknown[], unknown][];
}

export const useTogglePublish = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, TogglePublishVariables, TogglePublishContext>({
    mutationFn: async ({ id, isPublished }) => {
      const response = await client.api.blog[':id'].publish.$patch({
        param: { id },
        json: { isPublished },
      });
      if (!response.ok) throw new Error('Failed to update publish status');
      return await response.json();
    },

    // Flip the row immediately — a status toggle that waits on a round trip feels broken.
    onMutate: async ({ id, isPublished }) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // Every ['posts', params] cache entry, since the list is paginated + searched.
      const previous = queryClient.getQueriesData({ queryKey: ['posts'] });

      queryClient.setQueriesData<PostsCacheData>({ queryKey: ['posts'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((post) =>
            post.id === id ? { ...post, isPublished } : post
          ),
        };
      });

      return { previous };
    },

    onError: (error, _variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(error.message || 'Failed to update publish status');
    },

    onSuccess: (_data, { isPublished }) => {
      toast.success(isPublished ? 'Post published' : 'Moved to drafts');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
  });
};
