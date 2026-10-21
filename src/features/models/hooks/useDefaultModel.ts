import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearDefaultModel,
  getDefaultModel,
  setDefaultModel,
} from '../../../services/api/client';
import type { DefaultModel } from '../../../services/api/types';

export const DEFAULT_MODEL_QUERY_KEY = ['models', 'default'] as const;

export function useDefaultModel() {
  return useQuery<DefaultModel>({
    queryKey: DEFAULT_MODEL_QUERY_KEY,
    queryFn: getDefaultModel,
    retry: 1,
    staleTime: 10_000,
  });
}

export function useSetDefaultModelMutation() {
  const queryClient = useQueryClient();
  return useMutation<DefaultModel, Error, { modelId: string; force?: boolean }>({
    mutationFn: ({ modelId, force = false }) => setDefaultModel(modelId, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEFAULT_MODEL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useClearDefaultModelMutation() {
  const queryClient = useQueryClient();
  return useMutation<DefaultModel, Error, void>({
    mutationFn: () => clearDefaultModel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEFAULT_MODEL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
