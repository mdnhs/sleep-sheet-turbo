import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/rpc';

export const useGetPost = (slug: string) => {
  return useQuery({
    queryKey: ['post', slug],
    queryFn: async () => {
      const response = await client.api.blog[':slug'].$get({ param: { slug } });
      if (!response.ok) throw new Error('Failed to fetch post');
      const { post } = await response.json();
      return post;
    },
    enabled: !!slug,
  });
};
