import { useSettings } from '@/providers/SettingsProvider';

export function useAIInstructions() {
  const { settings } = useSettings();

  const buildSystemPrompt = () => {
    let prompt = '';

    // Add custom system prompt if provided
    if (settings.systemPrompt.trim()) {
      prompt += settings.systemPrompt + '\n\n';
    }

    // Add tone preference
    const toneInstruction = settings.tonePreference === 'custom' 
      ? settings.customTone 
      : settings.tonePreference;
    
    if (toneInstruction) {
      prompt += `Write in a ${toneInstruction} tone. `;
    }

    // Add writing style if provided
    if (settings.writingStyle.trim()) {
      prompt += `Use this writing style: ${settings.writingStyle}. `;
    }

    // Add default instruction if no custom prompt
    if (!settings.systemPrompt.trim()) {
      prompt += 'You are a helpful AI writing assistant. Help the user with their writing tasks while maintaining their voice and style preferences.';
    }

    return prompt.trim();
  };

  const getActiveCustomCommands = () => {
    return settings.customCommands.filter(cmd => cmd.enabled);
  };

  const findCustomCommand = (text: string) => {
    const activeCommands = getActiveCustomCommands();
    return activeCommands.find(cmd => 
      text.toLowerCase().includes(cmd.trigger.toLowerCase())
    );
  };

  return {
    systemPrompt: buildSystemPrompt(),
    customCommands: getActiveCustomCommands(),
    findCustomCommand,
    settings: {
      grammarCheckEnabled: settings.grammarCheckEnabled,
      autoSuggestionsEnabled: settings.autoSuggestionsEnabled,
      suggestionDelay: settings.suggestionDelay,
      spellCheckEnabled: settings.spellCheckEnabled
    }
  };
} 