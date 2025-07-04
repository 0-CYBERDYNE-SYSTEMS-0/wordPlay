import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ProcessingOperation {
  id: string;
  type: 'ai-command' | 'research' | 'content-generation' | 'file-operation' | 'general';
  message: string;
  progress: number; // 0-100
  startTime: number;
  status: 'active' | 'completed' | 'error' | 'cancelled';
  error?: string;
  canRetry?: boolean;
}

interface ProcessingState {
  isProcessing: boolean;
  operations: ProcessingOperation[];
  totalOperations: number;
  activeOperations: number;
  completedOperations: number;
  errorCount: number;
}

interface ProcessingContextType {
  processingState: ProcessingState;
  startProcessing: (config: {
    id?: string;
    type?: ProcessingOperation['type'];
    message?: string;
    initialProgress?: number;
  }) => string;
  stopProcessing: (id: string) => void;
  updateProgress: (id: string, progress: number, message?: string) => void;
  setError: (id: string, error: string, canRetry?: boolean) => void;
  retryOperation: (id: string) => void;
  clearCompleted: () => void;
  isAnyProcessing: boolean;
  getCurrentOperation: () => ProcessingOperation | null;
  getOperationById: (id: string) => ProcessingOperation | null;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
}

interface ProcessingProviderProps {
  children: ReactNode;
}

export function ProcessingProvider({ children }: ProcessingProviderProps) {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    operations: [],
    totalOperations: 0,
    activeOperations: 0,
    completedOperations: 0,
    errorCount: 0
  });

  const generateId = () => `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const startProcessing = (config: {
    id?: string;
    type?: ProcessingOperation['type'];
    message?: string;
    initialProgress?: number;
  }) => {
    const id = config.id || generateId();
    const operation: ProcessingOperation = {
      id,
      type: config.type || 'general',
      message: config.message || 'Processing...',
      progress: config.initialProgress || 0,
      startTime: Date.now(),
      status: 'active',
      canRetry: false
    };

    setProcessingState(prev => {
      const newOperations = [...prev.operations, operation];
      const activeCount = newOperations.filter(op => op.status === 'active').length;
      
      return {
        ...prev,
        isProcessing: true,
        operations: newOperations,
        totalOperations: prev.totalOperations + 1,
        activeOperations: activeCount
      };
    });

    return id;
  };

  const stopProcessing = (id: string) => {
    setProcessingState(prev => {
      const newOperations = prev.operations.map(op => 
        op.id === id ? { ...op, status: 'completed' as const, progress: 100 } : op
      );
      
      const activeCount = newOperations.filter(op => op.status === 'active').length;
      const completedCount = newOperations.filter(op => op.status === 'completed').length;
      
      return {
        ...prev,
        isProcessing: activeCount > 0,
        operations: newOperations,
        activeOperations: activeCount,
        completedOperations: completedCount
      };
    });
  };

  const updateProgress = (id: string, progress: number, message?: string) => {
    setProcessingState(prev => ({
      ...prev,
      operations: prev.operations.map(op => 
        op.id === id ? { 
          ...op, 
          progress: Math.min(100, Math.max(0, progress)),
          message: message || op.message
        } : op
      )
    }));
  };

  const setError = (id: string, error: string, canRetry: boolean = true) => {
    setProcessingState(prev => {
      const newOperations = prev.operations.map(op => 
        op.id === id ? { 
          ...op, 
          status: 'error' as const, 
          error,
          canRetry
        } : op
      );
      
      const activeCount = newOperations.filter(op => op.status === 'active').length;
      const errorCount = newOperations.filter(op => op.status === 'error').length;
      
      return {
        ...prev,
        isProcessing: activeCount > 0,
        operations: newOperations,
        activeOperations: activeCount,
        errorCount
      };
    });
  };

  const retryOperation = (id: string) => {
    setProcessingState(prev => {
      const newOperations = prev.operations.map(op => 
        op.id === id ? { 
          ...op, 
          status: 'active' as const, 
          progress: 0,
          error: undefined,
          startTime: Date.now()
        } : op
      );
      
      const activeCount = newOperations.filter(op => op.status === 'active').length;
      const errorCount = newOperations.filter(op => op.status === 'error').length;
      
      return {
        ...prev,
        isProcessing: true,
        operations: newOperations,
        activeOperations: activeCount,
        errorCount
      };
    });
  };

  const clearCompleted = () => {
    setProcessingState(prev => {
      const newOperations = prev.operations.filter(op => op.status !== 'completed');
      const activeCount = newOperations.filter(op => op.status === 'active').length;
      
      return {
        ...prev,
        isProcessing: activeCount > 0,
        operations: newOperations,
        activeOperations: activeCount,
        completedOperations: 0
      };
    });
  };

  const getCurrentOperation = (): ProcessingOperation | null => {
    const activeOps = processingState.operations.filter(op => op.status === 'active');
    return activeOps.length > 0 ? activeOps[activeOps.length - 1] : null;
  };

  const getOperationById = (id: string): ProcessingOperation | null => {
    return processingState.operations.find(op => op.id === id) || null;
  };

  const contextValue: ProcessingContextType = {
    processingState,
    startProcessing,
    stopProcessing,
    updateProgress,
    setError,
    retryOperation,
    clearCompleted,
    isAnyProcessing: processingState.isProcessing,
    getCurrentOperation,
    getOperationById
  };

  return (
    <ProcessingContext.Provider value={contextValue}>
      {children}
    </ProcessingContext.Provider>
  );
} 