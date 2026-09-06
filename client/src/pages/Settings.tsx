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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Slider } from "@/components/ui/slider";
import CustomCommandEditor from "@/components/CustomCommandEditor";

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { toast } = useToast();
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const settingsSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']),
    language: z.enum(['en', 'es', 'fr']),
    autosaveInterval: z.number().min(5000).max(300000),
    showLineNumbers: z.boolean(),
    fontSize: z.number().min(10).max(24),
    contextPanelDefaultOpen: z.boolean(),
    sidebarDefaultOpen: z.boolean(),
    llmProvider: z.enum(['openai', 'ollama', 'gemini', 'kimi']),
    llmModel: z.string(),
    ollamaUrl: z.string().url().optional().or(z.literal('')),
    researchModel: z.string().optional(),
    imageProvider: z.enum(['local', 'gemini', 'custom']).optional(),
    imageModel: z.string().optional(),
    imageSteps: z.number().optional(),
    imageSize: z.enum(['256x256', '512x512', '1024x1024']).optional(),
    localImageModel: z.string().optional()
  });

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      theme: settings.theme,
      autosaveInterval: settings.autosaveInterval,
      showLineNumbers: settings.showLineNumbers,
      contextPanelDefaultOpen: settings.contextPanelDefaultOpen,
      sidebarDefaultOpen: settings.sidebarDefaultOpen,
      llmProvider: settings.llmProvider,
      llmModel: settings.llmModel || 'mlx-community/gemma-4-e2b-it-4bit',
      ollamaUrl: settings.ollamaUrl || 'http://localhost:11434',
      researchModel: settings.researchModel || 'sonar',
      imageProvider: settings.imageProvider || 'local',
      imageModel: settings.imageModel || 'gemini-3.1-flash-lite-image',
      imageSteps: settings.imageSteps ?? 1,
      imageSize: settings.imageSize || '1024x1024',
      localImageModel: settings.localImageModel || 'FLUX.2 Klein 4B (mflux bridge)'
    }
  });

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
    llmModel: 'mlx-community/gemma-4-e2b-it-4bit',
    ollamaUrl: 'http://localhost:11434',
    researchModel: 'sonar',
    imageProvider: 'local',
    imageModel: 'gemini-3.1-flash-lite-image',
    imageSteps: 1,
    imageSize: '1024x1024',
    localImageModel: 'FLUX.2 Klein 4B (mflux bridge)',
    
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

  // Fetch Ollama models when provider is ollama. Goes through the server so
  // it works from ANY device on the network (a browser on a remote machine
  // has no localhost Ollama of its own).
  const fetchOllamaModels = async () => {
    if (settings.llmProvider !== 'ollama') return;

    setLoadingModels(true);
    try {
      const response = await fetch('/api/ai/ollama/models', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const models = data.models?.map((model: any) => model.name) || [];
        setOllamaModels(models);

        // If current model is not available, set to first available model
        if (models.length > 0 && !models.includes(settings.llmModel)) {
          updateSettings({ llmModel: models[0] });
        }
      } else {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to fetch models');
      }
    } catch (error: any) {
      console.error('Error fetching Ollama models:', error);
      toast({
        title: "Failed to fetch Ollama models",
        description: error?.message || "Check that Ollama is running on the server host.",
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
                  <Select value={settings.llmProvider} onValueChange={(value) => updateSettings({ llmProvider: value as 'openai' | 'ollama' | 'gemini' | 'kimi' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="kimi">Kimi (Coding Plan)</SelectItem>
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
                          <SelectItem value="mlx-community/gemma-4-e2b-it-4bit">Gemma 4 E2B (MLX local)</SelectItem>
                          <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                          <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                          <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </>
                      ) : settings.llmProvider === 'kimi' ? (
                        <>
                          <SelectItem value="kimi-for-coding">Kimi for Coding</SelectItem>
                          <SelectItem value="kimi-for-coding-highspeed">Kimi for Coding Highspeed</SelectItem>
                          <SelectItem value="k3">K3</SelectItem>
                          <SelectItem value="k3-256k">K3 (256k context)</SelectItem>
                        </>
                      ) : settings.llmProvider === 'gemini' ? (
                        <>
                          <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
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
                  {settings.llmProvider === 'kimi' && (
                    <p className="text-xs text-gray-500">
                      Uses the team server's Kimi Coding Plan key (<span className="font-mono">KIMI_API_KEY</span> in .env).
                      Streaming is not available on this provider yet.
                    </p>
                  )}
                </div>
              </div>
              
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-300">
                API keys are configured on the server via environment variables
                (<span className="font-mono">OPENAI_API_KEY</span>, <span className="font-mono">GEMINI_API_KEY</span>,{" "}
                <span className="font-mono">PERPLEXITY_API_KEY</span>) in the server's{" "}
                <span className="font-mono">.env</span> — they are never stored in your browser.
              </div>

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

          {/* Research + Image configuration */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Research & Image</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="researchModel">Research Model</Label>
                  <Select value={settings.researchModel || 'sonar'} onValueChange={(value) => updateSettings({ researchModel: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sonar">Sonar</SelectItem>
                      <SelectItem value="sonar-pro">Sonar Pro</SelectItem>
                      <SelectItem value="sonar-reasoning">Sonar Reasoning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imageProvider">Image Provider</Label>
                  <Select value={settings.imageProvider || 'local'} onValueChange={(value) => updateSettings({ imageProvider: value as 'local' | 'gemini' | 'custom' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local (mflux FLUX.2 Klein)</SelectItem>
                      <SelectItem value="gemini">Gemini (cloud)</SelectItem>
                      <SelectItem value="custom">Custom endpoint (OpenAI-compatible)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageModel">Image Model (Gemini)</Label>
                  <Input
                    id="imageModel"
                    placeholder="gemini-3.1-flash-lite-image"
                    value={settings.imageModel || ''}
                    onChange={(e) => updateSettings({ imageModel: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">Must be an image-capable Gemini model. Requires a Gemini API key (or GEMINI_API_KEY env).</p>
                </div>
                {settings.imageProvider === 'custom' && (
                  <div className="md:col-span-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-300">
                    Custom endpoints use the standard OpenAI images API shape and are configured on the
                    server via <span className="font-mono">IMAGE_API_URL</span> (plus optional{" "}
                    <span className="font-mono">IMAGE_API_KEY</span>,{" "}
                    <span className="font-mono">IMAGE_API_MODEL</span>) — works with ComfyUI bridges,
                    A1111 <span className="font-mono">--api</span>, SD WebUI, and hosted gateways.
                  </div>
                )}
                {settings.imageProvider === 'local' && (
                  <>
                    <div className="space-y-2">
                      <Label>Local Model (mflux bridge)</Label>
                      <div className="rounded-md border border-copper-200 bg-copper-50 px-3 py-2 text-sm text-copper-700">
                        {settings.localImageModel || 'FLUX.2 Klein 4B (mflux bridge)'}
                      </div>
                      <p className="text-xs text-gray-500">Loaded by the mflux bridge at MFLUX_BRIDGE_URL. Fixed model — not switchable per request.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imageSteps">Steps</Label>
                      <Select value={String(settings.imageSteps ?? 1)} onValueChange={(v) => updateSettings({ imageSteps: parseInt(v, 10) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 (fastest)</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="4">4 (bridge default)</SelectItem>
                          <SelectItem value="8">8 (highest quality)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">Higher steps = slower but more refined images.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imageSize">Size</Label>
                      <Select value={settings.imageSize || '1024x1024'} onValueChange={(v) => updateSettings({ imageSize: v as '256x256' | '512x512' | '1024x1024' })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="256x256">256×256</SelectItem>
                          <SelectItem value="512x512">512×512</SelectItem>
                          <SelectItem value="1024x1024">1024×1024</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
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

          {/* Custom Commands */}
          <section>
            <CustomCommandEditor />
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
                  <Label>Exports</Label>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Use the editor's download menu: Markdown for source, Shareable HTML for a
                    self-contained file (charts and images included), Print / PDF for paper.
                  </p>
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