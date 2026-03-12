import { useState, useEffect } from 'react'
import { fetchPoll, votePoll, closePoll } from '../services/chat-service'
import type { AuthParams, Poll } from '../types/chat'

interface Props {
  messageId: number
  auth: AuthParams
  currentUserId: string
}

export function PollCard({ messageId, auth, currentUserId }: Props) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Poll messages have their poll_id stored; we need to find it by message_id
    // We'll fetch via a search — the backend GET /polls/:id needs the poll ID.
    // Since we only have message_id, we'll use a lookup endpoint.
    // For now, we store poll data on the message itself via the group polls list.
    // Alternative: fetch all open polls for the group and match by message_id.
    // Simplest: add a poll_id field to the message, or query by message_id.
    // Let's use the approach of fetching by message_id — we need a small backend addition.
    // For now, we'll attempt to find the poll via group context.
    setLoading(false)
  }, [messageId])

  // We'll receive poll data from parent instead of fetching ourselves
  // This avoids N+1 queries — parent fetches all polls for visible messages
  if (loading) {
    return <div className="text-white/30 text-xs py-2">Loading poll...</div>
  }

  if (!poll) {
    return <div className="text-white/30 text-xs py-2">Poll data unavailable</div>
  }

  const isClosed = !!(poll.closed_at && poll.closed_at > 0)
  const hasVoted = poll.my_vote !== null && poll.my_vote !== undefined
  const showResults = hasVoted || isClosed
  const isCreator = poll.created_by === currentUserId

  const handleVote = async (optionIndex: number) => {
    if (voting || isClosed) return
    setVoting(true)
    setError('')
    try {
      const result = await votePoll(poll.id, optionIndex, auth)
      setPoll(prev => prev ? {
        ...prev,
        my_vote: result.my_vote,
        votes: result.votes,
        total_votes: result.total_votes,
      } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed')
    } finally {
      setVoting(false)
    }
  }

  const handleClose = async () => {
    try {
      await closePoll(poll.id, auth)
      setPoll(prev => prev ? { ...prev, closed_at: Date.now() } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Close failed')
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-1 max-w-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-white font-medium text-sm">{poll.question}</span>
        {isClosed && (
          <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
            Closed
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {poll.options.map((option, i) => {
          const count = poll.votes[i] || 0
          const pct = poll.total_votes > 0 ? Math.round((count / poll.total_votes) * 100) : 0
          const isMyVote = poll.my_vote === i

          if (showResults) {
            return (
              <div key={i} className="relative">
                <div
                  className={`absolute inset-0 rounded-lg ${isMyVote ? 'bg-sky-500/20' : 'bg-white/5'}`}
                  style={{ width: `${pct}%` }}
                />
                <div className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg ${isMyVote ? 'border border-sky-400/30' : ''}`}>
                  <span className={`text-sm ${isMyVote ? 'text-sky-300 font-medium' : 'text-white/70'}`}>
                    {isMyVote && <span className="mr-1">&#10003;</span>}
                    {option}
                  </span>
                  <span className="text-xs text-white/40 ml-2">{pct}%</span>
                </div>
              </div>
            )
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleVote(i)}
              disabled={voting}
              className="w-full text-left px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white/80 hover:bg-sky-600/20 hover:border-sky-400/30 hover:text-white transition-colors disabled:opacity-50"
            >
              {option}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-white/30">
        <span>{poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}</span>
        {isCreator && !isClosed && (
          <button
            type="button"
            onClick={handleClose}
            className="text-white/30 hover:text-rose-400 transition-colors"
          >
            Close poll
          </button>
        )}
      </div>

      {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}
    </div>
  )
}

// Standalone version that fetches its own data given a poll ID
export function PollCardWithFetch({ pollId, auth, currentUserId }: { pollId: string; auth: AuthParams; currentUserId: string }) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPoll(pollId, auth)
      .then(setPoll)
      .catch(() => setError('Failed to load poll'))
      .finally(() => setLoading(false))
  }, [pollId, auth])

  if (loading) {
    return <div className="text-white/30 text-xs py-2">Loading poll...</div>
  }
  if (!poll) {
    return <div className="text-white/30 text-xs py-2">{error || 'Poll not found'}</div>
  }

  const isClosed = !!(poll.closed_at && poll.closed_at > 0)
  const hasVoted = poll.my_vote !== null && poll.my_vote !== undefined
  const showResults = hasVoted || isClosed
  const isCreator = poll.created_by === currentUserId

  const handleVote = async (optionIndex: number) => {
    if (voting || isClosed) return
    setVoting(true)
    setError('')
    try {
      const result = await votePoll(pollId, optionIndex, auth)
      setPoll(prev => prev ? {
        ...prev,
        my_vote: result.my_vote,
        votes: result.votes,
        total_votes: result.total_votes,
      } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed')
    } finally {
      setVoting(false)
    }
  }

  const handleClose = async () => {
    try {
      await closePoll(pollId, auth)
      setPoll(prev => prev ? { ...prev, closed_at: Date.now() } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Close failed')
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-1 max-w-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-white font-medium text-sm">{poll.question}</span>
        {isClosed && (
          <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
            Closed
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {poll.options.map((option, i) => {
          const count = poll.votes[i] || 0
          const pct = poll.total_votes > 0 ? Math.round((count / poll.total_votes) * 100) : 0
          const isMyVote = poll.my_vote === i

          if (showResults) {
            return (
              <div key={i} className="relative">
                <div
                  className={`absolute inset-0 rounded-lg ${isMyVote ? 'bg-sky-500/20' : 'bg-white/5'}`}
                  style={{ width: `${pct}%` }}
                />
                <div className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg ${isMyVote ? 'border border-sky-400/30' : ''}`}>
                  <span className={`text-sm ${isMyVote ? 'text-sky-300 font-medium' : 'text-white/70'}`}>
                    {isMyVote && <span className="mr-1">&#10003;</span>}
                    {option}
                  </span>
                  <span className="text-xs text-white/40 ml-2">{pct}%</span>
                </div>
              </div>
            )
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleVote(i)}
              disabled={voting}
              className="w-full text-left px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white/80 hover:bg-sky-600/20 hover:border-sky-400/30 hover:text-white transition-colors disabled:opacity-50"
            >
              {option}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-white/30">
        <span>{poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}</span>
        {isCreator && !isClosed && (
          <button
            type="button"
            onClick={handleClose}
            className="text-white/30 hover:text-rose-400 transition-colors"
          >
            Close poll
          </button>
        )}
      </div>

      {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}
    </div>
  )
}
