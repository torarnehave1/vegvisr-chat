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
    <div className="bg-surface-sunk/80 border border-line rounded-xl p-4 mx-auto max-w-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-ink font-semibold text-sm">Create a Poll</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-ink-faint hover:text-ink text-xs"
        >
          Cancel
        </button>
      </div>

      {/* Question */}
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask a question..."
        className="w-full bg-surface-sunk border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-brand mb-3"
        autoFocus
      />

      {/* Options */}
      <div className="space-y-2 mb-3">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-ink-faint text-xs w-5 text-right flex-shrink-0">{i + 1}.</span>
            <input
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              placeholder={i === 0 ? 'Yes' : i === 1 ? 'No' : `Option ${i + 1}`}
              className="flex-1 bg-surface-sunk border border-line rounded-lg px-3 py-1.5 text-ink text-sm focus:outline-none focus:border-brand"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-ink-faint hover:text-danger text-xs px-1"
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
            className="text-brand hover:text-brand text-xs font-medium"
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
          className="px-4 py-1.5 bg-brand text-brand-ink rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-brand-strong transition-colors"
        >
          {disabled ? 'Creating...' : 'Create Poll'}
        </button>
      </div>
    </div>
  )
}
