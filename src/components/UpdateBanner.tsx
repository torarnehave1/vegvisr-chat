import { useRegisterSW } from 'virtual:pwa-register/react';
import { useVersionCheck } from '../hooks/useVersionCheck';

interface Props {
  onWhatsNew?: () => void
  hasNewFeatures?: boolean
  newFeatureCount?: number
}

/**
 * Shows a banner when a new version is deployed OR new features are added.
 *
 * Three independent triggers:
 * 1. **version.json polling** — detects code deploys (buildHash change)
 * 2. **Service Worker prompt** — for PWA-installed users
 * 3. **hasNewFeatures prop** — detects new What's New entries (agent or manual)
 *
 * Code deploy → "New update available" + Refresh button
 * Content update only → "New features added" + What's new? button (no refresh needed)
 */
export function UpdateBanner({ onWhatsNew, hasNewFeatures, newFeatureCount }: Props) {
  // Primary: version.json polling (reliable, CDN-proof)
  const { updateAvailable, reload } = useVersionCheck()

  // Secondary: SW prompt (for PWA-installed users)
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

  if (!isCodeUpdate && !isContentOnly) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-sky-400/30 bg-slate-900/95 px-5 py-3 shadow-xl shadow-sky-500/10 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm text-white/80">
        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
        {isCodeUpdate
          ? 'New update available'
          : `${newFeatureCount || ''} new feature${newFeatureCount === 1 ? '' : 's'} added`.trim()
        }
      </div>
      {onWhatsNew && (
        <button
          onClick={onWhatsNew}
          className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          What's new?
        </button>
      )}
      {isCodeUpdate && (
        <button
          onClick={reload}
          className="rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-400 transition-colors"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
