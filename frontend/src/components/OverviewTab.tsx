import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Coins, Percent } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { apiGet } from '../api';
import { formatNaira, COLORS } from '../utils';
import type { Transaction, TabId } from '../types';

interface OverviewTabProps {
  setActiveTab: (tab: TabId) => void;
}

export default function OverviewTab({ setActiveTab }: OverviewTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    (async () => {
      const { ok, data } = await apiGet<Transaction[]>('/transactions');
      if (ok) setTransactions(data);
    })();
  }, []);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense;

  const savingsRate = totalIncome > 0
    ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100))
    : 0;

  const sortedTxs = [...transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  const dailyMap: { [date: string]: { date: string; Income: number; Expense: number } } = {};
  sortedTxs.forEach((t) => {
    const d = t.transaction_date;
    if (!dailyMap[d]) dailyMap[d] = { date: d, Income: 0, Expense: 0 };
    if (t.type === 'income') dailyMap[d].Income += t.amount;
    else dailyMap[d].Expense += t.amount;
  });
  const dailyData = Object.values(dailyMap);

  const categoryMap: { [name: string]: number } = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const catName = t.category ? t.category.name : 'Uncategorised';
      categoryMap[catName] = (categoryMap[catName] || 0) + t.amount;
    });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  const balanceChangeMap: { [date: string]: number } = {};
  sortedTxs.forEach((t) => {
    const d = t.transaction_date;
    const change = t.type === 'income' ? t.amount : -t.amount;
    balanceChangeMap[d] = (balanceChangeMap[d] || 0) + change;
  });
  const sortedDates = Object.keys(balanceChangeMap).sort();
  let cumulative = 0;
  const savingsTrendData = sortedDates.map((d) => {
    cumulative += balanceChangeMap[d];
    return { date: d, Savings: cumulative };
  });

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-2">
          <p className="font-mono text-label-sm uppercase tracking-wider text-slate-400">Total Income</p>
          <div className="flex justify-between items-center">
            <h3 className="text-lg md:text-xl font-bold font-mono text-primary truncate">{formatNaira(totalIncome)}</h3>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-2">
          <p className="font-mono text-label-sm uppercase tracking-wider text-slate-400">Total Expenses</p>
          <div className="flex justify-between items-center">
            <h3 className="text-lg md:text-xl font-bold font-mono text-tertiary truncate">{formatNaira(totalExpense)}</h3>
            <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary shrink-0">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
        </div>

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
  );
}
