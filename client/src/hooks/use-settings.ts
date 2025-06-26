import { useState, useEffect, createContext, useContext } from "react";
import { useToast } from "@/hooks/use-toast";

export interface AppSettings {
  // Editor Settings
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'serif' | 'sans-serif' | 'mono';
  autosaveInterval: number; // in milliseconds
  wordWrapEnabled: boolean;
  
  // AI Settings
  llmProvider: 'openai' | 'ollama';
  llmModel: string;
  openaiApiKey?: string;
  ollamaUrl: string;
  
  // UI Settings
  sidebarDefaultOpen: boolean;
  contextPanelDefaultOpen: boolean;
  enableSounds: boolean;
  enableAnimations: boolean;
  
  // Writing Settings
  showWordCount: boolean;
  showReadingTime: boolean;
  showStyleAnalysis: boolean;
  spellCheckEnabled: boolean;
}

const defaultSettings: AppSettings = {
  // Editor Settings
  theme: 'system',
  fontSize: 'medium',
  fontFamily: 'serif',
  autosaveInterval: 1000,
  wordWrapEnabled: true,
  
  // AI Settings
  llmProvider: 'openai',
  llmModel: 'gpt-4.1-mini',
  ollamaUrl: 'http://localhost:11434',
  
  // UI Settings
  sidebarDefaultOpen: true,
  contextPanelDefaultOpen: true,
  enableSounds: true,
  enableAnimations: true,
  
  // Writing Settings
  showWordCount: true,
  showReadingTime: true,
  showStyleAnalysis: true,
  spellCheckEnabled: true,
};

const SETTINGS_STORAGE_KEY = 'wordplay-settings';

export function useSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Load settings from localStorage on initialization
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
      // Remove manual theme classes and let system preference apply
      root.classList.remove('light', 'dark');
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // Apply font size changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing font size classes
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${settings.fontSize}`);
  }, [settings.fontSize]);

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

  return {
    settings,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
  };
}

// Context for settings
const SettingsContext = createContext<ReturnType<typeof useSettings> | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const settingsValue = useSettings();
  return (
    <SettingsContext.Provider value={settingsValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}; 