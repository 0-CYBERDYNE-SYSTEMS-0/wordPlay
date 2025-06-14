import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProcessingState {
  isProcessing: boolean;
  message: string;
  processingCount: number;
}

interface ProcessingContextType {
  processingState: ProcessingState;
  startProcessing: (message?: string) => void;
  stopProcessing: () => void;
  updateMessage: (message: string) => void;
  isAnyProcessing: boolean;
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
    message: '',
    processingCount: 0
  });

  const startProcessing = (message: string = 'Processing...') => {
    setProcessingState(prev => ({
      isProcessing: true,
      message,
      processingCount: prev.processingCount + 1
    }));
  };

  const stopProcessing = () => {
    setProcessingState(prev => {
      const newCount = Math.max(0, prev.processingCount - 1);
      return {
        isProcessing: newCount > 0,
        message: newCount > 0 ? prev.message : '',
        processingCount: newCount
      };
    });
  };

  const updateMessage = (message: string) => {
    setProcessingState(prev => ({
      ...prev,
      message
    }));
  };

  const contextValue: ProcessingContextType = {
    processingState,
    startProcessing,
    stopProcessing,
    updateMessage,
    isAnyProcessing: processingState.isProcessing
  };

  return (
    <ProcessingContext.Provider value={contextValue}>
      {children}
    </ProcessingContext.Provider>
  );
} 