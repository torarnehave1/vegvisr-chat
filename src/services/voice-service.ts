const VOICE_BASE = 'https://voice.vegvisr.org'

export async function uploadAudio(
  blob: Blob,
  fileName: string,
  groupId: string,
): Promise<{ audioUrl: string; objectKey: string }> {
  const res = await fetch(`${VOICE_BASE}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'audio/webm',
      'X-File-Name': fileName,
      'X-Chat-Id': groupId,
    },
    body: blob,
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to upload audio')
  return { audioUrl: data.audioUrl, objectKey: data.objectKey }
}

export async function transcribeAudio(
  audioUrl: string,
  language?: string,
): Promise<{ text: string; language: string }> {
  const res = await fetch(`${VOICE_BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioUrl,
      model: 'whisper-1',
      language: language || null,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Transcription failed')
  return { text: data.text, language: data.language }
}
