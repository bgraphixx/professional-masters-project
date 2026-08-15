import type { Transaction } from './types';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const COLORS = ['#006a39', '#0058be', '#a23546', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#4b5563'];

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function computeSavingsTrend(sortedDates: string[], balanceChangeMap: Record<string, number>) {
  let cumulative = 0;
  return sortedDates.map((d) => {
    cumulative += balanceChangeMap[d];
    return { date: d, Savings: cumulative };
  });
}

export function exportTransactionsCSV(transactions: Transaction[]) {
  if (transactions.length === 0) return;
  const headers = ['Date', 'Description', 'Category', 'Amount', 'Type', 'Source'];
  const csvContent = [
    headers.join(','),
    ...transactions.map((tx) => [
      tx.transaction_date,
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${tx.category?.name || 'Uncategorised'}"`,
      tx.amount,
      tx.type,
      tx.source,
    ].join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'transactions_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
