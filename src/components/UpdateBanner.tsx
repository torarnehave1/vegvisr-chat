import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useVersionCheck } from '../hooks/useVersionCheck';

interface Props {
  onWhatsNew?: () => void
  hasNewFeatures?: boolean
  newFeatureCount?: number
  onMarkFeaturesSeen?: () => void
}

export function UpdateBanner({ onWhatsNew, hasNewFeatures, newFeatureCount, onMarkFeaturesSeen }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const { updateAvailable, reload } = useVersionCheck()

  const {
    needRefresh: [swNeedsRefresh],
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 1000);
      }
    },
  });

  const isCodeUpdate = updateAvailable || swNeedsRefresh
  const isContentOnly = !isCodeUpdate && hasNewFeatures

  if (dismissed || (!isCodeUpdate && !isContentOnly)) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 border-b border-brand/30 bg-white/95 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
        {isCodeUpdate
          ? 'New update available'
          : `${newFeatureCount || ''} new feature${newFeatureCount === 1 ? '' : 's'} added`.trim()
        }
      </div>
      {onWhatsNew && (
        <button
          type="button"
          onClick={() => {
            // Mark features as seen immediately so the banner doesn't reappear
            // on refresh if the user never clicks Back inside the WhatsNew page.
            if (isContentOnly && onMarkFeaturesSeen) onMarkFeaturesSeen();
            setDismissed(true);
            onWhatsNew();
          }}
          className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-ink-soft hover:text-ink hover:bg-surface-sunk transition-colors"
        >
          What's new?
        </button>
      )}
      {isCodeUpdate && (
        <button
          type="button"
          onClick={reload}
          className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-ink hover:bg-brand transition-colors"
        >
          Refresh
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          // Explicit dismissal: also persist the seen count so the banner doesn't
          // come back on the next reload for these same feature entries.
          if (isContentOnly && onMarkFeaturesSeen) onMarkFeaturesSeen();
          setDismissed(true);
        }}
        className="ml-1 p-1 text-ink-faint hover:text-ink transition-colors"
        title="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
