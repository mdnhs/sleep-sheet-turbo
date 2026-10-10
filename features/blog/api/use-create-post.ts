import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/lib/rpc';
import { toast } from 'sonner';
import { InferRequestType, InferResponseType } from 'hono';

type ResponseType = InferResponseType<typeof client.api.blog.$post>;
type RequestType = InferRequestType<typeof client.api.blog.$post>['json'];

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.blog.$post({ json });
      if (!response.ok) throw new Error('Failed to create post');
      return await response.json();
    },
    onSuccess: () => {
      toast.success('Post created');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create post');
    },
  });
};
