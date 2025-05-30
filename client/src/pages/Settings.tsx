import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/providers/SettingsProvider";
import { ArrowLeft, Download, Upload, RotateCcw, Save, RefreshCw } from "lucide-react";

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { toast } = useToast();
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Default settings
  const defaultSettings = {
    // Editor Settings
    theme: 'system',
    fontSize: 'medium',
    fontFamily: 'serif',
    autosaveInterval: 1000,
    wordWrapEnabled: true,
    
    // AI Settings
    llmProvider: 'openai',
    llmModel: '04-mini',
    openaiApiKey: '',
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

  // Apply theme changes to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (settings.theme === 'system') {
      // Remove manual theme classes and let system preference apply
      root.classList.remove('light', 'dark');
      // Add media query listener for system theme
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleThemeChange = (e: MediaQueryListEvent) => {
        if (settings.theme === 'system') {
          root.classList.toggle('dark', e.matches);
        }
      };
      mediaQuery.addEventListener('change', handleThemeChange);
      // Set initial theme
      root.classList.toggle('dark', mediaQuery.matches);
      
      return () => {
        mediaQuery.removeEventListener('change', handleThemeChange);
      };
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // Fetch Ollama models when provider is ollama
  const fetchOllamaModels = async () => {
    if (settings.llmProvider !== 'ollama') return;
    
    setLoadingModels(true);
    try {
      const response = await fetch(`${settings.ollamaUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        const models = data.models?.map((model: any) => model.name) || [];
        setOllamaModels(models);
        
        // If current model is not available, set to first available model
        if (models.length > 0 && !models.includes(settings.llmModel)) {
          updateSettings({ llmModel: models[0] });
        }
      } else {
        throw new Error('Failed to fetch models');
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      toast({
        title: "Failed to fetch Ollama models",
        description: "Make sure Ollama is running and accessible at the configured URL.",
        variant: "destructive",
      });
      // Set default fallback models
      setOllamaModels(['llama3', 'codellama', 'mistral']);
    } finally {
      setLoadingModels(false);
    }
  };

  // Load Ollama models when provider changes or component mounts
  useEffect(() => {
    if (settings.llmProvider === 'ollama') {
      fetchOllamaModels();
    }
  }, [settings.llmProvider, settings.ollamaUrl]);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importSettings(file);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('wordplay-settings', JSON.stringify(settings));
      toast({
        title: "Settings saved",
        description: "Your preferences have been saved successfully.",
      });
      
      // Trigger a page reload to apply certain settings
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Unable to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportSettings}
            className="flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetSettings}
            className="flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={saveSettings}
            className="flex items-center"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          
          {/* Editor Settings */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Editor Settings</h2>
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={settings.theme} onValueChange={(value) => updateSettings({ theme: value as 'light' | 'dark' | 'system' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Select value={settings.fontSize} onValueChange={(value) => updateSettings({ fontSize: value as 'small' | 'medium' | 'large' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <Select value={settings.fontFamily} onValueChange={(value) => updateSettings({ fontFamily: value as 'serif' | 'sans-serif' | 'mono' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serif">Serif</SelectItem>
                      <SelectItem value="sans-serif">Sans Serif</SelectItem>
                      <SelectItem value="mono">Monospace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lineHeight">Line Height</Label>
                  <Select value={settings.lineHeight} onValueChange={(value) => updateSettings({ lineHeight: value as 'compact' | 'normal' | 'relaxed' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="relaxed">Relaxed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editorWidth">Editor Width</Label>
                  <Select value={settings.editorWidth} onValueChange={(value) => updateSettings({ editorWidth: value as 'narrow' | 'normal' | 'wide' | 'full' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="narrow">Narrow</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="wide">Wide</SelectItem>
                      <SelectItem value="full">Full Width</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="autosaveInterval">Autosave Interval (ms)</Label>
                  <Input
                    id="autosaveInterval"
                    type="number"
                    min="500"
                    max="10000"
                    step="100"
                    value={settings.autosaveInterval}
                    onChange={(e) => updateSettings({ autosaveInterval: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-gray-500">Controls how often documents auto-save (1000ms = 1 second)</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="wordWrap"
                    checked={settings.wordWrapEnabled}
                    onCheckedChange={(checked) => updateSettings({ wordWrapEnabled: checked })}
                  />
                  <Label htmlFor="wordWrap">Enable word wrap</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="showLineNumbers"
                    checked={settings.showLineNumbers}
                    onCheckedChange={(checked) => updateSettings({ showLineNumbers: checked })}
                  />
                  <Label htmlFor="showLineNumbers">Show line numbers</Label>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* AI Settings */}
          <section>
            <h2 className="text-xl font-semibold mb-4">AI Settings</h2>
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="llmProvider">LLM Provider</Label>
                  <Select value={settings.llmProvider} onValueChange={(value) => updateSettings({ llmProvider: value as 'openai' | 'ollama' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="llmModel">Model</Label>
                    {settings.llmProvider === 'ollama' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchOllamaModels}
                        disabled={loadingModels}
                        className="h-6 px-2"
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingModels ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </div>
                  <Select value={settings.llmModel} onValueChange={(value) => updateSettings({ llmModel: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.llmProvider === 'openai' ? (
                        <>
                          <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                          <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                          <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="04-mini-low">04-mini-low</SelectItem>
                          <SelectItem value="04-mini">04-mini</SelectItem>
                        </>
                      ) : ollamaModels.length > 0 ? (
                        ollamaModels.map(model => (
                          <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>No models found - check Ollama</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {settings.llmProvider === 'ollama' && ollamaModels.length === 0 && !loadingModels && (
                    <p className="text-xs text-orange-600">
                      No models found. Make sure Ollama is running and has models installed.
                    </p>
                  )}
                </div>
              </div>
              
              {settings.llmProvider === 'openai' && (
                <div className="space-y-2">
                  <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                  <Input
                    id="openaiApiKey"
                    type="password"
                    placeholder="sk-..."
                    value={settings.openaiApiKey}
                    onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                  />
                  <p className="text-sm text-gray-500">Your API key is stored locally and never sent to our servers.</p>
                </div>
              )}
              
              {settings.llmProvider === 'ollama' && (
                <div className="space-y-2">
                  <Label htmlFor="ollamaUrl">Ollama Server URL</Label>
                  <Input
                    id="ollamaUrl"
                    type="url"
                    value={settings.ollamaUrl}
                    onChange={(e) => updateSettings({ ollamaUrl: e.target.value })}
                  />
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Custom Instructions */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Custom Instructions</h2>
            <div className="space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="Enter custom instructions for the AI assistant..."
                  className="min-h-24"
                  value={settings.systemPrompt}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  These instructions will be used as context for all AI interactions.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="writingStyle">Writing Style Description</Label>
                <Textarea
                  id="writingStyle"
                  placeholder="Describe your preferred writing style..."
                  className="min-h-20"
                  value={settings.writingStyle}
                  onChange={(e) => updateSettings({ writingStyle: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  Describe how you want the AI to write (e.g., "concise and technical", "flowery and descriptive").
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tonePreference">Default Tone</Label>
                  <Select value={settings.tonePreference} onValueChange={(value) => updateSettings({ tonePreference: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.tonePreference === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="customTone">Custom Tone</Label>
                    <Input
                      id="customTone"
                      placeholder="Describe your custom tone..."
                      value={settings.customTone}
                      onChange={(e) => updateSettings({ customTone: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* UI Settings */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Interface Settings</h2>
            <div className="space-y-4">
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="sidebarDefault"
                  checked={settings.sidebarDefaultOpen}
                  onCheckedChange={(checked) => updateSettings({ sidebarDefaultOpen: checked })}
                />
                <Label htmlFor="sidebarDefault">Open sidebar by default</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="contextPanelDefault"
                  checked={settings.contextPanelDefaultOpen}
                  onCheckedChange={(checked) => updateSettings({ contextPanelDefaultOpen: checked })}
                />
                <Label htmlFor="contextPanelDefault">Open context panel by default</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="enableSounds"
                  checked={settings.enableSounds}
                  onCheckedChange={(checked) => updateSettings({ enableSounds: checked })}
                />
                <Label htmlFor="enableSounds">Enable sound effects</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="enableAnimations"
                  checked={settings.enableAnimations}
                  onCheckedChange={(checked) => updateSettings({ enableAnimations: checked })}
                />
                <Label htmlFor="enableAnimations">Enable animations</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="distractionFreeMode"
                  checked={settings.distractionFreeMode}
                  onCheckedChange={(checked) => updateSettings({ distractionFreeMode: checked })}
                />
                <Label htmlFor="distractionFreeMode">Distraction-free writing mode</Label>
              </div>
            </div>
          </section>

          <Separator />

          {/* Writing Settings */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Writing Settings</h2>
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showWordCount"
                    checked={settings.showWordCount}
                    onCheckedChange={(checked) => updateSettings({ showWordCount: checked })}
                  />
                  <Label htmlFor="showWordCount">Show word count</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showReadingTime"
                    checked={settings.showReadingTime}
                    onCheckedChange={(checked) => updateSettings({ showReadingTime: checked })}
                  />
                  <Label htmlFor="showReadingTime">Show reading time estimate</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showStyleAnalysis"
                    checked={settings.showStyleAnalysis}
                    onCheckedChange={(checked) => updateSettings({ showStyleAnalysis: checked })}
                  />
                  <Label htmlFor="showStyleAnalysis">Show style analysis</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="spellCheck"
                    checked={settings.spellCheckEnabled}
                    onCheckedChange={(checked) => updateSettings({ spellCheckEnabled: checked })}
                  />
                  <Label htmlFor="spellCheck">Enable spell check</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="grammarCheck"
                    checked={settings.grammarCheckEnabled}
                    onCheckedChange={(checked) => updateSettings({ grammarCheckEnabled: checked })}
                  />
                  <Label htmlFor="grammarCheck">Enable grammar check</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoSuggestions"
                    checked={settings.autoSuggestionsEnabled}
                    onCheckedChange={(checked) => updateSettings({ autoSuggestionsEnabled: checked })}
                  />
                  <Label htmlFor="autoSuggestions">Enable auto-suggestions</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggestionDelay">Suggestion Delay (ms)</Label>
                <Input
                  id="suggestionDelay"
                  type="number"
                  min="100"
                  max="2000"
                  step="50"
                  value={settings.suggestionDelay}
                  onChange={(e) => updateSettings({ suggestionDelay: parseInt(e.target.value) })}
                />
                <p className="text-xs text-gray-500">How long to wait before showing AI suggestions</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Writing Goals */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Writing Goals</h2>
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableWordGoal"
                      checked={settings.enableWordGoal}
                      onCheckedChange={(checked) => updateSettings({ enableWordGoal: checked })}
                    />
                    <Label htmlFor="enableWordGoal">Daily word goal</Label>
                  </div>
                  {settings.enableWordGoal && (
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={settings.dailyWordGoal}
                      onChange={(e) => updateSettings({ dailyWordGoal: parseInt(e.target.value) })}
                      placeholder="Words per day"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableTimeGoal"
                      checked={settings.enableTimeGoal}
                      onCheckedChange={(checked) => updateSettings({ enableTimeGoal: checked })}
                    />
                    <Label htmlFor="enableTimeGoal">Session time goal</Label>
                  </div>
                  {settings.enableTimeGoal && (
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={settings.sessionTimeGoal}
                      onChange={(e) => updateSettings({ sessionTimeGoal: parseInt(e.target.value) })}
                      placeholder="Minutes per session"
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Export & Backup Settings */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Export & Backup</h2>
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultExportFormat">Default Export Format</Label>
                  <Select value={settings.defaultExportFormat} onValueChange={(value) => updateSettings({ defaultExportFormat: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="docx">Word Document</SelectItem>
                      <SelectItem value="txt">Plain Text</SelectItem>
                      <SelectItem value="markdown">Markdown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backupInterval">Auto-backup Interval (hours)</Label>
                  <Input
                    id="backupInterval"
                    type="number"
                    min="1"
                    max="168"
                    value={settings.backupInterval}
                    onChange={(e) => updateSettings({ backupInterval: parseInt(e.target.value) })}
                    disabled={!settings.autoBackupEnabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeMetadata"
                    checked={settings.includeMetadata}
                    onCheckedChange={(checked) => updateSettings({ includeMetadata: checked })}
                  />
                  <Label htmlFor="includeMetadata">Include metadata in exports</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoBackup"
                    checked={settings.autoBackupEnabled}
                    onCheckedChange={(checked) => updateSettings({ autoBackupEnabled: checked })}
                  />
                  <Label htmlFor="autoBackup">Enable auto-backup</Label>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Agent Settings */}
          <section>
            <h2 className="text-xl font-semibold mb-4">AI Agent Settings</h2>
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="autonomyLevel">Autonomy Level</Label>
                  <Select value={settings.autonomyLevel} onValueChange={(value) => updateSettings({ autonomyLevel: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative (5 tools max)</SelectItem>
                      <SelectItem value="moderate">Moderate (10 tools max)</SelectItem>
                      <SelectItem value="aggressive">Aggressive (20 tools max)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Controls how many tools the agent can use in sequence and how autonomous it operates
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxExecutionTime">Max Execution Time (minutes)</Label>
                  <Input
                    id="maxExecutionTime"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.maxExecutionTime}
                    onChange={(e) => updateSettings({ maxExecutionTime: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-gray-500">
                    Maximum time the agent can run before stopping (safety limit)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableSelfReflection"
                    checked={settings.enableSelfReflection}
                    onCheckedChange={(checked) => updateSettings({ enableSelfReflection: checked })}
                  />
                  <Label htmlFor="enableSelfReflection">Enable self-reflection</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableLearning"
                    checked={settings.enableLearning}
                    onCheckedChange={(checked) => updateSettings({ enableLearning: checked })}
                  />
                  <Label htmlFor="enableLearning">Enable learning from results</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableMemoryPersistence"
                    checked={settings.enableMemoryPersistence}
                    onCheckedChange={(checked) => updateSettings({ enableMemoryPersistence: checked })}
                  />
                  <Label htmlFor="enableMemoryPersistence">Persistent memory</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableChainOfThought"
                    checked={settings.enableChainOfThought}
                    onCheckedChange={(checked) => updateSettings({ enableChainOfThought: checked })}
                  />
                  <Label htmlFor="enableChainOfThought">Show reasoning process</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toolExecutionDelay">Tool Execution Delay (ms)</Label>
                <Input
                  id="toolExecutionDelay"
                  type="number"
                  min="0"
                  max="5000"
                  step="100"
                  value={settings.toolExecutionDelay}
                  onChange={(e) => updateSettings({ toolExecutionDelay: parseInt(e.target.value) })}
                />
                <p className="text-xs text-gray-500">
                  Delay between tool executions (0 = fastest, higher = easier to follow)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentInstructions">Custom Agent Instructions</Label>
                <Textarea
                  id="agentInstructions"
                  placeholder="Additional instructions for the AI agent's behavior..."
                  className="min-h-24"
                  value={settings.agentInstructions}
                  onChange={(e) => updateSettings({ agentInstructions: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  These instructions will guide the agent's behavior and tool selection
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Hidden file input for importing */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />
    </div>
  );
} 