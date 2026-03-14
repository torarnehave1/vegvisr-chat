import { useRegisterSW } from 'virtual:pwa-register/react';

interface Props {
  onWhatsNew?: () => void
}

export function UpdateBanner({ onWhatsNew }: Props) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => registration.update(), 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-sky-400/30 bg-slate-900/95 px-5 py-3 shadow-xl shadow-sky-500/10 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm text-white/80">
        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
        New update available
      </div>
      {onWhatsNew && (
        <button
          onClick={onWhatsNew}
          className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          What's new?
        </button>
      )}
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-400 transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
