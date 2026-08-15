import { useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { apiGet, apiPatch, apiDelete } from '../api';
import { useAsyncEffect } from '../hooks';
import { formatNaira } from '../utils';
import type { Insight, Transaction, UserProfile } from '../types';

interface InsightsTabProps {
  user: UserProfile;
}

export default function InsightsTab({ user }: InsightsTabProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchInsights = async () => {
    setInsightsLoading(true);
    try {
      const { ok, data } = await apiGet<Insight[]>('/insights');
      if (ok) setInsights(data);
    } finally {
      setInsightsLoading(false);
    }
  };

  // Bug fix: this tab previously never loaded insights until the user
  // manually clicked "Refresh Insights" — every other tab auto-fetches on
  // open, so do the same here.
  useAsyncEffect(async () => {
    fetchInsights();
    const { ok, data } = await apiGet<Transaction[]>('/transactions');
    if (ok) setTransactions(data);
  }, []);

  const handleMarkInsightRead = async (id: string) => {
    await apiPatch(`/insights/${id}/read`);
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
  };

  const handleDismissInsight = async (id: string) => {
    await apiDelete(`/insights/${id}`);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  const expenses = transactions.filter((t) => t.type === 'expense');
  const avgExpense = expenses.length > 0 ? expenses.reduce((sum, t) => sum + Number(t.amount), 0) / expenses.length : 0;
  const anomalies = expenses.filter((t) => Number(t.amount) > avgExpense * 2).slice(0, 3);

  const totalIncome = user?.monthly_income || 0;
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const projectedSavings = Math.max(0, totalIncome - totalExpenses);
  const savingsRate = totalIncome > 0 ? (projectedSavings / totalIncome) * 100 : 0;

  const typeStyle: Record<string, string> = {
    alert: 'bg-error/10 text-error border-error/25',
    trend: 'bg-secondary/10 text-secondary border-secondary/25',
    recommendation: 'bg-primary/10 text-primary border-primary/25',
  };
  const typeLabel: Record<string, string> = { alert: 'ALERT', trend: 'TREND', recommendation: 'TIP' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: Insights Feed */}
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
          {insights.map((insight) => {
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
                  <span>{new Date(insight.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {insight.is_read && <span className="text-slate-300">• Read</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: ML Console + Compliance */}
      <div className="lg:col-span-2 space-y-4">
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

        <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Spending Anomaly Detection
          </h3>
          {anomalies.length > 0 ? (
            <div className="space-y-2">
              {anomalies.map((a) => (
                <div key={a.id} className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-700 p-2 rounded flex justify-between items-center">
                  <span className="truncate pr-2">{a.description}</span>
                  <span className="font-bold shrink-0">{formatNaira(a.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">No unusual spending patterns detected recently.</p>
          )}
        </div>

        <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Savings Projections
          </h3>
          <div className="space-y-2 font-mono text-[11px] text-slate-600 bg-surface-low border border-outline-variant/40 rounded p-3">
            <div className="flex justify-between"><span>Monthly Income:</span><span className="font-bold">{formatNaira(totalIncome)}</span></div>
            <div className="flex justify-between"><span>Total Expenses:</span><span className="font-bold">{formatNaira(totalExpenses)}</span></div>
            <div className="flex justify-between border-t border-slate-200/50 pt-1 text-primary">
              <span>Projected Savings:</span><span className="font-bold">{formatNaira(projectedSavings)} ({savingsRate.toFixed(1)}%)</span>
            </div>
          </div>
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
  );
}
