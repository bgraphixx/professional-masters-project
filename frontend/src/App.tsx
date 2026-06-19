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
  Info,
  Plus,
  Upload,
  Trash2,
  Filter,
  FileSpreadsheet,
  X
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

interface Category {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
}

interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  transaction_date: string;
  description: string;
  type: string;
  source: string;
  confidence_score: number;
  is_flagged: boolean;
  category: Category | null;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [systemStatus, setSystemStatus] = useState<'connected' | 'checking' | 'failed'>('checking');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Manual Transaction Form state
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txCategoryId, setTxCategoryId] = useState('');

  // Filters state
  const [filterType, setFilterType] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  // CSV statement import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importSummary, setImportSummary] = useState('');

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

  // Fetch transactions and categories when logged in
  useEffect(() => {
    if (view === 'dashboard') {
      fetchTransactions();
      fetchCategories();
    }
  }, [view, filterType, filterCategoryId]);

  const fetchTransactions = async () => {
    try {
      let url = `${API_URL}/transactions`;
      const queryParams = new URLSearchParams();
      if (filterType) queryParams.append('type', filterType);
      if (filterCategoryId) queryParams.append('category_id', filterCategoryId);
      
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/transactions/categories`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

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
      setTransactions([]);
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

  // Transactions operations
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        description: txDesc,
        amount: parseFloat(txAmount),
        type: txType,
        transaction_date: txDate,
        source: 'manual'
      };
      if (txCategoryId) {
        payload.category_id = txCategoryId;
      }

      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error adding transaction');
      }

      // Reset form & close modal
      setTxDesc('');
      setTxAmount('');
      setTxType('expense');
      setTxDate(new Date().toISOString().split('T')[0]);
      setTxCategoryId('');
      setIsAddModalOpen(false);
      
      fetchTransactions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (txId: string, categoryId: string) => {
    try {
      const res = await fetch(`${API_URL}/transactions/${txId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category_id: categoryId || null })
      });
      if (res.ok) {
        fetchTransactions();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to update category');
      }
    } catch (err) {
      console.error('Error updating category:', err);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await fetch(`${API_URL}/transactions/${txId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        fetchTransactions();
      }
    } catch (err) {
      console.error('Error deleting transaction:', err);
    }
  };

  // CSV Drag and drop imports
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setCsvFile(file);
      } else {
        alert('Please drop a valid CSV statement file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setLoading(true);
    setImportSummary('');
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await fetch(`${API_URL}/transactions/import-csv`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'CSV importing failed');
      }

      setImportSummary(data.message);
      setCsvFile(null);
      fetchTransactions();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSummary('');
      }, 2500);
    } catch (err: any) {
      alert(err.message);
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-6 text-on-background relative">
      {/* Header Logo */}
      <div className="w-full max-w-[1000px] flex justify-between items-center mb-10 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center shadow-[0_4px_10px_rgba(0,106,57,0.15)]">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="font-sans font-bold text-xl tracking-tight text-on-background">
            Naira<span className="text-primary">AI</span>
          </span>
        </div>

        {/* Sync Status indicator */}
        <div className="flex items-center gap-2 text-xs bg-surface-lowest border border-outline-variant px-3.5 py-1.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
          <span className={`w-2 h-2 rounded-full ${
            systemStatus === 'connected' ? 'bg-primary' : 
            systemStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-error'
          }`} />
          <span className="font-mono text-label-sm text-slate-500 uppercase">
            STATUS: {systemStatus === 'connected' ? 'ONLINE' : systemStatus === 'checking' ? 'SYNCING' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Auth Forms */}
      {view !== 'dashboard' && (
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

            {/* Error and Success banners */}
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
      )}

      {/* Authed Dashboard Layout */}
      {view === 'dashboard' && user && (
        <div className="w-full max-w-[1000px] z-10 space-y-6">
          
          {/* Header Panel card */}
          <div className="bg-surface-lowest border border-outline-variant rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="font-mono text-label-sm uppercase tracking-wider text-slate-500">Account Owner</p>
              <h2 className="text-2xl font-bold tracking-tight text-on-background mt-0.5">{user.full_name}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
            </div>
            
            <div className="bg-surface-low border border-outline-variant/60 p-4 rounded-default flex items-center gap-3">
              <div className="w-10 h-10 rounded-default bg-primary-container/20 flex items-center justify-center text-primary font-bold text-lg">
                ₦
              </div>
              <div>
                <p className="font-mono text-label-sm uppercase tracking-wider text-slate-500">Monthly Budget Income</p>
                <h3 className="text-2xl font-medium tracking-tight text-on-background font-sans mt-0.5">{formatNaira(user.monthly_income)}</h3>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="bg-surface-lowest hover:bg-slate-50 border border-outline-variant text-slate-700 hover:text-slate-900 px-4 py-2.5 rounded-default font-bold text-xs cursor-pointer flex items-center gap-2 transition-colors self-end sm:self-auto"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Consent Status Card */}
            <div className="bg-surface-lowest border border-outline-variant rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Data Consent Status</span>
              </h3>
              
              <div className="space-y-3 bg-surface-low p-4 rounded-default border border-outline-variant/50">
                <div className="inline-flex items-center gap-1.5 bg-[#e2f9ec] text-[#006a39] text-xs font-bold px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Consent Active</span>
                </div>
                
                <p className="text-[11px] leading-relaxed text-slate-600">
                  You have granted permission to analyze your transaction history to provide customized budgeting insights.
                </p>

                <div className="border-t border-outline-variant/40 pt-2.5 space-y-1.5 font-mono text-label-sm text-slate-500">
                  <div className="flex justify-between">
                    <span>Consent Status:</span>
                    <span className="text-slate-800 font-semibold">{user.consent_given ? 'ACTIVE' : 'INACTIVE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Updated:</span>
                    <span className="text-slate-800 font-semibold max-w-[120px] truncate">
                      {user.consent_date ? new Date(user.consent_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Core Status Card */}
            <div className="bg-surface-lowest border border-outline-variant rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4 md:col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Infrastructure & ML Service</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface-low border border-outline-variant/50 p-4 rounded-default space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Classification Model</span>
                    <PieChart className="w-4 h-4 text-secondary" />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Automated transaction categorisation classifier active (TF-IDF + Logistic Regression).
                  </p>
                </div>

                <div className="bg-surface-low border border-outline-variant/50 p-4 rounded-default space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Categorisation Fallbacks</span>
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Fallback rule-based keyword triggers configured for low-confidence models (below 60%).
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-default bg-primary-container/10 border border-primary-container/20 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-primary font-bold">Sprint 2 Online:</strong> Add manual inputs, edit predicted categories directly in the rows, or drag and drop bank statement CSV files to trigger the batch auto-categorization pipeline.
                </p>
              </div>
            </div>
          </div>

          {/* Transactions Workspace */}
          <div className="bg-surface-lowest border border-outline-variant rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-6">
            
            {/* Toolbar Panel */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-surface-container pb-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-on-background">Transaction Management</h3>
                <p className="text-xs text-slate-500">Track and review automated classifications.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Type Filter */}
                <div className="relative">
                  <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-surface-lowest border border-outline-variant text-slate-700 text-xs rounded-default py-2 pl-3 pr-8 outline-none appearance-none cursor-pointer focus:border-secondary"
                  >
                    <option value="">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                  <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>

                {/* Category Filter */}
                <div className="relative">
                  <select 
                    value={filterCategoryId} 
                    onChange={(e) => setFilterCategoryId(e.target.value)}
                    className="bg-surface-lowest border border-outline-variant text-slate-700 text-xs rounded-default py-2 pl-3 pr-8 outline-none appearance-none cursor-pointer focus:border-secondary"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>

                {/* Add Transaction Button */}
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-primary hover:bg-[#00522b] text-white px-3.5 py-2 rounded-default text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-[0_2px_4px_rgba(0,106,57,0.1)] ml-auto md:ml-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Manual</span>
                </button>

                {/* Import Statement Button */}
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-surface-lowest hover:bg-slate-50 border border-outline-variant text-slate-700 px-3.5 py-2 rounded-default text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Import Statement</span>
                </button>
              </div>
            </div>

            {/* Transactions Flat List Table */}
            <div className="overflow-x-auto">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">No transactions found.</p>
                  <p className="text-xs">Click "Add Manual" or "Import Statement" to seed details.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Description</th>
                      <th className="pb-3 font-semibold">Source</th>
                      <th className="pb-3 font-semibold">Category (ML Classification)</th>
                      <th className="pb-3 font-semibold text-right">Amount</th>
                      <th className="pb-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-surface-container/60 hover:bg-slate-50/40 transition-colors">
                        {/* Date */}
                        <td className="py-4 text-sm font-mono text-slate-600">
                          {tx.transaction_date}
                        </td>

                        {/* Description */}
                        <td className="py-4 text-sm font-medium text-on-background max-w-[240px] truncate">
                          {tx.description}
                        </td>

                        {/* Source */}
                        <td className="py-4">
                          <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                            tx.source === 'csv' 
                              ? 'bg-secondary-container/10 text-secondary border border-secondary/10' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {tx.source}
                          </span>
                        </td>

                        {/* Category Dropdown & Warnings */}
                        <td className="py-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <select
                              value={tx.category_id || ''}
                              onChange={(e) => handleUpdateCategory(tx.id, e.target.value)}
                              className="bg-transparent hover:bg-surface-low border border-transparent hover:border-outline-variant text-xs text-slate-800 font-semibold rounded py-1 px-1.5 outline-none transition-all cursor-pointer focus:bg-surface-lowest focus:border-secondary"
                            >
                              <option value="">Uncategorised</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>

                            {/* Low Confidence Warning Icon */}
                            {tx.is_flagged && (
                              <div className="group relative">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 leading-relaxed font-sans">
                                  Low Confidence prediction ({(tx.confidence_score * 100).toFixed(0)}%). Review category.
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className={`py-4 text-right font-mono font-medium text-sm ${
                          tx.type === 'income' ? 'text-primary' : 'text-slate-800'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'}{formatNaira(tx.amount)}
                        </td>

                        {/* Delete action */}
                        <td className="py-4 text-center">
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="text-slate-400 hover:text-error p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Add Manual Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-lowest border border-outline-variant rounded-lg max-w-md w-full p-6 shadow-xl animate-fadeIn relative">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-on-background mb-4">Add Manual Transaction</h3>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              {/* Description */}
              <div className="space-y-1">
                <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bus fare to Ikeja"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all"
                />
              </div>

              {/* Amount & Type Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Amount (₦)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="2500"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Type</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all cursor-pointer"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              {/* Date & Pre-selected Category Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Date</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Override Category</label>
                  <select
                    value={txCategoryId}
                    onChange={(e) => setTxCategoryId(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all cursor-pointer"
                  >
                    <option value="">Auto-categorize (ML)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary hover:bg-[#00522b] text-white font-bold text-sm rounded-default cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-[0_2px_4px_rgba(0,106,57,0.1)]"
              >
                {loading ? (
                  <span className="border-2 border-white border-t-transparent w-4 h-4 rounded-full animate-spin" />
                ) : (
                  'Create Transaction'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-lowest border border-outline-variant rounded-lg max-w-md w-full p-6 shadow-xl animate-fadeIn relative">
            <button 
              onClick={() => setIsImportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-on-background mb-1">Import Bank Statement</h3>
            <p className="text-xs text-slate-500 mb-4">Support CSV statements (GTBank, Opay, Access, etc.).</p>

            {importSummary ? (
              <div className="p-4 rounded-default bg-primary-container/10 border border-primary-container text-primary text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-medium">{importSummary}</span>
              </div>
            ) : (
              <form onSubmit={handleImportCSV} className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`w-full min-h-[160px] border-2 border-dashed rounded-default flex flex-col items-center justify-center p-4 transition-all cursor-pointer ${
                    isDragging 
                      ? 'border-primary bg-primary-container/5' 
                      : csvFile 
                      ? 'border-secondary bg-surface-low' 
                      : 'border-outline-variant hover:border-slate-400 bg-surface-lowest'
                  }`}
                >
                  <input
                    type="file"
                    id="csv-file-input"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="csv-file-input" className="w-full h-full flex flex-col items-center justify-center cursor-pointer space-y-2">
                    <FileSpreadsheet className={`w-10 h-10 ${csvFile ? 'text-secondary' : 'text-slate-400'}`} />
                    <div className="text-center">
                      {csvFile ? (
                        <p className="text-xs font-bold text-slate-800">{csvFile.name}</p>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-slate-700">Drag & Drop bank statement CSV here</p>
                          <p className="text-[10px] text-slate-400 mt-1">or click to browse local files</p>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                <div className="p-3 bg-surface-low rounded border border-outline-variant/60">
                  <h4 className="text-[10px] font-bold text-slate-700 uppercase font-mono mb-1">Expected CSV Format:</h4>
                  <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
                    Headers should contain: Date, Description (or Narration), and Amount (or separate Debit/Credit columns).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !csvFile}
                  className="w-full py-3 bg-primary hover:bg-[#00522b] text-white font-bold text-sm rounded-default cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_2px_4px_rgba(0,106,57,0.1)]"
                >
                  {loading ? (
                    <span className="border-2 border-white border-t-transparent w-4 h-4 rounded-full animate-spin" />
                  ) : (
                    'Upload & Auto-Categorize'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <span className="text-[10px] text-slate-400 mt-auto mb-4 font-mono">
        NairaAI securely processes your financial data to help you save and budget.
      </span>
    </div>
  );
}

export default App;
