import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listModels, refreshModels } from '../../../services/api/client';
import type { ModelsResponse } from '../../../services/api/types';

export const MODELS_QUERY_KEY = ['models'] as const;

export function useModels() {
  return useQuery<ModelsResponse>({
    queryKey: MODELS_QUERY_KEY,
    queryFn: listModels,
    retry: 1,
    staleTime: 15_000,
  });
}

export function useRefreshModelsMutation() {
  const queryClient = useQueryClient();
  return useMutation<ModelsResponse, Error, void>({
    mutationFn: () => refreshModels(),
    onSuccess: data => {
      queryClient.setQueryData(MODELS_QUERY_KEY, data);
      queryClient.invalidateQueries({ queryKey: ['models', 'default'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
