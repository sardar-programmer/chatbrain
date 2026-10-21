import { useQuery } from '@tanstack/react-query';
import { getStatus } from '../../../services/api/client';
import type { StatusResponse } from '../../../services/api/types';

export const STATUS_QUERY_KEY = ['status'] as const;

export function useStatus() {
  return useQuery<StatusResponse>({
    queryKey: STATUS_QUERY_KEY,
    queryFn: getStatus,
    retry: 1,
    staleTime: 5_000,
  });
}
