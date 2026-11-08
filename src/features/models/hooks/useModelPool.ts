import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFailovers,
  getModelsHealth,
  getPool,
  resetHealth,
  scanModels,
  setPoolExcluded,
} from '../../../services/api/client';
import type {
  FailoverEvent,
  HealthResetResponse,
  ModelScanResponse,
  ModelsHealthResponse,
  PoolResponse,
} from '../../../services/api/types';

export const HEALTH_QUERY_KEY = ['models', 'health'];
export const POOL_QUERY_KEY = ['models', 'pool'];
export const FAILOVERS_QUERY_KEY = ['models', 'failovers'];

export function useModelsHealth() {
  return useQuery<ModelsHealthResponse>({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: () => getModelsHealth(),
    retry: 1,
    refetchInterval: () =>
      typeof document !== 'undefined' && document.hidden ? false : 5_000,
  });
}

export function usePool() {
  return useQuery<PoolResponse>({
    queryKey: POOL_QUERY_KEY,
    queryFn: () => getPool(),
    retry: 1,
    refetchInterval: () =>
      typeof document !== 'undefined' && document.hidden ? false : 5_000,
  });
}

export function useFailovers(limit = 20) {
  return useQuery<FailoverEvent[]>({
    queryKey: [...FAILOVERS_QUERY_KEY, limit],
    queryFn: () => getFailovers(limit),
    retry: 1,
    refetchInterval: () =>
      typeof document !== 'undefined' && document.hidden ? false : 5_000,
  });
}

export function useSetPoolExcludedMutation() {
  const queryClient = useQueryClient();
  return useMutation<PoolResponse, Error, { modelId: string; excluded: boolean }>({
    mutationFn: ({ modelId, excluded }) => setPoolExcluded(modelId, excluded),
    onSuccess: data => {
      queryClient.setQueryData(POOL_QUERY_KEY, data);
      queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useScanModelsMutation() {
  const queryClient = useQueryClient();
  return useMutation<ModelScanResponse, Error, number | void>({
    mutationFn: limit => scanModels(typeof limit === 'number' ? limit : 8),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: POOL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useResetHealthMutation() {
  const queryClient = useQueryClient();
  return useMutation<HealthResetResponse, Error, void>({
    mutationFn: () => resetHealth(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: POOL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
