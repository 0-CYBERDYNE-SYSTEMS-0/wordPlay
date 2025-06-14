import { useCallback } from 'react';
import { useProcessing } from '@/providers/ProcessingProvider';
import { apiRequest } from '@/lib/queryClient';

export function useApiProcessing() {
  const { startProcessing, stopProcessing, updateMessage } = useProcessing();

  const processedApiRequest = useCallback(
    async (
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      url: string,
      data?: any,
      processingMessage?: string
    ) => {
      try {
        startProcessing(processingMessage || 'Processing request...');
        
        const result = await apiRequest(method, url, data);
        
        return result;
      } catch (error) {
        throw error;
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, stopProcessing]
  );

  const processedFetch = useCallback(
    async (
      url: string,
      options?: RequestInit,
      processingMessage?: string
    ) => {
      try {
        startProcessing(processingMessage || 'Processing request...');
        
        const result = await fetch(url, options);
        
        return result;
      } catch (error) {
        throw error;
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, stopProcessing]
  );

  return {
    processedApiRequest,
    processedFetch,
    startProcessing,
    stopProcessing,
    updateMessage
  };
} 