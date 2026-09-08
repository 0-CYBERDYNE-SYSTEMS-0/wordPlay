/**
 * Provider registry — the single source of truth for AI providers.
 *
 * Modeled on how multi-provider AI apps (LibreChat, Open WebUI, LobeChat)
 * handle it: each named provider carries its own credentials, endpoint and
 * model catalog; the user's Settings selection is the ONLY thing that decides
 * which one serves a request. No shared slots, no silent cross-wiring.
 *
 * All credentials resolve from SERVER-SIDE env at call time (never from the
 * browser). `custom` covers any other OpenAI-compatible endpoint — local
 * MLX/LM Studio/vLLM or a cloud gateway (OpenRouter, Groq, Together, …).
 */

export type ProviderId = 'openai' | 'custom' | 'kimi' | 'gemini' | 'ollama';

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  /** Transport kind used by the request pipeline. */
  kind: 'openai-compatible' | 'gemini' | 'ollama';
  /** Env var holding the API key. */
  apiKeyEnv: string;
  /** Env var that can override the default base URL (optional). */
  baseUrlEnv?: string;
  defaultBaseUrl: string;
  /** Base URLs that don't need a real key (local runtimes). */
  keyOptional: boolean;
  defaultModel: string;
  /** Static catalog for the Settings UI (Ollama's list is dynamic). */
  models: string[];
  /** What the provider needs in the server .env, for UI hints. */
  requiredEnvHint: string;
}

const REGISTRY: Record<ProviderId, ProviderDefinition> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compatible',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyOptional: false,
    defaultModel: 'gpt-4.1-mini',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
    requiredEnvHint: 'OPENAI_API_KEY',
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    kind: 'openai-compatible',
    // Legacy fallback: OPENAI_BASE_URL used to be the only way to point at a
    // self-hosted endpoint; keep it working so existing .env files survive.
    apiKeyEnv: 'CUSTOM_API_KEY',
    baseUrlEnv: 'CUSTOM_BASE_URL',
    defaultBaseUrl: 'http://localhost:8080/v1',
    keyOptional: true,
    defaultModel: 'mlx-community/gemma-4-e2b-it-4bit',
    models: ['mlx-community/gemma-4-e2b-it-4bit'],
    requiredEnvHint: 'CUSTOM_BASE_URL (+ CUSTOM_API_KEY if your endpoint needs one)',
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi (Coding Plan)',
    kind: 'openai-compatible',
    apiKeyEnv: 'KIMI_API_KEY',
    baseUrlEnv: 'KIMI_BASE_URL',
    defaultBaseUrl: 'https://api.kimi.com/coding/v1',
    keyOptional: false,
    defaultModel: 'kimi-for-coding',
    models: ['kimi-for-coding', 'kimi-for-coding-highspeed', 'k3', 'k3-256k'],
    requiredEnvHint: 'KIMI_API_KEY',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    kind: 'gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    keyOptional: false,
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    requiredEnvHint: 'GEMINI_API_KEY',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (Local)',
    kind: 'ollama',
    apiKeyEnv: '',
    baseUrlEnv: 'OLLAMA_URL',
    defaultBaseUrl: 'http://localhost:11434',
    keyOptional: true,
    defaultModel: 'qwen3.5:4b',
    models: [],
    requiredEnvHint: 'OLLAMA_URL (optional; defaults to localhost:11434)',
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && value in REGISTRY;
}

export function getProvider(provider: unknown): ProviderDefinition {
  if (isProviderId(provider)) return REGISTRY[provider];
  // Unknown/legacy values behave as the plain OpenAI slot.
  return REGISTRY.openai;
}

export function allProviders(): ProviderDefinition[] {
  return Object.values(REGISTRY);
}

/** Credentials + endpoint a request to `provider` should use. */
export function resolveProviderCredentials(provider: unknown): {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  definition: ProviderDefinition;
} {
  const def = getProvider(provider);
  const apiKey = (def.apiKeyEnv && process.env[def.apiKeyEnv]) || (def.keyOptional ? 'default_key' : `missing_${def.id}_key`);
  let baseURL = (def.baseUrlEnv && process.env[def.baseUrlEnv]) || def.defaultBaseUrl;
  // Existing .env files used OPENAI_BASE_URL for self-hosted endpoints before
  // the custom provider existed — honor it rather than silently breaking them.
  if (def.id === 'custom' && baseURL === def.defaultBaseUrl && process.env.OPENAI_BASE_URL) {
    baseURL = process.env.OPENAI_BASE_URL;
  }
  return { apiKey, baseURL, defaultModel: def.defaultModel, definition: def };
}

/**
 * Pick the model to send. An explicit selection always wins — but it must
 * belong to the selected provider's catalog when that catalog is non-empty;
 * otherwise the provider default is used (prevents e.g. an MLX model name
 * reaching api.openai.com after a provider switch).
 */
export function resolveModel(provider: unknown, selectedModel?: string): string {
  const def = getProvider(provider);
  if (selectedModel && (def.models.length === 0 || def.models.includes(selectedModel))) {
    return selectedModel;
  }
  return def.defaultModel;
}
