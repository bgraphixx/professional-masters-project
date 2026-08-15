import { useState } from 'react';
import { Mail, Lock, User as UserIcon, Wallet, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiPost, apiErrorDetail } from '../api';
import type { UserProfile } from '../types';

function errorMessageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [view, setView] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!consentGiven) {
      setErrorMessage('You must give consent to register.');
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await apiPost<UserProfile>('/auth/register', {
        email,
        password,
        full_name: fullName,
        monthly_income: parseFloat(monthlyIncome) || 0,
        consent_given: consentGiven,
      });
      if (!ok) throw new Error(apiErrorDetail(data, 'Registration failed'));

      setSuccessMessage('Registration successful!');
      setTimeout(() => onAuthenticated(data), 1000);
    } catch (err) {
      setErrorMessage(errorMessageOf(err, 'An error occurred during registration.'));
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { ok, data } = await apiPost<UserProfile>('/auth/login', { email, password });
      if (!ok) throw new Error(apiErrorDetail(data, 'Login failed'));

      setSuccessMessage('Logged in successfully!');
      setTimeout(() => onAuthenticated(data), 1000);
    } catch (err) {
      setErrorMessage(errorMessageOf(err, 'Incorrect email or password.'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-6 text-on-background relative font-sans">
      {/* Header Logo */}
      <div className="w-full max-w-[1000px] flex justify-between items-center mb-8 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center shadow-[0_4px_10px_rgba(0,106,57,0.15)]">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="font-sans font-bold text-xl tracking-tight text-on-background">
            Naira<span className="text-primary">AI</span>
          </span>
        </div>
      </div>

      <div className="w-full max-w-[420px] my-auto transition-all">
        <div className="bg-surface-lowest border border-outline-variant rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.02)] p-8 transition-shadow duration-300 hover:shadow-[0_8px_25px_rgba(0,0,0,0.05)]">
          <div className="text-left mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-on-background">
              {view === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {view === 'login' ? 'Access your personal budgeting dashboard.' : 'Start tracking income and expenses with AI.'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-4 rounded-default bg-error-container/10 border border-error text-error text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-sans font-medium">{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="mb-5 p-4 rounded-default bg-primary-container/10 border border-primary-container text-primary text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-sans font-medium">{successMessage}</span>
            </div>
          )}

          <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {view === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Babajide Alao"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 pl-10 pr-4 text-on-background text-sm outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Monthly Income (₦)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-sans font-semibold text-sm">
                      ₦
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 450000"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 pl-10 pr-4 text-on-background text-sm outline-none transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="e.g. jide@naira.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 pl-10 pr-4 text-on-background text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 pl-10 pr-4 text-on-background text-sm outline-none transition-all"
                />
              </div>
            </div>

            {view === 'register' && (
              <div className="p-4 rounded-default bg-surface-low border border-outline-variant/60 space-y-3">
                <div className="flex gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-on-background">Data Consent</h4>
                    <p className="text-[11px] leading-relaxed text-slate-600 mt-1">
                      We analyze your transaction history to automatically categorize expenses and generate custom budget recommendations. You can view or delete your history at any time.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="rounded border-outline-variant text-primary focus:ring-primary/20 bg-surface-lowest w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium text-primary hover:text-primary-container select-none">
                    I consent to analyzing my transactions for budgeting insights
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-[#00522b] text-white font-bold text-sm rounded-default cursor-pointer active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-2 shadow-[0_2px_5px_rgba(0,106,57,0.1)]"
            >
              {loading ? (
                <span className="border-2 border-white border-t-transparent w-4 h-4 rounded-full animate-spin" />
              ) : view === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-slate-500">
            {view === 'login' ? (
              <span>
                New to NairaAI?{' '}
                <button
                  onClick={() => setView('register')}
                  className="text-primary hover:text-[#00522b] font-bold transition-colors cursor-pointer"
                >
                  Register
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button
                  onClick={() => setView('login')}
                  className="text-primary hover:text-[#00522b] font-bold transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
