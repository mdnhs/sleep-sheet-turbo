import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { client } from '@/lib/rpc';
import { InferResponseType } from 'hono';

export type BlogListResponse = InferResponseType<typeof client.api.blog.$get, 200>;

interface BlogQueryParams {
  page?: string;
  search?: string;
  limit?: string;
}

export interface UseGetPostsOptions {
  initialData?: BlogListResponse;
  staleTime?: number;
}

export const useGetPosts = (
  params?: BlogQueryParams,
  options?: UseGetPostsOptions
) => {
  return useQuery({
    queryKey: ['posts', params],
    queryFn: async (): Promise<BlogListResponse> => {
      const response = await client.api.blog.$get({
        query: params,
      });
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
    placeholderData: keepPreviousData,
    initialData: options?.initialData,
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
  });
};
