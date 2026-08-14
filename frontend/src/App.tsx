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
  Sparkles,
  Plus,
  Upload,
  Trash2,
  Filter,
  FileSpreadsheet,
  X,
  TrendingDown,
  Percent,
  Coins,
  Menu,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  PiggyBank,
  Settings
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  monthly_income: number;
  profession?: string;
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

interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  month: number;
  year: number;
  category: Category | null;
  spent_amount: number;
  percent_used: number;
  is_breached: boolean;
}

interface Insight {
  id: string;
  user_id: string;
  insight_type: 'alert' | 'trend' | 'recommendation';
  message: string;
  related_category_id: string | null;
  is_read: boolean;
  created_at: string;
  category: Category | null;
}

const COLORS = ['#006a39', '#0058be', '#a23546', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#4b5563'];

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
  // Profile settings state
  const [profileFullName, setProfileFullName] = useState('');
  const [profileIncome, setProfileIncome] = useState('');
  const [profileProfession, setProfileProfession] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');

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

  // Statement import state
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfBank, setPdfBank] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importSummary, setImportSummary] = useState('');

  // ML Retraining state
  const [mlStats, setMlStats] = useState<{
    default_samples: number;
    user_samples: number;
    total_samples: number;
    last_trained?: string;
  } | null>(null);
  const [mlTraining, setMlTraining] = useState(false);
  const [pendingRetrain, setPendingRetrain] = useState(false);

  // Navigation & layout states
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'budgets' | 'insights' | 'settings'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Budgets state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Insights state
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Type', 'Source'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(tx => [
        tx.transaction_date,
        `"${tx.description.replace(/"/g, '""')}"`,
        `"${tx.category?.name || 'Uncategorised'}"`,
        tx.amount,
        tx.type,
        tx.source
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'transactions_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    checkCurrentUser();
  }, []);
  useEffect(() => {
    if (user) {
      setProfileFullName(user.full_name);
      setProfileIncome(user.monthly_income.toString());
      setProfileProfession(user.profession || '');
    }
  }, [user]);

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
    setCurrentPage(1);
    if (view === 'dashboard') {
      fetchTransactions();
      fetchCategories();
    }
  }, [view, filterType, filterCategoryId]);

  // Fetch budgets when budgets tab is active or month/year changes
  useEffect(() => {
    if (view === 'dashboard' && activeTab === 'budgets') {
      fetchBudgets();
    }
  }, [view, activeTab, budgetMonth, budgetYear]);

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
        setPendingRetrain(true);
        fetchTransactions();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to update category');
      }
    } catch (err) {
      console.error('Error updating category:', err);
    }
  };

  const handleRetrainModel = async () => {
    setMlTraining(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API_URL}/ml/train`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to retrain model');
      }
      setMlStats({
        default_samples: data.default_samples,
        user_samples: data.user_samples,
        total_samples: data.total_samples,
        last_trained: new Date().toLocaleTimeString()
      });
      setPendingRetrain(false);
      setSuccessMessage('AI classification model retrained successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchTransactions(); // Refresh predictions/classifications
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during model retraining.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setMlTraining(false);
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

  const handleNukeTransactions = async () => {
    if (!confirm('Are you absolutely sure you want to nuke all your transactions? This cannot be undone!')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/transactions/all`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setSuccessMessage('All transactions have been deleted.');
        setTimeout(() => setSuccessMessage(''), 3000);
        fetchTransactions();
      } else {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete transactions');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: profileFullName,
          monthly_income: parseFloat(profileIncome) || 0,
          profession: profileProfession
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update profile');
      setUser(data);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: profileCurrentPassword,
          new_password: profileNewPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update password');
      setSuccessMessage('Password updated successfully!');
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
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
      if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.pdf')) {
        setStatementFile(file);
      } else {
        alert('Please drop a valid CSV or PDF statement file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStatementFile(e.target.files[0]);
    }
  };

  const handleImportStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementFile) return;

    setLoading(true);
    setImportSummary('');
    const formData = new FormData();
    formData.append('file', statementFile);
    
    let endpoint = '/transactions/import-csv';
    if (statementFile.name.toLowerCase().endsWith('.pdf')) {
      endpoint = '/transactions/import-pdf';
      if (pdfPassword) {
        formData.append('password', pdfPassword);
      }
      if (pdfBank) {
        formData.append('bank', pdfBank);
      }
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Importing failed');
      }

      setImportSummary(data.message);
      setStatementFile(null);
      setPdfPassword('');
      setPdfBank('');
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

  // ── Budget functions ──────────────────────────────────────────────────────
  const fetchBudgets = async () => {
    setBudgetLoading(true);
    try {
      const res = await fetch(`${API_URL}/budgets?month=${budgetMonth}&year=${budgetYear}`, { credentials: 'include' });
      if (res.ok) setBudgets(await res.json());
    } catch (err) { console.error('fetchBudgets error:', err); }
    finally { setBudgetLoading(false); }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetLoading(true);
    try {
      if (editingBudget) {
        const res = await fetch(`${API_URL}/budgets/${editingBudget.id}`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit_amount: parseFloat(budgetLimit) })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      } else {
        const res = await fetch(`${API_URL}/budgets`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: budgetCategoryId, limit_amount: parseFloat(budgetLimit), month: budgetMonth, year: budgetYear })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      }
      setIsBudgetModalOpen(false);
      setEditingBudget(null);
      setBudgetCategoryId('');
      setBudgetLimit('');
      fetchBudgets();
    } catch (err: any) { alert(err.message); }
    finally { setBudgetLoading(false); }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    await fetch(`${API_URL}/budgets/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchBudgets();
  };

  // ── Insights functions ────────────────────────────────────────────────────
  const fetchInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch(`${API_URL}/insights`, { credentials: 'include' });
      if (res.ok) setInsights(await res.json());
    } catch (err) { console.error('fetchInsights error:', err); }
    finally { setInsightsLoading(false); }
  };

  const handleMarkInsightRead = async (id: string) => {
    await fetch(`${API_URL}/insights/${id}/read`, { method: 'PATCH', credentials: 'include' });
    setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
  };

  const handleDismissInsight = async (id: string) => {
    await fetch(`${API_URL}/insights/${id}`, { method: 'DELETE', credentials: 'include' });
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Compute reactive dashboard stats
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense;

  const savingsRate = totalIncome > 0 
    ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) 
    : 0;

  // Prepare chart data matrices chronologically
  const sortedTxs = [...transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  // 1. Daily aggregates for BarChart
  const dailyMap: { [date: string]: { date: string; Income: number; Expense: number } } = {};
  sortedTxs.forEach(t => {
    const d = t.transaction_date;
    if (!dailyMap[d]) {
      dailyMap[d] = { date: d, Income: 0, Expense: 0 };
    }
    if (t.type === 'income') {
      dailyMap[d].Income += t.amount;
    } else {
      dailyMap[d].Expense += t.amount;
    }
  });
  const dailyData = Object.values(dailyMap);

  // 2. Category aggregates for PieChart (Donut)
  const categoryMap: { [name: string]: number } = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const catName = t.category ? t.category.name : 'Uncategorised';
      categoryMap[catName] = (categoryMap[catName] || 0) + t.amount;
    });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value
  }));

  // 3. Savings trend line over dates (cumulative net balances)
  const balanceChangeMap: { [date: string]: number } = {};
  sortedTxs.forEach(t => {
    const d = t.transaction_date;
    const change = t.type === 'income' ? t.amount : -t.amount;
    balanceChangeMap[d] = (balanceChangeMap[d] || 0) + change;
  });
  const sortedDates = Object.keys(balanceChangeMap).sort();
  let cumulative = 0;
  const savingsTrendData = sortedDates.map(d => {
    cumulative += balanceChangeMap[d];
    return {
      date: d,
      Savings: cumulative
    };
  });

  if (view === 'dashboard' && user) {
    return (
      <div className="min-h-screen bg-background flex text-on-background font-sans">
        {/* Desktop Sidebar */}
        <aside className={`hidden md:flex flex-col bg-surface-lowest border-r border-outline-variant/30 h-screen sticky top-0 transition-all duration-300 z-30 shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
          {/* Logo & Collapse button */}
          <div className="p-5 flex items-center justify-between border-b border-outline-variant/20">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center shadow-[0_4px_10px_rgba(0,106,57,0.15)]">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <span className="font-sans font-bold text-xl tracking-tight text-on-background">
                  Naira<span className="text-primary">AI</span>
                </span>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center shadow-[0_4px_10px_rgba(0,106,57,0.15)] mx-auto">
                <Wallet className="w-4 h-4 text-white" />
              </div>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              className={`p-1.5 rounded-default hover:bg-surface-low border border-outline-variant/30 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer ${isSidebarCollapsed ? 'mx-auto' : ''}`}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'transactions', label: 'Transactions', icon: FileSpreadsheet },
              { id: 'budgets', label: 'Budgets', icon: PiggyBank },
              { id: 'insights', label: 'AI Insights & ML', icon: Sparkles },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-default font-semibold text-sm transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-primary text-white shadow-[0_2px_8px_rgba(0,106,57,0.15)]' 
                      : 'text-slate-600 hover:text-slate-950 hover:bg-surface-low'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  title={item.label}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* User profile & Logout */}
          <div className="p-4 border-t border-outline-variant/20 space-y-3 bg-surface-lowest">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-on-background truncate">{user.full_name}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                </div>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm mx-auto" title={user.full_name}>
                {user.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-default font-semibold text-xs text-slate-600 hover:text-error hover:bg-error-container/10 transition-colors border border-transparent hover:border-error/20 cursor-pointer ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              {!isSidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Mobile Header & Sidebar Drawer */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <header className="md:hidden bg-surface-lowest border-b border-outline-variant/30 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <span className="font-sans font-bold text-lg tracking-tight text-on-background">
                Naira<span className="text-primary">AI</span>
              </span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="p-1.5 rounded-default border border-outline-variant/30 hover:bg-surface-low text-slate-600 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </header>

          {/* Mobile Menu Drawer Overlay */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-64 bg-surface-lowest h-full flex flex-col transition-all duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-sans font-bold text-lg tracking-tight text-on-background">
                      Naira<span className="text-primary">AI</span>
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="p-1.5 rounded-default border border-outline-variant/30 hover:bg-surface-low text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                  {[
                    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                    { id: 'transactions', label: 'Transactions', icon: FileSpreadsheet },
                    { id: 'budgets', label: 'Budgets', icon: PiggyBank },
                    { id: 'insights', label: 'AI Insights & ML', icon: Sparkles },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-default font-semibold text-sm transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-primary text-white shadow-[0_2px_8px_rgba(0,106,57,0.15)]' 
                            : 'text-slate-600 hover:text-slate-950 hover:bg-surface-low'
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="p-4 border-t border-outline-variant/20 space-y-3 bg-surface-lowest">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-background truncate">{user.full_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-default font-semibold text-xs text-slate-600 hover:text-error hover:bg-error-container/10 transition-colors border border-transparent hover:border-error/20 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-slate-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Scrollable View Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-on-background capitalize">
                  {activeTab === 'overview' ? 'Financial Overview' : activeTab === 'insights' ? 'AI Insights & ML Model' : activeTab}
                </h1>
                <p className="text-sm text-slate-500">
                  {activeTab === 'overview' && `Welcome back, ${user.full_name}. Here is your financial health status.`}
                  {activeTab === 'transactions' && 'Manage manual and imported financial statements.'}
                  {activeTab === 'budgets' && 'Set monthly spending limits and track your category budgets.'}
                  {activeTab === 'insights' && 'AI-generated alerts, trend analysis, and recommendations.'}
                </p>
              </div>

              {/* Status & Sync */}
              <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start">
                {activeTab === 'overview' && (
                  <div className="bg-surface-low border border-outline-variant/40 px-3 py-1.5 rounded-default flex items-center gap-2">
                    <span className="font-mono text-label-sm text-slate-500 uppercase">Monthly Income:</span>
                    <span className="font-semibold text-sm">{formatNaira(user.monthly_income)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metric Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total Income */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-2">
                    <p className="font-mono text-label-sm uppercase tracking-wider text-slate-400">Total Income</p>
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg md:text-xl font-bold font-mono text-primary truncate">{formatNaira(totalIncome)}</h3>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Total Expenses */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-2">
                    <p className="font-mono text-label-sm uppercase tracking-wider text-slate-400">Total Expenses</p>
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg md:text-xl font-bold font-mono text-tertiary truncate">{formatNaira(totalExpense)}</h3>
                      <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary shrink-0">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Net Savings */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-2">
                    <p className="font-mono text-label-sm uppercase tracking-wider text-slate-400">Net Savings</p>
                    <div className="flex justify-between items-center">
                      <h3 className={`text-lg md:text-xl font-bold font-mono truncate ${netSavings >= 0 ? 'text-secondary' : 'text-error'}`}>
                        {formatNaira(netSavings)}
                      </h3>
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Savings Rate */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-2">
                    <p className="font-mono text-label-sm uppercase tracking-wider text-slate-400">Savings Rate</p>
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg md:text-xl font-bold font-mono text-on-background">{savingsRate}%</h3>
                      <div className="w-8 h-8 rounded-full bg-surface-low border border-outline-variant/55 flex items-center justify-center text-slate-700 shrink-0">
                        <Percent className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Daily Cash Flow */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4 lg:col-span-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Daily Cash Flow</h3>
                      <span className="text-[10px] text-slate-400 font-mono">COMPARATIVE TREND</span>
                    </div>
                    <div className="h-[240px] w-full text-xs">
                      {dailyData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 font-mono text-[11px]">
                          NO TRANSACTION DATA
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                            <Tooltip formatter={(value: any) => formatNaira(Number(value))} contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '4px', fontFamily: 'Inter' }} />
                            <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontFamily: 'Inter', fontSize: '11px' }} />
                            <Bar dataKey="Income" fill="#006a39" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Expense" fill="#a23546" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Expense Breakdown */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Expense Breakdown</h3>
                      <span className="text-[10px] text-slate-400 font-mono">BY CATEGORY</span>
                    </div>
                    <div className="h-[240px] w-full text-xs relative flex items-center justify-center">
                      {categoryData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 font-mono text-[11px]">
                          NO EXPENSE RECORDED
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {categoryData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: any) => formatNaira(Number(value))} contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '4px', fontFamily: 'Inter' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                      {categoryData.length > 0 && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Total Spend</span>
                          <span className="text-sm font-bold text-slate-800 font-mono">{formatNaira(totalExpense)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Savings Curve */}
                <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Savings Accumulation Curve</h3>
                    <span className="text-[10px] text-slate-400 font-mono">CUMULATIVE BALANCE</span>
                  </div>
                  <div className="h-[200px] w-full text-xs">
                    {savingsTrendData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 font-mono text-[11px]">
                        NO TREND DATA AVAILABLE
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={savingsTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <Tooltip formatter={(value: any) => formatNaira(Number(value))} contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '4px', fontFamily: 'Inter' }} />
                          <Line type="monotone" dataKey="Savings" stroke="#0058be" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Recent Activity Widget */}
                <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recent Transactions</h3>
                    <button onClick={() => setActiveTab('transactions')} className="text-xs text-primary font-semibold hover:underline cursor-pointer">
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {transactions.slice(0, 5).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No recent activity.</p>
                    ) : (
                      transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex justify-between items-center py-2.5 border-b border-surface-container/60 last:border-0 text-sm">
                          <div>
                            <p className="font-semibold text-slate-800">{tx.description}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{tx.transaction_date} • {tx.category?.name || 'Uncategorised'}</p>
                          </div>
                          <span className={`font-mono font-medium ${tx.type === 'income' ? 'text-primary' : 'text-slate-800'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatNaira(tx.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TRANSACTIONS */}
            {activeTab === 'transactions' && (
              <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-6">
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-surface-container pb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Transaction Management</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Filter records and track automated classifications.</p>
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

                    {/* Export CSV Button */}
                    <button
                      onClick={handleExportCSV}
                      disabled={transactions.length === 0}
                      className="bg-surface-lowest hover:bg-slate-50 border border-outline-variant text-slate-700 px-3.5 py-2 rounded-default text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  {transactions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 space-y-2">
                      <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300" />
                      <p className="text-sm font-medium">No transactions found.</p>
                      <p className="text-xs">Click "Add Manual" or "Import Statement" to seed details.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-outline-variant text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                          <th className="pb-3 font-semibold">Date</th>
                          <th className="pb-3 font-semibold">Description</th>
                          <th className="pb-3 font-semibold">Source</th>
                          <th className="pb-3 font-semibold">Category</th>
                          <th className="pb-3 font-semibold text-right">Amount</th>
                          <th className="pb-3 font-semibold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTransactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-surface-container/60 hover:bg-slate-50/40 transition-colors">
                            <td className="py-4 text-sm font-mono text-slate-600">{tx.transaction_date}</td>
                            <td className="py-4 text-sm font-medium text-on-background max-w-sm whitespace-normal break-words">{tx.description}</td>
                            <td className="py-4">
                              <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                tx.source === 'csv' 
                                  ? 'bg-secondary-container/10 text-secondary border border-secondary/10' 
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {tx.source}
                              </span>
                            </td>
                            <td className="py-4 space-y-1">
                              <div className="flex items-center gap-2">
                                <select
                                  value={tx.category_id || ''}
                                  onChange={(e) => handleUpdateCategory(tx.id, e.target.value)}
                                  className="bg-transparent hover:bg-surface-low border border-transparent hover:border-outline-variant text-xs text-slate-800 font-semibold rounded py-1 px-1.5 outline-none transition-all cursor-pointer focus:bg-surface-lowest focus:border-secondary"
                                >
                                  <option value="">Uncategorised</option>
                                  {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                  ))}
                                </select>
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
                            <td className={`py-4 text-right font-mono font-medium text-sm ${
                              tx.type === 'income' ? 'text-primary' : 'text-slate-800'
                            }`}>{tx.type === 'income' ? '+' : '-'}{formatNaira(tx.amount)}</td>
                            <td className="py-4 text-center">
                              <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-400 hover:text-error p-1 rounded transition-colors cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-surface-container pt-4 mt-4">
                    <span className="text-xs text-slate-500">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, transactions.length)} of {transactions.length} entries
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 border border-outline-variant rounded-default text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-medium text-slate-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 border border-outline-variant rounded-default text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: BUDGETS */}
            {activeTab === 'budgets' && (
              <div className="space-y-6">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={budgetMonth}
                      onChange={(e) => setBudgetMonth(Number(e.target.value))}
                      className="bg-surface-lowest border border-outline-variant text-sm rounded-default px-3 py-2 text-on-background outline-none cursor-pointer"
                    >
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select
                      value={budgetYear}
                      onChange={(e) => setBudgetYear(Number(e.target.value))}
                      className="bg-surface-lowest border border-outline-variant text-sm rounded-default px-3 py-2 text-on-background outline-none cursor-pointer"
                    >
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => { setEditingBudget(null); setBudgetCategoryId(''); setBudgetLimit(''); setIsBudgetModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-default hover:bg-[#00522b] transition-colors shadow-[0_2px_6px_rgba(0,106,57,0.15)] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Budget
                  </button>
                </div>

                {/* Budget Cards */}
                {budgetLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="border-4 border-primary border-t-transparent w-8 h-8 rounded-full animate-spin" />
                  </div>
                ) : budgets.length === 0 ? (
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-12 text-center shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                    <PiggyBank className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-semibold">No budgets for {MONTH_NAMES[budgetMonth-1]} {budgetYear}</p>
                    <p className="text-xs text-slate-400 mt-1">Click "Add Budget" to set a spending limit for a category.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {budgets.map(budget => {
                      const pct = Math.min(100, budget.percent_used);
                      const barColor = pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
                      const remaining = budget.limit_amount - budget.spent_amount;
                      return (
                        <div key={budget.id} className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-shadow">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-sm text-on-background">{budget.category?.name || 'Unknown'}</p>
                              <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">{MONTH_NAMES[budget.month-1]} {budget.year}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {budget.is_breached && (
                                <span className="text-[9px] font-bold bg-error/10 text-error border border-error/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> BREACHED
                                </span>
                              )}
                              {!budget.is_breached && pct >= 80 && (
                                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-700 border border-amber-400/20 px-2 py-0.5 rounded-full">WARNING</span>
                              )}
                              <button onClick={() => { setEditingBudget(budget); setBudgetLimit(String(budget.limit_amount)); setIsBudgetModalOpen(true); }} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-surface-low transition-colors cursor-pointer" title="Edit">
                                <Filter className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteBudget(budget.id)} className="p-1.5 rounded text-slate-400 hover:text-error hover:bg-error/5 transition-colors cursor-pointer" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-slate-500">Spent: <span className="font-bold text-on-background">{formatNaira(budget.spent_amount)}</span></span>
                              <span className="text-slate-500">Limit: <span className="font-bold text-on-background">{formatNaira(budget.limit_amount)}</span></span>
                            </div>
                            <div className="h-2.5 w-full bg-surface-low border border-outline-variant/20 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className={`font-mono font-bold ${pct >= 100 ? 'text-error' : pct >= 80 ? 'text-amber-600' : 'text-primary'}`}>{pct.toFixed(0)}% used</span>
                              <span className={`font-mono text-slate-500`}>
                                {remaining >= 0 ? `₦${remaining.toLocaleString()} remaining` : `₦${Math.abs(remaining).toLocaleString()} over limit`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: INSIGHTS & ML */}
            {activeTab === 'insights' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Left: Insights Feed — spans 3 cols */}
                <div className="lg:col-span-3 bg-surface-lowest border border-outline-variant/70 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.01)] overflow-hidden">
                  <div className="flex items-center justify-between p-5 border-b border-outline-variant/30">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      AI Insights Feed
                    </h3>
                    <button
                      onClick={fetchInsights}
                      disabled={insightsLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-primary text-white rounded-default hover:bg-[#00522b] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {insightsLoading ? <span className="border-2 border-white border-t-transparent w-3 h-3 rounded-full animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                      {insightsLoading ? 'Analysing...' : 'Refresh Insights'}
                    </button>
                  </div>

                  <div className="divide-y divide-outline-variant/20 max-h-[600px] overflow-y-auto">
                    {insights.length === 0 && !insightsLoading && (
                      <div className="p-10 text-center">
                        <Sparkles className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm font-semibold">No insights yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">Click "Refresh Insights" to run the AI engine against your transactions.</p>
                      </div>
                    )}
                    {insights.map(insight => {
                      const typeStyle: Record<string, string> = {
                        alert: 'bg-error/10 text-error border-error/25',
                        trend: 'bg-secondary/10 text-secondary border-secondary/25',
                        recommendation: 'bg-primary/10 text-primary border-primary/25',
                      };
                      const typeLabel: Record<string, string> = { alert: 'ALERT', trend: 'TREND', recommendation: 'TIP' };
                      const TypeIcon = insight.insight_type === 'alert' ? AlertTriangle : insight.insight_type === 'trend' ? TrendingUp : Sparkles;
                      return (
                        <div key={insight.id} className={`p-4 space-y-2 transition-all ${insight.is_read ? 'opacity-60 bg-surface-low/40' : 'bg-surface-lowest'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <span className={`inline-flex items-center gap-1 text-[9px] font-bold border px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${typeStyle[insight.insight_type]}`}>
                                <TypeIcon className="w-2.5 h-2.5" />
                                {typeLabel[insight.insight_type]}
                              </span>
                              <p className="text-[12px] text-slate-700 leading-relaxed">{insight.message}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!insight.is_read && (
                                <button onClick={() => handleMarkInsightRead(insight.id)} title="Mark as read" className="p-1.5 rounded text-slate-400 hover:text-primary hover:bg-primary/5 cursor-pointer transition-colors">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => handleDismissInsight(insight.id)} title="Dismiss" className="p-1.5 rounded text-slate-400 hover:text-error hover:bg-error/5 cursor-pointer transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pl-7">
                            {insight.category && <span className="bg-surface-low border border-outline-variant/40 px-1.5 py-0.5 rounded">{insight.category.name}</span>}
                            <span>{new Date(insight.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span>
                            {insight.is_read && <span className="text-slate-300">• Read</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: ML Console + Compliance — spans 2 cols */}
                <div className="lg:col-span-2 space-y-4">

                  {/* NDPA Compliance */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      NDPA Compliance
                    </h3>
                    <div className="inline-flex items-center gap-1.5 bg-[#e2f9ec] text-[#006a39] text-[10px] font-bold px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Consent Active</span>
                    </div>
                    <div className="space-y-1.5 font-mono text-[10.5px] text-slate-500 border-t border-outline-variant/40 pt-2.5">
                      <div className="flex justify-between"><span>Authorized:</span><span className="text-slate-800 font-semibold">{user.consent_given ? 'YES' : 'NO'}</span></div>
                      <div className="flex justify-between"><span>Consent Date:</span><span className="text-slate-800 font-semibold">{user.consent_date ? new Date(user.consent_date).toLocaleDateString() : 'N/A'}</span></div>
                    </div>
                    <p className="text-[10.5px] leading-relaxed text-slate-500">
                      Data is processed under NDPA (2023). You hold the right to erasure at any time.
                    </p>
                  </div>

                  {/* Dynamic AI Insights */}
                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Spending Anomaly Detection
                    </h3>
                    {(() => {
                      const expenses = transactions.filter(t => t.type === 'expense');
                      const avgExpense = expenses.length > 0 ? expenses.reduce((sum, t) => sum + Number(t.amount), 0) / expenses.length : 0;
                      const anomalies = expenses.filter(t => Number(t.amount) > avgExpense * 2).slice(0, 3);
                      return anomalies.length > 0 ? (
                        <div className="space-y-2">
                          {anomalies.map(a => (
                            <div key={a.id} className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-700 p-2 rounded flex justify-between items-center">
                              <span className="truncate pr-2">{a.description}</span>
                              <span className="font-bold shrink-0">{formatNaira(a.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">No unusual spending patterns detected recently.</p>
                      );
                    })()}
                  </div>

                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Savings Projections
                    </h3>
                    {(() => {
                      const totalIncome = user?.monthly_income || 0;
                      const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
                      const projectedSavings = Math.max(0, totalIncome - totalExpenses);
                      const savingsRate = totalIncome > 0 ? (projectedSavings / totalIncome) * 100 : 0;
                      return (
                        <div className="space-y-2 font-mono text-[11px] text-slate-600 bg-surface-low border border-outline-variant/40 rounded p-3">
                          <div className="flex justify-between"><span>Monthly Income:</span><span className="font-bold">{formatNaira(totalIncome)}</span></div>
                          <div className="flex justify-between"><span>Total Expenses:</span><span className="font-bold">{formatNaira(totalExpenses)}</span></div>
                          <div className="flex justify-between border-t border-slate-200/50 pt-1 text-primary">
                            <span>Projected Savings:</span><span className="font-bold">{formatNaira(projectedSavings)} ({savingsRate.toFixed(1)}%)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-secondary" />
                      Personalized Tips
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed bg-secondary-container/10 border border-secondary/20 p-3 rounded">
                      {user?.profession 
                        ? `As a ${user.profession}, consider setting aside a portion of your income for professional development or industry-specific emergency funds. Your current spending aligns with typical benchmarks for your role.`
                        : `Consider updating your profile with your profession to receive customized financial strategies and peer comparisons.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-on-background">Settings</h2>
                  <p className="text-slate-500 text-sm mt-1">Manage your account and preferences.</p>
                </div>
                
                {/* Profile Form */}
                <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-on-background mb-4">Profile Details</h3>
                  <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Full Name</label>
                      <input type="text" required value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Monthly Income (₦)</label>
                      <input type="number" required min="0" value={profileIncome} onChange={(e) => setProfileIncome(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Profession / Occupation</label>
                      <input type="text" placeholder="e.g. Software Engineer" value={profileProfession} onChange={(e) => setProfileProfession(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
                    </div>
                    <button type="submit" disabled={loading} className="px-4 py-2 bg-primary hover:bg-[#00522b] text-white rounded-default font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50">
                      {loading ? 'Saving...' : 'Save Profile'}
                    </button>
                  </form>
                </div>

                {/* Password Form */}
                <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-on-background mb-4">Security</h3>
                  <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-lg">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Current Password</label>
                      <input type="password" required value={profileCurrentPassword} onChange={(e) => setProfileCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">New Password</label>
                      <input type="password" required minLength={8} value={profileNewPassword} onChange={(e) => setProfileNewPassword(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
                    </div>
                    <button type="submit" disabled={loading} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-default font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50">
                      {loading ? 'Saving...' : 'Update Password'}
                    </button>
                  </form>
                </div>

                <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-error mb-4">Danger Zone</h3>
                  <div className="border border-error/20 bg-error/5 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-error">Nuke All Transactions</h4>
                      <p className="text-sm text-slate-600 mt-1 max-w-md">Permanently delete all your imported and manually created transactions. This action cannot be undone.</p>
                    </div>
                    <button 
                      onClick={handleNukeTransactions}
                      disabled={loading}
                      className="px-5 py-2.5 bg-error hover:bg-[#b91c1c] text-white rounded-default font-bold text-sm shadow-sm transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Nuking...' : 'Nuke All Data'}
                    </button>
                  </div>
                </div>

                {/* ML Retraining Console (Admin/Settings) */}
                <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-on-background mb-4">ML Retraining</h3>
                  <div className="space-y-1 font-mono text-[10px] text-slate-500 bg-surface-low border border-outline-variant/40 rounded p-3">
                    <div className="flex justify-between"><span>Classifier:</span><span className="text-slate-800 font-bold">TF-IDF + LogReg</span></div>
                    <div className="flex justify-between"><span>Base Templates:</span><span className="text-slate-800 font-bold">{mlStats ? mlStats.default_samples : 49}</span></div>
                    <div className="flex justify-between"><span>User Corrections:</span><span className="text-slate-800 font-bold">{mlStats ? mlStats.user_samples : transactions.filter(t => t.category_id !== null).length}</span></div>
                    <div className="flex justify-between border-t border-slate-200/50 pt-1"><span>Total Dataset:</span><span className="text-slate-800 font-bold">{mlStats ? mlStats.total_samples : 49 + transactions.filter(t => t.category_id !== null).length}</span></div>
                    {mlStats?.last_trained && <div className="flex justify-between"><span>Last Trained:</span><span className="text-slate-800 font-bold">{mlStats.last_trained}</span></div>}
                  </div>
                  {pendingRetrain && (
                    <div className="p-3 rounded-default bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 mt-4">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10.5px] text-amber-700">Model outdated — new corrections available. Retrain to improve accuracy.</p>
                    </div>
                  )}
                  <button
                    onClick={handleRetrainModel}
                    disabled={mlTraining}
                    className={`w-full py-2.5 mt-4 text-xs font-bold text-white rounded-default cursor-pointer transition-all active:scale-[0.98] ${
                      pendingRetrain ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-[#00522b]'
                    } disabled:opacity-50 shadow-[0_2px_6px_rgba(0,0,0,0.08)]`}
                  >
                    {mlTraining ? (
                      <span className="flex items-center justify-center gap-2"><span className="border-2 border-white border-t-transparent w-3.5 h-3.5 rounded-full animate-spin" /> Retraining...</span>
                    ) : 'Retrain AI Model'}
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Global Modals inside Authed Dashboard */}
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
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
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
              <p className="text-xs text-slate-500 mb-4">Support CSV and PDF statements (GTBank, Opay, Access, etc.).</p>

              {importSummary ? (
                <div className="p-4 rounded-default bg-primary-container/10 border border-primary-container text-primary text-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="font-medium">{importSummary}</span>
                </div>
              ) : (
                <form onSubmit={handleImportStatement} className="space-y-4">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`w-full min-h-[160px] border-2 border-dashed rounded-default flex flex-col items-center justify-center p-4 transition-all cursor-pointer ${
                      isDragging 
                        ? 'border-primary bg-primary-container/5' 
                        : statementFile 
                        ? 'border-secondary bg-surface-low' 
                        : 'border-outline-variant hover:border-slate-400 bg-surface-lowest'
                    }`}
                  >
                    <input
                      type="file"
                      id="statement-file-input"
                      accept=".csv, .pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="statement-file-input" className="w-full h-full flex flex-col items-center justify-center cursor-pointer space-y-2">
                      <FileSpreadsheet className={`w-10 h-10 ${statementFile ? 'text-secondary' : 'text-slate-400'}`} />
                      <div className="text-center">
                        {statementFile ? (
                          <p className="text-xs font-bold text-slate-800">{statementFile.name}</p>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-slate-700">Drag & Drop bank statement CSV or PDF here</p>
                            <p className="text-[10px] text-slate-400 mt-1">or click to browse local files</p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                  
                  {statementFile && statementFile.name.toLowerCase().endsWith('.pdf') && (
                    <div className="space-y-3 mt-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Bank (Optional)</label>
                        <select
                          value={pdfBank}
                          onChange={(e) => setPdfBank(e.target.value)}
                          className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary bg-surface-lowest text-on-background transition-all"
                        >
                          <option value="">Auto-detect / Other</option>
                          <option value="opay">OPay</option>
                          <option value="providus">Providus Bank</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">PDF Password (if protected)</label>
                        <input
                          type="password"
                          placeholder="Leave blank if none"
                          value={pdfPassword}
                          onChange={(e) => setPdfPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-surface-low rounded border border-outline-variant/60">
                    <h4 className="text-[10px] font-bold text-slate-700 uppercase font-mono mb-1">Expected Format:</h4>
                    <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
                      Tables should contain: Date, Description (or Narration), and Amount (or separate Debit/Credit columns).
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !statementFile}
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

        {/* Budget Modal */}
        {isBudgetModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-lowest border border-outline-variant rounded-lg max-w-sm w-full p-6 shadow-xl relative">
              <button onClick={() => setIsBudgetModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-on-background mb-4">
                {editingBudget ? 'Edit Budget Limit' : 'Add New Budget'}
              </h3>
              <form onSubmit={handleSaveBudget} className="space-y-4">
                {!editingBudget && (
                  <div className="space-y-1">
                    <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Category</label>
                    <select
                      required
                      value={budgetCategoryId}
                      onChange={(e) => setBudgetCategoryId(e.target.value)}
                      className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none"
                    >
                      <option value="">Select a category...</option>
                      {categories.filter(c => c.type === 'expense').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Monthly Limit (₦)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50000"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={budgetLoading}
                  className="w-full py-3 bg-primary hover:bg-[#00522b] text-white font-bold text-sm rounded-default cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_2px_4px_rgba(0,106,57,0.1)]"
                >
                  {budgetLoading ? <span className="border-2 border-white border-t-transparent w-4 h-4 rounded-full animate-spin" /> : (editingBudget ? 'Save Changes' : 'Create Budget')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Otherwise render the unauthed Login/Register Shell
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

      {/* Footer */}
      <span className="text-[10px] text-slate-400 mt-8 mb-4 font-mono">
        NairaAI securely processes your financial data to help you save and budget.
      </span>
    </div>
  );
}

export default App;
