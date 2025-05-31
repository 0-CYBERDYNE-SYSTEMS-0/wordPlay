import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/providers/SettingsProvider";
import { 
  Download, 
  Upload, 
  RotateCcw, 
  Save, 
  RefreshCw,
  Settings,
  Palette,
  Brain,
  FileText,
  Target,
  Download as ExportIcon,
  Key,
  Server,
  Monitor,
  Zap
} from "lucide-react";

interface SettingsPanelProps {
  contextPanelOpen: boolean;
  onToggleContextPanel: () => void;
}

export default function SettingsPanel({ contextPanelOpen, onToggleContextPanel }: SettingsPanelProps) {
  const { toast } = useToast();
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useSettings();
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

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
        description: "Make sure Ollama is running and accessible.",
        variant: "destructive",
      });
      setOllamaModels(['llama3', 'codellama', 'mistral']);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (settings.llmProvider === 'ollama') {
      fetchOllamaModels();
    }
  }, [settings.llmProvider, settings.ollamaUrl]);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importSettings(file);
      toast({
        title: "Settings imported",
        description: "Your settings have been imported successfully.",
      });
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all settings to default?")) {
      resetSettings();
      toast({
        title: "Settings reset",
        description: "All settings have been reset to default values.",
      });
    }
  };

  return (
    <div className="h-full bg-white dark:bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportSettings}
              className="flex items-center gap-2"
            >
              <ExportIcon className="h-4 w-4" />
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('settings-import')?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <input
          id="settings-import"
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="agent" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Agent
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Goals
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your writing environment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={settings.theme} onValueChange={(value: 'light' | 'dark' | 'system') => updateSettings({ theme: value })}>
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
                  <Select value={settings.fontSize} onValueChange={(value: 'small' | 'medium' | 'large') => updateSettings({ fontSize: value })}>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontFamily">Font Family</Label>
                <Select value={settings.fontFamily} onValueChange={(value: 'serif' | 'sans-serif' | 'mono') => updateSettings({ fontFamily: value })}>
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Animations</Label>
                  <p className="text-sm text-gray-500">Enable smooth animations and transitions</p>
                </div>
                <Switch
                  checked={settings.enableAnimations}
                  onCheckedChange={(checked) => updateSettings({ enableAnimations: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sound Effects</Label>
                  <p className="text-sm text-gray-500">Enable audio feedback</p>
                </div>
                <Switch
                  checked={settings.enableSounds}
                  onCheckedChange={(checked) => updateSettings({ enableSounds: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interface Layout</CardTitle>
              <CardDescription>
                Configure default panel visibility and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sidebar Open by Default</Label>
                  <p className="text-sm text-gray-500">Show project sidebar when app starts</p>
                </div>
                <Switch
                  checked={settings.sidebarDefaultOpen}
                  onCheckedChange={(checked) => updateSettings({ sidebarDefaultOpen: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Context Panel Open by Default</Label>
                  <p className="text-sm text-gray-500">Show context panel when app starts</p>
                </div>
                <Switch
                  checked={settings.contextPanelDefaultOpen}
                  onCheckedChange={(checked) => updateSettings({ contextPanelDefaultOpen: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Distraction-Free Mode</Label>
                  <p className="text-sm text-gray-500">Minimize UI elements for focused writing</p>
                </div>
                <Switch
                  checked={settings.distractionFreeMode}
                  onCheckedChange={(checked) => updateSettings({ distractionFreeMode: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Model Configuration
              </CardTitle>
              <CardDescription>
                Configure your preferred AI provider and models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="llmProvider">AI Provider</Label>
                <Select value={settings.llmProvider} onValueChange={(value: 'openai' | 'ollama') => updateSettings({ llmProvider: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.llmProvider === 'ollama' && (
                <div className="space-y-2">
                  <Label htmlFor="ollamaUrl">Ollama Server URL</Label>
                  <Input
                    value={settings.ollamaUrl}
                    onChange={(e) => updateSettings({ ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="llmModel">AI Model</Label>
                  {settings.llmProvider === 'ollama' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchOllamaModels}
                      disabled={loadingModels}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingModels ? 'animate-spin' : ''}`} />
                      Refresh Models
                    </Button>
                  )}
                </div>
                {settings.llmProvider === 'openai' ? (
                  <Select value={settings.llmModel} onValueChange={(value) => updateSettings({ llmModel: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="o1-preview">o1-preview</SelectItem>
                      <SelectItem value="o1-mini">o1-mini</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={settings.llmModel} onValueChange={(value) => updateSettings({ llmModel: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.length > 0 ? ollamaModels.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      )) : (
                        <SelectItem value="llama3">llama3</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {settings.llmProvider === 'openai' && (
                <div className="space-y-2">
                  <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                  <Input
                    type="password"
                    value={settings.openaiApiKey || ''}
                    onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-gray-500">Your API key is stored locally and never shared</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Behavior</CardTitle>
              <CardDescription>
                Customize how AI responds and interacts with your writing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  value={settings.systemPrompt}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  placeholder="Custom instructions for the AI..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="writingStyle">Writing Style Instructions</Label>
                <Textarea
                  value={settings.writingStyle}
                  onChange={(e) => updateSettings({ writingStyle: e.target.value })}
                  placeholder="Describe your preferred writing style..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tonePreference">Tone Preference</Label>
                  <Select value={settings.tonePreference} onValueChange={(value: any) => updateSettings({ tonePreference: value })}>
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
                      value={settings.customTone}
                      onChange={(e) => updateSettings({ customTone: e.target.value })}
                      placeholder="Describe your tone..."
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Editor Settings */}
        <TabsContent value="editor" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Editor Configuration
              </CardTitle>
              <CardDescription>
                Customize your writing environment and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Autosave Interval</Label>
                <div className="px-3">
                  <Slider
                    value={[settings.autosaveInterval / 1000]}
                    onValueChange={(value) => updateSettings({ autosaveInterval: value[0] * 1000 })}
                    min={5}
                    max={300}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5s</span>
                    <span>{settings.autosaveInterval / 1000}s</span>
                    <span>5m</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lineHeight">Line Height</Label>
                  <Select value={settings.lineHeight} onValueChange={(value: any) => updateSettings({ lineHeight: value })}>
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
                  <Select value={settings.editorWidth} onValueChange={(value: any) => updateSettings({ editorWidth: value })}>
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
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Word Wrap</Label>
                  <p className="text-sm text-gray-500">Wrap long lines automatically</p>
                </div>
                <Switch
                  checked={settings.wordWrapEnabled}
                  onCheckedChange={(checked) => updateSettings({ wordWrapEnabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Line Numbers</Label>
                  <p className="text-sm text-gray-500">Display line numbers in the editor</p>
                </div>
                <Switch
                  checked={settings.showLineNumbers}
                  onCheckedChange={(checked) => updateSettings({ showLineNumbers: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Writing Assistance</CardTitle>
              <CardDescription>
                Configure real-time writing help and suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Spell Check</Label>
                  <p className="text-sm text-gray-500">Check spelling as you type</p>
                </div>
                <Switch
                  checked={settings.spellCheckEnabled}
                  onCheckedChange={(checked) => updateSettings({ spellCheckEnabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Grammar Check</Label>
                  <p className="text-sm text-gray-500">Check grammar as you type</p>
                </div>
                <Switch
                  checked={settings.grammarCheckEnabled}
                  onCheckedChange={(checked) => updateSettings({ grammarCheckEnabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Suggestions</Label>
                  <p className="text-sm text-gray-500">Show AI-powered writing suggestions</p>
                </div>
                <Switch
                  checked={settings.autoSuggestionsEnabled}
                  onCheckedChange={(checked) => updateSettings({ autoSuggestionsEnabled: checked })}
                />
              </div>

              {settings.autoSuggestionsEnabled && (
                <div className="space-y-2">
                  <Label>Suggestion Delay (ms)</Label>
                  <div className="px-3">
                    <Slider
                      value={[settings.suggestionDelay]}
                      onValueChange={(value) => updateSettings({ suggestionDelay: value[0] })}
                      min={100}
                      max={2000}
                      step={100}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>100ms</span>
                      <span>{settings.suggestionDelay}ms</span>
                      <span>2s</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Settings */}
        <TabsContent value="agent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                AI Agent Configuration
              </CardTitle>
              <CardDescription>
                Configure the autonomous AI agent behavior and capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="autonomyLevel">Autonomy Level</Label>
                <Select value={settings.autonomyLevel} onValueChange={(value: any) => updateSettings({ autonomyLevel: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Conservative: Ask before major changes | Moderate: Balance autonomy and safety | Aggressive: Maximum autonomy
                </p>
              </div>

              <div className="space-y-2">
                <Label>Max Execution Time (minutes)</Label>
                <div className="px-3">
                  <Slider
                    value={[settings.maxExecutionTime]}
                    onValueChange={(value) => updateSettings({ maxExecutionTime: value[0] })}
                    min={1}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1m</span>
                    <span>{settings.maxExecutionTime}m</span>
                    <span>30m</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tool Execution Delay (ms)</Label>
                <div className="px-3">
                  <Slider
                    value={[settings.toolExecutionDelay]}
                    onValueChange={(value) => updateSettings({ toolExecutionDelay: value[0] })}
                    min={0}
                    max={5000}
                    step={250}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0ms</span>
                    <span>{settings.toolExecutionDelay}ms</span>
                    <span>5s</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Self-Reflection</Label>
                  <p className="text-sm text-gray-500">Agent can analyze and improve its own responses</p>
                </div>
                <Switch
                  checked={settings.enableSelfReflection}
                  onCheckedChange={(checked) => updateSettings({ enableSelfReflection: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Learning</Label>
                  <p className="text-sm text-gray-500">Agent learns from interactions to improve responses</p>
                </div>
                <Switch
                  checked={settings.enableLearning}
                  onCheckedChange={(checked) => updateSettings({ enableLearning: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Chain of Thought</Label>
                  <p className="text-sm text-gray-500">Show agent's reasoning process</p>
                </div>
                <Switch
                  checked={settings.enableChainOfThought}
                  onCheckedChange={(checked) => updateSettings({ enableChainOfThought: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentInstructions">Agent Instructions</Label>
                <Textarea
                  value={settings.agentInstructions}
                  onChange={(e) => updateSettings({ agentInstructions: e.target.value })}
                  placeholder="Additional instructions for the AI agent..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals Settings */}
        <TabsContent value="goals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Writing Goals
              </CardTitle>
              <CardDescription>
                Set daily targets to stay motivated and track progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Daily Word Goal</Label>
                  <p className="text-sm text-gray-500">Set a daily writing target</p>
                </div>
                <Switch
                  checked={settings.enableWordGoal}
                  onCheckedChange={(checked) => updateSettings({ enableWordGoal: checked })}
                />
              </div>

              {settings.enableWordGoal && (
                <div className="space-y-2">
                  <Label>Daily Word Goal</Label>
                  <Input
                    type="number"
                    value={settings.dailyWordGoal}
                    onChange={(e) => updateSettings({ dailyWordGoal: parseInt(e.target.value) || 0 })}
                    placeholder="500"
                    min="0"
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Session Time Goal</Label>
                  <p className="text-sm text-gray-500">Set a target writing session length</p>
                </div>
                <Switch
                  checked={settings.enableTimeGoal}
                  onCheckedChange={(checked) => updateSettings({ enableTimeGoal: checked })}
                />
              </div>

              {settings.enableTimeGoal && (
                <div className="space-y-2">
                  <Label>Session Time Goal (minutes)</Label>
                  <Input
                    type="number"
                    value={settings.sessionTimeGoal}
                    onChange={(e) => updateSettings({ sessionTimeGoal: parseInt(e.target.value) || 0 })}
                    placeholder="30"
                    min="0"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistics Display</CardTitle>
              <CardDescription>
                Choose what writing statistics to show
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Word Count</Label>
                  <p className="text-sm text-gray-500">Display current word count</p>
                </div>
                <Switch
                  checked={settings.showWordCount}
                  onCheckedChange={(checked) => updateSettings({ showWordCount: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Reading Time</Label>
                  <p className="text-sm text-gray-500">Estimate reading time for current document</p>
                </div>
                <Switch
                  checked={settings.showReadingTime}
                  onCheckedChange={(checked) => updateSettings({ showReadingTime: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Style Analysis</Label>
                  <p className="text-sm text-gray-500">Display writing style insights</p>
                </div>
                <Switch
                  checked={settings.showStyleAnalysis}
                  onCheckedChange={(checked) => updateSettings({ showStyleAnalysis: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup & Export</CardTitle>
              <CardDescription>
                Configure automatic backups and default export settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Backup</Label>
                  <p className="text-sm text-gray-500">Automatically backup your work</p>
                </div>
                <Switch
                  checked={settings.autoBackupEnabled}
                  onCheckedChange={(checked) => updateSettings({ autoBackupEnabled: checked })}
                />
              </div>

              {settings.autoBackupEnabled && (
                <div className="space-y-2">
                  <Label>Backup Interval (hours)</Label>
                  <Input
                    type="number"
                    value={settings.backupInterval}
                    onChange={(e) => updateSettings({ backupInterval: parseInt(e.target.value) || 24 })}
                    placeholder="24"
                    min="1"
                    max="168"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="defaultExportFormat">Default Export Format</Label>
                <Select value={settings.defaultExportFormat} onValueChange={(value: any) => updateSettings({ defaultExportFormat: value })}>
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Metadata in Exports</Label>
                  <p className="text-sm text-gray-500">Add creation date, word count, etc.</p>
                </div>
                <Switch
                  checked={settings.includeMetadata}
                  onCheckedChange={(checked) => updateSettings({ includeMetadata: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 