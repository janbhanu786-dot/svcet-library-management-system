import { useState, type FormEvent } from 'react';
import { GraduationCap, LogIn, UserPlus } from 'lucide-react';
import type { Department, Student } from '../types/library';

const DEPARTMENTS: Department[] = ['CSE', 'AI & DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'MBA'];
const YEAR_OPTIONS = [
  'I B.Tech · Sem 1',
  'I B.Tech · Sem 2',
  'II B.Tech · Sem 1',
  'II B.Tech · Sem 2',
  'III B.Tech · Sem 1',
  'III B.Tech · Sem 2',
  'IV B.Tech · Sem 1',
  'IV B.Tech · Sem 2',
  'I MBA · Sem 2',
  'II MBA · Sem 2',
];

interface StudentAuthPanelProps {
  onAuthenticated: (student: Student) => void;
  initialMode?: 'login' | 'signup';
  onBrowseBooks?: () => void;
}

export function StudentAuthPanel({
  onAuthenticated,
  initialMode = 'login',
  onBrowseBooks,
}: StudentAuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign up fields
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState<Department>('CSE');
  const [yearSem, setYearSem] = useState(YEAR_OPTIONS[3]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to sign in.');
        return;
      }
      onAuthenticated(data.student as Student);
    } catch {
      setError('Network error while connecting to SVCET College Library.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/student/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          roll_no: rollNo,
          department,
          year_sem: yearSem,
          email,
          phone,
          password: signupPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to create student account.');
        return;
      }
      onAuthenticated(data.student as Student);
    } catch {
      setError('Network error while creating student account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-12">
        {/* Left Informational Column */}
        <div className="md:col-span-5 bg-[#0F172A] p-6 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-amber-300">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide">SVCET Student Portal</span>
            </div>
            <h2 className="mt-3 text-xl font-bold leading-snug text-balance">
              Student Library Access & Book Reservations
            </h2>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
              Create your SVCET student library account using your Roll Number and college email to reserve available textbooks, track due dates, and check fines.
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-white/10 pt-5 text-xs text-slate-300">
            <div>
              <span className="font-semibold text-white">Borrowing Limit:</span> Up to 4 textbooks per semester
            </div>
            <div>
              <span className="font-semibold text-white">Loan Period:</span> 14 days standard circulation
            </div>
            {onBrowseBooks && (
              <button
                type="button"
                onClick={onBrowseBooks}
                className="mt-2 inline-flex items-center text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-4"
              >
                Browse Available Books Catalog first
              </button>
            )}
          </div>
        </div>

        {/* Right Auth Form Column */}
        <div className="md:col-span-7 p-6">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Student Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Student Sign Up
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div>
                <label htmlFor="stu-login-id" className="block text-xs font-medium text-slate-700">
                  Roll Number or College Email
                </label>
                <input
                  id="stu-login-id"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g., 23781A0501 or rollno@svcet.edu.in"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div>
                <label htmlFor="stu-login-pass" className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="stu-login-pass"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#172554] disabled:opacity-60"
              >
                {loading ? 'Signing In...' : 'Sign In as Student'}
              </button>

              <p className="text-xs text-slate-500">
                New to SVCET College Library?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className="font-medium text-[#1E3A8A] hover:underline"
                >
                  Create your student account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="stu-name" className="block text-xs font-medium text-slate-700">
                  Student Full Name
                </label>
                <input
                  id="stu-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div>
                <label htmlFor="stu-roll" className="block text-xs font-medium text-slate-700">
                  Roll Number
                </label>
                <input
                  id="stu-roll"
                  type="text"
                  required
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="23781A0501"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div>
                <label htmlFor="stu-phone" className="block text-xs font-medium text-slate-700">
                  Phone Number
                </label>
                <input
                  id="stu-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div>
                <label htmlFor="stu-dept" className="block text-xs font-medium text-slate-700">
                  Department
                </label>
                <select
                  id="stu-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="stu-year" className="block text-xs font-medium text-slate-700">
                  Year & Semester
                </label>
                <select
                  id="stu-year"
                  value={yearSem}
                  onChange={(e) => setYearSem(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                >
                  {YEAR_OPTIONS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="stu-email" className="block text-xs font-medium text-slate-700">
                  Student Email
                </label>
                <input
                  id="stu-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@svcet.edu.in"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div>
                <label htmlFor="stu-pass" className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="stu-pass"
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div>
                <label htmlFor="stu-confirm" className="block text-xs font-medium text-slate-700">
                  Confirm Password
                </label>
                <input
                  id="stu-confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div className="sm:col-span-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#172554] disabled:opacity-60"
                >
                  {loading ? 'Creating Account...' : 'Sign Up & Enter Student Portal'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
