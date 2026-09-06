import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface AppSettings {
  // User Experience Settings
  userExperienceMode: 'simple' | 'advanced' | 'expert';
  hasCompletedOnboarding: boolean;
  
  // AI Content Generation Settings
  enableVisualizations: boolean;
  enableImageGeneration: boolean;
  
  // Editor Settings
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'serif' | 'sans-serif' | 'mono';
  autosaveInterval: number;
  wordWrapEnabled: boolean;
  lineHeight: 'compact' | 'normal' | 'relaxed';
  editorWidth: 'narrow' | 'normal' | 'wide' | 'full';
  showLineNumbers: boolean;
  
  // AI Settings
  llmProvider: 'openai' | 'ollama' | 'gemini' | 'kimi';
  llmModel: string;
  ollamaUrl: string;
  researchModel: string;
  imageProvider: 'local' | 'gemini' | 'custom';
  imageModel: string;
  // Local mflux bridge controls
  imageSteps: number;      // mflux steps (1 = fastest/quality tradeoff, 4 = bridge default)
  imageSize: '256x256' | '512x512' | '1024x1024';
  localImageModel: string; // display-only: model loaded in the mflux bridge
  
  // Reasoning Model Settings
  showThinkingProcess: boolean;
  thinkingStreamDelay: number; // ms delay for thinking animation
  reasoningModelDetection: boolean; // auto-detect reasoning models
  
  // Custom Instructions
  systemPrompt: string;
  writingStyle: string;
  tonePreference: 'professional' | 'casual' | 'academic' | 'creative' | 'technical' | 'custom';
  customTone: string;
  customCommands: Array<{
    trigger: string;
    instruction: string;
    enabled: boolean;
  }>;
  
  // Agent Settings
  autonomyLevel: 'conservative' | 'moderate' | 'aggressive';
  maxExecutionTime: number; // minutes — enforced server-side by the agent route
  
  // UI Settings
  sidebarDefaultOpen: boolean;
  contextPanelDefaultOpen: boolean;
  enableSounds: boolean;
  enableAnimations: boolean;
  distractionFreeMode: boolean;
  
  // Writing Settings
  showWordCount: boolean;
  showReadingTime: boolean;
  showStyleAnalysis: boolean;
  spellCheckEnabled: boolean;
  grammarCheckEnabled: boolean;
  autoSuggestionsEnabled: boolean;
  suggestionDelay: number;
  
  // Writing Goals
  dailyWordGoal: number;
  enableWordGoal: boolean;
  sessionTimeGoal: number; // minutes
  enableTimeGoal: boolean;
  
  // Export Settings
  includeMetadata: boolean;
  autoBackupEnabled: boolean;
  backupInterval: number; // hours
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  exportSettings: () => void;
  importSettings: (file: File) => void;
}

const defaultSettings: AppSettings = {
  // User Experience Settings - Ultra Minimalist Defaults
  userExperienceMode: 'simple', // Start simple, upgrade based on usage
  hasCompletedOnboarding: false,
  
  // AI Content Generation Settings - Minimal & Focused
  enableVisualizations: true, // Essential for research
  enableImageGeneration: false, // Disable by default to reduce cognitive load
  
  // Editor Settings - Writing-Focused
  theme: 'system', // Respect user preference
  fontSize: 'medium', // Comfortable reading
  fontFamily: 'serif', // Better for long-form writing
  autosaveInterval: 2000, // Very frequent saves
  wordWrapEnabled: true, // Always on for natural reading
  lineHeight: 'relaxed', // Better readability
  editorWidth: 'normal', // Standard comfortable width
  showLineNumbers: false, // Reduce visual clutter
  
  // AI Settings - Smart Defaults
  llmProvider: 'openai', // OpenAI-compatible (defaults to local MLX Gemma E2B via OPENAI_BASE_URL)
  llmModel: 'mlx-community/gemma-4-e2b-it-4bit', // Local MLX Gemma 4 E2B
  ollamaUrl: 'http://localhost:11434',
  researchModel: 'sonar', // Perplexity model for web research
  imageProvider: 'local', // Local mflux bridge first; Gemini fallback
  imageModel: 'gemini-3.1-flash-lite-image', // Gemini image-capable model
  imageSteps: 1, // mflux: 1 step = fastest; higher = slower but more refined
  imageSize: '1024x1024', // default generation resolution
  localImageModel: 'FLUX.2 Klein 4B (mflux bridge)',
  
  // Reasoning Model Settings - Ambient & Subtle
  showThinkingProcess: false, // Don't overwhelm users
  thinkingStreamDelay: 300, // Quick responses
  reasoningModelDetection: false, // Automatic, invisible to user
  
  // Custom Instructions - Minimal & Sensible
  systemPrompt: '', // Empty = let AI be helpful naturally
  writingStyle: '', // Let AI adapt to content
  tonePreference: 'professional', // Safe default
  customTone: '', // Empty unless user specifies
  customCommands: [], // Start empty, add as needed
  
  // Agent Settings - Conservative for New Users
  autonomyLevel: 'conservative', // Start conservative, allow growth
  maxExecutionTime: 2, // Quick responses
  
  // UI Settings - Distraction-Free by Default
  sidebarDefaultOpen: false, // Hide initially for focus
  contextPanelDefaultOpen: false, // Show only when AI has suggestions
  enableSounds: false, // Reduce audio clutter
  enableAnimations: true, // Smooth transitions are nice
  distractionFreeMode: true, // Enable by default for writing focus
  
  // Writing Settings - Essential Only
  showWordCount: true, // Useful for progress
  showReadingTime: false, // Not essential for writing flow
  showStyleAnalysis: false, // Show only in advanced mode
  spellCheckEnabled: true, // Always helpful
  grammarCheckEnabled: false, // Can be intrusive
  autoSuggestionsEnabled: false, // Let AI be proactive instead
  suggestionDelay: 200, // Quick when needed
  
  // Writing Goals - Progressive
  dailyWordGoal: 0, // Set by user if wanted
  enableWordGoal: false, // Optional motivation
  sessionTimeGoal: 0, // Not essential
  enableTimeGoal: false, // Optional
  
  // Export Settings - Simple & Standard
  includeMetadata: false, // Keep exports clean
  autoBackupEnabled: false, // Can overwhelm new users
  backupInterval: 24, // Default daily backup
};

const SETTINGS_STORAGE_KEY = 'wordplay-settings';

// Keys must never live in the browser: the server reads provider keys from
// its own .env. Strip any legacy key fields from stored/imported settings.
function sanitizeSettings(input: Record<string, unknown>): AppSettings {
  const { openaiApiKey: _o, geminiApiKey: _g, perplexityApiKey: _p, ...rest } = input;
  return { ...defaultSettings, ...rest };
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return sanitizeSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
    return defaultSettings;
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
      toast({
        title: "Settings save failed",
        description: "Unable to save your settings. Changes may be lost on reload.",
        variant: "destructive",
      });
    }
  }, [settings, toast]);

  // Apply theme changes to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (settings.theme === 'system') {
      root.classList.remove('light', 'dark');
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleThemeChange = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', handleThemeChange);
      root.classList.toggle('dark', mediaQuery.matches);
      
      return () => {
        mediaQuery.removeEventListener('change', handleThemeChange);
      };
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // Apply font size changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${settings.fontSize}`);
  }, [settings.fontSize]);

  // Apply font family changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-family-serif', 'font-family-sans-serif', 'font-family-mono');
    root.classList.add(`font-family-${settings.fontFamily}`);
  }, [settings.fontFamily]);

  // Apply line height changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('line-height-compact', 'line-height-normal', 'line-height-relaxed');
    root.classList.add(`line-height-${settings.lineHeight}`);
  }, [settings.lineHeight]);

  // Apply editor width changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('editor-width-narrow', 'editor-width-normal', 'editor-width-wide', 'editor-width-full');
    root.classList.add(`editor-width-${settings.editorWidth}`);
  }, [settings.editorWidth]);

  // Apply distraction-free mode
  useEffect(() => {
    const body = document.body;
    if (settings.distractionFreeMode) {
      body.classList.add('distraction-free-mode');
    } else {
      body.classList.remove('distraction-free-mode');
    }
  }, [settings.distractionFreeMode]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    toast({
      title: "Settings reset",
      description: "All settings have been reset to their default values.",
    });
  };

  const exportSettings = () => {
    try {
      const settingsJson = JSON.stringify(settings, null, 2);
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wordplay-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Settings exported",
        description: "Your settings have been downloaded as a JSON file.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export settings.",
        variant: "destructive",
      });
    }
  };

  const importSettings = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        const validatedSettings = sanitizeSettings(imported);
        setSettings(validatedSettings);
        
        toast({
          title: "Settings imported",
          description: "Your settings have been imported successfully.",
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Invalid settings file format.",
          variant: "destructive",
        });
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      resetSettings,
      exportSettings,
      importSettings,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
} 