import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpTooltipProps {
  children: React.ReactNode;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function HelpTooltip({ 
  children, 
  title, 
  description, 
  placement = 'top',
  className = ""
}: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`relative group ${className}`}>
            {children}
            <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <HelpCircle className="h-4 w-4 text-blue-500 bg-white rounded-full" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side={placement} className="max-w-sm">
          <div className="space-y-2">
            <div className="font-medium">{title}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{description}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface GuidedHintProps {
  children: React.ReactNode;
  hint: string;
  onDismiss?: () => void;
  showHint?: boolean;
}

export function GuidedHint({ children, hint, onDismiss, showHint = true }: GuidedHintProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !showHint) {
    return <>{children}</>;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="relative">
      {children}
      <div className="absolute top-full left-0 mt-2 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm max-w-xs z-10">
        <div className="flex items-start space-x-2">
          <div className="flex-1 text-sm text-blue-800 dark:text-blue-200">
            {hint}
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}