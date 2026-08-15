import { useState } from 'react';
import { Plus, Filter, Trash2, AlertTriangle, PiggyBank, X } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, apiErrorDetail } from '../api';
import { useAsyncEffect } from '../hooks';
import { formatNaira, MONTH_NAMES } from '../utils';
import type { Budget, Category } from '../types';

function errorMessageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function BudgetsTab() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [budgetLoading, setBudgetLoading] = useState(false);

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');

  useAsyncEffect(async () => {
    const { ok, data } = await apiGet<Category[]>('/transactions/categories');
    if (ok) setCategories(data);
  }, []);

  const fetchBudgets = async () => {
    setBudgetLoading(true);
    try {
      const { ok, data } = await apiGet<Budget[]>(`/budgets?month=${budgetMonth}&year=${budgetYear}`);
      if (ok) setBudgets(data);
    } finally {
      setBudgetLoading(false);
    }
  };

  useAsyncEffect(fetchBudgets, [budgetMonth, budgetYear]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetLoading(true);
    try {
      const result = editingBudget
        ? await apiPut<Budget>(`/budgets/${editingBudget.id}`, { limit_amount: parseFloat(budgetLimit) })
        : await apiPost<Budget>('/budgets', {
            category_id: budgetCategoryId,
            limit_amount: parseFloat(budgetLimit),
            month: budgetMonth,
            year: budgetYear,
          });
      if (!result.ok) throw new Error(apiErrorDetail(result.data, 'Failed to save budget'));

      setIsBudgetModalOpen(false);
      setEditingBudget(null);
      setBudgetCategoryId('');
      setBudgetLimit('');
      fetchBudgets();
    } catch (err) {
      alert(errorMessageOf(err, 'Failed to save budget'));
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    await apiDelete(`/budgets/${id}`);
    fetchBudgets();
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <select
            value={budgetMonth}
            onChange={(e) => setBudgetMonth(Number(e.target.value))}
            className="bg-surface-lowest border border-outline-variant text-sm rounded-default px-3 py-2 text-on-background outline-none cursor-pointer"
          >
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={budgetYear}
            onChange={(e) => setBudgetYear(Number(e.target.value))}
            className="bg-surface-lowest border border-outline-variant text-sm rounded-default px-3 py-2 text-on-background outline-none cursor-pointer"
          >
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
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
          <p className="text-slate-600 font-semibold">No budgets for {MONTH_NAMES[budgetMonth - 1]} {budgetYear}</p>
          <p className="text-xs text-slate-400 mt-1">Click "Add Budget" to set a spending limit for a category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const pct = Math.min(100, budget.percent_used);
            const barColor = pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
            const remaining = budget.limit_amount - budget.spent_amount;
            return (
              <div key={budget.id} className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm text-on-background">{budget.category?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">{MONTH_NAMES[budget.month - 1]} {budget.year}</p>
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

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-500">Spent: <span className="font-bold text-on-background">{formatNaira(budget.spent_amount)}</span></span>
                    <span className="text-slate-500">Limit: <span className="font-bold text-on-background">{formatNaira(budget.limit_amount)}</span></span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-low border border-outline-variant/20 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className={`font-mono font-bold ${pct >= 100 ? 'text-error' : pct >= 80 ? 'text-amber-600' : 'text-primary'}`}>{pct.toFixed(0)}% used</span>
                    <span className="font-mono text-slate-500">
                      {remaining >= 0 ? `₦${remaining.toLocaleString()} remaining` : `₦${Math.abs(remaining).toLocaleString()} over limit`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
                    {categories.filter((c) => c.type === 'expense').map((cat) => (
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
