const AI_BASE = 'https://smsgway.vegvisr.org/api/ai-chat'

export type AiProvider = 'grok' | 'openai'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiResponse {
  success: boolean
  message: string
  model?: string
}

export async function sendAiMessage(
  messages: AiMessage[],
  phone: string,
  provider: AiProvider = 'grok',
  userId?: string,
): Promise<AiResponse> {
  const body: Record<string, unknown> = { phone, provider, messages }
  if (userId) body.userId = userId

  const res = await fetch(AI_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'AI request failed')
  return { success: true, message: data.message, model: data.model }
}
