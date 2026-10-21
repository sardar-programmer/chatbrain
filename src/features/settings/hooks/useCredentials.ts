import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteGeminiKey,
  getCredentialsStatus,
  saveGeminiKey,
  testGeminiKey,
} from '../../../services/api/client';
import type { GeminiCredentialsStatus, GeminiTestResponse } from '../../../services/api/types';

export const CREDENTIALS_QUERY_KEY = ['credentials', 'gemini'] as const;

export function useCredentials() {
  return useQuery<GeminiCredentialsStatus>({
    queryKey: CREDENTIALS_QUERY_KEY,
    queryFn: getCredentialsStatus,
    retry: 1,
    staleTime: 10_000,
  });
}

export function useSaveKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation<GeminiCredentialsStatus, Error, string>({
    mutationFn: (apiKey: string) => saveGeminiKey(apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CREDENTIALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useTestKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation<GeminiTestResponse, Error, void>({
    mutationFn: () => testGeminiKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useDeleteKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation<GeminiCredentialsStatus, Error, void>({
    mutationFn: () => deleteGeminiKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CREDENTIALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
