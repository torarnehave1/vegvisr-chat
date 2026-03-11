import { useState } from 'react'

interface Props {
  onSave: (phone: string) => void
}

export function PhoneSetup({ onSave }: Props) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const handleSave = () => {
    let cleaned = phone.trim().replace(/\s/g, '')
    if (!cleaned) {
      setError('Please enter your phone number')
      return
    }
    // Add Norwegian prefix if just digits
    if (/^\d{8}$/.test(cleaned)) {
      cleaned = `+47${cleaned}`
    } else if (!cleaned.startsWith('+')) {
      cleaned = `+${cleaned}`
    }
    onSave(cleaned)
  }

  return (
    <div className="flex items-center justify-center h-full bg-slate-950 px-4">
      <div className="max-w-sm w-full text-center">
        <h2 className="text-white text-xl font-semibold mb-2">Phone Number Required</h2>
        <p className="text-white/50 text-sm mb-6">
          Enter your phone number to use the chat. This connects you with your existing groups.
        </p>
        <input
          type="tel"
          value={phone}
          onChange={e => { setPhone(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="+47 12345678"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg focus:outline-none focus:border-sky-400/50 mb-3"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          onClick={handleSave}
          className="w-full py-3 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-500 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
