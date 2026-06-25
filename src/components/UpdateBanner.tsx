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
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 border-b border-sky-400/30 bg-white/95 dark:bg-slate-900/95 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/80">
        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
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
          className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          What's new?
        </button>
      )}
      {isCodeUpdate && (
        <button
          type="button"
          onClick={reload}
          className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-900 dark:text-white hover:bg-sky-400 transition-colors"
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
        className="ml-1 p-1 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/80 transition-colors"
        title="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
