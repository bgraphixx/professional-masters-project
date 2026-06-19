import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Wallet, 
  ShieldCheck, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  PieChart, 
  Sparkles,
  Info
} from 'lucide-react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  monthly_income: number;
  consent_given: boolean;
  consent_date: string | null;
  created_at: string;
}

function App() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  
  // Common states
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [systemStatus, setSystemStatus] = useState<'connected' | 'checking' | 'failed'>('checking');

  // Verify backend health and check if user is already logged in on mount
  useEffect(() => {
    checkBackendHealth();
    checkCurrentUser();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/`);
      if (res.ok) {
        setSystemStatus('connected');
      } else {
        setSystemStatus('failed');
      }
    } catch {
      setSystemStatus('failed');
    }
  };

  const checkCurrentUser = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setView('dashboard');
      }
    } catch (err) {
      console.log('No current session:', err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!consentGiven) {
      setErrorMessage('You must give consent under the NDPA (2023) to register.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          monthly_income: parseFloat(monthlyIncome) || 0,
          consent_given: consentGiven
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      setUser(data);
      setSuccessMessage('Registration successful!');
      setTimeout(() => {
        setView('dashboard');
        setSuccessMessage('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      setUser(data);
      setSuccessMessage('Logged in successfully!');
      setTimeout(() => {
        setView('dashboard');
        setSuccessMessage('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setEmail('');
      setPassword('');
      setFullName('');
      setMonthlyIncome('');
      setConsentGiven(false);
      setView('login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#090d1a] flex flex-col items-center justify-center p-4">
      {/* Premium Background Blurry Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-teal-500/10 rounded-full blur-[120px]" />

      {/* Header / Brand */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Wallet className="w-5 h-5 text-[#090d1a]" />
        </div>
        <span className="font-heading font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          NairaFlow<span className="text-emerald-500">.ai</span>
        </span>
      </div>

      {/* Connection Status indicator */}
      <div className="absolute top-6 right-6 flex items-center gap-2 text-xs bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-full backdrop-blur-md">
        <span className={`w-2.5 h-2.5 rounded-full ${
          systemStatus === 'connected' ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : 
          systemStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 shadow-md shadow-red-500/50'
        }`} />
        <span className="text-slate-400">
          Backend: {systemStatus === 'connected' ? 'Connected' : systemStatus === 'checking' ? 'Checking status...' : 'Disconnected'}
        </span>
      </div>

      {/* Login & Register Views */}
      {view !== 'dashboard' && (
        <div className="w-full max-w-md mt-16 mb-8 z-10">
          {/* Main Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-2xl p-8 backdrop-blur-xl transition-all duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-heading font-extrabold bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
                {view === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                {view === 'login' ? 'Manage your personal finances with AI' : 'Start your journey to smarter budgeting'}
              </p>
            </div>

            {/* Error and Success Banners */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5 animate-fadeIn">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-5">
              {view === 'register' && (
                <>
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Chidi Kafunze"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Monthly Income */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Income (₦)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-medium text-sm">
                        ₦
                      </div>
                      <input
                        type="number"
                        required
                        placeholder="350000"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="chidi@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              {/* NDPA Consent (Register only) */}
              {view === 'register' && (
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-3">
                  <div className="flex gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">NDPA (2023) Compliance Consent</h4>
                      <p className="text-[11px] leading-relaxed text-slate-400 mt-1">
                        To categorize your transactions and generate AI-powered budgeting suggestions, we securely process transaction data. You have rights to data deletion and access under Nigeria Data Protection Act regulations.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500/20 bg-slate-950 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 select-none">
                      I authorize transaction processing for AI budgeting
                    </span>
                  </label>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-[#090d1a] font-bold text-sm rounded-xl cursor-pointer hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <span className="border-2 border-[#090d1a] border-t-transparent w-4 h-4 rounded-full animate-spin" />
                ) : view === 'login' ? (
                  'Login to Workspace'
                ) : (
                  'Create My Account'
                )}
              </button>
            </form>

            {/* View switcher */}
            <div className="text-center mt-6 text-sm text-slate-400">
              {view === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button 
                    onClick={() => setView('register')} 
                    className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
                  >
                    Register
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button 
                    onClick={() => setView('login')} 
                    className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
                  >
                    Log In
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard View */}
      {view === 'dashboard' && user && (
        <div className="w-full max-w-4xl mt-20 mb-8 z-10 space-y-6 animate-fadeIn">
          {/* Top Panel card */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account Owner</p>
              <h2 className="text-2xl font-heading font-extrabold text-white">{user.full_name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
            </div>
            
            <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                ₦
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Monthly Budget Income</p>
                <h3 className="text-lg font-heading font-extrabold text-white">{formatNaira(user.monthly_income)}</h3>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-2 transition-colors self-end md:self-auto"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>

          {/* Grid Area */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: Verification status */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-4">
              <h3 className="text-sm font-heading font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>NDPA Consent Status</span>
              </h3>
              
              <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorized</span>
                </div>
                
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Data processing consent was successfully captured and timestamped.
                </p>

                <div className="border-t border-slate-800/80 pt-2.5 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Consent Active:</span>
                    <span className="text-slate-300 font-semibold">{user.consent_given ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Timestamp:</span>
                    <span className="text-slate-300 font-semibold max-w-[140px] truncate">
                      {user.consent_date ? new Date(user.consent_date).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Dashboard Overview Placeholder */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-4 md:col-span-2">
              <h3 className="text-sm font-heading font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Initial Workspace Seeded</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Baseline Categorization</span>
                    <PieChart className="w-4 h-4 text-teal-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Default categories seeded and Logistic Regression ML model successfully initialized in backend context.
                  </p>
                </div>

                <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">AI Recommendations</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Dynamic recommendations module configured to analyze overspending thresholds (80% and 100%).
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-emerald-400 font-bold">Sprint 1 Complete:</strong> Authentication, User Management, database schemas, and baseline ML models have been scaffolded and are online. Ready to deploy backend database migrations.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Footer copyright */}
      <span className="text-[10px] text-slate-600 mt-8 mb-4">
        © 2026 NairaFlow.ai. Complying with Nigeria Data Protection Commission (NDPC) guidelines.
      </span>
    </div>
  );
}

export default App;
