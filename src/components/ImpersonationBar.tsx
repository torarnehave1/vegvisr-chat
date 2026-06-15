import { useEffect, useState } from 'react';
import { readStoredUser } from '../lib/auth';

const API = 'https://api.vegvisr.org/realtime';
// localStorage key holding the System Owner's REAL login while impersonating.
const BACKUP_KEY = 'originalUser';

type AdminUser = {
  email: string;
  userId: string;
  role: string | null;
  displayName: string | null;
  isSystemOwner: boolean;
};

/**
 * System Owner "Login as…" control.
 *
 * Backend gates both endpoints on `auth.isSystemOwner`, so a non-owner who
 * somehow renders this gets 403 and the component renders nothing.
 *
 * Impersonating swaps `localStorage['user']` for the target's auth payload
 * and stashes the owner's real login in `localStorage['originalUser']` so
 * it can be restored with one click.
 */
export default function ImpersonationBar() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stored = readStoredUser();
  const token = stored?.emailVerificationToken || '';
  const impersonating =
    typeof window !== 'undefined' && !!window.localStorage.getItem(BACKUP_KEY);

  // Only probe the user list when we are NOT already impersonating and hold a
  // token. A 403 (not a System Owner) leaves `users` null → renders nothing.
  useEffect(() => {
    if (impersonating || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/admin/users`, { headers: { 'X-API-Token': token } });
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && data.success) setUsers(data.users || []);
      } catch {
        /* not a System Owner / network — render nothing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, impersonating]);

  const impersonate = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/admin/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
        body: JSON.stringify({ email: selected }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        setError(data.error || `Impersonation failed (${r.status})`);
        setBusy(false);
        return;
      }
      // Preserve the TRUE original login; never overwrite an existing backup.
      if (!window.localStorage.getItem(BACKUP_KEY)) {
        window.localStorage.setItem(BACKUP_KEY, window.localStorage.getItem('user') || '');
      }
      window.localStorage.setItem('user', JSON.stringify(data.user));
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Network error');
      setBusy(false);
    }
  };

  const stop = () => {
    const orig = window.localStorage.getItem(BACKUP_KEY);
    if (orig) window.localStorage.setItem('user', orig);
    window.localStorage.removeItem(BACKUP_KEY);
    window.location.reload();
  };

  // Impersonating → prominent banner with one-click return.
  if (impersonating) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-sm text-amber-100">
        <span className="truncate">
          👁 Viewing as <b>{stored?.email}</b>
          {stored?.role ? ` (${stored.role})` : ''} — impersonated by System Owner
        </span>
        <button
          className="shrink-0 rounded-xl bg-amber-700 hover:bg-amber-800 px-3 py-1 text-xs font-semibold whitespace-nowrap"
          onClick={stop}
        >
          ↩ Return to my account
        </button>
      </div>
    );
  }

  // Not a System Owner (or no users) → render nothing.
  if (!users || users.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
      <label htmlFor="impersonate-user" className="text-xs uppercase tracking-[0.2em] text-white/60 whitespace-nowrap">
        🔑 Login as
      </label>
      <select
        id="impersonate-user"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 min-w-0 max-w-full sm:max-w-xs rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/60"
      >
        <option value="">Select a user…</option>
        {users
          .filter((u) => u.email !== stored?.email)
          .map((u) => (
            <option key={u.email} value={u.email}>
              {u.email} ({u.role || 'no role'})
              {u.isSystemOwner ? ' ★' : ''}
            </option>
          ))}
      </select>
      <button
        className="rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        disabled={!selected || busy}
        onClick={impersonate}
      >
        {busy ? 'Switching…' : 'Go'}
      </button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
