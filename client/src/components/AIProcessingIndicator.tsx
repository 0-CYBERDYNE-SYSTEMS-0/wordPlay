import React from 'react';
import { Brain, Loader2 } from 'lucide-react';

interface AIProcessingIndicatorProps {
  isProcessing: boolean;
  message?: string;
  className?: string;
}

export default function AIProcessingIndicator({ 
  isProcessing, 
  message = "AI is thinking...", 
  className = "" 
}: AIProcessingIndicatorProps) {
  if (!isProcessing) return null;

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <div className="relative">
        <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <Loader2 className="h-3 w-3 text-blue-500 animate-spin absolute -top-0.5 -right-0.5" />
      </div>
      <span className="text-blue-600 dark:text-blue-400 font-medium">{message}</span>
      <div className="flex space-x-1">
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
}

// Global overlay version for major operations
export function AIProcessingOverlay({ 
  isProcessing, 
  message = "AI is working on your request..." 
}: { isProcessing: boolean; message?: string }) {
  if (!isProcessing) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm mx-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Brain className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin absolute top-2 left-2" />
          </div>
          <div className="text-center">
            <p className="text-gray-900 dark:text-gray-100 font-medium">{message}</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">This may take a few moments</p>
          </div>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
} 