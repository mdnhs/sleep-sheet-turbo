import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/lib/rpc';
import { toast } from 'sonner';
import { InferResponseType } from 'hono';

type ResponseType = InferResponseType<typeof client.api.blog[':id']['$delete']>;

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  return useMutation<ResponseType, Error, string>({
    mutationFn: async (id) => {
      const response = await client.api.blog[':id'].$delete({ param: { id } });
      if (!response.ok) throw new Error('Failed to delete post');
      return await response.json();
    },
    onSuccess: () => {
      toast.success('Post deleted');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete post');
    },
  });
};
