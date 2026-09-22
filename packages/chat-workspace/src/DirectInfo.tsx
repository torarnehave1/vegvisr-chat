import { useEffect, useState } from 'react'
import type { ContactSharing, DirectPeer, createDirectChat } from '../../shared-chat/src/direct'

type DirectClient = ReturnType<typeof createDirectChat>

/**
 * The "i" panel of a private conversation: the other person's card (call, SMS, e-mail when they
 * share it) and my own opt-in choices for this community. Nothing is shared by default.
 */
export function DirectInfo({ client, groupId, name, onBack }: { client: DirectClient; groupId: string; name: string; onBack: () => void }) {
  const [peer, setPeer] = useState<DirectPeer | null>(null)
  const [mine, setMine] = useState<ContactSharing | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([client.fetchPeer(groupId), client.getContactSharing()])
      .then(([card, sharing]) => { if (!cancelled) { setPeer(card); setMine(sharing) } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke hente kontaktinformasjon.') })
    return () => { cancelled = true }
  }, [client, groupId])

  const choose = async (key: 'phone' | 'email', value: boolean) => {
    setSaving(true)
    setError('')
    try {
      setMine(await client.setContactSharing({ [key]: value }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre valget.')
    } finally {
      setSaving(false)
    }
  }

  const display = peer?.name || name
  const dial = (peer?.phone || '').replace(/[^\d+]/g, '')
  const button = 'inline-flex items-center rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 text-sm font-medium text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10'

  return (
    <section className="p-4 space-y-5 max-w-xl">
      <button type="button" onClick={onBack} className="text-sm text-slate-600 dark:text-white/70">← Tilbake</button>
      <div className="flex items-center gap-3">
        {peer?.avatar_url
          ? <img src={peer.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          : <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-lg font-semibold">{display.slice(0, 1).toUpperCase()}</div>}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{display}</h2>
          <p className="text-sm text-slate-500 dark:text-white/50">Privat samtale</p>
        </div>
      </div>

      {peer && (peer.phone || peer.email) ? (
        <div className="space-y-2">
          {peer.phone && <p className="text-sm text-slate-700 dark:text-white/80">Telefon: {peer.phone}</p>}
          {peer.email && <p className="text-sm text-slate-700 dark:text-white/80 break-all">E-post: {peer.email}</p>}
          <div className="flex flex-wrap gap-2">
            {peer.phone && <a className={button} href={`tel:${dial}`}>Ring</a>}
            {peer.phone && <a className={button} href={`sms:${dial}`}>Send SMS</a>}
            {peer.email && <a className={button} href={`mailto:${peer.email}`}>Send e-post</a>}
          </div>
        </div>
      ) : peer ? (
        <p className="text-sm text-slate-600 dark:text-white/60">{display} har ikke valgt å dele telefonnummer eller e-post.</p>
      ) : !error ? (
        <p className="text-sm text-slate-500 dark:text-white/50">Henter kontaktinformasjon …</p>
      ) : null}

      {mine && (
        <fieldset className="space-y-2 border-t border-slate-200 dark:border-white/10 pt-4">
          <legend className="text-sm font-semibold text-slate-900 dark:text-white">Dine kontaktopplysninger</legend>
          <p className="text-sm text-slate-600 dark:text-white/60">Velg hva andre medlemmer i dette fellesskapet kan se når de åpner info om deg i en privat samtale. Ingenting deles uten at du slår det på.</p>
          <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-white">
            <input type="checkbox" checked={mine.phone} disabled={saving || !mine.has_phone} onChange={event => choose('phone', event.target.checked)} />
            Vis telefonnummeret mitt{!mine.has_phone && ' (ikke registrert på kontoen)'}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-white">
            <input type="checkbox" checked={mine.email} disabled={saving || !mine.has_email} onChange={event => choose('email', event.target.checked)} />
            Vis e-postadressen min{!mine.has_email && ' (ikke registrert på kontoen)'}
          </label>
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </section>
  )
}
