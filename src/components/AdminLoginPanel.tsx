import { useState, type FormEvent } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

interface AdminLoginPanelProps {
  onSuccess: (adminName: string) => void;
}

export function AdminLoginPanel({ onSuccess }: AdminLoginPanelProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid administrator credentials.');
        return;
      }
      onSuccess(data.admin?.name || 'Shaik Kousar Bhanu');
    } catch {
      setError('Network error while verifying administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-5 bg-[#0F172A] p-6 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-amber-300">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide">SVCET Admin Access</span>
            </div>
            <h2 className="mt-3 text-xl font-bold leading-snug text-balance">
              Library Administrator Console
            </h2>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
              Sign in with authorized SVCET Chittoor Library Administrator credentials to manage textbook inventory, issue and return circulation, student records, and live SQL queries.
            </p>
          </div>

          <div className="mt-8 border-t border-white/10 pt-4 text-xs text-slate-400">
            Protected Role · SQLite Atomic Transactions
          </div>
        </div>

        <div className="md:col-span-7 p-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A8A]/10 text-[#1E3A8A]">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Admin Sign In</h3>
              <p className="text-xs text-slate-500">Enter administrator name and password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-name-input" className="block text-xs font-medium text-slate-700">
                Admin Name
              </label>
              <input
                id="admin-name-input"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin name"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            <div>
              <label htmlFor="admin-password-input" className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <input
                id="admin-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#172554] disabled:opacity-60"
            >
              {loading ? 'Verifying Credentials...' : 'Sign In to Admin Portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
