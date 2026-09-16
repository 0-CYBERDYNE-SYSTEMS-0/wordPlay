import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useSettings } from '@/providers/SettingsProvider';
import { useApiProcessing } from '@/hooks/use-api-processing';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Lightbulb,
  RefreshCw,
  Zap,
  Type,
  FileText,
  Search,
  Settings as SettingsIcon,
  EyeOff,
  X,
} from 'lucide-react';

interface AmbientAIProps {
  content: string;
  cursorPosition: number;
  selectedText?: string;
  onApplySuggestion: (suggestion: string) => void;
  onOpenFullAI?: () => void;
  isEnabled: boolean;
  assistanceLevel: 'minimal' | 'moderate' | 'comprehensive';
}

interface AIInsight {
  id: string;
  type: 'continuation' | 'improvement' | 'structure' | 'style' | 'research' | 'error';
  title: string;
  suggestion: string;
  confidence: number;
  preview?: string;
  action?: () => void;
}

interface WritingAnalysis {
  intent: 'creative-writing' | 'technical-doc' | 'research' | 'editing' | 'brainstorm';
  complexity: 'simple' | 'moderate' | 'complex';
  mood: 'flowing' | 'struggling' | 'exploring' | 'editing';
  assistance: 'minimal' | 'moderate' | 'comprehensive';
}

export default function AmbientAI({
  content,
  cursorPosition,
  selectedText,
  onApplySuggestion,
  onOpenFullAI,
  isEnabled,
  assistanceLevel = 'moderate',
}: AmbientAIProps) {
  const { settings } = useSettings();
  const { startProcessing, stopProcessing } = useApiProcessing();
  const [isVisible, setIsVisible] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<WritingAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalyzedLength, setLastAnalyzedLength] = useState(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState(() => Date.now());
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const analyzeWritingMutation = useMutation({
    mutationFn: async (analysisRequest: {
      content: string;
      cursorPosition: number;
      selectedText?: string;
      assistanceLevel: string;
    }) => {
      const operationId = startProcessing({
        message: 'Reading your draft…',
        type: 'ai-command',
        initialProgress: 0,
      });

      try {
        const response = await apiRequest('POST', '/api/ai/analyze-writing-intent', analysisRequest);
        return await response.json();
      } finally {
        stopProcessing(operationId);
      }
    },
    onSuccess: (data) => {
      if (data.insights) {
        setInsights(data.insights);
        setCurrentAnalysis(data.analysis);

        const hasUsefulInsights = data.insights.some(
          (insight: AIInsight) => insight.confidence > 0.6 && insight.type !== 'error'
        );

        setIsVisible(hasUsefulInsights && assistanceLevel !== 'minimal');
      }
    },
    onError: (error) => {
      console.warn('AmbientAI analysis failed:', error);
    },
  });

  useEffect(() => {
    if (!isEnabled || !content.trim()) {
      setIsVisible(false);
      return;
    }

    const lengthDelta = Math.abs(content.length - lastAnalyzedLength);
    const timeSinceLast = Date.now() - lastAnalysisTime;
    const shouldAnalyze =
      lengthDelta > 50 || (!isAnalyzing && timeSinceLast > 2000 && lengthDelta > 10);

    if (!shouldAnalyze) return;

    setIsAnalyzing(true);

    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    analysisTimeoutRef.current = setTimeout(() => {
      analyzeWritingMutation.mutate({
        content: content.substring(Math.max(0, cursorPosition - 500), cursorPosition + 200),
        cursorPosition: Math.min(cursorPosition, 500),
        selectedText,
        assistanceLevel,
      });
      setLastAnalyzedLength(content.length);
      setLastAnalysisTime(Date.now());
      setIsAnalyzing(false);
    }, 900);

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [content, cursorPosition, selectedText, isEnabled, assistanceLevel]);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'continuation':
        return <Type className="h-3.5 w-3.5" />;
      case 'improvement':
        return <Sparkles className="h-3.5 w-3.5" />;
      case 'structure':
        return <FileText className="h-3.5 w-3.5" />;
      case 'style':
        return <Zap className="h-3.5 w-3.5" />;
      case 'research':
        return <Search className="h-3.5 w-3.5" />;
      default:
        return <Lightbulb className="h-3.5 w-3.5" />;
    }
  };

  const getInsightAccent = (type: string) => {
    switch (type) {
      case 'continuation':
        return 'border-l-[var(--wp-ink)] text-[var(--wp-ink)]';
      case 'improvement':
        return 'border-l-[var(--wp-copper)] text-[var(--wp-copper)]';
      case 'structure':
        return 'border-l-[var(--wp-teal)] text-[var(--wp-teal)]';
      case 'style':
        return 'border-l-amber-600 text-amber-700 dark:text-amber-400';
      case 'research':
        return 'border-l-slate-500 text-slate-600 dark:text-slate-300';
      default:
        return 'border-l-stone-400 text-stone-500';
    }
  };

  const handleApplyInsight = (insight: AIInsight) => {
    onApplySuggestion(insight.suggestion);
    setIsVisible(false);
  };

  if (!isEnabled || !isVisible || insights.length === 0) {
    return null;
  }

  const moodLabel =
    currentAnalysis?.mood === 'flowing'
      ? 'In flow'
      : currentAnalysis?.mood === 'struggling'
        ? 'Need a nudge?'
        : currentAnalysis?.mood === 'editing'
          ? 'Editing'
          : 'Listening';

  return (
    <div
      className="ambient-ai-popup fixed z-40 w-[min(100vw-1.5rem,22rem)] bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] sm:bottom-6 sm:right-6"
      role="complementary"
      aria-label="Writing suggestions"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--wp-line)] bg-[var(--wp-paper-elevated)] shadow-[0_28px_56px_-16px_rgba(26,22,18,0.35)] dark:bg-stone-900 dark:border-stone-700">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--wp-line)] px-3.5 py-2.5 dark:border-stone-700">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-copper-100 text-[var(--wp-copper)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-serif text-[14px] font-semibold tracking-tight text-[var(--wp-ink)] dark:text-stone-50">
                Quiet assist
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">{moodLabel}</p>
            </div>
            {isAnalyzing && (
              <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-[var(--wp-copper)]" />
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {onOpenFullAI && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenFullAI}
                className="h-8 w-8 p-0 text-stone-500 hover:text-[var(--wp-ink)]"
                title="Open full AI features"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-8 w-8 p-0 text-stone-500 hover:text-[var(--wp-ink)]"
              title="Hide suggestions"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto minimal-scrollbar">
          {insights.slice(0, 3).map((insight) => (
            <div
              key={insight.id}
              className={`border-b border-[var(--wp-line)] border-l-2 px-3.5 py-3 last:border-b-0 dark:border-stone-700/80 ${getInsightAccent(insight.type)}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 opacity-90">{getInsightIcon(insight.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-[var(--wp-ink)] dark:text-stone-100">
                      {insight.title}
                    </span>
                    <span className="tabular-nums text-[10px] text-stone-400">
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-stone-600 line-clamp-3 dark:text-stone-300">
                    {insight.suggestion}
                  </p>
                  {insight.preview && (
                    <p className="mt-1 text-[11px] italic text-stone-400 line-clamp-2">
                      {insight.preview}
                    </p>
                  )}
                  <div className="mt-2.5 flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleApplyInsight(insight)}
                      className="h-7 rounded-full bg-[var(--wp-copper)] px-3 text-[11px] font-medium text-white hover:bg-copper-500 dark:bg-[var(--wp-copper)] dark:text-white dark:hover:bg-copper-500"
                    >
                      Insert
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInsights((prev) => prev.filter((i) => i.id !== insight.id))}
                      className="h-7 px-2 text-[11px] text-stone-500 hover:text-[var(--wp-ink)] dark:hover:text-stone-200"
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--wp-line)] px-3.5 py-2 dark:border-stone-700">
          <span className="text-[11px] text-stone-400">
            {settings.userExperienceMode === 'simple' ? 'Light touch' : 'Contextual'}
          </span>
          <button
            type="button"
            onClick={() => {
              setInsights([]);
              setIsVisible(false);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-stone-500 transition-colors hover:text-[var(--wp-copper)] dark:text-stone-400 dark:hover:text-[var(--wp-copper)]"
          >
            <X className="h-3 w-3" />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
