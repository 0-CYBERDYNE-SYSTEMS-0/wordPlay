import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface AppSettings {
  // User Experience Settings
  userExperienceMode: 'simple' | 'advanced';
  hasCompletedOnboarding: boolean;
  
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
  llmProvider: 'openai' | 'ollama';
  llmModel: string;
  openaiApiKey?: string;
  ollamaUrl: string;
  
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
  maxExecutionTime: number; // minutes
  enableSelfReflection: boolean;
  enableLearning: boolean;
  enableMemoryPersistence: boolean;
  enableChainOfThought: boolean;
  toolExecutionDelay: number; // ms
  agentInstructions: string;
  
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
  defaultExportFormat: 'pdf' | 'docx' | 'txt' | 'markdown';
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
  // User Experience Settings
  userExperienceMode: 'simple',
  hasCompletedOnboarding: false,
  
  // Editor Settings
  theme: 'system',
  fontSize: 'medium',
  fontFamily: 'serif',
  autosaveInterval: 30000,
  wordWrapEnabled: true,
  lineHeight: 'normal',
  editorWidth: 'normal',
  showLineNumbers: false,
  
  // AI Settings
  llmProvider: 'openai',
  llmModel: 'gpt-4.1-mini',
  ollamaUrl: 'http://localhost:11434',
  
  // Reasoning Model Settings
  showThinkingProcess: false,
  thinkingStreamDelay: 500,
  reasoningModelDetection: false,
  
  // Custom Instructions
  systemPrompt: '',
  writingStyle: '',
  tonePreference: 'professional',
  customTone: '',
  customCommands: [],
  
  // Agent Settings
  autonomyLevel: 'moderate',
  maxExecutionTime: 5,
  enableSelfReflection: true,
  enableLearning: true,
  enableMemoryPersistence: false,
  enableChainOfThought: false,
  toolExecutionDelay: 1000,
  agentInstructions: '',
  
  // UI Settings
  sidebarDefaultOpen: true,
  contextPanelDefaultOpen: true,
  enableSounds: true,
  enableAnimations: true,
  distractionFreeMode: false,
  
  // Writing Settings
  showWordCount: true,
  showReadingTime: true,
  showStyleAnalysis: true,
  spellCheckEnabled: true,
  grammarCheckEnabled: true,
  autoSuggestionsEnabled: true,
  suggestionDelay: 500,
  
  // Writing Goals
  dailyWordGoal: 0,
  enableWordGoal: false,
  sessionTimeGoal: 0,
  enableTimeGoal: false,
  
  // Export Settings
  defaultExportFormat: 'pdf',
  includeMetadata: true,
  autoBackupEnabled: false,
  backupInterval: 24,
};

const SETTINGS_STORAGE_KEY = 'wordplay-settings';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultSettings, ...parsed };
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
        const validatedSettings = { ...defaultSettings, ...imported };
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