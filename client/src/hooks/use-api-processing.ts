import { useCallback } from 'react';
import { useProcessing, ProcessingOperation } from '@/providers/ProcessingProvider';
import { apiRequest } from '@/lib/queryClient';

export function useApiProcessing() {
  const { 
    startProcessing, 
    stopProcessing, 
    updateProgress,
    setError 
  } = useProcessing();

  const processedApiRequest = useCallback(
    async (
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      url: string,
      data?: any,
      config?: {
        message?: string;
        type?: ProcessingOperation['type'];
        onProgress?: (progress: number, message?: string) => void;
      }
    ) => {
      const operationId = startProcessing({
        message: config?.message || 'Processing request...',
        type: config?.type || 'general',
        initialProgress: 10
      });
      
      try {
        // Update progress at key milestones
        updateProgress(operationId, 25, 'Sending request...');
        
        const result = await apiRequest(method, url, data);
        
        updateProgress(operationId, 75, 'Processing response...');
        
        // Allow custom progress updates
        if (config?.onProgress) {
          config.onProgress(90, 'Finalizing...');
        }
        
        updateProgress(operationId, 100, 'Complete');
        
        return result;
      } catch (error: any) {
        setError(operationId, error.message || 'Request failed', true);
        throw error;
      } finally {
        stopProcessing(operationId);
      }
    },
    [startProcessing, stopProcessing, updateProgress, setError]
  );

  const processedFetch = useCallback(
    async (
      url: string,
      options?: RequestInit,
      config?: {
        message?: string;
        type?: ProcessingOperation['type'];
      }
    ) => {
      const operationId = startProcessing({
        message: config?.message || 'Processing request...',
        type: config?.type || 'general',
        initialProgress: 10
      });
      
      try {
        updateProgress(operationId, 30, 'Connecting...');
        
        const result = await fetch(url, options);
        
        updateProgress(operationId, 80, 'Receiving data...');
        updateProgress(operationId, 100, 'Complete');
        
        return result;
      } catch (error: any) {
        setError(operationId, error.message || 'Fetch failed', true);
        throw error;
      } finally {
        stopProcessing(operationId);
      }
    },
    [startProcessing, stopProcessing, updateProgress, setError]
  );

  const createAIOperation = useCallback(
    (message: string, type: ProcessingOperation['type'] = 'ai-command') => {
      const operationId = startProcessing({
        message,
        type,
        initialProgress: 0
      });
      
      return {
        id: operationId,
        updateProgress: (progress: number, newMessage?: string) => 
          updateProgress(operationId, progress, newMessage),
        setError: (error: string, canRetry: boolean = true) => 
          setError(operationId, error, canRetry),
        complete: () => stopProcessing(operationId)
      };
    },
    [startProcessing, updateProgress, setError, stopProcessing]
  );

  return {
    processedApiRequest,
    processedFetch,
    createAIOperation,
    startProcessing,
    stopProcessing,
    updateProgress,
    setError
  };
} 