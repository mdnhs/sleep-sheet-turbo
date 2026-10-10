import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/lib/rpc';
import { toast } from 'sonner';
import { InferRequestType, InferResponseType } from 'hono';

type ResponseType = InferResponseType<typeof client.api.blog[':id']['$put']>;
type RequestType = InferRequestType<typeof client.api.blog[':id']['$put']>['json'];

export const useUpdatePost = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.blog[':id'].$put({ param: { id }, json });
      if (!response.ok) throw new Error('Failed to update post');
      return await response.json();
    },
    onSuccess: () => {
      toast.success('Post updated');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update post');
    },
  });
};
