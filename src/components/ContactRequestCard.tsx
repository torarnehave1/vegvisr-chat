import { useState } from 'react'
import { approveContactRequest } from '../services/chat-service'
import { readStoredUser } from '../lib/auth'
import type { AuthParams } from '../types/chat'

// A contact enquiry from a public site's contact-form, rendered as an actionable card.
//
// The message BODY is deliberately human-readable prose rather than JSON: the same string is
// the group-list preview, the push notification and the Instagram relay text. So the fields are
// parsed back out here. brand-worker is the only producer of this format, but if parsing ever
// fails we fall back to showing the raw text — an enquiry must never be swallowed by a card
// that could not read it.
type Parsed = { host: string; name: string; email: string; phone: string; message: string }

export function parseContactRequest(body: string): Parsed | null {
  const email = body.match(/^E-post:\s*(\S+@\S+)\s*$/m)?.[1]
  if (!email) return null
  const host = body.match(/Ny henvendelse\s*[—-]\s*(\S+)/)?.[1] || ''
  const name = body.match(/^Navn:\s*(.+?)\s*$/m)?.[1] || ''
  const phoneRaw = body.match(/^Telefon:\s*(.+?)\s*$/m)?.[1] || ''
  const phone = phoneRaw.replace(/\s*\(verifisert\)\s*$/, '').trim()
  // Free-text message is whatever follows the blank line after the labelled block.
  const message = body.split(/\n\s*\n/).slice(1).join('\n\n').trim()
  return { host, name, email, phone, message }
}

const APPROVED_KEY = (messageId: number) => `contact-approved:${messageId}`

export function ContactRequestCard({
  messageId,
  body,
  auth,
}: {
  messageId: number
  body: string
  auth: AuthParams
}) {
  const parsed = parseContactRequest(body)
  const isSuperadmin = (readStoredUser()?.role || '').toLowerCase() === 'superadmin'

  // Approval has no server-side record of its own, so a reload cannot know it happened.
  // Remembering it per viewer keeps the card honest without inventing a table. Approving
  // twice is harmless anyway — the endpoint treats an existing account as success.
  const [done, setDone] = useState<string | null>(() => {
    try { return window.localStorage.getItem(APPROVED_KEY(messageId)) } catch { return null }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!parsed) return <p className="text-sm whitespace-pre-wrap">{body}</p>

  const onApprove = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await approveContactRequest(auth, {
        contactEmail: parsed.email,
        contactName: parsed.name,
        contactPhone: parsed.phone,
        domain: parsed.host,
      })
      const msg = res.alreadyRegistered
        ? `Hadde allerede konto — påloggingslenke sendt til ${parsed.email}`
        : `Registrert og påloggingslenke sendt til ${parsed.email}`
      try { window.localStorage.setItem(APPROVED_KEY(messageId), msg) } catch { /* private mode */ }
      setDone(msg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Godkjenning feilet')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-600 p-3 text-sm max-w-sm">
      <div className="font-semibold mb-2">
        📩 Ny henvendelse{parsed.host ? ` — ${parsed.host}` : ''}
      </div>
      <dl className="space-y-0.5 mb-2">
        {parsed.name && (
          <div className="flex gap-2"><dt className="opacity-60 w-16 shrink-0">Navn</dt><dd>{parsed.name}</dd></div>
        )}
        <div className="flex gap-2"><dt className="opacity-60 w-16 shrink-0">E-post</dt><dd className="break-all">{parsed.email}</dd></div>
        {parsed.phone && (
          <div className="flex gap-2"><dt className="opacity-60 w-16 shrink-0">Telefon</dt><dd>{parsed.phone}</dd></div>
        )}
      </dl>
      {parsed.message && <p className="whitespace-pre-wrap mb-3 opacity-90">{parsed.message}</p>}

      {done ? (
        <p className="text-green-700 dark:text-green-400">✓ {done}</p>
      ) : isSuperadmin ? (
        <>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            {busy ? 'Godkjenner…' : 'Godkjenn og send tilgang'}
          </button>
          {error && <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>}
        </>
      ) : (
        <p className="opacity-60">Bare Superadmin kan godkjenne.</p>
      )}
    </div>
  )
}
