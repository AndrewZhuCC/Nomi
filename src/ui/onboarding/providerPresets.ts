/**
 * Provider presets for the manual model-add form.
 *
 * Picking a preset auto-fills BaseURL + 接口类型 + 供应商名称 so users don't have to
 * remember endpoint URLs. Relays/中转站 have their own arbitrary address (a preset
 * can't know it) → the "自定义 / 中转站" entry clears the address for the user to paste,
 * and they lean on 拉取可用模型 (GET /models) to fill in the model ids.
 *
 * `baseUrl: ''` means: anthropic uses its hosted default; custom waits for user input.
 */
export type ProviderPreset = {
  id: string
  label: string
  providerKind: 'openai-compatible' | 'anthropic'
  baseUrl: string
  /** The catch-all entry: clear the address, let the user paste their own (relays). */
  custom?: boolean
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openai', label: 'OpenAI', providerKind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
  { id: 'claude', label: 'Claude', providerKind: 'anthropic', baseUrl: '' },
  { id: 'gemini', label: 'Gemini', providerKind: 'openai-compatible', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'kimi', label: 'Kimi', providerKind: 'openai-compatible', baseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'zhipu', label: '智谱 GLM', providerKind: 'openai-compatible', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'deepseek', label: 'DeepSeek', providerKind: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'custom', label: '自定义 / 中转站', providerKind: 'openai-compatible', baseUrl: '', custom: true },
]
