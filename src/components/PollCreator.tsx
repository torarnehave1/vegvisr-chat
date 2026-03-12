import { useState } from 'react'

interface Props {
  onSubmit: (question: string, options: string[]) => void
  onCancel: () => void
  disabled?: boolean
}

export function PollCreator({ onSubmit, onCancel, disabled }: Props) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', '', ''])

  const validOptions = options.map(o => o.trim()).filter(Boolean)
  const canSubmit = question.trim() && validOptions.length >= 2

  const updateOption = (i: number, value: string) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? value : o))
  }

  const addOption = () => {
    if (options.length < 6) setOptions(prev => [...prev, ''])
  }

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="bg-slate-800/80 border border-white/10 rounded-xl p-4 mx-auto max-w-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Create a Poll</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-white/40 hover:text-white/70 text-xs"
        >
          Cancel
        </button>
      </div>

      {/* Question */}
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask a question..."
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-400/50 mb-3"
        autoFocus
      />

      {/* Options */}
      <div className="space-y-2 mb-3">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-white/30 text-xs w-5 text-right flex-shrink-0">{i + 1}.</span>
            <input
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              placeholder={i === 0 ? 'Yes' : i === 1 ? 'No' : `Option ${i + 1}`}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-400/50"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-white/20 hover:text-rose-400 text-xs px-1"
                title="Remove option"
              >
                x
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add option + Submit */}
      <div className="flex items-center justify-between">
        {options.length < 6 ? (
          <button
            type="button"
            onClick={addOption}
            className="text-sky-400 hover:text-sky-300 text-xs font-medium"
          >
            + Add option
          </button>
        ) : <span />}

        <button
          type="button"
          onClick={() => {
            if (canSubmit) onSubmit(question.trim(), validOptions)
          }}
          disabled={!canSubmit || disabled}
          className="px-4 py-1.5 bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-sky-500 transition-colors"
        >
          {disabled ? 'Creating...' : 'Create Poll'}
        </button>
      </div>
    </div>
  )
}
