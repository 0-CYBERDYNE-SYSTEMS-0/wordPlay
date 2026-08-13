import React from 'react';
import { Loader2 } from 'lucide-react';
import MatteDots from './MatteDots';

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
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <MatteDots size={4} gap={3.5} dotCount={4} label={message} />
      <span className="text-[var(--wp-copper)] dark:text-[var(--wp-copper)] font-medium">{message}</span>
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
          <MatteDots size={6} gap={5} dotCount={5} label={message} />
          <div className="text-center">
            <p className="text-gray-900 dark:text-gray-100 font-medium">{message}</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">This may take a few moments</p>
          </div>
          <div className="flex space-x-1">
            <MatteDots size={4} gap={4} dotCount={3} label="" />
          </div>
        </div>
      </div>
    </div>
  );
} 